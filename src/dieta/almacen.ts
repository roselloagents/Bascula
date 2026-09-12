// Lo que la persona nos contó, guardado solo en este móvil (SPEC-dieta-propia §5.5).
// Nada de esto sale del dispositivo ni entra en `firmaDeInputs`: con otro plan se vuelve a
// componer, porque `componerDia` es puro.

import type { DietaInterpretada, GustoPropio } from '../engine/types'

export const CLAVE_DIETA = 'bascula:dieta:v1'
export const CLAVE_BORRADOR_DIETA = 'bascula:dieta:borrador:v1'

/** Versión del formato guardado. Un número distinto se descarta entero. */
export const VERSION_DIETA = 1

/** Los ids que el audio sumó a las listas del paso 14, para poder retirarlos (§5.5). */
export interface GustosSumados {
  excluidos: string[]
  favoritos: string[]
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
