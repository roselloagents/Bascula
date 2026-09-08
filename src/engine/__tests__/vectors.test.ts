// Vectores de prueba normativos de docs/SPEC-calculo.md §5 (los diecinueve casos), más las
// exclusiones del paso 0, la validación de la §1 y los casos borde de las tablas 3.x.
//
// Convención de la §5: los intermedios se comparan con tolerancia ±0,15 (la spec la fija así
// explícitamente: con ±0,1 los valores que caen justo en el medio unidad quedaban en el borde
// exacto de la tolerancia) y las salidas redondeadas con igualdad exacta. Los avisos se comparan
// como conjunto, ya aplicadas las reglas de supresión.

import { describe, expect, it } from 'vitest'
import { calcular, textoError, textosAvisos } from '../index'
import type {
  BandaGrasa,
  BmrEcuacion,
  Fiabilidad,
  ImcCategoria,
  Inputs,
  InputEntrenamiento,
  MetodoGrasa,
  MetodoPesoObjetivo,
  Objetivo,
  ObjetivoEfectivo,
  Perfil,
  PrecisionFecha,
  Ritmo,
  Somatotipo,
  BaseProteina,
  FfmiCategoria,
} from '../types'

// ---------------------------------------------------------------- utilidades

const TOL = 0.15

function cerca(actual: number, esperado: number, etiqueta: string, tol = TOL): void {
  expect(
    Math.abs(actual - esperado) <= tol,
    `${etiqueta}: ${actual} no está a ±${tol} de ${esperado}`,
  ).toBe(true)
}

const FECHA = '2026-09-07'

const BASE = {
  clima_caluroso: false,
  embarazo_lactancia: false,
  condiciones: [],
  fecha_inicio: FECHA,
  peso_objetivo: null,
  somatotipo: null,
  ritmo: 'moderado',
  preferencia: 'omnivoro',
  cribado_tca: null,
} satisfies Partial<Inputs>

const ent = (o: Partial<InputEntrenamiento> = {}): InputEntrenamiento => ({
  tipo: 'ninguno',
  dias_semana: 0,
  minutos_sesion: 0,
  intensidad: 'media',
  experiencia: 'novato',
  momento: null,
  ...o,
})

// ---------------------------------------------------------------- forma de un vector

interface FilaComida {
  nombre: string
  hora: string
  pct: number
  p: number
  g: number
  hc: number
  kcal: number
  peri: boolean
}

interface Vector {
  n: string
  titulo: string
  inputs: Inputs
  imc: number
  imc_categoria: ImcCategoria
  grasa: {
    pct: number
    margen: number
    cunbae: number
    deurenberg: number
    navy?: number
    fiabilidad: Fiabilidad
    metodo_efectivo: MetodoGrasa
    banda: BandaGrasa
  }
  mlg: number
  bmr: { valor: number; ecuacion: BmrEcuacion; mifflin: number; katch: number; harris: number }
  tdee: {
    valor: number
    bruto: number
    pal: number
    ejercicio_dia: number
    perfil: Perfil
    kcal_sesion: number
  }
  objetivo_efectivo: ObjetivoEfectivo
  ritmo_efectivo: Ritmo
  kcal: number
  kcal_cierre: number
  macros: {
    p: number
    g: number
    hc: number
    fibra: number
    azucares: number
    base_kg: number
    base_proteina: BaseProteina
    somatotipo: Somatotipo
  }
  agua: { ml: number; rango: [number, number]; vasos: number } | null
  peso_objetivo: {
    metodo: MetodoPesoObjetivo
    sugerido: number
    rango: [number, number]
    mostrar_central: boolean
    efectivo: number | null
    hito: number | null
    imc22: number
    rango_imc: [number, number]
    clasicas: { devine: number; robinson: number; miller: number; hamwi: number } | null
  }
  cronograma: {
    ritmo_kg_sem: number
    ritmo_pct_sem: number
    delta_kg: number
    semanas: [number, number]
    diet_breaks: number
    fecha_min: string
    fecha_max: string
    precision_fecha: PrecisionFecha
    tramo_12sem: [number, number] | null
  } | null
  ffmi: { valor: number; normalizado: number; categoria: FfmiCategoria | null }
  comidas: FilaComida[]
  avisos: string[]
}

// ---------------------------------------------------------------- los diecinueve vectores

const VECTORES: Vector[] = [
  {
    n: '1',
    titulo: 'Hombre 32 años, sobrepeso ligero, entrena fuerza, pierde grasa, sin peso objetivo',
    inputs: {
      ...BASE,
      sexo: 'hombre',
      edad: 32,
      altura_cm: 178,
      peso_kg: 84,
      grasa: { metodo: 'desconocido' },
      somatotipo: { q1: 'media', q2: 'moderada', q3: 'moderada', q4: 'atletico' },
      actividad_diaria: 'ligero',
      entrenamiento: ent({ tipo: 'fuerza', dias_semana: 4, minutos_sesion: 60, intensidad: 'media', experiencia: 'intermedio', momento: 'tarde' }),
      objetivo: 'perder',
      ritmo: 'moderado',
      n_comidas: 4,
    },
    imc: 26.5,
    imc_categoria: 'sobrepeso',
    grasa: { pct: 24.7, margen: 5, cunbae: 24.7, deurenberg: 23.0, fiabilidad: 'baja', metodo_efectivo: 'desconocido', banda: 'alto' },
    mlg: 63.27,
    bmr: { valor: 1797.5, ecuacion: 'mifflin', mifflin: 1797.5, katch: 1736.5, harris: 1886.3 },
    tdee: { valor: 2743.8, bruto: 2888.3, pal: 1.5, ejercicio_dia: 192.0, perfil: 'fuerza', kcal_sesion: 336.0 },
    objetivo_efectivo: 'perder',
    ritmo_efectivo: 'moderado',
    kcal: 2190,
    kcal_cierre: 2190,
    macros: { p: 185, g: 70, hc: 205, fibra: 31, azucares: 54.8, base_kg: 84.0, base_proteina: 'peso_corporal', somatotipo: 'mesomorfo' },
    agua: { ml: 3250, rango: [3000, 3500], vasos: 13 },
    peso_objetivo: {
      metodo: 'grasa', sugerido: 74.5, rango: [68.5, 80.0], mostrar_central: false, efectivo: 74.5, hito: null,
      imc22: 69.7, rango_imc: [63.4, 78.9],
      clasicas: { devine: 73.2, robinson: 71.1, miller: 70.4, hamwi: 75.2 },
    },
    cronograma: { ritmo_kg_sem: 0.503, ritmo_pct_sem: 0.60, delta_kg: 9.5, semanas: [21, 25], diet_breaks: 2, fecha_min: '2027-02-01', fecha_max: '2027-03-01', precision_fecha: 'mes', tramo_12sem: [5.0, 6.0] },
    ffmi: { valor: 20.0, normalizado: 20.1, categoria: null },
    comidas: [
      { nombre: 'Desayuno', hora: '08:00', pct: 25, p: 45, g: 20, hc: 50, kcal: 560, peri: false },
      { nombre: 'Comida', hora: '14:00', pct: 30, p: 55, g: 20, hc: 55, kcal: 620, peri: false },
      { nombre: 'Merienda', hora: '17:30', pct: 15, p: 30, g: 10, hc: 40, kcal: 370, peri: true },
      { nombre: 'Cena', hora: '21:00', pct: 30, p: 55, g: 20, hc: 60, kcal: 640, peri: false },
    ],
    avisos: ['INFO_ADAPTACION', 'INFO_BMR_ATLETA', 'INFO_GRASA_ESTIMADA', 'WARN_PROTEINA_TOMA_ALTA'],
  },

  {
    n: '2',
    titulo: 'Mujer 28 años, medidas US Navy, recomposición, vegetariana, cribado TCA',
    inputs: {
      ...BASE,
      sexo: 'mujer',
      edad: 28,
      altura_cm: 165,
      peso_kg: 60,
      grasa: { metodo: 'medidas', cuello_cm: 32, cintura_cm: 72, cadera_cm: 96 },
      somatotipo: { q1: 'fina', q2: 'poca', q3: 'moderada', q4: 'delgado' },
      actividad_diaria: 'sedentario',
      entrenamiento: ent({ tipo: 'cardio', dias_semana: 3, minutos_sesion: 45, intensidad: 'media', experiencia: 'novato', momento: 'manana' }),
      objetivo: 'recomposicion',
      ritmo: 'moderado',
      preferencia: 'vegetariano',
      n_comidas: 3,
      condiciones: ['tca'],
    },
    imc: 22.0,
    imc_categoria: 'normal',
    grasa: { pct: 26.4, margen: 4, cunbae: 29.1, deurenberg: 27.5, navy: 26.4, fiabilidad: 'media', metodo_efectivo: 'medidas', banda: 'medio' },
    mlg: 44.16,
    bmr: { valor: 1330.25, ecuacion: 'mifflin', mifflin: 1330.25, katch: 1323.8, harris: 1392.3 },
    tdee: { valor: 1879.2, bruto: 1978.1, pal: 1.4, ejercicio_dia: 115.7, perfil: 'cardio', kcal_sesion: 270.0 },
    objetivo_efectivo: 'recomposicion',
    ritmo_efectivo: 'suave',
    kcal: 1740,
    kcal_cierre: 1750,
    macros: { p: 120, g: 50, hc: 205, fibra: 25, azucares: 43.5, base_kg: 60.0, base_proteina: 'peso_corporal', somatotipo: 'ectomorfo' },
    agua: { ml: 2150, rango: [1900, 2400], vasos: 9 },
    // v1.2: recomposición con déficit real (1 879,2 − 1 740 = 139,2 ≥ 50), así que la meta se
    // calcula como en `perder`. Hasta la v1.1: método `actual`, sugerido 60,0 y efectivo `null`.
    peso_objetivo: {
      metodo: 'grasa', sugerido: 57.5, rango: [53.0, 61.0], mostrar_central: true, efectivo: 57.5, hito: null,
      imc22: 59.9, rango_imc: [54.4, 67.8],
      clasicas: { devine: 56.9, robinson: 57.4, miller: 59.8, hamwi: 56.4 },
    },
    cronograma: null,
    ffmi: { valor: 16.2, normalizado: 16.5, categoria: 'medio' },
    comidas: [
      { nombre: 'Desayuno', hora: '08:00', pct: 30, p: 35, g: 15, hc: 70, kcal: 555, peri: true },
      { nombre: 'Comida', hora: '14:00', pct: 35, p: 45, g: 15, hc: 65, kcal: 575, peri: false },
      { nombre: 'Cena', hora: '21:00', pct: 35, p: 40, g: 20, hc: 70, kcal: 620, peri: false },
    ],
    avisos: ['INFO_RITMO_SUAVE', 'INFO_SOMATOTIPO', 'WARN_PROTEINA_TOMA_ALTA', 'WARN_RECOMPOSICION_SIN_FUERZA'],
  },

  {
    n: '3',
    titulo: 'Hombre 45 años, obesidad grado II, sedentario, ritmo agresivo, peso objetivo 85 kg',
    inputs: {
      ...BASE,
      sexo: 'hombre',
      edad: 45,
      altura_cm: 172,
      peso_kg: 105,
      grasa: { metodo: 'desconocido' },
      somatotipo: { q1: 'ancha', q2: 'mucha', q3: 'moderada', q4: 'robusto' },
      actividad_diaria: 'sedentario',
      entrenamiento: ent(),
      objetivo: 'perder',
      ritmo: 'agresivo',
      peso_objetivo: 85,
      n_comidas: 3,
    },
    imc: 35.5,
    imc_categoria: 'obesidad_II',
    grasa: { pct: 37.4, margen: 5, cunbae: 37.4, deurenberg: 36.7, fiabilidad: 'baja', metodo_efectivo: 'desconocido', banda: 'muy_alto' },
    mlg: 65.69,
    bmr: { valor: 1905.0, ecuacion: 'mifflin', mifflin: 1905.0, katch: 1788.9, harris: 2065.0 },
    tdee: { valor: 2533.7, bruto: 2667.0, pal: 1.4, ejercicio_dia: 0, perfil: 'sedentario', kcal_sesion: 0 },
    objetivo_efectivo: 'perder',
    ritmo_efectivo: 'agresivo',
    kcal: 1910,
    kcal_cierre: 1920,
    macros: { p: 160, g: 80, hc: 140, fibra: 27, azucares: 47.8, base_kg: 92.81, base_proteina: 'peso_ajustado', somatotipo: 'endomorfo' },
    agua: { ml: 3150, rango: [2900, 3400], vasos: 13 },
    peso_objetivo: {
      metodo: 'grasa', sugerido: 77.5, rango: [71.0, 83.0], mostrar_central: false, efectivo: 85.0, hito: 94.5,
      imc22: 65.1, rango_imc: [59.2, 73.7],
      clasicas: { devine: 67.7, robinson: 66.7, miller: 67.1, hamwi: 68.8 },
    },
    cronograma: { ritmo_kg_sem: 0.567, ritmo_pct_sem: 0.54, delta_kg: 20.0, semanas: [40, 52], diet_breaks: 4, fecha_min: '2027-06-14', fecha_max: '2027-09-06', precision_fecha: 'mes', tramo_12sem: [5.0, 7.0] },
    ffmi: { valor: 22.2, normalizado: 22.7, categoria: null },
    comidas: [
      { nombre: 'Desayuno', hora: '08:00', pct: 30, p: 50, g: 25, hc: 40, kcal: 585, peri: false },
      { nombre: 'Comida', hora: '14:00', pct: 35, p: 55, g: 25, hc: 50, kcal: 645, peri: false },
      { nombre: 'Cena', hora: '21:00', pct: 35, p: 55, g: 30, hc: 50, kcal: 690, peri: false },
    ],
    avisos: ['INFO_ADAPTACION', 'INFO_DEFICIT_CAPADO_TDEE', 'INFO_GRASA_ESTIMADA', 'INFO_SOMATOTIPO', 'WARN_IMC_35', 'WARN_SUELO_CALORICO_BMR'],
  },

  {
    n: '4',
    titulo: 'Mujer 52 años, obesidad grado I, estimación visual, objetivo "no lo sé", diabetes, 5 comidas',
    inputs: {
      ...BASE,
      sexo: 'mujer',
      edad: 52,
      altura_cm: 160,
      peso_kg: 82,
      grasa: { metodo: 'visual', categoria: 'sobrepeso_visible' },
      somatotipo: null,
      actividad_diaria: 'moderado',
      entrenamiento: ent({ tipo: 'mixto', dias_semana: 2, minutos_sesion: 45, intensidad: 'baja', experiencia: 'novato', momento: 'mediodia' }),
      objetivo: 'no_se',
      ritmo: 'suave',
      preferencia: 'sin_lactosa',
      n_comidas: 5,
      condiciones: ['diabetes'],
    },
    imc: 32.0,
    imc_categoria: 'obesidad_I',
    grasa: { pct: 35.0, margen: 5, cunbae: 45.3, deurenberg: 45.0, fiabilidad: 'baja', metodo_efectivo: 'visual', banda: 'muy_alto' },
    mlg: 53.30,
    bmr: { valor: 1399.0, ecuacion: 'mifflin', mifflin: 1399.0, katch: 1521.3, harris: 1476.4 },
    tdee: { valor: 2176.6, bruto: 2291.1, pal: 1.6, ejercicio_dia: 52.7, perfil: 'fuerza', kcal_sesion: 184.5 },
    objetivo_efectivo: 'perder',
    ritmo_efectivo: 'suave',
    kcal: 1730,
    kcal_cierre: 1725,
    macros: { p: 135, g: 65, hc: 150, fibra: 24, azucares: 43.3, base_kg: 78.10, base_proteina: 'peso_ajustado', somatotipo: 'mesomorfo' },
    agua: { ml: 2800, rango: [2550, 3050], vasos: 11 },
    peso_objetivo: {
      metodo: 'grasa', sugerido: 69.0, rango: [63.5, 74.5], mostrar_central: false, efectivo: 69.0, hito: 74.0,
      imc22: 56.3, rango_imc: [51.2, 63.7],
      clasicas: { devine: 52.4, robinson: 54.1, miller: 57.2, hamwi: 52.1 },
    },
    cronograma: { ritmo_kg_sem: 0.406, ritmo_pct_sem: 0.50, delta_kg: 13.0, semanas: [37, 46], diet_breaks: 4, fecha_min: '2027-05-24', fecha_max: '2027-07-26', precision_fecha: 'mes', tramo_12sem: [3.5, 5.0] },
    ffmi: { valor: 20.8, normalizado: 21.5, categoria: null },
    comidas: [
      { nombre: 'Desayuno', hora: '08:00', pct: 20, p: 25, g: 15, hc: 30, kcal: 355, peri: false },
      { nombre: 'Media mañana', hora: '11:00', pct: 10, p: 15, g: 5, hc: 15, kcal: 165, peri: false },
      { nombre: 'Comida', hora: '14:00', pct: 30, p: 40, g: 20, hc: 50, kcal: 540, peri: true },
      { nombre: 'Merienda', hora: '17:30', pct: 10, p: 15, g: 5, hc: 15, kcal: 165, peri: false },
      { nombre: 'Cena', hora: '21:00', pct: 30, p: 40, g: 20, hc: 40, kcal: 500, peri: false },
    ],
    avisos: ['INFO_ADAPTACION', 'INFO_FIBRA_AJUSTADA', 'INFO_GRASA_ESTIMADA', 'INFO_OBJETIVO_RESUELTO', 'WARN_DIABETES'],
  },

  {
    n: '5',
    titulo: 'Hombre 68 años, %grasa fiable (Katch-McArdle), mantenimiento, fuerza ligera',
    inputs: {
      ...BASE,
      sexo: 'hombre',
      edad: 68,
      altura_cm: 175,
      peso_kg: 78,
      grasa: { metodo: 'conocido', valor: 24, fuente: 'fiable' },
      somatotipo: { q1: 'media', q2: 'moderada', q3: 'mucha', q4: 'atletico' },
      actividad_diaria: 'ligero',
      entrenamiento: ent({ tipo: 'fuerza', dias_semana: 3, minutos_sesion: 45, intensidad: 'baja', experiencia: 'novato', momento: 'manana' }),
      objetivo: 'mantener',
      n_comidas: 3,
    },
    imc: 25.5,
    imc_categoria: 'sobrepeso',
    grasa: { pct: 24.0, margen: 2, cunbae: 27.8, deurenberg: 30.0, fiabilidad: 'alta', metodo_efectivo: 'conocido', banda: 'alto' },
    mlg: 59.28,
    bmr: { valor: 1650.4, ecuacion: 'katch_mcardle', mifflin: 1538.8, katch: 1650.4, harris: 1587.1 },
    tdee: { valor: 2411.4, bruto: 2538.4, pal: 1.5, ejercicio_dia: 62.7, perfil: 'fuerza', kcal_sesion: 146.3 },
    objetivo_efectivo: 'mantener',
    ritmo_efectivo: 'moderado',
    kcal: 2410,
    kcal_cierre: 2405,
    macros: { p: 150, g: 85, hc: 260, fibra: 34, azucares: 60.3, base_kg: 78.0, base_proteina: 'peso_corporal', somatotipo: 'mesomorfo' },
    agua: { ml: 2750, rango: [2500, 3000], vasos: 11 },
    peso_objetivo: {
      metodo: 'actual', sugerido: 78.0, rango: [68.5, 78.0], mostrar_central: true, efectivo: null, hito: null,
      imc22: 67.4, rango_imc: [61.2, 76.3],
      clasicas: { devine: 70.5, robinson: 68.9, miller: 68.7, hamwi: 72.0 },
    },
    cronograma: null,
    ffmi: { valor: 19.4, normalizado: 19.7, categoria: null },
    comidas: [
      { nombre: 'Desayuno', hora: '08:00', pct: 30, p: 45, g: 25, hc: 90, kcal: 765, peri: true },
      { nombre: 'Comida', hora: '14:00', pct: 35, p: 50, g: 30, hc: 80, kcal: 790, peri: false },
      { nombre: 'Cena', hora: '21:00', pct: 35, p: 55, g: 30, hc: 90, kcal: 850, peri: false },
    ],
    avisos: ['INFO_AGUA_MAYORES', 'INFO_MAYOR_60', 'INFO_PROYECCION_PLANA', 'INFO_SIN_CRONOGRAMA', 'WARN_PROTEINA_TOMA_ALTA'],
  },

  {
    n: '6',
    titulo: 'Mujer 35 años, delgada, %grasa estimado, gana músculo, peso objetivo 60 kg',
    inputs: {
      ...BASE,
      sexo: 'mujer',
      edad: 35,
      altura_cm: 170,
      peso_kg: 56,
      grasa: { metodo: 'conocido', valor: 21, fuente: 'estimado' },
      somatotipo: { q1: 'fina', q2: 'poca', q3: 'poca', q4: 'delgado' },
      actividad_diaria: 'sedentario',
      entrenamiento: ent({ tipo: 'fuerza', dias_semana: 3, minutos_sesion: 60, intensidad: 'media', experiencia: 'novato', momento: 'tarde' }),
      objetivo: 'ganar',
      ritmo: 'moderado',
      peso_objetivo: 60,
      n_comidas: 4,
    },
    imc: 19.4,
    imc_categoria: 'normal',
    grasa: { pct: 21.0, margen: 4, cunbae: 25.8, deurenberg: 25.9, fiabilidad: 'media', metodo_efectivo: 'conocido', banda: 'bajo' },
    mlg: 44.24,
    bmr: { valor: 1286.5, ecuacion: 'mifflin', mifflin: 1286.5, katch: 1325.6, harris: 1340.5 },
    tdee: { valor: 1802.2, bruto: 1897.1, pal: 1.4, ejercicio_dia: 96.0, perfil: 'fuerza', kcal_sesion: 224.0 },
    objetivo_efectivo: 'ganar',
    ritmo_efectivo: 'moderado',
    kcal: 2070,
    kcal_cierre: 2070,
    macros: { p: 100, g: 50, hc: 305, fibra: 29, azucares: 51.8, base_kg: 56.0, base_proteina: 'peso_corporal', somatotipo: 'ectomorfo' },
    agua: { ml: 2050, rango: [1800, 2300], vasos: 8 },
    peso_objetivo: {
      metodo: 'ritmo_16_semanas', sugerido: 60.0, rango: [59.0, 61.0], mostrar_central: true, efectivo: 60.0, hito: null,
      imc22: 63.6, rango_imc: [57.8, 72.0],
      clasicas: { devine: 61.4, robinson: 60.8, miller: 62.5, hamwi: 60.7 },
    },
    cronograma: { ritmo_kg_sem: 0.243, ritmo_pct_sem: 0.43, delta_kg: 4.0, semanas: [17, 20], diet_breaks: 0, fecha_min: '2027-01-04', fecha_max: '2027-01-25', precision_fecha: 'mes', tramo_12sem: [2.5, 3.0] },
    ffmi: { valor: 15.3, normalizado: 15.3, categoria: 'medio' },
    comidas: [
      { nombre: 'Desayuno', hora: '08:00', pct: 25, p: 25, g: 15, hc: 75, kcal: 535, peri: false },
      { nombre: 'Comida', hora: '14:00', pct: 30, p: 30, g: 10, hc: 80, kcal: 530, peri: false },
      { nombre: 'Merienda', hora: '17:30', pct: 15, p: 15, g: 10, hc: 60, kcal: 390, peri: true },
      { nombre: 'Cena', hora: '21:00', pct: 30, p: 30, g: 15, hc: 90, kcal: 615, peri: false },
    ],
    avisos: ['INFO_ADAPTACION', 'INFO_SOMATOTIPO'],
  },

  {
    n: '7',
    titulo: 'Hombre 40 años, trabajo físico, low-carb, endomorfo, clima caluroso, peso objetivo 80 kg',
    inputs: {
      ...BASE,
      sexo: 'hombre',
      edad: 40,
      altura_cm: 180,
      peso_kg: 92,
      grasa: { metodo: 'desconocido' },
      somatotipo: { q1: 'ancha', q2: 'mucha', q3: 'moderada', q4: 'robusto' },
      actividad_diaria: 'alto',
      entrenamiento: ent({ tipo: 'cardio', dias_semana: 2, minutos_sesion: 40, intensidad: 'media', experiencia: 'intermedio', momento: 'noche' }),
      objetivo: 'perder',
      ritmo: 'moderado',
      peso_objetivo: 80,
      preferencia: 'low_carb',
      n_comidas: 3,
      clima_caluroso: true,
    },
    imc: 28.4,
    imc_categoria: 'sobrepeso',
    grasa: { pct: 28.3, margen: 5, cunbae: 28.3, deurenberg: 27.1, fiabilidad: 'baja', metodo_efectivo: 'desconocido', banda: 'muy_alto' },
    mlg: 65.97,
    bmr: { valor: 1850.0, ecuacion: 'mifflin', mifflin: 1850.0, katch: 1794.9, harris: 1957.6 },
    tdee: { valor: 3175.5, bruto: 3342.6, pal: 1.75, ejercicio_dia: 105.1, perfil: 'cardio', kcal_sesion: 368.0 },
    objetivo_efectivo: 'perder',
    ritmo_efectivo: 'moderado',
    kcal: 2420,
    kcal_cierre: 2420,
    macros: { p: 165, g: 120, hc: 170, fibra: 34, azucares: 60.5, base_kg: 92.0, base_proteina: 'peso_corporal', somatotipo: 'endomorfo' },
    agua: { ml: 3700, rango: [3450, 3950], vasos: 15 },
    peso_objetivo: {
      metodo: 'grasa', sugerido: 77.5, rango: [71.5, 83.5], mostrar_central: false, efectivo: 80.0, hito: null,
      imc22: 71.3, rango_imc: [64.8, 80.7],
      clasicas: { devine: 75.0, robinson: 72.6, miller: 71.5, hamwi: 77.3 },
    },
    cronograma: { ritmo_kg_sem: 0.687, ritmo_pct_sem: 0.75, delta_kg: 12.0, semanas: [20, 23], diet_breaks: 2, fecha_min: '2027-01-25', fecha_max: '2027-02-15', precision_fecha: 'mes', tramo_12sem: [7.0, 8.0] },
    ffmi: { valor: 20.4, normalizado: 20.4, categoria: null },
    comidas: [
      { nombre: 'Desayuno', hora: '08:00', pct: 30, p: 50, g: 35, hc: 50, kcal: 715, peri: false },
      { nombre: 'Comida', hora: '14:00', pct: 35, p: 55, g: 45, hc: 50, kcal: 825, peri: false },
      { nombre: 'Cena', hora: '21:00', pct: 35, p: 60, g: 40, hc: 70, kcal: 880, peri: true },
    ],
    avisos: ['INFO_ADAPTACION', 'INFO_GRASA_ESTIMADA', 'WARN_AGUA_ALTA', 'WARN_PROTEINA_TOMA_ALTA'],
  },

  {
    n: '8',
    titulo: 'Mujer 29 años, sedentaria, ritmo agresivo, vegana, peso objetivo irreal (48 kg), 2 comidas',
    inputs: {
      ...BASE,
      sexo: 'mujer',
      edad: 29,
      altura_cm: 162,
      peso_kg: 66,
      grasa: { metodo: 'visual', categoria: 'media' },
      somatotipo: { q1: 'media', q2: 'moderada', q3: 'moderada', q4: 'atletico' },
      actividad_diaria: 'sedentario',
      entrenamiento: ent(),
      objetivo: 'perder',
      ritmo: 'agresivo',
      peso_objetivo: 48,
      preferencia: 'vegano',
      n_comidas: 2,
    },
    imc: 25.1,
    imc_categoria: 'sobrepeso',
    grasa: { pct: 28.0, margen: 5, cunbae: 34.3, deurenberg: 31.4, fiabilidad: 'baja', metodo_efectivo: 'visual', banda: 'alto' },
    mlg: 47.52,
    bmr: { valor: 1366.5, ecuacion: 'mifflin', mifflin: 1366.5, katch: 1396.4, harris: 1434.2 },
    tdee: { valor: 1817.4, bruto: 1913.1, pal: 1.4, ejercicio_dia: 0, perfil: 'sedentario', kcal_sesion: 0 },
    objetivo_efectivo: 'perder',
    ritmo_efectivo: 'agresivo',
    kcal: 1430,
    kcal_cierre: 1435,
    macros: { p: 100, g: 55, hc: 135, fibra: 20, azucares: 35.8, base_kg: 66.0, base_proteina: 'peso_corporal', somatotipo: 'mesomorfo' },
    agua: { ml: 2000, rango: [1750, 2250], vasos: 8 },
    peso_objetivo: {
      metodo: 'grasa', sugerido: 61.5, rango: [56.5, 66.5], mostrar_central: false, efectivo: 59.5, hito: null,
      imc22: 57.7, rango_imc: [52.5, 65.3],
      clasicas: { devine: 54.2, robinson: 55.4, miller: 58.2, hamwi: 53.8 },
    },
    cronograma: { ritmo_kg_sem: 0.352, ritmo_pct_sem: 0.53, delta_kg: 6.5, semanas: [21, 24], diet_breaks: 2, fecha_min: '2027-02-01', fecha_max: '2027-02-22', precision_fecha: 'mes', tramo_12sem: [3.5, 4.0] },
    ffmi: { valor: 18.1, normalizado: 18.6, categoria: null },
    comidas: [
      { nombre: 'Comida', hora: '14:00', pct: 45, p: 45, g: 25, hc: 60, kcal: 645, peri: false },
      { nombre: 'Cena', hora: '21:00', pct: 55, p: 55, g: 30, hc: 75, kcal: 790, peri: false },
    ],
    avisos: [
      'INFO_ADAPTACION', 'INFO_DEFICIT_CAPADO_TDEE', 'INFO_FIBRA_AJUSTADA', 'INFO_GRASA_ESTIMADA',
      'INFO_MICRONUTRIENTES', 'INFO_PROTEINA_CAPADA', 'INFO_VEGANO', 'WARN_OBJETIVO_GRASA_MUY_BAJA',
      'WARN_OBJETIVO_IMC_BAJO', 'WARN_PROTEINA_TOMA_ALTA', 'WARN_SUELO_CALORICO_EA',
    ],
  },

  {
    n: '9',
    titulo: 'Hombre 25 años, ectomorfo, fuerza 5 días, volumen agresivo, 6 comidas',
    inputs: {
      ...BASE,
      sexo: 'hombre',
      edad: 25,
      altura_cm: 185,
      peso_kg: 70,
      grasa: { metodo: 'desconocido' },
      somatotipo: { q1: 'fina', q2: 'poca', q3: 'poca', q4: 'delgado' },
      actividad_diaria: 'sedentario',
      entrenamiento: ent({ tipo: 'fuerza', dias_semana: 5, minutos_sesion: 75, intensidad: 'alta', experiencia: 'novato', momento: 'noche' }),
      objetivo: 'ganar',
      ritmo: 'agresivo',
      n_comidas: 6,
    },
    imc: 20.5,
    imc_categoria: 'normal',
    grasa: { pct: 13.6, margen: 5, cunbae: 13.6, deurenberg: 14.1, fiabilidad: 'baja', metodo_efectivo: 'desconocido', banda: 'bajo' },
    mlg: 60.51,
    bmr: { valor: 1736.25, ecuacion: 'mifflin', mifflin: 1736.25, katch: 1677.0, harris: 1772.0 },
    tdee: { valor: 2606.1, bruto: 2743.3, pal: 1.4, ejercicio_dia: 312.5, perfil: 'fuerza', kcal_sesion: 437.5 },
    objetivo_efectivo: 'ganar',
    ritmo_efectivo: 'agresivo',
    kcal: 3110,
    kcal_cierre: 3110,
    macros: { p: 125, g: 70, hc: 495, fibra: 40, azucares: 77.8, base_kg: 70.0, base_proteina: 'peso_corporal', somatotipo: 'ectomorfo' },
    agua: { ml: 2900, rango: [2650, 3150], vasos: 12 },
    peso_objetivo: {
      metodo: 'ritmo_16_semanas', sugerido: 77.5, rango: [75.5, 79.0], mostrar_central: true, efectivo: 77.5, hito: null,
      imc22: 75.3, rango_imc: [68.5, 85.2],
      clasicas: { devine: 79.5, robinson: 76.4, miller: 74.3, hamwi: 82.7 },
    },
    cronograma: { ritmo_kg_sem: 0.458, ritmo_pct_sem: 0.65, delta_kg: 7.5, semanas: [17, 19], diet_breaks: 0, fecha_min: '2027-01-04', fecha_max: '2027-01-18', precision_fecha: 'mes', tramo_12sem: [4.5, 5.5] },
    ffmi: { valor: 17.7, normalizado: 17.4, categoria: 'bajo' },
    comidas: [
      { nombre: 'Desayuno', hora: '08:00', pct: 15, p: 20, g: 10, hc: 75, kcal: 470, peri: false },
      { nombre: 'Media mañana', hora: '11:00', pct: 10, p: 15, g: 5, hc: 50, kcal: 305, peri: false },
      { nombre: 'Comida', hora: '14:00', pct: 25, p: 25, g: 20, hc: 95, kcal: 660, peri: false },
      { nombre: 'Merienda', hora: '17:30', pct: 10, p: 15, g: 5, hc: 50, kcal: 305, peri: false },
      { nombre: 'Cena', hora: '21:00', pct: 25, p: 30, g: 20, hc: 125, kcal: 800, peri: false },
      { nombre: 'Recena', hora: '23:00', pct: 15, p: 20, g: 10, hc: 100, kcal: 570, peri: true },
    ],
    avisos: ['INFO_ADAPTACION', 'INFO_BMR_ATLETA', 'INFO_GRASA_ESTIMADA', 'INFO_SOMATOTIPO'],
  },

  {
    n: '10',
    titulo: 'Mujer 30 años, 150 cm, obesidad y ritmo agresivo — bucle de factibilidad del paso 10',
    inputs: {
      ...BASE,
      sexo: 'mujer',
      edad: 30,
      altura_cm: 150,
      peso_kg: 70,
      grasa: { metodo: 'visual', categoria: 'obesidad_visible' },
      somatotipo: null,
      actividad_diaria: 'sedentario',
      entrenamiento: ent(),
      objetivo: 'perder',
      ritmo: 'agresivo',
      n_comidas: 3,
    },
    imc: 31.1,
    imc_categoria: 'obesidad_I',
    grasa: { pct: 43.0, margen: 5, cunbae: 42.5, deurenberg: 38.8, fiabilidad: 'baja', metodo_efectivo: 'visual', banda: 'muy_alto' },
    mlg: 39.90,
    bmr: { valor: 1326.5, ecuacion: 'mifflin', mifflin: 1326.5, katch: 1231.8, harris: 1429.7 },
    tdee: { valor: 1764.2, bruto: 1857.1, pal: 1.4, ejercicio_dia: 0, perfil: 'sedentario', kcal_sesion: 0 },
    objetivo_efectivo: 'perder',
    ritmo_efectivo: 'agresivo',
    kcal: 1380,
    kcal_cierre: 1375,
    macros: { p: 85, g: 55, hc: 135, fibra: 20, azucares: 34.5, base_kg: 68.13, base_proteina: 'peso_ajustado', somatotipo: 'mesomorfo' },
    agua: { ml: 2100, rango: [1850, 2350], vasos: 8 },
    peso_objetivo: {
      metodo: 'grasa', sugerido: 52.0, rango: [47.5, 56.0], mostrar_central: false, efectivo: 52.0, hito: 63.0,
      imc22: 49.5, rango_imc: [45.0, 56.0],
      clasicas: { devine: 43.3, robinson: 47.4, miller: 51.8, hamwi: 43.4 },
    },
    cronograma: { ritmo_kg_sem: 0.349, ritmo_pct_sem: 0.50, delta_kg: 18.0, semanas: [58, 84], diet_breaks: 6, fecha_min: '2027-10-18', fecha_max: '2028-04-17', precision_fecha: 'mes', tramo_12sem: [3.0, 4.0] },
    ffmi: { valor: 17.7, normalizado: 19.0, categoria: null },
    comidas: [
      { nombre: 'Desayuno', hora: '08:00', pct: 30, p: 25, g: 15, hc: 40, kcal: 395, peri: false },
      { nombre: 'Comida', hora: '14:00', pct: 35, p: 30, g: 20, hc: 50, kcal: 500, peri: false },
      { nombre: 'Cena', hora: '21:00', pct: 35, p: 30, g: 20, hc: 45, kcal: 480, peri: false },
    ],
    avisos: [
      'INFO_ADAPTACION', 'INFO_DEFICIT_CAPADO_TDEE', 'INFO_FIBRA_AJUSTADA', 'INFO_GRASA_ESTIMADA',
      'INFO_MICRONUTRIENTES', 'WARN_CRONOGRAMA_LARGO', 'WARN_DEFICIT_INFACTIBLE',
      'WARN_OBJETIVO_MUY_LEJANO', 'WARN_SUELO_CALORICO_BMR',
    ],
  },

  {
    n: '11',
    titulo: 'Hombre 25 años, muy magro y muy pesado — suelo por encima del TDEE',
    inputs: {
      ...BASE,
      sexo: 'hombre',
      edad: 25,
      altura_cm: 195,
      peso_kg: 100,
      grasa: { metodo: 'conocido', valor: 8, fuente: 'fiable' },
      somatotipo: null,
      actividad_diaria: 'sedentario',
      entrenamiento: ent(),
      objetivo: 'perder',
      ritmo: 'moderado',
      n_comidas: 3,
    },
    imc: 26.3,
    imc_categoria: 'sobrepeso',
    grasa: { pct: 8.0, margen: 2, cunbae: 23.5, deurenberg: 21.1, fiabilidad: 'alta', metodo_efectivo: 'conocido', banda: 'muy_bajo' },
    mlg: 92.0,
    bmr: { valor: 2357.2, ecuacion: 'katch_mcardle', mifflin: 2098.8, katch: 2357.2, harris: 2221.9 },
    tdee: { valor: 3135.1, bruto: 3300.1, pal: 1.4, ejercicio_dia: 0, perfil: 'sedentario', kcal_sesion: 0 },
    objetivo_efectivo: 'mantener',
    ritmo_efectivo: 'moderado',
    kcal: 3140,
    kcal_cierre: 3150,
    macros: { p: 120, g: 110, hc: 420, fibra: 40, azucares: 78.5, base_kg: 100.0, base_proteina: 'peso_corporal', somatotipo: 'mesomorfo' },
    agua: { ml: 3000, rango: [2750, 3250], vasos: 12 },
    peso_objetivo: {
      metodo: 'actual', sugerido: 100.0, rango: [100.0, 113.0], mostrar_central: true, efectivo: null, hito: null,
      imc22: 83.7, rango_imc: [76.0, 94.7],
      clasicas: { devine: 88.6, robinson: 83.9, miller: 79.8, hamwi: 93.3 },
    },
    cronograma: null,
    ffmi: { valor: 24.2, normalizado: 23.2, categoria: 'muy_desarrollado' },
    comidas: [
      { nombre: 'Desayuno', hora: '08:00', pct: 30, p: 35, g: 35, hc: 125, kcal: 955, peri: false },
      { nombre: 'Comida', hora: '14:00', pct: 35, p: 45, g: 35, hc: 150, kcal: 1095, peri: false },
      { nombre: 'Cena', hora: '21:00', pct: 35, p: 40, g: 40, hc: 145, kcal: 1100, peri: false },
    ],
    avisos: ['INFO_IMC_MUSCULADO', 'INFO_PROYECCION_PLANA', 'INFO_SIN_CRONOGRAMA', 'WARN_SIN_MARGEN_DEFICIT'],
  },

  {
    n: '12',
    titulo: 'Hombre 35 años en el borde exacto de la banda medio — WARN_YA_EN_OBJETIVO',
    inputs: {
      ...BASE,
      sexo: 'hombre',
      edad: 35,
      altura_cm: 180,
      peso_kg: 80,
      grasa: { metodo: 'conocido', valor: 15, fuente: 'estimado' },
      somatotipo: null,
      actividad_diaria: 'ligero',
      entrenamiento: ent({ tipo: 'fuerza', dias_semana: 3, minutos_sesion: 60, intensidad: 'media', experiencia: 'intermedio', momento: 'tarde' }),
      objetivo: 'perder',
      ritmo: 'moderado',
      n_comidas: 4,
    },
    imc: 24.7,
    imc_categoria: 'normal',
    grasa: { pct: 15.0, margen: 4, cunbae: 22.3, deurenberg: 21.5, fiabilidad: 'media', metodo_efectivo: 'conocido', banda: 'medio' },
    mlg: 68.0,
    bmr: { valor: 1755.0, ecuacion: 'mifflin', mifflin: 1755.0, katch: 1838.8, harris: 1825.2 },
    tdee: { valor: 2631.2, bruto: 2769.6, pal: 1.5, ejercicio_dia: 137.1, perfil: 'fuerza', kcal_sesion: 320.0 },
    objetivo_efectivo: 'recomposicion',
    ritmo_efectivo: 'moderado',
    kcal: 2430,
    kcal_cierre: 2435,
    macros: { p: 160, g: 75, hc: 280, fibra: 34, azucares: 60.8, base_kg: 80.0, base_proteina: 'peso_corporal', somatotipo: 'mesomorfo' },
    agua: { ml: 2850, rango: [2600, 3100], vasos: 11 },
    peso_objetivo: {
      metodo: 'actual', sugerido: 80.0, rango: [74.0, 85.0], mostrar_central: true, efectivo: null, hito: null,
      imc22: 71.3, rango_imc: [64.8, 80.7],
      clasicas: { devine: 75.0, robinson: 72.6, miller: 71.5, hamwi: 77.3 },
    },
    cronograma: null,
    ffmi: { valor: 21.0, normalizado: 21.0, categoria: 'bueno' },
    comidas: [
      { nombre: 'Desayuno', hora: '08:00', pct: 25, p: 40, g: 20, hc: 70, kcal: 620, peri: false },
      { nombre: 'Comida', hora: '14:00', pct: 30, p: 45, g: 20, hc: 70, kcal: 640, peri: false },
      { nombre: 'Merienda', hora: '17:30', pct: 15, p: 25, g: 10, hc: 55, kcal: 410, peri: true },
      { nombre: 'Cena', hora: '21:00', pct: 30, p: 50, g: 25, hc: 85, kcal: 765, peri: false },
    ],
    avisos: ['INFO_PROYECCION_PLANA', 'INFO_SIN_CRONOGRAMA', 'WARN_PROTEINA_TOMA_ALTA', 'WARN_YA_EN_OBJETIVO'],
  },

  {
    n: '13',
    titulo: 'Hombre 62 años con enfermedad renal e IMC ≥ 30 — cap renal como último filtro',
    inputs: {
      ...BASE,
      sexo: 'hombre',
      edad: 62,
      altura_cm: 170,
      peso_kg: 95,
      grasa: { metodo: 'desconocido' },
      somatotipo: null,
      actividad_diaria: 'ligero',
      entrenamiento: ent({ tipo: 'fuerza', dias_semana: 3, minutos_sesion: 45, intensidad: 'media', experiencia: 'novato', momento: 'manana' }),
      objetivo: 'perder',
      ritmo: 'moderado',
      n_comidas: 3,
      condiciones: ['renal'],
    },
    imc: 32.9,
    imc_categoria: 'obesidad_I',
    grasa: { pct: 35.7, margen: 5, cunbae: 35.7, deurenberg: 37.5, fiabilidad: 'baja', metodo_efectivo: 'desconocido', banda: 'muy_alto' },
    mlg: 61.10,
    bmr: { valor: 1707.5, ecuacion: 'mifflin', mifflin: 1707.5, katch: 1689.8, harris: 1824.9 },
    tdee: { valor: 2549.2, bruto: 2683.4, pal: 1.5, ejercicio_dia: 122.1, perfil: 'fuerza', kcal_sesion: 285.0 },
    objetivo_efectivo: 'perder',
    ritmo_efectivo: 'moderado',
    kcal: 1780,
    kcal_cierre: 1785,
    macros: { p: 95, g: 65, hc: 205, fibra: 25, azucares: 44.5, base_kg: 88.77, base_proteina: 'peso_ajustado', somatotipo: 'mesomorfo' },
    agua: null,
    peso_objetivo: {
      metodo: 'grasa', sugerido: 72.0, rango: [66.0, 77.0], mostrar_central: false, efectivo: 72.0, hito: 85.5,
      imc22: 63.6, rango_imc: [57.8, 72.0],
      clasicas: { devine: 65.9, robinson: 65.2, miller: 66.0, hamwi: 66.7 },
    },
    cronograma: { ritmo_kg_sem: 0.699, ritmo_pct_sem: 0.74, delta_kg: 23.0, semanas: [37, 48], diet_breaks: 4, fecha_min: '2027-05-24', fecha_max: '2027-08-09', precision_fecha: 'mes', tramo_12sem: [6.5, 8.5] },
    ffmi: { valor: 21.1, normalizado: 21.8, categoria: null },
    comidas: [
      { nombre: 'Desayuno', hora: '08:00', pct: 30, p: 30, g: 20, hc: 70, kcal: 580, peri: true },
      { nombre: 'Comida', hora: '14:00', pct: 35, p: 30, g: 20, hc: 65, kcal: 560, peri: false },
      { nombre: 'Cena', hora: '21:00', pct: 35, p: 35, g: 25, hc: 70, kcal: 645, peri: false },
    ],
    avisos: [
      'INFO_ADAPTACION', 'INFO_AGUA_NO_PRESCRITA', 'INFO_DEFICIT_CAPADO_TDEE', 'INFO_GRASA_ESTIMADA',
      'INFO_MAYOR_60_RENAL', 'INFO_MICRONUTRIENTES', 'WARN_RENAL',
    ],
  },

  {
    n: '14',
    titulo: 'Mujer 70 años con objetivo perder — modificadores de edad ≥ 65',
    inputs: {
      ...BASE,
      sexo: 'mujer',
      edad: 70,
      altura_cm: 158,
      peso_kg: 75,
      grasa: { metodo: 'desconocido' },
      somatotipo: null,
      actividad_diaria: 'ligero',
      entrenamiento: ent({ tipo: 'fuerza', dias_semana: 2, minutos_sesion: 40, intensidad: 'baja', experiencia: 'novato', momento: 'manana' }),
      objetivo: 'perder',
      ritmo: 'agresivo',
      n_comidas: 4,
    },
    imc: 30.0,
    imc_categoria: 'obesidad_I',
    grasa: { pct: 44.9, margen: 5, cunbae: 44.9, deurenberg: 46.8, fiabilidad: 'baja', metodo_efectivo: 'desconocido', banda: 'muy_alto' },
    mlg: 41.35,
    bmr: { valor: 1226.5, ecuacion: 'mifflin', mifflin: 1226.5, katch: 1263.1, harris: 1327.5 },
    tdee: { valor: 1781.7, bruto: 1875.5, pal: 1.5, ejercicio_dia: 35.7, perfil: 'fuerza', kcal_sesion: 125.0 },
    objetivo_efectivo: 'perder',
    ritmo_efectivo: 'moderado',
    kcal: 1580,
    kcal_cierre: 1580,
    macros: { p: 120, g: 60, hc: 140, fibra: 22, azucares: 39.5, base_kg: 74.92, base_proteina: 'peso_ajustado', somatotipo: 'mesomorfo' },
    agua: { ml: 2550, rango: [2300, 2800], vasos: 10 },
    peso_objetivo: {
      metodo: 'grasa', sugerido: 56.0, rango: [55.0, 60.0], mostrar_central: false, efectivo: 56.0, hito: 67.5,
      imc22: 54.9, rango_imc: [49.9, 62.2],
      clasicas: { devine: 50.6, robinson: 52.7, miller: 56.1, hamwi: 50.4 },
    },
    cronograma: null,
    ffmi: { valor: 16.6, normalizado: 17.3, categoria: null },
    comidas: [
      { nombre: 'Desayuno', hora: '08:00', pct: 25, p: 30, g: 15, hc: 40, kcal: 415, peri: true },
      { nombre: 'Comida', hora: '14:00', pct: 30, p: 35, g: 15, hc: 40, kcal: 435, peri: false },
      { nombre: 'Merienda', hora: '17:30', pct: 15, p: 20, g: 10, hc: 20, kcal: 250, peri: false },
      { nombre: 'Cena', hora: '21:00', pct: 30, p: 35, g: 20, hc: 40, kcal: 480, peri: false },
    ],
    avisos: [
      'INFO_AGUA_MAYORES', 'INFO_CRONOGRAMA_FUERA_DE_HORIZONTE', 'INFO_DEFICIT_CAPADO_TDEE',
      'INFO_FIBRA_AJUSTADA', 'INFO_GRASA_ESTIMADA', 'INFO_MAYOR_60', 'INFO_PROTEINA_CAPADA',
      'INFO_PROYECCION_PLANA',
      'WARN_DEFICIT_INFACTIBLE', 'WARN_OBJETIVO_MUY_LEJANO', 'WARN_PERDIDA_MAYOR_65',
    ],
  },

  {
    n: '15',
    titulo: 'Mujer 34 años, perder agresivo, regla irregular, omnívora sin lactosa (D, E, F)',
    inputs: {
      ...BASE,
      sexo: 'mujer',
      edad: 34,
      altura_cm: 168,
      peso_kg: 78,
      grasa: { metodo: 'desconocido' },
      somatotipo: null,
      actividad_diaria: 'ligero',
      entrenamiento: ent({ tipo: 'fuerza', dias_semana: 3, minutos_sesion: 50, intensidad: 'media', experiencia: 'intermedio', momento: 'tarde' }),
      objetivo: 'perder',
      ritmo: 'agresivo',
      peso_objetivo: 68,
      n_comidas: 4,
      preferencia_base: 'omnivoro',
      restricciones: ['sin_lactosa'],
      low_carb: false,
      menstruacion: 'irregular',
    },
    imc: 27.6,
    imc_categoria: 'sobrepeso',
    grasa: { pct: 38.5, margen: 5, cunbae: 38.5, deurenberg: 35.6, fiabilidad: 'baja', metodo_efectivo: 'desconocido', banda: 'muy_alto' },
    mlg: 48.01,
    bmr: { valor: 1499.0, ecuacion: 'mifflin', mifflin: 1499.0, katch: 1407.0, harris: 1542.1 },
    tdee: { valor: 2241.9, bruto: 2359.9, pal: 1.5, ejercicio_dia: 111.4, perfil: 'fuerza', kcal_sesion: 260.0 },
    // El paso 6.7bis ha suavizado el ritmo `agresivo` a `moderado` por `menstruacion = 'irregular'`.
    objetivo_efectivo: 'perder',
    ritmo_efectivo: 'moderado',
    kcal: 1600,
    kcal_cierre: 1605,
    macros: { p: 120, g: 65, hc: 135, fibra: 22, azucares: 40.0, base_kg: 78.0, base_proteina: 'peso_corporal', somatotipo: 'mesomorfo' },
    agua: { ml: 2750, rango: [2500, 3000], vasos: 11 },
    peso_objetivo: {
      metodo: 'grasa', sugerido: 62.5, rango: [57.0, 67.0], mostrar_central: false, efectivo: 68.0, hito: null,
      imc22: 62.1, rango_imc: [56.4, 70.3],
      clasicas: { devine: 59.6, robinson: 59.4, miller: 61.5, hamwi: 59.0 },
    },
    cronograma: { ritmo_kg_sem: 0.584, ritmo_pct_sem: 0.75, delta_kg: 10.0, semanas: [20, 22], diet_breaks: 2, fecha_min: '2027-01-25', fecha_max: '2027-02-08', precision_fecha: 'mes', tramo_12sem: [6.0, 7.0] },
    ffmi: { valor: 17.0, normalizado: 17.1, categoria: null },
    comidas: [
      { nombre: 'Desayuno', hora: '08:00', pct: 25, p: 30, g: 15, hc: 35, kcal: 395, peri: false },
      { nombre: 'Comida', hora: '14:00', pct: 30, p: 35, g: 20, hc: 35, kcal: 460, peri: false },
      { nombre: 'Merienda', hora: '17:30', pct: 15, p: 20, g: 10, hc: 25, kcal: 270, peri: true },
      { nombre: 'Cena', hora: '21:00', pct: 30, p: 35, g: 20, hc: 40, kcal: 480, peri: false },
    ],
    avisos: ['INFO_ADAPTACION', 'INFO_CICLO', 'INFO_FIBRA_AJUSTADA', 'INFO_GRASA_ESTIMADA', 'INFO_PROTEINA_CAPADA', 'WARN_CICLO_AUSENTE'],
  },

  {
    n: '16',
    titulo: 'Mujer 31 años, recomposición con prioridad perder, y ajuste manual de hidratos (B, C)',
    inputs: {
      ...BASE,
      sexo: 'mujer',
      edad: 31,
      altura_cm: 165,
      peso_kg: 64,
      grasa: { metodo: 'conocido', valor: 27, fuente: 'fiable' },
      somatotipo: null,
      actividad_diaria: 'ligero',
      entrenamiento: ent({ tipo: 'fuerza', dias_semana: 4, minutos_sesion: 55, intensidad: 'media', experiencia: 'intermedio', momento: 'tarde' }),
      objetivo: 'recomposicion',
      ritmo: 'moderado',
      n_comidas: 4,
      preferencia_base: 'omnivoro',
      restricciones: [],
      low_carb: false,
      recomposicion_prioridad: 'perder',
      menstruacion: 'regular',
    },
    imc: 23.5,
    imc_categoria: 'normal',
    grasa: { pct: 27.0, margen: 2, cunbae: 32.0, deurenberg: 29.9, fiabilidad: 'alta', metodo_efectivo: 'conocido', banda: 'medio' },
    mlg: 46.72,
    bmr: { valor: 1379.2, ecuacion: 'katch_mcardle', mifflin: 1355.3, katch: 1379.2, harris: 1416.3 },
    tdee: { valor: 2092.7, bruto: 2202.8, pal: 1.5, ejercicio_dia: 134.1, perfil: 'fuerza', kcal_sesion: 234.7 },
    objetivo_efectivo: 'recomposicion',
    ritmo_efectivo: 'moderado',
    // Déficit de recomposición: tabla 3.9[medio] 7,5 % + 5 puntos por la prioridad = 12,5 %.
    kcal: 1830,
    kcal_cierre: 1825,
    macros: { p: 130, g: 65, hc: 180, fibra: 26, azucares: 45.8, base_kg: 64.0, base_proteina: 'peso_corporal', somatotipo: 'mesomorfo' },
    agua: { ml: 2500, rango: [2250, 2750], vasos: 10 },
    // v1.2: recomposición con déficit real (2 092,7 − 1 830 = 262,7 ≥ 50) ⇒ meta como en `perder`.
    // Hasta la v1.1: método `actual`, sugerido 64,0, rango [57,0; 64,0] y efectivo `null`.
    peso_objetivo: {
      metodo: 'grasa', sugerido: 60.5, rango: [57.5, 63.5], mostrar_central: true, efectivo: 60.5, hito: null,
      imc22: 59.9, rango_imc: [54.4, 67.8],
      clasicas: { devine: 56.9, robinson: 57.4, miller: 59.8, hamwi: 56.4 },
    },
    cronograma: null,
    ffmi: { valor: 17.2, normalizado: 17.5, categoria: 'bueno' },
    comidas: [
      { nombre: 'Desayuno', hora: '08:00', pct: 25, p: 35, g: 15, hc: 45, kcal: 455, peri: false },
      { nombre: 'Comida', hora: '14:00', pct: 30, p: 35, g: 20, hc: 45, kcal: 500, peri: false },
      { nombre: 'Merienda', hora: '17:30', pct: 15, p: 20, g: 10, hc: 35, kcal: 310, peri: true },
      { nombre: 'Cena', hora: '21:00', pct: 30, p: 40, g: 20, hc: 55, kcal: 560, peri: false },
    ],
    // v1.2: INFO_PROYECCION_RECOMP sustituye a INFO_PROYECCION_PLANA (son excluyentes).
    avisos: ['INFO_BMR_ATLETA', 'INFO_CICLO', 'INFO_PROYECCION_RECOMP', 'INFO_RECOMP_PRIORIDAD_PERDER', 'INFO_SIN_CRONOGRAMA', 'WARN_PROTEINA_TOMA_ALTA'],
  },

  // ---------------------------------------------------------------- v1.2: casos 17, 18 y 19
  {
    n: '17',
    titulo: 'Mujer 45 años, recomposición con prioridad perder y peso objetivo 63 kg (H, I, G)',
    inputs: {
      ...BASE,
      sexo: 'mujer',
      edad: 45,
      altura_cm: 165,
      peso_kg: 68,
      grasa: { metodo: 'medidas', cuello_cm: 33, cintura_cm: 82, cadera_cm: 102 },
      somatotipo: null,
      actividad_diaria: 'ligero',
      entrenamiento: ent({ tipo: 'fuerza', dias_semana: 3, minutos_sesion: 45, intensidad: 'media', experiencia: 'novato', momento: 'tarde' }),
      objetivo: 'recomposicion',
      recomposicion_prioridad: 'perder',
      ritmo: 'moderado',
      peso_objetivo: 63,
      n_comidas: 4,
      preferencia_base: 'omnivoro',
      restricciones: [],
      low_carb: false,
      menstruacion: 'regular',
      sintomas_regla: ['sangrado_abundante', 'cansancio', 'hinchazon'],
      // Los tres campos que el motor IGNORA: van aquí a propósito (invariante S33).
      menu_sencillo: true,
      alimentos_excluidos: ['brocoli', 'coliflor'],
      alimentos_favoritos: ['pechuga_pollo', 'arroz_blanco_cocido'],
    },
    imc: 25.0,
    imc_categoria: 'normal',
    grasa: { pct: 33.8, margen: 4, cunbae: 36.2, deurenberg: 34.9, navy: 33.8, fiabilidad: 'media', metodo_efectivo: 'medidas', banda: 'muy_alto' },
    mlg: 45.01,
    bmr: { valor: 1325.3, ecuacion: 'mifflin', mifflin: 1325.3, katch: 1342.2, harris: 1392.7 },
    tdee: { valor: 1971.5, bruto: 2075.3, pal: 1.5, ejercicio_dia: 87.4, perfil: 'fuerza', kcal_sesion: 204.0 },
    objetivo_efectivo: 'recomposicion',
    ritmo_efectivo: 'moderado',
    // Tabla 3.9[muy_alto] 10 % + 5 puntos por la prioridad = 15 % (tope duro).
    kcal: 1680,
    kcal_cierre: 1680,
    macros: { p: 135, g: 60, hc: 150, fibra: 24, azucares: 42.0, base_kg: 68.0, base_proteina: 'peso_corporal', somatotipo: 'mesomorfo' },
    agua: { ml: 2400, rango: [2150, 2650], vasos: 10 },
    peso_objetivo: {
      metodo: 'grasa', sugerido: 58.5, rango: [54.0, 62.5], mostrar_central: true, efectivo: 63.0, hito: null,
      imc22: 59.9, rango_imc: [54.4, 67.8],
      clasicas: { devine: 56.9, robinson: 57.4, miller: 59.8, hamwi: 56.4 },
    },
    cronograma: null,
    ffmi: { valor: 16.5, normalizado: 16.8, categoria: null },
    comidas: [
      { nombre: 'Desayuno', hora: '08:00', pct: 25, p: 35, g: 15, hc: 40, kcal: 435, peri: false },
      { nombre: 'Comida', hora: '14:00', pct: 30, p: 40, g: 15, hc: 35, kcal: 435, peri: false },
      { nombre: 'Merienda', hora: '17:30', pct: 15, p: 20, g: 10, hc: 30, kcal: 290, peri: true },
      { nombre: 'Cena', hora: '21:00', pct: 30, p: 40, g: 20, hc: 45, kcal: 520, peri: false },
    ],
    // INFO_OBJETIVO_IGNORADO no aparece: lo retira la regla del paso 17, porque aquí el peso
    // objetivo sí se usa (es la meta de la curva de recomposición).
    avisos: ['INFO_CICLO', 'INFO_FIBRA_AJUSTADA', 'INFO_PROYECCION_RECOMP', 'INFO_RECOMP_PRIORIDAD_PERDER', 'INFO_SIN_CRONOGRAMA', 'WARN_PROTEINA_TOMA_ALTA'],
  },

  {
    n: '18',
    titulo: 'Hombre 38 años con plazo imposible: 15 kg en 8 semanas (H)',
    inputs: {
      ...BASE,
      sexo: 'hombre',
      edad: 38,
      altura_cm: 180,
      peso_kg: 95,
      grasa: { metodo: 'desconocido' },
      somatotipo: null,
      actividad_diaria: 'sedentario',
      entrenamiento: ent(),
      objetivo: 'perder',
      ritmo: 'suave',
      peso_objetivo: 80,
      plazo_semanas: 8,
      n_comidas: 3,
      preferencia_base: 'omnivoro',
    },
    imc: 29.3,
    imc_categoria: 'sobrepeso',
    grasa: { pct: 29.4, margen: 5, cunbae: 29.4, deurenberg: 27.7, fiabilidad: 'baja', metodo_efectivo: 'desconocido', banda: 'muy_alto' },
    mlg: 67.11,
    bmr: { valor: 1890.0, ecuacion: 'mifflin', mifflin: 1890.0, katch: 1819.6, harris: 2009.2 },
    tdee: { valor: 2513.7, bruto: 2646.0, pal: 1.4, ejercicio_dia: 0.0, perfil: 'sedentario', kcal_sesion: 0.0 },
    objetivo_efectivo: 'perder',
    // Paso 6.7ter: ritmo_req = 15/8 = 1,875 kg/sem y ni el agresivo (0,95) llega ⇒ agresivo, y el
    // `suave` que había elegido el usuario se descarta.
    ritmo_efectivo: 'agresivo',
    kcal: 1890,
    kcal_cierre: 1890,
    macros: { p: 160, g: 70, hc: 155, fibra: 26, azucares: 47.3, base_kg: 95.0, base_proteina: 'peso_corporal', somatotipo: 'mesomorfo' },
    agua: { ml: 2850, rango: [2600, 3100], vasos: 11 },
    peso_objetivo: {
      metodo: 'grasa', sugerido: 79.0, rango: [72.5, 85.0], mostrar_central: false, efectivo: 80.0, hito: 85.5,
      imc22: 71.3, rango_imc: [64.8, 80.7],
      clasicas: { devine: 75.0, robinson: 72.6, miller: 71.5, hamwi: 77.3 },
    },
    cronograma: { ritmo_kg_sem: 0.567, ritmo_pct_sem: 0.60, delta_kg: 15.0, semanas: [30, 37], diet_breaks: 3, fecha_min: '2027-04-05', fecha_max: '2027-05-24', precision_fecha: 'mes', tramo_12sem: [5.5, 7.0] },
    ffmi: { valor: 20.7, normalizado: 20.7, categoria: null },
    comidas: [
      { nombre: 'Desayuno', hora: '08:00', pct: 30, p: 50, g: 20, hc: 45, kcal: 560, peri: false },
      { nombre: 'Comida', hora: '14:00', pct: 35, p: 55, g: 25, hc: 55, kcal: 665, peri: false },
      { nombre: 'Cena', hora: '21:00', pct: 35, p: 55, g: 25, hc: 55, kcal: 665, peri: false },
    ],
    avisos: ['INFO_ADAPTACION', 'INFO_DEFICIT_CAPADO_TDEE', 'INFO_GRASA_ESTIMADA', 'WARN_PLAZO_IRREAL', 'WARN_PROTEINA_TOMA_ALTA', 'WARN_SUELO_CALORICO_BMR'],
  },

  {
    n: '19',
    titulo: 'Mujer 34 años con plazo holgado: 6 kg en 24 semanas (H)',
    inputs: {
      ...BASE,
      sexo: 'mujer',
      edad: 34,
      altura_cm: 168,
      peso_kg: 78,
      grasa: { metodo: 'desconocido' },
      somatotipo: null,
      actividad_diaria: 'ligero',
      entrenamiento: ent({ tipo: 'fuerza', dias_semana: 3, minutos_sesion: 50, intensidad: 'media', experiencia: 'intermedio', momento: 'tarde' }),
      objetivo: 'perder',
      ritmo: 'agresivo',
      peso_objetivo: 72,
      plazo_semanas: 24,
      n_comidas: 4,
      preferencia_base: 'omnivoro',
    },
    imc: 27.6,
    imc_categoria: 'sobrepeso',
    grasa: { pct: 38.5, margen: 5, cunbae: 38.5, deurenberg: 35.6, fiabilidad: 'baja', metodo_efectivo: 'desconocido', banda: 'muy_alto' },
    mlg: 48.01,
    bmr: { valor: 1499.0, ecuacion: 'mifflin', mifflin: 1499.0, katch: 1407.0, harris: 1542.1 },
    tdee: { valor: 2241.9, bruto: 2360.0, pal: 1.5, ejercicio_dia: 111.4, perfil: 'fuerza', kcal_sesion: 259.9 },
    objetivo_efectivo: 'perder',
    // Paso 6.7ter: ritmo_req = 0,25 kg/sem y el suave (0,39) ya llega ⇒ gana el PRIMERO de la
    // lista, y el `agresivo` que había elegido la usuaria se descarta.
    ritmo_efectivo: 'suave',
    kcal: 1810,
    kcal_cierre: 1805,
    macros: { p: 155, g: 65, hc: 150, fibra: 25, azucares: 45.3, base_kg: 78.0, base_proteina: 'peso_corporal', somatotipo: 'mesomorfo' },
    agua: { ml: 2750, rango: [2500, 3000], vasos: 11 },
    peso_objetivo: {
      metodo: 'grasa', sugerido: 62.5, rango: [57.0, 67.0], mostrar_central: false, efectivo: 72.0, hito: null,
      imc22: 62.1, rango_imc: [56.4, 70.3],
      clasicas: { devine: 59.6, robinson: 59.4, miller: 61.5, hamwi: 59.0 },
    },
    cronograma: { ritmo_kg_sem: 0.3927, ritmo_pct_sem: 0.50, delta_kg: 6.0, semanas: [17, 19], diet_breaks: 1, fecha_min: '2027-01-04', fecha_max: '2027-01-18', precision_fecha: 'mes', tramo_12sem: [4.0, 4.5] },
    ffmi: { valor: 17.0, normalizado: 17.1, categoria: null },
    comidas: [
      { nombre: 'Desayuno', hora: '08:00', pct: 25, p: 40, g: 15, hc: 40, kcal: 455, peri: false },
      { nombre: 'Comida', hora: '14:00', pct: 30, p: 45, g: 20, hc: 35, kcal: 500, peri: false },
      { nombre: 'Merienda', hora: '17:30', pct: 15, p: 25, g: 10, hc: 30, kcal: 310, peri: true },
      { nombre: 'Cena', hora: '21:00', pct: 30, p: 45, g: 20, hc: 45, kcal: 540, peri: false },
    ],
    avisos: ['INFO_ADAPTACION', 'INFO_GRASA_ESTIMADA', 'INFO_PROTEINA_CAPADA', 'INFO_RITMO_POR_PLAZO', 'WARN_PROTEINA_TOMA_ALTA'],
  },
]

// ---------------------------------------------------------------- comprobación de cada vector

for (const v of VECTORES) {
  describe(`Caso ${v.n} — ${v.titulo}`, () => {
    const r = calcular(v.inputs)

    it('no está excluido', () => {
      expect(r.excluido).toBeUndefined()
      expect(r.errores).toBeUndefined()
    })

    it('1. IMC y categoría', () => {
      cerca(r.imc, v.imc, 'imc')
      expect(r.imc_categoria).toBe(v.imc_categoria)
    })

    it('2. %grasa, estimadores, fiabilidad y banda', () => {
      cerca(r.grasa.pct, v.grasa.pct, 'grasa.pct')
      cerca(r.grasa.referencias.cunbae, v.grasa.cunbae, 'cunbae')
      cerca(r.grasa.referencias.deurenberg, v.grasa.deurenberg, 'deurenberg')
      if (v.grasa.navy === undefined) expect(r.grasa.referencias.navy).toBeUndefined()
      else cerca(r.grasa.referencias.navy as number, v.grasa.navy, 'navy')
      expect(r.grasa.fiabilidad).toBe(v.grasa.fiabilidad)
      expect(r.grasa.metodo_efectivo).toBe(v.grasa.metodo_efectivo)
      expect(r.grasa.banda).toBe(v.grasa.banda)
      cerca(r.grasa.rango[0], Math.max(3, v.grasa.pct - v.grasa.margen), 'grasa.rango[0]')
      cerca(r.grasa.rango[1], Math.min(65, v.grasa.pct + v.grasa.margen), 'grasa.rango[1]')
    })

    it('3. MLG', () => cerca(r.mlg, v.mlg, 'mlg'))

    it('4. BMR y las tres ecuaciones', () => {
      cerca(r.bmr.valor, v.bmr.valor, 'bmr.valor')
      expect(r.bmr.ecuacion).toBe(v.bmr.ecuacion)
      cerca(r.bmr.referencias.mifflin, v.bmr.mifflin, 'mifflin')
      cerca(r.bmr.referencias.katch, v.bmr.katch, 'katch')
      cerca(r.bmr.referencias.harris, v.bmr.harris, 'harris')
    })

    it('5. TDEE, PAL, perfil y ejercicio', () => {
      cerca(r.tdee.valor, v.tdee.valor, 'tdee.valor')
      cerca(r.tdee.bruto, v.tdee.bruto, 'tdee.bruto')
      expect(r.tdee.pal).toBe(v.tdee.pal)
      cerca(r.tdee.ejercicio_dia, v.tdee.ejercicio_dia, 'ejercicio_dia')
      expect(r.tdee.perfil).toBe(v.tdee.perfil)
    })

    it('6. objetivo y ritmo efectivos', () => {
      expect(r.objetivo_efectivo).toBe(v.objetivo_efectivo)
      expect(r.ritmo_efectivo).toBe(v.ritmo_efectivo)
    })

    it('7-10. kcal, cierre y macros', () => {
      expect(r.kcal).toBe(v.kcal)
      expect(r.kcal_cierre).toBe(v.kcal_cierre)
      expect(r.macros.proteina_g).toBe(v.macros.p)
      expect(r.macros.grasa_g).toBe(v.macros.g)
      expect(r.macros.hc_g).toBe(v.macros.hc)
      expect(r.macros.base_proteina).toBe(v.macros.base_proteina)
      cerca(r.macros.base_kg, v.macros.base_kg, 'base_kg')
      expect(r.macros.somatotipo).toBe(v.macros.somatotipo)
      // El cierre es la suma real de los macros y difiere ≤ 10 kcal del objetivo.
      expect(4 * v.macros.p + 4 * v.macros.hc + 9 * v.macros.g).toBe(v.kcal_cierre)
      expect(Math.abs(r.kcal_cierre - r.kcal)).toBeLessThanOrEqual(10)
      // %kcal y g/kg son derivados, no inputs.
      cerca(r.macros.pct.p, 4 * v.macros.p / v.kcal, 'pct.p', 0.001)
      cerca(r.macros.pct.g, 9 * v.macros.g / v.kcal, 'pct.g', 0.001)
      cerca(r.macros.pct.hc, 4 * v.macros.hc / v.kcal, 'pct.hc', 0.001)
      cerca(r.macros.gkg.p, v.macros.p / v.inputs.peso_kg, 'gkg.p', 0.001)
      cerca(r.macros.gkg.g, v.macros.g / v.inputs.peso_kg, 'gkg.g', 0.001)
      cerca(r.macros.gkg.hc, v.macros.hc / v.inputs.peso_kg, 'gkg.hc', 0.001)
    })

    it('11. fibra y azúcares libres', () => {
      expect(r.macros.fibra_g).toBe(v.macros.fibra)
      cerca(r.macros.azucares_libres_max_g, v.macros.azucares, 'azucares')
    })

    it('12. agua', () => {
      if (v.agua === null) {
        expect(r.agua).toBeNull()
      } else {
        expect(r.agua).not.toBeNull()
        expect(r.agua?.ml).toBe(v.agua.ml)
        expect(r.agua?.rango).toEqual(v.agua.rango)
        expect(r.agua?.vasos).toBe(v.agua.vasos)
      }
    })

    it('13. peso objetivo y referencias', () => {
      const p = r.peso_objetivo
      expect(p.metodo).toBe(v.peso_objetivo.metodo)
      expect(p.sugerido).toBe(v.peso_objetivo.sugerido)
      expect(p.rango).toEqual(v.peso_objetivo.rango)
      expect(p.mostrar_central).toBe(v.peso_objetivo.mostrar_central)
      expect(p.efectivo).toBe(v.peso_objetivo.efectivo)
      expect(p.hito_intermedio).toBe(v.peso_objetivo.hito)
      cerca(p.referencias.imc22, v.peso_objetivo.imc22, 'imc22')
      cerca(p.referencias.rango_imc[0], v.peso_objetivo.rango_imc[0], 'rango_imc[0]')
      cerca(p.referencias.rango_imc[1], v.peso_objetivo.rango_imc[1], 'rango_imc[1]')
      if (v.peso_objetivo.clasicas === null) {
        expect(p.referencias.clasicas).toBeNull()
      } else {
        const c = p.referencias.clasicas as Record<string, number>
        cerca(c.devine, v.peso_objetivo.clasicas.devine, 'devine')
        cerca(c.robinson, v.peso_objetivo.clasicas.robinson, 'robinson')
        cerca(c.miller, v.peso_objetivo.clasicas.miller, 'miller')
        cerca(c.hamwi, v.peso_objetivo.clasicas.hamwi, 'hamwi')
      }
      // Invariante del paso 13: el rango nunca está invertido ni excluye al central.
      expect(p.rango[0]).toBeLessThanOrEqual(p.sugerido)
      expect(p.sugerido).toBeLessThanOrEqual(p.rango[1])
    })

    it('14. cronograma', () => {
      if (v.cronograma === null) {
        expect(r.cronograma).toBeNull()
        return
      }
      const c = r.cronograma
      expect(c).not.toBeNull()
      if (!c) return
      cerca(c.ritmo_kg_sem, v.cronograma.ritmo_kg_sem, 'ritmo_kg_sem', 0.001)
      cerca(c.ritmo_pct_sem, v.cronograma.ritmo_pct_sem, 'ritmo_pct_sem', 0.01)
      cerca(c.delta_kg, v.cronograma.delta_kg, 'delta_kg')
      expect(c.semanas).toEqual(v.cronograma.semanas)
      expect(c.diet_breaks).toBe(v.cronograma.diet_breaks)
      expect(c.fecha_min).toBe(v.cronograma.fecha_min)
      expect(c.fecha_max).toBe(v.cronograma.fecha_max)
      expect(c.precision_fecha).toBe(v.cronograma.precision_fecha)
      expect(c.tramo_12sem).toEqual(v.cronograma.tramo_12sem)
    })

    it('15. FFMI', () => {
      cerca(r.ffmi.valor, v.ffmi.valor, 'ffmi.valor')
      cerca(r.ffmi.normalizado, v.ffmi.normalizado, 'ffmi.normalizado')
      expect(r.ffmi.categoria).toBe(v.ffmi.categoria)
    })

    it('16. reparto por comidas (nombres, horas, macros, kcal y peri)', () => {
      expect(r.comidas).toHaveLength(v.comidas.length)
      v.comidas.forEach((esperada, i) => {
        const c = r.comidas[i]
        expect(c.nombre, `comida ${i}`).toBe(esperada.nombre)
        expect(c.hora, `hora ${esperada.nombre}`).toBe(esperada.hora)
        expect(c.pct_kcal, `% ${esperada.nombre}`).toBe(esperada.pct)
        expect(c.proteina_g, `P ${esperada.nombre}`).toBe(esperada.p)
        expect(c.grasa_g, `G ${esperada.nombre}`).toBe(esperada.g)
        expect(c.hc_g, `HC ${esperada.nombre}`).toBe(esperada.hc)
        expect(c.kcal, `kcal ${esperada.nombre}`).toBe(esperada.kcal)
        expect(c.peri, `peri ${esperada.nombre}`).toBe(esperada.peri)
      })
      // El reparto suma exactamente el total diario.
      expect(r.comidas.reduce((a, c) => a + c.proteina_g, 0)).toBe(v.macros.p)
      expect(r.comidas.reduce((a, c) => a + c.grasa_g, 0)).toBe(v.macros.g)
      expect(r.comidas.reduce((a, c) => a + c.hc_g, 0)).toBe(v.macros.hc)
      // Como mucho una comida es peri-entreno.
      expect(r.comidas.filter((c) => c.peri).length).toBeLessThanOrEqual(1)
    })

    it('17. avisos (como conjunto, con las supresiones aplicadas)', () => {
      expect([...r.avisos].sort()).toEqual([...v.avisos].sort())
    })

    it('todos los avisos tienen texto y título resueltos', () => {
      const textos = textosAvisos(r, v.inputs)
      expect(textos).toHaveLength(v.avisos.length)
      for (const t of textos) {
        expect(t.texto.length, `${t.codigo} sin texto`).toBeGreaterThan(20)
        expect(t.texto).not.toContain('{')
        expect(t.titulo.length, `${t.codigo} sin título`).toBeGreaterThan(3)
      }
      // warn antes que info, y sin duplicados
      const rango = { error: 0, warn: 1, info: 2 } as const
      const orden = textos.map((t) => rango[t.severidad])
      expect(orden).toEqual([...orden].sort((a, b) => a - b))
      expect(new Set(textos.map((t) => t.codigo)).size).toBe(textos.length)
    })
  })
}

// ---------------------------------------------------------------- Caso 0: exclusiones y validación

const PERFIL_BASE: Inputs = {
  ...BASE,
  sexo: 'hombre',
  edad: 30,
  altura_cm: 175,
  peso_kg: 70,
  grasa: { metodo: 'desconocido' },
  actividad_diaria: 'sedentario',
  entrenamiento: ent(),
  objetivo: 'perder',
  n_comidas: 3,
}
const con = (o: Partial<Inputs>): Inputs => ({ ...PERFIL_BASE, ...o })

describe('Caso 0 — exclusiones del paso 0', () => {
  it('edad 16 → EXCL_EDAD', () => expect(calcular(con({ edad: 16 })).excluido).toBe('EXCL_EDAD'))
  it('edad 76 → EXCL_EDAD', () => expect(calcular(con({ edad: 76 })).excluido).toBe('EXCL_EDAD'))
  it('edad 18 y 75 no excluyen', () => {
    expect(calcular(con({ edad: 18 })).excluido).toBeUndefined()
    expect(calcular(con({ edad: 75 })).excluido).toBeUndefined()
  })
  it('embarazo o lactancia → EXCL_EMBARAZO_LACTANCIA', () => {
    expect(calcular(con({ sexo: 'mujer', peso_kg: 60, embarazo_lactancia: true })).excluido).toBe('EXCL_EMBARAZO_LACTANCIA')
  })
  it('IMC 15,4 → EXCL_IMC_MUY_BAJO', () => {
    expect(calcular(con({ altura_cm: 180, peso_kg: 50 })).excluido).toBe('EXCL_IMC_MUY_BAJO')
  })
  it("'tca' con IMC 17,9 → EXCL_TCA_RIESGO", () => {
    expect(calcular(con({ altura_cm: 180, peso_kg: 58, condiciones: ['tca'] })).excluido).toBe('EXCL_TCA_RIESGO')
  })
  it('el cribado positivo o evitado añade tca y puede excluir', () => {
    expect(calcular(con({ altura_cm: 180, peso_kg: 58, cribado_tca: 'positivo' })).excluido).toBe('EXCL_TCA_RIESGO')
    expect(calcular(con({ altura_cm: 180, peso_kg: 58, cribado_tca: 'evitado' })).excluido).toBe('EXCL_TCA_RIESGO')
    expect(calcular(con({ altura_cm: 180, peso_kg: 58, cribado_tca: 'negativo' })).excluido).toBeUndefined()
  })
  it('una exclusión no devuelve ningún plan', () => {
    const r = calcular(con({ edad: 16 }))
    expect(r.kcal).toBe(0)
    expect(r.comidas).toHaveLength(0)
    expect(r.avisos).toHaveLength(0)
    expect(r.cronograma).toBeNull()
  })
  it('textoError cubre todos los códigos de bloqueo', () => {
    for (const codigo of ['EXCL_EDAD', 'EXCL_EMBARAZO_LACTANCIA', 'EXCL_IMC_MUY_BAJO', 'EXCL_TCA_RIESGO', 'ERR_INPUT_RANGO']) {
      const t = textoError(codigo)
      expect(t.codigo).toBe(codigo)
      expect(t.severidad).toBe('error')
      expect(t.texto.length).toBeGreaterThan(30)
      expect(t.titulo.length).toBeGreaterThan(3)
    }
  })
})

describe('§1 — validación de rangos y dominios', () => {
  it('peso 400 → ERR_INPUT_RANGO con los campos afectados', () => {
    const r = calcular(con({ peso_kg: 400 }))
    expect(r.excluido).toBe('ERR_INPUT_RANGO')
    expect(r.errores).toEqual(['peso_kg', 'peso_kg+altura_cm'])
  })
  it('altura fuera de rango', () => {
    expect(calcular(con({ altura_cm: 120 })).errores).toContain('altura_cm')
    expect(calcular(con({ altura_cm: 240 })).errores).toContain('altura_cm')
  })
  it('n_comidas fuera del conjunto', () => {
    expect(calcular(con({ n_comidas: 7 as unknown as Inputs['n_comidas'] })).errores).toContain('n_comidas')
  })
  it('enumerado fuera de dominio no propaga NaN', () => {
    const r = calcular(con({ objetivo: 'adelgazar' as unknown as Objetivo }))
    expect(r.excluido).toBe('ERR_INPUT_RANGO')
    expect(r.errores).toContain('objetivo')
    expect(Number.isNaN(r.kcal)).toBe(false)
  })
  it('edad no entera', () => expect(calcular(con({ edad: 30.5 })).errores).toContain('edad'))
  it('fecha inválida', () => {
    expect(calcular(con({ fecha_inicio: '07/09/2026' })).errores).toContain('fecha_inicio')
    expect(calcular(con({ fecha_inicio: '2026-13-45' })).errores).toContain('fecha_inicio')
  })
  it('medidas sin cadera en mujer', () => {
    const r = calcular(con({ sexo: 'mujer', peso_kg: 60, grasa: { metodo: 'medidas', cuello_cm: 32, cintura_cm: 72 } }))
    expect(r.errores).toContain('grasa.cadera_cm')
  })
  it("metodo 'conocido' sin valor", () => {
    expect(calcular(con({ grasa: { metodo: 'conocido' } })).errores).toContain('grasa.valor')
  })
  it('categoría visual que no corresponde al sexo', () => {
    const r = calcular(con({ grasa: { metodo: 'visual', categoria: 'tonificada' as never } }))
    expect(r.errores).toContain('grasa.categoria')
  })
  it('IMC implausible por combinación de peso y altura', () => {
    expect(calcular(con({ altura_cm: 230, peso_kg: 35 })).errores).toContain('peso_kg+altura_cm')
  })
  it("con tipo 'ninguno' no se validan minutos ni intensidad", () => {
    const r = calcular(con({ entrenamiento: ent({ tipo: 'ninguno', minutos_sesion: 0, momento: null }) }))
    expect(r.excluido).toBeUndefined()
  })
  it('textoError de ERR_INPUT_RANGO enumera los campos legibles', () => {
    const inputs = con({ peso_kg: 400 })
    const t = textoError('ERR_INPUT_RANGO', inputs)
    expect(t.texto).toContain('peso')
  })
})

// ---------------------------------------------------------------- casos borde

describe('Casos borde', () => {
  it("dias_semana 0 con tipo 'fuerza' se trata como sedentario", () => {
    const r = calcular(con({ entrenamiento: ent({ tipo: 'fuerza', dias_semana: 0, minutos_sesion: 60, momento: 'tarde' }) }))
    expect(r.excluido).toBeUndefined()
    expect(r.tdee.perfil).toBe('sedentario')
    expect(r.tdee.ejercicio_dia).toBe(0)
    expect(r.comidas.every((c) => !c.peri)).toBe(true)
  })

  it('momento null deja todas las comidas sin peri y sin desplazar hidratos', () => {
    const conMomento = calcular(con({ entrenamiento: ent({ tipo: 'fuerza', dias_semana: 4, minutos_sesion: 60, momento: 'tarde' }), n_comidas: 4 }))
    const sinMomento = calcular(con({ entrenamiento: ent({ tipo: 'fuerza', dias_semana: 4, minutos_sesion: 60, momento: null }), n_comidas: 4 }))
    expect(sinMomento.comidas.every((c) => !c.peri)).toBe(true)
    expect(conMomento.comidas.filter((c) => c.peri)).toHaveLength(1)
    expect(sinMomento.macros.hc_g).toBe(conMomento.macros.hc_g)
  })

  it('peso objetivo igual al peso actual → mantenimiento e INFO_OBJETIVO_IGUAL', () => {
    const r = calcular(con({ peso_kg: 80, altura_cm: 175, peso_objetivo: 80 }))
    expect(r.objetivo_efectivo).toBe('mantener')
    expect(r.avisos).toContain('INFO_OBJETIVO_IGUAL')
    expect(r.cronograma).toBeNull()
  })

  it('suelo calórico por encima del TDEE → WARN_SIN_MARGEN_DEFICIT y plan de mantenimiento', () => {
    const r = calcular(con({
      altura_cm: 195,
      peso_kg: 100,
      grasa: { metodo: 'conocido', valor: 8, fuente: 'fiable' },
      objetivo: 'perder',
    }))
    expect(r.objetivo_efectivo).toBe('mantener')
    expect(r.avisos).toContain('WARN_SIN_MARGEN_DEFICIT')
    // La supresión retira los avisos que prometen una recomposición que ya no existe.
    expect(r.avisos).not.toContain('WARN_YA_MAGRO')
    expect(r.avisos).not.toContain('WARN_RECOMPOSICION_SIN_FUERZA')
    expect(r.avisos).not.toContain('INFO_DEFICIT_CAPADO_TDEE')
  })

  it('low_carb con kcal muy bajas respeta el mínimo de 75 g de hidratos y el techo de grasa', () => {
    const r = calcular(con({
      sexo: 'mujer',
      edad: 62,
      altura_cm: 150,
      peso_kg: 78,
      preferencia: 'low_carb',
      objetivo: 'perder',
      ritmo: 'agresivo',
    }))
    expect(r.excluido).toBeUndefined()
    expect(r.macros.hc_g).toBeGreaterThanOrEqual(75)
    expect(9 * r.macros.grasa_g).toBeLessThanOrEqual(0.50 * r.kcal)
    expect(r.macros.fibra_g).toBeGreaterThanOrEqual(20)
  })

  it('edad 60 exacta activa el mínimo de proteína y INFO_MAYOR_60', () => {
    const r59 = calcular(con({ edad: 59 }))
    const r60 = calcular(con({ edad: 60 }))
    expect(r59.avisos).not.toContain('INFO_MAYOR_60')
    expect(r60.avisos).toContain('INFO_MAYOR_60')
    expect(r60.macros.gkg.p).toBeGreaterThanOrEqual(r59.macros.gkg.p)
  })

  it('edad 65 exacta baja el techo de déficit al 20 % y sube el suelo de IMC del peso objetivo', () => {
    const base = { sexo: 'mujer' as const, altura_cm: 160, peso_kg: 85, objetivo: 'perder' as const, ritmo: 'agresivo' as const }
    const r64 = calcular(con({ ...base, edad: 64 }))
    const r65 = calcular(con({ ...base, edad: 65 }))
    expect(r64.avisos).not.toContain('WARN_PERDIDA_MAYOR_65')
    expect(r65.avisos).toContain('WARN_PERDIDA_MAYOR_65')
    expect(r65.avisos).toContain('INFO_AGUA_MAYORES')
    // Techo de déficit 20 % del TDEE a partir de 65 (frente al 25/30 % anterior).
    expect(r65.tdee.valor - r65.kcal).toBeLessThanOrEqual(0.20 * r65.tdee.valor + 10)
    // El peso objetivo mínimo pasa de IMC 18,5 a IMC 22.
    const h2 = (160 / 100) ** 2
    expect((r65.peso_objetivo.efectivo as number) / h2).toBeGreaterThanOrEqual(22)
  })

  it('IMC en los bordes exactos de cada categoría', () => {
    // altura 200 cm → h² = 4, así que el peso en kg es 4 × IMC.
    const enBorde = (imc: number): ImcCategoria =>
      calcular(con({ altura_cm: 200, peso_kg: 4 * imc })).imc_categoria
    expect(enBorde(18.5)).toBe('normal')
    expect(enBorde(18.4)).toBe('bajo_peso')
    expect(enBorde(25)).toBe('sobrepeso')
    expect(enBorde(24.9)).toBe('normal')
    expect(enBorde(30)).toBe('obesidad_I')
    expect(enBorde(35)).toBe('obesidad_II')
    expect(enBorde(40)).toBe('obesidad_III')
    expect(calcular(con({ altura_cm: 200, peso_kg: 4 * 15.9 })).excluido).toBe('EXCL_IMC_MUY_BAJO')
  })

  it('bandas de grasa en sus bordes exactos', () => {
    const banda = (valor: number, sexo: Inputs['sexo']) =>
      calcular(con({ sexo, peso_kg: sexo === 'hombre' ? 70 : 60, grasa: { metodo: 'conocido', valor, fuente: 'estimado' } })).grasa.banda
    expect(banda(11.9, 'hombre')).toBe('muy_bajo')
    expect(banda(12, 'hombre')).toBe('bajo')
    expect(banda(15, 'hombre')).toBe('medio')
    expect(banda(20, 'hombre')).toBe('alto')
    expect(banda(25, 'hombre')).toBe('muy_alto')
    expect(banda(19.9, 'mujer')).toBe('muy_bajo')
    expect(banda(20, 'mujer')).toBe('bajo')
    expect(banda(23, 'mujer')).toBe('medio')
    expect(banda(28, 'mujer')).toBe('alto')
    expect(banda(32, 'mujer')).toBe('muy_alto')
  })

  it('medidas Navy al borde: x < 15 en hombre cae a CUN-BAE con aviso', () => {
    const r = calcular(con({ altura_cm: 180, peso_kg: 85, grasa: { metodo: 'medidas', cuello_cm: 40, cintura_cm: 54.9 } }))
    expect(r.avisos).toContain('WARN_MEDIDAS_INVALIDAS')
    expect(r.grasa.metodo_efectivo).toBe('desconocido')
    expect(r.grasa.fiabilidad).toBe('baja')
    expect(r.grasa.referencias.navy).toBeUndefined()
  })

  it('medidas Navy al borde: resultado fuera de 3–60 se descarta', () => {
    const r = calcular(con({ altura_cm: 130, peso_kg: 100, grasa: { metodo: 'medidas', cuello_cm: 25, cintura_cm: 200 } }))
    expect(r.avisos).toContain('WARN_MEDIDAS_INVALIDAS')
    expect(r.grasa.metodo_efectivo).toBe('desconocido')
  })

  it('medidas Navy válidas con mucha discrepancia avisan pero se usan', () => {
    const r = calcular(con({ edad: 30, altura_cm: 175, peso_kg: 110, grasa: { metodo: 'medidas', cuello_cm: 35, cintura_cm: 90 } }))
    expect(r.grasa.metodo_efectivo).toBe('medidas')
    expect(r.avisos).toContain('WARN_GRASA_DISCREPANCIA')
    expect(r.grasa.referencias.navy).toBeDefined()
  })

  it('%grasa fuera del clamp avisa y usa el valor ajustado', () => {
    const r = calcular(con({ sexo: 'mujer', peso_kg: 60, grasa: { metodo: 'conocido', valor: 5, fuente: 'estimado' } }))
    expect(r.avisos).toContain('WARN_GRASA_FUERA_DE_RANGO')
    expect(r.grasa.pct).toBe(10)
    const texto = textosAvisos(r, con({ sexo: 'mujer', peso_kg: 60, grasa: { metodo: 'conocido', valor: 5, fuente: 'estimado' } }))
      .find((t) => t.codigo === 'WARN_GRASA_FUERA_DE_RANGO')
    expect(texto?.texto).toContain('10 %')
  })

  it("diabetes + low_carb anula el low-carb y publica preferencia_efectiva 'omnivoro'", () => {
    const r = calcular(con({ preferencia: 'low_carb', condiciones: ['diabetes'] }))
    expect(r.preferencia_efectiva).toBe('omnivoro')
    expect(r.avisos).toContain('WARN_LOWCARB_DIABETES')
    expect(r.macros.hc_g).toBeGreaterThanOrEqual(130)
  })

  it('más de 10 horas semanales de entrenamiento emiten INFO_ALTO_RENDIMIENTO', () => {
    const r = calcular(con({ entrenamiento: ent({ tipo: 'fuerza', dias_semana: 6, minutos_sesion: 120, intensidad: 'media', experiencia: 'avanzado', momento: 'tarde' }) }))
    expect(r.avisos).toContain('INFO_ALTO_RENDIMIENTO')
    const justo = calcular(con({ entrenamiento: ent({ tipo: 'fuerza', dias_semana: 5, minutos_sesion: 120, intensidad: 'media', experiencia: 'avanzado', momento: 'tarde' }) }))
    expect(justo.avisos).not.toContain('INFO_ALTO_RENDIMIENTO') // 10 h exactas no bastan
  })

  it('una comida principal con menos de 20 g de proteína emite WARN_PROTEINA_POR_TOMA', () => {
    const r = calcular(con({ sexo: 'mujer', edad: 30, altura_cm: 150, peso_kg: 45, n_comidas: 6, condiciones: ['renal'] }))
    expect(r.avisos).toContain('WARN_PROTEINA_POR_TOMA')
    const principales = r.comidas.filter((c) => c.pct_kcal >= 20)
    expect(principales.some((c) => c.proteina_g < 20)).toBe(true)
  })

  it("renal capa la proteína a 1,0 g/kg y no da objetivo de agua", () => {
    const r = calcular(con({ peso_kg: 80, condiciones: ['renal'] }))
    expect(r.macros.proteina_g).toBeLessThanOrEqual(80)
    expect(r.agua).toBeNull()
    expect(r.avisos).toContain('WARN_RENAL')
    expect(r.avisos).toContain('INFO_AGUA_NO_PRESCRITA')
    expect(r.avisos).not.toContain('INFO_PROTEINA_CAPADA')
  })
})

// ---------------------------------------------------------------- fragmentos condicionales del texto (§4)

describe('Fragmentos condicionales de los textos (§4)', () => {
  const textoDe = (inputs: Inputs, codigo: string): string => {
    const r = calcular(inputs)
    const t = textosAvisos(r, inputs).find((x) => x.codigo === codigo)
    expect(t, `no se emitió ${codigo}`).toBeDefined()
    return t?.texto ?? ''
  }

  it('INFO_DEFICIT_CAPADO_TDEE imprime el cap_pct realmente aplicado (20 % a partir de 65)', () => {
    const v14 = VECTORES.find((v) => v.n === '14') as Vector
    expect(textoDe(v14.inputs, 'INFO_DEFICIT_CAPADO_TDEE')).toContain('20 %')
    const v3 = VECTORES.find((v) => v.n === '3') as Vector
    expect(textoDe(v3.inputs, 'INFO_DEFICIT_CAPADO_TDEE')).toContain('30 %')
    const v8 = VECTORES.find((v) => v.n === '8') as Vector
    expect(textoDe(v8.inputs, 'INFO_DEFICIT_CAPADO_TDEE')).toContain('25 %')
  })

  it('WARN_PERDIDA_MAYOR_65 solo menciona el ritmo si se ha suavizado', () => {
    const v14 = VECTORES.find((v) => v.n === '14') as Vector // agresivo → moderado
    expect(textoDe(v14.inputs, 'WARN_PERDIDA_MAYOR_65')).toContain('y suavizado el ritmo')
    const suave = con({ sexo: 'mujer', edad: 70, altura_cm: 158, peso_kg: 75, objetivo: 'perder', ritmo: 'suave', n_comidas: 4 })
    expect(textoDe(suave, 'WARN_PERDIDA_MAYOR_65')).not.toContain('suavizado el ritmo')
  })

  it('los WARN_SUELO_CALORICO_* solo prometen calendario si existe cronograma', () => {
    const v3 = VECTORES.find((v) => v.n === '3') as Vector
    expect(calcular(v3.inputs).cronograma).not.toBeNull()
    expect(textoDe(v3.inputs, 'WARN_SUELO_CALORICO_BMR')).toContain('alargado el calendario')

    // Recomposición muy magra: el suelo de disponibilidad energética se activa y no hay cronograma.
    const sinCrono = con({ sexo: 'mujer', edad: 30, altura_cm: 180, peso_kg: 90, grasa: { metodo: 'conocido', valor: 15, fuente: 'estimado' }, objetivo: 'recomposicion' })
    expect(calcular(sinCrono).cronograma).toBeNull()
    expect(textoDe(sinCrono, 'WARN_SUELO_CALORICO_EA')).not.toContain('calendario')
  })

  it('INFO_PROTEINA_CAPADA imprime el pct_cap aplicado (30 % en dieta vegetal con < 1.800 kcal)', () => {
    const v8 = VECTORES.find((v) => v.n === '8') as Vector // vegana, 1430 kcal
    expect(textoDe(v8.inputs, 'INFO_PROTEINA_CAPADA')).toContain('30 %')
    const v14 = VECTORES.find((v) => v.n === '14') as Vector // omnívora
    expect(textoDe(v14.inputs, 'INFO_PROTEINA_CAPADA')).toContain('35 %')
  })

  it('INFO_MAYOR_60 expresa el mínimo en g/día cuando la base es el peso ajustado', () => {
    const v14 = VECTORES.find((v) => v.n === '14') as Vector // base 74,92 kg ajustada
    expect(textoDe(v14.inputs, 'INFO_MAYOR_60')).toContain('90 g al día')
    const v5 = VECTORES.find((v) => v.n === '5') as Vector // base = peso corporal
    expect(textoDe(v5.inputs, 'INFO_MAYOR_60')).toContain('1,2 g/kg')
  })

  it('WARN_RENAL imprime los gramos de proteína realmente prescritos', () => {
    const v13 = VECTORES.find((v) => v.n === '13') as Vector
    expect(textoDe(v13.inputs, 'WARN_RENAL')).toContain('95 g al día')
  })

  it('INFO_OBJETIVO_RESUELTO nombra el objetivo propuesto', () => {
    const v4 = VECTORES.find((v) => v.n === '4') as Vector
    expect(textoDe(v4.inputs, 'INFO_OBJETIVO_RESUELTO')).toContain('perder grasa')
  })

  it('ningún texto del catálogo deja placeholders sin resolver', () => {
    for (const v of VECTORES) {
      for (const t of textosAvisos(calcular(v.inputs), v.inputs)) {
        expect(t.texto, `${t.codigo} en el caso ${v.n}`).not.toMatch(/[{}]/)
      }
    }
  })
})

// ---------------------------------------------------------------- invariantes sobre los vectores

describe('Invariantes de seguridad sobre los diecinueve vectores', () => {
  it('perder implica al menos 50 kcal de déficit real (S24)', () => {
    for (const v of VECTORES) {
      const r = calcular(v.inputs)
      if (r.objetivo_efectivo === 'perder') {
        expect(r.tdee.valor - r.kcal, `caso ${v.n}`).toBeGreaterThanOrEqual(50)
      }
    }
  })

  it('ningún campo numérico es NaN (S25)', () => {
    for (const v of VECTORES) {
      const r = calcular(v.inputs)
      const recorrer = (x: unknown): void => {
        if (typeof x === 'number') expect(Number.isNaN(x), `caso ${v.n}`).toBe(false)
        else if (Array.isArray(x)) x.forEach(recorrer)
        else if (x && typeof x === 'object') Object.values(x).forEach(recorrer)
      }
      recorrer(r)
    }
  })

  it('los hidratos nunca bajan del mínimo de la §3.1', () => {
    for (const v of VECTORES) {
      const r = calcular(v.inputs)
      const minimo = r.preferencia_efectiva === 'low_carb' ? 75 : 130
      expect(r.macros.hc_g, `caso ${v.n}`).toBeGreaterThanOrEqual(minimo)
    }
  })

  it('ningún par de la tabla de supresión aparece junto', () => {
    const pares: Array<[string, string[]]> = [
      ['INFO_OBJETIVO_IGNORADO', ['WARN_OBJETIVO_INCOHERENTE']],
      ['WARN_IMC_BAJO_NO_DEFICIT', ['WARN_YA_MAGRO']],
      ['WARN_YA_EN_OBJETIVO', ['WARN_YA_MAGRO']],
      ['WARN_RENAL', ['INFO_MAYOR_60', 'INFO_PROTEINA_CAPADA']],
      ['WARN_SIN_MARGEN_DEFICIT', ['WARN_DEFICIT_MINIMO', 'INFO_DEFICIT_CAPADO_TDEE', 'WARN_YA_MAGRO', 'WARN_RECOMPOSICION_SUGERIDA', 'WARN_RECOMPOSICION_SIN_FUERZA']],
      ['INFO_OBJETIVO_RESUELTO_POR_PESO', ['INFO_OBJETIVO_IGNORADO']],
      ['INFO_AGUA_NO_PRESCRITA', ['WARN_AGUA_ALTA', 'INFO_AGUA_MAYORES']],
    ]
    for (const v of VECTORES) {
      const r = calcular(v.inputs)
      for (const [disparador, suprimidos] of pares) {
        if (r.avisos.includes(disparador)) {
          for (const s of suprimidos) expect(r.avisos, `caso ${v.n}: ${disparador} vs ${s}`).not.toContain(s)
        }
      }
    }
  })

  it("con 'tca' no se emite ningún aviso de la lista protegida", () => {
    const ocultos = [
      'INFO_GRASA_ESTIMADA', 'INFO_PESO_YA_MINIMO', 'INFO_IMC_MUSCULADO', 'INFO_ADAPTACION',
      'WARN_YA_MAGRO', 'WARN_YA_EN_OBJETIVO', 'WARN_OBJETIVO_MUY_LEJANO', 'WARN_CRONOGRAMA_LARGO',
      'INFO_SIN_CRONOGRAMA', 'INFO_SIN_CRONOGRAMA_SIN_MARGEN', 'INFO_CRONOGRAMA_NO_ESTIMABLE',
      'INFO_CRONOGRAMA_FUERA_DE_HORIZONTE',
    ]
    const r = calcular(con({ altura_cm: 165, peso_kg: 78, sexo: 'mujer', condiciones: ['tca'], objetivo: 'perder' }))
    for (const c of ocultos) expect(r.avisos).not.toContain(c)
    expect(r.avisos).toContain('INFO_RITMO_SUAVE')
    expect(r.ritmo_efectivo).toBe('suave')
  })
})
