// Persistencia local de lo que la persona nos contó, suma de gustos al paso 14 y la propuesta
// de la IA (SPEC-dieta-propia §5.5 y §4bis.4).

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DietaInterpretada } from '../../engine/types'
import type { HuecoPropuesta } from '../api'
import {
  CLAVE_BORRADOR_DIETA,
  CLAVE_DIETA,
  type DietaGuardada,
  type PropuestaGuardada,
  VERSION_DIETA,
  borrarDieta,
  borrarPropuesta,
  cargarBorradorDieta,
  cargarDieta,
  claveHuecos,
  guardarBorradorDieta,
  guardarDieta,
  guardarPropuesta,
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

// ---- Propuesta de la IA (§4bis.4) ----------------------------------------

function hueco(nombre: string, kcal: number, prot: number): HuecoPropuesta {
  return {
    nombre,
    hora: '14:00',
    peri: false,
    objetivo: { kcal, prot, carb: 62, fat: 20 },
    sin_hidratos: false,
  }
}

function propuestaGuardada(parcial: Partial<PropuestaGuardada> = {}): PropuestaGuardada {
  return {
    variante: 0,
    huecos_clave: claveHuecos([hueco('Comida', 620, 48)]),
    propuesta: {
      comidas: [{ nombre: 'Comida', alimentos: [] }],
      consejo: 'Te falta fibra.',
      preguntas: [{ texto: '¿Metemos verdura?', opciones: ['No', 'Sí'] }],
    },
    respuestas: [{ pregunta: '¿Metemos verdura?', respuesta: 'Solo en la cena' }],
    ...parcial,
  }
}

describe('claveHuecos (§4bis.4)', () => {
  it('la misma lista da la misma clave', () => {
    const huecos = [hueco('Comida', 620, 48), hueco('Cena', 500, 40)]
    expect(claveHuecos(huecos)).toBe(claveHuecos([...huecos]))
  })

  it('no depende del orden en que estén escritas las propiedades', () => {
    const uno: HuecoPropuesta = {
      nombre: 'Comida',
      hora: '14:00',
      peri: false,
      objetivo: { kcal: 620, prot: 48, carb: 62, fat: 20 },
      sin_hidratos: false,
    }
    const otro = {
      sin_hidratos: false,
      objetivo: { fat: 20, carb: 62, prot: 48, kcal: 620 },
      peri: false,
      hora: '14:00',
      nombre: 'Comida',
    } as HuecoPropuesta
    expect(claveHuecos([otro])).toBe(claveHuecos([uno]))
  })

  it('cambia con el nombre, con las kcal y con los macros', () => {
    const base = claveHuecos([hueco('Comida', 620, 48)])
    expect(claveHuecos([hueco('Cena', 620, 48)])).not.toBe(base)
    expect(claveHuecos([hueco('Comida', 700, 48)])).not.toBe(base)
    expect(claveHuecos([hueco('Comida', 620, 52)])).not.toBe(base)
  })

  it('redondea: kcal enteras y macros con un decimal', () => {
    expect(claveHuecos([hueco('Comida', 620.4, 48.04)])).toBe(
      claveHuecos([hueco('Comida', 620, 48)]),
    )
    expect(claveHuecos([hueco('Comida', 620, 48.06)])).not.toBe(
      claveHuecos([hueco('Comida', 620, 48)]),
    )
  })

  it('el orden de los huecos sí cuenta: es otro reparto', () => {
    expect(claveHuecos([hueco('Comida', 620, 48), hueco('Cena', 500, 40)])).not.toBe(
      claveHuecos([hueco('Cena', 500, 40), hueco('Comida', 620, 48)]),
    )
  })

  it('sin huecos da una clave válida y estable', () => {
    expect(claveHuecos([])).toBe('[]')
  })
})

describe('propuesta guardada (§4bis.4)', () => {
  it('guarda y recupera la propuesta entera', () => {
    const dieta = guardada({ propuesta: propuestaGuardada() })
    guardarDieta(dieta)
    expect(cargarDieta()).toEqual(dieta)
  })

  it('una dieta sin propuesta se lee sin el campo (compatibilidad con lo ya guardado)', () => {
    guardarDieta(guardada())
    const leida = cargarDieta()
    expect(leida).not.toBeNull()
    expect('propuesta' in (leida as DietaGuardada)).toBe(false)
  })

  it('tolera basura: la propuesta se descarta pero la dieta sobrevive', () => {
    for (const basura of [7, 'no', null, {}, { propuesta: { comidas: [] } }]) {
      window.localStorage.setItem(CLAVE_DIETA, JSON.stringify({ ...guardada(), propuesta: basura }))
      const leida = cargarDieta()
      expect(leida?.texto).toBe('Desayuno 250 g de kéfir')
      expect(leida?.propuesta).toBeUndefined()
    }
  })

  it('sanea variante, consejo, preguntas y respuestas', () => {
    window.localStorage.setItem(
      CLAVE_DIETA,
      JSON.stringify({
        ...guardada(),
        propuesta: {
          variante: 99.6,
          huecos_clave: 7,
          propuesta: {
            comidas: [
              { nombre: 'Comida', alimentos: [] },
              { nombre: 42, alimentos: [] },
              { nombre: 'Cena' },
            ],
            consejo: '',
            preguntas: [
              { texto: 'una', opciones: ['a', 'b'] },
              { texto: 'sin opciones', opciones: [] },
              { texto: 'dos', opciones: ['c', 'd'] },
              { texto: 'tres', opciones: ['e', 'f'] },
            ],
          },
          respuestas: [
            { pregunta: 'p1', respuesta: 'r1' },
            { pregunta: 'p2', respuesta: 7 },
            { pregunta: 'p3', respuesta: 'r3' },
            { pregunta: 'p4', respuesta: 'r4' },
            { pregunta: 'p5', respuesta: 'r5' },
            { pregunta: 'p6', respuesta: 'r6' },
          ],
        },
      }),
    )
    const leida = cargarDieta()?.propuesta
    expect(leida?.variante).toBe(20)
    expect(leida?.huecos_clave).toBe('')
    expect(leida?.propuesta.comidas).toEqual([{ nombre: 'Comida', alimentos: [] }])
    expect(leida?.propuesta.consejo).toBeNull()
    expect(leida?.propuesta.preguntas.map((p) => p.texto)).toEqual(['una', 'dos'])
    expect(leida?.respuestas.map((r) => r.pregunta)).toEqual(['p1', 'p3', 'p4', 'p5'])
  })

  it('una clave de huecos ilegible no se reutiliza: queda vacía y nunca coincide', () => {
    window.localStorage.setItem(
      CLAVE_DIETA,
      JSON.stringify({ ...guardada(), propuesta: { ...propuestaGuardada(), huecos_clave: null } }),
    )
    expect(cargarDieta()?.propuesta?.huecos_clave).not.toBe(claveHuecos([hueco('Comida', 620, 48)]))
  })

  it('guardarPropuesta la mete en la dieta guardada y devuelve la dieta nueva', () => {
    guardarDieta(guardada())
    const nueva = guardarPropuesta(propuestaGuardada())
    expect(nueva?.propuesta).toEqual(propuestaGuardada())
    expect(cargarDieta()?.propuesta).toEqual(propuestaGuardada())
  })

  it('guardarPropuesta respeta la dieta que le pasan y sin dieta guardada devuelve null', () => {
    expect(guardarPropuesta(propuestaGuardada())).toBeNull()
    const enMano = guardada({ texto: 'lo más fresco que hay' })
    const nueva = guardarPropuesta(propuestaGuardada(), enMano)
    expect(nueva?.texto).toBe('lo más fresco que hay')
    expect(cargarDieta()?.texto).toBe('lo más fresco que hay')
  })

  it('borrarPropuesta deja la dieta sin el campo', () => {
    guardarDieta(guardada({ propuesta: propuestaGuardada() }))
    const nueva = borrarPropuesta()
    expect(nueva?.propuesta).toBeUndefined()
    expect(cargarDieta()?.propuesta).toBeUndefined()
    expect(cargarDieta()?.texto).toBe('Desayuno 250 g de kéfir')
  })

  it('borrarPropuesta sin nada que borrar no rompe', () => {
    expect(borrarPropuesta()).toBeNull()
    guardarDieta(guardada())
    expect(borrarPropuesta()?.propuesta).toBeUndefined()
  })

  it('reinterpretar descarta la propuesta anterior', () => {
    guardarDieta(guardada({ propuesta: propuestaGuardada() }))
    // Lo que hace `interpretacionNueva` en App.tsx: una `DietaGuardada` nueva, sin arrastrar nada.
    guardarDieta({
      version: VERSION_DIETA,
      texto: 'Ahora desayuno tostadas',
      interpretada: interpretada({ comidas: [{ nombre: 'Desayuno', alimentos: [] }] }),
      fecha: '2026-09-13',
      activa: true,
      gustos_sumados: { excluidos: [], favoritos: [] },
    })
    expect(cargarDieta()?.propuesta).toBeUndefined()
    expect(cargarDieta()?.texto).toBe('Ahora desayuno tostadas')
  })
})
