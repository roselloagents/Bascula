// Validación de inputs (SPEC-calculo.md §1). Devuelve los nombres de los campos fuera de rango o
// fuera de dominio; una lista no vacía produce `{ excluido: 'ERR_INPUT_RANGO', errores }` y el motor
// no se ejecuta. Se valida el dominio de los enumerados antes que los rangos numéricos: sin eso un
// valor fuera de dominio propagaba NaN hasta devolver un plan con macros NaN.

import { VISUAL_HOMBRE, VISUAL_MUJER } from './constants'
import type { Inputs } from './types'

const DOMINIOS = {
  sexo: ['hombre', 'mujer'],
  metodo: ['conocido', 'medidas', 'visual', 'desconocido'],
  fuente: ['fiable', 'estimado'],
  actividad_diaria: ['sedentario', 'ligero', 'moderado', 'alto', 'muy_alto'],
  tipo: ['ninguno', 'fuerza', 'cardio', 'mixto'],
  intensidad: ['baja', 'media', 'alta'],
  experiencia: ['novato', 'intermedio', 'avanzado'],
  momento: ['manana', 'mediodia', 'tarde', 'noche'],
  objetivo: ['perder', 'mantener', 'ganar', 'recomposicion', 'no_se'],
  ritmo: ['suave', 'moderado', 'agresivo'],
  preferencia: ['omnivoro', 'vegetariano', 'vegano', 'sin_lactosa', 'sin_gluten', 'low_carb'],
  condicion: ['diabetes', 'renal', 'hepatica', 'tca', 'cardiaca', 'hipertension', 'tiroides', 'bariatrica', 'glp1', 'otra'],
  cribado_tca: ['positivo', 'evitado', 'negativo'],
  // v1.1: solo se validan si están presentes y no son `null` (§1.1).
  recomposicion_prioridad: ['perder', 'equilibrado', 'ganar'],
  menstruacion: ['regular', 'irregular', 'ausente', 'no_dice'],
  preferencia_base: ['omnivoro', 'vegetariano', 'vegano'],
  restriccion: ['sin_lactosa', 'sin_gluten'],
} as const satisfies Record<string, readonly string[]>

/** Etiquetas legibles de cada campo, para el texto de `ERR_INPUT_RANGO`. */
export const ETIQUETAS_CAMPO: Record<string, string> = {
  sexo: 'el sexo',
  edad: 'la edad (18 a 75 años, número entero)',
  altura_cm: 'la altura (entre 130 y 230 cm)',
  peso_kg: 'el peso (entre 35 y 300 kg)',
  'peso_kg+altura_cm': 'la combinación de peso y altura',
  'grasa.metodo': 'el método para estimar la grasa corporal',
  'grasa.valor': 'el porcentaje de grasa (entre 3 y 70 %)',
  'grasa.fuente': 'el origen del dato de grasa corporal',
  'grasa.cuello_cm': 'la medida del cuello (entre 25 y 60 cm)',
  'grasa.cintura_cm': 'la medida de la cintura (entre 50 y 200 cm)',
  'grasa.cadera_cm': 'la medida de la cadera (entre 60 y 200 cm)',
  'grasa.categoria': 'la descripción visual elegida',
  actividad_diaria: 'la actividad diaria',
  'entrenamiento.tipo': 'el tipo de entrenamiento',
  'entrenamiento.dias_semana': 'los días de entrenamiento por semana (0 a 7)',
  'entrenamiento.minutos_sesion': 'los minutos por sesión (entre 10 y 240)',
  'entrenamiento.intensidad': 'la intensidad del entrenamiento',
  'entrenamiento.experiencia': 'la experiencia entrenando',
  'entrenamiento.momento': 'el momento del día en que entrenas',
  objetivo: 'el objetivo',
  ritmo: 'el ritmo',
  peso_objetivo: 'el peso objetivo (entre 30 y 300 kg)',
  preferencia: 'la preferencia alimentaria',
  n_comidas: 'el número de comidas (de 2 a 6)',
  condiciones: 'las condiciones de salud',
  cribado_tca: 'la respuesta del cuestionario breve',
  fecha_inicio: 'la fecha de inicio',
  recomposicion_prioridad: 'qué te importa más ahora en la recomposición',
  menstruacion: 'la respuesta sobre tu regla',
  preferencia_base: 'la base de tu alimentación',
  restricciones: 'las restricciones alimentarias',
  low_carb: 'la opción baja en hidratos',
}

const enDominio = (dominio: readonly string[], valor: unknown): boolean =>
  typeof valor === 'string' && dominio.includes(valor)

const enRango = (valor: unknown, lo: number, hi: number): boolean =>
  typeof valor === 'number' && Number.isFinite(valor) && valor >= lo && valor <= hi

/**
 * Valida dominio y rango de todos los inputs (§1, incluida la validación cruzada de IMC).
 * El orden de los nombres devueltos es el del documento: primero dominios, luego rangos.
 */
export function validarInputs(inputs: Inputs): string[] {
  const e: string[] = []
  const grasa = (inputs.grasa ?? {}) as Partial<Inputs['grasa']>
  const ent = (inputs.entrenamiento ?? {}) as Partial<Inputs['entrenamiento']>

  // --- dominios de los enumerados
  if (!enDominio(DOMINIOS.sexo, inputs.sexo)) e.push('sexo')
  if (!enDominio(DOMINIOS.metodo, grasa.metodo)) e.push('grasa.metodo')
  // `grasa.fuente` se valida siempre que venga informada: la §1 la enumera sin condicionarla al método.
  if (grasa.fuente !== undefined && grasa.fuente !== null && !enDominio(DOMINIOS.fuente, grasa.fuente)) {
    e.push('grasa.fuente')
  }
  if (!enDominio(DOMINIOS.actividad_diaria, inputs.actividad_diaria)) e.push('actividad_diaria')
  if (!enDominio(DOMINIOS.tipo, ent.tipo)) e.push('entrenamiento.tipo')
  // La §1 exime de validación cuatro campos con `tipo = 'ninguno'`: dias_semana, minutos_sesion,
  // intensidad y momento. `experiencia` no está entre ellos, así que se valida siempre.
  if (!enDominio(DOMINIOS.experiencia, ent.experiencia)) e.push('entrenamiento.experiencia')
  if (ent.tipo !== 'ninguno') {
    if (!enDominio(DOMINIOS.intensidad, ent.intensidad)) e.push('entrenamiento.intensidad')
    if (ent.momento !== null && ent.momento !== undefined && !enDominio(DOMINIOS.momento, ent.momento)) {
      e.push('entrenamiento.momento')
    }
  }
  if (!enDominio(DOMINIOS.objetivo, inputs.objetivo)) e.push('objetivo')
  if (!enDominio(DOMINIOS.ritmo, inputs.ritmo)) e.push('ritmo')
  if (!enDominio(DOMINIOS.preferencia, inputs.preferencia)) e.push('preferencia')
  if (!Array.isArray(inputs.condiciones) || inputs.condiciones.some((c) => !enDominio(DOMINIOS.condicion, c))) {
    e.push('condiciones')
  }
  if (inputs.cribado_tca !== null && inputs.cribado_tca !== undefined && !enDominio(DOMINIOS.cribado_tca, inputs.cribado_tca)) {
    e.push('cribado_tca')
  }
  if (![2, 3, 4, 5, 6].includes(inputs.n_comidas)) e.push('n_comidas')

  // --- v1.1: campos opcionales. Ausente o `null` es SIEMPRE válido (§1.1); presente, debe
  // pertenecer a su dominio. `menstruacion` con `sexo = 'hombre'` no es un error: se valida y
  // después el paso 0 la ignora.
  const opcional = (valor: unknown, dominio: readonly string[], campo: string): void => {
    if (valor !== undefined && valor !== null && !enDominio(dominio, valor)) e.push(campo)
  }
  opcional(inputs.recomposicion_prioridad, DOMINIOS.recomposicion_prioridad, 'recomposicion_prioridad')
  opcional(inputs.menstruacion, DOMINIOS.menstruacion, 'menstruacion')
  opcional(inputs.preferencia_base, DOMINIOS.preferencia_base, 'preferencia_base')
  if (
    inputs.restricciones !== undefined &&
    inputs.restricciones !== null &&
    (!Array.isArray(inputs.restricciones) ||
      inputs.restricciones.some((r) => !enDominio(DOMINIOS.restriccion, r)))
  ) {
    e.push('restricciones')
  }
  if (inputs.low_carb !== undefined && inputs.low_carb !== null && typeof inputs.low_carb !== 'boolean') {
    e.push('low_carb')
  }

  // --- enteros y formato de fecha
  if (!Number.isInteger(inputs.edad)) e.push('edad')
  if (!Number.isInteger(ent.dias_semana)) e.push('entrenamiento.dias_semana')
  if (ent.tipo !== 'ninguno' && !Number.isInteger(ent.minutos_sesion)) e.push('entrenamiento.minutos_sesion')
  if (
    typeof inputs.fecha_inicio !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(inputs.fecha_inicio) ||
    Number.isNaN(Date.parse(`${inputs.fecha_inicio}T00:00:00Z`))
  ) {
    e.push('fecha_inicio')
  }
  if (e.length) return e // sin dominio válido no tiene sentido validar rangos

  // --- rangos numéricos
  if (!enRango(inputs.edad, 0, 120)) e.push('edad') // nota †: 18–75 lo decide el paso 0
  if (!enRango(inputs.altura_cm, 130, 230)) e.push('altura_cm')
  if (!enRango(inputs.peso_kg, 35, 300)) e.push('peso_kg')
  if (grasa.metodo === 'conocido' && !enRango(grasa.valor, 3, 70)) e.push('grasa.valor')
  if (grasa.metodo === 'medidas') {
    if (!enRango(grasa.cuello_cm, 25, 60)) e.push('grasa.cuello_cm')
    if (!enRango(grasa.cintura_cm, 50, 200)) e.push('grasa.cintura_cm')
    if (inputs.sexo === 'mujer' && !enRango(grasa.cadera_cm, 60, 200)) e.push('grasa.cadera_cm')
  }
  if (grasa.metodo === 'visual') {
    const tabla: Record<string, number> = inputs.sexo === 'hombre' ? VISUAL_HOMBRE : VISUAL_MUJER
    if (typeof grasa.categoria !== 'string' || !(grasa.categoria in tabla)) e.push('grasa.categoria')
  }
  if (inputs.peso_objetivo !== null && inputs.peso_objetivo !== undefined && !enRango(inputs.peso_objetivo, 30, 300)) {
    e.push('peso_objetivo')
  }
  if (ent.tipo !== 'ninguno' && !enRango(ent.minutos_sesion, 10, 240)) {
    e.push('entrenamiento.minutos_sesion')
  }
  if (!enRango(ent.dias_semana, 0, 7)) e.push('entrenamiento.dias_semana')
  const imc = inputs.peso_kg / (inputs.altura_cm / 100) ** 2
  if (imc < 12 || imc > 60) e.push('peso_kg+altura_cm')
  return e
}

/** Frases legibles por campo para acompañar a `ERR_INPUT_RANGO` en la interfaz y en el PDF. */
export function mensajesDeErrores(errores: readonly string[]): string[] {
  return errores.map((campo) => ETIQUETAS_CAMPO[campo] ?? campo)
}
