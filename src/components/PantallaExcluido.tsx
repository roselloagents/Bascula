// Pantallas de derivación: el motor no ha devuelto plan y no se muestra ningún
// otro dato del resultado (CONTRATO.md, "Errores y exclusiones").

import { useEffect, useRef } from 'react'
import type { AvisoTexto, CodigoExclusion } from '../engine/types'
import { AYUDA_TCA } from './utiles/copy'

const TITULOS: Record<CodigoExclusion, string> = {
  EXCL_EDAD: 'No podemos calcular tu plan todavía',
  EXCL_EMBARAZO_LACTANCIA: 'Este momento merece un cuidado especial',
  EXCL_IMC_MUY_BAJO: 'Esto necesita una valoración médica, no una calculadora',
  EXCL_TCA_RIESGO: 'Ahora mismo esta no es la herramienta adecuada para ti',
  ERR_INPUT_RANGO: 'Revisa estos datos',
}

const NOMBRES_CAMPO: Record<string, string> = {
  edad: 'Edad',
  altura_cm: 'Altura',
  peso_kg: 'Peso',
  peso_objetivo: 'Peso objetivo',
  n_comidas: 'Número de comidas',
  'grasa.valor': 'Porcentaje de grasa',
  'grasa.cuello_cm': 'Medida del cuello',
  'grasa.cintura_cm': 'Medida de la cintura',
  'grasa.cadera_cm': 'Medida de la cadera',
  'entrenamiento.dias_semana': 'Días de entrenamiento a la semana',
  'entrenamiento.minutos_sesion': 'Duración de cada sesión',
  fecha_inicio: 'Fecha de inicio',
}

/** Un código como `peso_kg+altura_cm` señala la combinación de dos campos. */
function nombreCampo(campo: string): string {
  return campo
    .split('+')
    .map((parte) => NOMBRES_CAMPO[parte] ?? parte)
    .join(' y ')
}

interface Props {
  codigo: CodigoExclusion
  aviso: AvisoTexto
  errores?: string[]
  onVolver: () => void
  onCorregir: () => void
}

export function PantallaExcluido({ codigo, aviso, errores, onVolver, onCorregir }: Props) {
  const esRango = codigo === 'ERR_INPUT_RANGO'
  const contenedor = useRef<HTMLElement>(null)
  useEffect(() => {
    window.scrollTo(0, 0)
    contenedor.current?.focus({ preventScroll: true })
  }, [])
  return (
    <section className="excluido" ref={contenedor} tabIndex={-1}>
      <h2>{TITULOS[codigo]}</h2>
      <p className="excluido-texto">{aviso.texto}</p>

      {esRango && errores && errores.length > 0 ? (
        <ul className="excluido-campos">
          {errores.map((campo) => (
            <li key={campo}>{nombreCampo(campo)}</li>
          ))}
        </ul>
      ) : null}

      {/* Botón único en las derivaciones (§1, pasos 2 y 3): invitar a "revisar lo contestado"
          empuja a cambiar justo la respuesta que activó el corte. Los dos botones se quedan solo
          en ERR_INPUT_RANGO, donde corregir es exactamente lo que se pide. */}
      <div className="acciones">
        {esRango ? (
          <>
            <button type="button" className="btn btn-principal" onClick={onCorregir}>
              Corregir mis respuestas
            </button>
            <button type="button" className="btn btn-secundario" onClick={onVolver}>
              Empezar de cero
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-principal" onClick={onVolver}>
            Volver al inicio
          </button>
        )}
      </div>

      <p className="nota">{AYUDA_TCA}</p>
    </section>
  )
}
