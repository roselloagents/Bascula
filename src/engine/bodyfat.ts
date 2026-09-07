// Paso 2 — estimación del % de grasa corporal (SPEC-calculo.md §2, paso 2).
// Se calculan siempre CUN-BAE y Deurenberg para el informe; el valor con el que se calcula sale de
// la prioridad de métodos, se recorta al dominio fisiológico y determina la banda de grasa.

import {
  BANDA_CORTES_HOMBRE,
  BANDA_CORTES_MUJER,
  GRASA_CLAMP_HOMBRE,
  GRASA_CLAMP_MUJER,
  GRASA_RANGO_MAX,
  GRASA_RANGO_MIN,
  GRASA_REFERENCIA_CLAMP,
  MARGEN_POR_METODO,
  VISUAL_HOMBRE,
  VISUAL_MUJER,
} from './constants'
import type { EmitirAviso } from './messages'
import { clamp } from './round'
import type { BandaGrasa, Fiabilidad, Inputs, MetodoGrasa, ResultadoGrasa } from './types'

export interface SalidaGrasa extends ResultadoGrasa {
  /** ± en puntos de %grasa que se muestra en pantalla (prioridad de método). */
  margen: number
}

/** CUN-BAE (Gómez-Ambrosi 2012). */
export function cunbae(imc: number, edad: number, hombre: boolean): number {
  const s = hombre ? 0 : 1
  return (
    -44.988 +
    0.503 * edad +
    10.689 * s +
    3.172 * imc -
    0.026 * imc * imc +
    0.181 * imc * s -
    0.02 * imc * edad -
    0.005 * imc * imc * s +
    0.00021 * imc * imc * edad
  )
}

/** Deurenberg (1991). */
export function deurenberg(imc: number, edad: number, hombre: boolean): number {
  return 1.20 * imc + 0.23 * edad - 10.8 * (hombre ? 1 : 0) - 5.4
}

/** Banda de grasa (paso 2), usada en los pasos 6, 7, 8 y 17. */
export function bandaGrasa(pct: number, hombre: boolean): BandaGrasa {
  const [c1, c2, c3, c4] = hombre ? BANDA_CORTES_HOMBRE : BANDA_CORTES_MUJER
  if (pct < c1) return 'muy_bajo'
  if (pct < c2) return 'bajo'
  if (pct < c3) return 'medio'
  if (pct < c4) return 'alto'
  return 'muy_alto'
}

export function calcularGrasa(inputs: Inputs, imc: number, emitir: EmitirAviso): SalidaGrasa {
  const hombre = inputs.sexo === 'hombre'
  const CUNBAE = cunbae(imc, inputs.edad, hombre)
  const DEURENBERG = deurenberg(imc, inputs.edad, hombre)

  let pct: number
  let fiabilidad: Fiabilidad
  let metodo_efectivo: MetodoGrasa = inputs.grasa.metodo
  let margen: number
  let navy: number | undefined

  if (inputs.grasa.metodo === 'conocido') {
    pct = inputs.grasa.valor as number
    if (inputs.grasa.fuente === 'fiable') {
      fiabilidad = 'alta'
      margen = MARGEN_POR_METODO.conocido_fiable
    } else {
      fiabilidad = 'media'
      margen = MARGEN_POR_METODO.conocido_estimado
    }
  } else if (inputs.grasa.metodo === 'medidas') {
    // US Navy (Hodgdon & Beckett 1984), medidas en cm y log10.
    let valido = true
    let D = 0
    if (hombre) {
      const x = (inputs.grasa.cintura_cm as number) - (inputs.grasa.cuello_cm as number)
      if (x < 15) valido = false
      else D = 1.0324 - 0.19077 * Math.log10(x) + 0.15456 * Math.log10(inputs.altura_cm)
    } else {
      const x = (inputs.grasa.cintura_cm as number) + (inputs.grasa.cadera_cm as number) - (inputs.grasa.cuello_cm as number)
      if (x < 60) valido = false
      else D = 1.29579 - 0.35004 * Math.log10(x) + 0.22100 * Math.log10(inputs.altura_cm)
    }
    if (valido) {
      navy = 495 / D - 450
      if (!(navy >= 3 && navy <= 60)) valido = false
    }
    if (!valido) {
      emitir('WARN_MEDIDAS_INVALIDAS')
      pct = CUNBAE
      fiabilidad = 'baja'
      metodo_efectivo = 'desconocido'
      margen = MARGEN_POR_METODO.cunbae
      navy = undefined
    } else {
      pct = navy as number
      fiabilidad = 'media'
      margen = MARGEN_POR_METODO.medidas
      if (Math.abs((navy as number) - CUNBAE) > 10) emitir('WARN_GRASA_DISCREPANCIA')
    }
  } else if (inputs.grasa.metodo === 'visual') {
    const tabla: Record<string, number> = hombre ? VISUAL_HOMBRE : VISUAL_MUJER
    pct = tabla[inputs.grasa.categoria as string]
    fiabilidad = 'baja'
    margen = MARGEN_POR_METODO.visual
  } else {
    pct = CUNBAE
    fiabilidad = 'baja'
    margen = MARGEN_POR_METODO.cunbae
  }

  const pctPrevio = pct
  const [clampLo, clampHi] = hombre ? GRASA_CLAMP_HOMBRE : GRASA_CLAMP_MUJER
  pct = clamp(pct, clampLo, clampHi)
  // Nunca se usa un valor distinto del introducido en silencio (§1, nota ‡).
  if (metodo_efectivo === 'conocido' && pct !== pctPrevio) emitir('WARN_GRASA_FUERA_DE_RANGO')

  const [refLo, refHi] = GRASA_REFERENCIA_CLAMP
  const referencias: ResultadoGrasa['referencias'] =
    navy === undefined
      ? { cunbae: clamp(CUNBAE, refLo, refHi), deurenberg: clamp(DEURENBERG, refLo, refHi) }
      : { cunbae: clamp(CUNBAE, refLo, refHi), deurenberg: clamp(DEURENBERG, refLo, refHi), navy }

  return {
    pct,
    rango: [Math.max(GRASA_RANGO_MIN, pct - margen), Math.min(GRASA_RANGO_MAX, pct + margen)],
    fiabilidad,
    metodo_efectivo,
    banda: bandaGrasa(pct, hombre),
    referencias,
    margen,
  }
}
