// Geometría de la gráfica y frases de balance del seguimiento (SPEC-ux §2.6b, §2.6c y §4.5b).
import { describe, expect, it } from 'vitest'
import type { Pesaje, PuntoProyeccion } from '../../engine/types'
import {
  CIERRE_BALANCE,
  crearEscala,
  fraseBalance,
  pathBanda,
  pesajesOrdenados,
  puntosPolilinea,
  semanaDePesaje,
} from '../proyeccion'

const CURVA: PuntoProyeccion[] = [
  { semana: 0, peso_min: 84, peso_esp: 84, peso_max: 84 },
  { semana: 4, peso_min: 81.5, peso_esp: 82, peso_max: 82.6 },
  { semana: 8, peso_min: 79.4, peso_esp: 80.2, peso_max: 81 },
  { semana: 12, peso_min: 77.5, peso_esp: 78.4, peso_max: 79.4 },
]

const PLANA: PuntoProyeccion[] = [
  { semana: 0, peso_min: 58.4, peso_esp: 58.4, peso_max: 58.4 },
  { semana: 4, peso_min: 57.4, peso_esp: 58.4, peso_max: 59.4 },
]

describe('escala de la gráfica', () => {
  it('cubre la banda entera con un kilo de margen y respeta el rectángulo de dibujo', () => {
    const e = crearEscala(CURVA)!
    expect(e.kgMin).toBe(76) // floor(77,5 - 1)
    expect(e.kgMax).toBe(85) // ceil(84 + 1)
    expect(e.x(0)).toBe(e.x0)
    expect(e.x(12)).toBeCloseTo(e.x1, 6)
    expect(e.y(e.kgMax)).toBeCloseTo(e.y0, 6)
    expect(e.y(e.kgMin)).toBeCloseTo(e.y1, 6)
    // Kilos más altos = más arriba en el papel (y crece hacia abajo).
    expect(e.y(84)).toBeLessThan(e.y(78))
  })

  it('acota los valores fuera de rango para no dibujar fuera del recuadro', () => {
    const e = crearEscala(CURVA)!
    expect(e.y(500)).toBeCloseTo(e.y0, 6)
    expect(e.y(0)).toBeCloseTo(e.y1, 6)
    expect(e.x(-5)).toBe(e.x0)
    expect(e.x(999)).toBeCloseTo(e.x1, 6)
    expect(e.y(Number.NaN)).toBeCloseTo(e.y1, 6)
  })

  it('mete los pesajes en la escala para que no queden pegados al eje', () => {
    const e = crearEscala(CURVA, [90])!
    expect(e.kgMax).toBe(91)
    expect(e.y(90)).toBeGreaterThan(e.y0)
  })

  it('ensancha la escala de una banda plana hasta 4 kg', () => {
    const e = crearEscala(PLANA)!
    expect(e.kgMax - e.kgMin).toBeGreaterThanOrEqual(4)
  })

  it('devuelve null sin puntos utilizables y no revienta con basura', () => {
    expect(crearEscala([])).toBeNull()
    expect(crearEscala([{ semana: 0, peso_min: Number.NaN, peso_esp: 1, peso_max: 2 }])).toBeNull()
  })

  it('el path de la banda va por peso_max y vuelve por peso_min, cerrado', () => {
    const e = crearEscala(CURVA)!
    const d = pathBanda(CURVA, e)
    expect(d.startsWith('M ')).toBe(true)
    expect(d.endsWith('Z')).toBe(true)
    expect((d.match(/L /g) ?? []).length).toBe(CURVA.length * 2 - 1)
    expect(d).not.toContain('NaN')
    expect(pathBanda([], e)).toBe('')
  })

  it('la polilínea se escribe como pares x,y', () => {
    expect(puntosPolilinea([{ x: 1, y: 2.345 }, { x: 3, y: 4 }])).toBe('1.00,2.35 3.00,4.00')
  })
})

describe('semanas y orden de los pesajes', () => {
  it('calcula la semana como floor(días / 7) y la acota', () => {
    expect(semanaDePesaje('2026-09-07', '2026-09-07', 12)).toBe(0)
    expect(semanaDePesaje('2026-09-13', '2026-09-07', 12)).toBe(0)
    expect(semanaDePesaje('2026-09-14', '2026-09-07', 12)).toBe(1)
    expect(semanaDePesaje('2026-10-05', '2026-09-07', 12)).toBe(4)
    expect(semanaDePesaje('2030-01-01', '2026-09-07', 12)).toBe(12)
    expect(semanaDePesaje('2020-01-01', '2026-09-07', 12)).toBe(0)
    expect(semanaDePesaje('lo-que-sea', '2026-09-07', 12)).toBe(0)
  })

  it('ordena de más antiguo a más reciente y descarta lo que no es un pesaje', () => {
    const sucios = [
      { fecha: '2026-10-05', kg: 83 },
      { fecha: 'no-es-una-fecha', kg: 80 },
      { fecha: '2026-09-07', kg: 84 },
      { fecha: '2026-09-21', kg: Number.NaN },
    ] as Pesaje[]
    expect(pesajesOrdenados(sucios).map((p) => p.fecha)).toEqual(['2026-09-07', '2026-10-05'])
    expect(pesajesOrdenados(undefined)).toEqual([])
  })
})

describe('frase de balance (§2.6c)', () => {
  const inicio = '2026-09-07'
  const dos = (kg: number): Pesaje[] => [
    { fecha: '2026-09-07', kg: 84 },
    { fecha: '2026-10-05', kg: kg },
  ]

  it('con menos de dos pesajes no dice nada: un punto no es una tendencia', () => {
    expect(fraseBalance([{ fecha: '2026-09-07', kg: 84 }], CURVA, inicio, 'perder', false)).toBeNull()
    expect(fraseBalance([], CURVA, inicio, 'perder', false)).toBeNull()
    expect(fraseBalance(dos(83), undefined, inicio, 'perder', false)).toBeNull()
  })

  it('perder: por delante, en la banda y por detrás', () => {
    const delante = fraseBalance(dos(80.5), CURVA, inicio, 'perder', false)!
    expect(delante[0]).toBe(
      'Vas por delante de la previsión: 1,5 kg por debajo de lo que esperábamos para la semana 4.',
    )
    expect(delante).toContain(CIERRE_BALANCE)

    const banda = fraseBalance(dos(82), CURVA, inicio, 'perder', false)!
    expect(banda[0]).toBe('Vas dentro de lo previsto para la semana 4. No hay nada que cambiar.')

    const detras = fraseBalance(dos(83), CURVA, inicio, 'perder', false)!
    expect(detras[0]).toBe(
      'Vas por detrás de la previsión: 1,0 kg por encima de lo que esperábamos para la semana 4.',
    )
    expect(detras[1]).toContain('Una semana no dice nada')
  })

  it('ganar: se invierte el sentido, no el criterio', () => {
    const delante = fraseBalance(dos(83), CURVA, inicio, 'ganar', false)!
    expect(delante[0]).toContain('por delante')
    expect(delante[0]).toContain('por encima')
    const detras = fraseBalance(dos(80.5), CURVA, inicio, 'ganar', false)!
    expect(detras[0]).toContain('por detrás')
    expect(detras[0]).toContain('por debajo')
  })

  it('proyección plana: en la banda o fuera de la banda, nunca "por delante"', () => {
    const pesajes = (kg: number): Pesaje[] => [
      { fecha: '2026-09-07', kg: 58.4 },
      { fecha: '2026-10-05', kg: kg },
    ]
    expect(fraseBalance(pesajes(58.1), PLANA, inicio, 'mantener', true)![0]).toContain('dentro de lo previsto')
    const fuera = fraseBalance(pesajes(61), PLANA, inicio, 'mantener', true)!
    expect(fuera[0]).toContain('más de un kilo respecto al de partida')
    expect(fuera[fuera.length - 1]).toBe(CIERRE_BALANCE)
  })

  it('ninguna frase promete, felicita, regaña ni usa exclamaciones', () => {
    const todas = [
      fraseBalance(dos(80.5), CURVA, inicio, 'perder', false),
      fraseBalance(dos(82), CURVA, inicio, 'perder', false),
      fraseBalance(dos(83), CURVA, inicio, 'perder', false),
      fraseBalance(dos(90), PLANA, inicio, 'recomposicion', true),
    ].flatMap((f) => f ?? [])
    expect(todas.length).toBeGreaterThan(0)
    for (const frase of todas) {
      expect(frase).not.toMatch(/[!¡]/)
      expect(frase.toLowerCase()).not.toContain('enhorabuena')
      expect(frase.toLowerCase()).not.toContain('garantiza')
    }
  })
})
