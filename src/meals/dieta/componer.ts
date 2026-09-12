// Composición del día con lo que la persona nos ha contado (docs/SPEC-dieta-propia.md §4).
//
// Las comidas dictadas se conservan —con los gramos ajustados solo si hace falta— y los huecos
// que quedan los monta el generador de menús con el resto del plan. Módulo puro y determinista:
// mismos `DietaInterpretada`, `Inputs`, `Resultado` y `variante` → mismo `DiaCompuesto`, bit a bit.
//
// El generador de menús llega INYECTADO (`Montador`): vive en `src/meals/index.ts`, que a su vez
// importa este módulo para publicar `componerDia`. Inyectarlo evita el ciclo de importación y
// deja este fichero comprobable con un montador de mentira.
import type { Alimento } from '../../data/foods'
import { alimentoPorId } from '../../data/foods'
import type {
  AlimentoAjustado,
  AlimentoPropio,
  Comida,
  ComidaCompuesta,
  ComidaPropia,
  DiaCompuesto,
  DietaInterpretada,
  EjemploComida,
  HabitoPropio,
  Inputs,
  Macros,
  MacrosPropio,
  ModoComposicion,
  Resultado,
} from '../../engine/types'
import { perfilDeResultado } from '../filtros'
import { nombreCorto } from '../textos'
import type { EntradaAjuste, EstadoAjuste, Pieza, Variable } from './ajuste'
import { MACROS, SUELOS, ajustar, cajaDe, estadoDe } from './ajuste'
import {
  AVISOS_NO_CUADRA,
  AVISO_ESTIMADOS,
  AVISO_NO_CUADRA,
  AVISO_SIN_ACEITE,
  AVISO_SIN_VEGETALES,
  aplicadoFavorito,
  aplicadoHabitoHueco,
  aplicadoMismaCadaDia,
  aplicadoSin,
  apuntadoComidaDictada,
  apuntadoFrecuencia,
  apuntadoHorario,
  apuntadoNComidas,
  apuntadoOtro,
  apuntadoSinBase,
  avisoAlcohol,
  avisoFibraBaja,
  avisoGrasaAlta,
  avisoGrasaBaja,
  avisoHcLejos,
  avisoKcalLejos,
  avisoLimitePorFactor,
  avisoLimitePorRacion,
  avisoPendientes,
  avisoPropiasGrandes,
  avisoProteinaCorta,
} from './textos'

/** Lo que `componerDia` necesita del generador de menús: los huecos montados y sus notas. */
export type Montador = (
  huecos: readonly Comida[],
  variante: number,
) => { comidas: EjemploComida[]; notas: string[] }

/** Umbrales de los avisos de §4.4. */
const UMBRAL_PROTEINA = 0.9
const UMBRAL_GRASA_BAJA = 0.8
const UMBRAL_GRASA_ALTA = 1.25
const UMBRAL_KCAL = 0.04
const UMBRAL_HC = 0.2
const UMBRAL_HC_DIABETES = 0.1
const UMBRAL_FIBRA = 0.7
/** Gramos de verdura y fruta por debajo de los cuales el día dictado se queda sin vegetales. */
const GRAMOS_VEGETALES = 300
/** Hidrato que se le deja a un hueco con el hábito `sin_hidratos` (§4.3.2). */
const HC_SIN_HIDRATOS = 10
const FACTOR_LIGERA = 0.7
const FACTOR_ABUNDANTE = 1.3

const CERO: MacrosPropio = { kcal: 0, prot: 0, carb: 0, fat: 0, fibra: 0, alcohol: 0 }

function redondea1(n: number): number {
  return Math.round(n * 10) / 10
}

/** Nombre normalizado de una comida: sin acentos, sin mayúsculas y sin espacios de sobra (§4.1). */
export function normalizarNombre(nombre: string): string {
  return nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

/** Nombre de un alimento para meterlo en una frase (§4.4). */
function nombreEnFrase(a: AlimentoPropio): string {
  const catalogo = a.alimento_id ? alimentoPorId(a.alimento_id) : undefined
  if (catalogo) return nombreCorto(catalogo)
  const base = a.nombre.trim()
  return base.length > 0 ? base.charAt(0).toLowerCase() + base.slice(1) : base
}

function nombreDeId(id: string): string {
  const a: Alimento | undefined = alimentoPorId(id)
  return a ? nombreCorto(a) : id
}

function aporteDe(macros: MacrosPropio, gramos: number): MacrosPropio {
  const f = gramos / 100
  return {
    kcal: macros.kcal * f,
    prot: macros.prot * f,
    carb: macros.carb * f,
    fat: macros.fat * f,
    fibra: macros.fibra * f,
    alcohol: macros.alcohol * f,
  }
}

function suma(a: MacrosPropio, b: MacrosPropio): MacrosPropio {
  return {
    kcal: a.kcal + b.kcal,
    prot: a.prot + b.prot,
    carb: a.carb + b.carb,
    fat: a.fat + b.fat,
    fibra: a.fibra + b.fibra,
    alcohol: a.alcohol + b.alcohol,
  }
}

function publicar(m: MacrosPropio): MacrosPropio {
  return {
    kcal: Math.round(m.kcal),
    prot: redondea1(m.prot),
    carb: redondea1(m.carb),
    fat: redondea1(m.fat),
    fibra: redondea1(m.fibra),
    alcohol: redondea1(m.alcohol),
  }
}

// ---------- §4.1: huecos y emparejamiento ----------

interface Dictada {
  nombre: string
  hora: string | null
  peri: boolean
  /** Índice del hueco del plan con el que empareja; `null` en una comida extra propia. */
  hueco: number | null
  objetivo: Macros | null
  /** Alimentos dictados sin los retirados, en el orden del array. */
  alimentos: AlimentoPropio[]
}

function objetivoDeHueco(c: Comida): Macros {
  return { kcal: c.kcal, prot: c.proteina_g, carb: c.hc_g, fat: c.grasa_g }
}

/**
 * Empareja cada comida dictada con el hueco del plan de mismo nombre normalizado (§4.1.1). Sin
 * coincidencia —o con el hueco ya ocupado— la comida se conserva como **extra propia**, al final
 * y en el orden dictado, con `objetivo: null`.
 */
function emparejar(comidas: readonly ComidaPropia[], huecos: readonly Comida[]): Dictada[] {
  const porNombre = new Map<string, number>()
  for (let i = 0; i < huecos.length; i++) {
    const clave = normalizarNombre(huecos[i].nombre)
    if (!porNombre.has(clave)) porNombre.set(clave, i)
  }
  const tomados = new Set<number>()
  const emparejadas: Dictada[] = []
  const extras: Dictada[] = []
  for (const c of comidas) {
    const alimentos = c.alimentos.filter((a) => a.retirado !== true)
    // Una comida sin alimentos (o con todos retirados) se descarta y su hueco se monta (§4.7).
    if (alimentos.length === 0) continue
    const indice = porNombre.get(normalizarNombre(c.nombre))
    if (indice !== undefined && !tomados.has(indice)) {
      tomados.add(indice)
      const hueco = huecos[indice]
      emparejadas.push({
        nombre: hueco.nombre,
        hora: hueco.hora,
        peri: hueco.peri,
        hueco: indice,
        objetivo: objetivoDeHueco(hueco),
        alimentos,
      })
      continue
    }
    extras.push({
      nombre: c.nombre,
      hora: null,
      peri: false,
      hueco: null,
      objetivo: null,
      alimentos,
    })
  }
  emparejadas.sort((a, b) => (a.hueco ?? 0) - (b.hueco ?? 0))
  return [...emparejadas, ...extras]
}

// ---------- §4.3.2: reparto del resto entre los huecos a montar ----------

interface Parte {
  kcal: number
  prot: number
  carb: number
  fat: number
}

function parteCero(): Parte {
  return { kcal: 0, prot: 0, carb: 0, fat: 0 }
}

function trasladar(partes: Parte[], j: number, delta: Parte, pesos: readonly number[]): boolean {
  let total = 0
  for (let i = 0; i < partes.length; i++) if (i !== j) total += pesos[i]
  if (!(total > 0)) return false
  for (let i = 0; i < partes.length; i++) {
    if (i === j) continue
    const f = pesos[i] / total
    partes[i].kcal += delta.kcal * f
    partes[i].prot += delta.prot * f
    partes[i].carb += delta.carb * f
    partes[i].fat += delta.fat * f
  }
  return true
}

/**
 * `true` si la parte respeta los suelos de §4.2.4. Con `sin_hidratos` el suelo de hidrato no se
 * comprueba: dejar el hueco por debajo de esos 10 g es exactamente lo que pide el hábito.
 */
function respetaSuelos(p: Parte, lowCarb: boolean, saltarCarb: boolean): boolean {
  if (p.kcal < SUELOS.kcal) return false
  if (p.prot < SUELOS.prot) return false
  if (p.fat < SUELOS.fat) return false
  if (!saltarCarb && !lowCarb && p.carb < SUELOS.carb) return false
  return true
}

// ---------- Composición ----------

export function componerDiaCon(
  interpretada: DietaInterpretada,
  inputs: Inputs,
  resultado: Resultado,
  variante: number,
  montar: Montador,
): DiaCompuesto {
  const perfil = perfilDeResultado(resultado, inputs)
  const objetivo: Macros = {
    kcal: resultado.kcal,
    prot: resultado.macros.proteina_g,
    carb: resultado.macros.hc_g,
    fat: resultado.macros.grasa_g,
  }
  const huecos = resultado.comidas
  const dictadas = emparejar(interpretada.comidas, huecos)
  const ocupados = new Set(dictadas.map((d) => d.hueco).filter((i): i is number => i !== null))
  const aMontar = huecos.map((_, i) => i).filter((i) => !ocupados.has(i))

  const modo: ModoComposicion =
    dictadas.length === 0 ? 'solo_contexto' : aMontar.length === 0 ? 'completa' : 'parcial'

  // ----- §4.2: clasificación, cajas y ajuste de los gramos dictados -----
  const piezas: Pieza[] = []
  const variables: Variable[] = []
  /** Estado y —si es variable— índice en `variables` de cada alimento, en el orden del día. */
  const fichas: { estado: EstadoAjuste; v: number }[] = []
  for (const d of dictadas) {
    for (const a of d.alimentos) {
      const estado = estadoDe(a)
      if (estado === 'pendiente') {
        fichas.push({ estado, v: -1 })
        continue
      }
      if (estado === 'fijo') {
        piezas.push({ macros: a.macros_100g, gramos: a.gramos ?? 0, variable: null })
        fichas.push({ estado, v: -1 })
        continue
      }
      const v = variables.length
      variables.push(cajaDe(a))
      piezas.push({ macros: a.macros_100g, gramos: a.gramos ?? 0, variable: v })
      fichas.push({ estado, v })
    }
  }

  const entrada: EntradaAjuste = {
    piezas,
    variables,
    objetivo,
    modo: modo === 'completa' ? 'completa' : 'parcial',
    huecosAMontar: aMontar.length,
    lowCarb: perfil.low_carb,
  }
  const ajuste = ajustar(entrada)

  // ----- §4.6: los alimentos ya ajustados, comida a comida -----
  const ajustados: AlimentoAjustado[][] = []
  const pendientes: { comida: string; nombre: string }[] = []
  /** Índice en `variables` de cada alimento del día aplanado; -1 si es fijo o pendiente. */
  const variableDe: number[] = []
  let ficha = 0
  for (const d of dictadas) {
    const lista: AlimentoAjustado[] = []
    for (const a of d.alimentos) {
      const f = fichas[ficha++]
      variableDe.push(f.v)
      if (f.estado === 'pendiente') {
        pendientes.push({ comida: d.nombre, nombre: a.nombre })
        lista.push({
          ...a,
          estado_ajuste: 'pendiente',
          gramos_ajustados: 0,
          delta_g: 0,
          cambio: 'igual',
          factor: 1,
          en_limite: 'no',
          aporte: { ...CERO },
        })
        continue
      }
      const dictados = a.gramos ?? 0
      if (f.estado === 'fijo') {
        lista.push({
          ...a,
          estado_ajuste: 'fijo',
          gramos_ajustados: dictados,
          delta_g: 0,
          cambio: 'igual',
          factor: 1,
          en_limite: 'no',
          aporte: aporteDe(a.macros_100g, dictados),
        })
        continue
      }
      const v = variables[f.v]
      const finales = ajuste.gramos[f.v]
      const delta = redondea1(finales - dictados)
      lista.push({
        ...a,
        estado_ajuste: 'variable',
        gramos_ajustados: finales,
        delta_g: delta,
        cambio: delta > 0 ? 'sube' : delta < 0 ? 'baja' : 'igual',
        factor: dictados > 0 ? finales / dictados : 1,
        en_limite: enLimite(v, finales),
        aporte: aporteDe(a.macros_100g, finales),
      })
    }
    ajustados.push(lista)
  }

  // ----- §4.3.1: el resto que queda para los huecos -----
  const totalesDictados = ajustados.reduce(
    (t, lista) => lista.reduce((x, a) => suma(x, a.aporte), t),
    { ...CERO },
  )
  const resto: Parte = {
    kcal: objetivo.kcal - totalesDictados.kcal,
    prot: objetivo.prot - totalesDictados.prot,
    carb: objetivo.carb - totalesDictados.carb,
    fat: objetivo.fat - totalesDictados.fat,
  }
  let restoRecortado = false
  for (const m of MACROS) {
    if (resto[m] < 0) {
      // Solo es un recorte real cuando hay huecos que montar: en modo `completa` no hay resto que
      // repartir y la desviación la cuenta `DIETA_KCAL_LEJOS`.
      if (aMontar.length > 0) restoRecortado = true
      resto[m] = 0
    }
  }

  // ----- §4.3.2: reparto ∝ pct_kcal y hábitos aplicables -----
  const aplicado: string[] = []
  const apuntado: string[] = []
  for (const g of interpretada.gustos) {
    const nombres = g.alimento_ids.map(nombreDeId)
    if (nombres.length === 0) apuntado.push(apuntadoSinBase(g.texto))
    else if (g.tipo === 'no_gusta') aplicado.push(aplicadoSin(nombres))
    else aplicado.push(aplicadoFavorito(nombres))
  }

  const pesos = aMontar.map((i) => Math.max(0, huecos[i].pct_kcal))
  const sumaPesos = pesos.reduce((t, p) => t + p, 0)
  const reparto = aMontar.map((_, j) => {
    const f = sumaPesos > 0 ? pesos[j] / sumaPesos : 1 / Math.max(1, aMontar.length)
    return { kcal: resto.kcal * f, prot: resto.prot * f, carb: resto.carb * f, fat: resto.fat * f }
  })
  const pesosEfectivos = sumaPesos > 0 ? pesos : aMontar.map(() => 1)

  const dictadasPorNombre = new Set(dictadas.map((d) => normalizarNombre(d.nombre)))
  for (const h of interpretada.habitos) {
    aplicarHabito(h, {
      huecos,
      aMontar,
      reparto,
      pesos: pesosEfectivos,
      lowCarb: perfil.low_carb,
      dictadasPorNombre,
      aplicado,
      apuntado,
    })
  }

  // Redondeo del reparto: kcal enteras, macros con 1 decimal, y el ÚLTIMO hueco absorbe el resto
  // para que la suma de los huecos sea exactamente el resto (§4.3.2).
  const objetivoHuecos = redondearReparto(reparto, resto)

  const comidasAMontar: Comida[] = aMontar.map((i, j) => ({
    nombre: huecos[i].nombre,
    hora: huecos[i].hora,
    pct_kcal: huecos[i].pct_kcal,
    proteina_g: objetivoHuecos[j].prot,
    grasa_g: objetivoHuecos[j].fat,
    hc_g: objetivoHuecos[j].carb,
    kcal: objetivoHuecos[j].kcal,
    peri: huecos[i].peri,
  }))

  const montado = montar(comidasAMontar, variante)

  // ----- §4.6: el día, en el orden del plan y con las extras al final -----
  const comidas: ComidaCompuesta[] = []
  const porHueco = new Map<number, number>()
  dictadas.forEach((d, i) => {
    if (d.hueco !== null) porHueco.set(d.hueco, i)
  })
  for (let i = 0; i < huecos.length; i++) {
    const indiceDictada = porHueco.get(i)
    if (indiceDictada !== undefined) {
      comidas.push(comidaPropia(dictadas[indiceDictada], ajustados[indiceDictada]))
      continue
    }
    const j = aMontar.indexOf(i)
    const ejemplo = montado.comidas[j]
    if (!ejemplo) continue
    comidas.push({
      nombre: huecos[i].nombre,
      hora: huecos[i].hora,
      peri: huecos[i].peri,
      origen: 'propuesta',
      objetivo: {
        kcal: objetivoHuecos[j].kcal,
        prot: objetivoHuecos[j].prot,
        carb: objetivoHuecos[j].carb,
        fat: objetivoHuecos[j].fat,
      },
      alimentos: [],
      ejemplo,
      totales: totalesDeEjemplo(ejemplo),
      pct_kcal: 0,
    })
  }
  dictadas.forEach((d, i) => {
    if (d.hueco === null) comidas.push(comidaPropia(d, ajustados[i]))
  })

  const totales = publicar(comidas.reduce((t, c) => suma(t, c.totales), { ...CERO }))
  for (const c of comidas) {
    c.pct_kcal = totales.kcal > 0 ? redondea1((c.totales.kcal / totales.kcal) * 100) : 0
  }

  const avisos = construirAvisos({
    modo,
    objetivo,
    totales,
    fibraObjetivo: resultado.macros.fibra_g,
    diabetes: inputs.condiciones.includes('diabetes'),
    pendientes,
    ajustados,
    variables,
    variableDe,
    resuelto: ajuste.resuelto,
    bajados: ajuste.bajados,
    restoRecortado,
    faltaAceite: interpretada.falta_aceite === true,
    kcalDictadas: totalesDictados.kcal,
  })

  return {
    modo,
    comidas,
    totales,
    objetivo,
    desvio: {
      kcal: Math.round(totales.kcal - objetivo.kcal),
      prot: redondea1(totales.prot - objetivo.prot),
      carb: redondea1(totales.carb - objetivo.carb),
      fat: redondea1(totales.fat - objetivo.fat),
    },
    avisos,
    aplicado,
    apuntado,
    pendientes,
    no_entendido: interpretada.no_entendido,
    notas: [...interpretada.notas, ...montado.notas],
    n_variables: variables.length,
    provisional: pendientes.length > 0,
  }
}

// ---------- Piezas de la composición ----------

function enLimite(v: Variable, gramos: number): AlimentoAjustado['en_limite'] {
  const tolerancia = v.paso / 2
  if (gramos >= v.hiRed - tolerancia) return v.limiteArriba
  if (gramos <= v.loRed + tolerancia) return 'factor'
  return 'no'
}

function comidaPropia(d: Dictada, alimentos: AlimentoAjustado[]): ComidaCompuesta {
  return {
    nombre: d.nombre,
    hora: d.hora,
    peri: d.peri,
    origen: 'propia',
    objetivo: d.objetivo,
    alimentos,
    ejemplo: null,
    totales: publicar(alimentos.reduce((t, a) => suma(t, a.aporte), { ...CERO })),
    pct_kcal: 0,
  }
}

/** Totales de una toma montada. La fibra sale de `foods.json`; el alcohol de un menú es 0. */
function totalesDeEjemplo(e: EjemploComida): MacrosPropio {
  let fibra = 0
  for (const a of e.alimentos) {
    const catalogo = alimentoPorId(a.id)
    if (catalogo) fibra += (catalogo.fibra * a.gramos) / 100
  }
  return {
    kcal: e.totales.kcal,
    prot: e.totales.prot,
    carb: e.totales.carb,
    fat: e.totales.fat,
    fibra: redondea1(fibra),
    alcohol: 0,
  }
}

interface ContextoHabito {
  huecos: readonly Comida[]
  aMontar: readonly number[]
  reparto: Parte[]
  pesos: readonly number[]
  lowCarb: boolean
  dictadasPorNombre: ReadonlySet<string>
  aplicado: string[]
  apuntado: string[]
}

/** §4.3.2 y §4.5: un hábito se aplica a un hueco montado o se apunta. */
function aplicarHabito(h: HabitoPropio, c: ContextoHabito): void {
  if (h.tipo === 'n_comidas') {
    c.apuntado.push(apuntadoNComidas(h.texto))
    return
  }
  if (h.tipo === 'frecuencia_semanal') {
    c.apuntado.push(apuntadoFrecuencia(h.texto))
    return
  }
  if (h.tipo === 'horario') {
    c.apuntado.push(apuntadoHorario(h.texto))
    return
  }
  if (h.tipo === 'otro') {
    c.apuntado.push(apuntadoOtro(h.texto))
    return
  }
  const clave = h.comida === null ? null : normalizarNombre(h.comida)
  if (h.tipo === 'misma_cada_dia') {
    if (clave !== null && c.dictadasPorNombre.has(clave)) {
      c.aplicado.push(aplicadoMismaCadaDia(h.comida ?? ''))
    } else {
      c.apuntado.push(apuntadoOtro(h.texto))
    }
    return
  }
  // sin_hidratos | ligera | abundante: solo se aplican sobre un hueco que montamos nosotros.
  if (clave !== null && c.dictadasPorNombre.has(clave)) {
    c.apuntado.push(apuntadoComidaDictada(h.texto))
    return
  }
  const j =
    clave === null ? -1 : c.aMontar.findIndex((i) => normalizarNombre(c.huecos[i].nombre) === clave)
  if (j < 0 || c.aMontar.length < 2) {
    c.apuntado.push(apuntadoOtro(h.texto))
    return
  }
  const copia = c.reparto.map((p) => ({ ...p }))
  const delta = parteCero()
  if (h.tipo === 'sin_hidratos') {
    const nuevo = Math.min(copia[j].carb, HC_SIN_HIDRATOS)
    delta.carb = copia[j].carb - nuevo
    delta.kcal = 4 * delta.carb
    copia[j].carb = nuevo
    copia[j].kcal -= delta.kcal
  } else if (h.tipo === 'ligera') {
    delta.kcal = copia[j].kcal * (1 - FACTOR_LIGERA)
    delta.prot = copia[j].prot * (1 - FACTOR_LIGERA)
    delta.carb = copia[j].carb * (1 - FACTOR_LIGERA)
    delta.fat = copia[j].fat * (1 - FACTOR_LIGERA)
    copia[j].kcal *= FACTOR_LIGERA
    copia[j].prot *= FACTOR_LIGERA
    copia[j].carb *= FACTOR_LIGERA
    copia[j].fat *= FACTOR_LIGERA
  } else {
    delta.kcal = -copia[j].kcal * (FACTOR_ABUNDANTE - 1)
    delta.prot = -copia[j].prot * (FACTOR_ABUNDANTE - 1)
    delta.carb = -copia[j].carb * (FACTOR_ABUNDANTE - 1)
    delta.fat = -copia[j].fat * (FACTOR_ABUNDANTE - 1)
    copia[j].kcal *= FACTOR_ABUNDANTE
    copia[j].prot *= FACTOR_ABUNDANTE
    copia[j].carb *= FACTOR_ABUNDANTE
    copia[j].fat *= FACTOR_ABUNDANTE
  }
  if (!trasladar(copia, j, delta, c.pesos)) {
    c.apuntado.push(apuntadoOtro(h.texto))
    return
  }
  const saltarCarb = h.tipo === 'sin_hidratos'
  for (let i = 0; i < copia.length; i++) {
    if (!respetaSuelos(copia[i], c.lowCarb, saltarCarb && i === j)) {
      c.apuntado.push(apuntadoOtro(h.texto))
      return
    }
  }
  for (let i = 0; i < copia.length; i++) c.reparto[i] = copia[i]
  c.aplicado.push(aplicadoHabitoHueco(c.huecos[c.aMontar[j]].nombre, h.tipo))
}

/** Redondeo del reparto con el último hueco absorbiendo la diferencia (§4.3.2). */
function redondearReparto(reparto: readonly Parte[], resto: Parte): Parte[] {
  const total: Parte = {
    kcal: Math.round(resto.kcal),
    prot: redondea1(resto.prot),
    carb: redondea1(resto.carb),
    fat: redondea1(resto.fat),
  }
  const salida = reparto.map((p) => ({
    kcal: Math.max(0, Math.round(p.kcal)),
    prot: Math.max(0, redondea1(p.prot)),
    carb: Math.max(0, redondea1(p.carb)),
    fat: Math.max(0, redondea1(p.fat)),
  }))
  if (salida.length === 0) return salida
  const ultimo = salida.length - 1
  for (const m of ['kcal', 'prot', 'carb', 'fat'] as const) {
    let acumulado = 0
    for (let i = 0; i < ultimo; i++) acumulado += salida[i][m]
    const resta = total[m] - acumulado
    salida[ultimo][m] = Math.max(0, m === 'kcal' ? Math.round(resta) : redondea1(resta))
  }
  return salida
}

// ---------- §4.4: avisos ----------

interface EntradaAvisos {
  modo: ModoComposicion
  objetivo: Macros
  totales: MacrosPropio
  fibraObjetivo: number
  diabetes: boolean
  pendientes: readonly { comida: string; nombre: string }[]
  ajustados: readonly AlimentoAjustado[][]
  variables: readonly Variable[]
  /** Índice en `variables` de cada alimento del día aplanado; -1 si es fijo o pendiente. */
  variableDe: readonly number[]
  resuelto: boolean
  bajados: boolean
  restoRecortado: boolean
  faltaAceite: boolean
  kcalDictadas: number
}

function construirAvisos(e: EntradaAvisos): { codigo: string; texto: string }[] {
  const avisos: { codigo: string; texto: string }[] = []
  const T = e.objetivo
  const M = e.totales
  const planos = e.ajustados.flat()
  const cajaDeAlimento = (i: number): Variable | undefined => e.variables[e.variableDe[i]]
  const variables = planos.filter((a) => a.estado_ajuste === 'variable')

  if (e.pendientes.length > 0) {
    avisos.push({
      codigo: 'DIETA_PENDIENTES',
      texto: avisoPendientes(e.pendientes.map((p) => p.nombre)),
    })
  }

  if (e.restoRecortado || e.bajados) {
    const movidos = e.bajados
      ? variables.filter((a) => a.delta_g < 0).map((a) => nombreEnFrase(a))
      : []
    const pct = T.kcal > 0 ? (e.kcalDictadas / T.kcal) * 100 : 0
    avisos.push({
      codigo: 'DIETA_PROPIAS_GRANDES',
      texto: avisoPropiasGrandes(pct, movidos),
    })
  }

  if (T.prot > 0 && M.prot < UMBRAL_PROTEINA * T.prot) {
    // El alimento dictado con más proteína por kcal que aún tenga recorrido hacia arriba.
    let mejor: AlimentoAjustado | null = null
    let mejorRatio = 0
    for (let i = 0; i < planos.length; i++) {
      const a = planos[i]
      if (a.estado_ajuste !== 'variable') continue
      const v = cajaDeAlimento(i)
      if (!v || a.gramos_ajustados >= v.hiRed - v.paso / 2) continue
      const kcal = a.macros_100g.kcal
      const ratio = kcal > 0 ? a.macros_100g.prot / kcal : 0
      if (ratio > mejorRatio) {
        mejorRatio = ratio
        mejor = a
      }
    }
    avisos.push({
      codigo: 'DIETA_PROTEINA_CORTA',
      texto: avisoProteinaCorta(M.prot, T.prot, mejor ? nombreEnFrase(mejor) : null),
    })
  }

  if (T.fat > 0 && M.fat < UMBRAL_GRASA_BAJA * T.fat) {
    avisos.push({ codigo: 'DIETA_GRASA_BAJA', texto: avisoGrasaBaja(M.fat, T.fat) })
  }

  if (T.fat > 0 && M.fat > UMBRAL_GRASA_ALTA * T.fat) {
    const conRecorrido = planos
      .filter((a, i) => {
        if (a.estado_ajuste !== 'variable') return false
        const v = cajaDeAlimento(i)
        return v !== undefined && a.gramos_ajustados > v.loRed + v.paso / 2
      })
      .sort((x, y) => y.aporte.fat - x.aporte.fat)
      .slice(0, 2)
      .map((a) => nombreEnFrase(a))
    avisos.push({ codigo: 'DIETA_GRASA_ALTA', texto: avisoGrasaAlta(M.fat, T.fat, conRecorrido) })
  }

  if (T.kcal > 0 && Math.abs(M.kcal - T.kcal) > UMBRAL_KCAL * T.kcal) {
    avisos.push({ codigo: 'DIETA_KCAL_LEJOS', texto: avisoKcalLejos(M.kcal - T.kcal) })
  }

  const umbralHc = e.diabetes ? UMBRAL_HC_DIABETES : UMBRAL_HC
  if (T.carb > 0 && Math.abs(M.carb - T.carb) > umbralHc * T.carb) {
    avisos.push({ codigo: 'DIETA_HC_LEJOS', texto: avisoHcLejos(M.carb, T.carb) })
  }

  if (e.fibraObjetivo > 0 && M.fibra < UMBRAL_FIBRA * e.fibraObjetivo) {
    avisos.push({ codigo: 'DIETA_FIBRA_BAJA', texto: avisoFibraBaja(M.fibra, e.fibraObjetivo) })
  }

  if (e.modo === 'completa') {
    const vegetales = planos
      .filter((a) => a.grupo_aprox === 'verdura' || a.grupo_aprox === 'fruta')
      .reduce((t, a) => t + a.gramos_ajustados, 0)
    if (vegetales < GRAMOS_VEGETALES) {
      avisos.push({ codigo: 'DIETA_SIN_VEGETALES', texto: AVISO_SIN_VEGETALES })
    }
  }

  if (e.faltaAceite) avisos.push({ codigo: 'DIETA_SIN_ACEITE', texto: AVISO_SIN_ACEITE })

  if (M.alcohol > 0) {
    avisos.push({ codigo: 'DIETA_ALCOHOL', texto: avisoAlcohol(7 * M.alcohol) })
  }

  // El aviso del límite habla de haber movido los gramos: solo tiene sentido cuando el solver ha
  // llegado a moverlos (en modo `parcial` con sitio de sobra los factores se quedan en 1).
  if (e.resuelto) {
    const porFactor = variables.find(
      (a) => a.en_limite === 'factor' && a.gramos_ajustados !== (a.gramos ?? 0),
    )
    if (porFactor) {
      avisos.push({
        codigo: 'DIETA_LIMITE',
        texto: avisoLimitePorFactor(nombreEnFrase(porFactor)),
      })
    }
    const porRacion = variables.find((a) => a.en_limite === 'racion')
    if (porRacion) {
      avisos.push({
        codigo: 'DIETA_LIMITE',
        texto: avisoLimitePorRacion(nombreEnFrase(porRacion), porRacion.gramos_ajustados),
      })
    }
  }

  if (planos.some((a) => a.origen_macros === 'estimado')) {
    avisos.push({ codigo: 'DIETA_ESTIMADOS', texto: AVISO_ESTIMADOS })
  }

  const distintos = new Set(avisos.map((a) => a.codigo)).size
  if (distintos >= AVISOS_NO_CUADRA) {
    avisos.unshift({ codigo: 'DIETA_NO_CUADRA', texto: AVISO_NO_CUADRA })
  }
  return avisos
}
