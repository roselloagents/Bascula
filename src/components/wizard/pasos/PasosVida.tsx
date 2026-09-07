// Pasos 8 a 13: actividad diaria, entrenamiento, objetivo, ritmo, peso objetivo
// y preferencias de menú.

import { Fragment } from 'react'
import type {
  ActividadDiaria,
  Experiencia,
  Intensidad,
  Momento,
  NComidas,
  Objetivo,
  PreferenciaBase,
  RecomposicionPrioridad,
  Restriccion,
  Ritmo,
  TipoEntrenamiento,
} from '../../../engine/types'
import { CampoNumero, Deslizador, Grupo, Interruptor, Opcion } from '../../ui/Controles'
import { numCorto, leerNumero } from '../../utiles/formato'
import { estaMarcado } from '../borrador'
import { Pantalla, type PropsPaso } from './comun'

const ACTIVIDADES: { valor: ActividadDiaria; titulo: string; detalle: string }[] = [
  { valor: 'sedentario', titulo: 'Sedentario', detalle: 'Trabajo sentado, me muevo poco (menos de 5.000 pasos al día)' },
  { valor: 'ligero', titulo: 'Ligero', detalle: 'De pie parte del día o camino algo (5.000-7.500 pasos)' },
  { valor: 'moderado', titulo: 'Moderado', detalle: 'Trabajo activo o camino bastante (7.500-10.000 pasos)' },
  { valor: 'alto', titulo: 'Alto', detalle: 'Trabajo físico o camino mucho (10.000-12.500 pasos)' },
  { valor: 'muy_alto', titulo: 'Muy alto', detalle: 'Trabajo físico intenso: obra, reparto, agricultura (más de 12.500 pasos)' },
]

export function PasoActividad({ b, set }: PropsPaso) {
  return (
    <Pantalla
      titulo="Sin contar el ejercicio que hagas de forma programada, ¿cómo describirías tu día a día?"
      intro="Si no llevas la cuenta de pasos, piensa en cuánto te mueves un día normal de trabajo, no un día de gimnasio."
      ayuda="Esta es la mayor diferencia real de gasto energético entre dos personas: no es lo mismo un trabajo de oficina que uno de reparto, aunque ninguno de los dos entrene."
    >
      <div className="opciones">
        {ACTIVIDADES.map(({ valor, titulo, detalle }) => (
          <Opcion
            key={valor}
            nombre="actividad"
            titulo={titulo}
            detalle={detalle}
            seleccionada={b.actividad_diaria === valor}
            onElegir={() => set({ actividad_diaria: valor })}
          />
        ))}
      </div>
    </Pantalla>
  )
}

const TIPOS: { valor: Exclude<TipoEntrenamiento, 'ninguno'>; titulo: string; detalle: string }[] = [
  { valor: 'fuerza', titulo: 'Fuerza', detalle: 'Pesas, calistenia, máquinas' },
  { valor: 'cardio', titulo: 'Cardio', detalle: 'Correr, bici, nadar, elíptica' },
  { valor: 'mixto', titulo: 'Mixto', detalle: 'Crossfit, clases dirigidas, combinación de ambos' },
]

const ANCLAS_INTENSIDAD: Record<string, Record<Intensidad, string>> = {
  fuerza: {
    baja: 'Máquinas, descansos largos',
    media: 'Pesos libres, series cerca del fallo',
    alta: 'Circuitos, descansos cortos',
  },
  cardio: {
    baja: 'Andar rápido, bici suave',
    media: 'Trote, bici moderada, natación',
    alta: 'Correr rápido, series intensas, spinning',
  },
  mixto: {
    baja: 'Sesiones suaves, poco tiempo en tensión',
    media: 'Mezcla de fuerza y cardio en la misma sesión',
    alta: 'Sesiones muy exigentes, casi sin pausas',
  },
}

const EXPERIENCIAS: { valor: Experiencia; titulo: string }[] = [
  { valor: 'novato', titulo: 'Menos de 1 año' },
  { valor: 'intermedio', titulo: 'Entre 1 y 4 años' },
  { valor: 'avanzado', titulo: 'Más de 4 años' },
]

const MOMENTOS: { valor: Momento; titulo: string }[] = [
  { valor: 'manana', titulo: 'Por la mañana' },
  { valor: 'mediodia', titulo: 'A mediodía' },
  { valor: 'tarde', titulo: 'Por la tarde' },
  { valor: 'noche', titulo: 'Por la noche' },
]

export function PasoEntrenamiento({ b, set }: PropsPaso) {
  const e = b.entrenamiento
  const setEntreno = (parche: Partial<typeof e>) =>
    set((previo) => ({ entrenamiento: { ...previo.entrenamiento, ...parche } }))
  const anclas = ANCLAS_INTENSIDAD[e.tipo ?? 'fuerza']

  return (
    <Pantalla
      titulo="¿Entrenas de forma regular?"
      ayuda="El entrenamiento cambia dos cosas: cuántas calorías gastas y cuánta proteína necesitas. Con fuerza, además, es lo que hace que el peso que pierdas sea grasa y no músculo."
    >
      <div className="opciones">
        <Opcion
          nombre="entrena"
          titulo="Sí, entreno"
          seleccionada={b.entrena === true}
          onElegir={() => set({ entrena: true })}
        />
        <Opcion
          nombre="entrena"
          titulo="No entreno actualmente"
          detalle="Calcularemos tu plan con tu actividad del día a día."
          seleccionada={b.entrena === false}
          onElegir={() => set({ entrena: false })}
        />
      </div>

      {b.entrena ? (
        <div className="sub-bloque">
          <Grupo etiqueta="¿Qué tipo de entrenamiento haces principalmente?">
            {TIPOS.map(({ valor, titulo, detalle }) => (
              <Opcion
                key={valor}
                nombre="tipo-entreno"
                titulo={titulo}
                detalle={detalle}
                seleccionada={e.tipo === valor}
                onElegir={() => setEntreno({ tipo: valor })}
              />
            ))}
          </Grupo>

          <Deslizador
            etiqueta="¿Cuántos días a la semana?"
            valor={e.dias_semana}
            min={0}
            max={7}
            paso={1}
            sufijo={e.dias_semana === 1 ? 'día' : 'días'}
            onCambio={(dias_semana) => setEntreno({ dias_semana })}
          />
          {e.dias_semana === 0 ? (
            <p className="nota">
              Con 0 días a la semana, lo calculamos igual que si no entrenaras: dinos los días reales
              cuando empieces.
            </p>
          ) : null}

          <Deslizador
            etiqueta="¿Cuánto dura cada sesión, de media?"
            valor={e.minutos_sesion}
            min={10}
            max={240}
            paso={5}
            sufijo="min"
            onCambio={(minutos_sesion) => setEntreno({ minutos_sesion })}
          />

          <Grupo etiqueta="¿Cómo describirías la intensidad?">
            {(['baja', 'media', 'alta'] as Intensidad[]).map((valor) => (
              <Opcion
                key={valor}
                nombre="intensidad"
                titulo={valor === 'baja' ? 'Baja' : valor === 'media' ? 'Media' : 'Alta'}
                detalle={anclas[valor]}
                seleccionada={e.intensidad === valor}
                onElegir={() => setEntreno({ intensidad: valor })}
              />
            ))}
          </Grupo>

          <Grupo
            etiqueta="¿Cuánto tiempo llevas entrenando de forma constante?"
            descripcion="Afecta a cuánto superávit calórico tiene sentido si tu objetivo es ganar músculo: cuanta más experiencia, menos margen de crecimiento y menos superávit necesitas."
            fila
          >
            {EXPERIENCIAS.map(({ valor, titulo }) => (
              <Opcion
                key={valor}
                nombre="experiencia"
                compacta
                titulo={titulo}
                seleccionada={e.experiencia === valor}
                onElegir={() => setEntreno({ experiencia: valor })}
              />
            ))}
          </Grupo>

          <Grupo
            etiqueta="¿Prefieres entrenar en algún momento del día en concreto?"
            descripcion="Si nos lo dices, adelantaremos un poco de carbohidrato a la comida más cercana a tu entrenamiento."
            fila
          >
            {MOMENTOS.map(({ valor, titulo }) => (
              <Opcion
                key={valor}
                nombre="momento"
                compacta
                titulo={titulo}
                seleccionada={e.momento === valor}
                onElegir={() => setEntreno({ momento: valor, momentoRespondido: true })}
              />
            ))}
            <Opcion
              nombre="momento"
              compacta
              titulo="No tengo preferencia"
              seleccionada={e.momentoRespondido && e.momento === null}
              onElegir={() => setEntreno({ momento: null, momentoRespondido: true })}
            />
          </Grupo>
        </div>
      ) : null}
    </Pantalla>
  )
}

const OBJETIVOS: { valor: Objetivo; titulo: string; detalle: string }[] = [
  { valor: 'perder', titulo: 'Perder grasa', detalle: 'Quiero bajar de peso cuidando el músculo que ya tengo.' },
  { valor: 'mantener', titulo: 'Mantenerme', detalle: 'Estoy a gusto con mi peso y quiero comer mejor y con orden.' },
  { valor: 'ganar', titulo: 'Ganar músculo', detalle: 'Quiero subir de peso ganando sobre todo masa muscular.' },
  {
    valor: 'recomposicion',
    titulo: 'Recomposición: perder grasa y ganar músculo a la vez',
    detalle:
      'Funciona mejor si tienes poca experiencia entrenando fuerza o si tu porcentaje de grasa ya es bajo. Los cambios son más lentos que en una fase específica, y es lo esperable.',
  },
  {
    valor: 'no_se',
    titulo: 'No lo tengo claro, decididlo vosotros',
    detalle:
      'Miraremos tu composición corporal y tu entrenamiento para proponerte lo más sensato. Podrás cambiarlo después.',
  },
]

const PRIORIDADES_RECOMP: { valor: RecomposicionPrioridad; titulo: string }[] = [
  { valor: 'perder', titulo: 'Perder grasa' },
  { valor: 'equilibrado', titulo: 'Las dos por igual' },
  { valor: 'ganar', titulo: 'Ganar músculo' },
]

export function PasoObjetivo({ b, set }: PropsPaso) {
  return (
    <Pantalla
      titulo="¿Cuál es tu objetivo principal ahora mismo?"
      ayuda="Es lo único que decide si sumamos o restamos calorías sobre tu gasto. Puedes cambiarlo después sin repetir el cuestionario: te llevamos de vuelta a esta pregunta."
    >
      <div className="opciones">
        {OBJETIVOS.map(({ valor, titulo, detalle }) => (
          <Fragment key={valor}>
            <Opcion
              nombre="objetivo"
              titulo={titulo}
              detalle={detalle}
              seleccionada={b.objetivo === valor}
              onElegir={() => set({ objetivo: valor })}
            />
            {/* Subpregunta del paso 10 (SPEC-ux §1, decisión C): vive dentro de esta pantalla,
                justo debajo de la tarjeta de recomposición, y no cuenta en la barra de progreso. */}
            {valor === 'recomposicion' && b.objetivo === 'recomposicion' ? (
              <div className="subpregunta">
                <Grupo
                  etiqueta="¿Qué te importa más ahora?"
                  descripcion="La recomposición es un equilibrio, y el equilibrio se puede inclinar. Si ahora te importa más perder grasa, bajamos algo más las calorías y te subimos la grasa a costa de los hidratos. Si te importa más ganar músculo, te dejamos comiendo en tu gasto, sin déficit. En los dos casos sigue siendo un proceso lento."
                  fila
                >
                  {PRIORIDADES_RECOMP.map((prioridad) => (
                    <Opcion
                      key={prioridad.valor}
                      nombre="recomposicion-prioridad"
                      compacta
                      titulo={prioridad.titulo}
                      seleccionada={b.recomposicion_prioridad === prioridad.valor}
                      onElegir={() => set({ recomposicion_prioridad: prioridad.valor })}
                    />
                  ))}
                </Grupo>
              </div>
            ) : null}
          </Fragment>
        ))}
      </div>
    </Pantalla>
  )
}

const RITMOS: { valor: Ritmo; titulo: string; detalle: string }[] = [
  { valor: 'suave', titulo: 'Suave', detalle: 'El cambio será más lento, pero más fácil de mantener.' },
  { valor: 'moderado', titulo: 'Moderado', detalle: 'Un equilibrio entre velocidad y comodidad.' },
  { valor: 'agresivo', titulo: 'Agresivo', detalle: 'Más rápido, pero exige más disciplina y más hambre.' },
]

export function PasoRitmo({ b, set }: PropsPaso) {
  return (
    <Pantalla
      titulo="¿A qué ritmo quieres avanzar?"
      ayuda="El ritmo no es solo una preferencia: cuanta menos grasa tengas de partida, menos margen hay para ir rápido sin perder músculo. Ajustaremos el número final a un rango seguro para tu caso."
    >
      <div className="opciones">
        {RITMOS.map(({ valor, titulo, detalle }) => (
          <Opcion
            key={valor}
            nombre="ritmo"
            titulo={titulo}
            detalle={detalle}
            seleccionada={b.ritmo === valor}
            onElegir={() => set({ ritmo: valor })}
          />
        ))}
      </div>
      <p className="nota">
        Ajustaremos el ritmo final a lo que sea seguro para tu caso; puede que apliquemos el más suave
        aunque elijas otro.
      </p>
    </Pantalla>
  )
}

export function PasoPesoObjetivo({ b, set, errores, marcados }: PropsPaso) {
  const altura = leerNumero(b.altura_cm)
  const objetivo = leerNumero(b.peso_objetivo)
  // Previsualización simple del IMC exigida por SPEC-ux §1 paso 12; el cálculo
  // real y cualquier corrección del peso objetivo los hace el motor.
  const imc = altura && objetivo ? objetivo / (altura / 100) ** 2 : null

  return (
    <Pantalla
      titulo="¿Tienes un peso objetivo en mente?"
      ayuda="Si no lo tienes claro, no pasa nada: te proponemos un peso saludable según tu altura y tu situación actual, y podrás cambiarlo cuando quieras."
    >
      <div className="opciones">
        <Opcion
          nombre="quiere-peso"
          titulo="Sí, quiero llegar a un peso concreto"
          seleccionada={b.quierePesoObjetivo === true}
          onElegir={() => set({ quierePesoObjetivo: true })}
        />
        <Opcion
          nombre="quiere-peso"
          titulo="No lo sé, proponédmelo vosotros"
          seleccionada={b.quierePesoObjetivo === false}
          onElegir={() => set({ quierePesoObjetivo: false, peso_objetivo: '' })}
        />
      </div>
      {b.quierePesoObjetivo ? (
        <div className="sub-bloque">
          <CampoNumero
            etiqueta="Peso al que quieres llegar"
            unidad="kg"
            autoFoco
            placeholder="Ej. 68"
            valor={b.peso_objetivo}
            onCambio={(peso_objetivo) => set({ peso_objetivo })}
            error={errores.peso_objetivo}
            max={300}
            marcado={estaMarcado(marcados, 'peso_objetivo')}
          />
          {imc !== null && !errores.peso_objetivo ? (
            <p className="nota nota-recuadro">
              Eso supondría un IMC aproximado de {numCorto(imc, 1)}.
              {imc < 18.5
                ? ' Es un IMC de bajo peso: en resultados te explicaremos por qué te proponemos ajustarlo.'
                : ''}
            </p>
          ) : null}
        </div>
      ) : null}
    </Pantalla>
  )
}

const BASES: { valor: PreferenciaBase; titulo: string; detalle: string }[] = [
  { valor: 'omnivoro', titulo: 'Como de todo', detalle: 'Sin restricciones: carne, pescado, huevos y lácteos.' },
  { valor: 'vegetariano', titulo: 'Vegetariano', detalle: 'Sin carne ni pescado; sí huevos y lácteos.' },
  { valor: 'vegano', titulo: 'Vegano', detalle: 'Sin ningún alimento de origen animal.' },
]

const RESTRICCIONES: { valor: Restriccion; titulo: string; detalle: string }[] = [
  { valor: 'sin_lactosa', titulo: 'Sin lactosa', detalle: 'Evito la leche y los lácteos con lactosa.' },
  { valor: 'sin_gluten', titulo: 'Sin gluten', detalle: 'Evito el trigo, la cebada y el centeno.' },
]

const COMIDAS: NComidas[] = [2, 3, 4, 5, 6]

export function PasoPreferencias({ b, set }: PropsPaso) {
  // Varias a la vez (v1.1, decisión E): antes había que renunciar a una para poder elegir la otra.
  const alternarRestriccion = (restriccion: Restriccion) =>
    set((previo) => ({
      restricciones: previo.restricciones.includes(restriccion)
        ? previo.restricciones.filter((r) => r !== restriccion)
        : [...previo.restricciones, restriccion],
    }))

  return (
    <Pantalla
      titulo="Cómo comes en tu día a día"
      ayuda="Salvo el interruptor de bajo en hidratos, nada de esto cambia tus calorías ni tus macros: solo los alimentos del menú de ejemplo y el número de comidas entre las que repartimos el día."
    >
      <Grupo
        etiqueta="¿Cómo comes?"
        descripcion="La base cambia los alimentos de tus menús. En vegano y vegetariano además subimos un poco la proteína total, porque las fuentes vegetales se aprovechan algo peor."
      >
        {BASES.map(({ valor, titulo, detalle }) => (
          <Opcion
            key={valor}
            nombre="preferencia-base"
            titulo={titulo}
            detalle={detalle}
            seleccionada={b.preferencia_base === valor}
            onElegir={() => set({ preferencia_base: valor })}
          />
        ))}
      </Grupo>

      <Grupo
        etiqueta="¿Evitas algo?"
        descripcion="Puedes marcar las dos. Solo cambian los alimentos que te proponemos: tus calorías y tus macros son exactamente los mismos."
      >
        {RESTRICCIONES.map(({ valor, titulo, detalle }) => (
          <Opcion
            key={valor}
            nombre={`restriccion-${valor}`}
            tipo="checkbox"
            titulo={titulo}
            detalle={detalle}
            seleccionada={b.restricciones.includes(valor)}
            onElegir={() => alternarRestriccion(valor)}
          />
        ))}
      </Grupo>

      {/* [SPEC] SPEC-ux §1 paso 13, 1c: título y descripción literales. Apagado por defecto. */}
      <Interruptor
        titulo="Bajo en hidratos"
        detalle="Menos pan, arroz y pasta; más grasa. Cambia de verdad tus macros, no solo el menú."
        activo={b.low_carb}
        onCambiar={(low_carb) => set({ low_carb })}
      />
      <p className="nota">
        Este sí cambia los números: te subimos la grasa al 45 % de las calorías y bajamos el mínimo de
        hidratos. Si tienes diabetes no lo aplicaremos y te lo explicaremos en el resultado.
      </p>

      <Grupo etiqueta="¿Cuántas comidas al día prefieres hacer?" fila>
        {COMIDAS.map((valor) => (
          <Opcion
            key={valor}
            nombre="n-comidas"
            compacta
            titulo={String(valor)}
            seleccionada={b.n_comidas === valor}
            onElegir={() => set({ n_comidas: valor })}
          />
        ))}
      </Grupo>
      <p className="nota nota-recuadro">
        No hay evidencia de que comer más o menos veces al día cambie tu metabolismo. Elige el número
        de comidas que mejor se adapte a tu rutina: lo único que cambia es cómo repartimos las mismas
        calorías y macros.
      </p>

      <Grupo
        etiqueta="¿Vives en una zona de clima caluroso o estamos en época de mucho calor?"
        descripcion="Con calor se suda más y hace falta algo más de agua al día."
        fila
      >
        <Opcion
          nombre="clima"
          compacta
          titulo="Sí"
          seleccionada={b.clima_caluroso}
          onElegir={() => set({ clima_caluroso: true })}
        />
        <Opcion
          nombre="clima"
          compacta
          titulo="No"
          seleccionada={!b.clima_caluroso}
          onElegir={() => set({ clima_caluroso: false })}
        />
      </Grupo>

      {/* [SPEC] SPEC-ux §3.7.1: título y descripción literales. Desactivado por defecto. */}
      <Interruptor
        titulo="¿Quieres comidas sencillas?"
        detalle="Menos alimentos distintos, comidas que se repiten y una compra fácil. Ideal si no quieres pensar."
        activo={b.menu_sencillo}
        onCambiar={(menu_sencillo) => set({ menu_sencillo })}
      />
      {b.menu_sencillo ? (
        <p className="nota nota-recuadro">
          Tu menú usará como mucho 12 alimentos distintos en toda la semana, con dos versiones de cada
          comida que se van alternando. Tus calorías y tus macros no cambian: solo cambia la variedad
          del menú y, con ella, la lista de la compra.
        </p>
      ) : null}
    </Pantalla>
  )
}
