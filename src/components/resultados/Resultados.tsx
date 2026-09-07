// Pantalla de resultados completa (SPEC-ux §2).
// Ningún número se calcula aquí: todo viene de `Resultado` y de `Ejemplos`.

import type { AvisoTexto, DatosPdf, Ejemplos, InputCalculo, Resultado } from '../../engine/types'
import { IconoLapiz } from '../ui/Iconos'
import { AVISOS_PRIORITARIOS } from '../utiles/copy'
import { hoyIso } from '../utiles/formato'
import { BloqueAgua, BloqueComidas, BloqueMacros, Cabecera } from './BloquesPlan'
import { BloqueConsejos, BloqueMenus } from './BloquesMenu'
import { BloqueAvisos, BloqueDisclaimer, BloqueMetodologia, BloquePeso } from './BloquesCierre'
import { BotonPdf } from './ExportarPdf'

interface ResultadosProps {
  inputs: InputCalculo
  resultado: Resultado
  ejemplos: Ejemplos
  avisos: AvisoTexto[]
  onEditar: () => void
}

export function Resultados({ inputs, resultado, ejemplos, avisos, onEditar }: ResultadosProps) {
  // Cribado del paso 5b: oculta %grasa, peso objetivo, cronograma y referencias.
  const protegido =
    inputs.cribado_tca === 'positivo' ||
    inputs.cribado_tca === 'evitado' ||
    inputs.condiciones.includes('tca')

  // SPEC-ux §2.8: con avisos de condición médica, IMC 35/40 o 65 años o más,
  // el bloque de avisos sube por encima de los menús.
  const prioridad =
    avisos.some((aviso) => AVISOS_PRIORITARIOS.includes(aviso.codigo)) || inputs.edad >= 65

  const datosPdf = (): DatosPdf => ({ inputs, resultado, ejemplos, avisos, fecha: hoyIso() })

  const acciones = (variante: 'principal' | 'secundario') => (
    <div className="acciones">
      <BotonPdf datos={datosPdf} variante={variante} />
      <button type="button" className="btn btn-secundario" onClick={onEditar}>
        <IconoLapiz />
        Editar respuestas
      </button>
    </div>
  )

  const bloqueAvisos = <BloqueAvisos avisos={avisos} />

  return (
    <div className="resultados">
      {acciones('principal')}

      <Cabecera inputs={inputs} resultado={resultado} avisos={avisos} protegido={protegido} />
      <BloqueMacros inputs={inputs} resultado={resultado} avisos={avisos} protegido={protegido} />
      <BloqueAgua inputs={inputs} resultado={resultado} avisos={avisos} protegido={protegido} />
      <BloqueComidas inputs={inputs} resultado={resultado} avisos={avisos} protegido={protegido} />

      {prioridad ? bloqueAvisos : null}

      <BloqueMenus inputs={inputs} ejemplos={ejemplos} />

      {!protegido ? (
        <BloquePeso inputs={inputs} resultado={resultado} avisos={avisos} />
      ) : null}

      <BloqueConsejos consejos={ejemplos.consejos} />

      {!prioridad ? bloqueAvisos : null}

      <BloqueMetodologia inputs={inputs} resultado={resultado} avisos={avisos} />
      <BloqueDisclaimer />

      {acciones('principal')}
    </div>
  )
}
