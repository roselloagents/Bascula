// Máquina de estados del dictado (SPEC-dieta-propia §5.3) con un SpeechRecognition falso.
// Nada de jsdom: se prueba `crearDictado`, que es lo que el hook envuelve.

import { beforeEach, describe, expect, it } from 'vitest'
import {
  MAX_REANUDACIONES,
  MENSAJE_PARADA,
  MENSAJES_ERROR_VOZ,
  TOPE_ESCUCHA_MS,
  type EstadoDictado,
  type EventoResultadoVoz,
  type VentanaDictado,
  crearDictado,
  esIos,
  esWebViewSinMicro,
  hayDictado,
  mensajeDeErrorVoz,
  textoAnadido,
} from '../dictado'

// ---- SpeechRecognition falso ---------------------------------------------

class VozFalsa {
  static creadas: VozFalsa[] = []
  /** Excepción que lanzará el siguiente `start()` (para probar el navegador que se niega). */
  static fallaAlArrancar = 0

  lang = ''
  interimResults = false
  continuous = false
  onstart: (() => void) | null = null
  onend: (() => void) | null = null
  onerror: ((evento: { error: string }) => void) | null = null
  onresult: ((evento: EventoResultadoVoz) => void) | null = null
  arrancada = false
  parada = false
  abortada = false

  constructor() {
    VozFalsa.creadas.push(this)
  }

  start(): void {
    if (VozFalsa.fallaAlArrancar > 0) {
      VozFalsa.fallaAlArrancar -= 1
      throw new Error('InvalidStateError')
    }
    this.arrancada = true
    this.onstart?.()
  }

  stop(): void {
    this.parada = true
    this.onend?.()
  }

  abort(): void {
    this.abortada = true
  }

  /** Empuja resultados: `[texto, esFinal]`. */
  emitir(...trozos: [string, boolean][]): void {
    const resultados = trozos.map(([texto, isFinal]) => ({
      length: 1,
      isFinal,
      0: { transcript: texto },
    }))
    const results: Record<string, unknown> = { length: resultados.length }
    resultados.forEach((resultado, i) => {
      results[String(i)] = resultado
    })
    this.onresult?.({
      resultIndex: 0,
      results: results as unknown as EventoResultadoVoz['results'],
    })
  }

  fallar(codigo: string): void {
    this.onerror?.({ error: codigo })
    this.onend?.()
  }
}

function ventana(
  ua = 'Mozilla/5.0 (Linux; Android 14) Chrome/140 Mobile Safari/537.36',
): VentanaDictado {
  return {
    SpeechRecognition: VozFalsa as unknown as VentanaDictado['SpeechRecognition'],
    navigator: { userAgent: ua, maxTouchPoints: 5 },
  }
}

interface Espia {
  finales: string[]
  provisionales: string[]
  estados: EstadoDictado[]
  mensajes: (string | null)[]
}

function espiar(): Espia {
  return { finales: [], provisionales: [], estados: [], mensajes: [] }
}

function montar(opciones: { ventana?: VentanaDictado; ahora?: () => number } = {}) {
  const espia = espiar()
  const control = crearDictado({
    ventana: opciones.ventana ?? ventana(),
    ahora: opciones.ahora,
    onFinal: (t) => espia.finales.push(t),
    onProvisional: (t) => espia.provisionales.push(t),
    onEstado: (e) => espia.estados.push(e),
    onMensaje: (m) => espia.mensajes.push(m),
  })
  return { control, espia }
}

beforeEach(() => {
  VozFalsa.creadas = []
  VozFalsa.fallaAlArrancar = 0
})

// ---- Detección ------------------------------------------------------------

describe('detección inyectable', () => {
  it('hayDictado mira las dos formas del constructor', () => {
    expect(hayDictado(ventana())).toBe(true)
    expect(
      hayDictado({
        webkitSpeechRecognition: VozFalsa as unknown as VentanaDictado['SpeechRecognition'],
      }),
    ).toBe(true)
    expect(hayDictado({})).toBe(false)
  })

  it('esIos reconoce iPhone y el iPad que se hace pasar por Mac', () => {
    expect(esIos({ navigator: { userAgent: 'iPhone; CPU iPhone OS 18_0' } })).toBe(true)
    expect(
      esIos({ navigator: { userAgent: 'Macintosh; Intel Mac OS X', maxTouchPoints: 5 } }),
    ).toBe(true)
    expect(
      esIos({ navigator: { userAgent: 'Macintosh; Intel Mac OS X', maxTouchPoints: 0 } }),
    ).toBe(false)
  })

  it('esWebViewSinMicro solo salta sin dictado y dentro de otra aplicación', () => {
    const dentroDeWhatsApp = { navigator: { userAgent: 'Android 14; wv) Chrome/140 Mobile' } }
    expect(esWebViewSinMicro(dentroDeWhatsApp)).toBe(true)
    // Con dictado disponible no hay nada que aconsejar.
    expect(esWebViewSinMicro({ ...ventana(), ...dentroDeWhatsApp })).toBe(false)
    // Firefox de escritorio tampoco tiene Web Speech, pero no es una WebView.
    expect(esWebViewSinMicro({ navigator: { userAgent: 'Firefox/130.0' } })).toBe(false)
  })
})

// ---- Resultados -----------------------------------------------------------

describe('resultados (§5.3)', () => {
  it('solo lo final se añade; lo provisional va aparte', () => {
    const { control, espia } = montar()
    control.empezar()
    const voz = VozFalsa.creadas[0]
    expect(voz.lang).toBe('es-ES')
    expect(voz.interimResults).toBe(true)
    expect(voz.continuous).toBe(true)

    voz.emitir(['desayuno doscientos', false])
    expect(espia.finales).toEqual([])
    expect(espia.provisionales.at(-1)).toBe('desayuno doscientos')

    voz.emitir(['Desayuno 250 g de kéfir', true])
    expect(espia.finales).toEqual(['Desayuno 250 g de kéfir'])
    expect(espia.provisionales.at(-1)).toBe('')
  })

  it('varios finales en un mismo evento se entregan en orden', () => {
    const { control, espia } = montar()
    control.empezar()
    VozFalsa.creadas[0].emitir(['Uno.', true], ['Dos.', true], ['tres', false])
    expect(espia.finales).toEqual(['Uno.', 'Dos.'])
    expect(espia.provisionales.at(-1)).toBe('tres')
  })

  it('el resumen del role="status" corta a seis palabras', () => {
    expect(textoAnadido('  Desayuno 250 g de kéfir con chía y almendras ')).toBe(
      'Añadido: Desayuno 250 g de kéfir con…',
    )
    expect(textoAnadido('sin hidratos')).toBe('Añadido: sin hidratos')
  })
})

// ---- Estados y parada -----------------------------------------------------

describe('estados', () => {
  it('empezar deja "escuchando" y parar vuelve a "reposo"', () => {
    const { control, espia } = montar()
    expect(control.estado).toBe('reposo')
    control.empezar()
    expect(control.estado).toBe('escuchando')
    control.parar()
    expect(VozFalsa.creadas[0].parada).toBe(true)
    expect(control.estado).toBe('reposo')
    expect(espia.estados).toEqual(['escuchando', 'reposo'])
    // Una parada pedida no deja mensaje de error.
    expect(espia.mensajes.filter((m) => m !== null)).toEqual([])
  })

  it('alternar hace de interruptor', () => {
    const { control } = montar()
    control.alternar()
    expect(control.estado).toBe('escuchando')
    control.alternar()
    expect(control.estado).toBe('reposo')
  })

  it('sin Web Speech no hay control: `disponible` es false y empezar no hace nada', () => {
    const { control, espia } = montar({ ventana: { navigator: { userAgent: 'Firefox/130' } } })
    expect(control.disponible).toBe(false)
    control.empezar()
    expect(control.estado).toBe('reposo')
    expect(VozFalsa.creadas).toHaveLength(0)
    expect(espia.estados).toEqual([])
  })

  it('si el navegador se niega a arrancar se avisa y se queda en reposo', () => {
    VozFalsa.fallaAlArrancar = 1
    const { control, espia } = montar()
    control.empezar()
    expect(control.estado).toBe('reposo')
    expect(espia.mensajes.at(-1)).toBe(MENSAJE_PARADA)
  })

  it('destruir aborta el reconocimiento vivo', () => {
    const { control } = montar()
    control.empezar()
    control.destruir()
    expect(VozFalsa.creadas[0].abortada).toBe(true)
  })
})

// ---- Errores --------------------------------------------------------------

describe('errores de voz (§5.3, textos literales)', () => {
  it('cada código tiene su texto y "aborted" no dice nada', () => {
    for (const [codigo, texto] of Object.entries(MENSAJES_ERROR_VOZ)) {
      VozFalsa.creadas = []
      const { control, espia } = montar()
      control.empezar()
      VozFalsa.creadas[0].fallar(codigo)
      expect(espia.mensajes.at(-1)).toBe(texto)
      expect(control.estado).toBe('reposo')
    }
    expect(MENSAJES_ERROR_VOZ.aborted).toBeNull()
    expect(MENSAJES_ERROR_VOZ['not-allowed']).toBe(
      'El navegador no nos deja usar el micrófono. Puedes escribirlo.',
    )
  })

  it('un código desconocido cae en el texto de parada', () => {
    expect(mensajeDeErrorVoz('language-not-supported')).toBe(MENSAJE_PARADA)
  })

  it('tras un error no se reanuda', () => {
    const { control } = montar()
    control.empezar()
    VozFalsa.creadas[0].fallar('no-speech')
    expect(VozFalsa.creadas).toHaveLength(1)
    expect(control.estado).toBe('reposo')
  })
})

// ---- Reanudación ----------------------------------------------------------

describe('reanudación (§5.3)', () => {
  it('se reanuda hasta tres veces y luego para con su mensaje', () => {
    const { control, espia } = montar({ ahora: () => 0 })
    control.empezar()
    for (let i = 0; i <= MAX_REANUDACIONES; i += 1) {
      expect(VozFalsa.creadas).toHaveLength(i + 1)
      // `onend` sin error y con la intención intacta: el navegador se cansó, no el usuario.
      VozFalsa.creadas[i].onend?.()
    }
    expect(VozFalsa.creadas).toHaveLength(MAX_REANUDACIONES + 1)
    expect(control.estado).toBe('reposo')
    expect(espia.mensajes.at(-1)).toBe(MENSAJE_PARADA)
  })

  it('pasados 90 s no se reanuda aunque queden intentos', () => {
    let reloj = 0
    const { control, espia } = montar({ ahora: () => reloj })
    control.empezar()
    reloj = TOPE_ESCUCHA_MS + 1
    VozFalsa.creadas[0].onend?.()
    expect(VozFalsa.creadas).toHaveLength(1)
    expect(control.estado).toBe('reposo')
    expect(espia.mensajes.at(-1)).toBe(MENSAJE_PARADA)
  })

  it('en iOS no se reanuda nunca', () => {
    const { control, espia } = montar({
      ventana: {
        SpeechRecognition: VozFalsa as unknown as VentanaDictado['SpeechRecognition'],
        navigator: { userAgent: 'iPhone; CPU iPhone OS 18_0 like Mac OS X Safari/605' },
      },
      ahora: () => 0,
    })
    control.empezar()
    VozFalsa.creadas[0].onend?.()
    expect(VozFalsa.creadas).toHaveLength(1)
    expect(espia.mensajes.at(-1)).toBe(MENSAJE_PARADA)
  })

  it('el contador se pone a cero en cada sesión nueva', () => {
    const { control } = montar({ ahora: () => 0 })
    control.empezar()
    VozFalsa.creadas[0].onend?.()
    expect(VozFalsa.creadas).toHaveLength(2)
    control.parar()
    VozFalsa.creadas = []
    control.empezar()
    for (let i = 0; i <= MAX_REANUDACIONES; i += 1) VozFalsa.creadas[i].onend?.()
    expect(VozFalsa.creadas).toHaveLength(MAX_REANUDACIONES + 1)
  })
})
