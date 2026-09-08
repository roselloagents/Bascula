// Paso 15 — FFMI (SPEC-calculo.md §2, paso 15). Nunca es input de macros.
// La normalización de Kouri se derivó en varones: la referencia es 1,70 m en mujeres.

import {
  FFMI_CONSTANTE_KOURI,
  FFMI_CORTES_HOMBRE,
  FFMI_CORTES_MUJER,
  FFMI_REF_ALTURA_HOMBRE,
  FFMI_REF_ALTURA_MUJER,
} from './constants'
import type { BandaGrasa, FfmiCategoria, ResultadoFfmi, Sexo } from './types'

export function categoriaFfmi(normalizado: number, hombre: boolean): FfmiCategoria {
  const [c1, c2, c3, c4] = hombre ? FFMI_CORTES_HOMBRE : FFMI_CORTES_MUJER
  if (normalizado < c1) return 'bajo'
  if (normalizado < c2) return 'medio'
  if (normalizado < c3) return 'bueno'
  if (normalizado < c4) return 'muy_desarrollado'
  return 'excepcional'
}

export function calcularFfmi(sexo: Sexo, mlg: number, h: number, banda: BandaGrasa): ResultadoFfmi {
  const hombre = sexo === 'hombre'
  const valor = mlg / (h * h)
  const ref = hombre ? FFMI_REF_ALTURA_HOMBRE : FFMI_REF_ALTURA_MUJER
  const normalizado = valor + FFMI_CONSTANTE_KOURI * (ref - h)
  // Con mucha grasa el FFMI no informa de musculatura: se muestra el número, no la categoría.
  const categoria =
    banda === 'alto' || banda === 'muy_alto' ? null : categoriaFfmi(normalizado, hombre)
  return { valor, normalizado, categoria }
}
