// Motor de cálculo de Báscula — implementación de docs/SPEC-calculo.md (pasos 0-17).
// TypeScript puro, sin React ni dependencias, determinista. Las firmas exportadas son las de
// CONTRATO.md y no deben cambiar: la UI, el generador de comidas y el PDF las consumen tal cual.

import { calcularGrasa } from './bodyfat'
import { calcularBmr, calcularMlg } from './bmr'
import { calcularCalorias } from './calories'
import {
  ALTO_RENDIMIENTO_HORAS,
  IMC_MUSCULADO_FFMI_HOMBRE,
  IMC_MUSCULADO_FFMI_MUJER,
  IMC_OBJETIVO_MIN,
  MICRONUTRIENTES_KCAL_HOMBRE,
  MICRONUTRIENTES_KCAL_MUJER,
} from './constants'
import { calcularFfmi } from './ffmi'
import { calcularObjetivo } from './goal'
import { calcularFibra, calcularMacros } from './macros'
import { calcularComidas } from './meals'
import type { CodigoAviso, EmitirAviso } from './messages'
import { filtrarAvisos, textoError, textosAvisos } from './messages'
import { calcularPesoObjetivo } from './target'
import { calcularTdee } from './tdee'
import { calcularCronograma } from './timeline'
import { validarInputs } from './validate'
import { calcularAgua } from './water'
import type { Condicion, ImcCategoria, Inputs, Resultado } from './types'

export type * from './types'
export { textoError, textosAvisos }

/** Paso 1 — categoría de IMC (OMS). Bordes estrictos por arriba, no estrictos por abajo. */
function categoriaImc(imc: number): ImcCategoria {
  if (imc < 18.5) return 'bajo_peso'
  if (imc < 25) return 'normal'
  if (imc < 30) return 'sobrepeso'
  if (imc < 35) return 'obesidad_I'
  if (imc < 40) return 'obesidad_II'
  return 'obesidad_III'
}

/**
 * Calcula el plan completo (SPEC §2, pasos 0-17).
 * Con `excluido` presente no hay plan: ningún otro campo debe leerse ni mostrarse.
 */
export function calcular(inputs: Inputs): Resultado {
  const emitidos: CodigoAviso[] = []
  const emitir: EmitirAviso = (codigo) => {
    if (!emitidos.includes(codigo)) emitidos.push(codigo)
  }

  const hombre = inputs.sexo === 'hombre'
  const h = inputs.altura_cm / 100
  const h2 = h * h
  const PC = inputs.peso_kg

  // ---------------- §1 — validación de dominio y rango
  const errores = validarInputs(inputs)
  if (errores.length) return { ...RESULTADO_BLOQUEADO, excluido: 'ERR_INPUT_RANGO', errores }

  // ---------------- Paso 0 — normalización de condiciones y exclusiones, en este orden exacto
  const condiciones: Condicion[] = [...inputs.condiciones]
  if ((inputs.cribado_tca === 'positivo' || inputs.cribado_tca === 'evitado') && !condiciones.includes('tca')) {
    condiciones.push('tca')
  }
  const imc = PC / h2
  if (inputs.edad < 18 || inputs.edad > 75) return { ...RESULTADO_BLOQUEADO, excluido: 'EXCL_EDAD' }
  if (inputs.embarazo_lactancia === true) return { ...RESULTADO_BLOQUEADO, excluido: 'EXCL_EMBARAZO_LACTANCIA' }
  if (imc < 16) return { ...RESULTADO_BLOQUEADO, excluido: 'EXCL_IMC_MUY_BAJO' }
  if (condiciones.includes('tca') && imc < IMC_OBJETIVO_MIN) {
    return { ...RESULTADO_BLOQUEADO, excluido: 'EXCL_TCA_RIESGO' }
  }

  // ---------------- Pasos 1-5
  const imc_categoria = categoriaImc(imc)
  const grasa = calcularGrasa(inputs, imc, emitir)
  const mlg = calcularMlg(PC, grasa.pct)
  const bmr = calcularBmr({
    sexo: inputs.sexo,
    edad: inputs.edad,
    alturaCm: inputs.altura_cm,
    pesoKg: PC,
    mlg,
    metodoEfectivo: grasa.metodo_efectivo,
    fiabilidad: grasa.fiabilidad,
  })
  const tdee = calcularTdee(inputs, bmr.valor, emitir)

  // ---------------- Paso 6
  const objetivo = calcularObjetivo(
    { inputs, condiciones, imc, banda: grasa.banda, perfil: tdee.perfil, mlg },
    emitir,
  )

  // ---------------- Paso 7
  const calorias = calcularCalorias(
    {
      sexo: inputs.sexo,
      edad: inputs.edad,
      pesoKg: PC,
      imc,
      banda: grasa.banda,
      perfil: tdee.perfil,
      experiencia: inputs.entrenamiento.experiencia,
      objetivo_efectivo: objetivo.objetivo_efectivo,
      ritmo_efectivo: objetivo.ritmo_efectivo,
      tdee: tdee.valor,
      bmr: bmr.valor,
      mlg,
      ejercicio_dia: tdee.ejercicio_dia,
    },
    emitir,
  )
  let objetivo_efectivo = calorias.objetivo_efectivo

  // ---------------- Pasos 8, 9 y 10
  const macros = calcularMacros(
    {
      sexo: inputs.sexo,
      edad: inputs.edad,
      pesoKg: PC,
      h2,
      imc,
      banda: grasa.banda,
      perfil: tdee.perfil,
      objetivo_efectivo,
      ritmo_efectivo: objetivo.ritmo_efectivo,
      preferencia_efectiva: objetivo.preferencia_efectiva,
      condiciones,
      somatotipo: inputs.somatotipo,
      kcal: calorias.kcal,
    },
    emitir,
  )
  const kcal = macros.kcal

  // ---------------- Paso 10bis — segunda pasada de la regla de margen, contra las kcal ya cerradas
  if ((objetivo_efectivo === 'perder' || objetivo_efectivo === 'recomposicion') && kcal >= tdee.valor - 50) {
    objetivo_efectivo = 'mantener'
    emitir('WARN_SIN_MARGEN_DEFICIT')
  }
  if (objetivo_efectivo === 'perder' && tdee.valor - kcal >= 50 && tdee.valor - kcal < 100) {
    emitir('WARN_DEFICIT_MINIMO')
  }

  // ---------------- Paso 11
  const fibra = calcularFibra(kcal, macros.hc_g, objetivo.preferencia_efectiva, emitir)

  // ---------------- Paso 12
  const agua = calcularAgua(
    {
      sexo: inputs.sexo,
      edad: inputs.edad,
      pesoKg: PC,
      actividad_diaria: inputs.actividad_diaria,
      condiciones,
      perfil: tdee.perfil,
      dias: tdee.dias,
      minutos_sesion: inputs.entrenamiento.minutos_sesion,
      clima_caluroso: inputs.clima_caluroso,
    },
    emitir,
  )

  // ---------------- Paso 13
  const peso_objetivo = calcularPesoObjetivo(
    {
      sexo: inputs.sexo,
      edad: inputs.edad,
      alturaCm: inputs.altura_cm,
      pesoKg: PC,
      h2,
      mlg,
      fiabilidad: grasa.fiabilidad,
      objetivo_efectivo,
      peso_objetivo: inputs.peso_objetivo ?? null,
      g_c: objetivo.g_c,
      g_lo: objetivo.g_lo,
      g_hi: objetivo.g_hi,
      kcal,
      tdee: tdee.valor,
    },
    emitir,
  )

  // ---------------- Paso 14
  const cronograma = calcularCronograma(
    {
      objetivo_efectivo,
      pesoKg: PC,
      peso_obj_ef: peso_objetivo.efectivo,
      kcal,
      tdee: tdee.valor,
      fecha_inicio: inputs.fecha_inicio,
    },
    emitir,
  )

  // ---------------- Paso 15
  const ffmi = calcularFfmi(inputs.sexo, mlg, h, grasa.banda)

  // ---------------- Paso 16
  const comidas = calcularComidas(
    {
      n_comidas: inputs.n_comidas,
      perfil: tdee.perfil,
      momento: inputs.entrenamiento.momento,
      pesoKg: PC,
      proteina_g: macros.proteina_g,
      grasa_g: macros.grasa_g,
      hc_g: macros.hc_g,
    },
    emitir,
  )

  // ---------------- Paso 17 — avisos finales
  if (imc < IMC_OBJETIVO_MIN) emitir('WARN_IMC_BAJO')
  if (imc >= 35 && imc < 40) emitir('WARN_IMC_35')
  if (imc >= 40) emitir('WARN_IMC_40')
  const es_renal = condiciones.includes('renal')
  if (inputs.edad >= 60 && !es_renal) emitir('INFO_MAYOR_60')
  if (inputs.edad >= 60 && es_renal) emitir('INFO_MAYOR_60_RENAL')
  if (objetivo.preferencia_efectiva === 'vegano') emitir('INFO_VEGANO')
  if (
    ffmi.normalizado >= (hombre ? IMC_MUSCULADO_FFMI_HOMBRE : IMC_MUSCULADO_FFMI_MUJER) &&
    imc >= 25 &&
    (grasa.banda === 'muy_bajo' || grasa.banda === 'bajo' || grasa.banda === 'medio')
  ) {
    emitir('INFO_IMC_MUSCULADO')
  }
  if (grasa.fiabilidad === 'baja') emitir('INFO_GRASA_ESTIMADA')
  if (
    tdee.perfil !== 'sedentario' &&
    tdee.dias * inputs.entrenamiento.minutos_sesion / 60 > ALTO_RENDIMIENTO_HORAS
  ) {
    emitir('INFO_ALTO_RENDIMIENTO')
  }
  if (kcal < (hombre ? MICRONUTRIENTES_KCAL_HOMBRE : MICRONUTRIENTES_KCAL_MUJER)) emitir('INFO_MICRONUTRIENTES')

  // Reevaluación contra `objetivo_efectivo`: el paso 6 lo emitió contra el objetivo intermedio.
  let avisos: CodigoAviso[] = emitidos
  if (objetivo_efectivo !== 'perder') avisos = avisos.filter((c) => c !== 'WARN_PERDIDA_MAYOR_65')
  avisos = filtrarAvisos(avisos, condiciones.includes('tca'))

  return {
    imc,
    imc_categoria,
    grasa: {
      pct: grasa.pct,
      rango: grasa.rango,
      fiabilidad: grasa.fiabilidad,
      metodo_efectivo: grasa.metodo_efectivo,
      banda: grasa.banda,
      referencias: grasa.referencias,
    },
    mlg,
    bmr,
    tdee: {
      valor: tdee.valor,
      bruto: tdee.bruto,
      pal: tdee.pal,
      ejercicio_dia: tdee.ejercicio_dia,
      perfil: tdee.perfil,
    },
    objetivo_efectivo,
    ritmo_efectivo: objetivo.ritmo_efectivo,
    preferencia_efectiva: objetivo.preferencia_efectiva,
    kcal,
    kcal_cierre: macros.kcal_cierre,
    macros: {
      proteina_g: macros.proteina_g,
      grasa_g: macros.grasa_g,
      hc_g: macros.hc_g,
      fibra_g: fibra.fibra_g,
      azucares_libres_max_g: fibra.azucares_libres_max_g,
      pct: {
        p: 4 * macros.proteina_g / kcal,
        g: 9 * macros.grasa_g / kcal,
        hc: 4 * macros.hc_g / kcal,
      },
      gkg: { p: macros.proteina_g / PC, g: macros.grasa_g / PC, hc: macros.hc_g / PC },
      base_proteina: macros.base_proteina,
      base_kg: macros.base_kg,
      somatotipo: macros.somatotipo,
    },
    agua,
    peso_objetivo,
    cronograma,
    ffmi,
    comidas,
    avisos,
  }
}

// En una exclusión el motor no devuelve ningún número (SPEC Paso 0): esta plantilla deja todos los
// campos a cero/vacío de forma tipada, pero la interfaz no debe leer ninguno.
const RESULTADO_BLOQUEADO: Resultado = {
  imc: 0,
  imc_categoria: 'normal',
  grasa: {
    pct: 0,
    rango: [0, 0],
    fiabilidad: 'baja',
    metodo_efectivo: 'desconocido',
    banda: 'medio',
    referencias: { cunbae: 0, deurenberg: 0 },
  },
  mlg: 0,
  bmr: { valor: 0, ecuacion: 'mifflin', referencias: { mifflin: 0, katch: 0, harris: 0 } },
  tdee: { valor: 0, bruto: 0, pal: 0, ejercicio_dia: 0, perfil: 'sedentario' },
  objetivo_efectivo: 'mantener',
  ritmo_efectivo: 'suave',
  preferencia_efectiva: 'omnivoro',
  kcal: 0,
  kcal_cierre: 0,
  macros: {
    proteina_g: 0,
    grasa_g: 0,
    hc_g: 0,
    fibra_g: 0,
    azucares_libres_max_g: 0,
    pct: { p: 0, g: 0, hc: 0 },
    gkg: { p: 0, g: 0, hc: 0 },
    base_proteina: 'peso_corporal',
    base_kg: 0,
    somatotipo: 'mesomorfo',
  },
  agua: null,
  peso_objetivo: {
    efectivo: null,
    sugerido: 0,
    mostrar_central: false,
    rango: [0, 0],
    metodo: 'actual',
    hito_intermedio: null,
    referencias: { imc22: 0, rango_imc: [0, 0], clasicas: null },
  },
  cronograma: null,
  ffmi: { valor: 0, normalizado: 0, categoria: null },
  comidas: [],
  avisos: [],
}
