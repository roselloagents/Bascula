// Composición del día con lo que la persona nos cuenta (docs/SPEC-dieta-propia.md §4.7).
// Deterministas bit a bit: ninguna aserción depende de la fecha, del azar ni del orden de un `Set`.
import { describe, expect, it } from 'vitest'
import type {
  AlimentoPropio,
  DiaCompuesto,
  DietaInterpretada,
  Inputs,
  Macros,
  Resultado,
} from '../../engine/types'
import { componerDia, generarComidas } from '../index'
import type { EntradaAjuste, Pieza, Variable } from '../dieta/ajuste'
import { ajustar, cajaDe, estadoDe, funcionCompleta } from '../dieta/ajuste'
import {
  DESAYUNO_SOLO,
  DIAS_COMPUESTOS,
  DIA_COMPLETO,
  DIETA_DIABETES,
  FIXTURES_DIETA,
  PLAN_1780,
  PLAN_2300,
  SOLO_CONTEXTO,
  delCatalogo,
  fixtureDieta,
  interpretada,
  planDieta,
  propio,
} from './dieta-fixtures'

const codigos = (dia: DiaCompuesto): string[] => dia.avisos.map((a) => a.codigo)
const texto = (dia: DiaCompuesto, codigo: string): string =>
  dia.avisos.find((a) => a.codigo === codigo)?.texto ?? ''
const propias = (dia: DiaCompuesto) => dia.comidas.filter((c) => c.origen === 'propia')
const propuestas = (dia: DiaCompuesto) => dia.comidas.filter((c) => c.origen === 'propuesta')
const idsMontados = (dia: DiaCompuesto): string[] =>
  propuestas(dia).flatMap((c) => (c.ejemplo?.alimentos ?? []).map((a) => a.id))

/** Reconstruye la entrada del solver tal y como la arma `componerDia`, para comprobar la caja. */
function entradaDe(
  d: DietaInterpretada,
  resultado: Resultado,
  modo: 'completa' | 'parcial',
  huecosAMontar: number,
): EntradaAjuste {
  const piezas: Pieza[] = []
  const variables: Variable[] = []
  for (const c of d.comidas) {
    for (const a of c.alimentos) {
      if (a.retirado === true) continue
      const estado = estadoDe(a)
      if (estado === 'pendiente') continue
      if (estado === 'fijo') {
        piezas.push({ macros: a.macros_100g, gramos: a.gramos ?? 0, variable: null })
        continue
      }
      const v = variables.length
      variables.push(cajaDe(a))
      piezas.push({ macros: a.macros_100g, gramos: a.gramos ?? 0, variable: v })
    }
  }
  const objetivo: Macros = {
    kcal: resultado.kcal,
    prot: resultado.macros.proteina_g,
    carb: resultado.macros.hc_g,
    fat: resultado.macros.grasa_g,
  }
  return { piezas, variables, objetivo, modo, huecosAMontar, lowCarb: false }
}

describe('§4.1 y §4.2 — solo el desayuno del §0', () => {
  const dia = DIAS_COMPUESTOS.desayuno_solo

  it('es una composición parcial con dos huecos montados', () => {
    expect(dia.modo).toBe('parcial')
    expect(propias(dia).map((c) => c.nombre)).toEqual(['Desayuno'])
    expect(propuestas(dia).map((c) => c.nombre)).toEqual(['Comida', 'Cena'])
    expect(dia.comidas.map((c) => c.nombre)).toEqual(['Desayuno', 'Comida', 'Cena'])
  })

  it('deja los factores en 1: lo dictado cabe en el plan sin tocarlo', () => {
    const desayuno = propias(dia)[0]
    for (const a of desayuno.alimentos) {
      if (a.estado_ajuste === 'pendiente') continue
      expect(a.factor, a.nombre).toBe(1)
      expect(a.gramos_ajustados, a.nombre).toBe(a.gramos)
      expect(a.cambio, a.nombre).toBe('igual')
    }
  })

  it('clasifica cada alimento como manda §4.2.1', () => {
    const estados = propias(dia)[0].alimentos.map((a) => `${a.nombre}:${a.estado_ajuste}`)
    expect(estados).toEqual([
      'Kéfir natural entero:variable',
      'Semillas de chía:fijo',
      'Almendras:variable',
      'Nueces:variable',
      'Proteína de suero en polvo:variable',
      'Cereales de arroz integral y avena 0 %:pendiente',
    ])
    expect(dia.n_variables).toBe(4)
  })

  it('cierra el día dentro del ±4 % de las kcal del plan y se marca provisional', () => {
    expect(Math.abs(dia.totales.kcal - dia.objetivo.kcal) / dia.objetivo.kcal).toBeLessThanOrEqual(
      0.04,
    )
    expect(dia.provisional).toBe(true)
    expect(dia.pendientes).toEqual([
      { comida: 'Desayuno', nombre: 'Cereales de arroz integral y avena 0 %' },
    ])
    expect(codigos(dia)).toContain('DIETA_PENDIENTES')
    expect(texto(dia, 'DIETA_PENDIENTES')).toBe(
      'Nos falta la cantidad de Cereales de arroz integral y avena 0 %. Hasta que la pongas en su comida, estos gramos son provisionales: lo que falta cambia el resto.',
    )
  })

  it('reparte el resto entre los huecos ∝ pct_kcal y sin pasarse del resto', () => {
    const objetivos = propuestas(dia).map((c) => c.objetivo!)
    const sumaKcal = objetivos.reduce((t, o) => t + o.kcal, 0)
    const dictadas = propias(dia).reduce((t, c) => t + c.totales.kcal, 0)
    expect(sumaKcal).toBe(Math.round(dia.objetivo.kcal - dictadas))
    // Comida (35 %) y Cena (35 %) del plan de 3 comidas: el resto se parte casi por la mitad.
    expect(Math.abs(objetivos[0].kcal - objetivos[1].kcal)).toBeLessThanOrEqual(2)
  })
})

describe('§4.2 — el día entero del §0', () => {
  for (const [etiqueta, plan] of [
    ['1 780 kcal', PLAN_1780],
    ['2 300 kcal', PLAN_2300],
  ] as const) {
    const dia = componerDia(DIA_COMPLETO, plan.inputs, plan.resultado)

    it(`es una composición completa — ${etiqueta}`, () => {
      expect(dia.modo).toBe('completa')
      expect(propuestas(dia)).toHaveLength(0)
      expect(dia.comidas.map((c) => c.nombre)).toEqual(['Desayuno', 'Comida', 'Cena'])
      expect(dia.comidas.every((c) => c.objetivo !== null)).toBe(true)
    })

    it(`respeta la caja después del redondeo — ${etiqueta}`, () => {
      const entrada = entradaDe(DIA_COMPLETO, plan.resultado, 'completa', 0)
      const salida = ajustar(entrada)
      salida.gramos.forEach((g, i) => {
        const v = entrada.variables[i]
        expect(g, `variable ${i}`).toBeGreaterThanOrEqual(v.loRed)
        expect(g, `variable ${i}`).toBeLessThanOrEqual(v.hiRed)
        if (v.unidadG !== null) expect(g % v.unidadG).toBe(0)
        else expect(g % v.paso).toBe(0)
      })
    })

    it(`termina el cierre en un punto que ningún paso de rejilla mejora — ${etiqueta}`, () => {
      const entrada = entradaDe(DIA_COMPLETO, plan.resultado, 'completa', 0)
      const salida = ajustar(entrada)
      const base = funcionCompleta(entrada, salida.gramos)
      for (let i = 0; i < entrada.variables.length; i++) {
        const v = entrada.variables[i]
        for (const direccion of [1, -1]) {
          const candidato = salida.gramos[i] + direccion * v.paso
          if (candidato < v.loRed || candidato > v.hiRed) continue
          const prueba = [...salida.gramos]
          prueba[i] = candidato
          expect(
            funcionCompleta(entrada, prueba),
            `variable ${i} ${direccion}`,
          ).toBeGreaterThanOrEqual(base - 1e-12)
        }
      }
    })

    it(`no aleja del plan: el ajuste mejora F frente a los gramos dictados — ${etiqueta}`, () => {
      const entrada = entradaDe(DIA_COMPLETO, plan.resultado, 'completa', 0)
      const salida = ajustar(entrada)
      const dictados = entrada.variables.map((v) => v.gramos)
      expect(funcionCompleta(entrada, salida.gramos)).toBeLessThanOrEqual(
        funcionCompleta(entrada, dictados) + 1e-12,
      )
    })
  }

  it('no mueve los fijos ni cuenta los pendientes', () => {
    const dia = DIAS_COMPUESTOS.dia_completo
    const chia = propias(dia)[0].alimentos.find((a) => a.nombre === 'Semillas de chía')!
    expect(chia.estado_ajuste).toBe('fijo')
    expect(chia.gramos_ajustados).toBe(5)
    expect(chia.factor).toBe(1)
    const fiambre = propias(dia)[2].alimentos.find((a) => a.estado_ajuste === 'pendiente')!
    expect(fiambre.gramos_ajustados).toBe(0)
    expect(fiambre.aporte.kcal).toBe(0)
  })

  it('redondea con la rejilla que marcan los gramos dictados (§4.2.6)', () => {
    const dia = DIAS_COMPUESTOS.dia_completo
    const desayuno = propias(dia)[0]
    // Kéfir 250 g → rejilla de 10; nueces 18 g → rejilla de 1; almendras 25 g → rejilla de 5.
    expect(desayuno.alimentos[0].gramos_ajustados % 10).toBe(0)
    expect(desayuno.alimentos[2].gramos_ajustados % 5).toBe(0)
    expect(Number.isInteger(desayuno.alimentos[3].gramos_ajustados)).toBe(true)
    // Los 5 huevos son contables: el gramaje final es múltiplo de la unidad de 55 g.
    const huevos = propias(dia)[2].alimentos[0]
    expect(huevos.gramos_ajustados % 55).toBe(0)
  })
})

describe('§4.1.2 y §4.3.2 — solo contexto', () => {
  const dia = DIAS_COMPUESTOS.solo_contexto

  it('monta el día entero y lo marca como solo contexto', () => {
    expect(dia.modo).toBe('solo_contexto')
    expect(propias(dia)).toHaveLength(0)
    expect(propuestas(dia)).toHaveLength(3)
    expect(dia.n_variables).toBe(0)
    expect(dia.provisional).toBe(false)
  })

  it('anota los dos gustos y la costumbre en "lo que hemos tenido en cuenta"', () => {
    expect(dia.aplicado).toEqual(['Sin brócoli', 'Favorito: salmón', 'Cena sin hidratos'])
    expect(dia.apuntado).toEqual([])
  })

  it('deja la cena en 10 g de hidratos y traslada sus kcal a las demás', () => {
    const cena = dia.comidas[2]
    expect(cena.objetivo!.carb).toBeLessThanOrEqual(10)
    const plan = fixtureDieta('solo_contexto').resultado.comidas
    expect(cena.objetivo!.kcal).toBeLessThan(plan[2].kcal)
    expect(dia.comidas[0].objetivo!.kcal).toBeGreaterThan(plan[0].kcal)
    const suma = dia.comidas.reduce((t, c) => t + c.objetivo!.kcal, 0)
    expect(suma).toBe(Math.round(dia.objetivo.kcal))
  })

  it('no mete el brócoli en ningún hueco', () => {
    expect(idsMontados(dia)).not.toContain('brocoli')
  })
})

describe('§4.2.4 y §4.4 — lo dictado se lleva casi todo el día', () => {
  const plan = planDieta({ kcal: 1000, prot: 90, carb: 80, fat: 30 })
  const dia = componerDia(DESAYUNO_SOLO, plan.inputs, plan.resultado)

  it('baja los variables lo justo y avisa de que lo tuyo es muy grande', () => {
    expect(dia.modo).toBe('parcial')
    const desayuno = propias(dia)[0]
    const variables = desayuno.alimentos.filter((a) => a.estado_ajuste === 'variable')
    expect(variables.some((a) => a.cambio === 'baja')).toBe(true)
    expect(variables.every((a) => a.factor <= 1)).toBe(true)
    expect(variables.every((a) => a.factor >= 0.5)).toBe(true)
    expect(codigos(dia)).toContain('DIETA_PROPIAS_GRANDES')
    expect(texto(dia, 'DIETA_PROPIAS_GRANDES')).toContain('% de tus calorías')
    expect(texto(dia, 'DIETA_PROPIAS_GRANDES')).toContain('hemos bajado un poco')
  })
})

describe('§4.5 — hábitos que se apuntan en vez de aplicarse', () => {
  const d = interpretada({
    comidas: [
      {
        nombre: 'Cena',
        alimentos: [delCatalogo('huevo_entero', 165, '3 huevos')],
      },
    ],
    habitos: [
      { texto: 'ceno ligero', tipo: 'ligera', comida: 'Cena', valor: null },
      { texto: 'hago cinco comidas', tipo: 'n_comidas', comida: null, valor: 5 },
      {
        texto: 'como pescado dos veces por semana',
        tipo: 'frecuencia_semanal',
        comida: null,
        valor: 2,
      },
      { texto: 'desayuno a las siete', tipo: 'horario', comida: 'Desayuno', valor: null },
      { texto: 'desayuno siempre lo mismo', tipo: 'misma_cada_dia', comida: 'Cena', valor: null },
    ],
  })
  const dia = componerDia(d, PLAN_1780.inputs, PLAN_1780.resultado)

  it('apunta lo que no podemos aplicar, con sus textos literales', () => {
    expect(dia.apuntado).toEqual([
      '«ceno ligero»: lo que nos contaste de esa comida manda',
      '«hago cinco comidas»: cambia el número de comidas en «Editar tus datos» y volvemos a montarlo',
      '«como pescado dos veces por semana»: el menú es de un día tipo; la semana aún no la repartimos',
      '«desayuno a las siete»: las horas del reparto son orientativas, muévelas sin miedo',
    ])
    expect(dia.aplicado).toEqual(['Cena: la tuya, cada día'])
  })
})

describe('§4.4 — cada aviso lo dispara un caso', () => {
  it('grasa baja', () => {
    const dia = DIAS_COMPUESTOS.baja_en_grasa
    expect(codigos(dia)).toContain('DIETA_GRASA_BAJA')
    expect(texto(dia, 'DIETA_GRASA_BAJA')).toContain('las vitaminas A, D, E y K')
    expect(codigos(dia)).toContain('DIETA_KCAL_LEJOS')
    expect(texto(dia, 'DIETA_KCAL_LEJOS')).toContain('por debajo de tu plan')
  })

  it('grasa alta, nombrando alimentos que aún tienen recorrido', () => {
    const dia = DIAS_COMPUESTOS.alta_en_grasa
    expect(codigos(dia)).toContain('DIETA_GRASA_ALTA')
    expect(texto(dia, 'DIETA_GRASA_ALTA')).toContain('Lo que más la sube es')
    expect(texto(dia, 'DIETA_GRASA_ALTA')).toContain('mira si puedes recortar ahí')
    expect(codigos(dia)).toContain('DIETA_PROTEINA_CORTA')
  })

  it('grasa alta con todo en su mínimo: el texto dice que ya no se puede bajar más', () => {
    const d = interpretada({
      comidas: [
        { nombre: 'Desayuno', alimentos: [delCatalogo('nueces', 60, '60 g de nueces')] },
        { nombre: 'Comida', alimentos: [delCatalogo('aove', 25, '25 g de aceite')] },
        { nombre: 'Cena', alimentos: [delCatalogo('almendras', 60, '60 g de almendras')] },
      ],
    })
    const plan = planDieta({ kcal: 700, prot: 40, carb: 40, fat: 25 })
    const dia = componerDia(d, plan.inputs, plan.resultado)
    expect(texto(dia, 'DIETA_GRASA_ALTA')).toContain('Hemos recortado al máximo la grasa')
  })

  it('hidratos lejos: con diabetes basta el 10 %', () => {
    const conDiabetes = DIAS_COMPUESTOS.diabetes
    expect(codigos(conDiabetes)).toContain('DIETA_HC_LEJOS')
    const sinDiabetes = componerDia(
      DIETA_DIABETES,
      planDieta({ kcal: 2100, prot: 140, carb: 195, fat: 75 }).inputs,
      planDieta({ kcal: 2100, prot: 140, carb: 195, fat: 75 }).resultado,
    )
    expect(codigos(sinDiabetes)).not.toContain('DIETA_HC_LEJOS')
  })

  it('fibra baja, sin vegetales, sin aceite y estimados', () => {
    const dia = DIAS_COMPUESTOS.dia_completo
    expect(codigos(dia)).toContain('DIETA_FIBRA_BAJA')
    expect(codigos(dia)).toContain('DIETA_SIN_VEGETALES')
    expect(codigos(dia)).toContain('DIETA_SIN_ACEITE')
    expect(codigos(dia)).toContain('DIETA_ESTIMADOS')
    expect(texto(dia, 'DIETA_SIN_ACEITE')).toBe(
      'No nos has dicho el aceite de cocinar ni el de aliñar. Suelen ser una o dos cucharadas al día, entre 90 y 180 kcal: dilo y los gramos saldrán mejor.',
    )
  })

  it('alcohol: se cuentan sus kcal y no se reparten como comida', () => {
    const cerveza: AlimentoPropio = propio(
      'Cerveza',
      330,
      'bebida',
      { kcal: 43, prot: 0.5, carb: 3.6, fat: 0, fibra: 0, alcohol: 3.9 },
      { ajustable: false },
    )
    const d = interpretada({
      comidas: [
        {
          nombre: 'Cena',
          alimentos: [delCatalogo('huevo_entero', 165, '3 huevos'), cerveza],
        },
      ],
    })
    const dia = componerDia(d, PLAN_1780.inputs, PLAN_1780.resultado)
    expect(codigos(dia)).toContain('DIETA_ALCOHOL')
    expect(texto(dia, 'DIETA_ALCOHOL')).toContain('El alcohol se lleva')
    // No ajustable: sus gramos no se tocan nunca.
    const bebida = propias(dia)[0].alimentos[1]
    expect(bebida.estado_ajuste).toBe('fijo')
    expect(bebida.gramos_ajustados).toBe(330)
  })

  it('el límite se distingue por factor y por tope de ración', () => {
    const dia = DIAS_COMPUESTOS.dia_completo
    const textos = dia.avisos.filter((a) => a.codigo === 'DIETA_LIMITE').map((a) => a.texto)
    expect(textos.some((t) => t.includes('entre la mitad y casi el doble'))).toBe(true)
    expect(textos.some((t) => t.includes('ya es una ración grande'))).toBe(true)
  })

  it('con cuatro avisos o más, "no cuadra" va el primero', () => {
    const dia = DIAS_COMPUESTOS.baja_en_grasa
    expect(dia.avisos[0].codigo).toBe('DIETA_NO_CUADRA')
    expect(new Set(codigos(dia).slice(1)).size).toBeGreaterThanOrEqual(4)
  })

  it('los trece códigos de §4.4 tienen al menos un caso entre los fixtures', () => {
    const vistos = new Set<string>()
    for (const f of FIXTURES_DIETA) for (const c of codigos(DIAS_COMPUESTOS[f.clave])) vistos.add(c)
    for (const c of [
      'DIETA_PENDIENTES',
      'DIETA_PROTEINA_CORTA',
      'DIETA_GRASA_BAJA',
      'DIETA_GRASA_ALTA',
      'DIETA_KCAL_LEJOS',
      'DIETA_HC_LEJOS',
      'DIETA_FIBRA_BAJA',
      'DIETA_SIN_VEGETALES',
      'DIETA_SIN_ACEITE',
      'DIETA_LIMITE',
      'DIETA_ESTIMADOS',
      'DIETA_NO_CUADRA',
    ]) {
      expect(vistos, c).toContain(c)
    }
  })
})

describe('§4.2.1 y §4.7 — casos límite', () => {
  it('un contable de una sola unidad es fijo y no se mueve', () => {
    const d = interpretada({
      comidas: [
        {
          nombre: 'Cena',
          alimentos: [
            delCatalogo('huevo_entero', 55, '1 huevo'),
            delCatalogo('pechuga_pollo', 200, '200 g de pollo'),
          ],
        },
      ],
    })
    const plan = planDieta({ kcal: 2600, prot: 200, carb: 300, fat: 80 })
    const dia = componerDia(d, plan.inputs, plan.resultado)
    const huevo = propias(dia)[0].alimentos[0]
    expect(huevo.estado_ajuste).toBe('fijo')
    expect(huevo.gramos_ajustados).toBe(55)
  })

  it('sin variables no se resuelve nada', () => {
    const d = interpretada({
      comidas: [
        {
          nombre: 'Cena',
          alimentos: [delCatalogo('huevo_entero', 55, '1 huevo')],
        },
      ],
    })
    const dia = componerDia(d, PLAN_1780.inputs, PLAN_1780.resultado)
    expect(dia.n_variables).toBe(0)
    expect(propias(dia)[0].alimentos[0].gramos_ajustados).toBe(55)
  })

  it('un alimento retirado se ignora del todo', () => {
    const conRetirado = interpretada({
      comidas: [
        {
          nombre: 'Cena',
          alimentos: [
            delCatalogo('huevo_entero', 165, '3 huevos'),
            delCatalogo('almendras', 30, '30 g de almendras', { retirado: true }),
          ],
        },
      ],
    })
    const sinRetirado = interpretada({
      comidas: [{ nombre: 'Cena', alimentos: [delCatalogo('huevo_entero', 165, '3 huevos')] }],
    })
    const a = componerDia(conRetirado, PLAN_1780.inputs, PLAN_1780.resultado)
    const b = componerDia(sinRetirado, PLAN_1780.inputs, PLAN_1780.resultado)
    expect(propias(a)[0].alimentos).toHaveLength(1)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('una comida dictada sin alimentos se descarta y su hueco se monta', () => {
    const d = interpretada({
      comidas: [
        { nombre: 'Desayuno', alimentos: [] },
        { nombre: 'Cena', alimentos: [delCatalogo('huevo_entero', 165, '3 huevos')] },
      ],
    })
    const dia = componerDia(d, PLAN_1780.inputs, PLAN_1780.resultado)
    expect(dia.modo).toBe('parcial')
    expect(dia.comidas.map((c) => `${c.nombre}:${c.origen}`)).toEqual([
      'Desayuno:propuesta',
      'Comida:propuesta',
      'Cena:propia',
    ])
  })

  it('una comida que no empareja con ningún hueco queda como extra propia al final', () => {
    const d = interpretada({
      comidas: [
        { nombre: 'Recena', alimentos: [delCatalogo('yogur_griego_0', 250, 'un yogur griego')] },
        { nombre: 'Cena', alimentos: [delCatalogo('huevo_entero', 165, '3 huevos')] },
      ],
    })
    const dia = componerDia(d, PLAN_1780.inputs, PLAN_1780.resultado)
    const extra = dia.comidas[dia.comidas.length - 1]
    expect(extra.nombre).toBe('Recena')
    expect(extra.origen).toBe('propia')
    expect(extra.objetivo).toBeNull()
    expect(extra.hora).toBeNull()
  })

  it('empareja por nombre normalizado, sin acentos ni mayúsculas', () => {
    const d = interpretada({
      comidas: [{ nombre: 'cena', alimentos: [delCatalogo('huevo_entero', 165, '3 huevos')] }],
    })
    const dia = componerDia(d, PLAN_1780.inputs, PLAN_1780.resultado)
    expect(dia.comidas[2].nombre).toBe('Cena')
    expect(dia.comidas[2].origen).toBe('propia')
  })

  it('es idempotente: la misma entrada da el mismo día, bit a bit', () => {
    for (const f of FIXTURES_DIETA) {
      const otra = componerDia(f.interpretada, f.inputs, f.resultado, f.variante)
      expect(JSON.stringify(otra), f.clave).toBe(JSON.stringify(DIAS_COMPUESTOS[f.clave]))
    }
  })

  it('"Ver otro ejemplo" solo cambia los huecos montados', () => {
    const f = fixtureDieta('desayuno_solo')
    const uno = componerDia(f.interpretada, f.inputs, f.resultado, 0)
    const otro = componerDia(f.interpretada, f.inputs, f.resultado, 1)
    // `pct_kcal` es el peso de la comida sobre el día ENTERO, así que cambia con los huecos
    // montados aunque la comida tuya sea la misma: se compara todo lo demás.
    const sinPct = (dia: DiaCompuesto): string =>
      JSON.stringify(propias(dia).map((c) => ({ ...c, pct_kcal: 0 })))
    expect(sinPct(otro)).toBe(sinPct(uno))
    expect(JSON.stringify(propuestas(otro))).not.toBe(JSON.stringify(propuestas(uno)))
  })
})

describe('§4.3.3 — generarComidas', () => {
  it('monta solo las tomas que se le pasan, con su nombre, hora y peri', () => {
    const { inputs, resultado } = PLAN_1780
    const huecos = [resultado.comidas[0], resultado.comidas[2]]
    const comidas = generarComidas(inputs, resultado, huecos)
    expect(comidas.map((c) => c.comida)).toEqual(['Desayuno', 'Cena'])
    expect(comidas[0].hora).toBe(resultado.comidas[0].hora)
    expect(comidas[1].peri).toBe(resultado.comidas[2].peri)
    expect(comidas.every((c) => c.alimentos.length > 0)).toBe(true)
  })

  it('sin huecos devuelve una lista vacía', () => {
    expect(generarComidas(PLAN_1780.inputs, PLAN_1780.resultado, [])).toEqual([])
  })

  it('es determinista', () => {
    const { inputs, resultado } = PLAN_1780
    const a = generarComidas(inputs, resultado, resultado.comidas, 2)
    const b = generarComidas(inputs, resultado, resultado.comidas, 2)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})

describe('§4.6 — forma de la salida', () => {
  it('publica totales, desvío y porcentajes coherentes', () => {
    for (const f of FIXTURES_DIETA) {
      const dia = DIAS_COMPUESTOS[f.clave]
      const suma = dia.comidas.reduce((t, c) => t + c.totales.kcal, 0)
      expect(Math.abs(suma - dia.totales.kcal), f.clave).toBeLessThanOrEqual(1)
      expect(dia.desvio.kcal, f.clave).toBe(Math.round(dia.totales.kcal - dia.objetivo.kcal))
      const pct = dia.comidas.reduce((t, c) => t + c.pct_kcal, 0)
      expect(Math.abs(pct - 100), f.clave).toBeLessThanOrEqual(0.5)
      for (const c of dia.comidas) {
        if (c.origen === 'propia') expect(c.ejemplo, f.clave).toBeNull()
        else expect(c.alimentos, f.clave).toEqual([])
      }
    }
  })

  it('copia lo no entendido y las notas del modelo', () => {
    const d = interpretada({
      comidas: [{ nombre: 'Cena', alimentos: [delCatalogo('huevo_entero', 165, '3 huevos')] }],
      no_entendido: [{ texto: 'tiras de fibra', sugerencia: '¿Quizá «tiras de fiambre de pavo»?' }],
      notas: ['He tomado el scoop como 60 g, como has dicho'],
    })
    const dia = componerDia(d, PLAN_1780.inputs, PLAN_1780.resultado)
    expect(dia.no_entendido).toEqual(d.no_entendido)
    expect(dia.notas[0]).toBe('He tomado el scoop como 60 g, como has dicho')
  })
})

describe('§4 — los seis fixtures son estables', () => {
  it('cada uno tiene el modo que promete', () => {
    const modos: Record<string, string> = {
      desayuno_solo: 'parcial',
      dia_completo: 'completa',
      solo_contexto: 'solo_contexto',
      baja_en_grasa: 'completa',
      alta_en_grasa: 'completa',
      diabetes: 'completa',
    }
    for (const f of FIXTURES_DIETA)
      expect(DIAS_COMPUESTOS[f.clave].modo, f.clave).toBe(modos[f.clave])
  })

  it('todos los alimentos dictados salen dentro de su caja', () => {
    for (const f of FIXTURES_DIETA) {
      const dia = DIAS_COMPUESTOS[f.clave]
      for (const c of dia.comidas) {
        for (const a of c.alimentos) {
          if (a.estado_ajuste !== 'variable') continue
          const caja = cajaDe(a)
          expect(a.gramos_ajustados, `${f.clave}/${a.nombre}`).toBeGreaterThanOrEqual(caja.loRed)
          expect(a.gramos_ajustados, `${f.clave}/${a.nombre}`).toBeLessThanOrEqual(caja.hiRed)
        }
      }
    }
  })
})

describe('utilidades de Inputs', () => {
  it('el perfil del hueco montado lleva los gustos ya sumados a las listas del paso 14', () => {
    const inputs: Inputs = {
      ...fixtureDieta('solo_contexto').inputs,
      alimentos_excluidos: ['brocoli', 'salmon'],
    }
    const dia = componerDia(SOLO_CONTEXTO, inputs, fixtureDieta('solo_contexto').resultado)
    expect(idsMontados(dia)).not.toContain('brocoli')
    expect(idsMontados(dia)).not.toContain('salmon')
  })
})
