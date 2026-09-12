// Piezas compartidas por la pantalla de resultados.

import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import type { AvisoTexto } from '../../engine/types'
import { IconoAviso, IconoNota } from '../ui/Iconos'
import { buscarAviso } from '../utiles/avisos'

interface SeccionProps {
  titulo: string
  descripcion?: ReactNode
  children: ReactNode
  icono?: ReactNode
  /**
   * Contador que, al cambiar, lleva el scroll y el foco al `h2` (SPEC-dieta-propia §5.4: al volver
   * al menú propuesto el foco tiene que caer aquí, no en el `body`). Sin esta prop el título no es
   * enfocable y la sección se comporta como siempre.
   */
  foco?: number
}

export function Seccion({ titulo, descripcion, children, icono, foco }: SeccionProps) {
  const titular = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (foco === undefined || foco <= 0) return
    titular.current?.scrollIntoView({ block: 'start' })
    titular.current?.focus({ preventScroll: true })
  }, [foco])
  return (
    <section className="seccion">
      <header className="seccion-cabecera">
        <h2 ref={titular} tabIndex={foco === undefined ? undefined : -1}>
          {icono ? <span className="seccion-icono">{icono}</span> : null}
          {titulo}
        </h2>
        {descripcion ? <p className="seccion-descripcion">{descripcion}</p> : null}
      </header>
      {children}
    </section>
  )
}

export function CajaAviso({ aviso }: { aviso: AvisoTexto }) {
  const esWarn = aviso.severidad === 'warn' || aviso.severidad === 'error'
  return (
    <div className={`caja-aviso${esWarn ? ' es-warn' : ''}`}>
      <span className="caja-aviso-icono" aria-hidden="true">
        {esWarn ? <IconoAviso /> : <IconoNota />}
      </span>
      <div>
        <p className="caja-aviso-titulo">{aviso.titulo}</p>
        <p className="caja-aviso-texto">{aviso.texto}</p>
      </div>
    </div>
  )
}

/** Renderiza un aviso solo si el motor lo ha emitido. */
export function AvisoSiExiste({ avisos, codigo }: { avisos: AvisoTexto[]; codigo: string }) {
  const aviso = buscarAviso(avisos, codigo)
  return aviso ? <CajaAviso aviso={aviso} /> : null
}
