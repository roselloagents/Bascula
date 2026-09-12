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
export type VisualHombre =
  'muy_definido' | 'definido' | 'medio' | 'sobrepeso_visible' | 'obesidad_visible'
export type VisualMujer =
  'muy_definida' | 'tonificada' | 'media' | 'sobrepeso_visible' | 'obesidad_visible'
export type CategoriaVisual = VisualHombre | VisualMujer
export type ActividadDiaria = 'sedentario' | 'ligero' | 'moderado' | 'alto' | 'muy_alto'
export type TipoEntrenamiento = 'ninguno' | 'fuerza' | 'cardio' | 'mixto'
export type Intensidad = 'baja' | 'media' | 'alta'
export type Experiencia = 'novato' | 'intermedio' | 'avanzado'
export type Momento = 'manana' | 'mediodia' | 'tarde' | 'noche'
export type Objetivo = 'perder' | 'mantener' | 'ganar' | 'recomposicion' | 'no_se'
export type ObjetivoEfectivo = Exclude<Objetivo, 'no_se'>
export type Ritmo = 'suave' | 'moderado' | 'agresivo'
export type Preferencia =
  'omnivoro' | 'vegetariano' | 'vegano' | 'sin_lactosa' | 'sin_gluten' | 'low_carb'
/** Base dietética excluyente del paso 13 del wizard (SPEC §1 fila 19). */
export type PreferenciaBase = 'omnivoro' | 'vegetariano' | 'vegano'
/** Restricciones combinables (varias a la vez) del paso 13 del wizard (SPEC §1 fila 20). */
export type Restriccion = 'sin_lactosa' | 'sin_gluten'
/** Subpregunta del paso de objetivo cuando se elige `recomposicion` (SPEC §1 fila 22). */
export type RecomposicionPrioridad = 'perder' | 'equilibrado' | 'ganar'
/** Respuesta del paso "¿Cómo es tu regla?", solo mujeres (SPEC §1 fila 23). */
export type Menstruacion = 'regular' | 'irregular' | 'ausente' | 'no_dice'
/**
 * Subpregunta "¿Qué notas esos días?" del paso de la regla (v1.2, SPEC §1 fila 25).
 * El array llega en el orden que elija la interfaz; el motor lo normaliza al orden canónico
 * de este tipo (dolor · hinchazon · antojos · cansancio · sangrado_abundante), que es el que
 * fija el orden de `Resultado.ciclo.consejos` (SPEC Paso 19).
 */
export type SintomaRegla = 'dolor' | 'hinchazon' | 'antojos' | 'cansancio' | 'sangrado_abundante'
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
  /** **No lo expone la UI desde la v1.1**: el paso 5b del wizard desapareció y la conversión a
   *  `InputCalculo` escribe siempre `null` (SPEC §1 fila 17). El motor conserva la regla —`positivo`
   *  y `evitado` añaden `'tca'` a `condiciones` en el paso 0— porque `'tca'` sigue siendo una
   *  `Condicion` válida y los vectores de la §5 la usan. */
  cribado_tca: CribadoTCA | null
  fecha_inicio: string // ISO 'YYYY-MM-DD'
  /** Paso 13 del wizard, "¿Quieres comidas sencillas?" (SPEC-ux-comidas-pdf §3.7). `false` por defecto.
   *  **El motor lo ignora por completo**: no entra en ningún cálculo de kcal, macros, agua ni cronograma.
   *  Solo lo lee el generador de menús, que con `true` usa el banco sencillo (≤ 12 alimentos distintos
   *  en la semana y dos variantes por rol de comida que se alternan por día par/impar). */
  menu_sencillo?: boolean
  // ---------- v1.1: campos nuevos, TODOS opcionales (ninguno cambia los 14 vectores) ----------
  /** Subpregunta "¿Qué te importa más ahora?" del paso de objetivo, solo con `objetivo === 'recomposicion'`.
   *  `undefined`/`null` equivale a `'equilibrado'`, que reproduce exactamente el comportamiento v1.0
   *  (SPEC Paso 7, tabla 3.9). Se ignora si `objetivo_efectivo` acaba siendo otro. */
  recomposicion_prioridad?: RecomposicionPrioridad | null
  /** Paso "¿Cómo es tu regla?" (solo `sexo === 'mujer'`; en hombres se ignora). **No cambia ningún
   *  número** salvo el ritmo agresivo, que pasa a moderado con `irregular`/`ausente` (SPEC Paso 6.7bis).
   *  Produce `INFO_CICLO` y `WARN_CICLO_AUSENTE`. */
  menstruacion?: Menstruacion | null
  /** Base dietética excluyente del paso 13 (SPEC §1 fila 19). Cuando está presente **manda sobre
   *  `preferencia`**, que deja de leerse; cuando falta, el paso 0 la deduce de `preferencia`. */
  preferencia_base?: PreferenciaBase | null
  /** Restricciones combinables del paso 13 (varias a la vez). Solo se leen si `preferencia_base`
   *  está presente; si no, el paso 0 las deduce de `preferencia`. */
  restricciones?: Restriccion[] | null
  /** Interruptor "bajo en hidratos" del paso 13. Solo se lee si `preferencia_base` está presente;
   *  si no, el paso 0 lo deduce de `preferencia === 'low_carb'`. */
  low_carb?: boolean | null
  // ---------- v1.2: campos nuevos, TODOS opcionales (ningún vector anterior cambia por ellos) ----------
  /** "Tengo una fecha en mente" del paso de ritmo (SPEC §1 fila 24). Semanas enteras, 4–52.
   *  **Solo se lee con `peso_objetivo !== null`** y con un objetivo efectivo `perder` o `ganar`:
   *  el paso 6.7ter elige con él el ritmo DISCRETO más suave que llega a tiempo (SPEC Paso 6.7ter).
   *  Ausente o `null` ⇒ comportamiento idéntico al de la v1.1. */
  plazo_semanas?: number | null
  /** Subpregunta "¿Qué notas esos días?" del paso de la regla (SPEC §1 fila 25). Solo se lee con
   *  `sexo === 'mujer'` y `menstruacion ∈ {regular, irregular}`. **No cambia ningún número**:
   *  su único efecto es `Resultado.ciclo` (SPEC Paso 19). Se deduplica y se ordena al orden
   *  canónico de `SintomaRegla`. */
  sintomas_regla?: SintomaRegla[] | null
  /** Ids de `src/data/foods.json` que el usuario no quiere ver en su menú (paso de alimentos del
   *  wizard, v1.2). **El motor lo ignora por completo**, igual que `menu_sencillo`: dos usuarios
   *  idénticos salvo este campo reciben el mismo `Resultado`. Solo lo lee `src/meals`
   *  (`SPEC-ux-comidas-pdf.md` §3.2b). */
  alimentos_excluidos?: string[] | null
  /** Ids de `src/data/foods.json` marcados como favoritos, **en el orden en que los marcó el
   *  usuario** (ese orden es normativo: fija la prioridad dentro de cada `FoodQuery`).
   *  **El motor lo ignora por completo**; solo lo lee `src/meals` (§3.2b). */
  alimentos_favoritos?: string[] | null
}

/** Alias histórico usado por la UI, el generador de comidas y el PDF. */
export type Inputs = InputCalculo

// ---------- Salida del motor (SPEC "Salida (Resultado)") ----------
export type ImcCategoria =
  'bajo_peso' | 'normal' | 'sobrepeso' | 'obesidad_I' | 'obesidad_II' | 'obesidad_III'
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
  // ---------- v1.1: campos nuevos, TODOS opcionales ----------
  /** Base dietética efectiva tras la traducción del paso 0 (SPEC §1, "regla de traducción").
   *  Es la que decide los multiplicadores de proteína (vegano ×1,15 / vegetariano ×1,10). */
  preferencia_base?: PreferenciaBase
  /** Restricciones efectivas tras la traducción del paso 0, sin duplicados y en orden canónico
   *  (`sin_lactosa` antes que `sin_gluten`). El generador de menús filtra por TODAS ellas. */
  restricciones?: Restriccion[]
  /** Interruptor "bajo en hidratos" efectivo (el paso 6.8 lo anula con `diabetes`). */
  low_carb?: boolean
  /** Prioridad de recomposición realmente aplicada; `undefined` si `objetivo_efectivo !== 'recomposicion'`. */
  recomposicion_prioridad?: RecomposicionPrioridad
  /** Proyección semana a semana del peso esperado (SPEC Paso 14). `undefined` con `excluido`
   *  o con `'tca' ∈ condiciones`. Sin cronograma es la proyección plana de ±1 kg. */
  proyeccion?: PuntoProyeccion[]
  /** Datos que necesita `ajustarMacros` (SPEC Paso 18) para no depender de `Inputs`.
   *  **Invariante**: `ajustarMacros` lo copia tal cual, nunca lo recalcula. */
  limites_ajuste?: LimitesAjuste
  /** Presente **solo** en un `Resultado` devuelto por `ajustarMacros` (SPEC Paso 18): dice qué
   *  palanca movió el usuario. Ausente ⇒ el plan es el recomendado por el motor. */
  ajuste?: { kcal: boolean; hc: boolean }
  // ---------- v1.2 ----------
  /** Consejos por síntoma de la regla (SPEC Paso 19). `undefined` salvo que `INFO_CICLO` esté
   *  entre los avisos **y** `inputs.sintomas_regla` traiga al menos un síntoma válido.
   *  **No cambia ningún número del plan**: es copy, y así lo dice su propio texto. */
  ciclo?: ResultadoCiclo
}

/** Un consejo de la tarjeta "Tu ciclo y tu plan" (SPEC Paso 19). */
export interface ConsejoCiclo {
  clave: SintomaRegla
  /** Encabezado corto del bloque ("Dolor: omega-3, magnesio y calor"). */
  titulo: string
  /** Texto completo, con los fragmentos condicionales ya resueltos por el motor. */
  texto: string
  /** Nombres legibles (no ids) ya filtrados por la base dietética y por las restricciones.
   *  Puede quedar vacío si las restricciones se llevan todos los candidatos; el consejo se
   *  publica igual, porque su texto vale por sí solo. */
  alimentos: string[]
}

/** `Resultado.ciclo` (SPEC Paso 19). */
export interface ResultadoCiclo {
  /** Los síntomas marcados, deduplicados y en el orden canónico de `SintomaRegla`. */
  sintomas: SintomaRegla[]
  /** Un consejo por síntoma, en el mismo orden que `sintomas`. */
  consejos: ConsejoCiclo[]
}

/** Un punto de la curva de proyección de peso (SPEC Paso 14). Pesos en kg con 1 decimal. */
export interface PuntoProyeccion {
  /** Semanas desde `fecha_inicio`. La entrada 0 es el peso actual (los tres valores coinciden). */
  semana: number
  /** Extremo optimista de la banda: el peso más bajo esperable en `perder`, el más bajo en `ganar`. */
  peso_min: number
  /** Valor central de la curva (adaptación creciente). */
  peso_esp: number
  /** Extremo pesimista de la banda. `peso_min ≤ peso_esp ≤ peso_max` siempre. */
  peso_max: number
}

/** Lo que el usuario mueve en el panel "Ajusta tus macros" (SPEC Paso 18, SPEC-ux §2.2b). */
export interface AjusteMacros {
  /** Calorías objetivo pedidas. Ausente ⇒ se conservan las recomendadas. */
  kcal?: number
  /** Hidratos en gramos pedidos. Ausente ⇒ se conservan los recomendados. */
  hc_g?: number
}

/** Límites y constantes del ajuste manual, publicados por el motor (SPEC Paso 18). */
export interface LimitesAjuste {
  /** `kcal` del plan recomendado. Nunca cambia, aunque el resultado ya venga ajustado. */
  kcal_recomendada: number
  /** `macros.hc_g` del plan recomendado. Nunca cambia. */
  hc_recomendado_g: number
  /** `macros.grasa_g` del plan recomendado. Nunca cambia: `ajustarMacros` la restituye tal cual
   *  cuando el ajuste está vacío, y así "volver a lo recomendado" devuelve el plan bit a bit. */
  grasa_recomendada_g: number
  /** Extremo inferior del control de calorías (múltiplo de 10): el suelo de seguridad del paso 7. */
  kcal_min: number
  /** Extremo superior (múltiplo de 10): el TDEE en `perder`, `1,20 · kcal_recomendada` en el resto. */
  kcal_max: number
  /** Salto del control de calorías en la interfaz. Siempre 50. */
  kcal_paso: number
  /** Mínimo del deslizador de hidratos. Siempre 30 g. */
  hc_min_ui_g: number
  /** Mínimo de hidratos del motor: 130 g, o 75 g con `low_carb` (SPEC Paso 10). */
  hc_min_motor_g: number
  /** Parte absoluta del suelo de grasa del paso 9: `(0,7 H / 0,8 M) · base_kg`. La otra parte
   *  (`0,20 · kcal / 9`) depende de las calorías y se recalcula en cada ajuste. */
  suelo_grasa_abs_g: number
  /** Peso corporal del usuario, para rehacer `gkg` y la proyección sin leer `Inputs`. */
  peso_kg: number
  /** `fecha_inicio` del usuario, para rehacer el cronograma sin leer `Inputs`. */
  fecha_inicio: string
  /** Umbral de `INFO_MICRONUTRIENTES`: 1 800 kcal en hombres, 1 500 en mujeres. */
  kcal_micronutrientes: number
}

/** Un pesaje del seguimiento local (SPEC-ux §2.6c). Vive solo en `localStorage`; el motor no lo lee. */
export interface Pesaje {
  /** ISO 'YYYY-MM-DD'. */
  fecha: string
  /** 30–300 kg, un decimal. */
  kg: number
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
  // ---------- v1.2 ----------
  /**
   * Avisos propios del generador que no están en la tabla §4 del motor y que la pantalla y el PDF
   * listan junto al resto (`SPEC-ux-comidas-pdf.md` §2.8). Hoy los emite: la regla de respaldo de
   * exclusiones de §3.2b ("No hemos podido evitar {alimento} en {comida}"). `undefined` o vacío
   * ⇒ no hay ninguno.
   */
  avisos_menu?: string[]
  /**
   * 2-4 alimentos sugeridos para los días de regla (§2.2c y §3.8), elegidos según
   * `resultado.ciclo.sintomas` y filtrados por base, restricciones **y `alimentos_excluidos`**.
   * `undefined` cuando no hay `resultado.ciclo` o cuando no hay menú (`renal`/`hepatica`).
   */
  alimentos_ciclo?: AlimentoCiclo[]
  /**
   * Favoritos del paso 14 que de verdad han llegado a la semana (§3.2b): los que están en el menú
   * o en la lista de la compra. El tope de 12 del modo sencillo puede dejar alguno fuera, y un
   * favorito que ninguna plantilla considera apto para sus tomas puede no salir en el plato. Es
   * la lista que imprimen el resumen de §2.5 y la fila de §4.2/§4.4, no la del cuestionario.
   * `undefined` cuando el usuario no ha marcado ningún favorito.
   */
  favoritos_aplicados?: string[]
}

/** Un alimento sugerido para los días de regla (`Ejemplos.alimentos_ciclo`, §3.8). */
export interface AlimentoCiclo {
  /** `id` de `src/data/foods.json`. */
  id: string
  /** `nombre` del alimento (el largo, no `nombre_corto`). */
  nombre: string
  /** Una línea corta que dice por qué está aquí ("hierro, para el sangrado abundante"). */
  por_que: string
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
  /** Número de alimentos distintos del menú semanal (`items.length`). **No cuenta los de
   *  `opcional_ciclo`**: esos no son del plan. */
  alimentos_distintos: number
  /** Notas fijas al pie de la lista (formatos aproximados, compra fraccionada, pesar en crudo). */
  notas: string[]
  /** Sección opcional "Para los días de regla" (v1.2, §3.8). `undefined` salvo que
   *  `resultado.ciclo` traiga `sangrado_abundante`, `cansancio` o `dolor`. */
  opcional_ciclo?: SeccionOpcionalCompra
}

/** Una sección opcional de la lista de la compra: no entra en las cantidades del plan (§3.8). */
export interface SeccionOpcionalCompra {
  /** Encabezado literal de la sección. */
  titulo: string
  /** Nota fija que deja claro que es opcional y que no está contada en el plan. */
  nota: string
  /** 1-3 líneas, con el mismo formato que el resto de la lista y cantidades pequeñas. */
  items: ItemCompra[]
}

// ---------- Datos para el PDF ----------
export interface DatosPdf {
  inputs: Inputs
  resultado: Resultado
  ejemplos: Ejemplos
  avisos: AvisoTexto[]
  fecha: string // ISO YYYY-MM-DD de generación
  /** Pesajes del seguimiento local (SPEC-ux §2.6c y §4.5b). `undefined` o vacío ⇒ el PDF no
   *  imprime el bloque de seguimiento. Nunca se envían a ningún servidor. */
  pesajes?: Pesaje[]
  /** v1.3 (SPEC-dieta-propia §6.2): el día compuesto con lo que la persona contó. Ausente ⇒ el PDF
   *  imprime el menú propuesto como hasta la v1.2. Presente ⇒ la sección "Ejemplo de menú" pasa a ser
   *  "Tu menú, con lo tuyo dentro" y la compra es la de ese día. */
  dieta_propia?: DiaCompuesto
}

// ---------- v1.3: "Cuéntanos cómo comes" (docs/SPEC-dieta-propia.md) ----------
// El motor NO lee nada de esta sección. `DietaInterpretada` la devuelve el servicio `api/` (Claude) y
// la corrige el usuario en la pantalla; `DiaCompuesto` lo calcula `src/meals/dieta/componer.ts` en el
// navegador, de forma pura y determinista (SPEC-dieta-propia §4): las comidas dictadas se conservan
// (con los gramos ajustados solo si hace falta) y los huecos los monta el generador de menús.

/** Estado del alimento, el mismo enum que `src/data/foods.ts` (SPEC-dieta-propia §3.3 regla 5). */
export type EstadoAlimentoPropio = 'crudo' | 'cocido' | 'seco' | 'listo'
/** Grupo aproximado que asigna el modelo; con `alimento_id` el servidor impone el `grupo` del catálogo. */
export type GrupoAprox =
  'proteina' | 'lacteo' | 'carbohidrato' | 'grasa' | 'verdura' | 'fruta' | 'bebida' | 'otro'

/** Macros por 100 g de un alimento propio: los cuatro de siempre más fibra (g) y alcohol (g). */
export interface MacrosPropio extends Macros {
  fibra: number
  alcohol: number
}

/** Un alimento tal y como lo ha entendido el modelo, más las correcciones del usuario (§3.4 y §5.4). */
export interface AlimentoPropio {
  /** Fragmento del texto del que sale ("100 g de arroz basmati pesado en seco"). */
  texto: string
  /** Nombre que se enseña ("Arroz basmati (crudo)"). */
  nombre: string
  /** `id` de foods.json si es el mismo alimento en el mismo estado; si no, null. */
  alimento_id: string | null
  estado: EstadoAlimentoPropio
  grupo_aprox: GrupoAprox
  /** Gramos que dijo la persona (ya convertidos), o que corrigió en la pantalla. null = no lo dijo. */
  gramos: number | null
  /** Solo si la persona habló en unidades o el alimento del catálogo es contable (el servidor la impone). */
  unidad?: { nombre: string; gramos: number }
  cantidad_unidades?: number | null
  /** Por 100 g. Del catálogo si hay `alimento_id` (el servidor los impone); estimados si no; del envase
   *  si el usuario los escribió en la pantalla. */
  macros_100g: MacrosPropio
  origen_macros: 'catalogo' | 'estimado' | 'envase'
  /** false = el ajuste no lo toca (especias, bebidas alcohólicas o azucaradas, guarniciones…). */
  ajustable: boolean
  confianza: 'alta' | 'media' | 'baja'
  nota?: string
  /** "Esto no lo como" (§5.4): el alimento se ignora por completo; se conserva para poder deshacer. */
  retirado?: boolean
}

export interface ComidaPropia {
  nombre: string
  alimentos: AlimentoPropio[]
}

/** Un gusto dictado (§3.3 regla 11): qué quiere ver y qué no, sin cantidades. */
export interface GustoPropio {
  texto: string
  tipo: 'gusta' | 'no_gusta'
  /** Ids del catálogo que son ese alimento o esa familia; vacío si no está en la base. */
  alimento_ids: string[]
}

/** Cómo quiere la persona sus tomas (§3.3 regla 12). Se aplica donde se puede y se apunta donde no (§4.5). */
export type TipoHabito =
  | 'sin_hidratos'
  | 'ligera'
  | 'abundante'
  | 'misma_cada_dia'
  | 'n_comidas'
  | 'frecuencia_semanal'
  | 'horario'
  | 'otro'

export interface HabitoPropio {
  texto: string
  tipo: TipoHabito
  /** Nombre de la comida del plan a la que se refiere, ya normalizado por el servidor; null si no aplica. */
  comida: string | null
  /** `n_comidas` (2–6) o `frecuencia_semanal` (veces por semana); null en el resto. */
  valor: number | null
}

/** Respuesta de `POST /api/dieta/interpretar` (SPEC-dieta-propia §2.3 y §3.4), ya post-validada. */
export interface DietaInterpretada {
  /** Solo las comidas descritas con alimentos: pueden ser todas, algunas o ninguna. */
  comidas: ComidaPropia[]
  gustos: GustoPropio[]
  habitos: HabitoPropio[]
  no_entendido: { texto: string; sugerencia?: string }[]
  notas: string[]
  /** El modelo vio alimentos que se cocinan o ensaladas sin ninguna grasa de adición (§3.3 regla 10). */
  falta_aceite: boolean
}

/** Un alimento dictado después del ajuste de gramos (SPEC-dieta-propia §4.2 y §4.6). */
export interface AlimentoAjustado extends AlimentoPropio {
  estado_ajuste: 'variable' | 'fijo' | 'pendiente'
  /** Gramos finales. Igual a `gramos` en fijos; 0 en pendientes. */
  gramos_ajustados: number
  delta_g: number
  cambio: 'sube' | 'baja' | 'igual'
  /** `gramos_ajustados / gramos`, el factor realmente aplicado (1 en fijos y pendientes). */
  factor: number
  /** Si el gramaje final es el extremo de su caja, y quién lo pone: el factor o el tope de ración. */
  en_limite: 'no' | 'factor' | 'racion'
  /** Aporte real con `gramos_ajustados`. */
  aporte: MacrosPropio
}

/** `completa`: todos los huecos del plan vienen dictados; `parcial`: alguno se monta; `solo_contexto`: ninguno viene dictado. */
export type ModoComposicion = 'completa' | 'parcial' | 'solo_contexto'
/** `propia`: comida dictada por la persona; `propuesta`: hueco montado por el generador de menús. */
export type OrigenComida = 'propia' | 'propuesta'

export interface ComidaCompuesta {
  nombre: string
  hora: string | null
  peri: boolean
  origen: OrigenComida
  /** El hueco del plan (o el reparto del resto en un hueco montado); null en una comida extra propia. */
  objetivo: Macros | null
  /** Alimentos dictados y ajustados (origen `propia`); vacío en `propuesta`. */
  alimentos: AlimentoAjustado[]
  /** La toma montada por el generador (origen `propuesta`), con alternativas; null en `propia`. */
  ejemplo: EjemploComida | null
  totales: MacrosPropio
  /** % de las kcal del día que se lleva esta comida (0–100, 1 decimal). */
  pct_kcal: number
}

/** Salida de `componerDia` (SPEC-dieta-propia §4.6). */
export interface DiaCompuesto {
  modo: ModoComposicion
  comidas: ComidaCompuesta[]
  totales: MacrosPropio
  objetivo: Macros
  /** totales − objetivo, kcal entera y macros con 1 decimal. */
  desvio: Macros
  /** En el orden de prioridad de §4.4; la pantalla enseña tres y pliega el resto, el PDF los imprime todos. */
  avisos: { codigo: string; texto: string }[]
  /** "Lo que hemos tenido en cuenta" (§4.5): gustos y hábitos aplicados, en texto ya redactado. */
  aplicado: string[]
  /** "Apuntado, pero aún no lo aplicamos" (§4.5). */
  apuntado: string[]
  pendientes: { comida: string; nombre: string }[]
  no_entendido: DietaInterpretada['no_entendido']
  /** Notas del modelo y del generador de menús (huecos que no cuadran, dos platos, respaldo de exclusiones). */
  notas: string[]
  /** Número de alimentos dictados clasificados como `variable`. */
  n_variables: number
  /** Hay pendientes: los gramos son provisionales (§4.4, `DIETA_PENDIENTES`). */
  provisional: boolean
}
