// Formato de números y fechas en español de España para el PDF.
// Regla dura: ningún campo opcional puede acabar imprimiendo "NaN" ni "undefined".

// Helvetica con WinAnsiEncoding no tiene el signo menos tipográfico U+2212: se codifica como el
// byte de control 0x12 y DESAPARECE de la página, así que un número negativo se imprimiría con su
// valor absoluto. Se usa el guion ASCII, que sí existe en WinAnsi.
const MENOS = '-'

/** Guion largo que sustituye a cualquier valor no imprimible. */
export const SIN_DATO = '—'

/**
 * Tramo propio de CP1252 que Helvetica/WinAnsi sí imprime, además de Latin-1 sin controles.
 * Lo comparte el test de integración para comprobar que nada desaparece de la página.
 */
export const CP1252_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'

function esNumero(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor)
}

/** Número con coma decimal y punto de millares. Devuelve `—` si no es un número válido. */
export function num(valor: number | null | undefined, decimales = 0): string {
  if (!esNumero(valor)) return SIN_DATO
  const negativo = valor < 0
  const fijo = Math.abs(valor).toFixed(decimales)
  const [entera, decimal] = fijo.split('.')
  const conMillares = entera.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const cuerpo = decimal ? `${conMillares},${decimal}` : conMillares
  return negativo ? `${MENOS}${cuerpo}` : cuerpo
}

/** `2.190 kcal`. */
export function kcal(valor: number | null | undefined): string {
  const n = num(valor)
  return n === SIN_DATO ? SIN_DATO : `${n} kcal`
}

/** `185 g` (0 decimales por defecto). */
export function gramos(valor: number | null | undefined, decimales = 0): string {
  const n = num(valor, decimales)
  return n === SIN_DATO ? SIN_DATO : `${n} g`
}

/** `3.250 ml`. */
export function mililitros(valor: number | null | undefined): string {
  const n = num(valor)
  return n === SIN_DATO ? SIN_DATO : `${n} ml`
}

/** `84,0 kg`. */
export function kilos(valor: number | null | undefined, decimales = 1): string {
  const n = num(valor, decimales)
  return n === SIN_DATO ? SIN_DATO : `${n} kg`
}

/** Fracción 0-1 a porcentaje: `34 %`. */
export function pctFraccion(valor: number | null | undefined, decimales = 0): string {
  if (!esNumero(valor)) return SIN_DATO
  return `${num(valor * 100, decimales)} %`
}

/** Valor ya en porcentaje: `25 %`. */
export function pct(valor: number | null | undefined, decimales = 0): string {
  const n = num(valor, decimales)
  return n === SIN_DATO ? SIN_DATO : `${n} %`
}

/** Rango numérico formateado con la unidad que se le pase. */
export function rango(
  valores: readonly [number, number] | null | undefined,
  formatea: (v: number) => string,
): string {
  if (!valores || !esNumero(valores[0]) || !esNumero(valores[1])) return SIN_DATO
  return `${formatea(valores[0])} - ${formatea(valores[1])}`
}

/** Ancho de barra en porcentaje del contenedor, siempre entre 0 y 100. */
export function anchoBarra(fraccion: number | null | undefined): string {
  if (!esNumero(fraccion)) return '0%'
  return `${Math.max(0, Math.min(100, fraccion * 100)).toFixed(2)}%`
}

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

function partesIso(iso: string | null | undefined): { d: number; m: number; a: number } | null {
  if (typeof iso !== 'string') return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim())
  if (!m) return null
  const anio = Number(m[1])
  const mes = Number(m[2])
  const dia = Number(m[3])
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null
  return { d: dia, m: mes, a: anio }
}

/** `1 de febrero de 2027`. */
export function fechaLarga(iso: string | null | undefined): string {
  const p = partesIso(iso)
  if (!p) return SIN_DATO
  return `${p.d} de ${MESES[p.m - 1]} de ${p.a}`
}

/** `1/2/2027`, para el pie de página. */
export function fechaCorta(iso: string | null | undefined): string {
  const p = partesIso(iso)
  if (!p) return SIN_DATO
  return `${p.d}/${p.m}/${p.a}`
}

/** Une un rango de fechas respetando la precisión que manda el motor. */
export function rangoFechas(
  min: string | null | undefined,
  max: string | null | undefined,
  precision: 'dia' | 'mes',
): string {
  if (precision === 'dia') {
    const a = fechaLarga(min)
    const b = fechaLarga(max)
    if (a === SIN_DATO || b === SIN_DATO) return SIN_DATO
    return `del ${a} al ${b}`
  }
  const a = partesIso(min)
  const b = partesIso(max)
  if (!a || !b) return SIN_DATO
  if (a.a === b.a && a.m === b.m) return `hacia ${MESES[a.m - 1]} de ${a.a}`
  if (a.a === b.a) return `entre ${MESES[a.m - 1]} y ${MESES[b.m - 1]} de ${a.a}`
  return `entre ${MESES[a.m - 1]} de ${a.a} y ${MESES[b.m - 1]} de ${b.a}`
}

/** Quita el punto final de una frase para poder encadenarla dentro de otra. */
export function sinPuntoFinal(texto: string): string {
  return texto.replace(/\.\s*$/, '')
}

/** Une una lista con comas y una "y" final. */
export function lista(elementos: readonly string[]): string {
  const limpios = elementos.filter((e) => e.trim().length > 0)
  if (limpios.length === 0) return SIN_DATO
  if (limpios.length === 1) return limpios[0]
  return `${limpios.slice(0, -1).join(', ')} y ${limpios[limpios.length - 1]}`
}

/**
 * Deja un texto imprimible con Helvetica + WinAnsiEncoding.
 *
 * Los formatos de `src/data/mercadona.json` llevan el signo `≈` (U+2248), que WinAnsi no tiene:
 * @react-pdf/renderer no falla, simplemente **borra** el carácter, así que "bandeja ≈ 1 kg" se
 * imprimiría como "bandeja  1 kg" y el usuario leería un peso exacto donde hay una aproximación.
 * Se sustituyen los pocos símbolos que pueden llegar desde datos y se descarta el resto.
 */
export function winAnsi(texto: string | null | undefined): string {
  if (typeof texto !== 'string') return SIN_DATO
  const sustituido = texto
    .replace(/\u2248/g, 'aprox.')
    .replace(/\u2212/g, '-')
    .replace(/\u2264/g, '<=')
    .replace(/\u2265/g, '>=')
    .replace(/\u2192/g, '->')
  let salida = ''
  for (const c of sustituido) {
    const code = c.codePointAt(0) ?? 0
    const imprimible = (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff)
    if (imprimible || c === '\n' || CP1252_EXTRA.includes(c)) salida += c
  }
  return salida
}
