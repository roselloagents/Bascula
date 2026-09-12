// Lista de la compra del día compuesto (docs/SPEC-dieta-propia.md §6.1).
import { describe, expect, it } from 'vitest'
import type {
  AlimentoAjustado,
  AlimentoPropio,
  ComidaCompuesta,
  DiaCompuesto,
  EjemploComida,
  GrupoAprox,
  MacrosPropio,
  SeccionOpcionalCompra,
} from '../../engine/types'
import { NOTAS_COMPRA } from '../compra'
import { CONSEJO_PROPIO, NOTA_COMPRA_DIETA, compraDeDia, slug, ubicacionDe } from '../dieta/compra'
import { DIAS_COMPUESTOS } from './dieta-fixtures'

const CERO: MacrosPropio = { kcal: 0, prot: 0, carb: 0, fat: 0, fibra: 0, alcohol: 0 }

function ajustado(
  nombre: string,
  gramos: number,
  extra: Partial<AlimentoAjustado> = {},
): AlimentoAjustado {
  const base: AlimentoPropio = {
    texto: nombre,
    nombre,
    alimento_id: null,
    estado: 'listo',
    grupo_aprox: 'otro',
    gramos,
    macros_100g: { kcal: 100, prot: 10, carb: 10, fat: 2, fibra: 0, alcohol: 0 },
    origen_macros: 'estimado',
    ajustable: true,
    confianza: 'media',
  }
  return {
    ...base,
    estado_ajuste: 'variable',
    gramos_ajustados: gramos,
    delta_g: 0,
    cambio: 'igual',
    factor: 1,
    en_limite: 'no',
    aporte: { ...CERO },
    ...extra,
  }
}

function propia(nombre: string, alimentos: AlimentoAjustado[]): ComidaCompuesta {
  return {
    nombre,
    hora: null,
    peri: false,
    origen: 'propia',
    objetivo: null,
    alimentos,
    ejemplo: null,
    totales: { ...CERO },
    pct_kcal: 0,
  }
}

function propuesta(nombre: string, alimentos: { id: string; nombre: string; gramos: number }[]) {
  const ejemplo: EjemploComida = {
    comida: nombre,
    hora: '14:00',
    peri: false,
    objetivo: { kcal: 0, prot: 0, carb: 0, fat: 0 },
    alimentos: alimentos.map((a) => ({
      ...a,
      medida: '',
      kcal: 0,
      prot: 0,
      carb: 0,
      fat: 0,
    })),
    totales: { kcal: 0, prot: 0, carb: 0, fat: 0 },
    alternativas: [],
  }
  const comida: ComidaCompuesta = {
    nombre,
    hora: '14:00',
    peri: false,
    origen: 'propuesta',
    objetivo: { kcal: 0, prot: 0, carb: 0, fat: 0 },
    alimentos: [],
    ejemplo,
    totales: { ...CERO },
    pct_kcal: 0,
  }
  return comida
}

function dia(comidas: ComidaCompuesta[]): DiaCompuesto {
  return {
    modo: 'parcial',
    comidas,
    totales: { ...CERO },
    objetivo: { kcal: 0, prot: 0, carb: 0, fat: 0 },
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

describe('§6.1.1 — se agrupa el día entero antes de multiplicar por siete', () => {
  it('junta en una línea el mismo alimento de una comida tuya y de una propuesta', () => {
    const lista = compraDeDia(
      dia([
        propia('Desayuno', [
          ajustado('Huevo entero', 110, { alimento_id: 'huevo_entero', grupo_aprox: 'proteina' }),
        ]),
        propuesta('Cena', [{ id: 'huevo_entero', nombre: 'Huevo entero', gramos: 55 }]),
      ]),
    )
    const huevos = lista.items.filter((i) => i.alimento_id === 'huevo_entero')
    expect(huevos).toHaveLength(1)
    expect(huevos[0].gramos_semana).toBe((110 + 55) * 7)
    expect(lista.alimentos_distintos).toBe(1)
  })

  it('deja fuera los pendientes y los retirados', () => {
    const lista = compraDeDia(
      dia([
        propia('Desayuno', [
          ajustado('Cereales raros', 0, { estado_ajuste: 'pendiente', gramos: null }),
          ajustado('Almendras', 30, {
            alimento_id: 'almendras',
            grupo_aprox: 'grasa',
            retirado: true,
          }),
          ajustado('Kéfir', 250, { alimento_id: 'kefir_entero', grupo_aprox: 'lacteo' }),
        ]),
      ]),
    )
    expect(lista.items.map((i) => i.alimento_id)).toEqual(['kefir_entero'])
  })
})

describe('§6.1.3 — alimentos que no están en nuestra base', () => {
  const lista = compraDeDia(
    dia([
      propia('Desayuno', [
        ajustado('Cereales de arroz integral y avena 0 %', 60, { grupo_aprox: 'carbohidrato' }),
        ajustado('Tiras de fiambre de pavo', 50, { grupo_aprox: 'proteina' }),
        ajustado('Bebida de arroz', 200, { grupo_aprox: 'bebida' }),
      ]),
    ]),
  )

  it('les da una clave propia, sin envases ni duración, y el consejo literal', () => {
    for (const item of lista.items) {
      expect(item.alimento_id.startsWith('propio:')).toBe(true)
      expect(item.envases).toBe(0)
      expect(item.envase_descripcion).toBe('')
      expect(item.dura_dias).toBe(0)
      expect(item.consejo).toBe('No está en nuestra base: mira el formato en el envase.')
      expect(item.consejo).toBe(CONSEJO_PROPIO)
      expect(item.producto).toBe(item.nombre)
    }
  })

  it('los coloca en su sección por `grupo_aprox`', () => {
    const porNombre = new Map(lista.items.map((i) => [i.nombre, i]))
    expect(porNombre.get('Cereales de arroz integral y avena 0 %')!.seccion).toBe('despensa')
    expect(porNombre.get('Tiras de fiambre de pavo')!.seccion).toBe('carniceria')
    expect(porNombre.get('Bebida de arroz')!.seccion).toBe('otros')
  })

  it('manda a la pescadería lo que suena a pescado', () => {
    expect(ubicacionDe('proteina', 'Lomos de merluza al vapor')).toEqual({
      seccion: 'pescaderia',
      conservacion: 'fresco',
    })
    expect(ubicacionDe('proteina', 'Salmón marinado')).toEqual({
      seccion: 'pescaderia',
      conservacion: 'fresco',
    })
    expect(ubicacionDe('proteina', 'Pechuga de pavo')).toEqual({
      seccion: 'carniceria',
      conservacion: 'fresco',
    })
  })

  it('cubre los ocho grupos del enum', () => {
    const grupos: GrupoAprox[] = [
      'proteina',
      'lacteo',
      'carbohidrato',
      'grasa',
      'verdura',
      'fruta',
      'bebida',
      'otro',
    ]
    for (const g of grupos) {
      const u = ubicacionDe(g, 'Algo')
      expect(u.seccion, g).toBeTruthy()
      expect(['fresco', 'despensa', 'congelado'], g).toContain(u.conservacion)
    }
  })
})

describe('§6.1.1 — claves propias', () => {
  it('dos nombres distintos con el mismo slug no se pisan', () => {
    const lista = compraDeDia(
      dia([
        propia('Desayuno', [
          ajustado('Pan  proteico', 60, { grupo_aprox: 'carbohidrato' }),
          ajustado('Pan próteico', 40, { grupo_aprox: 'carbohidrato' }),
        ]),
      ]),
    )
    expect(slug('Pan  proteico')).toBe(slug('Pan próteico'))
    expect(lista.items).toHaveLength(2)
    const claves = lista.items.map((i) => i.alimento_id).sort()
    expect(claves).toEqual(['propio:pan-proteico-2:listo', 'propio:pan-proteico:listo'])
    expect(lista.items.map((i) => i.gramos_semana).sort((a, b) => a - b)).toEqual([280, 420])
  })

  it('el mismo nombre en dos comidas sí se agrupa', () => {
    const lista = compraDeDia(
      dia([
        propia('Desayuno', [ajustado('Pan proteico', 60, { grupo_aprox: 'carbohidrato' })]),
        propia('Cena', [ajustado('Pan proteico', 40, { grupo_aprox: 'carbohidrato' })]),
      ]),
    )
    expect(lista.items).toHaveLength(1)
    expect(lista.items[0].gramos_semana).toBe(700)
  })

  it('el mismo nombre en dos estados distintos son dos líneas', () => {
    const lista = compraDeDia(
      dia([
        propia('Comida', [
          ajustado('Quinoa', 80, { grupo_aprox: 'carbohidrato', estado: 'crudo' }),
          ajustado('Quinoa', 200, { grupo_aprox: 'carbohidrato', estado: 'cocido' }),
        ]),
      ]),
    )
    expect(lista.items.map((i) => i.alimento_id).sort()).toEqual([
      'propio:quinoa:cocido',
      'propio:quinoa:crudo',
    ])
  })

  it('un nombre venenoso como "__proto__" no rompe nada', () => {
    const lista = compraDeDia(
      dia([
        propia('Cena', [
          ajustado('__proto__', 100, { grupo_aprox: 'otro' }),
          ajustado('constructor', 50, { grupo_aprox: 'otro' }),
        ]),
      ]),
    )
    expect(lista.items).toHaveLength(2)
    expect(lista.items.every((i) => i.alimento_id.startsWith('propio:'))).toBe(true)
    expect(Object.prototype.hasOwnProperty.call({}, 'polucion')).toBe(false)
    expect(({} as Record<string, unknown>).polucion).toBeUndefined()
  })

  it('un nombre sin letras ni números sigue dando una clave usable', () => {
    const lista = compraDeDia(
      dia([propia('Cena', [ajustado('···', 100, { grupo_aprox: 'otro' })])]),
    )
    expect(lista.items[0].alimento_id).toBe('propio:sin-nombre:listo')
  })
})

describe('§6.1.4 — notas, orden y sección opcional', () => {
  it('lleva las notas de siempre más la del menú con lo tuyo dentro', () => {
    const lista = compraDeDia(DIAS_COMPUESTOS.desayuno_solo)
    expect(lista.notas).toEqual([...NOTAS_COMPRA, NOTA_COMPRA_DIETA])
    expect(lista.notas[lista.notas.length - 1]).toBe(
      'Las cantidades salen de tu menú con lo tuyo dentro. Los alimentos que no están en nuestra base no llevan formato de venta.',
    )
    expect(lista.supermercado).toBe('Mercadona')
    expect(lista.dias).toBe(7)
    expect(lista.alimentos_distintos).toBe(lista.items.length)
  })

  it('ordena por recorrido de la tienda y, dentro, por nombre', () => {
    const lista = compraDeDia(DIAS_COMPUESTOS.dia_completo)
    const orden = [
      'carniceria',
      'pescaderia',
      'huevos_lacteos',
      'fruteria',
      'despensa',
      'congelados',
      'panaderia',
      'otros',
    ]
    const indices = lista.items.map((i) => orden.indexOf(i.seccion))
    expect([...indices].sort((a, b) => a - b)).toEqual(indices)
    for (let i = 1; i < lista.items.length; i++) {
      if (lista.items[i].seccion !== lista.items[i - 1].seccion) continue
      expect(
        lista.items[i - 1].nombre.localeCompare(lista.items[i].nombre, 'es'),
      ).toBeLessThanOrEqual(0)
    }
  })

  it('copia la sección opcional del ciclo si se le pasa', () => {
    const opcional: SeccionOpcionalCompra = {
      titulo: 'Para los días de regla (opcional)',
      nota: 'No está contado en las cantidades de tu plan.',
      items: [],
    }
    expect(compraDeDia(DIAS_COMPUESTOS.desayuno_solo, opcional).opcional_ciclo).toBe(opcional)
    expect(compraDeDia(DIAS_COMPUESTOS.desayuno_solo).opcional_ciclo).toBeUndefined()
  })

  it('es determinista con los seis fixtures', () => {
    for (const clave of Object.keys(DIAS_COMPUESTOS) as (keyof typeof DIAS_COMPUESTOS)[]) {
      const a = compraDeDia(DIAS_COMPUESTOS[clave])
      const b = compraDeDia(DIAS_COMPUESTOS[clave])
      expect(JSON.stringify(a), clave).toBe(JSON.stringify(b))
      expect(a.items.length, clave).toBeGreaterThan(0)
    }
  })

  it('un día sin nada da una lista vacía, no un error', () => {
    const lista = compraDeDia(dia([]))
    expect(lista.items).toEqual([])
    expect(lista.alimentos_distintos).toBe(0)
  })
})
