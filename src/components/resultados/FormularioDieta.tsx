// Formulario de "Cuéntanos cómo comes" (SPEC-dieta-propia §5.3).
//
// Aquí no se interpreta nada: el texto viaja a `src/dieta/api.ts` y lo que vuelve se le entrega
// al componente de arriba. El dictado lo hace el navegador (`src/dieta/dictado.ts`); la voz nunca
// pasa por nuestro servidor.

import { useEffect, useId, useRef, useState } from 'react'
import type { DietaInterpretada } from '../../engine/types'
import {
  ErrorApi,
  TEXTO_MAX,
  TEXTO_MIN,
  esCancelado,
  interpretarDieta,
  mensajeDeError,
} from '../../dieta/api'
import { cargarBorradorDieta, guardarBorradorDieta } from '../../dieta/almacen'
import { textoAnadido, useDictado, type VentanaDictado } from '../../dieta/dictado'
import { Cargador, IconoMicro } from '../ui/Iconos'

// ---- Copy literal (§5.3) -------------------------------------------------

/** [SPEC] §5.3, etiqueta del cuadro. */
const ETIQUETA = 'Cómo comes un día normal'
/** [SPEC] §5.3, texto de ejemplo del cuadro. */
const EJEMPLO =
  'Desayuno siempre 250 g de kéfir con 25 g de almendras. Al mediodía como de táper, pollo o pescado con arroz. Ceno ligero, sin hidratos. No me gusta el brócoli.'
/** [SPEC] §5.3, pista bajo el cuadro. */
const PISTA =
  'Puedes contarnos una sola comida o el día entero, con gramos si los sabes, y también lo que te gusta, lo que no y cómo prefieres cada comida. Lo que no nos digas lo proponemos nosotros. Si algo lo pesas en seco o en cocido, dilo, y no te olvides del aceite.'
/** [SPEC] §5.3, al abrir con un borrador guardado. */
const SEGUIMOS = 'Seguimos donde lo dejaste.'
/** [SPEC] §5.3, bajo el botón de micrófono. */
const VOZ_FUERA = 'Si prefieres que tu voz no salga del móvil, escríbelo.'
/** [SPEC] §5.3, sin Web Speech API (WebView de WhatsApp, Firefox…). */
const SIN_MICRO =
  'Aquí no podemos usar el micrófono. Si abres bascula.rsagents.es en Chrome o Safari (menú ⋮ → «Abrir en el navegador») podrás dictarlo en vez de escribirlo.'
/** [SPEC] §5.3, primera frase de la nota de privacidad; se omite sin dictado. */
const PRIVACIDAD_VOZ =
  'Al dictar, tu navegador usa el servicio de voz de Google (Chrome) o de Apple (Safari) para pasarlo a texto: eso no depende de nosotros.'
/** [SPEC] §5.3, resto de la nota de privacidad; siempre visible. */
const PRIVACIDAD =
  'Para entenderlo, el texto viaja a nuestro servidor y de ahí a Anthropic (Claude). Nosotros no lo guardamos ni lo registramos; Anthropic lo procesa para responder y, según su política de la API, no lo usa para entrenar sus modelos. En tu móvil sí se guarda, para que no tengas que repetirlo.'
/** [SPEC] §5.3, al pulsar "Montar mi menú con esto" sin nada que leer. */
const AVISO_CORTO =
  'Cuéntanos al menos una cosa: una comida con sus gramos, un alimento que no quieres ver o cómo prefieres cenar.'
/** [SPEC] §5.3, mientras se interpreta. */
const LEYENDO = 'Leyendo lo que nos cuentas…'
/** [SPEC] §5.3, a los 12 s. */
const TARDA = 'Seguimos leyendo; tarda un poco más de lo normal.'

/**
 * Miles separados por espacio, como en el copy de §5.3 ("{n} / 4 000"): `Intl` en español pone un
 * punto, y el contador quedaría "4.000" donde la spec pide "4 000".
 */
function conEspacios(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

/** Segundos que tarda en aparecer el mensaje de "tarda un poco más" (§5.3). */
const MS_TARDA = 12_000

/** Dirección que se copia con "Copiar el enlace" cuando no hay dictado (§5.3). */
const DIRECCION = 'https://bascula.rsagents.es'

// ---- Formulario -----------------------------------------------------------

interface Props {
  /** `resultado.comidas[].nombre`: lo único que viaja además del texto (§2.3). */
  comidasPlan: string[]
  token: string | null
  /** Texto de partida en "Editar lo que conté" (§5.4). Sin él se usa el borrador guardado. */
  textoInicial?: string
  onValidada: (texto: string, interpretada: DietaInterpretada) => void
  /** "Cancelar": pliega sin borrar; el foco vuelve al botón de la tarjeta. */
  onCancelar: () => void
  /** 503: la tarjeta vuelve al estado "no disponible" de §5.2. */
  onNoDisponible?: () => void
  /** Solo para los tests: en producción se usa `window`. */
  ventana?: VentanaDictado
}

/** Nombres de comida tal y como los acepta el contrato: 2–6, de 20 caracteres como mucho (§2.3). */
function nombresParaLaApi(comidas: string[]): string[] {
  return comidas
    .map((nombre) => nombre.trim().slice(0, 20))
    .filter((nombre) => nombre !== '')
    .slice(0, 6)
}

/** ¿El sistema pide que no animemos nada? Sin rueda, solo el texto (§5.3). */
function sinAnimacion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function FormularioDieta({
  comidasPlan,
  token,
  textoInicial,
  onValidada,
  onCancelar,
  onNoDisponible,
  ventana,
}: Props) {
  const guardado = useRef(textoInicial === undefined ? cargarBorradorDieta() : '')
  const [texto, setTexto] = useState(textoInicial ?? guardado.current)
  const [anadido, setAnadido] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [tarda, setTarda] = useState(false)
  const [copiado, setCopiado] = useState<'no' | 'si' | 'falla'>('no')
  const campo = useRef<HTMLTextAreaElement>(null)
  const peticion = useRef<AbortController | null>(null)
  const idCampo = useId()
  const idContador = `${idCampo}-contador`

  const dictado = useDictado({
    ventana,
    // Cada resultado FINAL se añade al cuadro con un espacio (§5.3); el provisional no entra.
    onFinal: (frase) => {
      setTexto((previo) => (previo.trim() === '' ? frase : `${previo.trim()} ${frase}`))
      setAnadido(textoAnadido(frase))
    },
  })

  // El foco entra en el cuadro al desplegarse el formulario (§5.2).
  useEffect(() => {
    campo.current?.focus()
  }, [])

  // Borrador con debounce de 500 ms (§5.3). No se guarda mientras se interpreta: si el usuario
  // cancela, el texto sigue en el cuadro igualmente.
  useEffect(() => {
    const temporizador = window.setTimeout(() => guardarBorradorDieta(texto), 500)
    return () => window.clearTimeout(temporizador)
  }, [texto])

  useEffect(() => () => peticion.current?.abort(), [])

  const largo = texto.trim().length
  const escuchando = dictado.estado === 'escuchando'
  const puede = largo >= TEXTO_MIN && largo <= TEXTO_MAX && !escuchando

  const cancelarPeticion = () => {
    peticion.current?.abort()
    peticion.current = null
  }

  const enviar = () => {
    if (enviando) return
    if (!puede) {
      setError(AVISO_CORTO)
      return
    }
    const control = new AbortController()
    peticion.current = control
    setError('')
    setTarda(false)
    setEnviando(true)
    const reloj = window.setTimeout(() => setTarda(true), MS_TARDA)
    void (async () => {
      try {
        const respuesta = await interpretarDieta(
          texto.trim(),
          nombresParaLaApi(comidasPlan),
          token,
          control.signal,
        )
        // El contrato devuelve `{ ...dieta, modelo }`: el campo extra se queda fuera de lo que se
        // guarda, para que lo almacenado sea un `DietaInterpretada` limpio (§2.3).
        const interpretada: DietaInterpretada = {
          comidas: respuesta.comidas ?? [],
          gustos: respuesta.gustos ?? [],
          habitos: respuesta.habitos ?? [],
          no_entendido: respuesta.no_entendido ?? [],
          notas: respuesta.notas ?? [],
          falta_aceite: respuesta.falta_aceite === true,
        }
        onValidada(texto.trim(), interpretada)
      } catch (fallo) {
        // Un 503 devuelve la tarjeta al estado "no disponible" de §5.2, no a un `role="alert"`.
        if (fallo instanceof ErrorApi && fallo.estado === 503 && onNoDisponible) {
          onNoDisponible()
          return
        }
        if (!esCancelado(fallo)) setError(mensajeDeError(fallo))
      } finally {
        window.clearTimeout(reloj)
        peticion.current = null
        setEnviando(false)
        setTarda(false)
      }
    })()
  }

  const copiarEnlace = () => {
    const direccion =
      typeof window !== 'undefined' && window.location?.origin ? window.location.origin : DIRECCION
    try {
      void navigator.clipboard
        .writeText(direccion)
        .then(() => setCopiado('si'))
        .catch(() => setCopiado('falla'))
    } catch {
      setCopiado('falla')
    }
  }

  const rueda = !sinAnimacion()

  return (
    <div className="dieta-formulario">
      {guardado.current !== '' && textoInicial === undefined ? (
        <p className="nota">{SEGUIMOS}</p>
      ) : null}

      <div className="dieta-campo">
        <label className="campo-etiqueta" htmlFor={idCampo}>
          {ETIQUETA}
        </label>
        <textarea
          id={idCampo}
          ref={campo}
          rows={6}
          value={texto}
          placeholder={EJEMPLO}
          aria-describedby={idContador}
          disabled={enviando}
          onChange={(evento) => {
            setTexto(evento.target.value)
            if (error !== '') setError('')
          }}
        />
        <p className="dieta-contador cifra" id={idContador}>
          {conEspacios(texto.length)} / {conEspacios(TEXTO_MAX)}
        </p>
      </div>

      <p className="dieta-pista">{PISTA}</p>

      {dictado.disponible ? (
        <>
          <div className="dieta-micro-fila">
            <button
              type="button"
              className="dieta-micro"
              aria-label="Dictar"
              aria-pressed={escuchando}
              disabled={enviando}
              onClick={dictado.alternar}
            >
              <IconoMicro tam={20} />
              <span aria-hidden="true">
                {escuchando ? 'Escuchando… toca para parar' : 'Dictar'}
              </span>
            </button>
            <span className="dieta-pista">{VOZ_FUERA}</span>
          </div>
          {/* El provisional se ve pero no se anuncia; el `role="status"` solo recoge lo final. */}
          <p className="dieta-provisional" aria-hidden="true">
            {dictado.provisional}
          </p>
          <p role="status" className="visualmente-oculto">
            {anadido}
          </p>
          {dictado.mensaje ? (
            <p role="alert" className="nota nota-recuadro">
              {dictado.mensaje}
            </p>
          ) : null}
        </>
      ) : (
        <div className="dieta-sin-micro">
          <p>{SIN_MICRO}</p>
          <p>
            <button type="button" className="btn-plano" onClick={copiarEnlace}>
              Copiar el enlace
            </button>
          </p>
          {/* Si el portapapeles falla (WebView sin permiso), la dirección queda seleccionable. */}
          {copiado === 'falla' ? (
            <p className="dieta-enlace-copiable">{DIRECCION}</p>
          ) : copiado === 'si' ? (
            <p className="nota" role="status">
              Enlace copiado.
            </p>
          ) : null}
        </div>
      )}

      <p className="dieta-privacidad">
        {dictado.disponible ? `${PRIVACIDAD_VOZ} ${PRIVACIDAD}` : PRIVACIDAD}
      </p>

      {error !== '' ? (
        <p role="alert" className="nota nota-recuadro">
          {error}
        </p>
      ) : null}

      {enviando && tarda ? (
        <p role="status" className="nota">
          {TARDA}
        </p>
      ) : null}

      <div className="acciones-menu">
        {/* Siempre operable: con menos de 10 caracteres no se deshabilita, se explica (§5.3). */}
        <button
          type="button"
          className="btn btn-principal"
          aria-disabled={!puede || enviando}
          aria-busy={enviando}
          onClick={enviar}
        >
          {enviando && rueda ? <Cargador /> : null}
          {enviando ? LEYENDO : 'Montar mi menú con esto'}
        </button>
        <button
          type="button"
          className="btn-plano"
          onClick={() => {
            if (enviando) cancelarPeticion()
            else onCancelar()
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
