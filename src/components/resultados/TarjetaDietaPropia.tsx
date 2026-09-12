// Tarjeta de entrada de "Cuéntanos cómo comes" (SPEC-dieta-propia §5.2).
//
// Tres estados: sin nada guardado (botón de entrada), con algo guardado pero no activo
// ("Ver mi menú con lo mío" y "Borrar lo que conté") y "no disponible" (sin clave en el servidor
// o sin conexión). Las capacidades se piden **al pulsar el botón**, nunca al montar la pantalla.

import { useRef, useState } from 'react'
import type { DietaInterpretada } from '../../engine/types'
import { ERROR_NO_DISPONIBLE } from '../../dieta/api'
import type { DietaGuardada } from '../../dieta/almacen'
import { hayDictado, type VentanaDictado } from '../../dieta/dictado'
import { Confirmacion } from '../ui/Confirmacion'
import { IconoMicro } from '../ui/Iconos'
import { FormularioDieta } from './FormularioDieta'
import { ID_TARJETA_DIETA, useAperturaDieta, type EstadoApertura } from './dieta'

// ---- Copy literal (§5.2) -------------------------------------------------

/** [SPEC] §5.2, título de la tarjeta y del enlace de la cabecera. */
export const TITULO_DIETA = '¿Ya tienes tus comidas o tus costumbres?'
/** [SPEC] §5.2, descripción. */
const DESCRIPCION =
  'Cuéntanos cómo comes: lo que desayunas siempre, lo que no puede faltar, lo que no quieres ver, cómo prefieres cenar… Montamos tu menú alrededor de lo tuyo y ajustamos los gramos a tu plan.'
/** [SPEC] §5.2, con algo guardado pero no activo. */
const GUARDADA = 'Tienes guardado lo que nos contaste de tus comidas.'
/** [SPEC] §5.2, confirmación de "Borrar lo que conté". */
const CONFIRMA_TITULO = '¿Borrar lo que nos contaste de tus comidas?'
const CONFIRMA_TEXTO = 'Tendrás que dictarlo otra vez.'
interface Props {
  /** Lo guardado en este móvil; `null` si no hay nada (§5.5). */
  dieta: DietaGuardada | null
  /** `resultado.comidas[].nombre` (§2.3). */
  comidasPlan: string[]
  onValidada: (texto: string, interpretada: DietaInterpretada) => void
  /** "Ver mi menú con lo mío": activa lo guardado sin ninguna petición. */
  onActivar: () => void
  onBorrar: () => void
  /** Avisa a la pantalla de que el formulario está desplegado: la barra fija se oculta (§5.3). */
  onFormulario?: (abierto: boolean) => void
  /** Solo para los tests: en producción se usa `window`. */
  ventana?: VentanaDictado
  /** Solo para los tests: estado de apertura de partida. */
  aperturaInicial?: EstadoApertura
}

export function TarjetaDietaPropia({
  dieta,
  comidasPlan,
  onValidada,
  onActivar,
  onBorrar,
  onFormulario,
  ventana,
  aperturaInicial = 'cerrado',
}: Props) {
  const apertura = useAperturaDieta(aperturaInicial)
  const [confirmando, setConfirmando] = useState(false)
  const entrada = useRef<HTMLButtonElement>(null)
  const micro = hayDictado(ventana)

  const abrir = () => {
    onFormulario?.(true)
    apertura.abrir()
  }

  const cerrar = () => {
    onFormulario?.(false)
    apertura.cerrar()
    // El foco vuelve al botón que abrió el formulario (§5.3).
    window.setTimeout(() => entrada.current?.focus(), 0)
  }

  const validada = (texto: string, interpretada: DietaInterpretada) => {
    onFormulario?.(false)
    apertura.cerrar()
    onValidada(texto, interpretada)
  }

  const abierto = apertura.estado === 'abierto'
  const pidiendo = apertura.estado === 'pidiendo'

  return (
    <section className="seccion seccion-dieta" id={ID_TARJETA_DIETA} tabIndex={-1}>
      <header className="seccion-cabecera">
        <h2>{TITULO_DIETA}</h2>
        <p className="seccion-descripcion">{DESCRIPCION}</p>
      </header>

      {abierto ? (
        <FormularioDieta
          comidasPlan={comidasPlan}
          token={apertura.token}
          textoInicial={dieta?.texto !== undefined && dieta.texto !== '' ? dieta.texto : undefined}
          onValidada={validada}
          onCancelar={cerrar}
          onNoDisponible={() => {
            onFormulario?.(false)
            apertura.noDisponible()
          }}
          ventana={ventana}
        />
      ) : dieta !== null ? (
        <>
          <p>{GUARDADA}</p>
          <div className="dieta-guardada">
            <button type="button" className="btn btn-principal" onClick={onActivar}>
              Ver mi menú con lo mío
            </button>
            <button type="button" className="btn-plano" onClick={() => setConfirmando(true)}>
              Borrar lo que conté
            </button>
          </div>
          <Confirmacion
            abierto={confirmando}
            titulo={CONFIRMA_TITULO}
            texto={CONFIRMA_TEXTO}
            confirmar="Borrar"
            cancelar="Cancelar"
            onConfirmar={() => {
              setConfirmando(false)
              onBorrar()
            }}
            onCancelar={() => setConfirmando(false)}
          />
        </>
      ) : (
        <div className="dieta-guardada">
          <button
            type="button"
            className="btn btn-secundario"
            ref={entrada}
            aria-busy={pidiendo}
            disabled={pidiendo}
            onClick={abrir}
          >
            {micro ? <IconoMicro tam={20} /> : null}
            {micro ? 'Dictar o escribir cómo como' : 'Escribir cómo como'}
          </button>
        </div>
      )}

      {apertura.estado === 'no_disponible' ? (
        <p className="nota nota-recuadro" role="status">
          {ERROR_NO_DISPONIBLE}
        </p>
      ) : null}
    </section>
  )
}
