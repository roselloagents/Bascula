// Cuestionario por pasos: una pantalla por pregunta, barra de progreso con total
// dinámico, validación por paso y cortes de seguridad (edad, embarazo/lactancia).

import { useEffect, useRef, useState, type FormEvent, type ReactElement } from 'react'
import type { CodigoExclusion, InputCalculo } from '../../engine/types'
import { Confirmacion } from '../ui/Confirmacion'
import { Plegable } from '../ui/Controles'
import { IconoAtras, IconoFlecha } from '../ui/Iconos'
import { leerNumero } from '../utiles/formato'
import { aInputs, anclarPlan, estadoPaso, pasosVisibles, type Borrador, type PasoId } from './borrador'
import {
  PasoCondiciones,
  PasoEdad,
  PasoEmbarazo,
  PasoMedidas,
  PasoRegla,
  PasoSexo,
} from './pasos/PasosPerfil'
import { PasoGrasa, PasoSomatotipo } from './pasos/PasosCuerpo'
import {
  PasoActividad,
  PasoEntrenamiento,
  PasoObjetivo,
  PasoPesoObjetivo,
  PasoPreferencias,
  PasoRitmo,
} from './pasos/PasosVida'
import type { ParcheBorrador, PropsPaso } from './pasos/comun'

const COMPONENTES: Record<PasoId, (props: PropsPaso) => ReactElement> = {
  sexo: PasoSexo,
  edad: PasoEdad,
  embarazo: PasoEmbarazo,
  regla: PasoRegla,
  medidas: PasoMedidas,
  condiciones: PasoCondiciones,
  grasa: PasoGrasa,
  somatotipo: PasoSomatotipo,
  actividad: PasoActividad,
  entrenamiento: PasoEntrenamiento,
  objetivo: PasoObjetivo,
  ritmo: PasoRitmo,
  pesoObjetivo: PasoPesoObjetivo,
  preferencias: PasoPreferencias,
}

/** Nombre corto de cada pantalla para el índice de "Ir a una pregunta". */
const TITULO_PASO: Record<PasoId, string> = {
  sexo: 'Sexo',
  edad: 'Edad',
  embarazo: 'Embarazo o lactancia',
  regla: 'Tu regla',
  medidas: 'Altura y peso',
  condiciones: 'Condiciones médicas',
  grasa: 'Grasa corporal',
  somatotipo: 'Constitución',
  actividad: 'Actividad diaria',
  entrenamiento: 'Entrenamiento',
  objetivo: 'Objetivo',
  ritmo: 'Ritmo',
  pesoObjetivo: 'Peso objetivo',
  preferencias: 'Preferencias y comidas',
}

interface WizardProps {
  borrador: Borrador
  onCambio: (actualizar: (previo: Borrador) => Borrador) => void
  onTerminar: (inputs: InputCalculo) => void
  onExclusion: (codigo: CodigoExclusion) => void
  onReiniciar: () => void
  /** Avisa del paso visible para poder recuperarlo tras recargar la página. */
  onPaso?: (paso: PasoId) => void
  pasoInicial?: PasoId
  /** Campos que el motor ha devuelto en `ERR_INPUT_RANGO`: se marcan en rojo. */
  camposMarcados?: string[]
}

export function Wizard({
  borrador,
  onCambio,
  onTerminar,
  onExclusion,
  onReiniciar,
  onPaso,
  pasoInicial = 'sexo',
  camposMarcados = [],
}: WizardProps) {
  const [pasoActual, setPasoActual] = useState<PasoId>(pasoInicial)
  // "Empezar de cero" borra todas las respuestas: se pide confirmación antes (el botón está en
  // todas las pantallas y un toque accidental tiraba el cuestionario entero).
  const [confirmarReinicio, setConfirmarReinicio] = useState(false)
  const contenedor = useRef<HTMLDivElement>(null)

  const pasos = pasosVisibles(borrador)
  const indice = Math.max(0, pasos.indexOf(pasoActual))
  const paso = pasos[indice]
  const { completo, errores } = estadoPaso(borrador, paso)
  const esUltimo = indice === pasos.length - 1
  const Componente = COMPONENTES[paso]

  // Índice de navegación: aparece cuando el cuestionario entero está contestado, que es el caso
  // de quien vuelve desde los resultados a cambiar un dato. Retirado el cribado (v1.1), ya no hay
  // ningún paso que quede fuera de la cuenta.
  const todoContestado = pasos.every((p) => estadoPaso(borrador, p).completo)

  useEffect(() => {
    window.scrollTo(0, 0)
    contenedor.current?.focus({ preventScroll: true })
    onPaso?.(pasoActual)
  }, [pasoActual, onPaso])

  const set = (parche: ParcheBorrador) =>
    onCambio((previo) => ({
      ...previo,
      ...(typeof parche === 'function' ? parche(previo) : parche),
    }))

  const avanzar = (evento: FormEvent) => {
    evento.preventDefault()
    if (!completo || Object.keys(errores).length > 0) return

    if (paso === 'edad') {
      const edad = leerNumero(borrador.edad)
      if (edad === null || edad < 18 || edad > 75) {
        onExclusion('EXCL_EDAD')
        return
      }
    }
    if (paso === 'embarazo' && borrador.embarazo_lactancia === true) {
      onExclusion('EXCL_EMBARAZO_LACTANCIA')
      return
    }
    if (esUltimo) {
      // El plan se ancla en su día de arranque antes de calcularlo, y el borrador se queda con
      // esa fecha: así la proyección y los pesajes hablan siempre del mismo punto de partida.
      const anclado = anclarPlan(borrador)
      if (anclado !== borrador) set(anclado)
      onTerminar(aInputs(anclado))
      return
    }
    setPasoActual(pasos[indice + 1])
  }

  const retroceder = () => {
    if (indice > 0) setPasoActual(pasos[indice - 1])
  }

  return (
    <>
      <Confirmacion
        abierto={confirmarReinicio}
        titulo="¿Empezar de cero?"
        texto="Se borrarán todas tus respuestas y volverás a la primera pregunta. Esto no se puede deshacer."
        confirmar="Sí, empezar de cero"
        cancelar="No, seguir donde estaba"
        onCancelar={() => setConfirmarReinicio(false)}
        onConfirmar={() => {
          setConfirmarReinicio(false)
          onReiniciar()
        }}
      />
      <form className="wizard" onSubmit={avanzar} noValidate>
        <div className="progreso">
          <div className="progreso-regla" aria-hidden="true">
            {pasos.map((p, i) => (
              <span key={p} data-hecho={i <= indice} />
            ))}
          </div>
          <div className="progreso-pie">
            <p className="progreso-texto">
              Paso {indice + 1} de {pasos.length}
            </p>
            <button type="button" className="btn-plano" onClick={() => setConfirmarReinicio(true)}>
              Empezar de cero
            </button>
          </div>
        </div>

        {todoContestado ? (
          <div className="indice-pasos">
            <Plegable titulo="Ir a una pregunta">
              <ul className="indice-lista">
                {pasos.map((p, i) => (
                  <li key={p}>
                    <button
                      type="button"
                      className="indice-boton"
                      data-actual={p === paso}
                      onClick={() => setPasoActual(p)}
                    >
                      <span className="cifra indice-numero">{i + 1}</span>
                      {TITULO_PASO[p]}
                    </button>
                  </li>
                ))}
              </ul>
            </Plegable>
          </div>
        ) : null}

        <div className="paso" key={paso} ref={contenedor} tabIndex={-1}>
          <Componente b={borrador} set={set} errores={errores} marcados={camposMarcados} />
        </div>

        <div className="barra-navegacion" data-solo={indice === 0}>
          {indice > 0 ? (
            <button type="button" className="btn btn-secundario" onClick={retroceder}>
              <IconoAtras />
              Atrás
            </button>
          ) : null}
          <button
            type="submit"
            className="btn btn-principal"
            disabled={!completo || Object.keys(errores).length > 0}
          >
            {esUltimo ? 'Ver mi plan' : 'Siguiente'}
            <IconoFlecha />
          </button>
        </div>
      </form>
    </>
  )
}
