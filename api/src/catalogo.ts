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

/** Una línea por alimento, ordenadas por `id`: `id | nombre | grupo | estado | kcal | P | HC | G | fibra [| unidad]`. */
export function lineasCatalogo(catalogo: Map<string, AlimentoCatalogo>): string[] {
  return [...catalogo.values()]
    .slice()
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((a) => {
      const base = [
        a.id,
        a.nombre,
        a.grupo,
        a.estado,
        numero(a.kcal),
        numero(a.proteina),
        numero(a.carbohidratos),
        numero(a.grasa),
        numero(a.fibra),
      ].join(' | ')
      return a.unidad_g !== undefined && a.unidad_nombre !== undefined
        ? `${base} | ${numero(a.unidad_g)} ${a.unidad_nombre}`
        : base
    })
}

export function textoCatalogo(catalogo: Map<string, AlimentoCatalogo>): string {
  return lineasCatalogo(catalogo).join('\n')
}

/** Números con coma decimal, como se escriben en español. */
function numero(valor: number): string {
  if (!Number.isFinite(valor)) return '0'
  const redondeado = Math.round(valor * 100) / 100
  return String(redondeado).replace('.', ',')
}
