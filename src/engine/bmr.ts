// Pasos 3 y 4 — masa libre de grasa y metabolismo basal (SPEC-calculo.md §2).
// Harris-Benedict nunca es primario y las ecuaciones nunca se promedian.

import type { BmrEcuacion, Fiabilidad, MetodoGrasa, ResultadoBmr, Sexo } from './types'

/** Paso 3 — masa libre de grasa. */
export function calcularMlg(pesoKg: number, grasaPct: number): number {
  return pesoKg * (1 - grasaPct / 100)
}

export function mifflin(pesoKg: number, alturaCm: number, edad: number, hombre: boolean): number {
  return 10 * pesoKg + 6.25 * alturaCm - 5 * edad + (hombre ? 5 : -161)
}

export function katchMcArdle(mlg: number): number {
  return 370 + 21.6 * mlg
}

export function harrisBenedict(
  pesoKg: number,
  alturaCm: number,
  edad: number,
  hombre: boolean,
): number {
  return hombre
    ? 88.362 + 13.397 * pesoKg + 4.799 * alturaCm - 5.677 * edad
    : 447.593 + 9.247 * pesoKg + 3.098 * alturaCm - 4.33 * edad
}

export interface EntradaBmr {
  sexo: Sexo
  edad: number
  alturaCm: number
  pesoKg: number
  mlg: number
  metodoEfectivo: MetodoGrasa
  fiabilidad: Fiabilidad
}

/** Paso 4 — BMR primario: Katch-McArdle solo con %grasa conocido y fiable. */
export function calcularBmr(e: EntradaBmr): ResultadoBmr {
  const hombre = e.sexo === 'hombre'
  const referencias = {
    mifflin: mifflin(e.pesoKg, e.alturaCm, e.edad, hombre),
    katch: katchMcArdle(e.mlg),
    harris: harrisBenedict(e.pesoKg, e.alturaCm, e.edad, hombre),
  }
  const usaKatch = e.metodoEfectivo === 'conocido' && e.fiabilidad === 'alta'
  const ecuacion: BmrEcuacion = usaKatch ? 'katch_mcardle' : 'mifflin'
  return { valor: usaKatch ? referencias.katch : referencias.mifflin, ecuacion, referencias }
}
