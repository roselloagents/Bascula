// Piezas compartidas por la pantalla de resultados.

import type { ReactNode } from 'react'
import type { AvisoTexto } from '../../engine/types'
import { IconoAviso, IconoNota } from '../ui/Iconos'
import { buscarAviso } from '../utiles/avisos'

interface SeccionProps {
  titulo: string
  descripcion?: ReactNode
  children: ReactNode
  icono?: ReactNode
}

export function Seccion({ titulo, descripcion, children, icono }: SeccionProps) {
  return (
    <section className="seccion">
      <header className="seccion-cabecera">
        <h2>
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
