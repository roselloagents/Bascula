// Paso 5 — TDEE (NEAT + ejercicio, sin sobreestimar) (SPEC-calculo.md §2, paso 5).
// Tres mecanismos evitan sobreestimar: PAL solo de vida diaria, MET neto (MET − 1) y el factor 0,95.

import { FACTOR_CORRECCION, MET, PAL_BASE } from './constants'
import type { EmitirAviso } from './messages'
import type { Inputs, Perfil, ResultadoTdee } from './types'

export interface SalidaTdee extends ResultadoTdee {
  /** Días efectivos de entrenamiento: 0 si `tipo = 'ninguno'`. */
  dias: number
  met: number
  kcal_sesion: number
}

/** Perfil de entrenamiento (§3.6). */
export function calcularPerfil(tipo: Inputs['entrenamiento']['tipo'], dias: number): Perfil {
  if (tipo === 'ninguno' || dias === 0) return 'sedentario'
  return tipo === 'cardio' ? 'cardio' : 'fuerza'
}

export function calcularTdee(inputs: Inputs, bmr: number, emitir: EmitirAviso): SalidaTdee {
  const t = inputs.entrenamiento
  const dias = t.tipo === 'ninguno' ? 0 : t.dias_semana
  const perfil = calcularPerfil(t.tipo, dias)
  const pal = PAL_BASE[inputs.actividad_diaria]
  const met = perfil === 'sedentario' ? 0 : MET[t.tipo][t.intensidad]
  // MET neto: se resta el reposo, ya incluido en BMR · PAL.
  const kcal_sesion =
    perfil === 'sedentario' ? 0 : ((met - 1) * inputs.peso_kg * t.minutos_sesion) / 60
  const ejercicio_dia = (kcal_sesion * dias) / 7
  const bruto = bmr * pal + ejercicio_dia
  const valor = bruto * FACTOR_CORRECCION

  if (perfil === 'fuerza' && dias >= 4) emitir('INFO_BMR_ATLETA')

  return { valor, bruto, pal, ejercicio_dia, perfil, dias, met, kcal_sesion }
}
