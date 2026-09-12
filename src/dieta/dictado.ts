// Dictado del navegador (Web Speech API) para "Cuéntanos cómo comes" (SPEC-dieta-propia §5.3).
// La voz NUNCA pasa por nuestro servidor: la transcribe el propio navegador (Google en Chrome,
// Apple en Safari) y aquí solo se recoge el texto.
//
// `lib.dom` no trae los tipos de `SpeechRecognition`, así que se declaran los mínimos. La
// detección es inyectable (`ventana`) para poder probar la máquina de estados sin jsdom.

import { useCallback, useEffect, useRef, useState } from 'react'

// ---- Tipos ambientales mínimos de la Web Speech API ----------------------

export interface AlternativaVoz {
  transcript: string
  confidence?: number
}

export interface ResultadoVoz {
  readonly length: number
  readonly isFinal: boolean
  readonly [indice: number]: AlternativaVoz
}

export interface ListaResultadosVoz {
  readonly length: number
  readonly [indice: number]: ResultadoVoz
}

export interface EventoResultadoVoz {
  resultIndex: number
  results: ListaResultadosVoz
}

export interface EventoErrorVoz {
  error: string
  message?: string
}

export interface ReconocimientoVoz {
  lang: string
  interimResults: boolean
  continuous: boolean
  maxAlternatives?: number
  onstart: (() => void) | null
  onend: (() => void) | null
  onerror: ((evento: EventoErrorVoz) => void) | null
  onresult: ((evento: EventoResultadoVoz) => void) | null
  start(): void
  stop(): void
  abort(): void
}

export interface ConstructorVoz {
  new (): ReconocimientoVoz
}

/** Lo poco que este módulo necesita de `window`; inyectable en los tests. */
export interface VentanaDictado {
  SpeechRecognition?: ConstructorVoz
  webkitSpeechRecognition?: ConstructorVoz
  navigator?: { userAgent?: string; maxTouchPoints?: number; platform?: string }
}

// ---- Constantes y copy (§5.3, literal) -----------------------------------

export type EstadoDictado = 'reposo' | 'escuchando'

/** Reanudaciones automáticas tras un `onend` sin error. */
export const MAX_REANUDACIONES = 3
/** Tope total de una sesión de escucha, reanudaciones incluidas. */
export const TOPE_ESCUCHA_MS = 90_000
/** Palabras del resumen del `role="status"`. */
export const PALABRAS_RESUMEN = 6

/** [SPEC] §5.3: el dictado se paró solo (o no se pudo reanudar). */
export const MENSAJE_PARADA = 'Hemos parado al dejar de oírte. Toca otra vez para seguir.'

/**
 * [SPEC] §5.3, mapa completo de errores de voz. `null` = no se dice nada (`aborted` es una
 * parada pedida por el propio usuario). Un código que no esté aquí cae en `MENSAJE_PARADA`:
 * es el único texto normativo que invita a volver a intentarlo sin mentir sobre la causa.
 */
export const MENSAJES_ERROR_VOZ: Record<string, string | null> = {
  'not-allowed': 'El navegador no nos deja usar el micrófono. Puedes escribirlo.',
  'service-not-allowed':
    'Tu móvil tiene el dictado desactivado. Actívalo en Ajustes → General → Teclado → Activar Dictado, o escríbelo.',
  'no-speech': 'No hemos oído nada. Vuelve a intentarlo.',
  'audio-capture': 'No encontramos el micrófono. ¿Lo está usando otra aplicación?',
  network: 'El dictado necesita conexión. Puedes escribirlo.',
  aborted: null,
}

/** El texto que corresponde a un código de error de voz (§5.3). */
export function mensajeDeErrorVoz(codigo: string): string | null {
  if (codigo in MENSAJES_ERROR_VOZ) return MENSAJES_ERROR_VOZ[codigo]
  return MENSAJE_PARADA
}

/** [SPEC] §5.3, región `role="status"`: "Añadido: {primeras 6 palabras}…". */
export function textoAnadido(texto: string): string {
  const palabras = texto.trim().split(/\s+/).filter(Boolean)
  const primeras = palabras.slice(0, PALABRAS_RESUMEN).join(' ')
  return `Añadido: ${primeras}${palabras.length > PALABRAS_RESUMEN ? '…' : ''}`
}

// ---- Detección (inyectable) ----------------------------------------------

function ventanaPorDefecto(ventana?: VentanaDictado): VentanaDictado | undefined {
  if (ventana) return ventana
  return typeof window === 'undefined' ? undefined : (window as unknown as VentanaDictado)
}

function constructorDeVoz(ventana?: VentanaDictado): ConstructorVoz | null {
  const win = ventanaPorDefecto(ventana)
  return win?.SpeechRecognition ?? win?.webkitSpeechRecognition ?? null
}

/** ¿Hay Web Speech API? Sin ella no se pinta el botón de micrófono (§5.3). */
export function hayDictado(ventana?: VentanaDictado): boolean {
  return constructorDeVoz(ventana) !== null
}

function agente(ventana?: VentanaDictado): string {
  return ventanaPorDefecto(ventana)?.navigator?.userAgent ?? ''
}

/**
 * iOS (o iPadOS, que se anuncia como Mac con pantalla táctil). Allí el reconocimiento termina
 * por sí solo tras cada frase y reiniciarlo fuera de un gesto no funciona: no se reanuda (§5.3).
 */
export function esIos(ventana?: VentanaDictado): boolean {
  const ua = agente(ventana)
  if (/iPhone|iPad|iPod/i.test(ua)) return true
  const toques = ventanaPorDefecto(ventana)?.navigator?.maxTouchPoints ?? 0
  return /Macintosh/i.test(ua) && toques > 1
}

/** Navegadores incrustados en otra aplicación (WhatsApp, Instagram, Facebook, Line…). */
const PATRONES_WEBVIEW =
  /;\s*wv\b|\bwv\)|FBAN|FBAV|FB_IAB|FBIOS|Instagram|Line\/|MicroMessenger|Snapchat|TikTok|Twitter/i

/**
 * "Aquí no podemos usar el micrófono" **y además** estamos dentro de una aplicación: solo en ese
 * caso tiene sentido el consejo del menú ⋮ → «Abrir en el navegador» (§5.3). La nota se pinta
 * siempre que no haya dictado; esto decide si se acompaña de ese consejo.
 */
export function esWebViewSinMicro(ventana?: VentanaDictado): boolean {
  if (hayDictado(ventana)) return false
  const ua = agente(ventana)
  if (ua === '') return false
  if (PATRONES_WEBVIEW.test(ua)) return true
  // WKWebView de iOS: sin el testigo "Safari/" no es el navegador, es una aplicación.
  return /iPhone|iPad|iPod/i.test(ua) && !/Safari\//i.test(ua)
}

// ---- Máquina de estados (sin React, para poder probarla) -----------------

export interface OpcionesDictado {
  /** Cada resultado FINAL, ya recortado. El componente lo añade al cuadro con un espacio. */
  onFinal: (texto: string) => void
  onEstado?: (estado: EstadoDictado) => void
  /** Texto provisional: se pinta aparte y NO entra en el cuadro (§5.3). */
  onProvisional?: (texto: string) => void
  /** Mensaje de error o de parada; `null` lo borra. */
  onMensaje?: (mensaje: string | null) => void
  ventana?: VentanaDictado
  /** Reloj inyectable para el tope de 90 s. */
  ahora?: () => number
}

export interface ControlDictado {
  readonly disponible: boolean
  readonly estado: EstadoDictado
  /** Debe llamarse **dentro del gesto** del usuario: `start()` es síncrono. */
  empezar: () => void
  parar: () => void
  alternar: () => void
  destruir: () => void
}

export function crearDictado(opciones: OpcionesDictado): ControlDictado {
  const Reconocimiento = constructorDeVoz(opciones.ventana)
  const ahora = opciones.ahora ?? Date.now
  const iosSinReanudar = esIos(opciones.ventana)

  let reconocimiento: ReconocimientoVoz | null = null
  let estado: EstadoDictado = 'reposo'
  /** Lo que quiere el usuario, que no siempre es lo que hace el navegador. */
  let intencion: EstadoDictado = 'reposo'
  let reanudaciones = 0
  let comienzo = 0
  let huboError = false

  function cambiarEstado(nuevo: EstadoDictado): void {
    if (estado === nuevo) return
    estado = nuevo
    opciones.onEstado?.(nuevo)
  }

  function soltar(): void {
    if (reconocimiento === null) return
    reconocimiento.onstart = null
    reconocimiento.onend = null
    reconocimiento.onerror = null
    reconocimiento.onresult = null
    reconocimiento = null
  }

  function alResultado(evento: EventoResultadoVoz): void {
    const finales: string[] = []
    let provisional = ''
    for (let i = evento.resultIndex; i < evento.results.length; i += 1) {
      const resultado = evento.results[i]
      if (!resultado) continue
      const texto = (resultado[0]?.transcript ?? '').trim()
      if (texto === '') continue
      if (resultado.isFinal) finales.push(texto)
      else provisional = provisional === '' ? texto : `${provisional} ${texto}`
    }
    opciones.onProvisional?.(provisional)
    for (const texto of finales) opciones.onFinal(texto)
  }

  function alError(evento: EventoErrorVoz): void {
    huboError = true
    intencion = 'reposo'
    opciones.onMensaje?.(mensajeDeErrorVoz(evento.error))
  }

  function alFin(): void {
    soltar()
    if (intencion === 'escuchando' && !huboError) {
      const dentroDeTiempo = ahora() - comienzo < TOPE_ESCUCHA_MS
      if (!iosSinReanudar && reanudaciones < MAX_REANUDACIONES && dentroDeTiempo) {
        reanudaciones += 1
        if (arrancar()) return
      }
      intencion = 'reposo'
      opciones.onMensaje?.(MENSAJE_PARADA)
    }
    opciones.onProvisional?.('')
    cambiarEstado('reposo')
  }

  /** Crea y arranca un reconocimiento nuevo. `false` si el navegador se negó. */
  function arrancar(): boolean {
    if (Reconocimiento === null) return false
    const rec = new Reconocimiento()
    rec.lang = 'es-ES'
    rec.interimResults = true
    rec.continuous = true
    rec.onstart = () => cambiarEstado('escuchando')
    rec.onresult = alResultado
    rec.onerror = alError
    rec.onend = alFin
    reconocimiento = rec
    try {
      rec.start()
    } catch {
      soltar()
      return false
    }
    return true
  }

  function empezar(): void {
    if (Reconocimiento === null || intencion === 'escuchando') return
    intencion = 'escuchando'
    reanudaciones = 0
    comienzo = ahora()
    huboError = false
    opciones.onMensaje?.(null)
    opciones.onProvisional?.('')
    if (!arrancar()) {
      intencion = 'reposo'
      cambiarEstado('reposo')
      opciones.onMensaje?.(MENSAJE_PARADA)
      return
    }
    // `onstart` puede tardar; el botón tiene que responder al toque igualmente.
    cambiarEstado('escuchando')
  }

  function parar(): void {
    intencion = 'reposo'
    if (reconocimiento === null) {
      cambiarEstado('reposo')
      return
    }
    try {
      reconocimiento.stop()
    } catch {
      soltar()
      cambiarEstado('reposo')
    }
  }

  function destruir(): void {
    intencion = 'reposo'
    const rec = reconocimiento
    soltar()
    try {
      rec?.abort()
    } catch {
      // El reconocimiento ya estaba muerto.
    }
    estado = 'reposo'
  }

  return {
    disponible: Reconocimiento !== null,
    get estado() {
      return estado
    },
    empezar,
    parar,
    alternar: () => (estado === 'escuchando' ? parar() : empezar()),
    destruir,
  }
}

// ---- Hook -----------------------------------------------------------------

export interface OpcionesUseDictado {
  onFinal: (texto: string) => void
  onEstado?: (estado: EstadoDictado) => void
  /** Solo para los tests: en producción se usa `window`. */
  ventana?: VentanaDictado
}

export interface UsoDictado {
  /** Hay Web Speech API: sin esto no se pinta el botón de micrófono. */
  disponible: boolean
  estado: EstadoDictado
  /** Texto provisional, para la línea `aria-hidden` de debajo del botón. */
  provisional: string
  /** Mensaje del `role="alert"`; `null` cuando no hay nada que decir. */
  mensaje: string | null
  /** Pulsación del botón: empieza o para. Debe estar dentro del gesto. */
  alternar: () => void
  parar: () => void
  limpiarMensaje: () => void
}

/** El dictado de §5.3 con su máquina de estados, listo para el botón de micrófono. */
export function useDictado(opciones: OpcionesUseDictado): UsoDictado {
  const [estado, setEstado] = useState<EstadoDictado>('reposo')
  const [provisional, setProvisional] = useState('')
  const [mensaje, setMensaje] = useState<string | null>(null)
  const control = useRef<ControlDictado | null>(null)
  const ultimas = useRef(opciones)
  const { ventana } = opciones

  useEffect(() => {
    ultimas.current = opciones
  })

  useEffect(() => {
    const creado = crearDictado({
      ventana,
      onFinal: (texto) => ultimas.current.onFinal(texto),
      onEstado: (nuevo) => {
        setEstado(nuevo)
        ultimas.current.onEstado?.(nuevo)
      },
      onProvisional: setProvisional,
      onMensaje: setMensaje,
    })
    control.current = creado
    return () => {
      creado.destruir()
      control.current = null
    }
  }, [ventana])

  const alternar = useCallback(() => control.current?.alternar(), [])
  const parar = useCallback(() => control.current?.parar(), [])
  const limpiarMensaje = useCallback(() => setMensaje(null), [])

  return {
    disponible: hayDictado(ventana),
    estado,
    provisional,
    mensaje,
    alternar,
    parar,
    limpiarMensaje,
  }
}
