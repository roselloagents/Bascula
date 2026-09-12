// Cliente HTTP de "Cuéntanos cómo comes" (SPEC-dieta-propia §2.2, §2.3, §4bis.1 y §5.3).
// Aquí no se interpreta nada: solo se habla con `/api/*`, se traduce el error a un texto
// normativo y se deja el resto al componente. Ninguna clave viaja por el navegador.

import type {
  DietaInterpretada,
  GustoPropio,
  HabitoPropio,
  Macros,
  PreferenciaBase,
  PropuestaIA,
  RespuestaIA,
  Restriccion,
} from '../engine/types'

/** Tope de tiempo del cliente (§2.3: nginx 90 s > cliente 75 s > servidor 60 s). */
export const TOPE_INTERPRETAR_MS = 75_000
/** Espera del único reintento de `/api/capacidades` ante un 429 (§2.2). */
export const ESPERA_REINTENTO_MS = 3_000
/** Límites del texto (§2.3). Los comprueba también el servidor. */
export const TEXTO_MIN = 10
export const TEXTO_MAX = 4_000

/** Respuesta de `GET /api/capacidades` (§2.2). */
export interface Capacidades {
  interpretar: boolean
  modelo: string | null
  token: string | null
}

/** Respuesta de `POST /api/dieta/interpretar` (§2.3): la dieta interpretada más el modelo. */
export interface RespuestaInterpretar extends DietaInterpretada {
  modelo: string
}

// ---- `POST /api/dieta/proponer` (§4bis.1) --------------------------------

/**
 * Un hueco del día tal y como viaja al servicio: nombre y hora del plan, si es la comida de
 * alrededor del entrenamiento, el objetivo ya repartido (§4.3.2) y si el hueco va sin hidratos.
 * De 1 a 6 por petición. **No lleva nada del perfil de la persona.**
 */
export interface HuecoPropuesta {
  nombre: string
  hora: string | null
  peri: boolean
  objetivo: Macros
  sin_hidratos: boolean
}

/** Las condiciones que sí viajan (§4bis.1); el resto se queda en el navegador. */
export type CondicionPropuesta = 'diabetes' | 'cardiaca' | 'hipertension'

/** Una comida ya dictada, resumida en líneas "Kéfir natural entero 250 g" (§4bis.1). */
export interface ComidaPropiaTexto {
  nombre: string
  alimentos: string[]
}

/** El perfil dietético que viaja: base, restricciones y las dos listas del paso 14 (§4bis.1). */
export interface PerfilPropuesta {
  base: PreferenciaBase
  restricciones: Restriccion[]
  low_carb: boolean
  excluidos: string[]
  favoritos: string[]
}

/**
 * El contexto de §4bis.1. Lo monta `contextoParaProponer` (`src/dieta/contexto.ts`).
 * **No viaja** sexo, edad, peso, objetivo ni kcal totales: solo lo que hace falta para elegir
 * alimentos (§7).
 */
export interface ContextoPropuesta {
  texto: string
  comidas_propias: ComidaPropiaTexto[]
  gustos: GustoPropio[]
  habitos: HabitoPropio[]
  perfil: PerfilPropuesta
  condiciones: CondicionPropuesta[]
  menu_sencillo: boolean
  respuestas: RespuestaIA[]
  variante: number
}

/** Respuesta de `POST /api/dieta/proponer` (§4bis.1): la propuesta más el modelo que la firmó. */
export interface RespuestaProponer extends PropuestaIA {
  modelo: string
}

/**
 * La propuesta sin el `modelo`, que es lo único que se guarda (§4bis.4): el nombre del modelo no
 * pinta nada en el navegador y guardarlo sería quedarse con un dato del servicio.
 */
export function sinModelo(respuesta: RespuestaProponer): PropuestaIA {
  return {
    comidas: respuesta.comidas,
    consejo: respuesta.consejo,
    preguntas: respuesta.preguntas,
  }
}

/**
 * Error de la API con el código del contrato (§2.3). `estado` 0 ⇒ no hubo respuesta HTTP:
 * `codigo` es entonces `RED` (fallo de red), `TIEMPO_AGOTADO` (tope del cliente) o `CANCELADO`
 * (el usuario pulsó "Cancelar"; ese no se le enseña a nadie).
 */
export class ErrorApi extends Error {
  estado: number
  codigo: string
  constructor(estado: number, codigo: string, mensaje?: string) {
    super(mensaje ?? `${estado} ${codigo}`)
    this.name = 'ErrorApi'
    this.estado = estado
    this.codigo = codigo
  }
}

export const CODIGO_RED = 'RED'
export const CODIGO_TIEMPO = 'TIEMPO_AGOTADO'
export const CODIGO_CANCELADO = 'CANCELADO'

/** `true` si el error es la cancelación voluntaria del usuario: no se pinta ningún mensaje. */
export function esCancelado(error: unknown): boolean {
  return error instanceof ErrorApi && error.codigo === CODIGO_CANCELADO
}

// ---- Textos de error (§5.3, literales) ----------------------------------

/** [SPEC] §5.3, fallo de red. */
export const ERROR_RED = 'No hemos podido conectar. Comprueba la conexión y vuelve a intentarlo.'
/** [SPEC] §5.3, 504. */
export const ERROR_TIEMPO =
  'Hemos tardado demasiado en leerlo. Vuelve a intentarlo; si insiste, acorta el texto.'
/** [SPEC] §5.3, 429. */
export const ERROR_CUOTA =
  'Estamos recibiendo muchas peticiones. Espera un minuto y vuelve a intentarlo.'
/** [SPEC] §5.3, 422. */
export const ERROR_SIN_CONTENIDO =
  'No hemos reconocido ninguna comida, gusto ni costumbre. Cuéntanoslo con otras palabras, por ejemplo: «desayuno 250 g de kéfir» o «no me gusta el brócoli».'
/** [SPEC] §5.3, 400. */
export const ERROR_TEXTO =
  'El texto es demasiado corto o demasiado largo (máximo 4 000 caracteres).'
/** [SPEC] §5.2, estado "no disponible" (503 y capacidades sin clave). */
export const ERROR_NO_DISPONIBLE =
  'Esta función no está disponible ahora mismo. Sigue con el menú propuesto de aquí abajo.'
/** [SPEC] §5.3, resto (incluido el 401 que ya reintentó con token nuevo). */
export const ERROR_GENERICO = 'Algo ha fallado al leerlo. Vuelve a intentarlo en un momento.'

/**
 * Texto que se enseña en el `role="alert"` del formulario (§5.3). Cadena vacía cuando el error
 * es la cancelación del propio usuario: ahí no se dice nada.
 */
export function mensajeDeError(error: unknown): string {
  if (esCancelado(error)) return ''
  if (!(error instanceof ErrorApi)) return ERROR_GENERICO
  if (error.codigo === CODIGO_TIEMPO) return ERROR_TIEMPO
  if (error.codigo === CODIGO_RED) return ERROR_RED
  switch (error.estado) {
    case 0:
      return ERROR_RED
    case 400:
      return ERROR_TEXTO
    case 422:
      return ERROR_SIN_CONTENIDO
    case 429:
      return ERROR_CUOTA
    case 503:
      return ERROR_NO_DISPONIBLE
    case 504:
      return ERROR_TIEMPO
    default:
      return ERROR_GENERICO
  }
}

// ---- Textos de error de la propuesta (§4bis.5) ---------------------------

/**
 * Los textos de §5.3 son los de LEER lo que la persona dictó, y en la propuesta dicen cosas
 * falsas: "Sigue con el menú propuesto de aquí abajo" (no hay tal menú: el bloque compuesto lo
 * sustituyó, §5.1), "No hemos reconocido ninguna comida, gusto ni costumbre" (culpa al dictado de
 * un fallo del modelo) o "Algo ha fallado al leerlo" (no se estaba leyendo nada). Aquí no se ha
 * perdido nada: en pantalla siguen la última propuesta válida o las plantillas.
 */
export const ERROR_PROPUESTA_NO_DISPONIBLE =
  'No hemos podido pedirle una propuesta a la IA. Tu menú sigue montado con nuestras plantillas.'
/** [SPEC] §4bis.5, 422 `PROPUESTA_VACIA`. */
export const ERROR_PROPUESTA_VACIA =
  'La IA no ha sabido montar alguna comida. Hemos usado nuestras plantillas; prueba con «Otra propuesta».'
/** [SPEC] §4bis.5, 504. */
export const ERROR_PROPUESTA_TIEMPO =
  'La IA ha tardado demasiado en contestar. Tu menú sigue montado con nuestras plantillas; prueba otra vez.'
/** [SPEC] §4bis.5, resto (500, 502, 401 que ya reintentó). */
export const ERROR_PROPUESTA_GENERICO =
  'Algo ha fallado al pedir la propuesta. Vuelve a intentarlo en un momento.'

/** El mensaje del `role="alert"` del bloque cuando falla `POST /api/dieta/proponer` (§4bis.5). */
export function mensajeDeErrorPropuesta(error: unknown): string {
  if (esCancelado(error)) return ''
  if (!(error instanceof ErrorApi)) return ERROR_PROPUESTA_GENERICO
  if (error.codigo === CODIGO_TIEMPO) return ERROR_PROPUESTA_TIEMPO
  if (error.codigo === CODIGO_RED) return ERROR_RED
  switch (error.estado) {
    case 0:
      return ERROR_RED
    case 422:
      return ERROR_PROPUESTA_VACIA
    case 429:
      return ERROR_CUOTA
    case 503:
      return ERROR_PROPUESTA_NO_DISPONIBLE
    case 504:
      return ERROR_PROPUESTA_TIEMPO
    default:
      return ERROR_PROPUESTA_GENERICO
  }
}

// ---- Utilidades internas -------------------------------------------------

function esperar(ms: number): Promise<void> {
  return new Promise((listo) => window.setTimeout(listo, ms))
}

/** El `codigo` del cuerpo `{ error: { codigo, mensaje } }`, o el estado como respaldo. */
async function codigoDeRespuesta(respuesta: Response): Promise<string> {
  try {
    const cuerpo = (await respuesta.json()) as unknown
    if (typeof cuerpo === 'object' && cuerpo !== null && 'error' in cuerpo) {
      const error = (cuerpo as { error?: unknown }).error
      if (typeof error === 'object' && error !== null && 'codigo' in error) {
        const codigo = (error as { codigo?: unknown }).codigo
        if (typeof codigo === 'string' && codigo !== '') return codigo
      }
    }
  } catch {
    // Un 502 de nginx puede no traer JSON: el estado ya dice bastante.
  }
  return `HTTP_${respuesta.status}`
}

/**
 * Reúne el `signal` del componente y el tope de tiempo del cliente en un solo `AbortSignal`,
 * distinguiendo quién abortó: `AbortSignal.any` no lo dice y los dos casos tienen texto distinto
 * (uno se calla, el otro enseña el mensaje de 504).
 */
interface Limite {
  signal: AbortSignal
  /** `true` si el corte lo puso el tope de 75 s y no el usuario. */
  porTiempo: () => boolean
  soltar: () => void
}

function conTope(ms: number, externa?: AbortSignal): Limite {
  const control = new AbortController()
  let porTiempo = false
  const temporizador = window.setTimeout(() => {
    porTiempo = true
    control.abort()
  }, ms)
  const cortar = () => control.abort()
  externa?.addEventListener('abort', cortar)
  return {
    signal: control.signal,
    porTiempo: () => porTiempo,
    soltar: () => {
      window.clearTimeout(temporizador)
      externa?.removeEventListener('abort', cortar)
    },
  }
}

/** Traduce el fallo de `fetch` (red, abort del usuario, tope) al `ErrorApi` que toca. */
function errorDeFallo(fallo: unknown, limite: Limite | null): ErrorApi {
  if (fallo instanceof ErrorApi) return fallo
  const abortado =
    limite !== null && limite.signal.aborted
      ? true
      : typeof fallo === 'object' &&
        fallo !== null &&
        (fallo as { name?: string }).name === 'AbortError'
  if (abortado) {
    if (limite !== null && limite.porTiempo()) return new ErrorApi(0, CODIGO_TIEMPO)
    return new ErrorApi(0, CODIGO_CANCELADO)
  }
  return new ErrorApi(0, CODIGO_RED)
}

const SIN_CAPACIDADES: Capacidades = { interpretar: false, modelo: null, token: null }

function leerCapacidades(dato: unknown): Capacidades {
  if (typeof dato !== 'object' || dato === null) return SIN_CAPACIDADES
  const crudo = dato as { interpretar?: unknown; modelo?: unknown; token?: unknown }
  return {
    interpretar: crudo.interpretar === true,
    modelo: typeof crudo.modelo === 'string' ? crudo.modelo : null,
    token: typeof crudo.token === 'string' && crudo.token !== '' ? crudo.token : null,
  }
}

// ---- Endpoints -----------------------------------------------------------

/**
 * `GET /api/capacidades` (§2.2). Se pide **al pulsar el botón de entrada**, no al montar la
 * pantalla. Ante `429` reintenta **una** vez a los 3 s; ante fallo de red o cualquier otro error
 * devuelve `interpretar: false`, que es el estado "no disponible" de §5.2: esta llamada nunca
 * lanza, porque su única consecuencia es enseñar el formulario o la nota.
 */
export async function capacidades(signal?: AbortSignal): Promise<Capacidades> {
  for (let intento = 0; intento < 2; intento += 1) {
    try {
      const respuesta = await fetch('/api/capacidades', {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal,
      })
      if (respuesta.status === 429 && intento === 0) {
        await esperar(ESPERA_REINTENTO_MS)
        continue
      }
      if (!respuesta.ok) return SIN_CAPACIDADES
      return leerCapacidades((await respuesta.json()) as unknown)
    } catch (fallo) {
      // Un abort del componente (se plegó la tarjeta) no merece reintento.
      if (signal?.aborted) return SIN_CAPACIDADES
      if (intento === 0 && fallo instanceof ErrorApi && fallo.estado === 429) {
        await esperar(ESPERA_REINTENTO_MS)
        continue
      }
      return SIN_CAPACIDADES
    }
  }
  return SIN_CAPACIDADES
}

/** Un solo POST con cuerpo JSON, sin reintentos. Lo comparten los dos endpoints del modelo. */
async function pedirJson<T>(
  ruta: string,
  cuerpo: unknown,
  token: string | null,
  limite: Limite,
): Promise<T> {
  const cabeceras: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
  if (token !== null && token !== '') cabeceras['X-Bascula-Token'] = token
  let respuesta: Response
  try {
    respuesta = await fetch(ruta, {
      method: 'POST',
      headers: cabeceras,
      cache: 'no-store',
      body: JSON.stringify(cuerpo),
      signal: limite.signal,
    })
  } catch (fallo) {
    throw errorDeFallo(fallo, limite)
  }
  if (!respuesta.ok) {
    throw new ErrorApi(respuesta.status, await codigoDeRespuesta(respuesta))
  }
  try {
    return (await respuesta.json()) as T
  } catch (fallo) {
    throw errorDeFallo(fallo, limite)
  }
}

/**
 * Ante `401` vuelve a pedir el token **una** vez y reintenta (§2.3). Si repite, el error sube tal
 * cual y el texto que ve el usuario es el genérico (§5.3).
 */
async function conTokenRenovado<T>(
  token: string | null,
  limite: Limite,
  llamar: (token: string | null) => Promise<T>,
): Promise<T> {
  try {
    return await llamar(token)
  } catch (fallo) {
    if (!(fallo instanceof ErrorApi) || fallo.estado !== 401) throw fallo
    const nuevas = await capacidades(limite.signal)
    // Si el corte llegó mientras se pedía el token, manda el corte: enseñar "algo ha fallado"
    // a quien acaba de pulsar "Cancelar" es mentir.
    if (limite.signal.aborted) throw errorDeFallo(new Error('abort'), limite)
    if (!nuevas.interpretar || nuevas.token === null) throw fallo
    return await llamar(nuevas.token)
  }
}

/**
 * `POST /api/dieta/interpretar` (§2.3). Tope de 75 s contado sobre **toda** la operación,
 * reintento incluido. Ante `401` se vuelve a pedir el token **una** vez y se reintenta; si
 * repite, el error sube tal cual y el texto que ve el usuario es el genérico (§5.3).
 *
 * No valida el texto: el servidor manda (10–4 000 caracteres) y el botón ya está en
 * `aria-disabled` por debajo de 10.
 */
export async function interpretarDieta(
  texto: string,
  comidasPlan: string[],
  token: string | null,
  signal?: AbortSignal,
): Promise<RespuestaInterpretar> {
  const limite = conTope(TOPE_INTERPRETAR_MS, signal)
  try {
    return await conTokenRenovado(token, limite, (usado) =>
      pedirJson<RespuestaInterpretar>(
        '/api/dieta/interpretar',
        { texto, comidas_plan: comidasPlan },
        usado,
        limite,
      ),
    )
  } catch (fallo) {
    throw errorDeFallo(fallo, limite)
  } finally {
    limite.soltar()
  }
}

/**
 * `POST /api/dieta/proponer` (§4bis.1): los huecos del día los propone el modelo con todo el
 * contexto y el algoritmo del navegador cuadra después los gramos. Mismo tope de 75 s sobre toda
 * la operación, misma renovación de token ante `401` y los mismos textos de error (§5.3) que
 * `interpretarDieta`; el `422` de aquí es `PROPUESTA_VACIA`.
 *
 * No valida nada: los límites de §4bis.1 (1–6 huecos, tamaños del contexto) los impone el
 * servidor, y `contextoParaProponer` ya recorta lo que hay que recortar.
 */
export async function proponerHuecos(
  huecos: HuecoPropuesta[],
  contexto: ContextoPropuesta,
  token: string | null,
  signal?: AbortSignal,
): Promise<RespuestaProponer> {
  const limite = conTope(TOPE_INTERPRETAR_MS, signal)
  try {
    return await conTokenRenovado(token, limite, (usado) =>
      pedirJson<RespuestaProponer>('/api/dieta/proponer', { huecos, contexto }, usado, limite),
    )
  } catch (fallo) {
    throw errorDeFallo(fallo, limite)
  } finally {
    limite.soltar()
  }
}
