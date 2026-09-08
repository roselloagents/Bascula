// Paso 19 — consejos por síntomas de la regla (SPEC-calculo.md §2, paso 19; decisión I de la v1.2).
//
// Es copy, sí, pero copy con dos dependencias que solo el motor conoce: la base dietética efectiva
// —recomendarle carne roja a una vegana en su propio plan es justo lo que rompe la confianza— y el
// `low_carb` efectivo. Ponerlo en la interfaz obligaba a duplicar las dos reglas en la pantalla y
// en el PDF, que es como se producen las divergencias que este proyecto ya ha pagado dos veces.
//
// NO cambia ni un número del plan: no toca kcal, macros, agua, peso objetivo, cronograma ni
// proyección, y no emite ningún aviso. `INFO_CICLO` sigue siendo la cabecera de la tarjeta y estos
// consejos van debajo, no en su lugar.

import type {
  ConsejoCiclo,
  PreferenciaBase,
  Restriccion,
  ResultadoCiclo,
  SintomaRegla,
} from './types'

/**
 * Orden canónico de `SintomaRegla` (§1 fila 25). Es el orden de `ciclo.sintomas` y el de
 * `ciclo.consejos`, nunca el orden en que la interfaz haya mandado el array.
 */
export const SINTOMAS_ORDEN: readonly SintomaRegla[] = [
  'dolor',
  'hinchazon',
  'antojos',
  'cansancio',
  'sangrado_abundante',
]

interface PlantillaConsejo {
  titulo: string
  /** Texto base; `{lc}` y `{fe}` son los dos únicos fragmentos condicionales del paso 19. */
  texto: string
  /** Fragmento de low-carb (solo `cansancio`). */
  lc?: string
  /** Fragmento de la ferritina (solo `sangrado_abundante`). */
  fe?: string
  alimentos: Record<PreferenciaBase, readonly string[]>
}

/** Copy literal de la §4 / paso 19. Los `alimentos` van por base dietética. */
const CONSEJOS: Record<SintomaRegla, PlantillaConsejo> = {
  dolor: {
    titulo: 'Dolor: omega-3, magnesio y calor',
    texto:
      'El dolor de regla lo producen las prostaglandinas, y el omega-3 compite con ellas: en los ensayos, 1-2 g al día durante dos o tres ciclos reducen el dolor y la necesidad de analgésicos. Es lento, no notarás nada el primer mes. El magnesio tiene evidencia más floja, pero por comida es barato y seguro. A corto plazo lo que mejor funciona sigue siendo el calor local y el movimiento suave. Si el dolor te impide hacer vida normal, eso no es normal: consúltalo.',
    alimentos: {
      omnivoro: ['Pescado azul (salmón, sardinas en lata)', 'Nueces', 'Semillas de lino molidas', 'Cacao puro'],
      vegetariano: ['Nueces', 'Semillas de lino molidas', 'Semillas de chía', 'Cacao puro'],
      vegano: ['Nueces', 'Semillas de lino molidas', 'Semillas de chía', 'Cacao puro'],
    },
  },
  hinchazon: {
    titulo: 'Hinchazón: es agua, no grasa',
    texto:
      'Ese kilo o dos de más de la semana antes es agua, y se va solo. No recortes calorías por eso: si bajas el plan cada vez que la báscula sube, acabas comiendo bastante menos de lo que necesitas. Lo que sí ayuda es quitar sal de la que viene ya puesta (embutido, conservas, precocinados, pan de molde), beber lo mismo o más —nunca menos— y llegar bien al potasio. Y pésate siempre el mismo día de la semana y en la misma fase del ciclo, o estarás comparando dos cosas distintas.',
    alimentos: {
      omnivoro: ['Plátano', 'Patata cocida', 'Espinacas', 'Calabacín'],
      vegetariano: ['Plátano', 'Patata cocida', 'Espinacas', 'Calabacín'],
      vegano: ['Plátano', 'Patata cocida', 'Espinacas', 'Calabacín'],
    },
  },
  antojos: {
    titulo: 'Más hambre: cuenta con ella',
    texto:
      'En la segunda mitad del ciclo el hambre sube de verdad: se han medido entre 100 y 300 kcal más al día. No es falta de fuerza de voluntad. Tienes dos formas de manejarlo y las dos valen: comer 100-200 kcal más esos días y compensarlas en el resto de la semana, o dejar el plan como está y apoyarte en proteína y fibra, que son lo que más sacia. Si te pide dulce, el cacao puro o una o dos onzas de chocolate del 85 % cunden mucho más que una tableta con leche.',
    alimentos: {
      omnivoro: ['Yogur griego 0%', 'Fruta (manzana, plátano)', 'Cacao puro', 'Chocolate negro 85%'],
      vegetariano: ['Yogur griego 0%', 'Fruta (manzana, plátano)', 'Cacao puro', 'Chocolate negro 85%'],
      vegano: ['Yogur de soja alto en proteína', 'Fruta (manzana, plátano)', 'Cacao puro', 'Almendras'],
    },
  },
  cansancio: {
    titulo: 'Cansancio: duerme y no bajes los hidratos',
    texto:
      'El cansancio de esos días suele ser una mezcla de dormir peor, hierro justo y menos energía disponible. Lo primero es dormir: es la palanca más grande y la más aburrida. Lo segundo, no recortar hidratos justo esa semana: son el combustible del entrenamiento y del ánimo.{lc} Si el cansancio dura bastante más que la regla, mira el hierro con tu médico.',
    // Sin la guarda, a quien no lleva low-carb se le pide subir unos hidratos que ya son normales.
    lc: ' Como llevas un plan bajo en hidratos, súbelos un poco esos días —una ración más de fruta o de tubérculo— y vuelve a tu plan después.',
    alimentos: {
      omnivoro: ['Avena', 'Patata cocida', 'Lentejas o garbanzos', 'Fruta'],
      vegetariano: ['Avena', 'Patata cocida', 'Lentejas o garbanzos', 'Fruta'],
      vegano: ['Avena', 'Patata cocida', 'Lentejas o garbanzos', 'Fruta'],
    },
  },
  sangrado_abundante: {
    titulo: 'Sangrado abundante: cuida el hierro',
    texto:
      'Un sangrado abundante mes a mes es la causa más frecuente de falta de hierro en mujeres. No cambiamos tus macros por esto: lo que cambia es qué eliges dentro de ellos. Acompaña el hierro con algo de vitamina C (naranja, kiwi, pimiento o tomate) y deja el café y el té para dos horas antes o después de esa comida, porque reducen bastante lo que absorbes.{fe}',
    // Solo con `cansancio` marcado: es la única combinación en la que la analítica es una
    // recomendación y no una alarma gratuita.
    fe: ' Si además te notas cansada, pide a tu médico una analítica con ferritina: es el dato que dice si tienes las reservas bajas, y un hemograma normal puede no verlo.',
    alimentos: {
      omnivoro: ['Lentejas o garbanzos', 'Carne roja magra (ternera)', 'Mejillones o berberechos al natural', 'Espinacas'],
      vegetariano: ['Lentejas o garbanzos', 'Espinacas', 'Tofu', 'Almendras'],
      vegano: ['Lentejas o garbanzos', 'Espinacas', 'Tofu', 'Almendras'],
    },
  },
}

/**
 * Las dos únicas sustituciones por restricción (§4, paso 19): la avena se retira sin gluten y el
 * yogur griego pasa a su versión sin lactosa. Si la lista se quedara vacía el consejo se publica
 * igual: su texto vale por sí solo.
 */
function alimentosDe(
  clave: SintomaRegla,
  pref_base: PreferenciaBase,
  restricciones: readonly Restriccion[],
): string[] {
  return CONSEJOS[clave].alimentos[pref_base]
    .filter((n) => !(n === 'Avena' && restricciones.includes('sin_gluten')))
    .map((n) => (n === 'Yogur griego 0%' && restricciones.includes('sin_lactosa') ? 'Yogur griego 0% sin lactosa' : n))
}

export interface EntradaCiclo {
  /** `true` si `INFO_CICLO` está entre los avisos FINALES del paso 17. */
  hay_info_ciclo: boolean
  sintomas_regla: readonly SintomaRegla[] | null | undefined
  pref_base: PreferenciaBase
  restricciones: readonly Restriccion[]
  /** `low_carb` EFECTIVO (el paso 6.8 lo anula con diabetes), no el pedido. */
  low_carb: boolean
}

/**
 * Paso 19. Devuelve `Resultado.ciclo`, o `undefined` cuando no hay `INFO_CICLO` o cuando no queda
 * ningún síntoma válido. `consejos[i].clave === sintomas[i]` siempre, y los textos llegan ya
 * cerrados: no queda ninguna llave por resolver en la presentación.
 */
export function calcularCiclo(e: EntradaCiclo): ResultadoCiclo | undefined {
  if (!e.hay_info_ciclo) return undefined
  const marcados = Array.isArray(e.sintomas_regla) ? e.sintomas_regla : []
  const sintomas = SINTOMAS_ORDEN.filter((s) => marcados.includes(s))
  if (sintomas.length === 0) return undefined
  const consejos: ConsejoCiclo[] = sintomas.map((clave) => {
    const c = CONSEJOS[clave]
    let texto = c.texto
    if (clave === 'cansancio') texto = texto.replace('{lc}', e.low_carb ? (c.lc ?? '') : '')
    if (clave === 'sangrado_abundante') {
      texto = texto.replace('{fe}', sintomas.includes('cansancio') ? (c.fe ?? '') : '')
    }
    return { clave, titulo: c.titulo, texto, alimentos: alimentosDe(clave, e.pref_base, e.restricciones) }
  })
  return { sintomas: [...sintomas], consejos }
}
