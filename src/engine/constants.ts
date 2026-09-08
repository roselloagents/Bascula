// Todas las tablas numéricas de SPEC-calculo.md §3. Ningún número del motor vive fuera de aquí,
// salvo los que la propia spec escribe dentro de una fórmula (pasos 2, 4, 13 y 15).

import type {
  ActividadDiaria,
  BandaGrasa,
  Experiencia,
  Intensidad,
  Momento,
  NComidas,
  ObjetivoEfectivo,
  Perfil,
  Ritmo,
  TipoEntrenamiento,
  VisualHombre,
  VisualMujer,
} from './types'

// ---------- §3.1 Constantes globales ----------
/** Margen de seguridad por sobreestimación autoinformada (paso 5). */
export const FACTOR_CORRECCION = 0.95
/** kcal por kg de tejido graso. */
export const KCAL_POR_KG_GRASA = 7700
export const SUELO_KCAL_HOMBRE = 1500
export const SUELO_KCAL_MUJER = 1200
/** Disponibilidad energética mínima (kcal/kg de MLG); 25 en banda `muy_alto`. */
export const EA_MIN = 30
export const EA_MIN_MUY_ALTO = 25
export const CAP_DEFICIT = 0.25
export const CAP_DEFICIT_MUY_ALTO = 0.30
export const CAP_DEFICIT_65 = 0.20
export const SUPERAVIT_MIN = 150
export const SUPERAVIT_MAX = 500
export const SUPERAVIT_SIN_FUERZA = 0.05
/** Techos de proteína: g/kg de peso corporal y % de kcal. */
export const PROT_TECHO_GKG_PC = 2.5
export const PROT_PCT_CAP = 0.35
export const PROT_PCT_CAP_VEGETAL = 0.30
export const PROT_KCAL_VEGETAL_UMBRAL = 1800
export const PROT_TECHO_GKG = 2.4
export const PROT_TECHO_GKG_AJUSTADO = 2.0
/** Línea roja RDA (g/kg de peso corporal); no se aplica con condición `renal`. */
export const PROT_LINEA_ROJA = 0.8
/** Cap renal: último filtro, sobre peso corporal. */
export const PROT_CAP_RENAL = 1.0
export const PROT_MIN_BARIATRICA_GLP1 = 1.5
export const PROT_FACTOR_VEGANO = 1.15
export const PROT_FACTOR_VEGETARIANO = 1.10
export const GRASA_SUELO_GKG_HOMBRE = 0.7
export const GRASA_SUELO_GKG_MUJER = 0.8
export const GRASA_SUELO_PCT_KCAL = 0.20
export const GRASA_TECHO_PCT_KCAL = 0.40
export const GRASA_TECHO_PCT_KCAL_LOWCARB = 0.50
export const HC_MIN = 130
export const HC_MIN_LOWCARB = 75
/** Desplazamiento del somatotipo: 10 % de las kcal no proteicas. */
export const SOMATOTIPO_DESPLAZAMIENTO = 0.10
export const FIBRA_POR_1000_KCAL = 14
export const FIBRA_MAX = 40
export const FIBRA_REFERENCIA = 25
export const FIBRA_SUELO_PCT_HC = 0.15
export const FIBRA_SUELO_LOWCARB = 20
export const FIBRA_LOWCARB_POR_1000_KCAL = 10
export const AGUA_SUELO_HOMBRE = 2000
export const AGUA_SUELO_MUJER = 1500
export const AGUA_TECHO_BASE_HOMBRE = 4000
export const AGUA_TECHO_BASE_MUJER = 3100
export const AGUA_TECHO_DURO = 4000
export const AGUA_ML_POR_HORA_EJERCICIO = 500
export const AGUA_TOPE_EJERCICIO = 1000
export const AGUA_CLIMA_CALUROSO = 400
export const AGUA_VASO_ML = 250
export const AGUA_UMBRAL_AVISO = 3500
export const IMC_OBJETIVO_MIN = 18.5
export const IMC_OBJETIVO_MIN_65 = 22
/** Peso objetivo máximo en la rama `ganar`. */
export const IMC_OBJETIVO_MAX_GANAR = 27.5
export const HITO_UMBRAL = 0.15
export const HITO_FACTOR = 0.90
export const OBJETIVO_LEJANO_UMBRAL = 0.25
export const GANANCIA_LEJANA_UMBRAL = 0.10
export const HORIZONTE_MAX_SEMANAS = 104
export const HORIZONTE_MAX_SEMANAS_GANAR = 20

// ---------- §3.1 v1.1 — prioridad de recomposición, proyección y ajuste manual ----------
/** `perder`: el déficit de recomposición sube 5 puntos porcentuales, con tope duro del 15 %. */
export const RECOMP_PRIORIDAD_DELTA = 0.05
export const RECOMP_PRIORIDAD_TOPE = 0.15
/** Semanas de la proyección con cronograma (tope duro) y sin él (curva plana). */
export const SEM_PROYECCION_MAX = 26
export const SEM_PROYECCION_PLANA = 12
/** Oscilación normal de peso (agua, sal, intestino) de la proyección plana. */
export const BANDA_PLANA_KG = 1
/** Un ciclo MATADOR son 8 semanas de dieta + 1 de descanso = 9 semanas de calendario. */
export const DIET_BREAK_CICLO_SEMANAS = 9
/** Mínimo del deslizador de hidratos del panel de ajuste (paso 18). */
export const HC_MIN_AJUSTE_UI = 30
/** Salto del control de calorías del panel de ajuste. */
export const KCAL_PASO_AJUSTE = 50
/** Franja de calorías del ajuste fuera de `perder`: ±20 % del plan recomendado. */
export const AJUSTE_KCAL_FACTOR_MIN = 0.80
export const AJUSTE_KCAL_FACTOR_MAX = 1.20
/** Déficit por debajo del cual el plan ajustado deja de ser una pérdida (`WARN_KCAL_AJUSTE_ALTA`). */
export const AJUSTE_DEFICIT_MIN = 100
// ---------- §3.1 v1.2 — plazo, recomposición con déficit y ciclo ----------
/** Semanas admitidas en `plazo_semanas` (§1 fila 24). */
export const PLAZO_SEMANAS_MIN = 4
export const PLAZO_SEMANAS_MAX = 52
/** Orden en que el paso 6.7ter prueba los ritmos: gana el PRIMERO que llega a la fecha. */
export const RITMOS_POR_SUAVIDAD = ['suave', 'moderado', 'agresivo'] as const
/** Tolerancia de la comparación `kg_sem(r) ≥ ritmo_req` (paso 6.7ter). */
export const PLAZO_EPSILON = 1e-9
/** Déficit real mínimo (kcal/día) para que una recomposición tenga meta y curva (pasos 13 y 14). */
export const RECOMP_DEFICIT_MIN = 50
/** Margen mínimo entre el peso actual y la meta para que haya meta que dar (paso 13). */
export const RECOMP_META_MARGEN_KG = 0.5
/** Semanas mínimas de la curva de recomposición: los hitos de 4, 8 y 12 tienen que existir. */
export const SEM_PROYECCION_RECOMP_MIN = 12
/** Orden canónico de las restricciones combinables (§1.1). */
export const RESTRICCIONES_CANONICAS = ['sin_lactosa', 'sin_gluten'] as const
/** Bases dietéticas excluyentes (§1.1). */
export const PREFERENCIAS_BASE = ['omnivoro', 'vegetariano', 'vegano'] as const

// ---------- §3.2 Somatotipo ----------
export const SOMA_Q1: Record<'fina' | 'media' | 'ancha', number> = { fina: -1, media: 0, ancha: 1 }
export const SOMA_Q2: Record<'poca' | 'moderada' | 'mucha', number> = { poca: -1, moderada: 0, mucha: 1 }
export const SOMA_Q4: Record<'delgado' | 'atletico' | 'robusto', number> = { delgado: -1, atletico: 0, robusto: 1 }

// ---------- §3.3 Estimación visual (punto medio de la categoría ACE) ----------
export const VISUAL_HOMBRE: Record<VisualHombre, number> = {
  muy_definido: 10.0,
  definido: 15.5,
  medio: 21.0,
  sobrepeso_visible: 28.0,
  obesidad_visible: 36.0,
}
export const VISUAL_MUJER: Record<VisualMujer, number> = {
  muy_definida: 17.0,
  tonificada: 22.5,
  media: 28.0,
  sobrepeso_visible: 35.0,
  obesidad_visible: 43.0,
}

// ---------- §3.4 PAL base (solo vida diaria, sin ejercicio) ----------
export const PAL_BASE: Record<ActividadDiaria, number> = {
  sedentario: 1.40,
  ligero: 1.50,
  moderado: 1.60,
  alto: 1.75,
  muy_alto: 1.90,
}

// ---------- §3.5 MET por tipo e intensidad (se usa MET − 1) ----------
export const MET: Record<TipoEntrenamiento, Record<Intensidad, number>> = {
  fuerza: { baja: 3.5, media: 5.0, alta: 6.0 },
  cardio: { baja: 4.5, media: 7.0, alta: 9.5 },
  mixto: { baja: 4.0, media: 6.0, alta: 8.0 },
  ninguno: { baja: 0, media: 0, alta: 0 },
}

// ---------- §3.7 Ritmo de pérdida (% del peso corporal por semana) ----------
// Las bandas `bajo` y `muy_bajo` nunca llegan aquí: el paso 6 convierte `perder` en `recomposicion`.
export const RITMO_PERDIDA: Record<'muy_alto' | 'alto' | 'medio', Record<Ritmo, number>> = {
  muy_alto: { suave: 0.50, moderado: 0.75, agresivo: 1.00 },
  alto: { suave: 0.40, moderado: 0.60, agresivo: 0.80 },
  medio: { suave: 0.30, moderado: 0.40, agresivo: 0.50 },
}

// ---------- §3.8 Superávit (% del TDEE) por experiencia y ritmo ----------
export const SUPERAVIT: Record<Experiencia, Record<Ritmo, number>> = {
  novato: { suave: 0.10, moderado: 0.15, agresivo: 0.20 },
  intermedio: { suave: 0.05, moderado: 0.10, agresivo: 0.125 },
  avanzado: { suave: 0.05, moderado: 0.075, agresivo: 0.10 },
}

// ---------- §3.9 Recomposición (déficit leve sobre TDEE) por banda de grasa ----------
export const RECOMPOSICION: Record<BandaGrasa, number> = {
  muy_alto: 0.10,
  alto: 0.10,
  medio: 0.075,
  bajo: 0.05,
  muy_bajo: 0.0,
}

// ---------- §3.10 Proteína (g/kg de `base`) ----------
export const PROTEINA_GKG: Record<Perfil, Record<ObjetivoEfectivo, number>> = {
  sedentario: { perder: 1.5, recomposicion: 1.5, mantener: 1.2, ganar: 1.4 },
  cardio: { perder: 1.8, recomposicion: 1.8, mantener: 1.6, ganar: 1.6 },
  fuerza: { perder: 2.2, recomposicion: 2.0, mantener: 1.7, ganar: 1.8 },
}

// ---------- §3.11 Grasa (% kcal objetivo) ----------
export const GRASA_PCT_LOWCARB = 0.45
export const GRASA_PCT_PERDER_AGRESIVO = 0.25
export const GRASA_PCT_PERDER = 0.28
export const GRASA_PCT_RECOMPOSICION = 0.28
/** Recomposición con prioridad `perder`: +5 puntos de grasa a costa de los hidratos (v1.1). */
export const GRASA_PCT_RECOMPOSICION_PERDER = 0.33
export const GRASA_PCT_MANTENER = 0.32
export const GRASA_PCT_GANAR = 0.27

// ---------- §3.13 Reparto de kcal por número de comidas ----------
/** Horas nominales fijas por nombre de comida. No dependen del usuario ni entran en ningún cálculo. */
export const HORAS_COMIDA: Record<string, string> = {
  Desayuno: '08:00',
  'Media mañana': '11:00',
  Comida: '14:00',
  Merienda: '17:30',
  Cena: '21:00',
  Recena: '23:00',
}

export interface PlantillaReparto {
  nombres: readonly string[]
  pct: readonly number[]
}

export const REPARTO: Record<NComidas, PlantillaReparto> = {
  2: { nombres: ['Comida', 'Cena'], pct: [45, 55] },
  3: { nombres: ['Desayuno', 'Comida', 'Cena'], pct: [30, 35, 35] },
  4: { nombres: ['Desayuno', 'Comida', 'Merienda', 'Cena'], pct: [25, 30, 15, 30] },
  5: { nombres: ['Desayuno', 'Media mañana', 'Comida', 'Merienda', 'Cena'], pct: [20, 10, 30, 10, 30] },
  6: {
    nombres: ['Desayuno', 'Media mañana', 'Comida', 'Merienda', 'Cena', 'Recena'],
    pct: [15, 10, 25, 10, 25, 15],
  },
}

// ---------- §3.14 Comida peri-entreno (índice, 0 = primera comida) ----------
export const PERI_INDICE: Record<NComidas, Record<Momento, number>> = {
  2: { manana: 0, mediodia: 0, tarde: 1, noche: 1 },
  3: { manana: 0, mediodia: 1, tarde: 2, noche: 2 },
  4: { manana: 0, mediodia: 1, tarde: 2, noche: 3 },
  5: { manana: 0, mediodia: 2, tarde: 3, noche: 4 },
  6: { manana: 0, mediodia: 2, tarde: 3, noche: 5 },
}

/** +5 puntos de HC a la comida peri-entreno, −5 a la mayor de las restantes (paso 16). */
export const PERI_PUNTOS_HC = 5

// ---------- §3.12 FFMI normalizado: cortes por sexo ----------
export const FFMI_CORTES_HOMBRE = [18, 20, 22, 25] as const
export const FFMI_CORTES_MUJER = [15, 17, 19, 22] as const
export const FFMI_REF_ALTURA_HOMBRE = 1.80
export const FFMI_REF_ALTURA_MUJER = 1.70
export const FFMI_CONSTANTE_KOURI = 6.3

// ---------- Paso 2: bandas de grasa ----------
export const BANDA_CORTES_HOMBRE = [12, 15, 20, 25] as const
export const BANDA_CORTES_MUJER = [20, 23, 28, 32] as const
/** Clamp fisiológico del %grasa con el que se calcula. */
export const GRASA_CLAMP_HOMBRE: readonly [number, number] = [4, 60]
export const GRASA_CLAMP_MUJER: readonly [number, number] = [10, 60]
/** Clamp del rango y de los estimadores publicados. */
export const GRASA_RANGO_MIN = 3
export const GRASA_RANGO_MAX = 65
export const GRASA_REFERENCIA_CLAMP: readonly [number, number] = [3, 60]

// ---------- Paso 13: %grasa objetivo y ensanche del rango ----------
export const GRASA_OBJETIVO_HOMBRE: readonly [number, number, number] = [15, 12, 17]
export const GRASA_OBJETIVO_MUJER: readonly [number, number, number] = [23, 20, 25]
export const GRASA_OBJETIVO_HOMBRE_65: readonly [number, number, number] = [18, 15, 20]
export const GRASA_OBJETIVO_MUJER_65: readonly [number, number, number] = [26, 23, 28]
/** %grasa mínimo saludable para fijar un peso objetivo (= límite superior de la banda `muy_bajo`). */
export const GRASA_MIN_OBJETIVO_HOMBRE = 12
export const GRASA_MIN_OBJETIVO_MUJER = 20
/** Puntos de %grasa del ensanche `w` según la fiabilidad de la estimación. */
export const ENSANCHE_POR_FIABILIDAD: Record<'alta' | 'media' | 'baja', number> = { alta: 2, media: 4, baja: 5 }
/** ± mostrado en pantalla según la prioridad de método del paso 2. */
export const MARGEN_POR_METODO = { conocido_fiable: 2, conocido_estimado: 4, medidas: 4, visual: 5, cunbae: 5 }

// ---------- Paso 14: adaptación metabólica y diet breaks ----------
export const ADAPTACION_PENDIENTE = 0.25
export const ADAPTACION_SEMANAS_REFERENCIA = 26
export const ADAPTACION_TOPE = 2
export const DIET_BREAK_CADA = 8
export const DIET_BREAK_UMBRAL_SEMANAS = 10
export const PRECISION_MES_UMBRAL_SEMANAS = 16
export const CRONOGRAMA_LARGO_SEMANAS = 52
export const CRONOGRAMA_DELTA_KG_MIN = 0.5
export const CRONOGRAMA_DELTA_KCAL_MIN = 50
export const CRONOGRAMA_RITMO_MIN = 0.05

// ---------- Paso 17: umbrales de avisos finales ----------
export const IMC_MUSCULADO_FFMI_HOMBRE = 22
export const IMC_MUSCULADO_FFMI_MUJER = 19
export const ALTO_RENDIMIENTO_HORAS = 10
export const MICRONUTRIENTES_KCAL_HOMBRE = 1800
export const MICRONUTRIENTES_KCAL_MUJER = 1500
export const PROTEINA_TOMA_MIN_G = 20
export const PROTEINA_TOMA_PCT_MIN = 20
export const PROTEINA_TOMA_ALTA_GKG = 0.55

// ---------- Paso 13: fórmulas clásicas (solo informativas) ----------
export const CLASICAS_ALTURA_MIN = 150
export const CLASICAS_ALTURA_MAX = 200
export const CM_POR_PULGADA = 2.54
