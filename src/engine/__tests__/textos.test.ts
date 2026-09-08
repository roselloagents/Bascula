// Los textos de la §4 tienen que decir el número que el motor aplicó de verdad: es la primera
// línea de la spec ("todo número visible sale del motor").
import { describe, expect, it } from 'vitest'
import { calcular, textosAvisos } from '../index'
import type { Inputs } from '../types'

const BASE: Inputs = {
  sexo: 'hombre',
  edad: 30,
  altura_cm: 150,
  peso_kg: 60,
  grasa: { metodo: 'conocido', valor: 26, fuente: 'fiable' },
  somatotipo: null,
  actividad_diaria: 'sedentario',
  entrenamiento: {
    tipo: 'fuerza',
    dias_semana: 6,
    minutos_sesion: 120,
    intensidad: 'alta',
    experiencia: 'avanzado',
    momento: 'tarde',
  },
  objetivo: 'perder',
  ritmo: 'agresivo',
  peso_objetivo: null,
  preferencia: 'omnivoro',
  n_comidas: 4,
  clima_caluroso: false,
  embarazo_lactancia: false,
  condiciones: [],
  cribado_tca: null,
  fecha_inicio: '2026-09-07',
}

describe('textos de la §4 con números condicionales', () => {
  it('WARN_SUELO_CALORICO_EA dice 25 kcal/kg en banda muy_alto, no 30', () => {
    const resultado = calcular(BASE)
    expect(resultado.grasa.banda).toBe('muy_alto')
    const aviso = textosAvisos(resultado, BASE).find((a) => a.codigo === 'WARN_SUELO_CALORICO_EA')
    expect(aviso, 'el caso debe activar el suelo de disponibilidad energética').toBeDefined()
    // Disponibilidad energética realmente entregada: (kcal − ejercicio) / MLG.
    const ea = (resultado.kcal - resultado.tdee.ejercicio_dia) / resultado.mlg
    expect(ea).toBeLessThan(30)
    expect(ea).toBeGreaterThanOrEqual(24.9)
    expect(aviso!.texto).toContain('25 kcal por kilo')
    expect(aviso!.texto).not.toContain('30 kcal por kilo')
  })

  it('INFO_PROTEINA_CAPADA imprime el pct_cap publicado por el motor', () => {
    const vegana: Inputs = {
      ...BASE,
      sexo: 'mujer',
      altura_cm: 162,
      peso_kg: 66,
      grasa: { metodo: 'visual', categoria: 'media' },
      entrenamiento: {
        tipo: 'ninguno',
        dias_semana: 0,
        minutos_sesion: 0,
        intensidad: 'media',
        experiencia: 'novato',
        momento: null,
      },
      preferencia: 'vegano',
      n_comidas: 2,
      peso_objetivo: 48,
    }
    const resultado = calcular(vegana)
    expect(resultado.macros.pct_cap).toBe(0.3)
    const aviso = textosAvisos(resultado, vegana).find((a) => a.codigo === 'INFO_PROTEINA_CAPADA')
    expect(aviso!.texto).toContain('30 %')
  })

  it('INFO_OBJETIVO_RESUELTO habla del objetivo que propuso la regla 6.1', () => {
    // IMC 17,99: la regla 6.1 propone `mantener` y el texto tiene que decirlo.
    const delgada: Inputs = {
      ...BASE,
      sexo: 'mujer',
      edad: 30,
      altura_cm: 170,
      peso_kg: 52,
      grasa: { metodo: 'desconocido' },
      entrenamiento: {
        tipo: 'ninguno',
        dias_semana: 0,
        minutos_sesion: 0,
        intensidad: 'media',
        experiencia: 'novato',
        momento: null,
      },
      objetivo: 'no_se',
    }
    const resultado = calcular(delgada)
    expect(resultado.objetivo_propuesto).toBe('mantener')
    const aviso = textosAvisos(resultado, delgada).find(
      (a) => a.codigo === 'INFO_OBJETIVO_RESUELTO',
    )
    expect(aviso!.texto).toContain('mantener tu peso')
  })

  it('con objetivo "no lo sé" y meta igual al peso actual se resuelve mantener', () => {
    const igual: Inputs = {
      ...BASE,
      sexo: 'hombre',
      altura_cm: 175,
      peso_kg: 80,
      grasa: { metodo: 'desconocido' },
      entrenamiento: {
        tipo: 'ninguno',
        dias_semana: 0,
        minutos_sesion: 0,
        intensidad: 'media',
        experiencia: 'novato',
        momento: null,
      },
      objetivo: 'no_se',
      peso_objetivo: 80,
    }
    const resultado = calcular(igual)
    expect(resultado.objetivo_efectivo).toBe('mantener')
    expect(resultado.avisos).toContain('INFO_OBJETIVO_IGUAL')
    expect(resultado.avisos).not.toContain('INFO_OBJETIVO_RESUELTO')
  })
})
