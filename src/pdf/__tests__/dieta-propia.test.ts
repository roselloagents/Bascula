// PDF con "Tu menú, con lo tuyo dentro" (docs/SPEC-dieta-propia.md §6.2).
// Como el resto de tests del exportador, los PDF se escriben FUERA del repositorio para poder
// abrirlos a ojo, y el texto se comprueba descomprimiendo los flujos de cada página (`utiles.ts`).
import { describe, expect, it } from 'vitest'
import { renderToBuffer, renderToFile } from '@react-pdf/renderer'
import { elementoPlan } from '../index'
import { MUESTRA_COMPLETA } from '../__fixtures__/muestra'
import {
  DIA_MAXIMO,
  MUESTRA_DIETA_COMPLETA,
  MUESTRA_DIETA_MAXIMA,
  MUESTRA_DIETA_PARCIAL,
  MUESTRA_DIETA_PROPUESTA_IA,
} from '../__fixtures__/dieta-propia'
import { textoDelPdf } from './utiles'

const SALIDA =
  'C:/Users/Msaiz/AppData/Local/Temp/claude/C--Users-Msaiz-Documents-Claude-Projects-Bacula/' +
  '6da81cfc-a292-4e61-aa06-e0aed557ca92/scratchpad'

async function paginas(datos: typeof MUESTRA_COMPLETA): Promise<number> {
  const buffer = await renderToBuffer(elementoPlan(datos))
  return (buffer.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length
}

describe('PDF con dieta propia (§6.2)', () => {
  it('escribe los cuatro PDF de muestra', async () => {
    await expect(
      renderToFile(elementoPlan(MUESTRA_DIETA_PARCIAL), `${SALIDA}/plan-dieta-parcial.pdf`),
    ).resolves.toBeDefined()
    await expect(
      renderToFile(elementoPlan(MUESTRA_DIETA_COMPLETA), `${SALIDA}/plan-dieta-completa.pdf`),
    ).resolves.toBeDefined()
    await expect(
      renderToFile(elementoPlan(MUESTRA_DIETA_MAXIMA), `${SALIDA}/plan-dieta-maxima.pdf`),
    ).resolves.toBeDefined()
    await expect(
      renderToFile(elementoPlan(MUESTRA_DIETA_PROPUESTA_IA), `${SALIDA}/plan-dieta-ia.pdf`),
    ).resolves.toBeDefined()
  }, 240_000)

  it('los cuatro casos caben en el máximo de 10 páginas de §4.4b', async () => {
    for (const [nombre, datos] of [
      ['parcial', MUESTRA_DIETA_PARCIAL],
      ['completa', MUESTRA_DIETA_COMPLETA],
      ['máxima', MUESTRA_DIETA_MAXIMA],
      ['propuesta IA', MUESTRA_DIETA_PROPUESTA_IA],
    ] as const) {
      const n = await paginas(datos)
      expect(n, `${nombre}: ${n} páginas`).toBeLessThanOrEqual(10)
      expect(n, nombre).toBeGreaterThan(3)
    }
  }, 240_000)

  it('sustituye "Ejemplo de menú" por el bloque de lo tuyo, con su descripción y su nota fija', async () => {
    const texto = await textoDelPdf(await renderToBuffer(elementoPlan(MUESTRA_DIETA_COMPLETA)))
    expect(texto).toContain('Tu menú, con lo tuyo dentro')
    expect(texto).not.toContain('Ejemplo de menú')
    // Descripción del modo `completa` (§5.4).
    expect(texto).toContain('Hemos movido los gramos lo justo para cuadrar tus calorías')
    // Nota fija del bloque y marca del pie.
    expect(texto).toContain('Las comidas marcadas «tuya» son tu comida real')
    expect(texto).toContain('con tus comidas')
    // Nota de la tabla de reparto (§5.1) en modo completa.
    expect(texto).toContain('tus comidas van por otros porcentajes')
    // Sin huecos de la IA, ni etiqueta ni línea de §4bis.5.
    expect(texto).not.toContain('propuesta IA')
    expect(texto).not.toContain('undefined')
    expect(texto).not.toMatch(/NaN/)
  }, 120_000)

  it('etiqueta cada comida, imprime los totales, lo que pedía el plan y los pendientes', async () => {
    const texto = await textoDelPdf(await renderToBuffer(elementoPlan(MUESTRA_DIETA_PARCIAL)))
    expect(texto).toContain('Desayuno · 08:00 · tuya')
    expect(texto).toContain('Comida · 14:00 · propuesta')
    // Las alternativas de los huecos montados siguen imprimiéndose como en el menú de siempre.
    expect(texto).toContain('Alternativas:')
    expect(texto).toContain('Lo que hemos tenido en cuenta')
    expect(texto).toContain('Apuntado, pero aún no lo aplicamos')
    expect(texto).toContain('Tu plan pedía:')
    expect(texto).toContain('Pendiente de cantidad:')
    expect(texto).toContain('Provisional')
    expect(texto).toContain('No hemos entendido:')
  }, 120_000)

  it('marca el estado, el "(antes N g)" y el origen de los macros de cada alimento dictado', async () => {
    const texto = await textoDelPdf(await renderToBuffer(elementoPlan(MUESTRA_DIETA_COMPLETA)))
    expect(texto).toContain('en crudo')
    expect(texto).toContain('(antes 200 g)')
    expect(texto).toContain('estimado')
    expect(texto).toContain('huevo M')
  }, 120_000)

  it('compacta el caso máximo: sin "(antes N g)" ni notas por alimento con más de 30 alimentos', async () => {
    const alimentos = DIA_MAXIMO.comidas.reduce((n, c) => n + c.alimentos.length, 0)
    expect(alimentos).toBe(40)
    expect(DIA_MAXIMO.comidas).toHaveLength(8)
    expect(DIA_MAXIMO.avisos.length).toBeGreaterThanOrEqual(13)
    expect(DIA_MAXIMO.no_entendido).toHaveLength(20)
    expect(DIA_MAXIMO.aplicado.length + DIA_MAXIMO.apuntado.length).toBe(32)
    const texto = await textoDelPdf(await renderToBuffer(elementoPlan(MUESTRA_DIETA_MAXIMA)))
    expect(texto).toContain('Tu menú, con lo tuyo dentro')
    expect(texto).not.toContain('(antes ')
    expect(texto).not.toContain('Basmati')
    // Los avisos se imprimen todos, no tres como en pantalla.
    expect(texto).toContain('el plan no cuadra bien')
    expect(texto).toContain('ya es una ración grande')
  }, 120_000)

  it('la compra imprime "—" en Comprar y en Dura cuando el alimento no está en nuestra base', async () => {
    const texto = await textoDelPdf(await renderToBuffer(elementoPlan(MUESTRA_DIETA_PARCIAL)))
    expect(texto).toContain('No está en nuestra base: mira el formato en el envase.')
    expect(texto).toContain('Las cantidades salen de tu menú con lo tuyo dentro.')
    // El guion largo se codifica como 0x97 en WinAnsi: se busca ese byte, no el carácter Unicode.
    expect(texto).toContain(String.fromCharCode(0x97))
  }, 120_000)

  it('imprime los huecos de la IA como los dictados, con su etiqueta y su línea (§4bis.5)', async () => {
    const texto = await textoDelPdf(await renderToBuffer(elementoPlan(MUESTRA_DIETA_PROPUESTA_IA)))
    // Etiqueta de §4bis.5 en las comidas del modelo, y la del generador sin tocar.
    expect(texto).toContain('Comida · 14:00 · propuesta IA')
    expect(texto).toContain('Cena · 21:00 · propuesta IA')
    expect(texto).toContain('Merienda · 17:30 · cerca de tu entreno · propuesta')
    expect(texto).toContain('Desayuno · 08:00 · tuya')
    // La línea bajo la descripción del bloque.
    expect(texto).toContain('Las comidas marcadas «propuesta IA» las ha montado Claude')
    // Los alimentos propuestos se imprimen como los dictados: gramos finales, estado y "estimado".
    expect(texto).toContain('Pechuga de pollo')
    expect(texto).toContain('Pan de centeno de panadería')
    expect(texto).toContain('ya cocido')
    expect(texto).toContain('estimado')
    // El hueco que cayó a plantillas se dice en "Apuntado".
    expect(texto).toContain('Para Merienda no nos ha convencido la propuesta')
    expect(texto).not.toContain('undefined')
    expect(texto).not.toMatch(/NaN/)
  }, 120_000)

  it('el consejo del modelo va una sola vez y las preguntas no se imprimen (§4bis.5)', async () => {
    const texto = await textoDelPdf(await renderToBuffer(elementoPlan(MUESTRA_DIETA_PROPUESTA_IA)))
    const consejo = 'se quedan cortos de fibra y de potasio'
    expect(texto).toContain(consejo)
    // El mismo texto llega como `consejo_ia` y como aviso `DIETA_CONSEJO_IA`: en papel va una vez.
    expect(texto.split(consejo)).toHaveLength(2)
    // Las preguntas de vuelta no se pueden responder en papel: no se imprimen.
    expect(texto).not.toContain('¿Metemos alguna verdura que sí te guste?')
    expect(texto).not.toContain('Una pregunta antes de seguir')
    expect(texto).not.toContain('Solo en la cena')
    expect(texto).not.toContain('Prefiero variar')
  }, 120_000)

  it('sin `dieta_propia` el PDF es el de la v1.2', async () => {
    const texto = await textoDelPdf(await renderToBuffer(elementoPlan(MUESTRA_COMPLETA)))
    expect(texto).toContain('Ejemplo de menú')
    expect(texto).not.toContain('Tu menú, con lo tuyo dentro')
    expect(texto).not.toContain('con tus comidas')
  }, 120_000)
})
