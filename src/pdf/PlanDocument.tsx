// Documento PDF del plan (docs/SPEC-ux-comidas-pdf.md §4).
// Regla del contrato: aquí no se calcula nada. Todo número sale de `datos.resultado` / `datos.ejemplos`.
// Fuentes estándar (Helvetica) para no depender de la red.
import { Circle, Document, Font, Line, Page, Path, Polyline, StyleSheet, Svg, Text, View } from '@react-pdf/renderer'
import type { ReactNode } from 'react'
import type {
  AlimentoCiclo,
  AlimentoPorcion,
  AvisoTexto,
  Comida,
  ConsejoCiclo,
  DatosPdf,
  EjemploComida,
  EjemploDia,
  ItemCompra,
  ListaCompra,
  Macros,
  Pesaje,
  PuntoProyeccion,
  SeccionOpcionalCompra,
  SeccionSuper,
  TablasEquivalencia,
} from '../engine/types'
// La nota del cierre de kcal es la MISMA función que usa la pantalla: en un plan ajustado el
// número cambia (§4.0: el PDF es la instantánea de lo que se ve en pantalla).
import { notaCierreKcal } from '../components/utiles/copy'
import { NOMBRE_SECCION, ORDEN_SECCIONES } from '../data/secciones'
// Las celdas de cantidad y el rótulo del modo sencillo salen del mismo helper que usa la
// pantalla (§4.4b: "las mismas cuatro columnas de §2.5b"). Aquí no se recalcula ningún número.
import {
  textoCantidadCiclo,
  textoCantidadDia,
  textoCantidadSemana,
  textoModoSencillo,
} from '../meals/compra'
import {
  etiqueta,
  formaDeComer,
  matizRecomposicion,
  NOMBRE_FORMULA_CLASICA,
  resumenAlimentos,
} from './etiquetas'
import {
  crearEscala,
  fraseBalance,
  GRAFICA,
  pathBanda,
  pesajesOrdenados,
  puntosPolilinea,
  semanaDePesaje,
} from './proyeccion'
import {
  anchoBarra,
  fechaCorta,
  fechaLarga,
  gramos,
  kcal as fmtKcal,
  kilos,
  lista,
  mililitros,
  num,
  pct,
  pctFraccion,
  rango,
  rangoFechas,
  sinPuntoFinal,
  SIN_DATO,
  winAnsi,
} from './formato'

// El guionado automático de @react-pdf/renderer parte las palabras con patrones INGLESES, y este
// documento está entero en español: partía "escur-ridos", "rebland-ecen", "de-scongelar" o
// "solomil-lo", justo en la lista de la compra, que es la página pensada para imprimir. Devolver
// la palabra entera desactiva el guionado: el texto solo se parte entre palabras.
Font.registerHyphenationCallback((palabra) => [palabra])

// ---------- Paleta (misma identidad que la pantalla, DESIGN-brief.md) ----------
const C = {
  papel: '#FBF8F3',
  tinta: '#221F1C',
  suave: '#6B645C',
  linea: '#E3DCD1',
  acento: '#22503F',
  acentoClaro: '#EDF2EE',
  proteina: '#A8452B',
  grasa: '#B5811A',
  hc: '#1F6F72',
  fibra: '#5C7A3F',
  avisoFondo: '#FBF0DC',
  avisoBorde: '#B5811A',
  infoFondo: '#F2EFE9',
}

const s = StyleSheet.create({
  page: {
    backgroundColor: C.papel,
    color: C.tinta,
    fontFamily: 'Helvetica',
    fontSize: 10,
    paddingTop: 50,
    paddingBottom: 46,
    paddingHorizontal: 42,
  },
  cabecera: {
    position: 'absolute',
    top: 26,
    left: 46,
    right: 46,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderBottomWidth: 0.75,
    borderBottomColor: C.linea,
    paddingBottom: 6,
  },
  cabeceraMarca: { fontFamily: 'Helvetica-Bold', fontSize: 9, color: C.acento, letterSpacing: 0.4 },
  cabeceraFecha: { fontSize: 8, color: C.suave },
  pie: {
    position: 'absolute',
    bottom: 26,
    left: 46,
    right: 46,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 0.75,
    borderTopColor: C.linea,
    paddingTop: 6,
    fontSize: 8,
    color: C.suave,
  },

  h1: { fontFamily: 'Helvetica-Bold', fontSize: 22, color: C.acento, marginBottom: 6 },
  h2: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 12.5,
    color: C.acento,
    marginBottom: 4,
    paddingBottom: 2,
    borderBottomWidth: 1.5,
    borderBottomColor: C.acento,
  },
  h3: { fontFamily: 'Helvetica-Bold', fontSize: 10.5, marginBottom: 3 },
  p: { marginBottom: 3, lineHeight: 1.28 },
  small: { fontSize: 8.5, color: C.suave, lineHeight: 1.32 },
  equivalencias: { fontSize: 8.5, color: C.tinta, lineHeight: 1.5 },
  seccion: { marginBottom: 7 },

  tarjeta: {
    borderWidth: 0.75,
    borderColor: C.linea,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    padding: 8,
  },
  fila: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 1.5 },
  filaLinea: { borderBottomWidth: 0.5, borderBottomColor: C.linea },
  filaEtiqueta: { color: C.suave, width: '40%' },
  filaValor: { width: '60%', textAlign: 'right' },

  barraFondo: { height: 6, backgroundColor: C.linea, borderRadius: 3.5, flexDirection: 'row' },

  tablaCabecera: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: C.acento,
    paddingBottom: 4,
    marginBottom: 2,
  },
  tablaFila: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: C.linea,
    alignItems: 'flex-start',
  },
  celdaTexto: { fontSize: 9.5 },
  celdaNum: { fontSize: 9.5, textAlign: 'right' },
  cabeceraCelda: { fontFamily: 'Helvetica-Bold', fontSize: 8.5, color: C.acento },

  // La lista de la compra es la única tabla con 14 filas de tres líneas: va más compacta que el
  // resto para que quepa entera en una página (SPEC §4.4b: se imprime suelta).
  filaCompra: {
    flexDirection: 'row',
    paddingVertical: 2,
    borderBottomWidth: 0.5,
    borderBottomColor: C.linea,
    alignItems: 'flex-start',
  },
  celdaCompra: { fontSize: 9 },
  celdaCompraNum: { fontSize: 9, textAlign: 'right' },
  compraSmall: { fontSize: 7.5, color: C.suave, lineHeight: 1.25 },

  aviso: {
    borderLeftWidth: 3,
    borderLeftColor: C.avisoBorde,
    backgroundColor: C.avisoFondo,
    padding: 6,
    marginBottom: 5,
    lineHeight: 1.3,
  },
  nota: {
    borderLeftWidth: 3,
    borderLeftColor: C.linea,
    backgroundColor: C.infoFondo,
    padding: 6,
    marginBottom: 5,
    lineHeight: 1.3,
  },
})

// ---------- Piezas reutilizables ----------
function Cabecera({ fecha }: { fecha: string }) {
  return (
    <View style={s.cabecera} fixed>
      <Text style={s.cabeceraMarca}>Báscula · Tus macros, bien calculados</Text>
      <Text style={s.cabeceraFecha}>{fechaCorta(fecha)}</Text>
    </View>
  )
}

// El pie va escrito dentro de `Marco`, no como componente aparte: @react-pdf/renderer descarta el texto
// dinámico (`render`) cuando el bloque `fixed` viene envuelto en un componente propio.
function Marco({
  fecha,
  ajustado,
  children,
}: {
  fecha: string
  /** §4.3: con un plan ajustado a mano, la marca va en el pie de TODAS las páginas. */
  ajustado?: boolean
  children: ReactNode
}) {
  return (
    <Page size="A4" style={s.page}>
      <Cabecera fecha={fecha} />
      {children}
      <View style={s.pie} fixed>
        <Text>
          Una herramienta de RS Agents
          {ajustado ? ' · plan ajustado por ti' : ''}
        </Text>
        <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
      </View>
    </Page>
  )
}

/**
 * Espacio que tiene que quedar por debajo del título para que el título se quede en la página.
 * Con los 40 pt de antes, «Notas informativas» cabía al pie de la página 6 y su primera caja de
 * aviso —que es `wrap={false}` y mide unos 65 pt— saltaba sola a la 7 (QA §8). 78 pt es la altura
 * de la caja de aviso más alta más su margen, así que el título viaja siempre con su contenido.
 */
const ESPACIO_TRAS_TITULO = 78

/** `sinCortes` evita que un bloque corto (el aviso legal) se parta a mitad de frase entre dos páginas. */
function Seccion({ titulo, children, sinCortes }: { titulo: string; children: ReactNode; sinCortes?: boolean }) {
  return (
    <View style={s.seccion} wrap={!sinCortes}>
      <Text style={s.h2} minPresenceAhead={ESPACIO_TRAS_TITULO}>
        {titulo}
      </Text>
      {children}
    </View>
  )
}

function Fila({ etiqueta: e, valor, ultima }: { etiqueta: string; valor: string; ultima?: boolean }) {
  return (
    <View style={ultima ? s.fila : [s.fila, s.filaLinea]} wrap={false}>
      <Text style={s.filaEtiqueta}>{e}</Text>
      <Text style={s.filaValor}>{valor}</Text>
    </View>
  )
}

function Barra({ segmentos }: { segmentos: { color: string; fraccion: number }[] }) {
  return (
    <View style={s.barraFondo}>
      {segmentos.map((seg, i) => (
        <View key={i} style={{ width: anchoBarra(seg.fraccion), backgroundColor: seg.color }} />
      ))}
    </View>
  )
}

function Vinetas({ textos }: { textos: readonly string[] }) {
  return (
    <View>
      {textos.map((t, i) => (
        <View key={i} style={{ flexDirection: 'row', marginBottom: 3 }} wrap={false}>
          <Text style={{ width: 12, color: C.acento }}>{'•'}</Text>
          <Text style={{ flex: 1 }}>{t}</Text>
        </View>
      ))}
    </View>
  )
}

function CajaAviso({ aviso }: { aviso: AvisoTexto }) {
  const esWarn = aviso.severidad === 'warn' || aviso.severidad === 'error'
  return (
    <View style={esWarn ? s.aviso : s.nota} wrap={false}>
      {aviso.titulo ? <Text style={s.h3}>{aviso.titulo}</Text> : null}
      <Text>{aviso.texto}</Text>
    </View>
  )
}

// ---------- Ficha de macro ----------
function TarjetaMacro({
  nombre,
  color,
  valor,
  gkg,
  fraccionKcal,
  frase,
}: {
  nombre: string
  color: string
  valor: string
  gkg: string | null
  fraccionKcal: number | null
  frase: string
}) {
  return (
    <View style={[s.tarjeta, { marginBottom: 5, paddingVertical: 6, borderLeftWidth: 3, borderLeftColor: color }]} wrap={false}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color }}>{nombre}</Text>
        <Text style={s.small}>
          {gkg === null ? 'al día' : gkg}
          {fraccionKcal === null ? '' : ` · ${pctFraccion(fraccionKcal)} de tus calorías`}
        </Text>
        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 14 }}>{valor}</Text>
      </View>
      <View style={{ marginTop: 4 }}>
        <Barra segmentos={[{ color, fraccion: fraccionKcal ?? 1 }]} />
      </View>
      <Text style={[s.small, { marginTop: 4 }]}>{frase}</Text>
    </View>
  )
}

// ---------- Menú de ejemplo ----------
function totalesTexto(t: Macros | null | undefined): string {
  if (!t) return SIN_DATO
  return `${fmtKcal(t.kcal)} · P ${gramos(t.prot)} · G ${gramos(t.fat)} · HC ${gramos(t.carb)}`
}

function LineaAlimento({ alimento }: { alimento: AlimentoPorcion }) {
  const medida = alimento.medida && alimento.medida.trim().length > 0 ? ` (${alimento.medida})` : ''
  return (
    <View style={{ flexDirection: 'row', paddingVertical: 2 }} wrap={false}>
      <Text style={{ width: 12, color: C.acento }}>{'•'}</Text>
      <Text style={{ flex: 1 }}>
        {alimento.nombre || SIN_DATO}
        {medida}
      </Text>
      <Text style={{ width: 62, textAlign: 'right', fontFamily: 'Helvetica-Bold' }}>{gramos(alimento.gramos)}</Text>
    </View>
  )
}

function BloqueComidaEjemplo({ comida }: { comida: EjemploComida }) {
  return (
    <View style={{ marginBottom: 8 }} minPresenceAhead={60}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          backgroundColor: C.acentoClaro,
          paddingVertical: 4,
          paddingHorizontal: 7,
          borderRadius: 3,
        }}
        wrap={false}
      >
        <Text style={{ fontFamily: 'Helvetica-Bold', color: C.acento }}>
          {comida.comida || SIN_DATO}
          {comida.hora ? ` · ${comida.hora}` : ''}
          {comida.peri ? ' · cerca de tu entreno' : ''}
        </Text>
        <Text style={{ fontSize: 9 }}>{totalesTexto(comida.totales)}</Text>
      </View>
      <View style={{ paddingHorizontal: 7, paddingTop: 4 }}>
        {(comida.alimentos ?? []).map((a, i) => (
          <LineaAlimento key={`${a.id}-${i}`} alimento={a} />
        ))}
        {(comida.alternativas ?? []).length > 0 ? (
          <Text style={[s.small, { marginTop: 3 }]}>Alternativas: {lista(comida.alternativas.map(sinPuntoFinal))}.</Text>
        ) : null}
      </View>
    </View>
  )
}

function BloqueDia({ dia, titulo }: { dia: EjemploDia; titulo: string }) {
  return (
    <View>
      <Text style={[s.h3, { marginTop: 2, marginBottom: 6 }]}>{titulo}</Text>
      {dia.comidas.map((c, i) => (
        <BloqueComidaEjemplo key={`${c.comida}-${i}`} comida={c} />
      ))}
      <View style={[s.tarjeta, { paddingVertical: 7, marginBottom: 6 }]} wrap={false}>
        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 9.5 }}>Total del día: {totalesTexto(dia.totales)}</Text>
      </View>
      {(dia.notas ?? []).map((n, i) => (
        <Text key={i} style={s.small}>
          {n}
        </Text>
      ))}
    </View>
  )
}

/** Tablas de equivalencias (§2.5 y §4.4): mismo bloque que la pantalla. */
function BloqueEquivalencias({ tablas }: { tablas: TablasEquivalencia }) {
  return (
    <View>
      <Text style={s.p}>{tablas.cabecera}</Text>
      {tablas.tablas.map((t) => (
        <View key={t.titulo} style={{ marginBottom: 8 }} wrap={false}>
          <Text style={[s.h3, { marginBottom: 3 }]}>{t.titulo}</Text>
          <Text style={s.equivalencias}>
            {t.filas.map((f) => `${f.nombre} ${f.gramos} g`).join('  ·  ')}
          </Text>
        </View>
      ))}
      <Text style={s.small}>{tablas.nota_verdura_fruta}</Text>
    </View>
  )
}

/** Lista de la compra (§3.7 y §4.4b): el PDF pinta `ejemplos.compra` tal cual, sin recalcular nada. */
const SUBTITULO_COMPRA =
  'Para 7 días, con el formato en el que se vende cada cosa en Mercadona. Sin precios: cambian de una tienda ' +
  'a otra y de una semana a otra.'

/** Agrupa los items por sección respetando `ORDEN_SECCIONES`; lo que no encaja cae en "otros". */
function porSecciones(items: readonly ItemCompra[]): { seccion: SeccionSuper; items: ItemCompra[] }[] {
  const grupos = new Map<SeccionSuper, ItemCompra[]>()
  for (const item of items) {
    if (!item) continue
    const seccion = ORDEN_SECCIONES.includes(item.seccion) ? item.seccion : 'otros'
    const lista = grupos.get(seccion)
    if (lista) lista.push(item)
    else grupos.set(seccion, [item])
  }
  return ORDEN_SECCIONES.filter((s) => (grupos.get(s)?.length ?? 0) > 0).map((s) => ({
    seccion: s,
    items: grupos.get(s) ?? [],
  }))
}

/** `3 días` / `1 día` / `—` si el generador no ha podido acotarlo. */
function duracionTexto(dias: number | null | undefined): string {
  const n = num(dias)
  if (n === SIN_DATO) return SIN_DATO
  return dias === 1 ? '1 día' : `${n} días`
}

/** `2 x bandeja aprox. 1 kg`. La "x" va en ASCII: el aspa tipográfica no existe en WinAnsi. */
function comprarTexto(item: ItemCompra): string {
  const cuantos = num(item.envases)
  const formato = winAnsi(item.envase_descripcion ?? '')
  if (cuantos === SIN_DATO && formato.trim().length === 0) return SIN_DATO
  if (formato.trim().length === 0) return cuantos
  if (cuantos === SIN_DATO) return formato
  return `${cuantos} x ${formato}`
}

/**
 * Umbral a partir del cual las filas de la compra se aprietan. §4.4b quiere esta página entera y
 * suelta, para llevarla al súper: con más de 16 líneas se desbordaba y dejaba una fila y las tres
 * notas fijas solas en la página siguiente.
 */
const ITEMS_COMPRA_COMPACTA = 14

/**
 * Las dos celdas de cantidad las redacta `src/meals/compra.ts` a partir de los gramos del item.
 * Si un gramaje llega roto, esa función devuelve "NaN g en la semana": el PDF no puede imprimir
 * eso, así que la celda cae al guion largo como cualquier otro dato que falta.
 */
function textoCantidadSeguro(texto: string): string {
  const limpio = winAnsi(texto)
  return /NaN|undefined/.test(limpio) ? SIN_DATO : limpio
}

/**
 * Línea de la sección opcional del ciclo (§4.4b, v1.2). Tres columnas y no cuatro: esa sección no
 * es del plan —son dos raciones para dos o tres días al mes—, así que ni "17,1 g al día" ni "te
 * dura 10 días", que es el vocabulario de la compra semanal y contradecía su propia nota.
 */
function LineaCompraCiclo({ item, compacta }: { item: ItemCompra; compacta: boolean }) {
  const consejo = winAnsi(item.consejo ?? '').trim()
  const menudo = compacta ? [s.compraSmall, { lineHeight: 1.1 }] : [s.compraSmall]
  return (
    <View style={compacta ? [s.filaCompra, { paddingVertical: 0 }] : s.filaCompra} wrap={false}>
      <View style={{ flex: 2.3, paddingRight: 6 }}>
        <Text style={[s.celdaCompra, { fontFamily: 'Helvetica-Bold' }]}>{winAnsi(item.producto) || SIN_DATO}</Text>
        <Text style={menudo}>
          {winAnsi(item.nombre) || SIN_DATO}
          {consejo.length > 0 ? ` · ${consejo}` : ''}
        </Text>
      </View>
      <Text style={[s.celdaCompraNum, { flex: 1.9, paddingRight: 6 }]}>
        {textoCantidadSeguro(textoCantidadCiclo(item))}
      </Text>
      <Text style={[s.celdaCompraNum, { flex: 1.9 }]}>{comprarTexto(item)}</Text>
    </View>
  )
}

function LineaCompra({ item, compacta }: { item: ItemCompra; compacta: boolean }) {
  const consejo = winAnsi(item.consejo ?? '').trim()
  // Con la lista apretada se recorta el aire de la fila y el interlineado de la letra pequeña:
  // el contenido no cambia, solo deja de sobrar media página.
  const menudo = compacta ? [s.compraSmall, { lineHeight: 1.1 }] : [s.compraSmall]
  return (
    <View style={compacta ? [s.filaCompra, { paddingVertical: 0 }] : s.filaCompra} wrap={false}>
      <View style={{ flex: 2.3, paddingRight: 6 }}>
        <Text style={[s.celdaCompra, { fontFamily: 'Helvetica-Bold' }]}>{winAnsi(item.producto) || SIN_DATO}</Text>
        <Text style={menudo}>
          {winAnsi(item.nombre) || SIN_DATO}
          {consejo.length > 0 ? ` · ${consejo}` : ''}
        </Text>
      </View>
      <View style={{ flex: 1.25, paddingRight: 6 }}>
        <Text style={s.celdaCompraNum}>{textoCantidadSeguro(textoCantidadSemana(item))}</Text>
        <Text style={[...menudo, { textAlign: 'right' }]}>{textoCantidadSeguro(textoCantidadDia(item))}</Text>
      </View>
      <Text style={[s.celdaCompraNum, { flex: 1.9, paddingRight: 6 }]}>{comprarTexto(item)}</Text>
      <Text style={[s.celdaCompraNum, { flex: 0.75 }]}>{duracionTexto(item.dura_dias)}</Text>
    </View>
  )
}

/**
 * Un bloque por síntoma dentro de la tarjeta del ciclo (§4.3b, v1.2): el `titulo` en negrita, el
 * `texto` íntegro tal y como lo redacta el motor y la línea "Prioriza:" cuando hay alimentos. Aquí
 * no se reescribe ni se trocea nada: los fragmentos condicionales ya vienen resueltos.
 */
function BloqueSintomaCiclo({ consejo }: { consejo: ConsejoCiclo }) {
  const alimentos = (consejo?.alimentos ?? []).filter((a) => typeof a === 'string' && a.trim().length > 0)
  const texto = typeof consejo?.texto === 'string' ? consejo.texto.trim() : ''
  return (
    <View style={{ marginTop: 6 }} wrap={false}>
      <Text style={s.h3}>{consejo?.titulo?.trim() || SIN_DATO}</Text>
      {texto.length > 0 ? <Text>{texto}</Text> : null}
      {alimentos.length > 0 ? (
        <Text style={[s.small, { marginTop: 2 }]}>Prioriza: {alimentos.join('  ·  ')}</Text>
      ) : null}
    </View>
  )
}

/**
 * Alimentos sugeridos para esos días (§3.8.1). Se agrupan por su `por_que` —que es uno por
 * síntoma— y el motivo se imprime UNA vez por grupo: repetir el mismo paréntesis cuatro veces en
 * la misma frase, además de atribuirle a cada alimento las propiedades de todo el grupo, se leía
 * fatal ("cacao puro (omega-3 y magnesio, que ayudan con el dolor)").
 *
 * La coletilla de la compra solo promete lo que de verdad está en la lista: la sección opcional
 * corta en tres y salta los que ya están en la compra del plan.
 */
function LineaAlimentosCiclo({
  alimentos,
  idsEnLaCompra,
}: {
  alimentos: readonly AlimentoCiclo[]
  idsEnLaCompra: readonly string[]
}) {
  const validos = alimentos.filter((a) => a && typeof a.nombre === 'string' && a.nombre.trim().length > 0)
  if (validos.length === 0) return null
  const grupos: { por_que: string; nombres: string[] }[] = []
  for (const a of validos) {
    const porQue = typeof a.por_que === 'string' ? sinPuntoFinal(a.por_que).trim() : ''
    const previo = grupos.find((g) => g.por_que === porQue)
    if (previo) previo.nombres.push(a.nombre)
    else grupos.push({ por_que: porQue, nombres: [a.nombre] })
  }
  const textos = grupos.map((g) =>
    g.por_que.length > 0 ? `${lista(g.nombres)} (${g.por_que})` : lista(g.nombres),
  )
  const enLaCompra = new Set(idsEnLaCompra)
  const todos = validos.every((a) => enLaCompra.has(a.id))
  const coletilla =
    idsEnLaCompra.length === 0
      ? ''
      : todos
        ? ' Los tienes al final de tu lista de la compra, en una sección opcional que no cuenta en el plan.'
        : ' Los que hemos podido, los tienes al final de tu lista de la compra, en una sección opcional que no cuenta en el plan.'
  return (
    <Text style={[s.small, { marginTop: 6 }]}>
      Para esos días: {textos.join('; ')}.{coletilla}
    </Text>
  )
}

function BloqueSeccionCompra({
  seccion,
  items,
  compacta,
}: {
  seccion: SeccionSuper
  items: readonly ItemCompra[]
  compacta: boolean
}) {
  return (
    <View style={{ marginBottom: compacta ? 2 : 4 }} minPresenceAhead={46}>
      <View style={[s.tablaCabecera, { paddingBottom: 2, marginBottom: 1, alignItems: 'flex-end' }]}>
        <Text style={[s.h3, { color: C.acento, flex: 2.3, marginBottom: 0 }]}>{NOMBRE_SECCION[seccion]}</Text>
        <Text style={[s.cabeceraCelda, { flex: 1.25, textAlign: 'right' }]}>CANTIDAD</Text>
        <Text style={[s.cabeceraCelda, { flex: 1.9, textAlign: 'right' }]}>COMPRAR</Text>
        <Text style={[s.cabeceraCelda, { flex: 0.75, textAlign: 'right' }]}>DURA</Text>
      </View>
      {items.map((item, i) => (
        <LineaCompra key={`${item.alimento_id}-${i}`} item={item} compacta={compacta} />
      ))}
    </View>
  )
}

/**
 * Sección opcional "Para los días de regla" (§3.8.2 y §4.4b, v1.2). Va al final de la lista y antes
 * de las notas fijas, separada con un filete, y **no** suma al recuento de alimentos del plan: eso
 * lo dice su propia `nota`, que viene escrita del generador y aquí se imprime tal cual.
 */
function BloqueOpcionalCompra({
  seccion,
  compacta,
}: {
  seccion: SeccionOpcionalCompra
  compacta: boolean
}) {
  const items = (seccion.items ?? []).filter((i) => !!i)
  if (items.length === 0) return null
  return (
    <View
      style={{ marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: C.acento }}
      minPresenceAhead={54}
      wrap={false}
    >
      <View style={[s.tablaCabecera, { paddingBottom: 2, marginBottom: 1, alignItems: 'flex-end' }]}>
        <Text style={[s.h3, { color: C.acento, flex: 2.3, marginBottom: 0 }]}>
          {winAnsi(seccion.titulo) || SIN_DATO}
        </Text>
        <Text style={[s.cabeceraCelda, { flex: 1.9, textAlign: 'right' }]}>CANTIDAD</Text>
        <Text style={[s.cabeceraCelda, { flex: 1.9, textAlign: 'right' }]}>COMPRAR</Text>
      </View>
      {typeof seccion.nota === 'string' && seccion.nota.trim().length > 0 ? (
        <Text style={[s.compraSmall, { marginBottom: 2 }]}>{winAnsi(seccion.nota)}</Text>
      ) : null}
      {items.map((item, i) => (
        <LineaCompraCiclo key={`opc-${item.alimento_id}-${i}`} item={item} compacta={compacta} />
      ))}
    </View>
  )
}

// ---------- Textos fijos ----------
/**
 * Gráfica de proyección (§4.5b): las mismas primitivas de `@react-pdf/renderer` sobre los mismos
 * `resultado.proyeccion` que pinta la pantalla. Aquí no se recalcula ningún peso.
 *
 * Las etiquetas de los ejes y de los hitos no van dentro del `<Svg>`: son `<View>` posicionadas
 * sobre el lienzo, porque el `<Text>` de SVG de la librería no comparte tipo con el `<Text>` de
 * flujo y obliga a castear. Las coordenadas son las mismas, así que el resultado es idéntico.
 */
function GraficaProyeccion({
  proyeccion,
  pesajes,
  fechaInicio,
  objetivoKg,
}: {
  proyeccion: readonly PuntoProyeccion[]
  pesajes: readonly Pesaje[]
  fechaInicio: string
  objetivoKg: number | null
}) {
  const escala = crearEscala(proyeccion, [...pesajes.map((p) => p.kg), ...(objetivoKg === null ? [] : [objetivoKg])])
  if (!escala) return null

  const puntos = proyeccion.filter((p) => p && Number.isFinite(p.semana))
  const hitos = puntos.filter((p) => p.semana === 4 || p.semana === 8 || p.semana === 12)
  const puntosPesaje = pesajes.map((p) => ({
    kg: p.kg,
    x: escala.x(semanaDePesaje(p.fecha, fechaInicio, escala.semanaMax)),
    y: escala.y(p.kg),
  }))

  return (
    <View style={{ width: escala.ancho, height: escala.alto, position: 'relative', marginBottom: 4 }} wrap={false}>
      <Svg width={escala.ancho} height={escala.alto} viewBox={`0 0 ${escala.ancho} ${escala.alto}`}>
        {escala.marcasY.map((kg, i) => (
          <Line
            key={`gy-${i}`}
            x1={escala.x0}
            y1={escala.y(kg)}
            x2={escala.x1}
            y2={escala.y(kg)}
            stroke={C.linea}
            strokeWidth={0.5}
          />
        ))}
        <Path d={pathBanda(puntos, escala)} fill={C.acento} fillOpacity={0.18} />
        {objetivoKg === null ? null : (
          <Line
            x1={escala.x0}
            y1={escala.y(objetivoKg)}
            x2={escala.x1}
            y2={escala.y(objetivoKg)}
            stroke={C.acento}
            strokeWidth={0.9}
            strokeDasharray="4 3"
          />
        )}
        <Polyline
          points={puntosPolilinea(puntos.map((p) => ({ x: escala.x(p.semana), y: escala.y(p.peso_esp) })))}
          fill="none"
          stroke={C.acento}
          strokeWidth={2}
        />
        {hitos.map((p) => (
          <Circle key={`h-${p.semana}`} cx={escala.x(p.semana)} cy={escala.y(p.peso_esp)} r={3} fill={C.acento} />
        ))}
        {puntosPesaje.length > 1 ? (
          <Polyline points={puntosPolilinea(puntosPesaje)} fill="none" stroke={C.proteina} strokeWidth={1} />
        ) : null}
        {puntosPesaje.map((p, i) => (
          <Circle key={`p-${i}`} cx={p.x} cy={p.y} r={2.4} fill={C.proteina} />
        ))}
        <Line x1={escala.x0} y1={escala.y1} x2={escala.x1} y2={escala.y1} stroke={C.suave} strokeWidth={0.75} />
        <Line x1={escala.x0} y1={escala.y0} x2={escala.x0} y2={escala.y1} stroke={C.suave} strokeWidth={0.75} />
      </Svg>

      {/* Etiquetas del eje vertical (kilos) */}
      {escala.marcasY.map((kg, i) => (
        <View
          key={`ly-${i}`}
          style={{ position: 'absolute', left: 0, top: escala.y(kg) - 4, width: GRAFICA.margenIzq - 4 }}
        >
          <Text style={{ fontSize: 6.5, color: C.suave, textAlign: 'right' }}>{num(kg, 1)}</Text>
        </View>
      ))}
      <View style={{ position: 'absolute', left: 0, top: 0, width: GRAFICA.margenIzq - 4 }}>
        <Text style={{ fontSize: 6.5, color: C.suave, textAlign: 'right' }}>kg</Text>
      </View>

      {/* Etiquetas del eje horizontal (semanas) */}
      {escala.marcasX.map((semana, i) => (
        <View
          key={`lx-${i}`}
          style={{ position: 'absolute', left: escala.x(semana) - 22, top: escala.y1 + 3, width: 44 }}
        >
          <Text style={{ fontSize: 6.5, color: C.suave, textAlign: 'center' }}>semana {num(semana)}</Text>
        </View>
      ))}

      {/* Etiquetas de los hitos de 4, 8 y 12 semanas */}
      {hitos.map((p) => (
        <View
          key={`lh-${p.semana}`}
          style={{ position: 'absolute', left: escala.x(p.semana) - 20, top: escala.y(p.peso_esp) - 13, width: 40 }}
        >
          <Text style={{ fontSize: 7, color: C.acento, textAlign: 'center', fontFamily: 'Helvetica-Bold' }}>
            {kilos(p.peso_esp)}
          </Text>
        </View>
      ))}

      {objetivoKg === null ? null : (
        <View style={{ position: 'absolute', left: escala.x1 - 74, top: escala.y(objetivoKg) - 9, width: 72 }}>
          <Text style={{ fontSize: 6.5, color: C.acento, textAlign: 'right' }}>objetivo {kilos(objetivoKg)}</Text>
        </View>
      )}
    </View>
  )
}

/** Media tabla de la proyección: cabecera más una fila por semana. */
function ColumnaProyeccion({ puntos }: { puntos: readonly PuntoProyeccion[] }) {
  return (
    <View style={{ flex: 1 }}>
      <View style={[s.tablaCabecera, { paddingBottom: 2, marginBottom: 1 }]}>
        <Text style={[s.cabeceraCelda, { flex: 1 }]}>SEM.</Text>
        <Text style={[s.cabeceraCelda, { flex: 1.2, textAlign: 'right' }]}>MÍN.</Text>
        <Text style={[s.cabeceraCelda, { flex: 1.4, textAlign: 'right' }]}>ESPERADO</Text>
        <Text style={[s.cabeceraCelda, { flex: 1.2, textAlign: 'right' }]}>MÁX.</Text>
      </View>
      {puntos.map((p, i) => (
        <View
          key={`fp-${p.semana}-${i}`}
          style={[s.tablaFila, { paddingVertical: 1.2, borderBottomWidth: i === puntos.length - 1 ? 0 : 0.5 }]}
          wrap={false}
        >
          <Text style={[s.celdaTexto, { flex: 1, fontSize: 8 }]}>{num(p.semana)}</Text>
          <Text style={[s.celdaNum, { flex: 1.2, fontSize: 8 }]}>{kilos(p.peso_min)}</Text>
          <Text style={[s.celdaNum, { flex: 1.4, fontSize: 8, fontFamily: 'Helvetica-Bold' }]}>
            {kilos(p.peso_esp)}
          </Text>
          <Text style={[s.celdaNum, { flex: 1.2, fontSize: 8 }]}>{kilos(p.peso_max)}</Text>
        </View>
      ))}
    </View>
  )
}

/**
 * Tabla equivalente a la gráfica, obligatoria en el PDF (§4.5b): una fila por semana, sin esconder
 * nada. Va **en dos columnas** —primera mitad de semanas a la izquierda, segunda a la derecha—
 * porque con 27 semanas una sola columna se come una página entera y el documento se pasaba del
 * máximo de 10 de §4.0.
 */
function TablaProyeccion({ proyeccion }: { proyeccion: readonly PuntoProyeccion[] }) {
  const mitad = Math.ceil(proyeccion.length / 2)
  const izquierda = proyeccion.slice(0, mitad)
  const derecha = proyeccion.slice(mitad)
  return (
    <View style={{ flexDirection: 'row' }}>
      <ColumnaProyeccion puntos={izquierda} />
      <View style={{ width: 18 }} />
      {derecha.length > 0 ? <ColumnaProyeccion puntos={derecha} /> : <View style={{ flex: 1 }} />}
    </View>
  )
}

const AVISOS_DESTACADOS = [
  'WARN_DIABETES',
  'WARN_RENAL',
  'WARN_HEPATICA',
  'WARN_CARDIACA',
  'WARN_HIPERTENSION',
  'WARN_TIROIDES',
  'WARN_BARIATRICA_GLP1',
  'WARN_CONDICION_OTRA',
  'WARN_IMC_35',
  'WARN_IMC_40',
]

const DISCLAIMER =
  'Báscula te ofrece una orientación nutricional general basada en evidencia científica, no un consejo médico ' +
  'ni un plan personalizado por un profesional sanitario. Los resultados son estimaciones: tu cuerpo puede ' +
  'responder de forma distinta. Si tienes una condición médica, tomas medicación, estás embarazada o en periodo ' +
  'de lactancia, o tienes antecedentes de trastornos de conducta alimentaria, consulta con un/a médico o ' +
  'dietista-nutricionista colegiado/a antes de seguir estas recomendaciones.'

const NOTA_AGUA =
  'Es líquido bebido: el café, el té y las infusiones cuentan si los tomas de forma habitual; la comida aporta ' +
  'además un 20-30 % de agua que no está incluido aquí. El alcohol no cuenta y deshidrata. No fuerces más de ' +
  '1 litro por hora. Si entrenas más de una hora, sudas mucho o hace calor, añade sal a las comidas o una ' +
  'bebida con electrolitos: beber mucha agua sin sodio puede bajarte el sodio en sangre.'

/** "Nota proyección" de `SPEC-calculo.md` §4, íntegra (§4.5b). */
const NOTA_PROYECCION =
  'Esta curva es una estimación, no una promesa: sale de tu déficit actual y de un factor de adaptación que ' +
  'crece con el tiempo. Tu peso real va a oscilar por agua, sal e intestino; lo que importa es la tendencia de ' +
  'varias semanas, no el dato de un día.'

const SUBTITULO_PROYECCION = 'Semana a semana, con el margen que toca.'

/**
 * Nota bajo el peso objetivo de una recomposición con meta (v1.2, decisión H). El número existe
 * —el motor lo valida con los mismos suelos que en `perder`— pero no lleva fecha detrás, y el PDF
 * lo dice donde se lee el número, no tres párrafos más abajo.
 */
const NOTA_PESO_OBJETIVO_RECOMP =
  'En recomposición este peso es orientativo: marca hacia dónde debería ir la báscula, no un día de ' +
  'llegada. Mídete también la cintura y hazte fotos cada cuatro semanas.'

/** Línea de ayuda de §2.10 y §4.6, literal y siempre presente. */
const LINEA_ADANER =
  'Si la comida o el peso te generan ansiedad, puedes hablar gratis con ADANER (adaner.org) o con tu centro de salud.'

const SIN_MENU =
  'No te proponemos menús de ejemplo. Con tu condición, la elección concreta de alimentos (potasio, fósforo, ' +
  'sodio y tipo de proteína) cambia mucho el resultado y debe hacerla un/a dietista-nutricionista ' +
  'especializado/a. Tus calorías y tus macros siguen siendo una referencia orientativa que puedes llevarle.'

function sufijoObjetivo(datos: DatosPdf): string {
  const { objetivo_efectivo, ritmo_efectivo } = datos.resultado
  if (objetivo_efectivo === 'perder' || objetivo_efectivo === 'ganar') {
    return `ritmo ${etiqueta.ritmo(ritmo_efectivo)}`
  }
  if (objetivo_efectivo === 'recomposicion') {
    // §4.2: con prioridad declarada, el matiz sustituye a la coletilla genérica.
    const matiz = matizRecomposicion(datos.resultado)
    return matiz ? `prioridad: ${matiz}` : 'cambios lentos, es lo esperable'
  }
  return ''
}

/** Documento completo del plan. Si el motor excluyó el cálculo, imprime solo el motivo. */
export function PlanDocument({ datos }: { datos: DatosPdf }) {
  const { inputs, resultado, ejemplos, avisos, fecha } = datos

  if (resultado.excluido) {
    const motivo = avisos.find((a) => a.codigo === resultado.excluido)
    return (
      <Document title="Báscula — plan nutricional" author="RS Agents" language="es-ES">
        <Marco fecha={fecha}>
          <Text style={s.h1}>No podemos darte un plan</Text>
          <Text style={s.p}>
            {motivo?.texto ??
              'Con los datos que nos has dado no podemos calcular un plan seguro. Consulta con un/a ' +
                'dietista-nutricionista colegiado/a.'}
          </Text>
          <Text style={s.small}>{DISCLAIMER}</Text>
        </Marco>
      </Document>
    )
  }

  // v1.1 (decisión A): la guarda del cribado que ocultaba %grasa, peso objetivo y "otras
  // referencias" queda retirada. El paso 5b del wizard ya no existe y estas páginas se imprimen
  // completas siempre. `'tca'` sigue sin serializarse en ninguna lista de condiciones (§4.0).

  // v1.1 (decisión B): marca de plan ajustado a mano. `resultado.ajuste` solo lo pone `ajustarMacros`.
  const ajuste = resultado.ajuste
  const ajustado = ajuste?.kcal === true || ajuste?.hc === true
  const limites = resultado.limites_ajuste

  const warns = avisos.filter((a) => a.severidad === 'warn' || a.severidad === 'error')
  const infos = avisos.filter((a) => a.severidad === 'info')
  const destacados = avisos.filter(
    (a) => AVISOS_DESTACADOS.includes(a.codigo) || (inputs.edad >= 65 && a.codigo === 'INFO_AGUA_MAYORES'),
  )
  const objetivoAjustado = inputs.objetivo === 'no_se' || inputs.objetivo !== resultado.objetivo_efectivo
  const avisoAdaptacion = avisos.find((a) => a.codigo === 'INFO_ADAPTACION')
  const avisoAjuste = avisos.find(
    (a) => a.codigo === 'INFO_OBJETIVO_RESUELTO' || a.codigo.startsWith('WARN_OBJETIVO'),
  )

  const condiciones = etiqueta.condiciones(inputs.condiciones)
  const ent = inputs.entrenamiento
  const entrenoTexto =
    ent.tipo === 'ninguno'
      ? etiqueta.entrenamiento('ninguno')
      : `${etiqueta.entrenamiento(ent.tipo)}, ${num(ent.dias_semana)} días por semana, ` +
        `${num(ent.minutos_sesion)} min por sesión, intensidad ${etiqueta.intensidad(ent.intensidad)}` +
        `${ent.momento ? `, ${etiqueta.momento(ent.momento)}` : ''}`

  const comidas: Comida[] = resultado.comidas ?? []
  const totalReparto = comidas.reduce(
    (acc, c) => ({
      pct: acc.pct + (c.pct_kcal ?? 0),
      p: acc.p + (c.proteina_g ?? 0),
      g: acc.g + (c.grasa_g ?? 0),
      hc: acc.hc + (c.hc_g ?? 0),
      kcal: acc.kcal + (c.kcal ?? 0),
    }),
    { pct: 0, p: 0, g: 0, hc: 0, kcal: 0 },
  )

  const hayMenu = (ejemplos?.entreno?.comidas ?? []).length > 0
  // §4.4b: la página de la compra solo existe si el generador ha dejado la lista en `ejemplos.compra`.
  const compra: ListaCompra | null =
    hayMenu && ejemplos?.compra && (ejemplos.compra.items ?? []).length > 0 ? ejemplos.compra : null
  const seccionesCompra = compra ? porSecciones(compra.items) : []
  const diasIguales =
    !ejemplos?.descanso ||
    JSON.stringify(ejemplos.entreno?.comidas ?? []) === JSON.stringify(ejemplos.descanso?.comidas ?? [])

  const clasicas = resultado.peso_objetivo?.referencias?.clasicas ?? null
  const crono = resultado.cronograma
  const avisoCronograma = avisos.find((a) => a.codigo.includes('CRONOGRAMA'))

  // §4.3b: la tarjeta del ciclo se imprime exactamente cuando el motor emite INFO_CICLO.
  const avisoCiclo = avisos.find((a) => a.codigo === 'INFO_CICLO')
  // v1.2: los bloques por síntoma van dentro de esa misma tarjeta, en el orden del motor. La lista
  // de síntomas marcados NO se imprime en ninguna parte (§4.2): solo sus consejos.
  const consejosCiclo = (resultado.ciclo?.consejos ?? []).filter((c) => !!c)
  const alimentosCiclo = (ejemplos?.alimentos_ciclo ?? []).filter((a) => !!a)

  // §4.2 y §4.4 (v1.2): resumen de lo que el usuario no quiere ver y de sus favoritos. Los ids que
  // no estén en `foods.json` se descartan: en el PDF no puede aparecer un identificador técnico.
  // De los favoritos se nombran los que de verdad han llegado a la semana (§3.2b): el tope de 12
  // del modo sencillo puede dejar alguno fuera, y prometer en el informe un favorito que no está
  // ni en el menú ni en la compra es justo lo que la decisión G venía a evitar.
  const favoritosServidos = ejemplos?.favoritos_aplicados ?? inputs.alimentos_favoritos
  const resumenAlimentosLargo = resumenAlimentos(inputs.alimentos_excluidos, favoritosServidos)
  const resumenAlimentosBreve = resumenAlimentos(inputs.alimentos_excluidos, favoritosServidos, true)
  const avisosMenu = (ejemplos?.avisos_menu ?? []).filter((t) => typeof t === 'string' && t.trim().length > 0)

  // §4.2 (v1.2): el plazo pedido es un matiz de la fila de ritmo, nunca el ritmo que se imprime.
  const plazo = typeof inputs.plazo_semanas === 'number' && Number.isFinite(inputs.plazo_semanas)
    ? inputs.plazo_semanas
    : null

  // §4.5b: proyección y seguimiento. Sin `resultado.proyeccion` no se imprime nada de esto.
  const proyeccion: PuntoProyeccion[] = resultado.proyeccion ?? []
  const pesajes: Pesaje[] = pesajesOrdenados(datos.pesajes)
  // §4.5b: el copy de debajo de la gráfica es UNO de tres, nunca dos. La banda de recomposición
  // (v1.2) manda sobre la plana: son excluyentes y el motor no emite las dos.
  const avisoProyeccionRecomp = avisos.find((a) => a.codigo === 'INFO_PROYECCION_RECOMP')
  const avisoProyeccionPlana = avisos.find((a) => a.codigo === 'INFO_PROYECCION_PLANA')
  const proyeccionPlana =
    !avisoProyeccionRecomp && (avisoProyeccionPlana !== undefined || crono === null)
  const notaProyeccion =
    avisoProyeccionRecomp?.texto ?? (proyeccionPlana ? (avisoProyeccionPlana?.texto ?? NOTA_PROYECCION) : NOTA_PROYECCION)
  const balance = fraseBalance(
    pesajes,
    proyeccion,
    inputs.fecha_inicio,
    resultado.objetivo_efectivo,
    proyeccionPlana,
  )

  return (
    <Document title="Báscula — plan nutricional" author="RS Agents" language="es-ES">
      {/* ---------- Página 1: portada con los resultados clave y los datos del usuario ----------
          Antes la portada gastaba media página en blanco y la página 2 repetía sexo, edad, altura y
          peso (QA §6). Ahora el plan se resume de un vistazo aquí y el documento tiene una página
          menos. ---------- */}
      <Marco fecha={fecha} ajustado={ajustado}>
        <View>
          <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 30, color: C.acento }}>Báscula</Text>
          <Text style={{ fontSize: 11, color: C.suave, marginBottom: 12 }}>Tus macros, bien calculados</Text>
          <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 17, marginBottom: 2 }}>
            Tu plan nutricional personalizado
          </Text>
          <Text style={{ fontSize: 9.5, color: C.suave, marginBottom: 12 }}>{fechaLarga(fecha)}</Text>

          <View style={[s.tarjeta, { marginBottom: 10 }]}>
            <Text style={{ fontSize: 9, color: C.suave }}>TU OBJETIVO</Text>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 19, color: C.acento }}>
              {etiqueta.objetivo(resultado.objetivo_efectivo)}
              {sufijoObjetivo(datos) ? (
                <Text style={{ fontFamily: 'Helvetica', fontSize: 11, color: C.suave }}>
                  {`  ·  ${sufijoObjetivo(datos)}`}
                </Text>
              ) : null}
            </Text>

            <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 0.75, borderTopColor: C.linea }}>
              <Text style={{ fontSize: 9, color: C.suave }}>
                CALORÍAS AL DÍA{ajustado ? ' · AJUSTADO POR TI' : ''}
              </Text>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 38, color: C.acento }}>
                {num(resultado.kcal)}
                <Text style={{ fontSize: 14, color: C.suave }}> kcal</Text>
              </Text>
              {/* Los tres macros en UNA línea, con los mismos colores que la pantalla. */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, marginBottom: 4 }}>
                <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 10.5, color: C.proteina }}>
                  Proteína {gramos(resultado.macros?.proteina_g)}
                </Text>
                <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 10.5, color: C.grasa }}>
                  Grasa {gramos(resultado.macros?.grasa_g)}
                </Text>
                <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 10.5, color: C.hc }}>
                  Carbohidratos {gramos(resultado.macros?.hc_g)}
                </Text>
                <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 10.5, color: C.fibra }}>
                  Fibra {gramos(resultado.macros?.fibra_g)}
                </Text>
              </View>
              <Barra
                segmentos={[
                  { color: C.proteina, fraccion: resultado.macros?.pct?.p ?? 0 },
                  { color: C.grasa, fraccion: resultado.macros?.pct?.g ?? 0 },
                  { color: C.hc, fraccion: resultado.macros?.pct?.hc ?? 0 },
                ]}
              />
            </View>

            <View style={{ marginTop: 8, paddingTop: 6, borderTopWidth: 0.75, borderTopColor: C.linea }}>
              <Fila
                etiqueta="Índice de masa corporal (IMC)"
                valor={`${num(resultado.imc, 1)} · ${etiqueta.imc(resultado.imc_categoria)}`}
              />
              <Fila
                etiqueta="Grasa corporal estimada"
                valor={`${rango(resultado.grasa?.rango, (v) => num(v, 0))} % · ${etiqueta.fiabilidad(
                  resultado.grasa?.fiabilidad,
                )}`}
              />
              <Fila etiqueta="Gasto energético estimado" valor={`${fmtKcal(resultado.tdee?.valor)} al día`} ultima />
            </View>
          </View>

          <Text style={[s.h2, { fontSize: 11.5 }]}>Tus datos</Text>
          <View style={s.tarjeta}>
            <Fila etiqueta="Sexo" valor={etiqueta.sexo(inputs.sexo)} />
            <Fila etiqueta="Edad" valor={`${num(inputs.edad)} años`} />
            <Fila etiqueta="Altura" valor={`${num(inputs.altura_cm)} cm`} />
            <Fila etiqueta="Peso" valor={kilos(inputs.peso_kg)} />
            <Fila
              etiqueta="Grasa corporal"
              valor={`${rango(resultado.grasa?.rango, (v) => num(v, 0))} % · ${etiqueta.metodoGrasa(
                resultado.grasa?.metodo_efectivo,
              )}`}
            />
            <Fila etiqueta="Actividad diaria" valor={etiqueta.actividad(inputs.actividad_diaria)} />
            <Fila etiqueta="Entrenamiento" valor={entrenoTexto} />
            <Fila
              etiqueta="Objetivo"
              valor={`${etiqueta.objetivo(resultado.objetivo_efectivo)}${
                matizRecomposicion(resultado) ? ` · prioridad: ${matizRecomposicion(resultado)}` : ''
              }`}
            />
            {/* §4.2 (v1.2): el ritmo impreso es SIEMPRE `ritmo_efectivo` —el del plan—, y el plazo
                pedido va como matiz. Si los dos no coinciden, lo explica INFO_RITMO_POR_PLAZO o
                WARN_PLAZO_IRREAL en la última página. */}
            <Fila
              etiqueta="Ritmo"
              valor={
                (resultado.objetivo_efectivo === 'perder' || resultado.objetivo_efectivo === 'ganar'
                  ? etiqueta.ritmo(resultado.ritmo_efectivo)
                  : 'no aplica con este objetivo') +
                (plazo === null ||
                (resultado.objetivo_efectivo !== 'perder' && resultado.objetivo_efectivo !== 'ganar')
                  ? ''
                  : ` · fecha pedida: ${num(plazo)} semanas`)
              }
            />
            {/* §4.2 (v1.1): base + restricciones + bajo en hidratos, nunca `inputs.preferencia`. */}
            <Fila etiqueta="Forma de comer" valor={formaDeComer(resultado)} />
            <Fila
              etiqueta="Comidas al día"
              valor={num(inputs.n_comidas)}
              ultima={condiciones.length === 0 && resumenAlimentosBreve.length === 0}
            />
            {condiciones.length > 0 ? (
              <Fila
                etiqueta="Nos has contado"
                valor={lista(condiciones)}
                ultima={resumenAlimentosBreve.length === 0}
              />
            ) : null}
            {/* §4.2 (v1.2): la misma línea que la pantalla imprime bajo el menú. */}
            {resumenAlimentosBreve.length > 0 ? (
              <Fila etiqueta="Alimentos" valor={resumenAlimentosBreve} ultima />
            ) : null}
          </View>

          {objetivoAjustado ? (
            <View style={[s.nota, { marginTop: 10 }]}>
              <Text style={s.h3}>Ajustado automáticamente</Text>
              <Text style={s.small}>
                {avisoAjuste?.texto ??
                  'Hemos elegido este objetivo a partir de tus respuestas para que el plan tenga sentido.'}
              </Text>
            </View>
          ) : null}

          <Text style={[s.small, { marginTop: 10 }]}>
            A tu gasto estimado le hemos restado un 5 % como margen de seguridad, porque casi todos sobrestimamos
            lo que nos movemos. Ninguna fórmula sin aparato mide la grasa corporal exacta: por eso te damos un
            rango, no una cifra cerrada. Documento informativo generado automáticamente. No sustituye una valoración nutricional individualizada.
          </Text>
        </View>
      </Marco>

      {/* ---------- Página 2: avisos del caso, macros, agua y método ---------- */}
      <Marco fecha={fecha} ajustado={ajustado}>
        {destacados.length > 0 ? (
          <Seccion titulo="Avisos para tu caso">
            {destacados.map((a) => (
              <CajaAviso key={a.codigo} aviso={a} />
            ))}
          </Seccion>
        ) : null}

        <Seccion titulo="Tus macronutrientes">
          {/* §4.3 (v1.1, decisión B): banda de plan ajustado, encima de las cuatro tarjetas.
              Compacta a propósito: la versión con el título en línea aparte hacía desbordar este
              marco y partía "Cómo lo calculamos". La marca se repite en la portada (§4.1) y en el
              pie de cada página, así que aquí basta con una banda de dos líneas bien visible. */}
          {ajustado ? (
            <View
              style={[s.tarjeta, { marginBottom: 8, borderLeftWidth: 4, borderLeftColor: C.acento, padding: 6 }]}
              wrap={false}
            >
              <Text style={s.p}>
                <Text style={{ fontFamily: 'Helvetica-Bold', color: C.acento }}>Plan ajustado por ti.</Text> Has
                cambiado{' '}
                {ajuste?.kcal && ajuste?.hc
                  ? 'las calorías y los hidratos'
                  : ajuste?.kcal
                    ? 'las calorías'
                    : 'los hidratos'}{' '}
                respecto a lo que te propusimos. Lo que te propusimos era: {fmtKcal(limites?.kcal_recomendada)} y{' '}
                {gramos(limites?.hc_recomendado_g)} de hidratos.
              </Text>
            </View>
          ) : null}
          <View style={{ marginBottom: 12 }}>
            <Barra
              segmentos={[
                { color: C.proteina, fraccion: resultado.macros?.pct?.p ?? 0 },
                { color: C.grasa, fraccion: resultado.macros?.pct?.g ?? 0 },
                { color: C.hc, fraccion: resultado.macros?.pct?.hc ?? 0 },
              ]}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
              <Text style={[s.small, { color: C.proteina }]}>Proteína {pctFraccion(resultado.macros?.pct?.p)}</Text>
              <Text style={[s.small, { color: C.grasa }]}>Grasa {pctFraccion(resultado.macros?.pct?.g)}</Text>
              <Text style={[s.small, { color: C.hc }]}>Carbohidratos {pctFraccion(resultado.macros?.pct?.hc)}</Text>
            </View>
          </View>

          <TarjetaMacro
            nombre="Proteína"
            color={C.proteina}
            valor={gramos(resultado.macros?.proteina_g)}
            gkg={`${num(resultado.macros?.gkg?.p, 1)} g por kilo de peso`}
            fraccionKcal={resultado.macros?.pct?.p ?? null}
            frase="Mantiene y construye tu músculo. En tus comidas principales intenta que haya al menos 20 g; un tentempié pequeño puede llevar menos sin problema, porque lo que más cuenta es el total del día."
          />
          <TarjetaMacro
            nombre="Grasa"
            color={C.grasa}
            valor={gramos(resultado.macros?.grasa_g)}
            gkg={`${num(resultado.macros?.gkg?.g, 1)} g por kilo de peso`}
            fraccionKcal={resultado.macros?.pct?.g ?? null}
            frase="Esencial para tus hormonas. Nunca debe faltar, aunque tu objetivo sea perder grasa corporal."
          />
          <TarjetaMacro
            nombre="Carbohidratos"
            color={C.hc}
            valor={gramos(resultado.macros?.hc_g)}
            gkg={`${num(resultado.macros?.gkg?.hc, 1)} g por kilo de peso`}
            fraccionKcal={resultado.macros?.pct?.hc ?? null}
            frase="Tu principal fuente de energía, sobre todo para entrenar fuerte. Es la cifra que más varía según cuántas calorías necesites."
          />
          <TarjetaMacro
            nombre="Fibra"
            color={C.fibra}
            valor={gramos(resultado.macros?.fibra_g)}
            gkg={null}
            fraccionKcal={null}
            frase="Cuida tu digestión y te ayuda a sentirte saciado/a. Repártela entre varias comidas: verdura, fruta y legumbres."
          />
          <Text style={s.small}>
            {notaCierreKcal(ajustado)} El cierre real de tu plan son{' '}
            {fmtKcal(resultado.kcal_cierre)}. Como referencia, limita los
            azúcares añadidos a menos de {gramos(resultado.macros?.azucares_libres_max_g)} al día.
          </Text>
        </Seccion>

        <Seccion titulo="Hidratación">
          {resultado.agua ? (
            <View>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 17, color: C.hc }}>
                Entre {mililitros(resultado.agua.rango?.[0])} y {mililitros(resultado.agua.rango?.[1])} al día
              </Text>
              <Text style={[s.p, { marginTop: 3 }]}>
                {mililitros(resultado.agua.ml)} de referencia, aproximadamente {num(resultado.agua.vasos)} vasos de
                250 ml.
              </Text>
            </View>
          ) : (
            <Text style={s.p}>
              {avisos.find((a) => a.codigo === 'INFO_AGUA_NO_PRESCRITA')?.texto ??
                'No te damos un objetivo de líquidos: con tu condición, la cantidad de agua la marca tu equipo médico.'}
            </Text>
          )}
          <Text style={s.small}>{NOTA_AGUA}</Text>
        </Seccion>

        {/* §4.3b (v1.1, decisión D): tarjeta del ciclo, debajo de la hidratación. Nunca se parte
            ni se resume, y el dato `menstruacion` no se imprime en ninguna parte. */}
        {/* La tarjeta SÍ se parte entre páginas desde la v1.2: con cuatro o cinco síntomas mide
            más que una página A4 entera, y `wrap={false}` la dejaba sobresalir del papel, es
            decir, recortada e invisible. Lo que no se parte es cada bloque de síntoma. */}
        {avisoCiclo ? (
          <View style={[s.nota, { marginBottom: 7 }]}>
            <Text style={s.h3}>Tu ciclo y tu plan</Text>
            <Text>{avisoCiclo.texto}</Text>
            {/* v1.2: un bloque por síntoma marcado, en el orden que trae el motor. Ninguno cambia
                un número: son qué priorizar dentro de los mismos macros. */}
            {consejosCiclo.map((c, i) => (
              <BloqueSintomaCiclo key={`${c.clave ?? 'sintoma'}-${i}`} consejo={c} />
            ))}
            {alimentosCiclo.length > 0 ? (
              <LineaAlimentosCiclo
                alimentos={alimentosCiclo}
                idsEnLaCompra={(compra?.opcional_ciclo?.items ?? []).map((i) => i.alimento_id)}
              />
            ) : null}
          </View>
        ) : null}

      </Marco>

      {/* ---------- Página 4: método, reparto y menú ----------
          "Cómo lo calculamos" ABRE esta página en vez de cerrar la de los macros: ahí, con la
          tarjeta del ciclo (§4.3b) o con la banda de plan ajustado (§4.3), el marco se desbordaba
          y la sección se partía, dejando su último párrafo solo en una página vacía al 85 %.
          `sinCortes` para que, si alguna vez no cabe, viaje entera. */}
      <Marco fecha={fecha} ajustado={ajustado}>
        <Seccion titulo="Cómo lo calculamos" sinCortes>
          <Text style={s.p}>
            Tu metabolismo basal (las calorías que gastarías en reposo) sale de la ecuación{' '}
            {etiqueta.bmr(resultado.bmr?.ecuacion)}: {fmtKcal(resultado.bmr?.valor)}.
          </Text>
          <Text style={s.p}>
            Tu gasto total estimado es de {fmtKcal(resultado.tdee?.bruto)}, al que restamos un 5 % de margen de
            seguridad: {fmtKcal(resultado.tdee?.valor)}. Sobre esa cifra aplicamos tu objetivo y tu ritmo para
            llegar a las {fmtKcal(resultado.kcal)} de tu plan.
          </Text>
          <Text style={s.small}>
            El somatotipo (en tu caso, {etiqueta.somatotipo(resultado.macros?.somatotipo)}) es una forma antigua de
            describir la silueta corporal: la ciencia actual no ha demostrado que sirva para calcular calorías o
            macros de forma precisa, así que lo usamos solo como un ajuste ligero entre carbohidratos y grasa,
            nunca en tus calorías ni en tu proteína.
          </Text>
        </Seccion>

        <Seccion titulo="Reparto por comidas">
          <View style={s.tablaCabecera}>
            <Text style={[s.cabeceraCelda, { flex: 2.4 }]}>COMIDA</Text>
            <Text style={[s.cabeceraCelda, { flex: 0.9, textAlign: 'right' }]}>%</Text>
            <Text style={[s.cabeceraCelda, { flex: 1.1, textAlign: 'right' }]}>PROT.</Text>
            <Text style={[s.cabeceraCelda, { flex: 1.1, textAlign: 'right' }]}>GRASA</Text>
            <Text style={[s.cabeceraCelda, { flex: 1.2, textAlign: 'right' }]}>HIDRATOS</Text>
            <Text style={[s.cabeceraCelda, { flex: 1.3, textAlign: 'right' }]}>CALORÍAS</Text>
          </View>
          {comidas.map((c, i) => (
            <View key={`${c.nombre}-${i}`} style={s.tablaFila} wrap={false}>
              <View style={{ flex: 2.4 }}>
                <Text style={s.celdaTexto}>{c.nombre}</Text>
                <Text style={s.small}>
                  {c.hora}
                  {c.peri ? ' · cerca de tu entreno' : ''}
                </Text>
              </View>
              <Text style={[s.celdaNum, { flex: 0.9 }]}>{pct(c.pct_kcal)}</Text>
              <Text style={[s.celdaNum, { flex: 1.1 }]}>{gramos(c.proteina_g)}</Text>
              <Text style={[s.celdaNum, { flex: 1.1 }]}>{gramos(c.grasa_g)}</Text>
              <Text style={[s.celdaNum, { flex: 1.2 }]}>{gramos(c.hc_g)}</Text>
              <Text style={[s.celdaNum, { flex: 1.3 }]}>{fmtKcal(c.kcal)}</Text>
            </View>
          ))}
          <View style={[s.tablaFila, { borderBottomWidth: 0, backgroundColor: C.acentoClaro }]} wrap={false}>
            <Text style={[s.celdaTexto, { flex: 2.4, fontFamily: 'Helvetica-Bold' }]}>Total del día</Text>
            <Text style={[s.celdaNum, { flex: 0.9, fontFamily: 'Helvetica-Bold' }]}>{pct(totalReparto.pct)}</Text>
            <Text style={[s.celdaNum, { flex: 1.1, fontFamily: 'Helvetica-Bold' }]}>{gramos(totalReparto.p)}</Text>
            <Text style={[s.celdaNum, { flex: 1.1, fontFamily: 'Helvetica-Bold' }]}>{gramos(totalReparto.g)}</Text>
            <Text style={[s.celdaNum, { flex: 1.2, fontFamily: 'Helvetica-Bold' }]}>{gramos(totalReparto.hc)}</Text>
            <Text style={[s.celdaNum, { flex: 1.3, fontFamily: 'Helvetica-Bold' }]}>{fmtKcal(totalReparto.kcal)}</Text>
          </View>
          <Text style={[s.small, { marginTop: 6 }]}>
            Las horas son de referencia: puedes desplazarlas sin que cambie ningún número. No hay evidencia de que
            comer más o menos veces al día cambie tu metabolismo, así que elige el número de comidas que mejor se
            adapte a tu rutina.
          </Text>
        </Seccion>

        <Seccion titulo="Ejemplo de menú">
          {hayMenu ? (
            <View>
              {diasIguales ? (
                <BloqueDia dia={ejemplos.entreno} titulo="Un día tipo" />
              ) : (
                <View>
                  <BloqueDia dia={ejemplos.entreno} titulo="Día de entreno" />
                  <BloqueDia dia={ejemplos.descanso} titulo="Día de descanso" />
                </View>
              )}
              {/* §4.4 (v1.2): el mismo resumen que la pantalla, sin el enlace "Cambiar" (en papel no
                  lleva a ninguna parte), y las notas del generador si ha tenido que usar igualmente
                  un alimento excluido. */}
              {resumenAlimentosLargo.length > 0 ? (
                <Text style={[s.small, { marginTop: 6 }]}>{resumenAlimentosLargo}</Text>
              ) : null}
              {avisosMenu.map((t, i) => (
                <Text key={`am-${i}`} style={[s.small, { marginTop: 2 }]}>
                  {t}
                </Text>
              ))}
              <Text style={[s.small, { marginTop: 6 }]}>
                Son ejemplos para orientarte, no un menú obligatorio. Puedes sustituir cualquier alimento por otro
                de la misma familia sin descuadrar tus macros de forma relevante: mira la tabla de equivalencias.
              </Text>
            </View>
          ) : (
            <Text style={s.p}>{SIN_MENU}</Text>
          )}
        </Seccion>

        {hayMenu ? (
          /* Entera o en la página siguiente: partida dejaba la última tabla y su nota solas en
             una página casi vacía. §4.4 ya la admite "en la misma página o en la siguiente". */
          <Seccion titulo="Equivalencias" sinCortes>
            <BloqueEquivalencias tablas={ejemplos.equivalencias} />
          </Seccion>
        ) : null}
      </Marco>

      {/* ---------- Página 3b: lista de la compra (§4.4b). Sin menú o sin lista, no se imprime. ---------- */}
      {compra ? (
        <Marco fecha={fecha} ajustado={ajustado}>
          {/* `fixed`: con una lista muy larga (vegano, 6 comidas, 3.000 kcal) no hay forma de que
              quepa en una página, y §4.4b pide poder imprimirla suelta. Si se parte, el título y el
              subtítulo se repiten arriba: la segunda hoja se sostiene sola en el súper. */}
          <Text style={[s.h1, { fontSize: 19, marginBottom: 2 }]} fixed>
            Tu lista de la compra de la semana
          </Text>
          <Text style={[s.small, { marginBottom: 6 }]} fixed>
            {SUBTITULO_COMPRA}
          </Text>
          {ejemplos.modo_sencillo ? (
            <View style={[s.tarjeta, { marginBottom: 6, padding: 6, borderLeftWidth: 3, borderLeftColor: C.acento }]} wrap={false}>
              <Text style={{ fontFamily: 'Helvetica-Bold', color: C.acento }}>
                {winAnsi(textoModoSencillo(compra.alimentos_distintos))} para toda la semana.
              </Text>
            </View>
          ) : null}
          {seccionesCompra.map((g) => (
            <BloqueSeccionCompra
              key={g.seccion}
              seccion={g.seccion}
              items={g.items}
              compacta={(compra.items ?? []).length > ITEMS_COMPRA_COMPACTA}
            />
          ))}
          {/* §4.4b (v1.2): sección opcional para los días de regla, al final y antes de las notas. */}
          {compra.opcional_ciclo ? (
            <BloqueOpcionalCompra
              seccion={compra.opcional_ciclo}
              compacta={(compra.items ?? []).length > ITEMS_COMPRA_COMPACTA}
            />
          ) : null}
          {(compra.notas ?? []).length > 0 ? (
            <View style={[s.nota, { marginTop: 2, padding: 6 }]} wrap={false}>
              <Text style={s.compraSmall}>
                {(compra.notas ?? []).map((n) => winAnsi(n)).join('  ·  ')}
              </Text>
            </View>
          ) : null}
        </Marco>
      ) : null}

      {/* ---------- Página 4: peso objetivo, consejos y referencias ---------- */}
      <Marco fecha={fecha} ajustado={ajustado}>
        <Seccion titulo="Peso objetivo y cronograma">
            <View style={[s.tarjeta, { marginBottom: 10 }]}>
              {resultado.peso_objetivo?.mostrar_central && resultado.peso_objetivo?.efectivo !== null ? (
                <View>
                  <Text style={{ fontSize: 9, color: C.suave }}>TU OBJETIVO</Text>
                  <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 26, color: C.acento }}>
                    {kilos(resultado.peso_objetivo?.efectivo)}
                  </Text>
                </View>
              ) : (
                <View>
                  <Text style={{ fontSize: 9, color: C.suave }}>FRANJA DE PESO RAZONABLE</Text>
                  <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 17, color: C.acento }}>
                    Entre {kilos(resultado.peso_objetivo?.rango?.[0])} y {kilos(resultado.peso_objetivo?.rango?.[1])}
                  </Text>
                  <Text style={[s.small, { marginTop: 4 }]}>
                    Tu masa magra es una estimación con varios kilos de margen, así que te damos una franja y no un
                    número.
                  </Text>
                </View>
              )}
              {/* §4.5 (v1.2): en recomposición con meta el número existe, pero no hay fecha detrás y
                  se dice donde se lee el número. */}
              {resultado.objetivo_efectivo === 'recomposicion' &&
              typeof resultado.peso_objetivo?.efectivo === 'number' ? (
                <Text style={[s.small, { marginTop: 6 }]}>{NOTA_PESO_OBJETIVO_RECOMP}</Text>
              ) : null}
              {typeof resultado.peso_objetivo?.hito_intermedio === 'number' ? (
                <Text style={[s.p, { marginTop: 8 }]}>
                  Primer hito: {kilos(resultado.peso_objetivo.hito_intermedio)}. Cuando el camino es largo, ir por
                  etapas ayuda a no perder la motivación.
                </Text>
              ) : null}
            </View>

            {crono ? (
              <View style={s.tarjeta}>
                <Fila
                  etiqueta="Tiempo estimado"
                  valor={`Entre ${num(crono.semanas?.[0])} y ${num(crono.semanas?.[1])} semanas`}
                />
                <Fila
                  etiqueta={crono.precision_fecha === 'mes' ? 'Horizonte aproximado' : 'Fechas'}
                  valor={rangoFechas(crono.fecha_min, crono.fecha_max, crono.precision_fecha)}
                />
                {crono.tramo_12sem ? (
                  <Fila
                    etiqueta="En las próximas 12 semanas"
                    valor={`Entre ${kilos(crono.tramo_12sem[0], 0)} y ${kilos(crono.tramo_12sem[1], 0)}`}
                  />
                ) : null}
                <Fila
                  etiqueta="Ritmo semanal"
                  valor={`${kilos(crono.ritmo_kg_sem, 2)} (${num(crono.ritmo_pct_sem, 2)} % de tu peso)`}
                />
                <Fila
                  etiqueta="Cambio total previsto"
                  valor={kilos(crono.delta_kg, 1)}
                  ultima={!(crono.diet_breaks > 0)}
                />
                {crono.diet_breaks > 0 ? (
                  <Fila
                    etiqueta="Semanas a mantenimiento"
                    valor={`${num(crono.diet_breaks)}, para que el cuerpo descanse del déficit`}
                    ultima
                  />
                ) : null}
                </View>
            ) : (
              <Text style={s.p}>
                {avisoCronograma?.texto ??
                  'Con este objetivo no hay un peso al que llegar en una fecha. Reevalúa medidas, fotos y ' +
                    'rendimiento cada 8-12 semanas.'}
              </Text>
            )}
            {/* §4.5: la nota INFO_ADAPTACION va bajo la línea de tiempo, no solo en la página de avisos. */}
            {crono && avisoAdaptacion ? (
              <Text style={[s.small, { marginTop: 6 }]}>{avisoAdaptacion.texto}</Text>
            ) : null}
        </Seccion>

        {/* ---------- §4.5b (v1.1, decisión F): proyección y seguimiento. Sin `proyeccion` no se
            imprime nada, ni un hueco ni una nota. ---------- */}
        {proyeccion.length > 0 ? (
          <Seccion titulo="Cómo debería ir la cosa">
            <Text style={[s.small, { marginBottom: 6 }]}>{SUBTITULO_PROYECCION}</Text>
            <GraficaProyeccion
              proyeccion={proyeccion}
              pesajes={pesajes}
              fechaInicio={inputs.fecha_inicio}
              objetivoKg={resultado.peso_objetivo?.efectivo ?? null}
            />
            {pesajes.length > 0 ? (
              <Text style={[s.small, { marginBottom: 6 }]}>
                La línea verde es la previsión; los puntos rojos, tu peso real.
              </Text>
            ) : null}
            <Text style={[s.p, { marginBottom: 6 }]}>{notaProyeccion}</Text>
            <Text style={[s.h3, { marginTop: 2 }]}>Los números, semana a semana</Text>
            <TablaProyeccion proyeccion={proyeccion} />

            {pesajes.length > 0 ? (
              <View style={{ marginTop: 8 }}>
                <Text style={s.h3}>Tu seguimiento</Text>
                <Text style={[s.small, { marginBottom: 4 }]}>
                  Estos pesajes estaban guardados solo en tu móvil el {fechaLarga(fecha)}. Este PDF es la única
                  copia que sale de él.
                </Text>
                {pesajes.map((p, i) => (
                  <View key={`pes-${p.fecha}-${i}`} style={[s.fila, s.filaLinea]} wrap={false}>
                    <Text style={s.filaEtiqueta}>{fechaCorta(p.fecha)}</Text>
                    <Text style={s.filaValor}>{kilos(p.kg)}</Text>
                  </View>
                ))}
                {balance ? (
                  <View style={{ marginTop: 6 }}>
                    {balance.map((t, i) => (
                      <Text key={`bal-${i}`} style={s.p}>
                        {t}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}
          </Seccion>
        ) : null}

        <Seccion titulo="Qué haría un nutricionista">
          <Vinetas textos={ejemplos?.consejos ?? []} />
        </Seccion>

        <Seccion titulo="Otras referencias, no son un objetivo">
            <View style={s.tarjeta}>
              <Fila
                etiqueta="Grasa corporal"
                valor={`${rango(resultado.grasa?.rango, (v) => num(v, 0))} % · nivel ${etiqueta.banda(
                  resultado.grasa?.banda,
                )}`}
              />
              <Fila
                etiqueta="Otras estimaciones de grasa"
                valor={lista([
                  `CUN-BAE ${num(resultado.grasa?.referencias?.cunbae, 1)} %`,
                  `Deurenberg ${num(resultado.grasa?.referencias?.deurenberg, 1)} %`,
                  ...(typeof resultado.grasa?.referencias?.navy === 'number'
                    ? [`US Navy ${num(resultado.grasa.referencias.navy, 1)} %`]
                    : []),
                ])}
              />
              <Fila etiqueta="Masa libre de grasa" valor={kilos(resultado.mlg)} />
              <Fila
                etiqueta="Índice de masa magra (FFMI)"
                valor={`${num(resultado.ffmi?.valor, 1)} · normalizado ${num(
                  resultado.ffmi?.normalizado,
                  1,
                )} · ${etiqueta.ffmi(resultado.ffmi?.categoria)}`}
              />
              <Fila etiqueta="Peso con un IMC de 22" valor={kilos(resultado.peso_objetivo?.referencias?.imc22)} />
              <Fila
                etiqueta="Franja de peso por IMC"
                valor={rango(resultado.peso_objetivo?.referencias?.rango_imc, (v) => kilos(v))}
                ultima={clasicas === null}
              />
              {clasicas ? (
                <Fila
                  etiqueta="Pesos ideales clásicos"
                  valor={lista(
                    Object.entries(clasicas).map(
                      ([clave, valor]) => `${NOMBRE_FORMULA_CLASICA[clave] ?? clave} ${kilos(valor)}`,
                    ),
                  )}
                  ultima
                />
              ) : null}
            </View>
            <Text style={[s.small, { marginTop: 6 }]}>
              Son puntos de comparación de la literatura (CUN-BAE, Deurenberg, US Navy, Devine, Robinson, Miller y
              Hamwi), no metas que tengas que alcanzar.
            </Text>
        </Seccion>

        {/* ---------- Avisos y disclaimer: siguen en el mismo flujo, sin salto forzado, para no
            dejar media página en blanco (§4.0 pide compacidad). ---------- */}
        {warns.length > 0 ? (
          <Seccion titulo="Avisos importantes">
            {warns.map((a) => (
              <CajaAviso key={a.codigo} aviso={a} />
            ))}
          </Seccion>
        ) : null}

        {infos.length > 0 ? (
          <Seccion titulo="Notas informativas">
            {infos.map((a) => (
              <CajaAviso key={a.codigo} aviso={a} />
            ))}
          </Seccion>
        ) : null}

        <Seccion titulo="Aviso legal" sinCortes>
          <Text style={s.p}>{DISCLAIMER}</Text>
          {/* §4.6: literal, palabra por palabra igual que en pantalla (§2.10). No depende de
              ninguna respuesta del cuestionario. */}
          <Text style={s.p}>{LINEA_ADANER}</Text>
          <Text style={s.small}>
            Plan generado el {fechaLarga(fecha)} con el motor de cálculo de Báscula, versión 1. Si vuelves más
            adelante con datos distintos, el cálculo se rehace con las mismas fórmulas.
          </Text>
        </Seccion>
      </Marco>
    </Document>
  )
}

export default PlanDocument
