// El contexto que viaja a `POST /api/dieta/proponer` (SPEC-dieta-propia §4bis.1).
//
// Aquí se decide qué sabe el modelo de la persona, y por eso este fichero es también una frontera
// de privacidad (§7): viaja lo que hace falta para ELEGIR alimentos —lo dictado, los gustos, los
// hábitos, el perfil dietético, tres condiciones y poco más— y **no viaja** sexo, edad, peso,
// objetivo ni las kcal del día. Los números del hueco van aparte, en `huecos`, y son los que el
// algoritmo del navegador cuadra después.

import { normalizarPreferencias } from '../engine/preferences'
import type { AlimentoAjustado, Condicion, DiaCompuesto, Inputs } from '../engine/types'
import { RESPUESTAS_MAX, VARIANTE_MAX, type DietaGuardada } from './almacen'
import {
  TEXTO_MAX,
  type ComidaPropiaTexto,
  type CondicionPropuesta,
  type ContextoPropuesta,
  type PerfilPropuesta,
} from './api'

/** Topes de §4bis.1 para lo que resume las comidas dictadas. */
export const COMIDAS_PROPIAS_MAX = 8
export const LINEAS_POR_COMIDA_MAX = 15
export const LINEA_MAX = 60
/** Topes de §4bis.1 para los gustos, los hábitos y las respuestas. */
export const GUSTOS_MAX = 20
export const HABITOS_MAX = 12
export const RESPUESTA_MAX = 200

/** Las únicas condiciones que viajan, en orden fijo para que el contexto sea determinista. */
const CONDICIONES_QUE_VIAJAN: readonly CondicionPropuesta[] = [
  'diabetes',
  'cardiaca',
  'hipertension',
]

function enRango(valor: number, min: number, max: number): number {
  if (!Number.isFinite(valor)) return min
  return Math.min(max, Math.max(min, Math.round(valor)))
}

function recortar(texto: string, maximo: number): string {
  const limpio = texto.trim()
  return limpio.length <= maximo ? limpio : limpio.slice(0, maximo).trimEnd()
}

function sinRepetir(ids: readonly string[] | null | undefined): string[] {
  const vistos = new Set<string>()
  const salida: string[] = []
  for (const id of ids ?? []) {
    if (typeof id !== 'string' || id === '' || vistos.has(id)) continue
    vistos.add(id)
    salida.push(id)
  }
  return salida
}

/**
 * Una línea "Kéfir natural entero 250 g" por alimento (§4bis.1). Se usan los **gramos finales**
 * (los que el ajuste de §4.2 dejó), que son los que la persona verá en la pantalla; un pendiente
 * —sin cantidad todavía— va solo con su nombre, porque "0 g" sería mentira.
 */
function lineaDeAlimento(alimento: AlimentoAjustado): string {
  const nombre = alimento.nombre.trim()
  const gramos = Math.round(alimento.gramos_ajustados)
  const linea = gramos > 0 ? `${nombre} ${gramos} g` : nombre
  return recortar(linea, LINEA_MAX)
}

/** Las comidas ya dictadas, resumidas para el prompt. Los retirados no llegan aquí (§4.2.1). */
function comidasPropias(compuesto: DiaCompuesto): ComidaPropiaTexto[] {
  const salida: ComidaPropiaTexto[] = []
  for (const comida of compuesto.comidas) {
    if (comida.origen !== 'propia') continue
    const alimentos = comida.alimentos
      .slice(0, LINEAS_POR_COMIDA_MAX)
      .map(lineaDeAlimento)
      .filter((l) => l !== '')
    if (alimentos.length === 0) continue
    salida.push({ nombre: recortar(comida.nombre, LINEA_MAX), alimentos })
    if (salida.length === COMIDAS_PROPIAS_MAX) break
  }
  return salida
}

/**
 * El perfil dietético desde `Inputs`, con la **regla de traducción** de `SPEC-calculo.md` §1.1
 * cuando no viene `preferencia_base` (la misma `normalizarPreferencias` del paso 0 del motor: no
 * se duplica aquí). Las dos listas del paso 14 llegan **con los gustos ya sumados** (§5.5); los
 * ids que no estén en el catálogo los descarta el servidor (§4bis.1).
 */
function perfilDeInputs(inputs: Inputs): PerfilPropuesta {
  const { pref_base, restricciones, low_carb_pedido } = normalizarPreferencias(inputs)
  return {
    base: pref_base,
    restricciones,
    low_carb: low_carb_pedido,
    excluidos: sinRepetir(inputs.alimentos_excluidos),
    favoritos: sinRepetir(inputs.alimentos_favoritos),
  }
}

/** De todas las condiciones del cuestionario, solo estas tres cambian lo que se puede proponer. */
function condicionesQueViajan(condiciones: readonly Condicion[] | undefined): CondicionPropuesta[] {
  const suyas = new Set<Condicion>(condiciones ?? [])
  return CONDICIONES_QUE_VIAJAN.filter((c) => suyas.has(c))
}

/**
 * Monta el objeto `contexto` de §4bis.1 a partir de lo guardado, del cuestionario y del día ya
 * compuesto (el de las plantillas la primera vez, el de la propuesta anterior después).
 *
 * `variante` sale de la propuesta guardada salvo que se pase otra: "Otra propuesta" (§4bis.3) la
 * sube de una en una y el servidor la acepta de 0 a 20.
 */
export function contextoParaProponer(
  dieta: DietaGuardada,
  inputs: Inputs,
  compuesto: DiaCompuesto,
  variante?: number,
): ContextoPropuesta {
  const pedida = variante ?? dieta.propuesta?.variante ?? 0
  const respuestas = (dieta.propuesta?.respuestas ?? []).slice(0, RESPUESTAS_MAX).map((r) => ({
    pregunta: recortar(r.pregunta, RESPUESTA_MAX),
    respuesta: recortar(r.respuesta, RESPUESTA_MAX),
  }))
  return {
    texto: recortar(dieta.texto, TEXTO_MAX),
    comidas_propias: comidasPropias(compuesto),
    gustos: dieta.interpretada.gustos.slice(0, GUSTOS_MAX),
    habitos: dieta.interpretada.habitos.slice(0, HABITOS_MAX),
    perfil: perfilDeInputs(inputs),
    condiciones: condicionesQueViajan(inputs.condiciones),
    menu_sencillo: inputs.menu_sencillo === true,
    respuestas,
    variante: enRango(pedida, 0, VARIANTE_MAX),
  }
}
