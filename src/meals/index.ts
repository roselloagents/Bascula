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
import type { FoodQuery, Plantilla, RolComida } from './plantillas'
import { BANCOS, plantillasDe } from './plantillas'
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
  notaProteinaLejos,
} from './textos'

/** Por debajo de esta energía la toma se resuelve con una plantilla de snack. */
const KCAL_TOMA_PEQUENA = 150
/** Por encima de esta energía la toma se reparte en dos platos. */
const KCAL_TOMA_GRANDE = 1100
/** Por debajo de esta energía la ración fija de verdura o fruta condiciona toda la toma. */
const KCAL_TOMA_LIGERA = 260

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

/** Filtro por preferencia dietética; se aplica antes que ningún otro criterio (§3.2). */
function pasaPreferencia(a: Alimento, preferencia: Preferencia): boolean {
  switch (preferencia) {
    case 'vegano':
      return a.tags.includes('vegano')
    case 'vegetariano':
      return a.tags.includes('vegetariano')
    case 'sin_lactosa':
      return a.grupo !== 'lacteo' || a.tags.includes('sin_lactosa')
    case 'sin_gluten':
      return a.tags.includes('sin_gluten')
    case 'low_carb':
    case 'omnivoro':
      return true
  }
}

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
  const validos = ALIMENTOS.filter((a) => pasaPreferencia(a, preferencia) && pasaQuery(a, q))
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
  const i = ctx.tomaLigera ? 0 : ctx.indiceComida
  const carbohidrato = elegirAlimento(p.ancla_carbohidrato, ctx, i + rotHc, false)
  const grasa = elegirAlimento(p.ancla_grasa, ctx, i + rotHc, false)
  const rotV = Math.max(0, rotVegetal)
  const verdura = elegirAlimento(p.verdura, ctx, i * 2 + rotV, rotVegetal >= 0)
  const fruta = elegirAlimento(p.fruta, ctx, i + rotV, rotVegetal >= 0)
  // Una FoodQuery obligatoria sin alimentos válidos descarta la plantilla (§3.2).
  if (p.ancla_carbohidrato && !carbohidrato && ctx.preferencia !== 'low_carb') return null
  if (p.verdura && !verdura) return null
  if (p.fruta && !fruta) return null
  return { id: p.id, proteina, proteina2, carbohidrato, grasa, verdura, fruta }
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

/** Genera el menú de una toma probando las plantillas de su rol en el orden del banco (§3.2). */
function construirComida(comida: Comida, ctx: Contexto, banco: readonly Plantilla[], usadas: Set<string>): ComidaResuelta {
  const objetivo: Macros = { kcal: comida.kcal, prot: comida.proteina_g, carb: comida.hc_g, fat: comida.grasa_g }
  const rol = rolComidaDe(comida.nombre, comida.kcal)
  ctx.tomaLigera = comida.kcal < KCAL_TOMA_LIGERA
  const disponibles = plantillasDe(banco, rol)
  const noUsadas = disponibles.filter((p) => !usadas.has(p.id))
  // Rotación circular: si se agotaron las plantillas del rol, se vuelve a empezar (§3.2).
  // Las plantillas ligeras cierran la lista: son el último recurso de una toma que no cabe
  // en ninguna plantilla de su propio rol (desayunos y comidas muy pequeños).
  const orden = [
    ...(noUsadas.length > 0 ? [...noUsadas, ...disponibles] : disponibles),
    ...(rol === 'ligera' ? [] : plantillasDe(banco, 'ligera')),
  ]

  // Una toma de más de 1.100 kcal no cabe en un solo plato: se sirve en dos (o tres si hace falta).
  const platosMin = objetivo.kcal > KCAL_TOMA_GRANDE ? 2 : 1
  const opcionesPlatos = [platosMin, platosMin + 1, platosMin + 2].filter((n) => n <= 3)

  let mejor: { porciones: Porcion[]; plantillas: string[]; platos: number } | null = null
  let mejorDesviacion = Number.POSITIVE_INFINITY
  let mejorNota = Number.POSITIVE_INFINITY

  busqueda: for (const platos of opcionesPlatos) {
    for (const plantilla of orden) {
      for (const rotProteina of ROTACIONES_PROTEINA) {
        for (const rotVegetal of ROTACIONES_VEGETAL) {
          for (const rotHc of ROTACIONES_HC) {
            const resuelta = resolverPlantilla(plantilla, ctx, rotProteina, rotVegetal, rotHc)
            if (!resuelta) continue
            const porciones = escalarComida(objetivo, resuelta, ctx.preferencia === 'low_carb', platos)
            const desvKcal = objetivo.kcal > 0 ? Math.abs(kcalPublicada(porciones) - objetivo.kcal) / objetivo.kcal : 0
            const desvProt =
              objetivo.prot > 0 ? Math.abs(proteinaPublicada(porciones) - objetivo.prot) / objetivo.prot : 0
            // Nota combinada: 1 es justo el límite de cada tolerancia; manda la peor de las dos.
            const nota = Math.max(desvKcal / TOLERANCIA_KCAL, desvProt / TOLERANCIA_PROTEINA)
            if (nota < mejorNota) {
              mejorNota = nota
              mejorDesviacion = desvKcal
              mejor = { porciones, plantillas: [resuelta.id], platos }
            }
            if (nota <= 1) break busqueda
            if (!resuelta.carbohidrato && !resuelta.grasa) break
          }
          if (!llevaVegetal(plantilla)) break
        }
      }
    }
  }

  if (!mejor) {
    // La validación de la base hace imposible quedarse sin plantilla; si pasara, no se
    // muestra una comida vacía: se devuelve la toma sin alimentos y se anota más arriba.
    mejor = { porciones: [], plantillas: [], platos: 1 }
    mejorDesviacion = 1
  }

  for (const p of mejor.porciones) {
    if (p.rol === 'proteina' || p.rol === 'proteina2') ctx.usados.add(p.alimento.id)
    if (p.rol === 'verdura' || p.rol === 'fruta') ctx.usados.add(p.alimento.id)
  }
  for (const id of mejor.plantillas) usadas.add(id)

  const alimentos = mejor.porciones.map(porcionAPorcionUi)
  const totales: Macros = {
    kcal: alimentos.reduce((t, a) => t + a.kcal, 0),
    prot: redondea1(alimentos.reduce((t, a) => t + a.prot, 0)),
    carb: redondea1(alimentos.reduce((t, a) => t + a.carb, 0)),
    fat: redondea1(alimentos.reduce((t, a) => t + a.fat, 0)),
  }
  // Las desviaciones se miden sobre los totales publicados (los de `totales`), no sobre las
  // sumas internas sin redondear: es lo que ve la pantalla y lo que comprueban los tests.
  const desviacionProteina = objetivo.prot > 0 ? Math.abs(totales.prot - objetivo.prot) / objetivo.prot : 0
  const desviacionKcal = objetivo.kcal > 0 ? Math.abs(totales.kcal - objetivo.kcal) / objetivo.kcal : mejorDesviacion

  return {
    ejemplo: {
      comida: comida.nombre,
      hora: comida.hora,
      peri: comida.peri,
      objetivo,
      alimentos,
      totales,
      alternativas: alternativasComida(mejor.porciones, ALIMENTOS),
    },
    porciones: mejor.porciones,
    converge: desviacionKcal <= TOLERANCIA_KCAL,
    desviacionKcal,
    desviacionProteina,
    plantillas: mejor.plantillas,
    platos: mejor.platos,
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
export function generarEjemplos(inputs: Inputs, resultado: Resultado): Ejemplos {
  const preferencia = resultado.preferencia_efectiva

  // Corte de seguridad por condiciones, antes que nada (§3.1).
  if (inputs.condiciones.includes('renal') || inputs.condiciones.includes('hepatica')) {
    return {
      entreno: diaSinMenu('entreno'),
      descanso: diaSinMenu('descanso'),
      consejos: consejos(resultado.objetivo_efectivo, preferencia, inputs.n_comidas),
    }
  }

  const offset = inputs.n_comidas + inputs.edad
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
    if (resultado.comidas[i].kcal > KCAL_TOMA_GRANDE) {
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

  const comidas = dia.comidas.map((c) => c.ejemplo)
  const totales = totalesDia(dia.comidas)
  const entreno: EjemploDia = { tipo: 'entreno', comidas, totales, notas }
  const descanso: EjemploDia = { tipo: 'descanso', comidas, totales, notas }

  return {
    entreno,
    descanso,
    consejos: consejos(resultado.objetivo_efectivo, preferencia, inputs.n_comidas),
  }
}
