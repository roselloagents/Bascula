// Notas fijas por condición médica encima de los bloques de menú (SPEC-ux §3.1 y
// SPEC-dieta-propia §5.1). Las comparten "Un día de ejemplo" y "Tu menú, con lo tuyo dentro":
// el texto es el mismo, y con la dieta propia se añade una línea más sobre los hidratos.

import type { Condicion } from '../../engine/types'
import { NOTA_CARDIACA, NOTA_DIABETES, NOTA_DIABETES_DIETA } from '../utiles/copy'

interface Props {
  condiciones: Condicion[]
  /** `true` en el bloque compuesto: los gramos de hidratos los ha movido el algoritmo (§5.1). */
  dietaPropia?: boolean
}

export function NotasCondicion({ condiciones, dietaPropia = false }: Props) {
  const diabetes = condiciones.includes('diabetes')
  const cardiaca = condiciones.includes('cardiaca')
  if (!diabetes && !cardiaca) return null
  return (
    <>
      {diabetes ? <p className="nota nota-recuadro">{NOTA_DIABETES}</p> : null}
      {diabetes && dietaPropia ? <p className="nota nota-recuadro">{NOTA_DIABETES_DIETA}</p> : null}
      {cardiaca ? <p className="nota nota-recuadro">{NOTA_CARDIACA}</p> : null}
    </>
  )
}
