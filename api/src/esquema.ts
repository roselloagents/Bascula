// Esquemas de zod de la entrada HTTP y de la salida del modelo (SPEC-dieta-propia §2.3 y §3.4).
// El esquema de salida lleva SOLO tipos, enums y estructura: ninguna longitud, rango ni regex
// (el SDK las quita del JSON Schema y las valida en cliente, y una salida útil fallaría el `parse`).
// Los opcionales del tipo del front son obligatorios y `nullable()` aquí.
import * as z from 'zod/v4'
import { sanear } from './saneado.ts'

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
