// Generador de ejemplos de comidas — docs/SPEC-ux-comidas-pdf.md §3.
// Módulo puro y determinista: mismos inputs → mismo menú. Sin Math.random.
// Mantener EXACTAMENTE esta firma exportada: la UI y el PDF dependen de ella.
import type { Alimento } from '../data/foods'
import { ALIMENTOS, alimentoPorId } from '../data/foods'
import type {
  AlimentoPorcion,
  Comida,
  DiaCompuesto,
  DietaInterpretada,
  EjemploComida,
  EjemploDia,
  Ejemplos,
  Inputs,
  ListaCompra,
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
import type { PerfilDietetico } from './filtros'
import {
  clavePerfil,
  esExtra,
  esVarianteSinLactosa,
  pasaPerfil,
  pasaPerfilMenu,
  perfilDeInputs,
  perfilDeResultado,
  sustituirSinLactosa,
} from './filtros'
import type { FoodQuery, Plantilla, RolComida } from './plantillas'
import { BANCOS, HC_LOW_CARB_ALTERNO, plantillasDe } from './plantillas'
import type { BancoSencillo } from './bancoSencillo'
import {
  BANCOS_SENCILLOS,
  MAX_ALIMENTOS_SENCILLO,
  bancoSencilloEfectivo,
  idsPermitidosSemana,
} from './bancoSencillo'
import type { GramosAlimento } from './compra'
import { listaCompraDeDias, seccionOpcionalCiclo } from './compra'
import { alimentosCiclo, llevaSeccionCiclo, porRondasDeSintoma } from './ciclo'
import { componerDiaCon } from './dieta/componer'
import {
  NOTA_CARDIACA,
  NOTA_DIABETES,
  NOTA_MODO_SENCILLO,
  TEXTO_SIN_MENU,
  alternativasComida,
  avisoExcluidoInevitable,
  avisoProteinaVegetal,
  consejos,
  nombreCorto,
  notaComidaLejos,
  notaDosPlatos,
  notaFallbackSencillo,
  notaFibra,
  notaKcalDia,
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
/**
 * Desviación diaria de kcal a partir de la cual el menú lleva su nota. El cierre vigila el ±10 %
 * POR TOMA, pero las desviaciones de cada toma se suman: el PDF llegaba a imprimir un "Total del
 * día" un 9 % por encima del objetivo, a pocos centímetros del total del reparto por comidas, sin
 * que nada lo explicara.
 */
const TOLERANCIA_KCAL_DIA = 0.05

interface Contexto {
  /** Base, restricciones y banco de plantillas del usuario (§3.2, filtro combinable de la v1.1). */
  perfil: PerfilDietetico
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
  /**
   * Rol de la toma que se está construyendo (§3.2b): decide dónde manda el gusto y dónde manda la
   * plantilla. `construirComida` lo fija antes de resolver cada toma.
   */
  rolComida: RolComida
  /**
   * Modo sencillo (§3.7.2): apaga la variedad. Sin desplazamiento por usuario, sin rotación por
   * comida y sin evitar los alimentos ya usados en el día, para que las dos variantes de cada rol
   * caigan siempre sobre la misma lista corta de básicos.
   */
  sencillo: boolean
  /** Cereal de respaldo de §3.2 cuando el ancla low-carb no cubre el hidrato. `null` si no aplica. */
  hcAlterno: FoodQuery | null
  /**
   * Lista blanca de ids: ninguna `FoodQuery` puede resolverse fuera de ella. `null` en la ruta
   * normal (toda la base). La usa el respaldo de §3.7.2 para rehacer una toma con las plantillas
   * del banco normal —que tienen más formas de plato— sin salirse de la lista corta del modo
   * sencillo, que es la promesa del modo.
   */
  permitidos: ReadonlySet<string> | null
  /**
   * Segunda pasada del respaldo de §3.2b: solo se enciende cuando el respaldo de siempre no ha
   * conseguido ninguna plantilla, y solo autoriza a las consultas OBLIGATORIAS (el ancla de
   * proteína de la toma y, fuera de low-carb, la de hidrato) a usar un alimento excluido. Las
   * consultas opcionales (verdura, fruta, grasa, segunda proteína) se omiten, como ya hacían.
   */
  permitirExcluidos: boolean
  /**
   * Toma marcada "sin hidratos" por una costumbre dictada (SPEC-dieta-propia §4.3.2): se monta por
   * la vía low-carb aunque el perfil no lo sea, para que la plantilla no traiga ancla de hidrato.
   */
  lowCarbToma: boolean
}

/** ¿Esta toma se monta como low-carb? Por el perfil o por la costumbre dictada de §4.3.2. */
function esLowCarb(ctx: Contexto): boolean {
  return ctx.perfil.banco === 'low_carb' || ctx.lowCarbToma
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
 *
 * Orden normativo de §3.2b, y el orden de los pasos importa:
 *   1. base + restricciones (§3.2), que NUNCA se relajan;
 *   2. filtros de la `FoodQuery`;
 *   3. tag `extra` (§3.0): fuera de toda consulta del menú;
 *   4. **excluidos** (§3.2b), antes que cualquier otro criterio: ni en `preferidos` ni en `reserva`;
 *   5. variantes `_sl` (§3.2) y lista blanca `permitidos` (§3.7.2);
 *   6. dentro de `preferidos`, primero los FAVORITOS en el orden del usuario y después el resto
 *      de `ids_preferidos` en el orden de la plantilla.
 *
 * Dónde adelanta un favorito (§3.2b): en las tomas PRINCIPALES (comida y cena) manda el gusto y
 * el favorito va delante de todo lo que comparta su rol; en el desayuno, la merienda y los
 * tentempiés manda la plantilla, y el favorito solo adelanta si ya está en sus `ids_preferidos`.
 * Anteponerlo a ciegas metía pechuga de pollo y arroz blanco en el desayuno de quien los había
 * marcado, y en modo sencillo lo dejaba comiendo lo mismo cuatro veces al día. Una consulta sin
 * lista declarada —donde la plantilla no opina— siempre deja pasar al favorito.
 *
 * `ignorarExcluidos` solo lo activa el respaldo de §3.2b, y solo para las consultas obligatorias:
 * es la vía por la que un alimento marcado como "no me gusta" puede volver, siempre con su aviso.
 */
function candidatos(
  q: FoodQuery,
  perfil: PerfilDietetico,
  permitidos: ReadonlySet<string> | null = null,
  ignorarExcluidos = false,
  /** `true` en las tomas principales: ahí el favorito adelanta aunque la plantilla no lo liste. */
  favoritoLibre = true,
): { preferidos: Alimento[]; reserva: Alimento[]; favoritos: Alimento[] } {
  // Filtro de §3.2: la CONJUNCIÓN de la base y de todas las restricciones, antes que ningún otro
  // criterio. Las variantes «sin lactosa» solo entran en la rotación de quien las necesita; para
  // el resto de perfiles quedan como reserva (§3.2): son el mismo alimento, más caro y sin motivo.
  const sinLactosa = perfil.restricciones.includes('sin_lactosa')
  const validos = ALIMENTOS.filter(
    (a) =>
      pasaPerfil(a, perfil) &&
      pasaQuery(a, q) &&
      !esExtra(a) &&
      (ignorarExcluidos || !perfil.excluidos.has(a.id)) &&
      (sinLactosa || !esVarianteSinLactosa(a)) &&
      (permitidos === null || permitidos.has(a.id)),
  )
  if (!q.ids_preferidos) {
    // Consulta sin lista declarada: la plantilla no opina sobre qué encaja, así que el favorito
    // manda. Ser favorito no salta ningún filtro (§3.2b): solo cambia qué hay en la posición 0.
    const favoritos = perfil.favoritos
      .map((id) => validos.find((a) => a.id === id))
      .filter((a): a is Alimento => a !== undefined)
    const resto = validos
      .filter((a) => !favoritos.includes(a))
      .sort((x, y) => x.id.localeCompare(y.id))
    return { preferidos: [...favoritos, ...resto], reserva: [], favoritos }
  }
  // Sustitución por variante `_sl` de §3.2, conservando la posición en la lista de preferidos.
  const idsDeclarados = sustituirSinLactosa(q.ids_preferidos, perfil)
  // Fuera de las tomas principales solo adelantan los favoritos que la propia consulta ya
  // considera aptos: la plantilla del desayuno sabe que el pollo no es un desayuno.
  const favoritos = perfil.favoritos
    .filter((id) => favoritoLibre || idsDeclarados.includes(id))
    .map((id) => validos.find((a) => a.id === id))
    .filter((a): a is Alimento => a !== undefined)
  const declarados = idsDeclarados
    .map((id) => validos.find((a) => a.id === id))
    .filter((a): a is Alimento => a !== undefined && !favoritos.includes(a))
  const preferidos = [...favoritos, ...declarados]
  const reserva = validos
    .filter((a) => !preferidos.includes(a))
    .sort((x, y) => x.id.localeCompare(y.id))
  return { preferidos, reserva, favoritos }
}

/**
 * Elige un alimento de la consulta. La rotación se aplica solo dentro de `ids_preferidos`
 * (el orden que declara la plantilla); el resto de la base es reserva si esa lista se vacía.
 */
function elegirAlimento(
  q: FoodQuery | null,
  ctx: Contexto,
  rotacion: number,
  evitarUsados: boolean,
  obligatoria = false,
  /** Ids ya elegidos en este plato: dos anclas del mismo plato no pueden ser el mismo alimento. */
  yaEnElPlato: ReadonlySet<string> | null = null,
): Alimento | null {
  if (!q) return null
  const favoritoLibre = ctx.rolComida === 'principal'
  const {
    preferidos,
    reserva,
    favoritos: favoritosDeLaConsulta,
  } = candidatos(q, ctx.perfil, ctx.permitidos, false, favoritoLibre)
  let lista = preferidos.length > 0 ? preferidos : reserva
  if (lista.length === 0 && ctx.permitirExcluidos && obligatoria) {
    // Respaldo de §3.2b: la consulta se ha quedado sin candidatos por las exclusiones y el
    // respaldo de siempre (otras plantillas, otro rol, banco omnívoro) tampoco ha dado nada. Se
    // usa el MEJOR candidato excluido —el que la consulta habría elegido si el usuario no lo
    // hubiera marcado— y `generarEjemplos` lo anota en `Ejemplos.avisos_menu`. La base dietética
    // y las restricciones siguen puestas: eso no lo relaja ningún respaldo.
    const conExcluidos = candidatos(q, ctx.perfil, ctx.permitidos, true, favoritoLibre)
    lista = conExcluidos.preferidos.length > 0 ? conExcluidos.preferidos : conExcluidos.reserva
  }
  // Un mismo alimento no puede ocupar dos anclas del mismo plato ("atún, atún y arroz"): pasa en
  // cuanto un favorito o una legumbre sirven para dos roles a la vez. Se prueba primero con los
  // preferidos sin repetir, luego con la reserva sin repetir y, solo si no queda nada más, se
  // repite: antes un plato con el mismo alimento dos veces que un plato sin ancla.
  if (yaEnElPlato && yaEnElPlato.size > 0) {
    const sinRepetir = (l: readonly Alimento[]): Alimento[] =>
      l.filter((a) => !yaEnElPlato.has(a.id))
    const primera = sinRepetir(lista)
    const segunda = primera.length > 0 ? primera : sinRepetir(lista === preferidos ? reserva : [])
    if (segunda.length > 0) lista = segunda
  }
  if (lista.length === 0) return null
  const esVegetal =
    q.grupo === 'verdura' || q.grupo === 'fruta' || q.rol === 'verdura' || q.rol === 'fruta'
  if (ctx.priorizarFibra && (q.grupo === 'verdura' || q.rol === 'verdura')) {
    lista = [...lista].sort((x, y) => y.fibra - x.fibra)
  } else if (ctx.tomaLigera && esVegetal) {
    // En una toma pequeña la ración fija manda: se ordenan por energía de la ración ascendente.
    const energia = (a: Alimento): number => (a.kcal * a.racionTipica_g) / 100
    lista = [...lista].sort((x, y) => energia(x) - energia(y) || x.id.localeCompare(y.id))
  } else if (ctx.tomaLigera && q.rol === 'proteina') {
    // Ídem con la proteína: en un snack manda el mínimo de ración, no el orden de la plantilla.
    const proteinaMinima = (a: Alimento): number => (a.proteina * limiteRacion(a).min) / 100
    lista = [...lista].sort(
      (x, y) => proteinaMinima(x) - proteinaMinima(y) || x.id.localeCompare(y.id),
    )
  }
  // Los favoritos van SIEMPRE delante (§3.2b) y la rotación se aplica al resto de la lista
  // exactamente como antes: sin favoritos el orden que sale de aquí es idéntico al de la v1.1.
  // Si el desplazamiento se aplicara también sobre ellos, marcar un alimento como favorito
  // correría la lista y podría sacarlo del menú, que es justo lo contrario de lo que pide.
  const favoritos = favoritosDeLaConsulta.filter((a) => lista.includes(a))
  const resto = favoritos.length > 0 ? lista.filter((a) => !favoritos.includes(a)) : lista
  // En una toma pequeña manda el mínimo de ración, así que se empieza siempre por el primero
  // de la lista (el más ligero) en vez de por el desplazamiento del usuario. En modo sencillo,
  // por lo mismo: gana el primer candidato de la lista que quepa dentro de la ración (§3.7.2).
  const base = ctx.tomaLigera || ctx.sencillo ? rotacion : ctx.offset + rotacion
  const inicio = resto.length > 0 ? ((base % resto.length) + resto.length) % resto.length : 0
  const orden = [...favoritos, ...resto.slice(inicio), ...resto.slice(0, inicio)]
  if (evitarUsados && !ctx.sencillo) {
    for (const c of orden) if (!ctx.usados.has(c.id)) return c
  }
  return orden[0]
}

// ---------- Construcción de una comida ----------

const CACHE_PERFIL = new Map<string, Alimento[]>()

/**
 * Alimentos con los que se escriben las alternativas por comida: los que pasan el filtro de §3.2,
 * sin los `extra` de §3.0 y **sin los excluidos** de §3.2b (un alimento marcado como "no me gusta"
 * no puede aparecer tampoco recomendado por escrito). Los favoritos van primero: son la única
 * cosa, además del menú, en la que el orden del usuario cuenta (§3.2b).
 */
function alimentosDePerfil(perfil: PerfilDietetico): Alimento[] {
  const clave = clavePerfil(perfil)
  const guardado = CACHE_PERFIL.get(clave)
  if (guardado) return guardado
  const validos = ALIMENTOS.filter((a) => pasaPerfilMenu(a, perfil))
  const favoritos = perfil.favoritos
    .map((id) => validos.find((a) => a.id === id))
    .filter((a): a is Alimento => a !== undefined)
  const lista = [...favoritos, ...validos.filter((a) => !favoritos.includes(a))]
  CACHE_PERFIL.set(clave, lista)
  return lista
}

function rolComidaDe(nombre: string, kcal: number): RolComida {
  if (kcal > 0 && kcal < KCAL_TOMA_PEQUENA) return 'ligera'
  if (nombre === 'Desayuno') return 'desayuno'
  if (nombre === 'Comida' || nombre === 'Cena') return 'principal'
  return 'ligera'
}

/** `true` si el usuario ha marcado algo en el paso 14 (§3.2b): excluidos o favoritos. */
function usaListasDeAlimentos(perfil: PerfilDietetico): boolean {
  return perfil.excluidos.size > 0 || perfil.favoritos.length > 0
}

function resolverPlantilla(
  p: Plantilla,
  ctx: Contexto,
  rotProteina: number,
  rotVegetal: number,
  rotHc: number,
): PlantillaResuelta | null {
  // El ancla de proteína es siempre obligatoria (§3.2b); el ancla de hidrato lo es fuera de
  // low-carb, donde la propia §3.2 la declara opcional.
  const proteina = elegirAlimento(
    p.ancla_proteina,
    ctx,
    Math.max(0, rotProteina),
    rotProteina >= 0,
    true,
  )
  if (!proteina) return null
  // Ningún alimento ocupa dos anclas del mismo plato: sin esta lista, un favorito que sirve para
  // dos roles (los garbanzos son proteína e hidrato) llenaba la comida entera él solo. La guarda
  // solo se activa para quien ha marcado algo en el paso 14: los ids de las plantillas ya
  // impiden el choque por sí solos, y encenderla siempre movería menús que hoy son correctos.
  const enElPlato = usaListasDeAlimentos(ctx.perfil) ? new Set<string>([proteina.id]) : null
  const anota = (a: Alimento | null): Alimento | null => {
    if (a && enElPlato) enElPlato.add(a.id)
    return a
  }
  const proteina2 = anota(
    elegirAlimento(p.ancla_proteina_2, ctx, 1 + Math.max(0, rotProteina), false, false, enElPlato),
  )
  // En una toma pequeña la búsqueda arranca en el primer candidato (el más ligero), sin sumarle
  // el índice de la comida: la variedad la da `usados`, no el desplazamiento.
  const i = ctx.tomaLigera || ctx.sencillo ? 0 : ctx.indiceComida + ctx.plato
  // Con favoritos marcados, el hidrato y la grasa esquivan lo ya usado en el día como hace la
  // proteína (§3.2b): sin esta guarda un favorito de esos dos roles ganaba TODAS las tomas del
  // día —arroz en el desayuno, la comida, la merienda y la cena— y la semana se quedaba en cuatro
  // alimentos. Sin favoritos el comportamiento es el de la v1.1, igual que antes.
  const rotarPorFavoritos = ctx.perfil.favoritos.length > 0
  const carbohidrato = anota(
    elegirAlimento(
      p.ancla_carbohidrato,
      ctx,
      i + rotHc,
      rotarPorFavoritos,
      !esLowCarb(ctx),
      enElPlato,
    ),
  )
  const grasa = anota(
    elegirAlimento(p.ancla_grasa, ctx, i + rotHc, rotarPorFavoritos, false, enElPlato),
  )
  const rotV = Math.max(0, rotVegetal)
  const verdura = anota(
    elegirAlimento(p.verdura, ctx, i * 2 + rotV, rotVegetal >= 0, false, enElPlato),
  )
  const fruta = anota(elegirAlimento(p.fruta, ctx, i + rotV, rotVegetal >= 0, false, enElPlato))
  // Una FoodQuery obligatoria sin alimentos válidos descarta la plantilla (§3.2).
  if (p.ancla_carbohidrato && !carbohidrato && !esLowCarb(ctx)) return null
  if (p.verdura && !verdura) return null
  if (p.fruta && !fruta) return null
  // Cereal normal de respaldo, solo en low-carb: lo usa `escalarComida` si el ancla low-carb no
  // puede cubrir el hidrato del plan ni con su ración máxima (§3.2). En modo sencillo la consulta
  // llega recortada a un único id que ya está en la lista corta, para no romper el tope de 12.
  const carbohidrato_alterno = elegirAlimento(
    ctx.hcAlterno,
    ctx,
    i + rotHc,
    false,
    false,
    enElPlato,
  )
  return {
    id: p.id,
    proteina,
    proteina2,
    carbohidrato,
    carbohidrato_alterno,
    grasa,
    verdura,
    fruta,
  }
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

/**
 * Agrupa por alimento las porciones de una toma servida en varios platos (§3.3). La tabla de la
 * pantalla y la del PDF no distinguen los platos, así que sin agrupar salían líneas idénticas
 * repetidas dentro de la misma comida ("plátano 120 g / … / plátano 120 g"). Se suman los valores
 * ya redondeados de cada porción, no los gramos en crudo, para que los totales de la comida no se
 * muevan ni un kcal respecto de los que cierra el escalado.
 */
function agruparPorAlimento(porciones: readonly Porcion[]): AlimentoPorcion[] {
  const orden: string[] = []
  const suma = new Map<string, AlimentoPorcion>()
  const alimentos = new Map<string, Alimento>()
  for (const p of porciones) {
    const ui = porcionAPorcionUi(p)
    const previo = suma.get(ui.id)
    if (!previo) {
      orden.push(ui.id)
      suma.set(ui.id, ui)
      alimentos.set(ui.id, p.alimento)
      continue
    }
    previo.gramos += ui.gramos
    previo.kcal += ui.kcal
    previo.prot = redondea1(previo.prot + ui.prot)
    previo.carb = redondea1(previo.carb + ui.carb)
    previo.fat = redondea1(previo.fat + ui.fat)
  }
  for (const id of orden) {
    const ui = suma.get(id)!
    ui.medida = textoMedida(alimentos.get(id)!, ui.gramos)
  }
  return orden.map((id) => suma.get(id)!)
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
  // Y al final de la lista, el rol contrario como último recurso: las ligeras para una toma
  // que no cabe en ninguna plantilla de su rol por pequeña, y las principales para el caso
  // simétrico, una "ligera" que en realidad no lo es (una merienda de 600 kcal en un plan de
  // 3.500 no cabe en yogur + fruta, y las plantillas ligeras se quedaban un 12 % cortas).
  const orden = [
    ...(noUsadas.length > 0 ? [...noUsadas, ...disponibles] : disponibles),
    ...plantillasDe(banco, rol === 'ligera' ? 'principal' : 'ligera'),
  ]

  let mejor: { porciones: Porcion[]; plantillas: string[] } | null = null
  let mejorNota = Number.POSITIVE_INFINITY

  busqueda: for (const plantilla of orden) {
    for (const rotProteina of ROTACIONES_PROTEINA) {
      for (const rotVegetal of ROTACIONES_VEGETAL) {
        for (const rotHc of ROTACIONES_HC) {
          const resuelta = resolverPlantilla(plantilla, ctx, rotProteina, rotVegetal, rotHc)
          if (!resuelta) continue
          const porciones = escalarComida(objetivo, resuelta, esLowCarb(ctx))
          const desvKcal =
            objetivo.kcal > 0
              ? Math.abs(kcalPublicada(porciones) - objetivo.kcal) / objetivo.kcal
              : 0
          const desvProt =
            objetivo.prot > 0
              ? Math.abs(proteinaPublicada(porciones) - objetivo.prot) / objetivo.prot
              : 0
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

  // Respaldo de §3.2b: si NINGUNA plantilla ha resuelto —porque las exclusiones han vaciado una
  // consulta obligatoria— se repite la búsqueda entera autorizando a esas consultas (y solo a
  // esas) a usar el mejor candidato excluido. `generarEjemplos` lo anota en `avisos_menu`:
  // preferimos un alimento que no gusta CON su aviso a una comida sin proteína, pero nunca en
  // silencio. Fuera de ese caso el flag no se enciende y no cambia ni un menú.
  if (!mejor && !ctx.permitirExcluidos && ctx.perfil.excluidos.size > 0) {
    ctx.permitirExcluidos = true
    try {
      return construirPlato(objetivo, rol, ctx, banco, usadas)
    } finally {
      ctx.permitirExcluidos = false
    }
  }

  // La validación de la base hace imposible quedarse sin plantilla; si pasara, no se muestra
  // una comida vacía: se devuelve el plato sin alimentos y se anota más arriba.
  if (!mejor) return { porciones: [], plantillas: [] }

  for (const p of mejor.porciones) {
    if (p.rol === 'proteina' || p.rol === 'proteina2') ctx.usados.add(p.alimento.id)
    if (p.rol === 'verdura' || p.rol === 'fruta') ctx.usados.add(p.alimento.id)
    // Los dos roles que la v1.1 no anotaba: solo se registran cuando hay favoritos, que es cuando
    // `resolverPlantilla` los consulta (§3.2b). Así ningún menú sin listas cambia.
    if (ctx.perfil.favoritos.length > 0 && (p.rol === 'carbohidrato' || p.rol === 'grasa')) {
      ctx.usados.add(p.alimento.id)
    }
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
function construirComida(
  comida: Comida,
  ctx: Contexto,
  banco: readonly Plantilla[],
  usadas: Set<string>,
): ComidaResuelta {
  const objetivo: Macros = {
    kcal: comida.kcal,
    prot: comida.proteina_g,
    carb: comida.hc_g,
    fat: comida.grasa_g,
  }
  const rol = rolComidaDe(comida.nombre, comida.kcal)
  ctx.rolComida = rol
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

  // Una toma de un solo plato ya viene con una línea por alimento; las de varios platos se
  // agrupan para no repetir la misma línea tantas veces como platos (§3.3).
  const alimentos = platos > 1 ? agruparPorAlimento(porciones) : porciones.map(porcionAPorcionUi)
  const totales: Macros = {
    kcal: alimentos.reduce((t, a) => t + a.kcal, 0),
    prot: redondea1(alimentos.reduce((t, a) => t + a.prot, 0)),
    carb: redondea1(alimentos.reduce((t, a) => t + a.carb, 0)),
    fat: redondea1(alimentos.reduce((t, a) => t + a.fat, 0)),
  }
  // Las desviaciones se miden sobre los totales publicados (los de `totales`), no sobre las
  // sumas internas sin redondear: es lo que ve la pantalla y lo que comprueban los tests.
  const desviacionProteina =
    objetivo.prot > 0 ? Math.abs(totales.prot - objetivo.prot) / objetivo.prot : 0
  const desviacionKcal =
    objetivo.kcal > 0 ? Math.abs(totales.kcal - objetivo.kcal) / objetivo.kcal : 1

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
      alternativas: alternativasComida(porciones, alimentosDePerfil(ctx.perfil)),
      // Solo cuando hay más de uno: `alimentos` va agrupado y sus gramos son los de la toma
      // entera, así que quien compruebe los límites de ración de §3.3 necesita saberlo.
      ...(platos > 1 ? { platos } : {}),
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

interface OpcionesDia {
  /** Reparto por comidas del motor (`resultado.comidas`) o el reconstruido desde `Ejemplos`. */
  comidas: readonly Comida[]
  /** Tomas que hay que montar sin hidratos (SPEC-dieta-propia §4.3.2); por índice de `comidas`. */
  sinHidratos?: readonly boolean[]
  perfil: PerfilDietetico
  offset: number
  priorizarFibra: boolean
  /** Banco de plantillas: el de §3.2 o una de las dos variantes del banco sencillo (§3.7.2). */
  banco: readonly Plantilla[]
  sencillo: boolean
  /**
   * Banco sencillo ya resuelto para el perfil (§3.7.2, restricciones combinadas). En modo sencillo
   * fija la lista blanca de la semana y la vía de escape recortada; `null` en modo normal.
   */
  bancoSencillo?: BancoSencillo | null
}

/**
 * Cereal de respaldo de §3.2: solo en low-carb. En modo sencillo llega recortado a un único id de
 * la lista blanca (`bancoSencillo.hcAlterno`), para no romper el tope de 12 alimentos.
 */
function hcAlternoDe(
  perfil: PerfilDietetico,
  bancoSencillo: BancoSencillo | null,
): FoodQuery | null {
  if (perfil.banco !== 'low_carb') return null
  return bancoSencillo ? bancoSencillo.hcAlterno : HC_LOW_CARB_ALTERNO
}

/** Toma con más hidrato del reparto (empates: la primera). Determinista. */
function indiceMasHidrato(comidas: readonly Comida[]): number {
  let mejor = 0
  for (let i = 1; i < comidas.length; i++) if (comidas[i].hc_g > comidas[mejor].hc_g) mejor = i
  return mejor
}

function construirDia(o: OpcionesDia): DiaConstruido {
  const bancoSencillo = o.sencillo ? (o.bancoSencillo ?? null) : null
  const ctx: Contexto = {
    perfil: o.perfil,
    offset: o.offset,
    usados: new Set(),
    indiceComida: 0,
    priorizarFibra: o.priorizarFibra,
    tomaLigera: false,
    plato: 0,
    rolComida: 'principal',
    sencillo: o.sencillo,
    hcAlterno: hcAlternoDe(o.perfil, bancoSencillo),
    // En modo sencillo ninguna `FoodQuery` puede salirse de la lista blanca ya filtrada por el
    // perfil (§3.7.2, regla 3): cuando los ids de la plantilla no pasan el filtro —un banco
    // vegetariano con `sin_gluten`, por ejemplo— la reserva se busca dentro de esa lista corta,
    // no en toda la base, que es lo que rompería el tope de 12 alimentos y la promesa del modo.
    permitidos: bancoSencillo ? idsPermitidosSemana(bancoSencillo) : null,
    permitirExcluidos: false,
    lowCarbToma: false,
  }
  // Vía de escape de §3.2 (el cereal normal del low-carb): en modo sencillo se permite en UNA
  // sola toma, la de más hidrato del reparto. Sin este tope la patata ganaba en las tres comidas
  // —encabezando la lista de la compra de quien había pedido low-carb— y ni el arroz de coliflor
  // ni el pan proteico llegaban a aparecer nunca.
  const escapeSencillo = ctx.hcAlterno
  const indiceEscape = o.sencillo ? indiceMasHidrato(o.comidas) : -1
  const banco = o.banco
  const usadas = new Set<string>()
  const comidas: ComidaResuelta[] = []
  for (const comida of o.comidas) {
    if (o.sencillo) ctx.hcAlterno = ctx.indiceComida === indiceEscape ? escapeSencillo : null
    // Una toma "sin hidratos" se monta con el banco low-carb, que es el único cuyas plantillas no
    // llevan ancla de carbohidrato: puntuar por kcal y proteína no basta para quitarla (§4.3.2).
    ctx.lowCarbToma = o.sinHidratos?.[ctx.indiceComida] === true
    const bancoToma = ctx.lowCarbToma && !o.sencillo ? BANCOS.low_carb : banco
    comidas.push(construirComida(comida, ctx, bancoToma, usadas))
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
  return {
    tipo,
    comidas: [],
    totales: { kcal: 0, prot: 0, carb: 0, fat: 0 },
    notas: [TEXTO_SIN_MENU],
  }
}

/**
 * Genera un día de ejemplo que cuadra con el reparto por comidas del motor.
 * En la v1 el motor devuelve UN solo array `comidas` (SPEC-calculo §2 Paso 16): no hay reparto de día
 * de entreno y de día de descanso, así que ambos días del contrato salen del mismo reparto.
 */
export function generarEjemplos(inputs: Inputs, resultado: Resultado, variante = 0): Ejemplos {
  // Filtro combinable de §3.2: base + todas las restricciones. Sale de `Resultado` (el motor lo
  // publica normalizado) y, si es un `Resultado` de la v1.0 que no lo trae, de la regla de
  // traducción de `SPEC-calculo.md` §1.1 aplicada a `preferencia_efectiva`.
  // Las dos listas del paso 14 (§3.2b) viajan en `InputCalculo`, no en `Resultado`: el motor las
  // ignora por completo y no las publica. Por eso el perfil se construye con los dos objetos.
  const perfil = perfilDeResultado(resultado, inputs)
  const preferencia = perfil.banco
  const tablas = equivalencias(perfil)

  // Corte de seguridad por condiciones, antes que nada (§3.1).
  if (inputs.condiciones.includes('renal') || inputs.condiciones.includes('hepatica')) {
    return {
      entreno: diaSinMenu('entreno'),
      descanso: diaSinMenu('descanso'),
      consejos: consejos(resultado.objetivo_efectivo, preferencia, inputs.n_comidas),
      equivalencias: tablas,
      modo_sencillo: inputs.menu_sencillo === true,
      preferencia_efectiva: preferencia,
    }
  }

  // Banco sencillo ya resuelto para el perfil (§3.7.2, restricciones combinadas). `null` cuando
  // ni con el relleno hay candidatos suficientes: entonces el modo sencillo se desactiva y el
  // menú sale de la rotación normal de §3.2, que sí tiene toda la base disponible (regla 4c).
  const bancoSencillo = bancoSencilloEfectivo(perfil)
  const sencillo = inputs.menu_sencillo === true && bancoSencillo !== null

  // "Ver otro ejemplo" (§2.5) desplaza el índice de arranque en +1: mismo plan, otras plantillas.
  // En modo sencillo no hay desplazamiento: el menú es siempre el mismo par de días (§3.7.2).
  const offset = sencillo ? 0 : inputs.n_comidas + inputs.edad + Math.max(0, Math.trunc(variante))
  const opcionesDe = (p: PerfilDietetico, bs: BancoSencillo | null): OpcionesDia => ({
    comidas: resultado.comidas,
    perfil: p,
    offset,
    priorizarFibra: false,
    banco: sencillo && bs ? bs.A : BANCOS[preferencia],
    sencillo,
    bancoSencillo: bs,
  })
  // El perfil con el que se construye el menú puede perder favoritos por el tope de variedad del
  // modo sencillo (justo debajo); los excluidos, nunca.
  let perfilMenu = perfil
  let bancoMenu = bancoSencillo
  let opciones = opcionesDe(perfilMenu, bancoMenu)
  let dia = construirDia(opciones)
  // Modo sencillo: el día B (días pares) usa las variantes `…-B` del mismo banco corto. No viaja
  // en `Ejemplos` (§3.7.3), solo sirve para ponderar 4/3 los gramos de la lista de la compra.
  //
  // El día B se construye con UN SOLO favorito, el primero de la lista (§3.2b, modo sencillo): en
  // modo sencillo la rotación por día está apagada, así que tres favoritos ganaban las dos tomas
  // principales de los siete días y la semana entera se quedaba en cinco alimentos. Con esta
  // regla los días 1, 3, 5 y 7 llevan todo lo que le gusta al usuario, los días 2, 4 y 6 llevan
  // su favorito principal y la otra opción de la lista corta, y el tope de 12 sigue en pie.
  const diaBDe = (o: OpcionesDia, banco: readonly Plantilla[]): DiaConstruido =>
    construirDia({
      ...o,
      banco,
      perfil: { ...o.perfil, favoritos: o.perfil.favoritos.slice(0, 1) },
    })
  let diaB = sencillo && bancoMenu ? diaBDe(opciones, bancoMenu.B) : null

  // Tope de variedad del modo sencillo (§3.7.2, regla 1, y §3.2b: "sin superar nunca el tope de
  // 12"). Un favorito que sirve para un rol pero no gana todas sus consultas añade un alimento a
  // la semana sin quitar ninguno. Cuando eso rompe el tope se retiran favoritos POR EL FINAL —el
  // orden del usuario es una prioridad— hasta que la semana vuelve a caber: los 12 alimentos son
  // la promesa del modo y mandan sobre el gusto.
  while (
    sencillo &&
    diaB &&
    perfilMenu.favoritos.length > 0 &&
    idsSemana(dia, diaB).size > MAX_ALIMENTOS_SENCILLO
  ) {
    perfilMenu = { ...perfilMenu, favoritos: perfilMenu.favoritos.slice(0, -1) }
    const recortado = bancoSencilloEfectivo(perfilMenu)
    if (!recortado) break
    bancoMenu = recortado
    opciones = opcionesDe(perfilMenu, bancoMenu)
    dia = construirDia(opciones)
    diaB = diaBDe(opciones, bancoMenu.B)
  }

  // Comprobación de fibra (§3.3): primero se rota a verduras de más fibra; si aun así no llega, nota.
  // En modo sencillo la lista de verduras tiene un único candidato: reordenarla no cambiaría nada.
  const fibraObjetivo = resultado.macros.fibra_g
  const umbralFibra = 0.7 * fibraObjetivo
  if (!sencillo && dia.fibra < umbralFibra) {
    const alterno = construirDia({ ...opciones, priorizarFibra: true })
    const mejora = alterno.fibra > dia.fibra
    const noEmpeora = alterno.convergen || !dia.convergen
    if (mejora && noEmpeora) dia = alterno
  }

  // Respaldo de §3.7.2: una toma que el banco sencillo no consigue cuadrar se rehace con el banco
  // normal. Solo se acepta si no rompe el tope de 12 alimentos distintos en la semana, que es la
  // promesa del modo; si lo rompe, se prefiere el menú sencillo con su nota de desviación.
  const notasFallback: string[] = []
  if (sencillo && diaB && bancoMenu) {
    const conFallback = aplicarFallbackSencillo(
      dia,
      diaB,
      resultado.comidas,
      perfilMenu,
      bancoMenu,
      offset,
    )
    if (conFallback) {
      dia = conFallback.dia
      diaB = conFallback.diaB
      notasFallback.push(...conFallback.notas)
    }
  }

  const notas: string[] = []
  if (sencillo) notas.push(NOTA_MODO_SENCILLO)
  if (inputs.condiciones.includes('diabetes')) notas.push(NOTA_DIABETES)
  if (inputs.condiciones.includes('cardiaca')) notas.push(NOTA_CARDIACA)
  notas.push(...notasFallback)

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
    Math.abs(totalesDelDia.fat - resultado.macros.grasa_g) / resultado.macros.grasa_g >
      TOLERANCIA_MACRO_DIA
  ) {
    notas.push(notaMacroDia('grasa', totalesDelDia.fat, resultado.macros.grasa_g, false))
  }
  if (
    resultado.kcal > 0 &&
    Math.abs(totalesDelDia.kcal - resultado.kcal) / resultado.kcal > TOLERANCIA_KCAL_DIA
  ) {
    notas.push(notaKcalDia(totalesDelDia.kcal, resultado.kcal))
  }

  const comidas = dia.comidas.map((c) => c.ejemplo)
  const totales = totalesDelDia
  const entreno: EjemploDia = { tipo: 'entreno', comidas, totales, notas }
  const descanso: EjemploDia = { tipo: 'descanso', comidas, totales, notas }

  // Respaldo de exclusiones (§3.2b): un excluido que ha tenido que volver porque sin él la toma
  // no cerraba lleva su aviso. Uno por alimento y comida, sin duplicados y en el orden de las
  // tomas. Con la lista vacía este bucle no hace nada y `avisos_menu` no se publica.
  const avisos_menu: string[] = []
  if (perfil.excluidos.size > 0) {
    const vistos = new Set<string>()
    for (const c of comidas) {
      for (const a of c.alimentos) {
        const clave = `${a.id}|${c.comida}`
        if (!perfil.excluidos.has(a.id) || vistos.has(clave)) continue
        vistos.add(clave)
        avisos_menu.push(avisoExcluidoInevitable(alimentoPorId(a.id)!, c.comida))
      }
    }
  }

  // Alimentos para los días de regla (§3.8.1) y su sección opcional en la compra (§3.8.2). Las
  // dos son pequeñas, opcionales y NO cambian ni un gramo del plan.
  const ciclo = alimentosCiclo(resultado, perfil)
  const compra = listaCompraDeDias(gramosDeDia(dia), diaB ? gramosDeDia(diaB) : null)
  if (ciclo.length > 0 && llevaSeccionCiclo(resultado)) {
    const opcional = seccionOpcionalCiclo(
      porRondasDeSintoma(ciclo).map((c) => ({
        id: c.id,
        nombre: c.nombre,
        racionTipica_g: c.alimento.racionTipica_g,
      })),
      new Set(compra.items.map((i) => i.alimento_id)),
    )
    // `alimentos_distintos` sigue siendo `items.length`: la sección opcional no es del plan.
    if (opcional) compra.opcional_ciclo = opcional
  }

  // Favoritos REALMENTE servidos (§3.2b): el tope de 12 del modo sencillo puede retirar alguno, y
  // un favorito que ninguna plantilla considera apto para sus tomas puede no llegar al plato. El
  // resumen de §2.5 y §4.4 imprime esta lista y no la del cuestionario: prometer un favorito que
  // no está ni en el menú ni en la compra es exactamente lo que la decisión G venía a evitar.
  const enLaSemana = idsSemana(dia, diaB)
  const favoritos_aplicados = perfil.favoritos.filter((id) => enLaSemana.has(id))

  return {
    entreno,
    descanso,
    consejos: consejos(resultado.objetivo_efectivo, preferencia, inputs.n_comidas),
    equivalencias: tablas,
    ...(perfil.favoritos.length > 0 ? { favoritos_aplicados } : {}),
    // La lista de la compra se genera SIEMPRE que hay menú, en modo sencillo o normal (§3.7.3).
    compra,
    modo_sencillo: sencillo,
    preferencia_efectiva: preferencia,
    ...(avisos_menu.length > 0 ? { avisos_menu } : {}),
    ...(ciclo.length > 0
      ? { alimentos_ciclo: ciclo.map(({ id, nombre, por_que }) => ({ id, nombre, por_que })) }
      : {}),
  }
}

// ---------- Modo sencillo: respaldo y tope de variedad (§3.7.2) ----------

/** Gramos de cada alimento de un día construido, listos para la lista de la compra. */
function gramosDeDia(dia: DiaConstruido): GramosAlimento[] {
  const lista: GramosAlimento[] = []
  for (const c of dia.comidas) {
    for (const a of c.ejemplo.alimentos)
      lista.push({ id: a.id, nombre: a.nombre, gramos: a.gramos })
  }
  return lista
}

/** Ids de los alimentos que aparecen en la semana (día A + día B). */
function idsSemana(dia: DiaConstruido, diaB: DiaConstruido | null): Set<string> {
  const ids = new Set<string>()
  for (const g of gramosDeDia(dia)) ids.add(g.id)
  if (diaB) for (const g of gramosDeDia(diaB)) ids.add(g.id)
  return ids
}

/**
 * Rehace una sola toma con las plantillas del banco normal de §3.2 —que reparten los papeles de
 * otra manera y suelen cerrar mejor una toma difícil— pero **restringidas a la lista blanca del
 * banco sencillo**: el respaldo de §3.7.2 no puede meter en la compra nada que no esté en la
 * lista corta de la preferencia. Contexto propio y determinista.
 */
function rehacerConBancoNormal(
  comida: Comida,
  indice: number,
  perfil: PerfilDietetico,
  offset: number,
  permitidos: ReadonlySet<string>,
): ComidaResuelta {
  const ctx: Contexto = {
    perfil,
    offset,
    usados: new Set(),
    indiceComida: indice,
    priorizarFibra: false,
    tomaLigera: false,
    plato: 0,
    rolComida: 'principal',
    sencillo: false,
    hcAlterno: hcAlternoDe(perfil, null),
    permitidos,
    permitirExcluidos: false,
    lowCarbToma: false,
  }
  return construirComida(comida, ctx, plantillasRespaldo(perfil.banco, comida), new Set())
}

/**
 * Plantillas del banco normal con las que el respaldo de §3.7.2 puede rehacer una toma: SOLO las
 * de su propio `rol_comida`.
 *
 * `construirPlato` añade las plantillas ligeras al final de la lista como último recurso, y con
 * la lista blanca corta del modo sencillo esa red de seguridad convertía un desayuno en una cena
 * (brócoli y atún a las ocho de la mañana). Recortando el banco antes de construir, para un
 * desayuno o una comida principal `plantillasDe(banco, 'ligera')` sale vacío y la sustitución
 * solo puede salir de su propio rol; si ninguna plantilla del rol cuadra, la toma se queda sin
 * porciones y `aplicarFallbackSencillo` la descarta, que es exactamente lo que queremos.
 */
export function plantillasRespaldo(preferencia: Preferencia, comida: Comida): readonly Plantilla[] {
  const rol = rolComidaDe(comida.nombre, comida.kcal)
  return BANCOS[preferencia].filter((p) => p.rol_comida === rol)
}

function recomponerDia(comidas: ComidaResuelta[]): DiaConstruido {
  return {
    comidas,
    fibra: comidas.reduce((t, c) => t + sumaFibra(c.porciones), 0),
    convergen: comidas.every((c) => c.converge),
  }
}

/**
 * Respaldo de §3.7.2: sustituye por el banco normal de §3.2 las tomas que el banco sencillo no
 * consigue meter dentro del ±10 % de kcal de §3.3. Las tomas se prueban de una en una y en orden,
 * y una sustitución solo se acepta si la semana sigue cabiendo en `MAX_ALIMENTOS_SENCILLO`
 * alimentos distintos **y todos ellos están en la lista blanca de la preferencia**: el tope de
 * variedad y la lista corta son la promesa del modo y mandan sobre el ajuste fino.
 * Devuelve `null` si no se ha aceptado ninguna sustitución.
 */
function aplicarFallbackSencillo(
  dia: DiaConstruido,
  diaB: DiaConstruido,
  comidas: readonly Comida[],
  perfil: PerfilDietetico,
  bancoSencillo: BancoSencillo,
  offset: number,
): { dia: DiaConstruido; diaB: DiaConstruido; notas: string[] } | null {
  const permitidos = new Set(bancoSencillo.candidatos)
  // Candidatas: tomas que el banco sencillo no cierra y que el normal sí. Se calculan una vez.
  const alternas = new Map<number, ComidaResuelta>()
  for (let i = 0; i < comidas.length; i++) {
    const a = dia.comidas[i]
    const b = diaB.comidas[i]
    if (!a || !b || (a.converge && b.converge)) continue
    const alterna = rehacerConBancoNormal(comidas[i], i, perfil, offset, permitidos)
    if (!alterna.converge || alterna.porciones.length === 0) continue
    // Cerrar las kcal no puede salir caro en proteína: el respaldo solo entra si la deja dentro
    // de la tolerancia de §3.3 o, al menos, no peor que la toma que sustituye. Sin esta guarda,
    // una toma muy grande cambiaba una desviación de calorías por una de 60 puntos de proteína.
    const peor = Math.max(a.desviacionProteina, b.desviacionProteina)
    if (alterna.desviacionProteina > TOLERANCIA_PROTEINA && alterna.desviacionProteina > peor)
      continue
    alternas.set(i, alterna)
  }
  if (alternas.size === 0) return null

  const aplicar = (indices: readonly number[]): { A: ComidaResuelta[]; B: ComidaResuelta[] } => {
    const A = [...dia.comidas]
    const B = [...diaB.comidas]
    for (const i of indices) {
      const alterna = alternas.get(i)
      if (!alterna) continue
      if (!A[i].converge) A[i] = alterna
      if (!B[i].converge) B[i] = alterna
    }
    return { A, B }
  }
  // Guarda del respaldo: la semana tiene que seguir cabiendo en el tope de variedad Y no salirse
  // de la lista blanca de §3.7.2. Sin la segunda condición el menú "sencillo" acababa con
  // proteína de guisante en polvo o semillas de lino en la lista de la compra, que es justo lo
  // que el modo promete no hacer (§3.7.2, regla 3). `rehacerConBancoNormal` ya trabaja dentro de
  // la lista blanca; la comprobación se queda como red de seguridad del invariante.
  const deLaSemana = idsPermitidosSemana(bancoSencillo)
  const cabe = (r: { A: ComidaResuelta[]; B: ComidaResuelta[] }): boolean => {
    const ids = idsSemana(recomponerDia(r.A), recomponerDia(r.B))
    if (ids.size > MAX_ALIMENTOS_SENCILLO) return false
    for (const id of ids) if (!deLaSemana.has(id)) return false
    return true
  }

  // Primero, todas a la vez: es lo que menos alimentos añade cuando el banco normal reutiliza los
  // mismos básicos. Si no cabe, se aceptan de una en una mientras el tope lo permita.
  const todas = [...alternas.keys()]
  let elegidas = todas
  if (!cabe(aplicar(todas))) {
    elegidas = []
    for (const i of todas) {
      const prueba = [...elegidas, i]
      if (cabe(aplicar(prueba))) elegidas = prueba
    }
  }
  if (elegidas.length === 0) return null

  const { A, B } = aplicar(elegidas)
  const notas = elegidas.map((i) => notaFallbackSencillo(dia.comidas[i].ejemplo.comida))
  return { dia: recomponerDia(A), diaB: recomponerDia(B), notas: [...new Set(notas)] }
}

// ---------- Lista de la compra semanal (§3.7.3) ----------

/**
 * Gramos por alimento del día que viaja en `Ejemplos` (el día A del par, en modo sencillo).
 * Trabaja sobre `alimentos[]`, que es exactamente lo que ve el usuario en la pantalla.
 */
function gramosDeEjemplo(comidas: readonly EjemploComida[]): GramosAlimento[] {
  const lista: GramosAlimento[] = []
  for (const c of comidas) {
    for (const a of c.alimentos) lista.push({ id: a.id, nombre: a.nombre, gramos: a.gramos })
  }
  return lista
}

const PREFERENCIAS: readonly Preferencia[] = [
  'omnivoro',
  'vegetariano',
  'vegano',
  'sin_lactosa',
  'sin_gluten',
  'low_carb',
]

/**
 * Preferencia con la que se construyó un menú sencillo. No se puede leer de `inputs.preferencia`
 * sin más: el Paso 6.8 del motor anula el low-carb con `diabetes`. Lo normal es que `Ejemplos`
 * la traiga escrita (`preferencia_efectiva`); si no —un `Ejemplos` construido a mano—, se deduce
 * de los alimentos del día A **por mayoría**, no exigiendo que todos estén en el banco: con la
 * pertenencia total, un solo alimento raro dejaba sin encajar a las seis preferencias y la
 * respuesta caía en `inputs.preferencia`, que puede no ser la efectiva.
 */
function preferenciaDelMenu(
  ejemplos: Ejemplos,
  comidas: readonly EjemploComida[],
  inputs: Inputs,
): Preferencia {
  if (ejemplos.preferencia_efectiva) return ejemplos.preferencia_efectiva
  const ids = new Set(gramosDeEjemplo(comidas).map((g) => g.id))
  // La del usuario va primero: con empate a votos, gana ella.
  const orden = [inputs.preferencia, ...PREFERENCIAS.filter((p) => p !== inputs.preferencia)]
  let mejor = inputs.preferencia
  let mejorVotos = -1
  for (const p of orden) {
    const permitidos = idsPermitidosSemana(BANCOS_SENCILLOS[p])
    let votos = 0
    for (const id of ids) if (permitidos.has(id)) votos++
    if (votos > mejorVotos) {
      mejorVotos = votos
      mejor = p
    }
  }
  return mejor
}

/** Reconstruye el reparto por comidas a partir del día que viaja en `Ejemplos`. */
function comidasDeEjemplo(comidas: readonly EjemploComida[]): Comida[] {
  return comidas.map((c) => ({
    nombre: c.comida,
    hora: c.hora,
    pct_kcal: 0,
    proteina_g: c.objetivo.prot,
    grasa_g: c.objetivo.fat,
    hc_g: c.objetivo.carb,
    kcal: c.objetivo.kcal,
    peri: c.peri,
  }))
}

/**
 * Lista de la compra semanal del menú (§3.7.3). Es exactamente lo que `generarEjemplos` deja en
 * `Ejemplos.compra`: si ya está calculada se devuelve tal cual, y si no (un `Ejemplos` construido
 * a mano) se calcula desde los gramos del día que sí viaja. En modo sencillo reconstruye el día B
 * con la misma regla determinista de §3.7.2 y pondera los dos días 4/3 (§3.7.3).
 *
 * Pura y determinista: mismos `Ejemplos` e `Inputs` → misma lista, incluido el orden de `items`.
 */
export function generarListaCompra(ejemplos: Ejemplos, inputs: Inputs): ListaCompra {
  if (ejemplos.compra) return ejemplos.compra

  const comidas = ejemplos.entreno.comidas
  const diaA = gramosDeEjemplo(comidas)
  const sencillo = inputs.menu_sencillo === true
  if (!sencillo || comidas.length === 0) return listaCompraDeDias(diaA, null)

  const preferencia = preferenciaDelMenu(ejemplos, comidas, inputs)
  // El perfil sale de `Inputs` (regla de traducción del paso 0): `Ejemplos` solo lleva el banco,
  // que con la decisión E puede no reflejar todas las restricciones del usuario.
  const perfil = perfilDeInputs(inputs, preferencia)
  const bancoSencillo = bancoSencilloEfectivo(perfil)
  // Sin banco sencillo válido no hubo día B: el menú se generó con la rotación normal (regla 4c).
  if (!bancoSencillo) return listaCompraDeDias(diaA, null)
  const diaB = construirDia({
    comidas: comidasDeEjemplo(comidas),
    perfil,
    offset: 0,
    priorizarFibra: false,
    banco: bancoSencillo.B,
    sencillo: true,
    bancoSencillo,
  })
  return listaCompraDeDias(diaA, gramosDeDia(diaB))
}

// ---------- v1.3: "Cuéntanos cómo comes" (docs/SPEC-dieta-propia.md §4) ----------

/**
 * Monta SOLO los huecos que quedan libres cuando la persona nos ha contado alguna de sus comidas
 * (§4.3.3). Reutiliza `construirDia` con los `Comida` objetivo que trae el reparto del resto
 * —mismo nombre, misma hora y mismo `peri` que el hueco del plan— y con el perfil de siempre, que
 * ya lleva sumados los gustos del audio a las listas del paso 14 (§5.5).
 *
 * Devuelve también las notas del generador (dos platos, toma que no cierra, proteína lejos y el
 * respaldo de exclusiones), que §4.3.3 manda recoger en `DiaCompuesto.notas`.
 */
function montarHuecos(
  inputs: Inputs,
  resultado: Resultado,
  huecos: readonly Comida[],
  variante: number,
  sinHidratos: readonly boolean[] = [],
): { comidas: EjemploComida[]; notas: string[] } {
  if (huecos.length === 0) return { comidas: [], notas: [] }
  const perfil = perfilDeResultado(resultado, inputs)
  const bancoSencillo = bancoSencilloEfectivo(perfil)
  const sencillo = inputs.menu_sencillo === true && bancoSencillo !== null
  // Mismo desplazamiento que el menú propuesto (§3.2): "Ver otro ejemplo" solo cambia `variante`.
  const offset = sencillo ? 0 : inputs.n_comidas + inputs.edad + Math.max(0, Math.trunc(variante))
  const dia = construirDia({
    comidas: huecos,
    sinHidratos,
    perfil,
    offset,
    priorizarFibra: false,
    banco: sencillo && bancoSencillo ? bancoSencillo.A : BANCOS[perfil.banco],
    sencillo,
    bancoSencillo,
  })

  const notas: string[] = []
  for (let i = 0; i < dia.comidas.length; i++) {
    const c = dia.comidas[i]
    if (c.platos > 1) notas.push(notaDosPlatos(c.ejemplo.comida, huecos[i].kcal, c.platos))
    if (c.porciones.length === 0) continue
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
  if (perfil.excluidos.size > 0) {
    const vistos = new Set<string>()
    for (const c of dia.comidas) {
      for (const a of c.ejemplo.alimentos) {
        const clave = `${a.id}|${c.ejemplo.comida}`
        if (!perfil.excluidos.has(a.id) || vistos.has(clave)) continue
        vistos.add(clave)
        notas.push(avisoExcluidoInevitable(alimentoPorId(a.id)!, c.ejemplo.comida))
      }
    }
  }
  return { comidas: dia.comidas.map((c) => c.ejemplo), notas }
}

/**
 * Menú de un subconjunto de tomas con los objetivos que se le pasen (§4.3.3). Es la puerta que
 * usa la composición del día; también sirve para montar un día entero pasándole `resultado.comidas`.
 */
export function generarComidas(
  inputs: Inputs,
  resultado: Resultado,
  huecos: readonly Comida[],
  variante = 0,
  sinHidratos: readonly boolean[] = [],
): EjemploComida[] {
  return montarHuecos(inputs, resultado, huecos, Math.max(0, Math.trunc(variante)), sinHidratos)
    .comidas
}

/**
 * Compone el día con lo que la persona nos contó (SPEC-dieta-propia §4). Puro y determinista.
 * El algoritmo vive en `./dieta/componer`; aquí se le inyecta el generador de menús, que es lo
 * único que ese módulo no puede importar sin crear un ciclo.
 */
export function componerDia(
  interpretada: DietaInterpretada,
  inputs: Inputs,
  resultado: Resultado,
  variante = 0,
): DiaCompuesto {
  const v = Math.max(0, Math.trunc(variante))
  return componerDiaCon(interpretada, inputs, resultado, v, (huecos, variante2, sinHidratos) =>
    montarHuecos(inputs, resultado, huecos, variante2, sinHidratos),
  )
}

export { compraDeDia } from './dieta/compra'
