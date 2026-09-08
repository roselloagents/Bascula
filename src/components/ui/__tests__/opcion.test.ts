// Nombre accesible de las tarjetas de opción (QA §4).
//
// El árbol de accesibilidad exponía los `input` como «radio "on"» / «checkbox "on"»: el texto
// visible de la tarjeta no llegaba al nombre accesible. Aquí se renderiza el componente de verdad
// y se comprueba que el `aria-labelledby` del control apunta a los nodos que llevan el título y el
// detalle, que es lo que lee un lector de pantalla.
//
// Se usa `renderToStaticMarkup` en vez de un DOM completo: el proyecto no arrastra jsdom y para
// esta comprobación basta con el HTML que React emite.
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Interruptor, Opcion } from '../Controles'

/** Valor de un atributo del primer `<input>` del marcado. */
function atributoDelInput(html: string, atributo: string): string | null {
  const input = html.match(/<input\b[^>]*>/)
  if (!input) return null
  const valor = input[0].match(new RegExp(`${atributo}="([^"]*)"`))
  return valor ? valor[1] : null
}

/** Texto de los elementos cuyo `id` se cita, en el mismo orden que los cita `aria-labelledby`. */
function nombreAccesible(html: string): string {
  const ids = (atributoDelInput(html, 'aria-labelledby') ?? '').split(/\s+/).filter(Boolean)
  return ids
    .map((id) => {
      const nodo = html.match(new RegExp(`<span[^>]*id="${id}"[^>]*>([\\s\\S]*?)</span>`))
      return nodo ? nodo[1].replace(/<[^>]+>/g, '').trim() : ''
    })
    .join(' ')
    .trim()
}

describe('tarjetas de opción — nombre accesible', () => {
  it('un radio con título y detalle se llama como la tarjeta', () => {
    const html = renderToStaticMarkup(
      createElement(Opcion, {
        nombre: 'metodo-grasa',
        titulo: 'Puedo medirme con cinta métrica',
        detalle: 'Tengo una cinta métrica a mano.',
        seleccionada: false,
        onElegir: () => {},
      }),
    )
    expect(atributoDelInput(html, 'type')).toBe('radio')
    expect(nombreAccesible(html)).toBe(
      'Puedo medirme con cinta métrica Tengo una cinta métrica a mano.',
    )
  })

  it('un radio sin detalle se llama como su título', () => {
    const html = renderToStaticMarkup(
      createElement(Opcion, {
        nombre: 'sexo',
        titulo: 'Mujer',
        seleccionada: true,
        onElegir: () => {},
      }),
    )
    expect(nombreAccesible(html)).toBe('Mujer')
  })

  it('un checkbox de condiciones se llama como su título', () => {
    const html = renderToStaticMarkup(
      createElement(Opcion, {
        nombre: 'condicion-ninguna',
        tipo: 'checkbox',
        titulo: 'Ninguna de las anteriores',
        seleccionada: false,
        onElegir: () => {},
      }),
    )
    expect(atributoDelInput(html, 'type')).toBe('checkbox')
    expect(nombreAccesible(html)).toBe('Ninguna de las anteriores')
  })

  it('el interruptor de comidas sencillas también tiene nombre', () => {
    const html = renderToStaticMarkup(
      createElement(Interruptor, {
        titulo: '¿Quieres comidas sencillas?',
        detalle: 'Como mucho doce alimentos en toda la semana.',
        activo: false,
        onCambiar: () => {},
      }),
    )
    expect(atributoDelInput(html, 'role')).toBe('switch')
    expect(nombreAccesible(html)).toBe(
      '¿Quieres comidas sencillas? Como mucho doce alimentos en toda la semana.',
    )
  })

  it('ninguna tarjeta se queda sin nombre accesible', () => {
    const html = renderToStaticMarkup(
      createElement(Opcion, {
        nombre: 'objetivo',
        titulo: 'Perder grasa',
        seleccionada: false,
        onElegir: () => {},
      }),
    )
    const nombre = nombreAccesible(html)
    expect(nombre.length).toBeGreaterThan(0)
    expect(nombre).not.toBe('on')
  })
})
