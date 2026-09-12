// Persistencia local de lo que la persona nos contó y suma de gustos al paso 14
// (SPEC-dieta-propia §5.5).

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DietaInterpretada } from '../../engine/types'
import {
  CLAVE_BORRADOR_DIETA,
  CLAVE_DIETA,
  type DietaGuardada,
  borrarDieta,
  cargarBorradorDieta,
  cargarDieta,
  guardarBorradorDieta,
  guardarDieta,
  retirarGustos,
  sumarGustos,
} from '../almacen'

const almacen = new Map<string, string>()
vi.stubGlobal('window', {
  localStorage: {
    getItem: (clave: string) => almacen.get(clave) ?? null,
    setItem: (clave: string, valor: string) => void almacen.set(clave, valor),
    removeItem: (clave: string) => void almacen.delete(clave),
  },
})

function interpretada(parcial: Partial<DietaInterpretada> = {}): DietaInterpretada {
  return {
    comidas: [],
    gustos: [],
    habitos: [],
    no_entendido: [],
    notas: [],
    falta_aceite: false,
    ...parcial,
  }
}

function guardada(parcial: Partial<DietaGuardada> = {}): DietaGuardada {
  return {
    version: 1,
    texto: 'Desayuno 250 g de kéfir',
    interpretada: interpretada({ comidas: [{ nombre: 'Desayuno', alimentos: [] }] }),
    fecha: '2026-09-12',
    activa: true,
    gustos_sumados: { excluidos: [], favoritos: [] },
    ...parcial,
  }
}

beforeEach(() => almacen.clear())

describe('cargarDieta / guardarDieta / borrarDieta', () => {
  it('guarda y recupera lo mismo', () => {
    const dieta = guardada()
    guardarDieta(dieta)
    expect(cargarDieta()).toEqual(dieta)
  })

  it('sin nada guardado devuelve null', () => {
    expect(cargarDieta()).toBeNull()
  })

  it('tolera basura: JSON roto, otra versión, tipos raros y contenido vacío', () => {
    almacen.set(CLAVE_DIETA, 'esto no es json')
    expect(cargarDieta()).toBeNull()
    almacen.set(CLAVE_DIETA, '[]')
    expect(cargarDieta()).toBeNull()
    almacen.set(CLAVE_DIETA, JSON.stringify({ ...guardada(), version: 2 }))
    expect(cargarDieta()).toBeNull()
    almacen.set(CLAVE_DIETA, JSON.stringify({ version: 1, interpretada: interpretada() }))
    expect(cargarDieta()).toBeNull()
    almacen.set(CLAVE_DIETA, JSON.stringify({ version: 1, interpretada: 'nada' }))
    expect(cargarDieta()).toBeNull()
  })

  it('descarta las piezas rotas pero conserva lo aprovechable', () => {
    almacen.set(
      CLAVE_DIETA,
      JSON.stringify({
        version: 1,
        texto: 42,
        fecha: null,
        activa: 'sí',
        interpretada: {
          comidas: [{ nombre: 'Cena', alimentos: [] }, { nombre: 7 }, null],
          gustos: [
            { texto: 'no me gusta el brócoli', tipo: 'no_gusta', alimento_ids: ['brocoli', 9] },
            { texto: 'raro', tipo: 'quizá', alimento_ids: [] },
          ],
          habitos: 'ninguno',
          notas: ['una nota', 3],
          falta_aceite: 'sí',
        },
        gustos_sumados: { excluidos: ['brocoli'], favoritos: 'no' },
      }),
    )
    const dieta = cargarDieta()
    expect(dieta).not.toBeNull()
    expect(dieta?.texto).toBe('')
    expect(dieta?.fecha).toBe('')
    // `activa: 'sí'` no es `true`: solo se activa con el booleano.
    expect(dieta?.activa).toBe(false)
    expect(dieta?.interpretada.comidas).toHaveLength(1)
    expect(dieta?.interpretada.gustos).toEqual([
      { texto: 'no me gusta el brócoli', tipo: 'no_gusta', alimento_ids: ['brocoli'] },
    ])
    expect(dieta?.interpretada.habitos).toEqual([])
    expect(dieta?.interpretada.notas).toEqual(['una nota'])
    expect(dieta?.interpretada.falta_aceite).toBe(false)
    expect(dieta?.gustos_sumados).toEqual({ excluidos: ['brocoli'], favoritos: [] })
  })

  it('`activa: false` se conserva: lo guardado sigue ahí aunque se vea el menú propuesto', () => {
    guardarDieta(guardada({ activa: false }))
    expect(cargarDieta()?.activa).toBe(false)
  })

  it('borrar se lleva también el borrador', () => {
    guardarDieta(guardada())
    guardarBorradorDieta('a medias')
    borrarDieta()
    expect(cargarDieta()).toBeNull()
    expect(cargarBorradorDieta()).toBe('')
    expect(almacen.has(CLAVE_BORRADOR_DIETA)).toBe(false)
  })
})

describe('borrador del cuadro (§5.3)', () => {
  it('guarda, recupera y se borra con la cadena vacía', () => {
    expect(cargarBorradorDieta()).toBe('')
    guardarBorradorDieta('Desayuno siempre lo mismo')
    expect(cargarBorradorDieta()).toBe('Desayuno siempre lo mismo')
    guardarBorradorDieta('')
    expect(cargarBorradorDieta()).toBe('')
  })
})

describe('sumarGustos / retirarGustos (§5.5)', () => {
  const gustos = (lista: { texto: string; tipo: 'gusta' | 'no_gusta'; ids: string[] }[]) =>
    interpretada({
      gustos: lista.map((g) => ({ texto: g.texto, tipo: g.tipo, alimento_ids: g.ids })),
    })

  it('los no_gusta van a excluidos ordenados por id y los gusta al final de favoritos', () => {
    const salida = sumarGustos(
      ['coliflor'],
      ['pollo'],
      null,
      gustos([
        { texto: 'no me gusta el brócoli', tipo: 'no_gusta', ids: ['brocoli', 'acelga'] },
        { texto: 'me encanta el salmón', tipo: 'gusta', ids: ['salmon', 'aguacate'] },
      ]),
    )
    expect(salida.excluidos).toEqual(['coliflor', 'acelga', 'brocoli'])
    expect(salida.favoritos).toEqual(['pollo', 'salmon', 'aguacate'])
    expect(salida.gustos_sumados).toEqual({
      excluidos: ['acelga', 'brocoli'],
      favoritos: ['salmon', 'aguacate'],
    })
  })

  it('un id en gusta y en no_gusta cuenta solo como no_gusta', () => {
    const salida = sumarGustos(
      [],
      [],
      null,
      gustos([
        { texto: 'me gusta el atún', tipo: 'gusta', ids: ['atun'] },
        { texto: 'ya no como atún', tipo: 'no_gusta', ids: ['atun'] },
      ]),
    )
    expect(salida.excluidos).toEqual(['atun'])
    expect(salida.favoritos).toEqual([])
    expect(salida.gustos_sumados.favoritos).toEqual([])
  })

  it('lo que acaba excluido sale de favoritos', () => {
    const salida = sumarGustos(
      [],
      ['brocoli', 'pollo'],
      null,
      gustos([{ texto: 'no me gusta el brócoli', tipo: 'no_gusta', ids: ['brocoli'] }]),
    )
    expect(salida.excluidos).toEqual(['brocoli'])
    expect(salida.favoritos).toEqual(['pollo'])
  })

  it('no apunta como suyo lo que el usuario ya había marcado a mano', () => {
    const salida = sumarGustos(
      ['brocoli'],
      ['salmon'],
      null,
      gustos([
        { texto: 'no me gusta el brócoli', tipo: 'no_gusta', ids: ['brocoli'] },
        { texto: 'me encanta el salmón', tipo: 'gusta', ids: ['salmon'] },
      ]),
    )
    expect(salida.excluidos).toEqual(['brocoli'])
    expect(salida.favoritos).toEqual(['salmon'])
    expect(salida.gustos_sumados).toEqual({ excluidos: [], favoritos: [] })
    // Y al retirar no se lleva por delante lo marcado a mano.
    const limpio = retirarGustos(salida.excluidos, salida.favoritos, salida.gustos_sumados)
    expect(limpio).toEqual({ excluidos: ['brocoli'], favoritos: ['salmon'] })
  })

  it('reinterpretar retira lo del audio anterior antes de sumar lo nuevo', () => {
    const primera = sumarGustos(
      ['coliflor'],
      ['pollo'],
      null,
      gustos([
        { texto: 'no me gusta el brócoli', tipo: 'no_gusta', ids: ['brocoli'] },
        { texto: 'me encanta el salmón', tipo: 'gusta', ids: ['salmon'] },
      ]),
    )
    const segunda = sumarGustos(
      primera.excluidos,
      primera.favoritos,
      primera.gustos_sumados,
      gustos([{ texto: 'no me gustan las acelgas', tipo: 'no_gusta', ids: ['acelga'] }]),
    )
    expect(segunda.excluidos).toEqual(['coliflor', 'acelga'])
    expect(segunda.favoritos).toEqual(['pollo'])
    expect(segunda.gustos_sumados).toEqual({ excluidos: ['acelga'], favoritos: [] })
  })

  it('los ids repetidos entre gustos no se duplican', () => {
    const salida = sumarGustos(
      [],
      [],
      null,
      gustos([
        { texto: 'no me gusta el pescado', tipo: 'no_gusta', ids: ['merluza', 'salmon'] },
        { texto: 'ni la merluza', tipo: 'no_gusta', ids: ['merluza'] },
      ]),
    )
    expect(salida.excluidos).toEqual(['merluza', 'salmon'])
  })

  it('retirarGustos sin nada previo devuelve copias, no las mismas listas', () => {
    const excluidos = ['a']
    const salida = retirarGustos(excluidos, [], null)
    expect(salida.excluidos).toEqual(['a'])
    expect(salida.excluidos).not.toBe(excluidos)
  })
})
