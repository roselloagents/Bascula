// Todos los mensajes de SPEC-calculo.md §4, con sus fragmentos condicionales resueltos, más el
// `titulo` corto de cada código para el encabezado de la tarjeta de aviso (CONTRATO.md).
// Aquí viven también las reglas de supresión del paso 6 y el filtro de protección del cribado TCA
// del paso 17.

import { capDeficit } from './calories'
import { EA_MIN, EA_MIN_MUY_ALTO } from './constants'
import { round5 } from './round'
import { mensajesDeErrores, validarInputs } from './validate'
import type { AvisoTexto, Inputs, Resultado, Severidad } from './types'

// ---------------------------------------------------------------- códigos

export type CodigoBloqueo =
  | 'EXCL_EDAD'
  | 'EXCL_EMBARAZO_LACTANCIA'
  | 'EXCL_IMC_MUY_BAJO'
  | 'EXCL_TCA_RIESGO'
  | 'ERR_INPUT_RANGO'

export type CodigoAviso =
  | 'WARN_MEDIDAS_INVALIDAS'
  | 'WARN_GRASA_DISCREPANCIA'
  | 'WARN_GRASA_FUERA_DE_RANGO'
  | 'WARN_OBJETIVO_INCOHERENTE'
  | 'WARN_IMC_BAJO_NO_DEFICIT'
  | 'WARN_YA_MAGRO'
  | 'WARN_RECOMPOSICION_SUGERIDA'
  | 'WARN_GANAR_SIN_FUERZA'
  | 'WARN_RECOMPOSICION_SIN_FUERZA'
  | 'WARN_YA_EN_OBJETIVO'
  | 'WARN_PERDIDA_MAYOR_65'
  | 'WARN_LOWCARB_DIABETES'
  | 'INFO_RITMO_SUAVE'
  | 'WARN_SUELO_CALORICO_SEXO'
  | 'WARN_SUELO_CALORICO_BMR'
  | 'WARN_SUELO_CALORICO_EA'
  | 'WARN_DEFICIT_MINIMO'
  | 'WARN_SIN_MARGEN_DEFICIT'
  | 'WARN_GASTO_BAJO_MINIMO'
  | 'WARN_KCAL_INSUFICIENTES_PARA_MACROS'
  | 'WARN_DEFICIT_INFACTIBLE'
  | 'WARN_OBJETIVO_IMC_BAJO'
  | 'WARN_OBJETIVO_GRASA_MUY_BAJA'
  | 'WARN_OBJETIVO_SIGUE_BAJO_PESO'
  | 'INFO_PESO_YA_MINIMO'
  | 'WARN_OBJETIVO_MUY_LEJANO'
  | 'WARN_OBJETIVO_IMC_ALTO'
  | 'WARN_GANANCIA_LEJANA'
  | 'WARN_CRONOGRAMA_LARGO'
  | 'WARN_PROTEINA_POR_TOMA'
  | 'WARN_PROTEINA_TOMA_ALTA'
  | 'WARN_IMC_BAJO'
  | 'WARN_IMC_35'
  | 'WARN_IMC_40'
  | 'WARN_DIABETES'
  | 'WARN_RENAL'
  | 'WARN_HEPATICA'
  | 'WARN_CARDIACA'
  | 'WARN_HIPERTENSION'
  | 'WARN_TIROIDES'
  | 'WARN_BARIATRICA_GLP1'
  | 'WARN_CONDICION_OTRA'
  | 'WARN_AGUA_ALTA'
  | 'INFO_AGUA_NO_PRESCRITA'
  | 'INFO_BMR_ATLETA'
  | 'INFO_OBJETIVO_RESUELTO'
  | 'INFO_OBJETIVO_RESUELTO_POR_PESO'
  | 'INFO_OBJETIVO_IGUAL'
  | 'INFO_OBJETIVO_IGNORADO'
  | 'INFO_DEFICIT_CAPADO_TDEE'
  | 'INFO_PROTEINA_CAPADA'
  | 'INFO_SOMATOTIPO'
  | 'INFO_ADAPTACION'
  | 'INFO_SIN_CRONOGRAMA'
  | 'INFO_SIN_CRONOGRAMA_SIN_MARGEN'
  | 'INFO_CRONOGRAMA_NO_ESTIMABLE'
  | 'INFO_CRONOGRAMA_FUERA_DE_HORIZONTE'
  | 'INFO_FIBRA_AJUSTADA'
  | 'INFO_MICRONUTRIENTES'
  | 'INFO_AGUA_MAYORES'
  | 'INFO_MAYOR_60'
  | 'INFO_MAYOR_60_RENAL'
  | 'INFO_VEGANO'
  | 'INFO_IMC_MUSCULADO'
  | 'INFO_GRASA_ESTIMADA'
  | 'INFO_ALTO_RENDIMIENTO'

/** Emisor de avisos del motor: idempotente, sin duplicados. */
export type EmitirAviso = (codigo: CodigoAviso) => void

// ---------------------------------------------------------------- utilidades de texto

interface Contexto {
  resultado: Resultado
  inputs: Inputs
}

/** Número en formato español: coma decimal y sin decimales cuando es entero. */
function num(x: number, decimales = 1): string {
  const redondeado = Number(x.toFixed(decimales))
  return Number.isInteger(redondeado) ? String(redondeado) : redondeado.toFixed(decimales).replace('.', ',')
}

/**
 * Nombre del objetivo tal y como lo enuncian INFO_OBJETIVO_RESUELTO* (§4). Se resuelve contra el
 * objetivo que propuso la regla 6.1, no contra el final: los pasos 6.3, 6.4, 7 y 10bis pueden
 * haberlo reescrito después y el aviso habla de lo que se propuso por composición corporal.
 */
function nombreObjetivo(ctx: Contexto): string {
  switch (ctx.resultado.objetivo_propuesto ?? ctx.resultado.objetivo_efectivo) {
    case 'perder':
      return 'perder grasa'
    case 'ganar':
      return 'ganar músculo'
    case 'recomposicion':
      return 'recomposición'
    default:
      return 'mantener tu peso'
  }
}

/**
 * `pct_cap` realmente aplicado en el paso 8: 30 % en dieta vegetal con menos de 1.800 kcal.
 * Lo publica el motor porque los pasos 9 y 10 pueden subir `kcal` después de aplicar el cap:
 * recalcularlo aquí con las kcal finales imprimiría un porcentaje que no se aplicó.
 */
function pctCapAplicado(ctx: Contexto): number {
  return Math.round(ctx.resultado.macros.pct_cap * 100)
}

/** Suelo de disponibilidad energética aplicado en el paso 7 (25 kcal/kg MLG en banda `muy_alto`). */
function sueloEa(ctx: Contexto): number {
  return ctx.resultado.grasa.banda === 'muy_alto' ? EA_MIN_MUY_ALTO : EA_MIN
}

/** El fragmento sobre el calendario se omite cuando no hay cronograma. */
const conCalendario = (ctx: Contexto, fragmento: string): string =>
  ctx.resultado.cronograma === null ? '' : fragmento

interface Plantilla {
  severidad: Severidad
  titulo: string
  texto: string | ((ctx: Contexto) => string)
}

// ---------------------------------------------------------------- textos §4

export const MENSAJES_BLOQUEO: Record<CodigoBloqueo, Plantilla> = {
  EXCL_EDAD: {
    severidad: 'error',
    titulo: 'Fuera del rango de edad',
    texto:
      'Báscula está pensada para personas adultas de 18 a 75 años. Fuera de ese rango las necesidades cambian mucho: consulta con tu médico o con un/a dietista-nutricionista.',
  },
  EXCL_EMBARAZO_LACTANCIA: {
    severidad: 'error',
    titulo: 'Embarazo o lactancia',
    texto:
      'Durante el embarazo y la lactancia las necesidades nutricionales cambian por completo y no deben calcularse con una calculadora genérica. Consulta con tu matrona, tu médico o un/a dietista-nutricionista.',
  },
  EXCL_IMC_MUY_BAJO: {
    severidad: 'error',
    titulo: 'Peso demasiado bajo',
    texto:
      'Con tu peso y tu altura, tu IMC está en un rango de delgadez severa. No vamos a darte calorías ni macros: lo que necesitas ahora es una valoración médica, no una calculadora. Habla con tu médico de cabecera; si te apetece hablarlo con alguien antes, ADANER atiende gratis (adaner.org).',
  },
  EXCL_TCA_RIESGO: {
    severidad: 'error',
    titulo: 'Esta herramienta no te conviene',
    texto:
      'Por lo que nos has contado, esta herramienta no es la adecuada para ti ahora mismo. Una calculadora de calorías y de peso objetivo puede empeorar las cosas cuando la relación con la comida está siendo difícil. Puedes contactar gratis con ADANER (adaner.org) o pedir cita en tu centro de salud.',
  },
  ERR_INPUT_RANGO: {
    severidad: 'error',
    titulo: 'Revisa los datos marcados',
    texto: 'Revisa el dato marcado: está fuera del rango que podemos calcular con seguridad.',
  },
}

export const MENSAJES: Record<CodigoAviso, Plantilla> = {
  WARN_MEDIDAS_INVALIDAS: {
    severidad: 'warn',
    titulo: 'Las medidas no cuadran',
    texto:
      'Las medidas de cuello, cintura y cadera no cuadran entre sí. Hemos estimado tu grasa corporal a partir de tu altura, peso y edad; revisa las medidas si quieres más precisión.',
  },
  WARN_GRASA_DISCREPANCIA: {
    severidad: 'warn',
    titulo: 'Estimaciones de grasa dispares',
    texto:
      'Tu estimación por medidas difiere bastante de la que dan tu altura y peso. Tómala como orientativa y, si puedes, contrástala con una bioimpedancia profesional.',
  },
  WARN_GRASA_FUERA_DE_RANGO: {
    severidad: 'warn',
    titulo: 'Porcentaje de grasa ajustado',
    texto: (ctx) =>
      `El porcentaje de grasa que has introducido está fuera del rango con el que podemos calcular con seguridad, así que hemos usado ${num(ctx.resultado.grasa.pct)} %. Todos los números de tu informe parten de ese dato ajustado, no del que escribiste.`,
  },
  WARN_OBJETIVO_INCOHERENTE: {
    severidad: 'warn',
    titulo: 'Peso objetivo en dirección contraria',
    texto:
      'Tu peso objetivo va en dirección contraria al objetivo que has elegido. Hemos calculado el plan según el peso objetivo; cámbialo si no era lo que querías.',
  },
  WARN_IMC_BAJO_NO_DEFICIT: {
    severidad: 'warn',
    titulo: 'Sin déficit por bajo peso',
    texto:
      'Tu IMC indica bajo peso, así que no te proponemos un déficit calórico. Te mostramos un plan de mantenimiento; si aun así quieres perder peso, habla antes con un profesional sanitario.',
  },
  WARN_YA_MAGRO: {
    severidad: 'warn',
    titulo: 'Ya estás en un rango bajo',
    texto:
      'Tu porcentaje de grasa ya está en un rango bajo y saludable. En vez de una dieta, te proponemos una recomposición: déficit muy ligero, proteína alta y entrenamiento de fuerza. Los cambios serán lentos y sutiles, y eso es lo esperable.',
  },
  WARN_RECOMPOSICION_SUGERIDA: {
    severidad: 'warn',
    titulo: 'Mejor recomposición que volumen',
    texto:
      'Con tu porcentaje de grasa actual y poca experiencia en fuerza, ganarás músculo igual de bien sin comer de más. Te proponemos recomposición: calorías cerca del mantenimiento, proteína alta y entrenamiento de fuerza.',
  },
  WARN_GANAR_SIN_FUERZA: {
    severidad: 'warn',
    titulo: 'Ganar peso sin entrenar fuerza',
    texto:
      'Sin entrenamiento de fuerza, comer de más solo aumenta la grasa. Hemos dejado un superávit mínimo; para ganar músculo necesitas entrenar fuerza al menos 2–3 días por semana.',
  },
  WARN_RECOMPOSICION_SIN_FUERZA: {
    severidad: 'warn',
    titulo: 'Recomposición sin entrenar fuerza',
    texto:
      'Sin entrenamiento de fuerza la recomposición no ocurre: esto es, en la práctica, un mantenimiento con la proteína alta. Empieza por 2–3 días de fuerza a la semana y vuelve a calcular; es la parte del plan que más cambia el resultado.',
  },
  WARN_YA_EN_OBJETIVO: {
    severidad: 'warn',
    titulo: 'Ya estás en tu franja',
    texto:
      'Tu peso ya está prácticamente en la franja que te corresponde por composición corporal, así que no tiene sentido ponerte a dieta. Te proponemos recomposición: calorías cerca del mantenimiento, proteína alta y fuerza.',
  },
  WARN_PERDIDA_MAYOR_65: {
    severidad: 'warn',
    titulo: 'Perder peso a partir de 65',
    // El fragmento «{ y suavizado el ritmo}» se omite cuando no se ha suavizado ningún ritmo.
    texto: (ctx) =>
      `A partir de los 65 años perder peso sin supervisión aumenta el riesgo de perder músculo y hueso. Hemos limitado el déficit máximo${ctx.resultado.ritmo_efectivo === ctx.inputs.ritmo ? '' : ' y suavizado el ritmo'}. Combina siempre el plan con entrenamiento de fuerza y coméntalo con tu médico.`,
  },
  WARN_LOWCARB_DIABETES: {
    severidad: 'warn',
    titulo: 'Baja en hidratos no aplicada',
    texto:
      'No aplicamos la opción baja en hidratos porque tienes diabetes: reducir los hidratos de golpe puede provocarte una hipoglucemia si tomas insulina o pastillas que la bajan, y con algunos fármacos (los iSGLT2, como la empagliflozina o la dapagliflozina) puede causar cetoacidosis. Habla con tu equipo médico antes de bajar los hidratos.',
  },
  INFO_RITMO_SUAVE: {
    severidad: 'info',
    titulo: 'Planteamiento más sostenible',
    texto:
      'Hemos elegido el planteamiento más sostenible en el tiempo: el que mejor se mantiene mes a mes y el que menos masa muscular cuesta.',
  },
  WARN_SUELO_CALORICO_SEXO: {
    severidad: 'warn',
    titulo: 'Calorías subidas al mínimo',
    texto: (ctx) =>
      `El ritmo que pedías exigiría comer por debajo de un mínimo seguro. Hemos subido las calorías al mínimo${conCalendario(ctx, ' y alargado el calendario')}.`,
  },
  WARN_SUELO_CALORICO_BMR: {
    severidad: 'warn',
    titulo: 'Calorías fijadas en tu basal',
    texto: (ctx) =>
      `El ritmo que pedías exigiría comer por debajo de tu metabolismo basal. Hemos fijado las calorías en tu basal${conCalendario(ctx, ' y alargado el calendario en consecuencia')}.`,
  },
  WARN_SUELO_CALORICO_EA: {
    severidad: 'warn',
    titulo: 'Disponibilidad energética protegida',
    texto: (ctx) =>
      `Con ese ritmo tu disponibilidad energética caería por debajo de ${sueloEa(ctx)} kcal por kilo de masa magra, un nivel asociado a alteraciones hormonales. Hemos subido las calorías hasta ese mínimo${conCalendario(ctx, ' y alargado el calendario')}.`,
  },
  WARN_DEFICIT_MINIMO: {
    severidad: 'warn',
    titulo: 'Déficit muy pequeño',
    texto:
      'Tu gasto estimado es tan cercano al mínimo seguro que el déficit resultante es muy pequeño. Aumentar tu actividad diaria (pasos) es la palanca más eficaz en tu caso.',
  },
  WARN_SIN_MARGEN_DEFICIT: {
    severidad: 'warn',
    titulo: 'Sin margen para un déficit',
    texto:
      'Tu gasto estimado ya está en el mínimo con el que podemos trabajar con seguridad, así que no podemos proponerte un déficit: te damos un plan de mantenimiento. La palanca aquí no es comer menos, es moverte más (pasos y fuerza) y volver a calcular en unas semanas.',
  },
  WARN_GASTO_BAJO_MINIMO: {
    severidad: 'warn',
    titulo: 'Gasto por debajo del mínimo',
    texto:
      'Tu gasto estimado queda por debajo del mínimo de referencia (1.500 kcal en hombres, 1.200 en mujeres). Hemos subido las calorías a ese mínimo, pero un plan en esta franja conviene valorarlo con un profesional.',
  },
  WARN_KCAL_INSUFICIENTES_PARA_MACROS: {
    severidad: 'warn',
    titulo: 'Calorías subidas por los macros',
    texto:
      'Con esas calorías no caben a la vez una grasa mínima y el resto de macros. Hemos subido ligeramente las calorías en lugar de forzar la grasa por encima de su techo.',
  },
  WARN_DEFICIT_INFACTIBLE: {
    severidad: 'warn',
    titulo: 'Déficit demasiado agresivo',
    texto:
      'Con esas calorías no caben una proteína y una grasa mínimas más 130 g de hidratos. Hemos subido ligeramente las calorías: el déficit pedido era demasiado agresivo.',
  },
  WARN_OBJETIVO_IMC_BAJO: {
    severidad: 'warn',
    titulo: 'Peso objetivo por debajo del mínimo',
    texto:
      'Ese peso objetivo supondría un IMC por debajo del mínimo saludable para tu altura y tu edad, así que lo hemos subido.',
  },
  WARN_OBJETIVO_GRASA_MUY_BAJA: {
    severidad: 'warn',
    titulo: 'Ese peso implica muy poca grasa',
    texto:
      'Para llegar a ese peso tendrías que bajar a un porcentaje de grasa que nosotros mismos consideramos demasiado bajo (por debajo del 12 % en hombres o del 20 % en mujeres). No vamos a fijarte un peso ahí abajo: te mostramos la franja saludable para tu composición corporal, y recuerda que tu porcentaje de grasa actual es una estimación.',
  },
  WARN_OBJETIVO_SIGUE_BAJO_PESO: {
    severidad: 'warn',
    titulo: 'La meta sigue en bajo peso',
    texto:
      'Ese peso objetivo sigue estando en bajo peso para tu altura. Hemos subido la meta al peso mínimo saludable; si vienes de una pérdida importante, conviene revisarlo con un profesional sanitario.',
  },
  INFO_PESO_YA_MINIMO: {
    severidad: 'info',
    titulo: 'Ya estás en el mínimo por altura',
    // Variante A con mantener/recomposición/ganar; variante B con perder.
    texto: (ctx) =>
      `Tu peso mínimo saludable por altura ya está por encima de la franja que te correspondería por porcentaje de grasa. ${
        ctx.resultado.objetivo_efectivo === 'perder'
          ? 'Por eso hemos fijado tu meta en ese mínimo y no más abajo.'
          : 'En tu caso el objetivo no es un peso: es recomposición (ganar algo de músculo manteniendo el peso).'
      }`,
  },
  WARN_OBJETIVO_MUY_LEJANO: {
    severidad: 'warn',
    titulo: 'Objetivo muy lejano',
    texto:
      'Tu objetivo supone perder más del 25 % de tu peso. Es alcanzable, pero conviene hacerlo por etapas: te marcamos un primer hito del 10 % y te recomendamos acompañamiento profesional.',
  },
  WARN_OBJETIVO_IMC_ALTO: {
    severidad: 'warn',
    titulo: 'Peso objetivo por encima del límite',
    texto:
      'Ese peso objetivo supondría un IMC por encima de 27,5. Si no eres una persona muy musculada, buena parte de esa ganancia será grasa: hemos ajustado la meta a ese límite. Cuando llegues, recalcula.',
  },
  WARN_GANANCIA_LEJANA: {
    severidad: 'warn',
    titulo: 'Ganancia de más de un ciclo',
    texto:
      'Ganar más del 10 % de tu peso lleva bastante más de un ciclo de volumen. Te mostramos solo las primeras 20 semanas: al final de esa fase, recalcula con tu peso real.',
  },
  WARN_CRONOGRAMA_LARGO: {
    severidad: 'warn',
    titulo: 'Calendario largo',
    texto:
      'El calendario estimado es largo: te mostramos solo el primer tramo. Fija hitos intermedios y revisa el plan cada 4–8 semanas con tus datos reales; más allá de dos años una proyección de este tipo no tiene ningún valor predictivo.',
  },
  WARN_PROTEINA_POR_TOMA: {
    severidad: 'warn',
    titulo: 'Poca proteína en una comida',
    texto:
      'Alguna de tus comidas principales se queda por debajo de 20 g de proteína. Puedes juntar dos tomas o aceptar que alguna sea un tentempié ligero; el total diario es lo que más cuenta.',
  },
  WARN_PROTEINA_TOMA_ALTA: {
    severidad: 'warn',
    titulo: 'Mucha proteína en una toma',
    texto:
      'Con este número de comidas concentras mucha proteína en una sola toma. El total diario sigue siendo lo que más cuenta, pero repartirla en 3 tomas se aprovecha algo mejor.',
  },
  WARN_IMC_BAJO: {
    severidad: 'warn',
    titulo: 'Tu IMC indica bajo peso',
    texto:
      'Tu IMC indica bajo peso. Si no es algo buscado, conviene descartar causas médicas con tu médico de cabecera.',
  },
  WARN_IMC_35: {
    severidad: 'warn',
    titulo: 'Mejor con acompañamiento profesional',
    texto:
      'Con tu IMC actual, un abordaje supervisado por médico o dietista-nutricionista te dará mejores resultados y más seguridad. Aquí tienes una orientación general para empezar.',
  },
  WARN_IMC_40: {
    severidad: 'warn',
    titulo: 'Conviene supervisión médica',
    texto:
      'Con un IMC de este nivel, el plan nutricional debería ir acompañado de supervisión médica. Te mostramos una orientación general, pero busca apoyo profesional antes de aplicarla.',
  },
  WARN_DIABETES: {
    severidad: 'warn',
    titulo: 'Diabetes: ajusta con tu equipo',
    texto:
      'Si tienes diabetes, cambiar la cantidad de hidratos puede obligar a ajustar tu medicación. Habla con tu equipo médico antes de aplicar estos macros y mídete la glucemia con más frecuencia las dos primeras semanas.',
  },
  WARN_RENAL: {
    severidad: 'warn',
    titulo: 'Proteína limitada por prudencia',
    texto: (ctx) =>
      `No podemos fijarte la proteína: en enfermedad renal el rango va de 0,55 a 1,2 g por kilo según el estadio y según si estás en diálisis, y eso solo puede decidirlo tu nefrólogo/a. Como tope de prudencia hemos limitado la proteína a 1,0 g por kilo de tu peso corporal (${num(ctx.resultado.macros.proteina_g, 0)} g al día), pero trátalo como pendiente de confirmar con tu especialista, no como tu objetivo.`,
  },
  WARN_HEPATICA: {
    severidad: 'warn',
    titulo: 'Enfermedad hepática',
    texto:
      'Con una enfermedad hepática los requerimientos de proteína pueden ser distintos a los estándar. Consulta con tu especialista antes de aplicar este plan.',
  },
  WARN_CARDIACA: {
    severidad: 'warn',
    titulo: 'Insuficiencia cardiaca',
    texto:
      'Con insuficiencia cardiaca, la cantidad de líquido y de sal que te conviene la fija tu cardiólogo/a, y suele ser bastante menor que la general: por eso no te damos objetivo de agua. Estos macros son una orientación; llévalos a tu revisión antes de aplicarlos y pésate a diario como te hayan indicado.',
  },
  WARN_HIPERTENSION: {
    severidad: 'warn',
    titulo: 'Vigila la sal',
    texto:
      'Con hipertensión o enfermedad cardiovascular, la sal importa tanto como las calorías: la OMS recomienda menos de 5 g de sal al día (unos 2 g de sodio). Vigila embutidos, conservas, quesos curados, pan y precocinados, y coméntalo con tu médico.',
  },
  WARN_TIROIDES: {
    severidad: 'warn',
    titulo: 'Patología tiroidea',
    texto:
      'Con patología tiroidea el gasto energético puede desviarse bastante de lo que estima cualquier fórmula, sobre todo si el tratamiento no está ajustado. Toma estos números como punto de partida y revísalos con tu endocrino.',
  },
  WARN_BARIATRICA_GLP1: {
    severidad: 'warn',
    titulo: 'Cirugía bariátrica o GLP-1',
    texto:
      'Tras una cirugía bariátrica o con un fármaco tipo GLP-1 (semaglutida, tirzepatida) la pérdida es rápida y el riesgo real es perder músculo y quedarte corto/a de proteína. Hemos subido tu proteína a un mínimo de 1,5 g por kilo, pero este es un caso que debe seguir tu equipo médico o un/a dietista-nutricionista.',
  },
  WARN_CONDICION_OTRA: {
    severidad: 'warn',
    titulo: 'Otra condición o medicación',
    texto:
      'Nos has dicho que tienes otra condición o que tomas medicación. No podemos tenerla en cuenta: consulta este plan con tu médico o dietista-nutricionista antes de aplicarlo.',
  },
  WARN_AGUA_ALTA: {
    severidad: 'warn',
    titulo: 'Objetivo de líquido alto',
    texto:
      'Tu objetivo de líquido es alto. Si entrenas más de una hora, sudas mucho o hace calor, el agua sola no basta: añade sal a las comidas o una bebida con electrolitos. Beber mucha agua sin sodio baja el sodio en sangre y eso sí es peligroso.',
  },
  INFO_AGUA_NO_PRESCRITA: {
    severidad: 'info',
    titulo: 'Sin objetivo de agua',
    texto:
      'No te damos un objetivo de agua: con tu condición la cantidad de líquido debe fijarla tu equipo médico, y puede ser bastante menor que la general.',
  },
  INFO_BMR_ATLETA: {
    severidad: 'info',
    titulo: 'La fórmula puede quedarse corta',
    texto:
      'Con tu volumen de entrenamiento, la ecuación estándar puede quedarse corta. Si en 3–4 semanas pierdes peso más rápido de lo previsto, sube 100–150 kcal.',
  },
  INFO_OBJETIVO_RESUELTO: {
    severidad: 'info',
    titulo: 'Objetivo propuesto por nosotros',
    texto: (ctx) =>
      `Nos has dicho que no tienes claro tu objetivo. Según tu composición corporal y tu entrenamiento te proponemos: ${nombreObjetivo(ctx)}. Puedes cambiarlo cuando quieras.`,
  },
  INFO_OBJETIVO_RESUELTO_POR_PESO: {
    severidad: 'info',
    titulo: 'Objetivo según tu peso meta',
    texto: (ctx) =>
      `No tenías claro tu objetivo, así que hemos usado el peso al que quieres llegar para decidirlo: te proponemos ${nombreObjetivo(ctx)}. Puedes cambiarlo cuando quieras.`,
  },
  INFO_OBJETIVO_IGUAL: {
    severidad: 'info',
    titulo: 'Tu meta es tu peso actual',
    texto:
      'Tu peso objetivo es prácticamente tu peso actual, así que te mostramos un plan de mantenimiento.',
  },
  INFO_OBJETIVO_IGNORADO: {
    severidad: 'info',
    titulo: 'Peso objetivo solo como referencia',
    texto:
      'Con el objetivo elegido el peso objetivo no se usa para calcular calorías; lo mostramos solo como referencia.',
  },
  INFO_DEFICIT_CAPADO_TDEE: {
    severidad: 'info',
    titulo: 'Déficit limitado por seguridad',
    texto: (ctx) =>
      `Hemos limitado el déficit al ${Math.round(capDeficit(ctx.resultado.grasa.banda, ctx.inputs.edad) * 100)} % de tu gasto para proteger tu masa muscular; el ritmo real será algo menor del que pedías.`,
  },
  INFO_PROTEINA_CAPADA: {
    severidad: 'info',
    titulo: 'Proteína limitada por utilidad',
    texto: (ctx) =>
      `Hemos limitado la proteína para que no supere 2,5 g/kg ni el ${pctCapAplicado(ctx)} % de tus calorías: por encima no hay beneficio demostrado.`,
  },
  INFO_SOMATOTIPO: {
    severidad: 'info',
    titulo: 'El somatotipo, solo como preferencia',
    texto:
      'El somatotipo es una forma antigua de describir la silueta corporal, pero la ciencia actual no ha demostrado que sirva para calcular calorías o macros de forma precisa. Lo usamos solo como un ajuste ligero de tu preferencia entre carbohidratos y grasas, nunca para decidir cuántas calorías necesitas.',
  },
  INFO_ADAPTACION: {
    severidad: 'info',
    titulo: 'El calendario es una estimación',
    texto:
      'El calendario es una estimación: al cambiar el peso, el gasto también cambia y la regla "7 700 kcal = 1 kg" pierde precisión. A partir del tercer o cuarto mes el ritmo real suele ser aproximadamente la mitad del previsto. Por eso te damos un rango y te recomendamos recalcular cada 2–4 semanas con tu peso real.',
  },
  INFO_SIN_CRONOGRAMA: {
    severidad: 'info',
    titulo: 'Sin calendario con este objetivo',
    texto:
      'Con este objetivo no hay un peso al que llegar en una fecha. Reevalúa medidas, fotos y rendimiento cada 8–12 semanas.',
  },
  INFO_SIN_CRONOGRAMA_SIN_MARGEN: {
    severidad: 'info',
    titulo: 'Ya estás donde queríamos llegar',
    texto:
      'Tu peso ya está donde queríamos llegar, así que no hay calendario. A partir de aquí lo que cambia el cuerpo no es el peso: es el entrenamiento de fuerza y la proteína.',
  },
  INFO_CRONOGRAMA_NO_ESTIMABLE: {
    severidad: 'info',
    titulo: 'No podemos darte una fecha',
    texto:
      'Con tus datos, el mínimo seguro está prácticamente en tu gasto estimado: el ritmo saldría de unos pocos gramos por semana y darte una fecha sería inventar. La palanca en tu caso es subir la actividad diaria, no bajar las calorías.',
  },
  INFO_CRONOGRAMA_FUERA_DE_HORIZONTE: {
    severidad: 'info',
    titulo: 'Objetivo demasiado lejos',
    texto:
      'Tu objetivo queda demasiado lejos para darte un calendario con sentido: una proyección a más de dos años no predice nada. Trabaja por etapas y recalcula al final de cada una.',
  },
  INFO_FIBRA_AJUSTADA: {
    severidad: 'info',
    titulo: 'Fibra algo por debajo',
    texto:
      'Con estas calorías (y estos hidratos) es normal quedarse algo por debajo de los 25 g de fibra de referencia. Prioriza verdura, fruta y legumbre antes que un suplemento de fibra.',
  },
  INFO_MICRONUTRIENTES: {
    severidad: 'info',
    titulo: 'Vigila los micronutrientes',
    texto:
      'Con estas calorías cuesta cubrir hierro, calcio, vitamina D y yodo solo con comida. Prioriza alimentos densos en nutrientes y valora con tu médico un análisis o un suplemento; no es un plan para mantener muchos meses.',
  },
  INFO_AGUA_MAYORES: {
    severidad: 'info',
    titulo: 'Bebe sin esperar a la sed',
    texto:
      'A partir de los 65 años la sensación de sed se reduce: reparte el agua en tomas regulares a lo largo del día en vez de esperar a tener sed.',
  },
  INFO_MAYOR_60: {
    severidad: 'info',
    titulo: 'Más proteína a partir de 60',
    texto: (ctx) => {
      const m = ctx.resultado.macros
      const minimo =
        m.base_proteina === 'peso_ajustado' ? `${num(round5(1.2 * m.base_kg), 0)} g al día` : '1,2 g/kg'
      return `A partir de los 60 años el cuerpo necesita algo más de proteína y entrenamiento de fuerza para frenar la pérdida de músculo. Hemos ajustado tu proteína al alza (mínimo ${minimo}) y te recomendamos 30–40 g por comida.`
    },
  },
  INFO_MAYOR_60_RENAL: {
    severidad: 'info',
    titulo: 'Tu riñón manda sobre la proteína',
    texto:
      'A tu edad convendría algo más de proteína para frenar la pérdida de músculo, pero tu condición renal manda y hemos aplicado el tope de prudencia. Esta es exactamente la decisión que debes tomar con tu nefrólogo/a, no con una calculadora.',
  },
  INFO_VEGANO: {
    severidad: 'info',
    titulo: 'Dieta vegana: proteína y B12',
    texto:
      'Hemos subido tu proteína un 15 % por la menor digestibilidad de las fuentes vegetales. Recuerda suplementar B12 y vigilar hierro y omega-3.',
  },
  INFO_IMC_MUSCULADO: {
    severidad: 'info',
    titulo: 'El IMC no te representa',
    texto:
      'Tu IMC sale en "sobrepeso" pero tu masa muscular es alta: en tu caso el IMC no es un buen indicador y no debes tomarlo como problema.',
  },
  INFO_GRASA_ESTIMADA: {
    severidad: 'info',
    titulo: 'Tu %grasa es una estimación',
    texto:
      'Tu porcentaje de grasa es una estimación con un error típico de ±5 puntos. Una bioimpedancia profesional o una DEXA afinarían el cálculo.',
  },
  INFO_ALTO_RENDIMIENTO: {
    severidad: 'info',
    titulo: 'Mucho volumen de entrenamiento',
    texto:
      'Con más de 10 horas semanales de entrenamiento, un/a dietista-nutricionista deportivo puede afinar mucho más estos números (periodización, timing). Toma esto como punto de partida.',
  },
}

// ---------------------------------------------------------------- supresiones (paso 6) y filtro TCA (paso 17)

const CRONOGRAMA_CORTE: CodigoAviso[] = [
  'INFO_SIN_CRONOGRAMA',
  'INFO_SIN_CRONOGRAMA_SIN_MARGEN',
  'INFO_CRONOGRAMA_NO_ESTIMABLE',
  'INFO_CRONOGRAMA_FUERA_DE_HORIZONTE',
]

/** Avisos que no se emiten con `'tca' ∈ condiciones` (paso 17, lista cerrada). */
export const TCA_OCULTOS: CodigoAviso[] = [
  'INFO_GRASA_ESTIMADA',
  'INFO_PESO_YA_MINIMO',
  'INFO_IMC_MUSCULADO',
  'INFO_ADAPTACION',
  'WARN_YA_MAGRO',
  'WARN_YA_EN_OBJETIVO',
  'WARN_OBJETIVO_MUY_LEJANO',
  'WARN_CRONOGRAMA_LARGO',
  'INFO_SIN_CRONOGRAMA',
  'INFO_SIN_CRONOGRAMA_SIN_MARGEN',
  'INFO_CRONOGRAMA_NO_ESTIMABLE',
  'INFO_CRONOGRAMA_FUERA_DE_HORIZONTE',
]

/** Reglas de supresión de avisos contradictorios (paso 6). La lista es cerrada. */
export const SUPRESIONES: ReadonlyArray<readonly [CodigoAviso, readonly CodigoAviso[]]> = [
  ['INFO_OBJETIVO_IGNORADO', ['WARN_OBJETIVO_INCOHERENTE']],
  ['WARN_IMC_BAJO_NO_DEFICIT', ['WARN_YA_MAGRO']],
  ['WARN_YA_EN_OBJETIVO', ['WARN_YA_MAGRO']],
  ['WARN_RENAL', ['INFO_MAYOR_60', 'INFO_PROTEINA_CAPADA']],
  [
    'WARN_SIN_MARGEN_DEFICIT',
    [
      'WARN_DEFICIT_MINIMO',
      'INFO_DEFICIT_CAPADO_TDEE',
      'WARN_YA_MAGRO',
      'WARN_RECOMPOSICION_SUGERIDA',
      'WARN_RECOMPOSICION_SIN_FUERZA',
    ],
  ],
  ['INFO_OBJETIVO_RESUELTO_POR_PESO', ['INFO_OBJETIVO_IGNORADO']],
  ['INFO_AGUA_NO_PRESCRITA', ['WARN_AGUA_ALTA', 'INFO_AGUA_MAYORES']],
  ...CRONOGRAMA_CORTE.map(
    (c) => [c, ['INFO_ADAPTACION', 'WARN_CRONOGRAMA_LARGO']] as readonly [CodigoAviso, readonly CodigoAviso[]],
  ),
]

/** Aplica las supresiones del paso 6 y el filtro de protección del cribado TCA del paso 17. */
export function filtrarAvisos(avisos: readonly CodigoAviso[], tieneTca: boolean): CodigoAviso[] {
  let salida = [...avisos]
  for (const [disparador, suprimidos] of SUPRESIONES) {
    if (salida.includes(disparador)) salida = salida.filter((c) => !suprimidos.includes(c))
  }
  if (tieneTca) salida = salida.filter((c) => !TCA_OCULTOS.includes(c))
  return salida
}

// ---------------------------------------------------------------- API pública de textos

const ORDEN_SEVERIDAD: Record<Severidad, number> = { error: 0, warn: 1, info: 2 }

function resolver(plantilla: Plantilla, codigo: string, ctx: Contexto): AvisoTexto {
  return {
    codigo,
    severidad: plantilla.severidad,
    titulo: plantilla.titulo,
    texto: typeof plantilla.texto === 'string' ? plantilla.texto : plantilla.texto(ctx),
  }
}

/** Textos de los avisos de un resultado, sin duplicados y con los `warn` antes que los `info`. */
export function textosAvisos(resultado: Resultado, inputs: Inputs): AvisoTexto[] {
  const ctx: Contexto = { resultado, inputs }
  const vistos = new Set<string>()
  const salida: AvisoTexto[] = []
  for (const codigo of resultado.avisos) {
    if (vistos.has(codigo)) continue
    vistos.add(codigo)
    const plantilla = MENSAJES[codigo as CodigoAviso]
    if (!plantilla) continue
    salida.push(resolver(plantilla, codigo, ctx))
  }
  return salida.sort((a, b) => ORDEN_SEVERIDAD[a.severidad] - ORDEN_SEVERIDAD[b.severidad])
}

/** Texto de un código bloqueante: cualquier `EXCL_*` o `ERR_INPUT_RANGO`. */
export function textoError(codigo: string, inputs?: Inputs): AvisoTexto {
  const plantilla = MENSAJES_BLOQUEO[codigo as CodigoBloqueo]
  if (!plantilla) {
    return {
      codigo,
      severidad: 'error',
      titulo: 'No podemos calcular tu plan',
      texto: 'No podemos calcular tu plan con los datos que nos has dado. Revisa el formulario e inténtalo de nuevo.',
    }
  }
  let texto = typeof plantilla.texto === 'string' ? plantilla.texto : ''
  if (codigo === 'ERR_INPUT_RANGO' && inputs) {
    const campos = mensajesDeErrores(validarInputs(inputs))
    if (campos.length) texto = `${texto} Revisa ${listar(campos)}.`
  }
  return { codigo, severidad: plantilla.severidad, titulo: plantilla.titulo, texto }
}

/** Enumeración en español: «a, b y c». */
function listar(partes: readonly string[]): string {
  if (partes.length === 1) return partes[0]
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`
}
