// Esquemas de zod de la entrada HTTP y de la salida del modelo (SPEC-dieta-propia §2.3 y §3.4).
// El esquema de salida lleva SOLO tipos, enums y estructura: ninguna longitud, rango ni regex
// (el SDK las quita del JSON Schema y las valida en cliente, y una salida útil fallaría el `parse`).
// Los opcionales del tipo del front son obligatorios y `nullable()` aquí.
import * as z from 'zod/v4'
import { numeroEn, sanear } from './saneado.ts'

// ---------- Entrada ----------

export const TEXTO_MIN = 10
export const TEXTO_MAX = 4000
export const COMIDA_MAX = 20

export const EsquemaEntrada = z.object({
  texto: z.string(),
  comidas_plan: z.array(z.string()),
})

export interface Entrada {
  texto: string
  comidas_plan: string[]
}

/** Valida el cuerpo ya parseado. Devuelve `null` cuando no cumple (→ `400 TEXTO_INVALIDO`). */
export function validarEntrada(cuerpo: unknown): Entrada | null {
  const leido = EsquemaEntrada.safeParse(cuerpo)
  if (!leido.success) return null
  const texto = leido.data.texto.trim()
  if (texto.length < TEXTO_MIN || texto.length > TEXTO_MAX) return null
  if (leido.data.comidas_plan.length < 2 || leido.data.comidas_plan.length > 6) return null
  // Los nombres de comida se interpolan en el mensaje `user`: se sanean como todo lo que viene de
  // fuera (control chars, espacios colapsados, NFC) antes de tocar el prompt (§7).
  const comidas = leido.data.comidas_plan.map((n) => sanear(n, COMIDA_MAX))
  if (comidas.some((n) => n === '')) return null
  return { texto, comidas_plan: comidas }
}

// ---------- Salida del modelo ----------

export const ESTADOS = ['crudo', 'cocido', 'seco', 'listo'] as const
export const GRUPOS = [
  'proteina',
  'lacteo',
  'carbohidrato',
  'grasa',
  'verdura',
  'fruta',
  'bebida',
  'otro',
] as const
export const ORIGENES_MACROS = ['catalogo', 'estimado', 'envase'] as const
export const CONFIANZAS = ['alta', 'media', 'baja'] as const
export const TIPOS_GUSTO = ['gusta', 'no_gusta'] as const
export const TIPOS_HABITO = [
  'sin_hidratos',
  'ligera',
  'abundante',
  'misma_cada_dia',
  'n_comidas',
  'frecuencia_semanal',
  'horario',
  'otro',
] as const

export const EsquemaMacros = z.object({
  kcal: z.number(),
  prot: z.number(),
  carb: z.number(),
  fat: z.number(),
  fibra: z.number(),
  alcohol: z.number(),
})

export const EsquemaAlimento = z.object({
  texto: z.string(),
  nombre: z.string(),
  alimento_id: z.string().nullable(),
  estado: z.enum(ESTADOS),
  grupo_aprox: z.enum(GRUPOS),
  gramos: z.number().nullable(),
  unidad: z.object({ nombre: z.string(), gramos: z.number() }).nullable(),
  cantidad_unidades: z.number().nullable(),
  macros_100g: EsquemaMacros,
  origen_macros: z.enum(ORIGENES_MACROS),
  ajustable: z.boolean(),
  confianza: z.enum(CONFIANZAS),
  nota: z.string().nullable(),
})

export const EsquemaComida = z.object({
  nombre: z.string(),
  alimentos: z.array(EsquemaAlimento),
})

export const EsquemaGusto = z.object({
  texto: z.string(),
  tipo: z.enum(TIPOS_GUSTO),
  alimento_ids: z.array(z.string()),
})

export const EsquemaHabito = z.object({
  texto: z.string(),
  tipo: z.enum(TIPOS_HABITO),
  comida: z.string().nullable(),
  valor: z.number().nullable(),
})

export const EsquemaSalida = z.object({
  comidas: z.array(EsquemaComida),
  gustos: z.array(EsquemaGusto),
  habitos: z.array(EsquemaHabito),
  no_entendido: z.array(z.object({ texto: z.string(), sugerencia: z.string().nullable() })),
  notas: z.array(z.string()),
  falta_aceite: z.boolean(),
})

export type SalidaModelo = z.infer<typeof EsquemaSalida>
export type AlimentoModelo = z.infer<typeof EsquemaAlimento>

/** Resumen corto del error de zod para el reintento (§3.1): nunca se manda la salida entera. */
export function resumirError(error: unknown): string {
  if (!(error instanceof z.ZodError)) return 'La respuesta no cumplía el formato pedido.'
  return error.issues
    .slice(0, 6)
    .map((i) => `${i.path.join('.') || '(raíz)'}: ${i.message}`)
    .join('; ')
    .slice(0, 400)
}

// ---------- Entrada de `POST /api/dieta/proponer` (§4bis.1) ----------

export const MAX_HUECOS = 6
export const MAX_COMIDAS_PROPIAS = 8
export const MAX_LINEAS_COMIDA = 15
export const LINEA_MAX = 60
export const MAX_GUSTOS_ENTRADA = 20
export const MAX_HABITOS_ENTRADA = 12
export const MAX_IDS = 40
export const MAX_RESPUESTAS = 4
export const RESPUESTA_MAX = 200
export const VARIANTE_MAX = 20
export const BASES = ['omnivoro', 'vegetariano', 'vegano'] as const
export const RESTRICCIONES = ['sin_lactosa', 'sin_gluten'] as const
/** Las únicas condiciones que viajan (§4bis.1): el resto se queda en el navegador. */
export const CONDICIONES = ['diabetes', 'cardiaca', 'hipertension'] as const

/** Zod solo mira la forma; los rangos y los recortes los pone `validarEntradaProponer`. */
export const EsquemaObjetivo = z.object({
  kcal: z.number(),
  prot: z.number(),
  carb: z.number(),
  fat: z.number(),
})

export const EsquemaHueco = z.object({
  nombre: z.string(),
  hora: z.string().nullable().optional(),
  peri: z.boolean().optional(),
  objetivo: EsquemaObjetivo,
  sin_hidratos: z.boolean().optional(),
})

export const EsquemaContexto = z.object({
  texto: z.string().optional(),
  comidas_propias: z
    .array(z.object({ nombre: z.string(), alimentos: z.array(z.string()) }))
    .optional(),
  gustos: z.array(EsquemaGusto).optional(),
  habitos: z.array(EsquemaHabito).optional(),
  perfil: z
    .object({
      base: z.string().optional(),
      restricciones: z.array(z.string()).optional(),
      low_carb: z.boolean().optional(),
      excluidos: z.array(z.string()).optional(),
      favoritos: z.array(z.string()).optional(),
    })
    .optional(),
  condiciones: z.array(z.string()).optional(),
  menu_sencillo: z.boolean().optional(),
  respuestas: z.array(z.object({ pregunta: z.string(), respuesta: z.string() })).optional(),
  variante: z.number().optional(),
})

export const EsquemaEntradaProponer = z.object({
  huecos: z.array(EsquemaHueco),
  contexto: EsquemaContexto,
})

export interface HuecoEntrada {
  nombre: string
  hora: string | null
  peri: boolean
  objetivo: { kcal: number; prot: number; carb: number; fat: number }
  sin_hidratos: boolean
}

export interface PerfilEntrada {
  base: (typeof BASES)[number]
  restricciones: (typeof RESTRICCIONES)[number][]
  low_carb: boolean
  excluidos: string[]
  favoritos: string[]
}

export interface ContextoEntrada {
  texto: string
  comidas_propias: { nombre: string; alimentos: string[] }[]
  gustos: { texto: string; tipo: (typeof TIPOS_GUSTO)[number]; alimento_ids: string[] }[]
  habitos: {
    texto: string
    tipo: (typeof TIPOS_HABITO)[number]
    comida: string | null
    valor: number | null
  }[]
  perfil: PerfilEntrada
  condiciones: (typeof CONDICIONES)[number][]
  menu_sencillo: boolean
  respuestas: { pregunta: string; respuesta: string }[]
  variante: number
}

export interface EntradaProponer {
  huecos: HuecoEntrada[]
  contexto: ContextoEntrada
}

/** Ids del catálogo: letras, números y guion bajo. Lo que no tenga esta forma no viaja. */
const ID_VALIDO = /^[a-z0-9_]{1,60}$/i

function idsLimpios(valores: string[] | undefined): string[] {
  const vistos = new Set<string>()
  const ids: string[] = []
  for (const bruto of valores ?? []) {
    const id = typeof bruto === 'string' ? bruto.trim() : ''
    if (!ID_VALIDO.test(id) || vistos.has(id)) continue
    vistos.add(id)
    ids.push(id)
    if (ids.length >= MAX_IDS) break
  }
  return ids
}

/**
 * Valida el cuerpo ya parseado de `/api/dieta/proponer`. Devuelve `null` cuando la forma no sirve
 * (→ `400`): fuera de 1–6 huecos, hueco sin nombre, objetivo fuera de rango o texto pasado de
 * largo. Todo lo demás se recorta en silencio a los máximos de §4bis.1 y se sanea como en §3.5:
 * lo que acaba en el prompt no puede traer caracteres de control ni longitudes libres.
 */
export function validarEntradaProponer(cuerpo: unknown): EntradaProponer | null {
  const leido = EsquemaEntradaProponer.safeParse(cuerpo)
  if (!leido.success) return null
  const { huecos: huecosCrudos, contexto: crudo } = leido.data
  if (huecosCrudos.length < 1 || huecosCrudos.length > MAX_HUECOS) return null

  const huecos: HuecoEntrada[] = []
  for (const hueco of huecosCrudos) {
    const nombre = sanear(hueco.nombre, COMIDA_MAX)
    if (nombre === '') return null
    const kcal = numeroEn(hueco.objetivo.kcal, 100, 2500, 0)
    const prot = numeroEn(hueco.objetivo.prot, 0, 300, 1)
    const carb = numeroEn(hueco.objetivo.carb, 0, 300, 1)
    const fat = numeroEn(hueco.objetivo.fat, 0, 300, 1)
    if (kcal === null || prot === null || carb === null || fat === null) return null
    const hora = sanear(hueco.hora, 8)
    huecos.push({
      nombre,
      hora: hora === '' ? null : hora,
      peri: hueco.peri === true,
      objetivo: { kcal, prot, carb, fat },
      sin_hidratos: hueco.sin_hidratos === true,
    })
  }

  const texto = (crudo.texto ?? '').trim()
  if (texto.length > TEXTO_MAX) return null

  const comidasPropias: { nombre: string; alimentos: string[] }[] = []
  for (const comida of (crudo.comidas_propias ?? []).slice(0, MAX_COMIDAS_PROPIAS)) {
    const nombre = sanear(comida.nombre, 40)
    if (nombre === '') continue
    const alimentos = comida.alimentos
      .slice(0, MAX_LINEAS_COMIDA)
      .map((linea) => sanear(linea, LINEA_MAX))
      .filter((linea) => linea !== '')
    comidasPropias.push({ nombre, alimentos })
  }

  const gustos: ContextoEntrada['gustos'] = []
  for (const gusto of (crudo.gustos ?? []).slice(0, MAX_GUSTOS_ENTRADA)) {
    const textoGusto = sanear(gusto.texto, 120)
    const ids = idsLimpios(gusto.alimento_ids)
    if (textoGusto === '' && ids.length === 0) continue
    gustos.push({ texto: textoGusto, tipo: gusto.tipo, alimento_ids: ids })
  }

  const habitos: ContextoEntrada['habitos'] = []
  for (const habito of (crudo.habitos ?? []).slice(0, MAX_HABITOS_ENTRADA)) {
    const textoHabito = sanear(habito.texto, 120)
    if (textoHabito === '') continue
    const comida = sanear(habito.comida, COMIDA_MAX)
    habitos.push({
      texto: textoHabito,
      tipo: habito.tipo,
      comida: comida === '' ? null : comida,
      valor: numeroEn(habito.valor, 0, 24, 0),
    })
  }

  const perfilCrudo = crudo.perfil ?? {}
  const base = (BASES as readonly string[]).includes(perfilCrudo.base ?? '')
    ? (perfilCrudo.base as PerfilEntrada['base'])
    : 'omnivoro'
  const restricciones = (RESTRICCIONES as readonly string[]).filter((r) =>
    (perfilCrudo.restricciones ?? []).includes(r),
  ) as PerfilEntrada['restricciones']
  const condiciones = (CONDICIONES as readonly string[]).filter((c) =>
    (crudo.condiciones ?? []).includes(c),
  ) as ContextoEntrada['condiciones']

  const respuestas: { pregunta: string; respuesta: string }[] = []
  for (const par of (crudo.respuestas ?? []).slice(0, MAX_RESPUESTAS)) {
    const respuesta = sanear(par.respuesta, RESPUESTA_MAX)
    if (respuesta === '') continue
    respuestas.push({ pregunta: sanear(par.pregunta, RESPUESTA_MAX), respuesta })
  }

  // La variante no invalida la petición: se recorta al rango. Quien pulse "Otra propuesta"
  // veintiuna veces merece otra propuesta, no un 400.
  const variante = Math.min(
    VARIANTE_MAX,
    Math.max(0, Math.round(numeroEn(crudo.variante, -1e9, 1e9, 0) ?? 0)),
  )

  return {
    huecos,
    contexto: {
      texto,
      comidas_propias: comidasPropias,
      gustos,
      habitos,
      perfil: {
        base,
        restricciones,
        low_carb: perfilCrudo.low_carb === true,
        excluidos: idsLimpios(perfilCrudo.excluidos),
        favoritos: idsLimpios(perfilCrudo.favoritos),
      },
      condiciones,
      menu_sencillo: crudo.menu_sencillo === true,
      respuestas,
      variante,
    },
  }
}

// ---------- Salida del modelo en `/api/dieta/proponer` (§4bis.1) ----------

export const EsquemaPregunta = z.object({
  texto: z.string(),
  opciones: z.array(z.string()),
})

/** Como `EsquemaSalida`: solo tipos, enums y estructura; los opcionales, `nullable()`. */
export const EsquemaPropuesta = z.object({
  comidas: z.array(EsquemaComida),
  consejo: z.string().nullable(),
  preguntas: z.array(EsquemaPregunta),
})

export type PropuestaModelo = z.infer<typeof EsquemaPropuesta>
export type PreguntaModelo = z.infer<typeof EsquemaPregunta>
