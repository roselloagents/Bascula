// El contexto que viaja a `/api/dieta/proponer` (SPEC-dieta-propia §4bis.1) y, sobre todo, lo que
// NO viaja (§7). Todo es puro: aquí no hay red ni `localStorage`.

import { describe, expect, it } from 'vitest'
import type {
  AlimentoAjustado,
  ComidaCompuesta,
  DiaCompuesto,
  DietaInterpretada,
  Inputs,
  MacrosPropio,
} from '../../engine/types'
import type { DietaGuardada, PropuestaGuardada } from '../almacen'
import { LINEA_MAX, contextoParaProponer } from '../contexto'

const CERO: MacrosPropio = { kcal: 0, prot: 0, carb: 0, fat: 0, fibra: 0, alcohol: 0 }

function alimento(nombre: string, gramosAjustados: number): AlimentoAjustado {
  return {
    texto: `${gramosAjustados} g de ${nombre}`,
    nombre,
    alimento_id: null,
    estado: 'listo',
    grupo_aprox: 'otro',
    gramos: gramosAjustados === 0 ? null : gramosAjustados,
    macros_100g: CERO,
    origen_macros: 'estimado',
    ajustable: true,
    confianza: 'alta',
    estado_ajuste: gramosAjustados === 0 ? 'pendiente' : 'variable',
    gramos_ajustados: gramosAjustados,
    delta_g: 0,
    cambio: 'igual',
    factor: 1,
    en_limite: 'no',
    aporte: CERO,
  }
}

function comida(
  nombre: string,
  origen: ComidaCompuesta['origen'],
  alimentos: AlimentoAjustado[],
): ComidaCompuesta {
  return {
    nombre,
    hora: '14:00',
    peri: false,
    origen,
    objetivo: { kcal: 620, prot: 48, carb: 62, fat: 20 },
    alimentos,
    ejemplo: null,
    totales: CERO,
    pct_kcal: 30,
  }
}

function compuestoDe(comidas: ComidaCompuesta[]): DiaCompuesto {
  return {
    modo: 'parcial',
    comidas,
    totales: CERO,
    objetivo: { kcal: 2000, prot: 150, carb: 200, fat: 70 },
    desvio: { kcal: 0, prot: 0, carb: 0, fat: 0 },
    avisos: [],
    aplicado: [],
    apuntado: [],
    pendientes: [],
    no_entendido: [],
    notas: [],
    n_variables: 0,
    provisional: false,
  }
}

function interpretada(parcial: Partial<DietaInterpretada> = {}): DietaInterpretada {
  return {
    comidas: [],
    gustos: [{ texto: 'no me gusta el brócoli', tipo: 'no_gusta', alimento_ids: ['brocoli'] }],
    habitos: [{ texto: 'ceno sin hidratos', tipo: 'sin_hidratos', comida: 'Cena', valor: null }],
    no_entendido: [],
    notas: [],
    falta_aceite: false,
    ...parcial,
  }
}

function dietaDe(parcial: Partial<DietaGuardada> = {}): DietaGuardada {
  return {
    version: 1,
    texto: '  Desayuno siempre 250 g de kéfir con 25 g de almendras.  ',
    interpretada: interpretada(),
    fecha: '2026-09-12',
    activa: true,
    gustos_sumados: { excluidos: [], favoritos: [] },
    ...parcial,
  }
}

/** `Inputs` con todo lo que el cuestionario sabe de la persona: nada de esto puede viajar. */
function inputsDe(parcial: Partial<Inputs> = {}): Inputs {
  return {
    sexo: 'mujer',
    edad: 41,
    altura_cm: 163,
    peso_kg: 71.5,
    grasa: { metodo: 'visual', categoria: 'medio' },
    somatotipo: null,
    actividad_diaria: 'moderado',
    entrenamiento: {
      tipo: 'fuerza',
      dias_semana: 4,
      minutos_sesion: 60,
      intensidad: 'media',
      experiencia: 'intermedio',
      momento: 'tarde',
    },
    objetivo: 'perder',
    ritmo: 'moderado',
    peso_objetivo: 65,
    preferencia: 'omnivoro',
    n_comidas: 4,
    clima_caluroso: false,
    embarazo_lactancia: false,
    condiciones: [],
    cribado_tca: 'negativo',
    fecha_inicio: '2026-09-07',
    ...parcial,
  }
}

const COMPUESTO = compuestoDe([
  comida('Desayuno', 'propia', [alimento('Kéfir natural entero', 250), alimento('Almendras', 25)]),
  comida('Comida', 'propuesta', []),
])

describe('contextoParaProponer (§4bis.1)', () => {
  it('monta el contexto entero: texto, comidas dictadas, gustos, hábitos y perfil', () => {
    const contexto = contextoParaProponer(dietaDe(), inputsDe(), COMPUESTO)
    expect(contexto.texto).toBe('Desayuno siempre 250 g de kéfir con 25 g de almendras.')
    expect(contexto.comidas_propias).toEqual([
      { nombre: 'Desayuno', alimentos: ['Kéfir natural entero 250 g', 'Almendras 25 g'] },
    ])
    expect(contexto.gustos).toEqual(interpretada().gustos)
    expect(contexto.habitos).toEqual(interpretada().habitos)
    expect(contexto.menu_sencillo).toBe(false)
    expect(contexto.condiciones).toEqual([])
    expect(contexto.respuestas).toEqual([])
    expect(contexto.variante).toBe(0)
  })

  it('solo viajan las comidas dictadas, no los huecos montados', () => {
    const contexto = contextoParaProponer(dietaDe(), inputsDe(), COMPUESTO)
    expect(contexto.comidas_propias.map((c) => c.nombre)).toEqual(['Desayuno'])
  })

  it('un alimento pendiente va sin gramos: "0 g" sería mentira', () => {
    const compuesto = compuestoDe([
      comida('Cena', 'propia', [alimento('Merluza', 0), alimento('Aceite de oliva', 10)]),
    ])
    const contexto = contextoParaProponer(dietaDe(), inputsDe(), compuesto)
    expect(contexto.comidas_propias[0].alimentos).toEqual(['Merluza', 'Aceite de oliva 10 g'])
  })

  it('respeta los topes de §4bis.1: 8 comidas, 15 líneas y 60 caracteres por línea', () => {
    const muchos = Array.from({ length: 20 }, (_, i) => alimento(`Alimento ${i}`, 100))
    const compuesto = compuestoDe(
      Array.from({ length: 10 }, (_, i) => comida(`Comida ${i}`, 'propia', muchos)),
    )
    const contexto = contextoParaProponer(dietaDe(), inputsDe(), compuesto)
    expect(contexto.comidas_propias).toHaveLength(8)
    expect(contexto.comidas_propias[0].alimentos).toHaveLength(15)

    const largo = compuestoDe([
      comida('Cena', 'propia', [alimento('Nombre larguísimo '.repeat(8), 100)]),
    ])
    const linea = contextoParaProponer(dietaDe(), inputsDe(), largo).comidas_propias[0].alimentos[0]
    expect(linea.length).toBeLessThanOrEqual(LINEA_MAX)
  })

  it('una comida dictada sin alimentos no ocupa sitio', () => {
    const compuesto = compuestoDe([comida('Desayuno', 'propia', [])])
    expect(contextoParaProponer(dietaDe(), inputsDe(), compuesto).comidas_propias).toEqual([])
  })
})

describe('perfil: la regla de traducción de SPEC-calculo §1.1', () => {
  it('con preferencia_base manda el paso 13 y `preferencia` no se lee', () => {
    const inputs = inputsDe({
      preferencia: 'low_carb',
      preferencia_base: 'vegetariano',
      restricciones: ['sin_gluten'],
      low_carb: false,
      alimentos_excluidos: ['brocoli'],
      alimentos_favoritos: ['salmon', 'pollo_pechuga'],
    })
    expect(contextoParaProponer(dietaDe(), inputs, COMPUESTO).perfil).toEqual({
      base: 'vegetariano',
      restricciones: ['sin_gluten'],
      low_carb: false,
      excluidos: ['brocoli'],
      favoritos: ['salmon', 'pollo_pechuga'],
    })
  })

  it('sin preferencia_base se traduce la preferencia única', () => {
    const perfilDe = (preferencia: Inputs['preferencia']) =>
      contextoParaProponer(dietaDe(), inputsDe({ preferencia }), COMPUESTO).perfil
    expect(perfilDe('sin_lactosa')).toMatchObject({
      base: 'omnivoro',
      restricciones: ['sin_lactosa'],
      low_carb: false,
    })
    expect(perfilDe('vegano')).toMatchObject({ base: 'vegano', restricciones: [], low_carb: false })
    expect(perfilDe('low_carb')).toMatchObject({
      base: 'omnivoro',
      restricciones: [],
      low_carb: true,
    })
  })

  it('las dos listas del paso 14 van sin repetidos y en su orden', () => {
    const inputs = inputsDe({
      alimentos_excluidos: ['brocoli', 'brocoli', ''],
      alimentos_favoritos: ['salmon', 'kefir', 'salmon'],
    })
    const perfil = contextoParaProponer(dietaDe(), inputs, COMPUESTO).perfil
    expect(perfil.excluidos).toEqual(['brocoli'])
    expect(perfil.favoritos).toEqual(['salmon', 'kefir'])
  })
})

describe('condiciones y menú sencillo', () => {
  it('solo viajan diabetes, cardiaca e hipertension, en orden fijo', () => {
    const inputs = inputsDe({
      condiciones: ['hipertension', 'renal', 'tca', 'diabetes', 'glp1'],
      menu_sencillo: true,
    })
    const contexto = contextoParaProponer(dietaDe(), inputs, COMPUESTO)
    expect(contexto.condiciones).toEqual(['diabetes', 'hipertension'])
    expect(contexto.menu_sencillo).toBe(true)
  })
})

describe('variante y respuestas (§4bis.5)', () => {
  const propuesta: PropuestaGuardada = {
    variante: 2,
    huecos_clave: '[]',
    propuesta: { comidas: [], consejo: null, preguntas: [] },
    respuestas: [{ pregunta: '¿Metemos verdura?', respuesta: 'Solo en la cena' }],
  }

  it('salen de la propuesta guardada', () => {
    const contexto = contextoParaProponer(dietaDe({ propuesta }), inputsDe(), COMPUESTO)
    expect(contexto.variante).toBe(2)
    expect(contexto.respuestas).toEqual(propuesta.respuestas)
  })

  it('"Otra propuesta" manda la variante que se le pase, acotada a 0–20', () => {
    const dieta = dietaDe({ propuesta })
    expect(contextoParaProponer(dieta, inputsDe(), COMPUESTO, 3).variante).toBe(3)
    expect(contextoParaProponer(dieta, inputsDe(), COMPUESTO, 99).variante).toBe(20)
    expect(contextoParaProponer(dieta, inputsDe(), COMPUESTO, -1).variante).toBe(0)
    expect(contextoParaProponer(dieta, inputsDe(), COMPUESTO, Number.NaN).variante).toBe(0)
  })

  it('las respuestas se recortan a cuatro y a 200 caracteres', () => {
    const muchas = Array.from({ length: 6 }, (_, i) => ({
      pregunta: `p${i}`,
      respuesta: 'a'.repeat(300),
    }))
    const contexto = contextoParaProponer(
      dietaDe({ propuesta: { ...propuesta, respuestas: muchas } }),
      inputsDe(),
      COMPUESTO,
    )
    expect(contexto.respuestas).toHaveLength(4)
    expect(contexto.respuestas[0].respuesta).toHaveLength(200)
  })
})

describe('privacidad (§7): qué NO viaja', () => {
  it('el contexto tiene exactamente las nueve claves del contrato', () => {
    const contexto = contextoParaProponer(dietaDe(), inputsDe(), COMPUESTO)
    expect(Object.keys(contexto).sort()).toEqual(
      [
        'comidas_propias',
        'condiciones',
        'gustos',
        'habitos',
        'menu_sencillo',
        'perfil',
        'respuestas',
        'texto',
        'variante',
      ].sort(),
    )
  })

  it('no lleva sexo, edad, peso, altura, objetivo ni kcal totales', () => {
    const inputs = inputsDe({ condiciones: ['diabetes', 'renal', 'tca'], menu_sencillo: true })
    const cuerpo = JSON.stringify(contextoParaProponer(dietaDe(), inputs, COMPUESTO))
    for (const prohibido of [
      'sexo',
      'edad',
      'altura',
      'peso',
      'kcal',
      'grasa',
      'entrenamiento',
      'actividad',
      'ritmo',
      'objetivo',
      'fecha_inicio',
      'embarazo',
      'menstruacion',
      'cribado',
      'renal',
      'tca',
    ]) {
      expect(cuerpo).not.toContain(prohibido)
    }
    expect(cuerpo).not.toContain('41')
    expect(cuerpo).not.toContain('163')
    expect(cuerpo).not.toContain('71.5')
  })
})
