// "Ajusta tus macros" (SPEC-ux §2.2b, decisión B).
//
// La pantalla no calcula ni un gramo: mueve dos palancas dentro de los límites que publica el
// motor (`limites_ajuste`) y le pide a `ajustarMacros` el plan resultante. La proteína no se toca.

import { useId, useState } from 'react'
import { textosAvisos } from '../../engine'
import type { AjusteMacros, InputCalculo, LimitesAjuste, Resultado } from '../../engine/types'
import { entero } from '../utiles/formato'
import { aplicarAjuste, hayAjuste } from './ajuste'
import { AvisoSiExiste } from './comun'

interface PanelAjusteProps {
  /** Plan **recomendado** por el motor: los límites y los valores de partida salen de aquí. */
  base: Resultado & { limites_ajuste: LimitesAjuste }
  inputs: InputCalculo
  /** Ajuste ya aplicado (el que se está viendo en el resto de la pantalla). */
  ajuste: AjusteMacros | null
  onAplicar: (ajuste: AjusteMacros | null) => void
}

const NOTA_PROTEINA =
  'La proteína no se toca: es la que protege tu músculo cuando comes menos, y es lo último que un nutricionista recorta. Lo que cambia es la grasa, que absorbe lo que le quites o le des a los hidratos.'

const NOTA_RECALCULO =
  'Al mover cualquiera de los dos recalculamos todo lo que depende de ellos: el reparto por comidas, el menú de ejemplo, la lista de la compra, el calendario y el PDF.'

const NOTA_SUELO_GRASA =
  'Con estas calorías no puedes bajar más los hidratos sin quedarte por debajo de la grasa mínima. Baja también las calorías si quieres seguir bajándolos.'

function baja5(valor: number): number {
  return Math.floor(valor / 5) * 5
}

/** Techo del deslizador de hidratos con las calorías que haya en ese momento (§2.2b). */
function techoHidratos(limites: LimitesAjuste, proteina: number, kcal: number): number {
  const sueloGrasa = Math.max(limites.suelo_grasa_abs_g, (0.2 * kcal) / 9)
  const techo = baja5((kcal - 4 * proteina - 9 * sueloGrasa) / 4)
  return kcal === limites.kcal_recomendada ? Math.max(techo, limites.hc_recomendado_g) : techo
}

/** Solo viajan las palancas que de verdad se han movido; el resto queda en lo recomendado. */
function componer(limites: LimitesAjuste, kcal: number, hc: number): AjusteMacros | null {
  const ajuste: AjusteMacros = {}
  if (kcal !== limites.kcal_recomendada) ajuste.kcal = kcal
  if (hc !== limites.hc_recomendado_g) ajuste.hc_g = hc
  return hayAjuste(ajuste) ? ajuste : null
}

function mismoAjuste(a: AjusteMacros | null, b: AjusteMacros | null): boolean {
  return (a?.kcal ?? null) === (b?.kcal ?? null) && (a?.hc_g ?? null) === (b?.hc_g ?? null)
}

export function PanelAjuste({ base, inputs, ajuste, onAplicar }: PanelAjusteProps) {
  const limites = base.limites_ajuste
  const proteina = base.macros.proteina_g
  const idHc = useId()
  const idKcal = useId()

  const [kcal, setKcal] = useState(ajuste?.kcal ?? limites.kcal_recomendada)
  const [hc, setHc] = useState(ajuste?.hc_g ?? limites.hc_recomendado_g)

  // Si el ajuste aplicado cambia desde fuera ("Volver a lo recomendado", o un plan nuevo), los
  // controles vuelven a reflejarlo. Se sincroniza en el render, no en un efecto: así no hay un
  // fotograma con los controles diciendo una cosa y el resto de la pantalla otra, y el bloque
  // no se desmonta (un `key` nuevo lo cerraría en cuanto el usuario pulsa "Aplicar").
  const [visto, setVisto] = useState(ajuste)
  if (visto !== ajuste) {
    setVisto(ajuste)
    setKcal(ajuste?.kcal ?? limites.kcal_recomendada)
    setHc(ajuste?.hc_g ?? limites.hc_recomendado_g)
  }

  const techo = techoHidratos(limites, proteina, kcal)
  // El suelo de grasa manda sobre los 30 g: si no llega para tanto, el deslizador se queda ahí.
  const suelo = Math.min(limites.hc_min_ui_g, techo)
  const hcVisible = Math.min(Math.max(hc, suelo), Math.max(techo, suelo))
  const sinMargen = techo <= suelo

  const borrador = componer(limites, kcal, hcVisible)
  const previo = aplicarAjuste(base, borrador)
  const avisosPrevios = textosAvisos(previo, inputs)
  const pendiente = !mismoAjuste(borrador, ajuste)

  const moverKcal = (paso: number) => {
    const nuevo = Math.min(Math.max(kcal + paso, limites.kcal_min), limites.kcal_max)
    setKcal(nuevo)
    // La grasa es "el resto": al bajar las calorías el techo de hidratos baja con ellas y el
    // deslizador se recorta solo (§2.2b, comportamiento 1).
    const techoNuevo = techoHidratos(limites, proteina, nuevo)
    const sueloNuevo = Math.min(limites.hc_min_ui_g, techoNuevo)
    setHc((previoHc) => Math.min(Math.max(previoHc, sueloNuevo), Math.max(techoNuevo, sueloNuevo)))
  }

  return (
    <details className="panel-ajuste">
      <summary>
        <span className="panel-ajuste-titulo">
          Ajusta tus macros
          {hayAjuste(ajuste) ? <span className="etiqueta-ajustado">ajustado por ti</span> : null}
        </span>
        <span className="panel-ajuste-sub">
          ¿Comes menos hidratos de los que te proponemos? Cámbialos aquí.
        </span>
      </summary>

      <div className="panel-ajuste-cuerpo">
        <p className="nota nota-recuadro">{NOTA_PROTEINA}</p>

        <div className="ajuste-control">
          <div className="ajuste-control-cabecera">
            <label htmlFor={idHc}>Hidratos al día</label>
            <output className="cifra ajuste-valor" htmlFor={idHc}>
              {entero(hcVisible)} g
            </output>
          </div>
          <input
            id={idHc}
            type="range"
            min={suelo}
            max={Math.max(techo, suelo)}
            step={5}
            value={hcVisible}
            disabled={sinMargen}
            aria-valuetext={`${entero(hcVisible)} gramos de hidratos al día`}
            onChange={(evento) => setHc(Number(evento.target.value))}
          />
          <p className="campo-pista cifra">
            Entre {entero(suelo)} y {entero(Math.max(techo, suelo))} g con estas calorías.
          </p>
          {sinMargen ? <p className="nota">{NOTA_SUELO_GRASA}</p> : null}
        </div>

        <div className="ajuste-control">
          <div className="ajuste-control-cabecera">
            <span id={idKcal}>Calorías al día</span>
            <output className="cifra ajuste-valor">{entero(kcal)} kcal</output>
          </div>
          <div className="ajuste-pasos" role="group" aria-labelledby={idKcal}>
            <button
              type="button"
              className="btn btn-secundario ajuste-paso"
              aria-label={`Bajar ${limites.kcal_paso} calorías`}
              disabled={kcal <= limites.kcal_min}
              onClick={() => moverKcal(-limites.kcal_paso)}
            >
              −{limites.kcal_paso}
            </button>
            <button
              type="button"
              className="btn btn-secundario ajuste-paso"
              aria-label={`Subir ${limites.kcal_paso} calorías`}
              disabled={kcal >= limites.kcal_max}
              onClick={() => moverKcal(limites.kcal_paso)}
            >
              +{limites.kcal_paso}
            </button>
          </div>
          <p className="campo-pista cifra">
            Entre {entero(limites.kcal_min)} y {entero(limites.kcal_max)} kcal.
          </p>
        </div>

        <p className="ajuste-resumen cifra" aria-live="polite">
          {entero(previo.macros.proteina_g)} g de proteína · {entero(previo.macros.grasa_g)} g de
          grasa · {entero(previo.macros.hc_g)} g de hidratos
          <span className="ajuste-resumen-kcal">{entero(previo.kcal)} kcal</span>
        </p>

        <AvisoSiExiste avisos={avisosPrevios} codigo="WARN_HC_BAJO_MINIMO" />
        <AvisoSiExiste avisos={avisosPrevios} codigo="WARN_KCAL_AJUSTE_ALTA" />

        <p className="nota">{NOTA_RECALCULO}</p>

        <div className="ajuste-acciones">
          <button
            type="button"
            className="btn btn-principal"
            disabled={!pendiente}
            onClick={() => onAplicar(borrador)}
          >
            Aplicar
          </button>
          <button
            type="button"
            className="btn btn-secundario"
            disabled={!hayAjuste(ajuste) && borrador === null}
            onClick={() => onAplicar(null)}
          >
            Volver a lo recomendado
          </button>
        </div>
      </div>
    </details>
  )
}
