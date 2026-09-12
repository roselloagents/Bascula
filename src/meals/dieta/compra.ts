// Lista de la compra del día compuesto (docs/SPEC-dieta-propia.md §6.1).
//
// Mismas columnas que la lista del menú propuesto (§3.7.3) y las mismas fórmulas: lo único que
// cambia es de dónde salen los gramos y qué se hace con un alimento que no está en `foods.json`.
// Se agrupa PRIMERO todo el día por alimento y solo después se multiplica por siete: agrupar
// después dejaba dos líneas del mismo alimento —una de la comida tuya y otra de la propuesta—
// cada una con sus propios envases.
//
// Módulo puro y determinista: mismo `DiaCompuesto` → misma lista, incluido el orden de `items`.
import { ORDEN_SECCIONES } from '../../data/secciones'
import type {
  Conservacion,
  DiaCompuesto,
  GrupoAprox,
  ItemCompra,
  ListaCompra,
  SeccionOpcionalCompra,
  SeccionSuper,
} from '../../engine/types'
import { NOTAS_COMPRA, itemDeCompra } from '../compra'

/** Nota propia de la lista con lo tuyo dentro (§6.1.4). */
export const NOTA_COMPRA_DIETA =
  'Las cantidades salen de tu menú con lo tuyo dentro. Los alimentos que no están en nuestra base no llevan formato de venta.'

/** Consejo fijo de un alimento dictado que no está en `foods.json` (§6.1.3). */
export const CONSEJO_PROPIO = 'No está en nuestra base: mira el formato en el envase.'

/** Prefijo de la clave de un alimento dictado sin `alimento_id`. Nunca choca con un id real. */
export const PREFIJO_PROPIO = 'propio:'

const ORDEN: ReadonlyMap<SeccionSuper, number> = new Map(ORDEN_SECCIONES.map((s, i) => [s, i]))

/** Nombres que delatan un pescado y mandan la línea a la pescadería (§6.1.3). */
const PESCADO = /pescad|atun|salmon|merluza/

/** Identificador estable a partir de un nombre libre: sin acentos, sin mayúsculas y sin símbolos. */
export function slug(nombre: string): string {
  const limpio = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return limpio.length > 0 ? limpio : 'sin-nombre'
}

/** Sección y conservación de un alimento propio, por su `grupo_aprox` (§6.1.3). */
export function ubicacionDe(
  grupo: GrupoAprox,
  nombre: string,
): { seccion: SeccionSuper; conservacion: Conservacion } {
  switch (grupo) {
    case 'proteina':
      return PESCADO.test(slug(nombre))
        ? { seccion: 'pescaderia', conservacion: 'fresco' }
        : { seccion: 'carniceria', conservacion: 'fresco' }
    case 'lacteo':
      return { seccion: 'huevos_lacteos', conservacion: 'fresco' }
    case 'verdura':
    case 'fruta':
      return { seccion: 'fruteria', conservacion: 'fresco' }
    case 'bebida':
      return { seccion: 'otros', conservacion: 'despensa' }
    case 'carbohidrato':
    case 'grasa':
    case 'otro':
      return { seccion: 'despensa', conservacion: 'despensa' }
  }
}

interface Acumulado {
  clave: string
  nombre: string
  gramos: number
  /** `null` en los alimentos del catálogo; el grupo del modelo en los propios. */
  grupo: GrupoAprox | null
}

/**
 * Lista de la compra de un día compuesto (§6.1). Los alimentos del catálogo salen exactamente
 * como en la lista del menú propuesto; los dictados que no están en la base llevan su nombre,
 * su sección por `grupo_aprox` y **ninguna columna inventada**: sin envases, sin duración y con
 * el consejo de mirar el formato en el envase.
 */
export function compraDeDia(
  compuesto: DiaCompuesto,
  opcionalCiclo?: SeccionOpcionalCompra,
): ListaCompra {
  // El mapa conserva el orden de primera aparición, que es lo que desempata los slugs repetidos.
  const total = new Map<string, Acumulado>()
  // `slug:estado` → nombres distintos ya vistos con esa forma, en orden (§6.1.1).
  const vistos = new Map<string, string[]>()

  const anotar = (
    clave: string,
    nombre: string,
    gramos: number,
    grupo: GrupoAprox | null,
  ): void => {
    if (!Number.isFinite(gramos) || gramos <= 0) return
    const previo = total.get(clave)
    if (previo) previo.gramos += gramos
    else total.set(clave, { clave, nombre, gramos, grupo })
  }

  for (const comida of compuesto.comidas) {
    for (const a of comida.alimentos) {
      if (a.estado_ajuste === 'pendiente' || a.retirado === true) continue
      if (a.alimento_id) {
        anotar(a.alimento_id, a.nombre, a.gramos_ajustados, null)
        continue
      }
      anotar(clavePropia(vistos, a.nombre, a.estado), a.nombre, a.gramos_ajustados, a.grupo_aprox)
    }
    for (const a of comida.ejemplo?.alimentos ?? []) anotar(a.id, a.nombre, a.gramos, null)
  }

  const items: ItemCompra[] = []
  for (const acumulado of total.values()) {
    const item = itemDeCompra(acumulado.clave, acumulado.nombre, acumulado.gramos * 7)
    if (!item) continue
    items.push(acumulado.grupo === null ? item : comoPropio(item, acumulado.grupo))
  }

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
    notas: [...NOTAS_COMPRA, NOTA_COMPRA_DIETA],
    ...(opcionalCiclo ? { opcional_ciclo: opcionalCiclo } : {}),
  }
}

/**
 * Clave de un alimento dictado sin `alimento_id`: `propio:slug:estado`. Dos nombres distintos que
 * comparten slug y estado no pueden pisarse, así que el segundo lleva `-2`, el tercero `-3`…
 * Se usa un `Map`, nunca un objeto: un nombre como `__proto__` no puede tocar ningún prototipo.
 */
function clavePropia(vistos: Map<string, string[]>, nombre: string, estado: string): string {
  const base = slug(nombre)
  const forma = `${base}:${estado}`
  const nombres = vistos.get(forma) ?? []
  let indice = nombres.indexOf(nombre)
  if (indice < 0) {
    nombres.push(nombre)
    vistos.set(forma, nombres)
    indice = nombres.length - 1
  }
  const sufijo = indice === 0 ? '' : `-${indice + 1}`
  return `${PREFIJO_PROPIO}${base}${sufijo}:${estado}`
}

/** Corrige las columnas que no se pueden saber de un alimento que no está en el catálogo (§6.1.3). */
function comoPropio(item: ItemCompra, grupo: GrupoAprox): ItemCompra {
  const { seccion, conservacion } = ubicacionDe(grupo, item.nombre)
  return {
    ...item,
    producto: item.nombre,
    seccion,
    conservacion,
    envases: 0,
    envase_descripcion: '',
    dura_dias: 0,
    consejo: CONSEJO_PROPIO,
  }
}
