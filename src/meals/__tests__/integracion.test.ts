// Integración real: `calcular()` → `generarEjemplos()`, con los nueve vectores de la §5.
// Los tests del módulo trabajaban con un `Resultado` sintético, así que los fallos que solo
// aparecen encadenando motor y menús (low-carb sin hidratos, alternativas que ignoran la
// preferencia, raciones fuera de los límites) no los veía nadie.
import { describe, expect, it } from 'vitest'
import { ALIMENTOS, alimentoPorId } from '../../data/foods'
import { calcular } from '../../engine'
import { generarEjemplos } from '../index'
import { limiteRacion } from '../escalado'
import { pasaPreferencia } from '../filtros'
import { nombreCorto } from '../textos'
import { KCAL_VECTORES, VECTORES } from './vectores'

describe('motor + generador de menús — vectores de la §5', () => {
  for (const v of VECTORES) {
    const resultado = calcular(v.inputs)
    const ejemplos = generarEjemplos(v.inputs, resultado)
    const etiqueta = `caso ${v.n} (${v.descripcion})`

    it(`reproduce las kcal publicadas en la §5 — ${etiqueta}`, () => {
      expect(resultado.excluido).toBeUndefined()
      expect(resultado.kcal).toBe(KCAL_VECTORES[v.n])
    })

    it(`respeta la preferencia efectiva en alimentos Y en alternativas — ${etiqueta}`, () => {
      const pref = resultado.preferencia_efectiva
      for (const comida of ejemplos.entreno.comidas) {
        for (const a of comida.alimentos) {
          const alimento = alimentoPorId(a.id)
          expect(alimento, a.id).toBeDefined()
          expect(pasaPreferencia(alimento!, pref), `${etiqueta} · ${a.id}`).toBe(true)
        }
        // Las alternativas son texto: se comprueba que ningún alimento prohibido por la
        // preferencia aparezca nombrado en ellas. Antes se borran los nombres permitidos, porque
        // varios prohibidos son prefijo de uno permitido ("queso fresco batido 0%" lo es de su
        // variante "… sin lactosa").
        const prohibidos = ALIMENTOS.filter((a) => !pasaPreferencia(a, pref))
        const permitidos = ALIMENTOS.filter((a) => pasaPreferencia(a, pref)).map(nombreCorto)
        for (const alternativa of comida.alternativas) {
          let resto = alternativa
          for (const nombre of [...permitidos].sort((x, y) => y.length - x.length)) {
            resto = resto.split(nombre).join('·')
          }
          for (const a of prohibidos) {
            expect(
              resto.includes(nombreCorto(a)),
              `${etiqueta} · alternativa cita "${nombreCorto(a)}" con preferencia ${pref}: ${alternativa}`,
            ).toBe(false)
          }
        }
      }
    })

    it(`no supera los límites de ración de §3.3 — ${etiqueta}`, () => {
      for (const comida of ejemplos.entreno.comidas) {
        for (const a of comida.alimentos) {
          const alimento = alimentoPorId(a.id)!
          const { min, max } = limiteRacion(alimento)
          expect(a.gramos, `${etiqueta} · ${a.id}: ${a.gramos} g (máx ${max})`).toBeLessThanOrEqual(max)
          expect(a.gramos, `${etiqueta} · ${a.id}: ${a.gramos} g (mín ${min})`).toBeGreaterThanOrEqual(min)
        }
      }
    })

    it(`cierra kcal y proteína, o lleva su nota — ${etiqueta}`, () => {
      for (const comida of ejemplos.entreno.comidas) {
        const dKcal = Math.abs(comida.totales.kcal - comida.objetivo.kcal) / comida.objetivo.kcal
        const dProt = Math.abs(comida.totales.prot - comida.objetivo.prot) / comida.objetivo.prot
        const notas = ejemplos.entreno.notas.filter((n) => n.startsWith(`${comida.comida}:`))
        if (dKcal > 0.1) {
          expect(notas.some((n) => n.includes('kcal de tu objetivo')), `${etiqueta} · ${comida.comida}`).toBe(true)
        }
        if (dProt > 0.15) {
          expect(notas.some((n) => n.includes('proteína')), `${etiqueta} · ${comida.comida}`).toBe(true)
        }
      }
    })

    it(`es determinista y no imprime NaN ni undefined — ${etiqueta}`, () => {
      const otra = generarEjemplos(v.inputs, calcular(v.inputs))
      expect(JSON.stringify(otra)).toBe(JSON.stringify(ejemplos))
      const texto = JSON.stringify(ejemplos)
      expect(texto).not.toContain('NaN')
      expect(texto).not.toContain('undefined')
      expect(texto).not.toContain('null,')
    })
  }

  it('las variantes sin lactosa solo se recomiendan a quien las necesita', () => {
    for (const v of VECTORES) {
      const resultado = calcular(v.inputs)
      if (resultado.preferencia_efectiva === 'sin_lactosa') continue
      const ejemplos = generarEjemplos(v.inputs, resultado)
      for (const comida of ejemplos.entreno.comidas) {
        for (const a of comida.alimentos) {
          expect(a.id.endsWith('_sl'), `caso ${v.n} · ${a.id} con preferencia ${resultado.preferencia_efectiva}`)
            .toBe(false)
        }
      }
    }
  })

  it('el hidrato del día se acerca al plan también en low-carb (caso 7)', () => {
    const v = VECTORES.find((x) => x.n === '7')!
    const resultado = calcular(v.inputs)
    const ejemplos = generarEjemplos(v.inputs, resultado)
    expect(resultado.preferencia_efectiva).toBe('low_carb')
    const desviacion =
      Math.abs(ejemplos.entreno.totales.carb - resultado.macros.hc_g) / resultado.macros.hc_g
    expect(desviacion, `${ejemplos.entreno.totales.carb} g frente a ${resultado.macros.hc_g} g`).toBeLessThanOrEqual(0.2)
  })

  it('con diabetes, una desviación de hidrato lleva su nota (caso 4)', () => {
    const v = VECTORES.find((x) => x.n === '4')!
    const resultado = calcular(v.inputs)
    const ejemplos = generarEjemplos(v.inputs, resultado)
    const desviacion =
      Math.abs(ejemplos.entreno.totales.carb - resultado.macros.hc_g) / resultado.macros.hc_g
    if (desviacion > 0.1) {
      expect(ejemplos.entreno.notas.some((n) => n.includes('hidratos al día'))).toBe(true)
    }
  })

  it('"Ver otro ejemplo" devuelve un menú distinto y igual de válido', () => {
    const v = VECTORES.find((x) => x.n === '1')!
    const resultado = calcular(v.inputs)
    const primero = generarEjemplos(v.inputs, resultado)
    const segundo = generarEjemplos(v.inputs, resultado, 1)
    const ids = (e: typeof primero): string =>
      e.entreno.comidas.map((c) => c.alimentos.map((a) => a.id).join(',')).join('|')
    expect(ids(segundo)).not.toBe(ids(primero))
    expect(segundo.entreno.comidas.length).toBe(primero.entreno.comidas.length)
  })
})
