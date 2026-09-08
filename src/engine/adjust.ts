// Paso 18 — ajuste manual de macros (SPEC-calculo.md §2, paso 18; SPEC-ux §2.2b).
//
// `ajustarMacros` NO lee `resultado.macros.grasa_g` ni `resultado.macros.hc_g`: parte siempre de
// los valores recomendados que viajan en `limites_ajuste`. Por eso es idempotente respecto al
// origen —`ajustarMacros(ajustarMacros(R, a1), a2) === ajustarMacros(R, a2)`— y con un ajuste
// vacío devuelve el plan recomendado bit a bit, que es lo que hace trivial "volver a lo
// recomendado" y lo que permite guardar en `localStorage` solo el ajuste, no el plan entero.
//
// La PROTEÍNA no se toca nunca: en déficit es la que preserva la masa magra (Helms 2014,
// Longland 2016), la misma razón por la que el orden de sacrificio del paso 10 la deja al final.
// El techo de grasa del paso 9 NO se aplica aquí (bajar los hidratos a 30 g empuja la grasa por
// encima del 40 % y bloquearlo dejaría el deslizador sin recorrido); el suelo sí, y es él quien
// fija `hc_max` y quien gana sobre el mínimo de 30 g cuando los dos entran en conflicto.

import {
  AJUSTE_DEFICIT_MIN,
  FIBRA_LOWCARB_POR_1000_KCAL,
  FIBRA_MAX,
  FIBRA_POR_1000_KCAL,
  FIBRA_REFERENCIA,
  FIBRA_SUELO_LOWCARB,
  FIBRA_SUELO_PCT_HC,
  GRASA_SUELO_PCT_KCAL,
  PERI_PUNTOS_HC,
} from './constants'
import type { CodigoAviso, EmitirAviso } from './messages'
import { AVISOS_REEVALUADOS_AJUSTE, SUPRESIONES } from './messages'
import { clamp, round10, round5, roundDown5, roundUp5 } from './round'
import { calcularPaso14 } from './timeline'
import type { AjusteMacros, Comida, LimitesAjuste, Resultado } from './types'

/**
 * Techo del deslizador de hidratos con unas kcal dadas (SPEC Paso 18, punto 2). Lo usan el motor
 * y el panel de la pantalla: si cada uno calculase el suyo, el deslizador podría ofrecer un valor
 * que `ajustarMacros` recorta después.
 *
 * Se calcula contra el suelo de grasa **ya redondeado** (`roundUp5`), que es el valor que el punto
 * 3 acaba poniendo en la grasa. Contra el suelo exacto se colaban hasta 5 g (45 kcal) de más y el
 * cierre se salía del 2 % con kcal bajas.
 */
export function techoHidratosAjuste(L: LimitesAjuste, proteina_g: number, kcal: number): number {
  const suelo_g = Math.max(L.suelo_grasa_abs_g, (GRASA_SUELO_PCT_KCAL * kcal) / 9)
  const techo = roundDown5((kcal - 4 * proteina_g - 9 * roundUp5(suelo_g)) / 4)
  // El redondeo a 5 g del paso 10 puede dejar `hc_recomendado_g` por encima de la cota exacta:
  // sin esta línea "volver a lo recomendado" no devolvía el plan recomendado.
  return kcal === L.kcal_recomendada ? Math.max(techo, L.hc_recomendado_g) : techo
}

/** Índice del mayor valor de `vec`, ignorando `omitir`; en empate, el índice más bajo. */
function indiceMayor(vec: readonly number[], omitir: number): number {
  let mejor = -1
  let valor = -Infinity
  for (let i = 0; i < vec.length; i++) {
    if (i === omitir) continue
    if (vec[i] > valor) {
      valor = vec[i]
      mejor = i
    }
  }
  return mejor
}

/**
 * Panel "Ajusta tus macros" (SPEC Paso 18). Puro, determinista y **sin `Inputs`**: todo lo que
 * necesita viaja en `Resultado.limites_ajuste`. Con `excluido` o sin `limites_ajuste`
 * (`'tca' ∈ condiciones`) devuelve el `Resultado` tal cual.
 */
export function ajustarMacros(resultado: Resultado, ajuste: AjusteMacros): Resultado {
  if (!resultado || resultado.excluido || !resultado.limites_ajuste) return resultado
  const L = resultado.limites_ajuste
  const P = resultado.macros.proteina_g // la proteína NO se toca nunca
  const TDEE = resultado.tdee.valor
  const obje = resultado.objetivo_efectivo
  const PC = L.peso_kg

  // ---------------- 1. calorías: múltiplo de 10 dentro de [kcal_min, kcal_max]
  const kcal_pedidas = ajuste?.kcal ?? L.kcal_recomendada
  const kcal = clamp(round10(kcal_pedidas), L.kcal_min, L.kcal_max)

  // ---------------- 2. hidratos: múltiplo de 5, entre 30 g y lo que deja el SUELO de grasa
  const suelo_g = Math.max(L.suelo_grasa_abs_g, (GRASA_SUELO_PCT_KCAL * kcal) / 9)
  // Con el techo calculado contra el suelo ya redondeado, `G` nunca cae por debajo del suelo y la
  // única desviación del cierre es el redondeo a 5 g de la propia grasa (≤ 22,5 kcal).
  const suelo_red_g = roundUp5(suelo_g)
  const hc_max = techoHidratosAjuste(L, P, kcal)
  const hc_lo = Math.min(L.hc_min_ui_g, hc_max) // el suelo de grasa manda sobre los 30 g
  const hc_pedidos = ajuste?.hc_g ?? L.hc_recomendado_g
  const HC = clamp(round5(hc_pedidos), hc_lo, hc_max)

  const cambia_kcal = kcal !== L.kcal_recomendada
  const cambia_hc = HC !== L.hc_recomendado_g
  const ajustado = cambia_kcal || cambia_hc

  // ---------------- 3. grasa: el resto. Sin ajuste se restituye EXACTAMENTE la recomendada.
  let G: number
  if (!ajustado) {
    G = L.grasa_recomendada_g
  } else {
    G = round5((kcal - 4 * P - 4 * HC) / 9)
    // Red de seguridad: con el techo de hidratos del punto 2 ya no puede dispararse.
    if (G < suelo_red_g) G = suelo_red_g // redondeo dirigido (§0.1); el suelo es inviolable
  }
  const kcal_cierre = 4 * P + 4 * HC + 9 * G
  if (Math.abs(kcal_cierre - kcal) > 0.02 * kcal) {
    throw new Error('paso 18: kcal_cierre fuera de tolerancia')
  }

  // ---------------- 5a. avisos: se retira todo lo que el ajuste puede cambiar
  let avisos: CodigoAviso[] = (resultado.avisos as CodigoAviso[]).filter(
    (c) => !AVISOS_REEVALUADOS_AJUSTE.includes(c),
  )
  const emitir: EmitirAviso = (codigo) => {
    if (!avisos.includes(codigo)) avisos.push(codigo)
  }

  // ---------------- 4a. paso 11 completo con las kcal y los HC nuevos
  const fibra_prop = (FIBRA_POR_1000_KCAL * kcal) / 1000
  const suelo_fibra = resultado.low_carb
    ? Math.max(FIBRA_SUELO_LOWCARB, (FIBRA_LOWCARB_POR_1000_KCAL * kcal) / 1000)
    : Math.min(FIBRA_REFERENCIA, FIBRA_SUELO_PCT_HC * HC)
  const fibra_g = Math.round(clamp(fibra_prop, suelo_fibra, FIBRA_MAX))
  if (fibra_g < FIBRA_REFERENCIA) emitir('INFO_FIBRA_AJUSTADA')
  if (kcal < L.kcal_micronutrientes) emitir('INFO_MICRONUTRIENTES')

  // ---------------- 4b. paso 14 completo con las kcal nuevas (misma meta y misma función)
  const { cronograma, proyeccion } = calcularPaso14(
    {
      objetivo_efectivo: obje,
      pesoKg: PC,
      peso_obj_ef: resultado.peso_objetivo.efectivo,
      kcal,
      tdee: TDEE,
      fecha_inicio: L.fecha_inicio,
    },
    emitir,
  )

  // ---------------- 4c. paso 16 con el MISMO vector de % y la MISMA comida peri.
  // `P_i` no cambia, así que WARN_PROTEINA_POR_TOMA y WARN_PROTEINA_TOMA_ALTA tampoco.
  const p = resultado.comidas.map((c) => c.pct_kcal)
  const i_peri = resultado.comidas.findIndex((c) => c.peri)
  const hcv = [...p]
  if (i_peri !== -1) {
    hcv[i_peri] += PERI_PUNTOS_HC
    hcv[indiceMayor(p, i_peri)] -= PERI_PUNTOS_HC
  }
  const principal = indiceMayor(p, -1)
  const repartir = (total: number, vector: readonly number[]): number[] => {
    const partes = vector.map((v) => round5((total * v) / 100))
    partes[principal] += total - partes.reduce((a, b) => a + b, 0)
    return partes
  }
  const P_i = repartir(P, p)
  const G_i = repartir(G, p)
  const HC_i = repartir(HC, hcv)
  const comidas: Comida[] = resultado.comidas.map((c, i) => ({
    ...c,
    proteina_g: P_i[i],
    grasa_g: G_i[i],
    hc_g: HC_i[i],
    kcal: 4 * P_i[i] + 9 * G_i[i] + 4 * HC_i[i],
  }))

  // ---------------- 5b. avisos propios del paso 18
  if (ajustado) emitir('INFO_AJUSTE_MANUAL')
  if (HC < L.hc_min_motor_g) emitir('WARN_HC_BAJO_MINIMO')
  // Solo si el usuario ha movido de verdad la palanca de las kcal: si no, el plan es el del motor
  // y acusarle de un déficit que no ha puesto borraría el WARN_DEFICIT_MINIMO honesto (invariante
  // S27: con `ajuste` vacío se devuelve el plan recomendado bit a bit, avisos incluidos).
  if (cambia_kcal && obje === 'perder' && TDEE - kcal < AJUSTE_DEFICIT_MIN) {
    emitir('WARN_KCAL_AJUSTE_ALTA')
  }
  if (obje === 'perder' && TDEE - kcal >= 50 && TDEE - kcal < AJUSTE_DEFICIT_MIN) {
    emitir('WARN_DEFICIT_MINIMO')
  }
  for (const [disparador, suprimidos] of SUPRESIONES) {
    if (avisos.includes(disparador)) avisos = avisos.filter((c) => !suprimidos.includes(c))
  }
  // Los avisos que sobreviven conservan su orden de entrada y los reemitidos se añaden al final:
  // el orden no es significativo (§ paso 17) y "bit a bit" se refiere al conjunto y a los números.

  // ---------------- 6. salida: el resto de campos se copia tal cual, `limites_ajuste` incluido
  const salida: Resultado = {
    ...resultado,
    kcal,
    kcal_cierre,
    macros: {
      ...resultado.macros,
      grasa_g: G,
      hc_g: HC,
      fibra_g,
      azucares_libres_max_g: (0.1 * kcal) / 4,
      pct: { p: (4 * P) / kcal, g: (9 * G) / kcal, hc: (4 * HC) / kcal },
      gkg: { p: P / PC, g: G / PC, hc: HC / PC },
    },
    cronograma,
    proyeccion,
    comidas,
    avisos,
    ajuste: { kcal: cambia_kcal, hc: cambia_hc },
  }
  if (!ajustado) delete salida.ajuste
  return salida
}
