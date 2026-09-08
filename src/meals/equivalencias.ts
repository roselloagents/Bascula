// Tablas de equivalencias (docs/SPEC-ux-comidas-pdf.md §2.5 y §4.4).
// Dato derivado de `foods.json` y de la preferencia efectiva: no depende de ningún número del
// usuario. Cambiar un alimento por otro de la misma tabla deja los macros casi iguales, y eso
// solo es cierto con las dos guardas normativas: filtro de preferencia y límites de ración.
import type { Alimento } from '../data/foods'
import { ALIMENTOS } from '../data/foods'
import type { Preferencia, TablaEquivalencia, TablasEquivalencia } from '../engine/types'
import { limiteRacion, textoMedida } from './escalado'
import type { PerfilDietetico } from './filtros'
import { esVarianteSinLactosa, pasaPerfilMenu, perfilDePreferencia } from './filtros'

/** Múltiplo de 5 g: la rejilla de báscula doméstica de §3.3. */
const round5 = (x: number): number => 5 * Math.round(x / 5)

/** Cantidad de referencia de cada tabla: 20 g de proteína, 30 g de hidrato, 10 g de grasa. */
const REFERENCIA = { proteina: 20, carbohidrato: 30, grasa: 10 } as const

function fila(
  a: Alimento,
  macro: 'proteina' | 'carbohidratos' | 'grasa',
  objetivo: number,
): TablaEquivalencia['filas'][number] | null {
  const por100 = a[macro]
  if (por100 <= 0) return null
  const gramos = round5((objetivo * 100) / por100)
  const { min, max } = limiteRacion(a)
  // Guarda de ración obligatoria en las tres tablas (§2.5): una equivalencia fuera de los
  // límites de `clampRacion` no es una ración real y no puede publicarse.
  if (gramos < min || gramos > max) return null
  return { id: a.id, nombre: a.nombre, gramos, medida: textoMedida(a, gramos) }
}

function tabla(
  titulo: string,
  descripcion: string,
  candidatos: readonly Alimento[],
  macro: 'proteina' | 'carbohidratos' | 'grasa',
  objetivo: number,
): TablaEquivalencia {
  const filas = candidatos
    .map((a) => fila(a, macro, objetivo))
    .filter((f): f is TablaEquivalencia['filas'][number] => f !== null)
    .sort((x, y) => x.nombre.localeCompare(y.nombre, 'es'))
  return { titulo, descripcion, filas }
}

/** Cabecera fija del bloque (§2.5). */
export const CABECERA_EQUIVALENCIAS =
  'Cambiar un alimento por otro de la misma tabla te deja los macros casi iguales; no hace falta que recalcules nada.'

/** Nota fija: verdura y fruta no llevan tabla (§2.5). */
export const NOTA_VERDURA_FRUTA_EQUIVALENCIAS =
  'Las verduras y las frutas son intercambiables entre sí sin recalcular nada.'

/**
 * Tres tablas (isoproteica, isoglucídica e isolipídica) con los alimentos de cada rol que
 * superan el filtro de §3.2 —base Y todas las restricciones— y cuya ración equivalente cabe en su
 * fila de `clampRacion`. Acepta un perfil combinable (v1.1) o una preferencia única (v1.0), que se
 * traduce con la regla de `SPEC-calculo.md` §1.1.
 */
export function equivalencias(preferencia: Preferencia | PerfilDietetico): TablasEquivalencia {
  const perfil = typeof preferencia === 'string' ? perfilDePreferencia(preferencia) : preferencia
  const sinLactosa = perfil.restricciones.includes('sin_lactosa')
  const base = ALIMENTOS.filter(
    // Los cereales, pastas y arroces en crudo están fuera del banco (§3.0): tampoco son
    // sustituciones servibles tal cual. Las variantes `_sl` solo se ofrecen a quien las necesita.
    // Y, desde la v1.2, `pasaPerfilMenu` deja fuera los alimentos con tag `extra` (§3.0: existen
    // solo para la tarjeta del ciclo) y los que el usuario ha marcado como "no me gusta" (§3.2b:
    // un excluido no puede aparecer en NINGÚN sitio, tampoco en una tabla de equivalencias).
    (a) =>
      pasaPerfilMenu(a, perfil) &&
      !(a.grupo === 'carbohidrato' && a.estado === 'crudo') &&
      (sinLactosa || !esVarianteSinLactosa(a)),
  )
  return {
    cabecera: CABECERA_EQUIVALENCIAS,
    nota_verdura_fruta: NOTA_VERDURA_FRUTA_EQUIVALENCIAS,
    tablas: [
      tabla(
        'Proteína · 20 g de proteína por ración',
        'Cantidades que aportan unos 20 g de proteína.',
        base.filter((a) => a.roles.includes('proteina')),
        'proteina',
        REFERENCIA.proteina,
      ),
      tabla(
        'Hidratos · 30 g de hidratos por ración',
        'Cantidades que aportan unos 30 g de hidratos de carbono.',
        base.filter((a) => a.roles.includes('carbohidrato')),
        'carbohidratos',
        REFERENCIA.carbohidrato,
      ),
      tabla(
        'Grasas · 10 g de grasa por ración',
        'Cantidades que aportan unos 10 g de grasa.',
        // Solo `grupo = 'grasa'` y sin rol de proteína (§2.5): si no, entraban 75 g de salmón
        // o 125 g de jamón serrano como intercambiables con 10 g de aceite.
        base.filter((a) => a.grupo === 'grasa' && !a.roles.includes('proteina')),
        'grasa',
        REFERENCIA.grasa,
      ),
    ],
  }
}
