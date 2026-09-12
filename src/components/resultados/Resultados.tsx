// Pantalla de resultados completa (SPEC-ux §2 y SPEC-dieta-propia §5).
// Ningún número se calcula aquí: todo viene de `Resultado`, de `Ejemplos` y de `DiaCompuesto`.

import { useEffect, useRef, useState } from 'react'
import type {
  AjusteMacros,
  AlimentoPropio,
  AvisoTexto,
  DatosPdf,
  DiaCompuesto,
  DietaInterpretada,
  Ejemplos,
  InputCalculo,
  Pesaje,
  Resultado,
} from '../../engine/types'
import type { DietaGuardada } from '../../dieta/almacen'
import { IconoLapiz } from '../ui/Iconos'
import { AVISOS_PRIORITARIOS } from '../utiles/copy'
import { hoyIso } from '../utiles/formato'
import { BloqueAgua, BloqueComidas, BloqueMacros, Cabecera, TarjetaCiclo } from './BloquesPlan'
import { BloqueConsejos, BloqueEquivalencias, BloqueMenus } from './BloquesMenu'
import { BloqueCompra } from './BloqueCompra'
import { BloqueAvisos, BloqueDisclaimer, BloqueMetodologia, BloquePeso } from './BloquesCierre'
import { BloqueProyeccion, BloqueSeguimiento } from './Proyeccion'
import { PanelAjuste } from './PanelAjuste'
import { hayPanelAjuste } from './ajuste'
import { BotonPdf } from './ExportarPdf'
import { TarjetaDietaPropia } from './TarjetaDietaPropia'
import { BloqueDietaPropia, ESTADO_MENU_PROPUESTO } from './BloqueDietaPropia'
import { ofreceDietaPropia, textoListo } from './dieta'

/** Segundos que el anuncio de la dieta se queda en pantalla si nadie hace nada (§5.4). */
const SEGUNDOS_ESTADO = 8

interface ResultadosProps {
  inputs: InputCalculo
  /** Plan que se está viendo: el recomendado, o el ajustado si el usuario movió las palancas. */
  resultado: Resultado
  /** Plan recomendado por el motor, sin ajuste. Es de donde salen los límites del panel §2.2b. */
  base: Resultado
  ejemplos: Ejemplos
  avisos: AvisoTexto[]
  ajuste: AjusteMacros | null
  pesajes: Pesaje[]
  onAjustar: (ajuste: AjusteMacros | null) => void
  onPesajes: (pesajes: Pesaje[]) => void
  onEditar: () => void
  onOtroEjemplo: () => void
  /** "No me gusta" de cada alimento del menú (§2.5, v1.2). */
  onExcluirAlimento?: (id: string) => void
  onDeshacerExclusion?: (id: string) => void
  /** Enlace "Cambiar" del resumen de alimentos: lleva al paso 14 del cuestionario. */
  onCambiarAlimentos?: () => void
  // ---- v1.3, "Cuéntanos cómo comes" (SPEC-dieta-propia §5) ----
  /** Lo guardado en este móvil, activo o no; `null` si no hay nada. */
  dieta?: DietaGuardada | null
  /** El día compuesto, solo cuando la composición está activa. */
  compuesto?: DiaCompuesto | null
  onDieta?: (texto: string, interpretada: DietaInterpretada) => void
  onActivarDieta?: () => void
  onVerPropuesto?: () => void
  onBorrarDieta?: () => void
  onCorregirDieta?: (comida: number, alimento: number, cambios: Partial<AlimentoPropio>) => void
}

export function Resultados({
  inputs,
  resultado,
  base,
  ejemplos,
  avisos,
  ajuste,
  pesajes,
  onAjustar,
  onPesajes,
  onEditar,
  onOtroEjemplo,
  onExcluirAlimento,
  onDeshacerExclusion,
  onCambiarAlimentos,
  dieta = null,
  compuesto = null,
  onDieta,
  onActivarDieta,
  onVerPropuesto,
  onBorrarDieta,
  onCorregirDieta,
}: ResultadosProps) {
  // SPEC-ux §2.8: con avisos de condición médica, IMC 35/40 o 65 años o más,
  // el bloque de avisos sube por encima de los menús.
  const prioridad =
    avisos.some((aviso) => AVISOS_PRIORITARIOS.includes(aviso.codigo)) || inputs.edad >= 65

  // §5.3: mientras el formulario está desplegado, la barra fija de acciones se oculta.
  const [formularioAbierto, setFormularioAbierto] = useState(false)
  // Contador que lleva el foco y el scroll al bloque compuesto al validar (§5.3).
  const [focoDieta, setFocoDieta] = useState(0)
  // El mismo mecanismo al revés: al volver al menú propuesto, el foco va a su h2 (§5.4).
  const [focoMenu, setFocoMenu] = useState(0)
  const [estadoDieta, setEstadoDieta] = useState('')
  // El anuncio describe un estado; cuando ese estado cambia, el anuncio deja de ser verdad. Se
  // vacía en cada acción y, si nadie hace nada, solo a sí mismo a los 8 s (§5.4).
  useEffect(() => {
    if (estadoDieta === '') return
    const temporizador = window.setTimeout(() => setEstadoDieta(''), SEGUNDOS_ESTADO * 1000)
    return () => window.clearTimeout(temporizador)
  }, [estadoDieta])

  const ofrece = onDieta !== undefined && ofreceDietaPropia(inputs, ejemplos)
  const activa = ofrece && compuesto !== null && dieta !== null

  const datosPdf = (): DatosPdf => ({
    inputs,
    resultado,
    ejemplos,
    avisos,
    fecha: hoyIso(),
    // §4.5b: los pesajes viajan al PDF desde este dispositivo; si no hay, el PDF no los imprime.
    pesajes: pesajes.length > 0 ? pesajes : undefined,
    // §6.2: con composición activa el PDF imprime el día compuesto en lugar del menú propuesto.
    dieta_propia: activa && compuesto ? compuesto : undefined,
  })

  // El plan aparece 700 ms después de pulsar "Ver mi plan": si nadie mueve el foco, se queda en
  // el `body` y quien usa lector de pantalla no se entera de que ya está.
  const contenedor = useRef<HTMLDivElement>(null)
  useEffect(() => {
    window.scrollTo(0, 0)
    contenedor.current?.focus({ preventScroll: true })
  }, [])

  const acciones = (variante: 'principal' | 'secundario') => (
    <div className={`acciones${variante === 'secundario' ? ' acciones-fijas' : ''}`}>
      <BotonPdf datos={datosPdf} variante={variante === 'secundario' ? 'principal' : variante} />
      <button type="button" className="btn btn-secundario" onClick={onEditar}>
        <IconoLapiz />
        Editar tus datos
      </button>
    </div>
  )

  const bloqueAvisos = <BloqueAvisos avisos={avisos} />

  const validada = (texto: string, interpretada: DietaInterpretada) => {
    setEstadoDieta(textoListo(interpretada))
    setFocoDieta((n) => n + 1)
    onDieta?.(texto, interpretada)
  }

  const comidasPlan = resultado.comidas.map((comida) => comida.nombre)

  return (
    <div className="resultados" ref={contenedor} tabIndex={-1}>
      {acciones('principal')}

      <Cabecera
        inputs={inputs}
        resultado={resultado}
        avisos={avisos}
        enlaceDieta={ofrece && !activa}
      />
      <BloqueMacros inputs={inputs} resultado={resultado} avisos={avisos} />

      {/* §2.2b: el panel lee sus límites del plan RECOMENDADO, no del que se está viendo. */}
      {hayPanelAjuste(base) ? (
        <PanelAjuste base={base} inputs={inputs} ajuste={ajuste} onAplicar={onAjustar} />
      ) : null}
      <TarjetaCiclo
        avisos={avisos}
        resultado={resultado}
        ejemplos={ejemplos}
        excluidos={inputs.alimentos_excluidos ?? []}
      />

      <BloqueAgua inputs={inputs} resultado={resultado} avisos={avisos} />
      <BloqueComidas
        inputs={inputs}
        resultado={resultado}
        avisos={avisos}
        notaDieta={activa && compuesto !== null && compuesto.modo !== 'solo_contexto'}
      />

      {prioridad ? bloqueAvisos : null}

      {/* §5.1: sin composición activa, la tarjeta va justo encima de "Un día de ejemplo". */}
      {ofrece && !activa ? (
        <TarjetaDietaPropia
          dieta={dieta}
          comidasPlan={comidasPlan}
          onValidada={validada}
          onActivar={() => {
            setEstadoDieta('')
            onActivarDieta?.()
          }}
          onBorrar={() => {
            setEstadoDieta('')
            onBorrarDieta?.()
          }}
          onFormulario={(abierto) => {
            if (abierto) setEstadoDieta('')
            setFormularioAbierto(abierto)
          }}
        />
      ) : null}

      {/* La región vive SIEMPRE, también vacía: si se monta y se desmonta, el lector de pantalla
          no llega a anunciar el mensaje nuevo (§5.4). */}
      <p className={estadoDieta === '' ? 'visualmente-oculto' : 'nota nota-recuadro'} role="status">
        {estadoDieta}
      </p>

      {activa && compuesto && dieta ? (
        <BloqueDietaPropia
          compuesto={compuesto}
          dieta={dieta}
          inputs={inputs}
          ejemplos={ejemplos}
          comidasPlan={comidasPlan}
          foco={focoDieta}
          onCorregir={(comida, alimento, cambios) => {
            setEstadoDieta('')
            onCorregirDieta?.(comida, alimento, cambios)
          }}
          onValidada={validada}
          onOtroEjemplo={onOtroEjemplo}
          onVerPropuesto={() => {
            setEstadoDieta(ESTADO_MENU_PROPUESTO)
            setFocoMenu((n) => n + 1)
            onVerPropuesto?.()
          }}
          onExcluirAlimento={onExcluirAlimento}
          onDeshacerExclusion={onDeshacerExclusion}
          onCambiarAlimentos={onCambiarAlimentos}
          onFormulario={(abierto) => {
            if (abierto) setEstadoDieta('')
            setFormularioAbierto(abierto)
          }}
        />
      ) : (
        <BloqueMenus
          inputs={inputs}
          ejemplos={ejemplos}
          onOtroEjemplo={onOtroEjemplo}
          onExcluirAlimento={onExcluirAlimento}
          onDeshacerExclusion={onDeshacerExclusion}
          onCambiarAlimentos={onCambiarAlimentos}
          foco={focoMenu}
        />
      )}
      <BloqueEquivalencias inputs={inputs} ejemplos={ejemplos} />
      <BloqueCompra ejemplos={ejemplos} />

      <BloquePeso inputs={inputs} resultado={resultado} avisos={avisos} />
      <BloqueProyeccion inputs={inputs} resultado={resultado} avisos={avisos} pesajes={pesajes} />
      <BloqueSeguimiento
        inputs={inputs}
        resultado={resultado}
        avisos={avisos}
        pesajes={pesajes}
        onCambiar={onPesajes}
      />

      <BloqueConsejos consejos={ejemplos.consejos} />

      {!prioridad ? bloqueAvisos : null}

      <BloqueMetodologia inputs={inputs} resultado={resultado} avisos={avisos} />
      <BloqueDisclaimer />

      {/* Barra fija: en móvil el informe ocupa varias pantallas y §2.0 pide tener siempre a la
          vista "Descargar PDF" y "Editar tus datos". Con el formulario de §5.3 desplegado se
          oculta: tapaba el cuadro de texto y el botón de dictar en un móvil de 375 px. */}
      {formularioAbierto ? null : acciones('secundario')}
    </div>
  )
}
