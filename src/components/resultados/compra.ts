// Presentación de la lista de la compra (SPEC-ux §2.5b). Aquí NO se calcula nada: los gramos,
// los envases y los días de duración vienen ya resueltos en `ListaCompra` (§3.7.3) y solo se les
// da forma de texto en español. Lo único que se decide aquí es el orden de las secciones, que es
// el de `ORDEN_SECCIONES`, y si una cantidad se lee mejor en gramos o en kilos.

import { NOMBRE_SECCION, ORDEN_SECCIONES } from '../../data/secciones'
import type { ItemCompra, SeccionSuper } from '../../engine/types'
import { entero } from '../utiles/formato'

// Las dos celdas de cantidad y el rótulo del modo sencillo se escriben con el mismo helper que
// usa el PDF (§4.4b: "las mismas cuatro columnas de §2.5b"), no con una copia paralela.
export {
  textoCantidadCiclo,
  textoCantidadDia,
  textoCantidadSemana,
  textoModoSencillo,
} from '../../meals/compra'

/** Guion largo de "no hay dato", el mismo que usa el PDF (§6.1). */
const SIN_DATO = '—'

export interface GrupoCompra {
  seccion: SeccionSuper
  /** Etiqueta visible de la sección ("Carnicería y charcutería"). */
  nombre: string
  items: ItemCompra[]
}

/**
 * Agrupa las líneas por sección respetando el orden de recorrido de la tienda y, dentro de cada
 * sección, el orden en que vienen (el generador ya las ordena por nombre). Las secciones vacías
 * no se pintan; una sección desconocida no se pierde: va al final.
 */
export function agruparPorSeccion(items: readonly ItemCompra[]): GrupoCompra[] {
  const grupos = new Map<SeccionSuper, ItemCompra[]>()
  for (const item of items) {
    const lista = grupos.get(item.seccion)
    if (lista) lista.push(item)
    else grupos.set(item.seccion, [item])
  }
  const conocidas = ORDEN_SECCIONES.filter((seccion) => grupos.has(seccion))
  const desconocidas = [...grupos.keys()].filter((seccion) => !ORDEN_SECCIONES.includes(seccion))
  return [...conocidas, ...desconocidas].map((seccion) => ({
    seccion,
    nombre: NOMBRE_SECCION[seccion] ?? 'Otros',
    items: grupos.get(seccion) ?? [],
  }))
}

/**
 * "2 × bandeja ≈ 1 kg". **v1.3 (SPEC-dieta-propia §6.1):** los alimentos dictados que no están en
 * nuestra base llegan con `envases: 0` y sin formato de venta; ahí no hay nada que comprar "0 veces",
 * así que la celda se queda en el guion largo.
 */
export function textoComprar(item: ItemCompra): string {
  if (item.envases === 0) return SIN_DATO
  return `${entero(item.envases)} × ${item.envase_descripcion}`
}

/** "te dura 5 días" / "te dura 1 día" / "—" con `dura_dias: 0` (§6.1: no lo sabemos). */
export function textoDura(item: ItemCompra): string {
  if (item.dura_dias === 0) return SIN_DATO
  return item.dura_dias === 1 ? 'te dura 1 día' : `te dura ${entero(item.dura_dias)} días`
}
