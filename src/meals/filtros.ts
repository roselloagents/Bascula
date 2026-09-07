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
}

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
  return { banco: preferencia, base, restricciones, low_carb: preferencia === 'low_carb' }
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
export function perfilDeResultado(resultado: Resultado): PerfilDietetico {
  const heredado = perfilDePreferencia(resultado.preferencia_efectiva)
  return {
    banco: resultado.preferencia_efectiva,
    base: resultado.preferencia_base ?? heredado.base,
    restricciones: resultado.restricciones
      ? normalizarRestricciones(resultado.restricciones)
      : heredado.restricciones,
    low_carb: resultado.low_carb ?? heredado.low_carb,
  }
}

/**
 * Perfil desde `InputCalculo` (regla de traducción del paso 0, `SPEC-calculo.md` §1.1). Lo usa
 * `generarListaCompra` cuando reconstruye el día B sin tener el `Resultado` delante: el banco sale
 * de `Ejemplos.preferencia_efectiva`, que ya es efectivo, y la base y las restricciones del
 * cuestionario, que `diabetes` no toca.
 */
export function perfilDeInputs(inputs: Inputs, banco: Preferencia): PerfilDietetico {
  if (inputs.preferencia_base === null || inputs.preferencia_base === undefined) {
    const antiguo = perfilDePreferencia(inputs.preferencia)
    return { ...antiguo, banco, low_carb: banco === 'low_carb' }
  }
  return {
    banco,
    base: inputs.preferencia_base,
    restricciones: normalizarRestricciones(inputs.restricciones),
    low_carb: banco === 'low_carb',
  }
}

/** Clave estable de un perfil: sirve de índice de caché y de etiqueta en los tests. */
export function clavePerfil(perfil: PerfilDietetico): string {
  return `${perfil.banco}|${perfil.base}|${perfil.restricciones.join('+')}|${perfil.low_carb ? 'lc' : ''}`
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
