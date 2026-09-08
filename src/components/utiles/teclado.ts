// Teclas que la interfaz tiene que interceptar.
// Vive fuera de los ficheros de componentes para que cada .tsx exporte solo componentes.

import type { KeyboardEvent } from 'react'

/**
 * Intro en el buscador de alimentos **no** envía el cuestionario (SPEC-ux §1 paso 14, v1.2.1).
 *
 * El campo vive dentro del `<form className="wizard" onSubmit={avanzar}>` del cuestionario y es el
 * único campo de texto del paso: por la submisión implícita de HTML, un Intro —o la tecla
 * "Buscar"/"Ir" que el teclado del móvil enseña justo por ser `type="search"`— llamaba a `avanzar`,
 * y como el paso 14 es el último y siempre está completo, generaba el plan y sacaba al usuario del
 * cuestionario con cero alimentos marcados. El `blur` cierra el teclado, que es lo único que esa
 * tecla sí tiene que hacer: filtrar ya filtra en cada letra.
 */
export function teclaEnBuscador(evento: KeyboardEvent<HTMLInputElement>) {
  if (evento.key !== 'Enter') return
  evento.preventDefault()
  evento.currentTarget.blur()
}
