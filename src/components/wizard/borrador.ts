// Estado del cuestionario mientras se rellena, su validación y su conversión
// a `InputCalculo`. Ningún número de aquí entra en el cálculo: solo se comprueban
// los rangos declarados en SPEC-calculo.md §1 para no llamar al motor con basura.

import type {
  ActividadDiaria,
  CategoriaVisual,
  Condicion,
  CribadoTCA,
  Experiencia,
  FuenteGrasa,
  InputCalculo,
  InputSomatotipo,
  Intensidad,
  MetodoGrasa,
  Momento,
  NComidas,
  Objetivo,
  Preferencia,
  Ritmo,
  Sexo,
  TipoEntrenamiento,
} from '../../engine/types'
import { hoyIso, leerNumero } from '../utiles/formato'

export const CLAVE_ALMACEN = 'bascula:inputs:v1'

export type RespuestaCribado = 'si' | 'prefiero_no' | 'no'

export type PasoId =
  | 'sexo'
  | 'edad'
  | 'embarazo'
  | 'medidas'
  | 'condiciones'
  | 'cribado'
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
  altura_cm: string
  peso_kg: string
  condiciones: Condicion[]
  sinCondiciones: boolean
  cribado: { q1: RespuestaCribado | null; q2: RespuestaCribado | null }
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
  ritmo: Ritmo
  quierePesoObjetivo: boolean | null
  peso_objetivo: string
  preferencia: Preferencia | null
  n_comidas: NComidas
  clima_caluroso: boolean
}

export function borradorInicial(): Borrador {
  return {
    sexo: null,
    edad: '',
    embarazo_lactancia: null,
    altura_cm: '',
    peso_kg: '',
    condiciones: [],
    sinCondiciones: false,
    cribado: { q1: null, q2: null },
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
    ritmo: 'moderado',
    quierePesoObjetivo: null,
    peso_objetivo: '',
    preferencia: null,
    n_comidas: 3,
    clima_caluroso: false,
  }
}

// ---- Persistencia -------------------------------------------------------
// El cribado del paso 5b nunca se guarda (CONTRATO.md, UI): se vuelve a preguntar.

export function guardarBorrador(borrador: Borrador): void {
  try {
    const resto: Partial<Borrador> = { ...borrador }
    delete resto.cribado
    window.localStorage.setItem(CLAVE_ALMACEN, JSON.stringify(resto))
  } catch {
    // Modo privado o almacenamiento lleno: seguir sin persistir.
  }
}

export function cargarBorrador(): Borrador {
  const base = borradorInicial()
  try {
    const crudo = window.localStorage.getItem(CLAVE_ALMACEN)
    if (!crudo) return base
    const datos = JSON.parse(crudo) as Partial<Borrador>
    return {
      ...base,
      ...datos,
      cribado: base.cribado,
      grasa: { ...base.grasa, ...(datos.grasa ?? {}) },
      somatotipo: { ...(datos.somatotipo ?? {}) },
      entrenamiento: { ...base.entrenamiento, ...(datos.entrenamiento ?? {}) },
      condiciones: Array.isArray(datos.condiciones) ? datos.condiciones : [],
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
    }
  } catch {
    return { paso: null, planGenerado: false }
  }
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

/** Cribado del paso 5b: "prefiero no responder" cuenta igual que un "sí". */
export function cribadoDe(borrador: Borrador): CribadoTCA | null {
  const { q1, q2 } = borrador.cribado
  if (q1 === null || q2 === null) return null
  if (q1 === 'si' || q2 === 'si') return 'positivo'
  if (q1 === 'prefiero_no' || q2 === 'prefiero_no') return 'evitado'
  return 'negativo'
}

/** `true` cuando el cribado activa las protecciones (siluetas, %grasa, peso objetivo). */
export function proteccionActiva(borrador: Borrador): boolean {
  const cribado = cribadoDe(borrador)
  return cribado === 'positivo' || cribado === 'evitado'
}

function objetivoUsaRitmo(objetivo: Objetivo | null): boolean {
  return objetivo === null || objetivo === 'perder' || objetivo === 'ganar' || objetivo === 'no_se'
}

/** Pasos que aplican con las respuestas dadas hasta ahora (SPEC-ux §1.0). */
export function pasosVisibles(borrador: Borrador): PasoId[] {
  const pasos: PasoId[] = ['sexo', 'edad']
  if (borrador.sexo === 'mujer') pasos.push('embarazo')
  pasos.push('medidas', 'condiciones', 'cribado', 'grasa', 'somatotipo', 'actividad', 'entrenamiento', 'objetivo')
  if (objetivoUsaRitmo(borrador.objetivo)) pasos.push('ritmo')
  if (objetivoUsaRitmo(borrador.objetivo) && !proteccionActiva(borrador)) pasos.push('pesoObjetivo')
  pasos.push('preferencias')
  return pasos
}

// ---- Validación ---------------------------------------------------------

export interface EstadoPaso {
  completo: boolean
  errores: Record<string, string>
}

/**
 * Método de grasa que de verdad se usa. Con la protección del cribado activa, el método `visual`
 * no existe (§1.2.6): ni la pantalla lo ofrece, ni la validación lo acepta, ni llega al motor.
 */
export function metodoEfectivo(b: Borrador): MetodoGrasa | null {
  if (proteccionActiva(b) && b.grasa.metodo === 'visual') return null
  return b.grasa.metodo
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

    case 'cribado':
      return { completo: b.cribado.q1 !== null && b.cribado.q2 !== null, errores }

    case 'grasa': {
      // Con el cribado positivo o evitado el bloque de siluetas "no existe" (§1.2.6): un método
      // `visual` guardado antes del cribado se ignora, y si no se elige ninguno se avanza con
      // `desconocido` en vez de dejar el botón muerto.
      if (metodoEfectivo(b) === null) return { completo: proteccionActiva(b), errores }
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
      if (metodoEfectivo(b) === 'visual') {
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
      return { completo: true, errores }

    case 'pesoObjetivo': {
      if (b.quierePesoObjetivo === null) return { completo: false, errores }
      if (b.quierePesoObjetivo === false) return { completo: true, errores }
      const objetivo = enRango(b.peso_objetivo, 30, 300)
      if (objetivo === 'fuera') {
        errores.peso_objetivo = 'Revisa el dato: solo podemos trabajar con un peso objetivo entre 30 y 300 kg.'
      }
      return { completo: objetivo === 'ok', errores }
    }

    case 'preferencias':
      return { completo: b.preferencia !== null, errores }
  }
}

/** `true` si el motor marcó ese campo como fuera de rango (`ERR_INPUT_RANGO`). */
export function estaMarcado(marcados: string[] | undefined, campo: string): boolean {
  return (marcados ?? []).some((c) => c.split('+').includes(campo))
}

// ---- Conversión a los inputs del motor ----------------------------------

export function aInputs(b: Borrador): InputCalculo {
  const metodo: MetodoGrasa = metodoEfectivo(b) ?? 'desconocido'
  const grasa: InputCalculo['grasa'] = { metodo }
  if (metodo === 'conocido') {
    grasa.valor = leerNumero(b.grasa.valor) ?? 0
    grasa.fuente = b.grasa.fuente ?? 'estimado'
  } else if (metodo === 'medidas') {
    grasa.cuello_cm = leerNumero(b.grasa.cuello_cm) ?? 0
    grasa.cintura_cm = leerNumero(b.grasa.cintura_cm) ?? 0
    if (b.sexo === 'mujer') grasa.cadera_cm = leerNumero(b.grasa.cadera_cm) ?? 0
  } else if (metodo === 'visual' && b.grasa.categoria && !proteccionActiva(b)) {
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
    ritmo: pasos.includes('ritmo') ? b.ritmo : 'moderado',
    peso_objetivo: pesoObjetivo,
    preferencia: b.preferencia ?? 'omnivoro',
    n_comidas: b.n_comidas,
    clima_caluroso: b.clima_caluroso,
    embarazo_lactancia: b.embarazo_lactancia === true,
    condiciones: b.sinCondiciones ? [] : b.condiciones,
    cribado_tca: cribadoDe(b),
    fecha_inicio: hoyIso(),
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
    case 'cribado_tca':
      return 'condiciones'
    case 'grasa':
      return 'grasa'
    case 'actividad_diaria':
      return 'actividad'
    case 'entrenamiento':
      return 'entrenamiento'
    case 'objetivo':
      return 'objetivo'
    case 'ritmo':
      return 'ritmo'
    case 'peso_objetivo':
      return 'pesoObjetivo'
    case 'preferencia':
    case 'n_comidas':
      return 'preferencias'
    default:
      return null
  }
}
