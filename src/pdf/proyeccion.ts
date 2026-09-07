// Geometría de la gráfica de proyección y frase de balance del seguimiento (SPEC-ux §4.5b).
// Aquí no se calcula ningún peso: la curva llega hecha en `resultado.proyeccion` (motor, paso 14b)
// y los pesajes llegan tal cual desde `DatosPdf.pesajes`. Este módulo solo convierte kilos y
// semanas en coordenadas, y elige (no redacta) una de las cuatro frases normativas de §2.6c.
import type { ObjetivoEfectivo, Pesaje, PuntoProyeccion } from '../engine/types'

// ---------- Escala de la gráfica ----------

/** Lienzo en puntos PDF. Ancho útil de la página A4 con los márgenes del documento (595 - 84). */
export const GRAFICA = {
  ancho: 500,
  alto: 168,
  margenIzq: 40,
  margenDer: 10,
  margenSup: 14,
  margenInf: 18,
} as const

export interface EscalaProyeccion {
  ancho: number
  alto: number
  /** Rectángulo de dibujo (coordenadas del SVG, y crece hacia abajo). */
  x0: number
  x1: number
  y0: number
  y1: number
  semanaMax: number
  kgMin: number
  kgMax: number
  /** Semana -> coordenada x. */
  x: (semana: number) => number
  /** Kilos -> coordenada y, acotada al rectángulo de dibujo. */
  y: (kg: number) => number
  /** Semanas con marca en el eje horizontal (cada 4). */
  marcasX: number[]
  /** Kilos con marca en el eje vertical (5 marcas). */
  marcasY: number[]
}

function finito(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

/**
 * Escala de la gráfica a partir de la proyección del motor.
 *
 * El rango vertical es el de `SPEC-ux §2.6b` —`[min(peso_min) - 1, max(peso_max) + 1]` redondeado
 * al kilo— **ampliado con los kilos de `extras`** (los pesajes y la línea de objetivo): un punto
 * fuera del rectángulo se dibujaría sobre el eje y el usuario vería su pesaje pegado al borde.
 */
export function crearEscala(
  proyeccion: readonly PuntoProyeccion[],
  extras: readonly number[] = [],
): EscalaProyeccion | null {
  const puntos = (proyeccion ?? []).filter(
    (p) => p && finito(p.semana) && finito(p.peso_min) && finito(p.peso_esp) && finito(p.peso_max),
  )
  if (puntos.length === 0) return null

  const semanaMax = Math.max(1, ...puntos.map((p) => p.semana))
  const kilos = [
    ...puntos.map((p) => p.peso_min),
    ...puntos.map((p) => p.peso_max),
    ...extras.filter(finito),
  ]
  let kgMin = Math.floor(Math.min(...kilos) - 1)
  let kgMax = Math.ceil(Math.max(...kilos) + 1)
  if (kgMax - kgMin < 4) {
    // Con una banda plana el rango sería de 2 kg y la curva quedaría pegada al centro sin escala
    // legible: se ensancha a 4 kg simétricos.
    const centro = (kgMax + kgMin) / 2
    kgMin = Math.floor(centro - 2)
    kgMax = Math.ceil(centro + 2)
  }

  const x0 = GRAFICA.margenIzq
  const x1 = GRAFICA.ancho - GRAFICA.margenDer
  const y0 = GRAFICA.margenSup
  const y1 = GRAFICA.alto - GRAFICA.margenInf

  const x = (semana: number) => {
    const s = finito(semana) ? Math.max(0, Math.min(semanaMax, semana)) : 0
    return x0 + (s / semanaMax) * (x1 - x0)
  }
  const y = (kg: number) => {
    const k = finito(kg) ? Math.max(kgMin, Math.min(kgMax, kg)) : kgMin
    return y1 - ((k - kgMin) / (kgMax - kgMin)) * (y1 - y0)
  }

  const marcasX: number[] = []
  for (let s = 0; s <= semanaMax; s += 4) marcasX.push(s)
  const marcasY = [0, 1, 2, 3, 4].map((i) => kgMin + ((kgMax - kgMin) * i) / 4)

  return { ancho: GRAFICA.ancho, alto: GRAFICA.alto, x0, x1, y0, y1, semanaMax, kgMin, kgMax, x, y, marcasX, marcasY }
}

/** Path de la banda: de izquierda a derecha por `peso_max` y de vuelta por `peso_min`. */
export function pathBanda(puntos: readonly PuntoProyeccion[], e: EscalaProyeccion): string {
  if (puntos.length === 0) return ''
  const ida = puntos.map((p, i) => `${i === 0 ? 'M' : 'L'} ${e.x(p.semana).toFixed(2)} ${e.y(p.peso_max).toFixed(2)}`)
  const vuelta = [...puntos]
    .reverse()
    .map((p) => `L ${e.x(p.semana).toFixed(2)} ${e.y(p.peso_min).toFixed(2)}`)
  return `${ida.join(' ')} ${vuelta.join(' ')} Z`
}

/** Puntos de una polilínea `x,y x,y ...` para la curva central o para los pesajes. */
export function puntosPolilinea(pares: readonly { x: number; y: number }[]): string {
  return pares.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')
}

// ---------- Seguimiento (§2.6c y §4.5b) ----------

const MS_DIA = 86_400_000
const RE_ISO = /^(\d{4})-(\d{2})-(\d{2})$/

function aFecha(iso: string | null | undefined): number | null {
  if (typeof iso !== 'string') return null
  const m = iso.trim().match(RE_ISO)
  if (!m) return null
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isFinite(t) ? t : null
}

/** `s = floor((fecha_pesaje - fecha_inicio) / 7 días)`, acotada a `[0, última semana]` (§2.6c). */
export function semanaDePesaje(fechaPesaje: string, fechaInicio: string, semanaMax: number): number {
  const a = aFecha(fechaPesaje)
  const b = aFecha(fechaInicio)
  if (a === null || b === null) return 0
  const semanas = Math.floor((a - b) / (7 * MS_DIA))
  return Math.max(0, Math.min(semanaMax, semanas))
}

/** Pesajes válidos ordenados de más antiguo a más reciente. */
export function pesajesOrdenados(pesajes: readonly Pesaje[] | undefined): Pesaje[] {
  return (pesajes ?? [])
    .filter((p): p is Pesaje => !!p && finito(p.kg) && aFecha(p.fecha) !== null)
    .slice()
    .sort((a, b) => (aFecha(a.fecha) ?? 0) - (aFecha(b.fecha) ?? 0))
}

export const CIERRE_BALANCE = 'Recalcula tu plan cada 4-6 semanas, o antes si has cambiado 5 kg.'

const SEGUIR_POR_DELANTE =
  'Ojo con acelerar: ir más rápido de lo previsto suele costar músculo. Si el ritmo se mantiene así, recalcula.'
const SEGUIR_POR_DETRAS =
  'Una semana no dice nada: el peso oscila por agua, sal e intestino. Si en tres o cuatro semanas seguidas ' +
  'sigue así, es que el gasto estimado no era el tuyo.'
const FUERA_DE_BANDA =
  'Tu peso se ha movido más de un kilo respecto al de partida. En un plan de mantenimiento o de recomposición ' +
  'eso suele ser agua; si se mantiene tres o cuatro semanas, recalcula con tu peso real.'

function unKilo(valor: number): string {
  return `${Math.abs(valor).toFixed(1).replace('.', ',')} kg`
}

/**
 * Frases de balance de §2.6c, elegidas **solo con el pesaje más reciente**. Devuelve la lista de
 * párrafos (la frase elegida más el cierre fijo) o `null` cuando no hay que decir nada: con menos
 * de dos pesajes un punto suelto no es una tendencia.
 */
export function fraseBalance(
  pesajes: readonly Pesaje[] | undefined,
  proyeccion: readonly PuntoProyeccion[] | undefined,
  fechaInicio: string,
  objetivo: ObjetivoEfectivo,
  plana: boolean,
): string[] | null {
  const lista = pesajesOrdenados(pesajes)
  if (lista.length < 2 || !proyeccion || proyeccion.length === 0) return null

  const ultimo = lista[lista.length - 1]
  const semanaMax = Math.max(...proyeccion.map((p) => p.semana))
  const semana = semanaDePesaje(ultimo.fecha, fechaInicio, semanaMax)
  const punto = proyeccion.find((p) => p.semana === semana) ?? proyeccion[proyeccion.length - 1]
  if (!punto) return null

  const dentro = ultimo.kg >= punto.peso_min && ultimo.kg <= punto.peso_max
  const diferencia = unKilo(ultimo.kg - punto.peso_esp)
  const enBanda = `Vas dentro de lo previsto para la semana ${semana}. No hay nada que cambiar.`

  if (plana || (objetivo !== 'perder' && objetivo !== 'ganar')) {
    return dentro ? [enBanda, CIERRE_BALANCE] : [FUERA_DE_BANDA, CIERRE_BALANCE]
  }
  if (dentro) return [enBanda, CIERRE_BALANCE]

  const porDelante = objetivo === 'perder' ? ultimo.kg < punto.peso_min : ultimo.kg > punto.peso_max
  if (porDelante) {
    const sentido = objetivo === 'perder' ? 'por debajo' : 'por encima'
    return [
      `Vas por delante de la previsión: ${diferencia} ${sentido} de lo que esperábamos para la semana ${semana}.`,
      SEGUIR_POR_DELANTE,
      CIERRE_BALANCE,
    ]
  }
  const sentido = objetivo === 'perder' ? 'por encima' : 'por debajo'
  return [
    `Vas por detrás de la previsión: ${diferencia} ${sentido} de lo que esperábamos para la semana ${semana}.`,
    SEGUIR_POR_DETRAS,
    CIERRE_BALANCE,
  ]
}
