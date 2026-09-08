// Pasos 8, 9, 10 y 11 — proteína, grasa, hidratos (resto + factibilidad) y fibra
// (SPEC-calculo.md §2). El orden importa: la proteína usa las kcal ya redondeadas, la grasa usa la
// proteína ya redondeada y los hidratos absorben el residuo. Orden de sacrificio: grasa → proteína →
// subir kcal (normativo, vale también para el generador de menús).

import {
  FIBRA_LOWCARB_POR_1000_KCAL,
  FIBRA_MAX,
  FIBRA_POR_1000_KCAL,
  FIBRA_REFERENCIA,
  FIBRA_SUELO_LOWCARB,
  FIBRA_SUELO_PCT_HC,
  GRASA_PCT_GANAR,
  GRASA_PCT_LOWCARB,
  GRASA_PCT_MANTENER,
  GRASA_PCT_PERDER,
  GRASA_PCT_PERDER_AGRESIVO,
  GRASA_PCT_RECOMPOSICION,
  GRASA_PCT_RECOMPOSICION_PERDER,
  GRASA_SUELO_GKG_HOMBRE,
  GRASA_SUELO_GKG_MUJER,
  GRASA_SUELO_PCT_KCAL,
  GRASA_TECHO_PCT_KCAL,
  GRASA_TECHO_PCT_KCAL_LOWCARB,
  HC_MIN,
  HC_MIN_LOWCARB,
  PROTEINA_GKG,
  PROT_CAP_RENAL,
  PROT_FACTOR_VEGANO,
  PROT_FACTOR_VEGETARIANO,
  PROT_KCAL_VEGETAL_UMBRAL,
  PROT_LINEA_ROJA,
  PROT_MIN_BARIATRICA_GLP1,
  PROT_PCT_CAP,
  PROT_PCT_CAP_VEGETAL,
  PROT_TECHO_GKG,
  PROT_TECHO_GKG_AJUSTADO,
  PROT_TECHO_GKG_PC,
  SOMATOTIPO_DESPLAZAMIENTO,
  SOMA_Q1,
  SOMA_Q2,
  SOMA_Q4,
} from './constants'
import type { EmitirAviso } from './messages'
import { clamp, round5, roundDown5, roundUp10, roundUp5 } from './round'
import type {
  BandaGrasa,
  BaseProteina,
  Condicion,
  InputSomatotipo,
  ObjetivoEfectivo,
  Perfil,
  PreferenciaBase,
  RecomposicionPrioridad,
  Ritmo,
  Sexo,
  Somatotipo,
} from './types'

/** §3.2 — clasificación del somatotipo. Solo desplaza kcal no proteicas entre grasa e hidratos. */
export function clasificarSomatotipo(s: InputSomatotipo | null): Somatotipo {
  if (!s) return 'mesomorfo'
  let S = SOMA_Q1[s.q1] + SOMA_Q2[s.q2] + SOMA_Q4[s.q4]
  if (s.q3 === 'mucha' && S !== 0) S = S - Math.sign(S)
  if (s.q3 === 'poca' && S < 0) S = Math.max(S - 1, -3)
  if (S <= -2) return 'ectomorfo'
  if (S >= 2) return 'endomorfo'
  return 'mesomorfo'
}

export interface EntradaMacros {
  sexo: Sexo
  edad: number
  pesoKg: number
  h2: number
  imc: number
  banda: BandaGrasa
  perfil: Perfil
  objetivo_efectivo: ObjetivoEfectivo
  ritmo_efectivo: Ritmo
  /** Prioridad de recomposición ya resuelta (paso 9: `perder` sube la grasa 5 puntos). */
  recomposicion_prioridad: RecomposicionPrioridad
  /** Base dietética efectiva: es ella —no el banco— la que multiplica la proteína (§1.1). */
  pref_base: PreferenciaBase
  /** Interruptor bajo en hidratos ya efectivo (el paso 6.8 lo anula con `diabetes`). */
  low_carb: boolean
  condiciones: readonly Condicion[]
  somatotipo: InputSomatotipo | null
  kcal: number
}

export interface SalidaMacros {
  kcal: number
  proteina_g: number
  grasa_g: number
  hc_g: number
  kcal_cierre: number
  gkg_efectivo: number
  base_kg: number
  base_proteina: BaseProteina
  somatotipo: Somatotipo
  p_cap: number
  /** Fracción de kcal del cap de proteína realmente aplicada en el paso 8 (0,35 o 0,30). */
  pct_cap: number
  suelo_g: number
  techo_g: number
  /** Mínimo de hidratos del paso 10 (130 g, o 75 g con `low_carb`), para `limites_ajuste`. */
  hc_min: number
  /** Parte absoluta del suelo de grasa del paso 9: `(0,7 H / 0,8 M) · base_kg`. */
  suelo_grasa_abs_g: number
}

export function calcularMacros(e: EntradaMacros, emitir: EmitirAviso): SalidaMacros {
  const hombre = e.sexo === 'hombre'
  const PC = e.pesoKg
  const pref_base = e.pref_base
  const low_carb = e.low_carb
  const es_renal = e.condiciones.includes('renal')
  let kcal = e.kcal

  // ---------------- Paso 8 — proteína
  const PC30 = 30 * e.h2
  const PA = PC30 + 0.25 * (PC - PC30) // peso ajustado
  const base = e.imc >= 30 ? PA : PC
  const base_proteina: BaseProteina = e.imc >= 30 ? 'peso_ajustado' : 'peso_corporal'

  let gkg: number
  if (e.imc >= 30) {
    gkg = PROTEINA_GKG.sedentario[e.objetivo_efectivo] // fila de obesidad (Weijs 2024)
    if (e.perfil !== 'sedentario') gkg += 0.2
  } else {
    gkg = PROTEINA_GKG[e.perfil][e.objetivo_efectivo]
  }
  if (e.edad >= 60) gkg += 0.2
  if (e.objetivo_efectivo === 'perder' && e.ritmo_efectivo === 'agresivo') gkg += 0.2
  if (
    (e.objetivo_efectivo === 'perder' || e.objetivo_efectivo === 'recomposicion') &&
    (e.banda === 'muy_bajo' || e.banda === 'bajo')
  ) {
    gkg += 0.2
  }
  if (e.edad >= 60) gkg = Math.max(gkg, e.perfil === 'fuerza' ? 1.6 : 1.2)
  if (e.condiciones.includes('bariatrica') || e.condiciones.includes('glp1')) {
    gkg = Math.max(gkg, PROT_MIN_BARIATRICA_GLP1)
  }
  // La BASE dietética, no el banco: un usuario vegano y bajo en hidratos sigue siendo vegano.
  if (pref_base === 'vegano') gkg = gkg * PROT_FACTOR_VEGANO
  if (pref_base === 'vegetariano') gkg = gkg * PROT_FACTOR_VEGETARIANO
  // El techo es SIEMPRE el último filtro de g/kg, después de los multiplicadores de preferencia.
  gkg = Math.min(gkg, e.imc >= 30 ? PROT_TECHO_GKG_AJUSTADO : PROT_TECHO_GKG)

  if (e.condiciones.includes('hepatica')) emitir('WARN_HEPATICA')
  if (e.condiciones.includes('diabetes')) emitir('WARN_DIABETES')
  if (e.condiciones.includes('cardiaca')) emitir('WARN_CARDIACA')
  if (e.condiciones.includes('hipertension')) emitir('WARN_HIPERTENSION')
  if (e.condiciones.includes('tiroides')) emitir('WARN_TIROIDES')
  if (e.condiciones.includes('bariatrica') || e.condiciones.includes('glp1'))
    emitir('WARN_BARIATRICA_GLP1')
  if (e.condiciones.includes('otra')) emitir('WARN_CONDICION_OTRA')

  const pctCap = (): number =>
    (pref_base === 'vegano' || pref_base === 'vegetariano') && kcal < PROT_KCAL_VEGETAL_UMBRAL
      ? PROT_PCT_CAP_VEGETAL
      : PROT_PCT_CAP
  const calcularPcap = (): number => Math.min(PROT_TECHO_GKG_PC * PC, (pctCap() * kcal) / 4)

  const P_raw = gkg * base
  let p_cap = calcularPcap()
  // Se guarda el porcentaje con el que se calculó el cap que de verdad limita la proteína: los
  // pasos 9 y 10 pueden subir las kcal después y `resultado.kcal` ya no serviría para deducirlo.
  let pct_cap = pctCap()
  let P = Math.min(P_raw, p_cap)
  P = Math.max(P, PROT_LINEA_ROJA * PC) // línea roja RDA
  if (P < P_raw) emitir('INFO_PROTEINA_CAPADA')

  if (es_renal) {
    // Cap renal: último filtro de todos, sobre el peso corporal real.
    P = Math.min(P, PROT_CAP_RENAL * PC)
    P = roundDown5(P)
    emitir('WARN_RENAL')
  } else {
    P = P === p_cap ? roundDown5(P) : round5(P)
    if (P < PROT_LINEA_ROJA * PC) P = roundUp5(PROT_LINEA_ROJA * PC)
  }

  // Suelo del bucle del paso 10: cerrado por arriba con el cap renal y por abajo con la línea roja.
  const calcularPmin = (): number => {
    let v = (e.edad >= 60 ? (e.perfil === 'fuerza' ? 1.6 : 1.2) : 1.2) * base
    if (es_renal) v = Math.min(v, PROT_CAP_RENAL * PC)
    else v = Math.max(v, PROT_LINEA_ROJA * PC)
    return v
  }
  let p_min = calcularPmin()

  // ---------------- Paso 9 — grasa
  const pct_grasa = low_carb
    ? GRASA_PCT_LOWCARB
    : e.objetivo_efectivo === 'perder'
      ? e.ritmo_efectivo === 'agresivo'
        ? GRASA_PCT_PERDER_AGRESIVO
        : GRASA_PCT_PERDER
      : e.objetivo_efectivo === 'recomposicion'
        ? e.recomposicion_prioridad === 'perder'
          ? GRASA_PCT_RECOMPOSICION_PERDER
          : GRASA_PCT_RECOMPOSICION
        : e.objetivo_efectivo === 'mantener'
          ? GRASA_PCT_MANTENER
          : GRASA_PCT_GANAR
  const suelo_gkg = hombre ? GRASA_SUELO_GKG_HOMBRE : GRASA_SUELO_GKG_MUJER
  const pctTecho = low_carb ? GRASA_TECHO_PCT_KCAL_LOWCARB : GRASA_TECHO_PCT_KCAL
  const calcularSueloG = (): number => Math.max(suelo_gkg * base, (GRASA_SUELO_PCT_KCAL * kcal) / 9)
  const calcularTechoG = (): number => (pctTecho * kcal) / 9

  let suelo_g = calcularSueloG()
  let techo_g = calcularTechoG()

  /**
   * Faltan calorías para cuadrar los macros: se suben las kcal en vez de forzar la grasa.
   * La franja no basta con que exista (`suelo_g ≤ techo_g`): tiene que contener algún múltiplo
   * de 5 g, porque la grasa se prescribe redondeada a 5. Si no lo contiene, el redondeo dirigido
   * del final del paso 9 deja G por debajo del suelo obligatorio sin ningún aviso.
   */
  const asegurarFranjaGrasa = (): void => {
    for (let it = 0; roundUp5(suelo_g) > techo_g; it++) {
      if (it > 10) throw new Error('paso 9: la franja de grasa no converge')
      kcal = roundUp10((roundUp5(suelo_g) * 9) / pctTecho)
      emitir('WARN_KCAL_INSUFICIENTES_PARA_MACROS')
      suelo_g = calcularSueloG()
      techo_g = calcularTechoG()
      p_cap = calcularPcap()
      if (P > p_cap) {
        P = roundDown5(p_cap)
        pct_cap = pctCap()
      }
    }
  }
  asegurarFranjaGrasa()

  const G0 = clamp((pct_grasa * kcal) / 9, suelo_g, techo_g)
  const soma = clasificarSomatotipo(e.somatotipo)
  const delta = (SOMATOTIPO_DESPLAZAMIENTO * (kcal - 4 * P)) / 9
  let G1: number
  if (!low_carb && soma === 'endomorfo') {
    G1 = Math.min(G0 + delta, techo_g)
    emitir('INFO_SOMATOTIPO')
  } else if (!low_carb && soma === 'ectomorfo') {
    G1 = Math.max(G0 - delta, suelo_g)
    emitir('INFO_SOMATOTIPO')
  } else {
    G1 = G0
  }
  let G = round5(G1)
  if (G < suelo_g) G = roundUp5(suelo_g)
  if (G > techo_g) G = roundDown5(techo_g)

  // ---------------- Paso 10 — hidratos (resto) y factibilidad
  const hc_min = low_carb ? HC_MIN_LOWCARB : HC_MIN
  let HC = 0
  for (let it = 0; ; it++) {
    // Agotar el tope es un fallo del motor, no una salida válida (§ paso 10).
    if (it > 4000) throw new Error('paso 10: el bucle de factibilidad no converge')
    HC = (kcal - 4 * P - 9 * G) / 4
    if (HC >= hc_min) break
    if (G - 5 >= suelo_g) {
      G = G - 5 // la grasa se sacrifica PRIMERO
      continue
    }
    if (P - 5 >= p_min) {
      P = P - 5 // la proteína es la última variable que se toca
      continue
    }
    kcal = kcal + 50
    emitir('WARN_DEFICIT_INFACTIBLE')
    suelo_g = calcularSueloG()
    techo_g = calcularTechoG()
    p_cap = calcularPcap()
    p_min = calcularPmin()
    if (P > p_cap) {
      P = roundDown5(p_cap)
      pct_cap = pctCap()
    }
    asegurarFranjaGrasa() // la franja debe seguir admitiendo un múltiplo de 5 g
    if (G < suelo_g) G = roundUp5(suelo_g)
    if (G > techo_g) G = roundDown5(techo_g)
  }
  HC = round5(HC)
  const kcal_cierre = 4 * P + 4 * HC + 9 * G
  // Invariante del paso 10: agotar la tolerancia es un fallo del motor, no una salida válida.
  if (Math.abs(kcal_cierre - kcal) > 0.02 * kcal) {
    throw new Error('paso 10: kcal_cierre fuera de tolerancia')
  }

  return {
    kcal,
    proteina_g: P,
    grasa_g: G,
    hc_g: HC,
    kcal_cierre,
    gkg_efectivo: gkg,
    base_kg: base,
    base_proteina,
    somatotipo: soma,
    p_cap,
    pct_cap,
    suelo_g,
    techo_g,
    hc_min,
    suelo_grasa_abs_g: suelo_gkg * base,
  }
}

export interface SalidaFibra {
  fibra_g: number
  azucares_libres_max_g: number
}

/** Paso 11 — fibra y azúcares libres. El suelo se ata al hidrato realmente prescrito. */
export function calcularFibra(
  kcal: number,
  hc: number,
  low_carb: boolean,
  emitir: EmitirAviso,
): SalidaFibra {
  const fibra_prop = (FIBRA_POR_1000_KCAL * kcal) / 1000
  const suelo_fibra = low_carb
    ? Math.max(FIBRA_SUELO_LOWCARB, (FIBRA_LOWCARB_POR_1000_KCAL * kcal) / 1000)
    : Math.min(FIBRA_REFERENCIA, FIBRA_SUELO_PCT_HC * hc)
  const fibra_g = Math.round(clamp(fibra_prop, suelo_fibra, FIBRA_MAX))
  if (fibra_g < FIBRA_REFERENCIA) emitir('INFO_FIBRA_AJUSTADA')
  return { fibra_g, azucares_libres_max_g: (0.1 * kcal) / 4 }
}
