// Pantalla de resultados completa (SPEC-ux §2).
// Ningún número se calcula aquí: todo viene de `Resultado` y de `Ejemplos`.

import { useEffect, useRef } from 'react'
import type {
  AjusteMacros,
  AvisoTexto,
  DatosPdf,
  Ejemplos,
  InputCalculo,
  Pesaje,
  Resultado,
} from '../../engine/types'
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
}: ResultadosProps) {
  // SPEC-ux §2.8: con avisos de condición médica, IMC 35/40 o 65 años o más,
  // el bloque de avisos sube por encima de los menús.
  const prioridad =
    avisos.some((aviso) => AVISOS_PRIORITARIOS.includes(aviso.codigo)) || inputs.edad >= 65

  const datosPdf = (): DatosPdf => ({
    inputs,
    resultado,
    ejemplos,
    avisos,
    fecha: hoyIso(),
    // §4.5b: los pesajes viajan al PDF desde este dispositivo; si no hay, el PDF no los imprime.
    pesajes: pesajes.length > 0 ? pesajes : undefined,
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

  return (
    <div className="resultados" ref={contenedor} tabIndex={-1}>
      {acciones('principal')}

      <Cabecera inputs={inputs} resultado={resultado} avisos={avisos} />
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
      <BloqueComidas inputs={inputs} resultado={resultado} avisos={avisos} />

      {prioridad ? bloqueAvisos : null}

      <BloqueMenus
        inputs={inputs}
        ejemplos={ejemplos}
        onOtroEjemplo={onOtroEjemplo}
        onExcluirAlimento={onExcluirAlimento}
        onDeshacerExclusion={onDeshacerExclusion}
        onCambiarAlimentos={onCambiarAlimentos}
      />
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
          vista "Descargar PDF" y "Editar tus datos". */}
      {acciones('secundario')}
    </div>
  )
}
