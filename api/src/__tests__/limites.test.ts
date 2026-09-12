// Cuotas por IP (IPv6 por /64), tope global, presupuesto y desalojo LRU (SPEC-dieta-propia §7).
import { describe, expect, it } from 'vitest'
import { claveIp, crearLimites, fechaUtc } from '../limites.ts'
import { crearToken, tokenValido, ventanaDe } from '../token.ts'
import { sanear, normalizarNombre, numeroEn } from '../saneado.ts'

function limites(parcial: Partial<Parameters<typeof crearLimites>[0]> = {}) {
  return crearLimites({
    carpeta: '.',
    topeIpDia: 3,
    topeGlobalDia: 10,
    topeEurosDia: 1,
    persistir: false,
    ...parcial,
  })
}

describe('cuotas', () => {
  it('cuenta por IP hasta el tope', () => {
    const l = limites()
    for (let i = 0; i < 3; i += 1) {
      expect(l.comprobar('1.2.3.4')).toBeNull()
      l.registrarPeticion('1.2.3.4')
    }
    expect(l.comprobar('1.2.3.4')).toBe('CUOTA_IP')
    expect(l.comprobar('5.6.7.8')).toBeNull()
  })

  it('agrega las IPv6 por /64', () => {
    expect(claveIp('2001:db8:1:2:3:4:5:6')).toBe(claveIp('2001:db8:1:2:aaaa:bbbb:cccc:dddd'))
    expect(claveIp('2001:db8:1:2::1')).not.toBe(claveIp('2001:db8:1:3::1'))
    expect(claveIp('::ffff:1.2.3.4')).toBe('1.2.3.4')
    const l = limites({ topeIpDia: 1 })
    l.registrarPeticion('2001:db8:1:2:3:4:5:6')
    expect(l.comprobar('2001:db8:1:2::99')).toBe('CUOTA_IP')
  })

  it('el tope global y el presupuesto son independientes de la IP', () => {
    const global = limites({ topeIpDia: 100, topeGlobalDia: 2 })
    global.registrarPeticion('1.1.1.1')
    global.registrarPeticion('2.2.2.2')
    expect(global.comprobar('3.3.3.3')).toBe('CUOTA_GLOBAL')

    const euros = limites({ topeIpDia: 100, topeGlobalDia: 100, topeEurosDia: 0.1 })
    euros.registrarCoste(0.09)
    expect(euros.comprobar('1.1.1.1')).toBeNull()
    euros.registrarCoste(0.02)
    expect(euros.comprobar('1.1.1.1')).toBe('PRESUPUESTO')
  })

  it('el mapa de IPs está acotado y desaloja la menos usada (LRU)', () => {
    const l = limites({ topeIpDia: 100, topeGlobalDia: 10000, maxIps: 3 })
    for (const ip of ['1.1.1.1', '2.2.2.2', '3.3.3.3']) l.registrarPeticion(ip)
    l.registrarPeticion('1.1.1.1') // la recoloca al final
    l.registrarPeticion('4.4.4.4') // desaloja la más vieja: 2.2.2.2
    const claves = Object.keys(l.estado().ips)
    expect(claves).toHaveLength(3)
    expect(claves).not.toContain('2.2.2.2')
    expect(claves).toContain('1.1.1.1')
  })

  it('al cambiar de día UTC los contadores vuelven a cero', () => {
    let reloj = Date.parse('2026-09-12T23:59:00Z')
    const l = limites({ topeIpDia: 1, ahora: () => reloj })
    l.registrarPeticion('1.2.3.4')
    expect(l.comprobar('1.2.3.4')).toBe('CUOTA_IP')
    reloj = Date.parse('2026-09-13T00:01:00Z')
    expect(l.comprobar('1.2.3.4')).toBeNull()
    expect(l.estado().fecha).toBe('2026-09-13')
  })

  it('fechaUtc no depende de la zona horaria local', () => {
    expect(fechaUtc(Date.parse('2026-09-12T23:30:00Z'))).toBe('2026-09-12')
  })
})

describe('token efímero (§7)', () => {
  it('vale en su ventana y en la anterior, y no en la de antes', () => {
    const ahora = Date.parse('2026-09-12T10:05:00Z')
    const token = crearToken('secreto', '1.2.3.4', ahora)
    expect(tokenValido('secreto', '1.2.3.4', token, ahora)).toBe(true)
    expect(tokenValido('secreto', '1.2.3.4', token, ahora + 10 * 60 * 1000)).toBe(true)
    expect(tokenValido('secreto', '1.2.3.4', token, ahora + 25 * 60 * 1000)).toBe(false)
  })

  it('no sirve para otra IP, ni con otro secreto, ni inventado', () => {
    const ahora = Date.now()
    const token = crearToken('secreto', '1.2.3.4', ahora)
    expect(tokenValido('secreto', '9.9.9.9', token, ahora)).toBe(false)
    expect(tokenValido('otro', '1.2.3.4', token, ahora)).toBe(false)
    expect(tokenValido('secreto', '1.2.3.4', 'inventado', ahora)).toBe(false)
    expect(tokenValido('secreto', '1.2.3.4', undefined, ahora)).toBe(false)
    expect(tokenValido('secreto', '1.2.3.4', ['a', 'b'], ahora)).toBe(false)
  })

  it('la ventana es de 10 minutos', () => {
    expect(ventanaDe(600_000) - ventanaDe(0)).toBe(1)
  })
})

describe('saneado', () => {
  it('recorta, colapsa y limita la longitud', () => {
    expect(sanear('  hola   mundo  ', 100)).toBe('hola mundo')
    expect(sanear('a'.repeat(50), 10)).toHaveLength(10)
    expect(sanear(42, 10)).toBe('')
    expect(sanear('con​cero', 100)).toBe('con cero')
  })

  it('normaliza nombres para comparar comidas', () => {
    expect(normalizarNombre('  MEDIA   Mañana ')).toBe('media manana')
  })

  it('numeroEn respeta el rango y redondea', () => {
    expect(numeroEn(3.456, 0, 10, 1)).toBe(3.5)
    expect(numeroEn(11, 0, 10)).toBeNull()
    expect(numeroEn(Number.NaN, 0, 10)).toBeNull()
    expect(numeroEn('5', 0, 10)).toBeNull()
  })
})
