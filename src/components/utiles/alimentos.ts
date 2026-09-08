// Alimentos que se pueden marcar como "no me gusta" o como favoritos (SPEC-ux §1 paso 14, v1.2).
//
// Aquí no vive ninguna regla de filtrado propia: la base dietética y las restricciones se
// comprueban con `pasaBase` y `pasaRestricciones` de `src/meals/filtros.ts`, que es el mismo
// filtro que aplica el generador de menús. Lo único que añade este módulo es el reparto en los
// siete grupos legibles de la pantalla y el orden de los chips.

import { ALIMENTOS, alimentoPorId, type Alimento } from '../../data/foods'
import type { PreferenciaBase, Restriccion } from '../../engine/types'
import { pasaBase, pasaRestricciones } from '../../meals/filtros'

/** Los siete grupos de la pantalla, en el orden exacto de §1 paso 14. */
export type ClaveGrupoChips =
  | 'carne_pescado'
  | 'huevos_lacteos'
  | 'legumbres'
  | 'cereales'
  | 'frutas'
  | 'verduras'
  | 'grasas'

export const GRUPOS_CHIPS: { clave: ClaveGrupoChips; nombre: string }[] = [
  { clave: 'carne_pescado', nombre: 'Carne y pescado' },
  { clave: 'huevos_lacteos', nombre: 'Huevos y lácteos' },
  { clave: 'legumbres', nombre: 'Legumbres y soja' },
  { clave: 'cereales', nombre: 'Arroz, pasta, pan y patata' },
  { clave: 'frutas', nombre: 'Frutas' },
  { clave: 'verduras', nombre: 'Verduras' },
  { clave: 'grasas', nombre: 'Grasas y frutos secos' },
]

const HUEVOS = ['huevo_entero', 'clara_huevo']

/**
 * Grupo legible de un alimento. Las tres filas de `grupo === 'proteina'` se evalúan **en el orden
 * de la tabla** de §1 paso 14: primero huevos, después legumbres y soja, y lo que queda es carne y
 * pescado. Así `huevo_entero` cae en "Huevos y lácteos" y `tofu` en "Legumbres y soja".
 */
export function grupoDeChip(a: Alimento): ClaveGrupoChips | null {
  if (a.grupo === 'lacteo' || HUEVOS.includes(a.id)) return 'huevos_lacteos'
  if (a.grupo === 'proteina') {
    return a.tags.includes('vegano') || a.roles.includes('carbohidrato') ? 'legumbres' : 'carne_pescado'
  }
  if (a.grupo === 'carbohidrato') return 'cereales'
  if (a.grupo === 'fruta') return 'frutas'
  if (a.grupo === 'verdura') return 'verduras'
  if (a.grupo === 'grasa') return 'grasas'
  return null
}

export interface PerfilChips {
  base: PreferenciaBase
  restricciones: readonly Restriccion[]
}

/**
 * `true` si el alimento se puede marcar. Pasa la base y **todas** las restricciones ya elegidas
 * en el paso 13 (§3.2): una vegana no ve pollo y quien evita el gluten no ve pan. Los cereales
 * crudos (arroz y pasta sin cocer) no se muestran porque no entran nunca en un menú; los `extra`
 * de la v1.2 **sí**, porque pueden salir en la tarjeta del ciclo y en la compra opcional.
 */
export function sePuedeMarcar(a: Alimento, perfil: PerfilChips): boolean {
  if (a.grupo === 'carbohidrato' && a.estado === 'crudo') return false
  return pasaBase(a, perfil.base) && pasaRestricciones(a, perfil.restricciones)
}

export interface GrupoChips {
  clave: ClaveGrupoChips
  nombre: string
  alimentos: Alimento[]
}

/**
 * Los alimentos marcables, repartidos en los siete grupos y ordenados dentro de cada uno por
 * `nombre_corto` con `localeCompare('es')`. Un grupo sin ningún alimento que pase el filtro no
 * se devuelve (§1 paso 14: no se pinta un encabezado vacío).
 */
export function gruposDeAlimentos(perfil: PerfilChips): GrupoChips[] {
  const porGrupo = new Map<ClaveGrupoChips, Alimento[]>()
  for (const alimento of ALIMENTOS) {
    if (!sePuedeMarcar(alimento, perfil)) continue
    const clave = grupoDeChip(alimento)
    if (clave === null) continue
    const lista = porGrupo.get(clave)
    if (lista) lista.push(alimento)
    else porGrupo.set(clave, [alimento])
  }
  return GRUPOS_CHIPS.filter(({ clave }) => (porGrupo.get(clave)?.length ?? 0) > 0).map(
    ({ clave, nombre }) => ({
      clave,
      nombre,
      alimentos: (porGrupo.get(clave) ?? []).sort((a, b) =>
        a.nombre_corto.localeCompare(b.nombre_corto, 'es'),
      ),
    }),
  )
}

/** Nombre corto de un id (§3.0). Un id que ya no exista en la base se ignora, no se inventa. */
export function nombreCorto(id: string): string | null {
  return alimentoPorId(id)?.nombre_corto ?? null
}

/** "brócoli, coliflor" con los nombres cortos de los ids que existan, en el orden recibido. */
export function listaNombresCortos(ids: readonly string[]): string {
  return ids
    .map(nombreCorto)
    .filter((nombre): nombre is string => nombre !== null)
    .join(', ')
}

/** "3 que no te gustan · 4 favoritos" (§1 paso 14). Cadena vacía si no hay nada marcado. */
export function resumenMarcados(excluidos: readonly string[], favoritos: readonly string[]): string {
  const partes: string[] = []
  if (excluidos.length > 0) {
    partes.push(`${excluidos.length} que no te ${excluidos.length === 1 ? 'gusta' : 'gustan'}`)
  }
  if (favoritos.length > 0) {
    partes.push(`${favoritos.length} ${favoritos.length === 1 ? 'favorito' : 'favoritos'}`)
  }
  return partes.join(' · ')
}
