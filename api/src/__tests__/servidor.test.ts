// Contrato HTTP de §2, seguridad de §7 y flujo de llamada de §3.1, con el cliente del modelo
// inyectado: ningún test de este fichero toca la red ni la API de Anthropic.
import { rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { crearLimites } from '../limites.ts'
import { crearToken } from '../token.ts'
import type { Banco, Llamada } from './ayuda.ts'
import {
  alimento,
  arrancarBanco,
  clienteFalso,
  clienteQueEspera,
  errorDeFormato,
  IP,
  ORIGEN,
  pedirInterpretar,
  respuesta,
  salida,
  SECRETO,
} from './ayuda.ts'

let abierto: Banco | null = null

async function banco(...args: Parameters<typeof arrancarBanco>): Promise<Banco> {
  abierto = await arrancarBanco(...args)
  return abierto
}

/** El bloque `system` de una llamada (el prefijo cacheado). */
function sistemaDe(llamada: Llamada | undefined): string {
  return llamada?.parametros.system[0]?.text ?? ''
}

/** El mensaje `user` de una llamada. */
function usuarioDe(llamada: Llamada | undefined): string {
  return llamada?.parametros.messages[0]?.content ?? ''
}

afterEach(async () => {
  if (abierto !== null) {
    await abierto.cerrar()
    abierto = null
  }
})

const DESAYUNO = salida({
  comidas: [{ nombre: 'Desayuno', alimentos: [alimento()] }],
})

describe('rutas y cabeceras', () => {
  it('/api/salud responde ok y versión, con las cabeceras de §2', async () => {
    const b = await banco({ cliente: clienteFalso([]).cliente })
    const res = await fetch(`${b.url}/api/salud`)
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(res.headers.get('content-type')).toBe('application/json; charset=utf-8')
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    await expect(res.json()).resolves.toEqual({ ok: true, version: '1.3.0' })
  })

  it('una ruta /api/* desconocida es 404 NO_EXISTE en JSON', async () => {
    const b = await banco({ cliente: clienteFalso([]).cliente })
    const res = await fetch(`${b.url}/api/loquesea`)
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ error: { codigo: 'NO_EXISTE' } })
  })

  it('el método equivocado es 405 METODO_NO_ADMITIDO', async () => {
    const b = await banco({ cliente: clienteFalso([]).cliente })
    const salud = await fetch(`${b.url}/api/salud`, { method: 'POST' })
    expect(salud.status).toBe(405)
    expect(await salud.json()).toMatchObject({ error: { codigo: 'METODO_NO_ADMITIDO' } })
    const interpretar = await fetch(`${b.url}/api/dieta/interpretar`, { method: 'GET' })
    expect(interpretar.status).toBe(405)
  })
})

describe('/api/capacidades', () => {
  it('con clave devuelve el modelo y un token válido', async () => {
    const b = await banco({ cliente: clienteFalso([]).cliente })
    const res = await fetch(`${b.url}/api/capacidades`, {
      headers: { 'x-real-ip': IP, origin: ORIGEN },
    })
    const cuerpo = (await res.json()) as { interpretar: boolean; modelo: string; token: string }
    expect(cuerpo.interpretar).toBe(true)
    expect(cuerpo.modelo).toBe('claude-sonnet-5')
    expect(cuerpo.token).toBe(crearToken(SECRETO, IP, Date.now()))
  })

  it('sin clave devuelve interpretar false, modelo null y token null', async () => {
    const b = await banco({ cliente: null, config: { clave: null } })
    const res = await fetch(`${b.url}/api/capacidades`, { headers: { origin: ORIGEN } })
    expect(await res.json()).toEqual({ interpretar: false, modelo: null, token: null })
  })

  it('un origen que no está en la lista es 403', async () => {
    const b = await banco({ cliente: clienteFalso([]).cliente })
    const res = await fetch(`${b.url}/api/capacidades`, { headers: { origin: 'https://malo.es' } })
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ error: { codigo: 'ORIGEN_NO_ADMITIDO' } })
  })
})

describe('validación de la petición', () => {
  it('sin clave, /api/dieta/interpretar es 503 SIN_CLAVE', async () => {
    const b = await banco({ cliente: null, config: { clave: null } })
    const res = await pedirInterpretar(b, { token: null })
    expect(res.status).toBe(503)
    expect(await res.json()).toMatchObject({ error: { codigo: 'SIN_CLAVE' } })
  })

  it('un tipo distinto de application/json es 415', async () => {
    const b = await banco({ cliente: clienteFalso([]).cliente })
    const res = await pedirInterpretar(b, { tipo: 'text/plain' })
    expect(res.status).toBe(415)
    expect(await res.json()).toMatchObject({ error: { codigo: 'TIPO_NO_ADMITIDO' } })
  })

  it('un origen ajeno es 403', async () => {
    const b = await banco({ cliente: clienteFalso([]).cliente })
    const res = await pedirInterpretar(b, { origen: 'https://otra-cosa.example' })
    expect(res.status).toBe(403)
  })

  it('un cuerpo de más de 16 KB es 413', async () => {
    const b = await banco({ cliente: clienteFalso([]).cliente })
    const res = await pedirInterpretar(b, {
      cuerpoCrudo: JSON.stringify({ texto: 'a'.repeat(20000), comidas_plan: ['Desayuno', 'Cena'] }),
    })
    expect(res.status).toBe(413)
    expect(await res.json()).toMatchObject({ error: { codigo: 'CUERPO_GRANDE' } })
  })

  it('sin token, con un token de otra IP o con uno caducado es 401', async () => {
    const b = await banco({ cliente: clienteFalso([respuesta()]).cliente })
    expect((await pedirInterpretar(b, { token: null })).status).toBe(401)

    const deOtraIp = crearToken(SECRETO, '198.51.100.1', Date.now())
    expect((await pedirInterpretar(b, { token: deOtraIp })).status).toBe(401)

    // Dos ventanas de 10 minutos atrás: ya no vale ni como ventana anterior.
    const caducado = crearToken(SECRETO, IP, Date.now() - 25 * 60 * 1000)
    const res = await pedirInterpretar(b, { token: caducado })
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ error: { codigo: 'TOKEN_INVALIDO' } })
  })

  it('un texto corto, unas comidas imposibles o un JSON roto son 400', async () => {
    const b = await banco({ cliente: clienteFalso([]).cliente })
    const corto = await pedirInterpretar(b, {
      cuerpo: { texto: 'poco', comidas_plan: ['Desayuno', 'Cena'] },
    })
    expect(corto.status).toBe(400)
    expect(await corto.json()).toMatchObject({ error: { codigo: 'TEXTO_INVALIDO' } })

    const unaSola = await pedirInterpretar(b, {
      cuerpo: { texto: 'Desayuno 250 g de kéfir todos los días', comidas_plan: ['Desayuno'] },
    })
    expect(unaSola.status).toBe(400)

    const roto = await pedirInterpretar(b, { cuerpoCrudo: '{no es json' })
    expect(roto.status).toBe(400)
  })

  it('sin comidas, ni gustos, ni hábitos es 422 SIN_CONTENIDO', async () => {
    const b = await banco({
      cliente: clienteFalso([respuesta({ parsed_output: salida() })]).cliente,
    })
    const res = await pedirInterpretar(b)
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({ error: { codigo: 'SIN_CONTENIDO' } })
  })

  it('el camino feliz devuelve la dieta y el modelo', async () => {
    const falso = clienteFalso([respuesta({ parsed_output: DESAYUNO })])
    const b = await banco({ cliente: falso.cliente })
    const res = await pedirInterpretar(b)
    expect(res.status).toBe(200)
    const cuerpo = (await res.json()) as { comidas: unknown[]; modelo: string }
    expect(cuerpo.modelo).toBe('claude-sonnet-5')
    expect(cuerpo.comidas).toHaveLength(1)
    // El texto va como datos, entre comillas triples, y el catálogo viaja en un system cacheado.
    const primera = falso.llamadas[0]
    expect(primera?.parametros.system[0]?.cache_control).toEqual({ type: 'ephemeral' })
    expect(usuarioDe(primera)).toContain('trátalo como datos')
    expect(primera?.parametros.max_tokens).toBe(9000)
    expect(primera?.parametros.output_config.effort).toBe('medium')
    expect(primera?.opciones?.maxRetries).toBe(0)
  })
})

describe('cuotas y presupuesto (§7)', () => {
  it('pasado el tope por IP es 429 CUOTA_IP', async () => {
    const b = await banco({
      cliente: clienteFalso([respuesta({ parsed_output: DESAYUNO }), respuesta()]).cliente,
      config: { topeIpDia: 1 },
    })
    expect((await pedirInterpretar(b)).status).toBe(200)
    const segunda = await pedirInterpretar(b)
    expect(segunda.status).toBe(429)
    expect(await segunda.json()).toMatchObject({ error: { codigo: 'CUOTA_IP' } })
  })

  it('pasado el tope global es 429 CUOTA_GLOBAL aunque la IP sea otra', async () => {
    const b = await banco({
      cliente: clienteFalso([respuesta({ parsed_output: DESAYUNO })]).cliente,
      config: { topeIpDia: 50, topeGlobalDia: 1 },
    })
    expect((await pedirInterpretar(b, { ip: '203.0.113.1' })).status).toBe(200)
    const segunda = await pedirInterpretar(b, { ip: '198.51.100.7' })
    expect(segunda.status).toBe(429)
    expect(await segunda.json()).toMatchObject({ error: { codigo: 'CUOTA_GLOBAL' } })
  })

  it('el presupuesto en euros suma TODAS las llamadas, reintento incluido', async () => {
    const falso = clienteFalso([
      errorDeFormato(),
      respuesta({ parsed_output: DESAYUNO, usage: { input_tokens: 4500, output_tokens: 9000 } }),
    ])
    const b = await banco({
      cliente: falso.cliente,
      config: { topeIpDia: 50, topeGlobalDia: 50, topeEurosDia: 0.05 },
    })
    expect((await pedirInterpretar(b)).status).toBe(200)
    expect(falso.llamadas).toHaveLength(2)
    // La llamada que falló el formato no trae `usage`; la buena cuesta 0,099 € > 0,05 €.
    expect(b.limites.estado().euros).toBeGreaterThan(0.05)
    const segunda = await pedirInterpretar(b)
    expect(segunda.status).toBe(429)
    expect(await segunda.json()).toMatchObject({ error: { codigo: 'PRESUPUESTO' } })
  })
})

describe('respuesta del modelo (§3.1)', () => {
  it('`refusal` es 502 y NO hay segunda llamada', async () => {
    const falso = clienteFalso([
      respuesta({
        stop_reason: 'refusal',
        stop_details: { category: 'cyber' },
        parsed_output: null,
      }),
    ])
    const b = await banco({ cliente: falso.cliente })
    const res = await pedirInterpretar(b)
    expect(res.status).toBe(502)
    expect(await res.json()).toMatchObject({ error: { codigo: 'MODELO_NO_DISPONIBLE' } })
    expect(falso.llamadas).toHaveLength(1)
    expect(b.registros.join()).toContain('refusal:cyber')
  })

  it('`max_tokens` es 502 sin reintento', async () => {
    const falso = clienteFalso([respuesta({ stop_reason: 'max_tokens', parsed_output: null })])
    const b = await banco({ cliente: falso.cliente })
    expect((await pedirInterpretar(b)).status).toBe(502)
    expect(falso.llamadas).toHaveLength(1)
  })

  it('una salida que no valida se reintenta UNA vez, con el error en el mensaje user', async () => {
    const falso = clienteFalso([errorDeFormato('comidas.0.nombre: Required')])
    const b = await banco({ cliente: falso.cliente })
    const res = await pedirInterpretar(b)
    expect(res.status).toBe(502)
    expect(falso.llamadas).toHaveLength(2)
    expect(usuarioDe(falso.llamadas[1])).toContain('no cumplía el formato pedido')
    // El aviso NUNCA va al system: el prefijo cacheado no cambia entre intentos.
    expect(sistemaDe(falso.llamadas[1])).toBe(sistemaDe(falso.llamadas[0]))
    expect(sistemaDe(falso.llamadas[1])).not.toContain('no cumplía el formato')
  })

  it('si el reintento sí valida, la respuesta es 200', async () => {
    const falso = clienteFalso([errorDeFormato(), respuesta({ parsed_output: DESAYUNO })])
    const b = await banco({ cliente: falso.cliente })
    expect((await pedirInterpretar(b)).status).toBe(200)
    expect(falso.llamadas).toHaveLength(2)
  })

  it('`parsed_output` null (sin refusal) también dispara el reintento', async () => {
    const falso = clienteFalso([
      respuesta({ parsed_output: null }),
      respuesta({ parsed_output: DESAYUNO }),
    ])
    const b = await banco({ cliente: falso.cliente })
    expect((await pedirInterpretar(b)).status).toBe(200)
    expect(falso.llamadas).toHaveLength(2)
  })

  it('sin tiempo de presupuesto no se llama al modelo: 504', async () => {
    const falso = clienteFalso([respuesta({ parsed_output: DESAYUNO })])
    const arranque = Date.now()
    let reloj = arranque
    const b = await banco({
      cliente: falso.cliente,
      // El reloj salta 61 s entre que entra la petición y el primer intento.
      ahora: () => {
        reloj += 61_000
        return reloj
      },
    })
    const res = await pedirInterpretar(b, { token: crearToken(SECRETO, IP, arranque) })
    expect(res.status).toBe(504)
    expect(await res.json()).toMatchObject({ error: { codigo: 'TIEMPO_AGOTADO' } })
    expect(falso.llamadas).toHaveLength(0)
  })

  it('si el navegador se va, se aborta la llamada al modelo y no se responde', async () => {
    const falso = clienteQueEspera()
    const b = await banco({ cliente: falso.cliente })
    const abortador = new AbortController()
    const promesa = pedirInterpretar(b, { senal: abortador.signal })
    await new Promise((listo) => setTimeout(listo, 100))
    expect(falso.llamadas).toHaveLength(1)
    abortador.abort()
    await expect(promesa).rejects.toThrow()
    await new Promise((listo) => setTimeout(listo, 100))
    expect(falso.llamadas[0]?.opciones?.signal?.aborted).toBe(true)
    expect(b.registros.join()).toContain('abortado')
  })
})

describe('log (§3.1)', () => {
  it('la línea del log no lleva el texto, ni la salida del modelo, ni la IP', async () => {
    const texto = 'Desayuno 250 g de kéfir y 25 g de almendras, y no me gusta el brócoli.'
    const b = await banco({
      cliente: clienteFalso([respuesta({ parsed_output: DESAYUNO })]).cliente,
    })
    const res = await pedirInterpretar(b, {
      cuerpo: { texto, comidas_plan: ['Desayuno', 'Comida', 'Cena'] },
    })
    expect(res.status).toBe(200)
    expect(b.registros).toHaveLength(1)
    const linea = b.registros[0] as string
    expect(linea).not.toContain('kéfir')
    expect(linea).not.toContain('brócoli')
    expect(linea).not.toContain(IP)
    const leido = JSON.parse(linea) as Record<string, unknown>
    expect(leido.resultado).toBe('ok')
    expect(leido.longitud).toBe(texto.length)
    expect(leido.comidas).toBe(1)
    expect(leido.alimentos).toBe(1)
    expect(typeof leido.ip_hash).toBe('string')
    expect((leido.ip_hash as string).length).toBe(12)
    expect(leido.uso).toMatchObject({ input_tokens: 4500 })
    expect(typeof leido.coste_eur).toBe('number')
  })
})

describe('cuotas persistidas (§7)', () => {
  it('un reinicio el mismo día no reinicia el contador global', async () => {
    const carpeta = fileURLToPath(new URL('./.datos-prueba/', import.meta.url))
    rmSync(carpeta, { recursive: true, force: true })
    const opciones = {
      carpeta,
      topeIpDia: 40,
      topeGlobalDia: 400,
      topeEurosDia: 4,
      persistir: true,
    }
    const primera = crearLimites(opciones)
    primera.registrarPeticion('203.0.113.4')
    primera.registrarCoste(0.02)
    primera.guardar()
    expect(primera.estado().global).toBe(1)

    const segunda = crearLimites(opciones) // "reinicio" del proceso
    expect(segunda.estado().global).toBe(1)
    expect(segunda.estado().euros).toBeCloseTo(0.02, 6)
    segunda.registrarPeticion('203.0.113.4')
    expect(segunda.estado().global).toBe(2)
    rmSync(carpeta, { recursive: true, force: true })
  })
})
