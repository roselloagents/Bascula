// Motor de cálculo de Báscula — implementación de docs/SPEC-calculo.md (pasos 0-17).
// TypeScript puro, sin React ni dependencias, determinista. Las firmas exportadas son las de
// CONTRATO.md y no deben cambiar: la UI, el generador de comidas y el PDF las consumen tal cual.

import { ajustarMacros, techoHidratosAjuste } from './adjust'
import { calcularGrasa } from './bodyfat'
import { calcularBmr, calcularMlg } from './bmr'
import { calcularCalorias } from './calories'
import { calcularCiclo } from './ciclo'
import {
  AJUSTE_KCAL_FACTOR_MAX,
  AJUSTE_KCAL_FACTOR_MIN,
  ALTO_RENDIMIENTO_HORAS,
  EA_MIN,
  EA_MIN_MUY_ALTO,
  HC_MIN_AJUSTE_UI,
  IMC_MUSCULADO_FFMI_HOMBRE,
  IMC_MUSCULADO_FFMI_MUJER,
  IMC_OBJETIVO_MIN,
  KCAL_PASO_AJUSTE,
  MICRONUTRIENTES_KCAL_HOMBRE,
  MICRONUTRIENTES_KCAL_MUJER,
  SUELO_KCAL_HOMBRE,
  SUELO_KCAL_MUJER,
} from './constants'
import { calcularFfmi } from './ffmi'
import { calcularObjetivo } from './goal'
import { calcularFibra, calcularMacros } from './macros'
import { calcularComidas } from './meals'
import type { CodigoAviso, EmitirAviso } from './messages'
import { filtrarAvisos, textoError, textosAvisos } from './messages'
import { normalizarPreferencias } from './preferences'
import { round10, roundUp10 } from './round'
import { calcularPesoObjetivo } from './target'
import { calcularTdee } from './tdee'
import { calcularPaso14 } from './timeline'
import { validarInputs } from './validate'
import { calcularAgua } from './water'
import type {
  Condicion,
  ImcCategoria,
  Inputs,
  LimitesAjuste,
  Menstruacion,
  RecomposicionPrioridad,
  Resultado,
} from './types'

export type * from './types'
export { ajustarMacros, techoHidratosAjuste, textoError, textosAvisos }

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
  // Regla de traducción de las preferencias (§1.1) y normalización de la regla: se hacen aquí,
  // antes de la primera exclusión, para que el resto del motor hable siempre del trío efectivo.
  const { pref_base, restricciones, low_carb_pedido } = normalizarPreferencias(inputs)
  const menstruacion: Menstruacion | null =
    inputs.sexo === 'mujer' ? (inputs.menstruacion ?? null) : null // en hombres se ignora
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
    {
      inputs,
      condiciones,
      imc,
      banda: grasa.banda,
      perfil: tdee.perfil,
      mlg,
      pref_base,
      restricciones,
      low_carb_pedido,
      menstruacion,
      tdee: tdee.valor,
    },
    emitir,
  )
  // `null`/ausente ≡ `'equilibrado'`, que es exactamente el comportamiento v1.0 (§1 fila 22).
  const recomposicion_prioridad: RecomposicionPrioridad = inputs.recomposicion_prioridad ?? 'equilibrado'

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
      recomposicion_prioridad,
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
      recomposicion_prioridad,
      pref_base: objetivo.preferencia_base,
      low_carb: objetivo.low_carb,
      condiciones,
      somatotipo: inputs.somatotipo,
      kcal: calorias.kcal,
    },
    emitir,
  )
  const kcal = macros.kcal

  // ---------------- Paso 10bis — segunda pasada de la regla de margen, contra las kcal ya cerradas
  if (
    !calorias.recomp_sin_deficit &&
    (objetivo_efectivo === 'perder' || objetivo_efectivo === 'recomposicion') &&
    kcal >= tdee.valor - 50
  ) {
    objetivo_efectivo = 'mantener'
    emitir('WARN_SIN_MARGEN_DEFICIT')
  }
  if (objetivo_efectivo === 'perder' && tdee.valor - kcal >= 50 && tdee.valor - kcal < 100) {
    emitir('WARN_DEFICIT_MINIMO')
  }

  // ---------------- Paso 11
  const fibra = calcularFibra(kcal, macros.hc_g, objetivo.low_carb, emitir)

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

  // ---------------- Pasos 14 y 14b
  const { cronograma, proyeccion } = calcularPaso14(
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
  if (objetivo.preferencia_base === 'vegano') emitir('INFO_VEGANO')
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

  // REGLA (decisión D). Se evalúa aquí y no en el paso 6: `objetivo_efectivo` ya no puede cambiar,
  // y la tercera cláusula mira el ritmo ELEGIDO por el usuario (el 6.7bis ya pudo suavizar el
  // efectivo, y entonces la condición se autodestruiría).
  if (menstruacion === 'regular' || menstruacion === 'irregular') emitir('INFO_CICLO')
  if (
    (menstruacion === 'irregular' || menstruacion === 'ausente') &&
    (objetivo_efectivo === 'perder' ||
      grasa.banda === 'muy_bajo' ||
      grasa.banda === 'bajo' ||
      inputs.ritmo === 'agresivo')
  ) {
    emitir('WARN_CICLO_AUSENTE')
  }

  // Reevaluación contra `objetivo_efectivo`: el paso 6 lo emitió contra el objetivo intermedio.
  let avisos: CodigoAviso[] = emitidos
  if (objetivo_efectivo !== 'perder') avisos = avisos.filter((c) => c !== 'WARN_PERDIDA_MAYOR_65')
  // El paso 10bis puede reescribir `objetivo_efectivo` a 'mantener' después de que el paso 7 haya
  // emitido la prioridad de recomposición: entonces `recomposicion_prioridad` no se publica y el
  // aviso hablaría de un déficit que ya no existe.
  if (objetivo_efectivo !== 'recomposicion') {
    avisos = avisos.filter(
      (c) => c !== 'INFO_RECOMP_PRIORIDAD_PERDER' && c !== 'INFO_RECOMP_PRIORIDAD_GANAR',
    )
  }
  // v1.2 (recomposición con déficit): el aviso afirma que "el peso objetivo no se usa", y con la
  // proyección del paso 14 sí se usa, como meta de la curva. Las calorías siguen saliendo de la
  // tabla 3.9, y eso lo explica INFO_PROYECCION_RECOMP.
  if (objetivo_efectivo === 'recomposicion' && peso_objetivo.efectivo !== null) {
    avisos = avisos.filter((c) => c !== 'INFO_OBJETIVO_IGNORADO')
  }
  // v1.2 (PLAZO): los dos avisos del paso 6.7ter hablan de una fecha para una meta de peso. Si el
  // plan final ya no es de perder/ganar se retiran; si un suavizado de seguridad ha bajado el ritmo
  // que el plazo había elegido, o si el propio cronograma sale más largo que el plazo, la promesa
  // deja de ser cierta y el aviso pasa a ser el de plazo irreal.
  const plazo = typeof inputs.plazo_semanas === 'number' && Number.isFinite(inputs.plazo_semanas)
    ? inputs.plazo_semanas
    : null
  if (
    plazo === null ||
    inputs.peso_objetivo === null ||
    inputs.peso_objetivo === undefined ||
    (objetivo_efectivo !== 'perder' && objetivo_efectivo !== 'ganar')
  ) {
    avisos = avisos.filter((c) => c !== 'INFO_RITMO_POR_PLAZO' && c !== 'WARN_PLAZO_IRREAL')
  } else if (objetivo.ritmo_plazo !== null) {
    const no_llega =
      objetivo.ritmo_efectivo !== objetivo.ritmo_plazo ||
      (cronograma !== null && cronograma.semanas[0] > plazo)
    if (no_llega) {
      avisos = avisos.filter((c) => c !== 'INFO_RITMO_POR_PLAZO')
      if (!avisos.includes('WARN_PLAZO_IRREAL')) avisos.push('WARN_PLAZO_IRREAL')
    }
  }
  const tiene_tca = condiciones.includes('tca')
  avisos = filtrarAvisos(avisos, tiene_tca)

  // ---------------- Paso 19 — ciclo (v1.2). Va después del 17 porque depende de `INFO_CICLO` ya
  // filtrado, y no toca ni un número: solo publica `Resultado.ciclo`.
  const ciclo = calcularCiclo({
    hay_info_ciclo: avisos.includes('INFO_CICLO'),
    sintomas_regla: inputs.sintomas_regla ?? null,
    pref_base: objetivo.preferencia_base,
    restricciones: objetivo.restricciones,
    low_carb: objetivo.low_carb,
  })

  // ---------------- Paso 18 — límites del ajuste manual (se publican SIEMPRE, también sin ajuste).
  // Con `'tca'` no hay panel de ajuste: `limites_ajuste` queda `undefined`, igual que `proyeccion`.
  const suelo_sexo = hombre ? SUELO_KCAL_HOMBRE : SUELO_KCAL_MUJER
  const suelo_ea_aj = (grasa.banda === 'muy_alto' ? EA_MIN_MUY_ALTO : EA_MIN) * mlg + tdee.ejercicio_dia
  const suelo_aj =
    objetivo_efectivo === 'perder' || objetivo_efectivo === 'recomposicion'
      ? Math.max(suelo_sexo, bmr.valor, suelo_ea_aj)
      : suelo_sexo
  let kcal_min_aj = roundUp10(suelo_aj)
  let kcal_max_aj: number
  if (objetivo_efectivo === 'perder') {
    kcal_max_aj = round10(tdee.valor)
  } else {
    kcal_min_aj = Math.max(kcal_min_aj, round10(AJUSTE_KCAL_FACTOR_MIN * kcal))
    kcal_max_aj = round10(AJUSTE_KCAL_FACTOR_MAX * kcal)
  }
  // El plan recomendado SIEMPRE cabe dentro de sus propios límites: el `round10` del paso 7 puede
  // dejarlo hasta 5 kcal por debajo del suelo cuando el suelo no llegó a activarse.
  kcal_min_aj = Math.min(kcal_min_aj, kcal)
  kcal_max_aj = Math.max(kcal_max_aj, kcal)
  if (kcal_max_aj < kcal_min_aj) kcal_max_aj = kcal_min_aj
  const limites_ajuste: LimitesAjuste | undefined = tiene_tca
    ? undefined
    : {
        kcal_recomendada: kcal,
        hc_recomendado_g: macros.hc_g,
        grasa_recomendada_g: macros.grasa_g,
        kcal_min: kcal_min_aj,
        kcal_max: kcal_max_aj,
        kcal_paso: KCAL_PASO_AJUSTE,
        hc_min_ui_g: HC_MIN_AJUSTE_UI,
        hc_min_motor_g: macros.hc_min,
        suelo_grasa_abs_g: macros.suelo_grasa_abs_g,
        peso_kg: PC,
        fecha_inicio: inputs.fecha_inicio,
        kcal_micronutrientes: hombre ? MICRONUTRIENTES_KCAL_HOMBRE : MICRONUTRIENTES_KCAL_MUJER,
      }

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
    objetivo_propuesto: objetivo.objetivo_propuesto,
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
      pct_cap: macros.pct_cap,
    },
    agua,
    peso_objetivo,
    cronograma,
    ffmi,
    comidas,
    avisos,
    // ---------------- v1.1
    preferencia_base: objetivo.preferencia_base,
    restricciones: objetivo.restricciones,
    low_carb: objetivo.low_carb,
    recomposicion_prioridad: objetivo_efectivo === 'recomposicion' ? recomposicion_prioridad : undefined,
    // Regla no expuesta: con `'tca'` no se publica la proyección, por el mismo motivo por el que
    // se retiran los avisos de cronograma (paso 17).
    proyeccion: tiene_tca ? undefined : proyeccion,
    limites_ajuste,
    // ---------------- v1.2
    ciclo,
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
    pct_cap: 0,
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
