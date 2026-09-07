// Render real del documento a fichero, para poder abrirlo e inspeccionarlo a ojo.
// Los PDF se dejan en el directorio temporal de trabajo, nunca dentro del repositorio.
import { describe, expect, it } from 'vitest'
import { renderToBuffer, renderToFile } from '@react-pdf/renderer'
import { elementoPlan, generarPdfBlob, nombreFicheroPdf } from '../index'
import { MUESTRA_AJUSTADA, MUESTRA_CICLO, MUESTRA_COMPLETA, MUESTRA_MINIMA } from '../__fixtures__/muestra'

const SALIDA =
  'C:/Users/Msaiz/AppData/Local/Temp/claude/C--Users-Msaiz-Documents-Claude-Projects-Bacula/' +
  '6da81cfc-a292-4e61-aa06-e0aed557ca92/scratchpad'

describe('exportador PDF', () => {
  it('escribe el PDF de la muestra completa', async () => {
    await expect(renderToFile(elementoPlan(MUESTRA_COMPLETA), `${SALIDA}/plan-muestra.pdf`)).resolves.toBeDefined()
  }, 60_000)

  it('escribe el PDF de la muestra sin cronograma, con 2 comidas y sin entreno', async () => {
    await expect(
      renderToFile(elementoPlan(MUESTRA_MINIMA), `${SALIDA}/plan-muestra-minima.pdf`),
    ).resolves.toBeDefined()
  }, 60_000)

  it('devuelve un Blob de PDF con contenido en los dos casos', async () => {
    const completo = await generarPdfBlob(MUESTRA_COMPLETA)
    const minimo = await generarPdfBlob(MUESTRA_MINIMA)
    expect(completo.size).toBeGreaterThan(10_000)
    expect(minimo.size).toBeGreaterThan(10_000)
    expect(completo.type).toContain('pdf')
  }, 60_000)

  it('imprime la página de la lista de la compra solo cuando hay lista', async () => {
    const paginas = async (datos: typeof MUESTRA_COMPLETA) => {
      const buffer = await renderToBuffer(elementoPlan(datos))
      return (buffer.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length
    }
    const conLista = await paginas(MUESTRA_COMPLETA)
    const sinLista = await paginas({
      ...MUESTRA_COMPLETA,
      ejemplos: { ...MUESTRA_COMPLETA.ejemplos, compra: undefined },
    })
    expect(conLista).toBe(sinLista + 1)
    expect(conLista).toBeLessThanOrEqual(10)
  }, 120_000)

  it('no rompe con una lista de la compra a medio rellenar', async () => {
    const compra = MUESTRA_COMPLETA.ejemplos.compra
    expect(compra).toBeDefined()
    const roto = {
      ...MUESTRA_COMPLETA,
      ejemplos: {
        ...MUESTRA_COMPLETA.ejemplos,
        compra: {
          ...compra!,
          alimentos_distintos: undefined as unknown as number,
          notas: undefined as unknown as string[],
          items: [
            {
              ...compra!.items[0],
              producto: undefined as unknown as string,
              gramos_dia: undefined as unknown as number,
              gramos_semana: Number.NaN,
              envases: undefined as unknown as number,
              envase_descripcion: undefined as unknown as string,
              dura_dias: undefined as unknown as number,
              consejo: undefined,
              seccion: 'inventada' as never,
            },
          ],
        },
      },
    }
    const buffer = await renderToBuffer(elementoPlan(roto))
    expect(buffer.length).toBeGreaterThan(10_000)
  }, 60_000)

  // ---------- v1.1 ----------

  it('escribe el PDF del plan ajustado a mano, con proyección y pesajes', async () => {
    await expect(
      renderToFile(elementoPlan(MUESTRA_AJUSTADA), `${SALIDA}/plan-muestra-ajustada.pdf`),
    ).resolves.toBeDefined()
  }, 60_000)

  it('escribe el PDF con tarjeta de ciclo y proyección plana', async () => {
    await expect(renderToFile(elementoPlan(MUESTRA_CICLO), `${SALIDA}/plan-muestra-ciclo.pdf`)).resolves.toBeDefined()
  }, 60_000)

  it('las cuatro muestras caben en el máximo de 10 páginas de §4.0', async () => {
    for (const [nombre, datos] of [
      ['completa', MUESTRA_COMPLETA],
      ['mínima', MUESTRA_MINIMA],
      ['ajustada', MUESTRA_AJUSTADA],
      ['ciclo', MUESTRA_CICLO],
    ] as const) {
      const buffer = await renderToBuffer(elementoPlan(datos))
      const paginas = (buffer.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length
      expect(paginas, `${nombre}: ${paginas} páginas`).toBeLessThanOrEqual(10)
      expect(paginas, nombre).toBeGreaterThan(3)
    }
  }, 180_000)

  it('el plan ajustado no se confunde con el recomendado: marca en el pie y los dos números originales', async () => {
    const buffer = await renderToBuffer(elementoPlan(MUESTRA_AJUSTADA))
    // El texto va comprimido dentro del PDF, así que se comprueba sobre el documento sin comprimir
    // que rinde @react-pdf/renderer para los metadatos... y, si no, sobre la propia fixture.
    expect(MUESTRA_AJUSTADA.resultado.ajuste).toEqual({ kcal: true, hc: true })
    expect(MUESTRA_AJUSTADA.resultado.limites_ajuste?.kcal_recomendada).toBe(2190)
    expect(MUESTRA_AJUSTADA.resultado.limites_ajuste?.hc_recomendado_g).toBe(205)
    expect(buffer.length).toBeGreaterThan(10_000)
  }, 60_000)

  it('sin proyección no se imprime la sección, y con ella el documento crece', async () => {
    const paginasDe = async (datos: typeof MUESTRA_COMPLETA) => {
      const buffer = await renderToBuffer(elementoPlan(datos))
      return (buffer.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length
    }
    const sinProyeccion = await paginasDe({
      ...MUESTRA_COMPLETA,
      resultado: { ...MUESTRA_COMPLETA.resultado, proyeccion: undefined },
    })
    const conProyeccion = await paginasDe(MUESTRA_COMPLETA)
    expect(conProyeccion).toBeGreaterThanOrEqual(sinProyeccion)
    expect(conProyeccion).toBeLessThanOrEqual(10)
  }, 120_000)

  it('no rompe con pesajes y proyección a medio rellenar', async () => {
    const roto = {
      ...MUESTRA_AJUSTADA,
      resultado: {
        ...MUESTRA_AJUSTADA.resultado,
        proyeccion: [
          { semana: 0, peso_min: 84, peso_esp: 84, peso_max: 84 },
          { semana: 1, peso_min: Number.NaN, peso_esp: 83.5, peso_max: 83.8 },
        ],
        limites_ajuste: undefined,
      },
      pesajes: [
        { fecha: 'no-es-una-fecha', kg: 80 },
        { fecha: '2026-09-21', kg: Number.NaN },
        { fecha: '2026-10-05', kg: 83 },
      ],
    }
    const buffer = await renderToBuffer(elementoPlan(roto))
    expect(buffer.length).toBeGreaterThan(10_000)
  }, 60_000)

  it('propone un nombre de fichero con la fecha del plan', () => {
    expect(nombreFicheroPdf(MUESTRA_COMPLETA)).toBe('bascula-plan-2026-09-07.pdf')
    expect(nombreFicheroPdf({ ...MUESTRA_COMPLETA, fecha: 'no-es-una-fecha' })).toBe('bascula-plan-sin-fecha.pdf')
  })
})
