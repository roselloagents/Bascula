// Render real del documento a fichero, para poder abrirlo e inspeccionarlo a ojo.
// Los PDF se dejan en el directorio temporal de trabajo, nunca dentro del repositorio.
import { describe, expect, it } from 'vitest'
import { renderToBuffer, renderToFile } from '@react-pdf/renderer'
import { elementoPlan, generarPdfBlob, nombreFicheroPdf } from '../index'
import { MUESTRA_COMPLETA, MUESTRA_MINIMA } from '../__fixtures__/muestra'

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
    expect(conLista).toBeLessThanOrEqual(8)
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

  it('propone un nombre de fichero con la fecha del plan', () => {
    expect(nombreFicheroPdf(MUESTRA_COMPLETA)).toBe('bascula-plan-2026-09-07.pdf')
    expect(nombreFicheroPdf({ ...MUESTRA_COMPLETA, fecha: 'no-es-una-fecha' })).toBe('bascula-plan-sin-fecha.pdf')
  })
})
