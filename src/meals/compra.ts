// Lista de la compra semanal (docs/SPEC-ux-comidas-pdf.md §3.7.3).
//
// Convierte los gramos del menú en algo que se puede meter en un carro: para cada alimento, el
// total de siete días, el producto típico de Mercadona con su formato, cuántos envases hacen
// falta, cuántos días dura lo comprado y el consejo de conservación. Sin precios (§3.7.3: varían
// por tienda y por semana y envejecen mal en un PDF descargado).
//
// Módulo puro y determinista: mismas entradas → misma lista, incluido el orden de `items`.
import type { ItemCompra, ListaCompra, SeccionOpcionalCompra, SeccionSuper } from '../engine/types'
import { ORDEN_SECCIONES, formatoCompra } from '../data/mercadona'

/** Gramos de un alimento en un día del menú. */
export interface GramosAlimento {
  id: string
  nombre: string
  gramos: number
}

/**
 * Consejo fijo de §3.7.3: un fresco que daría para más días de los que aguanta se compra en dos
 * veces. Es la única regla que reescribe el `consejo` del catálogo, y solo se aplica cuando la
 * compra se puede partir de verdad: con un único envase la instrucción es imposible de seguir.
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

// ---------- Texto de las celdas de cantidad (§2.5b y §4.4b) ----------
// Vive aquí, y no en la pantalla, porque §4.4b obliga al PDF a llevar "las mismas cuatro
// columnas de §2.5b": con una función de formato en cada capa, la pantalla decía "1,93 kg en la
// semana · 82,5 g al día" y el PDF "1.925 g en la semana · 83 g al día" para la misma línea.
// El formateador es propio (nada de `Intl`) porque el PDF solo puede imprimir WinAnsi.

/** Número con punto de millares, coma decimal y sin ceros de relleno (1.925 / 82,5 / 2). */
function cifra(n: number, decimales: number): string {
  const negativo = n < 0
  const fijo = Math.abs(n).toFixed(decimales)
  const limpio = decimales > 0 ? fijo.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '') : fijo
  const [entera, decimal] = limpio.split('.')
  const conMillares = entera.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const cuerpo = decimal ? `${conMillares},${decimal}` : conMillares
  return negativo ? `-${cuerpo}` : cuerpo
}

/** Cantidad semanal: en kilos a partir de 1 kg, porque "1,4 kg" se lee mejor que "1.400 g". */
export function textoCantidadSemana(item: ItemCompra): string {
  if (item.gramos_semana >= 1000) return `${cifra(item.gramos_semana / 1000, 2)} kg en la semana`
  return `${cifra(item.gramos_semana, 0)} g en la semana`
}

/** Cantidad diaria del menú, en la línea secundaria de la misma celda. */
export function textoCantidadDia(item: ItemCompra): string {
  return `${cifra(item.gramos_dia, 1)} g al día`
}

/**
 * Cantidad de la sección opcional del ciclo (§3.8.2). Esa sección no es del plan: son dos
 * raciones para dos o tres días al mes, así que no puede hablar el idioma semanal del resto de la
 * lista ("120 g en la semana · 17,1 g al día · te dura 10 días" para dos latas de sardinas).
 */
export function textoCantidadCiclo(item: ItemCompra): string {
  const cantidad =
    item.gramos_semana >= 1000
      ? `${cifra(item.gramos_semana / 1000, 2)} kg`
      : `${cifra(item.gramos_semana, 0)} g`
  return `${cantidad} en total, unas 2 raciones`
}

/** Rótulo del distintivo de modo sencillo, con el singular resuelto (§2.5b y §4.4b). */
export function textoModoSencillo(alimentos: number | undefined): string {
  if (alimentos === undefined || !Number.isFinite(alimentos)) return 'Modo sencillo'
  const n = Math.round(alimentos)
  return `Modo sencillo: ${cifra(n, 0)} ${n === 1 ? 'alimento' : 'alimentos'}`
}

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
 * Días de cada variante en la semana del modo sencillo (§3.7.2, regla 2): los días 1, 3, 5 y 7
 * siguen el día A y los días 2, 4 y 6 el día B. La lista de la compra tiene que comprar esa
 * semana, no una media: con 4·A + 3·B un alimento que solo aparece en el día A se compraba corto.
 */
export const DIAS_A = 4
export const DIAS_B = 3

/**
 * Una línea de la lista a partir de los gramos de la semana: formato de venta, envases, duración
 * y consejo, con las fórmulas de §3.7.3. La usan la lista del plan y la sección opcional del
 * ciclo (§3.8.2), que solo se diferencian en de dónde salen esos gramos.
 */
export function itemDeCompra(id: string, nombre: string, gramosSemana: number): ItemCompra | null {
  const gramos_semana = Math.round(gramosSemana)
  if (gramos_semana <= 0) return null
  const gramos_dia = redondea1(gramos_semana / 7)

  const fila = formatoCompra(id)
  // `mercadona.json` cubre los 105 alimentos de `foods.json` (lo comprueba
  // `src/data/__tests__/mercadona.test.ts`); esta rama solo evita que un alimento nuevo sin
  // ficha desaparezca en silencio de la lista.
  const envase_g = fila && fila.envase_g > 0 ? fila.envase_g : Math.max(1, gramos_semana)
  const conservacion = fila?.conservacion ?? 'despensa'
  const conservacion_dias = fila?.conservacion_dias ?? 7

  const envases = Math.max(1, Math.ceil(gramos_semana / envase_g))
  const duraBruto =
    gramos_dia > 0 ? Math.floor((envases * envase_g) / gramos_dia) : conservacion_dias
  const dura_dias = Math.max(1, Math.min(duraBruto, conservacion_dias))
  // Partir la compra en dos solo tiene sentido si de verdad se compra más de un envase: con un
  // único paquete el consejo era materialmente imposible y tapaba el consejo del catálogo.
  const consejo =
    conservacion === 'fresco' &&
    duraBruto > conservacion_dias &&
    envases >= 2 &&
    gramos_semana > envase_g
      ? CONSEJO_FRESCO_DOS_VECES
      : fila?.consejo

  return {
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
  }
}

/**
 * Lista de la compra de un menú semanal. `diaB` solo se pasa en modo sencillo: la semana son
 * cuatro días del día A y tres del día B, contando 0 en el día donde el alimento no aparece.
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
    // La semana es la que publica el calendario de §3.7.2 (4 días A + 3 días B), no la media de
    // los dos días: promediar dejaba corto todo alimento que pesa más en el día A.
    const item = itemDeCompra(id, nombre, b ? DIAS_A * gA + DIAS_B * gB : gA * 7)
    if (item) items.push(item)
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

// ---------- Sección opcional "Para los días de regla" (§3.8.2) ----------

/** Encabezado literal de la sección opcional (§3.8.2). */
export const TITULO_OPCIONAL_CICLO = 'Para los días de regla (opcional)'

/** Nota fija de la sección opcional: deja claro que no está contada en el plan (§3.8.2). */
export const NOTA_OPCIONAL_CICLO =
  'No está contado en las cantidades de tu plan: son compras pequeñas para 2-3 días al mes. Si no te apetece, sáltatela.'

/** Como mucho tres líneas (§3.8.2). */
export const MAX_ITEMS_OPCIONAL_CICLO = 3

/** Un candidato de la sección opcional: el alimento del ciclo con su ración típica. */
export interface CandidatoCiclo {
  id: string
  nombre: string
  racionTipica_g: number
}

/**
 * Sección opcional de la lista de la compra (§3.8.2). Entran, en el orden recibido y parando en
 * tres, los alimentos del ciclo cuyo `id` **no esté ya** en la lista del plan: si ya lo compras
 * para el menú, no hace falta una línea nueva. La cantidad es fija y pequeña —dos raciones
 * típicas— y el resto de columnas sale de las mismas fórmulas de §3.7.3.
 *
 * No cuenta en `alimentos_distintos` ni en el tope de 12 del modo sencillo: no es del plan.
 */
export function seccionOpcionalCiclo(
  candidatos: readonly CandidatoCiclo[],
  yaEnLaLista: ReadonlySet<string>,
): SeccionOpcionalCompra | undefined {
  const items: ItemCompra[] = []
  for (const c of candidatos) {
    if (items.length >= MAX_ITEMS_OPCIONAL_CICLO) break
    if (yaEnLaLista.has(c.id)) continue
    const item = itemDeCompra(c.id, c.nombre, 2 * c.racionTipica_g)
    if (item) items.push(item)
  }
  if (items.length === 0) return undefined
  return { titulo: TITULO_OPCIONAL_CICLO, nota: NOTA_OPCIONAL_CICLO, items }
}
