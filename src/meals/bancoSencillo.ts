// Banco sencillo (docs/SPEC-ux-comidas-pdf.md §3.7.2).
//
// Con `inputs.menu_sencillo === true` el generador cambia de banco: en vez de rotar plantillas y
// alimentos para dar variedad (§3.2), usa DOS variantes por rol de comida —el banco `A` para los
// días 1, 3, 5 y 7 y el banco `B` para los días 2, 4 y 6— resueltas contra una lista corta de
// alimentos básicos y repetibles. Todo lo demás sigue igual: mismas plantillas, mismo algoritmo
// de escalado de §3.3, mismas tolerancias y el mismo determinismo (sin `Math.random`).
//
// La regla dura es el tope de variedad: **como mucho 12 alimentos distintos en toda la semana**.
// Aquí se separan dos listas para poder garantizarlo por construcción sin renunciar a la tabla
// normativa de §3.7.2:
//
//   - `candidatos` es la **lista blanca** de la preferencia, tal cual la escribe §3.7.2 (hasta 16
//     ids). Marca lo que puede llegar a la lista de la compra del modo sencillo: la usan el
//     respaldo de §3.7.2 y los tests para comprobar que nada de fuera se cuela.
//   - Las **plantillas** de los días A y B usan un subconjunto de como mucho
//     `MAX_ALIMENTOS_SENCILLO` ids distintos (`idsDeBanco`), así que la unión de los dos días
//     nunca pasa de 12 aunque se usen todas las plantillas.
//
// `src/meals/__tests__/sencillo.test.ts` comprueba las dos cosas.
import type { Alimento, RolAlimento } from '../data/foods'
import { ALIMENTOS, alimentoPorId } from '../data/foods'
import type { Preferencia } from '../engine/types'
import type { PerfilDietetico } from './filtros'
import { esVarianteSinLactosa, pasaPerfilMenu, sustituirSinLactosa } from './filtros'
import type { FoodQuery, Plantilla } from './plantillas'

/** Tope duro de alimentos distintos en la semana (§3.7.2, regla 1). */
export const MAX_ALIMENTOS_SENCILLO = 12

/** Tope de la tabla de candidatos de §3.7.2: "ninguna lista tiene más de 16 candidatos". */
export const MAX_CANDIDATOS_SENCILLO = 16

// ---------- Atajos de consulta ----------
// Las consultas del banco sencillo son deliberadamente pobres: rol + lista cerrada de ids. El
// filtro de preferencia de §3.2 se aplica antes (lo hace `candidatos` en `index.ts`), así que un
// id que no pase la preferencia simplemente no entra y gana el siguiente de la lista.
const prot = (ids: string[]): FoodQuery => ({ rol: 'proteina', ids_preferidos: ids })
const carb = (ids: string[]): FoodQuery => ({ rol: 'carbohidrato', ids_preferidos: ids })
const grasa = (ids: string[]): FoodQuery => ({ rol: 'grasa', ids_preferidos: ids })
const verd = (ids: string[]): FoodQuery => ({
  rol: 'verdura',
  grupo: 'verdura',
  ids_preferidos: ids,
})
const frut = (ids: string[]): FoodQuery => ({ rol: 'fruta', grupo: 'fruta', ids_preferidos: ids })

interface Receta {
  id: string
  rol_comida: Plantilla['rol_comida']
  p: string[]
  p2?: string[]
  c?: string[]
  g?: string[]
  v?: string[]
  f?: string[]
}

function plantilla(r: Receta): Plantilla {
  return {
    id: r.id,
    rol_comida: r.rol_comida,
    ancla_proteina: prot(r.p),
    ancla_proteina_2: r.p2 ? prot(r.p2) : null,
    ancla_carbohidrato: r.c ? carb(r.c) : null,
    ancla_grasa: r.g ? grasa(r.g) : null,
    verdura: r.v ? verd(r.v) : null,
    fruta: r.f ? frut(r.f) : null,
  }
}

/** Un banco sencillo: la lista blanca de la semana y las plantillas de los días A y B. */
export interface BancoSencillo {
  /**
   * Lista blanca de §3.7.2 para esa preferencia (hasta `MAX_CANDIDATOS_SENCILLO` ids). Es el
   * límite de lo que puede llegar a la lista de la compra, incluido el respaldo de §3.7.2; los
   * ids que usan las plantillas son un subconjunto de como mucho `MAX_ALIMENTOS_SENCILLO`.
   */
  candidatos: readonly string[]
  /** Plantillas de los días impares (1, 3, 5, 7). */
  A: readonly Plantilla[]
  /** Plantillas de los días pares (2, 4, 6): misma estructura, otra variante. */
  B: readonly Plantilla[]
  /**
   * Vía de escape de §3.2 para `low_carb` (cereal normal cuando el ancla low-carb no cubre el
   * hidrato del plan), restringida a un único id que ya está en `candidatos`. `null` en el resto
   * de preferencias: sin esta restricción el escape metía patata, arroz y boniato en la lista de
   * la compra y rompía el tope de 12.
   */
  hcAlterno: FoodQuery | null
}

// ---------- Omnívoro ----------
// El pavo es el que evita el desayuno de cuatro huevos: el huevo tope su ración en 250 g y, en un
// desayuno de 40 g de proteína, se quedaba solo cubriendo el objetivo.
// Las plantillas renuncian a la segunda fruta para que quepan dos cosas. La lenteja: es la segunda
// ancla de proteína de las comidas principales —sin ella el pollo se quedaba clavado en su ración
// máxima y la toma salía del ±15 %— y sube la fibra del día, que en modo sencillo no tiene la
// rotación de verduras de §3.3. Y la patata cocida: quien pide "pollo, arroz, huevos, cosas
// sencillas" espera patata en la semana, así que rota con el arroz entre las dos variantes de
// comida principal. El hueco lo deja el atún, que sigue en la lista blanca (el respaldo de §3.7.2
// puede usarlo) pero ya no en las plantillas: el tope duro son 12 alimentos distintos.
const OMN_SEN: readonly string[] = [
  'pechuga_pollo',
  'huevo_entero',
  'atun_natural',
  'pechuga_pavo',
  'lentejas_cocidas',
  'arroz_blanco_cocido',
  'patata_cocida',
  'avena_copos',
  'pan_integral',
  'aove',
  'almendras',
  'brocoli',
  'judia_verde',
  'tomate',
  'platano',
  'manzana',
]

const OMN_A: Plantilla[] = [
  plantilla({
    id: 'SEN-OMN-DES-A',
    rol_comida: 'desayuno',
    p: ['huevo_entero'],
    p2: ['pechuga_pavo'],
    c: ['avena_copos', 'pan_integral'],
    g: ['almendras'],
    f: ['platano'],
  }),
  plantilla({
    id: 'SEN-OMN-PRI-A1',
    rol_comida: 'principal',
    p: ['pechuga_pollo'],
    p2: ['lentejas_cocidas'],
    c: ['arroz_blanco_cocido', 'patata_cocida'],
    g: ['aove'],
    v: ['brocoli'],
  }),
  plantilla({
    id: 'SEN-OMN-PRI-A2',
    rol_comida: 'principal',
    p: ['pechuga_pollo'],
    p2: ['lentejas_cocidas'],
    c: ['patata_cocida', 'arroz_blanco_cocido'],
    g: ['aove'],
    v: ['brocoli'],
  }),
  plantilla({
    id: 'SEN-OMN-LIG-A1',
    rol_comida: 'ligera',
    p: ['pechuga_pavo', 'huevo_entero'],
    c: ['pan_integral'],
  }),
  plantilla({
    id: 'SEN-OMN-LIG-A2',
    rol_comida: 'ligera',
    p: ['huevo_entero', 'pechuga_pavo'],
    g: ['almendras'],
    f: ['platano'],
  }),
]

const OMN_B: Plantilla[] = [
  plantilla({
    id: 'SEN-OMN-DES-B',
    rol_comida: 'desayuno',
    p: ['pechuga_pavo'],
    p2: ['huevo_entero'],
    c: ['pan_integral', 'avena_copos'],
    g: ['almendras'],
    f: ['platano'],
  }),
  plantilla({
    id: 'SEN-OMN-PRI-B1',
    rol_comida: 'principal',
    p: ['pechuga_pollo'],
    p2: ['lentejas_cocidas'],
    c: ['patata_cocida', 'arroz_blanco_cocido'],
    g: ['aove'],
    v: ['brocoli'],
  }),
  plantilla({
    id: 'SEN-OMN-PRI-B2',
    rol_comida: 'principal',
    p: ['pechuga_pollo'],
    p2: ['lentejas_cocidas'],
    c: ['arroz_blanco_cocido', 'patata_cocida'],
    g: ['aove'],
    v: ['brocoli'],
  }),
  plantilla({
    id: 'SEN-OMN-LIG-B1',
    rol_comida: 'ligera',
    p: ['huevo_entero', 'pechuga_pavo'],
    c: ['pan_integral'],
  }),
  plantilla({
    id: 'SEN-OMN-LIG-B2',
    rol_comida: 'ligera',
    p: ['pechuga_pavo', 'huevo_entero'],
    g: ['almendras'],
    f: ['platano'],
  }),
]

// ---------- Vegetariano ----------
// El queso fresco batido 0 % es la segunda ancla proteica de baja densidad energética que pedía
// §3.7.2: 45 kcal por cada 8 g de proteína y 300 g de ración máxima. Sin él, los desayunos y las
// tomas ligeras se quedaban a treinta puntos porcentuales del objetivo de proteína.
const VEG_SEN: readonly string[] = [
  'huevo_entero',
  'queso_fresco_batido_0',
  'yogur_griego_0',
  'lentejas_cocidas',
  'garbanzos_cocidos',
  'arroz_blanco_cocido',
  'patata_cocida',
  'avena_copos',
  'pan_integral',
  'aove',
  'almendras',
  'brocoli',
  'judia_verde',
  'tomate',
  'platano',
  'manzana',
]

const VEG_A: Plantilla[] = [
  plantilla({
    id: 'SEN-VEG-DES-A',
    rol_comida: 'desayuno',
    p: ['yogur_griego_0'],
    p2: ['queso_fresco_batido_0'],
    c: ['avena_copos', 'pan_integral'],
    g: ['almendras'],
    f: ['platano'],
  }),
  plantilla({
    id: 'SEN-VEG-PRI-A1',
    rol_comida: 'principal',
    p: ['lentejas_cocidas'],
    p2: ['huevo_entero'],
    c: ['arroz_blanco_cocido'],
    g: ['aove'],
    v: ['brocoli'],
  }),
  plantilla({
    id: 'SEN-VEG-PRI-A2',
    rol_comida: 'principal',
    p: ['huevo_entero'],
    p2: ['lentejas_cocidas'],
    c: ['arroz_blanco_cocido'],
    g: ['aove'],
    v: ['brocoli'],
  }),
  plantilla({
    id: 'SEN-VEG-LIG-A1',
    rol_comida: 'ligera',
    p: ['yogur_griego_0'],
    p2: ['queso_fresco_batido_0'],
    c: ['pan_integral'],
  }),
  plantilla({
    id: 'SEN-VEG-LIG-A2',
    rol_comida: 'ligera',
    p: ['yogur_griego_0'],
    p2: ['queso_fresco_batido_0'],
    g: ['almendras'],
    f: ['platano'],
  }),
]

const VEG_B: Plantilla[] = [
  plantilla({
    id: 'SEN-VEG-DES-B',
    rol_comida: 'desayuno',
    p: ['queso_fresco_batido_0'],
    p2: ['huevo_entero'],
    c: ['pan_integral', 'avena_copos'],
    g: ['almendras'],
    f: ['manzana'],
  }),
  plantilla({
    id: 'SEN-VEG-PRI-B1',
    rol_comida: 'principal',
    p: ['huevo_entero'],
    p2: ['lentejas_cocidas'],
    c: ['arroz_blanco_cocido'],
    g: ['aove'],
    v: ['brocoli'],
  }),
  plantilla({
    id: 'SEN-VEG-PRI-B2',
    rol_comida: 'principal',
    p: ['lentejas_cocidas'],
    p2: ['huevo_entero'],
    c: ['arroz_blanco_cocido'],
    g: ['aove'],
    v: ['brocoli'],
  }),
  plantilla({
    id: 'SEN-VEG-LIG-B1',
    rol_comida: 'ligera',
    p: ['queso_fresco_batido_0'],
    p2: ['yogur_griego_0'],
    c: ['pan_integral'],
  }),
  plantilla({
    id: 'SEN-VEG-LIG-B2',
    rol_comida: 'ligera',
    p: ['queso_fresco_batido_0'],
    p2: ['yogur_griego_0'],
    g: ['almendras'],
    f: ['manzana'],
  }),
]

// ---------- Vegano ----------
// La soja texturizada es la segunda ancla proteica de baja densidad energética del banco vegano
// (105 kcal por cada 15,5 g de proteína): sin ella, el yogur de soja tenía que cubrir solo
// desayunos de 40 g de proteína y se quedaba en 27 g. El tofu entra también en el desayuno como
// segunda ancla (tofu revuelto), que es lo que arregla las tomas grandes de la mañana.
const VGN_SEN: readonly string[] = [
  'tofu_firme',
  'lentejas_cocidas',
  'garbanzos_cocidos',
  'yogur_soja_proteico',
  'soja_texturizada_hidratada',
  'arroz_blanco_cocido',
  'patata_cocida',
  'avena_copos',
  'pan_integral',
  'aove',
  'almendras',
  'brocoli',
  'judia_verde',
  'tomate',
  'platano',
  'manzana',
]

const VGN_A: Plantilla[] = [
  plantilla({
    id: 'SEN-VGN-DES-A',
    rol_comida: 'desayuno',
    p: ['tofu_firme'],
    p2: ['yogur_soja_proteico'],
    c: ['avena_copos', 'pan_integral'],
    g: ['almendras'],
    f: ['platano'],
  }),
  plantilla({
    id: 'SEN-VGN-PRI-A1',
    rol_comida: 'principal',
    p: ['tofu_firme'],
    p2: ['lentejas_cocidas'],
    c: ['arroz_blanco_cocido'],
    g: ['aove'],
    v: ['brocoli'],
  }),
  plantilla({
    id: 'SEN-VGN-PRI-A2',
    rol_comida: 'principal',
    p: ['lentejas_cocidas'],
    p2: ['tofu_firme'],
    c: ['arroz_blanco_cocido'],
    g: ['aove'],
    v: ['brocoli'],
  }),
  plantilla({
    id: 'SEN-VGN-LIG-A1',
    rol_comida: 'ligera',
    p: ['yogur_soja_proteico'],
    c: ['pan_integral'],
  }),
  plantilla({
    id: 'SEN-VGN-LIG-A2',
    rol_comida: 'ligera',
    p: ['yogur_soja_proteico'],
    g: ['almendras'],
    f: ['platano'],
  }),
]

const VGN_B: Plantilla[] = [
  plantilla({
    id: 'SEN-VGN-DES-B',
    rol_comida: 'desayuno',
    p: ['soja_texturizada_hidratada'],
    p2: ['yogur_soja_proteico'],
    c: ['pan_integral', 'avena_copos'],
    g: ['almendras'],
    f: ['manzana'],
  }),
  plantilla({
    id: 'SEN-VGN-PRI-B1',
    rol_comida: 'principal',
    p: ['soja_texturizada_hidratada'],
    p2: ['lentejas_cocidas'],
    c: ['arroz_blanco_cocido'],
    g: ['aove'],
    v: ['brocoli'],
  }),
  plantilla({
    id: 'SEN-VGN-PRI-B2',
    rol_comida: 'principal',
    p: ['lentejas_cocidas'],
    p2: ['soja_texturizada_hidratada'],
    c: ['arroz_blanco_cocido'],
    g: ['aove'],
    v: ['brocoli'],
  }),
  plantilla({
    id: 'SEN-VGN-LIG-B1',
    rol_comida: 'ligera',
    p: ['yogur_soja_proteico'],
    c: ['pan_integral'],
  }),
  plantilla({
    id: 'SEN-VGN-LIG-B2',
    rol_comida: 'ligera',
    p: ['yogur_soja_proteico'],
    g: ['almendras'],
    f: ['manzana'],
  }),
]

// ---------- Sin lactosa ----------
// Mismo esqueleto que el omnívoro —patata y arroz rotando en las comidas principales, atún en la
// lista blanca pero fuera de las plantillas—; el único lácteo es la variante sin lactosa de §3.2.
const SLA_SEN: readonly string[] = [
  'pechuga_pollo',
  'huevo_entero',
  'atun_natural',
  'queso_fresco_batido_0_sl',
  'lentejas_cocidas',
  'arroz_blanco_cocido',
  'patata_cocida',
  'avena_copos',
  'pan_integral',
  'aove',
  'almendras',
  'brocoli',
  'judia_verde',
  'tomate',
  'platano',
  'manzana',
]

const SLA_A: Plantilla[] = [
  plantilla({
    id: 'SEN-SLA-DES-A',
    rol_comida: 'desayuno',
    p: ['queso_fresco_batido_0_sl'],
    p2: ['huevo_entero'],
    c: ['avena_copos', 'pan_integral'],
    g: ['almendras'],
    f: ['platano'],
  }),
  plantilla({
    id: 'SEN-SLA-PRI-A1',
    rol_comida: 'principal',
    p: ['pechuga_pollo'],
    p2: ['lentejas_cocidas'],
    c: ['arroz_blanco_cocido', 'patata_cocida'],
    g: ['aove'],
    v: ['brocoli'],
  }),
  plantilla({
    id: 'SEN-SLA-PRI-A2',
    rol_comida: 'principal',
    p: ['pechuga_pollo'],
    p2: ['lentejas_cocidas'],
    c: ['patata_cocida', 'arroz_blanco_cocido'],
    g: ['aove'],
    v: ['brocoli'],
  }),
  plantilla({
    id: 'SEN-SLA-LIG-A1',
    rol_comida: 'ligera',
    p: ['queso_fresco_batido_0_sl', 'huevo_entero'],
    c: ['pan_integral'],
  }),
  plantilla({
    id: 'SEN-SLA-LIG-A2',
    rol_comida: 'ligera',
    p: ['queso_fresco_batido_0_sl', 'huevo_entero'],
    g: ['almendras'],
    f: ['platano'],
  }),
]

const SLA_B: Plantilla[] = [
  plantilla({
    id: 'SEN-SLA-DES-B',
    rol_comida: 'desayuno',
    p: ['huevo_entero'],
    p2: ['queso_fresco_batido_0_sl'],
    c: ['pan_integral', 'avena_copos'],
    g: ['almendras'],
    f: ['platano'],
  }),
  plantilla({
    id: 'SEN-SLA-PRI-B1',
    rol_comida: 'principal',
    p: ['pechuga_pollo'],
    p2: ['lentejas_cocidas'],
    c: ['patata_cocida', 'arroz_blanco_cocido'],
    g: ['aove'],
    v: ['brocoli'],
  }),
  plantilla({
    id: 'SEN-SLA-PRI-B2',
    rol_comida: 'principal',
    p: ['pechuga_pollo'],
    p2: ['lentejas_cocidas'],
    c: ['arroz_blanco_cocido', 'patata_cocida'],
    g: ['aove'],
    v: ['brocoli'],
  }),
  plantilla({
    id: 'SEN-SLA-LIG-B1',
    rol_comida: 'ligera',
    p: ['huevo_entero', 'queso_fresco_batido_0_sl'],
    c: ['pan_integral'],
  }),
  plantilla({
    id: 'SEN-SLA-LIG-B2',
    rol_comida: 'ligera',
    p: ['queso_fresco_batido_0_sl', 'huevo_entero'],
    g: ['almendras'],
    f: ['platano'],
  }),
]

// ---------- Sin gluten ----------
// Ni avena ni pan integral llevan el tag `sin_gluten` en `foods.json`: el pan del desayuno lo
// sustituyen las tortitas de arroz, y el hidrato de las comidas lo reparten el arroz y la patata,
// que rotan entre las dos variantes de comida principal. El atún se queda en la lista blanca.
const SGL_SEN: readonly string[] = [
  'pechuga_pollo',
  'huevo_entero',
  'atun_natural',
  'yogur_griego_0',
  'lentejas_cocidas',
  'arroz_blanco_cocido',
  'patata_cocida',
  'tortitas_arroz',
  'aove',
  'almendras',
  'brocoli',
  'judia_verde',
  'tomate',
  'platano',
  'manzana',
]

const SGL_A: Plantilla[] = [
  plantilla({
    id: 'SEN-SGL-DES-A',
    rol_comida: 'desayuno',
    p: ['yogur_griego_0'],
    p2: ['huevo_entero'],
    c: ['tortitas_arroz'],
    g: ['almendras'],
    f: ['platano'],
  }),
  plantilla({
    id: 'SEN-SGL-PRI-A1',
    rol_comida: 'principal',
    p: ['pechuga_pollo'],
    p2: ['lentejas_cocidas'],
    c: ['arroz_blanco_cocido', 'patata_cocida'],
    g: ['aove'],
    v: ['brocoli'],
  }),
  plantilla({
    id: 'SEN-SGL-PRI-A2',
    rol_comida: 'principal',
    p: ['pechuga_pollo'],
    p2: ['lentejas_cocidas'],
    c: ['patata_cocida', 'arroz_blanco_cocido'],
    g: ['aove'],
    v: ['brocoli'],
  }),
  plantilla({
    id: 'SEN-SGL-LIG-A1',
    rol_comida: 'ligera',
    p: ['yogur_griego_0', 'huevo_entero'],
    c: ['tortitas_arroz'],
  }),
  plantilla({
    id: 'SEN-SGL-LIG-A2',
    rol_comida: 'ligera',
    p: ['yogur_griego_0', 'huevo_entero'],
    g: ['almendras'],
    f: ['platano'],
  }),
]

const SGL_B: Plantilla[] = [
  plantilla({
    id: 'SEN-SGL-DES-B',
    rol_comida: 'desayuno',
    p: ['huevo_entero'],
    p2: ['yogur_griego_0'],
    c: ['tortitas_arroz'],
    g: ['almendras'],
    f: ['manzana'],
  }),
  plantilla({
    id: 'SEN-SGL-PRI-B1',
    rol_comida: 'principal',
    p: ['pechuga_pollo'],
    p2: ['lentejas_cocidas'],
    c: ['patata_cocida', 'arroz_blanco_cocido'],
    g: ['aove'],
    v: ['brocoli'],
  }),
  plantilla({
    id: 'SEN-SGL-PRI-B2',
    rol_comida: 'principal',
    p: ['pechuga_pollo'],
    p2: ['lentejas_cocidas'],
    c: ['arroz_blanco_cocido', 'patata_cocida'],
    g: ['aove'],
    v: ['brocoli'],
  }),
  plantilla({
    id: 'SEN-SGL-LIG-B1',
    rol_comida: 'ligera',
    p: ['yogur_griego_0', 'huevo_entero'],
    c: ['tortitas_arroz'],
  }),
  plantilla({
    id: 'SEN-SGL-LIG-B2',
    rol_comida: 'ligera',
    p: ['yogur_griego_0', 'huevo_entero'],
    g: ['almendras'],
    f: ['manzana'],
  }),
]

// ---------- Low-carb ----------
// Las comidas principales llevan las DOS anclas low-carb de §3.7.2 (arroz de coliflor y pan
// proteico) y la rotación de hidrato elige entre ellas: con una sola, el techo de hidrato de la
// plantilla se quedaba tan bajo que la vía de escape de §3.2 ganaba siempre y la lista de la
// compra de alguien que había pedido low-carb salía encabezada por patatas.
// `patata_cocida` sigue siendo esa vía de escape (§3.2), no un candidato de §3.7.2, y en modo
// sencillo el generador la limita a UNA toma del día (ver `construirDia`).
const LCB_SEN: readonly string[] = [
  'huevo_entero',
  'pechuga_pollo',
  'atun_natural',
  'queso_fresco_batido_0',
  'yogur_griego_0',
  'arroz_coliflor',
  'pan_proteico',
  'aove',
  'aguacate',
  'almendras',
  'brocoli',
  'judia_verde',
  'tomate',
  'fresas',
]

const LCB_A: Plantilla[] = [
  plantilla({
    id: 'SEN-LCB-DES-A',
    rol_comida: 'desayuno',
    p: ['huevo_entero'],
    p2: ['yogur_griego_0'],
    c: ['pan_proteico'],
    g: ['aguacate'],
    f: ['fresas'],
  }),
  plantilla({
    id: 'SEN-LCB-PRI-A1',
    rol_comida: 'principal',
    p: ['pechuga_pollo', 'atun_natural'],
    p2: ['huevo_entero'],
    c: ['arroz_coliflor', 'pan_proteico'],
    g: ['aove'],
    v: ['brocoli'],
  }),
  plantilla({
    id: 'SEN-LCB-PRI-A2',
    rol_comida: 'principal',
    p: ['atun_natural', 'pechuga_pollo'],
    p2: ['huevo_entero'],
    c: ['pan_proteico', 'arroz_coliflor'],
    g: ['aove'],
    v: ['brocoli'],
  }),
  plantilla({
    id: 'SEN-LCB-LIG-A1',
    rol_comida: 'ligera',
    p: ['yogur_griego_0', 'huevo_entero'],
    g: ['almendras'],
  }),
  plantilla({
    id: 'SEN-LCB-LIG-A2',
    rol_comida: 'ligera',
    p: ['yogur_griego_0', 'huevo_entero'],
    g: ['aguacate'],
    f: ['fresas'],
  }),
]

const LCB_B: Plantilla[] = [
  plantilla({
    id: 'SEN-LCB-DES-B',
    rol_comida: 'desayuno',
    p: ['yogur_griego_0'],
    p2: ['huevo_entero'],
    c: ['pan_proteico'],
    g: ['almendras'],
    f: ['fresas'],
  }),
  plantilla({
    id: 'SEN-LCB-PRI-B1',
    rol_comida: 'principal',
    p: ['atun_natural', 'pechuga_pollo'],
    p2: ['huevo_entero'],
    c: ['pan_proteico', 'arroz_coliflor'],
    g: ['aove'],
    v: ['brocoli'],
  }),
  plantilla({
    id: 'SEN-LCB-PRI-B2',
    rol_comida: 'principal',
    p: ['pechuga_pollo', 'atun_natural'],
    p2: ['huevo_entero'],
    c: ['arroz_coliflor', 'pan_proteico'],
    g: ['aove'],
    v: ['brocoli'],
  }),
  plantilla({
    id: 'SEN-LCB-LIG-B1',
    rol_comida: 'ligera',
    p: ['yogur_griego_0', 'huevo_entero'],
    g: ['aguacate'],
  }),
  plantilla({
    id: 'SEN-LCB-LIG-B2',
    rol_comida: 'ligera',
    p: ['yogur_griego_0', 'huevo_entero'],
    g: ['almendras'],
    f: ['fresas'],
  }),
]

const HC_ALTERNO_SENCILLO: FoodQuery = {
  rol: 'carbohidrato',
  grupo: 'carbohidrato',
  estado_excluye: ['crudo'],
  ids_preferidos: ['patata_cocida'],
}

/** Banco sencillo por preferencia dietética (§3.7.2). */
export const BANCOS_SENCILLOS: Record<Preferencia, BancoSencillo> = {
  omnivoro: { candidatos: OMN_SEN, A: OMN_A, B: OMN_B, hcAlterno: null },
  vegetariano: { candidatos: VEG_SEN, A: VEG_A, B: VEG_B, hcAlterno: null },
  vegano: { candidatos: VGN_SEN, A: VGN_A, B: VGN_B, hcAlterno: null },
  sin_lactosa: { candidatos: SLA_SEN, A: SLA_A, B: SLA_B, hcAlterno: null },
  sin_gluten: { candidatos: SGL_SEN, A: SGL_A, B: SGL_B, hcAlterno: null },
  low_carb: { candidatos: LCB_SEN, A: LCB_A, B: LCB_B, hcAlterno: HC_ALTERNO_SENCILLO },
}

/**
 * Ids que pueden llegar a la lista de la compra de una semana sencilla: la lista blanca de
 * §3.7.2 más la vía de escape de §3.2, que no es un candidato de la tabla pero sí puede aparecer
 * en el plato (solo en low-carb y solo en una toma del día). El respaldo de §3.7.2 se queda en
 * `candidatos` a secas: no puede añadir patata a una segunda toma.
 */
export function idsPermitidosSemana(banco: BancoSencillo): Set<string> {
  const ids = new Set<string>(banco.candidatos)
  for (const id of banco.hcAlterno?.ids_preferidos ?? []) ids.add(id)
  return ids
}

/** Todos los ids que declaran las `FoodQuery` de un banco sencillo (para los tests y la guarda). */
export function idsDeBanco(banco: BancoSencillo): string[] {
  const ids = new Set<string>()
  const anadir = (q: FoodQuery | null): void => {
    for (const id of q?.ids_preferidos ?? []) ids.add(id)
  }
  for (const p of [...banco.A, ...banco.B]) {
    anadir(p.ancla_proteina)
    anadir(p.ancla_proteina_2)
    anadir(p.ancla_carbohidrato)
    anadir(p.ancla_grasa)
    anadir(p.verdura)
    anadir(p.fruta)
  }
  anadir(banco.hcAlterno)
  return [...ids].sort((a, b) => a.localeCompare(b))
}

// ---------- Restricciones combinadas (§3.7.2, v1.1) ----------
//
// La tabla de candidatos de §3.7.2 está indexada por `preferencia_efectiva` (el banco), que con
// la decisión E puede llevar solo una parte de lo que el usuario ha pedido: un vegetariano sin
// gluten usa el banco `vegetariano` y su fila de candidatos lleva avena y pan integral, que no
// puede comer. La lista efectiva se construye en los cuatro pasos normativos de §3.7.2:
// sustitución por variante `_sl`, filtrado por la conjunción base + restricciones, relleno cuando
// un rol se queda corto y, si ni así llega, desactivación del modo sencillo. Ninguno de los pasos
// puede servir un alimento que incumpla la base o una restricción.

/** Mínimo de candidatos por rol de §3.7.2 (regla 4): 2 en proteína e hidrato, 1 en el resto. */
export const MINIMOS_ROL_SENCILLO: ReadonlyArray<{ rol: RolAlimento; min: number }> = [
  { rol: 'proteina', min: 2 },
  { rol: 'carbohidrato', min: 2 },
  { rol: 'grasa', min: 1 },
  { rol: 'verdura', min: 1 },
  { rol: 'fruta', min: 1 },
]

function sirveParaRol(a: Alimento, rol: RolAlimento, perfil: PerfilDietetico): boolean {
  if (!a.roles.includes(rol)) return false
  // Los cereales, pastas y arroces en crudo están fuera del banco (§3.0).
  if (rol === 'carbohidrato' && a.estado === 'crudo') return false
  if (!perfil.restricciones.includes('sin_lactosa') && esVarianteSinLactosa(a)) return false
  // v1.2: ni los `extra` (§3.0) ni los excluidos (§3.2b) pueden entrar por el relleno de la
  // regla 4 de §3.7.2, igual que no pueden entrar por la lista de la tabla.
  return pasaPerfilMenu(a, perfil)
}

function candidatoValido(id: string, perfil: PerfilDietetico): boolean {
  const a = alimentoPorId(id)
  return a !== undefined && pasaPerfilMenu(a, perfil)
}

function cuentaRol(ids: readonly string[], rol: RolAlimento, perfil: PerfilDietetico): number {
  let n = 0
  for (const id of ids) {
    const a = alimentoPorId(id)
    if (a && sirveParaRol(a, rol, perfil)) n++
  }
  return n
}

/**
 * Rol con el que un favorito entra en la lista corta: el primero de `MINIMOS_ROL_SENCILLO` que
 * el alimento sirve. La legumbre, que declara `proteina` y `carbohidrato`, entra como proteína,
 * que es su papel en las plantillas del banco sencillo.
 */
function rolDeFavorito(a: Alimento, perfil: PerfilDietetico): RolAlimento | null {
  for (const { rol } of MINIMOS_ROL_SENCILLO) if (sirveParaRol(a, rol, perfil)) return rol
  return null
}

/**
 * Coloca los favoritos en cabeza de su rol dentro de la lista corta (§3.2b, modo sencillo).
 * Modifica `ids` en el sitio. Un favorito ya presente sube a la primera posición de su rol; uno
 * que falta entra a cambio del último candidato del mismo rol que no use ninguna plantilla del
 * banco (día A ni día B). Determinista y sin `Math.random`.
 */
function colocarFavoritos(ids: string[], base: BancoSencillo, perfil: PerfilDietetico): void {
  if (perfil.favoritos.length === 0) return
  const enPlantillas = new Set(idsDeBanco(base))
  // El orden del usuario es normativo, y se recorre al revés porque cada favorito se inserta en
  // la primera posición de su rol: así el primero de la lista acaba delante de todos.
  for (const id of [...perfil.favoritos].reverse()) {
    const a = alimentoPorId(id)
    if (!a) continue
    const rol = rolDeFavorito(a, perfil)
    if (!rol) continue
    if (ids.includes(id)) {
      ids.splice(ids.indexOf(id), 1)
    } else {
      // Uno entra, uno sale: se descarta el último candidato del mismo rol que ninguna plantilla
      // esté usando (§3.2b). Si todos están en uso no se descarta ninguno y el favorito entra
      // igual: quien vigila de verdad el tope de 12 es `generarEjemplos`, contando los alimentos
      // de la semana ya construida y retirando favoritos si no caben.
      for (let i = ids.length - 1; i >= 0; i--) {
        const c = alimentoPorId(ids[i])
        if (!c || enPlantillas.has(ids[i]) || !sirveParaRol(c, rol, perfil)) continue
        ids.splice(i, 1)
        break
      }
    }
    const primero = ids.findIndex((otro) => {
      const c = alimentoPorId(otro)
      return c !== undefined && sirveParaRol(c, rol, perfil)
    })
    ids.splice(primero === -1 ? ids.length : primero, 0, id)
  }
}

/**
 * Banco sencillo con la lista de candidatos ya resuelta para el perfil del usuario (§3.7.2).
 * `null` significa que ni con el relleno hay candidatos suficientes: el modo sencillo se desactiva
 * y el menú se genera con la rotación normal de §3.2, que sí tiene toda la base disponible.
 */
export function bancoSencilloEfectivo(perfil: PerfilDietetico): BancoSencillo | null {
  const base = BANCOS_SENCILLOS[perfil.banco]
  // 1 y 2: la fila del banco, con las variantes sin lactosa en su misma posición.
  const conVariantes = sustituirSinLactosa(base.candidatos, perfil)
  // 3: filtrado por la conjunción base + todas las restricciones y, desde la v1.2, retirada de
  // los excluidos (§3.2b, modo sencillo, punto 2) justo después de ese filtrado.
  const ids: string[] = conVariantes.filter((id) => candidatoValido(id, perfil))
  // 3 bis (§3.2b, modo sencillo, punto 3): los favoritos que pasan el filtro y el rol se colocan
  // en las primeras posiciones de la lista corta de su rol, en el orden del usuario, delante de
  // los candidatos de la tabla. Un favorito que no estaba en la lista ENTRA, y para no tocar el
  // tope de variedad se descarta el último candidato de ese rol que ninguna plantilla del día A
  // ni del día B esté usando; si todos están en uso, el favorito no entra.
  colocarFavoritos(ids, base, perfil)

  // 4: relleno por rol, parando en cuanto se llega al mínimo.
  const respaldoOmnivoro = sustituirSinLactosa(BANCOS_SENCILLOS.omnivoro.candidatos, perfil)
  const restoDeLaBase = [...ALIMENTOS].sort((x, y) => x.id.localeCompare(y.id, 'es'))
  for (const { rol, min } of MINIMOS_ROL_SENCILLO) {
    let n = cuentaRol(ids, rol, perfil)
    if (n >= min) continue
    // a) los candidatos de la fila `omnivoro` que sí pasan el filtro.
    for (const id of respaldoOmnivoro) {
      if (n >= min) break
      const a = alimentoPorId(id)
      if (!a || ids.includes(id) || !sirveParaRol(a, rol, perfil)) continue
      ids.push(id)
      n++
    }
    // b) el resto de `foods.json`, por id, para que siga siendo determinista.
    for (const a of restoDeLaBase) {
      if (n >= min) break
      if (ids.includes(a.id) || !sirveParaRol(a, rol, perfil)) continue
      ids.push(a.id)
      n++
    }
    // c) ni así: el modo sencillo se desactiva para este usuario.
    if (n < min) return null
  }

  // La vía de escape de §3.2 tampoco puede saltarse el filtro.
  const escape = (base.hcAlterno?.ids_preferidos ?? []).filter((id) => candidatoValido(id, perfil))
  const hcAlterno =
    base.hcAlterno && escape.length > 0 ? { ...base.hcAlterno, ids_preferidos: escape } : null

  return { candidatos: ids, A: base.A, B: base.B, hcAlterno }
}
