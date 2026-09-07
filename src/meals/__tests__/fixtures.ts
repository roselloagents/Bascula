// Constructores de `Inputs` y `Resultado` sintéticos para los tests del generador de menús.
// El reparto por comidas reproduce el Paso 16 de docs/SPEC-calculo.md (tabla 3.13 y tabla 3.14),
// para que los objetivos por toma tengan las mismas proporciones que los del motor real.
import type {
  Comida,
  Inputs,
  NComidas,
  Objetivo,
  ObjetivoEfectivo,
  Preferencia,
  PreferenciaBase,
  Restriccion,
  Resultado,
} from '../../engine/types'

interface FilaReparto {
  nombres: string[]
  horas: string[]
  pct: number[]
}

const TABLA_313: Record<NComidas, FilaReparto> = {
  2: { nombres: ['Comida', 'Cena'], horas: ['14:00', '21:00'], pct: [45, 55] },
  3: { nombres: ['Desayuno', 'Comida', 'Cena'], horas: ['08:00', '14:00', '21:00'], pct: [30, 35, 35] },
  4: {
    nombres: ['Desayuno', 'Comida', 'Merienda', 'Cena'],
    horas: ['08:00', '14:00', '17:30', '21:00'],
    pct: [25, 30, 15, 30],
  },
  5: {
    nombres: ['Desayuno', 'Media mañana', 'Comida', 'Merienda', 'Cena'],
    horas: ['08:00', '11:00', '14:00', '17:30', '21:00'],
    pct: [20, 10, 30, 10, 30],
  },
  6: {
    nombres: ['Desayuno', 'Media mañana', 'Comida', 'Merienda', 'Cena', 'Recena'],
    horas: ['08:00', '11:00', '14:00', '17:30', '21:00', '23:00'],
    pct: [15, 10, 25, 10, 25, 15],
  },
}

const round5 = (x: number): number => Math.round(x / 5) * 5

function indicePrincipal(pct: readonly number[]): number {
  let mejor = 0
  for (let i = 1; i < pct.length; i++) if (pct[i] > pct[mejor]) mejor = i
  return mejor
}

function repartir(total: number, vec: readonly number[], principal: number): number[] {
  const partes = vec.map((v) => round5((total * v) / 100))
  const suma = partes.reduce((a, b) => a + b, 0)
  partes[principal] += total - suma
  return partes
}

export interface OpcionesPlan {
  kcal: number
  nComidas: NComidas
  /** Banco de plantillas (`preferencia_efectiva`, regla inversa de `SPEC-calculo.md` §1.1). */
  preferencia: Preferencia
  objetivo?: ObjetivoEfectivo
  pesoKg?: number
  edad?: number
  /** Índice de la comida peri-entreno; `null` si no aplica. */
  peri?: number | null
  /** v1.1: base dietética excluyente. Ausente ⇒ `Resultado` de la v1.0, sin los campos nuevos. */
  base?: PreferenciaBase
  /** v1.1: restricciones combinables. */
  restricciones?: Restriccion[]
  /** v1.1: interruptor "bajo en hidratos" ya efectivo (el paso 6.8 lo anula con `diabetes`). */
  lowCarb?: boolean
  /** Hidrato diario del plan **ajustado por el usuario** (§2.2b): la grasa se recalcula como resto. */
  hcAjustado?: number
}

/**
 * Regla inversa de `SPEC-calculo.md` §1.1: qué banco de plantillas toca con una base, unas
 * restricciones y el interruptor de bajo en hidratos.
 */
export function bancoDe(
  base: PreferenciaBase,
  restricciones: readonly Restriccion[] = [],
  lowCarb = false,
): Preferencia {
  if (lowCarb) return 'low_carb'
  if (base === 'vegano' || base === 'vegetariano') return base
  if (restricciones.includes('sin_gluten')) return 'sin_gluten'
  if (restricciones.includes('sin_lactosa')) return 'sin_lactosa'
  return 'omnivoro'
}

/** `Resultado` sintético con un reparto por comidas construido como el Paso 16 del motor. */
export function resultadoDe(o: OpcionesPlan): Resultado {
  const fila = TABLA_313[o.nComidas]
  const peso = o.pesoKg ?? 75
  const proteinaDia = round5(peso * 2)
  const pctGrasa = o.preferencia === 'low_carb' ? 0.45 : 0.25
  const grasaRecomendada = round5((o.kcal * pctGrasa) / 9)
  const hcRecomendado = Math.max(50, round5((o.kcal - 4 * proteinaDia - 9 * grasaRecomendada) / 4))
  // Plan ajustado (§2.2b): la proteína no se toca, el hidrato lo fija el usuario y la grasa es el
  // resto, (kcal − 4P − 4HC)/9. Es exactamente lo que devuelve `ajustarMacros`.
  const ajustado = o.hcAjustado !== undefined
  const hcDia = ajustado ? round5(o.hcAjustado as number) : hcRecomendado
  const grasaDia = ajustado ? round5((o.kcal - 4 * proteinaDia - 4 * hcDia) / 9) : grasaRecomendada

  const principal = indicePrincipal(fila.pct)
  const hcv = [...fila.pct]
  if (o.peri !== null && o.peri !== undefined) {
    hcv[o.peri] += 5
    let j = -1
    for (let i = 0; i < fila.pct.length; i++) {
      if (i === o.peri) continue
      if (j === -1 || fila.pct[i] > fila.pct[j]) j = i
    }
    if (j >= 0) hcv[j] -= 5
  }

  const P = repartir(proteinaDia, fila.pct, principal)
  const G = repartir(grasaDia, fila.pct, principal)
  const HC = repartir(hcDia, hcv, principal)

  const comidas: Comida[] = fila.nombres.map((nombre, i) => ({
    nombre,
    hora: fila.horas[i],
    pct_kcal: fila.pct[i],
    proteina_g: P[i],
    grasa_g: G[i],
    hc_g: HC[i],
    kcal: 4 * P[i] + 9 * G[i] + 4 * HC[i],
    peri: o.peri === i,
  }))

  const kcalCierre = comidas.reduce((t, c) => t + c.kcal, 0)

  return {
    imc: 24.2,
    imc_categoria: 'normal',
    grasa: {
      pct: 20,
      rango: [18, 22],
      fiabilidad: 'media',
      metodo_efectivo: 'visual',
      banda: 'medio',
      referencias: { cunbae: 20, deurenberg: 20 },
    },
    mlg: peso * 0.8,
    bmr: { valor: 1700, ecuacion: 'mifflin', referencias: { mifflin: 1700, katch: 1690, harris: 1720 } },
    tdee: { valor: o.kcal, bruto: o.kcal, pal: 1.5, ejercicio_dia: 250, perfil: 'fuerza' },
    objetivo_efectivo: o.objetivo ?? 'mantener',
    ritmo_efectivo: 'moderado',
    preferencia_efectiva: o.preferencia,
    // Los tres campos de la v1.1 solo viajan si el test los pide: sin ellos, `src/meals` tiene que
    // deducirlos de `preferencia_efectiva` con la regla de traducción de §1.1 (compatibilidad).
    ...(o.base ? { preferencia_base: o.base } : {}),
    ...(o.base ? { restricciones: o.restricciones ?? [] } : {}),
    ...(o.base ? { low_carb: o.lowCarb === true } : {}),
    ...(ajustado ? { ajuste: { kcal: false, hc: true } } : {}),
    kcal: o.kcal,
    kcal_cierre: kcalCierre,
    macros: {
      proteina_g: proteinaDia,
      grasa_g: grasaDia,
      hc_g: hcDia,
      fibra_g: Math.round((o.kcal / 1000) * 14),
      azucares_libres_max_g: Math.round((o.kcal * 0.05) / 4),
      pct: { p: 30, g: 25, hc: 45 },
      gkg: { p: 2, g: 0.9, hc: 3 },
      base_proteina: 'peso_corporal',
      base_kg: peso,
      somatotipo: 'mesomorfo',
    pct_cap: 0.35,
    },
    agua: { ml: 2500, rango: [2200, 2800], vasos: 10 },
    peso_objetivo: {
      efectivo: peso,
      sugerido: peso,
      mostrar_central: true,
      rango: [peso - 2, peso + 2],
      metodo: 'actual',
      hito_intermedio: null,
      referencias: { imc22: peso, rango_imc: [peso - 5, peso + 5], clasicas: null },
    },
    cronograma: null,
    ffmi: { valor: 20, normalizado: 20, categoria: 'bueno' },
    comidas,
    avisos: [],
  }
}

/** `Inputs` sintéticos coherentes con el `Resultado` de arriba. */
export function inputsDe(o: OpcionesPlan & { objetivoCrudo?: Objetivo; condiciones?: Inputs['condiciones'] }): Inputs {
  return {
    sexo: 'hombre',
    edad: o.edad ?? 35,
    altura_cm: 178,
    peso_kg: o.pesoKg ?? 75,
    grasa: { metodo: 'visual', categoria: 'medio' },
    somatotipo: null,
    actividad_diaria: 'moderado',
    entrenamiento: {
      tipo: 'fuerza',
      dias_semana: 4,
      minutos_sesion: 60,
      intensidad: 'media',
      experiencia: 'intermedio',
      momento: 'tarde',
    },
    objetivo: o.objetivoCrudo ?? o.objetivo ?? 'mantener',
    ritmo: 'moderado',
    peso_objetivo: null,
    preferencia: o.preferencia,
    ...(o.base
      ? { preferencia_base: o.base, restricciones: o.restricciones ?? [], low_carb: o.lowCarb === true }
      : {}),
    n_comidas: o.nComidas,
    clima_caluroso: false,
    embarazo_lactancia: false,
    condiciones: o.condiciones ?? [],
    cribado_tca: 'negativo',
    fecha_inicio: '2026-09-07',
  }
}
