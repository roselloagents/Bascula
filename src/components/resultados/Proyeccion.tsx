// Proyección semana a semana (§2.6b) y seguimiento local de pesajes (§2.6c), v1.1 decisión F.
//
// La curva y la banda salen enteras de `resultado.proyeccion`: aquí no se estima ningún peso.
// Los pesajes viven solo en este navegador (`bascula:pesajes:v1`) y se dibujan encima.

import { useId, useState } from 'react'
import type {
  AvisoTexto,
  InputCalculo,
  Pesaje,
  PuntoProyeccion,
  Resultado,
} from '../../engine/types'
import { Confirmacion } from '../ui/Confirmacion'
import { IconoPapelera } from '../ui/Iconos'
import { buscarAviso } from '../utiles/avisos'
import { hoyIso, leerNumero, num, numCorto } from '../utiles/formato'
import { Seccion } from './comun'
import {
  PESO_MAX_KG,
  PESO_MIN_KG,
  anadirPesaje,
  calcularBalance,
  diasEntre,
  fechaCorta,
  mensajeFechaPesaje,
  mensajePesoPesaje,
  ordenar,
  semanaDePesaje,
} from './seguimiento'

/** [SPEC] SPEC-calculo §4, nota proyección (íntegra). */
const NOTA_PROYECCION =
  'Esta curva es una estimación, no una promesa: sale de tu déficit actual y de un factor de adaptación que crece con el tiempo. Tu peso real va a oscilar por agua, sal e intestino; lo que importa es la tendencia de varias semanas, no el dato de un día.'

const AVISO_DISPOSITIVO =
  'Apunta tu peso cuando te peses y lo dibujamos sobre la curva. Se guarda solo en este navegador: no hay cuenta, no hay nube y nadie más lo ve. Si borras los datos del navegador o cambias de móvil, se pierde.'

// ---- Gráfica ------------------------------------------------------------

const ANCHO = 340
const ALTO = 200
const M = { arriba: 16, derecha: 10, abajo: 24, izquierda: 34 }

interface PuntoPesaje {
  semana: number
  kg: number
  fecha: string
}

interface GraficaProps {
  proyeccion: PuntoProyeccion[]
  pesajes: PuntoPesaje[]
  objetivo: number | null
}

function GraficaProyeccion({ proyeccion, pesajes, objetivo }: GraficaProps) {
  const ultima = proyeccion[proyeccion.length - 1].semana || 1
  const minima = Math.min(...proyeccion.map((p) => p.peso_min))
  const maxima = Math.max(...proyeccion.map((p) => p.peso_max))
  // El eje sale de la proyección (§2.6b) y se estira lo justo para que un pesaje real nunca
  // quede fuera del dibujo: un punto invisible sería peor que un eje un kilo más ancho.
  const kgMin = Math.floor(Math.min(minima, ...pesajes.map((p) => p.kg)) - 1)
  const techo = Math.ceil(Math.max(maxima, ...pesajes.map((p) => p.kg)) + 1)
  // Cuatro tramos de un número entero de kilos: así las cinco marcas del eje son kilos redondos
  // (73, 69, 65…) en vez de 69,3 o 65,5, que es ruido en una gráfica de 340 px de ancho.
  const paso = Math.max(1, Math.ceil((techo - kgMin) / 4))
  const kgMax = kgMin + paso * 4
  const rango = kgMax - kgMin

  const x = (semana: number) =>
    M.izquierda + (semana / ultima) * (ANCHO - M.izquierda - M.derecha)
  const y = (kg: number) => M.arriba + ((kgMax - kg) / rango) * (ALTO - M.arriba - M.abajo)

  const banda = [
    ...proyeccion.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.semana)},${y(p.peso_max)}`),
    ...[...proyeccion].reverse().map((p) => `L${x(p.semana)},${y(p.peso_min)}`),
    'Z',
  ].join(' ')
  const curva = proyeccion.map((p) => `${x(p.semana)},${y(p.peso_esp)}`).join(' ')
  const hitos = proyeccion.filter((p) => p.semana === 4 || p.semana === 8 || p.semana === 12)

  // Marcas del eje X cada 4 semanas; si no caben, una de cada dos (§2.6b, móvil primero).
  const cada4 = proyeccion.filter((p) => p.semana % 4 === 0)
  const marcasX = cada4.length > 7 ? cada4.filter((_, i) => i % 2 === 0) : cada4
  const marcasY = [0, 1, 2, 3, 4].map((i) => kgMin + paso * i)

  const primero = proyeccion[0]
  const ultimo = proyeccion[proyeccion.length - 1]
  const resumen = `Proyección de peso: de ${numCorto(primero.peso_esp, 1)} kg en la semana ${
    primero.semana
  } a entre ${numCorto(ultimo.peso_min, 1)} y ${numCorto(ultimo.peso_max, 1)} kg en la semana ${
    ultimo.semana
  }.`

  return (
    <svg
      className="grafica-proyeccion"
      viewBox={`0 0 ${ANCHO} ${ALTO}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={resumen}
    >
      <text className="grafica-eje-titulo" x={2} y={10}>
        kg
      </text>
      {marcasY.map((kg) => (
        <g key={kg}>
          <line
            className="grafica-rejilla"
            x1={M.izquierda}
            x2={ANCHO - M.derecha}
            y1={y(kg)}
            y2={y(kg)}
          />
          <text className="grafica-marca" x={M.izquierda - 5} y={y(kg) + 3} textAnchor="end">
            {numCorto(kg, 1)}
          </text>
        </g>
      ))}

      <path className="grafica-banda" d={banda} />
      <polyline className="grafica-curva" points={curva} />

      {objetivo !== null && objetivo >= kgMin && objetivo <= kgMax ? (
        <g>
          <line
            className="grafica-objetivo"
            x1={M.izquierda}
            x2={ANCHO - M.derecha}
            y1={y(objetivo)}
            y2={y(objetivo)}
          />
          <text className="grafica-etiqueta" x={ANCHO - M.derecha} y={y(objetivo) - 4} textAnchor="end">
            objetivo {numCorto(objetivo, 1)} kg
          </text>
        </g>
      ) : null}

      {hitos.map((p) => (
        <g key={p.semana}>
          <circle className="grafica-hito" cx={x(p.semana)} cy={y(p.peso_esp)} r={3.5} />
          <text className="grafica-etiqueta" x={x(p.semana)} y={y(p.peso_esp) - 7} textAnchor="middle">
            {numCorto(p.peso_esp, 1)} kg
          </text>
        </g>
      ))}

      {pesajes.length > 1 ? (
        <polyline
          className="grafica-pesajes"
          points={pesajes.map((p) => `${x(p.semana)},${y(p.kg)}`).join(' ')}
        />
      ) : null}
      {pesajes.map((p) => (
        <circle key={p.fecha} className="grafica-pesaje" cx={x(p.semana)} cy={y(p.kg)} r={3} />
      ))}

      {marcasX.map((p) => (
        <text
          key={p.semana}
          className="grafica-marca"
          x={x(p.semana)}
          y={ALTO - 6}
          textAnchor="middle"
        >
          {p.semana}
        </text>
      ))}
      <text className="grafica-marca" x={M.izquierda} y={ALTO - 16} textAnchor="start">
        semanas
      </text>
    </svg>
  )
}

// ---- Bloque de proyección ------------------------------------------------

interface ProyeccionProps {
  inputs: InputCalculo
  resultado: Resultado
  avisos: AvisoTexto[]
  pesajes: Pesaje[]
}

/** Pesajes convertidos a (semana, kg) para dibujarlos sobre la curva. */
function pesajesEnSemanas(
  pesajes: Pesaje[],
  fechaInicio: string,
  ultimaSemana: number,
): PuntoPesaje[] {
  return ordenar(pesajes).map((p) => ({
    semana: semanaDePesaje(p.fecha, fechaInicio, ultimaSemana),
    kg: p.kg,
    fecha: p.fecha,
  }))
}

export function BloqueProyeccion({ inputs, resultado, avisos, pesajes }: ProyeccionProps) {
  const proyeccion = resultado.proyeccion
  if (!proyeccion || proyeccion.length === 0) return null

  // El copy de debajo de la gráfica es uno de tres, nunca dos (§2.6b y §4.5b): la nota general,
  // el texto de la proyección plana o el de la banda de recomposición de la v1.2.
  const plana = buscarAviso(avisos, 'INFO_PROYECCION_PLANA')
  const recomp = buscarAviso(avisos, 'INFO_PROYECCION_RECOMP')
  const ultima = proyeccion[proyeccion.length - 1].semana
  const puntos = pesajesEnSemanas(pesajes, inputs.fecha_inicio, ultima)

  return (
    <Seccion titulo="Cómo debería ir la cosa" descripcion="Semana a semana, con el margen que toca.">
      <GraficaProyeccion
        proyeccion={proyeccion}
        pesajes={puntos}
        objetivo={resultado.peso_objetivo.efectivo}
      />

      <ul className="leyenda-proyeccion">
        <li className="leyenda-curva">Lo previsto</li>
        <li className="leyenda-banda">Entre lo optimista y lo pesimista</li>
        {puntos.length > 0 ? <li className="leyenda-real">Tu peso real</li> : null}
      </ul>

      <details className="tabla-proyeccion">
        <summary>Ver los números</summary>
        <div className="tabla-envoltorio">
          <table className="tabla-comidas">
            <caption className="visualmente-oculto">
              Peso mínimo, esperado y máximo de la proyección, semana a semana.
            </caption>
            <thead>
              <tr>
                <th scope="col">Semana</th>
                <th scope="col">Mínimo</th>
                <th scope="col">Esperado</th>
                <th scope="col">Máximo</th>
              </tr>
            </thead>
            <tbody>
              {proyeccion.map((p) => (
                <tr key={p.semana}>
                  <th scope="row" className="cifra">
                    {num(p.semana)}
                  </th>
                  <td data-etiqueta="Mínimo" className="cifra">
                    {numCorto(p.peso_min, 1)} kg
                  </td>
                  <td data-etiqueta="Esperado" className="cifra">
                    {numCorto(p.peso_esp, 1)} kg
                  </td>
                  <td data-etiqueta="Máximo" className="cifra">
                    {numCorto(p.peso_max, 1)} kg
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <p className="nota">{plana?.texto ?? recomp?.texto ?? NOTA_PROYECCION}</p>
    </Seccion>
  )
}

// ---- Bloque de seguimiento ----------------------------------------------

interface SeguimientoProps extends ProyeccionProps {
  onCambiar: (pesajes: Pesaje[]) => void
}

export function BloqueSeguimiento({
  inputs,
  resultado,
  avisos,
  pesajes,
  onCambiar,
}: SeguimientoProps) {
  const proyeccion = resultado.proyeccion
  const hoy = hoyIso()
  const [fecha, setFecha] = useState(hoy)
  const [kg, setKg] = useState('')
  const [nota, setNota] = useState<string | null>(null)
  const [confirmarBorrado, setConfirmarBorrado] = useState(false)
  const idFecha = useId()
  const idKg = useId()

  if (!proyeccion || proyeccion.length === 0) return null

  const peso = leerNumero(kg)
  const desdeInicio = diasEntre(inputs.fecha_inicio, fecha)
  const hastaHoy = diasEntre(fecha, hoy)
  const dentroDeFechas = (desdeInicio ?? -1) >= 0 && (hastaHoy ?? -1) >= 0
  const pesoValido = peso !== null && peso >= PESO_MIN_KG && peso <= PESO_MAX_KG
  const valido = dentroDeFechas && pesoValido
  // §2.6c (v1.2, decisión J): hasta ahora una fecha fuera de rango se rechazaba en silencio —el
  // botón apagado, ni mensaje ni campo marcado—, que es justo lo que la §1.0 prohíbe en el wizard.
  const errorFecha = mensajeFechaPesaje(fecha, inputs.fecha_inicio, hoy)
  const errorPeso = mensajePesoPesaje(peso)

  const balance = calcularBalance(
    pesajes,
    proyeccion,
    resultado.objetivo_efectivo,
    inputs.fecha_inicio,
    buscarAviso(avisos, 'INFO_PROYECCION_PLANA') !== undefined || resultado.cronograma === null,
  )

  const anadir = () => {
    if (!valido || peso === null) return
    const { pesajes: nuevos, sustituido } = anadirPesaje(pesajes, {
      fecha,
      kg: Math.round(peso * 10) / 10,
    })
    onCambiar(nuevos)
    setKg('')
    setNota(sustituido ? 'Ya tenías un pesaje ese día; lo hemos actualizado.' : null)
  }

  const borrar = (borrado: Pesaje) => {
    onCambiar(pesajes.filter((p) => p.fecha !== borrado.fecha))
    setNota(null)
  }

  const recientes = [...ordenar(pesajes)].reverse()

  return (
    <>
      <Confirmacion
        abierto={confirmarBorrado}
        titulo="¿Borrar todo el seguimiento?"
        texto="Se borrarán todos los pesajes guardados en este navegador. Esto no se puede deshacer."
        confirmar="Sí, borrarlo todo"
        cancelar="No, conservarlo"
        onCancelar={() => setConfirmarBorrado(false)}
        onConfirmar={() => {
          setConfirmarBorrado(false)
          onCambiar([])
          setNota(null)
        }}
      />
      <details className="panel-seguimiento">
        <summary>
          <span className="panel-ajuste-titulo">
            Tu seguimiento en este móvil
            <span className="distintivo-local">Solo en este dispositivo</span>
          </span>
        </summary>

        <div className="panel-ajuste-cuerpo">
          <p className="nota nota-recuadro">{AVISO_DISPOSITIVO}</p>

          <div className="pesaje-formulario">
            <div className="campo">
              <label className="campo-etiqueta" htmlFor={idFecha}>
                Fecha
              </label>
              <div className={`campo-caja${errorFecha ? ' erroneo' : ''}`}>
                <input
                  id={idFecha}
                  type="date"
                  value={fecha}
                  min={inputs.fecha_inicio}
                  max={hoy}
                  aria-invalid={errorFecha !== null}
                  aria-describedby={errorFecha ? `${idFecha}-error` : undefined}
                  onChange={(evento) => setFecha(evento.target.value)}
                />
              </div>
              {errorFecha ? (
                <p className="campo-error" id={`${idFecha}-error`} role="alert">
                  {errorFecha}
                </p>
              ) : null}
            </div>
            <div className="campo">
              <label className="campo-etiqueta" htmlFor={idKg}>
                Peso
              </label>
              <div className={`campo-caja${errorPeso ? ' erroneo' : ''}`}>
                <input
                  id={idKg}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="Ej. 78,4"
                  value={kg}
                  aria-invalid={errorPeso !== null}
                  aria-describedby={errorPeso ? `${idKg}-error` : undefined}
                  onChange={(evento) => setKg(evento.target.value.replace(/[^\d.,]/g, ''))}
                />
                <span className="campo-unidad">kg</span>
              </div>
              {errorPeso ? (
                <p className="campo-error" id={`${idKg}-error`} role="alert">
                  {errorPeso}
                </p>
              ) : null}
            </div>
            <button type="button" className="btn btn-principal" disabled={!valido} onClick={anadir}>
              Añadir pesaje
            </button>
          </div>
          {nota ? (
            <p className="nota" aria-live="polite">
              {nota}
            </p>
          ) : null}

          {recientes.length > 0 ? (
            <ul className="lista-pesajes">
              {recientes.map((p) => (
                <li key={p.fecha}>
                  <span className="cifra">
                    {fechaCorta(p.fecha)} · {numCorto(p.kg, 1)} kg
                  </span>
                  <button
                    type="button"
                    className="btn-icono"
                    aria-label={`Borrar el pesaje del ${fechaCorta(p.fecha)}`}
                    onClick={() => borrar(p)}
                  >
                    <IconoPapelera />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="nota">Todavía no has apuntado ningún pesaje.</p>
          )}

          {balance ? (
            <div className="balance" data-estado={balance.estado}>
              <p>{balance.frase}</p>
              {balance.nota ? <p className="nota">{balance.nota}</p> : null}
              <p className="nota">{balance.cierre}</p>
            </div>
          ) : (
            // La frase de balance necesita dos pesajes. El día que se crea el plan solo cabe uno
            // (la fecha mínima y la máxima son la misma), así que sin esta línea el usuario apunta
            // su peso, no pasa nada visible y no sabe por qué.
            <p className="nota">
              Con dos pesajes en semanas distintas te decimos si vas por delante o por detrás de la
              previsión.
            </p>
          )}

          {recientes.length > 0 ? (
            <button
              type="button"
              className="btn-plano"
              onClick={() => setConfirmarBorrado(true)}
            >
              Borrar todo el seguimiento
            </button>
          ) : null}
        </div>
      </details>
    </>
  )
}
