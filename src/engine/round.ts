// Redondeos y utilidades numéricas (SPEC-calculo.md §0.1).
// Todos con la semántica de Math.round de JavaScript (la mitad hacia +∞), nunca redondeo bancario.

/** 1 decimal. Solo para presentar; nunca dentro del cálculo. */
export const round1 = (x: number): number => Math.round(x * 10) / 10
/** Múltiplo de 0,5 (pesos objetivo). */
export const round05 = (x: number): number => Math.round(x * 2) / 2
/** Múltiplo de 5 (gramos de macros). */
export const round5 = (x: number): number => 5 * Math.round(x / 5)
/** Múltiplo de 10 (kcal objetivo). */
export const round10 = (x: number): number => 10 * Math.round(x / 10)
/** Múltiplo de 50 (agua en ml). */
export const round50 = (x: number): number => 50 * Math.round(x / 50)

export const clamp = (x: number, lo: number, hi: number): number => Math.min(Math.max(x, lo), hi)

// --- Redondeo dirigido: obligatorio cuando hay un límite activo (§0.1).
/** kcal tras activarse un suelo. */
export const roundUp10 = (x: number): number => 10 * Math.ceil(x / 10)
/** Gramos tras activarse un techo. */
export const roundDown5 = (x: number): number => 5 * Math.floor(x / 5)
/** Gramos tras activarse un suelo. */
export const roundUp5 = (x: number): number => 5 * Math.ceil(x / 5)
/** kg tras activarse un suelo de peso. */
export const roundUp05 = (x: number): number => Math.ceil(x * 2) / 2
/** kg tras activarse un techo de peso. */
export const roundDown05 = (x: number): number => Math.floor(x * 2) / 2

/** Suma días naturales a una fecha ISO 'YYYY-MM-DD' trabajando en UTC (paso 14). */
export function sumarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}
