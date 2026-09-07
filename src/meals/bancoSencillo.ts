// Banco sencillo (docs/SPEC-ux-comidas-pdf.md §3.7.2).
//
// Con `inputs.menu_sencillo === true` el generador cambia de banco: en vez de rotar plantillas y
// alimentos para dar variedad (§3.2), usa DOS variantes por rol de comida —el banco `A` para los
// días 1, 3, 5 y 7 y el banco `B` para los días 2, 4 y 6— resueltas contra una lista corta de
// alimentos básicos y repetibles. Todo lo demás sigue igual: mismas plantillas, mismo algoritmo
// de escalado de §3.3, mismas tolerancias y el mismo determinismo (sin `Math.random`).
//
// La regla dura es el tope de variedad: **como mucho 12 alimentos distintos en toda la semana**.
// Aquí se garantiza por construcción: `candidatos` enumera los ids que pueden aparecer en la
// semana de esa preferencia y ninguna `FoodQuery` de sus plantillas sale de esa lista, así que la
// unión de los días A y B nunca la supera. `src/meals/__tests__/sencillo.test.ts` comprueba las
// dos cosas (que la lista no pasa de 12 y que las plantillas no se salen de ella).
import type { Preferencia } from '../engine/types'
import type { FoodQuery, Plantilla } from './plantillas'

/** Tope duro de alimentos distintos en la semana (§3.7.2, regla 1). */
export const MAX_ALIMENTOS_SENCILLO = 12

// ---------- Atajos de consulta ----------
// Las consultas del banco sencillo son deliberadamente pobres: rol + lista cerrada de ids. El
// filtro de preferencia de §3.2 se aplica antes (lo hace `candidatos` en `index.ts`), así que un
// id que no pase la preferencia simplemente no entra y gana el siguiente de la lista.
const prot = (ids: string[]): FoodQuery => ({ rol: 'proteina', ids_preferidos: ids })
const carb = (ids: string[]): FoodQuery => ({ rol: 'carbohidrato', ids_preferidos: ids })
const grasa = (ids: string[]): FoodQuery => ({ rol: 'grasa', ids_preferidos: ids })
const verd = (ids: string[]): FoodQuery => ({ rol: 'verdura', grupo: 'verdura', ids_preferidos: ids })
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
  /** Ids de `foods.json` que pueden aparecer en la semana. Nunca más de `MAX_ALIMENTOS_SENCILLO`. */
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
// desayuno de 40 g de proteína, se quedaba solo cubriendo el objetivo. Sale de la misma lista de
// candidatos de §3.7.2 y a cambio la semana renuncia a la segunda fruta.
const OMN_SEN: readonly string[] = [
  'huevo_entero',
  'pechuga_pavo',
  'pechuga_pollo',
  'atun_natural',
  'arroz_blanco_cocido',
  'patata_cocida',
  'avena_copos',
  'pan_integral',
  'aove',
  'almendras',
  'brocoli',
  'platano',
]

const OMN_A: Plantilla[] = [
  plantilla({ id: 'SEN-OMN-DES-A', rol_comida: 'desayuno', p: ['huevo_entero'], p2: ['pechuga_pavo'], c: ['avena_copos', 'pan_integral'], g: ['almendras'], f: ['platano'] }),
  plantilla({ id: 'SEN-OMN-PRI-A1', rol_comida: 'principal', p: ['pechuga_pollo', 'atun_natural'], c: ['arroz_blanco_cocido', 'patata_cocida'], g: ['aove'], v: ['brocoli'] }),
  plantilla({ id: 'SEN-OMN-PRI-A2', rol_comida: 'principal', p: ['atun_natural', 'pechuga_pollo'], c: ['patata_cocida', 'arroz_blanco_cocido'], g: ['aove'], v: ['brocoli'] }),
  plantilla({ id: 'SEN-OMN-LIG-A1', rol_comida: 'ligera', p: ['pechuga_pavo', 'huevo_entero', 'atun_natural'], c: ['pan_integral'] }),
  plantilla({ id: 'SEN-OMN-LIG-A2', rol_comida: 'ligera', p: ['huevo_entero', 'atun_natural'], g: ['almendras'], f: ['platano'] }),
]

const OMN_B: Plantilla[] = [
  plantilla({ id: 'SEN-OMN-DES-B', rol_comida: 'desayuno', p: ['pechuga_pavo'], p2: ['huevo_entero'], c: ['pan_integral', 'avena_copos'], g: ['almendras'], f: ['platano'] }),
  plantilla({ id: 'SEN-OMN-PRI-B1', rol_comida: 'principal', p: ['atun_natural', 'pechuga_pollo'], c: ['patata_cocida', 'arroz_blanco_cocido'], g: ['aove'], v: ['brocoli'] }),
  plantilla({ id: 'SEN-OMN-PRI-B2', rol_comida: 'principal', p: ['pechuga_pollo', 'atun_natural'], c: ['arroz_blanco_cocido', 'patata_cocida'], g: ['aove'], v: ['brocoli'] }),
  plantilla({ id: 'SEN-OMN-LIG-B1', rol_comida: 'ligera', p: ['atun_natural', 'pechuga_pavo', 'huevo_entero'], c: ['pan_integral'] }),
  plantilla({ id: 'SEN-OMN-LIG-B2', rol_comida: 'ligera', p: ['pechuga_pavo', 'huevo_entero'], g: ['almendras'], f: ['platano'] }),
]

// ---------- Vegetariano ----------
const VEG_SEN: readonly string[] = [
  'huevo_entero',
  'yogur_griego_0',
  'lentejas_cocidas',
  'arroz_blanco_cocido',
  'patata_cocida',
  'avena_copos',
  'pan_integral',
  'aove',
  'almendras',
  'brocoli',
  'platano',
  'manzana',
]

const VEG_A: Plantilla[] = [
  plantilla({ id: 'SEN-VEG-DES-A', rol_comida: 'desayuno', p: ['yogur_griego_0'], p2: ['huevo_entero'], c: ['avena_copos', 'pan_integral'], g: ['almendras'], f: ['platano'] }),
  plantilla({ id: 'SEN-VEG-PRI-A1', rol_comida: 'principal', p: ['lentejas_cocidas'], p2: ['huevo_entero'], c: ['arroz_blanco_cocido', 'patata_cocida'], g: ['aove'], v: ['brocoli'] }),
  plantilla({ id: 'SEN-VEG-PRI-A2', rol_comida: 'principal', p: ['huevo_entero'], p2: ['lentejas_cocidas'], c: ['patata_cocida', 'arroz_blanco_cocido'], g: ['aove'], v: ['brocoli'] }),
  plantilla({ id: 'SEN-VEG-LIG-A1', rol_comida: 'ligera', p: ['yogur_griego_0'], c: ['pan_integral'] }),
  plantilla({ id: 'SEN-VEG-LIG-A2', rol_comida: 'ligera', p: ['yogur_griego_0'], g: ['almendras'], f: ['platano'] }),
]

const VEG_B: Plantilla[] = [
  plantilla({ id: 'SEN-VEG-DES-B', rol_comida: 'desayuno', p: ['yogur_griego_0'], p2: ['huevo_entero'], c: ['pan_integral', 'avena_copos'], g: ['almendras'], f: ['manzana'] }),
  plantilla({ id: 'SEN-VEG-PRI-B1', rol_comida: 'principal', p: ['huevo_entero'], p2: ['lentejas_cocidas'], c: ['patata_cocida', 'arroz_blanco_cocido'], g: ['aove'], v: ['brocoli'] }),
  plantilla({ id: 'SEN-VEG-PRI-B2', rol_comida: 'principal', p: ['lentejas_cocidas'], p2: ['huevo_entero'], c: ['arroz_blanco_cocido', 'patata_cocida'], g: ['aove'], v: ['brocoli'] }),
  plantilla({ id: 'SEN-VEG-LIG-B1', rol_comida: 'ligera', p: ['yogur_griego_0'], c: ['pan_integral'] }),
  plantilla({ id: 'SEN-VEG-LIG-B2', rol_comida: 'ligera', p: ['yogur_griego_0'], g: ['almendras'], f: ['manzana'] }),
]

// ---------- Vegano ----------
const VGN_SEN: readonly string[] = [
  'yogur_soja_proteico',
  'tofu_firme',
  'lentejas_cocidas',
  'arroz_blanco_cocido',
  'patata_cocida',
  'avena_copos',
  'pan_integral',
  'aove',
  'almendras',
  'brocoli',
  'platano',
  'manzana',
]

const VGN_A: Plantilla[] = [
  plantilla({ id: 'SEN-VGN-DES-A', rol_comida: 'desayuno', p: ['yogur_soja_proteico'], c: ['avena_copos', 'pan_integral'], g: ['almendras'], f: ['platano'] }),
  plantilla({ id: 'SEN-VGN-PRI-A1', rol_comida: 'principal', p: ['tofu_firme'], p2: ['lentejas_cocidas'], c: ['arroz_blanco_cocido', 'patata_cocida'], g: ['aove'], v: ['brocoli'] }),
  plantilla({ id: 'SEN-VGN-PRI-A2', rol_comida: 'principal', p: ['lentejas_cocidas'], p2: ['tofu_firme'], c: ['patata_cocida', 'arroz_blanco_cocido'], g: ['aove'], v: ['brocoli'] }),
  plantilla({ id: 'SEN-VGN-LIG-A1', rol_comida: 'ligera', p: ['yogur_soja_proteico'], c: ['pan_integral'] }),
  plantilla({ id: 'SEN-VGN-LIG-A2', rol_comida: 'ligera', p: ['yogur_soja_proteico'], g: ['almendras'], f: ['platano'] }),
]

const VGN_B: Plantilla[] = [
  plantilla({ id: 'SEN-VGN-DES-B', rol_comida: 'desayuno', p: ['yogur_soja_proteico'], c: ['pan_integral', 'avena_copos'], g: ['almendras'], f: ['manzana'] }),
  plantilla({ id: 'SEN-VGN-PRI-B1', rol_comida: 'principal', p: ['lentejas_cocidas'], p2: ['tofu_firme'], c: ['patata_cocida', 'arroz_blanco_cocido'], g: ['aove'], v: ['brocoli'] }),
  plantilla({ id: 'SEN-VGN-PRI-B2', rol_comida: 'principal', p: ['tofu_firme'], p2: ['lentejas_cocidas'], c: ['arroz_blanco_cocido', 'patata_cocida'], g: ['aove'], v: ['brocoli'] }),
  plantilla({ id: 'SEN-VGN-LIG-B1', rol_comida: 'ligera', p: ['yogur_soja_proteico'], c: ['pan_integral'] }),
  plantilla({ id: 'SEN-VGN-LIG-B2', rol_comida: 'ligera', p: ['yogur_soja_proteico'], g: ['almendras'], f: ['manzana'] }),
]

// ---------- Sin lactosa ----------
// Mismo esqueleto que el omnívoro; el único lácteo es la variante sin lactosa de §3.2.
const SLA_SEN: readonly string[] = [
  'queso_fresco_batido_0_sl',
  'huevo_entero',
  'pechuga_pollo',
  'atun_natural',
  'arroz_blanco_cocido',
  'patata_cocida',
  'avena_copos',
  'pan_integral',
  'aove',
  'almendras',
  'brocoli',
  'platano',
]

const SLA_A: Plantilla[] = [
  plantilla({ id: 'SEN-SLA-DES-A', rol_comida: 'desayuno', p: ['queso_fresco_batido_0_sl'], p2: ['huevo_entero'], c: ['avena_copos', 'pan_integral'], g: ['almendras'], f: ['platano'] }),
  plantilla({ id: 'SEN-SLA-PRI-A1', rol_comida: 'principal', p: ['pechuga_pollo', 'atun_natural'], c: ['arroz_blanco_cocido', 'patata_cocida'], g: ['aove'], v: ['brocoli'] }),
  plantilla({ id: 'SEN-SLA-PRI-A2', rol_comida: 'principal', p: ['atun_natural', 'pechuga_pollo'], c: ['patata_cocida', 'arroz_blanco_cocido'], g: ['aove'], v: ['brocoli'] }),
  plantilla({ id: 'SEN-SLA-LIG-A1', rol_comida: 'ligera', p: ['queso_fresco_batido_0_sl', 'huevo_entero'], c: ['pan_integral'] }),
  plantilla({ id: 'SEN-SLA-LIG-A2', rol_comida: 'ligera', p: ['queso_fresco_batido_0_sl', 'huevo_entero'], g: ['almendras'], f: ['platano'] }),
]

const SLA_B: Plantilla[] = [
  plantilla({ id: 'SEN-SLA-DES-B', rol_comida: 'desayuno', p: ['huevo_entero'], p2: ['queso_fresco_batido_0_sl'], c: ['pan_integral', 'avena_copos'], g: ['almendras'], f: ['platano'] }),
  plantilla({ id: 'SEN-SLA-PRI-B1', rol_comida: 'principal', p: ['atun_natural', 'pechuga_pollo'], c: ['patata_cocida', 'arroz_blanco_cocido'], g: ['aove'], v: ['brocoli'] }),
  plantilla({ id: 'SEN-SLA-PRI-B2', rol_comida: 'principal', p: ['pechuga_pollo', 'atun_natural'], c: ['arroz_blanco_cocido', 'patata_cocida'], g: ['aove'], v: ['brocoli'] }),
  plantilla({ id: 'SEN-SLA-LIG-B1', rol_comida: 'ligera', p: ['huevo_entero', 'queso_fresco_batido_0_sl'], c: ['pan_integral'] }),
  plantilla({ id: 'SEN-SLA-LIG-B2', rol_comida: 'ligera', p: ['queso_fresco_batido_0_sl', 'huevo_entero'], g: ['almendras'], f: ['platano'] }),
]

// ---------- Sin gluten ----------
// Ni avena ni pan integral llevan el tag `sin_gluten` en `foods.json`: el pan del desayuno lo
// sustituyen las tortitas de arroz y el hidrato de las comidas, el arroz y la patata.
const SGL_SEN: readonly string[] = [
  'yogur_griego_0',
  'huevo_entero',
  'pechuga_pollo',
  'atun_natural',
  'arroz_blanco_cocido',
  'patata_cocida',
  'tortitas_arroz',
  'aove',
  'almendras',
  'brocoli',
  'platano',
  'manzana',
]

const SGL_A: Plantilla[] = [
  plantilla({ id: 'SEN-SGL-DES-A', rol_comida: 'desayuno', p: ['yogur_griego_0'], p2: ['huevo_entero'], c: ['tortitas_arroz'], g: ['almendras'], f: ['platano'] }),
  plantilla({ id: 'SEN-SGL-PRI-A1', rol_comida: 'principal', p: ['pechuga_pollo', 'atun_natural'], c: ['arroz_blanco_cocido', 'patata_cocida'], g: ['aove'], v: ['brocoli'] }),
  plantilla({ id: 'SEN-SGL-PRI-A2', rol_comida: 'principal', p: ['atun_natural', 'pechuga_pollo'], c: ['patata_cocida', 'arroz_blanco_cocido'], g: ['aove'], v: ['brocoli'] }),
  plantilla({ id: 'SEN-SGL-LIG-A1', rol_comida: 'ligera', p: ['yogur_griego_0', 'huevo_entero'], c: ['tortitas_arroz'] }),
  plantilla({ id: 'SEN-SGL-LIG-A2', rol_comida: 'ligera', p: ['yogur_griego_0', 'huevo_entero'], g: ['almendras'], f: ['platano'] }),
]

const SGL_B: Plantilla[] = [
  plantilla({ id: 'SEN-SGL-DES-B', rol_comida: 'desayuno', p: ['huevo_entero'], p2: ['yogur_griego_0'], c: ['tortitas_arroz'], g: ['almendras'], f: ['manzana'] }),
  plantilla({ id: 'SEN-SGL-PRI-B1', rol_comida: 'principal', p: ['atun_natural', 'pechuga_pollo'], c: ['patata_cocida', 'arroz_blanco_cocido'], g: ['aove'], v: ['brocoli'] }),
  plantilla({ id: 'SEN-SGL-PRI-B2', rol_comida: 'principal', p: ['pechuga_pollo', 'atun_natural'], c: ['arroz_blanco_cocido', 'patata_cocida'], g: ['aove'], v: ['brocoli'] }),
  plantilla({ id: 'SEN-SGL-LIG-B1', rol_comida: 'ligera', p: ['yogur_griego_0', 'huevo_entero'], c: ['tortitas_arroz'] }),
  plantilla({ id: 'SEN-SGL-LIG-B2', rol_comida: 'ligera', p: ['yogur_griego_0', 'huevo_entero'], g: ['almendras'], f: ['manzana'] }),
]

// ---------- Low-carb ----------
// `patata_cocida` solo aparece por la vía de escape de §3.2 (planes con más hidrato del que el
// arroz de coliflor y el pan proteico pueden cubrir); por eso está en `candidatos` aunque no
// figure en ninguna plantilla.
const LCB_SEN: readonly string[] = [
  'huevo_entero',
  'yogur_griego_0',
  'pechuga_pollo',
  'atun_natural',
  'pan_proteico',
  'arroz_coliflor',
  'patata_cocida',
  'aove',
  'aguacate',
  'almendras',
  'brocoli',
  'fresas',
]

const LCB_A: Plantilla[] = [
  plantilla({ id: 'SEN-LCB-DES-A', rol_comida: 'desayuno', p: ['huevo_entero'], p2: ['yogur_griego_0'], c: ['pan_proteico'], g: ['aguacate'], f: ['fresas'] }),
  plantilla({ id: 'SEN-LCB-PRI-A1', rol_comida: 'principal', p: ['pechuga_pollo', 'atun_natural'], p2: ['huevo_entero'], c: ['arroz_coliflor'], g: ['aove'], v: ['brocoli'] }),
  plantilla({ id: 'SEN-LCB-PRI-A2', rol_comida: 'principal', p: ['atun_natural', 'pechuga_pollo'], p2: ['huevo_entero'], c: ['arroz_coliflor'], g: ['aove'], v: ['brocoli'] }),
  plantilla({ id: 'SEN-LCB-LIG-A1', rol_comida: 'ligera', p: ['yogur_griego_0', 'huevo_entero'], g: ['almendras'] }),
  plantilla({ id: 'SEN-LCB-LIG-A2', rol_comida: 'ligera', p: ['yogur_griego_0', 'huevo_entero'], g: ['aguacate'], f: ['fresas'] }),
]

const LCB_B: Plantilla[] = [
  plantilla({ id: 'SEN-LCB-DES-B', rol_comida: 'desayuno', p: ['yogur_griego_0'], p2: ['huevo_entero'], c: ['pan_proteico'], g: ['almendras'], f: ['fresas'] }),
  plantilla({ id: 'SEN-LCB-PRI-B1', rol_comida: 'principal', p: ['atun_natural', 'pechuga_pollo'], p2: ['huevo_entero'], c: ['arroz_coliflor'], g: ['aove'], v: ['brocoli'] }),
  plantilla({ id: 'SEN-LCB-PRI-B2', rol_comida: 'principal', p: ['pechuga_pollo', 'atun_natural'], p2: ['huevo_entero'], c: ['arroz_coliflor'], g: ['aove'], v: ['brocoli'] }),
  plantilla({ id: 'SEN-LCB-LIG-B1', rol_comida: 'ligera', p: ['yogur_griego_0', 'huevo_entero'], g: ['aguacate'] }),
  plantilla({ id: 'SEN-LCB-LIG-B2', rol_comida: 'ligera', p: ['yogur_griego_0', 'huevo_entero'], g: ['almendras'], f: ['fresas'] }),
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
