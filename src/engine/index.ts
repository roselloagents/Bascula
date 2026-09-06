// STUB TEMPORAL — será sustituido por la implementación real del motor (docs/SPEC-calculo.md).
// Mantener EXACTAMENTE estas firmas exportadas: la UI, el generador de comidas y el PDF dependen de ellas.
import type { AvisoTexto, ErrorCalculo, Inputs, Resultado, Salida } from './types'

export type * from './types'

/** Calcula el plan completo a partir de las respuestas del cuestionario (SPEC §2). */
export function calcular(inputs: Inputs): Salida {
  if (inputs.embarazo_lactancia) return { ok: false, error: 'ERR_EXCLUDED_PREGNANCY' }
  return RESULTADO_EJEMPLO
}

/** Devuelve los textos (SPEC §4) de los avisos de un resultado, con placeholders sustituidos, ordenados por severidad. */
export function textosAvisos(resultado: Resultado, _inputs: Inputs): AvisoTexto[] {
  return resultado.avisos.map((codigo) => ({
    codigo,
    severidad: codigo.startsWith('WARN') ? 'warn' : 'info',
    titulo: codigo,
    texto: `Texto pendiente para ${codigo}.`,
  }))
}

/** Texto (SPEC §4) de un error bloqueante. */
export function textoError(error: ErrorCalculo, _inputs?: Inputs): AvisoTexto {
  return { codigo: error.error, severidad: 'error', titulo: error.error, texto: `Texto pendiente para ${error.error}.` }
}

// Muestra plausible (no exacta) para desarrollar la UI mientras el motor real no existe.
const RESULTADO_EJEMPLO: Resultado = {
  ok: true,
  imc: 30.9,
  imc_categoria: 'obesidad_I',
  grasa_pct: 30.1,
  grasa_fiabilidad: 'baja',
  grasa_pct_cunbae: 30.1,
  grasa_pct_deurenberg: 31.6,
  mlg_kg: 68.5,
  mg_kg: 29.5,
  bmr: 1897.5,
  bmr_ecuacion: 'mifflin',
  bmr_referencia: 1849.6,
  pal_base: 1.3,
  met: 0,
  eat_sesion: 0,
  eat_diario: 0,
  gasto_actividad: 569.3,
  tdee: 2410,
  tdee_rango: [2169, 2651],
  objetivo_efectivo: 'perder_grasa',
  ritmo: 'moderado',
  grasa_objetivo_pct: 20,
  peso_sugerido: { central: 82.4, rango: [76.5, 88.0], peso_min_seguro: 63.9, m1: 80.9, m2: 69.7, f: 0.1 },
  peso_objetivo_usado: 80,
  kcal_objetivo: 1928,
  deficit: 482,
  superavit: 0,
  suelo: 1898,
  peso_ref_proteina: 91.3,
  proteina_factor: 1.8,
  proteina_g: 164,
  proteina_tope: 193,
  somatotipo_resultado: 'endomorfo',
  grasa_pct_kcal: 0.35,
  grasa_g: 75,
  carbohidratos_g: 149,
  fibra_g: 27,
  kcal_reales: 1927,
  agua_descanso_ml: 2900,
  agua_entreno_ml: 2900,
  agua_rango_ml: [2600, 3200],
  vasos_250: 12,
  comidas_peri: [],
  reparto_entreno: [
    { comida: 'desayuno', hora: '08:00', pct: 30, prot: 49, carb: 45, fat: 22, kcal: 574, peri: false },
    { comida: 'comida', hora: '14:00', pct: 40, prot: 66, carb: 60, fat: 30, kcal: 774, peri: false },
    { comida: 'cena', hora: '21:00', pct: 30, prot: 49, carb: 44, fat: 23, kcal: 579, peri: false },
  ],
  reparto_descanso: [
    { comida: 'desayuno', hora: '08:00', pct: 30, prot: 49, carb: 45, fat: 22, kcal: 574, peri: false },
    { comida: 'comida', hora: '14:00', pct: 40, prot: 66, carb: 60, fat: 30, kcal: 774, peri: false },
    { comida: 'cena', hora: '21:00', pct: 30, prot: 49, carb: 44, fat: 23, kcal: 579, peri: false },
  ],
  cronograma: {
    aplica: true,
    kg_semana: 0.44,
    pct_semana: 0.45,
    semanas_teoricas: 40.9,
    semanas_estimadas: 48,
    fecha: '2027-08-07',
    hitos: [[4, 96.5], [8, 95.0], [12, 93.5], [48, 80]],
  },
  ffmi: 21.6,
  ffmi_normalizado: 21.5,
  ffmi_categoria: 'bueno',
  avisos: ['INFO_BMI_OBESITY', 'WARN_BF_ESTIMATE', 'INFO_ACTIVITY_MARGIN', 'INFO_GOAL_CONSERVATIVE', 'INFO_SOMATOTYPE', 'INFO_ADAPTATION'],
}
