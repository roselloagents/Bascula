// Cuotas por IP, cuota global y presupuesto en euros, persistidos en `${BASCULA_DATOS}/cuotas.json`
// (SPEC-dieta-propia §7). Todo es del día UTC: al cambiar de día los contadores vuelven a cero.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export type MotivoCuota = 'CUOTA_IP' | 'CUOTA_GLOBAL' | 'PRESUPUESTO'

export interface EstadoCuotas {
  fecha: string
  global: number
  euros: number
  ips: Record<string, number>
}

export interface Limites {
  /** `null` si puede pasar; si no, el código del `429`. */
  comprobar(ip: string): MotivoCuota | null
  /** Suma una interpretación a la IP y al contador global, y persiste. */
  registrarPeticion(ip: string): void
  /** Suma el coste de UNA llamada al modelo (también la del reintento), y persiste. */
  registrarCoste(euros: number): void
  estado(): EstadoCuotas
  /** Persiste (se llama en `SIGTERM`). */
  guardar(): void
}

export interface OpcionesLimites {
  carpeta: string
  topeIpDia: number
  topeGlobalDia: number
  topeEurosDia: number
  ahora?: () => number
  /** Tope del mapa de IPs; al pasarlo se desaloja la menos usada recientemente. */
  maxIps?: number
  /** Para los tests: sin esto se escribe de verdad en disco. */
  persistir?: boolean
}

export const MAX_IPS = 10000
export const NOMBRE_FICHERO = 'cuotas.json'

export function crearLimites(opciones: OpcionesLimites): Limites {
  const ahora = opciones.ahora ?? (() => Date.now())
  const maxIps = opciones.maxIps ?? MAX_IPS
  const persistir = opciones.persistir ?? true
  const ruta = join(opciones.carpeta, NOMBRE_FICHERO)

  let fecha = fechaUtc(ahora())
  let global = 0
  let euros = 0
  // El orden de inserción del Map es el del desalojo LRU: el primero es el menos usado.
  let ips = new Map<string, number>()
  let avisadoDeEscritura = false

  cargar()

  function cargar(): void {
    if (!persistir) return
    let crudo: string
    try {
      crudo = readFileSync(ruta, 'utf8')
    } catch {
      return // Primer arranque: todavía no hay fichero.
    }
    try {
      const leido: unknown = JSON.parse(crudo)
      if (typeof leido !== 'object' || leido === null) return
      const estado = leido as Partial<EstadoCuotas>
      if (estado.fecha !== fecha) return // Es de otro día: se empieza de cero.
      global = numero(estado.global)
      euros = numero(estado.euros)
      const guardadas = estado.ips
      if (typeof guardadas === 'object' && guardadas !== null) {
        for (const [clave, valor] of Object.entries(guardadas)) {
          if (clave === '__proto__') continue
          ips.set(clave, numero(valor))
        }
        podar()
      }
    } catch {
      // Fichero corrupto: se ignora y se sigue con los contadores a cero.
    }
  }

  function guardar(): void {
    if (!persistir) return
    const destino = ruta
    const temporal = `${destino}.tmp`
    try {
      mkdirSync(dirname(destino), { recursive: true })
      writeFileSync(temporal, JSON.stringify(estado()), 'utf8')
      renameSync(temporal, destino)
    } catch (error) {
      if (!avisadoDeEscritura) {
        avisadoDeEscritura = true
        console.error(
          JSON.stringify({
            evento: 'cuotas_no_persistidas',
            ruta: destino,
            error: error instanceof Error ? error.message : 'desconocido',
          }),
        )
      }
    }
  }

  function rodarDia(): void {
    const hoy = fechaUtc(ahora())
    if (hoy === fecha) return
    fecha = hoy
    global = 0
    euros = 0
    ips = new Map()
  }

  function podar(): void {
    while (ips.size > maxIps) {
      const primera = ips.keys().next()
      if (primera.done === true) break
      ips.delete(primera.value)
    }
  }

  function estado(): EstadoCuotas {
    return { fecha, global, euros, ips: Object.fromEntries(ips) }
  }

  return {
    comprobar(ip) {
      rodarDia()
      const clave = claveIp(ip)
      if ((ips.get(clave) ?? 0) >= opciones.topeIpDia) return 'CUOTA_IP'
      if (global >= opciones.topeGlobalDia) return 'CUOTA_GLOBAL'
      if (euros >= opciones.topeEurosDia) return 'PRESUPUESTO'
      return null
    },
    registrarPeticion(ip) {
      rodarDia()
      const clave = claveIp(ip)
      const previo = ips.get(clave) ?? 0
      ips.delete(clave) // Recolocar al final = "usada ahora mismo" (LRU).
      ips.set(clave, previo + 1)
      podar()
      global += 1
      guardar()
    },
    registrarCoste(cantidad) {
      rodarDia()
      if (Number.isFinite(cantidad) && cantidad > 0) euros += cantidad
      guardar()
    },
    estado,
    guardar,
  }
}

/** Fecha UTC en `YYYY-MM-DD`. */
export function fechaUtc(ahora: number): string {
  return new Date(ahora).toISOString().slice(0, 10)
}

/**
 * Clave de cuota de una IP. IPv4 tal cual; IPv6 agregada por /64 (los cuatro primeros grupos),
 * porque un solo cliente tiene a su disposición todo un /64.
 */
export function claveIp(ip: string): string {
  const limpia = (ip || 'desconocida').trim().toLowerCase()
  const sinZona = limpia.split('%')[0] ?? limpia
  if (!sinZona.includes(':')) return sinZona
  const mapeada = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(sinZona)
  if (mapeada) return mapeada[1] as string
  return `${expandir(sinZona).slice(0, 4).join(':')}::/64`
}

/** Los ocho grupos de una IPv6, con el `::` ya desplegado. */
function expandir(ip: string): string[] {
  const partes = ip.split('::')
  const izquierda = (partes[0] ?? '').split(':').filter((g) => g !== '')
  const derecha = partes.length > 1 ? (partes[1] ?? '').split(':').filter((g) => g !== '') : []
  const huecos = 8 - izquierda.length - derecha.length
  const medio = partes.length > 1 && huecos > 0 ? Array<string>(huecos).fill('0') : []
  const grupos = [...izquierda, ...medio, ...derecha]
  while (grupos.length < 8) grupos.push('0')
  return grupos.slice(0, 8).map((g) => g.replace(/^0+(?=.)/, ''))
}

function numero(valor: unknown): number {
  return typeof valor === 'number' && Number.isFinite(valor) && valor > 0 ? valor : 0
}
