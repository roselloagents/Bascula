// Catálogo de formatos de compra en Mercadona (docs/SPEC-ux-comidas-pdf.md §3.7).
// UNA entrada por cada alimento de `foods.json`, con el mismo `id` en `alimento_id`.
// Este módulo solo aporta el tipado y el índice; no transforma ningún número y no lleva precios.
import type { Conservacion, SeccionSuper } from '../engine/types'
import datos from './mercadona.json'

/** Una fila de `mercadona.json`: cómo se compra un alimento de la base. */
export interface FilaMercadona {
  /** `id` de `src/data/foods.json`. */
  alimento_id: string
  /** Nombre comercial típico, con "Hacendado" cuando es lo habitual. Nunca lleva precio. */
  producto: string
  /**
   * Peso neto aproximado de un envase o unidad de compra, **expresado en la misma base en la que
   * `foods.json` mide ese alimento** (§3.7): en crudo para los alimentos `crudo`, ya cocido para
   * los `cocido` (1 kg de arroz crudo ≈ 2,6 kg cocido), escurrido para las conservas y peso
   * comestible para huevos y piezas de fruta. Siempre > 0.
   */
  envase_g: number
  /** Formato en texto ("bandeja ≈ 1 kg", "docena", "bote 570 g (≈ 400 g escurridos)"). */
  envase_descripcion: string
  seccion: SeccionSuper
  conservacion: Conservacion
  /** Días razonables que aguanta lo comprado en nevera, congelador o despensa. */
  conservacion_dias: number
  /** Consejo breve de conservación o de compra. Opcional. */
  consejo?: string
}

export const MERCADONA: readonly FilaMercadona[] = datos as unknown as readonly FilaMercadona[]

const INDICE: ReadonlyMap<string, FilaMercadona> = new Map(MERCADONA.map((f) => [f.alimento_id, f]))

/** Formato de compra de un alimento, o `undefined` si no está en el catálogo. */
export function formatoCompra(alimentoId: string): FilaMercadona | undefined {
  return INDICE.get(alimentoId)
}

// Las etiquetas y el orden de las secciones viven en `secciones.ts` (no dependen del catálogo,
// y así la pantalla puede usarlas sin cargar `mercadona.json`). Se reexportan aquí porque
// CONTRATO.md señala este módulo como la fuente de la lista de la compra para pantalla y PDF.
export { NOMBRE_SECCION, ORDEN_SECCIONES } from './secciones'
