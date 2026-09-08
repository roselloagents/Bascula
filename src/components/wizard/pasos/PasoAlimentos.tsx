// Paso 14 (v1.2, decisión G): "¿Hay alimentos que no quieres ver en tu menú?".
//
// Es el último paso y es opcional de rellenar. No cambia ni una caloría: las dos listas viajan a
// `src/meals`, y el motor las ignora igual que `menu_sencillo`. La lista de alimentos y el filtro
// por base y restricciones salen de `src/data/foods.ts` y `src/meals/filtros.ts`: aquí no se
// duplica ninguna regla.

import { useRef, useState, type KeyboardEvent } from 'react'
import { gruposDeAlimentos, resumenMarcados } from '../../utiles/alimentos'
import { Pantalla, type PropsPaso } from './comun'

type Modo = 'excluir' | 'favorito'

/** [SPEC] SPEC-ux §1 paso 14, intro literal. */
const INTRO =
  'Márcalos y no aparecerán ni en tus menús ni en tu lista de la compra. Y si hay alguno que te encanta, márcalo como favorito y lo pondremos primero. Esto no cambia ni una caloría de tu plan: solo cambia qué comes.'

const MODOS: { valor: Modo; icono: string; titulo: string }[] = [
  { valor: 'excluir', icono: '✕', titulo: 'No me gusta' },
  { valor: 'favorito', icono: '★', titulo: 'Favorito' },
]

export function PasoAlimentos({ b, set }: PropsPaso) {
  const [modo, setModo] = useState<Modo>('excluir')
  const botones = useRef<(HTMLButtonElement | null)[]>([])
  const grupos = gruposDeAlimentos({ base: b.preferencia_base, restricciones: b.restricciones })

  // Patrón ARIA de `radiogroup` (§1 paso 14): un solo botón en el orden de tabulación y las
  // flechas mueven la selección. Antes los dos tenían `tabIndex 0` y las flechas no hacían nada.
  const teclas = (evento: KeyboardEvent<HTMLButtonElement>, indice: number) => {
    const salto =
      evento.key === 'ArrowRight' || evento.key === 'ArrowDown'
        ? 1
        : evento.key === 'ArrowLeft' || evento.key === 'ArrowUp'
          ? -1
          : 0
    if (salto === 0) return
    evento.preventDefault()
    const siguiente = (indice + salto + MODOS.length) % MODOS.length
    setModo(MODOS[siguiente].valor)
    botones.current[siguiente]?.focus()
  }

  // Reglas de §1 paso 14: el chip sin marcar toma el modo activo; el marcado en ese mismo modo se
  // desmarca; el marcado en el otro modo cambia de lista. Un alimento nunca está en las dos.
  const alternar = (id: string) =>
    set((previo) => {
      const excluidos = previo.alimentos_excluidos
      const favoritos = previo.alimentos_favoritos
      if (modo === 'excluir') {
        if (excluidos.includes(id)) {
          return { alimentos_excluidos: excluidos.filter((x) => x !== id) }
        }
        return {
          // Los excluidos van en orden de `id` para que el borrador sea estable.
          alimentos_excluidos: [...excluidos, id].sort(),
          alimentos_favoritos: favoritos.filter((x) => x !== id),
        }
      }
      if (favoritos.includes(id)) {
        return { alimentos_favoritos: favoritos.filter((x) => x !== id) }
      }
      return {
        // Los favoritos van en el orden en que los marcó el usuario: ese orden es normativo.
        alimentos_favoritos: [...favoritos, id],
        alimentos_excluidos: excluidos.filter((x) => x !== id),
      }
    })

  const resumen = resumenMarcados(b.alimentos_excluidos, b.alimentos_favoritos)

  return (
    <Pantalla
      titulo="¿Hay alimentos que no quieres ver en tu menú?"
      intro={INTRO}
      ayuda="Solo te enseñamos los alimentos que encajan con cómo comes: si eres vegana no verás pollo, y si evitas el gluten no verás pan de trigo. Marcar o desmarcar aquí no toca tus calorías ni tus macros; rehacemos el menú, las equivalencias y la lista de la compra, nada más."
    >
      <div className="segmentado-barra">
        <div className="segmentado" role="radiogroup" aria-label="Qué haces al tocar un alimento">
          {MODOS.map(({ valor, icono, titulo }, i) => (
            <button
              key={valor}
              type="button"
              role="radio"
              aria-checked={modo === valor}
              tabIndex={modo === valor ? 0 : -1}
              ref={(nodo) => {
                botones.current[i] = nodo
              }}
              className="segmentado-boton"
              data-sel={modo === valor}
              onClick={() => setModo(valor)}
              onKeyDown={(evento) => teclas(evento, i)}
            >
              <span aria-hidden="true">{icono}</span> {titulo}
            </button>
          ))}
        </div>
        {/* El mismo resumen vivo que hay al final, aquí arriba: la pantalla mide cuatro pantallas
            de móvil y el recuento quedaba fuera de la vista todo el rato (§1 paso 14). */}
        {resumen !== '' ? <p className="segmentado-resumen">{resumen}</p> : null}
      </div>

      {grupos.map((grupo) => (
        <div className="grupo-chips" key={grupo.clave}>
          <h3 className="grupo-chips-titulo">{grupo.nombre}</h3>
          <ul className="chips">
            {grupo.alimentos.map((alimento) => {
              const excluido = b.alimentos_excluidos.includes(alimento.id)
              const favorito = b.alimentos_favoritos.includes(alimento.id)
              const estado = excluido ? 'excluido' : favorito ? 'favorito' : 'libre'
              return (
                <li key={alimento.id}>
                  <button
                    type="button"
                    className="chip"
                    data-estado={estado}
                    aria-pressed={excluido || favorito}
                    aria-label={
                      excluido
                        ? `${alimento.nombre_corto}, no me gusta`
                        : favorito
                          ? `${alimento.nombre_corto}, favorito`
                          : undefined
                    }
                    onClick={() => alternar(alimento.id)}
                  >
                    <span className="chip-marca" aria-hidden="true">
                      {excluido ? '✕' : favorito ? '★' : ''}
                    </span>
                    {alimento.nombre_corto}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ))}

      <p className="resumen-alimentos" role="status" aria-live="polite">
        {resumen}
      </p>
    </Pantalla>
  )
}
