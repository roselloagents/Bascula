// STUB TEMPORAL — será sustituido por el documento real con @react-pdf/renderer (docs/SPEC-ux-comidas-pdf.md §4).
// Mantener EXACTAMENTE esta firma exportada. La UI lo carga con `await import('../pdf')` para no cargar
// la librería (≈1 MB) hasta que el usuario pulsa "Exportar PDF".
import type { DatosPdf } from '../engine/types'

/** Genera el PDF del plan y lo devuelve como Blob listo para descargar. */
export async function generarPdfBlob(datos: DatosPdf): Promise<Blob> {
  const texto = `Báscula — plan de macros (stub)\nkcal ${datos.resultado.kcal_objetivo} · P ${datos.resultado.proteina_g} g · G ${datos.resultado.grasa_g} g · CH ${datos.resultado.carbohidratos_g} g`
  return new Blob([texto], { type: 'text/plain' })
}

/** Nombre de fichero sugerido para la descarga. */
export function nombreFicheroPdf(datos: DatosPdf): string {
  return `bascula-plan-${datos.fecha}.pdf`
}
