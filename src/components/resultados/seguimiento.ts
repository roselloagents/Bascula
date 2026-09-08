// "Tu seguimiento en este móvil" (SPEC-ux §2.6c): pesajes guardados solo en este navegador.
// Nada de esto sale del dispositivo y el motor no lo lee nunca: solo se dibuja sobre la
// proyección y viaja al PDF en `DatosPdf.pesajes`.

import type { ObjetivoEfectivo, Pesaje, PuntoProyeccion } from '../../engine/types'
import { diasEntreIso, isoAMilis, numCorto } from '../utiles/formato'

export const CLAVE_PESAJES = 'bascula:pesajes:v1'

export const PESO_MIN_KG = 30
export const PESO_MAX_KG = 300

/** Días completos entre dos fechas ISO (negativo si la segunda es anterior). */
export function diasEntre(desde: string, hasta: string): number | null {
  return diasEntreIso(desde, hasta)
}

/** '2026-09-07' → '7/9/2026'. */
export function fechaCorta(iso: string): string {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!partes) return iso
  return `${Number(partes[3])}/${Number(partes[2])}/${partes[1]}`
}

/**
 * Mensaje de fecha no válida del formulario de pesajes (§2.6c, v1.2 decisión J). Hasta la v1.1
 * una fecha fuera de rango se rechazaba **en silencio**: el botón apagado, sin mensaje y sin
 * campo marcado, que es justo el defecto que la §1.0 prohíbe en el cuestionario. `null` cuando
 * la fecha vale.
 */
export function mensajeFechaPesaje(fecha: string, fechaInicio: string, hoy: string): string | null {
  const desdeInicio = diasEntre(fechaInicio, fecha)
  const hastaHoy = diasEntre(fecha, hoy)
  if (desdeInicio === null || hastaHoy === null) return 'Pon la fecha del día en que te pesaste.'
  if (desdeInicio < 0) {
    return `Esa fecha es anterior al día en que empezaste el plan (${fechaCorta(fechaInicio)}). Elige una posterior.`
  }
  if (hastaHoy < 0) return 'Todavía no puedes apuntar un peso de una fecha futura.'
  return null
}

/** Mensaje de peso no válido del mismo formulario. Con el campo vacío no se dice nada. */
export function mensajePesoPesaje(kg: number | null): string | null {
  if (kg === null) return null
  return kg >= PESO_MIN_KG && kg <= PESO_MAX_KG
    ? null
    : `Pon un peso entre ${PESO_MIN_KG} y ${PESO_MAX_KG} kg.`
}

/**
 * Semana de la proyección en la que cae un pesaje: `floor((fecha − fecha_inicio) / 7 días)`,
 * acotada a `[0, última semana]` (SPEC-ux §2.6c).
 */
export function semanaDePesaje(fecha: string, fechaInicio: string, ultimaSemana: number): number {
  const dias = diasEntre(fechaInicio, fecha)
  if (dias === null) return 0
  return Math.min(Math.max(Math.floor(dias / 7), 0), ultimaSemana)
}

/** El punto de la proyección de esa semana, o el más cercano que exista. */
export function puntoDeSemana(
  proyeccion: PuntoProyeccion[],
  semana: number,
): PuntoProyeccion | null {
  if (proyeccion.length === 0) return null
  let mejor = proyeccion[0]
  for (const punto of proyeccion) {
    if (Math.abs(punto.semana - semana) < Math.abs(mejor.semana - semana)) mejor = punto
  }
  return mejor
}

// ---- Persistencia --------------------------------------------------------

export function cargarPesajes(): Pesaje[] {
  try {
    const crudo = window.localStorage.getItem(CLAVE_PESAJES)
    if (!crudo) return []
    const datos = JSON.parse(crudo) as unknown
    if (!Array.isArray(datos)) return []
    return ordenar(
      datos.filter(
        (p): p is Pesaje =>
          typeof p === 'object' &&
          p !== null &&
          typeof (p as Pesaje).fecha === 'string' &&
          isoAMilis((p as Pesaje).fecha) !== null &&
          typeof (p as Pesaje).kg === 'number' &&
          Number.isFinite((p as Pesaje).kg),
      ),
    )
  } catch {
    return []
  }
}

export function guardarPesajes(pesajes: Pesaje[]): void {
  try {
    if (pesajes.length === 0) {
      window.localStorage.removeItem(CLAVE_PESAJES)
      return
    }
    window.localStorage.setItem(CLAVE_PESAJES, JSON.stringify(ordenar(pesajes)))
  } catch {
    // Modo privado: la lista sigue en memoria hasta que se cierre la pestaña.
  }
}

/** Orden ascendente por fecha, que es como se guarda y como viaja al PDF. */
export function ordenar(pesajes: Pesaje[]): Pesaje[] {
  return [...pesajes].sort((a, b) => a.fecha.localeCompare(b.fecha))
}

/** Añade un pesaje; si ya había uno de esa fecha, lo sustituye (no se duplica). */
export function anadirPesaje(
  pesajes: Pesaje[],
  nuevo: Pesaje,
): { pesajes: Pesaje[]; sustituido: boolean } {
  const sustituido = pesajes.some((p) => p.fecha === nuevo.fecha)
  const resto = pesajes.filter((p) => p.fecha !== nuevo.fecha)
  return { pesajes: ordenar([...resto, nuevo]), sustituido }
}

// ---- Frase de balance (SPEC-ux §2.6c, normativa) -------------------------

export type EstadoBalance = 'por_delante' | 'en_banda' | 'por_detras' | 'fuera_banda'

export interface Balance {
  estado: EstadoBalance
  semana: number
  /** Frase principal, la que corresponde al estado. */
  frase: string
  /** Segunda frase del estado, cuando la hay. */
  nota?: string
  /** Cierre fijo, siempre presente debajo de cualquiera de las anteriores. */
  cierre: string
}

export const CIERRE_BALANCE = 'Recalcula tu plan cada 4-6 semanas, o antes si has cambiado 5 kg.'

/**
 * Balance del pesaje **más reciente** contra el punto de su semana. Con menos de dos pesajes
 * devuelve `null`: un punto suelto no es una tendencia y la spec prohíbe pintar frase.
 */
export function calcularBalance(
  pesajes: Pesaje[],
  proyeccion: PuntoProyeccion[],
  objetivo: ObjetivoEfectivo,
  fechaInicio: string,
  plana: boolean,
): Balance | null {
  if (pesajes.length < 2 || proyeccion.length === 0) return null
  const ordenados = ordenar(pesajes)
  const ultimo = ordenados[ordenados.length - 1]
  const ultimaSemana = proyeccion[proyeccion.length - 1].semana
  const semana = semanaDePesaje(ultimo.fecha, fechaInicio, ultimaSemana)
  const punto = puntoDeSemana(proyeccion, semana)
  if (!punto) return null

  const dentro = ultimo.kg >= punto.peso_min && ultimo.kg <= punto.peso_max
  const diferencia = numCorto(Math.abs(ultimo.kg - punto.peso_esp), 1)
  const enBanda: Balance = {
    estado: 'en_banda',
    semana: punto.semana,
    frase: `Vas dentro de lo previsto para la semana ${punto.semana}. No hay nada que cambiar.`,
    cierre: CIERRE_BALANCE,
  }

  // Proyección plana (mantener o recomposición): la banda es ±1 kg y solo hay dos estados.
  if (plana || (objetivo !== 'perder' && objetivo !== 'ganar')) {
    if (dentro) return enBanda
    return {
      estado: 'fuera_banda',
      semana: punto.semana,
      frase:
        'Tu peso se ha movido más de un kilo respecto al de partida. En un plan de mantenimiento o de recomposición eso suele ser agua; si se mantiene tres o cuatro semanas, recalcula con tu peso real.',
      cierre: CIERRE_BALANCE,
    }
  }

  if (dentro) return enBanda

  const perder = objetivo === 'perder'
  const adelantado = perder ? ultimo.kg < punto.peso_min : ultimo.kg > punto.peso_max

  if (adelantado) {
    return {
      estado: 'por_delante',
      semana: punto.semana,
      frase: `Vas por delante de la previsión: ${diferencia} kg por ${
        perder ? 'debajo' : 'encima'
      } de lo que esperábamos para la semana ${punto.semana}.`,
      nota: 'Ojo con acelerar: ir más rápido de lo previsto suele costar músculo. Si el ritmo se mantiene así, recalcula.',
      cierre: CIERRE_BALANCE,
    }
  }

  return {
    estado: 'por_detras',
    semana: punto.semana,
    frase: `Vas por detrás de la previsión: ${diferencia} kg por ${
      perder ? 'encima' : 'debajo'
    } de lo que esperábamos para la semana ${punto.semana}.`,
    nota: 'Una semana no dice nada: el peso oscila por agua, sal e intestino. Si en tres o cuatro semanas seguidas sigue así, es que el gasto estimado no era el tuyo.',
    cierre: CIERRE_BALANCE,
  }
}
