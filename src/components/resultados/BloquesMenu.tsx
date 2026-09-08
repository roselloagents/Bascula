// Ejemplos de menú y consejos accionables (SPEC-ux §2.5 y §2.7).

import { useEffect, useState } from 'react'
import type { Ejemplos, InputCalculo } from '../../engine/types'
import { Plegable } from '../ui/Controles'
import { IconoBombilla, IconoMarca, IconoPesa } from '../ui/Iconos'
import { listaNombresCortos, nombreCorto } from '../utiles/alimentos'
import { NOTA_MENU, NOTA_SENCILLO_SIN_OTRO_EJEMPLO, NOTA_VERDURA_FRUTA } from '../utiles/copy'
import { entero } from '../utiles/formato'
import { textoModoSencillo } from './compra'
import { Seccion } from './comun'

/** [SPEC] SPEC-ux §3.1: texto que sustituye a los menús con condición renal o hepática. */
const TEXTO_SIN_MENU =
  'No te proponemos menús de ejemplo. Con tu condición, la elección concreta de alimentos (potasio, fósforo, sodio y tipo de proteína) cambia mucho el resultado y debe hacerla un/a dietista-nutricionista especializado/a. Tus calorías y tus macros siguen siendo una referencia orientativa que puedes llevarle.'

/** [SPEC] SPEC-ux §3.1: notas fijas sobre el bloque de menús. */
const NOTA_DIABETES =
  'Estos gramajes de hidratos son un ejemplo: si usas insulina o pastillas que bajan el azúcar, revisa la dosis con tu equipo médico antes de cambiar tu forma de comer.'
const NOTA_CARDIACA =
  'Cocina sin sal añadida y evita embutidos y conservas: con tu condición el sodio importa más que los gramos exactos.'

interface PropsMenu {
  inputs: InputCalculo
  ejemplos: Ejemplos
  onOtroEjemplo?: () => void
  /** "No me gusta" por alimento (§2.5, v1.2): añade el id a los excluidos y rehace el menú. */
  onExcluirAlimento?: (id: string) => void
  /** "Deshacer" del aviso efímero: retira el id de los excluidos. */
  onDeshacerExclusion?: (id: string) => void
  /** Enlace "Cambiar" del resumen: lleva al paso de alimentos del cuestionario. */
  onCambiarAlimentos?: () => void
}

/** Segundos que dura el aviso de "Fuera {alimento}" antes de desaparecer (§2.5). */
const SEGUNDOS_DESHACER = 6

export function BloqueMenus({
  inputs,
  ejemplos,
  onOtroEjemplo,
  onExcluirAlimento,
  onDeshacerExclusion,
  onCambiarAlimentos,
}: PropsMenu) {
  // El aviso efímero se cierra solo a los 6 s; el cambio, no. Vive aquí y no en `App` porque es
  // presentación pura: ni el plan ni el borrador dependen de que se vea o no.
  const [quitado, setQuitado] = useState<{ id: string; nombre: string } | null>(null)
  useEffect(() => {
    if (quitado === null) return
    const temporizador = window.setTimeout(() => setQuitado(null), SEGUNDOS_DESHACER * 1000)
    return () => window.clearTimeout(temporizador)
  }, [quitado])

  const sinMenu =
    inputs.condiciones.includes('renal') ||
    inputs.condiciones.includes('hepatica') ||
    ejemplos.entreno.comidas.length === 0

  if (sinMenu) {
    return (
      <Seccion titulo="Ejemplos de menú">
        <p className="nota-recuadro">{TEXTO_SIN_MENU}</p>
      </Seccion>
    )
  }

  // En la v1 el motor devuelve un único reparto (CONTRATO.md), así que el día de entreno y el de
  // descanso son idénticos: no se muestra un conmutador que promete una variación que no existe.
  const jornada = ejemplos.entreno

  return (
    <Seccion
      titulo="Un día de ejemplo"
      descripcion="Los gramajes ya están escalados a tus macros. Pesa en crudo salvo que ponga otra cosa."
    >
      {/* Distintivo de modo sencillo (§3.7): el número sale de la lista de la compra, que ya lo
          trae contado (`alimentos_distintos`); la pantalla no cuenta alimentos por su cuenta. */}
      {ejemplos.modo_sencillo ? (
        <p className="distintivo-sencillo">
          <IconoMarca tam={14} />
          {textoModoSencillo(ejemplos.compra?.alimentos_distintos)}
        </p>
      ) : null}

      {inputs.condiciones.includes('diabetes') ? <p className="nota nota-recuadro">{NOTA_DIABETES}</p> : null}
      {inputs.condiciones.includes('cardiaca') ? <p className="nota nota-recuadro">{NOTA_CARDIACA}</p> : null}

      <ol className="lista-menu">
        {jornada.comidas.map((comida) => (
          <li key={comida.comida} className="menu-comida">
            <div className="menu-comida-cabecera">
              <h3>{comida.comida}</h3>
              <span className="comida-hora cifra">{comida.hora}</span>
              {comida.peri ? (
                <span className="etiqueta-peri">
                  <IconoPesa tam={14} /> cerca de tu entreno
                </span>
              ) : null}
            </div>
            <ul className="menu-alimentos">
              {comida.alimentos.map((alimento) => (
                <li key={alimento.id}>
                  <span className="cifra menu-gramos">{entero(alimento.gramos)} g</span>
                  <span className="menu-alimento">{alimento.nombre}</span>
                  <span className="menu-medida">{alimento.medida}</span>
                  {/* §2.5 (v1.2): acción pequeña y secundaria, sin color de alerta. No llama al
                      motor: solo cambia el menú, las equivalencias, la compra y el PDF. */}
                  {onExcluirAlimento ? (
                    <button
                      type="button"
                      className="menu-quitar"
                      aria-label={`Quitar ${alimento.nombre} de mi menú`}
                      onClick={() => {
                        setQuitado({
                          id: alimento.id,
                          nombre: nombreCorto(alimento.id) ?? alimento.nombre,
                        })
                        onExcluirAlimento(alimento.id)
                      }}
                    >
                      <span aria-hidden="true">✕</span> No me gusta
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
            <p className="menu-totales cifra">
              {entero(comida.totales.kcal)} kcal · {entero(comida.totales.prot)} g de proteína ·{' '}
              {entero(comida.totales.fat)} g de grasa · {entero(comida.totales.carb)} g de hidratos
            </p>
            {comida.alternativas.length > 0 ? (
              <ul className="menu-alternativas">
                {comida.alternativas.map((alternativa) => (
                  <li key={alternativa}>{alternativa}</li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ol>

      <p className="menu-total-dia cifra">
        Total del día: {entero(jornada.totales.kcal)} kcal · {entero(jornada.totales.prot)} g de
        proteína · {entero(jornada.totales.fat)} g de grasa · {entero(jornada.totales.carb)} g de
        hidratos
      </p>

      {quitado ? (
        <p className="aviso-efimero" role="status">
          Fuera {quitado.nombre}. Hemos rehecho el menú y la compra.
          {onDeshacerExclusion ? (
            <button
              type="button"
              className="btn-plano"
              onClick={() => {
                onDeshacerExclusion(quitado.id)
                setQuitado(null)
              }}
            >
              Deshacer
            </button>
          ) : null}
        </p>
      ) : null}

      {jornada.notas.map((nota) => (
        <p className="nota" key={nota}>
          {nota}
        </p>
      ))}
      {/* Avisos propios del generador (§3.2b): "No hemos podido evitar X en la comida". */}
      {(ejemplos.avisos_menu ?? []).map((aviso) => (
        <p className="nota" key={aviso}>
          {aviso}
        </p>
      ))}
      <p className="nota">{NOTA_MENU}</p>
      <p className="nota">{NOTA_VERDURA_FRUTA}</p>

      {/* "Ver otro ejemplo" cambia de plantilla dentro del mismo plan (§2.5), pero en modo
          sencillo el generador siempre devuelve el mismo par de días (§3.7.2): el botón no haría
          nada y se leería como un fallo. Se sustituye por la explicación y la salida. */}
      {ejemplos.modo_sencillo ? (
        <p className="nota">{NOTA_SENCILLO_SIN_OTRO_EJEMPLO}</p>
      ) : onOtroEjemplo ? (
        <div className="acciones-menu">
          <button type="button" className="btn btn-secundario" onClick={onOtroEjemplo}>
            Ver otro ejemplo
          </button>
        </div>
      ) : null}

      <ResumenAlimentos inputs={inputs} onCambiar={onCambiarAlimentos} />
    </Seccion>
  )
}

/**
 * "Sin: brócoli, coliflor · Favoritos: pollo, arroz · Cambiar" (§2.5, v1.2). Los nombres son los
 * cortos de `foods.json`; cada mitad se omite si su lista está vacía y, sin ninguna de las dos,
 * la línea no se pinta.
 */
export function ResumenAlimentos({
  inputs,
  onCambiar,
}: {
  inputs: InputCalculo
  onCambiar?: () => void
}) {
  const sin = listaNombresCortos(inputs.alimentos_excluidos ?? [])
  const favoritos = listaNombresCortos(inputs.alimentos_favoritos ?? [])
  if (sin === '' && favoritos === '') return null
  return (
    <p className="resumen-alimentos-menu">
      {sin !== '' ? <span>Sin: {sin}</span> : null}
      {sin !== '' && favoritos !== '' ? <span aria-hidden="true"> · </span> : null}
      {favoritos !== '' ? <span>Favoritos: {favoritos}</span> : null}
      {onCambiar ? (
        <button type="button" className="btn-plano" onClick={onCambiar}>
          Cambiar
        </button>
      ) : null}
    </p>
  )
}

/** Bloque plegable de equivalencias (§2.5). Los gramajes salen del módulo de menús. */
export function BloqueEquivalencias({ inputs, ejemplos }: PropsMenu) {
  const sinMenu =
    inputs.condiciones.includes('renal') ||
    inputs.condiciones.includes('hepatica') ||
    ejemplos.entreno.comidas.length === 0
  const tablas = ejemplos.equivalencias
  if (sinMenu || !tablas || tablas.tablas.length === 0) return null

  return (
    <Seccion titulo="Equivalencias" descripcion={tablas.cabecera}>
      {tablas.tablas.map((tabla) => (
        <Plegable key={tabla.titulo} titulo={tabla.titulo}>
          <p className="nota">{tabla.descripcion}</p>
          <ul className="lista-equivalencias">
            {tabla.filas.map((fila) => (
              <li key={fila.id}>
                <span className="cifra menu-gramos">{entero(fila.gramos)} g</span>
                <span className="menu-alimento">{fila.nombre}</span>
                <span className="menu-medida">{fila.medida}</span>
              </li>
            ))}
          </ul>
        </Plegable>
      ))}
      <p className="nota">{tablas.nota_verdura_fruta}</p>
    </Seccion>
  )
}

export function BloqueConsejos({ consejos }: { consejos: string[] }) {
  if (consejos.length === 0) return null
  return (
    <Seccion titulo="Qué haría un nutricionista" icono={<IconoBombilla />}>
      <ul className="lista-consejos">
        {consejos.map((consejo) => (
          <li key={consejo}>{consejo}</li>
        ))}
      </ul>
    </Seccion>
  )
}
