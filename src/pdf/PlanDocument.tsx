// Documento PDF del plan (docs/SPEC-ux-comidas-pdf.md §4).
// Regla del contrato: aquí no se calcula nada. Todo número sale de `datos.resultado` / `datos.ejemplos`.
// Fuentes estándar (Helvetica) para no depender de la red.
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { ReactNode } from 'react'
import type {
  AlimentoPorcion,
  AvisoTexto,
  Comida,
  DatosPdf,
  EjemploComida,
  EjemploDia,
  ItemCompra,
  ListaCompra,
  Macros,
  SeccionSuper,
  TablasEquivalencia,
} from '../engine/types'
import { NOMBRE_SECCION, ORDEN_SECCIONES } from '../data/secciones'
// Las celdas de cantidad y el rótulo del modo sencillo salen del mismo helper que usa la
// pantalla (§4.4b: "las mismas cuatro columnas de §2.5b"). Aquí no se recalcula ningún número.
import { textoCantidadDia, textoCantidadSemana, textoModoSencillo } from '../meals/compra'
import { etiqueta, NOMBRE_FORMULA_CLASICA } from './etiquetas'
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
    marginBottom: 5,
    paddingBottom: 2.5,
    borderBottomWidth: 1.5,
    borderBottomColor: C.acento,
  },
  h3: { fontFamily: 'Helvetica-Bold', fontSize: 10.5, marginBottom: 3 },
  p: { marginBottom: 3.5, lineHeight: 1.3 },
  small: { fontSize: 8.5, color: C.suave, lineHeight: 1.4 },
  equivalencias: { fontSize: 8.5, color: C.tinta, lineHeight: 1.5 },
  seccion: { marginBottom: 9 },

  tarjeta: {
    borderWidth: 0.75,
    borderColor: C.linea,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    padding: 9,
  },
  fila: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
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
    paddingVertical: 5,
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
    padding: 8,
    marginBottom: 6,
    lineHeight: 1.35,
  },
  nota: {
    borderLeftWidth: 3,
    borderLeftColor: C.linea,
    backgroundColor: C.infoFondo,
    padding: 8,
    marginBottom: 6,
    lineHeight: 1.35,
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
function Marco({ fecha, children }: { fecha: string; children: ReactNode }) {
  return (
    <Page size="A4" style={s.page}>
      <Cabecera fecha={fecha} />
      {children}
      <View style={s.pie} fixed>
        <Text>Una herramienta de RS Agents</Text>
        <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
      </View>
    </Page>
  )
}

/** `sinCortes` evita que un bloque corto (el aviso legal) se parta a mitad de frase entre dos páginas. */
function Seccion({ titulo, children, sinCortes }: { titulo: string; children: ReactNode; sinCortes?: boolean }) {
  return (
    <View style={s.seccion} wrap={!sinCortes}>
      <Text style={s.h2} minPresenceAhead={40}>
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
        <View key={i} style={{ flexDirection: 'row', marginBottom: 4 }} wrap={false}>
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
    <View style={[s.tarjeta, { marginBottom: 6, borderLeftWidth: 3, borderLeftColor: color }]} wrap={false}>
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
    <View style={{ marginBottom: 10 }} minPresenceAhead={60}>
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

function LineaCompra({ item }: { item: ItemCompra }) {
  const consejo = winAnsi(item.consejo ?? '').trim()
  return (
    <View style={s.filaCompra} wrap={false}>
      <View style={{ flex: 2.3, paddingRight: 6 }}>
        <Text style={[s.celdaCompra, { fontFamily: 'Helvetica-Bold' }]}>{winAnsi(item.producto) || SIN_DATO}</Text>
        <Text style={s.compraSmall}>
          {winAnsi(item.nombre) || SIN_DATO}
          {consejo.length > 0 ? ` · ${consejo}` : ''}
        </Text>
      </View>
      <View style={{ flex: 1.25, paddingRight: 6 }}>
        <Text style={s.celdaCompraNum}>{winAnsi(textoCantidadSemana(item))}</Text>
        <Text style={[s.compraSmall, { textAlign: 'right' }]}>{winAnsi(textoCantidadDia(item))}</Text>
      </View>
      <Text style={[s.celdaCompraNum, { flex: 1.9, paddingRight: 6 }]}>{comprarTexto(item)}</Text>
      <Text style={[s.celdaCompraNum, { flex: 0.75 }]}>{duracionTexto(item.dura_dias)}</Text>
    </View>
  )
}

function BloqueSeccionCompra({ seccion, items }: { seccion: SeccionSuper; items: readonly ItemCompra[] }) {
  return (
    <View style={{ marginBottom: 4 }} minPresenceAhead={46}>
      <View style={[s.tablaCabecera, { paddingBottom: 2, marginBottom: 1, alignItems: 'flex-end' }]}>
        <Text style={[s.h3, { color: C.acento, flex: 2.3, marginBottom: 0 }]}>{NOMBRE_SECCION[seccion]}</Text>
        <Text style={[s.cabeceraCelda, { flex: 1.25, textAlign: 'right' }]}>CANTIDAD</Text>
        <Text style={[s.cabeceraCelda, { flex: 1.9, textAlign: 'right' }]}>COMPRAR</Text>
        <Text style={[s.cabeceraCelda, { flex: 0.75, textAlign: 'right' }]}>DURA</Text>
      </View>
      {items.map((item, i) => (
        <LineaCompra key={`${item.alimento_id}-${i}`} item={item} />
      ))}
    </View>
  )
}

// ---------- Textos fijos ----------
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

const SIN_MENU =
  'No te proponemos menús de ejemplo. Con tu condición, la elección concreta de alimentos (potasio, fósforo, ' +
  'sodio y tipo de proteína) cambia mucho el resultado y debe hacerla un/a dietista-nutricionista ' +
  'especializado/a. Tus calorías y tus macros siguen siendo una referencia orientativa que puedes llevarle.'

function sufijoObjetivo(datos: DatosPdf): string {
  const { objetivo_efectivo, ritmo_efectivo } = datos.resultado
  if (objetivo_efectivo === 'perder' || objetivo_efectivo === 'ganar') {
    return `ritmo ${etiqueta.ritmo(ritmo_efectivo)}`
  }
  if (objetivo_efectivo === 'recomposicion') return 'cambios lentos, es lo esperable'
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

  // Guarda del cribado (§2.1, §2.6, §2.9 y §4.5): sin %grasa, sin peso objetivo, sin otras referencias.
  const ocultarGrasa =
    inputs.cribado_tca === 'positivo' ||
    inputs.cribado_tca === 'evitado' ||
    (inputs.condiciones ?? []).includes('tca')

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

  return (
    <Document title="Báscula — plan nutricional" author="RS Agents" language="es-ES">
      {/* ---------- Página 1: portada ---------- */}
      <Marco fecha={fecha}>
        <View style={{ marginTop: 36 }}>
          <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 34, color: C.acento }}>Báscula</Text>
          <Text style={{ fontSize: 12, color: C.suave, marginBottom: 26 }}>Tus macros, bien calculados</Text>
          <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 20, marginBottom: 22 }}>
            Tu plan nutricional personalizado
          </Text>

          <View style={[s.tarjeta, { marginBottom: 22 }]}>
            <Fila etiqueta="Sexo" valor={etiqueta.sexo(inputs.sexo)} />
            <Fila etiqueta="Edad" valor={`${num(inputs.edad)} años`} />
            <Fila etiqueta="Altura" valor={`${num(inputs.altura_cm)} cm`} />
            <Fila etiqueta="Peso" valor={kilos(inputs.peso_kg)} />
            <Fila etiqueta="Fecha del plan" valor={fechaLarga(fecha)} ultima />
          </View>

          <Text style={{ fontSize: 9, color: C.suave, marginBottom: 2 }}>TU OBJETIVO</Text>
          <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 26, color: C.acento }}>
            {etiqueta.objetivo(resultado.objetivo_efectivo)}
          </Text>
          {sufijoObjetivo(datos) ? (
            <Text style={{ fontSize: 11, color: C.suave, marginBottom: 10 }}>{sufijoObjetivo(datos)}</Text>
          ) : null}
          {objetivoAjustado ? (
            <View style={[s.nota, { marginTop: 10 }]}>
              <Text style={s.h3}>Ajustado automáticamente</Text>
              <Text style={s.small}>
                {avisoAjuste?.texto ??
                  'Hemos elegido este objetivo a partir de tus respuestas para que el plan tenga sentido.'}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={{ position: 'absolute', bottom: 72, left: 46, right: 46 }}>
          <Text style={s.small}>
            Documento informativo generado automáticamente. No sustituye una valoración nutricional
            individualizada. RS Agents / Báscula no se hace responsable del uso que se haga de esta información sin
            supervisión profesional.
          </Text>
        </View>
      </Marco>

      {/* ---------- Página 2: datos y resultados clave ---------- */}
      <Marco fecha={fecha}>
        <Seccion titulo="Tus datos">
          <View style={s.tarjeta}>
            <Fila etiqueta="Sexo" valor={etiqueta.sexo(inputs.sexo)} />
            <Fila etiqueta="Edad" valor={`${num(inputs.edad)} años`} />
            <Fila etiqueta="Altura" valor={`${num(inputs.altura_cm)} cm`} />
            <Fila etiqueta="Peso" valor={kilos(inputs.peso_kg)} />
            {ocultarGrasa ? null : (
              <Fila
                etiqueta="Grasa corporal"
                valor={`${rango(resultado.grasa?.rango, (v) => num(v, 0))} % · ${etiqueta.metodoGrasa(
                  resultado.grasa?.metodo_efectivo,
                )}`}
              />
            )}
            <Fila etiqueta="Actividad diaria" valor={etiqueta.actividad(inputs.actividad_diaria)} />
            <Fila etiqueta="Entrenamiento" valor={entrenoTexto} />
            <Fila etiqueta="Objetivo" valor={etiqueta.objetivo(resultado.objetivo_efectivo)} />
            <Fila
              etiqueta="Ritmo"
              valor={
                resultado.objetivo_efectivo === 'perder' || resultado.objetivo_efectivo === 'ganar'
                  ? etiqueta.ritmo(resultado.ritmo_efectivo)
                  : 'no aplica con este objetivo'
              }
            />
            <Fila etiqueta="Forma de comer" valor={etiqueta.preferencia(resultado.preferencia_efectiva)} />
            <Fila etiqueta="Comidas al día" valor={num(inputs.n_comidas)} ultima={condiciones.length === 0} />
            {condiciones.length > 0 ? <Fila etiqueta="Nos has contado" valor={lista(condiciones)} ultima /> : null}
          </View>
        </Seccion>

        <Seccion titulo="Tus resultados">
          <View style={[s.tarjeta, { marginBottom: 10 }]}>
            <Text style={{ fontSize: 9, color: C.suave }}>CALORÍAS AL DÍA</Text>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 36, color: C.acento }}>
              {num(resultado.kcal)}
              <Text style={{ fontSize: 14, color: C.suave }}> kcal</Text>
            </Text>
          </View>
          <View style={s.tarjeta}>
            <Fila
              etiqueta="Índice de masa corporal (IMC)"
              valor={`${num(resultado.imc, 1)} · ${etiqueta.imc(resultado.imc_categoria)}`}
            />
            {ocultarGrasa ? null : (
              <Fila
                etiqueta="Grasa corporal estimada"
                valor={`${rango(resultado.grasa?.rango, (v) => num(v, 0))} % · ${etiqueta.fiabilidad(
                  resultado.grasa?.fiabilidad,
                )}`}
              />
            )}
            <Fila etiqueta="Gasto energético estimado" valor={`${fmtKcal(resultado.tdee?.valor)} al día`} ultima />
          </View>
          <Text style={[s.small, { marginTop: 6 }]}>
            A tu gasto estimado le hemos restado un 5 % como margen de seguridad, porque casi todos sobrestimamos
            lo que nos movemos.
            {ocultarGrasa
              ? ''
              : ' Ninguna fórmula sin aparato mide la grasa corporal exacta: por eso te damos un rango, no una cifra cerrada.'}
          </Text>
        </Seccion>

        {destacados.length > 0 ? (
          <Seccion titulo="Avisos para tu caso">
            {destacados.map((a) => (
              <CajaAviso key={a.codigo} aviso={a} />
            ))}
          </Seccion>
        ) : null}
      </Marco>

      {/* ---------- Página 3: macros, agua y método ---------- */}
      <Marco fecha={fecha}>
        <Seccion titulo="Tus macronutrientes">
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
            Las calorías de tus macros pueden diferir hasta 10 kcal del objetivo por el redondeo a múltiplos de 5
            gramos (el cierre real de tu plan son {fmtKcal(resultado.kcal_cierre)}). Como referencia, limita los
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

        <Seccion titulo="Cómo lo calculamos">
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
      </Marco>

      {/* ---------- Página 4: reparto y menú ---------- */}
      <Marco fecha={fecha}>
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
          <Seccion titulo="Equivalencias">
            <BloqueEquivalencias tablas={ejemplos.equivalencias} />
          </Seccion>
        ) : null}
      </Marco>

      {/* ---------- Página 4b: lista de la compra (§4.4b). Sin menú o sin lista, no se imprime. ---------- */}
      {compra ? (
        <Marco fecha={fecha}>
          <Text style={[s.h1, { fontSize: 19, marginBottom: 2 }]}>Tu lista de la compra de la semana</Text>
          <Text style={[s.small, { marginBottom: 6 }]}>{SUBTITULO_COMPRA}</Text>
          {ejemplos.modo_sencillo ? (
            <View style={[s.tarjeta, { marginBottom: 6, padding: 6, borderLeftWidth: 3, borderLeftColor: C.acento }]} wrap={false}>
              <Text style={{ fontFamily: 'Helvetica-Bold', color: C.acento }}>
                {winAnsi(textoModoSencillo(compra.alimentos_distintos))} para toda la semana.
              </Text>
            </View>
          ) : null}
          {seccionesCompra.map((g) => (
            <BloqueSeccionCompra key={g.seccion} seccion={g.seccion} items={g.items} />
          ))}
          {(compra.notas ?? []).length > 0 ? (
            <View style={[s.nota, { marginTop: 2, padding: 6 }]} wrap={false}>
              <Text style={s.compraSmall}>
                {(compra.notas ?? []).map((n) => winAnsi(n)).join('  ·  ')}
              </Text>
            </View>
          ) : null}
        </Marco>
      ) : null}

      {/* ---------- Página 5: peso objetivo, consejos y referencias ---------- */}
      <Marco fecha={fecha}>
        {ocultarGrasa ? null : (
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
        )}

        <Seccion titulo="Qué haría un nutricionista">
          <Vinetas textos={ejemplos?.consejos ?? []} />
        </Seccion>

        {ocultarGrasa ? null : (
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
        )}

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
          <Text style={s.p}>
            ¿La comida o el peso te generan ansiedad? Puedes hablar gratis con ADANER, la asociación de ayuda en
            trastornos de la conducta alimentaria (adaner.org).
          </Text>
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
