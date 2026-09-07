// Ayudas sobre la lista de avisos que devuelve el motor.
// Vive fuera de los ficheros de componentes para que cada .tsx exporte solo componentes.

import type { AvisoTexto } from '../../engine/types'

/** Busca un aviso por su código; devuelve undefined si el motor no lo ha emitido. */
export function buscarAviso(avisos: AvisoTexto[], codigo: string): AvisoTexto | undefined {
  return avisos.find((aviso) => aviso.codigo === codigo)
}
