// Secciones del supermercado por las que se agrupa la lista de la compra (§3.7).
// Viven aparte del catálogo a propósito: son ocho etiquetas de texto que la pantalla de
// resultados necesita desde el primer render, mientras que `mercadona.json` (26 kB) solo hace
// falta cuando el generador de menús construye la lista, ya en el módulo diferido. Importar las
// etiquetas desde `mercadona.ts` arrastraba el catálogo entero al arranque de la aplicación.
import type { SeccionSuper } from '../engine/types'

/**
 * Orden de recorrido de la tienda: la lista de la compra se ordena por este array (§3.7).
 * Es exactamente el orden en que `SeccionSuper` declara sus valores en `engine/types.ts`.
 */
export const ORDEN_SECCIONES: readonly SeccionSuper[] = [
  'carniceria',
  'pescaderia',
  'huevos_lacteos',
  'fruteria',
  'despensa',
  'congelados',
  'panaderia',
  'otros',
]

/** Etiqueta visible de cada sección, en español de España (pantalla y PDF). */
export const NOMBRE_SECCION: Record<SeccionSuper, string> = {
  carniceria: 'Carnicería y charcutería',
  pescaderia: 'Pescadería',
  huevos_lacteos: 'Huevos y lácteos',
  fruteria: 'Frutería y verdulería',
  panaderia: 'Panadería',
  congelados: 'Congelados',
  despensa: 'Despensa',
  otros: 'Otros',
}
