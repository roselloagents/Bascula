// Integración real motor → menús → PDF con los catorce vectores de la §5, en los dos modos.
// El PDF se probaba solo con dos fixtures escritas a mano: los fallos que aparecen al encadenar
// los tres módulos (raciones imposibles, alternativas fuera de la preferencia, caracteres que
// Helvetica/WinAnsi no puede imprimir) no los veía ningún test.
import { describe, expect, it } from 'vitest'
import { renderToBuffer } from '@react-pdf/renderer'
import { calcular, textosAvisos } from '../../engine'
import { generarEjemplos } from '../../meals'
import { VECTORES } from '../../meals/__tests__/vectores'
import { elementoPlan } from '../index'
import { CP1252_EXTRA, winAnsi } from '../formato'
import type { DatosPdf } from '../../engine/types'

/**
 * Máximo de páginas declarado en SPEC-ux-comidas-pdf.md §4.0, ya con la página de la compra
 * (§4.4b) y con la proyección y el seguimiento de la v1.1 (§4.5b), que suben el rango a 6-10
 * páginas: la tabla semana a semana de la proyección puede llegar a 27 filas.
 *
 * El recuento va **por vector y por modo**: son 28 renderizados, no 14. Se quedan en 8 páginas
 * ocho de ellos, los extremos de la §5 por dos motivos distintos: muchos avisos (caso 8 con once,
 * caso 10 con nueve, caso 14 con diez, los tres en los dos modos) y mucha comida que listar
 * (casos 9 y 11, por encima de 3.100 kcal y con listas de la compra de 18 líneas, y solo en modo
 * normal: el modo sencillo los baja a 7). Los otros dieciocho renderizados caben en 7 páginas, y
 * los dos más cortos —caso 13, renal y sin menú— en 6. Ninguno baja de ahí.
 */
const PAGINAS_MAX = 10


/** Tope de alimentos distintos del modo sencillo (SPEC-ux-comidas-pdf.md §3.7.2). */
const ALIMENTOS_MAX_SENCILLO = 12

function datosDe(indice: number, sencillo = false): DatosPdf {
  const inputs = { ...VECTORES[indice].inputs, menu_sencillo: sencillo }
  const resultado = calcular(inputs)
  const ejemplos = generarEjemplos(inputs, resultado)
  return { inputs, resultado, ejemplos, avisos: textosAvisos(resultado, inputs), fecha: '2026-09-07' }
}

/**
 * Caracteres imprimibles por Helvetica con WinAnsiEncoding: Latin-1 sin controles más el tramo
 * propio de CP1252. Todo lo que quede fuera (U+2212, U+2248, flechas, ≤/≥) desaparece de la
 * página o se convierte en otra letra.
 */
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
      // La lista de la compra llega con los `≈` de `mercadona.json`, que WinAnsi no tiene: el
      // documento la pasa por `winAnsi()` antes de imprimirla, así que se comprueba ya saneada.
      const { compra, ...restoEjemplos } = datos.ejemplos
      const textos = [
        ...cadenas({ ...datos, ejemplos: restoEjemplos }),
        ...cadenas(compra ?? null).map(winAnsi),
      ]
      for (const texto of textos) {
        expect(fueraDeWinAnsi(texto), `caso ${v.n}: "${texto}"`).toEqual([])
      }
    })
  }

  it('rinde los catorce casos sin NaN ni undefined y dentro del máximo de páginas', async () => {
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


  // El modo sencillo llega al PDF por el mismo camino que a la pantalla: no hay fixture de por
  // medio. Se comprueba que el generador rellena la lista, que respeta su tope, y que la página
  // de la compra no desborda el máximo de páginas con una lista real.
  it('imprime también los catorce casos en modo sencillo, con su lista real', async () => {
    for (let i = 0; i < VECTORES.length; i++) {
      const v = VECTORES[i]
      const datos = datosDe(i, true)
      const { compra, modo_sencillo } = datos.ejemplos
      expect(modo_sencillo, `caso ${v.n}`).toBe(true)
      // El vector 13 es renal: §3.1 lo deja sin menú y, por tanto, sin lista de la compra. El
      // PDF tiene que imprimirse igual, sin la página de §4.4b.
      const sinMenu = datos.ejemplos.entreno.comidas.length === 0
      expect(compra === undefined, `caso ${v.n}`).toBe(sinMenu)
      if (!sinMenu) {
        expect(compra!.alimentos_distintos, `caso ${v.n}`).toBeLessThanOrEqual(ALIMENTOS_MAX_SENCILLO)
        expect(compra!.items.length, `caso ${v.n}`).toBe(compra!.alimentos_distintos)
      }

      const buffer = await renderToBuffer(elementoPlan(datos))
      const paginas = (buffer.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length
      expect(paginas, `caso ${v.n}: ${paginas} páginas`).toBeLessThanOrEqual(PAGINAS_MAX)
      expect(paginas, `caso ${v.n}`).toBeGreaterThan(3)
    }
  }, 180_000)
})
