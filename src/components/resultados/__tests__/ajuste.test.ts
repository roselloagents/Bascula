// Panel "Ajusta tus macros" (§2.2b) contra el motor real: la pantalla no calcula macros, los
// pide a `ajustarMacros`. Aquí se comprueba el enganche (límites, palancas, persistencia) y que
// la proteína no se mueve nunca.

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { calcular, textosAvisos } from '../../../engine'
import type { AjusteMacros, InputCalculo, Resultado } from '../../../engine/types'
import { PanelAjuste } from '../PanelAjuste'
import { CLAVE_AJUSTE, aplicarAjuste, cargarAjuste, guardarAjuste, hayPanelAjuste } from '../ajuste'

const almacen = new Map<string, string>()
vi.stubGlobal('window', {
  localStorage: {
    getItem: (clave: string) => almacen.get(clave) ?? null,
    setItem: (clave: string, valor: string) => void almacen.set(clave, valor),
    removeItem: (clave: string) => void almacen.delete(clave),
  },
})

const INPUTS: InputCalculo = {
  sexo: 'mujer',
  edad: 34,
  altura_cm: 165,
  peso_kg: 60,
  grasa: { metodo: 'desconocido' },
  somatotipo: null,
  actividad_diaria: 'ligero',
  entrenamiento: {
    tipo: 'fuerza',
    dias_semana: 3,
    minutos_sesion: 55,
    intensidad: 'media',
    experiencia: 'novato',
    momento: 'manana',
  },
  objetivo: 'recomposicion',
  ritmo: 'moderado',
  peso_objetivo: null,
  preferencia: 'omnivoro',
  preferencia_base: 'omnivoro',
  restricciones: [],
  low_carb: false,
  recomposicion_prioridad: 'equilibrado',
  menstruacion: 'regular',
  n_comidas: 3,
  clima_caluroso: false,
  embarazo_lactancia: false,
  condiciones: [],
  cribado_tca: null,
  fecha_inicio: '2026-01-05',
}

function plan(): Resultado & { limites_ajuste: NonNullable<Resultado['limites_ajuste']> } {
  const resultado = calcular(INPUTS)
  expect(resultado.excluido).toBeFalsy()
  if (!hayPanelAjuste(resultado)) throw new Error('el motor debe publicar limites_ajuste')
  return resultado
}

function marcado(ajuste: AjusteMacros | null): string {
  return renderToStaticMarkup(
    createElement(PanelAjuste, {
      base: plan(),
      inputs: INPUTS,
      ajuste,
      onAplicar: () => undefined,
    }),
  )
}

beforeEach(() => almacen.clear())

describe('panel de ajuste', () => {
  it('arranca cerrado, con el copy normativo y el plan recomendado en los controles', () => {
    const base = plan()
    const html = marcado(null)
    expect(html).toContain('Ajusta tus macros')
    expect(html).toContain('¿Comes menos hidratos de los que te proponemos? Cámbialos aquí.')
    expect(html).toContain('La proteína no se toca')
    expect(html).not.toContain('<details class="panel-ajuste" open')
    // El deslizador arranca en los hidratos recomendados y el control de kcal en las suyas.
    expect(html).toContain(`aria-valuetext="${base.limites_ajuste.hc_recomendado_g} gramos de hidratos al día"`)
    expect(html).toContain('Bajar 50 calorías')
    expect(html).toContain('Subir 50 calorías')
  })

  it('con ajuste activo lleva el distintivo "ajustado por ti"', () => {
    const base = plan()
    expect(marcado(null)).not.toContain('ajustado por ti')
    expect(marcado({ hc_g: base.limites_ajuste.hc_min_ui_g })).toContain('ajustado por ti')
  })

  it('el resumen en vivo son los macros que devuelve el motor, no un cálculo propio', () => {
    const base = plan()
    const ajuste: AjusteMacros = { hc_g: 80 }
    const ajustado = aplicarAjuste(base, ajuste)
    const html = marcado(ajuste)
    expect(html).toContain(`${Math.round(ajustado.macros.proteina_g)} g de proteína`)
    expect(html).toContain(`${Math.round(ajustado.macros.grasa_g)} g de grasa`)
    expect(html).toContain(`${Math.round(ajustado.macros.hc_g)} g de hidratos`)
  })
})

describe('aplicar el ajuste', () => {
  it('baja los hidratos, sube la grasa y deja la proteína intacta', () => {
    const base = plan()
    const ajustado = aplicarAjuste(base, { hc_g: 80 })
    expect(ajustado.macros.hc_g).toBeLessThan(base.macros.hc_g)
    expect(ajustado.macros.grasa_g).toBeGreaterThan(base.macros.grasa_g)
    expect(ajustado.macros.proteina_g).toBe(base.macros.proteina_g)
    expect(ajustado.ajuste?.hc).toBe(true)
  })

  it('rehace el reparto por comidas y la proyección con el plan ajustado', () => {
    const base = plan()
    const ajustado = aplicarAjuste(base, { kcal: base.limites_ajuste.kcal_min })
    expect(ajustado.kcal).toBe(base.limites_ajuste.kcal_min)
    expect(ajustado.comidas.length).toBe(base.comidas.length)
    expect(ajustado.comidas[0].kcal).not.toBe(base.comidas[0].kcal)
    expect(ajustado.proyeccion).toBeDefined()
  })

  it('sin ajuste devuelve el plan recomendado tal cual ("Volver a lo recomendado")', () => {
    const base = plan()
    expect(aplicarAjuste(base, null)).toBe(base)
    expect(aplicarAjuste(base, {})).toBe(base)
  })

  it('bajar los hidratos por debajo del mínimo avisa, no bloquea', () => {
    const base = plan()
    const ajustado = aplicarAjuste(base, { hc_g: base.limites_ajuste.hc_min_ui_g })
    expect(ajustado.macros.hc_g).toBeLessThan(base.limites_ajuste.hc_min_motor_g)
    const codigos = textosAvisos(ajustado, INPUTS).map((a) => a.codigo)
    expect(codigos).toContain('WARN_HC_BAJO_MINIMO')
  })
})

describe('persistencia del ajuste', () => {
  it('se guarda solo el ajuste, nunca el plan ajustado', () => {
    guardarAjuste({ hc_g: 90 })
    expect(JSON.parse(almacen.get(CLAVE_AJUSTE) ?? '{}')).toEqual({ hc_g: 90 })
    expect(cargarAjuste()).toEqual({ hc_g: 90 })
  })

  it('"volver a lo recomendado" borra la clave', () => {
    guardarAjuste({ kcal: 1800 })
    guardarAjuste(null)
    expect(almacen.has(CLAVE_AJUSTE)).toBe(false)
    expect(cargarAjuste()).toBeNull()
  })

  it('una clave con basura no rompe la pantalla', () => {
    almacen.set(CLAVE_AJUSTE, '{"kcal":"muchas"}')
    expect(cargarAjuste()).toBeNull()
    almacen.set(CLAVE_AJUSTE, 'no es json')
    expect(cargarAjuste()).toBeNull()
  })
})

describe('tarjeta del ciclo (§2.2c)', () => {
  it('la regla regular produce INFO_CICLO y no cambia ningún número', () => {
    const conRegla = calcular(INPUTS)
    const sinRegla = calcular({ ...INPUTS, menstruacion: null })
    expect(conRegla.avisos).toContain('INFO_CICLO')
    expect(sinRegla.avisos).not.toContain('INFO_CICLO')
    expect(conRegla.kcal).toBe(sinRegla.kcal)
    expect(conRegla.macros).toEqual(sinRegla.macros)
  })
})
