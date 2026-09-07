// Pasos 6 y 7: porcentaje de grasa corporal (cuatro métodos) y somatotipo.

import type { CategoriaVisual, MetodoGrasa, Sexo, Somatotipo } from '../../../engine/types'
import { CampoNumero, Grupo, Opcion, OpcionAccion } from '../../ui/Controles'
import {
  IlustracionMedidas,
  SiluetaGrasa,
  TrioSomatotipos,
} from '../../graficos/Siluetas'
import { NOMBRE_SOMATOTIPO, RASGOS_CORTOS } from '../../utiles/copy'
import { somatotipoProvisional } from '../../utiles/somatotipo'
import { estaMarcado, metodoEfectivo, proteccionActiva } from '../borrador'
import { Pantalla, type PropsPaso } from './comun'

const METODOS: { valor: MetodoGrasa; titulo: string; detalle: string }[] = [
  {
    valor: 'conocido',
    titulo: 'Sí, lo sé',
    detalle: 'Tengo un número de una prueba, de una báscula de bioimpedancia o de una app.',
  },
  {
    valor: 'medidas',
    titulo: 'Puedo medirme con cinta métrica',
    detalle: 'Tengo una cinta métrica a mano y puedo medirme el cuello y la cintura ahora mismo.',
  },
  {
    valor: 'visual',
    titulo: 'No lo sé, ayúdame a estimarlo',
    detalle: 'Elegiré la silueta que más se parezca a mi cuerpo ahora mismo.',
  },
  {
    valor: 'desconocido',
    titulo: 'Prefiero que lo estiméis por mi altura y peso',
    detalle: 'Sin medirme ni elegir nada: usaremos tu altura, tu peso, tu edad y tu sexo.',
  },
]

const VISUAL_HOMBRE: { valor: CategoriaVisual; titulo: string; detalle: string }[] = [
  { valor: 'muy_definido', titulo: 'Muy definido', detalle: 'Abdominales muy marcados, venas visibles en brazos o abdomen' },
  { valor: 'definido', titulo: 'Definido', detalle: 'Abdominales visibles pero poco marcados, silueta atlética' },
  { valor: 'medio', titulo: 'Medio', detalle: 'Abdomen liso sin marcar, silueta normal' },
  { valor: 'sobrepeso_visible', titulo: 'Con sobrepeso visible', detalle: 'Acumulación abdominal visible, cintura por encima de la cadera' },
  { valor: 'obesidad_visible', titulo: 'Con obesidad visible', detalle: 'Acumulación de grasa evidente en abdomen, pecho y cara' },
]

const VISUAL_MUJER: { valor: CategoriaVisual; titulo: string; detalle: string }[] = [
  { valor: 'muy_definida', titulo: 'Muy definida', detalle: 'Definición muscular visible (no es el objetivo por defecto de la mayoría de mujeres, y no pasa nada si no es tu caso)' },
  { valor: 'tonificada', titulo: 'Tonificada', detalle: 'Silueta tonificada con algo de definición' },
  { valor: 'media', titulo: 'Media', detalle: 'Curvas normales sin marcación muscular' },
  { valor: 'sobrepeso_visible', titulo: 'Con sobrepeso visible', detalle: 'Acumulación de grasa visible en cadera, muslos y abdomen' },
  { valor: 'obesidad_visible', titulo: 'Con obesidad visible', detalle: 'Acumulación evidente y generalizada' },
]

function visualesDe(sexo: Sexo) {
  return sexo === 'mujer' ? VISUAL_MUJER : VISUAL_HOMBRE
}

export function PasoGrasa({ b, set, errores, marcados }: PropsPaso) {
  const sexo: Sexo = b.sexo ?? 'hombre'
  const protegido = proteccionActiva(b)
  const metodos = protegido ? METODOS.filter((m) => m.valor !== 'visual') : METODOS
  // Mismo criterio que la validación y que `aInputs`: con la protección activa el método visual
  // no existe, y no elegir ninguno equivale a `desconocido` (§1.2.6).
  const metodo = metodoEfectivo(b)
  const visualElegida = visualesDe(sexo).find((v) => v.valor === b.grasa.categoria)
  const visuales = visualesDe(sexo)

  return (
    <Pantalla
      titulo="¿Sabes tu porcentaje de grasa corporal?"
      intro="Ninguna fórmula sin aparato mide la grasa corporal con precisión absoluta: te daremos siempre un rango, no una cifra exacta. Cuanto mejor sea el dato de partida, más ajustado será tu plan."
    >
      <div className="opciones">
        {metodos.map(({ valor, titulo, detalle }) => (
          <Opcion
            key={valor}
            nombre="metodo-grasa"
            titulo={titulo}
            detalle={detalle}
            seleccionada={metodo === valor}
            onElegir={() => set((previo) => ({ grasa: { ...previo.grasa, metodo: valor } }))}
          />
        ))}
      </div>

      {metodo === 'conocido' ? (
        <div className="sub-bloque">
          <CampoNumero
            etiqueta="¿Qué porcentaje de grasa tienes?"
            unidad="%"
            placeholder="Ej. 22"
            valor={b.grasa.valor}
            onCambio={(valor) => set((previo) => ({ grasa: { ...previo.grasa, valor } }))}
            error={errores.valor}
            max={70}
            marcado={estaMarcado(marcados, 'grasa.valor')}
          />
          <Grupo etiqueta="¿Cómo lo has obtenido?">
            <Opcion
              nombre="fuente-grasa"
              titulo="Con una prueba profesional"
              detalle="DEXA, bioimpedancia de clínica o pliegues cutáneos hechos por un profesional."
              seleccionada={b.grasa.fuente === 'fiable'}
              onElegir={() => set((previo) => ({ grasa: { ...previo.grasa, fuente: 'fiable' } }))}
            />
            <Opcion
              nombre="fuente-grasa"
              titulo="Con una báscula de casa, una app o a ojo"
              detalle="Bioimpedancia doméstica, una aplicación del móvil o una estimación tuya."
              seleccionada={b.grasa.fuente === 'estimado'}
              onElegir={() => set((previo) => ({ grasa: { ...previo.grasa, fuente: 'estimado' } }))}
            />
          </Grupo>
          {b.grasa.fuente === 'fiable' ? (
            <p className="nota nota-recuadro">
              Perfecto: con un dato fiable podemos usar una fórmula más precisa para tu metabolismo
              basal (Katch-McArdle).
            </p>
          ) : null}
          {b.grasa.fuente === 'estimado' ? (
            <p className="nota nota-recuadro">
              Vale, lo usaremos igualmente, pero como estimación: las básculas domésticas pueden tener
              errores de varios puntos. Usaremos la fórmula estándar (Mifflin-St Jeor), que es más
              fiable cuando el porcentaje de grasa no es un dato de precisión clínica.
            </p>
          ) : null}
        </div>
      ) : null}

      {metodo === 'medidas' ? (
        <div className="sub-bloque">
          <IlustracionMedidas sexo={sexo} />
          <CampoNumero
            etiqueta="Cuello"
            unidad="cm"
            placeholder="Ej. 38"
            valor={b.grasa.cuello_cm}
            onCambio={(cuello_cm) => set((previo) => ({ grasa: { ...previo.grasa, cuello_cm } }))}
            error={errores.cuello_cm}
            max={60}
            marcado={estaMarcado(marcados, 'grasa.cuello_cm')}
            pista="Mide justo debajo de la laringe (la «nuez»), con la cinta ligeramente inclinada hacia abajo por delante."
          />
          <CampoNumero
            etiqueta="Cintura"
            unidad="cm"
            placeholder="Ej. 88"
            valor={b.grasa.cintura_cm}
            onCambio={(cintura_cm) => set((previo) => ({ grasa: { ...previo.grasa, cintura_cm } }))}
            error={errores.cintura_cm}
            max={200}
            marcado={estaMarcado(marcados, 'grasa.cintura_cm')}
            pista="Mide a la altura del ombligo, después de soltar el aire, sin apretar la cinta."
          />
          {sexo === 'mujer' ? (
            <CampoNumero
              etiqueta="Cadera"
              unidad="cm"
              placeholder="Ej. 100"
              valor={b.grasa.cadera_cm}
              onCambio={(cadera_cm) => set((previo) => ({ grasa: { ...previo.grasa, cadera_cm } }))}
              error={errores.cadera_cm}
              max={200}
              marcado={estaMarcado(marcados, 'grasa.cadera_cm')}
              pista="Mide en el punto de mayor anchura de las caderas y los glúteos."
            />
          ) : null}
        </div>
      ) : null}

      {metodo === 'visual' ? (
        <div className="sub-bloque">
          <Grupo etiqueta="Elige la silueta o descripción que más se parezca a tu cuerpo ahora mismo.">
            {visuales.map(({ valor, titulo, detalle }) => (
              <Opcion
                key={valor}
                nombre="categoria-visual"
                titulo={titulo}
                detalle={detalle}
                seleccionada={b.grasa.categoria === valor}
                onElegir={() => set((previo) => ({ grasa: { ...previo.grasa, categoria: valor } }))}
                ilustracion={<SiluetaGrasa sexo={sexo} categoria={valor} alto={128} />}
              />
            ))}
          </Grupo>
          {visualElegida ? (
            <p className="nota nota-recuadro">
              Has elegido «{visualElegida.titulo}»: lo traduciremos a un rango de grasa corporal, no a
              una cifra exacta.
            </p>
          ) : null}
          <p className="nota">
            Es normal dudar entre dos opciones: elige la que se parezca más. El margen de error de este
            método es de unos ±5 puntos, y te lo indicaremos siempre como rango.
          </p>
        </div>
      ) : null}

      {metodo === 'desconocido' ? (
        <p className="nota nota-recuadro">
          Vale, estimaremos tu grasa corporal solo con tu altura, peso, edad y sexo (fórmula CUN-BAE).
          Es la opción menos precisa, pero suficiente para empezar; siempre podrás afinarla más
          adelante.
        </p>
      ) : null}
    </Pantalla>
  )
}

const PREGUNTAS_SOMATOTIPO = [
  {
    clave: 'q1' as const,
    titulo: '¿Cómo describirías la estructura de tus muñecas y tobillos?',
    opciones: [
      { valor: 'fina' as const, titulo: 'Fina' },
      { valor: 'media' as const, titulo: 'Media' },
      { valor: 'ancha' as const, titulo: 'Ancha' },
    ],
  },
  {
    clave: 'q2' as const,
    titulo: '¿Con qué facilidad ganas grasa cuando comes de más?',
    opciones: [
      { valor: 'poca' as const, titulo: 'Poca facilidad' },
      { valor: 'moderada' as const, titulo: 'Facilidad moderada' },
      { valor: 'mucha' as const, titulo: 'Mucha facilidad' },
    ],
  },
  {
    clave: 'q3' as const,
    titulo: '¿Con qué facilidad ganas músculo cuando entrenas fuerza?',
    opciones: [
      { valor: 'poca' as const, titulo: 'Poca facilidad' },
      { valor: 'moderada' as const, titulo: 'Facilidad moderada' },
      { valor: 'mucha' as const, titulo: 'Mucha facilidad' },
    ],
  },
  {
    clave: 'q4' as const,
    titulo: 'Sin entrenar ni cuidar la alimentación, ¿cuál describe mejor tu apariencia habitual?',
    opciones: [
      { valor: 'delgado' as const, titulo: 'Delgado/a' },
      { valor: 'atletico' as const, titulo: 'Atlético/a' },
      { valor: 'robusto' as const, titulo: 'Robusto/a' },
    ],
  },
]

/**
 * Leyenda bajo las tres siluetas: nombre del somatotipo que corresponde a lo contestado hasta
 * ahora y sus rasgos en lenguaje llano. Sin respuestas, invita a contestar en vez de quedarse en
 * blanco. No muestra ningún número: el somatotipo solo desplaza hidratos y grasa (§3.2).
 */
function LeyendaSomatotipo({ tipo, completo }: { tipo: Somatotipo | null; completo: boolean }) {
  if (tipo === null) {
    return (
      <p className="nota leyenda-soma-vacia" aria-live="polite">
        Contesta y te iremos marcando con cuál de las tres encajas más.
      </p>
    )
  }
  return (
    <div className="leyenda-soma" aria-live="polite">
      <p className="leyenda-soma-titulo">
        <span className="leyenda-soma-etiqueta">
          {completo ? 'Encajas con' : 'De momento encajas con'}
        </span>
        <strong>{NOMBRE_SOMATOTIPO[tipo]}</strong>
      </p>
      <ul className="leyenda-soma-rasgos">
        {RASGOS_CORTOS[tipo].map((rasgo) => (
          <li key={rasgo}>{rasgo}</li>
        ))}
      </ul>
      {!completo ? (
        <p className="nota">Puede cambiar con las respuestas que te quedan.</p>
      ) : null}
    </div>
  )
}

export function PasoSomatotipo({ b, set }: PropsPaso) {
  const sexo: Sexo = b.sexo ?? 'hombre'
  const s = b.somatotipo
  const completo = Boolean(s.q1 && s.q2 && s.q3 && s.q4)
  const destacado = somatotipoProvisional(s)

  if (b.somatotipoElegido !== 'responder') {
    return (
      <Pantalla
        titulo="Esto es opcional, y no es una prescripción científica"
        ayuda="Lo preguntamos solo para ajustar el reparto entre hidratos y grasa a lo que te suele sentar mejor. No cambia ni tus calorías ni tu proteína, y puedes saltarlo sin perder nada."
        intro="El somatotipo (ectomorfo, mesomorfo, endomorfo) es una forma antigua de describir la silueta corporal. La ciencia actual no ha demostrado que sirva para calcular calorías o macros con precisión. Si lo rellenas, lo usaremos solo como un ajuste ligero entre carbohidratos y grasa, nunca para decidir cuántas calorías o cuánta proteína necesitas."
      >
        <TrioSomatotipos sexo={sexo} destacado={destacado} />
        {destacado ? <LeyendaSomatotipo tipo={destacado} completo={completo} /> : null}
        {/* Son dos acciones de navegación, no una respuesta: botones, no radios. */}
        <div className="opciones">
          <OpcionAccion
            titulo="Vale, son solo 4 preguntas"
            onElegir={() => set({ somatotipoElegido: 'responder' })}
          />
          <OpcionAccion
            titulo="Prefiero saltarlo"
            detalle="Tu plan se calcula igual; solo cambia un ajuste fino entre hidratos y grasa."
            onElegir={() => set({ somatotipoElegido: 'saltar', somatotipo: {} })}
          />
        </div>
      </Pantalla>
    )
  }

  return (
    <Pantalla
      titulo="Cuatro preguntas sobre tu constitución"
      intro="Según vayas contestando, resaltaremos la silueta con la que más encajas."
    >
      {/* Las siluetas y las preguntas van en el mismo bloque para que el trío pueda quedarse
          fijo (`position: sticky`) mientras se contesta: así se ve cambiar el resalte al pulsar
          la tercera o la cuarta respuesta, que caen fuera de la primera pantalla. */}
      <div className="soma-panel">
        <div className="bloque-siluetas">
          <TrioSomatotipos sexo={sexo} destacado={destacado} />
        </div>
        <LeyendaSomatotipo tipo={destacado} completo={completo} />
        {PREGUNTAS_SOMATOTIPO.map((pregunta) => (
          <Grupo key={pregunta.clave} etiqueta={pregunta.titulo} fila>
            {pregunta.opciones.map((opcion) => (
              <Opcion
                key={opcion.valor}
                nombre={`soma-${pregunta.clave}`}
                compacta
                titulo={opcion.titulo}
                seleccionada={s[pregunta.clave] === opcion.valor}
                onElegir={() =>
                  set((previo) => ({
                    somatotipo: { ...previo.somatotipo, [pregunta.clave]: opcion.valor },
                  }))
                }
              />
            ))}
          </Grupo>
        ))}
      </div>
      {completo ? (
        <p className="nota nota-recuadro">
          Listo. Lo usaremos solo como un ajuste ligero entre hidratos y grasa; en tus resultados verás
          cuál hemos aplicado y por qué.
        </p>
      ) : null}
      <button
        type="button"
        className="btn-plano"
        onClick={() => set({ somatotipoElegido: 'saltar', somatotipo: {} })}
      >
        Prefiero saltarlo
      </button>
    </Pantalla>
  )
}
