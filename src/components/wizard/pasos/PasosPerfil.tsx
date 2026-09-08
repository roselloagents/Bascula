// Pasos 1 a 5: sexo, edad, embarazo/lactancia, regla, altura y peso y
// condiciones médicas.

import type { Condicion, Menstruacion, SintomaRegla } from '../../../engine/types'
import { Ayuda, CampoNumero, Grupo, Opcion } from '../../ui/Controles'
import { CONDICION_ETIQUETA, TEXTO_CONDICIONES_FIJO } from '../../utiles/copy'
import { estaMarcado, ORDEN_SINTOMAS } from '../borrador'
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
        placeholder="Ej. 35"
        valor={b.edad}
        onCambio={(edad) => set({ edad })}
        error={errores.edad}
        max={120}
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

const REGLAS: { valor: Menstruacion; titulo: string }[] = [
  { valor: 'regular', titulo: 'Regular — me viene más o menos cada mes' },
  { valor: 'irregular', titulo: 'Irregular — se me adelanta, se me atrasa o se me salta' },
  { valor: 'ausente', titulo: 'No la tengo — menopausia, anticonceptivo continuo u otra causa' },
  { valor: 'no_dice', titulo: 'Prefiero no decirlo' },
]

const SINTOMAS: { valor: SintomaRegla; titulo: string }[] = [
  { valor: 'dolor', titulo: 'Dolor fuerte' },
  { valor: 'hinchazon', titulo: 'Hinchazón y retención' },
  { valor: 'antojos', titulo: 'Más hambre o antojos' },
  { valor: 'cansancio', titulo: 'Cansancio' },
  { valor: 'sangrado_abundante', titulo: 'Sangrado abundante' },
]

/**
 * Paso 3b (SPEC-ux §1). No cambia calorías ni macros: produce la tarjeta "Tu ciclo y tu plan" y,
 * con regla irregular o ausente junto a un déficit, el aviso de seguridad. Lo único numérico que sí
 * cambia es el ritmo (paso 6.7bis del motor), y por eso el copy lo dice: prometer "no cambia ningún
 * número" y luego mover el ritmo en la cabecera del resultado es mentir. Se puede dejar sin
 * contestar: `null` vale exactamente igual que "prefiero no decirlo".
 */
export function PasoRegla({ b, set }: PropsPaso) {
  // El orden en que se marcan no importa: se guardan siempre en el orden canónico del tipo.
  const alternarSintoma = (sintoma: SintomaRegla) =>
    set((previo) => ({
      sintomas_regla: ORDEN_SINTOMAS.filter((s) =>
        s === sintoma ? !previo.sintomas_regla.includes(s) : previo.sintomas_regla.includes(s),
      ),
    }))

  return (
    <Pantalla
      titulo="¿Cómo es tu regla?"
      intro="Puedes saltarte esta pregunta: no cambia tus calorías ni tus macros. Lo único que puede cambiar: si has elegido ritmo agresivo y tu regla es irregular o no la tienes, lo suavizamos a moderado por seguridad."
      ayuda="No cambia tus macros: el gasto energético varía muy poco a lo largo del ciclo. Lo preguntamos por dos motivos. Uno, para explicarte por qué la báscula sube un par de kilos la semana antes de la regla sin que hayas hecho nada mal. Y dos, porque una regla irregular o ausente junto con un déficit puede ser una señal de que estás comiendo demasiado poco, y eso sí conviene mirarlo: en ese caso, si habías pedido ritmo agresivo, lo suavizamos a moderado (y con él cambian las calorías del plan)."
    >
      <div className="opciones">
        {REGLAS.map(({ valor, titulo }) => (
          <Opcion
            key={valor}
            nombre="menstruacion"
            titulo={titulo}
            seleccionada={b.menstruacion === valor}
            // Con "no la tengo" o "prefiero no decirlo" la subpregunta se cierra y su valor se
            // descarta (§1 paso 3b): no se guarda una respuesta que la pantalla ya no enseña.
            onElegir={() =>
              set(
                valor === 'regular' || valor === 'irregular'
                  ? { menstruacion: valor }
                  : { menstruacion: valor, sintomas_regla: [] },
              )
            }
          />
        ))}
      </div>

      {/* Subpregunta de la v1.2 (decisión I): no es un paso y no toca la barra de progreso.
          No cambia ningún número: su único efecto es la tarjeta del ciclo y la compra opcional. */}
      {b.menstruacion === 'regular' || b.menstruacion === 'irregular' ? (
        <div className="subpregunta">
          <Grupo
            etiqueta="¿Qué notas esos días?"
            descripcion="Opcional, puedes marcar varias."
          >
            {SINTOMAS.map(({ valor, titulo }) => (
              <Opcion
                key={valor}
                nombre={`sintoma-${valor}`}
                tipo="checkbox"
                titulo={titulo}
                seleccionada={b.sintomas_regla.includes(valor)}
                onElegir={() => alternarSintoma(valor)}
              />
            ))}
          </Grupo>
          <p className="nota">
            Esto no cambia tus calorías ni tus macros. Te damos consejos de alimentos para esos días,
            que es donde sí se puede hacer algo.
          </p>
          <Ayuda>
            A los números no les afecta: lo que cambia en esos días son los micronutrientes, sobre
            todo el hierro si sangras mucho. Con lo que marques te preparamos una tarjeta con qué
            priorizar antes y durante la regla, y una sección opcional en la lista de la compra.
          </Ayuda>
        </div>
      ) : null}
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
          placeholder="Ej. 172"
          valor={b.altura_cm}
          onCambio={(altura_cm) => set({ altura_cm })}
          error={errores.altura_cm}
          max={230}
          marcado={estaMarcado(marcados, 'altura_cm')}
        />
        <CampoNumero
          etiqueta="¿Cuánto pesas?"
          unidad="kg"
          placeholder="Ej. 74"
          valor={b.peso_kg}
          onCambio={(peso_kg) => set({ peso_kg })}
          error={errores.peso_kg}
          max={300}
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
