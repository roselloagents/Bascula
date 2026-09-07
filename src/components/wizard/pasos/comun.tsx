// Andamiaje compartido por las pantallas del cuestionario.

import type { ReactNode } from 'react'
import { Ayuda } from '../../ui/Controles'
import type { Borrador } from '../borrador'

export type ParcheBorrador = Partial<Borrador> | ((previo: Borrador) => Partial<Borrador>)

export interface PropsPaso {
  b: Borrador
  /** Acepta un parche directo o una función del estado anterior (actualizaciones anidadas). */
  set: (parche: ParcheBorrador) => void
  errores: Record<string, string>
}

interface PantallaProps {
  titulo: string
  intro?: ReactNode
  ayuda?: ReactNode
  children: ReactNode
}

export function Pantalla({ titulo, intro, ayuda, children }: PantallaProps) {
  return (
    <div className="pantalla">
      <header className="pantalla-cabecera">
        <h2 className="pantalla-titulo">{titulo}</h2>
        {intro ? <p className="pantalla-intro">{intro}</p> : null}
        {ayuda ? <Ayuda>{ayuda}</Ayuda> : null}
      </header>
      <div className="pantalla-cuerpo">{children}</div>
    </div>
  )
}
