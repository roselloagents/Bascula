// Integración real: `calcular()` → `generarEjemplos()` → lista de la compra, con los catorce
// vectores de la §5 (los cinco últimos los pidió la revisión adversaria del motor y solo llegaban
// al motor: el fallo de envases de la lista de la compra únicamente aparecía en el vector 11).
// Los tests del módulo trabajaban con un `Resultado` sintético, así que los fallos que solo
// aparecen encadenando motor y menús (low-carb sin hidratos, alternativas que ignoran la
// preferencia, raciones fuera de los límites) no los veía nadie.
import { describe, expect, it } from 'vitest'
import { ALIMENTOS, alimentoPorId } from '../../data/foods'
import { calcular } from '../../engine'
import { DIAS_A, DIAS_B } from '../compra'
import { generarEjemplos, generarListaCompra } from '../index'
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
        // Una toma que no cabe en un plato se sirve en varios y `alimentos` viene agrupado: los
        // límites de ración de §3.3 son por plato, así que el techo se multiplica por `platos`.
        const platos = comida.platos ?? 1
        for (const a of comida.alimentos) {
          const alimento = alimentoPorId(a.id)!
          const { min, max } = limiteRacion(alimento)
          const techo = max * platos
          expect(
            a.gramos,
            `${etiqueta} · ${a.id}: ${a.gramos} g (máx ${techo})`,
          ).toBeLessThanOrEqual(techo)
          expect(
            a.gramos,
            `${etiqueta} · ${a.id}: ${a.gramos} g (mín ${min})`,
          ).toBeGreaterThanOrEqual(min)
        }
      }
    })

    it(`cierra kcal y proteína, o lleva su nota — ${etiqueta}`, () => {
      for (const comida of ejemplos.entreno.comidas) {
        const dKcal = Math.abs(comida.totales.kcal - comida.objetivo.kcal) / comida.objetivo.kcal
        const dProt = Math.abs(comida.totales.prot - comida.objetivo.prot) / comida.objetivo.prot
        const notas = ejemplos.entreno.notas.filter((n) => n.startsWith(`${comida.comida}:`))
        if (dKcal > 0.1) {
          expect(
            notas.some((n) => n.includes('kcal de tu objetivo')),
            `${etiqueta} · ${comida.comida}`,
          ).toBe(true)
        }
        if (dProt > 0.15) {
          expect(
            notas.some((n) => n.includes('proteína')),
            `${etiqueta} · ${comida.comida}`,
          ).toBe(true)
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
          expect(
            a.id.endsWith('_sl'),
            `caso ${v.n} · ${a.id} con preferencia ${resultado.preferencia_efectiva}`,
          ).toBe(false)
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
    expect(
      desviacion,
      `${ejemplos.entreno.totales.carb} g frente a ${resultado.macros.hc_g} g`,
    ).toBeLessThanOrEqual(0.2)
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

describe('motor + lista de la compra — los catorce vectores en los dos modos', () => {
  it('compra la semana real: 7 días del menú, o 4 días A + 3 días B en modo sencillo', () => {
    for (const v of VECTORES) {
      for (const sencillo of [false, true]) {
        const inputs = { ...v.inputs, menu_sencillo: sencillo }
        const resultado = calcular(inputs)
        const ejemplos = generarEjemplos(inputs, resultado)
        const etiqueta = `caso ${v.n} sencillo=${sencillo}`

        // §3.1: con condición renal o hepática no hay menú y tampoco hay lista.
        if (ejemplos.entreno.comidas.length === 0) {
          expect(ejemplos.compra, etiqueta).toBeUndefined()
          continue
        }
        expect(ejemplos.compra, etiqueta).toBeDefined()

        const diaA = new Map<string, number>()
        for (const c of ejemplos.entreno.comidas) {
          for (const a of c.alimentos) diaA.set(a.id, (diaA.get(a.id) ?? 0) + a.gramos)
        }

        for (const item of ejemplos.compra!.items) {
          const gA = diaA.get(item.alimento_id) ?? 0
          const contexto = `${etiqueta} · ${item.alimento_id}`
          if (!sencillo) {
            expect(item.gramos_semana, contexto).toBe(Math.round(gA * 7))
          } else {
            // La semana nunca compra menos de los cuatro días del día A (era el fallo de la
            // media aritmética: 3,5 días de cada variante).
            expect(item.gramos_semana, contexto).toBeGreaterThanOrEqual(DIAS_A * gA)
            // Y lo que sobra por encima de esos cuatro días son exactamente tres días del día B.
            const restoB = item.gramos_semana - DIAS_A * gA
            expect(restoB % DIAS_B, contexto).toBe(0)
            expect(item.gramos_semana, contexto).toBe(DIAS_A * gA + DIAS_B * (restoB / DIAS_B))
          }
          // Lo comprado cubre de verdad la semana, sin cruzar el borde de envase.
          expect(item.envases * item.envase_g, contexto).toBeGreaterThanOrEqual(item.gramos_semana)
          expect(item.gramos_dia, contexto).toBe(Math.round((item.gramos_semana / 7) * 10) / 10)
        }

        // `generarListaCompra` sobre un `Ejemplos` sin `compra` (uno construido a mano) rehace el
        // día B con la preferencia efectiva que ahora viaja en `Ejemplos`, no con una deducida a
        // ojo: en modo normal la lista sale idéntica, y en modo sencillo cumple las mismas
        // fórmulas —no puede ser idéntica porque el respaldo por toma de §3.7.2 no se reconstruye.
        const rehecha = generarListaCompra({ ...ejemplos, compra: undefined }, inputs)
        if (!sencillo) {
          expect(JSON.stringify(rehecha), etiqueta).toBe(JSON.stringify(ejemplos.compra))
        }
        for (const item of rehecha.items) {
          const gA = diaA.get(item.alimento_id) ?? 0
          const contexto = `${etiqueta} (rehecha) · ${item.alimento_id}`
          expect(item.gramos_semana, contexto).toBeGreaterThanOrEqual(
            sencillo ? DIAS_A * gA : 7 * gA,
          )
          expect(item.gramos_dia, contexto).toBe(Math.round((item.gramos_semana / 7) * 10) / 10)
        }
      }
    }
  })
})
