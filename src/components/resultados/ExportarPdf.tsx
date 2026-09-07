// Botón de exportación a PDF. La librería del PDF pesa cerca de un mega, así que
// el módulo se carga solo cuando se pulsa (`await import('../../pdf')`).

import { useState } from 'react'
import type { DatosPdf } from '../../engine/types'
import { Cargador, IconoDescarga } from '../ui/Iconos'

interface BotonPdfProps {
  datos: () => DatosPdf
  variante?: 'principal' | 'secundario'
}

export function BotonPdf({ datos, variante = 'principal' }: BotonPdfProps) {
  const [estado, setEstado] = useState<'listo' | 'generando' | 'error'>('listo')

  const exportar = async () => {
    setEstado('generando')
    try {
      const modulo = await import('../../pdf')
      const datosPdf = datos()
      const blob = await modulo.generarPdfBlob(datosPdf)
      const nombre = modulo.nombreFicheroPdf(datosPdf)
      const url = URL.createObjectURL(blob)
      const enlace = document.createElement('a')
      if ('download' in enlace) {
        enlace.href = url
        enlace.download = nombre
        enlace.rel = 'noopener'
        document.body.appendChild(enlace)
        enlace.click()
        enlace.remove()
      } else {
        // Safari en iOS antiguo: sin atributo download, se abre en otra pestaña.
        window.open(url, '_blank')
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
        disabled={estado === 'generando'}
      >
        {estado === 'generando' ? <Cargador /> : <IconoDescarga />}
        {estado === 'generando' ? 'Preparando el PDF…' : 'Exportar PDF'}
      </button>
      <p aria-live="polite" className="exportar-estado">
        {estado === 'error'
          ? 'No hemos podido generar el PDF. Vuelve a intentarlo en unos segundos.'
          : ''}
      </p>
    </div>
  )
}
