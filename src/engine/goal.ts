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
import { bancoDe } from './preferences'
import type {
  BandaGrasa,
  Condicion,
  Inputs,
  Menstruacion,
  ObjetivoEfectivo,
  Perfil,
  Preferencia,
  PreferenciaBase,
  Restriccion,
  Ritmo,
} from './types'

export interface EntradaObjetivo {
  inputs: Inputs
  condiciones: readonly Condicion[]
  imc: number
  banda: BandaGrasa
  perfil: Perfil
  mlg: number
  /** Trío de la regla de traducción del paso 0 (§1.1). */
  pref_base: PreferenciaBase
  restricciones: readonly Restriccion[]
  low_carb_pedido: boolean
  /** `menstruacion` normalizada del paso 0: siempre `null` en hombres. */
  menstruacion: Menstruacion | null
}

export interface SalidaObjetivo {
  objetivo_efectivo: ObjetivoEfectivo
  /** Objetivo resuelto por la regla 6.1 (solo con `objetivo === 'no_se'`). */
  objetivo_propuesto?: ObjetivoEfectivo
  ritmo_efectivo: Ritmo
  preferencia_efectiva: Preferencia
  /** Trío efectivo publicado en `Resultado` (paso 6.8). */
  preferencia_base: PreferenciaBase
  restricciones: Restriccion[]
  low_carb: boolean
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
  // `true` cuando el peso objetivo ya explica la decisión (por dirección o por igualdad): el
  // texto genérico INFO_OBJETIVO_RESUELTO sobraría.
  let resueltoPorPeso = false
  let objetivo_propuesto: ObjetivoEfectivo | undefined

  // 6.1 — "no lo sé"
  if (obj === 'no_se') {
    if (pobj !== null && Math.abs(pobj - PC) >= 1) {
      obj = pobj < PC ? 'perder' : 'ganar'
      resueltoPorPeso = true
      emitir('INFO_OBJETIVO_RESUELTO_POR_PESO')
    } else if (pobj !== null) {
      // Meta a menos de 1 kg del peso actual: misma lectura conservadora que la regla 6.2, que
      // no cubre este caso por estar restringida a `objetivo !== 'no_se'`.
      obj = 'mantener'
      resueltoPorPeso = true
      emitir('INFO_OBJETIVO_IGUAL')
    } else if (imc < 20) obj = 'mantener'
    else if (banda === 'alto' || banda === 'muy_alto') obj = 'perder'
    else if (banda === 'muy_bajo' && perfil === 'fuerza') obj = 'ganar'
    else if (perfil === 'fuerza') obj = 'recomposicion'
    else obj = 'mantener'
    if (!resueltoPorPeso) emitir('INFO_OBJETIVO_RESUELTO')
    objetivo_propuesto = obj
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

  // 6.7bis — REGLA (solo mujeres). Es el ÚNICO efecto numérico de `menstruacion`.
  // `WARN_CICLO_AUSENTE` NO se emite aquí: su condición mira el objetivo FINAL (que los pasos 7
  // y 10bis todavía pueden reescribir) y el ritmo ELEGIDO por el usuario, no este ya suavizado.
  if (e.menstruacion === 'irregular' || e.menstruacion === 'ausente') {
    if (ritmo_efectivo === 'agresivo') ritmo_efectivo = 'moderado'
  }

  // 6.8 — preferencias: la diabetes solo anula el interruptor de bajo en hidratos
  let low_carb = e.low_carb_pedido
  if (condiciones.includes('diabetes') && low_carb) {
    low_carb = false
    emitir('WARN_LOWCARB_DIABETES')
  }
  const restricciones = [...e.restricciones]
  const preferencia_efectiva = bancoDe(e.pref_base, restricciones, low_carb)

  return {
    objetivo_efectivo: obj,
    objetivo_propuesto,
    ritmo_efectivo,
    preferencia_efectiva,
    preferencia_base: e.pref_base,
    restricciones,
    low_carb,
    g_c,
    g_lo,
    g_hi,
  }
}
