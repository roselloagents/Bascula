// Vista previa del somatotipo mientras se contesta el paso 7.
// La interfaz NO implementa la fórmula: con las cuatro respuestas dadas delega en
// `clasificarSomatotipo`, la misma función que usa el motor (SPEC-calculo §3.2), para que la
// silueta resaltada en el cuestionario y el somatotipo del plan no puedan discrepar nunca.

import { SOMA_Q1, SOMA_Q2, SOMA_Q4 } from '../../engine/constants'
import { clasificarSomatotipo } from '../../engine/macros'
import type { InputSomatotipo, Somatotipo } from '../../engine/types'

/**
 * Somatotipo que corresponde a las respuestas dadas **hasta el momento**.
 *
 * - Sin ninguna respuesta devuelve `null`: no se resalta ninguna silueta.
 * - Con las cuatro respuestas devuelve exactamente lo que devolvería el motor.
 * - Con respuestas incompletas usa el mismo marcador (las que faltan suman 0) pero con el umbral
 *   proporcional a lo contestado, para que la silueta reaccione ya con la primera respuesta en
 *   vez de quedarse en «mesomorfo» hasta la tercera. Es una previsualización, no un cálculo:
 *   ningún número del plan depende de ella.
 */
export function somatotipoProvisional(parcial: Partial<InputSomatotipo>): Somatotipo | null {
  const { q1, q2, q3, q4 } = parcial
  if (!q1 && !q2 && !q3 && !q4) return null
  if (q1 && q2 && q3 && q4) return clasificarSomatotipo({ q1, q2, q3, q4 })

  let puntuacion = 0
  let respondidas = 0
  if (q1) {
    puntuacion += SOMA_Q1[q1]
    respondidas += 1
  }
  if (q2) {
    puntuacion += SOMA_Q2[q2]
    respondidas += 1
  }
  if (q4) {
    puntuacion += SOMA_Q4[q4]
    respondidas += 1
  }
  // Mismo ajuste por facilidad para ganar músculo que el motor (§3.2).
  if (q3 === 'mucha' && puntuacion !== 0) puntuacion -= Math.sign(puntuacion)
  if (q3 === 'poca' && puntuacion < 0) puntuacion = Math.max(puntuacion - 1, -3)

  const umbral = respondidas <= 1 ? 1 : 2
  if (puntuacion <= -umbral) return 'ectomorfo'
  if (puntuacion >= umbral) return 'endomorfo'
  return 'mesomorfo'
}
