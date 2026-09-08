// Peso objetivo y cronograma, avisos, metodología y disclaimer
// (SPEC-ux §2.6, §2.8, §2.9 y §2.10).

import type { AvisoTexto, InputCalculo, Resultado } from '../../engine/types'
import { Plegable } from '../ui/Controles'
import { TrioSomatotipos } from '../graficos/Siluetas'
import { AYUDA_TCA, DISCLAIMER, NOTA_PESO_OBJETIVO } from '../utiles/copy'
import { entero, fechaLarga, mesYAno, num, numCorto } from '../utiles/formato'
import { CajaAviso, Seccion } from './comun'
import { buscarAviso } from '../utiles/avisos'

const CODIGOS_SIN_CRONOGRAMA = [
  'INFO_SIN_CRONOGRAMA_SIN_MARGEN',
  'INFO_CRONOGRAMA_NO_ESTIMABLE',
  'INFO_CRONOGRAMA_FUERA_DE_HORIZONTE',
  'INFO_SIN_CRONOGRAMA',
]

const CATEGORIA_FFMI: Record<string, string> = {
  bajo: 'bajo',
  medio: 'medio',
  bueno: 'bueno',
  muy_desarrollado: 'muy desarrollado',
  excepcional: 'excepcional',
}

const NOMBRE_CLASICAS: Record<string, string> = {
  devine: 'Devine',
  robinson: 'Robinson',
  miller: 'Miller',
  hamwi: 'Hamwi',
}

interface PropsCierre {
  inputs: InputCalculo
  resultado: Resultado
  avisos: AvisoTexto[]
}

export function BloquePeso({ inputs, resultado, avisos }: PropsCierre) {
  const po = resultado.peso_objetivo
  const crono = resultado.cronograma
  const avisoSinCrono = avisos.find((a) => CODIGOS_SIN_CRONOGRAMA.includes(a.codigo))
  const adaptacion = buscarAviso(avisos, 'INFO_ADAPTACION')

  // El peso que ha escrito el usuario se enseña SIEMPRE como cifra principal (v1.2): con la grasa
  // estimada (`mostrar_central === false`) la tarjeta titulaba una franja que él no había pedido y
  // que además dejaba su número fuera, mientras la gráfica, la tabla y los avisos sí hablaban de
  // él. La franja propuesta pasa a nota. El titular de franja se reserva para quien no dio meta.
  const metaDelUsuario = inputs.peso_objetivo !== null && inputs.peso_objetivo !== undefined
  const conCifra = po.efectivo !== null && (po.mostrar_central || metaDelUsuario)

  return (
    <Seccion titulo="A dónde vas y en cuánto tiempo">
      {conCifra && po.efectivo !== null ? (
        <>
          <p className="cifra peso-cifra">{numCorto(po.efectivo, 1)} kg</p>
          <p className="peso-etiqueta">{metaDelUsuario ? 'tu objetivo' : 'el peso que te proponemos'}</p>
          {!metaDelUsuario ? (
            <p className="nota">
              Te proponemos este peso según tu altura y tu porcentaje de grasa actual; puedes cambiarlo
              cuando quieras.
            </p>
          ) : null}
          {!po.mostrar_central ? (
            <>
              <p className="nota">
                Por tu masa magra estimada te propondríamos entre {numCorto(po.rango[0], 1)} y{' '}
                {numCorto(po.rango[1], 1)} kg, pero el número que manda es el tuyo.
              </p>
              <p className="nota">{NOTA_PESO_OBJETIVO}</p>
            </>
          ) : null}
        </>
      ) : (
        <>
          <p className="cifra peso-franja">
            Entre {numCorto(po.rango[0], 1)} y {numCorto(po.rango[1], 1)} kg
          </p>
          <p className="nota">
            Tu masa magra es una estimación con varios kilos de margen, así que te damos una franja y
            no un número.
          </p>
          <p className="nota">{NOTA_PESO_OBJETIVO}</p>
        </>
      )}

      {/* Recomposición con déficit real (v1.2): el peso objetivo existe y se dibuja, pero no hay
          fecha y el músculo que se gane compensa parte de la grasa que se pierda. Se dice aquí,
          donde está el número, y no solo en la nota de la proyección. */}
      {resultado.objetivo_efectivo === 'recomposicion' && po.efectivo !== null ? (
        <p className="nota">
          En recomposición este peso es orientativo: la báscula baja más despacio de lo que cambia
          tu cuerpo, así que no te damos una fecha. Mídete también la cintura y hazte fotos.
        </p>
      ) : null}

      {po.hito_intermedio !== null ? (
        <div className="hito">
          <p className="cifra hito-cifra">Primer hito: {numCorto(po.hito_intermedio, 1)} kg</p>
          <p className="nota">
            Cuando el camino es largo, ir por etapas ayuda a no perder la motivación.
          </p>
        </div>
      ) : null}

      {crono ? (
        <div className="cronograma">
          {crono.tramo_12sem ? (
            <p className="cronograma-principal cifra">
              En las próximas 12 semanas, entre {numCorto(crono.tramo_12sem[0], 1)} y{' '}
              {numCorto(crono.tramo_12sem[1], 1)} kg
            </p>
          ) : null}
          <ul className="cronograma-hitos">
            <li>
              <span className="cifra">
                Entre {num(crono.semanas[0])} y {num(crono.semanas[1])} semanas
              </span>{' '}
              para llegar al objetivo
              {crono.precision_fecha === 'dia'
                ? `, de ${fechaLarga(crono.fecha_min)} a ${fechaLarga(crono.fecha_max)}`
                : `, hacia ${mesYAno(crono.fecha_max)}`}
              .
            </li>
            <li>
              Eso es un ritmo de unos{' '}
              <span className="cifra">{numCorto(crono.ritmo_kg_sem, 2)} kg</span> (
              <span className="cifra">{numCorto(crono.ritmo_pct_sem, 1)} %</span>) por semana.
            </li>
            {crono.diet_breaks > 0 ? (
              <li>
                Hemos incluido <span className="cifra">{num(crono.diet_breaks)}</span>{' '}
                {crono.diet_breaks === 1 ? 'semana' : 'semanas'} a mantenimiento dentro del cálculo,
                para que el cuerpo descanse del déficit.
              </li>
            ) : null}
          </ul>
          {adaptacion ? <CajaAviso aviso={adaptacion} /> : null}
        </div>
      ) : avisoSinCrono ? (
        <CajaAviso aviso={avisoSinCrono} />
      ) : (
        <p className="nota nota-recuadro">
          Con este objetivo no hay un peso al que llegar en una fecha. Reevalúa medidas, fotos y
          rendimiento cada 8-12 semanas.
        </p>
      )}
    </Seccion>
  )
}

export function BloqueAvisos({ avisos }: { avisos: AvisoTexto[] }) {
  const warns = avisos.filter((a) => a.severidad === 'warn' || a.severidad === 'error')
  const infos = avisos.filter((a) => a.severidad === 'info')
  if (avisos.length === 0) return null

  return (
    <Seccion titulo="Avisos y notas para tu caso">
      {warns.length > 0 ? (
        <div className="lista-avisos">
          {warns.map((aviso) => (
            <CajaAviso key={aviso.codigo} aviso={aviso} />
          ))}
        </div>
      ) : null}
      {infos.length > 0 ? (
        <Plegable
          titulo={`Notas informativas (${infos.length})`}
          abiertoInicial
        >
          {infos.map((aviso) => (
            <CajaAviso key={aviso.codigo} aviso={aviso} />
          ))}
        </Plegable>
      ) : null}
    </Seccion>
  )
}

export function BloqueMetodologia({ inputs, resultado, avisos }: PropsCierre) {
  const somatotipo = buscarAviso(avisos, 'INFO_SOMATOTIPO')
  const clasicas = resultado.peso_objetivo.referencias.clasicas

  return (
    <Plegable titulo="¿Cómo hemos calculado esto?">
      <p>
        Tu metabolismo basal (las calorías que gastarías en reposo absoluto) lo hemos calculado con{' '}
        {resultado.bmr.ecuacion === 'katch_mcardle'
          ? 'Katch-McArdle, porque nos diste un porcentaje de grasa de una prueba fiable'
          : 'Mifflin-St Jeor, la fórmula estándar'}
        : <span className="cifra">{entero(resultado.bmr.valor)} kcal</span> al día.
      </p>
      <p>
        Tu gasto total estimado antes del margen de seguridad es de{' '}
        <span className="cifra">{entero(resultado.tdee.bruto)} kcal</span>; le restamos un 5 % y nos
        quedamos con <span className="cifra">{entero(resultado.tdee.valor)} kcal</span>.
      </p>
      {inputs.somatotipo ? (
        <>
          <p>
            {somatotipo
              ? somatotipo.texto
              : 'El somatotipo es una forma antigua de describir la silueta corporal, pero la ciencia actual no ha demostrado que sirva para calcular calorías o macros de forma precisa. Lo hemos usado solo como un ajuste ligero entre carbohidratos y grasa (nunca en tus calorías ni tu proteína).'}
          </p>
          <p className="nota">
            Con tus respuestas hemos aplicado el ajuste de tipo{' '}
            <strong>{resultado.macros.somatotipo}</strong>.
          </p>
          <TrioSomatotipos sexo={inputs.sexo} destacado={resultado.macros.somatotipo} />
        </>
      ) : null}

      {/* v1.1 (decisión A): el bloque de referencias se muestra a todo el mundo, sin guardas. */}
      <div className="referencias">
          <h3>Otras referencias, no son un objetivo</h3>
          <ul className="lista-referencias cifra">
            <li>Grasa corporal por CUN-BAE: {numCorto(resultado.grasa.referencias.cunbae, 1)} %</li>
            <li>Grasa corporal por Deurenberg: {numCorto(resultado.grasa.referencias.deurenberg, 1)} %</li>
            {resultado.grasa.referencias.navy !== undefined ? (
              <li>Grasa corporal por US Navy: {numCorto(resultado.grasa.referencias.navy, 1)} %</li>
            ) : null}
            <li>Masa libre de grasa estimada: {numCorto(resultado.mlg, 1)} kg</li>
            <li>
              Índice de masa libre de grasa (FFMI): {numCorto(resultado.ffmi.normalizado, 1)}
              {resultado.ffmi.categoria ? ` — ${CATEGORIA_FFMI[resultado.ffmi.categoria]}` : ''}
            </li>
            <li>Peso para un IMC de 22: {numCorto(resultado.peso_objetivo.referencias.imc22, 1)} kg</li>
          {clasicas
            ? Object.entries(clasicas).map(([clave, valor]) => (
                <li key={clave}>
                  Peso ideal {NOMBRE_CLASICAS[clave] ?? clave}: {numCorto(valor, 1)} kg
                </li>
              ))
            : null}
        </ul>
      </div>
    </Plegable>
  )
}

/**
 * §2.10. La línea de ADANER es literal, fija y para todo el mundo: es lo único que queda del
 * cribado retirado en la v1.1, y va en el mismo tamaño que el resto del disclaimer. El texto
 * se parte por el dominio para poder enlazarlo, en vez de reescribirlo: así esta pantalla, la
 * de derivación y el PDF dicen exactamente lo mismo.
 */
export function BloqueDisclaimer() {
  const [antes, despues] = AYUDA_TCA.split('adaner.org')
  return (
    <section className="disclaimer">
      <p>{DISCLAIMER}</p>
      <p className="disclaimer-ayuda">
        {antes}
        <a href="https://adaner.org" target="_blank" rel="noopener noreferrer">
          adaner.org
        </a>
        {despues}
      </p>
    </section>
  )
}
