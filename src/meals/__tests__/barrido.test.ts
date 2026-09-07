// Barrido amplio: todas las preferencias × 2-6 comidas × 1.300-3.500 kcal × tres pesos × peri.
// Comprueba la regla dura de §3.3: una toma o cae dentro de la tolerancia, o lleva su nota.
// Ningún gramaje imposible puede publicarse en silencio.
import { describe, expect, it } from 'vitest'
import type { NComidas, Preferencia } from '../../engine/types'
import { generarEjemplos } from '../index'
import type { OpcionesPlan } from './fixtures'
import { inputsDe, resultadoDe } from './fixtures'

const PREFERENCIAS: Preferencia[] = ['omnivoro', 'vegetariano', 'vegano', 'sin_lactosa', 'sin_gluten', 'low_carb']
const COMIDAS: NComidas[] = [2, 3, 4, 5, 6]
const KCAL = [1300, 1800, 2300, 2800, 3500]
const PESOS = [55, 75, 100]

function planes(preferencia: Preferencia): OpcionesPlan[] {
  const lista: OpcionesPlan[] = []
  for (const nComidas of COMIDAS) {
    for (const kcal of KCAL) {
      for (const pesoKg of PESOS) {
        for (const peri of [null, 0, nComidas - 1]) {
          lista.push({ kcal, nComidas, preferencia, pesoKg, peri, edad: 30 + (kcal % 7) })
        }
      }
    }
  }
  return lista
}

describe('barrido de planes', () => {
  for (const preferencia of PREFERENCIAS) {
    it(`cierra o avisa en todas las tomas — ${preferencia}`, () => {
      let tomas = 0
      let dentro = 0
      for (const plan of planes(preferencia)) {
        const ejemplos = generarEjemplos(inputsDe(plan), resultadoDe(plan))
        const etiqueta = `${preferencia} ${plan.kcal} kcal / ${plan.nComidas} comidas / ${plan.pesoKg} kg / peri ${plan.peri}`
        expect(ejemplos.entreno.comidas.length).toBe(plan.nComidas)
        for (const comida of ejemplos.entreno.comidas) {
          tomas += 1
          const dKcal = Math.abs(comida.totales.kcal - comida.objetivo.kcal) / comida.objetivo.kcal
          const dProt = Math.abs(comida.totales.prot - comida.objetivo.prot) / comida.objetivo.prot
          if (dKcal <= 0.1 && dProt <= 0.15) {
            dentro += 1
            continue
          }
          const notas = ejemplos.entreno.notas.filter((n) => n.startsWith(`${comida.comida}:`))
          if (dKcal > 0.1) {
            expect(
              notas.some((n) => n.includes('kcal de tu objetivo')),
              `${etiqueta} · ${comida.comida}: ${comida.totales.kcal} vs ${comida.objetivo.kcal} kcal sin nota`,
            ).toBe(true)
          }
          if (dProt > 0.15) {
            expect(
              notas.some((n) => n.includes('proteína')),
              `${etiqueta} · ${comida.comida}: ${comida.totales.prot} vs ${comida.objetivo.prot} g de proteína sin nota`,
            ).toBe(true)
          }
        }
      }
      // El grueso del barrido incluye combinaciones extremas (55 kg con 3.500 kcal, 100 kg con
      // 1.300); aun así, la inmensa mayoría de las tomas debe cerrar sin nota. El umbral bajó de
      // 0,90 a 0,87 al hacer duros los máximos de ración de §3.3 (una toma grande se reparte en
      // varios platos en vez de triplicar las raciones) y al añadir los topes de plausibilidad de
      // los alimentos contables: las esquinas del barrido —vegano de 100 kg con 1.300 kcal, 110 g
      // de proteína en una sola toma— dejan de cerrar y salen con su nota, que es exactamente lo
      // que §3.3 manda hacer con ellas.
      expect(dentro / tomas, `${preferencia}: solo ${dentro} de ${tomas} tomas dentro`).toBeGreaterThan(0.87)
    })
  }
})
