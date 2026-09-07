// La silueta resaltada del paso 7 no puede contradecir al somatotipo que acabará en el plan.

import { describe, expect, it } from 'vitest'
import { clasificarSomatotipo } from '../../../engine/macros'
import type { InputSomatotipo } from '../../../engine/types'
import { somatotipoProvisional } from '../somatotipo'

const Q1: InputSomatotipo['q1'][] = ['fina', 'media', 'ancha']
const Q2: InputSomatotipo['q2'][] = ['poca', 'moderada', 'mucha']
const Q3: InputSomatotipo['q3'][] = ['poca', 'moderada', 'mucha']
const Q4: InputSomatotipo['q4'][] = ['delgado', 'atletico', 'robusto']

describe('somatotipoProvisional', () => {
  it('sin ninguna respuesta no resalta ninguna silueta', () => {
    expect(somatotipoProvisional({})).toBeNull()
  })

  it('con las cuatro respuestas coincide con el motor en las 81 combinaciones', () => {
    for (const q1 of Q1) {
      for (const q2 of Q2) {
        for (const q3 of Q3) {
          for (const q4 of Q4) {
            const respuestas = { q1, q2, q3, q4 }
            expect(somatotipoProvisional(respuestas), JSON.stringify(respuestas)).toBe(
              clasificarSomatotipo(respuestas),
            )
          }
        }
      }
    }
  })

  it('reacciona ya con la primera respuesta', () => {
    expect(somatotipoProvisional({ q1: 'fina' })).toBe('ectomorfo')
    expect(somatotipoProvisional({ q1: 'media' })).toBe('mesomorfo')
    expect(somatotipoProvisional({ q1: 'ancha' })).toBe('endomorfo')
    expect(somatotipoProvisional({ q4: 'robusto' })).toBe('endomorfo')
  })

  it('con dos respuestas exige que las dos vayan en el mismo sentido', () => {
    expect(somatotipoProvisional({ q1: 'ancha', q2: 'mucha' })).toBe('endomorfo')
    expect(somatotipoProvisional({ q1: 'ancha', q2: 'moderada' })).toBe('mesomorfo')
    expect(somatotipoProvisional({ q1: 'fina', q4: 'robusto' })).toBe('mesomorfo')
  })

  it('la pregunta del músculo sola no decide nada', () => {
    expect(somatotipoProvisional({ q3: 'mucha' })).toBe('mesomorfo')
    expect(somatotipoProvisional({ q3: 'poca' })).toBe('mesomorfo')
  })
})
