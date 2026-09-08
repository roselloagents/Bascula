// Ajuste manual de macros (SPEC-ux §2.2b, SPEC-calculo Paso 18).
//
// La interfaz no calcula ningún macro: se los pide a `ajustarMacros` del motor, que es pura,
// determinista e idempotente respecto al origen. Por eso en `localStorage` se guarda **solo el
// ajuste** (`{ kcal?, hc_g? }`), nunca el `Resultado` ajustado.

import { ajustarMacros } from '../../engine'
import type { AjusteMacros, InputCalculo, LimitesAjuste, Resultado } from '../../engine/types'

export const CLAVE_AJUSTE = 'bascula:ajuste:v1'

/**
 * `true` si se puede pintar el panel. Sin `limites_ajuste` no hay ajuste posible: el motor lo
 * deja `undefined` con `'tca' ∈ condiciones` (SPEC Paso 18), y entonces el plan se muestra tal cual.
 */
export function hayPanelAjuste(resultado: Resultado): resultado is Resultado & {
  limites_ajuste: LimitesAjuste
} {
  return resultado.limites_ajuste !== undefined
}

/** Aplica un ajuste al plan recomendado. Sin ajuste devuelve el plan tal cual. */
export function aplicarAjuste(resultado: Resultado, ajuste: AjusteMacros | null): Resultado {
  if (!hayAjuste(ajuste) || resultado.limites_ajuste === undefined) return resultado
  try {
    return ajustarMacros(resultado, ajuste as AjusteMacros)
  } catch (error) {
    // El paso 18 lanza si el cierre de kcal no cuadra. Con el techo de hidratos del punto 2 ya no
    // debería pasar nunca; si pasara, mejor el plan recomendado que uno roto, pero NO en silencio:
    // el fallo se deja en la consola (esta función se llama también durante el render del panel,
    // así que no puede tocar `localStorage` aquí).
    console.error('paso 18: el ajuste no cuadra, se vuelve al plan recomendado', error)
    return resultado
  }
}

/** `true` si el ajuste mueve de verdad alguna de las dos palancas. */
export function hayAjuste(ajuste: AjusteMacros | null): boolean {
  return Boolean(ajuste && (ajuste.kcal !== undefined || ajuste.hc_g !== undefined))
}

// ---- Persistencia --------------------------------------------------------

export function cargarAjuste(): AjusteMacros | null {
  try {
    const crudo = window.localStorage.getItem(CLAVE_AJUSTE)
    if (!crudo) return null
    const datos = JSON.parse(crudo) as Partial<AjusteMacros>
    const ajuste: AjusteMacros = {}
    if (typeof datos.kcal === 'number' && Number.isFinite(datos.kcal)) ajuste.kcal = datos.kcal
    if (typeof datos.hc_g === 'number' && Number.isFinite(datos.hc_g)) ajuste.hc_g = datos.hc_g
    return hayAjuste(ajuste) ? ajuste : null
  } catch {
    return null
  }
}

export function guardarAjuste(ajuste: AjusteMacros | null): void {
  try {
    if (!hayAjuste(ajuste)) {
      window.localStorage.removeItem(CLAVE_AJUSTE)
      return
    }
    window.localStorage.setItem(CLAVE_AJUSTE, JSON.stringify(ajuste))
  } catch {
    // Modo privado: el ajuste sigue vivo en memoria durante la sesión.
  }
}

export function borrarAjuste(): void {
  guardarAjuste(null)
}

/**
 * Campos que el motor **no lee** y que por tanto no pueden cambiar el plan (SPEC-calculo §0.3):
 * el menú sencillo y las dos listas de alimentos de la v1.2. Si entraran en la huella, marcar
 * "no me gusta" en un alimento tiraría el ajuste manual guardado y el "Volver a mi plan" del
 * arranque (SPEC-ux §1 paso 14), y lo único que ha cambiado es qué se come.
 */
const CAMPOS_SIN_EFECTO = ['menu_sencillo', 'alimentos_excluidos', 'alimentos_favoritos']

/**
 * Huella de los datos con los que se calculó un plan. Si el usuario edita sus datos y recalcula,
 * la huella cambia y el ajuste guardado se descarta: los límites del plan nuevo no tienen por qué
 * parecerse a los del anterior (SPEC-ux §2.2b). Los campos que el motor ignora quedan fuera.
 */
export function firmaDeInputs(inputs: InputCalculo): string {
  const relevantes: Record<string, unknown> = {}
  for (const [clave, valor] of Object.entries(inputs)) {
    if (!CAMPOS_SIN_EFECTO.includes(clave)) relevantes[clave] = valor
  }
  return JSON.stringify(relevantes)
}
