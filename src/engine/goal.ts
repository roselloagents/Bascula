// Paso 6 — objetivo efectivo, ritmo efectivo y preferencia efectiva (SPEC-calculo.md §2, paso 6).
// Las sub-reglas 6.1 a 6.8 se ejecutan en este orden exacto.

import {
  DIET_BREAK_CADA,
  DIET_BREAK_UMBRAL_SEMANAS,
  GRASA_MIN_OBJETIVO_HOMBRE,
  GRASA_MIN_OBJETIVO_MUJER,
  GRASA_OBJETIVO_HOMBRE,
  GRASA_OBJETIVO_HOMBRE_65,
  GRASA_OBJETIVO_MUJER,
  GRASA_OBJETIVO_MUJER_65,
  IMC_OBJETIVO_MAX_GANAR,
  IMC_OBJETIVO_MIN,
  IMC_OBJETIVO_MIN_65,
  KCAL_POR_KG_GRASA,
  PLAZO_EPSILON,
  RITMOS_POR_SUAVIDAD,
  RITMO_PERDIDA,
  SUPERAVIT,
  SUPERAVIT_MAX,
  SUPERAVIT_MIN,
  SUPERAVIT_SIN_FUERZA,
} from './constants'
import type { EmitirAviso } from './messages'
import { bancoDe } from './preferences'
import { clamp } from './round'
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
  /** TDEE del paso 5: lo necesita el paso 6.7ter para traducir el superávit de `ganar` a kg/semana. */
  tdee: number
}

export interface SalidaObjetivo {
  objetivo_efectivo: ObjetivoEfectivo
  /** Objetivo resuelto por la regla 6.1 (solo con `objetivo === 'no_se'`). */
  objetivo_propuesto?: ObjetivoEfectivo
  ritmo_efectivo: Ritmo
  /**
   * Ritmo que eligió el plazo en el paso 6.7ter, o `null` si el plazo no se leyó (sin
   * `plazo_semanas`, sin `peso_objetivo` o con un objetivo intermedio que no es `perder`/`ganar`).
   * El paso 17 lo compara con `ritmo_efectivo`: si un suavizado de seguridad lo ha bajado, la
   * fecha ya no se alcanza e `INFO_RITMO_POR_PLAZO` pasa a ser `WARN_PLAZO_IRREAL`.
   */
  ritmo_plazo: Ritmo | null
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
  const t =
    edad >= 65
      ? hombre
        ? GRASA_OBJETIVO_HOMBRE_65
        : GRASA_OBJETIVO_MUJER_65
      : hombre
        ? GRASA_OBJETIVO_HOMBRE
        : GRASA_OBJETIVO_MUJER
  return [t[0], t[1], t[2]]
}

/**
 * Meta que el paso 13 va a publicar para una meta escrita por el usuario, con los mismos suelos y
 * techos de seguridad (§2, paso 13): en `perder`, el IMC mínimo por edad y la grasa esencial; en
 * `ganar`, ese mismo suelo y el techo de IMC 27,5. Se calcula aquí, en el paso 6.7ter, porque el
 * plazo tiene que medirse contra la meta REAL del plan y no contra una que el informe descarta.
 */
function metaSegura(
  pobj: number,
  obj: ObjetivoEfectivo | 'no_se',
  hombre: boolean,
  edad: number,
  mlg: number,
  h2: number,
): number {
  const min_imc = (edad >= 65 ? IMC_OBJETIVO_MIN_65 : IMC_OBJETIVO_MIN) * h2
  if (obj === 'ganar') return Math.min(Math.max(pobj, min_imc), IMC_OBJETIVO_MAX_GANAR * h2)
  const g_min = hombre ? GRASA_MIN_OBJETIVO_HOMBRE : GRASA_MIN_OBJETIVO_MUJER
  return Math.max(pobj, min_imc, mlg / (1 - g_min / 100))
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
    if (
      imc >= IMC_OBJETIVO_MIN &&
      (exp === 'novato' || perfil !== 'fuerza') &&
      (banda === 'alto' || banda === 'muy_alto')
    ) {
      obj = 'recomposicion'
      emitir('WARN_RECOMPOSICION_SUGERIDA')
    } else if (perfil !== 'fuerza') {
      emitir('WARN_GANAR_SIN_FUERZA')
    }
  }
  // 6.5
  if (obj === 'recomposicion' && perfil !== 'fuerza') emitir('WARN_RECOMPOSICION_SIN_FUERZA')
  // 6.6
  if (
    (obj === 'mantener' || obj === 'recomposicion') &&
    pobj !== null &&
    Math.abs(pobj - PC) >= 1
  ) {
    emitir('INFO_OBJETIVO_IGNORADO')
  }

  // 6.7 — ritmo efectivo
  let ritmo_efectivo: Ritmo = inputs.ritmo

  // 6.7ter — PLAZO (v1.2, decisión H). Se evalúa AQUÍ, lo primero del paso 7 y ANTES de cualquier
  // suavizado de seguridad: fija el ritmo de PARTIDA a partir de la fecha que ha pedido el usuario,
  // y los suavizados de 6.7 (tca, edad ≥ 65) y 6.7bis (regla) se aplican después sobre él y MANDAN.
  // El `ritmo` que eligió el usuario se descarta: ha pedido una fecha, y la fecha es más concreta.
  const plazo =
    typeof inputs.plazo_semanas === 'number' && Number.isFinite(inputs.plazo_semanas)
      ? inputs.plazo_semanas
      : null
  let ritmo_plazo: Ritmo | null = null
  // La meta contra la que se mide el plazo es la que el paso 13 va a PUBLICAR, no la que el
  // usuario escribió: los suelos de seguridad (IMC mínimo y grasa esencial) pueden subirla, y
  // dividir por el plazo una meta que el propio informe rechaza aplicaba un ritmo más duro que el
  // que exige el plan real. Con la meta ya en el suelo, `meta_plazo` coincide con
  // `peso_objetivo.efectivo`, que es el número que se imprime.
  const meta_plazo =
    pobj === null
      ? null
      : metaSegura(pobj, obj, hombre, inputs.edad, mlg, (inputs.altura_cm / 100) ** 2)
  // Con la meta ya corregida el camino puede desaparecer (el suelo queda por encima del peso
  // actual, o el techo de `ganar` por debajo): entonces no hay fecha que juzgar y el plazo no
  // emite nada, ni ritmo ni aviso.
  const delta_plazo = meta_plazo === null ? 0 : obj === 'perder' ? PC - meta_plazo : meta_plazo - PC
  if (
    plazo !== null &&
    meta_plazo !== null &&
    delta_plazo > 0 &&
    (obj === 'perder' || obj === 'ganar')
  ) {
    // kg/semana que da cada ritmo de la tabla, con la misma aritmética del paso 7.
    const kgSem = (r: Ritmo): number | null => {
      if (obj === 'perder') {
        const fila = RITMO_PERDIDA[banda as 'muy_alto' | 'alto' | 'medio'] as
          Record<Ritmo, number> | undefined
        return fila ? (fila[r] / 100) * PC : null
      }
      const sup_pct = perfil !== 'fuerza' ? SUPERAVIT_SIN_FUERZA : SUPERAVIT[exp][r]
      return (clamp(sup_pct * e.tdee, SUPERAVIT_MIN, SUPERAVIT_MAX) * 7) / KCAL_POR_KG_GRASA
    }
    // Semanas que ese ritmo produciría DE VERDAD, con la misma aritmética del paso 14: la parte
    // lineal más las semanas de mantenimiento (diet breaks). Comparar contra la tasa pelada de la
    // tabla hacía que el paso 17 juzgara con un modelo distinto del que había elegido el ritmo:
    // el motor avisaba de que la fecha era imposible cuando un ritmo de su propia tabla llegaba,
    // y pedir MÁS tiempo podía dar una respuesta peor que pedir menos.
    const semanasDe = (v: number): number => {
      const sem_lineal = delta_plazo / v
      const descansos =
        obj === 'perder' && sem_lineal > DIET_BREAK_UMBRAL_SEMANAS
          ? Math.floor(sem_lineal / DIET_BREAK_CADA)
          : 0
      return Math.ceil(sem_lineal - PLAZO_EPSILON) + descansos
    }
    for (const r of RITMOS_POR_SUAVIDAD) {
      const v = kgSem(r)
      if (v !== null && v > 0 && semanasDe(v) <= plazo) {
        ritmo_plazo = r
        break
      }
    }
    if (ritmo_plazo === null) {
      // Ni el agresivo llega: se aplica igualmente y el aviso lo dice sin adornos.
      ritmo_plazo = 'agresivo'
      emitir('WARN_PLAZO_IRREAL')
    } else {
      emitir('INFO_RITMO_POR_PLAZO')
    }
    ritmo_efectivo = ritmo_plazo
  }

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
  // Solo en planes que restan calorías: el motivo del suavizado es la baja disponibilidad
  // energética (RED-S) y ahí el remedio es comer MÁS, así que recortar un superávit iría en contra.
  if (
    (e.menstruacion === 'irregular' || e.menstruacion === 'ausente') &&
    (obj === 'perder' || obj === 'recomposicion')
  ) {
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
    ritmo_plazo,
    preferencia_efectiva,
    preferencia_base: e.pref_base,
    restricciones,
    low_carb,
    g_c,
    g_lo,
    g_hi,
  }
}
