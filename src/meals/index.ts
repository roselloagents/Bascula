// Generador de ejemplos de comidas — docs/SPEC-ux-comidas-pdf.md §3.
// Módulo puro y determinista: mismos inputs → mismo menú. Sin Math.random.
// Mantener EXACTAMENTE esta firma exportada: la UI y el PDF dependen de ella.
import type { Alimento } from '../data/foods'
import { ALIMENTOS } from '../data/foods'
import type {
  AlimentoPorcion,
  Comida,
  EjemploComida,
  EjemploDia,
  Ejemplos,
  Inputs,
  Macros,
  Preferencia,
  Resultado,
} from '../engine/types'
import type { PlantillaResuelta, Porcion } from './escalado'
import {
  TOLERANCIA_KCAL,
  TOLERANCIA_PROTEINA,
  escalarComida,
  kcalPublicada,
  limiteRacion,
  proteinaPublicada,
  sumaFibra,
  textoMedida,
} from './escalado'
import { equivalencias } from './equivalencias'
import { esVarianteSinLactosa, pasaPreferencia } from './filtros'
import type { FoodQuery, Plantilla, RolComida } from './plantillas'
import { BANCOS, HC_LOW_CARB_ALTERNO, plantillasDe } from './plantillas'
import {
  NOTA_CARDIACA,
  NOTA_DIABETES,
  TEXTO_SIN_MENU,
  alternativasComida,
  avisoProteinaVegetal,
  consejos,
  nombreCorto,
  notaComidaLejos,
  notaDosPlatos,
  notaFibra,
  notaMacroDia,
  notaProteinaLejos,
} from './textos'

/** Por debajo de esta energía la toma se resuelve con una plantilla de snack. */
const KCAL_TOMA_PEQUENA = 150
/**
 * Energía máxima de un plato. Por encima, ninguna combinación de alimentos cabe dentro de los
 * máximos de ración de §3.3, así que la toma se reparte en varios platos (cada uno con su
 * plantilla y su parte del objetivo) en vez de ampliar las raciones.
 */
const KCAL_PLATO = 900
/** Como mucho cuatro platos por toma: más allá, el ejemplo deja de ser legible. */
const PLATOS_MAX = 4
/** Por debajo de esta energía la ración fija de verdura o fruta condiciona toda la toma. */
const KCAL_TOMA_LIGERA = 260
/** Desviación diaria de hidrato o grasa a partir de la cual el menú lleva su nota. */
const TOLERANCIA_MACRO_DIA = 0.2
/** Con `diabetes` el hidrato se vigila más de cerca: es el macro que ajusta la medicación. */
const TOLERANCIA_HC_DIABETES = 0.1

interface Contexto {
  preferencia: Preferencia
  /** Desplazamiento determinista derivado de los inputs; da variedad entre usuarios. */
  offset: number
  /** Ids de proteína ya usados ese día: evita repetir la misma en todas las tomas. */
  usados: Set<string>
  /** Contador de comidas resueltas: rota verduras y frutas dentro del día. */
  indiceComida: number
  /** Ordena los candidatos de verdura y legumbre por fibra descendente (§3.3). */
  priorizarFibra: boolean
  /** Toma pequeña: la ración fija de verdura o fruta se elige entre las menos energéticas. */
  tomaLigera: boolean
  /** Índice del plato dentro de la toma: desplaza la rotación para que los platos no se repitan. */
  plato: number
}

interface ComidaResuelta {
  ejemplo: EjemploComida
  porciones: Porcion[]
  converge: boolean
  desviacionKcal: number
  desviacionProteina: number
  plantillas: string[]
  /** Número de platos en que se sirve la toma (1 salvo tomas muy grandes). */
  platos: number
}

// ---------- Filtros de alimentos ----------

function pasaQuery(a: Alimento, q: FoodQuery): boolean {
  if (q.rol && !a.roles.includes(q.rol)) return false
  if (q.grupo && a.grupo !== q.grupo) return false
  // Los cereales, pastas y arroces en crudo están fuera del banco de plantillas (§3.0).
  const excluidos = q.estado_excluye ?? (a.grupo === 'carbohidrato' ? ['crudo'] : [])
  if (excluidos.includes(a.estado)) return false
  if (q.proteina_min !== undefined && a.proteina < q.proteina_min) return false
  if (q.hc_max !== undefined && a.carbohidratos > q.hc_max) return false
  if (q.grasa_min !== undefined && a.grasa < q.grasa_min) return false
  if (q.grasa_max !== undefined && a.grasa > q.grasa_max) return false
  if (q.tags_incluye && !q.tags_incluye.every((t) => a.tags.includes(t))) return false
  if (q.tags_excluye && q.tags_excluye.some((t) => a.tags.includes(t))) return false
  return true
}

/**
 * Candidatos de una consulta separados en dos tramos: los `ids_preferidos` que pasan los
 * filtros (por donde rota la variedad) y el resto de la base como reserva.
 */
function candidatos(q: FoodQuery, preferencia: Preferencia): { preferidos: Alimento[]; reserva: Alimento[] } {
  // Las variantes «sin lactosa» solo entran en la rotación de quien las necesita; para el resto
  // de preferencias quedan como reserva (§3.2): son el mismo alimento, más caro y sin motivo.
  const validos = ALIMENTOS.filter(
    (a) =>
      pasaPreferencia(a, preferencia) &&
      pasaQuery(a, q) &&
      (preferencia === 'sin_lactosa' || !esVarianteSinLactosa(a)),
  )
  if (!q.ids_preferidos) {
    return { preferidos: [...validos].sort((x, y) => x.id.localeCompare(y.id)), reserva: [] }
  }
  const preferidos = q.ids_preferidos
    .map((id) => validos.find((a) => a.id === id))
    .filter((a): a is Alimento => a !== undefined)
  const reserva = validos.filter((a) => !preferidos.includes(a)).sort((x, y) => x.id.localeCompare(y.id))
  return { preferidos, reserva }
}

/**
 * Elige un alimento de la consulta. La rotación se aplica solo dentro de `ids_preferidos`
 * (el orden que declara la plantilla); el resto de la base es reserva si esa lista se vacía.
 */
function elegirAlimento(q: FoodQuery | null, ctx: Contexto, rotacion: number, evitarUsados: boolean): Alimento | null {
  if (!q) return null
  const { preferidos, reserva } = candidatos(q, ctx.preferencia)
  let lista = preferidos.length > 0 ? preferidos : reserva
  if (lista.length === 0) return null
  const esVegetal = q.grupo === 'verdura' || q.grupo === 'fruta' || q.rol === 'verdura' || q.rol === 'fruta'
  if (ctx.priorizarFibra && (q.grupo === 'verdura' || q.rol === 'verdura')) {
    lista = [...lista].sort((x, y) => y.fibra - x.fibra)
  } else if (ctx.tomaLigera && esVegetal) {
    // En una toma pequeña la ración fija manda: se ordenan por energía de la ración ascendente.
    const energia = (a: Alimento): number => (a.kcal * a.racionTipica_g) / 100
    lista = [...lista].sort((x, y) => energia(x) - energia(y) || x.id.localeCompare(y.id))
  } else if (ctx.tomaLigera && q.rol === 'proteina') {
    // Ídem con la proteína: en un snack manda el mínimo de ración, no el orden de la plantilla.
    const proteinaMinima = (a: Alimento): number => (a.proteina * limiteRacion(a).min) / 100
    lista = [...lista].sort((x, y) => proteinaMinima(x) - proteinaMinima(y) || x.id.localeCompare(y.id))
  }
  // En una toma pequeña manda el mínimo de ración, así que se empieza siempre por el primero
  // de la lista (el más ligero) en vez de por el desplazamiento del usuario.
  const base = ctx.tomaLigera ? rotacion : ctx.offset + rotacion
  const inicio = (((base % lista.length) + lista.length) % lista.length)
  if (evitarUsados) {
    for (let k = 0; k < lista.length; k++) {
      const c = lista[(inicio + k) % lista.length]
      if (!ctx.usados.has(c.id)) return c
    }
  }
  return lista[inicio]
}

// ---------- Construcción de una comida ----------

const CACHE_PREFERENCIA = new Map<Preferencia, Alimento[]>()

/** Alimentos que pasan el filtro de preferencia; se reutiliza en alternativas y equivalencias. */
function alimentosDePreferencia(preferencia: Preferencia): Alimento[] {
  const guardado = CACHE_PREFERENCIA.get(preferencia)
  if (guardado) return guardado
  const lista = ALIMENTOS.filter((a) => pasaPreferencia(a, preferencia))
  CACHE_PREFERENCIA.set(preferencia, lista)
  return lista
}

function rolComidaDe(nombre: string, kcal: number): RolComida {
  if (kcal > 0 && kcal < KCAL_TOMA_PEQUENA) return 'ligera'
  if (nombre === 'Desayuno') return 'desayuno'
  if (nombre === 'Comida' || nombre === 'Cena') return 'principal'
  return 'ligera'
}

function resolverPlantilla(
  p: Plantilla,
  ctx: Contexto,
  rotProteina: number,
  rotVegetal: number,
  rotHc: number,
): PlantillaResuelta | null {
  const proteina = elegirAlimento(p.ancla_proteina, ctx, Math.max(0, rotProteina), rotProteina >= 0)
  if (!proteina) return null
  const proteina2 = elegirAlimento(p.ancla_proteina_2, ctx, 1 + Math.max(0, rotProteina), false)
  // En una toma pequeña la búsqueda arranca en el primer candidato (el más ligero), sin sumarle
  // el índice de la comida: la variedad la da `usados`, no el desplazamiento.
  const i = ctx.tomaLigera ? 0 : ctx.indiceComida + ctx.plato
  const carbohidrato = elegirAlimento(p.ancla_carbohidrato, ctx, i + rotHc, false)
  const grasa = elegirAlimento(p.ancla_grasa, ctx, i + rotHc, false)
  const rotV = Math.max(0, rotVegetal)
  const verdura = elegirAlimento(p.verdura, ctx, i * 2 + rotV, rotVegetal >= 0)
  const fruta = elegirAlimento(p.fruta, ctx, i + rotV, rotVegetal >= 0)
  // Una FoodQuery obligatoria sin alimentos válidos descarta la plantilla (§3.2).
  if (p.ancla_carbohidrato && !carbohidrato && ctx.preferencia !== 'low_carb') return null
  if (p.verdura && !verdura) return null
  if (p.fruta && !fruta) return null
  // Cereal normal de respaldo, solo en low-carb: lo usa `escalarComida` si el ancla low-carb no
  // puede cubrir el hidrato del plan ni con su ración máxima (§3.2).
  const carbohidrato_alterno =
    ctx.preferencia === 'low_carb' ? elegirAlimento(HC_LOW_CARB_ALTERNO, ctx, i + rotHc, false) : null
  return { id: p.id, proteina, proteina2, carbohidrato, carbohidrato_alterno, grasa, verdura, fruta }
}

function redondea1(n: number): number {
  return Math.round(n * 10) / 10
}

function porcionAPorcionUi(p: Porcion): AlimentoPorcion {
  return {
    id: p.alimento.id,
    nombre: p.alimento.nombre,
    gramos: p.gramos,
    medida: textoMedida(p.alimento, p.gramos),
    kcal: Math.round((p.alimento.kcal * p.gramos) / 100),
    prot: redondea1((p.alimento.proteina * p.gramos) / 100),
    carb: redondea1((p.alimento.carbohidratos * p.gramos) / 100),
    fat: redondea1((p.alimento.grasa * p.gramos) / 100),
  }
}

/** `true` si la plantilla lleva verdura o fruta: solo entonces rotarlas cambia algo. */
function llevaVegetal(p: Plantilla): boolean {
  return p.verdura !== null || p.fruta !== null
}

/**
 * Rotaciones de alimento que se prueban dentro de cada plantilla antes de descartarla.
 * El valor `-1` significa "vuelve al primer candidato aunque ya se haya usado hoy": la variedad
 * es deseable, pero no a costa de sacar la toma de la tolerancia (§3.3 manda sobre §3.4).
 */
const ROTACIONES_PROTEINA = [0, 1, 2, -1]
const ROTACIONES_VEGETAL = [0, 1, -1]
const ROTACIONES_HC = [0, 1]

/** Busca el mejor plato para un objetivo dado, dentro de las plantillas del rol (§3.2). */
function construirPlato(
  objetivo: Macros,
  rol: RolComida,
  ctx: Contexto,
  banco: readonly Plantilla[],
  usadas: Set<string>,
): { porciones: Porcion[]; plantillas: string[] } {
  const disponibles = plantillasDe(banco, rol)
  const noUsadas = disponibles.filter((p) => !usadas.has(p.id))
  // Rotación circular: si se agotaron las plantillas del rol, se vuelve a empezar (§3.2).
  // Las plantillas ligeras cierran la lista: son el último recurso de una toma que no cabe
  // en ninguna plantilla de su propio rol (desayunos y comidas muy pequeños).
  const orden = [
    ...(noUsadas.length > 0 ? [...noUsadas, ...disponibles] : disponibles),
    ...(rol === 'ligera' ? [] : plantillasDe(banco, 'ligera')),
  ]

  let mejor: { porciones: Porcion[]; plantillas: string[] } | null = null
  let mejorNota = Number.POSITIVE_INFINITY

  busqueda: for (const plantilla of orden) {
    for (const rotProteina of ROTACIONES_PROTEINA) {
      for (const rotVegetal of ROTACIONES_VEGETAL) {
        for (const rotHc of ROTACIONES_HC) {
          const resuelta = resolverPlantilla(plantilla, ctx, rotProteina, rotVegetal, rotHc)
          if (!resuelta) continue
          const porciones = escalarComida(objetivo, resuelta, ctx.preferencia === 'low_carb')
          const desvKcal = objetivo.kcal > 0 ? Math.abs(kcalPublicada(porciones) - objetivo.kcal) / objetivo.kcal : 0
          const desvProt =
            objetivo.prot > 0 ? Math.abs(proteinaPublicada(porciones) - objetivo.prot) / objetivo.prot : 0
          // Nota combinada: 1 es justo el límite de cada tolerancia; manda la peor de las dos.
          const nota = Math.max(desvKcal / TOLERANCIA_KCAL, desvProt / TOLERANCIA_PROTEINA)
          if (nota < mejorNota) {
            mejorNota = nota
            mejor = { porciones, plantillas: [resuelta.id] }
          }
          if (nota <= 1) break busqueda
          if (!resuelta.carbohidrato && !resuelta.grasa) break
        }
        if (!llevaVegetal(plantilla)) break
      }
    }
  }

  // La validación de la base hace imposible quedarse sin plantilla; si pasara, no se muestra
  // una comida vacía: se devuelve el plato sin alimentos y se anota más arriba.
  if (!mejor) return { porciones: [], plantillas: [] }

  for (const p of mejor.porciones) {
    if (p.rol === 'proteina' || p.rol === 'proteina2') ctx.usados.add(p.alimento.id)
    if (p.rol === 'verdura' || p.rol === 'fruta') ctx.usados.add(p.alimento.id)
  }
  for (const id of mejor.plantillas) usadas.add(id)
  return mejor
}

/**
 * Genera el menú de una toma. Por encima de 1.100 kcal ningún plato cabe dentro de los máximos
 * de ración de §3.3, así que la toma se reparte en varios platos —cada uno con su propia
 * plantilla y su parte del objetivo— en vez de ampliar las raciones, que es lo que la §3.3
 * prohíbe expresamente ("respetando siempre los límites de ración").
 */
function construirComida(comida: Comida, ctx: Contexto, banco: readonly Plantilla[], usadas: Set<string>): ComidaResuelta {
  const objetivo: Macros = { kcal: comida.kcal, prot: comida.proteina_g, carb: comida.hc_g, fat: comida.grasa_g }
  const rol = rolComidaDe(comida.nombre, comida.kcal)
  ctx.tomaLigera = comida.kcal < KCAL_TOMA_LIGERA
  const platos = Math.min(PLATOS_MAX, Math.max(1, Math.ceil(objetivo.kcal / KCAL_PLATO)))

  const porciones: Porcion[] = []
  const plantillas: string[] = []
  for (let i = 0; i < platos; i++) {
    const parte: Macros = {
      kcal: objetivo.kcal / platos,
      prot: objetivo.prot / platos,
      carb: objetivo.carb / platos,
      fat: objetivo.fat / platos,
    }
    ctx.plato = i
    const plato = construirPlato(parte, rol, ctx, banco, usadas)
    porciones.push(...plato.porciones)
    plantillas.push(...plato.plantillas)
  }

  const alimentos = porciones.map(porcionAPorcionUi)
  const totales: Macros = {
    kcal: alimentos.reduce((t, a) => t + a.kcal, 0),
    prot: redondea1(alimentos.reduce((t, a) => t + a.prot, 0)),
    carb: redondea1(alimentos.reduce((t, a) => t + a.carb, 0)),
    fat: redondea1(alimentos.reduce((t, a) => t + a.fat, 0)),
  }
  // Las desviaciones se miden sobre los totales publicados (los de `totales`), no sobre las
  // sumas internas sin redondear: es lo que ve la pantalla y lo que comprueban los tests.
  const desviacionProteina = objetivo.prot > 0 ? Math.abs(totales.prot - objetivo.prot) / objetivo.prot : 0
  const desviacionKcal = objetivo.kcal > 0 ? Math.abs(totales.kcal - objetivo.kcal) / objetivo.kcal : 1

  return {
    ejemplo: {
      comida: comida.nombre,
      hora: comida.hora,
      peri: comida.peri,
      objetivo,
      alimentos,
      totales,
      // Las alternativas se buscan SOLO entre los alimentos que pasan el filtro de preferencia:
      // recomendar por escrito pollo a una persona vegana rompía la promesa de la pantalla.
      alternativas: alternativasComida(porciones, alimentosDePreferencia(ctx.preferencia)),
    },
    porciones,
    converge: desviacionKcal <= TOLERANCIA_KCAL,
    desviacionKcal,
    desviacionProteina,
    plantillas,
    platos,
  }
}

// ---------- Construcción del día ----------

interface DiaConstruido {
  comidas: ComidaResuelta[]
  fibra: number
  convergen: boolean
}

function construirDia(resultado: Resultado, preferencia: Preferencia, offset: number, priorizarFibra: boolean): DiaConstruido {
  const ctx: Contexto = {
    preferencia,
    offset,
    usados: new Set(),
    indiceComida: 0,
    priorizarFibra,
    tomaLigera: false,
    plato: 0,
  }
  const banco = BANCOS[preferencia]
  const usadas = new Set<string>()
  const comidas: ComidaResuelta[] = []
  for (const comida of resultado.comidas) {
    comidas.push(construirComida(comida, ctx, banco, usadas))
    ctx.indiceComida += 1
    // Las proteínas se reservan dentro del día; verduras y frutas se liberan si se agotan.
    if (ctx.usados.size > 24) ctx.usados.clear()
  }
  const fibra = comidas.reduce((t, c) => t + sumaFibra(c.porciones), 0)
  return { comidas, fibra, convergen: comidas.every((c) => c.converge) }
}

function totalesDia(comidas: readonly ComidaResuelta[]): Macros {
  return {
    kcal: comidas.reduce((t, c) => t + c.ejemplo.totales.kcal, 0),
    prot: redondea1(comidas.reduce((t, c) => t + c.ejemplo.totales.prot, 0)),
    carb: redondea1(comidas.reduce((t, c) => t + c.ejemplo.totales.carb, 0)),
    fat: redondea1(comidas.reduce((t, c) => t + c.ejemplo.totales.fat, 0)),
  }
}

/** Día sin menú: condición renal o hepática (§3.1). */
function diaSinMenu(tipo: 'entreno' | 'descanso'): EjemploDia {
  return { tipo, comidas: [], totales: { kcal: 0, prot: 0, carb: 0, fat: 0 }, notas: [TEXTO_SIN_MENU] }
}

/**
 * Genera un día de ejemplo que cuadra con el reparto por comidas del motor.
 * En la v1 el motor devuelve UN solo array `comidas` (SPEC-calculo §2 Paso 16): no hay reparto de día
 * de entreno y de día de descanso, así que ambos días del contrato salen del mismo reparto.
 */
export function generarEjemplos(inputs: Inputs, resultado: Resultado, variante = 0): Ejemplos {
  const preferencia = resultado.preferencia_efectiva
  const tablas = equivalencias(preferencia)

  // Corte de seguridad por condiciones, antes que nada (§3.1).
  if (inputs.condiciones.includes('renal') || inputs.condiciones.includes('hepatica')) {
    return {
      entreno: diaSinMenu('entreno'),
      descanso: diaSinMenu('descanso'),
      consejos: consejos(resultado.objetivo_efectivo, preferencia, inputs.n_comidas),
      equivalencias: tablas,
    }
  }

  // "Ver otro ejemplo" (§2.5) desplaza el índice de arranque en +1: mismo plan, otras plantillas.
  const offset = inputs.n_comidas + inputs.edad + Math.max(0, Math.trunc(variante))
  let dia = construirDia(resultado, preferencia, offset, false)

  // Comprobación de fibra (§3.3): primero se rota a verduras de más fibra; si aun así no llega, nota.
  const fibraObjetivo = resultado.macros.fibra_g
  const umbralFibra = 0.7 * fibraObjetivo
  if (dia.fibra < umbralFibra) {
    const alterno = construirDia(resultado, preferencia, offset, true)
    const mejora = alterno.fibra > dia.fibra
    const noEmpeora = alterno.convergen || !dia.convergen
    if (mejora && noEmpeora) dia = alterno
  }

  const notas: string[] = []
  if (inputs.condiciones.includes('diabetes')) notas.push(NOTA_DIABETES)
  if (inputs.condiciones.includes('cardiaca')) notas.push(NOTA_CARDIACA)

  for (let i = 0; i < dia.comidas.length; i++) {
    const c = dia.comidas[i]
    if (c.platos > 1) {
      notas.push(notaDosPlatos(c.ejemplo.comida, resultado.comidas[i].kcal, c.platos))
    }
    if (c.porciones.length > 0) {
      const ajustable =
        c.porciones.find((p) => p.rol === 'carbohidrato') ??
        c.porciones.find((p) => p.rol === 'grasa') ??
        c.porciones[c.porciones.length - 1]
      if (!c.converge) {
        notas.push(
          notaComidaLejos(
            c.ejemplo.comida,
            c.ejemplo.totales.kcal - c.ejemplo.objetivo.kcal,
            nombreCorto(ajustable.alimento),
          ),
        )
      }
      if (c.desviacionProteina > TOLERANCIA_PROTEINA) {
        const proteico = c.porciones.find((p) => p.rol === 'proteina') ?? ajustable
        notas.push(
          notaProteinaLejos(
            c.ejemplo.comida,
            c.ejemplo.totales.prot,
            c.ejemplo.objetivo.prot,
            nombreCorto(proteico.alimento),
          ),
        )
      }
    }
  }

  // Aviso propio del módulo: proteína vegetal fuera del umbral terminal del ±15 % (§3.3).
  const esVegetal = preferencia === 'vegano' || preferencia === 'vegetariano'
  if (esVegetal && dia.comidas.some((c) => c.desviacionProteina > TOLERANCIA_PROTEINA)) {
    notas.push(avisoProteinaVegetal(resultado.comidas.length, resultado.macros.proteina_g))
  }

  if (dia.fibra < umbralFibra) notas.push(notaFibra(dia.fibra, fibraObjetivo))

  // Desviación diaria de hidrato y grasa: el cierre solo vigila kcal y proteína, así que estos
  // dos macros pueden alejarse del reparto que la propia pantalla imprime dos bloques más arriba.
  const totalesDelDia = totalesDia(dia.comidas)
  const diabetes = inputs.condiciones.includes('diabetes')
  const limiteHc = diabetes ? TOLERANCIA_HC_DIABETES : TOLERANCIA_MACRO_DIA
  if (
    resultado.macros.hc_g > 0 &&
    Math.abs(totalesDelDia.carb - resultado.macros.hc_g) / resultado.macros.hc_g > limiteHc
  ) {
    notas.push(notaMacroDia('hidratos', totalesDelDia.carb, resultado.macros.hc_g, diabetes))
  }
  if (
    resultado.macros.grasa_g > 0 &&
    Math.abs(totalesDelDia.fat - resultado.macros.grasa_g) / resultado.macros.grasa_g > TOLERANCIA_MACRO_DIA
  ) {
    notas.push(notaMacroDia('grasa', totalesDelDia.fat, resultado.macros.grasa_g, false))
  }

  const comidas = dia.comidas.map((c) => c.ejemplo)
  const totales = totalesDelDia
  const entreno: EjemploDia = { tipo: 'entreno', comidas, totales, notas }
  const descanso: EjemploDia = { tipo: 'descanso', comidas, totales, notas }

  return {
    entreno,
    descanso,
    consejos: consejos(resultado.objetivo_efectivo, preferencia, inputs.n_comidas),
    equivalencias: tablas,
  }
}
