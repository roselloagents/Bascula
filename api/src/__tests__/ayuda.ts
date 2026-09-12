// Utilidades compartidas por los tests del servicio: cliente del modelo FALSO (ningún test toca la
// red), servidor efímero en un puerto libre y constructores de salidas del modelo.
import type { AddressInfo } from 'node:net'
import type { SalidaModelo } from '../esquema.ts'
import type {
  ClienteModelo,
  OpcionesLlamada,
  ParametrosLlamada,
  RespuestaModelo,
} from '../interpretar.ts'
import { crearLimites } from '../limites.ts'
import type { Limites } from '../limites.ts'
import { crearServidor } from '../servidor.ts'
import type { OpcionesServidor } from '../servidor.ts'
import { crearToken } from '../token.ts'

export const SECRETO = 'secreto-de-pruebas'
export const ORIGEN = 'http://localhost:5173'
export const IP = '203.0.113.9'

export interface Llamada {
  parametros: ParametrosLlamada
  opciones: OpcionesLlamada | undefined
}

export interface ClienteFalso {
  cliente: ClienteModelo
  llamadas: Llamada[]
}

/** Devuelve (o lanza) las respuestas preparadas, una por llamada, en orden. */
export function clienteFalso(guion: (RespuestaModelo | Error)[]): ClienteFalso {
  const llamadas: Llamada[] = []
  const cliente: ClienteModelo = {
    messages: {
      parse(parametros, opciones) {
        llamadas.push({ parametros, opciones })
        const siguiente = guion[llamadas.length - 1]
        if (siguiente === undefined) return Promise.reject(new Error('sin respuesta preparada'))
        if (siguiente instanceof Error) return Promise.reject(siguiente)
        return Promise.resolve(siguiente)
      },
    },
  }
  return { cliente, llamadas }
}

/** Cliente que no contesta nunca: solo termina si alguien aborta su señal. */
export function clienteQueEspera(): ClienteFalso {
  const llamadas: Llamada[] = []
  const cliente: ClienteModelo = {
    messages: {
      parse(parametros, opciones) {
        llamadas.push({ parametros, opciones })
        return new Promise<RespuestaModelo>((_, rechazar) => {
          const senal = opciones?.signal
          if (senal === undefined) return
          if (senal.aborted) rechazar(errorDeAborto())
          senal.addEventListener('abort', () => rechazar(errorDeAborto()))
        })
      },
    },
  }
  return { cliente, llamadas }
}

function errorDeAborto(): Error {
  const error = new Error('This operation was aborted')
  error.name = 'AbortError'
  return error
}

/** El error que lanza el SDK cuando la salida no valida contra el esquema de zod. */
export function errorDeFormato(detalle = 'comidas: Required'): Error {
  return new Error(`Failed to parse structured output: ZodError: ${detalle}`)
}

export function respuesta(parcial: Partial<RespuestaModelo> = {}): RespuestaModelo {
  return {
    stop_reason: 'end_turn',
    usage: { input_tokens: 4500, output_tokens: 900 },
    parsed_output: salida(),
    ...parcial,
  }
}

export function salida(parcial: Partial<SalidaModelo> = {}): SalidaModelo {
  return {
    comidas: [],
    gustos: [],
    habitos: [],
    no_entendido: [],
    notas: [],
    falta_aceite: false,
    ...parcial,
  }
}

export function alimento(parcial: Partial<SalidaModelo['comidas'][0]['alimentos'][0]> = {}) {
  return {
    texto: '250 g de kéfir',
    nombre: 'Kéfir natural',
    alimento_id: null,
    estado: 'listo' as const,
    grupo_aprox: 'lacteo' as const,
    gramos: 250,
    unidad: null,
    cantidad_unidades: null,
    macros_100g: { kcal: 62, prot: 3.3, carb: 4.5, fat: 3.3, fibra: 0, alcohol: 0 },
    origen_macros: 'estimado' as const,
    ajustable: true,
    confianza: 'media' as const,
    nota: null,
    ...parcial,
  }
}

export interface Banco {
  url: string
  cerrar: () => Promise<void>
  limites: Limites
  registros: string[]
}

/** Arranca el servidor en un puerto libre con límites en memoria (nada se escribe en disco). */
export async function arrancarBanco(opciones: OpcionesServidor = {}): Promise<Banco> {
  const registros: string[] = []
  const config = {
    clave: 'clave-de-pruebas',
    secreto: SECRETO,
    origenes: [ORIGEN],
    datos: '.',
    ...opciones.config,
  }
  const limites =
    opciones.limites ??
    crearLimites({
      carpeta: '.',
      topeIpDia: config.topeIpDia ?? 40,
      topeGlobalDia: config.topeGlobalDia ?? 400,
      topeEurosDia: config.topeEurosDia ?? 4,
      ahora: opciones.ahora,
      persistir: false,
    })
  const servidor = crearServidor({
    ...opciones,
    config,
    limites,
    registrar: (linea) => registros.push(linea),
  })
  await new Promise<void>((listo) => servidor.listen(0, '127.0.0.1', listo))
  const { port } = servidor.address() as AddressInfo
  return {
    url: `http://127.0.0.1:${port}`,
    limites,
    registros,
    cerrar: () =>
      new Promise<void>((listo) => {
        servidor.closeAllConnections()
        servidor.close(() => listo())
      }),
  }
}

export interface OpcionesPeticion {
  ip?: string
  origen?: string | null
  token?: string | null
  cuerpo?: unknown
  cuerpoCrudo?: string
  tipo?: string | null
  metodo?: string
  ahora?: number
  senal?: AbortSignal
}

export async function pedirInterpretar(
  banco: Banco,
  opciones: OpcionesPeticion = {},
): Promise<Response> {
  const ip = opciones.ip ?? IP
  const cabeceras: Record<string, string> = { 'x-real-ip': ip }
  if (opciones.tipo !== null) cabeceras['content-type'] = opciones.tipo ?? 'application/json'
  if (opciones.origen !== null) cabeceras['origin'] = opciones.origen ?? ORIGEN
  const token =
    opciones.token === null
      ? null
      : (opciones.token ?? crearToken(SECRETO, ip, opciones.ahora ?? Date.now()))
  if (token !== null) cabeceras['x-bascula-token'] = token
  const cuerpo =
    opciones.cuerpoCrudo ??
    JSON.stringify(
      opciones.cuerpo ?? {
        texto: 'Desayuno siempre 250 g de kéfir con 25 g de almendras.',
        comidas_plan: ['Desayuno', 'Comida', 'Cena'],
      },
    )
  return fetch(`${banco.url}/api/dieta/interpretar`, {
    method: opciones.metodo ?? 'POST',
    headers: cabeceras,
    body: cuerpo,
    signal: opciones.senal,
  })
}
