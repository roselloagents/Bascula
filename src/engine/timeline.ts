// Paso 14 — cronograma y paso 14b — proyección semana a semana (SPEC-calculo.md §2, paso 14).
// Ninguna división sin denominador comprobado: los suelos del paso 7 pueden dejar el déficit real
// en cero o negativo, y sin guardas salían semanas negativas y fechas del pasado.
//
// Los dos pasos viven en la MISMA función porque el paso 18 (`ajustarMacros`) tiene que rehacerlos
// literalmente con las kcal ajustadas: dos copias del algoritmo serían un bug silencioso.

import {
  ADAPTACION_PENDIENTE,
  ADAPTACION_SEMANAS_REFERENCIA,
  ADAPTACION_TOPE,
  BANDA_PLANA_KG,
  CRONOGRAMA_DELTA_KCAL_MIN,
  CRONOGRAMA_DELTA_KG_MIN,
  CRONOGRAMA_LARGO_SEMANAS,
  CRONOGRAMA_RITMO_MIN,
  DIET_BREAK_CADA,
  DIET_BREAK_CICLO_SEMANAS,
  DIET_BREAK_UMBRAL_SEMANAS,
  HORIZONTE_MAX_SEMANAS,
  HORIZONTE_MAX_SEMANAS_GANAR,
  KCAL_POR_KG_GRASA,
  PRECISION_MES_UMBRAL_SEMANAS,
  RECOMP_DEFICIT_MIN,
  RECOMP_META_MARGEN_KG,
  SEM_PROYECCION_MAX,
  SEM_PROYECCION_PLANA,
  SEM_PROYECCION_RECOMP_MIN,
} from './constants'
import type { EmitirAviso } from './messages'
import { clamp, round05, round1, sumarDias } from './round'
import type { ObjetivoEfectivo, PuntoProyeccion, ResultadoCronograma } from './types'

export interface EntradaCronograma {
  objetivo_efectivo: ObjetivoEfectivo
  pesoKg: number
  peso_obj_ef: number | null
  kcal: number
  tdee: number
  fecha_inicio: string
}

export interface SalidaPaso14 {
  cronograma: ResultadoCronograma | null
  proyeccion: PuntoProyeccion[]
}

/**
 * Paso 14b — curva con banda, consistente por construcción con `[semanas[0], semanas[1]]`:
 * `rapido` alcanza la meta en `sem_lineal` (extremo optimista) y `lento` en
 * `sem_lineal · factor_adapt` (pesimista), así que la gráfica no puede contradecir al calendario.
 */
function proyeccionCurva(
  PC: number,
  gana: boolean,
  delta_kg: number,
  ritmo_kg_sem: number,
  factor_adapt: number,
  diet_breaks: number,
  sem_tope: number,
): PuntoProyeccion[] {
  const S = Math.min(sem_tope, SEM_PROYECCION_MAX)
  const puntos: PuntoProyeccion[] = []
  for (let s = 0; s <= S; s++) {
    // Una semana a mantenimiento por cada 8 de dieta (MATADOR): 9 semanas de calendario por ciclo.
    const descansos = diet_breaks > 0 ? Math.min(diet_breaks, Math.floor(s / DIET_BREAK_CICLO_SEMANAS)) : 0
    const s_ef = Math.max(0, s - descansos)
    // Misma adaptación creciente del cronograma, acotada por `factor_adapt` para que la curva
    // central nunca se salga de su propia banda.
    const f = 1 + ADAPTACION_PENDIENTE * Math.min(s_ef / ADAPTACION_SEMANAS_REFERENCIA, ADAPTACION_TOPE)
    const rapido = Math.min(ritmo_kg_sem * s_ef, delta_kg)
    const lento = Math.min(ritmo_kg_sem * s_ef / factor_adapt, delta_kg)
    const esp = Math.min(ritmo_kg_sem * s_ef / Math.min(f, factor_adapt), delta_kg)
    puntos.push(
      gana
        ? { semana: s, peso_min: round1(PC + lento), peso_esp: round1(PC + esp), peso_max: round1(PC + rapido) }
        : { semana: s, peso_min: round1(PC - rapido), peso_esp: round1(PC - esp), peso_max: round1(PC - lento) },
    )
  }
  return puntos
}

/**
 * Paso 14b — proyección de RECOMPOSICIÓN CON DÉFICIT REAL (v1.2, decisión H). No hay cronograma
 * —en recomposición no se promete fecha—, pero sí hay déficit, y esconderlo tras una banda plana
 * de ±1 kg era mentir en la dirección contraria: quien pide recomposición con prioridad `perder`
 * lleva un déficit de verdad y veía una raya horizontal.
 *
 *   borde inferior = la curva del déficit (la misma regla lineal de 7 700 kcal/kg que el
 *                    `peso_min` de `perder`), acotada por la meta;
 *   borde superior = el peso actual (todo lo que pierdes de grasa lo compensa el músculo);
 *   esperado       = el punto medio, y el copy no lo disfraza de pronóstico afinado.
 */
function proyeccionRecomp(PC: number, delta_kg: number, ritmo_kg_sem: number): PuntoProyeccion[] {
  const sem_lineal = delta_kg / ritmo_kg_sem
  // Nunca menos de 12 semanas (los hitos de 4, 8 y 12 tienen que existir) ni más de 26.
  const S = clamp(Math.ceil(sem_lineal), SEM_PROYECCION_RECOMP_MIN, SEM_PROYECCION_MAX)
  const puntos: PuntoProyeccion[] = []
  for (let s = 0; s <= S; s++) {
    const rapido = Math.min(ritmo_kg_sem * s, delta_kg)
    const inferior = PC - rapido
    puntos.push({
      semana: s,
      peso_min: round1(inferior),
      peso_esp: round1((inferior + PC) / 2),
      peso_max: round1(PC),
    })
  }
  return puntos
}

/** Paso 14b — sin cronograma lo esperable es que el peso no cambie (±1 kg de agua, sal e intestino). */
function proyeccionPlana(PC: number): PuntoProyeccion[] {
  const puntos: PuntoProyeccion[] = []
  for (let s = 0; s <= SEM_PROYECCION_PLANA; s++) {
    const banda = s === 0 ? 0 : BANDA_PLANA_KG
    puntos.push({ semana: s, peso_min: round1(PC - banda), peso_esp: round1(PC), peso_max: round1(PC + banda) })
  }
  return puntos
}

/** Pasos 14 y 14b. La proyección se calcula SIEMPRE, también cuando no hay cronograma. */
export function calcularPaso14(e: EntradaCronograma, emitir: EmitirAviso): SalidaPaso14 {
  let cronograma: ResultadoCronograma | null = null
  let proyeccion: PuntoProyeccion[] | null = null

  if (e.objetivo_efectivo === 'mantener' || e.objetivo_efectivo === 'recomposicion' || e.peso_obj_ef === null) {
    emitir('INFO_SIN_CRONOGRAMA')
    // v1.2: recomposición con déficit real y con una meta por debajo del peso actual. El cronograma
    // sigue siendo `null` (no se promete fecha); lo único que cambia es la curva.
    if (
      e.objetivo_efectivo === 'recomposicion' &&
      e.peso_obj_ef !== null &&
      e.tdee - e.kcal >= RECOMP_DEFICIT_MIN &&
      e.pesoKg - e.peso_obj_ef >= RECOMP_META_MARGEN_KG
    ) {
      const ritmo_kg_sem = (e.tdee - e.kcal) * 7 / KCAL_POR_KG_GRASA
      if (ritmo_kg_sem >= CRONOGRAMA_RITMO_MIN) {
        proyeccion = proyeccionRecomp(e.pesoKg, e.pesoKg - e.peso_obj_ef, ritmo_kg_sem)
        emitir('INFO_PROYECCION_RECOMP')
      }
    }
  } else {
    const perder = e.objetivo_efectivo === 'perder'
    const delta_kcal = perder ? e.tdee - e.kcal : e.kcal - e.tdee
    const delta_kg = perder ? e.pesoKg - e.peso_obj_ef : e.peso_obj_ef - e.pesoKg

    if (delta_kg < CRONOGRAMA_DELTA_KG_MIN) {
      emitir('INFO_SIN_CRONOGRAMA_SIN_MARGEN')
    } else if (delta_kcal < CRONOGRAMA_DELTA_KCAL_MIN) {
      emitir('INFO_CRONOGRAMA_NO_ESTIMABLE')
    } else {
      const ritmo_kg_sem = delta_kcal * 7 / KCAL_POR_KG_GRASA
      if (ritmo_kg_sem < CRONOGRAMA_RITMO_MIN) {
        emitir('INFO_CRONOGRAMA_NO_ESTIMABLE')
      } else {
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

        const horizonte_max =
          e.objetivo_efectivo === 'ganar' ? HORIZONTE_MAX_SEMANAS_GANAR : HORIZONTE_MAX_SEMANAS
        if (semanas[0] > horizonte_max) {
          emitir('INFO_CRONOGRAMA_FUERA_DE_HORIZONTE')
        } else {
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

          cronograma = {
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
          emitir('INFO_ADAPTACION')
          proyeccion = proyeccionCurva(
            e.pesoKg,
            !perder,
            delta_kg,
            ritmo_kg_sem,
            factor_adapt,
            diet_breaks,
            semanas[1],
          )
        }
      }
    }
  }

  if (proyeccion === null) {
    proyeccion = proyeccionPlana(e.pesoKg)
    emitir('INFO_PROYECCION_PLANA')
  }
  return { cronograma, proyeccion }
}
