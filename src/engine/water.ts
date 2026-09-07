// Paso 12 — agua (SPEC-calculo.md §2, paso 12).
// Con enfermedad renal o cardiaca NO se da objetivo de hidratación: la restricción hídrica es
// tratamiento estándar y una sobrecarga de líquidos es causa habitual de ingreso.

import {
  AGUA_CLIMA_CALUROSO,
  AGUA_ML_POR_HORA_EJERCICIO,
  AGUA_SUELO_HOMBRE,
  AGUA_SUELO_MUJER,
  AGUA_TECHO_BASE_HOMBRE,
  AGUA_TECHO_BASE_MUJER,
  AGUA_TECHO_DURO,
  AGUA_TOPE_EJERCICIO,
  AGUA_UMBRAL_AVISO,
  AGUA_VASO_ML,
} from './constants'
import type { EmitirAviso } from './messages'
import { clamp, round50 } from './round'
import type { ActividadDiaria, Condicion, Perfil, ResultadoAgua, Sexo } from './types'

export interface EntradaAgua {
  sexo: Sexo
  edad: number
  pesoKg: number
  actividad_diaria: ActividadDiaria
  condiciones: readonly Condicion[]
  perfil: Perfil
  dias: number
  minutos_sesion: number
  clima_caluroso: boolean
}

export function calcularAgua(e: EntradaAgua, emitir: EmitirAviso): ResultadoAgua {
  const hombre = e.sexo === 'hombre'
  if (e.condiciones.includes('renal') || e.condiciones.includes('cardiaca')) {
    emitir('INFO_AGUA_NO_PRESCRITA')
    return null
  }

  const k =
    e.actividad_diaria === 'alto' || e.actividad_diaria === 'muy_alto' || e.dias >= 4
      ? 35
      : e.actividad_diaria === 'moderado' || (e.dias >= 1 && e.dias <= 3)
        ? 33
        : 30
  const suelo_agua = hombre ? AGUA_SUELO_HOMBRE : AGUA_SUELO_MUJER
  let agua_base = Math.max(e.pesoKg * k, suelo_agua)
  agua_base = Math.min(agua_base, hombre ? AGUA_TECHO_BASE_HOMBRE : AGUA_TECHO_BASE_MUJER)
  const min_dia = e.perfil === 'sedentario' ? 0 : e.minutos_sesion * e.dias / 7
  const aj_ejercicio = Math.min(AGUA_TOPE_EJERCICIO, min_dia / 60 * AGUA_ML_POR_HORA_EJERCICIO)
  const aj_clima = e.clima_caluroso ? AGUA_CLIMA_CALUROSO : 0
  const ml = round50(clamp(agua_base + aj_ejercicio + aj_clima, suelo_agua, AGUA_TECHO_DURO))
  const vasos = Math.round(ml / AGUA_VASO_ML) // orientativo: vasos · 250 ≠ ml

  if (ml >= AGUA_UMBRAL_AVISO) emitir('WARN_AGUA_ALTA')
  if (e.edad >= 65) emitir('INFO_AGUA_MAYORES')

  return {
    ml,
    rango: [Math.max(ml - 250, suelo_agua), Math.min(ml + 250, AGUA_TECHO_DURO)],
    vasos,
  }
}
