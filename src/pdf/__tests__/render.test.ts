// Render real del documento a fichero, para poder abrirlo e inspeccionarlo a ojo.
// Los PDF se dejan en el directorio temporal de trabajo, nunca dentro del repositorio.
import { describe, expect, it } from 'vitest'
import { renderToFile } from '@react-pdf/renderer'
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

  it('propone un nombre de fichero con la fecha del plan', () => {
    expect(nombreFicheroPdf(MUESTRA_COMPLETA)).toBe('bascula-plan-2026-09-07.pdf')
    expect(nombreFicheroPdf({ ...MUESTRA_COMPLETA, fecha: 'no-es-una-fecha' })).toBe('bascula-plan-sin-fecha.pdf')
  })
})
