// Textos fijos de la interfaz.
// Los que llevan la marca [SPEC] son normativos y se reproducen palabra por palabra
// (SPEC-ux-comidas-pdf.md §2 y SPEC-calculo.md §4, "Copy fijo del informe").

import type {
  ActividadDiaria,
  Condicion,
  Experiencia,
  ImcCategoria,
  Intensidad,
  Momento,
  ObjetivoEfectivo,
  Preferencia,
  Ritmo,
  Somatotipo,
  TipoEntrenamiento,
} from '../../engine/types'

export const MARCA = 'Báscula'
export const CLAIM = 'Tus macros, bien calculados.'
export const PIE = 'Una herramienta de RS Agents'

// ---- Copy fijo normativo -------------------------------------------------

/** [SPEC] SPEC-calculo §4, nota TDEE. */
export const NOTA_TDEE =
  'A tu gasto estimado le hemos restado un 5 % como margen de seguridad, porque casi todos sobrestimamos lo que nos movemos.'

/** [SPEC] SPEC-calculo §4, nota %grasa. */
export const NOTA_GRASA =
  'Ninguna fórmula sin aparato mide la grasa: te mostramos un rango, no una cifra exacta.'

/** [SPEC] SPEC-calculo §4, nota comidas. */
export const NOTA_COMIDAS =
  'No hay evidencia de que comer más o menos veces al día cambie tu metabolismo. Elige el número de comidas que mejor se adapte a tu rutina.'

/** [SPEC] SPEC-calculo §4, nota agua (íntegra). */
export const NOTA_AGUA =
  'Es líquido bebido: el café, el té y las infusiones cuentan si los tomas de forma habitual; la comida aporta además un 20-30 % de agua que no está incluido aquí. El alcohol no cuenta y deshidrata. No fuerces más de 1 litro por hora. Si entrenas más de una hora, sudas mucho o hace calor, añade sal a las comidas o una bebida con electrolitos: beber mucha agua sin sodio puede bajarte el sodio en sangre.'

/** [SPEC] SPEC-calculo §4, nota peso objetivo. */
export const NOTA_PESO_OBJETIVO =
  'El peso que te proponemos sale de tu masa magra estimada, y esa estimación tiene un margen de varios kilos. Por eso te damos una franja y no un número exacto: la báscula es una señal más, no el objetivo.'

/** [SPEC] SPEC-calculo §4, nota cierre kcal. */
export const NOTA_CIERRE_KCAL =
  'Las calorías de tus macros pueden diferir hasta 10 kcal del objetivo por el redondeo a múltiplos de 5 gramos.'

/** [SPEC] SPEC-calculo §4 / SPEC-ux §2.10. */
export const DISCLAIMER =
  'Báscula te ofrece una orientación nutricional general basada en evidencia científica, no un consejo médico ni un plan personalizado por un profesional sanitario. Los resultados son estimaciones: tu cuerpo puede responder de forma distinta. Si tienes una condición médica, tomas medicación, estás embarazada o en periodo de lactancia, o tienes antecedentes de trastornos de conducta alimentaria, consulta con un/a médico o dietista-nutricionista colegiado/a antes de seguir estas recomendaciones.'

/** [SPEC] SPEC-ux §2.10 y §1.2.5b: pie universal, nunca condicionado. */
export const AYUDA_TCA =
  '¿La comida o el peso te generan ansiedad? Habla gratis con ADANER (adaner.org) o pide cita en tu centro de salud.'

/** [SPEC] SPEC-ux §1.2.5, texto fijo bajo las condiciones médicas. */
export const TEXTO_CONDICIONES_FIJO =
  'Estas condiciones cambian de verdad tus necesidades y ninguna calculadora general puede afinarlas: enséñale este plan a tu médico o a un/a dietista-nutricionista antes de aplicarlo.'

/** [SPEC] SPEC-ux §2.4, horas de referencia. */
export const NOTA_HORAS = 'son horas de referencia: puedes desplazarlas sin que cambie ningún número'

/** [SPEC] SPEC-ux §2.5. */
export const NOTA_MENU =
  'Son ejemplos para orientarte, no un menú obligatorio. Puedes sustituir cualquier alimento por otro de la misma familia sin descuadrar tus macros de forma relevante: mira la tabla de equivalencias justo debajo.'

/** [SPEC] SPEC-ux §2.5, verdura y fruta. */
export const NOTA_VERDURA_FRUTA =
  'Las verduras y las frutas son intercambiables entre sí sin recalcular nada.'

// ---- Frases explicativas de cada macro (SPEC-ux §2.2) --------------------

export const FRASES_MACRO = {
  proteina:
    'Mantiene y construye tu músculo. En tus comidas principales intenta que haya al menos 20 g; un tentempié pequeño puede llevar menos sin problema, porque lo que más cuenta es el total del día.',
  grasa:
    'Esencial para tus hormonas. Nunca debe faltar, aunque tu objetivo sea perder grasa corporal.',
  hc: 'Tu principal fuente de energía, sobre todo para entrenar fuerte. Es la cifra que más varía según cuántas calorías necesites.',
  fibra:
    'Cuida tu digestión y te ayuda a sentirte saciado/a. Repártela entre varias comidas: verdura, fruta y legumbres.',
} as const

// ---- Etiquetas de valores del motor -------------------------------------

export const IMC_CATEGORIA: Record<ImcCategoria, string> = {
  bajo_peso: 'bajo peso',
  normal: 'peso normal',
  sobrepeso: 'sobrepeso',
  obesidad_I: 'obesidad grado I',
  obesidad_II: 'obesidad grado II',
  obesidad_III: 'obesidad grado III',
}

export const OBJETIVO_TITULO: Record<ObjetivoEfectivo, string> = {
  perder: 'Perder grasa',
  mantener: 'Mantenerte',
  ganar: 'Ganar músculo',
  recomposicion: 'Recomposición',
}

export const RITMO_ETIQUETA: Record<Ritmo, string> = {
  suave: 'suave',
  moderado: 'moderado',
  agresivo: 'agresivo',
}

export const ACTIVIDAD_ETIQUETA: Record<ActividadDiaria, string> = {
  sedentario: 'Sedentario',
  ligero: 'Ligero',
  moderado: 'Moderado',
  alto: 'Alto',
  muy_alto: 'Muy alto',
}

export const ENTRENO_ETIQUETA: Record<TipoEntrenamiento, string> = {
  ninguno: 'No entrena',
  fuerza: 'Fuerza',
  cardio: 'Cardio',
  mixto: 'Mixto',
}

export const INTENSIDAD_ETIQUETA: Record<Intensidad, string> = {
  baja: 'Intensidad baja',
  media: 'Intensidad media',
  alta: 'Intensidad alta',
}

export const EXPERIENCIA_ETIQUETA: Record<Experiencia, string> = {
  novato: 'Menos de 1 año entrenando',
  intermedio: 'Entre 1 y 4 años entrenando',
  avanzado: 'Más de 4 años entrenando',
}

export const MOMENTO_ETIQUETA: Record<Momento, string> = {
  manana: 'Por la mañana',
  mediodia: 'A mediodía',
  tarde: 'Por la tarde',
  noche: 'Por la noche',
}

export const PREFERENCIA_ETIQUETA: Record<Preferencia, string> = {
  omnivoro: 'Omnívoro',
  vegetariano: 'Vegetariano',
  vegano: 'Vegano',
  sin_lactosa: 'Sin lactosa',
  sin_gluten: 'Sin gluten',
  low_carb: 'Bajo en hidratos',
}

/** 'tca' no aparece nunca en ninguna lista de condiciones (SPEC-ux §1.2.5b). */
export const CONDICION_ETIQUETA: Record<Exclude<Condicion, 'tca'>, string> = {
  diabetes: 'Diabetes (tipo 1 o 2)',
  renal: 'Enfermedad renal',
  hepatica: 'Enfermedad hepática',
  cardiaca: 'Insuficiencia cardiaca',
  hipertension: 'Hipertensión o enfermedad cardiovascular en tratamiento',
  tiroides: 'Problemas de tiroides',
  bariatrica: 'Cirugía de estómago (bariátrica)',
  glp1: 'Medicación para adelgazar tipo Ozempic, Wegovy o Mounjaro',
  otra: 'Otra condición o toma de medicación',
}

/** Etiqueta de fiabilidad del %grasa según el método efectivo (SPEC-ux §2.1). */
export const FIABILIDAD_GRASA: Record<string, string> = {
  conocido: 'dato aportado por ti',
  medidas: 'estimación con medidas',
  visual: 'estimación orientativa',
  desconocido: 'estimación orientativa',
}

// ---- Avisos que suben el bloque de seguridad por encima de los menús ----
// [SPEC] SPEC-ux §2.8, lista cerrada y literal.
export const AVISOS_PRIORITARIOS = [
  'WARN_DIABETES',
  'WARN_RENAL',
  'WARN_HEPATICA',
  'WARN_CARDIACA',
  'WARN_HIPERTENSION',
  'WARN_TIROIDES',
  'WARN_BARIATRICA_GLP1',
  'WARN_CONDICION_OTRA',
  'WARN_IMC_35',
  'WARN_IMC_40',
]

// ---- Rasgos de los somatotipos (leyenda del cuestionario) ----------------

export const RASGOS_SOMATOTIPO: { tipo: Somatotipo; nombre: string; rasgos: string }[] = [
  {
    tipo: 'ectomorfo',
    nombre: 'Ectomorfo',
    rasgos: 'Estructura fina, hombros estrechos y te cuesta ganar peso, comas lo que comas.',
  },
  {
    tipo: 'mesomorfo',
    nombre: 'Mesomorfo',
    rasgos: 'Estructura media, hombros anchos respecto a la cintura y ganas músculo con facilidad.',
  },
  {
    tipo: 'endomorfo',
    nombre: 'Endomorfo',
    rasgos: 'Estructura ancha y acumulas grasa con facilidad cuando te descuidas.',
  },
]
