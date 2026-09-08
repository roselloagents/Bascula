// Las alternativas por comida ("Cambia X g de A por Y g de B") tienen que cumplir lo que promete
// el copy que las rodea: sustituir sin descuadrar los macros. `redondearGramos` recorta la ración
// equivalente a los límites del alimento, y ese recorte llegó a publicar "+147 % de hidratos".
import { describe, expect, it } from 'vitest'
import { ALIMENTOS } from '../../data/foods'
import type { Alimento } from '../../data/foods'
import type { NComidas, Preferencia } from '../../engine/types'
import { generarEjemplos } from '../index'
import { nombreCorto } from '../textos'
import type { OpcionesPlan } from './fixtures'
import { inputsDe, resultadoDe } from './fixtures'

const PREFERENCIAS: Preferencia[] = [
  'omnivoro',
  'vegetariano',
  'vegano',
  'sin_lactosa',
  'sin_gluten',
  'low_carb',
]
const COMIDAS: NComidas[] = [3, 4, 5]
const KCAL = [1400, 1900, 2400, 3000]
const PESOS = [55, 80, 105]

/** `nombreCorto` no es único (crudo/cocido comparten nombre): se guardan todos los homónimos. */
const PORNOMBRE = new Map<string, Alimento[]>()
for (const a of ALIMENTOS) {
  const clave = nombreCorto(a)
  PORNOMBRE.set(clave, [...(PORNOMBRE.get(clave) ?? []), a])
}

const LINEA = /^Cambia (\d+(?:[.,]\d+)?) g de (.+?) por (\d+(?:[.,]\d+)?) g de (.+?)\.$/

/** Desviación relativa del macro que mejor cuadra entre las dos raciones de una alternativa. */
function desviacion(texto: string): number | null {
  const m = LINEA.exec(texto)
  if (!m) return null
  const [, gA, nA, gB, nB] = m
  const origenes = PORNOMBRE.get(nA) ?? []
  const destinos = PORNOMBRE.get(nB) ?? []
  let mejor: number | null = null
  for (const a of origenes) {
    for (const b of destinos) {
      for (const macro of ['proteina', 'carbohidratos', 'grasa'] as const) {
        const x = (a[macro] * Number(gA.replace(',', '.'))) / 100
        const y = (b[macro] * Number(gB.replace(',', '.'))) / 100
        if (x <= 0) continue
        const d = Math.abs(y - x) / x
        if (mejor === null || d < mejor) mejor = d
      }
    }
  }
  return mejor
}

describe('alternativas por comida', () => {
  for (const preferencia of PREFERENCIAS) {
    it(`ninguna sustitución se pasa del ±15 % — ${preferencia}`, () => {
      let lineas = 0
      for (const nComidas of COMIDAS) {
        for (const kcal of KCAL) {
          for (const pesoKg of PESOS) {
            const plan: OpcionesPlan = { kcal, nComidas, preferencia, pesoKg, peri: null, edad: 34 }
            for (const sencillo of [false, true]) {
              const variante = sencillo ? 'sencillo' : 'normal'
              const ejemplos = generarEjemplos(
                { ...inputsDe(plan), menu_sencillo: sencillo },
                resultadoDe(plan),
              )
              for (const comida of ejemplos.entreno.comidas) {
                for (const texto of comida.alternativas) {
                  const d = desviacion(texto)
                  lineas += 1
                  // `null` = alguno de los dos nombres no está en la base: entonces no se puede
                  // medir, pero tampoco se ha podido generar, así que no debería ocurrir.
                  expect(
                    d,
                    `${preferencia} ${kcal} kcal ${variante}: "${texto}" no medible`,
                  ).not.toBeNull()
                  expect(
                    d ?? 1,
                    `${preferencia} ${kcal} kcal / ${nComidas} comidas / ${pesoKg} kg ${variante}: "${texto}" se desvía un ${Math.round((d ?? 1) * 100)} %`,
                  ).toBeLessThanOrEqual(0.15 + 1e-9)
                }
              }
            }
          }
        }
      }
      expect(
        lineas,
        `${preferencia}: el barrido no ha generado ninguna alternativa`,
      ).toBeGreaterThan(50)
    })
  }
})
