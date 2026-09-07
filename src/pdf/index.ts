// Exportador PDF (docs/SPEC-ux-comidas-pdf.md §4). Firmas fijadas en docs/CONTRATO.md.
// La UI lo carga con `await import('../pdf')` para no arrastrar la librería hasta que se pulsa "Exportar PDF".
import { createElement } from 'react'
import { pdf } from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import type { DatosPdf } from '../engine/types'
import { PlanDocument } from './PlanDocument'

/** Elemento React del documento, compartido por el Blob del navegador y por `renderToFile` en los tests. */
export function elementoPlan(datos: DatosPdf): ReactElement<DocumentProps> {
  return createElement(PlanDocument, { datos }) as unknown as ReactElement<DocumentProps>
}

/** Genera el PDF del plan y lo devuelve como Blob listo para descargar. */
export async function generarPdfBlob(datos: DatosPdf): Promise<Blob> {
  return await pdf(elementoPlan(datos)).toBlob()
}

/** Nombre de fichero sugerido para la descarga. */
export function nombreFicheroPdf(datos: DatosPdf): string {
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(datos.fecha ?? '') ? datos.fecha : 'sin-fecha'
  return `bascula-plan-${fecha}.pdf`
}
