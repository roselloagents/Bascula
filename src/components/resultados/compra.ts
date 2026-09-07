// Presentación de la lista de la compra (SPEC-ux §2.5b). Aquí NO se calcula nada: los gramos,
// los envases y los días de duración vienen ya resueltos en `ListaCompra` (§3.7.3) y solo se les
// da forma de texto en español. Lo único que se decide aquí es el orden de las secciones, que es
// el de `ORDEN_SECCIONES`, y si una cantidad se lee mejor en gramos o en kilos.

import { NOMBRE_SECCION, ORDEN_SECCIONES } from '../../data/secciones'
import type { ItemCompra, SeccionSuper } from '../../engine/types'
import { entero, numCorto } from '../utiles/formato'

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

/** Cantidad semanal: en kilos a partir de 1 kg, porque "1,4 kg" se lee mejor que "1.400 g". */
export function textoCantidadSemana(item: ItemCompra): string {
  if (item.gramos_semana >= 1000) return `${numCorto(item.gramos_semana / 1000, 2)} kg en la semana`
  return `${entero(item.gramos_semana)} g en la semana`
}

/** Cantidad diaria del menú, en la línea secundaria de la misma celda. */
export function textoCantidadDia(item: ItemCompra): string {
  return `${numCorto(item.gramos_dia, 1)} g al día`
}

/** "2 × bandeja ≈ 1 kg". */
export function textoComprar(item: ItemCompra): string {
  return `${entero(item.envases)} × ${item.envase_descripcion}`
}

/** "te dura 5 días" / "te dura 1 día". */
export function textoDura(item: ItemCompra): string {
  return item.dura_dias === 1 ? 'te dura 1 día' : `te dura ${entero(item.dura_dias)} días`
}

/** Rótulo del distintivo de modo sencillo (§2.5b). */
export function textoModoSencillo(alimentos: number | undefined): string {
  if (alimentos === undefined) return 'Modo sencillo'
  return `Modo sencillo: ${entero(alimentos)} ${alimentos === 1 ? 'alimento' : 'alimentos'}`
}
