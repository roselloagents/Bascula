// Barrido de invariantes de seguridad del motor (SPEC-calculo.md §2, pasos 9 y 10).
// El invariante clave es `suelo_g ≤ G ≤ techo_g`: el redondeo a 5 g de la grasa no puede dejarla
// por debajo del suelo obligatorio ni por encima de su techo en ningún perfil válido.

import { describe, expect, it } from 'vitest'
import { calcular } from '../index'
import {
  GRASA_SUELO_GKG_HOMBRE,
  GRASA_SUELO_GKG_MUJER,
  GRASA_SUELO_PCT_KCAL,
  GRASA_TECHO_PCT_KCAL,
  GRASA_TECHO_PCT_KCAL_LOWCARB,
} from '../constants'
import type { Inputs, Preferencia, Ritmo, Sexo } from '../types'

const BASE: Inputs = {
  sexo: 'mujer',
  edad: 60,
  altura_cm: 190,
  peso_kg: 90,
  grasa: { metodo: 'desconocido' },
  somatotipo: null,
  actividad_diaria: 'sedentario',
  entrenamiento: {
    tipo: 'ninguno',
    dias_semana: 0,
    minutos_sesion: 60,
    intensidad: 'media',
    experiencia: 'novato',
    momento: null,
  },
  objetivo: 'perder',
  ritmo: 'suave',
  peso_objetivo: null,
  preferencia: 'vegano',
  n_comidas: 4,
  clima_caluroso: false,
  embarazo_lactancia: false,
  condiciones: [],
  cribado_tca: null,
  fecha_inicio: '2026-09-07',
}

/** Reproduce los límites del paso 9 con las kcal finales del plan. */
function limitesGrasa(inputs: Inputs, r: ReturnType<typeof calcular>): [number, number] {
  const suelo_gkg = inputs.sexo === 'hombre' ? GRASA_SUELO_GKG_HOMBRE : GRASA_SUELO_GKG_MUJER
  const pctTecho =
    r.preferencia_efectiva === 'low_carb' ? GRASA_TECHO_PCT_KCAL_LOWCARB : GRASA_TECHO_PCT_KCAL
  return [
    Math.max(suelo_gkg * r.macros.base_kg, GRASA_SUELO_PCT_KCAL * r.kcal / 9),
    pctTecho * r.kcal / 9,
  ]
}

describe('paso 9 — la grasa nunca sale de su franja', () => {
  it('el caso mínimo de la revisión adversaria respeta el suelo', () => {
    const r = calcular(BASE)
    const [suelo, techo] = limitesGrasa(BASE, r)
    expect(r.macros.grasa_g).toBeGreaterThanOrEqual(suelo)
    expect(r.macros.grasa_g).toBeLessThanOrEqual(techo)
  })

  it('barrido de perfiles válidos: suelo_g ≤ G ≤ techo_g y kcal_cierre dentro del 2 %', () => {
    const sexos: Sexo[] = ['hombre', 'mujer']
    const prefs: Preferencia[] = ['omnivoro', 'vegano', 'vegetariano', 'low_carb', 'sin_gluten']
    const ritmos: Ritmo[] = ['suave', 'moderado', 'agresivo']
    let casos = 0
    for (const sexo of sexos) {
      for (const edad of [18, 30, 45, 60, 75]) {
        for (const altura of [150, 165, 180, 190, 210]) {
          for (const peso of [40, 55, 70, 90, 120, 160]) {
            for (const pref of prefs) {
              for (const ritmo of ritmos) {
                for (const objetivo of ['perder', 'mantener', 'ganar', 'recomposicion'] as const) {
                  const inputs: Inputs = { ...BASE, sexo, edad, altura_cm: altura, peso_kg: peso, preferencia: pref, ritmo, objetivo }
                  const r = calcular(inputs)
                  if (r.excluido) continue
                  casos++
                  const [suelo, techo] = limitesGrasa(inputs, r)
                  if (r.macros.grasa_g < suelo || r.macros.grasa_g > techo) {
                    throw new Error(
                      `franja de grasa violada: ${JSON.stringify({ sexo, edad, altura, peso, pref, ritmo, objetivo, G: r.macros.grasa_g, suelo, techo })}`,
                    )
                  }
                  expect(Math.abs(r.kcal_cierre - r.kcal)).toBeLessThanOrEqual(0.02 * r.kcal)
                }
              }
            }
          }
        }
      }
    }
    expect(casos).toBeGreaterThan(1000)
  })
})
