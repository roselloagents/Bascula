// Filtro de preferencia dietética (docs/SPEC-ux-comidas-pdf.md §3.2). Vive en su propio módulo
// porque lo usan las plantillas, las alternativas por comida y las tablas de equivalencias: un
// alimento que no pasa este filtro no puede aparecer en NINGUNO de los tres sitios.
import type { Alimento } from '../data/foods'
import type { Preferencia } from '../engine/types'

export function pasaPreferencia(a: Alimento, preferencia: Preferencia): boolean {
  switch (preferencia) {
    case 'vegano':
      return a.tags.includes('vegano')
    case 'vegetariano':
      return a.tags.includes('vegetariano')
    case 'sin_lactosa':
      return a.grupo !== 'lacteo' || a.tags.includes('sin_lactosa')
    case 'sin_gluten':
      return a.tags.includes('sin_gluten')
    case 'low_carb':
    case 'omnivoro':
      return true
  }
}

/**
 * Las variantes «sin lactosa» de un lácteo existen para que el filtro `sin_lactosa` no vacíe el
 * grupo, no para el resto de preferencias: a un usuario omnívoro le tocaba por rotación un
 * producto más caro y sin ningún motivo en su perfil. Se dejan solo como reserva.
 */
export function esVarianteSinLactosa(a: Alimento): boolean {
  return a.grupo === 'lacteo' && a.id.endsWith('_sl')
}
