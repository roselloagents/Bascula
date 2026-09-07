// Estado del cuestionario mientras se rellena, su validación y su conversión
// a `InputCalculo`. Ningún número de aquí entra en el cálculo: solo se comprueban
// los rangos declarados en SPEC-calculo.md §1 para no llamar al motor con basura.

import type {
  ActividadDiaria,
  CategoriaVisual,
  Condicion,
  Experiencia,
  FuenteGrasa,
  InputCalculo,
  InputSomatotipo,
  Intensidad,
  Menstruacion,
  MetodoGrasa,
  Momento,
  NComidas,
  Objetivo,
  Preferencia,
  PreferenciaBase,
  RecomposicionPrioridad,
  Restriccion,
  Ritmo,
  Sexo,
  TipoEntrenamiento,
} from '../../engine/types'
import { hoyIso, leerNumero } from '../utiles/formato'

export const CLAVE_ALMACEN = 'bascula:inputs:v1'

/** Orden canónico de las restricciones combinables (SPEC-calculo §1.1, regla de traducción). */
export const ORDEN_RESTRICCIONES: Restriccion[] = ['sin_lactosa', 'sin_gluten']

export type PasoId =
  | 'sexo'
  | 'edad'
  | 'embarazo'
  | 'regla'
  | 'medidas'
  | 'condiciones'
  | 'grasa'
  | 'somatotipo'
  | 'actividad'
  | 'entrenamiento'
  | 'objetivo'
  | 'ritmo'
  | 'pesoObjetivo'
  | 'preferencias'

export interface Borrador {
  sexo: Sexo | null
  edad: string
  embarazo_lactancia: boolean | null
  /** Paso 3b, solo mujeres. `null` = no contestado, que vale igual que "prefiero no decirlo". */
  menstruacion: Menstruacion | null
  altura_cm: string
  peso_kg: string
  condiciones: Condicion[]
  sinCondiciones: boolean
  grasa: {
    metodo: MetodoGrasa | null
    valor: string
    fuente: FuenteGrasa | null
    cuello_cm: string
    cintura_cm: string
    cadera_cm: string
    categoria: CategoriaVisual | null
  }
  somatotipoElegido: 'saltar' | 'responder' | null
  somatotipo: Partial<InputSomatotipo>
  actividad_diaria: ActividadDiaria | null
  entrena: boolean | null
  entrenamiento: {
    tipo: Exclude<TipoEntrenamiento, 'ninguno'> | null
    dias_semana: number
    minutos_sesion: number
    intensidad: Intensidad | null
    experiencia: Experiencia | null
    momento: Momento | null
    momentoRespondido: boolean
  }
  objetivo: Objetivo | null
  /** Subpregunta del paso 10 (SPEC-ux §1 paso 10). Preseleccionada en `equilibrado`, que es el
   *  comportamiento de la v1.0 y no cambia ningún número. Solo viaja con `objetivo` de recomposición. */
  recomposicion_prioridad: RecomposicionPrioridad
  /** Sin preseleccionar (QA §1): el ritmo cambia el tamaño del déficit y el cronograma,
   *  así que no es un valor por defecto razonable como el número de comidas o el clima. */
  ritmo: Ritmo | null
  quierePesoObjetivo: boolean | null
  peso_objetivo: string
  /** Paso 13, base excluyente (SPEC-ux §1 paso 13, 1a). Preseleccionada en "como de todo". */
  preferencia_base: PreferenciaBase
  /** Paso 13, restricciones combinables (varias a la vez). */
  restricciones: Restriccion[]
  /** Paso 13, interruptor "bajo en hidratos". Este sí cambia los números (SPEC-calculo §1.1). */
  low_carb: boolean
  n_comidas: NComidas
  clima_caluroso: boolean
  /** "¿Quieres comidas sencillas?" del paso 13 (SPEC-ux §3.7.1). Desactivado por defecto. */
  menu_sencillo: boolean
  /**
   * Día en que empezó el plan (`InputCalculo.fecha_inicio`). **No se pregunta**: se fija la
   * primera vez que se pide el plan y se conserva mientras el peso no cambie. Si se recalculara
   * a hoy en cada visita, la semana 0 de la proyección se movería cada día, los pesajes de §2.6c
   * quedarían "antes del principio" y el ajuste guardado se descartaría por cambio de datos.
   */
  fecha_inicio: string
  /** Peso con el que se fijó `fecha_inicio`: al cambiarlo, el plan (y la proyección) empiezan hoy. */
  peso_inicio: string
}

export function borradorInicial(): Borrador {
  return {
    sexo: null,
    edad: '',
    embarazo_lactancia: null,
    menstruacion: null,
    altura_cm: '',
    peso_kg: '',
    condiciones: [],
    sinCondiciones: false,
    grasa: {
      metodo: null,
      valor: '',
      fuente: null,
      cuello_cm: '',
      cintura_cm: '',
      cadera_cm: '',
      categoria: null,
    },
    somatotipoElegido: null,
    somatotipo: {},
    actividad_diaria: null,
    entrena: null,
    entrenamiento: {
      tipo: null,
      dias_semana: 3,
      minutos_sesion: 60,
      intensidad: null,
      experiencia: null,
      momento: null,
      momentoRespondido: false,
    },
    objetivo: null,
    recomposicion_prioridad: 'equilibrado',
    ritmo: null,
    quierePesoObjetivo: null,
    peso_objetivo: '',
    preferencia_base: 'omnivoro',
    restricciones: [],
    low_carb: false,
    n_comidas: 3,
    clima_caluroso: false,
    menu_sencillo: false,
    fecha_inicio: '',
    peso_inicio: '',
  }
}

/**
 * Fija el arranque del plan antes de calcularlo: la primera vez, y cada vez que el usuario dice
 * un peso distinto (la proyección arranca en el peso actual, así que con un peso nuevo el plan
 * empieza hoy). Mientras no cambie, la fecha se conserva y el seguimiento sigue teniendo sentido.
 */
export function anclarPlan(b: Borrador): Borrador {
  if (b.fecha_inicio !== '' && b.peso_inicio === b.peso_kg) return b
  return { ...b, fecha_inicio: hoyIso(), peso_inicio: b.peso_kg }
}

// ---- Persistencia -------------------------------------------------------

export function guardarBorrador(borrador: Borrador): void {
  try {
    window.localStorage.setItem(CLAVE_ALMACEN, JSON.stringify(borrador))
  } catch {
    // Modo privado o almacenamiento lleno: seguir sin persistir.
  }
}

/**
 * Un borrador guardado con la v1.0 trae una sola `preferencia` y el cribado del paso 5b. Se
 * normaliza sin perder respuestas: la preferencia antigua se reparte en base + restricciones +
 * interruptor con la **regla de traducción** de `SPEC-calculo.md` §1.1, y el cribado se descarta
 * (desde la v1.1 la UI escribe siempre `cribado_tca: null`).
 */
function normalizarPreferencias(datos: Record<string, unknown>): Partial<Borrador> {
  if (typeof datos.preferencia_base === 'string') {
    const elegida = datos.preferencia_base as PreferenciaBase
    const guardadas = Array.isArray(datos.restricciones) ? (datos.restricciones as Restriccion[]) : []
    return {
      preferencia_base: BASES.includes(elegida) ? elegida : 'omnivoro',
      restricciones: ORDEN_RESTRICCIONES.filter((r) => guardadas.includes(r)),
      low_carb: datos.low_carb === true,
    }
  }
  const antigua = datos.preferencia as Preferencia | undefined
  if (typeof antigua !== 'string') return {}
  return {
    preferencia_base: antigua === 'vegetariano' || antigua === 'vegano' ? antigua : 'omnivoro',
    restricciones:
      antigua === 'sin_lactosa' ? ['sin_lactosa'] : antigua === 'sin_gluten' ? ['sin_gluten'] : [],
    low_carb: antigua === 'low_carb',
  }
}

const BASES: PreferenciaBase[] = ['omnivoro', 'vegetariano', 'vegano']
const MENSTRUACIONES: Menstruacion[] = ['regular', 'irregular', 'ausente', 'no_dice']
const PRIORIDADES: RecomposicionPrioridad[] = ['perder', 'equilibrado', 'ganar']

export function cargarBorrador(): Borrador {
  const base = borradorInicial()
  try {
    const crudo = window.localStorage.getItem(CLAVE_ALMACEN)
    if (!crudo) return base
    const datos = JSON.parse(crudo) as Partial<Borrador> & Record<string, unknown>
    const prioridad = datos.recomposicion_prioridad as RecomposicionPrioridad | undefined
    const menstruacion = datos.menstruacion as Menstruacion | undefined
    // Campos de la v1.0 que ya no existen: se leen (para traducir la preferencia) y se tiran,
    // para no volver a guardarlos en el borrador nuevo.
    const heredado = { ...datos }
    delete heredado.cribado
    delete heredado.preferencia
    return {
      ...base,
      ...heredado,
      grasa: { ...base.grasa, ...(datos.grasa ?? {}) },
      somatotipo: { ...(datos.somatotipo ?? {}) },
      entrenamiento: { ...base.entrenamiento, ...(datos.entrenamiento ?? {}) },
      condiciones: Array.isArray(datos.condiciones) ? datos.condiciones : [],
      menstruacion: menstruacion && MENSTRUACIONES.includes(menstruacion) ? menstruacion : null,
      recomposicion_prioridad:
        prioridad && PRIORIDADES.includes(prioridad) ? prioridad : 'equilibrado',
      ...normalizarPreferencias(datos),
    }
  } catch {
    return base
  }
}

// ---- Sesión: paso actual y plan ya calculado ----------------------------
// Van en su propia clave para no mezclarse con las respuestas: al recargar la página el usuario
// volvía a la primera pantalla y tenía que pulsar "Siguiente" trece veces para recuperar su plan.

export const CLAVE_SESION = 'bascula:sesion:v1'

export interface Sesion {
  paso: PasoId | null
  planGenerado: boolean
  /**
   * Huella de los `InputCalculo` con los que se calculó el último plan. Sirve para decidir si el
   * ajuste manual guardado (`bascula:ajuste:v1`) sigue valiendo: si el usuario edita sus datos y
   * recalcula, los límites del plan nuevo no tienen por qué parecerse a los del anterior y el
   * ajuste se descarta (SPEC-ux §2.2b).
   */
  firmaPlan?: string
}

export function guardarSesion(sesion: Sesion): void {
  try {
    window.localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion))
  } catch {
    // Modo privado: se sigue sin persistir.
  }
}

export function cargarSesion(): Sesion {
  try {
    const crudo = window.localStorage.getItem(CLAVE_SESION)
    if (!crudo) return { paso: null, planGenerado: false }
    const datos = JSON.parse(crudo) as Partial<Sesion>
    return {
      paso: typeof datos.paso === 'string' ? (datos.paso as PasoId) : null,
      planGenerado: datos.planGenerado === true,
      firmaPlan: typeof datos.firmaPlan === 'string' ? datos.firmaPlan : undefined,
    }
  } catch {
    return { paso: null, planGenerado: false }
  }
}

/**
 * Guarda el paso en el que está el usuario **conservando la huella del último plan**. El wizard
 * escribe su paso nada más montarse, y también al volver desde los resultados con "Editar tus
 * datos": si esa escritura borrase `firmaPlan`, el ajuste manual guardado se descartaría al
 * recalcular aunque el usuario no hubiera tocado ni un dato (SPEC-ux §2.2b: el ajuste solo se
 * pierde al recalcular con datos **distintos**).
 */
export function guardarPasoSesion(paso: PasoId): void {
  guardarSesion({ paso, planGenerado: false, firmaPlan: cargarSesion().firmaPlan })
}

export function borrarSesion(): void {
  try {
    window.localStorage.removeItem(CLAVE_SESION)
  } catch {
    // Nada que hacer.
  }
}

export function borrarBorrador(): void {
  try {
    window.localStorage.removeItem(CLAVE_ALMACEN)
  } catch {
    // Nada que hacer: el estado en memoria ya se ha reiniciado.
  }
}

// ---- Ramificación -------------------------------------------------------

function objetivoUsaRitmo(objetivo: Objetivo | null): boolean {
  return objetivo === null || objetivo === 'perder' || objetivo === 'ganar' || objetivo === 'no_se'
}

/** Pasos que aplican con las respuestas dadas hasta ahora (SPEC-ux §1.0). */
export function pasosVisibles(borrador: Borrador): PasoId[] {
  const pasos: PasoId[] = ['sexo', 'edad']
  // La regla va justo detrás de embarazo/lactancia y solo se pregunta a mujeres (§1 paso 3b).
  if (borrador.sexo === 'mujer') pasos.push('embarazo', 'regla')
  pasos.push('medidas', 'condiciones', 'grasa', 'somatotipo', 'actividad', 'entrenamiento', 'objetivo')
  // El peso objetivo ya no depende de ningún cribado (v1.1, decisión A): solo del objetivo.
  if (objetivoUsaRitmo(borrador.objetivo)) pasos.push('ritmo', 'pesoObjetivo')
  pasos.push('preferencias')
  return pasos
}

// ---- Validación ---------------------------------------------------------

export interface EstadoPaso {
  completo: boolean
  errores: Record<string, string>
}

function enRango(texto: string, min: number, max: number): 'vacio' | 'fuera' | 'ok' {
  const valor = leerNumero(texto)
  if (valor === null) return 'vacio'
  return valor >= min && valor <= max ? 'ok' : 'fuera'
}

export function estadoPaso(borrador: Borrador, paso: PasoId): EstadoPaso {
  const errores: Record<string, string> = {}
  const b = borrador

  switch (paso) {
    case 'sexo':
      return { completo: b.sexo !== null, errores }

    case 'edad': {
      const valor = leerNumero(b.edad)
      if (valor !== null && (!Number.isInteger(valor) || valor < 0 || valor > 120)) {
        errores.edad = 'Introduce una edad válida.'
      }
      return { completo: valor !== null && !errores.edad, errores }
    }

    case 'embarazo':
      return { completo: b.embarazo_lactancia !== null, errores }

    // Se puede saltar: sin respuesta viaja `null`, con el mismo efecto que "prefiero no decirlo".
    case 'regla':
      return { completo: true, errores }

    case 'medidas': {
      const altura = enRango(b.altura_cm, 130, 230)
      const peso = enRango(b.peso_kg, 35, 300)
      if (altura === 'fuera') {
        errores.altura_cm = 'Revisa tu altura: parece fuera de un rango que podamos calcular con seguridad.'
      }
      if (peso === 'fuera') {
        errores.peso_kg = 'Revisa tu peso: parece fuera de un rango que podamos calcular con seguridad.'
      }
      return { completo: altura === 'ok' && peso === 'ok', errores }
    }

    case 'condiciones':
      return { completo: b.sinCondiciones || b.condiciones.length > 0, errores }

    case 'grasa': {
      if (b.grasa.metodo === null) return { completo: false, errores }
      if (b.grasa.metodo === 'conocido') {
        const pct = enRango(b.grasa.valor, 3, 70)
        if (pct === 'fuera') {
          errores.valor =
            'Revisa el dato: un porcentaje de grasa fuera de 3-70 % no es habitual. Si no estás seguro/a, elige que lo estimemos nosotros.'
        }
        return { completo: pct === 'ok' && b.grasa.fuente !== null, errores }
      }
      if (b.grasa.metodo === 'medidas') {
        const cuello = enRango(b.grasa.cuello_cm, 25, 60)
        const cintura = enRango(b.grasa.cintura_cm, 50, 200)
        const cadera = b.sexo === 'mujer' ? enRango(b.grasa.cadera_cm, 60, 200) : 'ok'
        if (cuello === 'fuera') errores.cuello_cm = 'El cuello suele medir entre 25 y 60 cm.'
        if (cintura === 'fuera') errores.cintura_cm = 'La cintura suele medir entre 50 y 200 cm.'
        if (cadera === 'fuera') errores.cadera_cm = 'La cadera suele medir entre 60 y 200 cm.'
        return { completo: cuello === 'ok' && cintura === 'ok' && cadera === 'ok', errores }
      }
      if (b.grasa.metodo === 'visual') {
        return { completo: b.grasa.categoria !== null, errores }
      }
      return { completo: true, errores }
    }

    case 'somatotipo': {
      if (b.somatotipoElegido === 'saltar') return { completo: true, errores }
      if (b.somatotipoElegido === 'responder') {
        const s = b.somatotipo
        return { completo: Boolean(s.q1 && s.q2 && s.q3 && s.q4), errores }
      }
      return { completo: false, errores }
    }

    case 'actividad':
      return { completo: b.actividad_diaria !== null, errores }

    case 'entrenamiento': {
      if (b.entrena === false) return { completo: true, errores }
      if (b.entrena === null) return { completo: false, errores }
      const e = b.entrenamiento
      const completo = Boolean(e.tipo && e.intensidad && e.experiencia && e.momentoRespondido)
      return { completo, errores }
    }

    case 'objetivo':
      return { completo: b.objetivo !== null, errores }

    case 'ritmo':
      return { completo: b.ritmo !== null, errores }

    case 'pesoObjetivo': {
      if (b.quierePesoObjetivo === null) return { completo: false, errores }
      if (b.quierePesoObjetivo === false) return { completo: true, errores }
      const objetivo = enRango(b.peso_objetivo, 30, 300)
      if (objetivo === 'fuera') {
        errores.peso_objetivo = 'Revisa el dato: solo podemos trabajar con un peso objetivo entre 30 y 300 kg.'
      }
      return { completo: objetivo === 'ok', errores }
    }

    // La base viene preseleccionada en "como de todo" y el resto de controles tienen valor por
    // defecto (§1 paso 13), así que este paso nunca bloquea el botón.
    case 'preferencias':
      return { completo: true, errores }
  }
}

/** `true` si el motor marcó ese campo como fuera de rango (`ERR_INPUT_RANGO`). */
export function estaMarcado(marcados: string[] | undefined, campo: string): boolean {
  return (marcados ?? []).some((c) => c.split('+').includes(campo))
}

// ---- Conversión a los inputs del motor ----------------------------------

/**
 * Regla inversa de `SPEC-calculo.md` §1.1: el valor del campo antiguo `preferencia` que
 * corresponde al trío (base, restricciones, interruptor). El motor lo ignora en cuanto ve
 * `preferencia_base`, pero se envía igualmente para el código que todavía lo lea.
 */
export function preferenciaHeredada(
  base: PreferenciaBase,
  restricciones: Restriccion[],
  lowCarb: boolean,
): Preferencia {
  if (lowCarb) return 'low_carb'
  if (base !== 'omnivoro') return base
  if (restricciones.includes('sin_gluten')) return 'sin_gluten'
  if (restricciones.includes('sin_lactosa')) return 'sin_lactosa'
  return 'omnivoro'
}

export function aInputs(b: Borrador): InputCalculo {
  const metodo: MetodoGrasa = b.grasa.metodo ?? 'desconocido'
  const grasa: InputCalculo['grasa'] = { metodo }
  if (metodo === 'conocido') {
    grasa.valor = leerNumero(b.grasa.valor) ?? 0
    grasa.fuente = b.grasa.fuente ?? 'estimado'
  } else if (metodo === 'medidas') {
    grasa.cuello_cm = leerNumero(b.grasa.cuello_cm) ?? 0
    grasa.cintura_cm = leerNumero(b.grasa.cintura_cm) ?? 0
    if (b.sexo === 'mujer') grasa.cadera_cm = leerNumero(b.grasa.cadera_cm) ?? 0
  } else if (metodo === 'visual' && b.grasa.categoria) {
    grasa.categoria = b.grasa.categoria
  }

  const s = b.somatotipo
  const somatotipo: InputSomatotipo | null =
    b.somatotipoElegido === 'responder' && s.q1 && s.q2 && s.q3 && s.q4
      ? { q1: s.q1, q2: s.q2, q3: s.q3, q4: s.q4 }
      : null

  const e = b.entrenamiento
  const entrenamiento: InputCalculo['entrenamiento'] =
    b.entrena && e.tipo
      ? {
          tipo: e.tipo,
          dias_semana: e.dias_semana,
          minutos_sesion: e.minutos_sesion,
          intensidad: e.intensidad ?? 'media',
          experiencia: e.experiencia ?? 'novato',
          momento: e.momento,
        }
      : {
          tipo: 'ninguno',
          dias_semana: 0,
          minutos_sesion: 60,
          intensidad: 'media',
          experiencia: 'novato',
          momento: null,
        }

  const pasos = pasosVisibles(b)
  const pesoObjetivo =
    pasos.includes('pesoObjetivo') && b.quierePesoObjetivo ? leerNumero(b.peso_objetivo) : null

  // Paso 13 (§1.1): se envían los tres campos nuevos y también el antiguo `preferencia`.
  const restricciones = ORDEN_RESTRICCIONES.filter((r) => b.restricciones.includes(r))
  const lowCarb = b.low_carb === true

  return {
    sexo: b.sexo ?? 'hombre',
    edad: leerNumero(b.edad) ?? 0,
    altura_cm: leerNumero(b.altura_cm) ?? 0,
    peso_kg: leerNumero(b.peso_kg) ?? 0,
    grasa,
    somatotipo,
    actividad_diaria: b.actividad_diaria ?? 'sedentario',
    entrenamiento,
    objetivo: b.objetivo ?? 'mantener',
    // Fuera del paso 11 (objetivos que no usan ritmo) el motor pide igualmente un valor:
    // se resuelve aquí, como el resto de campos que el cuestionario puede no preguntar.
    ritmo: (pasos.includes('ritmo') ? b.ritmo : null) ?? 'moderado',
    peso_objetivo: pesoObjetivo,
    preferencia: preferenciaHeredada(b.preferencia_base, restricciones, lowCarb),
    preferencia_base: b.preferencia_base,
    restricciones,
    low_carb: lowCarb,
    // Solo se envía con el objetivo que la pregunta (§1 paso 10); en el resto viaja `null`,
    // que el motor trata como 'equilibrado'.
    recomposicion_prioridad: b.objetivo === 'recomposicion' ? b.recomposicion_prioridad : null,
    // Solo se pregunta a mujeres; en hombres el motor la ignora, pero no la enviamos siquiera.
    menstruacion: b.sexo === 'mujer' ? b.menstruacion : null,
    n_comidas: b.n_comidas,
    clima_caluroso: b.clima_caluroso,
    // Solo lo lee el generador de menús; el motor lo ignora por completo (§3.7.1).
    menu_sencillo: b.menu_sencillo === true,
    embarazo_lactancia: b.embarazo_lactancia === true,
    condiciones: b.sinCondiciones ? [] : b.condiciones,
    // v1.1 (decisión A): el paso 5b ya no existe y la UI escribe siempre `null`. Ningún camino
    // de la interfaz puede producir 'positivo' ni 'evitado', y por tanto tampoco 'tca'.
    cribado_tca: null,
    // Lo fija `anclarPlan` al pedir el plan; el respaldo es para un borrador de la v1.0.
    fecha_inicio: b.fecha_inicio || hoyIso(),
  }
}

/** Paso del cuestionario donde se corrige un campo devuelto en `Resultado.errores`. */
export function pasoDeCampo(campo: string): PasoId | null {
  const raiz = campo.split('+')[0].split('.')[0]
  switch (raiz) {
    case 'edad':
      return 'edad'
    case 'altura_cm':
    case 'peso_kg':
      return 'medidas'
    case 'condiciones':
      return 'condiciones'
    case 'menstruacion':
      return 'regla'
    case 'grasa':
      return 'grasa'
    case 'actividad_diaria':
      return 'actividad'
    case 'entrenamiento':
      return 'entrenamiento'
    case 'objetivo':
    case 'recomposicion_prioridad':
      return 'objetivo'
    case 'ritmo':
      return 'ritmo'
    case 'peso_objetivo':
      return 'pesoObjetivo'
    case 'preferencia':
    case 'preferencia_base':
    case 'restricciones':
    case 'low_carb':
    case 'n_comidas':
      return 'preferencias'
    default:
      return null
  }
}
