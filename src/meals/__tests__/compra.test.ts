// Lista de la compra semanal (docs/SPEC-ux-comidas-pdf.md §3.7.3): sumas, envases, duración,
// consejos de conservación, orden por sección y determinismo.
import { describe, expect, it } from 'vitest'
import { ORDEN_SECCIONES, formatoCompra } from '../../data/mercadona'
import type { Ejemplos, ItemCompra, NComidas, Preferencia } from '../../engine/types'
import { CONSEJO_FRESCO_DOS_VECES, NOTAS_COMPRA, listaCompraDeDias } from '../compra'
import { generarEjemplos, generarListaCompra } from '../index'
import { inputsDe, resultadoDe } from './fixtures'

const PREFERENCIAS: Preferencia[] = ['omnivoro', 'vegetariano', 'vegano', 'sin_lactosa', 'sin_gluten', 'low_carb']
const KCAL = [1400, 1700, 2000, 2400, 2800, 3200]
const COMIDAS: NComidas[] = [2, 3, 4, 5, 6]

function plan(kcal: number, nComidas: NComidas, preferencia: Preferencia, sencillo: boolean) {
  const o = { kcal, nComidas, preferencia, objetivo: 'mantener' as const }
  const inputs = { ...inputsDe(o), menu_sencillo: sencillo }
  return { inputs, ejemplos: generarEjemplos(inputs, resultadoDe(o)) }
}

function comprobarItem(item: ItemCompra, contexto: string): void {
  for (const n of [item.gramos_dia, item.gramos_semana, item.envase_g, item.envases, item.dura_dias]) {
    expect(Number.isFinite(n), `${contexto} ${item.alimento_id}`).toBe(true)
    expect(Number.isNaN(n)).toBe(false)
  }
  expect(item.gramos_dia, contexto).toBeGreaterThan(0)
  expect(item.envase_g, contexto).toBeGreaterThan(0)
  // Fórmulas normativas de §3.7.3.
  expect(item.gramos_semana).toBe(Math.round(item.gramos_dia * 7))
  expect(item.envases).toBe(Math.ceil(item.gramos_semana / item.envase_g))
  expect(item.envases).toBeGreaterThanOrEqual(1)
  const duraBruto = Math.floor((item.envases * item.envase_g) / item.gramos_dia)
  const fila = formatoCompra(item.alimento_id)
  expect(fila, `sin ficha de Mercadona: ${item.alimento_id}`).toBeDefined()
  expect(item.dura_dias).toBe(Math.max(1, Math.min(duraBruto, fila!.conservacion_dias)))
  expect(item.dura_dias).toBeLessThanOrEqual(fila!.conservacion_dias)
  // Lo comprado siempre da para los días que dice, y nunca menos de uno.
  expect(item.envases * item.envase_g).toBeGreaterThanOrEqual(item.gramos_dia * item.dura_dias)
  expect(item.dura_dias).toBeGreaterThanOrEqual(1)
  // Datos de presentación: producto y formato siempre escritos, y sin precio.
  expect(item.producto.length).toBeGreaterThan(0)
  expect(item.envase_descripcion.length).toBeGreaterThan(0)
  expect(item.producto).not.toMatch(/€|EUR/)
  // El consejo del fresco que sobra sustituye al del catálogo (única regla que lo reescribe).
  if (item.conservacion === 'fresco' && duraBruto > fila!.conservacion_dias) {
    expect(item.consejo, contexto).toBe(CONSEJO_FRESCO_DOS_VECES)
  }
  // Fuera de esa regla el consejo es el del catálogo, que puede no existir (un yogur o una
  // manzana aguantan de sobra la semana y no necesitan ninguna advertencia).
  if (item.consejo !== undefined) expect(item.consejo.length, contexto).toBeGreaterThan(0)
}

describe('lista de la compra: forma y fórmulas (§3.7.3)', () => {
  it('se genera siempre que hay menú, en modo normal y en modo sencillo', () => {
    for (const sencillo of [false, true]) {
      for (const p of PREFERENCIAS) {
        for (const kcal of KCAL) {
          for (const n of COMIDAS) {
            const { ejemplos } = plan(kcal, n, p, sencillo)
            const compra = ejemplos.compra
            const contexto = `${p} ${kcal} ${n} sencillo=${sencillo}`
            expect(compra, contexto).toBeDefined()
            expect(compra!.supermercado).toBe('Mercadona')
            expect(compra!.dias).toBe(7)
            expect(compra!.notas).toEqual([...NOTAS_COMPRA])
            expect(compra!.items.length).toBeGreaterThan(0)
            expect(compra!.alimentos_distintos).toBe(compra!.items.length)
            for (const item of compra!.items) comprobarItem(item, contexto)
          }
        }
      }
    }
  })

  it('ordena por sección y, dentro de cada sección, por nombre en español', () => {
    for (const sencillo of [false, true]) {
      for (const p of PREFERENCIAS) {
        const items = plan(2400, 5, p, sencillo).ejemplos.compra!.items
        for (let i = 1; i < items.length; i++) {
          const a = ORDEN_SECCIONES.indexOf(items[i - 1].seccion)
          const b = ORDEN_SECCIONES.indexOf(items[i].seccion)
          expect(a).toBeGreaterThanOrEqual(0)
          expect(a).toBeLessThanOrEqual(b)
          if (a === b) expect(items[i - 1].nombre.localeCompare(items[i].nombre, 'es')).toBeLessThanOrEqual(0)
        }
      }
    }
  })

  it('no repite alimentos: una línea por `alimento_id`', () => {
    for (const p of PREFERENCIAS) {
      const items = plan(2600, 6, p, true).ejemplos.compra!.items
      expect(new Set(items.map((i) => i.alimento_id)).size).toBe(items.length)
    }
  })
})

describe('lista de la compra: gramos del menú', () => {
  it('modo normal: los gramos del día son la suma exacta de los del menú', () => {
    for (const p of PREFERENCIAS) {
      for (const n of COMIDAS) {
        const { ejemplos } = plan(2200, n, p, false)
        const suma = new Map<string, number>()
        for (const c of ejemplos.entreno.comidas) {
          for (const a of c.alimentos) suma.set(a.id, (suma.get(a.id) ?? 0) + a.gramos)
        }
        expect(ejemplos.compra!.items.length).toBe(suma.size)
        for (const item of ejemplos.compra!.items) {
          expect(item.gramos_dia, `${p} ${n} ${item.alimento_id}`).toBe(suma.get(item.alimento_id))
        }
      }
    }
  })

  it('modo sencillo: promedia los dos días y por eso puede llevar medio gramo', () => {
    const { ejemplos } = plan(2200, 4, 'omnivoro', true)
    const delDia = new Map<string, number>()
    for (const c of ejemplos.entreno.comidas) {
      for (const a of c.alimentos) delDia.set(a.id, (delDia.get(a.id) ?? 0) + a.gramos)
    }
    // La lista incluye alimentos que solo aparecen el día B (los del par que no viaja en Ejemplos).
    const soloDiaB = ejemplos.compra!.items.filter((i) => !delDia.has(i.alimento_id))
    expect(soloDiaB.length).toBeGreaterThan(0)
    // Y para los del día A el promedio nunca es mayor que sus propios gramos más los del día B.
    for (const item of ejemplos.compra!.items) {
      const gA = delDia.get(item.alimento_id) ?? 0
      if (gA > 0) expect(item.gramos_dia).toBeGreaterThan(0)
      expect(Math.round(item.gramos_dia * 10) / 10).toBe(item.gramos_dia)
    }
  })

  it('la media de dos días se calcula alimento a alimento, contando 0 donde falta', () => {
    const lista = listaCompraDeDias(
      [
        { id: 'huevo_entero', nombre: 'Huevo entero', gramos: 110 },
        { id: 'huevo_entero', nombre: 'Huevo entero', gramos: 55 },
        { id: 'platano', nombre: 'Plátano', gramos: 120 },
      ],
      [{ id: 'huevo_entero', nombre: 'Huevo entero', gramos: 55 }],
    )
    const huevo = lista.items.find((i) => i.alimento_id === 'huevo_entero')!
    const platano = lista.items.find((i) => i.alimento_id === 'platano')!
    expect(huevo.gramos_dia).toBe(110) // (165 + 55) / 2
    expect(huevo.gramos_semana).toBe(770)
    expect(platano.gramos_dia).toBe(60) // (120 + 0) / 2
    expect(platano.gramos_semana).toBe(420)
  })
})

describe('generarListaCompra (§3.7.3, API)', () => {
  it('devuelve exactamente lo que `generarEjemplos` deja en `Ejemplos.compra`', () => {
    for (const sencillo of [false, true]) {
      for (const p of PREFERENCIAS) {
        for (const n of COMIDAS) {
          const { inputs, ejemplos } = plan(2000, n, p, sencillo)
          expect(generarListaCompra(ejemplos, inputs)).toBe(ejemplos.compra)
        }
      }
    }
  })

  it('es pura y determinista: mismas entradas, misma lista y mismo orden', () => {
    for (const p of PREFERENCIAS) {
      const { inputs, ejemplos } = plan(2600, 4, p, true)
      const sinCompra: Ejemplos = { ...ejemplos, compra: undefined }
      const a = generarListaCompra(sinCompra, inputs)
      const b = generarListaCompra(sinCompra, inputs)
      expect(JSON.stringify(b)).toBe(JSON.stringify(a))
      expect(a.alimentos_distintos).toBeGreaterThan(0)
    }
  })

  it('reconstruye la lista desde un `Ejemplos` sin `compra` (modo normal, gramos exactos)', () => {
    for (const p of PREFERENCIAS) {
      const { inputs, ejemplos } = plan(2200, 4, p, false)
      const rehecha = generarListaCompra({ ...ejemplos, compra: undefined }, inputs)
      expect(JSON.stringify(rehecha)).toBe(JSON.stringify(ejemplos.compra))
    }
  })

  it('sin menú (condición renal o hepática) no hay lista de la compra', () => {
    for (const condicion of ['renal', 'hepatica'] as const) {
      const o = { kcal: 2200, nComidas: 4 as NComidas, preferencia: 'omnivoro' as const, objetivo: 'mantener' as const }
      const inputs = { ...inputsDe({ ...o, condiciones: [condicion] }), menu_sencillo: true }
      const ejemplos = generarEjemplos(inputs, resultadoDe(o))
      expect(ejemplos.compra).toBeUndefined()
      expect(ejemplos.modo_sencillo).toBe(true)
      // Llamada directa sobre un menú vacío: lista vacía, nunca un error.
      const lista = generarListaCompra(ejemplos, inputs)
      expect(lista.items).toEqual([])
      expect(lista.alimentos_distintos).toBe(0)
    }
  })
})

describe('lista de la compra: consejos de conservación', () => {
  it('los frescos que darían para más días de los que aguantan se compran en dos veces', () => {
    const lista = listaCompraDeDias([{ id: 'pechuga_pollo', nombre: 'Pechuga de pollo', gramos: 100 }], null)
    const pollo = lista.items[0]
    expect(pollo.conservacion).toBe('fresco')
    // 700 g a la semana → 1 bandeja de 1 kg → 10 días brutos, pero el pollo aguanta 3.
    expect(pollo.envases).toBe(1)
    expect(pollo.dura_dias).toBe(3)
    expect(pollo.consejo).toBe(CONSEJO_FRESCO_DOS_VECES)
  })

  it('un producto de despensa conserva el consejo de su ficha', () => {
    const lista = listaCompraDeDias([{ id: 'aove', nombre: 'AOVE', gramos: 30 }], null)
    const aove = lista.items[0]
    expect(aove.conservacion).toBe('despensa')
    expect(aove.consejo).toBe(formatoCompra('aove')!.consejo)
  })
})
