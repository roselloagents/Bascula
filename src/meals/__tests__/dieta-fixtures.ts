// Fixtures de "Cuéntanos cómo comes" (docs/SPEC-dieta-propia.md §4.7 y §6.1).
//
// Viven aquí y no dentro de un `.test.ts` a propósito: los usan los tests de la composición y de
// la compra, el bloque de la pantalla (§5.4), los fixtures del PDF (§6.2) y el script de muestra
// `scripts/dieta-muestra.mjs`. Todo es puro y determinista: `DIAS_COMPUESTOS` se calcula al
// importar el módulo y sale siempre igual.
//
// Los alimentos que existen en `foods.json` copian sus macros DEL CATÁLOGO, que es justo lo que
// impone el servidor en §3.5; los que no existen llevan macros estimados, como los devolvería el
// modelo.
import type { Alimento } from '../../data/foods'
import { alimentoPorId, esContable } from '../../data/foods'
import type {
  AlimentoPropio,
  Comida,
  ComidaPropia,
  DiaCompuesto,
  DietaInterpretada,
  GrupoAprox,
  Inputs,
  MacrosPropio,
  NComidas,
  Preferencia,
  Resultado,
} from '../../engine/types'
import { componerDia } from '../index'
import { inputsDe, resultadoDe } from './fixtures'

// ---------- Constructores ----------

/** Un alimento dictado que SÍ está en el catálogo: macros, estado y unidad los pone `foods.json`. */
export function delCatalogo(
  id: string,
  gramos: number | null,
  texto: string,
  extra: Partial<AlimentoPropio> = {},
): AlimentoPropio {
  const a = alimentoPorId(id) as Alimento
  const macros_100g: MacrosPropio = {
    kcal: a.kcal,
    prot: a.proteina,
    carb: a.carbohidratos,
    fat: a.grasa,
    fibra: a.fibra,
    alcohol: 0,
  }
  const unidad =
    esContable(a) && gramos !== null
      ? {
          unidad: { nombre: a.unidad_nombre, gramos: a.unidad_g },
          cantidad_unidades: Math.max(1, Math.round(gramos / a.unidad_g)),
        }
      : {}
  return {
    texto,
    nombre: a.nombre,
    alimento_id: id,
    estado: a.estado,
    grupo_aprox: a.grupo as GrupoAprox,
    gramos,
    ...unidad,
    macros_100g,
    origen_macros: 'catalogo',
    ajustable: true,
    confianza: 'alta',
    ...extra,
  }
}

/** Un alimento dictado que NO está en el catálogo: macros estimados por el modelo (§3.3, regla 7). */
export function propio(
  nombre: string,
  gramos: number | null,
  grupo: GrupoAprox,
  macros: MacrosPropio,
  extra: Partial<AlimentoPropio> = {},
): AlimentoPropio {
  return {
    texto: nombre,
    nombre,
    alimento_id: null,
    estado: 'listo',
    grupo_aprox: grupo,
    gramos,
    macros_100g: macros,
    origen_macros: 'estimado',
    ajustable: true,
    confianza: 'media',
    ...extra,
  }
}

const macros = (
  kcal: number,
  prot: number,
  carb: number,
  fat: number,
  fibra = 0,
  alcohol = 0,
): MacrosPropio => ({ kcal, prot, carb, fat, fibra, alcohol })

function comida(nombre: string, alimentos: AlimentoPropio[]): ComidaPropia {
  return { nombre, alimentos }
}

/** `DietaInterpretada` mínima: lo que no se diga va vacío, como sale del servidor. */
export function interpretada(parcial: Partial<DietaInterpretada>): DietaInterpretada {
  return {
    comidas: [],
    gustos: [],
    habitos: [],
    no_entendido: [],
    notas: [],
    falta_aceite: false,
    ...parcial,
  }
}

// ---------- Plan del motor con macros exactos ----------

function repartir(total: number, pct: readonly number[], decimales: number): number[] {
  const suma = pct.reduce((t, p) => t + p, 0)
  const f = (n: number): number =>
    decimales === 0 ? Math.round(n) : Math.round(n * 10 ** decimales) / 10 ** decimales
  const partes = pct.map((p) => f((total * p) / (suma > 0 ? suma : pct.length)))
  const ultimo = partes.length - 1
  if (ultimo >= 0) {
    const acumulado = partes.slice(0, ultimo).reduce((t, x) => t + x, 0)
    partes[ultimo] = f(total - acumulado)
  }
  return partes
}

export interface OpcionesPlanDieta {
  kcal: number
  prot: number
  carb: number
  fat: number
  nComidas?: NComidas
  preferencia?: Preferencia
  condiciones?: Inputs['condiciones']
  fibra?: number
  excluidos?: string[]
  favoritos?: string[]
}

/**
 * `Inputs` y `Resultado` con los macros EXACTOS que pide el caso: el reparto por comidas se
 * rehace ∝ `pct_kcal` sobre esos macros, como el Paso 16 del motor.
 */
export function planDieta(o: OpcionesPlanDieta): { inputs: Inputs; resultado: Resultado } {
  const nComidas = o.nComidas ?? 3
  const preferencia = o.preferencia ?? 'omnivoro'
  const base = resultadoDe({ kcal: o.kcal, nComidas, preferencia })
  const inputs: Inputs = {
    ...inputsDe({ kcal: o.kcal, nComidas, preferencia, condiciones: o.condiciones }),
    ...(o.excluidos ? { alimentos_excluidos: o.excluidos } : {}),
    ...(o.favoritos ? { alimentos_favoritos: o.favoritos } : {}),
  }
  const pct = base.comidas.map((c) => c.pct_kcal)
  const P = repartir(o.prot, pct, 1)
  const G = repartir(o.fat, pct, 1)
  const HC = repartir(o.carb, pct, 1)
  const K = repartir(o.kcal, pct, 0)
  const comidas: Comida[] = base.comidas.map((c, i) => ({
    ...c,
    proteina_g: P[i],
    grasa_g: G[i],
    hc_g: HC[i],
    kcal: K[i],
  }))
  return {
    inputs,
    resultado: {
      ...base,
      kcal: o.kcal,
      kcal_cierre: K.reduce((t, x) => t + x, 0),
      macros: {
        ...base.macros,
        proteina_g: o.prot,
        grasa_g: o.fat,
        hc_g: o.carb,
        fibra_g: o.fibra ?? base.macros.fibra_g,
      },
      comidas,
    },
  }
}

// ---------- Las comidas del §0 ----------

/** "Unos cereales del Mercadona 0 % grasa", sin cantidad: queda pendiente (§3.3, regla 8). */
const CEREALES_PENDIENTE = propio(
  'Cereales de arroz integral y avena 0 %',
  null,
  'carbohidrato',
  macros(370, 8, 80, 1.5, 6),
  { nota: 'No has dicho la cantidad' },
)

/** "Unas tiras de fiambre", sin cantidad. */
const FIAMBRE_PENDIENTE = propio(
  'Tiras de fiambre de pavo',
  null,
  'proteina',
  macros(105, 18, 1, 3),
  {
    nota: 'No has dicho la cantidad',
  },
)

const DESAYUNO_DEL_AUDIO = comida('Desayuno', [
  delCatalogo('kefir_entero', 250, '250 g de kéfir'),
  delCatalogo('semillas_chia', 5, '5 g de chía'),
  delCatalogo('almendras', 25, '25 g de almendras'),
  delCatalogo('nueces', 18, '18 de nueces'),
  delCatalogo('proteina_suero_polvo', 60, 'un scoop de proteína de unos 60 g en total', {
    nota: 'He tomado el scoop como 60 g, como has dicho',
  }),
  CEREALES_PENDIENTE,
])

const COMIDA_DEL_AUDIO = comida('Comida', [
  delCatalogo('pechuga_pollo', 200, '200 g de pollo'),
  delCatalogo('arroz_blanco_crudo', 100, '100 g de arroz basmati pesado en seco', {
    nombre: 'Arroz basmati (crudo)',
    nota: 'Basmati ≈ arroz blanco',
  }),
])

const CENA_DEL_AUDIO = comida('Cena', [
  delCatalogo('huevo_entero', 275, '5 huevos'),
  FIAMBRE_PENDIENTE,
])

// ---------- Los seis fixtures ----------

/** Solo el desayuno del §0: el resto del día lo montamos nosotros (modo `parcial`). */
export const DESAYUNO_SOLO = interpretada({ comidas: [DESAYUNO_DEL_AUDIO] })

/** El día entero del §0: desayuno, comida y cena dictados (modo `completa`). */
export const DIA_COMPLETO = interpretada({
  comidas: [DESAYUNO_DEL_AUDIO, COMIDA_DEL_AUDIO, CENA_DEL_AUDIO],
  falta_aceite: true,
})

/** Ni una comida: solo gustos y costumbres (modo `solo_contexto`). */
export const SOLO_CONTEXTO = interpretada({
  gustos: [
    { texto: 'no me gusta el brócoli', tipo: 'no_gusta', alimento_ids: ['brocoli'] },
    { texto: 'me encanta el salmón', tipo: 'gusta', alimento_ids: ['salmon'] },
  ],
  habitos: [{ texto: 'ceno sin hidratos', tipo: 'sin_hidratos', comida: 'Cena', valor: null }],
})

/** Día completo sin apenas grasa: dispara `DIETA_GRASA_BAJA`. */
export const BAJA_EN_GRASA = interpretada({
  comidas: [
    comida('Desayuno', [
      delCatalogo('clara_huevo', 198, '6 claras'),
      delCatalogo('pan_integral', 120, '120 g de pan integral'),
    ]),
    comida('Comida', [
      delCatalogo('pechuga_pollo', 220, '220 g de pechuga'),
      delCatalogo('arroz_blanco_cocido', 300, '300 g de arroz ya hecho'),
    ]),
    comida('Cena', [
      delCatalogo('merluza', 250, '250 g de merluza'),
      delCatalogo('patata_cocida', 300, '300 g de patata cocida'),
    ]),
  ],
})

/** Día completo cargado de frutos secos y huevos: dispara `DIETA_GRASA_ALTA`. */
export const ALTA_EN_GRASA = interpretada({
  comidas: [
    comida('Desayuno', [
      delCatalogo('nueces', 60, '60 g de nueces'),
      delCatalogo('huevo_entero', 220, '4 huevos'),
    ]),
    comida('Comida', [
      delCatalogo('salmon', 200, '200 g de salmón'),
      delCatalogo('almendras', 50, '50 g de almendras'),
      delCatalogo('arroz_blanco_crudo', 80, '80 g de arroz en crudo'),
    ]),
    comida('Cena', [
      delCatalogo('huevo_entero', 165, '3 huevos'),
      delCatalogo('aguacate', 150, 'medio aguacate'),
    ]),
  ],
})

/** Día completo con más hidrato del que pide el plan y `diabetes`: `DIETA_HC_LEJOS` al 10 %. */
export const DIETA_DIABETES = interpretada({
  comidas: [
    comida('Desayuno', [
      delCatalogo('avena_copos', 80, '80 g de avena'),
      delCatalogo('leche_semidesnatada', 250, 'un vaso de leche'),
    ]),
    comida('Comida', [
      delCatalogo('pechuga_pollo', 180, '180 g de pollo'),
      delCatalogo('arroz_blanco_cocido', 320, '320 g de arroz hecho'),
    ]),
    comida('Cena', [
      delCatalogo('merluza', 180, '180 g de merluza'),
      delCatalogo('patata_cocida', 320, '320 g de patata'),
    ]),
  ],
})

export type ClaveFixture =
  | 'desayuno_solo'
  | 'dia_completo'
  | 'solo_contexto'
  | 'baja_en_grasa'
  | 'alta_en_grasa'
  | 'diabetes'

export interface FixtureDieta {
  clave: ClaveFixture
  titulo: string
  interpretada: DietaInterpretada
  inputs: Inputs
  resultado: Resultado
  variante: number
}

/** Plan del §4.7: 3 comidas a 1 780 kcal / 145 P / 165 HC / 58 G. */
export const PLAN_1780 = planDieta({ kcal: 1780, prot: 145, carb: 165, fat: 58 })
/** El mismo día del §0 contra un plan más grande: 2 300 / 170 / 260 / 70. */
export const PLAN_2300 = planDieta({ kcal: 2300, prot: 170, carb: 260, fat: 70 })

const PLAN_CONTEXTO = planDieta({
  kcal: 2100,
  prot: 150,
  carb: 210,
  fat: 70,
  excluidos: ['brocoli'],
  favoritos: ['salmon'],
})
const PLAN_BAJA_GRASA = planDieta({ kcal: 2200, prot: 150, carb: 240, fat: 75 })
const PLAN_ALTA_GRASA = planDieta({ kcal: 2400, prot: 150, carb: 300, fat: 45 })
const PLAN_DIABETES = planDieta({
  kcal: 2100,
  prot: 140,
  carb: 195,
  fat: 75,
  condiciones: ['diabetes'],
})

export const FIXTURES_DIETA: readonly FixtureDieta[] = [
  {
    clave: 'desayuno_solo',
    titulo: 'Solo el desayuno del §0 (parcial)',
    interpretada: DESAYUNO_SOLO,
    ...PLAN_1780,
    variante: 0,
  },
  {
    clave: 'dia_completo',
    titulo: 'El día entero del §0 (completa)',
    interpretada: DIA_COMPLETO,
    ...PLAN_1780,
    variante: 0,
  },
  {
    clave: 'solo_contexto',
    titulo: 'Gustos y costumbres, ninguna comida (solo contexto)',
    interpretada: SOLO_CONTEXTO,
    ...PLAN_CONTEXTO,
    variante: 0,
  },
  {
    clave: 'baja_en_grasa',
    titulo: 'Día completo sin apenas grasa',
    interpretada: BAJA_EN_GRASA,
    ...PLAN_BAJA_GRASA,
    variante: 0,
  },
  {
    clave: 'alta_en_grasa',
    titulo: 'Día completo cargado de grasa',
    interpretada: ALTA_EN_GRASA,
    ...PLAN_ALTA_GRASA,
    variante: 0,
  },
  {
    clave: 'diabetes',
    titulo: 'Día completo con diabetes y los hidratos altos',
    interpretada: DIETA_DIABETES,
    ...PLAN_DIABETES,
    variante: 0,
  },
]

/** El `DiaCompuesto` ya calculado de cada fixture: estable, para el PDF y para la pantalla. */
export const DIAS_COMPUESTOS: Record<ClaveFixture, DiaCompuesto> = Object.fromEntries(
  FIXTURES_DIETA.map((f) => [
    f.clave,
    componerDia(f.interpretada, f.inputs, f.resultado, f.variante),
  ]),
) as Record<ClaveFixture, DiaCompuesto>

/** El fixture con esa clave. */
export function fixtureDieta(clave: ClaveFixture): FixtureDieta {
  return FIXTURES_DIETA.find((f) => f.clave === clave) as FixtureDieta
}
