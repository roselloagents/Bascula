// Diálogo de confirmación accesible sobre el elemento nativo <dialog>: modal, con foco atrapado por
// el navegador, cierre con Escape y con un toque fuera de la caja. El botón seguro (cancelar) recibe
// el foco al abrirse para que un Enter apresurado no borre nada.

import { useEffect, useId, useRef, type MouseEvent, type SyntheticEvent } from 'react'

interface ConfirmacionProps {
  abierto: boolean
  titulo: string
  texto: string
  /** Etiqueta del botón que ejecuta la acción destructiva. */
  confirmar: string
  cancelar: string
  onConfirmar: () => void
  onCancelar: () => void
}

export function Confirmacion({
  abierto,
  titulo,
  texto,
  confirmar,
  cancelar,
  onConfirmar,
  onCancelar,
}: ConfirmacionProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const idTitulo = useId()
  const idTexto = useId()

  useEffect(() => {
    const dialogo = ref.current
    if (!dialogo) return
    if (abierto && !dialogo.open) {
      // Navegadores sin showModal (muy antiguos): se muestra como bloque normal.
      if (typeof dialogo.showModal === 'function') dialogo.showModal()
      else dialogo.setAttribute('open', '')
    } else if (!abierto && dialogo.open) {
      dialogo.close()
    }
  }, [abierto])

  // Escape: el navegador intenta cerrar el diálogo; se deja que sea el estado de React quien mande.
  const cancelarNativo = (evento: SyntheticEvent<HTMLDialogElement>) => {
    evento.preventDefault()
    onCancelar()
  }

  // Un toque en el velo (fuera de la caja) equivale a cancelar.
  const tocarFuera = (evento: MouseEvent<HTMLDialogElement>) => {
    if (evento.target === ref.current) onCancelar()
  }

  return (
    <dialog
      ref={ref}
      className="confirmacion"
      aria-labelledby={idTitulo}
      aria-describedby={idTexto}
      onCancel={cancelarNativo}
      onClick={tocarFuera}
    >
      <div className="confirmacion-caja">
        <h2 id={idTitulo} className="confirmacion-titulo">
          {titulo}
        </h2>
        <p id={idTexto} className="confirmacion-texto">
          {texto}
        </p>
        <div className="confirmacion-acciones">
          <button type="button" className="btn btn-secundario" onClick={onCancelar} autoFocus>
            {cancelar}
          </button>
          <button type="button" className="btn btn-principal" onClick={onConfirmar}>
            {confirmar}
          </button>
        </div>
      </div>
    </dialog>
  )
}
