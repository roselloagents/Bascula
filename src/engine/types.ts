// =====================================================================
// CONTRATO COMPARTIDO — Báscula
// Tipos de entrada/salida del motor de cálculo (docs/SPEC-calculo.md §1.1 y Anexo A),
// del generador de ejemplos de comidas y del exportador PDF.
// Cualquier cambio aquí afecta a motor, UI, comidas y PDF: mantener sincronizado con la spec.
// =====================================================================

// ---------- Inputs (SPEC §1.1) ----------
export type Sexo = 'hombre' | 'mujer'

export type FuenteGrasa = 'dexa' | 'bia_profesional' | 'plicometria_profesional' | 'bascula_bia_casera' | 'otro'
export type CategoriaVisual = 'esencial' | 'atleta' | 'fitness' | 'aceptable' | 'obesidad'

export type Grasa =
  | { metodo: 'conocido'; valor: number; fuente: FuenteGrasa } // valor en % (3–60)
  | { metodo: 'medidas'; cuello_cm: number; cintura_cm: number; cadera_cm?: number } // cadera obligatoria si mujer
  | { metodo: 'visual'; categoria: CategoriaVisual }
  | { metodo: 'desconocido' }

export interface SomatotipoRespuestas {
  q1: 'fina' | 'media' | 'ancha' // complexión ósea
  q2: 'poca' | 'moderada' | 'mucha' // facilidad para ganar grasa
  q3: 'poca' | 'moderada' | 'mucha' // facilidad para ganar músculo
  q4: 'delgado' | 'atletico' | 'robusto' // apariencia habitual antes de entrenar
}

export type ActividadDiaria = 'sedentario' | 'ligero' | 'moderado' | 'alto' | 'muy_alto'
export type TipoEntrenamiento = 'ninguno' | 'fuerza' | 'cardio' | 'mixto'
export type Intensidad = 'baja' | 'moderada' | 'alta'

export interface Entrenamiento {
  tipo: TipoEntrenamiento
  dias_semana: number // 0–7 entero
  minutos_sesion: number // 0–180 entero
  intensidad: Intensidad
}

export type Objetivo = 'perder_grasa' | 'mantener' | 'ganar_musculo' | 'recomposicion' | 'no_lo_se'
export type ObjetivoEfectivo = Exclude<Objetivo, 'no_lo_se'>
export type Ritmo = 'suave' | 'moderado' | 'agresivo'
export type Preferencia = 'omnivoro' | 'vegetariano' | 'vegano' | 'sin_lactosa' | 'sin_gluten' | 'low_carb'
export type MomentoEntreno = 'manana' | 'mediodia' | 'tarde' | 'noche'
export type Condicion = 'ninguna' | 'diabetes' | 'cardiovascular' | 'tiroides' | 'hepatica' | 'renal' | 'tca' | 'otra'
export type NComidas = 2 | 3 | 4 | 5 | 6

export interface Inputs {
  sexo: Sexo
  edad: number // 18–75 entero
  altura_cm: number // 140–220
  peso_kg: number // 35–250
  grasa: Grasa
  somatotipo: SomatotipoRespuestas | null // null = prefiero no responder
  actividad_diaria: ActividadDiaria
  entrenamiento: Entrenamiento
  objetivo: Objetivo
  ritmo: Ritmo
  peso_objetivo: number | null // null = no lo sé
  preferencia: Preferencia
  n_comidas: NComidas
  momento_entreno: MomentoEntreno | null
  clima_caluroso: boolean
  embarazo_lactancia: boolean
  condiciones: Condicion[]
  fecha_inicio?: string // ISO YYYY-MM-DD; default hoy
}

// ---------- Salida del motor (SPEC Anexo A) ----------
export type ImcCategoria = 'bajo_peso' | 'normopeso' | 'sobrepeso' | 'obesidad_I' | 'obesidad_II' | 'obesidad_III'
export type Fiabilidad = 'alta' | 'media' | 'baja'
export type BmrEcuacion = 'mifflin' | 'katch_mcardle'
export type SomatotipoResultado = 'ectomorfo' | 'mesomorfo' | 'endomorfo' | 'no_evaluado'
export type FfmiCategoria = 'bajo' | 'medio' | 'bueno' | 'muy_alto' | 'excepcional'

export interface Comida {
  comida: string // nombre de la toma (desayuno, media_manana, comida, merienda, cena, recena...)
  hora: string // hora nominal HH:MM de la plantilla (SPEC §3.10)
  pct: number // % de kcal de la plantilla
  prot: number
  carb: number
  fat: number
  kcal: number
  peri: boolean // comida peri-entreno (solo en reparto_entreno)
}

export interface PesoSugerido {
  central: number
  rango: [number, number]
  peso_min_seguro: number
  m1?: number
  m1_rango?: [number, number]
  m2?: number
  m2_rango?: [number, number]
  f?: number
  delta?: number
}

export type Cronograma =
  | {
      aplica: true
      kg_semana: number
      pct_semana: number
      semanas_teoricas: number
      semanas_estimadas: number
      fecha: string // ISO YYYY-MM-DD
      hitos: [number, number][] // [semana, peso]
    }
  | { aplica: false; semanas_revision: 8 }

export interface Resultado {
  ok: true
  imc: number
  imc_categoria: ImcCategoria
  grasa_pct: number
  grasa_fiabilidad: Fiabilidad
  grasa_pct_cunbae: number
  grasa_pct_deurenberg: number
  mlg_kg: number
  mg_kg: number
  bmr: number
  bmr_ecuacion: BmrEcuacion
  bmr_referencia: number
  pal_base: number
  met: number
  eat_sesion: number
  eat_diario: number
  gasto_actividad: number
  tdee: number
  tdee_rango: [number, number]
  objetivo_efectivo: ObjetivoEfectivo
  ritmo: Ritmo
  grasa_objetivo_pct: number
  peso_sugerido: PesoSugerido
  peso_objetivo_usado: number
  kcal_objetivo: number
  deficit: number
  superavit: number
  suelo: number
  peso_ref_proteina: number
  proteina_factor: number
  proteina_g: number
  proteina_tope: number
  somatotipo_resultado: SomatotipoResultado
  grasa_pct_kcal: number | null
  grasa_g: number
  carbohidratos_g: number
  fibra_g: number
  kcal_reales: number
  agua_descanso_ml: number
  agua_entreno_ml: number
  agua_rango_ml: [number, number]
  vasos_250: number
  comidas_peri: string[]
  reparto_entreno: Comida[]
  reparto_descanso: Comida[]
  cronograma: Cronograma
  ffmi: number
  ffmi_normalizado: number
  ffmi_categoria: FfmiCategoria
  avisos: string[] // códigos SPEC §4, sin duplicados
}

export interface ErrorCalculo {
  ok: false
  error: string // código ERR_* (SPEC §2.0 / §1.3)
  errores?: string[] // detalle de ERR_INPUT_RANGE
}

export type Salida = Resultado | ErrorCalculo

// ---------- Textos de avisos (SPEC §4) ----------
export type Severidad = 'error' | 'warn' | 'info'
export interface AvisoTexto {
  codigo: string
  severidad: Severidad
  titulo: string // etiqueta corta para la UI (p. ej. "Peso objetivo poco seguro")
  texto: string // texto completo con los placeholders ya sustituidos
}

// ---------- Ejemplos de comidas (docs/SPEC-ux-comidas-pdf.md) ----------
export interface Macros {
  kcal: number
  prot: number
  carb: number
  fat: number
}

export interface AlimentoPorcion {
  id: string // id de src/data/foods.json
  nombre: string
  gramos: number // gramos en crudo / peso neto
  medida: string // medida casera ("1 pechuga mediana", "3 cucharadas")
  kcal: number
  prot: number
  carb: number
  fat: number
}

export interface EjemploComida {
  comida: string // mismo nombre que Comida.comida
  hora: string
  peri: boolean
  objetivo: Macros // lo que pide el reparto del motor para esta toma
  alimentos: AlimentoPorcion[]
  totales: Macros // suma real de los alimentos
  alternativas: string[] // 2-3 sustituciones en texto ("Cambia el pollo por 150 g de merluza")
}

export interface EjemploDia {
  tipo: 'entreno' | 'descanso'
  comidas: EjemploComida[]
  totales: Macros
  notas: string[]
}

export interface Ejemplos {
  entreno: EjemploDia
  descanso: EjemploDia // si no entrena, igual que entreno
  consejos: string[] // 3-5 consejos prácticos de adherencia según preferencia/objetivo
}

// ---------- Datos para el PDF ----------
export interface DatosPdf {
  inputs: Inputs
  resultado: Resultado
  ejemplos: Ejemplos
  avisos: AvisoTexto[]
  fecha: string // ISO YYYY-MM-DD de generación
}
