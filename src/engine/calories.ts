// Paso 7 — objetivo calórico con techos, suelos de seguridad y primera pasada de la regla de margen
// (SPEC-calculo.md §2, paso 7).

import {
  CAP_DEFICIT,
  CAP_DEFICIT_65,
  CAP_DEFICIT_MUY_ALTO,
  EA_MIN,
  EA_MIN_MUY_ALTO,
  IMC_OBJETIVO_MIN,
  KCAL_POR_KG_GRASA,
  RECOMPOSICION,
  RITMO_PERDIDA,
  SUELO_KCAL_HOMBRE,
  SUELO_KCAL_MUJER,
  SUPERAVIT,
  SUPERAVIT_MAX,
  SUPERAVIT_MIN,
  SUPERAVIT_SIN_FUERZA,
} from './constants'
import type { EmitirAviso } from './messages'
import { clamp, round10, roundUp10 } from './round'
import type { BandaGrasa, Experiencia, ObjetivoEfectivo, Perfil, Ritmo, Sexo } from './types'

export interface EntradaCalorias {
  sexo: Sexo
  edad: number
  pesoKg: number
  imc: number
  banda: BandaGrasa
  perfil: Perfil
  experiencia: Experiencia
  objetivo_efectivo: ObjetivoEfectivo
  ritmo_efectivo: Ritmo
  tdee: number
  bmr: number
  mlg: number
  ejercicio_dia: number
}

export interface SalidaCalorias {
  kcal: number
  objetivo_efectivo: ObjetivoEfectivo
  cap_pct: number
}

/** Techo de déficit como fracción del TDEE (§3.1). */
export function capDeficit(banda: BandaGrasa, edad: number): number {
  const cap = banda === 'muy_alto' ? CAP_DEFICIT_MUY_ALTO : CAP_DEFICIT
  return edad >= 65 ? Math.min(cap, CAP_DEFICIT_65) : cap
}

export function calcularCalorias(e: EntradaCalorias, emitir: EmitirAviso): SalidaCalorias {
  const hombre = e.sexo === 'hombre'
  const cap_pct = capDeficit(e.banda, e.edad)
  let objetivo_efectivo = e.objetivo_efectivo
  let kcal_calc: number

  if (objetivo_efectivo === 'perder') {
    const ritmo_pct = RITMO_PERDIDA[e.banda as 'muy_alto' | 'alto' | 'medio'][e.ritmo_efectivo]
    const deficit_ritmo = (ritmo_pct / 100) * e.pesoKg * KCAL_POR_KG_GRASA / 7
    const deficit_cap = cap_pct * e.tdee
    if (deficit_ritmo > deficit_cap) emitir('INFO_DEFICIT_CAPADO_TDEE')
    kcal_calc = e.tdee - Math.min(deficit_ritmo, deficit_cap)
  } else if (objetivo_efectivo === 'ganar') {
    const sup_pct = e.perfil !== 'fuerza' ? SUPERAVIT_SIN_FUERZA : SUPERAVIT[e.experiencia][e.ritmo_efectivo]
    kcal_calc = e.tdee + clamp(sup_pct * e.tdee, SUPERAVIT_MIN, SUPERAVIT_MAX)
  } else if (objetivo_efectivo === 'recomposicion') {
    kcal_calc = e.tdee * (1 - RECOMPOSICION[e.banda])
  } else {
    kcal_calc = e.tdee
  }

  // Prohibición dura de balance negativo en bajo peso (red redundante con el paso 6.3).
  if (e.imc < IMC_OBJETIVO_MIN) kcal_calc = Math.max(kcal_calc, e.tdee)

  const suelo_sexo = hombre ? SUELO_KCAL_HOMBRE : SUELO_KCAL_MUJER
  let suelo_activo = false

  if (objetivo_efectivo === 'perder' || objetivo_efectivo === 'recomposicion') {
    const suelo_bmr = e.bmr
    // Disponibilidad energética mínima (IOC REDs 2023): nunca se desactiva, se atenúa a 25 en muy_alto.
    const suelo_ea = (e.banda === 'muy_alto' ? EA_MIN_MUY_ALTO : EA_MIN) * e.mlg + e.ejercicio_dia
    const suelo = Math.max(suelo_sexo, suelo_bmr, suelo_ea)
    if (kcal_calc < suelo) {
      kcal_calc = suelo
      suelo_activo = true
      if (suelo === suelo_ea && suelo_ea > Math.max(suelo_sexo, suelo_bmr)) emitir('WARN_SUELO_CALORICO_EA')
      else if (suelo === suelo_bmr && suelo_bmr >= suelo_sexo) emitir('WARN_SUELO_CALORICO_BMR')
      else emitir('WARN_SUELO_CALORICO_SEXO')
    }
  }
  if ((objetivo_efectivo === 'mantener' || objetivo_efectivo === 'ganar') && kcal_calc < suelo_sexo) {
    kcal_calc = suelo_sexo
    suelo_activo = true
    emitir('WARN_GASTO_BAJO_MINIMO')
  }

  // Redondeo dirigido si hubo suelo (§0.1).
  let kcal = suelo_activo ? roundUp10(kcal_calc) : round10(kcal_calc)

  // Primera pasada de la regla de margen; los pasos 9 y 10 aún pueden subir kcal (paso 10bis).
  if ((objetivo_efectivo === 'perder' || objetivo_efectivo === 'recomposicion') && kcal >= e.tdee - 50) {
    objetivo_efectivo = 'mantener'
    kcal = round10(Math.max(e.tdee, kcal))
    emitir('WARN_SIN_MARGEN_DEFICIT')
  }

  return { kcal, objetivo_efectivo, cap_pct }
}
