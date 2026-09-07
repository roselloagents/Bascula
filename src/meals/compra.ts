// Lista de la compra semanal (docs/SPEC-ux-comidas-pdf.md §3.7.3).
//
// Convierte los gramos del menú en algo que se puede meter en un carro: para cada alimento, el
// total de siete días, el producto típico de Mercadona con su formato, cuántos envases hacen
// falta, cuántos días dura lo comprado y el consejo de conservación. Sin precios (§3.7.3: varían
// por tienda y por semana y envejecen mal en un PDF descargado).
//
// Módulo puro y determinista: mismas entradas → misma lista, incluido el orden de `items`.
import type { ItemCompra, ListaCompra, SeccionSuper } from '../engine/types'
import { ORDEN_SECCIONES, formatoCompra } from '../data/mercadona'

/** Gramos de un alimento en un día del menú. */
export interface GramosAlimento {
  id: string
  nombre: string
  gramos: number
}

/**
 * Consejo fijo de §3.7.3: un fresco que daría para más días de los que aguanta se compra en dos
 * veces. Es la única regla que reescribe el `consejo` del catálogo.
 */
export const CONSEJO_FRESCO_DOS_VECES =
  'Es fresco: cómpralo en dos veces, mitad al principio de la semana y mitad a mitad.'

/** Notas fijas al pie de la lista, literales y en este orden (§3.7.3). */
export const NOTAS_COMPRA: readonly string[] = [
  'Formatos aproximados; pueden variar por tienda',
  'Compra fresco dos veces por semana',
  'Pesa en crudo',
]

const ORDEN: ReadonlyMap<SeccionSuper, number> = new Map(ORDEN_SECCIONES.map((s, i) => [s, i]))

function redondea1(n: number): number {
  return Math.round(n * 10) / 10
}

/** Suma los gramos de cada alimento de un día, agrupando por `id` (§3.7.3). */
export function gramosPorAlimento(dia: readonly GramosAlimento[]): Map<string, GramosAlimento> {
  const total = new Map<string, GramosAlimento>()
  for (const a of dia) {
    if (!Number.isFinite(a.gramos) || a.gramos <= 0) continue
    const previo = total.get(a.id)
    if (previo) previo.gramos += a.gramos
    else total.set(a.id, { id: a.id, nombre: a.nombre, gramos: a.gramos })
  }
  return total
}

/**
 * Lista de la compra de un menú semanal. `diaB` solo se pasa en modo sencillo: los gramos de
 * cada alimento son la media aritmética de los dos días, contando 0 en el día donde no aparece.
 */
export function listaCompraDeDias(
  diaA: readonly GramosAlimento[],
  diaB: readonly GramosAlimento[] | null,
): ListaCompra {
  const a = gramosPorAlimento(diaA)
  const b = diaB ? gramosPorAlimento(diaB) : null
  const ids = new Set<string>([...a.keys(), ...(b ? b.keys() : [])])

  const items: ItemCompra[] = []
  for (const id of ids) {
    const nombre = a.get(id)?.nombre ?? b?.get(id)?.nombre ?? id
    const gA = a.get(id)?.gramos ?? 0
    const gB = b?.get(id)?.gramos ?? 0
    const gramos_dia = b ? redondea1((gA + gB) / 2) : redondea1(gA)
    if (gramos_dia <= 0) continue

    const fila = formatoCompra(id)
    // `mercadona.json` cubre los 101 alimentos de `foods.json` (lo comprueba
    // `src/data/__tests__/mercadona.test.ts`); esta rama solo evita que un alimento nuevo sin
    // ficha desaparezca en silencio de la lista.
    const envase_g = fila && fila.envase_g > 0 ? fila.envase_g : Math.max(1, Math.round(gramos_dia * 7))
    const conservacion = fila?.conservacion ?? 'despensa'
    const conservacion_dias = fila?.conservacion_dias ?? 7

    const gramos_semana = Math.round(gramos_dia * 7)
    const envases = Math.max(1, Math.ceil(gramos_semana / envase_g))
    const duraBruto = Math.floor((envases * envase_g) / gramos_dia)
    const dura_dias = Math.max(1, Math.min(duraBruto, conservacion_dias))
    const consejo =
      conservacion === 'fresco' && duraBruto > conservacion_dias ? CONSEJO_FRESCO_DOS_VECES : fila?.consejo

    items.push({
      alimento_id: id,
      nombre,
      producto: fila?.producto ?? nombre,
      seccion: fila?.seccion ?? 'otros',
      conservacion,
      gramos_dia,
      gramos_semana,
      envase_g,
      envase_descripcion: fila?.envase_descripcion ?? 'formato aproximado',
      envases,
      dura_dias,
      ...(consejo ? { consejo } : {}),
    })
  }

  // Orden de recorrido de la tienda y, dentro de cada sección, alfabético en español (§3.7.3).
  items.sort((x, y) => {
    const sx = ORDEN.get(x.seccion) ?? ORDEN_SECCIONES.length
    const sy = ORDEN.get(y.seccion) ?? ORDEN_SECCIONES.length
    if (sx !== sy) return sx - sy
    return x.nombre.localeCompare(y.nombre, 'es') || x.alimento_id.localeCompare(y.alimento_id)
  })

  return {
    supermercado: 'Mercadona',
    dias: 7,
    items,
    alimentos_distintos: items.length,
    notas: [...NOTAS_COMPRA],
  }
}
