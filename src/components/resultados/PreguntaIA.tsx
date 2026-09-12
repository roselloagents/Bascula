// Tarjeta "Una pregunta antes de seguir" (SPEC-dieta-propia §4bis.5).
//
// El modelo puede devolver hasta dos preguntas con respuestas rápidas. Aquí no se llama a nada:
// responder sube el par {pregunta, respuesta} a `App`, que lo guarda, lo añade al texto contado y
// vuelve a pedir la propuesta. "Seguir así" cierra la tarjeta sin gastar una llamada.

import { useEffect, useId, useRef, useState } from 'react'
import type { PreguntaIA as PreguntaDelModelo } from '../../engine/types'
import { PREGUNTAS_MAX } from '../../dieta/almacen'
import { RESPUESTA_MAX } from '../../dieta/contexto'

/** [SPEC] §4bis.5, título de la tarjeta con UNA pregunta. */
export const TITULO_PREGUNTA_IA = 'Una pregunta antes de seguir'
/** [SPEC] §4bis.5, el mismo título cuando se pintan las dos: en singular era falso. */
export const TITULO_PREGUNTAS_IA = 'Dos preguntas antes de seguir'
/** [SPEC] §4bis.5, el campo de texto libre y sus dos botones. */
export const ETIQUETA_OTRA_RESPUESTA = 'Otra respuesta'
export const BOTON_RESPONDER = 'Responder'
export const BOTON_SEGUIR = 'Seguir así'
/** [SPEC] §4bis.5, al pulsar "Responder" con el campo vacío (WCAG 3.3.1). */
export const AVISO_RESPUESTA_VACIA = 'Escribe tu respuesta o elige una de las opciones.'

interface Props {
  preguntas: readonly PreguntaDelModelo[]
  /** Responder: se guarda, se añade al texto contado y se pide otra propuesta (misma variante). */
  onResponder: (pregunta: string, respuesta: string) => void
  /** "Seguir así": cierra la tarjeta sin llamar a nadie. */
  onSeguir: () => void
  /**
   * La tarjeta se ha ido con algo escrito a medias (llegó una propuesta nueva mientras la persona
   * escribía). No se puede enviar por su cuenta, pero tampoco puede desaparecer en silencio.
   */
  onDescartada?: () => void
}

export function PreguntaIA({ preguntas, onResponder, onSeguir, onDescartada }: Props) {
  const id = useId()
  // Una caja de texto por pregunta: con dos preguntas, un solo campo no diría a cuál responde.
  const [escritas, setEscritas] = useState<Record<number, string>>({})
  const [aviso, setAviso] = useState('')
  const campos = useRef<Record<number, HTMLInputElement | null>>({})
  /** Lo escrito, para poder mirarlo desde la limpieza del efecto (que se ejecuta al desmontar). */
  const pendiente = useRef(escritas)
  const avisarDescarte = useRef(onDescartada)

  // Los refs se escriben en un efecto, no en el render: aquí solo se usan para saber, cuando la
  // tarjeta ya se ha ido, si había algo escrito a medias.
  useEffect(() => {
    pendiente.current = escritas
    avisarDescarte.current = onDescartada
  })

  useEffect(() => {
    return () => {
      const hay = Object.values(pendiente.current).some((t) => t.trim() !== '')
      if (hay) avisarDescarte.current?.()
    }
  }, [])

  if (preguntas.length === 0) return null

  const visibles = preguntas.slice(0, PREGUNTAS_MAX)

  return (
    <section className="dieta-preguntas" aria-labelledby={`${id}-titulo`}>
      <h3 className="dieta-subtitulo" id={`${id}-titulo`}>
        {visibles.length === 1 ? TITULO_PREGUNTA_IA : TITULO_PREGUNTAS_IA}
      </h3>

      {visibles.map((pregunta, i) => {
        const escrita = escritas[i] ?? ''
        const vacia = escrita.trim() === ''
        // Con dos preguntas, "Responder" y "Otra respuesta" se repetían con el mismo nombre
        // accesible y nada las distinguía al tabular (WCAG 2.4.6): cada grupo se nombra con su
        // propia pregunta.
        const idTexto = `${id}-texto-${i}`
        return (
          <div
            className="dieta-pregunta"
            key={pregunta.texto}
            role="group"
            aria-labelledby={idTexto}
          >
            <p className="dieta-pregunta-texto" id={idTexto}>
              {pregunta.texto}
            </p>
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
                  aria-label={`${ETIQUETA_OTRA_RESPUESTA} a «${pregunta.texto}»`}
                  ref={(nodo) => {
                    campos.current[i] = nodo
                  }}
                  value={escrita}
                  onChange={(evento) => {
                    setAviso('')
                    setEscritas((previas) => ({ ...previas, [i]: evento.target.value }))
                  }}
                />
              </div>
              {/* Operable siempre, como el botón de §5.3: `disabled` le quitaría el foco a quien
                  acaba de escribir y el motivo no se anunciaría. Pero entonces hay que DECIR el
                  motivo: pulsarlo vacío no podía quedarse mudo (WCAG 3.3.1). */}
              <button
                type="button"
                className="btn-plano"
                aria-disabled={vacia}
                aria-label={`${BOTON_RESPONDER} a «${pregunta.texto}»`}
                onClick={() => {
                  const respuesta = escrita.trim()
                  if (respuesta === '') {
                    setAviso(AVISO_RESPUESTA_VACIA)
                    campos.current[i]?.focus()
                    return
                  }
                  onResponder(pregunta.texto, respuesta)
                }}
              >
                {BOTON_RESPONDER}
              </button>
            </div>
          </div>
        )
      })}

      <p className="dieta-pregunta-aviso" role="status">
        {aviso}
      </p>

      <button type="button" className="btn-plano" onClick={onSeguir}>
        {BOTON_SEGUIR}
      </button>
    </section>
  )
}
