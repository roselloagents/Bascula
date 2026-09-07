// Red de última instancia: si algo revienta durante el render, el usuario ve una pantalla con una
// salida en vez de una página en blanco.
//
// Sin esto, un dato guardado con la forma equivocada (el esquema del borrador cambió en la v1.1)
// dejaba `#root` vacío: cero botones, y cada recarga repitiendo el fallo, así que ni siquiera se
// podía pulsar "Empezar de cero". La única salida era borrar los datos del sitio a mano.
import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

/** Todo lo que la app guarda en este dispositivo: respuestas, sesión, ajuste manual y pesajes. */
const PREFIJO = 'bascula:'

/** Borra las claves de Báscula y recarga. Lo que haya en el móvil se pierde; el plan se rehace. */
function empezarDeCero(): void {
  try {
    const claves: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const clave = window.localStorage.key(i)
      if (clave !== null && clave.startsWith(PREFIJO)) claves.push(clave)
    }
    for (const clave of claves) window.localStorage.removeItem(clave)
  } catch {
    // Modo privado o almacenamiento bloqueado: no hay nada guardado que borrar.
  }
  window.location.reload()
}

interface Props {
  children: ReactNode
}

interface Estado {
  roto: boolean
}

export class LimiteDeError extends Component<Props, Estado> {
  state: Estado = { roto: false }

  static getDerivedStateFromError(): Estado {
    return { roto: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Báscula: fallo durante el render', error, info.componentStack)
  }

  render(): ReactNode {
    if (!this.state.roto) return this.props.children
    return (
      <div className="app">
        <main className="contenido">
          <section className="excluido">
            <h2>Algo se ha roto</h2>
            <p className="excluido-texto">
              No hemos podido pintar tu plan. Suele pasar cuando lo que quedó guardado en este móvil
              es de una versión anterior de Báscula. Empezar de cero borra tus respuestas, tu ajuste
              manual y tus pesajes de este dispositivo, y deja la app como recién abierta.
            </p>
            <div className="acciones">
              <button type="button" className="btn btn-principal" onClick={empezarDeCero}>
                Empezar de cero
              </button>
            </div>
          </section>
        </main>
      </div>
    )
  }
}
