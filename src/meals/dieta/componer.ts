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
  PropuestaIA,
  Resultado,
} from '../../engine/types'
import { perfilDeResultado } from '../filtros'
import { nombreCorto } from '../textos'
import type { EntradaAjuste, EstadoAjuste, Pieza, Variable } from './ajuste'
import { MACROS, SUELOS, ajustar, cajaDe, estadoDe, totalesDe } from './ajuste'
import {
  AVISOS_NO_CUADRA,
  AVISO_ESTIMADOS,
  AVISO_ESTIMADOS_IA,
  AVISO_NO_CUADRA,
  AVISO_SIN_ACEITE,
  AVISO_SIN_VEGETALES,
  AVISO_SIN_VEGETALES_IA,
  CODIGO_CONSEJO_IA,
  aplicadoFavorito,
  aplicadoHabitoHueco,
  aplicadoMismaCadaDia,
  aplicadoSin,
  apuntadoComidaDictada,
  apuntadoExcluidoEnPropuesta,
  apuntadoFrecuencia,
  apuntadoHorario,
  apuntadoNComidas,
  apuntadoNoCabe,
  apuntadoOtro,
  apuntadoPropuestaConHidratos,
  apuntadoPropuestaNoConvence,
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

/**
 * Lo que `componerDia` necesita del generador de menús: los huecos montados y sus notas.
 * `sinHidratos` marca, hueco a hueco, las tomas a las que se ha aplicado ese hábito (§4.3.2): el
 * generador tiene que montarlas por la vía low-carb, porque puntúa por kcal y proteína y, sin la
 * marca, metía igualmente el ancla de hidrato con su ración mínima.
 */
export type Montador = (
  huecos: readonly Comida[],
  variante: number,
  sinHidratos: readonly boolean[],
  cubiertos: readonly boolean[],
) => { comidas: EjemploComida[]; notas: string[] }

/**
 * Un hueco tal y como lo pide `POST /api/dieta/proponer` (§4bis.1). Sale de un `DiaCompuesto` ya
 * calculado —con plantillas o con una propuesta anterior— porque es ahí donde está el objetivo de
 * cada hueco después del reparto del resto y de los hábitos (§4.3.2).
 */
export interface HuecoIA {
  nombre: string
  hora: string | null
  peri: boolean
  objetivo: Macros
  sin_hidratos: boolean
}

/**
 * Los huecos que montamos nosotros (plantillas o IA), en el orden del día, listos para pedirle una
 * propuesta al modelo (§4bis.1). Las comidas dictadas no salen: esas manda lo que contó la persona.
 */
export function huecosParaProponer(compuesto: DiaCompuesto): HuecoIA[] {
  const huecos: HuecoIA[] = []
  for (const c of compuesto.comidas) {
    if (c.origen !== 'propuesta' && c.origen !== 'propuesta_ia') continue
    if (c.objetivo === null) continue
    huecos.push({
      nombre: c.nombre,
      hora: c.hora,
      peri: c.peri,
      objetivo: { ...c.objetivo },
      sin_hidratos: c.sin_hidratos === true,
    })
  }
  return huecos
}

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
/**
 * La promesa "{Comida} sin hidratos" se da por cumplida cuando en el plato no hay ningún alimento
 * del grupo `carbohidrato` (pan, arroz, pasta, patata, boniato…). Los hidratos que aportan la
 * verdura y la fruta no la rompen: lo que la persona lee —y ve— es que no hay guarnición.
 */
function sinHidratosDeVerdad(ejemplo: EjemploComida): boolean {
  return !ejemplo.alimentos.some((a) => alimentoPorId(a.id)?.grupo === 'carbohidrato')
}
/**
 * La misma comprobación sobre una comida propuesta por la IA (§4bis.3). El grupo bueno es el del
 * catálogo cuando el alimento existe en `foods.json` (ahí `grupo_aprox` lo impone el servidor) y
 * el del modelo cuando no existe.
 */
function sinHidratosPropuesta(alimentos: readonly AlimentoPropio[]): boolean {
  return !alimentos.some((a) => {
    const catalogo = a.alimento_id ? alimentoPorId(a.alimento_id) : undefined
    return (catalogo ? catalogo.grupo : a.grupo_aprox) === 'carbohidrato'
  })
}
/**
 * Cuánto se le tolera a un hueco propuesto después de cuadrarlo (§4bis.3): más de un 15 % de
 * diferencia en kcal o en proteína y ese hueco se monta con nuestras plantillas.
 */
const TOLERANCIA_IA = 0.15

/** Suelo de una grasa de adición propuesta por la IA: menos de esto no se puede medir en casa. */
const SUELO_GRASA_G = 5
/** Densidad a partir de la cual una grasa es "de adición" (aceite, mantequilla): kcal/100 g. */
const KCAL_GRASA_DENSA = 700
/** Grasa mínima (g, o fracción de la del día) para que un alimento se nombre en DIETA_GRASA_ALTA. */
const GRASA_RELEVANTE_G = 3
const GRASA_RELEVANTE_PCT = 0.05
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
  propuesta?: PropuestaIA,
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
        lista.push(filaAjustada(a, 'pendiente', 0, null))
        continue
      }
      if (f.estado === 'fijo') {
        lista.push(filaAjustada(a, 'fijo', a.gramos ?? 0, null))
        continue
      }
      lista.push(filaAjustada(a, 'variable', ajuste.gramos[f.v], variables[f.v]))
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
  const sinHidratos = aMontar.map(() => false)
  const porConfirmar: { hueco: number; aplicado: string; apuntado: string; texto: string }[] = []
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
      sinHidratos,
      porConfirmar,
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

  // ----- §4bis.3: los huecos que propone la IA, cuadrados uno a uno -----
  // Se hace ANTES de montar para que el generador sepa qué huecos no va a enseñar nadie y no
  // suelte sus notas ("la Cena se queda 80 kcal por encima…") sobre una comida que no se ve.
  const deLaIa: (HuecoCuadrado | null)[] = aMontar.map(() => null)
  // Las notas de la propuesta NO son "apuntado": esa lista son cosas que dijo la persona y que aún
  // no aplicamos, y "hemos usado la nuestra" describe algo que SÍ se ha hecho (§4bis.3). Van al
  // pie del bloque, con las demás notas, donde caben en una línea de texto.
  const notasPropuesta: string[] = []
  if (propuesta !== undefined) {
    const porNombre = new Map<string, ComidaPropia>()
    for (const c of propuesta.comidas) {
      const clave = normalizarNombre(c.nombre)
      if (!porNombre.has(clave)) porNombre.set(clave, c)
    }
    for (let j = 0; j < aMontar.length; j++) {
      // Por nombre y no por posición: §4bis.1 pide una comida por hueco y en el mismo orden, pero
      // una propuesta con menos huecos de los pedidos no puede correr las demás de sitio.
      const c = porNombre.get(normalizarNombre(comidasAMontar[j].nombre))
      const objetivoJ: Macros = { ...objetivoHuecos[j] }
      const cuadrado = c === undefined ? null : cuadrarHueco(c, objetivoJ, perfil.low_carb)
      if (cuadrado !== null && convence(cuadrado, objetivoJ)) {
        deLaIa[j] = cuadrado
        // Un excluido colado en la propuesta no la tira abajo —los gramos ya cuadran—, pero se
        // apunta: nadie debería encontrarse en su menú justo lo que dijo que no quería.
        const dichos = new Set<string>()
        for (const a of cuadrado.alimentos) {
          const id = a.alimento_id
          if (id === null || !perfil.excluidos.has(id) || dichos.has(id)) continue
          dichos.add(id)
          apuntado.push(apuntadoExcluidoEnPropuesta(nombreDeId(id), comidasAMontar[j].nombre))
        }
        continue
      }
      notasPropuesta.push(apuntadoPropuestaNoConvence(comidasAMontar[j].nombre))
    }
  }

  const montado = montar(
    comidasAMontar,
    variante,
    sinHidratos,
    deLaIa.map((c) => c !== null),
  )

  // §4.5: lo prometido se comprueba contra lo montado. Si la toma sigue trayendo hidratos (banco
  // sencillo, plantillas sin salida, propuesta de la IA con guarnición), la costumbre pasa de
  // "aplicado" a "apuntado": nunca se promete lo que no se ha hecho.
  for (const p of porConfirmar) {
    const ia = deLaIa[p.hueco]
    let motivo = p.apuntado
    if (ia !== null) {
      if (sinHidratosPropuesta(ia.alimentos)) continue
      // Aquí el hábito SÍ se aplicó al objetivo y no había ningún problema de tamaño: lo que ha
      // pasado es que la propuesta trajo guarnición. `apuntadoNoCabe` contaría otra cosa (§4.5).
      motivo = apuntadoPropuestaConHidratos(p.texto, comidasAMontar[p.hueco].nombre)
    } else {
      const ejemplo = montado.comidas[p.hueco]
      if (ejemplo !== undefined && sinHidratosDeVerdad(ejemplo)) continue
    }
    const i = aplicado.indexOf(p.aplicado)
    if (i >= 0) aplicado.splice(i, 1)
    apuntado.push(motivo)
  }

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
    const objetivoJ: Macros = {
      kcal: objetivoHuecos[j].kcal,
      prot: objetivoHuecos[j].prot,
      carb: objetivoHuecos[j].carb,
      fat: objetivoHuecos[j].fat,
    }
    const ia = deLaIa[j]
    if (ia !== null) {
      comidas.push({
        nombre: huecos[i].nombre,
        hora: huecos[i].hora,
        peri: huecos[i].peri,
        origen: 'propuesta_ia',
        objetivo: objetivoJ,
        alimentos: ia.alimentos,
        ejemplo: null,
        ...(sinHidratos[j] ? { sin_hidratos: true } : {}),
        totales: ia.totales,
        pct_kcal: 0,
      })
      continue
    }
    const ejemplo = montado.comidas[j]
    if (!ejemplo) continue
    comidas.push({
      nombre: huecos[i].nombre,
      hora: huecos[i].hora,
      peri: huecos[i].peri,
      origen: 'propuesta',
      objetivo: objetivoJ,
      alimentos: [],
      ejemplo,
      ...(sinHidratos[j] ? { sin_hidratos: true } : {}),
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
    propuestos: deLaIa.map((c) => c?.alimentos ?? []),
    variables,
    variableDe,
    resuelto: ajuste.resuelto,
    bajados: ajuste.bajados,
    restoRecortado,
    faltaAceite: interpretada.falta_aceite === true,
    kcalDictadas: totalesDictados.kcal,
  })

  // §4bis.3: el consejo del modelo va como aviso informativo, el primero de los informativos. No
  // cuenta para el umbral de `DIETA_NO_CUADRA` —no señala nada que no cuadre— y por eso se inserta
  // después de construir la lista, detrás del terminal si lo hubiera.
  const consejo = propuesta?.consejo?.trim() ?? ''
  if (consejo.length > 0) {
    const terminal = avisos.length > 0 && avisos[0].codigo === 'DIETA_NO_CUADRA' ? 1 : 0
    avisos.splice(terminal, 0, { codigo: CODIGO_CONSEJO_IA, texto: consejo })
  }

  // Sin propuesta, el día sale exactamente igual que antes de la decisión L: estos tres campos ni
  // siquiera aparecen en el objeto.
  const conIa = deLaIa.filter((c) => c !== null).length
  const extrasIa =
    propuesta === undefined
      ? {}
      : {
          preguntas: propuesta.preguntas.map((p) => ({ ...p, opciones: [...p.opciones] })),
          consejo_ia: propuesta.consejo,
          origen_huecos:
            aMontar.length === 0
              ? null
              : conIa === 0
                ? ('plantillas' as const)
                : conIa === aMontar.length
                  ? ('ia' as const)
                  : ('mixto' as const),
        }

  return {
    ...extrasIa,
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
    notas: [...interpretada.notas, ...montado.notas, ...notasPropuesta],
    n_variables: variables.length,
    provisional: pendientes.length > 0,
  }
}

// ---------- Piezas de la composición ----------

/**
 * La cuenta de unidades que se PUBLICA es la de los gramos finales (§5.4 pide la forma "5 huevos M
 * (275 g)", con su gramaje): el solver trabaja en unidades, pero sin esto la fila enseñaba las
 * unidades dictadas junto a los gramos ajustados y se contradecía. `gramos` sigue guardando lo
 * dictado, que es lo que lee "Cambiar".
 */
function unidadesFinales(a: AlimentoPropio, gramos: number): number | null | undefined {
  const u = a.unidad?.gramos
  if (typeof u !== 'number' || !Number.isFinite(u) || u <= 0) return a.cantidad_unidades
  if (!(gramos > 0)) return a.cantidad_unidades
  return Math.max(1, Math.round(gramos / u))
}

/**
 * Una fila ya ajustada (§4.6). La usan igual los alimentos dictados y los que propone la IA: en
 * los dos casos los gramos que se enseñan son los que ha puesto el solver, y `gramos` sigue
 * guardando el punto de partida (lo dictado, o lo que el modelo propuso a ojo).
 */
function filaAjustada(
  a: AlimentoPropio,
  estado: EstadoAjuste,
  gramos: number,
  v: Variable | null,
): AlimentoAjustado {
  if (estado === 'pendiente') {
    return {
      ...a,
      estado_ajuste: 'pendiente',
      gramos_ajustados: 0,
      delta_g: 0,
      cambio: 'igual',
      factor: 1,
      en_limite: 'no',
      aporte: { ...CERO },
    }
  }
  if (estado === 'fijo' || v === null) {
    return {
      ...a,
      cantidad_unidades: unidadesFinales(a, gramos),
      estado_ajuste: 'fijo',
      gramos_ajustados: gramos,
      delta_g: 0,
      cambio: 'igual',
      factor: 1,
      en_limite: 'no',
      aporte: aporteDe(a.macros_100g, gramos),
    }
  }
  const partida = a.gramos ?? 0
  const delta = redondea1(gramos - partida)
  return {
    ...a,
    cantidad_unidades: unidadesFinales(a, gramos),
    estado_ajuste: 'variable',
    gramos_ajustados: gramos,
    delta_g: delta,
    cambio: delta > 0 ? 'sube' : delta < 0 ? 'baja' : 'igual',
    factor: partida > 0 ? gramos / partida : 1,
    en_limite: enLimite(v, gramos),
    aporte: aporteDe(a.macros_100g, gramos),
  }
}

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

/** Un hueco propuesto por la IA después de pasar por el solver (§4bis.3). */
interface HuecoCuadrado {
  alimentos: AlimentoAjustado[]
  totales: MacrosPropio
}

/**
 * Cuadra UN hueco propuesto por el modelo contra su objetivo (§4bis.3): el solver de §4.2 en modo
 * `completa` pero con las piezas de esa sola comida —cajas de §4.2.2, redondeo de §4.2.6 y cierre
 * de §4.2.7—, porque aquí no hay nada más en el día que pueda absorber la diferencia.
 *
 * Devuelve `null` si la comida no vale: sin alimentos, o con todos sin gramos utilizables. Un
 * alimento propuesto sin gramos se descarta en vez de quedarse `pendiente`: la fila de una comida
 * `propuesta_ia` no tiene "Cambiar" (§4bis.3), así que nadie podría completarlo nunca.
 */
function cuadrarHueco(
  comida: ComidaPropia,
  objetivo: Macros,
  lowCarb: boolean,
): HuecoCuadrado | null {
  const alimentos = comida.alimentos.filter(
    (a) => a.retirado !== true && estadoDe(a) !== 'pendiente',
  )
  if (alimentos.length === 0) return null
  const piezas: Pieza[] = []
  const variables: Variable[] = []
  const fichas: { estado: EstadoAjuste; v: number }[] = []
  for (const a of alimentos) {
    const estado = estadoDe(a)
    if (estado === 'fijo') {
      piezas.push({ macros: a.macros_100g, gramos: a.gramos ?? 0, variable: null })
      fichas.push({ estado, v: -1 })
      continue
    }
    const v = variables.length
    variables.push(sueloDeCocina(a, cajaDe(a)))
    piezas.push({ macros: a.macros_100g, gramos: a.gramos ?? 0, variable: v })
    fichas.push({ estado, v })
  }
  const ajuste = ajustar({
    piezas,
    variables,
    objetivo: objetivoAlcanzable(piezas, variables, objetivo),
    modo: 'completa',
    huecosAMontar: 0,
    lowCarb,
  })
  const filas = alimentos.map((a, i) => {
    const f = fichas[i]
    return f.estado === 'fijo'
      ? filaAjustada(a, 'fijo', a.gramos ?? 0, null)
      : filaAjustada(a, 'variable', ajuste.gramos[f.v], variables[f.v])
  })
  return {
    alimentos: filas,
    totales: publicar(filas.reduce((t, a) => suma(t, a.aporte), { ...CERO })),
  }
}

/**
 * Suelo de cocina para la grasa de adición de un hueco propuesto (§4bis.3). La caja de §4.2.2 es
 * `[0,5·g , 1,75·g]` sobre lo que propuso el modelo y no tiene suelo absoluto: con el aceite eso
 * daba "3 g" para un plato entero, media cucharadita, que no es una instrucción usable en una
 * cocina. El prompt le promete al modelo raciones de casa (aceite 5–15 g, §4bis.2 regla 2) y esto
 * es lo que las sostiene. Solo se toca el camino de la propuesta: lo dictado (§4.2) no se toca.
 */
function sueloDeCocina(a: AlimentoPropio, caja: Variable): Variable {
  if (a.grupo_aprox !== 'grasa' || a.macros_100g.kcal <= KCAL_GRASA_DENSA) return caja
  if (caja.unidadG !== null) return caja
  const suelo = Math.min(SUELO_GRASA_G, caja.hiRed)
  if (!(suelo > caja.loRed)) return caja
  return { ...caja, lo: Math.max(caja.lo, suelo), loRed: suelo }
}

/**
 * Objetivo utilizable del hueco (§4bis.3). Un macro que la propuesta NO puede alcanzar ni con
 * todas sus piezas en el extremo alto de la caja no tiene mínimo interior: su término de `F` es
 * estrictamente decreciente y solo empuja los gramos hacia arriba, disparando los demás macros.
 * Ese fue el caso de la decisión L ("solo pollo y arroz", sin ninguna fuente de grasa): el óptimo
 * de `F` se iba a 591 kcal y 59,9 g de proteína y el hueco no pasaba el ±15 %, así que nunca se
 * servía. Poniendo a 0 ese macro, `funcionCompleta` se salta su término y el resto cuadra.
 *
 * Es determinista y solo quita términos sin óptimo interior; el ±15 % de `convence` se sigue
 * midiendo contra el objetivo REAL.
 */
function objetivoAlcanzable(
  piezas: readonly Pieza[],
  variables: readonly Variable[],
  objetivo: Macros,
): Macros {
  const maximos = totalesDe(
    piezas,
    variables.map((v) => v.hiRed),
  )
  const util: Macros = { ...objetivo }
  for (const m of MACROS) {
    if (util[m] > 0 && maximos[m] < util[m]) util[m] = 0
  }
  return util
}

/** `true` si el hueco cuadrado se queda dentro del ±15 % en kcal y en proteína (§4bis.3). */
function convence(cuadrado: HuecoCuadrado, objetivo: Macros): boolean {
  for (const m of ['kcal', 'prot'] as const) {
    const T = objetivo[m]
    if (!(T > 0)) continue
    if (Math.abs(cuadrado.totales[m] - T) > TOLERANCIA_IA * T) return false
  }
  return true
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
  /** Huecos (índice dentro de `aMontar`) a los que se ha aplicado `sin_hidratos`. */
  sinHidratos: boolean[]
  /** Promesas que hay que comprobar contra lo realmente montado (§4.5): nunca prometer de más. */
  porConfirmar: { hueco: number; aplicado: string; apuntado: string; texto: string }[]
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
    c.apuntado.push(apuntadoNoCabe(h.texto))
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
    c.apuntado.push(apuntadoNoCabe(h.texto))
    return
  }
  const saltarCarb = h.tipo === 'sin_hidratos'
  for (let i = 0; i < copia.length; i++) {
    if (!respetaSuelos(copia[i], c.lowCarb, saltarCarb && i === j)) {
      c.apuntado.push(apuntadoNoCabe(h.texto))
      return
    }
  }
  for (let i = 0; i < copia.length; i++) c.reparto[i] = copia[i]
  const texto = aplicadoHabitoHueco(c.huecos[c.aMontar[j]].nombre, h.tipo)
  c.aplicado.push(texto)
  if (h.tipo === 'sin_hidratos') {
    c.sinHidratos[j] = true
    // La promesa "Cena sin hidratos" solo vale si la cena montada los lleva de verdad.
    c.porConfirmar.push({
      hueco: j,
      aplicado: texto,
      apuntado: apuntadoNoCabe(h.texto),
      texto: h.texto,
    })
  }
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
  /**
   * Las filas de los huecos que ha montado la IA (§4bis.3). Van aparte de `ajustados` porque los
   * avisos que buscan "qué alimento DICTADO tiene recorrido" (proteína corta, grasa alta, límite)
   * solo tienen sentido sobre lo que dijo la persona; los que se evalúan sobre el DÍA COMPLETO
   * (§4.4) tienen que contarlas, y sin esto un día entero de IA no emitía ni un aviso.
   */
  propuestos: readonly AlimentoAjustado[][]
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
  const deLaIa = e.propuestos.flat()
  /** Todo lo que se come ese día, lo dictado y lo propuesto: los avisos de §4.4 miran el día. */
  const delDia = [...planos, ...deLaIa]
  const hayIa = deLaIa.length > 0
  /** Un día sin ninguna comida de la persona: el copy no puede decir "tus comidas" (§4.4). */
  const menu = e.modo === 'solo_contexto'
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
      texto: avisoProteinaCorta(M.prot, T.prot, mejor ? nombreEnFrase(mejor) : null, menu),
    })
  }

  if (T.fat > 0 && M.fat < UMBRAL_GRASA_BAJA * T.fat) {
    avisos.push({ codigo: 'DIETA_GRASA_BAJA', texto: avisoGrasaBaja(M.fat, T.fat, menu) })
  }

  if (T.fat > 0 && M.fat > UMBRAL_GRASA_ALTA * T.fat) {
    const conRecorrido = planos
      .filter((a, i) => {
        if (a.estado_ajuste !== 'variable') return false
        // Solo se señala lo que sube la grasa DE VERDAD: sin esto, cuando los alimentos grasos ya
        // estaban en su mínimo, el aviso acababa pidiendo recortar el arroz por sus 0,8 g.
        if (a.aporte.fat < GRASA_RELEVANTE_G && a.aporte.fat < GRASA_RELEVANTE_PCT * M.fat) {
          return false
        }
        const v = cajaDeAlimento(i)
        return v !== undefined && a.gramos_ajustados > v.loRed + v.paso / 2
      })
      .sort((x, y) => y.aporte.fat - x.aporte.fat)
      .slice(0, 2)
      .map((a) => nombreEnFrase(a))
    avisos.push({
      codigo: 'DIETA_GRASA_ALTA',
      texto: avisoGrasaAlta(M.fat, T.fat, conRecorrido, menu),
    })
  }

  if (T.kcal > 0 && Math.abs(M.kcal - T.kcal) > UMBRAL_KCAL * T.kcal) {
    avisos.push({ codigo: 'DIETA_KCAL_LEJOS', texto: avisoKcalLejos(M.kcal - T.kcal, menu) })
  }

  const umbralHc = e.diabetes ? UMBRAL_HC_DIABETES : UMBRAL_HC
  if (T.carb > 0 && Math.abs(M.carb - T.carb) > umbralHc * T.carb) {
    avisos.push({ codigo: 'DIETA_HC_LEJOS', texto: avisoHcLejos(M.carb, T.carb) })
  }

  if (e.fibraObjetivo > 0 && M.fibra < UMBRAL_FIBRA * e.fibraObjetivo) {
    avisos.push({
      codigo: 'DIETA_FIBRA_BAJA',
      texto: avisoFibraBaja(M.fibra, e.fibraObjetivo, menu),
    })
  }

  // El candado del modo `completa` estaba porque en `parcial` los huecos los montan nuestras
  // plantillas, que siempre traen verdura. Con huecos de IA eso ya no se puede dar por hecho: un
  // día de "solo pollo y arroz" se iba sin un aviso. Con IA cambia también el texto (§4bis.3).
  if (e.modo === 'completa' || hayIa) {
    const vegetales = delDia
      .filter((a) => a.grupo_aprox === 'verdura' || a.grupo_aprox === 'fruta')
      .reduce((t, a) => t + a.gramos_ajustados, 0)
    if (vegetales < GRAMOS_VEGETALES) {
      avisos.push({
        codigo: 'DIETA_SIN_VEGETALES',
        texto: hayIa ? AVISO_SIN_VEGETALES_IA : AVISO_SIN_VEGETALES,
      })
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

  // También los propuestos: la fila pinta el distintivo "estimado" venga de donde venga, y el
  // aviso que lo explica no puede quedarse mudo justo en el día que monta la IA.
  const estimadoDictado = planos.some((a) => a.origen_macros === 'estimado')
  const estimadoIa = deLaIa.some((a) => a.origen_macros === 'estimado')
  if (estimadoDictado || estimadoIa) {
    // "Escríbelos desde «Cambiar»" solo vale si hay alguna fila editable: las de la IA no lo son.
    avisos.push({
      codigo: 'DIETA_ESTIMADOS',
      texto: estimadoDictado ? AVISO_ESTIMADOS : AVISO_ESTIMADOS_IA,
    })
  }

  const distintos = new Set(avisos.map((a) => a.codigo)).size
  if (distintos >= AVISOS_NO_CUADRA) {
    avisos.unshift({ codigo: 'DIETA_NO_CUADRA', texto: AVISO_NO_CUADRA })
  }
  return avisos
}
