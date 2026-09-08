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
  'carne_pescado' | 'huevos_lacteos' | 'legumbres' | 'cereales' | 'frutas' | 'verduras' | 'grasas'

export const GRUPOS_CHIPS: { clave: ClaveGrupoChips; nombre: string }[] = [
  { clave: 'carne_pescado', nombre: 'Carne y pescado' },
  // Las bebidas vegetales viven en el grupo `lacteo` de `foods.json` por su papel en el menú,
  // pero quien no toma lácteos las busca justo aquí: el rótulo las nombra (§1 paso 14).
  { clave: 'huevos_lacteos', nombre: 'Huevos, lácteos y bebidas vegetales' },
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
 * pescado. Así `huevo_entero` cae en el grupo de los lácteos y `tofu` en "Legumbres y soja".
 */
export function grupoDeChip(a: Alimento): ClaveGrupoChips | null {
  if (a.grupo === 'lacteo' || HUEVOS.includes(a.id)) return 'huevos_lacteos'
  if (a.grupo === 'proteina') {
    return a.tags.includes('vegano') || a.roles.includes('carbohidrato')
      ? 'legumbres'
      : 'carne_pescado'
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

/**
 * Nombres cortos de una lista de ids, ordenados alfabéticamente en español (§2.5). El orden
 * interno de los excluidos es por `id` —estable para el borrador—, pero una persona que lee
 * "Brócoli, Lomo de cerdo, Coliflor" ve una lista desordenada, no un orden interno.
 */
export function nombresCortosOrdenados(ids: readonly string[]): string[] {
  return ids
    .map(nombreCorto)
    .filter((nombre): nombre is string => nombre !== null)
    .sort((a, b) => a.localeCompare(b, 'es'))
}

/** "3 que no te gustan · 4 favoritos" (§1 paso 14). Cadena vacía si no hay nada marcado. */
export function resumenMarcados(
  excluidos: readonly string[],
  favoritos: readonly string[],
): string {
  const partes: string[] = []
  if (excluidos.length > 0) {
    partes.push(`${excluidos.length} que no te ${excluidos.length === 1 ? 'gusta' : 'gustan'}`)
  }
  if (favoritos.length > 0) {
    partes.push(`${favoritos.length} ${favoritos.length === 1 ? 'favorito' : 'favoritos'}`)
  }
  return partes.join(' · ')
}

/* ---- Buscador y plegado de la pantalla (§1 paso 14, v1.2.1) ------------ */

/**
 * Texto listo para comparar: en minúsculas y sin acentos. Se descompone en NFD y se tiran los
 * diacríticos, así que "Brócoli", "brocoli" y "BROCOLI" son la misma cadena.
 */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * `true` si el alimento responde a lo escrito en el buscador. Se mira en `nombre_corto` **y** en
 * `nombre`, palabra a palabra y por subcadena: "lino" encuentra "Semillas de lino" (que no es su
 * nombre corto) y "yogur 0" encuentra "Yogur griego 0%" (dos trozos sueltos del mismo nombre).
 * Con el buscador vacío pasan todos.
 */
export function coincide(alimento: Alimento, consulta: string): boolean {
  const trozos = normalizarTexto(consulta)
    .split(/\s+/)
    .filter((trozo) => trozo !== '')
  if (trozos.length === 0) return true
  // Los trozos no llevan espacios, así que ninguno puede colarse a caballo de los dos nombres.
  const donde = `${normalizarTexto(alimento.nombre_corto)} ${normalizarTexto(alimento.nombre)}`
  return trozos.every((trozo) => donde.includes(trozo))
}

/**
 * Los grupos que tienen alguna coincidencia, con solo los alimentos que coinciden. Con el
 * buscador vacío se devuelven los siete tal cual: buscar no reordena ni reagrupa nada.
 */
export function filtrarGrupos(grupos: readonly GrupoChips[], consulta: string): GrupoChips[] {
  if (normalizarTexto(consulta) === '') return [...grupos]
  return grupos
    .map((grupo) => ({
      ...grupo,
      alimentos: grupo.alimentos.filter((alimento) => coincide(alimento, consulta)),
    }))
    .filter((grupo) => grupo.alimentos.length > 0)
}

/** Cuántos alimentos hay en total en una lista de grupos. */
export function cuentaAlimentos(grupos: readonly GrupoChips[]): number {
  return grupos.reduce((suma, grupo) => suma + grupo.alimentos.length, 0)
}

/**
 * [SPEC] SPEC-ux §1 paso 14, línea de resultados del buscador (copy literal).
 *
 * Vive dentro de la barra fija, que no puede pasar de 130 px: tiene que caber en **una línea**
 * (v1.2.1, revisión). Por eso el caso sin resultados se dice aquí en corto y la frase larga que
 * explica qué hacer es `SIN_RESULTADOS`, que se pinta donde estarían los grupos.
 */
export function lineaBusqueda(cuantos: number, consulta: string): string {
  const texto = consulta.trim()
  if (cuantos === 0) return `Ningún alimento para «${texto}»`
  return `${cuantos} ${cuantos === 1 ? 'alimento' : 'alimentos'} para «${texto}»`
}

/** [SPEC] SPEC-ux §1 paso 14: el vacío del buscador, donde estarían los grupos (copy literal). */
export const SIN_RESULTADOS =
  'Ningún alimento se llama así. Prueba con otro nombre o mira los grupos.'

/** Los ids marcados que caen dentro de un grupo, separados por lista (cabecera plegable). */
export function marcadosDelGrupo(
  grupo: GrupoChips,
  excluidos: readonly string[],
  favoritos: readonly string[],
): { excluidos: string[]; favoritos: string[] } {
  const dentro = (ids: readonly string[]) =>
    grupo.alimentos.map((alimento) => alimento.id).filter((id) => ids.includes(id))
  return { excluidos: dentro(excluidos), favoritos: dentro(favoritos) }
}

/**
 * "✕ 2 · ★ 1": las marcas de un grupo, en corto, para la cabecera plegable. Cadena vacía si no
 * hay ninguna. Es la versión visual; la hablada la da `resumenMarcados` con las mismas listas.
 */
export function marcasDeGrupo(marcados: { excluidos: string[]; favoritos: string[] }): string {
  const partes: string[] = []
  if (marcados.excluidos.length > 0) partes.push(`✕ ${marcados.excluidos.length}`)
  if (marcados.favoritos.length > 0) partes.push(`★ ${marcados.favoritos.length}`)
  return partes.join(' · ')
}
