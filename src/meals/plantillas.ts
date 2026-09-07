// Bancos de plantillas por preferencia dietética (docs/SPEC-ux-comidas-pdf.md §3.2).
// Una plantilla describe ROLES de alimento, no alimentos concretos: los resuelve `elegirAlimento`.
import type { Alimento } from '../data/foods'
import type { Preferencia } from '../engine/types'

export type RolComida = 'desayuno' | 'principal' | 'ligera'

/** Consulta sobre `foods.json`; los filtros de preferencia se aplican antes que estos criterios. */
export interface FoodQuery {
  rol?: Alimento['roles'][number]
  grupo?: Alimento['grupo']
  estado_excluye?: Alimento['estado'][]
  proteina_min?: number
  hc_max?: number
  grasa_min?: number
  grasa_max?: number
  tags_incluye?: Alimento['tags']
  tags_excluye?: Alimento['tags']
  /** Orden de preferencia: gana el primero que pase los filtros (con rotación para dar variedad). */
  ids_preferidos?: string[]
}

export interface Plantilla {
  id: string
  rol_comida: RolComida
  ancla_proteina: FoodQuery
  ancla_proteina_2: FoodQuery | null
  ancla_carbohidrato: FoodQuery | null
  ancla_grasa: FoodQuery | null
  verdura: FoodQuery | null
  fruta: FoodQuery | null
}

// ---------- Consultas reutilizadas ----------
const VERDURAS: FoodQuery = {
  rol: 'verdura',
  grupo: 'verdura',
  ids_preferidos: [
    'brocoli',
    'judia_verde',
    'pimiento_rojo',
    'calabacin',
    'espinacas',
    'berenjena',
    'coliflor',
    'champinones',
    'tomate',
    'calabaza',
    'zanahoria',
    'puerro',
    'lechuga',
    'pepino',
    'cebolla',
  ],
}

const FRUTAS: FoodQuery = {
  rol: 'fruta',
  grupo: 'fruta',
  ids_preferidos: ['platano', 'manzana', 'pera', 'naranja', 'kiwi', 'mandarina', 'pina', 'uvas', 'fresas'],
}

/** Frutas de baja densidad energética: snacks pequeños y bancos low-carb. */
const FRUTAS_LIGERAS: FoodQuery = {
  rol: 'fruta',
  grupo: 'fruta',
  ids_preferidos: ['fresas', 'sandia', 'melon', 'mandarina', 'manzana', 'naranja'],
}

const AOVE: FoodQuery = { rol: 'grasa', grasa_min: 80, ids_preferidos: ['aove'] }

const FRUTOS_SECOS: FoodQuery = {
  rol: 'grasa',
  grupo: 'grasa',
  grasa_min: 25,
  grasa_max: 79,
  ids_preferidos: ['nueces', 'almendras', 'pistachos', 'cacahuetes', 'anacardos', 'semillas_chia', 'semillas_lino'],
}

const HUEVO: FoodQuery = { rol: 'proteina', ids_preferidos: ['huevo_entero', 'clara_huevo'] }

/** Lácteos proteicos; incluye las variantes sin lactosa como alternativa filtrable. */
const lacteoProteico = (ids: string[]): FoodQuery => ({
  rol: 'proteina',
  grupo: 'lacteo',
  proteina_min: 7,
  ids_preferidos: ids,
})

const LACTEO_YOGUR = lacteoProteico([
  'yogur_griego_0',
  'yogur_griego_0_sl',
  'queso_fresco_batido_0',
  'queso_fresco_batido_0_sl',
  'requeson',
  'queso_cottage',
  'yogur_griego_natural',
])

const LACTEO_BATIDO = lacteoProteico([
  'queso_fresco_batido_0',
  'queso_fresco_batido_0_sl',
  'requeson',
  'queso_cottage',
  'yogur_griego_0',
  'yogur_griego_0_sl',
  'yogur_griego_natural',
])

const LACTEO_REQUESON = lacteoProteico([
  'requeson',
  'queso_cottage',
  'queso_fresco_batido_0',
  'queso_fresco_batido_0_sl',
  'yogur_griego_0',
  'yogur_griego_0_sl',
])

const CEREAL_DESAYUNO: FoodQuery = {
  rol: 'carbohidrato',
  grupo: 'carbohidrato',
  estado_excluye: ['crudo'],
  ids_preferidos: ['pan_integral', 'avena_copos', 'pan_blanco', 'tortitas_arroz'],
}

const CEREAL_COCIDO: FoodQuery = {
  rol: 'carbohidrato',
  grupo: 'carbohidrato',
  estado_excluye: ['crudo'],
  ids_preferidos: [
    'arroz_blanco_cocido',
    'pasta_cocida',
    'quinoa_cocida',
    'arroz_integral_cocido',
    'cuscus_cocido',
    'patata_cocida',
  ],
}

const CEREAL_SIN_GLUTEN: FoodQuery = {
  rol: 'carbohidrato',
  grupo: 'carbohidrato',
  estado_excluye: ['crudo'],
  ids_preferidos: ['arroz_blanco_cocido', 'quinoa_cocida', 'arroz_integral_cocido', 'patata_cocida'],
}

const TUBERCULO: FoodQuery = {
  rol: 'carbohidrato',
  grupo: 'carbohidrato',
  estado_excluye: ['crudo'],
  ids_preferidos: ['patata_cocida', 'boniato_cocido', 'arroz_blanco_cocido'],
}

const TUBERCULO_BONIATO: FoodQuery = {
  rol: 'carbohidrato',
  grupo: 'carbohidrato',
  estado_excluye: ['crudo'],
  ids_preferidos: ['boniato_cocido', 'patata_cocida', 'quinoa_cocida'],
}

const PAN_O_TORTITAS: FoodQuery = {
  rol: 'carbohidrato',
  grupo: 'carbohidrato',
  estado_excluye: ['crudo'],
  ids_preferidos: ['tortitas_arroz', 'pan_integral', 'pan_blanco'],
}

const CARNE_MAGRA: FoodQuery = {
  rol: 'proteina',
  grupo: 'proteina',
  proteina_min: 15,
  ids_preferidos: ['pechuga_pollo', 'ternera_solomillo', 'pechuga_pavo', 'cerdo_lomo', 'muslo_pollo'],
}

const PESCADO_BLANCO: FoodQuery = {
  rol: 'proteina',
  grupo: 'proteina',
  proteina_min: 14,
  ids_preferidos: ['merluza', 'gambas', 'atun_natural'],
}

const PESCADO_AZUL: FoodQuery = {
  rol: 'proteina',
  grupo: 'proteina',
  grasa_min: 4,
  ids_preferidos: ['salmon', 'atun_aceite', 'salmon_ahumado'],
}

const FIAMBRE_MAGRO: FoodQuery = {
  rol: 'proteina',
  grupo: 'proteina',
  proteina_min: 15,
  ids_preferidos: ['jamon_cocido', 'pechuga_pavo', 'jamon_serrano'],
}

const ATUN: FoodQuery = { rol: 'proteina', grupo: 'proteina', ids_preferidos: ['atun_natural', 'jamon_cocido', 'pechuga_pavo'] }

// Vegetales
const LEGUMBRE: FoodQuery = {
  rol: 'proteina',
  grupo: 'proteina',
  ids_preferidos: ['lentejas_cocidas', 'garbanzos_cocidos', 'judias_blancas_cocidas'],
}

const SOJA_VEGETAL: FoodQuery = {
  rol: 'proteina',
  grupo: 'proteina',
  proteina_min: 8,
  ids_preferidos: ['tofu_firme', 'tiras_soja', 'seitan_cocido', 'tempeh', 'tofu'],
}

const SOJA_HIDRATADA: FoodQuery = {
  rol: 'proteina',
  grupo: 'proteina',
  ids_preferidos: ['soja_texturizada_hidratada', 'altramuces', 'edamame_cocido', 'tofu_firme'],
}

const PROTEINA_POLVO: FoodQuery = {
  rol: 'proteina',
  grupo: 'proteina',
  proteina_min: 50,
  ids_preferidos: ['proteina_guisante_polvo', 'proteina_soja_polvo'],
}

const YOGUR_SOJA: FoodQuery = { rol: 'proteina', grupo: 'lacteo', proteina_min: 7, ids_preferidos: ['yogur_soja_proteico'] }

const BEBIDA_VEGETAL: FoodQuery = { rol: 'complemento', grupo: 'lacteo', ids_preferidos: ['bebida_soja', 'leche_avena'] }

const AVENA: FoodQuery = { rol: 'carbohidrato', grupo: 'carbohidrato', estado_excluye: ['crudo'], ids_preferidos: ['avena_copos', 'pan_integral'] }

const SEMILLAS: FoodQuery = {
  rol: 'grasa',
  grupo: 'grasa',
  grasa_min: 25,
  grasa_max: 79,
  ids_preferidos: ['semillas_chia', 'semillas_lino', 'nueces', 'almendras'],
}

const HC_LOW_CARB: FoodQuery = {
  rol: 'carbohidrato',
  grupo: 'carbohidrato',
  estado_excluye: ['crudo'],
  tags_incluye: ['low_carb'],
  ids_preferidos: ['arroz_coliflor', 'pan_proteico'],
}

const CARNE_O_PESCADO: FoodQuery = {
  rol: 'proteina',
  grupo: 'proteina',
  proteina_min: 14,
  ids_preferidos: ['pechuga_pollo', 'salmon', 'ternera_solomillo', 'merluza', 'pechuga_pavo', 'cerdo_lomo'],
}

// ---------- Banco omnívoro (base de `sin_lactosa` y `sin_gluten`) ----------
const OMN: Plantilla[] = [
  {
    id: 'OMN-DES-1',
    rol_comida: 'desayuno',
    ancla_proteina: LACTEO_YOGUR,
    ancla_proteina_2: HUEVO,
    ancla_carbohidrato: CEREAL_DESAYUNO,
    ancla_grasa: FRUTOS_SECOS,
    verdura: null,
    fruta: FRUTAS,
  },
  {
    id: 'OMN-DES-2',
    rol_comida: 'desayuno',
    ancla_proteina: LACTEO_BATIDO,
    ancla_proteina_2: HUEVO,
    ancla_carbohidrato: CEREAL_DESAYUNO,
    ancla_grasa: AOVE,
    verdura: VERDURAS,
    fruta: null,
  },
  {
    id: 'OMN-PRI-1',
    rol_comida: 'principal',
    ancla_proteina: CARNE_MAGRA,
    ancla_proteina_2: HUEVO,
    ancla_carbohidrato: CEREAL_COCIDO,
    ancla_grasa: AOVE,
    verdura: VERDURAS,
    fruta: null,
  },
  {
    id: 'OMN-PRI-2',
    rol_comida: 'principal',
    ancla_proteina: PESCADO_BLANCO,
    ancla_proteina_2: HUEVO,
    ancla_carbohidrato: TUBERCULO,
    ancla_grasa: AOVE,
    verdura: VERDURAS,
    fruta: null,
  },
  {
    id: 'OMN-PRI-3',
    rol_comida: 'principal',
    ancla_proteina: PESCADO_AZUL,
    ancla_proteina_2: null,
    ancla_carbohidrato: TUBERCULO_BONIATO,
    ancla_grasa: AOVE,
    verdura: VERDURAS,
    fruta: null,
  },
  {
    id: 'OMN-LIG-1',
    rol_comida: 'ligera',
    ancla_proteina: LACTEO_REQUESON,
    ancla_proteina_2: null,
    ancla_carbohidrato: PAN_O_TORTITAS,
    ancla_grasa: FRUTOS_SECOS,
    verdura: null,
    fruta: FRUTAS,
  },
  {
    id: 'OMN-LIG-2',
    rol_comida: 'ligera',
    ancla_proteina: ATUN,
    ancla_proteina_2: null,
    ancla_carbohidrato: PAN_O_TORTITAS,
    ancla_grasa: AOVE,
    verdura: null,
    fruta: FRUTAS,
  },
  {
    // Snack mínimo: sin ancla de carbohidrato, para tomas pequeñas (< 150 kcal).
    id: 'OMN-LIG-3',
    rol_comida: 'ligera',
    ancla_proteina: LACTEO_YOGUR,
    ancla_proteina_2: null,
    ancla_carbohidrato: null,
    ancla_grasa: null,
    verdura: null,
    fruta: FRUTAS_LIGERAS,
  },
  {
    // Snack mínimo sin acompañamiento: única forma de cerrar tomas de menos de 150 kcal.
    id: 'OMN-LIG-4',
    rol_comida: 'ligera',
    ancla_proteina: LACTEO_YOGUR,
    ancla_proteina_2: null,
    ancla_carbohidrato: null,
    ancla_grasa: null,
    verdura: null,
    fruta: null,
  },
]

// ---------- Banco vegetariano ----------
const VEG: Plantilla[] = [
  {
    id: 'VEG-DES-1',
    rol_comida: 'desayuno',
    ancla_proteina: lacteoProteico([
      'yogur_griego_natural',
      'yogur_griego_0',
      'yogur_griego_0_sl',
      'queso_fresco_batido_0',
      'requeson',
    ]),
    ancla_proteina_2: null,
    ancla_carbohidrato: AVENA,
    ancla_grasa: FRUTOS_SECOS,
    verdura: null,
    fruta: FRUTAS,
  },
  {
    id: 'VEG-DES-2',
    rol_comida: 'desayuno',
    ancla_proteina: LACTEO_BATIDO,
    ancla_proteina_2: HUEVO,
    ancla_carbohidrato: CEREAL_DESAYUNO,
    ancla_grasa: FRUTOS_SECOS,
    verdura: null,
    fruta: FRUTAS,
  },
  {
    id: 'VEG-PRI-1',
    rol_comida: 'principal',
    ancla_proteina: LACTEO_BATIDO,
    ancla_proteina_2: HUEVO,
    ancla_carbohidrato: CEREAL_COCIDO,
    ancla_grasa: AOVE,
    verdura: VERDURAS,
    fruta: null,
  },
  {
    id: 'VEG-PRI-2',
    rol_comida: 'principal',
    ancla_proteina: LEGUMBRE,
    ancla_proteina_2: HUEVO,
    ancla_carbohidrato: CEREAL_DESAYUNO,
    ancla_grasa: AOVE,
    verdura: VERDURAS,
    fruta: null,
  },
  {
    id: 'VEG-PRI-3',
    rol_comida: 'principal',
    ancla_proteina: SOJA_VEGETAL,
    ancla_proteina_2: HUEVO,
    ancla_carbohidrato: CEREAL_COCIDO,
    ancla_grasa: AOVE,
    verdura: VERDURAS,
    fruta: null,
  },
  {
    id: 'VEG-LIG-1',
    rol_comida: 'ligera',
    ancla_proteina: lacteoProteico(['yogur_griego_0', 'yogur_griego_0_sl', 'yogur_griego_natural', 'requeson']),
    ancla_proteina_2: null,
    ancla_carbohidrato: null,
    ancla_grasa: FRUTOS_SECOS,
    verdura: null,
    fruta: FRUTAS,
  },
  {
    id: 'VEG-LIG-2',
    rol_comida: 'ligera',
    ancla_proteina: LACTEO_REQUESON,
    ancla_proteina_2: null,
    ancla_carbohidrato: PAN_O_TORTITAS,
    ancla_grasa: null,
    verdura: null,
    fruta: FRUTAS,
  },
  {
    id: 'VEG-LIG-3',
    rol_comida: 'ligera',
    ancla_proteina: LACTEO_YOGUR,
    ancla_proteina_2: null,
    ancla_carbohidrato: null,
    ancla_grasa: null,
    verdura: null,
    fruta: FRUTAS_LIGERAS,
  },
  {
    // Snack mínimo sin acompañamiento: única forma de cerrar tomas de menos de 150 kcal.
    id: 'VEG-LIG-4',
    rol_comida: 'ligera',
    ancla_proteina: LACTEO_YOGUR,
    ancla_proteina_2: null,
    ancla_carbohidrato: null,
    ancla_grasa: null,
    verdura: null,
    fruta: null,
  },
]

// ---------- Banco vegano ----------
const VGN: Plantilla[] = [
  {
    id: 'VGN-DES-1',
    rol_comida: 'desayuno',
    ancla_proteina: YOGUR_SOJA,
    ancla_proteina_2: PROTEINA_POLVO,
    ancla_carbohidrato: AVENA,
    ancla_grasa: SEMILLAS,
    verdura: null,
    fruta: FRUTAS,
  },
  {
    id: 'VGN-DES-2',
    rol_comida: 'desayuno',
    ancla_proteina: PROTEINA_POLVO,
    ancla_proteina_2: BEBIDA_VEGETAL,
    ancla_carbohidrato: AVENA,
    ancla_grasa: SEMILLAS,
    verdura: null,
    fruta: FRUTAS,
  },
  {
    id: 'VGN-PRI-1',
    rol_comida: 'principal',
    ancla_proteina: SOJA_VEGETAL,
    ancla_proteina_2: SOJA_HIDRATADA,
    ancla_carbohidrato: CEREAL_COCIDO,
    ancla_grasa: AOVE,
    verdura: VERDURAS,
    fruta: null,
  },
  {
    id: 'VGN-PRI-2',
    rol_comida: 'principal',
    ancla_proteina: LEGUMBRE,
    ancla_proteina_2: SOJA_HIDRATADA,
    ancla_carbohidrato: CEREAL_COCIDO,
    ancla_grasa: AOVE,
    verdura: VERDURAS,
    fruta: null,
  },
  {
    id: 'VGN-PRI-3',
    rol_comida: 'principal',
    ancla_proteina: { rol: 'proteina', grupo: 'proteina', ids_preferidos: ['tempeh', 'tiras_soja', 'tofu_firme'] },
    ancla_proteina_2: SOJA_HIDRATADA,
    ancla_carbohidrato: TUBERCULO_BONIATO,
    ancla_grasa: AOVE,
    verdura: VERDURAS,
    fruta: null,
  },
  {
    id: 'VGN-LIG-1',
    rol_comida: 'ligera',
    ancla_proteina: YOGUR_SOJA,
    ancla_proteina_2: null,
    ancla_carbohidrato: PAN_O_TORTITAS,
    ancla_grasa: FRUTOS_SECOS,
    verdura: null,
    fruta: FRUTAS,
  },
  {
    id: 'VGN-LIG-2',
    rol_comida: 'ligera',
    ancla_proteina: { rol: 'proteina', grupo: 'proteina', ids_preferidos: ['altramuces', 'edamame_cocido', 'tofu_firme'] },
    ancla_proteina_2: null,
    ancla_carbohidrato: PAN_O_TORTITAS,
    ancla_grasa: null,
    verdura: null,
    fruta: FRUTAS,
  },
  {
    id: 'VGN-LIG-3',
    rol_comida: 'ligera',
    ancla_proteina: YOGUR_SOJA,
    ancla_proteina_2: null,
    ancla_carbohidrato: null,
    ancla_grasa: null,
    verdura: null,
    fruta: FRUTAS_LIGERAS,
  },
  {
    // Snack mínimo sin acompañamiento: única forma de cerrar tomas de menos de 150 kcal.
    id: 'VGN-LIG-4',
    rol_comida: 'ligera',
    ancla_proteina: YOGUR_SOJA,
    ancla_proteina_2: null,
    ancla_carbohidrato: null,
    ancla_grasa: null,
    verdura: null,
    fruta: null,
  },
]

// ---------- Banco sin gluten ----------
const SGL: Plantilla[] = [
  {
    id: 'SGL-DES-1',
    rol_comida: 'desayuno',
    ancla_proteina: LACTEO_YOGUR,
    ancla_proteina_2: HUEVO,
    ancla_carbohidrato: null,
    ancla_grasa: FRUTOS_SECOS,
    verdura: null,
    fruta: FRUTAS,
  },
  {
    id: 'SGL-DES-2',
    rol_comida: 'desayuno',
    ancla_proteina: LACTEO_BATIDO,
    ancla_proteina_2: HUEVO,
    ancla_carbohidrato: { rol: 'carbohidrato', grupo: 'carbohidrato', estado_excluye: ['crudo'], ids_preferidos: ['patata_cocida', 'tortitas_arroz', 'boniato_cocido'] },
    ancla_grasa: AOVE,
    verdura: VERDURAS,
    fruta: null,
  },
  {
    id: 'SGL-PRI-1',
    rol_comida: 'principal',
    ancla_proteina: CARNE_MAGRA,
    ancla_proteina_2: HUEVO,
    ancla_carbohidrato: CEREAL_SIN_GLUTEN,
    ancla_grasa: AOVE,
    verdura: VERDURAS,
    fruta: null,
  },
  {
    id: 'SGL-PRI-2',
    rol_comida: 'principal',
    ancla_proteina: PESCADO_BLANCO,
    ancla_proteina_2: HUEVO,
    ancla_carbohidrato: TUBERCULO,
    ancla_grasa: AOVE,
    verdura: VERDURAS,
    fruta: null,
  },
  {
    id: 'SGL-PRI-3',
    rol_comida: 'principal',
    ancla_proteina: PESCADO_AZUL,
    ancla_proteina_2: null,
    ancla_carbohidrato: TUBERCULO_BONIATO,
    ancla_grasa: null,
    verdura: VERDURAS,
    fruta: null,
  },
  {
    id: 'SGL-LIG-1',
    rol_comida: 'ligera',
    ancla_proteina: LACTEO_REQUESON,
    ancla_proteina_2: null,
    ancla_carbohidrato: { rol: 'carbohidrato', grupo: 'carbohidrato', estado_excluye: ['crudo'], ids_preferidos: ['tortitas_arroz'] },
    ancla_grasa: FRUTOS_SECOS,
    verdura: null,
    fruta: FRUTAS,
  },
  {
    id: 'SGL-LIG-2',
    rol_comida: 'ligera',
    ancla_proteina: ATUN,
    ancla_proteina_2: null,
    ancla_carbohidrato: null,
    ancla_grasa: FRUTOS_SECOS,
    verdura: null,
    fruta: FRUTAS,
  },
  {
    id: 'SGL-LIG-3',
    rol_comida: 'ligera',
    ancla_proteina: LACTEO_YOGUR,
    ancla_proteina_2: null,
    ancla_carbohidrato: null,
    ancla_grasa: null,
    verdura: null,
    fruta: FRUTAS_LIGERAS,
  },
  {
    // Snack mínimo sin acompañamiento: única forma de cerrar tomas de menos de 150 kcal.
    id: 'SGL-LIG-4',
    rol_comida: 'ligera',
    ancla_proteina: LACTEO_YOGUR,
    ancla_proteina_2: null,
    ancla_carbohidrato: null,
    ancla_grasa: null,
    verdura: null,
    fruta: null,
  },
]

// ---------- Banco low-carb ----------
const LCB: Plantilla[] = [
  {
    id: 'LCB-DES-1',
    rol_comida: 'desayuno',
    ancla_proteina: HUEVO,
    ancla_proteina_2: FIAMBRE_MAGRO,
    ancla_carbohidrato: HC_LOW_CARB,
    ancla_grasa: { rol: 'grasa', grupo: 'grasa', ids_preferidos: ['aguacate', 'aove'] },
    verdura: VERDURAS,
    fruta: null,
  },
  {
    id: 'LCB-DES-2',
    rol_comida: 'desayuno',
    ancla_proteina: lacteoProteico(['yogur_griego_0', 'yogur_griego_0_sl', 'queso_fresco_batido_0', 'yogur_griego_natural']),
    ancla_proteina_2: HUEVO,
    ancla_carbohidrato: HC_LOW_CARB,
    ancla_grasa: FRUTOS_SECOS,
    verdura: null,
    fruta: { rol: 'fruta', grupo: 'fruta', tags_incluye: ['low_carb'], ids_preferidos: ['fresas', 'sandia', 'melon'] },
  },
  {
    id: 'LCB-PRI-1',
    rol_comida: 'principal',
    ancla_proteina: CARNE_O_PESCADO,
    ancla_proteina_2: HUEVO,
    ancla_carbohidrato: null,
    ancla_grasa: AOVE,
    verdura: VERDURAS,
    fruta: null,
  },
  {
    id: 'LCB-PRI-2',
    rol_comida: 'principal',
    ancla_proteina: CARNE_O_PESCADO,
    ancla_proteina_2: HUEVO,
    ancla_carbohidrato: HC_LOW_CARB,
    ancla_grasa: AOVE,
    verdura: VERDURAS,
    fruta: null,
  },
  {
    id: 'LCB-LIG-1',
    rol_comida: 'ligera',
    ancla_proteina: LACTEO_BATIDO,
    ancla_proteina_2: null,
    ancla_carbohidrato: null,
    ancla_grasa: FRUTOS_SECOS,
    verdura: null,
    fruta: null,
  },
  {
    id: 'LCB-LIG-2',
    rol_comida: 'ligera',
    ancla_proteina: HUEVO,
    ancla_proteina_2: null,
    ancla_carbohidrato: null,
    ancla_grasa: { rol: 'grasa', grupo: 'grasa', ids_preferidos: ['aceitunas', 'aguacate'] },
    verdura: null,
    fruta: null,
  },
  {
    id: 'LCB-LIG-3',
    rol_comida: 'ligera',
    ancla_proteina: lacteoProteico(['yogur_griego_0', 'yogur_griego_0_sl', 'queso_fresco_batido_0']),
    ancla_proteina_2: null,
    ancla_carbohidrato: null,
    ancla_grasa: null,
    verdura: null,
    fruta: { rol: 'fruta', grupo: 'fruta', tags_incluye: ['low_carb'], ids_preferidos: ['fresas', 'sandia', 'melon'] },
  },
  {
    // Snack mínimo sin acompañamiento: única forma de cerrar tomas de menos de 150 kcal.
    id: 'LCB-LIG-4',
    rol_comida: 'ligera',
    ancla_proteina: LACTEO_BATIDO,
    ancla_proteina_2: null,
    ancla_carbohidrato: null,
    ancla_grasa: null,
    verdura: null,
    fruta: null,
  },
]

/**
 * Banco por preferencia. `sin_lactosa` y `sin_gluten` reutilizan la estructura omnívora
 * (§3.2): el trabajo lo hace el filtro por tags, que en `sin_gluten` además cambia el desayuno.
 */
export const BANCOS: Record<Preferencia, readonly Plantilla[]> = {
  omnivoro: OMN,
  vegetariano: VEG,
  vegano: VGN,
  sin_lactosa: OMN,
  sin_gluten: SGL,
  low_carb: LCB,
}

/** Plantillas de un banco para un rol de comida, en el orden estable de sus identificadores. */
export function plantillasDe(banco: readonly Plantilla[], rol: RolComida): readonly Plantilla[] {
  return banco.filter((p) => p.rol_comida === rol)
}
