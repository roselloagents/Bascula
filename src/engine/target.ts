// Paso 13 — peso objetivo: sugerido y validación del que da el usuario (SPEC-calculo.md §2, paso 13).
// El redondeo a 0,5 kg nunca cruza un límite activo: roundUp05 en los suelos, roundDown05 en el techo.

import {
  CLASICAS_ALTURA_MAX,
  CLASICAS_ALTURA_MIN,
  CM_POR_PULGADA,
  ENSANCHE_POR_FIABILIDAD,
  GANANCIA_LEJANA_UMBRAL,
  GRASA_MIN_OBJETIVO_HOMBRE,
  GRASA_MIN_OBJETIVO_MUJER,
  HITO_FACTOR,
  HITO_UMBRAL,
  IMC_OBJETIVO_MAX_GANAR,
  IMC_OBJETIVO_MIN,
  IMC_OBJETIVO_MIN_65,
  OBJETIVO_LEJANO_UMBRAL,
  RECOMP_DEFICIT_MIN,
  RECOMP_META_MARGEN_KG,
} from './constants'
import type { EmitirAviso } from './messages'
import { clamp, round05, roundDown05, roundUp05 } from './round'
import type {
  Fiabilidad,
  MetodoPesoObjetivo,
  ObjetivoEfectivo,
  ResultadoPesoObjetivo,
  Sexo,
} from './types'

export interface EntradaPesoObjetivo {
  sexo: Sexo
  edad: number
  alturaCm: number
  pesoKg: number
  h2: number
  mlg: number
  fiabilidad: Fiabilidad
  objetivo_efectivo: ObjetivoEfectivo
  peso_objetivo: number | null
  g_c: number
  g_lo: number
  g_hi: number
  kcal: number
  tdee: number
}

export function calcularPesoObjetivo(
  e: EntradaPesoObjetivo,
  emitir: EmitirAviso,
): ResultadoPesoObjetivo {
  const hombre = e.sexo === 'hombre'
  const PC = e.pesoKg
  const h2 = e.h2
  const pobj = e.peso_objetivo

  // ---- Cálculos comunes (siempre, para el informe)
  const pesoA = e.mlg / (1 - e.g_c / 100)
  const rangoA: [number, number] = [e.mlg / (1 - e.g_lo / 100), e.mlg / (1 - e.g_hi / 100)]
  const pesoB = 22 * h2
  const rangoB: [number, number] = [20 * h2, 24.9 * h2]
  const imc_min = e.edad >= 65 ? IMC_OBJETIVO_MIN_65 : IMC_OBJETIVO_MIN
  const min185 = imc_min * h2
  const ensanche = (e.mlg * (ENSANCHE_POR_FIABILIDAD[e.fiabilidad] / 100)) / (1 - e.g_c / 100)
  const pulg = e.alturaCm / CM_POR_PULGADA
  // Fórmulas clínicas de los años 60-80: fuera de 150-200 cm devuelven pesos absurdos.
  const clasicas =
    e.alturaCm >= CLASICAS_ALTURA_MIN && e.alturaCm <= CLASICAS_ALTURA_MAX
      ? {
          devine: hombre ? 50 + 2.3 * (pulg - 60) : 45.5 + 2.3 * (pulg - 60),
          robinson: hombre ? 52 + 1.9 * (pulg - 60) : 49 + 1.7 * (pulg - 60),
          miller: hombre ? 56.2 + 1.41 * (pulg - 60) : 53.1 + 1.36 * (pulg - 60),
          hamwi: hombre ? 48 + 2.7 * (pulg - 60) : 45.5 + 2.2 * (pulg - 60),
        }
      : null

  // Rango sugerido: nunca invertido y siempre conteniendo al valor central.
  let lo = Math.max(Math.min(rangoA[0] - ensanche, rangoA[1] + ensanche), min185)
  let hi = Math.max(rangoA[1] + ensanche, lo)
  if (min185 > rangoA[1] + ensanche) {
    lo = min185
    hi = min185
    emitir('INFO_PESO_YA_MINIMO')
  }
  const lo05 = roundUp05(lo)
  const hi05 = Math.max(round05(hi), lo05)
  let sugerido = clamp(round05(clamp(Math.max(pesoA, min185), lo, hi)), lo05, hi05)
  let rango: [number, number] = [lo05, hi05]
  let mostrar_central = e.fiabilidad !== 'baja'
  let efectivo: number | null = null
  let hito_intermedio: number | null = null
  let metodo: MetodoPesoObjetivo = 'actual'
  let piso_peso = min185

  // v1.2 (decisión H): la recomposición CON déficit real —prioridad `perder`, o `equilibrado` con
  // una banda que sí resta— propone y valida la meta exactamente como `perder`: mismos suelos
  // (IMC mínimo y grasa esencial) y mismos avisos. La comprobación `PC − meta ≥ 0,5` va ANTES de
  // ejecutar la rama, no después: si se ejecutara primero y se descartara luego, el informe se
  // llevaría avisos sobre una meta que no se le enseña a nadie. Con prioridad `ganar` nunca se
  // llega aquí (`kcal ≈ TDEE`, así que `TDEE − kcal < 50`).
  const recomp_con_deficit =
    e.objetivo_efectivo === 'recomposicion' && e.tdee - e.kcal >= RECOMP_DEFICIT_MIN
  const meta_cand = recomp_con_deficit ? (pobj === null ? sugerido : pobj) : null
  const rama_perder =
    e.objetivo_efectivo === 'perder' ||
    (meta_cand !== null && PC - meta_cand >= RECOMP_META_MARGEN_KG)

  if (rama_perder) {
    metodo = 'grasa'
    if (pobj === null) {
      efectivo = sugerido
    } else {
      efectivo = pobj
      if (efectivo / h2 < imc_min) {
        // El aviso no afirma dónde queda la meta: el suelo por `g_min` puede subirla otra vez.
        emitir('WARN_OBJETIVO_IMC_BAJO')
        efectivo = min185
      }
      const grasa_implicita = (1 - e.mlg / efectivo) * 100
      const g_min = hombre ? GRASA_MIN_OBJETIVO_HOMBRE : GRASA_MIN_OBJETIVO_MUJER
      if (grasa_implicita < g_min) {
        emitir('WARN_OBJETIVO_GRASA_MUY_BAJA')
        piso_peso = Math.max(e.mlg / (1 - g_min / 100), min185)
        efectivo = piso_peso
        mostrar_central = false // no se fija un número nuevo: se muestra la franja
      }
    }
    efectivo = round05(efectivo)
    if (efectivo < piso_peso) efectivo = roundUp05(piso_peso)
    // Una sola evaluación, contra el peso objetivo ya cerrado y sin distinguir quién fijó la meta.
    if ((PC - efectivo) / PC > OBJETIVO_LEJANO_UMBRAL) emitir('WARN_OBJETIVO_MUY_LEJANO')
    hito_intermedio = (PC - efectivo) / PC > HITO_UMBRAL ? round05(PC * HITO_FACTOR) : null
  } else if (e.objetivo_efectivo === 'ganar') {
    metodo = 'ritmo_16_semanas'
    const ritmo_kg = ((e.kcal - e.tdee) * 7) / 7700
    sugerido = round05(PC + ritmo_kg * 16)
    rango = [round05(PC + ritmo_kg * 12), round05(PC + ritmo_kg * 20)]
    if (sugerido < min185) sugerido = roundUp05(min185)
    if (rango[0] < min185) rango[0] = roundUp05(min185)
    const techo275 = roundDown05(IMC_OBJETIVO_MAX_GANAR * h2)
    if (PC / h2 <= IMC_OBJETIVO_MAX_GANAR) {
      // El techo nunca baja la meta por debajo del peso actual.
      rango[0] = Math.min(rango[0], techo275)
      rango[1] = Math.min(rango[1], techo275)
      sugerido = Math.min(sugerido, techo275)
    }
    rango[1] = Math.max(rango[1], sugerido, rango[0])
    sugerido = clamp(sugerido, rango[0], rango[1])
    mostrar_central = true
    if (pobj === null) {
      efectivo = sugerido
    } else {
      efectivo = pobj
      if (efectivo / h2 < imc_min) {
        emitir('WARN_OBJETIVO_SIGUE_BAJO_PESO')
        efectivo = Math.max(efectivo, min185)
      }
      if (efectivo / h2 > IMC_OBJETIVO_MAX_GANAR) {
        emitir('WARN_OBJETIVO_IMC_ALTO')
        efectivo = IMC_OBJETIVO_MAX_GANAR * h2
      }
      if ((efectivo - PC) / PC > GANANCIA_LEJANA_UMBRAL) emitir('WARN_GANANCIA_LEJANA')
    }
    efectivo = round05(efectivo)
    if (efectivo < piso_peso) efectivo = roundUp05(piso_peso)
    if (efectivo / h2 > IMC_OBJETIVO_MAX_GANAR) {
      // Con el peso actual ya por encima de IMC 27,5 el techo no puede aplicarse.
      efectivo = Math.max(roundDown05(IMC_OBJETIVO_MAX_GANAR * h2), round05(PC), sugerido)
      if (efectivo / h2 > IMC_OBJETIVO_MAX_GANAR) emitir('WARN_OBJETIVO_IMC_ALTO')
    }
  } else {
    metodo = 'actual'
    sugerido = round05(PC)
    // La franja por %grasa se ensancha hasta contener el peso actual.
    rango = [round05(Math.min(lo, PC)), round05(Math.max(hi, PC))]
    mostrar_central = true
    efectivo = null
  }

  return {
    efectivo,
    sugerido,
    mostrar_central,
    rango,
    metodo,
    hito_intermedio,
    referencias: { imc22: pesoB, rango_imc: rangoB, clasicas },
  }
}
