// Paso 16 — reparto por comidas (SPEC-calculo.md §2, paso 16).
// Un único array `comidas` en la v1: no hay día de entreno y día de descanso.
// Proteína y grasa siguen los % de la tabla 3.13; los HC usan el vector con los +5/−5 del peri-entreno.

import {
  HORAS_COMIDA,
  PERI_INDICE,
  PERI_PUNTOS_HC,
  PROTEINA_TOMA_ALTA_GKG,
  PROTEINA_TOMA_MIN_G,
  PROTEINA_TOMA_PCT_MIN,
  REPARTO,
} from './constants'
import type { EmitirAviso } from './messages'
import { round5 } from './round'
import type { Comida, Momento, NComidas, Perfil } from './types'

export interface EntradaComidas {
  n_comidas: NComidas
  perfil: Perfil
  momento: Momento | null
  pesoKg: number
  proteina_g: number
  grasa_g: number
  hc_g: number
}

/** Índice del mayor valor de `vec`, ignorando `omitir`; en empate, el índice más bajo. */
function indiceMayor(vec: readonly number[], omitir: number): number {
  let mejor = -1
  let valor = -Infinity
  for (let i = 0; i < vec.length; i++) {
    if (i === omitir) continue
    if (vec[i] > valor) {
      valor = vec[i]
      mejor = i
    }
  }
  return mejor
}

export function calcularComidas(e: EntradaComidas, emitir: EmitirAviso): Comida[] {
  const plantilla = REPARTO[e.n_comidas]
  const p = [...plantilla.pct]
  const hcv = [...p]

  const i_peri =
    e.perfil !== 'sedentario' && e.momento !== null && e.momento !== undefined
      ? PERI_INDICE[e.n_comidas][e.momento]
      : null
  if (i_peri !== null) {
    hcv[i_peri] += PERI_PUNTOS_HC
    hcv[indiceMayor(p, i_peri)] -= PERI_PUNTOS_HC
  }
  const principal = indiceMayor(p, -1)

  const repartir = (total: number, vector: readonly number[]): number[] => {
    const partes = vector.map((v) => round5(total * v / 100))
    partes[principal] += total - partes.reduce((a, b) => a + b, 0)
    return partes
  }

  const P_i = repartir(e.proteina_g, p)
  const G_i = repartir(e.grasa_g, p)
  const HC_i = repartir(e.hc_g, hcv)

  const comidas: Comida[] = plantilla.nombres.map((nombre, i) => ({
    nombre,
    hora: HORAS_COMIDA[nombre],
    pct_kcal: p[i],
    proteina_g: P_i[i],
    grasa_g: G_i[i],
    hc_g: HC_i[i],
    kcal: 4 * P_i[i] + 9 * G_i[i] + 4 * HC_i[i],
    peri: i === i_peri,
  }))

  // Guardarraíl de proteína por toma, por los dos lados.
  if (p.some((v, i) => v >= PROTEINA_TOMA_PCT_MIN && P_i[i] < PROTEINA_TOMA_MIN_G)) emitir('WARN_PROTEINA_POR_TOMA')
  if (P_i.some((v) => v > PROTEINA_TOMA_ALTA_GKG * e.pesoKg)) emitir('WARN_PROTEINA_TOMA_ALTA')

  return comidas
}
