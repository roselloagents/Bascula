// Lo que la persona nos contó, guardado solo en este móvil (SPEC-dieta-propia §5.5 y §4bis.4).
// Nada de esto sale del dispositivo ni entra en `firmaDeInputs`: con otro plan se vuelve a
// componer, porque `componerDia` es puro.

import type {
  DietaInterpretada,
  GustoPropio,
  PreguntaIA,
  PropuestaIA,
  RespuestaIA,
} from '../engine/types'
import type { HuecoPropuesta } from './api'

export const CLAVE_DIETA = 'bascula:dieta:v1'
export const CLAVE_BORRADOR_DIETA = 'bascula:dieta:borrador:v1'

/** Versión del formato guardado. Un número distinto se descarta entero. */
export const VERSION_DIETA = 1

/** Los ids que el audio sumó a las listas del paso 14, para poder retirarlos (§5.5). */
export interface GustosSumados {
  excluidos: string[]
  favoritos: string[]
}

/** Tope de `variante` que acepta el servicio (§4bis.1). */
export const VARIANTE_MAX = 20
/** Tope de respuestas a preguntas de la IA que viajan en el contexto (§4bis.1). */
export const RESPUESTAS_MAX = 4
/** Tope de preguntas por propuesta (§4bis.1 y §4bis.5). */
export const PREGUNTAS_MAX = 2

/**
 * La última propuesta de la IA, guardada con la clave de los huecos con los que se pidió
 * (§4bis.4). **Sin el `modelo`**: eso no se guarda.
 */
export interface PropuestaGuardada {
  /** 0–20; "Otra propuesta" la sube de una en una. */
  variante: number
  /** `claveHuecos` de los huecos con los que se pidió: si cambia, la propuesta no se reutiliza. */
  huecos_clave: string
  propuesta: PropuestaIA
  /** Lo que la persona ha contestado a las preguntas de vuelta, en orden (≤ 4). */
  respuestas: RespuestaIA[]
}

/** `bascula:dieta:v1` (§5.5). Las correcciones de §5.4 reescriben `interpretada`. */
export interface DietaGuardada {
  version: 1
  texto: string
  interpretada: DietaInterpretada
  /** ISO 'YYYY-MM-DD' del día en que se interpretó. */
  fecha: string
  /** `false` ⇒ está guardada pero se está viendo el menú propuesto (§5.4). */
  activa: boolean
  gustos_sumados: GustosSumados
  /** v1.3, decisión L (§4bis.4). Ausente en todo lo guardado antes y siempre que no haya IA. */
  propuesta?: PropuestaGuardada
}

// ---- Lectura tolerante ---------------------------------------------------

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function cadenas(valor: unknown): string[] {
  if (!Array.isArray(valor)) return []
  return valor.filter((v): v is string => typeof v === 'string' && v !== '')
}

/**
 * Saneado mínimo de `DietaInterpretada`: el servidor ya la validó entera (§3.5), pero lo que se
 * lee de `localStorage` puede ser de otra versión, estar a medias o haberlo escrito otra cosa.
 * Solo se comprueba la forma; los valores no se tocan. `null` si no hay nada aprovechable.
 */
function leerInterpretada(valor: unknown): DietaInterpretada | null {
  if (!esObjeto(valor)) return null
  const comidas = Array.isArray(valor.comidas)
    ? valor.comidas.filter(
        (c): c is DietaInterpretada['comidas'][number] =>
          esObjeto(c) && typeof c.nombre === 'string' && Array.isArray(c.alimentos),
      )
    : []
  const gustos = Array.isArray(valor.gustos)
    ? valor.gustos.filter(
        (g): g is GustoPropio =>
          esObjeto(g) &&
          typeof g.texto === 'string' &&
          (g.tipo === 'gusta' || g.tipo === 'no_gusta') &&
          Array.isArray(g.alimento_ids),
      )
    : []
  const habitos = Array.isArray(valor.habitos)
    ? valor.habitos.filter(
        (h): h is DietaInterpretada['habitos'][number] =>
          esObjeto(h) && typeof h.texto === 'string' && typeof h.tipo === 'string',
      )
    : []
  const noEntendido = Array.isArray(valor.no_entendido)
    ? valor.no_entendido.filter(
        (n): n is DietaInterpretada['no_entendido'][number] =>
          esObjeto(n) && typeof n.texto === 'string',
      )
    : []
  if (comidas.length === 0 && gustos.length === 0 && habitos.length === 0) return null
  return {
    comidas,
    gustos: gustos.map((g) => ({ ...g, alimento_ids: cadenas(g.alimento_ids) })),
    habitos,
    no_entendido: noEntendido,
    notas: cadenas(valor.notas),
    falta_aceite: valor.falta_aceite === true,
  }
}

function enteroEnRango(valor: unknown, min: number, max: number): number {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return min
  return Math.min(max, Math.max(min, Math.round(valor)))
}

function leerPreguntas(valor: unknown): PreguntaIA[] {
  if (!Array.isArray(valor)) return []
  const preguntas: PreguntaIA[] = []
  for (const p of valor as unknown[]) {
    if (!esObjeto(p) || typeof p.texto !== 'string' || p.texto === '') continue
    const opciones = cadenas(p.opciones)
    // Una pregunta sin opciones no se puede pintar (§4bis.5): se descarta entera.
    if (opciones.length === 0) continue
    preguntas.push({ texto: p.texto, opciones })
    if (preguntas.length === PREGUNTAS_MAX) break
  }
  return preguntas
}

function leerRespuestas(valor: unknown): RespuestaIA[] {
  if (!Array.isArray(valor)) return []
  const respuestas: RespuestaIA[] = []
  for (const r of valor as unknown[]) {
    if (!esObjeto(r) || typeof r.pregunta !== 'string' || typeof r.respuesta !== 'string') continue
    if (r.pregunta === '' || r.respuesta === '') continue
    respuestas.push({ pregunta: r.pregunta, respuesta: r.respuesta })
    if (respuestas.length === RESPUESTAS_MAX) break
  }
  return respuestas
}

/**
 * Saneado mínimo de la propuesta guardada (§4bis.4). Como en `leerInterpretada`, solo se mira la
 * forma: el servidor ya post-validó los alimentos (§3.5). Sin comidas aprovechables devuelve
 * `null` y el bloque pedirá otra propuesta. Una `huecos_clave` ilegible queda en cadena vacía,
 * que no coincide con ninguna clave real: la propuesta no se reutiliza, que es lo prudente.
 */
function leerPropuesta(valor: unknown): PropuestaGuardada | null {
  if (!esObjeto(valor)) return null
  const cruda = esObjeto(valor.propuesta) ? valor.propuesta : null
  if (cruda === null) return null
  const comidas = Array.isArray(cruda.comidas)
    ? cruda.comidas.filter(
        (c): c is PropuestaIA['comidas'][number] =>
          esObjeto(c) && typeof c.nombre === 'string' && Array.isArray(c.alimentos),
      )
    : []
  if (comidas.length === 0) return null
  return {
    variante: enteroEnRango(valor.variante, 0, VARIANTE_MAX),
    huecos_clave: typeof valor.huecos_clave === 'string' ? valor.huecos_clave : '',
    propuesta: {
      comidas,
      consejo: typeof cruda.consejo === 'string' && cruda.consejo !== '' ? cruda.consejo : null,
      preguntas: leerPreguntas(cruda.preguntas),
    },
    respuestas: leerRespuestas(valor.respuestas),
  }
}

/** Lo guardado, o `null`. Tolera basura, otra versión y `localStorage` inaccesible. */
export function cargarDieta(): DietaGuardada | null {
  try {
    const crudo = window.localStorage.getItem(CLAVE_DIETA)
    if (!crudo) return null
    const datos = JSON.parse(crudo) as unknown
    if (!esObjeto(datos) || datos.version !== VERSION_DIETA) return null
    const interpretada = leerInterpretada(datos.interpretada)
    if (interpretada === null) return null
    const sumados = esObjeto(datos.gustos_sumados) ? datos.gustos_sumados : {}
    const propuesta = leerPropuesta(datos.propuesta)
    return {
      version: VERSION_DIETA,
      texto: typeof datos.texto === 'string' ? datos.texto : '',
      interpretada,
      fecha: typeof datos.fecha === 'string' ? datos.fecha : '',
      activa: datos.activa === true,
      gustos_sumados: {
        excluidos: cadenas(sumados.excluidos),
        favoritos: cadenas(sumados.favoritos),
      },
      // Ausente, no `undefined`: así `cargarDieta` devuelve exactamente lo que se guardó y los
      // `toEqual` de los tests no distinguen entre una dieta de la v1.3 sin IA y una anterior.
      ...(propuesta === null ? {} : { propuesta }),
    }
  } catch {
    return null
  }
}

export function guardarDieta(dieta: DietaGuardada): void {
  try {
    window.localStorage.setItem(CLAVE_DIETA, JSON.stringify(dieta))
  } catch {
    // Modo incógnito o cuota llena: la composición sigue viva en memoria.
  }
}

/** "Borrar lo que conté" y "Empezar de cero": se va la dieta y también el borrador (§5.5). */
export function borrarDieta(): void {
  try {
    window.localStorage.removeItem(CLAVE_DIETA)
    window.localStorage.removeItem(CLAVE_BORRADOR_DIETA)
  } catch {
    // Nada que hacer: si no se puede borrar, tampoco se pudo guardar.
  }
}

// ---- Propuesta de la IA (§4bis.4) ----------------------------------------

function redondeo1(valor: number): number {
  const n = Math.round(valor * 10) / 10
  return Number.isFinite(n) ? n : 0
}

/**
 * Clave de los huecos con los que se pidió una propuesta (§4bis.4): `JSON.stringify` de los
 * **nombres** y los **objetivos redondeados** (kcal enteras, macros con un decimal, como §4.3.2).
 *
 * Va como array de arrays a propósito: así la clave no depende del orden en que estén escritas
 * las propiedades del objeto —`{ prot, kcal }` y `{ kcal, prot }` dan la misma— y solo cambia
 * cuando cambia de verdad lo que se le pidió al modelo. Hora, `peri` y `sin_hidratos` quedan
 * fuera: no mueven el objetivo y harían caducar la propuesta sin motivo.
 */
export function claveHuecos(huecos: readonly HuecoPropuesta[]): string {
  return JSON.stringify(
    huecos.map((h) => [
      h.nombre,
      Math.round(h.objetivo.kcal),
      redondeo1(h.objetivo.prot),
      redondeo1(h.objetivo.carb),
      redondeo1(h.objetivo.fat),
    ]),
  )
}

/**
 * Guarda la propuesta dentro de la dieta y devuelve la dieta ya actualizada (`null` si no hay
 * ninguna guardada). Sin `dieta` la lee de `localStorage`; con ella, la respeta: la pantalla
 * suele tener en la mano una más fresca que la del almacén.
 */
export function guardarPropuesta(
  propuesta: PropuestaGuardada,
  dieta?: DietaGuardada | null,
): DietaGuardada | null {
  const base = dieta === undefined ? cargarDieta() : dieta
  if (base === null) return null
  const nueva: DietaGuardada = { ...base, propuesta }
  guardarDieta(nueva)
  return nueva
}

/**
 * Quita la propuesta guardada (la IA ha dejado de estar disponible, o lo contado ha cambiado) y
 * devuelve la dieta sin ella. Reinterpretar no necesita llamarla: esa vía escribe una
 * `DietaGuardada` nueva, y la propuesta anterior se va con lo demás.
 */
export function borrarPropuesta(dieta?: DietaGuardada | null): DietaGuardada | null {
  const base = dieta === undefined ? cargarDieta() : dieta
  if (base === null) return null
  if (base.propuesta === undefined) return base
  const nueva: DietaGuardada = { ...base }
  delete nueva.propuesta
  guardarDieta(nueva)
  return nueva
}

// ---- Borrador del cuadro de texto (§5.3) ---------------------------------

/** Texto a medio escribir. El debounce de 500 ms lo pone el componente, no esto. */
export function cargarBorradorDieta(): string {
  try {
    const crudo = window.localStorage.getItem(CLAVE_BORRADOR_DIETA)
    return typeof crudo === 'string' ? crudo : ''
  } catch {
    return ''
  }
}

export function guardarBorradorDieta(texto: string): void {
  try {
    if (texto === '') window.localStorage.removeItem(CLAVE_BORRADOR_DIETA)
    else window.localStorage.setItem(CLAVE_BORRADOR_DIETA, texto)
  } catch {
    // Igual que arriba: perder el borrador no rompe nada.
  }
}

export function borrarBorradorDieta(): void {
  guardarBorradorDieta('')
}

// ---- Gustos → listas del paso 14 (§5.5) ----------------------------------

/** Lo que devuelve `sumarGustos`: las dos listas ya listas para el borrador del cuestionario. */
export interface ListasConGustos {
  excluidos: string[]
  favoritos: string[]
  gustos_sumados: GustosSumados
}

function sinRepetir(ids: string[]): string[] {
  const vistos = new Set<string>()
  const salida: string[] = []
  for (const id of ids) {
    if (id === '' || vistos.has(id)) continue
    vistos.add(id)
    salida.push(id)
  }
  return salida
}

/**
 * Suma los gustos del audio a las listas del paso 14 (§5.5):
 *
 * - primero se **retiran** los del audio anterior (`gustosPrevios`), para que reinterpretar no
 *   acumule lo que ya no se dice;
 * - los ids de `no_gusta` se añaden a excluidos **ordenados por id**;
 * - los de `gusta` se añaden **al final de favoritos, en el orden en que vienen** (ese orden es
 *   normativo: fija la prioridad dentro de cada `FoodQuery`);
 * - un id que esté en los dos cuenta solo como `no_gusta` (el servidor ya lo resuelve así, §3.5;
 *   aquí se vuelve a aplicar porque lo guardado puede venir de otra versión);
 * - lo que acabe excluido sale de favoritos.
 *
 * `gustos_sumados` recoge **solo lo que esta llamada ha añadido de verdad**: lo que el usuario ya
 * había marcado a mano no se apunta, y así "Borrar lo que conté" no se lo lleva por delante.
 * Contrapartida conocida: un favorito marcado a mano que el audio excluye se pierde de favoritos
 * y no vuelve al retirar (queda anotado en el informe).
 */
export function sumarGustos(
  excluidos: string[],
  favoritos: string[],
  gustosPrevios: GustosSumados | null,
  interpretada: DietaInterpretada,
): ListasConGustos {
  const limpio = retirarGustos(excluidos, favoritos, gustosPrevios)

  const noGusta = sinRepetir(
    interpretada.gustos.filter((g) => g.tipo === 'no_gusta').flatMap((g) => g.alimento_ids),
  )
  const gusta = sinRepetir(
    interpretada.gustos.filter((g) => g.tipo === 'gusta').flatMap((g) => g.alimento_ids),
  ).filter((id) => !noGusta.includes(id))

  const yaExcluidos = new Set(limpio.excluidos)
  const nuevosExcluidos = noGusta.filter((id) => !yaExcluidos.has(id)).sort()
  const finalExcluidos = [...limpio.excluidos, ...nuevosExcluidos]

  const excluidoAhora = new Set(finalExcluidos)
  const yaFavoritos = new Set(limpio.favoritos)
  const nuevosFavoritos = gusta.filter((id) => !yaFavoritos.has(id) && !excluidoAhora.has(id))
  const finalFavoritos = [...limpio.favoritos, ...nuevosFavoritos].filter(
    (id) => !excluidoAhora.has(id),
  )

  return {
    excluidos: finalExcluidos,
    favoritos: finalFavoritos,
    gustos_sumados: { excluidos: nuevosExcluidos, favoritos: nuevosFavoritos },
  }
}

/** Deshace lo que sumó el audio, sin tocar lo que el usuario marcó a mano (§5.2 y §5.5). */
export function retirarGustos(
  excluidos: string[],
  favoritos: string[],
  gustosPrevios: GustosSumados | null,
): { excluidos: string[]; favoritos: string[] } {
  if (gustosPrevios === null) return { excluidos: [...excluidos], favoritos: [...favoritos] }
  const fueraExcluidos = new Set(gustosPrevios.excluidos)
  const fueraFavoritos = new Set(gustosPrevios.favoritos)
  return {
    excluidos: excluidos.filter((id) => !fueraExcluidos.has(id)),
    favoritos: favoritos.filter((id) => !fueraFavoritos.has(id)),
  }
}
