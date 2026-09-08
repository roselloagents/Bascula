// Pantalla de resultados de la v1.2 (decisiones G, I y J): la acción "No me gusta" de cada
// alimento, el resumen de alimentos, los consejos por síntoma de la tarjeta del ciclo, la sección
// opcional de la lista de la compra y los mensajes del formulario de pesajes.
//
// Se usa `renderToStaticMarkup` con datos de muestra: el módulo de menús no hace falta para
// comprobar qué pinta la pantalla con un `Ejemplos` dado.

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type {
  AvisoTexto,
  Ejemplos,
  EjemploDia,
  InputCalculo,
  ListaCompra,
  Resultado,
  ResultadoCiclo,
} from '../../../engine/types'
import { BloqueMenus } from '../BloquesMenu'
import { mensajeFechaPesaje, mensajePesoPesaje } from '../seguimiento'
import { BloqueCompra } from '../BloqueCompra'
import { TarjetaCiclo } from '../BloquesPlan'

const INPUTS: InputCalculo = {
  sexo: 'mujer',
  edad: 45,
  altura_cm: 165,
  peso_kg: 68,
  grasa: { metodo: 'desconocido' },
  somatotipo: null,
  actividad_diaria: 'ligero',
  entrenamiento: {
    tipo: 'fuerza',
    dias_semana: 3,
    minutos_sesion: 45,
    intensidad: 'media',
    experiencia: 'novato',
    momento: null,
  },
  objetivo: 'perder',
  ritmo: 'moderado',
  peso_objetivo: 63,
  preferencia: 'omnivoro',
  preferencia_base: 'omnivoro',
  restricciones: [],
  low_carb: false,
  n_comidas: 3,
  clima_caluroso: false,
  menu_sencillo: false,
  embarazo_lactancia: false,
  condiciones: [],
  cribado_tca: null,
  fecha_inicio: '2026-09-01',
}

const DIA: EjemploDia = {
  tipo: 'entreno',
  comidas: [
    {
      comida: 'Comida',
      hora: '14:00',
      peri: false,
      objetivo: { kcal: 600, prot: 40, carb: 60, fat: 18 },
      alimentos: [
        {
          id: 'brocoli',
          nombre: 'Brócoli (cocido)',
          gramos: 200,
          medida: '2 puñados',
          kcal: 70,
          prot: 6,
          carb: 8,
          fat: 1,
        },
      ],
      totales: { kcal: 70, prot: 6, carb: 8, fat: 1 },
      alternativas: [],
    },
  ],
  totales: { kcal: 70, prot: 6, carb: 8, fat: 1 },
  notas: [],
}

const EJEMPLOS: Ejemplos = {
  entreno: DIA,
  descanso: DIA,
  consejos: [],
  equivalencias: { cabecera: '', nota_verdura_fruta: '', tablas: [] },
}

function pintaMenus(extra: Partial<Ejemplos> = {}, inputs: InputCalculo = INPUTS): string {
  return renderToStaticMarkup(
    createElement(BloqueMenus, {
      inputs,
      ejemplos: { ...EJEMPLOS, ...extra },
      onExcluirAlimento: () => {},
      onDeshacerExclusion: () => {},
      onCambiarAlimentos: () => {},
    }),
  )
}

describe('acción "No me gusta" del menú (§2.5)', () => {
  it('cada alimento lleva su acción, con el nombre completo en el nombre accesible', () => {
    const html = pintaMenus()
    expect(html).toContain('aria-label="Quitar Brócoli (cocido) de mi menú"')
    expect(html).toContain('No me gusta')
  })

  it('sin manejador no se pinta la acción (el PDF y las vistas de solo lectura)', () => {
    const html = renderToStaticMarkup(
      createElement(BloqueMenus, { inputs: INPUTS, ejemplos: EJEMPLOS }),
    )
    expect(html).not.toContain('de mi menú')
  })

  it('los avisos del generador se pintan con el resto de notas del menú', () => {
    const html = pintaMenus({ avisos_menu: ['No hemos podido evitar el brócoli en la Comida.'] })
    expect(html).toContain('No hemos podido evitar el brócoli en la Comida.')
  })
})

describe('resumen de alimentos bajo el menú (§2.5)', () => {
  it('nombra con el nombre corto, separa las dos mitades y ofrece "Cambiar"', () => {
    const html = pintaMenus(
      {},
      { ...INPUTS, alimentos_excluidos: ['brocoli'], alimentos_favoritos: ['pechuga_pollo'] },
    )
    expect(html).toContain('Sin: Brócoli')
    expect(html).toContain('Favoritos: Pechuga de pollo')
    expect(html).toContain('Cambiar')
  })

  it('cada mitad se omite si su lista está vacía', () => {
    const html = pintaMenus({}, { ...INPUTS, alimentos_excluidos: ['brocoli'] })
    expect(html).toContain('Sin: Brócoli')
    expect(html).not.toContain('Favoritos:')
  })

  it('sin ninguna de las dos listas la línea no existe', () => {
    expect(pintaMenus()).not.toContain('Sin:')
  })
})

describe('tarjeta "Tu ciclo y tu plan" (§2.2c)', () => {
  const ciclo: AvisoTexto = {
    codigo: 'INFO_CICLO',
    severidad: 'info',
    titulo: 'Tu ciclo y tu plan',
    texto: 'La báscula sube un par de kilos la semana antes de la regla.',
  }
  const resultadoCiclo: ResultadoCiclo = {
    sintomas: ['dolor', 'sangrado_abundante'],
    consejos: [
      {
        clave: 'dolor',
        titulo: 'Dolor: omega-3, magnesio y calor',
        texto: 'El omega-3 y el magnesio ayudan con el dolor.',
        alimentos: ['Sardinas en lata', 'Nueces'],
      },
      {
        clave: 'sangrado_abundante',
        titulo: 'Sangrado abundante: hierro',
        texto: 'Prioriza el hierro y acompáñalo de vitamina C.',
        alimentos: [],
      },
    ],
  }

  const pinta = (resultado?: Resultado, ejemplos?: Ejemplos) =>
    renderToStaticMarkup(createElement(TarjetaCiclo, { avisos: [ciclo], resultado, ejemplos }))

  it('sin `resultado.ciclo` solo se pinta el texto íntegro de INFO_CICLO', () => {
    const html = pinta()
    expect(html).toContain('La báscula sube un par de kilos la semana antes de la regla.')
    expect(html).not.toContain('Prioriza:')
  })

  it('con consejos pinta un bloque por síntoma, en su orden, y omite la línea sin alimentos', () => {
    const html = pinta({ ciclo: resultadoCiclo } as Resultado)
    expect(html.indexOf('Dolor: omega-3')).toBeLessThan(html.indexOf('Sangrado abundante: hierro'))
    expect(html).toContain('Prioriza:')
    expect(html).toContain('Sardinas en lata · Nueces')
    // El segundo consejo no trae alimentos: su línea entera no se pinta (una sola "Prioriza:").
    expect(html.split('Prioriza:').length - 1).toBe(1)
  })

  it('la línea de la compra opcional solo aparece si hay alimentos del ciclo', () => {
    const conAlimentos = pinta({ ciclo: resultadoCiclo } as Resultado, {
      ...EJEMPLOS,
      alimentos_ciclo: [{ id: 'lentejas_cocidas', nombre: 'Lentejas cocidas', por_que: 'hierro' }],
    })
    expect(conAlimentos).toContain('sección opcional para esos días')
    expect(pinta({ ciclo: resultadoCiclo } as Resultado, EJEMPLOS)).not.toContain(
      'sección opcional para esos días',
    )
  })

  it('sin INFO_CICLO la tarjeta no existe', () => {
    expect(renderToStaticMarkup(createElement(TarjetaCiclo, { avisos: [] }))).toBe('')
  })
})

describe('sección opcional de la lista de la compra (§2.5b)', () => {
  const item = {
    alimento_id: 'lentejas_cocidas',
    nombre: 'Lentejas cocidas',
    producto: 'Lentejas cocidas en bote',
    seccion: 'despensa' as const,
    conservacion: 'despensa' as const,
    gramos_dia: 60,
    gramos_semana: 420,
    envase_g: 240,
    envase_descripcion: 'bote 400 g (escurrido 240 g)',
    envases: 2,
    dura_dias: 8,
  }
  const compra: ListaCompra = {
    supermercado: 'Mercadona',
    dias: 7,
    items: [item],
    alimentos_distintos: 1,
    notas: ['Los formatos son aproximados.'],
    opcional_ciclo: {
      titulo: 'Para los días de regla (opcional)',
      nota: 'No está contado en las cantidades de tu plan.',
      items: [{ ...item, alimento_id: 'mejillones_lata', nombre: 'Mejillones al natural' }],
    },
  }

  it('se pinta al final, con su título y su nota, y no toca el recuento del plan', () => {
    const html = renderToStaticMarkup(
      createElement(BloqueCompra, { ejemplos: { ...EJEMPLOS, compra } }),
    )
    expect(html).toContain('Para los días de regla (opcional)')
    expect(html).toContain('No está contado en las cantidades de tu plan.')
    expect(html).toContain('Mejillones al natural')
    expect(html.indexOf('Para los días de regla')).toBeLessThan(
      html.indexOf('Los formatos son aproximados.'),
    )
    expect(html).toContain('>1</span>')
  })

  it('sin sección opcional la lista se pinta igual que antes', () => {
    const html = renderToStaticMarkup(
      createElement(BloqueCompra, {
        ejemplos: { ...EJEMPLOS, compra: { ...compra, opcional_ciclo: undefined } },
      }),
    )
    expect(html).not.toContain('Para los días de regla')
  })
})

describe('formulario de pesajes: fecha y peso no válidos (§2.6c, decisión J)', () => {
  it('cada motivo tiene su mensaje, y una fecha válida no dice nada', () => {
    expect(mensajeFechaPesaje('2026-08-30', '2026-09-01', '2026-09-08')).toBe(
      'Esa fecha es anterior al día en que empezaste el plan (1/9/2026). Elige una entre ese día y hoy.',
    )
    // El primer día del plan el rango válido es un solo día: un único mensaje, sin bucle entre
    // "elige una posterior" y "no puedes apuntar una fecha futura".
    const soloHoy = 'Hoy es el primer día de tu plan: de momento solo puedes apuntar el pesaje del 8/9/2026.'
    expect(mensajeFechaPesaje('2026-09-01', '2026-09-08', '2026-09-08')).toBe(soloHoy)
    expect(mensajeFechaPesaje('2026-09-20', '2026-09-08', '2026-09-08')).toBe(soloHoy)
    expect(mensajeFechaPesaje('2026-09-08', '2026-09-08', '2026-09-08')).toBeNull()
    expect(mensajeFechaPesaje('2026-09-20', '2026-09-01', '2026-09-08')).toBe(
      'Todavía no puedes apuntar un peso de una fecha futura.',
    )
    expect(mensajeFechaPesaje('', '2026-09-01', '2026-09-08')).toBe(
      'Pon la fecha del día en que te pesaste.',
    )
    expect(mensajeFechaPesaje('2026-09-05', '2026-09-01', '2026-09-08')).toBeNull()
  })

  it('el peso fuera de 30-300 kg lo dice; el campo vacío, no', () => {
    expect(mensajePesoPesaje(12)).toBe('Pon un peso entre 30 y 300 kg.')
    expect(mensajePesoPesaje(320)).toBe('Pon un peso entre 30 y 300 kg.')
    expect(mensajePesoPesaje(null)).toBeNull()
    expect(mensajePesoPesaje(68.4)).toBeNull()
  })
})
