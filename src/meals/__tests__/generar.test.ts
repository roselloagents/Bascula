// Tests del generador de ejemplos de comidas (docs/SPEC-ux-comidas-pdf.md §3, CONTRATO.md).
import { describe, expect, it } from 'vitest'
import type { Alimento } from '../../data/foods'
import { ALIMENTOS, alimentoPorId, esContable } from '../../data/foods'
import type { Ejemplos, Preferencia } from '../../engine/types'
import { generarEjemplos } from '../index'
import type { OpcionesPlan } from './fixtures'
import { inputsDe, resultadoDe } from './fixtures'

const PREFERENCIAS: Preferencia[] = ['omnivoro', 'vegetariano', 'vegano', 'sin_lactosa', 'sin_gluten', 'low_carb']

/** Barrido de planes realistas: 2-6 comidas, 1.300-3.500 kcal, con y sin peri-entreno. */
const PLANES: OpcionesPlan[] = [
  { kcal: 1300, nComidas: 2, preferencia: 'omnivoro', objetivo: 'perder', pesoKg: 62, peri: 1 },
  { kcal: 1500, nComidas: 3, preferencia: 'omnivoro', objetivo: 'perder', pesoKg: 70, peri: null },
  { kcal: 1800, nComidas: 4, preferencia: 'omnivoro', objetivo: 'mantener', pesoKg: 78, peri: 2 },
  { kcal: 2200, nComidas: 5, preferencia: 'omnivoro', objetivo: 'recomposicion', pesoKg: 84, peri: 3 },
  { kcal: 2600, nComidas: 6, preferencia: 'omnivoro', objetivo: 'ganar', pesoKg: 90, peri: 5 },
  { kcal: 3500, nComidas: 4, preferencia: 'omnivoro', objetivo: 'ganar', pesoKg: 100, peri: 2 },
  { kcal: 3500, nComidas: 2, preferencia: 'omnivoro', objetivo: 'ganar', pesoKg: 100, peri: 0 },
]

function planesDe(preferencia: Preferencia): OpcionesPlan[] {
  return PLANES.map((p) => ({ ...p, preferencia }))
}

function generar(p: OpcionesPlan): Ejemplos {
  return generarEjemplos(inputsDe(p), resultadoDe(p))
}

function etiqueta(p: OpcionesPlan): string {
  return `${p.preferencia} ${p.kcal} kcal / ${p.nComidas} comidas`
}

function esFinito(n: number): boolean {
  return Number.isFinite(n) && !Number.isNaN(n)
}

describe('generarEjemplos — tolerancias por comida', () => {
  for (const preferencia of PREFERENCIAS) {
    for (const plan of planesDe(preferencia)) {
      it(`cierra dentro del ±10 % de kcal — ${etiqueta(plan)}`, () => {
        const ejemplos = generar(plan)
        for (const comida of ejemplos.entreno.comidas) {
          const desviacion = Math.abs(comida.totales.kcal - comida.objetivo.kcal) / comida.objetivo.kcal
          expect(desviacion, `${etiqueta(plan)} · ${comida.comida}: ${comida.totales.kcal} vs ${comida.objetivo.kcal}`)
            .toBeLessThanOrEqual(0.1)
        }
      })

      it(`cierra la proteína dentro del umbral terminal del ±15 % — ${etiqueta(plan)}`, () => {
        const ejemplos = generar(plan)
        for (const comida of ejemplos.entreno.comidas) {
          const desviacion = Math.abs(comida.totales.prot - comida.objetivo.prot) / comida.objetivo.prot
          if (desviacion > 0.15) {
            // §3.3 no permite imprimir un gramaje imposible en silencio: si la proteína no
            // cierra, el menú debe llevar su nota (y el aviso vegetal si la causa es esa).
            const conNota = ejemplos.entreno.notas.some(
              (n) => n.startsWith(`${comida.comida}:`) && n.includes('proteína'),
            )
            expect(conNota, `${etiqueta(plan)} · ${comida.comida}: proteína fuera sin nota`).toBe(true)
          } else {
            expect(desviacion).toBeLessThanOrEqual(0.15)
          }
        }
      })
    }
  }
})

describe('generarEjemplos — integridad de los datos', () => {
  for (const preferencia of PREFERENCIAS) {
    it(`no produce NaN ni gramajes imposibles — ${preferencia}`, () => {
      for (const plan of planesDe(preferencia)) {
        const ejemplos = generar(plan)
        expect(ejemplos.entreno.comidas.length).toBe(plan.nComidas)
        for (const comida of ejemplos.entreno.comidas) {
          expect(comida.alimentos.length, `${etiqueta(plan)} · ${comida.comida}`).toBeGreaterThan(0)
          for (const a of comida.alimentos) {
            expect(esFinito(a.gramos) && a.gramos > 0, `${a.id}`).toBe(true)
            expect(esFinito(a.kcal) && esFinito(a.prot) && esFinito(a.carb) && esFinito(a.fat)).toBe(true)
            expect(a.medida.trim().length, `${a.id} sin medida casera`).toBeGreaterThan(0)
            const alimento = alimentoPorId(a.id)
            expect(alimento, `${a.id} no está en la base`).toBeDefined()
            const paso = esContable(alimento!) ? alimento!.unidad_g : a.gramos >= 100 ? 10 : 5
            expect(a.gramos % paso, `${a.id}: ${a.gramos} g no cae en la rejilla de ${paso} g`).toBe(0)
          }
          for (const valor of [comida.totales.kcal, comida.totales.prot, comida.totales.carb, comida.totales.fat]) {
            expect(esFinito(valor)).toBe(true)
          }
        }
        for (const valor of Object.values(ejemplos.entreno.totales)) expect(esFinito(valor)).toBe(true)
      }
    })

    it(`suma los totales exactamente a partir de los alimentos — ${preferencia}`, () => {
      for (const plan of planesDe(preferencia)) {
        const ejemplos = generar(plan)
        for (const comida of ejemplos.entreno.comidas) {
          const kcal = comida.alimentos.reduce((t, a) => t + a.kcal, 0)
          expect(comida.totales.kcal, `${etiqueta(plan)} · ${comida.comida}`).toBe(kcal)
        }
        const kcalDia = ejemplos.entreno.comidas.reduce((t, c) => t + c.totales.kcal, 0)
        expect(ejemplos.entreno.totales.kcal).toBe(kcalDia)
      }
    })
  }

  it('copia el nombre, la hora y el peri de cada comida del motor', () => {
    const plan: OpcionesPlan = { kcal: 2200, nComidas: 5, preferencia: 'omnivoro', peri: 3 }
    const resultado = resultadoDe(plan)
    const ejemplos = generarEjemplos(inputsDe(plan), resultado)
    ejemplos.entreno.comidas.forEach((c, i) => {
      expect(c.comida).toBe(resultado.comidas[i].nombre)
      expect(c.hora).toBe(resultado.comidas[i].hora)
      expect(c.peri).toBe(resultado.comidas[i].peri)
      expect(c.objetivo.kcal).toBe(resultado.comidas[i].kcal)
    })
    expect(ejemplos.entreno.comidas.filter((c) => c.peri).length).toBe(1)
  })
})

describe('generarEjemplos — preferencias dietéticas', () => {
  function alimentosDe(ejemplos: Ejemplos): Alimento[] {
    return ejemplos.entreno.comidas.flatMap((c) => c.alimentos.map((a) => alimentoPorId(a.id)!))
  }

  it('vegano: solo alimentos con tag vegano', () => {
    for (const plan of planesDe('vegano')) {
      for (const a of alimentosDe(generar(plan))) {
        expect(a.tags, `${etiqueta(plan)} · ${a.id}`).toContain('vegano')
      }
    }
  })

  it('vegetariano: solo alimentos vegetarianos o veganos', () => {
    for (const plan of planesDe('vegetariano')) {
      for (const a of alimentosDe(generar(plan))) {
        expect(a.tags.includes('vegetariano') || a.tags.includes('vegano'), `${a.id}`).toBe(true)
      }
    }
  })

  it('sin lactosa: ningún lácteo sin el tag sin_lactosa', () => {
    for (const plan of planesDe('sin_lactosa')) {
      for (const a of alimentosDe(generar(plan))) {
        if (a.grupo === 'lacteo') expect(a.tags, `${a.id}`).toContain('sin_lactosa')
      }
    }
  })

  it('sin gluten: solo alimentos con tag sin_gluten', () => {
    for (const plan of planesDe('sin_gluten')) {
      for (const a of alimentosDe(generar(plan))) {
        expect(a.tags, `${etiqueta(plan)} · ${a.id}`).toContain('sin_gluten')
      }
    }
  })

  it('low carb: cereal normal solo como vía de escape de §3.2', () => {
    // El ancla low-carb (arroz de coliflor, pan proteico) aporta como mucho 18 g de hidrato con
    // su ración máxima. Cuando el plan pide más, §3.2 permite un cereal normal con la ración
    // rebajada: sin esa vía de escape el menú entregaba un tercio del hidrato prescrito.
    for (const plan of planesDe('low_carb')) {
      const ejemplos = generar(plan)
      for (const comida of ejemplos.entreno.comidas) {
        for (const a of comida.alimentos) {
          const alimento = alimentoPorId(a.id)!
          if (alimento.grupo === 'carbohidrato' && !alimento.tags.includes('low_carb')) {
            expect(
              comida.objetivo.carb,
              `${etiqueta(plan)} · ${a.id}: cereal normal sin necesitarlo`,
            ).toBeGreaterThan(18)
          }
        }
      }
    }
  })

  it('low carb: el hidrato del día no se aleja más del 20 % del plan', () => {
    for (const plan of planesDe('low_carb')) {
      const resultado = resultadoDe(plan)
      const ejemplos = generar(plan)
      const desviacion =
        Math.abs(ejemplos.entreno.totales.carb - resultado.macros.hc_g) / resultado.macros.hc_g
      expect(desviacion, `${etiqueta(plan)}: ${ejemplos.entreno.totales.carb} vs ${resultado.macros.hc_g} g`)
        .toBeLessThanOrEqual(0.2)
    }
  })

  it('usa la preferencia efectiva del motor: diabetes + low_carb cae en el banco omnívoro', () => {
    const plan: OpcionesPlan = { kcal: 2200, nComidas: 4, preferencia: 'omnivoro', peri: 2 }
    const inputs = { ...inputsDe(plan), preferencia: 'low_carb' as const, condiciones: ['diabetes' as const] }
    const ejemplos = generarEjemplos(inputs, resultadoDe(plan))
    const ids = ejemplos.entreno.comidas.flatMap((c) => c.alimentos.map((a) => a.id))
    const cerealesNormales = ids.filter((id) => {
      const a = alimentoPorId(id)!
      return a.grupo === 'carbohidrato' && !a.tags.includes('low_carb')
    })
    expect(cerealesNormales.length, 'el banco low-carb no habría usado cereales normales').toBeGreaterThan(0)
    expect(ejemplos.entreno.notas.some((n) => n.includes('insulina'))).toBe(true)
  })
})

describe('generarEjemplos — determinismo y variedad', () => {
  it('devuelve exactamente el mismo menú con los mismos inputs', () => {
    for (const preferencia of PREFERENCIAS) {
      for (const plan of planesDe(preferencia)) {
        const a = generar(plan)
        const b = generar(plan)
        expect(b, etiqueta(plan)).toEqual(a)
      }
    }
  })

  it('no repite la misma proteína en todas las tomas del día', () => {
    for (const preferencia of PREFERENCIAS) {
      for (const plan of planesDe(preferencia).filter((p) => p.nComidas >= 3)) {
        const ejemplos = generar(plan)
        const anclas = ejemplos.entreno.comidas.map((c) => {
          const proteicos = c.alimentos
            .map((a) => alimentoPorId(a.id)!)
            .filter((a) => a.roles.includes('proteina'))
          return proteicos[0]?.id ?? ''
        })
        expect(new Set(anclas).size, `${etiqueta(plan)}: ${anclas.join(', ')}`).toBeGreaterThan(1)
      }
    }
  })

  it('cambia el menú entre usuarios con distinto perfil', () => {
    const base: OpcionesPlan = { kcal: 2200, nComidas: 4, preferencia: 'omnivoro', peri: 2 }
    const a = generarEjemplos(inputsDe({ ...base, edad: 30 }), resultadoDe(base))
    const b = generarEjemplos(inputsDe({ ...base, edad: 31 }), resultadoDe(base))
    const idsA = a.entreno.comidas.flatMap((c) => c.alimentos.map((x) => x.id)).join('|')
    const idsB = b.entreno.comidas.flatMap((c) => c.alimentos.map((x) => x.id)).join('|')
    expect(idsB).not.toBe(idsA)
  })
})

describe('generarEjemplos — textos, notas y consejos', () => {
  it('da entre 3 y 5 consejos y 2-3 alternativas por comida, todo en español', () => {
    for (const preferencia of PREFERENCIAS) {
      for (const plan of planesDe(preferencia)) {
        const ejemplos = generar(plan)
        expect(ejemplos.consejos.length, etiqueta(plan)).toBeGreaterThanOrEqual(3)
        expect(ejemplos.consejos.length, etiqueta(plan)).toBeLessThanOrEqual(5)
        for (const comida of ejemplos.entreno.comidas) {
          expect(comida.alternativas.length, `${etiqueta(plan)} · ${comida.comida}`).toBeGreaterThanOrEqual(2)
          expect(comida.alternativas.length).toBeLessThanOrEqual(3)
          for (const alt of comida.alternativas) expect(alt).toMatch(/^Cambia \d+ g de .+ por \d+ g de .+\.$/)
        }
      }
    }
  })

  it('reparte en varios platos las tomas que no caben en uno solo', () => {
    const plan: OpcionesPlan = { kcal: 3500, nComidas: 2, preferencia: 'omnivoro', pesoKg: 100, peri: 0 }
    const ejemplos = generar(plan)
    const grandes = ejemplos.entreno.comidas.filter((c) => c.objetivo.kcal > 900)
    expect(grandes.length).toBeGreaterThan(0)
    for (const c of grandes) {
      expect(
        ejemplos.entreno.notas.some((n) => n.startsWith(`${c.comida}:`) && /(dos|tres|cuatro) platos/.test(n)),
        `${c.comida} sin nota de reparto en platos`,
      ).toBe(true)
    }
  })

  it('resuelve las tomas pequeñas con una plantilla de snack', () => {
    const plan: OpcionesPlan = { kcal: 1300, nComidas: 6, preferencia: 'omnivoro', pesoKg: 55, peri: null }
    const ejemplos = generar(plan)
    const pequenas = ejemplos.entreno.comidas.filter((c) => c.objetivo.kcal < 150)
    for (const c of pequenas) {
      expect(c.alimentos.length, `${c.comida}`).toBeLessThanOrEqual(3)
      const desviacion = Math.abs(c.totales.kcal - c.objetivo.kcal) / c.objetivo.kcal
      expect(desviacion, `${c.comida}: ${c.totales.kcal} vs ${c.objetivo.kcal}`).toBeLessThanOrEqual(0.1)
    }
  })

  it('no genera menú con condición renal o hepática', () => {
    for (const condicion of ['renal', 'hepatica'] as const) {
      const plan: OpcionesPlan = { kcal: 2000, nComidas: 4, preferencia: 'omnivoro', peri: 2 }
      const inputs = { ...inputsDe(plan), condiciones: [condicion] }
      const ejemplos = generarEjemplos(inputs, resultadoDe(plan))
      expect(ejemplos.entreno.comidas).toEqual([])
      expect(ejemplos.descanso.comidas).toEqual([])
      expect(ejemplos.entreno.notas[0]).toContain('dietista-nutricionista especializado')
      expect(ejemplos.consejos.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('añade la nota de sodio con condición cardiaca', () => {
    const plan: OpcionesPlan = { kcal: 2000, nComidas: 3, preferencia: 'omnivoro', peri: null }
    const inputs = { ...inputsDe(plan), condiciones: ['cardiaca' as const] }
    const ejemplos = generarEjemplos(inputs, resultadoDe(plan))
    expect(ejemplos.entreno.notas.some((n) => n.includes('sin sal añadida'))).toBe(true)
  })

  it('devuelve el mismo reparto en el día de entreno y en el de descanso (v1)', () => {
    const plan: OpcionesPlan = { kcal: 2400, nComidas: 4, preferencia: 'omnivoro', peri: 2 }
    const ejemplos = generar(plan)
    expect(ejemplos.descanso.comidas).toEqual(ejemplos.entreno.comidas)
    expect(ejemplos.descanso.tipo).toBe('descanso')
    expect(ejemplos.entreno.tipo).toBe('entreno')
  })

  it('avisa cuando el menú se queda corto de fibra', () => {
    // Menú low-carb con objetivo de fibra alto: la base no puede cubrirlo sin cereal integral.
    const plan: OpcionesPlan = { kcal: 1800, nComidas: 3, preferencia: 'low_carb', peri: null }
    const resultado = resultadoDe(plan)
    const conFibraAlta = { ...resultado, macros: { ...resultado.macros, fibra_g: 60 } }
    const ejemplos = generarEjemplos(inputsDe(plan), conFibraAlta)
    expect(ejemplos.entreno.notas.some((n) => n.includes('g de fibra frente a los'))).toBe(true)
  })
})

describe('generarEjemplos — cobertura del banco', () => {
  it('todas las plantillas resuelven algún alimento en cada preferencia', () => {
    // Comprobación indirecta: en un día de 6 comidas se usan las tres plantillas ligeras.
    for (const preferencia of PREFERENCIAS) {
      const plan: OpcionesPlan = { kcal: 2600, nComidas: 6, preferencia, pesoKg: 85, peri: 5 }
      const ejemplos = generar(plan)
      const ids = new Set(ejemplos.entreno.comidas.flatMap((c) => c.alimentos.map((a) => a.id)))
      expect(ids.size, `${preferencia}: solo ${ids.size} alimentos distintos`).toBeGreaterThanOrEqual(6)
      for (const id of ids) expect(ALIMENTOS.some((a) => a.id === id)).toBe(true)
    }
  })
})

describe('generarEjemplos — tomas repartidas en varios platos (§3.3)', () => {
  it('la tabla de la comida no repite el mismo alimento una vez por plato', () => {
    // Antes, una toma de 1.100 kcal servida en dos platos imprimía "plátano 120 g / huevo 55 g /
    // avena 65 g" dos veces seguidas: la lista es plana y no distingue los platos.
    let conVariosPlatos = 0
    for (const sencillo of [false, true]) {
      for (const preferencia of PREFERENCIAS) {
        for (const plan of PLANES) {
          const opciones: OpcionesPlan = { ...plan, preferencia }
          const inputs = { ...inputsDe(opciones), menu_sencillo: sencillo }
          const ejemplos = generarEjemplos(inputs, resultadoDe(opciones))
          for (const c of ejemplos.entreno.comidas) {
            const ids = c.alimentos.map((a) => a.id)
            expect(new Set(ids).size, `${preferencia} ${plan.kcal} ${c.comida}: ${ids.join(' ')}`).toBe(ids.length)
          }
          if (ejemplos.entreno.notas.some((n) => n.includes('va repartido en'))) conVariosPlatos++
        }
      }
    }
    // Y el barrido de verdad pasa por el caso: si no, el test no comprobaría nada.
    expect(conVariosPlatos).toBeGreaterThan(0)
  })
})
