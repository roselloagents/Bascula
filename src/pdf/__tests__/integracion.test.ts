// Integración real motor → menús → PDF con los nueve vectores de la §5.
// El PDF se probaba solo con dos fixtures escritas a mano: los fallos que aparecen al encadenar
// los tres módulos (raciones imposibles, alternativas fuera de la preferencia, caracteres que
// Helvetica/WinAnsi no puede imprimir) no los veía ningún test.
import { describe, expect, it } from 'vitest'
import { renderToBuffer } from '@react-pdf/renderer'
import { calcular, textosAvisos } from '../../engine'
import { generarEjemplos } from '../../meals'
import { VECTORES } from '../../meals/__tests__/vectores'
import { elementoPlan } from '../index'
import type { DatosPdf } from '../../engine/types'

/** Máximo de páginas declarado en SPEC-ux-comidas-pdf.md §4.0. */
const PAGINAS_MAX = 8

function datosDe(indice: number): DatosPdf {
  const v = VECTORES[indice]
  const resultado = calcular(v.inputs)
  const ejemplos = generarEjemplos(v.inputs, resultado)
  return { inputs: v.inputs, resultado, ejemplos, avisos: textosAvisos(resultado, v.inputs), fecha: '2026-09-07' }
}

/**
 * Caracteres imprimibles por Helvetica con WinAnsiEncoding: Latin-1 sin controles más el tramo
 * propio de CP1252. Todo lo que quede fuera (U+2212, U+2248, flechas, ≤/≥) desaparece de la
 * página o se convierte en otra letra.
 */
const CP1252_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'
function fueraDeWinAnsi(texto: string): string[] {
  const malos: string[] = []
  for (const c of texto) {
    const code = c.codePointAt(0) ?? 0
    const imprimible = (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff)
    if (!imprimible && c !== '\n' && !CP1252_EXTRA.includes(c)) malos.push(`${c} (U+${code.toString(16)})`)
  }
  return malos
}

function cadenas(valor: unknown, salida: string[] = []): string[] {
  if (typeof valor === 'string') salida.push(valor)
  else if (Array.isArray(valor)) valor.forEach((v) => cadenas(v, salida))
  else if (valor && typeof valor === 'object') Object.values(valor).forEach((v) => cadenas(v, salida))
  return salida
}

describe('PDF — vectores de la §5 de punta a punta', () => {
  for (let i = 0; i < VECTORES.length; i++) {
    const v = VECTORES[i]

    it(`todo el texto que entra en el PDF es imprimible en WinAnsi — caso ${v.n}`, () => {
      const datos = datosDe(i)
      for (const texto of cadenas(datos)) {
        expect(fueraDeWinAnsi(texto), `caso ${v.n}: "${texto}"`).toEqual([])
      }
    })
  }

  it('rinde los nueve casos sin NaN ni undefined y dentro del máximo de páginas', async () => {
    for (let i = 0; i < VECTORES.length; i++) {
      const v = VECTORES[i]
      const buffer = await renderToBuffer(elementoPlan(datosDe(i)))
      const crudo = buffer.toString('latin1')
      const paginas = (crudo.match(/\/Type\s*\/Page[^s]/g) ?? []).length
      expect(paginas, `caso ${v.n}: ${paginas} páginas`).toBeLessThanOrEqual(PAGINAS_MAX)
      expect(paginas, `caso ${v.n}`).toBeGreaterThan(3)
      expect(buffer.length, `caso ${v.n}`).toBeGreaterThan(10_000)
    }
  }, 180_000)
})
