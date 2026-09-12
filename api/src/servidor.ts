// Servidor HTTP de la v1.3: arranque, rutas, cabeceras, cuotas y tiempos (SPEC-dieta-propia §2 y §7).
// Node 24 ejecuta este .ts sin build. El cliente del modelo se inyecta: los tests no tocan la red.
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AlimentoCatalogo } from './catalogo.ts'
import { cargarCatalogo } from './catalogo.ts'
import { validarEntrada, validarEntradaProponer } from './esquema.ts'
import type { ClienteModelo, UsoModelo } from './interpretar.ts'
import {
  ESFUERZO_POR_DEFECTO,
  type Esfuerzo,
  MODELO_POR_DEFECTO,
  construirSistema,
  esfuerzoAdmitido,
  interpretarTexto,
  modeloAdmitido,
} from './interpretar.ts'
import type { Limites } from './limites.ts'
import { crearLimites, fechaUtc } from './limites.ts'
import { construirSistemaProponer, proponerHuecos } from './proponer.ts'
import { crearToken, secretoAleatorio, tokenValido } from './token.ts'

export const VERSION = '1.3.0'
/** Tope del cuerpo de `/api/dieta/interpretar` (§7). nginx corta antes, a 64 KB. */
export const MAX_CUERPO = 16 * 1024
/** Tope del cuerpo de `/api/dieta/proponer` (§4bis.1): lleva los huecos y todo el contexto. */
export const MAX_CUERPO_PROPONER = 32 * 1024
/**
 * Presupuesto total del servidor (§2.3): 60 s del primer intento + 10 s del reintento en la
 * lectura del texto dictado, 50 s + 20 s en la propuesta (§4bis.1). En los dos casos suman
 * exactamente estos 70 000 ms: no hay holgura, así que quien toque los tiempos de una llamada
 * tiene que mirar también los de la otra.
 */
export const MS_PRESUPUESTO = 70_000

export interface Config {
  clave: string | null
  modelo: string
  esfuerzo: Esfuerzo
  topeEurosDia: number
  topeGlobalDia: number
  topeIpDia: number
  origenes: string[]
  secreto: string
  datos: string
  puerto: number
}

export function configDesdeEntorno(
  entorno: NodeJS.ProcessEnv = process.env,
  avisar: (mensaje: string) => void = (m) => console.warn(m),
): Config {
  const pedido = (entorno.BASCULA_MODELO ?? '').trim()
  let modelo = MODELO_POR_DEFECTO
  if (pedido !== '') {
    if (modeloAdmitido(pedido)) modelo = pedido
    else
      avisar(`BASCULA_MODELO "${pedido}" no está en la lista blanca; se usa ${MODELO_POR_DEFECTO}.`)
  }
  const esfuerzoPedido = (entorno.BASCULA_ESFUERZO ?? '').trim()
  let esfuerzo: Esfuerzo = ESFUERZO_POR_DEFECTO
  if (esfuerzoPedido !== '') {
    if (esfuerzoAdmitido(esfuerzoPedido)) esfuerzo = esfuerzoPedido
    else
      avisar(
        `BASCULA_ESFUERZO "${esfuerzoPedido}" no es low, medium ni high; se usa ${ESFUERZO_POR_DEFECTO}.`,
      )
  }
  const clave = (entorno.ANTHROPIC_API_KEY ?? '').trim()
  const origenes = (entorno.BASCULA_ORIGENES ?? 'https://bascula.rsagents.es')
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o !== '')
  return {
    clave: clave === '' ? null : clave,
    modelo,
    esfuerzo,
    topeEurosDia: numeroEntorno(entorno.BASCULA_TOPE_EUROS_DIA, 4),
    topeGlobalDia: numeroEntorno(entorno.BASCULA_TOPE_GLOBAL_DIA, 400),
    topeIpDia: numeroEntorno(entorno.BASCULA_TOPE_IP_DIA, 40),
    origenes,
    secreto: (entorno.BASCULA_SECRETO ?? '').trim() || secretoAleatorio(),
    datos: (entorno.BASCULA_DATOS ?? '').trim() || '/data',
    puerto: numeroEntorno(entorno.PORT, 8787),
  }
}

export interface OpcionesServidor {
  config?: Partial<Config>
  /** `null` = sin clave (503). Los tests inyectan un cliente falso. */
  cliente?: ClienteModelo | null
  catalogo?: Map<string, AlimentoCatalogo>
  limites?: Limites
  ahora?: () => number
  /** Una línea JSON por petición (§3.1). Los tests la capturan. */
  registrar?: (linea: string) => void
}

export interface Aplicacion {
  manejar: (req: IncomingMessage, res: ServerResponse) => void
  config: Config
  limites: Limites
  catalogo: Map<string, AlimentoCatalogo>
  sistema: string
  /** El bloque `system` de `/api/dieta/proponer` (§4bis.2), también serializado una sola vez. */
  sistemaProponer: string
}

export function crearAplicacion(opciones: OpcionesServidor = {}): Aplicacion {
  // Sin avisos aquí: `arrancar()` ya ha leído el entorno y ha avisado una vez.
  const config: Config = { ...configDesdeEntorno(process.env, () => {}), ...opciones.config }
  const catalogo = opciones.catalogo ?? cargarCatalogo()
  const sistema = construirSistema(catalogo)
  const sistemaProponer = construirSistemaProponer(catalogo)
  const ahora = opciones.ahora ?? (() => Date.now())
  const registrar = opciones.registrar ?? ((linea: string) => console.log(linea))
  const limites =
    opciones.limites ??
    crearLimites({
      carpeta: config.datos,
      topeIpDia: config.topeIpDia,
      topeGlobalDia: config.topeGlobalDia,
      topeEurosDia: config.topeEurosDia,
      ahora,
    })
  const cliente = opciones.cliente ?? null
  const puedeInterpretar = config.clave !== null && cliente !== null

  function manejar(req: IncomingMessage, res: ServerResponse): void {
    const url = new URL(req.url ?? '/', 'http://interno')
    const ruta = url.pathname.replace(/\/+$/, '') || '/'
    const metodo = req.method ?? 'GET'

    if (ruta === '/api/salud') {
      if (metodo !== 'GET' && metodo !== 'HEAD') return fallo(res, 405, 'METODO_NO_ADMITIDO')
      return responder(res, 200, { ok: true, version: VERSION })
    }

    if (ruta === '/api/capacidades') {
      if (metodo !== 'GET' && metodo !== 'HEAD') return fallo(res, 405, 'METODO_NO_ADMITIDO')
      if (!origenAdmitido(req, config.origenes)) return fallo(res, 403, 'ORIGEN_NO_ADMITIDO')
      const token = puedeInterpretar ? crearToken(config.secreto, ipDe(req), ahora()) : null
      return responder(res, 200, {
        interpretar: puedeInterpretar,
        modelo: puedeInterpretar ? config.modelo : null,
        token,
      })
    }

    if (ruta === '/api/dieta/interpretar') {
      if (metodo !== 'POST') return fallo(res, 405, 'METODO_NO_ADMITIDO')
      void interpretar(req, res)
      return
    }

    if (ruta === '/api/dieta/proponer') {
      if (metodo !== 'POST') return fallo(res, 405, 'METODO_NO_ADMITIDO')
      void proponer(req, res)
      return
    }

    return fallo(res, 404, 'NO_EXISTE')
  }

  async function interpretar(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const entrada = ahora()
    if (!tipoJson(req)) return fallo(res, 415, 'TIPO_NO_ADMITIDO')
    if (!origenAdmitido(req, config.origenes)) return fallo(res, 403, 'ORIGEN_NO_ADMITIDO')

    const declarado = Number(req.headers['content-length'] ?? '0')
    if (Number.isFinite(declarado) && declarado > MAX_CUERPO) {
      return fallo(res, 413, 'CUERPO_GRANDE')
    }
    const cuerpo = await leerCuerpo(req)
    if (cuerpo === null) {
      // Se contesta primero y se corta la conexión después: si no, el cliente no ve el 413.
      res.on('finish', () => req.destroy())
      return fallo(res, 413, 'CUERPO_GRANDE')
    }

    if (!puedeInterpretar) return fallo(res, 503, 'SIN_CLAVE')

    const ip = ipDe(req)
    if (!tokenValido(config.secreto, ip, req.headers['x-bascula-token'], ahora())) {
      return fallo(res, 401, 'TOKEN_INVALIDO')
    }

    let leido: unknown
    try {
      leido = JSON.parse(cuerpo)
    } catch {
      return fallo(res, 400, 'TEXTO_INVALIDO')
    }
    const datos = validarEntrada(leido)
    if (datos === null) return fallo(res, 400, 'TEXTO_INVALIDO')

    const motivo = limites.comprobar(ip)
    if (motivo !== null) return fallo(res, 429, motivo)
    limites.registrarPeticion(ip)

    // Quien cierra la pestaña no paga: se aborta la llamada al modelo (§2.3).
    const abortador = new AbortController()
    res.on('close', () => {
      if (!res.writableFinished) abortador.abort()
    })

    let euros = 0
    let uso: UsoModelo | null = null
    let estimado = false
    const resultado = await interpretarTexto({
      cliente: cliente as ClienteModelo,
      modelo: config.modelo,
      esfuerzo: config.esfuerzo,
      sistema,
      texto: datos.texto,
      comidasPlan: datos.comidas_plan,
      catalogo,
      senalCliente: abortador.signal,
      limiteMs: entrada + MS_PRESUPUESTO,
      ahora,
      alFacturar: (coste, usoLlamada, esEstimado) => {
        euros += coste
        uso = usoLlamada
        if (esEstimado === true) estimado = true
        limites.registrarCoste(coste)
      },
    })

    const comun = {
      fecha: new Date(ahora()).toISOString(),
      ip_hash: hashIp(ip, config.secreto, ahora()),
      longitud: datos.texto.length,
      comidas_plan: datos.comidas_plan.length,
      modelo: config.modelo,
      intentos: resultado.intentos,
      uso,
      coste_eur: Math.round(euros * 1e6) / 1e6,
      latencia_ms: ahora() - entrada,
    }

    if (resultado.estado === 'ok') {
      const dieta = resultado.dieta
      registrar(
        JSON.stringify({
          ...comun,
          resultado: 'ok',
          comidas: dieta.comidas.length,
          alimentos: dieta.comidas.reduce((n, c) => n + c.alimentos.length, 0),
          gustos: dieta.gustos.length,
          habitos: dieta.habitos.length,
        }),
      )
      return responder(res, 200, { ...dieta, modelo: config.modelo })
    }

    registrar(
      JSON.stringify({
        ...comun,
        resultado: resultado.estado,
        motivo: resultado.estado === 'modelo' ? resultado.motivo : undefined,
      }),
    )
    if (resultado.estado === 'abortado') {
      res.destroy()
      return
    }
    if (resultado.estado === 'sin_contenido') return fallo(res, 422, 'SIN_CONTENIDO')
    if (resultado.estado === 'tiempo') return fallo(res, 504, 'TIEMPO_AGOTADO')
    return fallo(res, 502, 'MODELO_NO_DISPONIBLE')
  }

  /**
   * `POST /api/dieta/proponer` (§4bis.1): mismo control de origen, token, cuota y presupuesto que
   * interpretar, y el mismo abort al cerrar la conexión. Lo único distinto es el tope del cuerpo
   * (32 KB, porque viaja todo el contexto) y lo que se valida.
   */
  async function proponer(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const entrada = ahora()
    if (!tipoJson(req)) return fallo(res, 415, 'TIPO_NO_ADMITIDO')
    if (!origenAdmitido(req, config.origenes)) return fallo(res, 403, 'ORIGEN_NO_ADMITIDO')

    const declarado = Number(req.headers['content-length'] ?? '0')
    if (Number.isFinite(declarado) && declarado > MAX_CUERPO_PROPONER) {
      return fallo(res, 413, 'CUERPO_GRANDE')
    }
    const cuerpo = await leerCuerpo(req, MAX_CUERPO_PROPONER)
    if (cuerpo === null) {
      // Se contesta primero y se corta la conexión después: si no, el cliente no ve el 413.
      res.on('finish', () => req.destroy())
      return fallo(res, 413, 'CUERPO_GRANDE')
    }

    if (!puedeInterpretar) return fallo(res, 503, 'SIN_CLAVE')

    const ip = ipDe(req)
    if (!tokenValido(config.secreto, ip, req.headers['x-bascula-token'], ahora())) {
      return fallo(res, 401, 'TOKEN_INVALIDO')
    }

    // Código propio: los motivos de un 400 aquí (0 o más de 6 huecos, objetivo fuera de rango,
    // hueco sin nombre, JSON roto) no tienen nada que ver con el texto dictado, y el front pintaba
    // "El texto es demasiado corto o demasiado largo" delante de alguien que no había escrito nada.
    let leido: unknown
    try {
      leido = JSON.parse(cuerpo)
    } catch {
      return fallo(res, 400, 'HUECOS_INVALIDOS')
    }
    const datos = validarEntradaProponer(leido)
    if (datos === null) return fallo(res, 400, 'HUECOS_INVALIDOS')

    // Cuota compartida con interpretar: una propuesta cuesta lo mismo que una lectura (§4bis.6).
    const motivo = limites.comprobar(ip)
    if (motivo !== null) return fallo(res, 429, motivo)
    limites.registrarPeticion(ip)

    const abortador = new AbortController()
    res.on('close', () => {
      if (!res.writableFinished) abortador.abort()
    })

    let euros = 0
    let uso: UsoModelo | null = null
    // `true` si alguna de las llamadas se ha cobrado por estimación (se agotó por tiempo y no hubo
    // `usage` que leer): el coste del log es entonces una cota, no una medida.
    let estimado = false
    const resultado = await proponerHuecos({
      cliente: cliente as ClienteModelo,
      modelo: config.modelo,
      esfuerzo: config.esfuerzo,
      sistema: sistemaProponer,
      entrada: datos,
      catalogo,
      senalCliente: abortador.signal,
      limiteMs: entrada + MS_PRESUPUESTO,
      ahora,
      alFacturar: (coste, usoLlamada, esEstimado) => {
        euros += coste
        if (usoLlamada !== null) uso = usoLlamada
        if (esEstimado === true) estimado = true
        limites.registrarCoste(coste)
      },
    })

    const comun = {
      fecha: new Date(ahora()).toISOString(),
      ip_hash: hashIp(ip, config.secreto, ahora()),
      ruta: 'proponer',
      huecos: datos.huecos.length,
      variante: datos.contexto.variante,
      respuestas: datos.contexto.respuestas.length,
      modelo: config.modelo,
      intentos: resultado.intentos,
      uso,
      coste_eur: Math.round(euros * 1e6) / 1e6,
      coste_estimado: estimado,
      latencia_ms: ahora() - entrada,
    }

    if (resultado.estado === 'ok') {
      const propuesta = resultado.propuesta
      registrar(
        JSON.stringify({
          ...comun,
          resultado: 'ok',
          alimentos: propuesta.comidas.reduce((n, c) => n + c.alimentos.length, 0),
          preguntas: propuesta.preguntas.length,
          consejo: propuesta.consejo !== null,
          retirados: propuesta.retirados.length,
          descartados: propuesta.descartados,
          huecos_vacios: propuesta.vacios,
        }),
      )
      return responder(res, 200, {
        comidas: propuesta.comidas,
        consejo: propuesta.consejo,
        preguntas: propuesta.preguntas,
        modelo: config.modelo,
      })
    }

    registrar(
      JSON.stringify({
        ...comun,
        resultado: resultado.estado,
        motivo: resultado.estado === 'modelo' ? resultado.motivo : undefined,
      }),
    )
    if (resultado.estado === 'abortado') {
      res.destroy()
      return
    }
    if (resultado.estado === 'vacia') return fallo(res, 422, 'PROPUESTA_VACIA')
    if (resultado.estado === 'tiempo') return fallo(res, 504, 'TIEMPO_AGOTADO')
    return fallo(res, 502, 'MODELO_NO_DISPONIBLE')
  }

  return { manejar, config, limites, catalogo, sistema, sistemaProponer }
}

export function crearServidor(opciones: OpcionesServidor = {}): Server & { app: Aplicacion } {
  const app = crearAplicacion(opciones)
  const servidor = createServer(app.manejar) as Server & { app: Aplicacion }
  servidor.app = app
  servidor.headersTimeout = 20_000
  servidor.requestTimeout = 90_000
  return servidor
}

// ---------- Utilidades HTTP ----------

/** Mensajes de error, en español y sin detalles internos. */
export const MENSAJES: Record<string, string> = {
  TEXTO_INVALIDO: 'El texto es demasiado corto o demasiado largo (máximo 4 000 caracteres).',
  TOKEN_INVALIDO: 'La sesión ha caducado. Vuelve a intentarlo.',
  ORIGEN_NO_ADMITIDO: 'Origen no admitido.',
  NO_EXISTE: 'No existe.',
  METODO_NO_ADMITIDO: 'Método no admitido.',
  CUERPO_GRANDE: 'Lo que nos has mandado es demasiado grande.',
  TIPO_NO_ADMITIDO: 'Se esperaba application/json.',
  SIN_CONTENIDO: 'No hemos reconocido ninguna comida, gusto ni costumbre.',
  PROPUESTA_VACIA: 'No hemos podido montar una propuesta con esto.',
  HUECOS_INVALIDOS: 'No hemos podido preparar la petición. Vuelve a intentarlo.',
  CUOTA_IP: 'Has hecho muchas interpretaciones hoy. Vuelve a intentarlo mañana.',
  CUOTA_GLOBAL: 'Estamos recibiendo muchas peticiones. Espera un minuto y vuelve a intentarlo.',
  PRESUPUESTO: 'Hoy ya no podemos leer más textos. Vuelve a intentarlo mañana.',
  MODELO_NO_DISPONIBLE: 'Algo ha fallado al leerlo. Vuelve a intentarlo en un momento.',
  SIN_CLAVE: 'Esta función no está disponible ahora mismo.',
  TIEMPO_AGOTADO: 'Hemos tardado demasiado en leerlo. Vuelve a intentarlo.',
}

export function responder(res: ServerResponse, codigo: number, cuerpo: unknown): void {
  const texto = JSON.stringify(cuerpo)
  res.writeHead(codigo, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(texto),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  })
  res.end(texto)
}

export function fallo(res: ServerResponse, codigo: number, codigoError: string): void {
  responder(res, codigo, {
    error: { codigo: codigoError, mensaje: MENSAJES[codigoError] ?? 'Algo ha fallado.' },
  })
}

/** Redes privadas de Docker y loopback: solo desde ahí puede venir nuestro nginx. */
const PRIVADA =
  /^(?:::1|127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|f[cd][0-9a-f]{2}:|::ffff:(?:127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.))/i

/**
 * La IP real la pone nginx en `X-Real-IP`; nunca se lee `X-Forwarded-For` (§7). Defensa en
 * profundidad: la cabecera solo se cree si la conexión viene de una red privada (nuestro nginx).
 * Hoy el contenedor no publica puertos ni está en `dokploy-network`, pero si algún día lo
 * estuviera, la cuota por IP, el token efímero y el `ip_hash` del log no se anularían con una
 * cabecera inventada.
 */
export function ipDe(req: IncomingMessage): string {
  const remota = req.socket.remoteAddress ?? ''
  const cabecera = req.headers['x-real-ip']
  const valor = Array.isArray(cabecera) ? cabecera[0] : cabecera
  if (typeof valor === 'string' && valor.trim() !== '' && (remota === '' || PRIVADA.test(remota))) {
    return valor.trim()
  }
  // Sin nginx delante (desarrollo) o con una conexión que no es de confianza.
  return remota === '' ? 'desconocida' : remota
}

/**
 * Control cross-site (§7): `Origin` en la lista, o sin `Origin` con `Sec-Fetch-Site` de la propia
 * página. Lo demás, 403 — también lo que no trae ninguna de las dos cabeceras (curl, scripts):
 * `/api/salud`, que es el HEALTHCHECK, queda fuera de este control.
 */
export function origenAdmitido(req: IncomingMessage, origenes: string[]): boolean {
  const origen = req.headers.origin
  if (typeof origen === 'string' && origen !== '' && origen !== 'null') {
    return origenes.includes(origen)
  }
  const sitio = req.headers['sec-fetch-site']
  return sitio === 'same-origin' || sitio === 'none'
}

function tipoJson(req: IncomingMessage): boolean {
  const tipo = req.headers['content-type']
  if (typeof tipo !== 'string') return false
  return tipo.split(';')[0]?.trim().toLowerCase() === 'application/json'
}

/**
 * Lee el cuerpo con tope duro; `null` si se pasa de `MAX_CUERPO`. Al pasarse NO se destruye la
 * petición: se deja de leer y el llamante responde `413` antes de cerrar (con `Transfer-Encoding:
 * chunked` no hay `Content-Length` que mirar antes, y destruir aquí dejaba al navegador con un
 * fallo de red en vez del error de §2.3).
 */
function leerCuerpo(req: IncomingMessage, maximo: number = MAX_CUERPO): Promise<string | null> {
  return new Promise((cumplir) => {
    const trozos: Buffer[] = []
    let total = 0
    let cerrado = false
    req.on('data', (trozo: Buffer) => {
      if (cerrado) return
      total += trozo.length
      if (total > maximo) {
        cerrado = true
        req.pause()
        cumplir(null)
        return
      }
      trozos.push(trozo)
    })
    req.on('end', () => {
      if (cerrado) return
      cerrado = true
      cumplir(Buffer.concat(trozos).toString('utf8'))
    })
    req.on('error', () => {
      if (cerrado) return
      cerrado = true
      cumplir(null)
    })
  })
}

/** `sha256(ip + sal del día UTC)` recortado: en el log nunca aparece la IP (§3.1). */
export function hashIp(ip: string, secreto: string, ahora: number): string {
  return createHash('sha256')
    .update(`${ip}|${fechaUtc(ahora)}|${secreto}`)
    .digest('hex')
    .slice(0, 12)
}

/**
 * Un `0` es un valor legítimo: es la palanca para apagar el gasto en caliente sin quitar la clave
 * (`BASCULA_TOPE_EUROS_DIA=0` → `PRESUPUESTO` desde la primera petición). Solo se cae al valor por
 * defecto lo que no es un número o es negativo. `PORT` nunca se pasa a 0 desde aquí en producción.
 */
function numeroEntorno(valor: string | undefined, porDefecto: number): number {
  const texto = (valor ?? '').trim()
  if (texto === '') return porDefecto
  const leido = Number(texto)
  return Number.isFinite(leido) && leido >= 0 ? leido : porDefecto
}

// ---------- Arranque ----------

export async function arrancar(): Promise<Server> {
  const config = configDesdeEntorno()
  let cliente: ClienteModelo | null = null
  if (config.clave !== null) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    cliente = new Anthropic({ apiKey: config.clave, maxRetries: 0 }) as unknown as ClienteModelo
  }
  const servidor = crearServidor({ config, cliente })
  servidor.listen(config.puerto, () => {
    console.log(
      JSON.stringify({
        evento: 'arranque',
        version: VERSION,
        puerto: config.puerto,
        modelo: config.modelo,
        interpretar: cliente !== null,
        origenes: config.origenes,
      }),
    )
  })
  const cerrar = (): void => {
    servidor.app.limites.guardar()
    servidor.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 5000).unref()
  }
  process.on('SIGTERM', cerrar)
  process.on('SIGINT', cerrar)
  return servidor
}

const esteFichero = fileURLToPath(import.meta.url)
if (process.argv[1] !== undefined && resolve(process.argv[1]) === esteFichero) {
  void arrancar()
}
