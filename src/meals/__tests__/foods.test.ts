// Validación de la base de alimentos (docs/SPEC-ux-comidas-pdf.md §3.0, punto 4).
import { describe, expect, it } from 'vitest'
import type { Alimento } from '../../data/foods'
import {
  ALIMENTOS,
  ESTADOS_VALIDOS,
  GRUPOS_VALIDOS,
  ROLES_VALIDOS,
  TAGS_VALIDOS,
  alimentoPorId,
} from '../../data/foods'
import { filaRacion, limiteRacion, textoMedida } from '../escalado'

const IDS_CREMAS = ['mantequilla_cacahuete']

/** Predicados de las filas de `clampRacion` (§3.3), aplicados sin cortocircuito. */
function filasAplicables(a: Alimento): string[] {
  const rol = (r: string): boolean => (a.roles as string[]).includes(r)
  const filas: string[] = []
  if (a.grupo === 'proteina' && ['crudo', 'cocido', 'listo'].includes(a.estado) && !rol('carbohidrato')) {
    filas.push('proteina')
  }
  if (a.grupo === 'proteina' && rol('carbohidrato')) filas.push('proteina_con_hc')
  if (a.grupo === 'proteina' && a.estado === 'seco') filas.push('proteina_seca')
  if (a.grupo === 'lacteo' && rol('proteina') && a.grasa >= 20) filas.push('queso_curado')
  if (a.grupo === 'lacteo' && rol('proteina') && a.grasa < 20) filas.push('lacteo_proteico')
  if (a.grupo === 'lacteo' && rol('complemento') && !rol('proteina')) filas.push('lacteo_bebida')
  if (a.grupo === 'carbohidrato' && a.estado === 'cocido') filas.push('hc_cocido')
  if (a.grupo === 'carbohidrato' && a.estado === 'seco') filas.push('hc_seco')
  if (a.grupo === 'carbohidrato' && a.estado === 'listo') filas.push('hc_listo')
  if (a.grupo === 'carbohidrato' && a.estado === 'crudo') filas.push('hc_crudo')
  if (rol('grasa') && a.grasa >= 80) filas.push('grasa_pura')
  if (a.grupo === 'grasa' && a.grasa >= 25 && a.grasa < 80 && !IDS_CREMAS.includes(a.id)) filas.push('frutos_secos')
  if (a.grupo === 'grasa' && IDS_CREMAS.includes(a.id)) filas.push('crema')
  if (a.id === 'aceitunas') filas.push('aceitunas')
  if (a.id === 'aguacate') filas.push('aguacate')
  if (a.grupo === 'verdura' || a.grupo === 'fruta') filas.push('verdura_fruta')
  return filas
}

describe('base de alimentos', () => {
  it('tiene 101 alimentos y ningún id duplicado', () => {
    expect(ALIMENTOS.length).toBe(101)
    const ids = new Set(ALIMENTOS.map((a) => a.id))
    expect(ids.size).toBe(ALIMENTOS.length)
  })

  it('cumple kcal ≈ 4P + 4HC + 9G con un margen del 15 %', () => {
    for (const a of ALIMENTOS) {
      const atwater = 4 * a.proteina + 4 * a.carbohidratos + 9 * a.grasa
      const desviacion = Math.abs(a.kcal - atwater) / a.kcal
      expect(desviacion, `${a.id}: ${a.kcal} kcal frente a ${atwater.toFixed(1)}`).toBeLessThanOrEqual(0.15)
    }
  })

  it('solo usa valores del enum en grupo, estado, roles y tags', () => {
    for (const a of ALIMENTOS) {
      expect(GRUPOS_VALIDOS, a.id).toContain(a.grupo)
      expect(ESTADOS_VALIDOS, a.id).toContain(a.estado)
      expect(a.roles.length, a.id).toBeGreaterThan(0)
      for (const r of a.roles) expect(ROLES_VALIDOS, `${a.id}/${r}`).toContain(r)
      for (const t of a.tags) expect(TAGS_VALIDOS, `${a.id}/${t}`).toContain(t)
    }
  })

  it('mantiene coherentes fibra, hidratos netos y unidades contables', () => {
    for (const a of ALIMENTOS) {
      expect(a.fibra, a.id).toBeLessThanOrEqual(a.carbohidratos)
      expect(Math.abs(a.hc_netos - (a.carbohidratos - a.fibra)), a.id).toBeLessThan(0.001)
      if (a.unidad_g !== undefined) expect(a.unidad_nombre, a.id).toBeTruthy()
      if (a.unidad_nombre !== undefined) expect(a.unidad_g, a.id).toBeGreaterThan(0)
      expect(a.racionTipica_g, a.id).toBeGreaterThan(0)
      expect(a.medidaCasera.length, a.id).toBeGreaterThan(0)
      expect(a.fuente.length, a.id).toBeGreaterThan(0)
    }
  })

  it('etiqueta como vegetariano todo lo vegano y marca la lactosa en todos los lácteos', () => {
    for (const a of ALIMENTOS) {
      if (a.tags.includes('vegano')) expect(a.tags, a.id).toContain('vegetariano')
      if (a.grupo === 'lacteo') {
        const marcado = a.tags.includes('con_lactosa') || a.tags.includes('sin_lactosa')
        expect(marcado, `${a.id} no declara con_lactosa ni sin_lactosa`).toBe(true)
      }
    }
  })

  it('encaja cada alimento en exactamente una fila de clampRacion', () => {
    for (const a of ALIMENTOS) {
      const filas = filasAplicables(a)
      expect(filas.length, `${a.id}: filas ${filas.join(' + ') || '(ninguna)'}`).toBe(1)
    }
  })

  it('devuelve límites de ración usables para todos los alimentos', () => {
    for (const a of ALIMENTOS) {
      const base = filaRacion(a)
      const limite = limiteRacion(a)
      expect(base.min, a.id).toBeGreaterThan(0)
      expect(base.max, a.id).toBeGreaterThanOrEqual(base.min)
      expect(limite.max, a.id).toBeGreaterThanOrEqual(limite.min)
    }
  })

  it('escribe una medida casera coherente con el gramaje', () => {
    expect(textoMedida(alimentoPorId('huevo_entero')!, 165)).toBe('3 huevos M')
    expect(textoMedida(alimentoPorId('clara_huevo')!, 33)).toBe('1 clara')
    expect(textoMedida(alimentoPorId('atun_natural')!, 104)).toBe('2 latas pequeñas escurridas')
    expect(textoMedida(alimentoPorId('pechuga_pollo')!, 135)).toBe('1 pechuga mediana')
    expect(textoMedida(alimentoPorId('pechuga_pollo')!, 250)).toContain('ración generosa')
    expect(textoMedida(alimentoPorId('arroz_blanco_cocido')!, 60)).toContain('ración pequeña')
  })
})
