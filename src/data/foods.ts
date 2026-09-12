// Base de alimentos del generador de menús (docs/SPEC-ux-comidas-pdf.md §3.0).
// `foods.json` es copia literal de `docs/foods.json`: 107 alimentos con macros por 100 g
// (101 del plan + los 6 con tag `extra`: 4 de la tarjeta del ciclo de la v1.2 y 2 de las comidas
// dictadas de la v1.3).
// Este módulo solo aporta el tipado y los índices; no transforma ningún número.
import datos from './foods.json'

export type GrupoAlimento = 'proteina' | 'lacteo' | 'carbohidrato' | 'grasa' | 'verdura' | 'fruta'
export type RolAlimento =
  'proteina' | 'carbohidrato' | 'grasa' | 'verdura' | 'fruta' | 'complemento'
export type EstadoAlimento = 'crudo' | 'cocido' | 'seco' | 'listo'
export type TagAlimento =
  | 'vegetariano'
  | 'vegano'
  | 'sin_lactosa'
  | 'con_lactosa'
  | 'sin_gluten'
  | 'low_carb'
  /** v1.2: alimento que existe solo para la tarjeta del ciclo (SPEC-ux §3.8). **Nunca** entra en una
   *  `FoodQuery` del menú: ni en la rotación, ni en la reserva, ni en las alternativas, ni en las
   *  tablas de equivalencias. Así se pueden añadir alimentos sin cambiar ni un menú existente. */
  | 'extra'

/** Una entrada de `foods.json`. Todos los macros son g por 100 g; `kcal`, kcal por 100 g. */
export interface Alimento {
  id: string
  nombre: string
  /** Nombre corto para los chips del paso 14 del wizard y para el resumen de §2.5 (máx. 18 caracteres).
   *  El nombre largo se sigue usando en el menú, en las equivalencias y en la lista de la compra. */
  nombre_corto: string
  grupo: GrupoAlimento
  roles: RolAlimento[]
  estado: EstadoAlimento
  /** Energía por 100 g y ÚNICA fuente de verdad energética: nunca se recalcula como 4P+4HC+9G. */
  kcal: number
  proteina: number
  grasa: number
  /** Hidrato TOTAL, con la fibra incluida (convención BEDCA/USDA). */
  carbohidratos: number
  fibra: number
  /** `carbohidratos − fibra`. Solo presentación low-carb; el generador escala con `carbohidratos`. */
  hc_netos: number
  racionTipica_g: number
  medidaCasera: string
  /** Solo en alimentos contables: peso de UNA unidad. */
  unidad_g?: number
  /** Solo en alimentos contables: nombre de UNA unidad ("huevo M", "rebanada"). */
  unidad_nombre?: string
  tags: TagAlimento[]
  fuente: string
}

export const GRUPOS_VALIDOS: readonly GrupoAlimento[] = [
  'proteina',
  'lacteo',
  'carbohidrato',
  'grasa',
  'verdura',
  'fruta',
]
export const ROLES_VALIDOS: readonly RolAlimento[] = [
  'proteina',
  'carbohidrato',
  'grasa',
  'verdura',
  'fruta',
  'complemento',
]
export const ESTADOS_VALIDOS: readonly EstadoAlimento[] = ['crudo', 'cocido', 'seco', 'listo']
export const TAGS_VALIDOS: readonly TagAlimento[] = [
  'vegetariano',
  'vegano',
  'sin_lactosa',
  'con_lactosa',
  'sin_gluten',
  'low_carb',
  'extra',
]

// El JSON se infiere con `string` donde el contrato declara uniones cerradas; la validación de
// src/meals/__tests__/foods.test.ts comprueba que todos los valores pertenecen al enum.
export const ALIMENTOS: readonly Alimento[] = datos as unknown as readonly Alimento[]

const INDICE: ReadonlyMap<string, Alimento> = new Map(ALIMENTOS.map((a) => [a.id, a]))

/** Alimento por id, o `undefined` si no está en la base. */
export function alimentoPorId(id: string): Alimento | undefined {
  return INDICE.get(id)
}

/** `true` si el alimento es contable por unidades (huevo, lata, rebanada, pieza de fruta). */
export function esContable(
  a: Alimento,
): a is Alimento & { unidad_g: number; unidad_nombre: string } {
  return typeof a.unidad_g === 'number' && a.unidad_g > 0 && typeof a.unidad_nombre === 'string'
}
