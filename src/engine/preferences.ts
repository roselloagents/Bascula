// §1.1 — regla de traducción y regla inversa de las preferencias (v1.1).
// El wizard ya no pide UNA preferencia, sino una base excluyente + restricciones combinables +
// un interruptor de bajo en hidratos. El motor sigue aceptando el campo antiguo, y por eso
// ninguno de los catorce vectores de la §5 cambia: traducido, el formato antiguo produce
// exactamente el mismo trío efectivo que leía la v1.0.

import { PREFERENCIAS_BASE, RESTRICCIONES_CANONICAS } from './constants'
import type { Inputs, Preferencia, PreferenciaBase, Restriccion } from './types'

export interface PreferenciasNormalizadas {
  pref_base: PreferenciaBase
  restricciones: Restriccion[]
  /** Interruptor tal y como lo pidió el usuario; el paso 6.8 lo anula con `diabetes`. */
  low_carb_pedido: boolean
}

const esBase = (v: unknown): v is PreferenciaBase =>
  typeof v === 'string' && (PREFERENCIAS_BASE as readonly string[]).includes(v)

/**
 * Paso 0 — regla de traducción (§1.1). Con `preferencia_base` presente, `preferencia` **no se lee**;
 * cuando falta (o es `null`), el trío se deduce del campo antiguo.
 */
export function normalizarPreferencias(inputs: Inputs): PreferenciasNormalizadas {
  if (inputs.preferencia_base === undefined || inputs.preferencia_base === null) {
    return {
      pref_base: esBase(inputs.preferencia) ? inputs.preferencia : 'omnivoro',
      restricciones:
        inputs.preferencia === 'sin_lactosa'
          ? ['sin_lactosa']
          : inputs.preferencia === 'sin_gluten'
            ? ['sin_gluten']
            : [],
      low_carb_pedido: inputs.preferencia === 'low_carb',
    }
  }
  const pedidas = Array.isArray(inputs.restricciones) ? inputs.restricciones : []
  return {
    pref_base: inputs.preferencia_base,
    // Deduplicadas y en orden canónico: el filtro del generador de menús las recorre tal cual.
    restricciones: RESTRICCIONES_CANONICAS.filter((r) => pedidas.includes(r)),
    low_carb_pedido: inputs.low_carb === true,
  }
}

/**
 * Regla inversa (§1.1): el banco de plantillas que publica el motor en `preferencia_efectiva`.
 * `sin_gluten` va antes que `sin_lactosa` porque su banco cambia la estructura de las plantillas;
 * las restricciones que no dan nombre al banco no se pierden (viajan en `Resultado.restricciones`).
 */
export function bancoDe(
  pref_base: PreferenciaBase,
  restricciones: readonly Restriccion[],
  low_carb: boolean,
): Preferencia {
  if (low_carb) return 'low_carb'
  if (pref_base === 'vegano') return 'vegano'
  if (pref_base === 'vegetariano') return 'vegetariano'
  if (restricciones.includes('sin_gluten')) return 'sin_gluten'
  if (restricciones.includes('sin_lactosa')) return 'sin_lactosa'
  return 'omnivoro'
}
