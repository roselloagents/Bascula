// Ajuste de los gramos de las comidas dictadas (docs/SPEC-dieta-propia.md §4.2).
//
// Módulo puro y determinista: mismas entradas → mismos gramos, bit a bit. Sin `Math.random`, sin
// fecha, sin estado global. Los totales del día se recalculan ENTEROS en cada evaluación,
// recorriendo las piezas en el orden del array (§4.2.5): nada de sumas incrementales, que
// dependerían del orden de las restas y darían resultados distintos según el camino.
//
// Las kcal salen SIEMPRE de `macros_100g.kcal`, nunca de 4P + 4HC + 9G (§4.2.5).
import { alimentoPorId } from '../../data/foods'
import type { AlimentoPropio, Macros, MacrosPropio } from '../../engine/types'
import { limiteRacion } from '../escalado'

/** Factores de §4.2.2: entre la mitad y casi el doble de lo que la persona dijo que come. */
export const FACTOR_MIN = 0.5
export const FACTOR_MAX = 1.75

/** Por debajo de este aporte diario el alimento dictado no se mueve (§4.2.1). */
export const KCAL_FIJO = 30

/**
 * Penalización asimétrica de §4.2.3 (cuadrática a trozos, con el codo en el objetivo): quedarse
 * corto de proteína o de grasa es peor que pasarse, y el hidrato es simétrico porque es el macro
 * que absorbe el resto.
 */
export const PESOS: Record<keyof Macros, { bajo: number; alto: number }> = {
  kcal: { bajo: 2, alto: 2 },
  prot: { bajo: 5, alto: 1 },
  carb: { bajo: 1, alto: 1 },
  fat: { bajo: 4, alto: 1.5 },
}

/** Peso del término que mantiene los factores cerca de 1 (§4.2.3 y §4.2.4). */
export const LAMBDA_COMPLETA = 0.05
export const LAMBDA_PARCIAL = 1

/** Suelo por hueco a montar (§4.2.4). El de hidrato es 0 con `low_carb`. */
export const SUELOS: Record<keyof Macros, number> = { kcal: 250, prot: 15, carb: 10, fat: 8 }

/** Orden canónico de los macros del ajuste: fija el determinismo de las sumas. */
export const MACROS: readonly (keyof Macros)[] = ['kcal', 'prot', 'carb', 'fat']

const BARRIDOS_MAX = 500
const ITERACIONES_TERNARIA = 60
const PARADA = 1e-6
const PASOS_CIERRE = 8
const EPS = 1e-9

export type EstadoAjuste = 'variable' | 'fijo' | 'pendiente'

/** Una pieza del día: un alimento dictado que aporta macros (fijo o variable). */
export interface Pieza {
  macros: MacrosPropio
  /** Gramos de una pieza fija; en una variable, los gramos dictados (el punto de partida). */
  gramos: number
  /** Índice dentro de `variables` si la pieza se puede mover; `null` si es fija. */
  variable: number | null
}

/** La caja de un alimento variable: dónde puede moverse y con qué rejilla (§4.2.2 y §4.2.6). */
export interface Variable {
  /** Gramos dictados. Es la referencia del factor: `factor = gramos_ajustados / gramos`. */
  gramos: number
  /** Contable: gramos de UNA unidad; `null` si se mide en gramos. */
  unidadG: number | null
  /** Contable: unidades dictadas. */
  unidades: number
  /** Caja continua en gramos. */
  lo: number
  hi: number
  /** Quién pone el extremo superior: `FACTOR_MAX` o el tope de ración. */
  limiteArriba: 'factor' | 'racion'
  /** Rejilla de báscula de §4.2.6; en las contables, los gramos de una unidad. */
  paso: number
  /** La misma caja llevada a la rejilla: es donde cae el gramaje final. */
  loRed: number
  hiRed: number
}

export interface EntradaAjuste {
  piezas: readonly Pieza[]
  variables: readonly Variable[]
  /** Objetivo del día: `T` de §4. */
  objetivo: Macros
  modo: 'completa' | 'parcial'
  /** Huecos que quedan por montar (solo cuenta en `parcial`). */
  huecosAMontar: number
  lowCarb: boolean
}

export interface SalidaAjuste {
  /** Gramos finales de cada variable, en el orden de `variables`. */
  gramos: number[]
  /** `true` si el solver ha llegado a moverse (en `parcial`, solo cuando los suelos no caben). */
  resuelto: boolean
  /** `true` si en modo `parcial` algún gramaje ha bajado por §4.2.4 (§4.4, `DIETA_PROPIAS_GRANDES`). */
  bajados: boolean
}

// ---------- Clasificación y cajas ----------

/** Gramos de una unidad si el alimento es contable de verdad (§4.2.2); `null` si no lo es. */
export function unidadDe(a: AlimentoPropio): number | null {
  const g = a.unidad?.gramos
  const n = a.cantidad_unidades
  if (typeof g !== 'number' || !Number.isFinite(g) || g <= 0) return null
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return null
  return g
}

/**
 * Clasificación de §4.2.1, en este orden: sin gramos es `pendiente`; no ajustable, vegetal,
 * aporte menor de 30 kcal o contable de una sola unidad es `fijo`; el resto, `variable`.
 * `retirado` no llega aquí: se descarta antes, del todo.
 */
export function estadoDe(a: AlimentoPropio): EstadoAjuste {
  const g = a.gramos
  if (typeof g !== 'number' || !Number.isFinite(g) || g <= 0) return 'pendiente'
  if (!a.ajustable) return 'fijo'
  if (a.grupo_aprox === 'verdura' || a.grupo_aprox === 'fruta') return 'fijo'
  if ((a.macros_100g.kcal * g) / 100 < KCAL_FIJO) return 'fijo'
  if (unidadDe(a) !== null && a.cantidad_unidades === 1) return 'fijo'
  return 'variable'
}

/**
 * Tope de ración de §4.2.2. Con `alimento_id`, el máximo de `limiteRacion`; sin él —o cuando esa
 * fila es un marcador degenerado (`min === max`: el tag `extra` y el carbohidrato en crudo, que
 * §3.3 declara fuera del menú)— el tope sale de la densidad energética.
 */
export function topeDe(a: AlimentoPropio): number {
  const catalogo = a.alimento_id ? alimentoPorId(a.alimento_id) : undefined
  if (catalogo) {
    const { min, max } = limiteRacion(catalogo)
    if (max > min) return max
  }
  const kcal = a.macros_100g.kcal
  if (kcal < 150) return 300
  if (kcal <= 400) return 150
  return 60
}

/** Rejilla de báscula según los gramos DICTADOS (§4.2.6). */
export function rejillaDe(gramos: number): number {
  if (gramos < 20) return 1
  if (gramos < 100) return 5
  return 10
}

/** Quita el ruido de coma flotante de un gramaje antes de compararlo o publicarlo. */
function limpio(n: number): number {
  return Math.round(n * 1e6) / 1e6
}

/**
 * Caja de un alimento variable (§4.2.2). La caja **siempre contiene los gramos dictados**: es lo
 * que permite que el modo `parcial` deje los factores en 1 aunque el tope de ración de ese
 * alimento sea menor que la ración que la persona come. Cuando el tope queda por debajo de lo
 * dictado, el extremo superior es lo dictado: nunca se sube por encima de un tope, pero tampoco
 * se recorta una comida real sin haberlo pedido la función objetivo.
 */
export function cajaDe(a: AlimentoPropio): Variable {
  const gramos = Math.max(0, a.gramos ?? 0)
  const tope = topeDe(a)
  const u = unidadDe(a)
  if (u !== null) {
    const n = Math.max(1, Math.round(a.cantidad_unidades ?? 1))
    // Los dos extremos salen de los GRAMOS dictados, no del número de unidades: §3.5 recalcula
    // `cantidad_unidades` redondeando y no toca `gramos`, así que en cuanto los gramos no son
    // múltiplo de la unidad, una caja en unidades se sale del factor por los dos lados.
    const loU = Math.max(1, Math.ceil((FACTOR_MIN * gramos) / u - EPS))
    const porFactor = Math.floor((FACTOR_MAX * gramos) / u + EPS)
    const porRacion = Math.max(1, Math.floor(tope / u + EPS))
    // El extremo superior tampoco baja de lo dictado (misma regla que en gramos), pero nunca pasa
    // del factor máximo.
    const contieneDictado = Math.min(Math.ceil(gramos / u - EPS), Math.max(porFactor, loU))
    const hiU = Math.max(Math.min(porFactor, porRacion), contieneDictado, loU)
    return {
      gramos,
      unidadG: u,
      unidades: n,
      lo: loU * u,
      hi: hiU * u,
      limiteArriba: porRacion < porFactor ? 'racion' : 'factor',
      paso: u,
      loRed: loU * u,
      hiRed: hiU * u,
    }
  }
  const lo = FACTOR_MIN * gramos
  const porFactor = FACTOR_MAX * gramos
  const hi = Math.max(Math.min(porFactor, tope), gramos)
  const paso = rejillaDe(gramos)
  let loRed = Math.ceil(lo / paso - EPS) * paso
  let hiRed = Math.floor(hi / paso + EPS) * paso
  if (loRed > hiRed) {
    loRed = Math.round(lo / paso) * paso
    hiRed = loRed
  }
  return {
    gramos,
    unidadG: null,
    unidades: 0,
    lo,
    hi,
    limiteArriba: tope < porFactor ? 'racion' : 'factor',
    paso,
    loRed: limpio(loRed),
    hiRed: limpio(hiRed),
  }
}

// ---------- Funciones objetivo ----------

/**
 * Totales del día con un vector de gramos. Se recorre la lista entera en el orden del array y se
 * suma desde cero (§4.2.5): es la única forma de que dos caminos distintos den el mismo número.
 */
export function totalesDe(
  piezas: readonly Pieza[],
  gramosVariables: readonly number[],
): MacrosPropio {
  let kcal = 0
  let prot = 0
  let carb = 0
  let fat = 0
  let fibra = 0
  let alcohol = 0
  for (const p of piezas) {
    const g = p.variable === null ? p.gramos : gramosVariables[p.variable]
    if (!(g > 0)) continue
    const f = g / 100
    kcal += p.macros.kcal * f
    prot += p.macros.prot * f
    carb += p.macros.carb * f
    fat += p.macros.fat * f
    fibra += p.macros.fibra * f
    alcohol += p.macros.alcohol * f
  }
  return { kcal, prot, carb, fat, fibra, alcohol }
}

function penalizacionFactores(
  variables: readonly Variable[],
  gramos: readonly number[],
  lambda: number,
): number {
  const n = variables.length
  if (n === 0) return 0
  let suma = 0
  for (let i = 0; i < n; i++) {
    const s = variables[i].gramos > 0 ? gramos[i] / variables[i].gramos : 1
    suma += (s - 1) * (s - 1)
  }
  return (lambda / n) * suma
}

/** `F(s)` de §4.2.3: desviación asimétrica por macro más el término que sujeta los factores. */
export function funcionCompleta(e: EntradaAjuste, gramos: readonly number[]): number {
  const M = totalesDe(e.piezas, gramos)
  let valor = 0
  for (const m of MACROS) {
    const T = e.objetivo[m]
    if (!(T > 0)) continue
    const d = M[m] - T
    const w = d < 0 ? PESOS[m].bajo : PESOS[m].alto
    valor += w * (d / T) * (d / T)
  }
  return valor + penalizacionFactores(e.variables, gramos, LAMBDA_COMPLETA)
}

/** Suelo de un macro para TODOS los huecos que quedan por montar (§4.2.4). */
export function sueloDe(e: EntradaAjuste, m: keyof Macros): number {
  const base = m === 'carb' && e.lowCarb ? 0 : SUELOS[m]
  return base * Math.max(0, e.huecosAMontar)
}

/**
 * `G(s)` de §4.2.4: bisagra convexa. Solo empuja los gramos dictados cuando el resto del día se
 * queda sin sitio para montar los huecos que faltan; mientras quepa, el mínimo está en `s = 1`.
 */
export function funcionParcial(e: EntradaAjuste, gramos: readonly number[]): number {
  const M = totalesDe(e.piezas, gramos)
  let valor = penalizacionFactores(e.variables, gramos, LAMBDA_PARCIAL)
  for (const m of MACROS) {
    const T = e.objetivo[m]
    if (!(T > 0)) continue
    const falta = Math.max(0, sueloDe(e, m) - (T - M[m]))
    valor += PESOS[m].bajo * (falta / T) * (falta / T)
  }
  return valor
}

/** `true` si lo dictado deja sitio para los suelos de todos los huecos a montar (§4.2.4). */
export function cabenLosSuelos(e: EntradaAjuste, gramos: readonly number[]): boolean {
  const M = totalesDe(e.piezas, gramos)
  for (const m of MACROS) {
    const T = e.objetivo[m]
    if (!(T > 0)) continue
    if (T - M[m] < sueloDe(e, m) - EPS) return false
  }
  return true
}

// ---------- Solver ----------

/**
 * Descenso por coordenadas con búsqueda ternaria (§4.2.5). La función es convexa en cada `s_i`
 * por separado (suma de cuadrados de funciones afines), así que la ternaria encuentra su mínimo
 * en la caja. Barridos en el orden de los alimentos; se para cuando el mayor cambio de factor de
 * un barrido baja de 1e-6 o a los 500 barridos.
 */
function descenso(
  e: EntradaAjuste,
  f: (gramos: readonly number[]) => number,
  gramos: number[],
): void {
  for (let barrido = 0; barrido < BARRIDOS_MAX; barrido++) {
    let mayor = 0
    for (let i = 0; i < e.variables.length; i++) {
      const v = e.variables[i]
      if (!(v.hi > v.lo)) {
        gramos[i] = v.lo
        continue
      }
      const antes = gramos[i]
      let a = v.lo
      let b = v.hi
      for (let k = 0; k < ITERACIONES_TERNARIA; k++) {
        const m1 = a + (b - a) / 3
        const m2 = b - (b - a) / 3
        gramos[i] = m1
        const f1 = f(gramos)
        gramos[i] = m2
        const f2 = f(gramos)
        if (f1 <= f2) b = m2
        else a = m1
      }
      gramos[i] = (a + b) / 2
      const cambio = v.gramos > 0 ? Math.abs(gramos[i] - antes) / v.gramos : 0
      if (cambio > mayor) mayor = cambio
    }
    if (mayor < PARADA) break
  }
}

/**
 * Redondeo a báscula dentro de la caja (§4.2.6). En un contable se lleva a la unidad MÁS CERCANA
 * (como `redondearGramos` del menú propuesto): escalar las unidades por la razón sobre los gramos
 * dictados se saltaba la unidad más próxima cuando `gramos ≠ unidades · unidad_g`.
 */
export function enRejilla(v: Variable, gramos: number): number {
  const bruto =
    v.unidadG !== null
      ? Math.max(1, Math.round(gramos / v.unidadG)) * v.unidadG
      : Math.round(gramos / v.paso) * v.paso
  return limpio(Math.min(v.hiRed, Math.max(v.loRed, bruto)))
}

/**
 * Cierre guiado por la función (§4.2.7, solo en modo `completa`): se prueban TODOS los
 * movimientos de un paso de rejilla —arriba y abajo, dentro de la caja— y se acepta el que más
 * baja `F` con los gramos ya redondeados. Así el cierre nunca aleja del objetivo; el anterior
 * "empujar el último alimento" sí podía.
 */
function cerrar(
  e: EntradaAjuste,
  f: (gramos: readonly number[]) => number,
  gramos: number[],
): void {
  for (let paso = 0; paso < PASOS_CIERRE; paso++) {
    let mejorValor = f(gramos)
    let mejorI = -1
    let mejorG = 0
    for (let i = 0; i < e.variables.length; i++) {
      const v = e.variables[i]
      for (const direccion of [1, -1]) {
        const candidato = limpio(gramos[i] + direccion * v.paso)
        if (candidato < v.loRed - EPS || candidato > v.hiRed + EPS) continue
        const previo = gramos[i]
        gramos[i] = candidato
        const valor = f(gramos)
        gramos[i] = previo
        if (valor < mejorValor - 1e-12) {
          mejorValor = valor
          mejorI = i
          mejorG = candidato
        }
      }
    }
    if (mejorI < 0) break
    gramos[mejorI] = mejorG
  }
}

/**
 * Resuelve los gramos de las variables (§4.2.3 a §4.2.7). En modo `parcial` con sitio de sobra no
 * se toca nada: los gramos dictados se devuelven tal cual, sin pasar siquiera por la rejilla, que
 * es lo que significa "factores 1".
 */
export function ajustar(e: EntradaAjuste): SalidaAjuste {
  if (e.variables.length === 0) return { gramos: [], resuelto: false, bajados: false }
  const gramos = e.variables.map((v) => v.gramos)
  let resuelto = false
  if (e.modo === 'completa') {
    descenso(e, (g) => funcionCompleta(e, g), gramos)
    resuelto = true
  } else if (!cabenLosSuelos(e, gramos)) {
    descenso(e, (g) => funcionParcial(e, g), gramos)
    resuelto = true
  }
  if (!resuelto) return { gramos, resuelto, bajados: false }
  const finales = e.variables.map((v, i) => enRejilla(v, gramos[i]))
  if (e.modo === 'completa') cerrar(e, (g) => funcionCompleta(e, g), finales)
  const bajados = e.modo === 'parcial' && finales.some((g, i) => g < e.variables[i].gramos - EPS)
  return { gramos: finales, resuelto, bajados }
}
