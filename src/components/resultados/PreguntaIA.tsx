// Tarjeta "Una pregunta antes de seguir" (SPEC-dieta-propia §4bis.5).
//
// El modelo puede devolver hasta dos preguntas con respuestas rápidas. Aquí no se llama a nada:
// responder sube el par {pregunta, respuesta} a `App`, que lo guarda, lo añade al texto contado y
// vuelve a pedir la propuesta. "Seguir así" cierra la tarjeta sin gastar una llamada.

import { useId, useState } from 'react'
import type { PreguntaIA as PreguntaDelModelo } from '../../engine/types'
import { PREGUNTAS_MAX } from '../../dieta/almacen'
import { RESPUESTA_MAX } from '../../dieta/contexto'

/** [SPEC] §4bis.5, título de la tarjeta. */
export const TITULO_PREGUNTA_IA = 'Una pregunta antes de seguir'
/** [SPEC] §4bis.5, el campo de texto libre y sus dos botones. */
export const ETIQUETA_OTRA_RESPUESTA = 'Otra respuesta'
export const BOTON_RESPONDER = 'Responder'
export const BOTON_SEGUIR = 'Seguir así'

interface Props {
  preguntas: readonly PreguntaDelModelo[]
  /** Responder: se guarda, se añade al texto contado y se pide otra propuesta (misma variante). */
  onResponder: (pregunta: string, respuesta: string) => void
  /** "Seguir así": cierra la tarjeta sin llamar a nadie. */
  onSeguir: () => void
}

export function PreguntaIA({ preguntas, onResponder, onSeguir }: Props) {
  const id = useId()
  // Una caja de texto por pregunta: con dos preguntas, un solo campo no diría a cuál responde.
  const [escritas, setEscritas] = useState<Record<number, string>>({})

  if (preguntas.length === 0) return null

  return (
    <section className="dieta-preguntas" aria-labelledby={`${id}-titulo`}>
      <h3 className="dieta-subtitulo" id={`${id}-titulo`}>
        {TITULO_PREGUNTA_IA}
      </h3>

      {preguntas.slice(0, PREGUNTAS_MAX).map((pregunta, i) => {
        const escrita = escritas[i] ?? ''
        const vacia = escrita.trim() === ''
        return (
          <div className="dieta-pregunta" key={pregunta.texto}>
            <p className="dieta-pregunta-texto">{pregunta.texto}</p>
            <div className="dieta-pregunta-opciones">
              {pregunta.opciones.map((opcion) => (
                <button
                  type="button"
                  className="btn btn-secundario"
                  key={opcion}
                  onClick={() => onResponder(pregunta.texto, opcion)}
                >
                  {opcion}
                </button>
              ))}
            </div>
            <div className="campo dieta-pregunta-otra">
              <label className="campo-etiqueta" htmlFor={`${id}-otra-${i}`}>
                {ETIQUETA_OTRA_RESPUESTA}
              </label>
              <div className="campo-caja">
                <input
                  id={`${id}-otra-${i}`}
                  type="text"
                  autoComplete="off"
                  maxLength={RESPUESTA_MAX}
                  value={escrita}
                  onChange={(evento) =>
                    setEscritas((previas) => ({ ...previas, [i]: evento.target.value }))
                  }
                />
              </div>
              {/* Operable siempre, como el botón de §5.3: `disabled` le quitaría el foco a quien
                  acaba de escribir y el motivo no se anunciaría. */}
              <button
                type="button"
                className="btn-plano"
                aria-disabled={vacia}
                onClick={() => {
                  const respuesta = escrita.trim()
                  if (respuesta === '') return
                  onResponder(pregunta.texto, respuesta)
                }}
              >
                {BOTON_RESPONDER}
              </button>
            </div>
          </div>
        )
      })}

      <button type="button" className="btn-plano" onClick={onSeguir}>
        {BOTON_SEGUIR}
      </button>
    </section>
  )
}
