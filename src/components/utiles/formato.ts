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

/** Lee un número escrito por una persona: acepta coma o punto decimal. */
export function leerNumero(texto: string): number | null {
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
