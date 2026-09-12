// Notas fijas por condición compartidas por los dos bloques de menú (SPEC-dieta-propia §5.1).
// Vive aquí, junto al resto de la v1.3, para no pisar el fichero de pruebas del bloque compuesto.

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { NotasCondicion } from '../../components/resultados/NotasCondicion'
import { NOTA_CARDIACA, NOTA_DIABETES, NOTA_DIABETES_DIETA } from '../../components/utiles/copy'
import type { Condicion } from '../../engine/types'

function pintar(condiciones: Condicion[], dietaPropia?: boolean): string {
  return renderToStaticMarkup(createElement(NotasCondicion, { condiciones, dietaPropia }))
}

describe('NotasCondicion', () => {
  it('sin diabetes ni condición cardiaca no pinta nada', () => {
    expect(pintar([])).toBe('')
    expect(pintar(['tiroides', 'glp1'], true)).toBe('')
  })

  it('pinta las notas de siempre, sin la línea de la dieta propia', () => {
    const html = pintar(['diabetes', 'cardiaca'])
    expect(html).toContain(NOTA_DIABETES)
    expect(html).toContain(NOTA_CARDIACA)
    expect(html).not.toContain(NOTA_DIABETES_DIETA)
  })

  it('con dieta propia añade la línea de los gramos de hidratos, y solo con diabetes', () => {
    expect(pintar(['diabetes'], true)).toContain(NOTA_DIABETES_DIETA)
    expect(pintar(['cardiaca'], true)).not.toContain(NOTA_DIABETES_DIETA)
  })

  it('las tres notas van en `.nota.nota-recuadro`, como en el bloque de hoy', () => {
    const html = pintar(['diabetes'], true)
    expect(html.match(/class="nota nota-recuadro"/g)).toHaveLength(2)
  })
})
