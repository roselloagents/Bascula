// Modo sencillo (docs/SPEC-ux-comidas-pdf.md §3.7.2): tope de variedad, alternancia de días
// A/B, respeto de la preferencia dietética y las mismas tolerancias de §3.3.
import { describe, expect, it } from 'vitest'
import { ALIMENTOS, alimentoPorId } from '../../data/foods'
import type { NComidas, Preferencia } from '../../engine/types'
import { BANCOS_SENCILLOS, MAX_ALIMENTOS_SENCILLO, idsDeBanco } from '../bancoSencillo'
import { TOLERANCIA_KCAL } from '../escalado'
import { pasaPreferencia } from '../filtros'
import { generarEjemplos } from '../index'
import { inputsDe, resultadoDe } from './fixtures'

const PREFERENCIAS: Preferencia[] = ['omnivoro', 'vegetariano', 'vegano', 'sin_lactosa', 'sin_gluten', 'low_carb']
const KCAL = [1400, 1700, 2000, 2400, 2800, 3200]
const COMIDAS: NComidas[] = [2, 3, 4, 5, 6]

function menuSencillo(kcal: number, nComidas: NComidas, preferencia: Preferencia) {
  const o = { kcal, nComidas, preferencia, objetivo: 'mantener' as const }
  return generarEjemplos({ ...inputsDe(o), menu_sencillo: true }, resultadoDe(o))
}

describe('banco sencillo (§3.7.2)', () => {
  for (const p of PREFERENCIAS) {
    const banco = BANCOS_SENCILLOS[p]

    it(`${p}: no más de ${MAX_ALIMENTOS_SENCILLO} candidatos y sin duplicados`, () => {
      expect(banco.candidatos.length).toBeLessThanOrEqual(MAX_ALIMENTOS_SENCILLO)
      expect(new Set(banco.candidatos).size).toBe(banco.candidatos.length)
    })

    it(`${p}: todos los candidatos existen y pasan el filtro de preferencia`, () => {
      for (const id of banco.candidatos) {
        const a = alimentoPorId(id)
        expect(a, id).toBeDefined()
        expect(pasaPreferencia(a!, p), `${id} no vale para ${p}`).toBe(true)
      }
    })

    it(`${p}: ninguna plantilla usa un alimento de fuera de la lista corta`, () => {
      for (const id of idsDeBanco(banco)) expect(banco.candidatos, id).toContain(id)
    })

    it(`${p}: dos variantes por rol de comida (día A y día B)`, () => {
      const roles = ['desayuno', 'principal', 'ligera'] as const
      for (const rol of roles) {
        expect(banco.A.filter((x) => x.rol_comida === rol).length, rol).toBeGreaterThan(0)
        expect(banco.B.filter((x) => x.rol_comida === rol).length, rol).toBeGreaterThan(0)
      }
      // Ninguna plantilla se comparte entre los dos días: el día par siempre cambia de variante.
      const idsA = new Set(banco.A.map((x) => x.id))
      for (const x of banco.B) expect(idsA.has(x.id)).toBe(false)
    })
  }
})

describe('menú sencillo: tope de variedad y marcas', () => {
  it('nunca pasa de 12 alimentos distintos en la semana', () => {
    for (const p of PREFERENCIAS) {
      for (const kcal of KCAL) {
        for (const n of COMIDAS) {
          const e = menuSencillo(kcal, n, p)
          expect(e.compra, `${p} ${kcal} ${n}`).toBeDefined()
          expect(e.compra!.alimentos_distintos, `${p} ${kcal} ${n}`).toBeLessThanOrEqual(MAX_ALIMENTOS_SENCILLO)
          expect(e.compra!.items.length).toBe(e.compra!.alimentos_distintos)
        }
      }
    }
  })

  it('marca `modo_sencillo` y lo apaga en el menú normal', () => {
    const o = { kcal: 2200, nComidas: 4 as NComidas, preferencia: 'omnivoro' as const, objetivo: 'mantener' as const }
    expect(generarEjemplos({ ...inputsDe(o), menu_sencillo: true }, resultadoDe(o)).modo_sencillo).toBe(true)
    expect(generarEjemplos(inputsDe(o), resultadoDe(o)).modo_sencillo).toBe(false)
  })

  it('usa menos alimentos que el menú normal para el mismo plan', () => {
    const o = { kcal: 2400, nComidas: 5 as NComidas, preferencia: 'omnivoro' as const, objetivo: 'mantener' as const }
    const normal = generarEjemplos(inputsDe(o), resultadoDe(o))
    const sencillo = generarEjemplos({ ...inputsDe(o), menu_sencillo: true }, resultadoDe(o))
    const distintosNormal = new Set(normal.entreno.comidas.flatMap((c) => c.alimentos.map((a) => a.id))).size
    expect(sencillo.compra!.alimentos_distintos).toBeLessThan(distintosNormal + 2)
    expect(distintosNormal).toBeGreaterThan(MAX_ALIMENTOS_SENCILLO - 3)
  })

  it('es determinista: dos llamadas idénticas dan el mismo menú y la misma lista', () => {
    for (const p of PREFERENCIAS) {
      const a = menuSencillo(2000, 4, p)
      const b = menuSencillo(2000, 4, p)
      expect(JSON.stringify(b)).toBe(JSON.stringify(a))
    }
  })

  it('ignora `variante`: el modo sencillo no rota plantillas', () => {
    const o = { kcal: 2000, nComidas: 4 as NComidas, preferencia: 'omnivoro' as const, objetivo: 'mantener' as const }
    const i = { ...inputsDe(o), menu_sencillo: true }
    expect(JSON.stringify(generarEjemplos(i, resultadoDe(o), 3))).toBe(
      JSON.stringify(generarEjemplos(i, resultadoDe(o), 0)),
    )
  })
})

describe('menú sencillo: preferencia dietética (§3.7.2, regla 4)', () => {
  it('vegano: ni un solo alimento sin el tag `vegano`, tampoco en la lista de la compra', () => {
    for (const kcal of KCAL) {
      for (const n of COMIDAS) {
        const e = menuSencillo(kcal, n, 'vegano')
        for (const item of e.compra!.items) {
          const a = alimentoPorId(item.alimento_id)
          expect(a?.tags, item.alimento_id).toContain('vegano')
        }
      }
    }
  })

  it('sin gluten: ni avena ni pan integral, y todo con el tag `sin_gluten`', () => {
    for (const kcal of KCAL) {
      for (const n of COMIDAS) {
        const e = menuSencillo(kcal, n, 'sin_gluten')
        for (const item of e.compra!.items) {
          expect(['avena_copos', 'pan_integral', 'pasta_cocida']).not.toContain(item.alimento_id)
          expect(alimentoPorId(item.alimento_id)?.tags, item.alimento_id).toContain('sin_gluten')
        }
      }
    }
  })

  it('vegetariano y sin lactosa: todo pasa su filtro de preferencia', () => {
    for (const p of ['vegetariano', 'sin_lactosa'] as const) {
      for (const n of COMIDAS) {
        const e = menuSencillo(2200, n, p)
        for (const item of e.compra!.items) {
          const a = alimentoPorId(item.alimento_id)
          expect(pasaPreferencia(a!, p), `${item.alimento_id} en ${p}`).toBe(true)
        }
      }
    }
  })

  it('la base tiene ficha de todos los candidatos sencillos', () => {
    const ids = new Set(ALIMENTOS.map((a) => a.id))
    for (const p of PREFERENCIAS) for (const id of BANCOS_SENCILLOS[p].candidatos) expect(ids.has(id), id).toBe(true)
  })
})

describe('menú sencillo: tolerancias de §3.3', () => {
  it('cada toma cierra dentro del ±10 % de kcal o lleva su nota', () => {
    for (const p of PREFERENCIAS) {
      for (const kcal of KCAL) {
        for (const n of COMIDAS) {
          const e = menuSencillo(kcal, n, p)
          for (const c of e.entreno.comidas) {
            const desv = Math.abs(c.totales.kcal - c.objetivo.kcal) / c.objetivo.kcal
            if (desv <= TOLERANCIA_KCAL) continue
            expect(
              e.entreno.notas.some((t) => t.startsWith(`${c.comida}:`)),
              `${p} ${kcal} ${n} ${c.comida} ${c.totales.kcal}/${c.objetivo.kcal}`,
            ).toBe(true)
          }
        }
      }
    }
  })

  it('ninguna toma se va a más del 25 % de su objetivo de kcal', () => {
    for (const p of PREFERENCIAS) {
      for (const kcal of KCAL) {
        for (const n of COMIDAS) {
          for (const c of menuSencillo(kcal, n, p).entreno.comidas) {
            const desv = Math.abs(c.totales.kcal - c.objetivo.kcal) / c.objetivo.kcal
            expect(desv, `${p} ${kcal} ${n} ${c.comida}`).toBeLessThan(0.25)
          }
        }
      }
    }
  })

  it('todas las tomas llevan alimentos y gramajes positivos', () => {
    for (const p of PREFERENCIAS) {
      for (const n of COMIDAS) {
        for (const c of menuSencillo(1800, n, p).entreno.comidas) {
          expect(c.alimentos.length, `${p} ${n} ${c.comida}`).toBeGreaterThan(0)
          for (const a of c.alimentos) expect(a.gramos).toBeGreaterThan(0)
        }
      }
    }
  })
})
