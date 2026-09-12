// Limpieza de todas las cadenas que vienen del modelo (SPEC-dieta-propia §3.5).
// Nada de lo que devuelve el modelo llega al front sin pasar por aquí.
/* eslint-disable no-control-regex -- quitar los caracteres de control es justo lo que hace esto */

/** Caracteres de control, formato invisible, separadores de línea y BOM. */
const INVISIBLES =
  /[\u0000-\u001f\u007f-\u009f\u00ad\u200b-\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069\ufeff]/g

/**
 * `trim`, colapsa espacios, quita caracteres de control, normaliza a NFC y recorta a `max`.
 * Lo que no es una cadena devuelve `''`.
 */
export function sanear(valor: unknown, max: number): string {
  if (typeof valor !== 'string') return ''
  let texto = valor.normalize('NFC').replace(INVISIBLES, ' ')
  texto = texto.replace(/\s+/g, ' ').trim()
  if (texto.length > max) {
    // Se corta por la última palabra entera que cabe: «Cereales de arroz integral y avena 0 % g»
    // salía de cortar a ciegas «… 0 % grasa». Si la palabra es más larga que la mitad del tope, se
    // corta a ciegas igualmente para no vaciar el texto.
    const corte = texto.slice(0, max)
    const espacio = corte.lastIndexOf(' ')
    texto = (espacio > max / 2 ? corte.slice(0, espacio) : corte).trim()
  }
  return texto
}

/** Quita los diacríticos (para comparar nombres de comida). */
export function sinAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/** Clave de comparación de un nombre de comida: sin acentos, en minúsculas y sin espacios de más. */
export function normalizarNombre(texto: string): string {
  return sinAcentos(texto).toLowerCase().replace(/\s+/g, ' ').trim()
}

/** Número finito dentro de `[min, max]`, redondeado a `decimales`; si no, `null`. */
export function numeroEn(valor: unknown, min: number, max: number, decimales = 1): number | null {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return null
  if (valor < min || valor > max) return null
  const factor = 10 ** decimales
  return Math.round(valor * factor) / factor
}
