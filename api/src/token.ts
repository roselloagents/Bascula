// Token efímero de §7: HMAC-SHA256(secreto, `ip|ventana_de_10_min`) en base64url.
// Vale en la ventana actual y en la anterior, así que dura entre 10 y 20 minutos.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

export const VENTANA_MS = 10 * 60 * 1000

export function ventanaDe(ahora: number): number {
  return Math.floor(ahora / VENTANA_MS)
}

export function firmar(secreto: string, ip: string, ventana: number): string {
  return createHmac('sha256', secreto).update(`${ip}|${ventana}`).digest('base64url')
}

export function crearToken(secreto: string, ip: string, ahora: number): string {
  return firmar(secreto, ip, ventanaDe(ahora))
}

export function tokenValido(secreto: string, ip: string, token: unknown, ahora: number): boolean {
  if (typeof token !== 'string' || token.length === 0 || token.length > 200) return false
  const ventana = ventanaDe(ahora)
  return (
    iguales(token, firmar(secreto, ip, ventana)) || iguales(token, firmar(secreto, ip, ventana - 1))
  )
}

/** Secreto de respaldo cuando no viene por entorno: aleatorio y solo válido mientras viva el proceso. */
export function secretoAleatorio(): string {
  return randomBytes(32).toString('base64url')
}

function iguales(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}
