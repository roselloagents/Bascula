// =====================================================================
// CONTRATO COMPARTIDO — Báscula
// Tipos de entrada/salida del motor de cálculo (docs/SPEC-calculo.md §0.3 y "Salida (Resultado)"),
// del generador de ejemplos de comidas y del exportador PDF.
// Fuente única de verdad: docs/SPEC-calculo.md. Cualquier cambio aquí afecta a motor, UI, comidas y PDF.
// =====================================================================

// ---------- Inputs (SPEC §0.3 / §1) ----------
export type Sexo = 'hombre' | 'mujer'
export type MetodoGrasa = 'conocido' | 'medidas' | 'visual' | 'desconocido'
export type FuenteGrasa = 'fiable' | 'estimado'
export type VisualHombre = 'muy_definido' | 'definido' | 'medio' | 'sobrepeso_visible' | 'obesidad_visible'
export type VisualMujer = 'muy_definida' | 'tonificada' | 'media' | 'sobrepeso_visible' | 'obesidad_visible'
export type CategoriaVisual = VisualHombre | VisualMujer
export type ActividadDiaria = 'sedentario' | 'ligero' | 'moderado' | 'alto' | 'muy_alto'
export type TipoEntrenamiento = 'ninguno' | 'fuerza' | 'cardio' | 'mixto'
export type Intensidad = 'baja' | 'media' | 'alta'
export type Experiencia = 'novato' | 'intermedio' | 'avanzado'
export type Momento = 'manana' | 'mediodia' | 'tarde' | 'noche'
export type Objetivo = 'perder' | 'mantener' | 'ganar' | 'recomposicion' | 'no_se'
export type ObjetivoEfectivo = Exclude<Objetivo, 'no_se'>
export type Ritmo = 'suave' | 'moderado' | 'agresivo'
export type Preferencia = 'omnivoro' | 'vegetariano' | 'vegano' | 'sin_lactosa' | 'sin_gluten' | 'low_carb'
export type Condicion =
  | 'diabetes'
  | 'renal'
  | 'hepatica'
  | 'tca'
  | 'cardiaca'
  | 'hipertension'
  | 'tiroides'
  | 'bariatrica'
  | 'glp1'
  | 'otra'
/** Cribado breve del paso 5b del wizard. 'positivo' y 'evitado' añaden 'tca' a `condiciones` (SPEC Paso 0). */
export type CribadoTCA = 'positivo' | 'evitado' | 'negativo'
export type Somatotipo = 'ectomorfo' | 'mesomorfo' | 'endomorfo'
export type Fiabilidad = 'alta' | 'media' | 'baja'
export type BandaGrasa = 'muy_bajo' | 'bajo' | 'medio' | 'alto' | 'muy_alto'
export type Perfil = 'sedentario' | 'cardio' | 'fuerza'
export type NComidas = 2 | 3 | 4 | 5 | 6

export interface InputGrasa {
  metodo: MetodoGrasa
  valor?: number // metodo 'conocido' (3–70; el paso 2 lo recorta a 4–60 H / 10–60 M)
  fuente?: FuenteGrasa // metodo 'conocido'
  cuello_cm?: number // metodo 'medidas'
  cintura_cm?: number // metodo 'medidas'
  cadera_cm?: number // metodo 'medidas', obligatorio en mujeres
  categoria?: CategoriaVisual // metodo 'visual'
}

export interface InputSomatotipo {
  q1: 'fina' | 'media' | 'ancha' // estructura ósea
  q2: 'poca' | 'moderada' | 'mucha' // facilidad histórica para ganar grasa
  q3: 'poca' | 'moderada' | 'mucha' // facilidad histórica para ganar músculo
  q4: 'delgado' | 'atletico' | 'robusto' // apariencia habitual sin entrenar
}

export interface InputEntrenamiento {
  tipo: TipoEntrenamiento
  dias_semana: number // 0–7 entero
  minutos_sesion: number // 10–240 entero (ignorado si tipo = 'ninguno')
  intensidad: Intensidad
  experiencia: Experiencia
  momento: Momento | null
}

export interface InputCalculo {
  sexo: Sexo
  edad: number // 0–120; fuera de 18–75 el paso 0 devuelve EXCL_EDAD
  altura_cm: number // 130–230
  peso_kg: number // 35–300
  grasa: InputGrasa
  somatotipo: InputSomatotipo | null
  actividad_diaria: ActividadDiaria
  entrenamiento: InputEntrenamiento
  objetivo: Objetivo
  ritmo: Ritmo
  peso_objetivo: number | null // 30–300; null = "no lo sé"
  preferencia: Preferencia
  n_comidas: NComidas
  clima_caluroso: boolean
  embarazo_lactancia: boolean
  condiciones: Condicion[]
  cribado_tca: CribadoTCA | null
  fecha_inicio: string // ISO 'YYYY-MM-DD'
  /** Paso 13 del wizard, "¿Quieres comidas sencillas?" (SPEC-ux-comidas-pdf §3.7). `false` por defecto.
   *  **El motor lo ignora por completo**: no entra en ningún cálculo de kcal, macros, agua ni cronograma.
   *  Solo lo lee el generador de menús, que con `true` usa el banco sencillo (≤ 12 alimentos distintos
   *  en la semana y dos variantes por rol de comida que se alternan por día par/impar). */
  menu_sencillo?: boolean
}

/** Alias histórico usado por la UI, el generador de comidas y el PDF. */
export type Inputs = InputCalculo

// ---------- Salida del motor (SPEC "Salida (Resultado)") ----------
export type ImcCategoria = 'bajo_peso' | 'normal' | 'sobrepeso' | 'obesidad_I' | 'obesidad_II' | 'obesidad_III'
export type BmrEcuacion = 'mifflin' | 'katch_mcardle'
export type FfmiCategoria = 'bajo' | 'medio' | 'bueno' | 'muy_desarrollado' | 'excepcional'
export type BaseProteina = 'peso_corporal' | 'peso_ajustado'
export type MetodoPesoObjetivo = 'grasa' | 'ritmo_16_semanas' | 'actual'
export type PrecisionFecha = 'dia' | 'mes'

/** Códigos que impiden devolver un plan. `ERR_INPUT_RANGO` viaja acompañado de `errores`. */
export type CodigoExclusion =
  | 'EXCL_EDAD'
  | 'EXCL_EMBARAZO_LACTANCIA'
  | 'EXCL_IMC_MUY_BAJO'
  | 'EXCL_TCA_RIESGO'
  | 'ERR_INPUT_RANGO'

export interface ResultadoGrasa {
  pct: number
  rango: [number, number]
  fiabilidad: Fiabilidad
  metodo_efectivo: MetodoGrasa
  banda: BandaGrasa
  referencias: { cunbae: number; deurenberg: number; navy?: number }
}

export interface ResultadoBmr {
  valor: number
  ecuacion: BmrEcuacion
  referencias: { mifflin: number; katch: number; harris: number }
}

export interface ResultadoTdee {
  valor: number
  bruto: number
  pal: number
  ejercicio_dia: number
  perfil: Perfil
}

export interface ResultadoMacros {
  proteina_g: number
  grasa_g: number
  hc_g: number
  fibra_g: number
  azucares_libres_max_g: number
  pct: { p: number; g: number; hc: number }
  gkg: { p: number; g: number; hc: number }
  base_proteina: BaseProteina
  base_kg: number
  somatotipo: Somatotipo
  /** Fracción de kcal del cap de proteína realmente aplicada en el paso 8 (0,35 o 0,30).
   *  El texto de `INFO_PROTEINA_CAPADA` la imprime: no puede deducirse de `kcal`, porque los
   *  pasos 9 y 10 pueden haberlas subido después de aplicar el cap. */
  pct_cap: number
}

/** `null` con condición `renal` o `cardiaca` (SPEC Paso 12). */
export type ResultadoAgua = { ml: number; rango: [number, number]; vasos: number } | null

export interface ResultadoPesoObjetivo {
  efectivo: number | null
  sugerido: number
  /** `false` ⇒ la UI y el PDF muestran solo la franja, sin número grande (SPEC Paso 13). */
  mostrar_central: boolean
  rango: [number, number]
  metodo: MetodoPesoObjetivo
  hito_intermedio: number | null
  referencias: {
    imc22: number
    rango_imc: [number, number]
    /** `null` fuera de 150–200 cm de altura. */
    clasicas: Record<string, number> | null
  }
}

export interface ResultadoCronograma {
  ritmo_kg_sem: number
  ritmo_pct_sem: number
  delta_kg: number
  semanas: [number, number]
  diet_breaks: number
  fecha_min: string // ISO YYYY-MM-DD
  fecha_max: string // ISO YYYY-MM-DD
  /** `'mes'` ⇒ no se imprimen fechas exactas, solo mes y año (SPEC Paso 14). */
  precision_fecha: PrecisionFecha
  /** Pérdida/ganancia prevista en las primeras 12 semanas; `null` con horizonte ≤ 16 semanas. */
  tramo_12sem: [number, number] | null
}

export interface ResultadoFfmi {
  valor: number
  normalizado: number
  /** `null` cuando la banda de grasa es `alto` o `muy_alto` (SPEC Paso 15). */
  categoria: FfmiCategoria | null
}

export interface Comida {
  /** Nombre de la toma: Desayuno, Media mañana, Comida, Merienda, Cena, Recena (SPEC tabla 3.13). */
  nombre: string
  /** Hora nominal fija 'HH:MM' de la tabla 3.13. No interviene en ningún cálculo. */
  hora: string
  pct_kcal: number
  proteina_g: number
  grasa_g: number
  hc_g: number
  kcal: number
  /** Comida de alrededor del entrenamiento (SPEC tabla 3.14). Como mucho una es `true`. */
  peri: boolean
}

export interface Resultado {
  /** Presente ⇒ no hay plan: el resto de campos no debe leerse ni mostrarse. */
  excluido?: CodigoExclusion
  /** Solo con `excluido === 'ERR_INPUT_RANGO'`: nombres de los campos fuera de rango. */
  errores?: string[]
  imc: number
  imc_categoria: ImcCategoria
  grasa: ResultadoGrasa
  mlg: number
  bmr: ResultadoBmr
  tdee: ResultadoTdee
  objetivo_efectivo: ObjetivoEfectivo
  /** Objetivo que propuso la regla 6.1 con `objetivo === 'no_se'`; `undefined` si el usuario
   *  eligió objetivo. Los pasos 6.3-6.4, 7 y 10bis pueden reescribir `objetivo_efectivo` después,
   *  y los textos de `INFO_OBJETIVO_RESUELTO*` hablan de lo que se propuso, no del plan final. */
  objetivo_propuesto?: ObjetivoEfectivo
  ritmo_efectivo: Ritmo
  /** Paso 6.8: `diabetes` + `low_carb` -> `omnivoro`. El generador de comidas y el PDF deben usar
   *  este valor, nunca `inputs.preferencia`. */
  preferencia_efectiva: Preferencia
  kcal: number
  kcal_cierre: number
  macros: ResultadoMacros
  agua: ResultadoAgua
  peso_objetivo: ResultadoPesoObjetivo
  cronograma: ResultadoCronograma | null
  ffmi: ResultadoFfmi
  /** Un único reparto en la v1: no hay día de entreno y día de descanso (SPEC Paso 16). */
  comidas: Comida[]
  /** Códigos de la tabla §4, sin duplicados y con las reglas de supresión ya aplicadas. */
  avisos: string[]
}

/** Alias histórico usado por la UI, el generador de comidas y el PDF. */
export type Salida = Resultado

// ---------- Textos de avisos (SPEC §4) ----------
export type Severidad = 'error' | 'warn' | 'info'
export interface AvisoTexto {
  codigo: string
  severidad: Severidad
  titulo: string // etiqueta corta para la UI (p. ej. "Peso objetivo poco seguro")
  texto: string // texto completo con los placeholders ya sustituidos
}

// ---------- Ejemplos de comidas (docs/SPEC-ux-comidas-pdf.md §3) ----------
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
  comida: string // mismo valor que Comida.nombre (resultado.comidas[i].nombre)
  hora: string
  peri: boolean
  objetivo: Macros // lo que pide el reparto del motor para esta toma
  alimentos: AlimentoPorcion[]
  totales: Macros // suma real de los alimentos
  alternativas: string[] // 2-3 sustituciones en texto ("Cambia el pollo por 150 g de merluza")
  /**
   * Número de platos en que se sirve la toma cuando no cabe en uno solo (§3.3). Ausente si es 1,
   * que es el caso normal. `alimentos` viene agrupado por alimento, así que sus gramos son los de
   * **toda la toma**: para comprobar los límites de ración de §3.3 hay que dividirlos entre este
   * número. La nota de §3.6 dice lo mismo en palabras; la pantalla y el PDF no necesitan el campo.
   */
  platos?: number
}

export interface EjemploDia {
  tipo: 'entreno' | 'descanso'
  comidas: EjemploComida[]
  totales: Macros
  notas: string[]
}

/** Una fila de una tabla de equivalencias: la ración de ese alimento que iguala la referencia. */
export interface FilaEquivalencia {
  id: string
  nombre: string
  gramos: number
  medida: string
}

export interface TablaEquivalencia {
  titulo: string
  descripcion: string
  filas: FilaEquivalencia[]
}

/** Bloque "Equivalencias" de SPEC-ux §2.5 y §4.4: se genera solo con `foods.json`. */
export interface TablasEquivalencia {
  cabecera: string
  nota_verdura_fruta: string
  tablas: TablaEquivalencia[]
}

export interface Ejemplos {
  entreno: EjemploDia
  descanso: EjemploDia // si no entrena, igual que entreno
  consejos: string[] // 3-5 consejos prácticos de adherencia según preferencia/objetivo
  /** Tablas isoproteica, isoglucídica e isolipídica filtradas por `preferencia_efectiva` (§2.5). */
  equivalencias: TablasEquivalencia
  /** Lista de la compra semanal del menú (§3.7). `undefined` cuando no hay menú
   *  (condición `renal` o `hepatica`, §3.1) o cuando el generador aún no la ha calculado. */
  compra?: ListaCompra
  /** `true` si el menú se ha generado con el banco sencillo (`inputs.menu_sencillo`, §3.7).
   *  La pantalla y el PDF lo usan solo para el rótulo del bloque; no cambia ningún número. */
  modo_sencillo?: boolean
  /**
   * Preferencia con la que se construyó el menú: `Resultado.preferencia_efectiva`, que no tiene
   * por qué ser `Inputs.preferencia` (el Paso 6.8 anula el low-carb con `diabetes`). La escribe
   * `generarEjemplos` para que `generarListaCompra` no tenga que deducirla de los alimentos.
   * Opcional: un `Ejemplos` construido a mano puede no traerla.
   */
  preferencia_efectiva?: Preferencia
}

// ---------- Lista de la compra semanal (docs/SPEC-ux-comidas-pdf.md §3.7) ----------
/** Sección del supermercado por la que se agrupa la lista (orden de recorrido de la tienda). */
export type SeccionSuper =
  | 'carniceria'
  | 'pescaderia'
  | 'huevos_lacteos'
  | 'fruteria'
  | 'despensa'
  | 'congelados'
  | 'panaderia'
  | 'otros'

/** Cómo se guarda el producto una vez comprado. Determina el consejo de compra fraccionada. */
export type Conservacion = 'fresco' | 'despensa' | 'congelado'

/** Una línea de la lista de la compra: un alimento del menú con su formato de venta típico. */
export interface ItemCompra {
  /** `id` de `src/data/foods.json`. */
  alimento_id: string
  /** Nombre del alimento tal y como aparece en el menú. */
  nombre: string
  /** Producto comercial típico de Mercadona (`src/data/mercadona.json`). Sin precio. */
  producto: string
  seccion: SeccionSuper
  conservacion: Conservacion
  /** Gramos que pide el menú en un día (media de las dos variantes si se alternan). */
  gramos_dia: number
  /** `gramos_dia · 7`, redondeado. */
  gramos_semana: number
  /** Peso neto aproximado de un envase o unidad de compra. Siempre > 0. */
  envase_g: number
  /** Formato del envase en texto ("bandeja ≈ 1 kg", "docena", "bote 400 g escurrido 240 g"). */
  envase_descripcion: string
  /** `ceil(gramos_semana / envase_g)`. */
  envases: number
  /** `floor(envases · envase_g / gramos_dia)`, acotado por `conservacion_dias`. */
  dura_dias: number
  /** Consejo breve de conservación o de compra fraccionada. */
  consejo?: string
}

/** Bloque "Lista de la compra" de §2.5b y de la página del PDF de §3.7. */
export interface ListaCompra {
  supermercado: 'Mercadona'
  dias: 7
  /** Ordenados por sección (orden de `SeccionSuper`) y, dentro de cada sección, por `nombre`. */
  items: ItemCompra[]
  /** Número de alimentos distintos del menú semanal (`items.length`). */
  alimentos_distintos: number
  /** Notas fijas al pie de la lista (formatos aproximados, compra fraccionada, pesar en crudo). */
  notas: string[]
}

// ---------- Datos para el PDF ----------
export interface DatosPdf {
  inputs: Inputs
  resultado: Resultado
  ejemplos: Ejemplos
  avisos: AvisoTexto[]
  fecha: string // ISO YYYY-MM-DD de generación
}
