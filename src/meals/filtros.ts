// Filtro de alimentos (docs/SPEC-ux-comidas-pdf.md §3.2). Vive en su propio módulo porque lo usan
// las plantillas, las alternativas por comida y las tablas de equivalencias: un alimento que no
// pasa este filtro no puede aparecer en NINGUNO de los tres sitios.
//
// v1.1 (decisión E): la preferencia deja de ser un único valor excluyente y pasa a ser una **base**
// (omnívoro / vegetariano / vegano) más **restricciones combinables** (sin lactosa, sin gluten) más
// el interruptor **bajo en hidratos**. El filtro es la CONJUNCIÓN de la base y de todas las
// restricciones; ningún fallback puede relajar ninguna de las dos cosas. El banco de plantillas lo
// sigue eligiendo `preferencia_efectiva` (la "regla inversa" de `SPEC-calculo.md` §1.1), que no
// tiene por qué llevar todas las restricciones: un vegetariano sin gluten usa el banco vegetariano
// y, encima, el filtro de `sin_gluten`.
import type { Alimento } from '../data/foods'
import { alimentoPorId } from '../data/foods'
import type { Inputs, Preferencia, PreferenciaBase, Restriccion, Resultado } from '../engine/types'

/** Orden canónico de las restricciones (`SPEC-calculo.md` §1.1): fija el determinismo. */
export const RESTRICCIONES_CANONICAS: readonly Restriccion[] = ['sin_lactosa', 'sin_gluten']

/**
 * Lo que el generador necesita saber de las preferencias del usuario. `banco` es
 * `resultado.preferencia_efectiva` (qué banco de plantillas se usa) y los otros tres, el trío
 * efectivo de `SPEC-calculo.md` §1.1 con el que se filtra CADA alimento.
 */
export interface PerfilDietetico {
  /** Banco de plantillas (§3.2, regla inversa). */
  banco: Preferencia
  base: PreferenciaBase
  restricciones: readonly Restriccion[]
  low_carb: boolean
  /**
   * v1.2 (§3.2b): ids de `foods.json` que el usuario no quiere ver. Se filtran DESPUÉS de la base
   * y de las restricciones y ANTES de cualquier otro criterio, y no pueden aparecer en ningún
   * sitio: menú, alternativas, equivalencias, lista de la compra ni alimentos del ciclo.
   */
  excluidos: ReadonlySet<string>
  /**
   * v1.2 (§3.2b): ids marcados como favoritos, **en el orden del usuario** (ese orden es
   * normativo). Solo cambian el ORDEN dentro de una consulta, nunca la validez: un favorito que
   * no pasa la base, una restricción o la `FoodQuery` simplemente no aparece.
   */
  favoritos: readonly string[]
}

/** Listas de alimentos vacías: el perfil de quien no ha marcado nada en el paso 14. */
const SIN_LISTAS: Pick<PerfilDietetico, 'excluidos' | 'favoritos'> = {
  excluidos: new Set<string>(),
  favoritos: [],
}

/**
 * Normalización de §3.2b, **una sola vez al construir el perfil**: se descartan los ids que no
 * existen en `foods.json`, se deduplica conservando el orden del usuario y un id que esté en las
 * dos listas cuenta solo como excluido (se retira de favoritos).
 */
export function normalizarListasAlimentos(
  excluidos: readonly string[] | null | undefined,
  favoritos: readonly string[] | null | undefined,
): Pick<PerfilDietetico, 'excluidos' | 'favoritos'> {
  const limpia = (ids: readonly string[] | null | undefined): string[] => {
    const vistos = new Set<string>()
    const lista: string[] = []
    for (const id of ids ?? []) {
      if (typeof id !== 'string' || vistos.has(id) || alimentoPorId(id) === undefined) continue
      vistos.add(id)
      lista.push(id)
    }
    return lista
  }
  const fuera = new Set(limpia(excluidos))
  // Exclusiones encadenadas (§3.2b): hay alimentos que son otro alimento con otra forma. El
  // "arroz de coliflor" ES coliflor rallada, y quien marca la coliflor no espera encontrársela
  // en el plato bajo otro nombre. La cadena va en un solo sentido: excluir el arroz de coliflor
  // no retira la coliflor, que es una verdura normal.
  for (const [origen, arrastrados] of EXCLUSIONES_ENCADENADAS) {
    if (fuera.has(origen)) for (const id of arrastrados) fuera.add(id)
  }
  return { excluidos: fuera, favoritos: limpia(favoritos).filter((id) => !fuera.has(id)) }
}

/** Un id excluido arrastra a estos otros (§3.2b): el mismo alimento con otra presentación. */
const EXCLUSIONES_ENCADENADAS: readonly (readonly [string, readonly string[]])[] = [
  ['coliflor', ['arroz_coliflor']],
]

export function pasaBase(a: Alimento, base: PreferenciaBase): boolean {
  switch (base) {
    case 'vegano':
      return a.tags.includes('vegano')
    case 'vegetariano':
      return a.tags.includes('vegetariano')
    case 'omnivoro':
      return true
  }
}

export function pasaRestriccion(a: Alimento, r: Restriccion): boolean {
  switch (r) {
    case 'sin_lactosa':
      return a.grupo !== 'lacteo' || a.tags.includes('sin_lactosa')
    case 'sin_gluten':
      return a.tags.includes('sin_gluten')
  }
}

/** Conjunción de todas las restricciones del usuario (§3.2). */
export function pasaRestricciones(a: Alimento, restricciones: readonly Restriccion[]): boolean {
  return restricciones.every((r) => pasaRestriccion(a, r))
}

/** Filtro completo de §3.2: base Y todas las restricciones. `low_carb` no filtra alimentos. */
export function pasaPerfil(a: Alimento, perfil: PerfilDietetico): boolean {
  return pasaBase(a, perfil.base) && pasaRestricciones(a, perfil.restricciones)
}

/**
 * Regla de traducción de `SPEC-calculo.md` §1.1 aplicada a un único valor `Preferencia`. Es la
 * que se usa con un `Resultado` de la v1.0 (sin los tres campos nuevos) y con cualquier código
 * que siga hablando de una preferencia única.
 */
export function perfilDePreferencia(preferencia: Preferencia): PerfilDietetico {
  const base: PreferenciaBase =
    preferencia === 'vegano' || preferencia === 'vegetariano' ? preferencia : 'omnivoro'
  const restricciones: Restriccion[] =
    preferencia === 'sin_lactosa' ? ['sin_lactosa'] : preferencia === 'sin_gluten' ? ['sin_gluten'] : []
  return { banco: preferencia, base, restricciones, low_carb: preferencia === 'low_carb', ...SIN_LISTAS }
}

/**
 * v1.2 (§3.0): los alimentos con tag `extra` existen solo para la tarjeta del ciclo (§3.8) y no
 * pueden entrar en ninguna `FoodQuery` del menú, ni en las alternativas, ni en las tablas de
 * equivalencias. Así se añaden alimentos a la base sin cambiar ni un menú existente.
 */
export function esExtra(a: Alimento): boolean {
  return a.tags.includes('extra')
}

/** Filtro completo del menú (§3.2 + §3.2b): perfil, fuera los `extra` y fuera los excluidos. */
export function pasaPerfilMenu(a: Alimento, perfil: PerfilDietetico): boolean {
  return pasaPerfil(a, perfil) && !esExtra(a) && !perfil.excluidos.has(a.id)
}

/** Deduplica y ordena las restricciones en el orden canónico de §1.1. */
function normalizarRestricciones(rs: readonly Restriccion[] | null | undefined): Restriccion[] {
  return RESTRICCIONES_CANONICAS.filter((r) => (rs ?? []).includes(r))
}

/**
 * Perfil con el que se construye el menú. Sale de `Resultado`, **nunca de `Inputs`**: el motor
 * publica los tres campos ya normalizados (§1.1 y Paso 6.8, donde `diabetes` anula el low-carb).
 * Un `Resultado` que no los traiga se deduce de `preferencia_efectiva` con la regla de traducción.
 */
export function perfilDeResultado(resultado: Resultado, inputs?: Inputs): PerfilDietetico {
  const heredado = perfilDePreferencia(resultado.preferencia_efectiva)
  return {
    banco: resultado.preferencia_efectiva,
    base: resultado.preferencia_base ?? heredado.base,
    restricciones: resultado.restricciones
      ? normalizarRestricciones(resultado.restricciones)
      : heredado.restricciones,
    low_carb: resultado.low_carb ?? heredado.low_carb,
    // Las dos listas del paso 14 salen de `InputCalculo`, **no de `Resultado`**: el motor las
    // ignora por completo y por eso no las publica (§3.2b). Sin `inputs` —un `Resultado` suelto
    // en un test— el perfil queda sin listas, que es el comportamiento de la v1.1.
    ...normalizarListasAlimentos(inputs?.alimentos_excluidos, inputs?.alimentos_favoritos),
  }
}

/**
 * Perfil desde `InputCalculo` (regla de traducción del paso 0, `SPEC-calculo.md` §1.1). Lo usa
 * `generarListaCompra` cuando reconstruye el día B sin tener el `Resultado` delante: el banco sale
 * de `Ejemplos.preferencia_efectiva`, que ya es efectivo, y la base y las restricciones del
 * cuestionario, que `diabetes` no toca.
 */
export function perfilDeInputs(inputs: Inputs, banco: Preferencia): PerfilDietetico {
  const listas = normalizarListasAlimentos(inputs.alimentos_excluidos, inputs.alimentos_favoritos)
  if (inputs.preferencia_base === null || inputs.preferencia_base === undefined) {
    const antiguo = perfilDePreferencia(inputs.preferencia)
    return { ...antiguo, banco, low_carb: banco === 'low_carb', ...listas }
  }
  return {
    banco,
    base: inputs.preferencia_base,
    restricciones: normalizarRestricciones(inputs.restricciones),
    low_carb: banco === 'low_carb',
    ...listas,
  }
}

/** Clave estable de un perfil: sirve de índice de caché y de etiqueta en los tests. */
export function clavePerfil(perfil: PerfilDietetico): string {
  // Las dos listas del paso 14 entran en la clave: la caché de `alimentosDePerfil` alimenta las
  // alternativas por comida, que ni pueden nombrar un excluido ni ignoran el orden de favoritos.
  const excluidos = [...perfil.excluidos].sort().join(',')
  const favoritos = perfil.favoritos.join(',')
  return `${perfil.banco}|${perfil.base}|${perfil.restricciones.join('+')}|${perfil.low_carb ? 'lc' : ''}|${excluidos}|${favoritos}`
}

/**
 * Las variantes «sin lactosa» de un lácteo existen para que la restricción `sin_lactosa` no vacíe
 * el grupo, no para el resto de perfiles: a un usuario omnívoro le tocaba por rotación un producto
 * más caro y sin ningún motivo en su perfil. Fuera de esa restricción se dejan solo como reserva.
 */
export function esVarianteSinLactosa(a: Alimento): boolean {
  return a.grupo === 'lacteo' && a.id.endsWith('_sl')
}

/**
 * Sustitución por variante `_sl` de §3.2: con `'sin_lactosa' ∈ restricciones`, un id cuya variante
 * sin lactosa exista en `foods.json` se cambia por ella **conservando su posición** en la lista de
 * preferidos. Sin esta regla, un vegetariano sin lactosa (banco `vegetariano`, cuyas plantillas
 * nombran `yogur_griego_0`) perdía sus dos anclas lácteas y caía a la reserva.
 */
export function idConSinLactosa(id: string): string {
  if (id.endsWith('_sl')) return id
  return alimentoPorId(`${id}_sl`) ? `${id}_sl` : id
}

/** Aplica `idConSinLactosa` a una lista de ids si el perfil lo pide; si no, la devuelve tal cual. */
export function sustituirSinLactosa(ids: readonly string[], perfil: PerfilDietetico): readonly string[] {
  if (!perfil.restricciones.includes('sin_lactosa')) return ids
  return ids.map(idConSinLactosa)
}

/**
 * Filtro de la v1.0 sobre una preferencia única. Se conserva porque el resto del proyecto —y los
 * tests de la v1.0— siguen hablando de un único valor; internamente es el filtro combinable de
 * §3.2 aplicado al perfil que produce la regla de traducción.
 */
export function pasaPreferencia(a: Alimento, preferencia: Preferencia): boolean {
  return pasaPerfil(a, perfilDePreferencia(preferencia))
}
