// Diálogo de confirmación de "Empezar de cero".
//
// Sin DOM completo (el proyecto no arrastra jsdom) se comprueba el marcado que React emite: es un
// <dialog> etiquetado por su título y descrito por su texto, y el botón que recibe el foco al
// abrirse es el de cancelar, para que un Enter apresurado no borre nada.
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Confirmacion } from '../Confirmacion'

function marcado(): string {
  return renderToStaticMarkup(
    createElement(Confirmacion, {
      abierto: true,
      titulo: '¿Empezar de cero?',
      texto: 'Se borrarán todas tus respuestas.',
      confirmar: 'Sí, empezar de cero',
      cancelar: 'No, seguir donde estaba',
      onConfirmar: () => undefined,
      onCancelar: () => undefined,
    }),
  )
}

describe('diálogo de confirmación', () => {
  it('es un <dialog> etiquetado por el título y descrito por el texto', () => {
    const html = marcado()
    const dialogo = html.match(/<dialog\b[^>]*>/)?.[0] ?? ''
    const idTitulo = dialogo.match(/aria-labelledby="([^"]+)"/)?.[1]
    const idTexto = dialogo.match(/aria-describedby="([^"]+)"/)?.[1]
    expect(idTitulo).toBeTruthy()
    expect(idTexto).toBeTruthy()
    expect(html).toContain(`id="${idTitulo}"`)
    expect(html).toContain(`id="${idTexto}"`)
    expect(html).toContain('¿Empezar de cero?')
    expect(html).toContain('Se borrarán todas tus respuestas.')
  })

  it('ofrece cancelar antes que confirmar y ambos botones son type="button"', () => {
    const html = marcado()
    const botones = html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g) ?? []
    expect(botones).toHaveLength(2)
    expect(botones[0]).toContain('type="button"')
    expect(botones[0]).toContain('No, seguir donde estaba')
    expect(botones[1]).toContain('type="button"')
    expect(botones[1]).toContain('Sí, empezar de cero')
  })
})
