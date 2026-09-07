// Presentación de la lista de la compra (§2.5b). La lista NO se fabrica aquí: se pide al
// generador real (cuestionario → `aInputs` → `calcular` → `generarEjemplos`), que es
// exactamente el camino que recorre la aplicación. Así el test cubre también el enganche:
// si el interruptor del paso 13 dejara de llegar al generador, o el generador dejara de
// rellenar `Ejemplos.compra`, estos casos se caen.

import { describe, expect, it } from 'vitest'
import { calcular } from '../../../engine'
import { generarEjemplos } from '../../../meals'
import { formatoCompra, ORDEN_SECCIONES } from '../../../data/mercadona'
import type { Ejemplos, InputCalculo, ItemCompra, ListaCompra } from '../../../engine/types'
import { aInputs, borradorInicial, type Borrador } from '../../wizard/borrador'
import {
  agruparPorSeccion,
  textoCantidadDia,
  textoCantidadSemana,
  textoComprar,
  textoDura,
  textoModoSencillo,
} from '../compra'

const CONSEJO_FRESCO =
  'Es fresco: cómpralo en dos veces, mitad al principio de la semana y mitad a mitad.'

/** Un cuestionario contestado de punta a punta, como el que deja el usuario en el paso 13. */
function borradorCompleto(cambios: Partial<Borrador> = {}): Borrador {
  return {
    ...borradorInicial(),
    sexo: 'hombre',
    edad: '35',
    altura_cm: '178',
    peso_kg: '80',
    somatotipoElegido: 'saltar',
    actividad_diaria: 'ligero',
    entrena: false,
    objetivo: 'mantener',
    quierePesoObjetivo: false,
    preferencia: 'omnivoro',
    n_comidas: 4,
    sinCondiciones: true,
    ...cambios,
  }
}

function plan(cambios: Partial<Borrador> = {}): { inputs: InputCalculo; ejemplos: Ejemplos } {
  const inputs = aInputs(borradorCompleto(cambios))
  const resultado = calcular(inputs)
  expect(resultado.excluido, 'el caso de prueba no debería quedar excluido').toBeFalsy()
  return { inputs, ejemplos: generarEjemplos(inputs, resultado) }
}

function listaDe(cambios: Partial<Borrador> = {}): ListaCompra {
  const { ejemplos } = plan(cambios)
  expect(ejemplos.compra, 'el generador debe rellenar Ejemplos.compra').toBeDefined()
  return ejemplos.compra!
}

const SENCILLA = listaDe({ menu_sencillo: true })

describe('el generador alimenta la pantalla', () => {
  it('el interruptor del paso 13 llega hasta el menú y su lista', () => {
    const sencillo = plan({ menu_sencillo: true })
    const normal = plan({ menu_sencillo: false })
    expect(sencillo.inputs.menu_sencillo).toBe(true)
    expect(sencillo.ejemplos.modo_sencillo).toBe(true)
    expect(normal.inputs.menu_sencillo).toBe(false)
    expect(normal.ejemplos.modo_sencillo).toBe(false)
    // La promesa del modo: la compra de la semana cabe en 12 alimentos y es más corta que la normal.
    expect(SENCILLA.alimentos_distintos).toBeLessThanOrEqual(12)
    expect(SENCILLA.items.length).toBeLessThan(normal.ejemplos.compra!.items.length)
  })

  it('sin menú (condición renal) no hay lista que pintar', () => {
    const { ejemplos } = plan({ sinCondiciones: false, condiciones: ['renal'] })
    expect(ejemplos.compra).toBeUndefined()
  })

  it('la lista es siempre la misma para el mismo cuestionario', () => {
    expect(listaDe({ menu_sencillo: true })).toEqual(SENCILLA)
  })
})

describe('lo que la pantalla recibe del generador', () => {
  it('usa formatos reales del catálogo de Mercadona', () => {
    expect(SENCILLA.supermercado).toBe('Mercadona')
    expect(SENCILLA.dias).toBe(7)
    expect(SENCILLA.items.length).toBeGreaterThan(0)
    for (const item of SENCILLA.items) {
      const fila = formatoCompra(item.alimento_id)
      expect(fila, item.alimento_id).toBeDefined()
      expect(item.producto).toBe(fila?.producto)
      expect(item.envase_g).toBe(fila?.envase_g)
      expect(item.envase_descripcion).toBe(fila?.envase_descripcion)
      expect(item.seccion).toBe(fila?.seccion)
      expect(item.conservacion).toBe(fila?.conservacion)
    }
  })

  it('cumple las fórmulas de §3.7.3 y el tope de 12 alimentos del modo sencillo', () => {
    for (const item of SENCILLA.items) {
      const fila = formatoCompra(item.alimento_id)!
      const bruto = Math.floor((item.envases * item.envase_g) / item.gramos_dia)
      expect(item.gramos_semana).toBe(Math.round(item.gramos_dia * 7))
      expect(item.envases).toBe(Math.ceil(item.gramos_semana / item.envase_g))
      expect(item.dura_dias).toBe(Math.min(bruto, fila.conservacion_dias))
      // El consejo fijo del fresco solo entra cuando de verdad se compran dos envases o más.
      if (item.conservacion === 'fresco' && bruto > fila.conservacion_dias && item.envases >= 2) {
        expect(item.consejo).toBe(CONSEJO_FRESCO)
      }
      if (item.envases === 1) expect(item.consejo).not.toBe(CONSEJO_FRESCO)
    }
    expect(SENCILLA.alimentos_distintos).toBe(SENCILLA.items.length)
    expect(SENCILLA.alimentos_distintos).toBeLessThanOrEqual(12)
  })
})

describe('agruparPorSeccion', () => {
  const grupos = agruparPorSeccion(SENCILLA.items)

  it('no pierde ni duplica líneas', () => {
    const ids = grupos.flatMap((g) => g.items.map((i) => i.alimento_id))
    expect(ids.sort()).toEqual(SENCILLA.items.map((i) => i.alimento_id).sort())
  })

  it('respeta el orden de recorrido de la tienda y no deja secciones vacías', () => {
    const orden = grupos.map((g) => ORDEN_SECCIONES.indexOf(g.seccion))
    expect(orden).toEqual([...orden].sort((a, b) => a - b))
    expect(grupos.every((g) => g.items.length > 0)).toBe(true)
    expect(grupos[0].nombre).toBe('Carnicería y charcutería')
  })

  it('con una lista vacía no devuelve ningún grupo', () => {
    expect(agruparPorSeccion([])).toEqual([])
  })
})

describe('textos de cada línea', () => {
  // Números fijos: aquí se prueba el formateo, no el generador.
  const linea = (cambios: Partial<ItemCompra>): ItemCompra => ({
    alimento_id: 'pechuga_pollo',
    nombre: 'Pechuga de pollo (cruda, sin piel)',
    producto: 'Pechuga de pollo fileteada Hacendado',
    seccion: 'carniceria',
    conservacion: 'fresco',
    gramos_dia: 180,
    gramos_semana: 1260,
    envase_g: 1000,
    envase_descripcion: 'bandeja ≈ 1 kg',
    envases: 2,
    dura_dias: 3,
    ...cambios,
  })

  it('pasa a kilos a partir de 1 kg y mantiene los gramos por debajo', () => {
    expect(textoCantidadSemana(linea({}))).toBe('1,26 kg en la semana')
    expect(textoCantidadSemana(linea({ gramos_semana: 999 }))).toBe('999 g en la semana')
    expect(textoCantidadSemana(linea({ gramos_semana: 1000 }))).toBe('1 kg en la semana')
    expect(textoCantidadDia(linea({}))).toBe('180 g al día')
  })

  it('dice cuántos envases comprar y cuántos días dura', () => {
    expect(textoComprar(linea({}))).toBe('2 × bandeja ≈ 1 kg')
    expect(textoDura(linea({}))).toBe('te dura 3 días')
    expect(textoDura(linea({ dura_dias: 1 }))).toBe('te dura 1 día')
  })

  it('rotula el modo sencillo con el número de alimentos, o sin él si aún no hay lista', () => {
    expect(textoModoSencillo(11)).toBe('Modo sencillo: 11 alimentos')
    expect(textoModoSencillo(1)).toBe('Modo sencillo: 1 alimento')
    expect(textoModoSencillo(undefined)).toBe('Modo sencillo')
  })
})
