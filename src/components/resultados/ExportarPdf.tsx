// Botón de exportación a PDF. La librería del PDF pesa cerca de un mega, así que
// el módulo se carga solo cuando se pulsa (`await import('../../pdf')`).

import { useState } from 'react'
import type { DatosPdf } from '../../engine/types'
import { Cargador, IconoDescarga } from '../ui/Iconos'

interface BotonPdfProps {
  datos: () => DatosPdf
  variante?: 'principal' | 'secundario'
}

/**
 * `'download' in enlace` es cierto en todos los navegadores actuales —también en Safari de iOS,
 * donde el atributo existe pero la descarga no se honra—, así que aquella rama de respaldo era
 * código muerto. Se detecta el navegador de verdad.
 */
function esIos(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const iPadOs = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1
  return /iPad|iPhone|iPod/.test(ua) || iPadOs
}

export function BotonPdf({ datos, variante = 'principal' }: BotonPdfProps) {
  const [estado, setEstado] = useState<'listo' | 'generando' | 'error'>('listo')
  const [urlPdf, setUrlPdf] = useState<string | null>(null)

  const exportar = async () => {
    setEstado('generando')
    try {
      const modulo = await import('../../pdf')
      const datosPdf = datos()
      const blob = await modulo.generarPdfBlob(datosPdf)
      const nombre = modulo.nombreFicheroPdf(datosPdf)
      const url = URL.createObjectURL(blob)
      if (esIos()) {
        // En iOS la descarga directa no se honra: se abre el PDF y, si el navegador bloquea la
        // ventana, queda el enlace visible de abajo.
        const ventana = window.open(url, '_blank')
        if (!ventana) setUrlPdf(url)
      } else {
        const enlace = document.createElement('a')
        enlace.href = url
        enlace.download = nombre
        enlace.rel = 'noopener'
        document.body.appendChild(enlace)
        enlace.click()
        enlace.remove()
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 30000)
      setEstado('listo')
    } catch {
      setEstado('error')
    }
  }

  return (
    <div className="exportar">
      <button
        type="button"
        className={`btn btn-${variante}`}
        onClick={exportar}
        aria-busy={estado === 'generando'}
        disabled={estado === 'generando'}
      >
        {estado === 'generando' ? <Cargador /> : <IconoDescarga />}
        {estado === 'generando' ? 'Preparando el PDF…' : 'Descargar PDF'}
      </button>
      {/* La región solo existe cuando hay algo que anunciar: con dos botones en la página había
          dos regiones `aria-live` vacías compitiendo. */}
      {estado === 'error' ? (
        <p aria-live="polite" className="exportar-estado">
          No hemos podido generar el PDF. Vuelve a intentarlo en unos segundos.
        </p>
      ) : null}
      {urlPdf ? (
        <p className="exportar-estado">
          <a href={urlPdf} target="_blank" rel="noopener noreferrer">
            Abrir el PDF
          </a>
        </p>
      ) : null}
    </div>
  )
}
