// Paso 14 (v1.2, decisión G): "¿Hay alimentos que no quieres ver en tu menú?".
//
// Es el último paso y es opcional de rellenar. No cambia ni una caloría: las dos listas viajan a
// `src/meals`, y el motor las ignora igual que `menu_sencillo`. La lista de alimentos y el filtro
// por base y restricciones salen de `src/data/foods.ts` y `src/meals/filtros.ts`: aquí no se
// duplica ninguna regla.

import { useRef, useState, type KeyboardEvent } from 'react'
import {
  cuentaAlimentos,
  filtrarGrupos,
  gruposDeAlimentos,
  lineaBusqueda,
  marcadosDelGrupo,
  marcasDeGrupo,
  normalizarTexto,
  resumenMarcados,
  type ClaveGrupoChips,
  type GrupoChips,
} from '../../utiles/alimentos'
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
  const grupos = gruposDeAlimentos({
    base: b.preferencia_base,
    restricciones: b.restricciones,
  })

  const [busqueda, setBusqueda] = useState('')
  // Al entrar, todo plegado salvo los grupos que ya tienen algo marcado: quien vuelve desde el
  // enlace "Cambiar" de resultados ve lo suyo abierto (§1 paso 14). Solo se calcula al montar; a
  // partir de ahí manda lo que toque el usuario, y el plegado no se persiste.
  const [abiertos, setAbiertos] = useState<ClaveGrupoChips[]>(() =>
    grupos
      .filter((grupo) => {
        const marcados = marcadosDelGrupo(grupo, b.alimentos_excluidos, b.alimentos_favoritos)
        return marcados.excluidos.length + marcados.favoritos.length > 0
      })
      .map((grupo) => grupo.clave),
  )

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

  const alternarGrupo = (clave: ClaveGrupoChips) =>
    setAbiertos((previo) =>
      previo.includes(clave) ? previo.filter((otra) => otra !== clave) : [...previo, clave],
    )

  const resumen = resumenMarcados(b.alimentos_excluidos, b.alimentos_favoritos)

  // Con algo escrito no hay nada que plegar: los grupos que quedan se pintan abiertos y el botón
  // de "Mostrar todos" sobra.
  const buscando = normalizarTexto(busqueda) !== ''
  const todosAbiertos = grupos.every((grupo) => abiertos.includes(grupo.clave))

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
        {/* Buscador (§1 paso 14, v1.2.1): 103 chips en siete grupos median cuatro pantallas de
            móvil y encontrar el brócoli costaba scroll. Sin `autoFocus`: al entrar en el paso el
            foco sigue en el contenedor, como en el resto del cuestionario. */}
        <div className="buscador">
          <label className="etiqueta-oculta" htmlFor="buscador-alimentos">
            Busca un alimento por su nombre
          </label>
          <input
            id="buscador-alimentos"
            className="buscador-campo"
            type="search"
            value={busqueda}
            placeholder="Busca un alimento (p. ej. brócoli)"
            autoComplete="off"
            onChange={(evento) => setBusqueda(evento.target.value)}
          />
          {buscando ? (
            <button type="button" className="buscador-borrar" onClick={() => setBusqueda('')}>
              Borrar
            </button>
          ) : null}
        </div>

        {/* El mismo resumen vivo que hay al final, aquí arriba: la pantalla mide cuatro pantallas
            de móvil y el recuento quedaba fuera de la vista todo el rato (§1 paso 14). El botón de
            plegado comparte fila con él para que la barra fija no pase de 130 px en 375 px. */}
        <div className="segmentado-pie">
          <p className="segmentado-resumen">{resumen}</p>
          {buscando ? null : (
            <button
              type="button"
              className="plegar-todos"
              onClick={() => setAbiertos(todosAbiertos ? [] : grupos.map((grupo) => grupo.clave))}
            >
              {todosAbiertos ? 'Plegar todos' : 'Mostrar todos'}
            </button>
          )}
        </div>
      </div>

      <GruposPlegables
        grupos={grupos}
        busqueda={busqueda}
        abiertos={abiertos}
        excluidos={b.alimentos_excluidos}
        favoritos={b.alimentos_favoritos}
        alternarGrupo={alternarGrupo}
        alternarChip={alternar}
      />

      <p className="resumen-alimentos" role="status" aria-live="polite">
        {resumen}
      </p>
    </Pantalla>
  )
}

interface PropsGrupos {
  grupos: GrupoChips[]
  busqueda: string
  abiertos: ClaveGrupoChips[]
  excluidos: readonly string[]
  favoritos: readonly string[]
  alternarGrupo: (clave: ClaveGrupoChips) => void
  alternarChip: (id: string) => void
}

/**
 * Los siete grupos plegables y la línea de resultados del buscador (§1 paso 14, v1.2.1). Se
 * separa de `PasoAlimentos` porque es la parte que depende del texto buscado y del plegado, y
 * así se puede pintar con `renderToStaticMarkup` sin simular a nadie escribiendo.
 */
export function GruposPlegables({
  grupos,
  busqueda,
  abiertos,
  excluidos,
  favoritos,
  alternarGrupo,
  alternarChip,
}: PropsGrupos) {
  // Buscando se pintan solo los grupos con coincidencias y todos desplegados, pero `abiertos` no
  // se toca: al borrar el buscador se vuelve exactamente a lo que había (§1 paso 14).
  const buscando = normalizarTexto(busqueda) !== ''
  const visibles = filtrarGrupos(grupos, busqueda)

  return (
    <>
      {/* La región vive siempre en el DOM aunque esté vacía: un `aria-live` que aparece con el
        texto ya dentro no se anuncia. */}
      <p className="busqueda-resultados" role="status" aria-live="polite">
        {buscando ? lineaBusqueda(cuentaAlimentos(visibles), busqueda) : ''}
      </p>

      <div className="grupos-alimentos">
        {visibles.map((grupo) => {
          const marcados = marcadosDelGrupo(grupo, excluidos, favoritos)
          const marcas = marcasDeGrupo(marcados)
          const hablado = resumenMarcados(marcados.excluidos, marcados.favoritos)
          const cuantos = grupo.alimentos.length
          const cuenta = `${cuantos} ${cuantos === 1 ? 'alimento' : 'alimentos'}`
          const abierto = buscando || abiertos.includes(grupo.clave)
          const idLista = `chips-${grupo.clave}`
          return (
            <div className="grupo-chips" key={grupo.clave}>
              {/* Buscando no hay nada que plegar —solo se pintan los grupos con coincidencias y
                abiertos—, así que la cabecera es un encabezado a secas y no un botón que no
                hace nada visible. */}
              <h3 className="grupo-chips-titulo">
                {buscando ? (
                  <span className="grupo-chips-fija">
                    <span className="grupo-chips-nombre">{grupo.nombre}</span>
                    <span className="grupo-chips-datos">{cuenta}</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="grupo-chips-boton"
                    aria-expanded={abierto}
                    aria-controls={idLista}
                    onClick={() => alternarGrupo(grupo.clave)}
                  >
                    <span className="grupo-chips-flecha" aria-hidden="true" data-abierto={abierto}>
                      ›
                    </span>
                    <span className="grupo-chips-nombre">{grupo.nombre}</span>
                    <span className="grupo-chips-datos" aria-hidden="true">
                      {marcas === '' ? cuantos : `${cuantos} · ${marcas}`}
                    </span>
                    <span className="etiqueta-oculta">
                      {hablado === '' ? cuenta : `${cuenta}, ${hablado}`}
                    </span>
                  </button>
                )}
              </h3>
              <ul className="chips" id={idLista} hidden={!abierto}>
                {grupo.alimentos.map((alimento) => {
                  const excluido = excluidos.includes(alimento.id)
                  const favorito = favoritos.includes(alimento.id)
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
                        onClick={() => alternarChip(alimento.id)}
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
          )
        })}
      </div>
    </>
  )
}
