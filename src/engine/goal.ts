// Paso 6 — objetivo efectivo, ritmo efectivo y preferencia efectiva (SPEC-calculo.md §2, paso 6).
// Las sub-reglas 6.1 a 6.8 se ejecutan en este orden exacto.

import {
  GRASA_OBJETIVO_HOMBRE,
  GRASA_OBJETIVO_HOMBRE_65,
  GRASA_OBJETIVO_MUJER,
  GRASA_OBJETIVO_MUJER_65,
  IMC_OBJETIVO_MIN,
} from './constants'
import type { EmitirAviso } from './messages'
import type { BandaGrasa, Condicion, Inputs, ObjetivoEfectivo, Perfil, Preferencia, Ritmo } from './types'

export interface EntradaObjetivo {
  inputs: Inputs
  condiciones: readonly Condicion[]
  imc: number
  banda: BandaGrasa
  perfil: Perfil
  mlg: number
}

export interface SalidaObjetivo {
  objetivo_efectivo: ObjetivoEfectivo
  ritmo_efectivo: Ritmo
  preferencia_efectiva: Preferencia
  /** %grasa objetivo central y franja (paso 13); el central lo usa también la regla 6.3. */
  g_c: number
  g_lo: number
  g_hi: number
}

/** %grasa objetivo central y rango por sexo y edad (paso 13, usado ya en el paso 6.3). */
export function grasaObjetivo(hombre: boolean, edad: number): [number, number, number] {
  const t = edad >= 65
    ? hombre ? GRASA_OBJETIVO_HOMBRE_65 : GRASA_OBJETIVO_MUJER_65
    : hombre ? GRASA_OBJETIVO_HOMBRE : GRASA_OBJETIVO_MUJER
  return [t[0], t[1], t[2]]
}

export function calcularObjetivo(e: EntradaObjetivo, emitir: EmitirAviso): SalidaObjetivo {
  const { inputs, condiciones, imc, banda, perfil, mlg } = e
  const hombre = inputs.sexo === 'hombre'
  const PC = inputs.peso_kg
  const [g_c, g_lo, g_hi] = grasaObjetivo(hombre, inputs.edad)
  const exp = inputs.entrenamiento.experiencia
  const pobj = inputs.peso_objetivo ?? null
  let obj: ObjetivoEfectivo | 'no_se' = inputs.objetivo
  let resueltoPorPeso = false

  // 6.1 — "no lo sé"
  if (obj === 'no_se') {
    if (pobj !== null && Math.abs(pobj - PC) >= 1) {
      obj = pobj < PC ? 'perder' : 'ganar'
      resueltoPorPeso = true
      emitir('INFO_OBJETIVO_RESUELTO_POR_PESO')
    } else if (imc < 20) obj = 'mantener'
    else if (banda === 'alto' || banda === 'muy_alto') obj = 'perder'
    else if (banda === 'muy_bajo' && perfil === 'fuerza') obj = 'ganar'
    else if (perfil === 'fuerza') obj = 'recomposicion'
    else obj = 'mantener'
    if (!resueltoPorPeso) emitir('INFO_OBJETIVO_RESUELTO')
  } else if (pobj !== null && (obj === 'perder' || obj === 'ganar')) {
    // 6.2 — coherencia con el peso objetivo (solo si el usuario eligió objetivo)
    if (Math.abs(pobj - PC) < 1) {
      obj = 'mantener'
      emitir('INFO_OBJETIVO_IGUAL')
    } else if (obj === 'perder' && pobj > PC) {
      obj = 'ganar'
      emitir('WARN_OBJETIVO_INCOHERENTE')
    } else if (obj === 'ganar' && pobj < PC) {
      obj = 'perder'
      emitir('WARN_OBJETIVO_INCOHERENTE')
    }
  }

  // 6.3 — guardarraíl de bajo peso, incondicional
  if (imc < IMC_OBJETIVO_MIN && (obj === 'perder' || obj === 'recomposicion')) {
    obj = 'mantener'
    emitir('WARN_IMC_BAJO_NO_DEFICIT')
  }
  if (obj === 'perder' && (banda === 'muy_bajo' || banda === 'bajo')) {
    obj = 'recomposicion'
    emitir('WARN_YA_MAGRO')
  }
  if (obj === 'perder' && pobj === null && mlg / (1 - g_c / 100) >= PC - 0.5) {
    obj = 'recomposicion'
    emitir('WARN_YA_EN_OBJETIVO')
  }

  // 6.4 — ganancia
  if (obj === 'ganar') {
    if (imc >= IMC_OBJETIVO_MIN && (exp === 'novato' || perfil !== 'fuerza') && (banda === 'alto' || banda === 'muy_alto')) {
      obj = 'recomposicion'
      emitir('WARN_RECOMPOSICION_SUGERIDA')
    } else if (perfil !== 'fuerza') {
      emitir('WARN_GANAR_SIN_FUERZA')
    }
  }
  // 6.5
  if (obj === 'recomposicion' && perfil !== 'fuerza') emitir('WARN_RECOMPOSICION_SIN_FUERZA')
  // 6.6
  if ((obj === 'mantener' || obj === 'recomposicion') && pobj !== null && Math.abs(pobj - PC) >= 1) {
    emitir('INFO_OBJETIVO_IGNORADO')
  }

  // 6.7 — ritmo efectivo
  let ritmo_efectivo: Ritmo = inputs.ritmo
  if (condiciones.includes('tca')) {
    // El texto no menciona la causa: la respuesta del cribado es privada.
    emitir('INFO_RITMO_SUAVE')
    if (ritmo_efectivo !== 'suave') ritmo_efectivo = 'suave'
  }
  if (inputs.edad >= 65 && obj === 'perder') {
    if (ritmo_efectivo === 'agresivo') ritmo_efectivo = 'moderado'
    // El paso 17 lo retira si el paso 7 reescribe `objetivo_efectivo` a otra cosa.
    emitir('WARN_PERDIDA_MAYOR_65')
  }

  // 6.8 — preferencia efectiva
  let preferencia_efectiva: Preferencia = inputs.preferencia
  if (condiciones.includes('diabetes') && preferencia_efectiva === 'low_carb') {
    preferencia_efectiva = 'omnivoro'
    emitir('WARN_LOWCARB_DIABETES')
  }

  return { objetivo_efectivo: obj, ritmo_efectivo, preferencia_efectiva, g_c, g_lo, g_hi }
}
