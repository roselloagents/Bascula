// Resumen de alimentos excluidos y favoritos (§4.2 y §4.4, v1.2).
import { describe, expect, it } from 'vitest'
import { nombresCortos, resumenAlimentos } from '../etiquetas'

describe('nombresCortos', () => {
  it('traduce los ids a `nombre_corto` respetando el orden del usuario', () => {
    expect(nombresCortos(['coliflor', 'brocoli'])).toEqual(['Coliflor', 'Brócoli'])
  })

  it('descarta ids repetidos y los que no están en la base', () => {
    expect(nombresCortos(['brocoli', 'brocoli', 'no_existe'])).toEqual(['Brócoli'])
    expect(nombresCortos(null)).toEqual([])
    expect(nombresCortos(undefined)).toEqual([])
  })
})

describe('resumenAlimentos', () => {
  it('junta las dos mitades con el separador de la §2.5', () => {
    expect(resumenAlimentos(['brocoli'], ['pechuga_pollo'])).toBe('Sin: Brócoli · Favoritos: Pechuga de pollo')
  })

  it('omite la mitad que no aplica', () => {
    expect(resumenAlimentos(['brocoli'], [])).toBe('Sin: Brócoli')
    expect(resumenAlimentos([], ['pechuga_pollo'])).toBe('Favoritos: Pechuga de pollo')
  })

  it('devuelve cadena vacía sin listas, para que el PDF no pinte una línea en blanco', () => {
    expect(resumenAlimentos(null, undefined)).toBe('')
    expect(resumenAlimentos(['no_existe'], ['tampoco'])).toBe('')
  })

  it('da la variante en minúscula para la fila de datos de §4.2', () => {
    expect(resumenAlimentos(['brocoli'], ['pechuga_pollo'], true)).toBe(
      'sin Brócoli · favoritos Pechuga de pollo',
    )
  })
})
