// Ejemplos de menú y consejos accionables (SPEC-ux §2.5 y §2.7).

import { useState } from 'react'
import type { Ejemplos, InputCalculo } from '../../engine/types'
import { IconoBombilla, IconoPesa } from '../ui/Iconos'
import { NOTA_MENU, NOTA_VERDURA_FRUTA } from '../utiles/copy'
import { entero } from '../utiles/formato'
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
}

export function BloqueMenus({ inputs, ejemplos }: PropsMenu) {
  const [dia, setDia] = useState<'entreno' | 'descanso'>('entreno')
  const entrena = inputs.entrenamiento.tipo !== 'ninguno' && inputs.entrenamiento.dias_semana > 0
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

  const jornada = entrena && dia === 'descanso' ? ejemplos.descanso : ejemplos.entreno

  return (
    <Seccion
      titulo="Un día de ejemplo"
      descripcion="Los gramajes ya están escalados a tus macros. Pesa en crudo salvo que ponga otra cosa."
    >
      {entrena ? (
        <div className="conmutador" role="group" aria-label="Tipo de día">
          <button
            type="button"
            className="conmutador-opcion"
            data-activo={dia === 'entreno'}
            aria-pressed={dia === 'entreno'}
            onClick={() => setDia('entreno')}
          >
            Día de entreno
          </button>
          <button
            type="button"
            className="conmutador-opcion"
            data-activo={dia === 'descanso'}
            aria-pressed={dia === 'descanso'}
            onClick={() => setDia('descanso')}
          >
            Día de descanso
          </button>
        </div>
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

      {jornada.notas.map((nota) => (
        <p className="nota" key={nota}>
          {nota}
        </p>
      ))}
      <p className="nota">{NOTA_MENU}</p>
      <p className="nota">{NOTA_VERDURA_FRUTA}</p>
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
