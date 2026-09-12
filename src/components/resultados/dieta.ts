// Piezas sin JSX de "Cuéntanos cómo comes" (SPEC-dieta-propia §5), compartidas por la tarjeta
// (§5.2), el formulario (§5.3), el bloque compuesto (§5.4) y `App`.
//
// Viven aparte de los componentes porque el repo exige que un fichero con componentes solo exporte
// componentes (`react-refresh/only-export-components`), y porque así se pueden probar sin pintar
// nada.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { DietaInterpretada, Ejemplos, InputCalculo } from '../../engine/types'
import { capacidades } from '../../dieta/api'
import { num } from '../utiles/formato'

/** Ancla del enlace de descubribilidad de la cabecera (§5.1). */
export const ID_TARJETA_DIETA = 'tarjeta-dieta'

/**
 * ¿Se ofrece la función? (§5.1) Hay menú —el mismo predicado `sinMenu` de `BloquesMenu`: sin
 * `renal`, sin `hepatica` y con comidas— y no hay `tca`. Con `renal` o `hepatica` no existen huecos
 * que montar, así que la guarda vive aquí y no en el algoritmo (§4.7).
 */
export function ofreceDietaPropia(inputs: InputCalculo, ejemplos: Ejemplos): boolean {
  if (inputs.condiciones.includes('tca')) return false
  if (inputs.condiciones.includes('renal') || inputs.condiciones.includes('hepatica')) return false
  return ejemplos.entreno.comidas.length > 0
}

/** [SPEC] §5.3, al validar: "Listo: hemos leído 2 comidas, 1 gusto y 1 costumbre…". */
export function textoListo(interpretada: DietaInterpretada): string {
  const partes: string[] = []
  const n = interpretada.comidas.length
  const g = interpretada.gustos.length
  const h = interpretada.habitos.length
  if (n > 0) partes.push(`${num(n)} ${n === 1 ? 'comida' : 'comidas'}`)
  if (g > 0) partes.push(`${num(g)} ${g === 1 ? 'gusto' : 'gustos'}`)
  if (h > 0) partes.push(`${num(h)} ${h === 1 ? 'costumbre' : 'costumbres'}`)
  const lista =
    partes.length === 0
      ? 'lo que nos has contado'
      : partes.length === 1
        ? partes[0]
        : `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`
  return `Listo: hemos leído ${lista}. Revisa que sea lo tuyo.`
}

/**
 * Sin acentos ni mayúsculas, como en §4.1. Se repite aquí en vez de importarlo de
 * `src/meals/dieta/componer`: ese módulo va en el paquete diferido de menús y traerlo a la pantalla
 * metería el generador entero en la carga inicial.
 */
function normalizar(nombre: string): string {
  return nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * De la fila que se ve a su sitio en la `DietaInterpretada` guardada. El día compuesto empareja
 * cada comida dictada con el hueco de mismo nombre normalizado y **quita los retirados**, así que
 * el n-ésimo alimento de la pantalla es el n-ésimo no retirado de esa comida (§4.1 y §4.2.1).
 */
export function localizarAlimento(
  interpretada: DietaInterpretada,
  nombreComida: string,
  visible: number,
): { comida: number; alimento: number } | null {
  const clave = normalizar(nombreComida)
  const comida = interpretada.comidas.findIndex((c) => normalizar(c.nombre) === clave)
  if (comida < 0) return null
  const alimentos = interpretada.comidas[comida].alimentos
  let n = 0
  for (let j = 0; j < alimentos.length; j += 1) {
    if (alimentos[j].retirado === true) continue
    if (n === visible) return { comida, alimento: j }
    n += 1
  }
  return null
}

// ---- Apertura de la tarjeta (§5.2): capacidades perezosas -----------------

/**
 * Estado del despliegue del formulario. `pidiendo` es la llamada a `/api/capacidades`, que se hace
 * **al pulsar el botón**, no al montar la pantalla (§2.2).
 */
export type EstadoApertura = 'cerrado' | 'pidiendo' | 'abierto' | 'no_disponible'

export interface AperturaDieta {
  estado: EstadoApertura
  /** Token efímero de `/api/capacidades`, ya listo para `interpretarDieta`. */
  token: string | null
  abrir: () => void
  cerrar: () => void
  /** Un 503 durante la interpretación devuelve la tarjeta al estado "no disponible" (§5.3). */
  noDisponible: () => void
}

/**
 * Pide capacidades y decide si se despliega el formulario o la nota de "no disponible". Lo usan la
 * tarjeta de entrada (§5.2) y el "Editar lo que conté" del bloque compuesto (§5.4).
 */
export function useAperturaDieta(inicial: EstadoApertura = 'cerrado'): AperturaDieta {
  const [estado, setEstado] = useState<EstadoApertura>(inicial)
  const [token, setToken] = useState<string | null>(null)
  const vivo = useRef(true)
  useEffect(() => {
    vivo.current = true
    return () => {
      vivo.current = false
    }
  }, [])

  const abrir = useCallback(() => {
    setEstado('pidiendo')
    void capacidades().then((caps) => {
      if (!vivo.current) return
      // `capacidades` nunca lanza: cualquier fallo llega aquí como `interpretar: false`, que es
      // exactamente el estado "no disponible" de §5.2.
      if (caps.interpretar) {
        setToken(caps.token)
        setEstado('abierto')
      } else {
        setToken(null)
        setEstado('no_disponible')
      }
    })
  }, [])

  const cerrar = useCallback(() => setEstado('cerrado'), [])
  const noDisponible = useCallback(() => {
    setToken(null)
    setEstado('no_disponible')
  }, [])

  return { estado, token, abrir, cerrar, noDisponible }
}
