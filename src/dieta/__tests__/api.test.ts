// Cliente de `/api/*` (SPEC-dieta-propia §2.2, §2.3 y §5.3) con un `fetch` falso: ninguna
// prueba toca la red ni la API de Anthropic.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ERROR_CUOTA,
  ERROR_GENERICO,
  ERROR_NO_DISPONIBLE,
  ERROR_RED,
  ERROR_SIN_CONTENIDO,
  ERROR_TEXTO,
  ERROR_TIEMPO,
  ErrorApi,
  capacidades,
  esCancelado,
  interpretarDieta,
  mensajeDeError,
} from '../api'

// ---- Reloj falso ----------------------------------------------------------
// Los temporizadores por debajo del umbral disparan en el siguiente microtick (la espera de 3 s
// del reintento de capacidades); los de por encima no disparan nunca (el tope de 75 s). Subiendo
// el umbral se prueba justo lo contrario.
let umbralMs = 5_000
let siguienteId = 1
const cancelados = new Set<number>()

vi.stubGlobal('window', {
  setTimeout: (fn: () => void, ms = 0) => {
    const id = siguienteId
    siguienteId += 1
    if (ms <= umbralMs) {
      queueMicrotask(() => {
        if (!cancelados.has(id)) fn()
      })
    }
    return id
  },
  clearTimeout: (id: number) => void cancelados.add(id),
})

const falsoFetch = vi.fn()
vi.stubGlobal('fetch', falsoFetch)

function respuesta(estado: number, cuerpo: unknown): Response {
  return {
    ok: estado >= 200 && estado < 300,
    status: estado,
    json: async () => cuerpo,
  } as unknown as Response
}

function errorApi(codigo: string): unknown {
  return { error: { codigo, mensaje: 'da igual' } }
}

const DIETA = {
  comidas: [{ nombre: 'Desayuno', alimentos: [] }],
  gustos: [],
  habitos: [],
  no_entendido: [],
  notas: [],
  falta_aceite: false,
  modelo: 'claude-sonnet-5',
}

beforeEach(() => {
  falsoFetch.mockReset()
  cancelados.clear()
  umbralMs = 5_000
})

afterEach(() => {
  umbralMs = 5_000
})

/** Corre `interpretarDieta` y devuelve el error que lanza. */
async function fallo(...args: Parameters<typeof interpretarDieta>): Promise<ErrorApi> {
  try {
    await interpretarDieta(...args)
  } catch (e) {
    return e as ErrorApi
  }
  throw new Error('esperábamos un error')
}

describe('capacidades (§2.2)', () => {
  it('lee interpretar, modelo y token', async () => {
    falsoFetch.mockResolvedValue(
      respuesta(200, { interpretar: true, modelo: 'claude-sonnet-5', token: 'abc' }),
    )
    expect(await capacidades()).toEqual({
      interpretar: true,
      modelo: 'claude-sonnet-5',
      token: 'abc',
    })
    expect(falsoFetch).toHaveBeenCalledTimes(1)
    expect(falsoFetch.mock.calls[0][0]).toBe('/api/capacidades')
  })

  it('reintenta UNA vez ante 429 y se queda con la segunda respuesta', async () => {
    falsoFetch
      .mockResolvedValueOnce(respuesta(429, errorApi('LIMITE')))
      .mockResolvedValueOnce(respuesta(200, { interpretar: true, modelo: 'm', token: 't' }))
    const salida = await capacidades()
    expect(falsoFetch).toHaveBeenCalledTimes(2)
    expect(salida.interpretar).toBe(true)
    expect(salida.token).toBe('t')
  })

  it('con dos 429 se rinde: no hay tercer intento y queda "no disponible"', async () => {
    falsoFetch.mockResolvedValue(respuesta(429, errorApi('LIMITE')))
    const salida = await capacidades()
    expect(falsoFetch).toHaveBeenCalledTimes(2)
    expect(salida).toEqual({ interpretar: false, modelo: null, token: null })
  })

  it('ante 503 o fallo de red devuelve interpretar: false sin lanzar', async () => {
    falsoFetch.mockResolvedValueOnce(respuesta(503, errorApi('SIN_CLAVE')))
    expect((await capacidades()).interpretar).toBe(false)
    falsoFetch.mockRejectedValueOnce(new TypeError('failed to fetch'))
    expect((await capacidades()).interpretar).toBe(false)
  })

  it('un cuerpo con basura no se cuela como token', async () => {
    falsoFetch.mockResolvedValue(respuesta(200, { interpretar: 'sí', modelo: 7, token: '' }))
    expect(await capacidades()).toEqual({ interpretar: false, modelo: null, token: null })
  })
})

describe('interpretarDieta (§2.3)', () => {
  it('manda texto, comidas y el token, y devuelve la dieta', async () => {
    falsoFetch.mockResolvedValue(respuesta(200, DIETA))
    const salida = await interpretarDieta('Desayuno 250 g de kéfir', ['Desayuno', 'Cena'], 'tok')
    expect(salida.modelo).toBe('claude-sonnet-5')
    const [url, init] = falsoFetch.mock.calls[0]
    expect(url).toBe('/api/dieta/interpretar')
    expect(init.method).toBe('POST')
    expect(init.headers['X-Bascula-Token']).toBe('tok')
    expect(JSON.parse(init.body)).toEqual({
      texto: 'Desayuno 250 g de kéfir',
      comidas_plan: ['Desayuno', 'Cena'],
    })
  })

  it('cada código de la §5.3 tiene su texto', async () => {
    const casos: [number, string, string][] = [
      [400, 'TEXTO_INVALIDO', ERROR_TEXTO],
      [422, 'SIN_CONTENIDO', ERROR_SIN_CONTENIDO],
      [429, 'CUOTA_IP', ERROR_CUOTA],
      [503, 'SIN_CLAVE', ERROR_NO_DISPONIBLE],
      [504, 'TIEMPO_AGOTADO', ERROR_TIEMPO],
      [502, 'MODELO_NO_DISPONIBLE', ERROR_GENERICO],
      [403, 'ORIGEN_NO_ADMITIDO', ERROR_GENERICO],
    ]
    for (const [estado, codigo, texto] of casos) {
      falsoFetch.mockReset()
      falsoFetch.mockResolvedValue(respuesta(estado, errorApi(codigo)))
      const e = await fallo('texto largo de verdad', ['Comida'], 'tok')
      expect(e.estado).toBe(estado)
      expect(e.codigo).toBe(codigo)
      expect(mensajeDeError(e)).toBe(texto)
    }
  })

  it('ante 401 pide otro token y reintenta una vez', async () => {
    falsoFetch
      .mockResolvedValueOnce(respuesta(401, errorApi('TOKEN_INVALIDO')))
      .mockResolvedValueOnce(respuesta(200, { interpretar: true, modelo: 'm', token: 'nuevo' }))
      .mockResolvedValueOnce(respuesta(200, DIETA))
    const salida = await interpretarDieta('texto largo de verdad', ['Comida'], 'viejo')
    expect(salida.modelo).toBe('claude-sonnet-5')
    expect(falsoFetch).toHaveBeenCalledTimes(3)
    expect(falsoFetch.mock.calls[1][0]).toBe('/api/capacidades')
    expect(falsoFetch.mock.calls[2][1].headers['X-Bascula-Token']).toBe('nuevo')
  })

  it('si el 401 se repite, el error sube y el texto es el genérico', async () => {
    falsoFetch
      .mockResolvedValueOnce(respuesta(401, errorApi('TOKEN_INVALIDO')))
      .mockResolvedValueOnce(respuesta(200, { interpretar: true, modelo: 'm', token: 'nuevo' }))
      .mockResolvedValueOnce(respuesta(401, errorApi('TOKEN_INVALIDO')))
    const e = await fallo('texto largo de verdad', ['Comida'], 'viejo')
    expect(falsoFetch).toHaveBeenCalledTimes(3)
    expect(e.estado).toBe(401)
    expect(mensajeDeError(e)).toBe(ERROR_GENERICO)
  })

  it('sin token nuevo no hay segundo intento', async () => {
    falsoFetch
      .mockResolvedValueOnce(respuesta(401, errorApi('TOKEN_INVALIDO')))
      .mockResolvedValueOnce(respuesta(503, errorApi('SIN_CLAVE')))
    const e = await fallo('texto largo de verdad', ['Comida'], 'viejo')
    expect(falsoFetch).toHaveBeenCalledTimes(2)
    expect(e.estado).toBe(401)
  })

  it('un fallo de red da el texto de conexión', async () => {
    falsoFetch.mockRejectedValue(new TypeError('failed to fetch'))
    const e = await fallo('texto largo de verdad', ['Comida'], 'tok')
    expect(e.estado).toBe(0)
    expect(mensajeDeError(e)).toBe(ERROR_RED)
  })

  it('"Cancelar" aborta y no enseña ningún mensaje', async () => {
    const control = new AbortController()
    falsoFetch.mockImplementation(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_, rechazar) => {
          init.signal.addEventListener('abort', () => {
            const error = new Error('abortado')
            error.name = 'AbortError'
            rechazar(error)
          })
        }),
    )
    const promesa = fallo('texto largo de verdad', ['Comida'], 'tok', control.signal)
    control.abort()
    const e = await promesa
    expect(esCancelado(e)).toBe(true)
    expect(mensajeDeError(e)).toBe('')
  })

  it('el tope de 75 s corta con el texto de "hemos tardado demasiado"', async () => {
    umbralMs = 200_000 // ahora el temporizador del tope sí dispara
    falsoFetch.mockImplementation(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_, rechazar) => {
          init.signal.addEventListener('abort', () => {
            const error = new Error('abortado')
            error.name = 'AbortError'
            rechazar(error)
          })
        }),
    )
    const e = await fallo('texto largo de verdad', ['Comida'], 'tok')
    expect(e.codigo).toBe('TIEMPO_AGOTADO')
    expect(mensajeDeError(e)).toBe(ERROR_TIEMPO)
  })
})

describe('mensajeDeError', () => {
  it('lo que no es un ErrorApi cae en el genérico', () => {
    expect(mensajeDeError(new Error('vaya'))).toBe(ERROR_GENERICO)
    expect(mensajeDeError(null)).toBe(ERROR_GENERICO)
  })

  it('un 200 con JSON roto se cuenta como fallo de red', async () => {
    falsoFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('json roto')
      },
    } as unknown as Response)
    const e = await fallo('texto largo de verdad', ['Comida'], 'tok')
    expect(mensajeDeError(e)).toBe(ERROR_RED)
  })
})
