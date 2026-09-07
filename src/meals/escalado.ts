// Algoritmo de escalado de gramajes por comida (docs/SPEC-ux-comidas-pdf.md §3.3 y §3.5).
// Todas las kcal salen del campo `kcal` del alimento, nunca de 4P+4HC+9G (§3.0).
import type { Alimento } from '../data/foods'
import { esContable } from '../data/foods'
import type { Macros } from '../engine/types'

/** Rol funcional de una porción dentro de la comida; ordena el cierre de kcal. */
export type RolPorcion = 'verdura' | 'fruta' | 'proteina' | 'proteina2' | 'carbohidrato' | 'grasa'

export interface Porcion {
  rol: RolPorcion
  alimento: Alimento
  gramos: number
}

/** Plantilla ya resuelta a alimentos concretos de `foods.json`. */
export interface PlantillaResuelta {
  id: string
  proteina: Alimento | null
  proteina2: Alimento | null
  carbohidrato: Alimento | null
  /** Vía de escape de §3.2 en `low_carb`: cereal normal cuando el ancla low-carb no llega. */
  carbohidrato_alterno: Alimento | null
  grasa: Alimento | null
  verdura: Alimento | null
  fruta: Alimento | null
}

export interface LimiteRacion {
  min: number
  max: number
}

const IDS_CREMAS = ['mantequilla_cacahuete']

/**
 * Topes de plausibilidad de los alimentos contables (§3.5): un gramaje puede caber en la fila de
 * `clampRacion` y aun así no parecerse a un plato real. Siete claras de huevo o cuatro latas de
 * atún son técnicamente válidas y nadie las come así.
 */
const TOPE_UNIDADES: Record<string, number> = {
  clara_huevo: 5,
  atun_natural: 2,
  atun_aceite: 2,
  tortitas_arroz: 8,
}

/**
 * Límites de ración de la tabla de §3.3. Los predicados son mutuamente excluyentes:
 * todo alimento de la base encaja en exactamente una fila (lo comprueba el test de la base).
 */
export function filaRacion(a: Alimento): LimiteRacion {
  const rol = (r: string) => a.roles.includes(r as Alimento['roles'][number])
  if (a.grupo === 'proteina' && a.estado === 'seco') return { min: 15, max: 60 }
  if (a.grupo === 'proteina' && rol('carbohidrato')) return { min: 50, max: 300 }
  if (a.grupo === 'proteina') return { min: 50, max: 250 }
  if (a.grupo === 'lacteo' && rol('proteina') && a.grasa >= 20) return { min: 20, max: 80 }
  if (a.grupo === 'lacteo' && (rol('proteina') || rol('complemento'))) return { min: 100, max: 300 }
  if (a.grupo === 'carbohidrato' && a.estado === 'cocido') return { min: 50, max: 300 }
  if (a.grupo === 'carbohidrato' && a.estado === 'seco') return { min: 30, max: 100 }
  if (a.grupo === 'carbohidrato' && a.estado === 'listo') return { min: 15, max: 100 }
  if (a.id === 'aceitunas') return { min: 10, max: 40 }
  if (a.id === 'aguacate') return { min: 50, max: 150 }
  if (rol('grasa') && a.grasa >= 80) return { min: 5, max: 25 }
  if (a.grupo === 'grasa' && IDS_CREMAS.includes(a.id)) return { min: 10, max: 30 }
  if (a.grupo === 'grasa' && a.grasa >= 25 && a.grasa < 80) return { min: 10, max: 50 }
  // Verdura y fruta: ración fija; el techo solo acota la ración doble de low-carb.
  if (a.grupo === 'verdura' || a.grupo === 'fruta') {
    return { min: a.racionTipica_g, max: a.racionTipica_g * 3 }
  }
  // Carbohidrato crudo: excluido del banco de plantillas (§3.0). Nunca debería llegar aquí.
  return { min: a.racionTipica_g, max: a.racionTipica_g }
}

/**
 * Límites efectivos: en los alimentos contables el mínimo es una unidad y el máximo, el mayor
 * múltiplo de `unidad_g` que no supere el máximo de su fila (§3.3).
 * Los máximos de la tabla de §3.3 son duros: una toma muy grande se reparte en varios platos
 * (cada uno con su propia plantilla), nunca ampliando la ración de un alimento.
 */
export function limiteRacion(a: Alimento): LimiteRacion {
  const base = filaRacion(a)
  if (!esContable(a)) return base
  const u = a.unidad_g
  const tope = TOPE_UNIDADES[a.id]
  const maxFila = tope === undefined ? base.max : Math.min(base.max, tope * u)
  return { min: u, max: Math.max(u, Math.floor(maxFila / u) * u) }
}

/** Paso de báscula: múltiplos de 5 g por debajo de 100 g, de 10 g a partir de 100 g (§3.3). */
function paso(gramos: number): number {
  return gramos >= 100 ? 10 : 5
}

/** Redondea a la rejilla de báscula y recorta a los límites de ración del alimento. */
export function redondearGramos(a: Alimento, gramos: number): number {
  const { min, max } = limiteRacion(a)
  if (!Number.isFinite(gramos)) return min
  if (esContable(a)) {
    const u = a.unidad_g
    const n = Math.max(1, Math.round(gramos / u))
    return Math.min(max, Math.max(min, n * u))
  }
  const bruto = Math.min(max, Math.max(min, gramos))
  const p = paso(bruto)
  let g = Math.round(bruto / p) * p
  if (g < min) g = min
  if (g > max) g = max
  return g
}

/** Siguiente gramaje válido en la dirección pedida, o el mismo valor si la palanca está agotada. */
export function siguienteGramaje(a: Alimento, gramos: number, direccion: 1 | -1): number {
  const { min, max } = limiteRacion(a)
  const salto = esContable(a) ? a.unidad_g : direccion < 0 ? (gramos > 100 ? 10 : 5) : gramos >= 100 ? 10 : 5
  const g = Math.min(max, Math.max(min, gramos + direccion * salto))
  return g
}

// ---------- Sumas sobre la selección ----------
export const sumaProteina = (s: readonly Porcion[]): number =>
  s.reduce((t, x) => t + (x.alimento.proteina * x.gramos) / 100, 0)
export const sumaGrasa = (s: readonly Porcion[]): number =>
  s.reduce((t, x) => t + (x.alimento.grasa * x.gramos) / 100, 0)
export const sumaHc = (s: readonly Porcion[]): number =>
  s.reduce((t, x) => t + (x.alimento.carbohidratos * x.gramos) / 100, 0)
export const sumaKcal = (s: readonly Porcion[]): number =>
  s.reduce((t, x) => t + (x.alimento.kcal * x.gramos) / 100, 0)
export const sumaFibra = (s: readonly Porcion[]): number =>
  s.reduce((t, x) => t + (x.alimento.fibra * x.gramos) / 100, 0)

/**
 * Energía y proteína "publicadas": la suma de los valores YA redondeados de cada alimento, que
 * es lo que ve el usuario en la tarjeta de la comida. El cierre y la validación trabajan sobre
 * estas cifras para que no haya desviaciones que solo existan por el redondeo de presentación.
 */
export const kcalPublicada = (s: readonly Porcion[]): number =>
  s.reduce((t, x) => t + Math.round((x.alimento.kcal * x.gramos) / 100), 0)
export const proteinaPublicada = (s: readonly Porcion[]): number =>
  Math.round(s.reduce((t, x) => t + Math.round((x.alimento.proteina * x.gramos) / 10) / 10, 0) * 10) / 10

/** Tolerancia normativa de kcal por comida (§3.3). */
export const TOLERANCIA_KCAL = 0.1
/** Umbral terminal de proteína por comida (§3.3, WARN_MENU_PROTEINA_VEGETAL). */
export const TOLERANCIA_PROTEINA = 0.15

/**
 * Escala una plantilla resuelta hasta cuadrar el objetivo de la toma.
 * Orden: verdura y fruta (ración fija, descontadas) → proteína → segunda proteína →
 * carbohidrato → grasa de ajuste → cierre de kcal.
 */
export function escalarComida(objetivo: Macros, plan: PlantillaResuelta, lowCarb: boolean): Porcion[] {
  const sel: Porcion[] = []
  const anadir = (rol: RolPorcion, alimento: Alimento, gramos: number): void => {
    if (gramos > 0) sel.push({ rol, alimento, gramos })
  }

  // 0. Verdura y fruta: ración fija, pero sus macros se descuentan del objetivo.
  if (plan.verdura) {
    anadir('verdura', plan.verdura, redondearGramos(plan.verdura, plan.verdura.racionTipica_g))
  }
  if (plan.fruta) {
    anadir('fruta', plan.fruta, redondearGramos(plan.fruta, plan.fruta.racionTipica_g))
  }

  // 1. Ancla de proteína, con topes cruzados sobre grasa e hidrato.
  if (plan.proteina && plan.proteina.proteina > 0) {
    anadir('proteina', plan.proteina, gramosAncla(plan.proteina, objetivo, sel))
  }

  // 1b. Segunda fuente de proteína si la primera se quedó corta por un tope.
  if (plan.proteina2 && plan.proteina2.proteina > 0 && objetivo.prot - sumaProteina(sel) > 5) {
    anadir('proteina2', plan.proteina2, gramosAncla(plan.proteina2, objetivo, sel))
  }

  // 2. Ancla de carbohidrato: cubre lo que falta, con lo ya aportado descontado.
  let hcPendiente = Math.max(0, objetivo.carb - sumaHc(sel))
  const sinAnclaHc = lowCarb && hcPendiente < 20
  if (sinAnclaHc) {
    // Regla propia de low-carb (§3.2): sin ancla de HC, la verdura sube al doble de su ración.
    const verdura = sel.find((x) => x.rol === 'verdura')
    if (verdura) {
      verdura.gramos = redondearGramos(verdura.alimento, verdura.alimento.racionTipica_g * 2)
    }
    hcPendiente = Math.max(0, objetivo.carb - sumaHc(sel))
  }
  if (!sinAnclaHc) {
    // Vía de escape de §3.2: si el ancla low-carb no puede cubrir el hidrato pendiente ni con su
    // ración máxima, se permite un cereal normal y se rebaja la ración (se escala al pendiente).
    let ancla = plan.carbohidrato
    if (lowCarb && plan.carbohidrato_alterno) {
      const techo = ancla ? (ancla.carbohidratos * limiteRacion(ancla).max) / 100 : 0
      if (techo < hcPendiente) ancla = plan.carbohidrato_alterno
    }
    if (ancla && ancla.carbohidratos > 0) {
      const g = hcPendiente / (ancla.carbohidratos / 100)
      anadir('carbohidrato', ancla, redondearGramos(ancla, g))
    }
  }

  // 3. Ancla de grasa: solo si falta grasa apreciable (con < 4 g ya se pasaría el mínimo de 5 g).
  const grasaPendiente = objetivo.fat - sumaGrasa(sel)
  if (plan.grasa && plan.grasa.grasa > 0 && grasaPendiente >= 4) {
    const g = grasaPendiente / (plan.grasa.grasa / 100)
    anadir('grasa', plan.grasa, redondearGramos(plan.grasa, g))
  }

  // 4. Cierre de kcal y, si hace falta, ajuste fino de la proteína.
  cerrarKcal(sel, objetivo)
  cerrarProteina(sel, objetivo)
  return sel
}

/** Gramos de un ancla de proteína con los topes cruzados de §3.3. */
function gramosAncla(a: Alimento, objetivo: Macros, sel: readonly Porcion[]): number {
  let g = (objetivo.prot - sumaProteina(sel)) / (a.proteina / 100)
  if (a.grasa > 5) g = Math.min(g, (objetivo.fat - sumaGrasa(sel)) / (a.grasa / 100))
  if (a.carbohidratos > 5) g = Math.min(g, (objetivo.carb - sumaHc(sel)) / (a.carbohidratos / 100))
  return redondearGramos(a, g)
}

/** Orden de sacrificio del cierre: carbohidrato → grasa → proteína (§3.3). */
const ORDEN_CIERRE: readonly RolPorcion[] = ['carbohidrato', 'grasa', 'proteina2', 'proteina']

/** Ajusta la comida en pasos de báscula hasta entrar en el ±10 % de kcal, o hasta agotar palancas. */
function cerrarKcal(sel: Porcion[], objetivo: Macros): void {
  if (objetivo.kcal <= 0) return
  const desviacion = (): number => Math.abs(kcalPublicada(sel) - objetivo.kcal) / objetivo.kcal
  for (const rol of ORDEN_CIERRE) {
    const p = sel.find((x) => x.rol === rol)
    if (!p) continue
    // 200 pasos son de sobra para recorrer cualquier rango de ración de la tabla.
    for (let i = 0; i < 200 && desviacion() > TOLERANCIA_KCAL; i++) {
      const direccion: 1 | -1 = kcalPublicada(sel) > objetivo.kcal ? -1 : 1
      const previo = p.gramos
      const desviacionPrevia = desviacion()
      const nuevo = siguienteGramaje(p.alimento, previo, direccion)
      if (nuevo === previo) break
      p.gramos = nuevo
      if (desviacion() >= desviacionPrevia) {
        p.gramos = previo
        break
      }
    }
    if (desviacion() <= TOLERANCIA_KCAL) return
  }
}

/**
 * Ajuste fino de la proteína cuando el cierre de kcal la deja fuera del umbral terminal del
 * ±15 % (§3.3): se mueve el ancla de proteína hacia el objetivo y se compensan las kcal con el
 * carbohidrato (o la grasa). Cualquier paso que empeore la proteína o saque las kcal del ±10 %
 * se deshace por completo, así que este ajuste nunca puede estropear el cierre anterior.
 */
function cerrarProteina(sel: Porcion[], objetivo: Macros): void {
  if (objetivo.prot <= 0 || objetivo.kcal <= 0) return
  const ancla = sel.find((x) => x.rol === 'proteina')
  if (!ancla) return
  const compensa = sel.find((x) => x.rol === 'carbohidrato') ?? sel.find((x) => x.rol === 'grasa')
  const desvProteina = (): number => Math.abs(proteinaPublicada(sel) - objetivo.prot) / objetivo.prot
  const desvKcal = (): number => Math.abs(kcalPublicada(sel) - objetivo.kcal) / objetivo.kcal

  for (let i = 0; i < 100 && desvProteina() > TOLERANCIA_PROTEINA; i++) {
    const copia = sel.map((x) => x.gramos)
    const antesProteina = desvProteina()
    const direccion: 1 | -1 = proteinaPublicada(sel) > objetivo.prot ? -1 : 1
    const nuevo = siguienteGramaje(ancla.alimento, ancla.gramos, direccion)
    if (nuevo === ancla.gramos) break
    ancla.gramos = nuevo
    if (compensa) {
      for (let j = 0; j < 60 && desvKcal() > TOLERANCIA_KCAL; j++) {
        const antesKcal = desvKcal()
        const dirKcal: 1 | -1 = kcalPublicada(sel) > objetivo.kcal ? -1 : 1
        const previo = compensa.gramos
        const siguiente = siguienteGramaje(compensa.alimento, previo, dirKcal)
        if (siguiente === previo) break
        compensa.gramos = siguiente
        if (desvKcal() >= antesKcal) {
          compensa.gramos = previo
          break
        }
      }
    }
    if (desvProteina() >= antesProteina || desvKcal() > TOLERANCIA_KCAL) {
      sel.forEach((x, k) => (x.gramos = copia[k]))
      break
    }
  }
}

// ---------- Medida casera (§3.5) ----------

/** Pluraliza una palabra española sencilla; deja intactas las siglas y calificativos de una letra. */
function plural(palabra: string): string {
  if (palabra.length <= 1 || palabra === palabra.toUpperCase()) return palabra
  const ultima = palabra.slice(-1).toLowerCase()
  if (ultima === 's') return palabra
  if ('aeiouáéíóú'.includes(ultima)) return `${palabra}s`
  return `${palabra}es`
}

/** Medida casera coherente con el gramaje real (§3.5). Nunca devuelve cadena vacía. */
export function textoMedida(a: Alimento, gramos: number): string {
  if (esContable(a)) {
    const n = Math.max(1, Math.round(gramos / a.unidad_g))
    const nombre = a.unidad_nombre
      .split(' ')
      .map((w) => (n > 1 ? plural(w) : w))
      .join(' ')
    return `${n} ${nombre}`
  }
  const r = gramos / a.racionTipica_g
  if (r < 0.75) return `ración pequeña, ${a.medidaCasera}`
  if (r <= 1.35) return a.medidaCasera
  if (r <= 2.25) return `ración generosa, ${a.medidaCasera}`
  return `ración doble, ${a.medidaCasera}: puedes repartirla en dos platos`
}
