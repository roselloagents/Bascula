// Bloque "Equivalencias" (docs/SPEC-ux-comidas-pdf.md §2.5 y §4.4).
import { describe, expect, it } from 'vitest'
import { alimentoPorId } from '../../data/foods'
import type { Preferencia } from '../../engine/types'
import { equivalencias } from '../equivalencias'
import { limiteRacion } from '../escalado'
import { pasaPreferencia } from '../filtros'

const PREFERENCIAS: Preferencia[] = ['omnivoro', 'vegetariano', 'vegano', 'sin_lactosa', 'sin_gluten', 'low_carb']

describe('tablas de equivalencias', () => {
  for (const preferencia of PREFERENCIAS) {
    it(`respeta el filtro de preferencia y los límites de ración — ${preferencia}`, () => {
      const { tablas } = equivalencias(preferencia)
      expect(tablas).toHaveLength(3)
      for (const tabla of tablas) {
        expect(tabla.filas.length, `${preferencia} · ${tabla.titulo}`).toBeGreaterThan(2)
        for (const fila of tabla.filas) {
          const a = alimentoPorId(fila.id)
          expect(a, fila.id).toBeDefined()
          expect(pasaPreferencia(a!, preferencia), `${preferencia} · ${fila.id}`).toBe(true)
          const { min, max } = limiteRacion(a!)
          expect(fila.gramos, `${preferencia} · ${fila.id}: ${fila.gramos} g`).toBeGreaterThanOrEqual(min)
          expect(fila.gramos, `${preferencia} · ${fila.id}: ${fila.gramos} g`).toBeLessThanOrEqual(max)
          expect(fila.medida.length).toBeGreaterThan(0)
        }
      }
    })
  }

  it('la tabla de grasas no cuela fuentes de proteína', () => {
    const grasas = equivalencias('omnivoro').tablas[2]
    for (const fila of grasas.filas) {
      const a = alimentoPorId(fila.id)!
      expect(a.grupo, fila.id).toBe('grasa')
      expect(a.roles.includes('proteina'), fila.id).toBe(false)
    }
  })

  it('cada ración equivale a la referencia de su tabla (±25 %)', () => {
    const [proteina, hidratos, grasa] = equivalencias('omnivoro').tablas
    const cerca = (real: number, objetivo: number): boolean => Math.abs(real - objetivo) / objetivo <= 0.25
    for (const f of proteina.filas) {
      const a = alimentoPorId(f.id)!
      expect(cerca((a.proteina * f.gramos) / 100, 20), `${f.id}`).toBe(true)
    }
    for (const f of hidratos.filas) {
      const a = alimentoPorId(f.id)!
      expect(cerca((a.carbohidratos * f.gramos) / 100, 30), `${f.id}`).toBe(true)
    }
    for (const f of grasa.filas) {
      const a = alimentoPorId(f.id)!
      expect(cerca((a.grasa * f.gramos) / 100, 10), `${f.id}`).toBe(true)
    }
  })
})
