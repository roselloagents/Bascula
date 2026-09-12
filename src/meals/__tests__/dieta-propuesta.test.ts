// Huecos propuestos por la IA y cuadrados por el algoritmo (docs/SPEC-dieta-propia.md §4bis.6).
//
// El modelo elige y describe; los números los pone el solver de §4.2. Todo lo de aquí es puro y
// determinista: ninguna aserción depende de la fecha, del azar ni del orden de un `Set`.
import { describe, expect, it } from 'vitest'
import type { ComidaCompuesta, ComidaPropia, DiaCompuesto, PropuestaIA } from '../../engine/types'
import { alimentoPorId } from '../../data/foods'
import { compraDeDia, componerDia, huecosParaProponer } from '../index'
import { cajaDe } from '../dieta/ajuste'
import {
  DESAYUNO_SOLO,
  DIAS_COMPUESTOS,
  DIAS_CON_PROPUESTA,
  DIA_COMPLETO,
  PLAN_1780,
  PROPUESTA_IA_CONTEXTO,
  PROPUESTA_IA_PARCIAL,
  SOLO_CONTEXTO,
  delCatalogo,
  fixtureDieta,
  planDieta,
} from './dieta-fixtures'

const CONTEXTO = fixtureDieta('solo_contexto')

const codigos = (dia: DiaCompuesto): string[] => dia.avisos.map((a) => a.codigo)
const origenes = (dia: DiaCompuesto): string[] => dia.comidas.map((c) => c.origen)
const deIa = (dia: DiaCompuesto): ComidaCompuesta[] =>
  dia.comidas.filter((c) => c.origen === 'propuesta_ia')

/** La misma propuesta con una comida cambiada: los fixtures no se tocan. */
function con(propuesta: PropuestaIA, comida: ComidaPropia): PropuestaIA {
  return {
    ...propuesta,
    comidas: propuesta.comidas.map((c) => (c.nombre === comida.nombre ? comida : c)),
  }
}

/** Una comida que no puede cuadrar con ningún objetivo razonable: 100 g de tomate. */
const RIDICULA = (nombre: string): ComidaPropia => ({
  nombre,
  alimentos: [delCatalogo('tomate', 100, 'Tomate')],
})

describe('§4bis.3 — cada hueco propuesto se cuadra con el solver de §4.2', () => {
  const dia = DIAS_CON_PROPUESTA.desayuno_solo

  it('conserva la comida dictada y monta los dos huecos con la propuesta', () => {
    expect(dia.modo).toBe('parcial')
    expect(origenes(dia)).toEqual(['propia', 'propuesta_ia', 'propuesta_ia'])
    expect(dia.comidas.map((c) => c.nombre)).toEqual(['Desayuno', 'Comida', 'Cena'])
    expect(dia.origen_huecos).toBe('ia')
  })

  it('deja los alimentos como AlimentoAjustado y el ejemplo a null (§4bis.3)', () => {
    for (const c of deIa(dia)) {
      expect(c.ejemplo).toBeNull()
      expect(c.alimentos.length).toBeGreaterThan(0)
      for (const a of c.alimentos) {
        expect(a.estado_ajuste, a.nombre).not.toBe('pendiente')
        expect(a.aporte.kcal, a.nombre).toBeCloseTo((a.macros_100g.kcal * a.gramos_ajustados) / 100)
      }
    }
    // Ningún hueco propuesto deja pendientes: la fila no tiene "Cambiar" con la que completarlos.
    expect(dia.pendientes.every((p) => p.comida === 'Desayuno')).toBe(true)
  })

  it('respeta la caja de §4.2.2 y la rejilla de §4.2.6 en cada alimento propuesto', () => {
    for (const c of deIa(dia)) {
      for (const a of c.alimentos) {
        if (a.estado_ajuste !== 'variable') {
          expect(a.gramos_ajustados, a.nombre).toBe(a.gramos)
          continue
        }
        const v = cajaDe(a)
        expect(a.gramos_ajustados, a.nombre).toBeGreaterThanOrEqual(v.loRed)
        expect(a.gramos_ajustados, a.nombre).toBeLessThanOrEqual(v.hiRed)
        expect(a.factor, a.nombre).toBeGreaterThanOrEqual(0.5)
        expect(a.factor, a.nombre).toBeLessThanOrEqual(1.75)
        if (v.unidadG !== null) expect(a.gramos_ajustados % v.unidadG, a.nombre).toBe(0)
        else expect(a.gramos_ajustados % v.paso, a.nombre).toBe(0)
      }
    }
  })

  it('cierra cada hueco dentro del ±15 % en kcal y en proteína', () => {
    for (const c of deIa(dia)) {
      const T = c.objetivo!
      expect(Math.abs(c.totales.kcal - T.kcal), c.nombre).toBeLessThanOrEqual(0.15 * T.kcal)
      expect(Math.abs(c.totales.prot - T.prot), c.nombre).toBeLessThanOrEqual(0.15 * T.prot)
    }
  })

  it('el solver mueve de verdad los gramos que el modelo puso a ojo', () => {
    const movidos = deIa(dia).flatMap((c) =>
      c.alimentos.filter((a) => a.gramos_ajustados !== a.gramos),
    )
    expect(movidos.length).toBeGreaterThan(0)
    for (const a of movidos) expect(a.cambio).toBe(a.delta_g > 0 ? 'sube' : 'baja')
  })
})

describe('§4bis.3 — un hueco que no convence cae a nuestras plantillas', () => {
  it('con la cena ridícula, la cena se monta con plantillas y se apunta', () => {
    const dia = componerDia(
      DESAYUNO_SOLO,
      PLAN_1780.inputs,
      PLAN_1780.resultado,
      0,
      con(PROPUESTA_IA_PARCIAL, RIDICULA('Cena')),
    )
    expect(origenes(dia)).toEqual(['propia', 'propuesta_ia', 'propuesta'])
    expect(dia.origen_huecos).toBe('mixto')
    expect(dia.apuntado).toContain(
      'Para Cena no nos ha convencido la propuesta y hemos usado la nuestra.',
    )
    // La que sí convenció no se apunta.
    expect(dia.apuntado).not.toContain(
      'Para Comida no nos ha convencido la propuesta y hemos usado la nuestra.',
    )
    const cena = dia.comidas[2]
    expect(cena.ejemplo).not.toBeNull()
    expect(cena.alimentos).toEqual([])
  })

  it('un hueco vacío tampoco convence', () => {
    const dia = componerDia(DESAYUNO_SOLO, PLAN_1780.inputs, PLAN_1780.resultado, 0, {
      ...PROPUESTA_IA_PARCIAL,
      comidas: [{ nombre: 'Comida', alimentos: [] }, PROPUESTA_IA_PARCIAL.comidas[1]],
    })
    expect(origenes(dia)).toEqual(['propia', 'propuesta', 'propuesta_ia'])
    expect(dia.origen_huecos).toBe('mixto')
  })

  it('la comida montada con plantillas cuadra con su objetivo, como siempre', () => {
    const dia = componerDia(
      DESAYUNO_SOLO,
      PLAN_1780.inputs,
      PLAN_1780.resultado,
      0,
      con(PROPUESTA_IA_PARCIAL, RIDICULA('Cena')),
    )
    const sinIa = componerDia(DESAYUNO_SOLO, PLAN_1780.inputs, PLAN_1780.resultado)
    // El respaldo es EXACTAMENTE el menú de siempre: montar el día entero y quedarse con el hueco
    // que hace falta, no montar uno suelto con otro reparto de plantillas.
    expect(dia.comidas[2].ejemplo).toEqual(sinIa.comidas[2].ejemplo)
  })
})

describe('§4bis.3 — origen_huecos en los tres casos', () => {
  it('ia cuando todos los huecos son del modelo', () => {
    expect(DIAS_CON_PROPUESTA.desayuno_solo.origen_huecos).toBe('ia')
    expect(DIAS_CON_PROPUESTA.solo_contexto.origen_huecos).toBe('ia')
  })

  it('plantillas cuando no convence ninguno', () => {
    const dia = componerDia(DESAYUNO_SOLO, PLAN_1780.inputs, PLAN_1780.resultado, 0, {
      comidas: [RIDICULA('Comida'), RIDICULA('Cena')],
      consejo: null,
      preguntas: [],
    })
    expect(origenes(dia)).toEqual(['propia', 'propuesta', 'propuesta'])
    expect(dia.origen_huecos).toBe('plantillas')
    expect(dia.apuntado).toEqual([
      'Para Comida no nos ha convencido la propuesta y hemos usado la nuestra.',
      'Para Cena no nos ha convencido la propuesta y hemos usado la nuestra.',
    ])
  })

  it('mixto cuando uno cae y otro no', () => {
    const dia = componerDia(
      DESAYUNO_SOLO,
      PLAN_1780.inputs,
      PLAN_1780.resultado,
      0,
      con(PROPUESTA_IA_PARCIAL, RIDICULA('Comida')),
    )
    expect(dia.origen_huecos).toBe('mixto')
  })

  it('null cuando no hay ningún hueco que montar (día completo dictado)', () => {
    const dia = componerDia(DIA_COMPLETO, PLAN_1780.inputs, PLAN_1780.resultado, 0, {
      comidas: [],
      consejo: null,
      preguntas: [],
    })
    expect(dia.modo).toBe('completa')
    expect(dia.origen_huecos).toBeNull()
  })
})

describe('§4bis.3 — propuesta con menos huecos de los pedidos', () => {
  it('el hueco que falta se monta con plantillas y los demás se cuadran igual', () => {
    const dia = componerDia(DESAYUNO_SOLO, PLAN_1780.inputs, PLAN_1780.resultado, 0, {
      ...PROPUESTA_IA_PARCIAL,
      comidas: [PROPUESTA_IA_PARCIAL.comidas[1]], // solo la Cena
    })
    expect(origenes(dia)).toEqual(['propia', 'propuesta', 'propuesta_ia'])
    expect(dia.apuntado).toContain(
      'Para Comida no nos ha convencido la propuesta y hemos usado la nuestra.',
    )
    // Emparejado por NOMBRE: la única comida de la propuesta es la Cena y ahí es donde entra.
    expect(dia.comidas[2].alimentos.map((a) => a.alimento_id)).toEqual([
      'merluza',
      'patata_cocida',
      'tomate',
      'aove',
    ])
  })
})

describe('§4bis.3 — la propuesta trae algo excluido', () => {
  const conBrocoli = con(PROPUESTA_IA_CONTEXTO, {
    nombre: 'Comida',
    alimentos: [
      delCatalogo('salmon', 200, 'Salmón'),
      delCatalogo('arroz_integral_cocido', 300, 'Arroz integral'),
      delCatalogo('brocoli', 150, 'Brócoli'),
      delCatalogo('aove', 5, 'Aceite de oliva'),
    ],
  })
  const dia = componerDia(SOLO_CONTEXTO, CONTEXTO.inputs, CONTEXTO.resultado, 0, conBrocoli)

  it('se cuadra igual: el hueco sigue siendo de la IA', () => {
    expect(origenes(dia)).toEqual(['propuesta_ia', 'propuesta_ia', 'propuesta_ia'])
    expect(dia.comidas[1].alimentos.map((a) => a.alimento_id)).toContain('brocoli')
  })

  it('pero se apunta, con el nombre del alimento y el de la comida', () => {
    expect(dia.apuntado).toContain(
      'La propuesta de Comida trae brócoli, que no querías: pide «Otra propuesta» si prefieres cambiarla.',
    )
  })
})

describe('§4bis.3 — modo solo contexto con propuesta para todos los huecos', () => {
  const dia = DIAS_CON_PROPUESTA.solo_contexto

  it('monta el día entero con la IA', () => {
    expect(dia.modo).toBe('solo_contexto')
    expect(origenes(dia)).toEqual(['propuesta_ia', 'propuesta_ia', 'propuesta_ia'])
    expect(dia.origen_huecos).toBe('ia')
    expect(dia.n_variables).toBe(0)
    expect(dia.provisional).toBe(false)
  })

  it('la cena propuesta cumple la promesa "sin hidratos" y la costumbre se queda en aplicado', () => {
    const cena = dia.comidas[2]
    expect(cena.sin_hidratos).toBe(true)
    const grupos = cena.alimentos.map((a) =>
      a.alimento_id ? alimentoPorId(a.alimento_id)?.grupo : a.grupo_aprox,
    )
    expect(grupos).not.toContain('carbohidrato')
    expect(dia.aplicado).toEqual(['Sin brócoli', 'Favorito: salmón', 'Cena sin hidratos'])
    expect(dia.apuntado).toEqual([])
  })

  it('si la cena propuesta trae guarnición, la promesa pasa a apuntado (§4.5)', () => {
    const conArroz = con(PROPUESTA_IA_CONTEXTO, {
      nombre: 'Cena',
      alimentos: [
        delCatalogo('pechuga_pollo', 200, 'Pechuga de pollo'),
        delCatalogo('arroz_blanco_cocido', 120, 'Arroz blanco'),
        delCatalogo('aove', 10, 'Aceite de oliva'),
      ],
    })
    const otro = componerDia(SOLO_CONTEXTO, CONTEXTO.inputs, CONTEXTO.resultado, 0, conArroz)
    expect(otro.comidas[2].origen).toBe('propuesta_ia')
    expect(otro.aplicado).not.toContain('Cena sin hidratos')
    expect(otro.apuntado).toContain(
      '«ceno sin hidratos»: no lo aplicamos porque esa comida se quedaría demasiado pequeña; cuéntanos también otra comida y lo movemos',
    )
    // Pero la siguiente propuesta SÍ tiene que pedir la cena sin hidratos: la costumbre se retiró
    // de "aplicado" porque el plato la rompía, no porque haya dejado de aplicarse al objetivo.
    expect(huecosParaProponer(otro)[2].sin_hidratos).toBe(true)
  })

  it('no arrastra las notas del generador de los huecos que no se enseñan', () => {
    expect(dia.notas).toEqual([])
  })
})

describe('§4bis.3 — las notas del generador son las de los huecos que se ven', () => {
  // Un plan muy grande parte cada hueco montado en dos platos, y eso deja una nota por hueco.
  const PLAN = planDieta({ kcal: 3400, prot: 220, carb: 420, fat: 100 })
  const COMIDA_GRANDE: ComidaPropia = {
    nombre: 'Comida',
    alimentos: [
      delCatalogo('pechuga_pollo', 300, 'Pechuga de pollo'),
      delCatalogo('arroz_blanco_crudo', 200, 'Arroz blanco'),
      delCatalogo('judia_verde', 200, 'Judía verde'),
      delCatalogo('aove', 20, 'Aceite de oliva'),
    ],
  }
  const sinIa = componerDia(DESAYUNO_SOLO, PLAN.inputs, PLAN.resultado)

  it('sin propuesta, el generador avisa de los dos huecos', () => {
    expect(sinIa.notas).toHaveLength(2)
    expect(sinIa.notas[0]).toContain('Comida:')
    expect(sinIa.notas[1]).toContain('Cena:')
  })

  it('con la Comida propuesta por la IA, solo queda la nota de la Cena', () => {
    const dia = componerDia(DESAYUNO_SOLO, PLAN.inputs, PLAN.resultado, 0, {
      comidas: [COMIDA_GRANDE],
      consejo: null,
      preguntas: [],
    })
    expect(origenes(dia)).toEqual(['propia', 'propuesta_ia', 'propuesta'])
    expect(dia.notas).toEqual([sinIa.notas[1]])
  })

  it('y si ninguna propuesta convence, las notas son las de siempre', () => {
    const dia = componerDia(DESAYUNO_SOLO, PLAN.inputs, PLAN.resultado, 0, {
      comidas: [RIDICULA('Comida'), RIDICULA('Cena')],
      consejo: null,
      preguntas: [],
    })
    expect(dia.notas).toEqual(sinIa.notas)
  })
})

describe('§4bis.3 — preguntas, consejo y avisos', () => {
  it('copia las preguntas y el consejo del modelo', () => {
    const dia = DIAS_CON_PROPUESTA.solo_contexto
    expect(dia.consejo_ia).toBe(PROPUESTA_IA_CONTEXTO.consejo)
    expect(dia.preguntas).toEqual(PROPUESTA_IA_CONTEXTO.preguntas)
    // Copiadas, no compartidas: tocar el día no puede tocar la propuesta guardada.
    expect(dia.preguntas![0]).not.toBe(PROPUESTA_IA_CONTEXTO.preguntas[0])
    expect(dia.preguntas![0].opciones).not.toBe(PROPUESTA_IA_CONTEXTO.preguntas[0].opciones)
  })

  it('DIETA_CONSEJO_IA es el primero de los informativos y lleva el consejo literal', () => {
    const dia = DIAS_CON_PROPUESTA.desayuno_solo
    expect(dia.avisos[0].codigo).toBe('DIETA_CONSEJO_IA')
    expect(dia.avisos[0].texto).toBe(PROPUESTA_IA_PARCIAL.consejo)
    expect(codigos(dia).slice(1)).toEqual(['DIETA_PENDIENTES', 'DIETA_ESTIMADOS'])
  })

  it('detrás de DIETA_NO_CUADRA, que es terminal, y sin tocar el resto de la lista', () => {
    const propuesta: PropuestaIA = { comidas: [], consejo: 'Ojo con la fibra.', preguntas: [] }
    const dia = componerDia(DIA_COMPLETO, PLAN_1780.inputs, PLAN_1780.resultado, 0, propuesta)
    const sinIa = DIAS_COMPUESTOS.dia_completo
    expect(dia.avisos[0].codigo).toBe('DIETA_NO_CUADRA')
    expect(dia.avisos[1]).toEqual({ codigo: 'DIETA_CONSEJO_IA', texto: 'Ojo con la fibra.' })
    // El consejo no es un aviso de §4.4: ni cuenta para el umbral ni cambia nada de lo demás.
    expect(dia.avisos.filter((a) => a.codigo !== 'DIETA_CONSEJO_IA')).toEqual(sinIa.avisos)
  })

  it('sin consejo no hay aviso', () => {
    const dia = componerDia(DESAYUNO_SOLO, PLAN_1780.inputs, PLAN_1780.resultado, 0, {
      ...PROPUESTA_IA_PARCIAL,
      consejo: null,
      preguntas: [],
    })
    expect(codigos(dia)).not.toContain('DIETA_CONSEJO_IA')
    expect(dia.consejo_ia).toBeNull()
    expect(dia.preguntas).toEqual([])
  })
})

describe('§4bis.1 — huecosParaProponer', () => {
  it('devuelve los huecos montados con su objetivo, en el orden del día', () => {
    expect(huecosParaProponer(DIAS_COMPUESTOS.desayuno_solo)).toEqual([
      {
        nombre: 'Comida',
        hora: DIAS_COMPUESTOS.desayuno_solo.comidas[1].hora,
        peri: false,
        objetivo: DIAS_COMPUESTOS.desayuno_solo.comidas[1].objetivo,
        sin_hidratos: false,
      },
      {
        nombre: 'Cena',
        hora: DIAS_COMPUESTOS.desayuno_solo.comidas[2].hora,
        peri: false,
        objetivo: DIAS_COMPUESTOS.desayuno_solo.comidas[2].objetivo,
        sin_hidratos: false,
      },
    ])
  })

  it('marca el hueco al que se aplicó "sin hidratos"', () => {
    const huecos = huecosParaProponer(DIAS_COMPUESTOS.solo_contexto)
    expect(huecos.map((h) => h.nombre)).toEqual(['Desayuno', 'Comida', 'Cena'])
    expect(huecos.map((h) => h.sin_hidratos)).toEqual([false, false, true])
    expect(huecos[2].objetivo.carb).toBeLessThanOrEqual(10)
  })

  it('no pide nada cuando todas las comidas son tuyas', () => {
    expect(huecosParaProponer(DIAS_COMPUESTOS.dia_completo)).toEqual([])
  })

  it('con un día ya montado por la IA pide los mismos huecos ("Otra propuesta")', () => {
    expect(huecosParaProponer(DIAS_CON_PROPUESTA.solo_contexto)).toEqual(
      huecosParaProponer(DIAS_COMPUESTOS.solo_contexto),
    )
  })

  it('no comparte el objetivo con el día: el que pide no puede mutarlo', () => {
    const dia = DIAS_COMPUESTOS.solo_contexto
    expect(huecosParaProponer(dia)[0].objetivo).not.toBe(dia.comidas[0].objetivo)
  })
})

describe('§4bis.6 — determinismo y compatibilidad hacia atrás', () => {
  it('la misma propuesta da el mismo día, bit a bit', () => {
    const a = componerDia(
      SOLO_CONTEXTO,
      CONTEXTO.inputs,
      CONTEXTO.resultado,
      0,
      PROPUESTA_IA_CONTEXTO,
    )
    const b = componerDia(
      SOLO_CONTEXTO,
      CONTEXTO.inputs,
      CONTEXTO.resultado,
      0,
      PROPUESTA_IA_CONTEXTO,
    )
    expect(a).toEqual(b)
    expect(a).toEqual(DIAS_CON_PROPUESTA.solo_contexto)
  })

  it('sin propuesta el día es exactamente el de siempre, sin campos nuevos', () => {
    const dia = componerDia(DESAYUNO_SOLO, PLAN_1780.inputs, PLAN_1780.resultado)
    expect(dia).toEqual(DIAS_COMPUESTOS.desayuno_solo)
    expect('preguntas' in dia).toBe(false)
    expect('consejo_ia' in dia).toBe(false)
    expect('origen_huecos' in dia).toBe(false)
    expect(componerDia(DESAYUNO_SOLO, PLAN_1780.inputs, PLAN_1780.resultado, 0, undefined)).toEqual(
      dia,
    )
  })

  it('"Otra propuesta" con la misma variante y otra propuesta solo cambia los huecos', () => {
    const uno = DIAS_CON_PROPUESTA.desayuno_solo
    const otro = componerDia(
      DESAYUNO_SOLO,
      PLAN_1780.inputs,
      PLAN_1780.resultado,
      1,
      PROPUESTA_IA_PARCIAL,
    )
    expect(otro.comidas[0]).toEqual(uno.comidas[0])
    // La variante solo la usan las plantillas: con la misma propuesta, los huecos de la IA salen igual.
    expect(otro.comidas[1]).toEqual(uno.comidas[1])
  })
})

describe('§6.1 — la compra con comidas propuestas por la IA', () => {
  it('mete los alimentos de los huecos de la IA en la lista, agrupados con los tuyos', () => {
    const dia = DIAS_CON_PROPUESTA.desayuno_solo
    const lista = compraDeDia(dia)
    const ids = lista.items.map((i) => i.alimento_id)
    for (const c of deIa(dia)) {
      for (const a of c.alimentos) expect(ids, a.nombre).toContain(a.alimento_id)
    }
    // El AOVE está en la comida y en la cena: una sola línea con los gramos de las dos.
    const aove = lista.items.find((i) => i.alimento_id === 'aove')!
    const gramos = deIa(dia)
      .flatMap((c) => c.alimentos.filter((a) => a.alimento_id === 'aove'))
      .reduce((t, a) => t + a.gramos_ajustados, 0)
    expect(aove.gramos_semana).toBe(gramos * 7)
  })

  it('agrupa un alimento que está en la comida dictada y en la propuesta de la IA', () => {
    // El desayuno dictado lleva nueces; se las metemos también a la cena propuesta.
    const dia = componerDia(
      DESAYUNO_SOLO,
      PLAN_1780.inputs,
      PLAN_1780.resultado,
      0,
      con(PROPUESTA_IA_PARCIAL, {
        nombre: 'Cena',
        alimentos: [
          delCatalogo('merluza', 220, 'Merluza'),
          delCatalogo('patata_cocida', 300, 'Patata cocida'),
          delCatalogo('nueces', 20, 'Nueces'),
        ],
      }),
    )
    const lista = compraDeDia(dia)
    expect(lista.items.filter((i) => i.alimento_id === 'nueces')).toHaveLength(1)
  })
})
