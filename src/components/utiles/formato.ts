// Formato de números, unidades y fechas en español de España.
// Aquí no se calcula nada: solo se da forma a lo que devuelve el motor.

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

/** Número con separador decimal español y los decimales pedidos. */
export function num(valor: number, decimales = 0): string {
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(valor)
}

/** Número con hasta `decimales` decimales, sin ceros de relleno (74,5 / 75). */
export function numCorto(valor: number, decimales = 1): string {
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: decimales }).format(valor)
}

/** Entero redondeado (kcal, ml, gramos). */
export function entero(valor: number): string {
  return num(Math.round(valor))
}

/** Porcentaje entero a partir de una fracción 0-1. */
export function pctDeFraccion(fraccion: number): string {
  return `${num(Math.round(fraccion * 100))} %`
}

/**
 * Lee un número escrito por una persona: acepta coma o punto decimal.
 *
 * Acepta `unknown` a propósito: el borrador viene de `localStorage`, y un campo con el tipo
 * equivocado (un número donde iba una cadena) hacía saltar `texto.trim is not a function` en pleno
 * render y dejaba la página en blanco. Lo que no sea una cadena no es un número escrito: `null`.
 */
export function leerNumero(texto: unknown): number | null {
  if (typeof texto !== 'string') return null
  const limpio = texto.trim().replace(/\s/g, '').replace(',', '.')
  if (limpio === '') return null
  if (!/^-?\d*\.?\d+$/.test(limpio)) return null
  const valor = Number(limpio)
  return Number.isFinite(valor) ? valor : null
}

/** Fecha de hoy en ISO local (no UTC: evita saltar de día por la tarde-noche). */
export function hoyIso(): string {
  const d = new Date()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

const MS_DIA = 86_400_000

/** Fecha ISO 'YYYY-MM-DD' a milisegundos UTC. Sin hora: se comparan días, no instantes. */
export function isoAMilis(iso: string): number | null {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!partes) return null
  const [, a, m, d] = partes
  const valor = Date.UTC(Number(a), Number(m) - 1, Number(d))
  return Number.isFinite(valor) ? valor : null
}

/** Días completos entre dos fechas ISO (negativo si la segunda es anterior). */
export function diasEntreIso(desde: string, hasta: string): number | null {
  const a = isoAMilis(desde)
  const b = isoAMilis(hasta)
  if (a === null || b === null) return null
  return Math.round((b - a) / MS_DIA)
}

/** La fecha ISO que cae `dias` días después de `iso`. */
export function sumarDias(iso: string, dias: number): string {
  const base = isoAMilis(iso)
  if (base === null) return iso
  return new Date(base + dias * MS_DIA).toISOString().slice(0, 10)
}

/** '2027-02-01' → '1 de febrero de 2027'. */
export function fechaLarga(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number)
  if (!a || !m || !d) return iso
  return `${d} de ${MESES[m - 1]} de ${a}`
}

/** '2027-02-01' → 'febrero de 2027'. */
export function mesYAno(iso: string): string {
  const [a, m] = iso.split('-').map(Number)
  if (!a || !m) return iso
  return `${MESES[m - 1]} de ${a}`
}
