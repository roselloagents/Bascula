// Pasos 1 a 5b: sexo, edad, embarazo/lactancia, altura y peso, condiciones
// médicas y cribado breve sobre la relación con la comida.

import type { Condicion } from '../../../engine/types'
import { CampoNumero, Grupo, Opcion } from '../../ui/Controles'
import { CONDICION_ETIQUETA, TEXTO_CONDICIONES_FIJO } from '../../utiles/copy'
import type { RespuestaCribado } from '../borrador'
import { estaMarcado } from '../borrador'
import { Pantalla, type PropsPaso } from './comun'

export function PasoSexo({ b, set }: PropsPaso) {
  return (
    <Pantalla
      titulo="¿Cuál es tu sexo?"
      ayuda="Lo usamos porque las fórmulas de gasto energético y de estimación de grasa corporal son distintas entre hombres y mujeres. Todavía no tenemos fórmulas validadas para otras opciones; en cuanto existan, las añadiremos."
    >
      <div className="opciones">
        <Opcion
          nombre="sexo"
          titulo="Hombre"
          seleccionada={b.sexo === 'hombre'}
          onElegir={() => set({ sexo: 'hombre' })}
        />
        <Opcion
          nombre="sexo"
          titulo="Mujer"
          seleccionada={b.sexo === 'mujer'}
          onElegir={() => set({ sexo: 'mujer' })}
        />
      </div>
    </Pantalla>
  )
}

export function PasoEdad({ b, set, errores, marcados }: PropsPaso) {
  return (
    <Pantalla
      titulo="¿Cuántos años tienes?"
      ayuda="La edad influye en tu metabolismo basal y en cuánta proteína necesitas para mantener el músculo. Báscula está pensada para adultos de 18 a 75 años."
    >
      <CampoNumero
        etiqueta="Edad"
        unidad="años"
        entero
        autoFoco
        valor={b.edad}
        onCambio={(edad) => set({ edad })}
        error={errores.edad}
        marcado={estaMarcado(marcados, 'edad')}
      />
    </Pantalla>
  )
}

export function PasoEmbarazo({ b, set }: PropsPaso) {
  return (
    <Pantalla
      titulo="¿Estás embarazada o en periodo de lactancia?"
      ayuda="El embarazo y la lactancia cambian tanto las necesidades nutricionales que no pueden calcularse con una calculadora general."
    >
      <div className="opciones">
        <Opcion
          nombre="embarazo"
          titulo="Sí"
          seleccionada={b.embarazo_lactancia === true}
          onElegir={() => set({ embarazo_lactancia: true })}
        />
        <Opcion
          nombre="embarazo"
          titulo="No"
          seleccionada={b.embarazo_lactancia === false}
          onElegir={() => set({ embarazo_lactancia: false })}
        />
      </div>
    </Pantalla>
  )
}

export function PasoMedidas({ b, set, errores, marcados }: PropsPaso) {
  return (
    <Pantalla
      titulo="Tu altura y tu peso"
      ayuda="Tu altura y tu peso son la base de todos los cálculos: cuánta energía necesitas, cuánta proteína y cuánta agua."
    >
      <div className="pareja-campos">
        <CampoNumero
          etiqueta="¿Cuánto mides?"
          unidad="cm"
          autoFoco
          valor={b.altura_cm}
          onCambio={(altura_cm) => set({ altura_cm })}
          error={errores.altura_cm}
          marcado={estaMarcado(marcados, 'altura_cm')}
        />
        <CampoNumero
          etiqueta="¿Cuánto pesas?"
          unidad="kg"
          valor={b.peso_kg}
          onCambio={(peso_kg) => set({ peso_kg })}
          error={errores.peso_kg}
          marcado={estaMarcado(marcados, 'peso_kg')}
          pista="Puedes actualizarlo cuando quieras: recalcularemos tu plan con tu peso real."
        />
      </div>
    </Pantalla>
  )
}

const ORDEN_CONDICIONES: Exclude<Condicion, 'tca'>[] = [
  'diabetes',
  'renal',
  'hepatica',
  'cardiaca',
  'hipertension',
  'tiroides',
  'bariatrica',
  'glp1',
  'otra',
]

export function PasoCondiciones({ b, set }: PropsPaso) {
  const alternar = (condicion: Exclude<Condicion, 'tca'>) =>
    set((previo) => ({
      condiciones: previo.condiciones.includes(condicion)
        ? previo.condiciones.filter((c) => c !== condicion)
        : [...previo.condiciones, condicion],
      sinCondiciones: false,
    }))

  return (
    <Pantalla
      titulo="¿Tienes alguna de estas condiciones?"
      intro="Puedes marcar varias."
      ayuda="No usamos esta información para bloquear tu plan, solo para avisarte de cosas importantes antes de que lo apliques. Nunca sustituye a tu equipo médico."
    >
      <div className="opciones">
        {ORDEN_CONDICIONES.map((condicion) => (
          <Opcion
            key={condicion}
            nombre={`condicion-${condicion}`}
            tipo="checkbox"
            titulo={CONDICION_ETIQUETA[condicion]}
            seleccionada={!b.sinCondiciones && b.condiciones.includes(condicion)}
            onElegir={() => alternar(condicion)}
          />
        ))}
        <Opcion
          nombre="condicion-ninguna"
          tipo="checkbox"
          titulo="Ninguna de las anteriores"
          seleccionada={b.sinCondiciones}
          onElegir={() => set({ sinCondiciones: !b.sinCondiciones, condiciones: [] })}
        />
      </div>
      <p className="nota nota-recuadro">{TEXTO_CONDICIONES_FIJO}</p>
    </Pantalla>
  )
}

const RESPUESTAS_CRIBADO: { valor: RespuestaCribado; titulo: string }[] = [
  { valor: 'si', titulo: 'Sí' },
  { valor: 'prefiero_no', titulo: 'Prefiero no responder' },
  { valor: 'no', titulo: 'No' },
]

export function PasoCribado({ b, set }: PropsPaso) {
  const responder = (clave: 'q1' | 'q2', valor: RespuestaCribado) =>
    set((previo) => ({ cribado: { ...previo.cribado, [clave]: valor } }))

  return (
    <Pantalla
      titulo="Tu relación con la comida"
      intro="Solo la usamos para ajustar el ritmo de tu plan. En tu informe verás una nota diciendo que hemos aplicado el ritmo más suave, pero no aparece esta pregunta ni tu respuesta."
    >
      <Grupo etiqueta="¿Alguna vez la comida o el peso te han generado mucha ansiedad o preocupación?" fila>
        {RESPUESTAS_CRIBADO.map(({ valor, titulo }) => (
          <Opcion
            key={valor}
            nombre="cribado-1"
            compacta
            titulo={titulo}
            seleccionada={b.cribado.q1 === valor}
            onElegir={() => responder('q1', valor)}
          />
        ))}
      </Grupo>
      <Grupo etiqueta="¿Dirías que la comida o el peso ocupan tu cabeza gran parte del día?" fila>
        {RESPUESTAS_CRIBADO.map(({ valor, titulo }) => (
          <Opcion
            key={valor}
            nombre="cribado-2"
            compacta
            titulo={titulo}
            seleccionada={b.cribado.q2 === valor}
            onElegir={() => responder('q2', valor)}
          />
        ))}
      </Grupo>
      <p className="nota nota-recuadro">
        Si en algún momento la comida o el peso te generan mucha ansiedad, no tienes que gestionarlo
        solo/a: puedes hablar gratis con ADANER (Asociación en Defensa de la Atención a la Anorexia y
        la Bulimia) o con tu centro de salud.
      </p>
    </Pantalla>
  )
}
