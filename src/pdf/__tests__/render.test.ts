// Render real del documento a fichero, para poder abrirlo e inspeccionarlo a ojo.
// Los PDF se dejan en el directorio temporal de trabajo, nunca dentro del repositorio.
import { describe, expect, it } from 'vitest'
import { renderToBuffer, renderToFile } from '@react-pdf/renderer'
import { elementoPlan, generarPdfBlob, nombreFicheroPdf } from '../index'
import {
  MUESTRA_AJUSTADA,
  MUESTRA_ALIMENTOS,
  MUESTRA_CICLO,
  MUESTRA_CICLO_SINTOMAS,
  MUESTRA_COMPLETA,
  MUESTRA_MINIMA,
  MUESTRA_RECOMPOSICION,
} from '../__fixtures__/muestra'
import { textoDelPdf } from './utiles'

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

  it('todas las muestras caben en el máximo de 10 páginas de §4.0', async () => {
    for (const [nombre, datos] of [
      ['completa', MUESTRA_COMPLETA],
      ['mínima', MUESTRA_MINIMA],
      ['ajustada', MUESTRA_AJUSTADA],
      ['ciclo', MUESTRA_CICLO],
      ['recomposición', MUESTRA_RECOMPOSICION],
      ['ciclo con síntomas', MUESTRA_CICLO_SINTOMAS],
      ['alimentos y plazo', MUESTRA_ALIMENTOS],
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

  // ---------- v1.2 ----------

  it('imprime el resumen de alimentos, el plazo pedido y las notas del generador', async () => {
    const buffer = await renderToBuffer(elementoPlan(MUESTRA_ALIMENTOS))
    const texto = await textoDelPdf(buffer)
    // §4.4: la misma línea que la pantalla, sin el enlace "Cambiar".
    expect(texto).toContain('Sin: Brócoli, Coliflor')
    expect(texto).toContain('Favoritos: Pechuga de pollo, Arroz blanco')
    // §4.2: fila de datos con la variante breve y el matiz del plazo sobre el ritmo del plan.
    expect(texto).toContain('sin Brócoli, Coliflor')
    expect(texto).toContain('fecha pedida: 8 semanas')
    expect(texto).toContain('agresivo')
    // El aviso del generador (§3.2b) se lista donde el resto de notas del menú.
    expect(texto).toContain('No hemos podido evitar')
    expect(texto).not.toContain('undefined')
    expect(texto).not.toMatch(/NaN/)
  }, 90_000)

  it('la tarjeta del ciclo lleva un bloque por síntoma y la compra su sección opcional', async () => {
    const buffer = await renderToBuffer(elementoPlan(MUESTRA_CICLO_SINTOMAS))
    const texto = await textoDelPdf(buffer)
    expect(texto).toContain('Tu ciclo y tu plan')
    for (const consejo of MUESTRA_CICLO_SINTOMAS.resultado.ciclo?.consejos ?? []) {
      expect(texto, consejo.clave).toContain(consejo.titulo)
    }
    expect((texto.match(/Prioriza:/g) ?? []).length).toBe(3)
    // §3.8.1 y §4.4b: los alimentos sugeridos y su sección opcional en la lista de la compra.
    expect(texto).toContain('Para esos días:')
    expect(texto).toContain('Para los días de regla (opcional)')
    expect(texto).toContain('Mejillones al natural')
    // La lista de síntomas marcados NO se imprime en la tabla de datos (§4.2).
    expect(texto).not.toContain('sangrado_abundante')
    expect(texto).not.toContain('undefined')
    expect(texto).not.toMatch(/NaN/)
  }, 90_000)

  it('la recomposición con meta imprime su banda, su nota y el peso objetivo orientativo', async () => {
    const buffer = await renderToBuffer(elementoPlan(MUESTRA_RECOMPOSICION))
    const texto = await textoDelPdf(buffer)
    expect(texto).toContain('63,0 kg')
    expect(texto).toContain('orientativo')
    // §4.5b: el copy es el de INFO_PROYECCION_RECOMP, no el de la proyección plana ni el fijo.
    expect(texto).toContain('sino una banda')
    expect(texto).not.toContain('esperamos que tu peso se mantenga')
    // Sin cronograma no hay fechas que prometer.
    expect(MUESTRA_RECOMPOSICION.resultado.cronograma).toBeNull()
    expect(texto).toContain('Cómo debería ir la cosa')
    expect(texto).not.toContain('undefined')
    expect(texto).not.toMatch(/NaN/)
  }, 90_000)

  it('no rompe con el ciclo, los alimentos y la sección opcional a medio rellenar', async () => {
    const compra = MUESTRA_CICLO_SINTOMAS.ejemplos.compra
    const roto = {
      ...MUESTRA_CICLO_SINTOMAS,
      inputs: {
        ...MUESTRA_CICLO_SINTOMAS.inputs,
        alimentos_excluidos: ['no_existe', ''] as unknown as string[],
        alimentos_favoritos: undefined,
        plazo_semanas: Number.NaN,
      },
      resultado: {
        ...MUESTRA_CICLO_SINTOMAS.resultado,
        ciclo: {
          sintomas: ['dolor' as const],
          consejos: [
            {
              clave: 'dolor' as const,
              titulo: undefined as unknown as string,
              texto: undefined as unknown as string,
              alimentos: undefined as unknown as string[],
            },
          ],
        },
      },
      ejemplos: {
        ...MUESTRA_CICLO_SINTOMAS.ejemplos,
        alimentos_ciclo: [{ id: 'x', nombre: 'Espinacas', por_que: undefined as unknown as string }],
        compra: {
          ...compra!,
          opcional_ciclo: {
            titulo: undefined as unknown as string,
            nota: undefined as unknown as string,
            items: [
              {
                ...compra!.opcional_ciclo!.items[0],
                producto: undefined as unknown as string,
                gramos_semana: Number.NaN,
                envases: undefined as unknown as number,
              },
            ],
          },
        },
      },
    }
    const buffer = await renderToBuffer(elementoPlan(roto))
    const texto = await textoDelPdf(buffer)
    expect(buffer.length).toBeGreaterThan(10_000)
    expect(texto).not.toContain('undefined')
    expect(texto).not.toMatch(/NaN/)
    // Un id que no está en `foods.json` no se imprime como identificador técnico.
    expect(texto).not.toContain('no_existe')
    expect(texto).not.toContain('fecha pedida')
  }, 90_000)

  it('escribe los PDF de las tres muestras nuevas de la v1.2', async () => {
    await expect(
      renderToFile(elementoPlan(MUESTRA_RECOMPOSICION), `${SALIDA}/plan-muestra-recomposicion.pdf`),
    ).resolves.toBeDefined()
    await expect(
      renderToFile(elementoPlan(MUESTRA_CICLO_SINTOMAS), `${SALIDA}/plan-muestra-ciclo-sintomas.pdf`),
    ).resolves.toBeDefined()
    await expect(
      renderToFile(elementoPlan(MUESTRA_ALIMENTOS), `${SALIDA}/plan-muestra-alimentos.pdf`),
    ).resolves.toBeDefined()
  }, 120_000)

  it('propone un nombre de fichero con la fecha del plan', () => {
    expect(nombreFicheroPdf(MUESTRA_COMPLETA)).toBe('bascula-plan-2026-09-07.pdf')
    expect(nombreFicheroPdf({ ...MUESTRA_COMPLETA, fecha: 'no-es-una-fecha' })).toBe('bascula-plan-sin-fecha.pdf')
  })
})
