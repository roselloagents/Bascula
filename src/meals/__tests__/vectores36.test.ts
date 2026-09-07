// Vectores de `SPEC-ux-comidas-pdf.md` §3.6: los tres menús completos, fijados alimento a
// alimento. La spec dice que son vectores de prueba y que, si cambian, "se regeneran; no se
// corrigen a mano": este test es el que obliga a regenerarlos.
import { describe, expect, it } from 'vitest'
import { alimentoPorId } from '../../data/foods'
import { calcular } from '../../engine'
import { generarEjemplos } from '../index'
import { VECTORES } from './vectores'

interface MenuEsperado {
  comida: string
  alimentos: string[]
  kcal: number
}

/**
 * Generados con el algoritmo de §3.3 sobre `foods.json`, nunca escritos a mano. Última
 * regeneración: al bajar a 250 g el máximo de ración del lácteo proteico —la otra mitad de la
 * QA §7, que hasta ahora solo tenía corregidas las claras— y al dejar que una toma "ligera"
 * demasiado grande caiga en las plantillas principales.
 */
const ESPERADOS: Record<string, { menus: MenuEsperado[]; kcalDia: number; fibra: number }> = {
  '1': {
    menus: [
      {
        comida: 'Desayuno',
        alimentos: ['platano 120', 'queso_fresco_batido_0 250', 'clara_huevo 132', 'pan_integral 30', 'almendras 35'],
        kcal: 566,
      },
      {
        comida: 'Comida',
        alimentos: ['tomate 180', 'pechuga_pavo 220', 'pasta_cocida 150', 'aove 15'],
        kcal: 639,
      },
      {
        comida: 'Merienda',
        alimentos: ['pera 170', 'requeson 230', 'pan_blanco 30'],
        kcal: 402,
      },
      {
        comida: 'Cena',
        alimentos: ['lechuga 90', 'merluza 250', 'clara_huevo 99', 'patata_cocida 280', 'aove 20'],
        kcal: 670,
      },
    ],
    kcalDia: 2277,
    fibra: 26.745,
  },
  '2': {
    menus: [
      {
        comida: 'Desayuno',
        alimentos: ['kiwi 150', 'requeson 250', 'pan_integral 90'],
        kcal: 559,
      },
      {
        comida: 'Comida',
        alimentos: ['calabacin 180', 'queso_cottage 250', 'huevo_entero 55', 'quinoa_cocida 220'],
        kcal: 630,
      },
      {
        comida: 'Cena',
        alimentos: ['berenjena 180', 'garbanzos_cocidos 240', 'huevo_entero 55', 'avena_copos 30'],
        kcal: 650,
      },
    ],
    kcalDia: 1839,
    fibra: 45.4,
  },
  '3': {
    menus: [
      {
        comida: 'Desayuno',
        alimentos: ['naranja 180', 'queso_cottage 250', 'clara_huevo 132', 'pan_integral 30', 'semillas_lino 30'],
        kcal: 633,
      },
      {
        comida: 'Comida',
        alimentos: ['berenjena 180', 'muslo_pollo 250', 'pasta_cocida 130', 'aove 15'],
        kcal: 692,
      },
      {
        comida: 'Cena',
        alimentos: ['champinones 130', 'merluza 250', 'clara_huevo 66', 'arroz_blanco_cocido 160', 'aove 25'],
        kcal: 681,
      },
    ],
    kcalDia: 2006,
    fibra: 24.2,
  },
}

describe('§3.6 — los tres menús completos calculados', () => {
  for (const n of Object.keys(ESPERADOS)) {
    it(`reproduce el ejemplo del caso ${n}`, () => {
      const v = VECTORES.find((x) => x.n === n)!
      const resultado = calcular(v.inputs)
      const ejemplos = generarEjemplos(v.inputs, resultado)
      const esperado = ESPERADOS[n]

      expect(ejemplos.entreno.comidas).toHaveLength(esperado.menus.length)
      ejemplos.entreno.comidas.forEach((comida, i) => {
        const e = esperado.menus[i]
        expect(comida.comida).toBe(e.comida)
        expect(comida.alimentos.map((a) => `${a.id} ${a.gramos}`)).toEqual(e.alimentos)
        expect(comida.totales.kcal).toBe(e.kcal)
        // Regla dura de §3.3: ninguna comida de los vectores se sale del ±10 % de kcal.
        const desviacion = Math.abs(comida.totales.kcal - comida.objetivo.kcal) / comida.objetivo.kcal
        expect(desviacion, `${e.comida}: ${comida.totales.kcal} vs ${comida.objetivo.kcal}`).toBeLessThanOrEqual(0.1)
      })

      expect(ejemplos.entreno.totales.kcal).toBe(esperado.kcalDia)
      const fibra = ejemplos.entreno.comidas.reduce(
        (t, c) => t + c.alimentos.reduce((s, a) => s + (alimentoPorId(a.id)!.fibra * a.gramos) / 100, 0),
        0,
      )
      expect(fibra).toBeCloseTo(esperado.fibra, 2)
    })
  }
})
