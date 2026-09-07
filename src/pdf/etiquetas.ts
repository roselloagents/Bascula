// Traducción de los códigos internos del motor a lenguaje llano.
// Nada de lo que se imprime en el PDF puede ser un identificador técnico.
import type {
  ActividadDiaria,
  BandaGrasa,
  BmrEcuacion,
  Condicion,
  Experiencia,
  Fiabilidad,
  FfmiCategoria,
  ImcCategoria,
  Intensidad,
  MetodoGrasa,
  Momento,
  ObjetivoEfectivo,
  Preferencia,
  Ritmo,
  Sexo,
  Somatotipo,
  TipoEntrenamiento,
} from '../engine/types'

function traduce<K extends string>(mapa: Record<K, string>, clave: K | null | undefined, porDefecto = '—'): string {
  if (clave === null || clave === undefined) return porDefecto
  return mapa[clave] ?? porDefecto
}

const SEXO: Record<Sexo, string> = { hombre: 'Hombre', mujer: 'Mujer' }

const OBJETIVO: Record<ObjetivoEfectivo, string> = {
  perder: 'Perder grasa',
  mantener: 'Mantenerte',
  ganar: 'Ganar músculo',
  recomposicion: 'Recomposición',
}

const RITMO: Record<Ritmo, string> = { suave: 'suave', moderado: 'moderado', agresivo: 'agresivo' }

const ACTIVIDAD: Record<ActividadDiaria, string> = {
  sedentario: 'Sedentaria (trabajo sentado, poco movimiento)',
  ligero: 'Ligera (algo de caminar cada día)',
  moderado: 'Moderada (de pie o caminando a menudo)',
  alto: 'Alta (trabajo físico buena parte del día)',
  muy_alto: 'Muy alta (trabajo físico exigente)',
}

const ENTRENAMIENTO: Record<TipoEntrenamiento, string> = {
  ninguno: 'No entrenas por ahora',
  fuerza: 'Fuerza (pesas, calistenia)',
  cardio: 'Cardio (correr, bici, natación)',
  mixto: 'Mixto (fuerza y cardio)',
}

const INTENSIDAD: Record<Intensidad, string> = { baja: 'suave', media: 'media', alta: 'exigente' }

const EXPERIENCIA: Record<Experiencia, string> = {
  novato: 'empezando',
  intermedio: 'con experiencia',
  avanzado: 'avanzada',
}

const MOMENTO: Record<Momento, string> = {
  manana: 'por la mañana',
  mediodia: 'a mediodía',
  tarde: 'por la tarde',
  noche: 'por la noche',
}

const PREFERENCIA: Record<Preferencia, string> = {
  omnivoro: 'Sin restricciones',
  vegetariano: 'Vegetariana',
  vegano: 'Vegana',
  sin_lactosa: 'Sin lactosa',
  sin_gluten: 'Sin gluten',
  low_carb: 'Baja en hidratos',
}

const CONDICION: Record<Condicion, string> = {
  diabetes: 'diabetes',
  renal: 'problema renal',
  hepatica: 'problema hepático',
  tca: '',
  cardiaca: 'problema de corazón',
  hipertension: 'tensión alta',
  tiroides: 'tiroides',
  bariatrica: 'cirugía bariátrica',
  glp1: 'medicación tipo GLP-1',
  otra: 'otra condición',
}

const IMC: Record<ImcCategoria, string> = {
  bajo_peso: 'bajo peso',
  normal: 'peso normal',
  sobrepeso: 'sobrepeso',
  obesidad_I: 'obesidad grado I',
  obesidad_II: 'obesidad grado II',
  obesidad_III: 'obesidad grado III',
}

const FIABILIDAD: Record<Fiabilidad, string> = {
  alta: 'dato aportado por ti',
  media: 'estimación con medidas',
  baja: 'estimación orientativa',
}

const METODO_GRASA: Record<MetodoGrasa, string> = {
  conocido: 'a partir del dato que nos diste',
  medidas: 'a partir de tus medidas corporales',
  visual: 'a partir de la silueta que elegiste',
  desconocido: 'estimado a partir de tu peso, altura y edad',
}

const BANDA: Record<BandaGrasa, string> = {
  muy_bajo: 'muy bajo',
  bajo: 'bajo',
  medio: 'medio',
  alto: 'alto',
  muy_alto: 'muy alto',
}

const FFMI: Record<FfmiCategoria, string> = {
  bajo: 'bajo',
  medio: 'medio',
  bueno: 'bueno',
  muy_desarrollado: 'muy desarrollado',
  excepcional: 'excepcional',
}

const BMR: Record<BmrEcuacion, string> = {
  mifflin: 'Mifflin-St Jeor (1990)',
  katch_mcardle: 'Katch-McArdle',
}

const SOMATOTIPO: Record<Somatotipo, string> = {
  ectomorfo: 'complexión delgada',
  mesomorfo: 'complexión atlética',
  endomorfo: 'complexión robusta',
}

export const etiqueta = {
  sexo: (v: Sexo | null | undefined) => traduce(SEXO, v),
  objetivo: (v: ObjetivoEfectivo | null | undefined) => traduce(OBJETIVO, v),
  ritmo: (v: Ritmo | null | undefined) => traduce(RITMO, v),
  actividad: (v: ActividadDiaria | null | undefined) => traduce(ACTIVIDAD, v),
  entrenamiento: (v: TipoEntrenamiento | null | undefined) => traduce(ENTRENAMIENTO, v),
  intensidad: (v: Intensidad | null | undefined) => traduce(INTENSIDAD, v),
  experiencia: (v: Experiencia | null | undefined) => traduce(EXPERIENCIA, v),
  momento: (v: Momento | null | undefined) => traduce(MOMENTO, v, ''),
  preferencia: (v: Preferencia | null | undefined) => traduce(PREFERENCIA, v),
  imc: (v: ImcCategoria | null | undefined) => traduce(IMC, v),
  fiabilidad: (v: Fiabilidad | null | undefined) => traduce(FIABILIDAD, v),
  metodoGrasa: (v: MetodoGrasa | null | undefined) => traduce(METODO_GRASA, v),
  banda: (v: BandaGrasa | null | undefined) => traduce(BANDA, v),
  ffmi: (v: FfmiCategoria | null | undefined) => traduce(FFMI, v, 'sin categoría con este nivel de grasa'),
  bmr: (v: BmrEcuacion | null | undefined) => traduce(BMR, v),
  somatotipo: (v: Somatotipo | null | undefined) => traduce(SOMATOTIPO, v),
  /** Lista de condiciones en lenguaje llano. `'tca'` nunca se serializa (CONTRATO). */
  condiciones: (vs: readonly Condicion[] | null | undefined): string[] =>
    (vs ?? []).filter((c) => c !== 'tca').map((c) => traduce(CONDICION, c, '')).filter((t) => t.length > 0),
}

/** Nombre clásico de peso ideal en texto llano. */
export const NOMBRE_FORMULA_CLASICA: Record<string, string> = {
  devine: 'Devine',
  robinson: 'Robinson',
  miller: 'Miller',
  hamwi: 'Hamwi',
}
