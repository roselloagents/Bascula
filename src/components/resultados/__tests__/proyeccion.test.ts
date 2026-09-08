// Proyección (§2.6b) y seguimiento local (§2.6c) con datos de muestra.
//
// Se usa una curva de muestra corta (semanas 0, 4, 8 y 12) para poder afirmar números exactos,
// y además la proyección real que publica el motor. Lo que se comprueba es la presentación
// —gráfica accesible y tabla equivalente con los mismos números— y las frases de balance,
// que son normativas.

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { calcular } from '../../../engine'
import type { InputCalculo, Pesaje, PuntoProyeccion, Resultado } from '../../../engine/types'
import { BloqueProyeccion } from '../Proyeccion'
import { anadirPesaje, calcularBalance, semanaDePesaje } from '../seguimiento'

const INPUTS: InputCalculo = {
  sexo: 'hombre',
  edad: 35,
  altura_cm: 178,
  peso_kg: 84,
  grasa: { metodo: 'desconocido' },
  somatotipo: null,
  actividad_diaria: 'ligero',
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
  peso_objetivo: 78,
  preferencia: 'omnivoro',
  preferencia_base: 'omnivoro',
  restricciones: [],
  low_carb: false,
  n_comidas: 4,
  clima_caluroso: false,
  embarazo_lactancia: false,
  condiciones: [],
  cribado_tca: null,
  fecha_inicio: '2026-01-05',
}

/** Proyección de muestra con la forma que publica el paso 14b. */
const PROYECCION: PuntoProyeccion[] = [
  { semana: 0, peso_min: 84, peso_esp: 84, peso_max: 84 },
  { semana: 4, peso_min: 81.5, peso_esp: 82, peso_max: 82.6 },
  { semana: 8, peso_min: 79.4, peso_esp: 80.2, peso_max: 81 },
  { semana: 12, peso_min: 77.5, peso_esp: 78.5, peso_max: 79.6 },
]

function conProyeccion(): Resultado {
  const resultado = calcular(INPUTS)
  expect(resultado.excluido, 'el caso de muestra no debería quedar excluido').toBeFalsy()
  return { ...resultado, proyeccion: PROYECCION }
}

function marcado(pesajes: Pesaje[] = []): string {
  return renderToStaticMarkup(
    createElement(BloqueProyeccion, {
      inputs: INPUTS,
      resultado: conProyeccion(),
      avisos: [],
      pesajes,
    }),
  )
}

describe('bloque de proyección', () => {
  it('la gráfica es una imagen con resumen accesible', () => {
    const html = marcado()
    expect(html).toContain('role="img"')
    expect(html).toMatch(
      /aria-label="Proyección de peso: de 84 kg en la semana 0 a entre 77,5 y 79,6 kg en la semana 12/,
    )
  })

  it('la tabla equivalente lleva los mismos números que la curva, semana a semana', () => {
    const html = marcado()
    expect(html).toContain('Ver los números')
    for (const punto of PROYECCION) {
      const fila = new RegExp(`>${punto.semana}</th>`)
      expect(html).toMatch(fila)
    }
    expect(html).toContain('78,5 kg')
    expect(html).toContain('79,6 kg')
  })

  it('los hitos son las semanas 4, 8 y 12 y la línea del objetivo lleva su etiqueta', () => {
    const html = marcado()
    expect(html.match(/class="grafica-hito"/g)?.length).toBe(3)
    expect(html).toContain('objetivo 78 kg')
  })

  it('los pesajes se dibujan encima de la curva', () => {
    const conPesajes = marcado([
      { fecha: '2026-02-02', kg: 82.4 },
      { fecha: '2026-03-02', kg: 80.9 },
    ])
    expect(conPesajes.match(/class="grafica-pesaje"/g)?.length).toBe(2)
    expect(conPesajes).toContain('grafica-pesajes')
    expect(conPesajes).toContain('Tu peso real')
  })

  it('sin proyección el bloque no se pinta (§2.6b)', () => {
    const html = renderToStaticMarkup(
      createElement(BloqueProyeccion, {
        inputs: INPUTS,
        resultado: { ...conProyeccion(), proyeccion: undefined },
        avisos: [],
        pesajes: [],
      }),
    )
    expect(html).toBe('')
  })

  it('la proyección que publica el motor se pinta con sus propios números', () => {
    const real = calcular(INPUTS)
    expect(real.proyeccion, 'el motor v1.1 publica la proyección').toBeDefined()
    const html = renderToStaticMarkup(
      createElement(BloqueProyeccion, { inputs: INPUTS, resultado: real, avisos: [], pesajes: [] }),
    )
    const ultimo = real.proyeccion![real.proyeccion!.length - 1]
    expect(html).toContain(`en la semana ${ultimo.semana}`)
    // Una fila de tabla por punto de la curva: la tabla ES la versión accesible de la gráfica.
    expect(html.match(/<tr><th scope="row"/g)?.length).toBe(real.proyeccion!.length)
  })
})

describe('seguimiento local', () => {
  it('la semana sale de la fecha de inicio y se acota al final de la proyección', () => {
    expect(semanaDePesaje('2026-01-05', INPUTS.fecha_inicio, 12)).toBe(0)
    expect(semanaDePesaje('2026-01-19', INPUTS.fecha_inicio, 12)).toBe(2)
    expect(semanaDePesaje('2027-01-19', INPUTS.fecha_inicio, 12)).toBe(12)
  })

  it('un segundo pesaje del mismo día sustituye al anterior, no lo duplica', () => {
    const primero = anadirPesaje([], { fecha: '2026-02-02', kg: 83 })
    const segundo = anadirPesaje(primero.pesajes, { fecha: '2026-02-02', kg: 82.5 })
    expect(primero.sustituido).toBe(false)
    expect(segundo.sustituido).toBe(true)
    expect(segundo.pesajes).toEqual([{ fecha: '2026-02-02', kg: 82.5 }])
  })

  it('con menos de dos pesajes no hay frase de balance', () => {
    const uno = calcularBalance(
      [{ fecha: '2026-02-02', kg: 82 }],
      PROYECCION,
      'perder',
      INPUTS.fecha_inicio,
      false,
    )
    expect(uno).toBeNull()
  })

  it('las tres frases de "perder" son las de la spec', () => {
    const base: Pesaje[] = [{ fecha: '2026-01-12', kg: 83.5 }]
    const balance = (kg: number) =>
      calcularBalance(
        [...base, { fecha: '2026-02-02', kg }],
        PROYECCION,
        'perder',
        INPUTS.fecha_inicio,
        false,
      )

    // Semana 4: banda 81,5-82,6 y esperado 82,0.
    const delante = balance(80.5)
    expect(delante?.estado).toBe('por_delante')
    expect(delante?.frase).toBe(
      'Vas por delante de la previsión: 1,5 kg por debajo de lo que esperábamos para la semana 4.',
    )
    expect(delante?.nota).toContain('Ojo con acelerar')

    expect(balance(82)?.frase).toBe(
      'Vas dentro de lo previsto para la semana 4. No hay nada que cambiar.',
    )

    const detras = balance(83.2)
    expect(detras?.estado).toBe('por_detras')
    expect(detras?.frase).toBe(
      'Vas por detrás de la previsión: 1,2 kg por encima de lo que esperábamos para la semana 4.',
    )
    expect(detras?.cierre).toBe('Recalcula tu plan cada 4-6 semanas, o antes si has cambiado 5 kg.')
  })

  it('en "ganar" se invierten arriba y abajo', () => {
    const balance = calcularBalance(
      [
        { fecha: '2026-01-12', kg: 83.5 },
        { fecha: '2026-02-02', kg: 83.4 },
      ],
      PROYECCION,
      'ganar',
      INPUTS.fecha_inicio,
      false,
    )
    expect(balance?.estado).toBe('por_delante')
    expect(balance?.frase).toContain('por encima de lo que esperábamos')
  })

  it('con proyección plana solo hay "en la banda" y "fuera de la banda"', () => {
    const plana: PuntoProyeccion[] = [
      { semana: 0, peso_min: 84, peso_esp: 84, peso_max: 84 },
      { semana: 4, peso_min: 83, peso_esp: 84, peso_max: 85 },
    ]
    const fuera = calcularBalance(
      [
        { fecha: '2026-01-12', kg: 84 },
        { fecha: '2026-02-02', kg: 86.4 },
      ],
      plana,
      'recomposicion',
      INPUTS.fecha_inicio,
      true,
    )
    expect(fuera?.estado).toBe('fuera_banda')
    expect(fuera?.frase).toContain('Tu peso se ha movido más de un kilo')
  })
})
