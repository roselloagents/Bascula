// Paso 14 — cronograma (SPEC-calculo.md §2, paso 14).
// Ninguna división sin denominador comprobado: los suelos del paso 7 pueden dejar el déficit real
// en cero o negativo, y sin guardas salían semanas negativas y fechas del pasado.

import {
  ADAPTACION_PENDIENTE,
  ADAPTACION_SEMANAS_REFERENCIA,
  ADAPTACION_TOPE,
  CRONOGRAMA_DELTA_KCAL_MIN,
  CRONOGRAMA_DELTA_KG_MIN,
  CRONOGRAMA_LARGO_SEMANAS,
  CRONOGRAMA_RITMO_MIN,
  DIET_BREAK_CADA,
  DIET_BREAK_UMBRAL_SEMANAS,
  HORIZONTE_MAX_SEMANAS,
  HORIZONTE_MAX_SEMANAS_GANAR,
  KCAL_POR_KG_GRASA,
  PRECISION_MES_UMBRAL_SEMANAS,
} from './constants'
import type { EmitirAviso } from './messages'
import { round05, sumarDias } from './round'
import type { ObjetivoEfectivo, ResultadoCronograma } from './types'

export interface EntradaCronograma {
  objetivo_efectivo: ObjetivoEfectivo
  pesoKg: number
  peso_obj_ef: number | null
  kcal: number
  tdee: number
  fecha_inicio: string
}

export function calcularCronograma(e: EntradaCronograma, emitir: EmitirAviso): ResultadoCronograma | null {
  if (e.objetivo_efectivo === 'mantener' || e.objetivo_efectivo === 'recomposicion' || e.peso_obj_ef === null) {
    emitir('INFO_SIN_CRONOGRAMA')
    return null
  }

  const perder = e.objetivo_efectivo === 'perder'
  const delta_kcal = perder ? e.tdee - e.kcal : e.kcal - e.tdee
  const delta_kg = perder ? e.pesoKg - e.peso_obj_ef : e.peso_obj_ef - e.pesoKg

  if (delta_kg < CRONOGRAMA_DELTA_KG_MIN) {
    emitir('INFO_SIN_CRONOGRAMA_SIN_MARGEN')
    return null
  }
  if (delta_kcal < CRONOGRAMA_DELTA_KCAL_MIN) {
    emitir('INFO_CRONOGRAMA_NO_ESTIMABLE')
    return null
  }

  const ritmo_kg_sem = delta_kcal * 7 / KCAL_POR_KG_GRASA
  if (ritmo_kg_sem < CRONOGRAMA_RITMO_MIN) {
    emitir('INFO_CRONOGRAMA_NO_ESTIMABLE')
    return null
  }

  const ritmo_pct_sem = ritmo_kg_sem / e.pesoKg * 100
  const sem_lineal = delta_kg / ritmo_kg_sem
  // ×1,25 a los 6 meses · ×1,75 al año o más (Hall: la regla lineal sobreestima a 12 meses).
  const factor_adapt =
    1 + ADAPTACION_PENDIENTE * Math.min(sem_lineal / ADAPTACION_SEMANAS_REFERENCIA, ADAPTACION_TOPE)
  const sem_min = Math.ceil(sem_lineal)
  const sem_max = Math.ceil(sem_lineal * factor_adapt)
  const diet_breaks =
    perder && sem_lineal > DIET_BREAK_UMBRAL_SEMANAS ? Math.floor(sem_lineal / DIET_BREAK_CADA) : 0
  let semanas: [number, number] = [sem_min + diet_breaks, sem_max + diet_breaks]

  const horizonte_max = e.objetivo_efectivo === 'ganar' ? HORIZONTE_MAX_SEMANAS_GANAR : HORIZONTE_MAX_SEMANAS
  if (semanas[0] > horizonte_max) {
    emitir('INFO_CRONOGRAMA_FUERA_DE_HORIZONTE')
    return null
  }
  if (semanas[1] > horizonte_max) {
    semanas = [semanas[0], horizonte_max]
    emitir('WARN_CRONOGRAMA_LARGO')
  }

  const precision_fecha = semanas[1] > PRECISION_MES_UMBRAL_SEMANAS ? 'mes' : 'dia'
  const tramo_12sem: [number, number] | null =
    semanas[1] > PRECISION_MES_UMBRAL_SEMANAS
      ? [round05(ritmo_kg_sem * 12 / factor_adapt), round05(ritmo_kg_sem * 12)]
      : null
  if (semanas[1] > CRONOGRAMA_LARGO_SEMANAS) emitir('WARN_CRONOGRAMA_LARGO')
  emitir('INFO_ADAPTACION')

  return {
    ritmo_kg_sem,
    ritmo_pct_sem,
    delta_kg,
    semanas,
    diet_breaks,
    fecha_min: sumarDias(e.fecha_inicio, 7 * semanas[0]),
    fecha_max: sumarDias(e.fecha_inicio, 7 * semanas[1]),
    precision_fecha,
    tramo_12sem,
  }
}
