// Cabecera, macros, hidratación y reparto por comidas (SPEC-ux §2.1 a §2.4).

import type { AvisoTexto, Ejemplos, InputCalculo, Resultado } from '../../engine/types'
import { DonutMacros } from '../graficos/DonutMacros'
import { IconoGota, IconoPesa } from '../ui/Iconos'
import {
  FIABILIDAD_GRASA,
  FRASES_MACRO,
  IMC_CATEGORIA,
  NOTA_AGUA,
  notaCierreKcal,
  NOTA_COMIDAS,
  NOTA_GRASA,
  NOTA_HORAS,
  NOTA_TDEE,
  OBJETIVO_TITULO,
  RITMO_ETIQUETA,
} from '../utiles/copy'
import { entero, num, numCorto, pctDeFraccion } from '../utiles/formato'
import { AvisoSiExiste, Seccion } from './comun'
import { buscarAviso } from '../utiles/avisos'

const CODIGOS_RECONVERSION = [
  'INFO_OBJETIVO_RESUELTO',
  'WARN_OBJETIVO_INCOHERENTE',
  'WARN_IMC_BAJO_NO_DEFICIT',
  'WARN_YA_MAGRO',
  'WARN_YA_EN_OBJETIVO',
  'WARN_RECOMPOSICION_SUGERIDA',
  'WARN_GANAR_SIN_FUERZA',
  'WARN_SIN_MARGEN_DEFICIT',
]

interface PropsBloque {
  inputs: InputCalculo
  resultado: Resultado
  avisos: AvisoTexto[]
}

/** Sufijo de ritmo de la cabecera (SPEC-ux §2.1, regla normativa). */
function sufijoObjetivo(resultado: Resultado): string {
  if (resultado.objetivo_efectivo === 'perder' || resultado.objetivo_efectivo === 'ganar') {
    return ` · ritmo ${RITMO_ETIQUETA[resultado.ritmo_efectivo]}`
  }
  if (resultado.objetivo_efectivo === 'recomposicion') return ' · cambios lentos, es lo esperable'
  return ''
}

export function Cabecera({ inputs, resultado, avisos }: PropsBloque) {
  const reconvertido = inputs.objetivo !== resultado.objetivo_efectivo
  const avisoReconversion = avisos.find((a) => CODIGOS_RECONVERSION.includes(a.codigo))
  const [grasaMin, grasaMax] = resultado.grasa.rango

  return (
    <header className="cabecera-plan">
      <p className="cabecera-etiqueta">Tu objetivo diario</p>
      <p className="cifra cabecera-cifra">{entero(resultado.kcal)}</p>
      <p className="cabecera-unidad">
        kcal al día
        {/* Plan ajustado a mano (§2.2b): el distintivo acompaña siempre a la cifra grande. */}
        {resultado.ajuste ? <span className="etiqueta-ajustado">ajustado por ti</span> : null}
      </p>
      <p className="cabecera-objetivo">
        {OBJETIVO_TITULO[resultado.objetivo_efectivo]}
        {sufijoObjetivo(resultado)}
      </p>

      {reconvertido && avisoReconversion ? (
        <p className="cabecera-ajuste">
          <span className="etiqueta-ajuste">Ajustado automáticamente</span>
          {avisoReconversion.texto}
        </p>
      ) : null}

      <dl className="datos-secundarios">
        <div>
          <dt>Índice de masa corporal</dt>
          <dd className="cifra">
            {numCorto(resultado.imc, 1)}{' '}
            <span className="dato-nota">{IMC_CATEGORIA[resultado.imc_categoria]}</span>
          </dd>
        </div>
        <div>
          <dt>Grasa corporal estimada</dt>
          <dd className="cifra">
            {num(Math.round(grasaMin))}-{num(Math.round(grasaMax))} %{' '}
            <span className="dato-nota">
              {FIABILIDAD_GRASA[resultado.grasa.metodo_efectivo] ?? 'estimación orientativa'}
            </span>
          </dd>
        </div>
        <div>
          <dt>Gasto energético diario</dt>
          <dd className="cifra">
            {entero(resultado.tdee.valor)} kcal{' '}
            <span className="dato-nota">es lo que estimamos que quemas</span>
          </dd>
        </div>
      </dl>

      <p className="nota">{NOTA_TDEE}</p>
      <p className="nota">{NOTA_GRASA}</p>
    </header>
  )
}

export function BloqueMacros({ resultado, avisos }: PropsBloque) {
  const m = resultado.macros
  const tarjetas = [
    {
      clave: 'proteina',
      nombre: 'Proteína',
      gramos: m.proteina_g,
      gkg: m.gkg.p,
      pct: m.pct.p,
      frase: FRASES_MACRO.proteina,
    },
    {
      clave: 'grasa',
      nombre: 'Grasa',
      gramos: m.grasa_g,
      gkg: m.gkg.g,
      pct: m.pct.g,
      frase: FRASES_MACRO.grasa,
    },
    {
      clave: 'carbo',
      nombre: 'Carbohidratos',
      gramos: m.hc_g,
      gkg: m.gkg.hc,
      pct: m.pct.hc,
      frase: FRASES_MACRO.hc,
    },
  ]

  return (
    <Seccion titulo="Tus macros del día">
      <div className="macros-cabecera">
        <DonutMacros pct={m.pct} kcal={resultado.kcal} />
        <ul className="leyenda-macros">
          {tarjetas.map((t) => (
            <li key={t.clave} data-macro={t.clave}>
              <span className="leyenda-punto" aria-hidden="true" />
              <span className="leyenda-nombre">{t.nombre}</span>
              <span className="cifra leyenda-valor">{entero(t.gramos)} g</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="macros-detalle">
        {tarjetas.map((t) => (
          <article key={t.clave} className="macro" data-macro={t.clave}>
            <h3>{t.nombre}</h3>
            <p className="cifra macro-cifra">
              {entero(t.gramos)} <span>g al día</span>
            </p>
            <p className="macro-datos cifra">
              {numCorto(t.gkg, 2)} g por kilo de peso · {pctDeFraccion(t.pct)} de tus calorías
            </p>
            <p className="macro-frase">{t.frase}</p>
            {t.clave === 'proteina' ? <AvisoSiExiste avisos={avisos} codigo="INFO_PROTEINA_CAPADA" /> : null}
          </article>
        ))}
        <article className="macro" data-macro="fibra">
          <h3>Fibra</h3>
          <p className="cifra macro-cifra">
            {entero(m.fibra_g)} <span>g al día</span>
          </p>
          <p className="macro-frase">{FRASES_MACRO.fibra}</p>
        </article>
      </div>

      <p className="nota">{notaCierreKcal(resultado.ajuste !== undefined)}</p>
      <p className="nota">
        Como referencia, limita los azúcares añadidos a menos de{' '}
        <span className="cifra">{entero(m.azucares_libres_max_g)} g</span> al día.
      </p>
    </Seccion>
  )
}

/**
 * Tarjeta "Tu ciclo y tu plan" (§2.2c). Se pinta exactamente cuando el motor emite `INFO_CICLO`,
 * con su texto íntegro: no cambia ningún número y el copy lo dice con todas las letras.
 */
/**
 * "Tu ciclo y tu plan" (§2.2c). El texto de `INFO_CICLO` va íntegro y, desde la v1.2, debajo van
 * los consejos por síntoma de `resultado.ciclo`: la pantalla no los reescribe ni los trocea, y
 * los fragmentos condicionales ya vienen resueltos por el motor. Nada de esto cambia un número.
 */
export function TarjetaCiclo({
  avisos,
  resultado,
  ejemplos,
}: {
  avisos: AvisoTexto[]
  resultado?: Resultado
  ejemplos?: Ejemplos
}) {
  const ciclo = buscarAviso(avisos, 'INFO_CICLO')
  if (!ciclo) return null
  const consejos = resultado?.ciclo?.consejos ?? []
  const hayCompraOpcional = (ejemplos?.alimentos_ciclo ?? []).length > 0
  return (
    <Seccion titulo="Tu ciclo y tu plan">
      <p>{ciclo.texto}</p>
      {consejos.map((consejo) => (
        <div className="consejo-ciclo" key={consejo.clave}>
          <h4 className="consejo-ciclo-titulo">{consejo.titulo}</h4>
          <p>{consejo.texto}</p>
          {consejo.alimentos.length > 0 ? (
            <p className="consejo-ciclo-alimentos">
              <span className="consejo-ciclo-etiqueta">Prioriza:</span>{' '}
              {consejo.alimentos.join(' · ')}
            </p>
          ) : null}
        </div>
      ))}
      {consejos.length > 0 && hayCompraOpcional ? (
        <p className="nota">
          En tu lista de la compra te hemos dejado una sección opcional para esos días.
        </p>
      ) : null}
    </Seccion>
  )
}

export function BloqueAgua({ inputs, resultado, avisos }: PropsBloque) {
  const agua = resultado.agua

  if (agua === null) {
    const aviso = buscarAviso(avisos, 'INFO_AGUA_NO_PRESCRITA')
    return (
      <Seccion titulo="Hidratación" icono={<IconoGota />}>
        <p>
          {aviso
            ? aviso.texto
            : 'Con tu condición no te damos un objetivo de líquidos: la cantidad que te conviene la marca tu equipo médico.'}
        </p>
      </Seccion>
    )
  }

  const [min, max] = agua.rango
  return (
    <Seccion titulo="Hidratación" icono={<IconoGota />}>
      <p className="cifra agua-franja">
        Entre {entero(min)} y {entero(max)} ml al día
      </p>
      <p className="agua-secundaria cifra">
        {entero(agua.ml)} ml de referencia ({numCorto(agua.ml / 1000, 1)} litros), ≈ {num(agua.vasos)}{' '}
        vasos de 250 ml
      </p>
      <p className="nota">{NOTA_AGUA}</p>
      {inputs.edad >= 65 ? <AvisoSiExiste avisos={avisos} codigo="INFO_AGUA_MAYORES" /> : null}
    </Seccion>
  )
}

export function BloqueComidas({ resultado, avisos }: PropsBloque) {
  const comidas = resultado.comidas
  // La fila de totales sale del motor (`macros` y `kcal_cierre`), no de sumar la tabla: el
  // CONTRATO prohíbe mostrar un número que no venga del motor.
  const total = {
    proteina: resultado.macros.proteina_g,
    grasa: resultado.macros.grasa_g,
    hc: resultado.macros.hc_g,
    kcal: resultado.kcal_cierre,
    pct: comidas.reduce((acc, c) => acc + c.pct_kcal, 0),
  }

  return (
    <Seccion titulo="Cómo repartir el día">
      <AvisoSiExiste avisos={avisos} codigo="WARN_PROTEINA_POR_TOMA" />
      <AvisoSiExiste avisos={avisos} codigo="WARN_PROTEINA_TOMA_ALTA" />

      <div className="tabla-envoltorio">
        <table className="tabla-comidas">
          <caption className="visualmente-oculto">
            Reparto de calorías y macros entre tus comidas del día.
          </caption>
          <thead>
            <tr>
              <th scope="col">Comida</th>
              <th scope="col">% kcal</th>
              <th scope="col">Proteína</th>
              <th scope="col">Grasa</th>
              <th scope="col">Hidratos</th>
              <th scope="col">Calorías</th>
            </tr>
          </thead>
          <tbody>
            {comidas.map((comida) => (
              <tr key={comida.nombre}>
                <th scope="row">
                  <span className="comida-nombre">{comida.nombre}</span>
                  <span className="comida-hora cifra">{comida.hora}</span>
                  {comida.peri ? (
                    <span className="etiqueta-peri">
                      <IconoPesa tam={14} /> cerca de tu entreno
                    </span>
                  ) : null}
                </th>
                <td data-etiqueta="% kcal" className="cifra">
                  {num(comida.pct_kcal)} %
                </td>
                <td data-etiqueta="Proteína" className="cifra">
                  {entero(comida.proteina_g)} g
                </td>
                <td data-etiqueta="Grasa" className="cifra">
                  {entero(comida.grasa_g)} g
                </td>
                <td data-etiqueta="Hidratos" className="cifra">
                  {entero(comida.hc_g)} g
                </td>
                <td data-etiqueta="Calorías" className="cifra">
                  {entero(comida.kcal)} kcal
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total del día</th>
              <td data-etiqueta="% kcal" className="cifra">
                {num(total.pct)} %
              </td>
              <td data-etiqueta="Proteína" className="cifra">
                {entero(total.proteina)} g
              </td>
              <td data-etiqueta="Grasa" className="cifra">
                {entero(total.grasa)} g
              </td>
              <td data-etiqueta="Hidratos" className="cifra">
                {entero(total.hc)} g
              </td>
              <td data-etiqueta="Calorías" className="cifra">
                {entero(total.kcal)} kcal
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="nota">
        Total de tus macros: {entero(resultado.kcal_cierre)} kcal.{' '}
        {notaCierreKcal(resultado.ajuste !== undefined)}
      </p>
      <p className="nota">Las horas {NOTA_HORAS}.</p>
      <p className="nota">{NOTA_COMIDAS}</p>
    </Seccion>
  )
}
