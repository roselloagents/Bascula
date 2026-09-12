// Carga de `src/data/foods.json` y su versión compacta para el prompt (SPEC-dieta-propia §3.2).
// El catálogo se lee una vez al arrancar: el bloque `system` es un prefijo estable y cacheable.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/** Los campos de `foods.json` que necesita el servicio (el resto se ignora). */
export interface AlimentoCatalogo {
  id: string
  nombre: string
  grupo: string
  estado: string
  kcal: number
  proteina: number
  carbohidratos: number
  grasa: number
  fibra: number
  /** Etiquetas de `foods.json`: `vegetariano`, `vegano`, `sin_gluten`, `sin_lactosa`,
   *  `con_lactosa`, `low_carb`, `extra`. Son las que codifican la base y las restricciones. */
  tags?: string[]
  unidad_g?: number
  unidad_nombre?: string
}

/** `api/src/catalogo.ts` → `src/data/foods.json` (la imagen respeta esta misma distancia). */
export const RUTA_FOODS = fileURLToPath(new URL('../../src/data/foods.json', import.meta.url))

export function cargarCatalogo(ruta: string = RUTA_FOODS): Map<string, AlimentoCatalogo> {
  const crudo: unknown = JSON.parse(readFileSync(ruta, 'utf8'))
  if (!Array.isArray(crudo)) throw new Error('foods.json no es un array')
  const catalogo = new Map<string, AlimentoCatalogo>()
  for (const fila of crudo as AlimentoCatalogo[]) {
    if (typeof fila?.id !== 'string' || fila.id === '') continue
    catalogo.set(fila.id, fila)
  }
  return catalogo
}

export interface OpcionesCatalogo {
  /**
   * Añade la columna de etiquetas entre `fibra` y `unidad` (§4bis.2). Solo la usa el prompt de
   * propuesta: ahí el modelo tiene que respetar la base y las restricciones del perfil, y sin
   * esta columna tenía que adivinar por el nombre si un alimento lleva lactosa o gluten.
   * La lectura del texto dictado (§3.2) no la necesita y su bloque `system` no cambia.
   */
  tags?: boolean
}

/** Una línea por alimento, ordenadas por `id`: `id | nombre | grupo | estado | kcal | P | HC | G | fibra [| tags] [| unidad]`. */
export function lineasCatalogo(
  catalogo: Map<string, AlimentoCatalogo>,
  opciones: OpcionesCatalogo = {},
): string[] {
  return [...catalogo.values()]
    .slice()
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((a) => {
      const columnas = [
        a.id,
        a.nombre,
        a.grupo,
        a.estado,
        numero(a.kcal),
        numero(a.proteina),
        numero(a.carbohidratos),
        numero(a.grasa),
        numero(a.fibra),
      ]
      // La columna va SIEMPRE que se pida, aunque el alimento no traiga etiquetas: si apareciera
      // y desapareciera, la columna de la unidad cambiaría de sitio según la fila.
      if (opciones.tags === true) {
        const tags = Array.isArray(a.tags) ? a.tags.filter((t) => typeof t === 'string') : []
        columnas.push(tags.length > 0 ? tags.join(',') : '-')
      }
      const base = columnas.join(' | ')
      return a.unidad_g !== undefined && a.unidad_nombre !== undefined
        ? `${base} | ${numero(a.unidad_g)} ${a.unidad_nombre}`
        : base
    })
}

export function textoCatalogo(
  catalogo: Map<string, AlimentoCatalogo>,
  opciones: OpcionesCatalogo = {},
): string {
  return lineasCatalogo(catalogo, opciones).join('\n')
}

/** Base de la dieta del perfil, tal y como la filtra `src/meals/filtros.ts` con los mismos tags. */
export function pasaBase(a: AlimentoCatalogo, base: string): boolean {
  if (base === 'vegano' || base === 'vegetariano') return (a.tags ?? []).includes(base)
  return true
}

/** Restricción combinable del perfil, con la misma regla que el generador de menús. */
export function pasaRestriccion(a: AlimentoCatalogo, restriccion: string): boolean {
  if (restriccion === 'sin_lactosa') {
    return a.grupo !== 'lacteo' || (a.tags ?? []).includes('sin_lactosa')
  }
  if (restriccion === 'sin_gluten') return (a.tags ?? []).includes('sin_gluten')
  return true
}

/** Base Y todas las restricciones (§3.2 del menú propuesto, aplicado aquí a la propuesta de la IA). */
export function pasaPerfil(
  a: AlimentoCatalogo,
  base: string,
  restricciones: readonly string[],
): boolean {
  return pasaBase(a, base) && restricciones.every((r) => pasaRestriccion(a, r))
}

/** Números con coma decimal, como se escriben en español. */
function numero(valor: number): string {
  if (!Number.isFinite(valor)) return '0'
  const redondeado = Math.round(valor * 100) / 100
  return String(redondeado).replace('.', ',')
}
