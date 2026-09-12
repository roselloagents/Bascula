// "Tu menú, con lo tuyo dentro" (SPEC-dieta-propia §5.4).
//
// Sustituye al bloque "Un día de ejemplo" mientras la composición está activa. Aquí no se calcula
// ni un gramo: todo sale de `DiaCompuesto`, que produce `componerDia` en `src/meals/dieta`. Las
// correcciones por fila cambian la `DietaInterpretada` guardada y vuelven a componer el día desde
// `App`, sin llamar a la API.

import { useEffect, useRef, useState } from 'react'
import type {
  AlimentoAjustado,
  AlimentoPropio,
  ComidaCompuesta,
  DiaCompuesto,
  DietaInterpretada,
  Ejemplos,
  InputCalculo,
  MacrosPropio,
} from '../../engine/types'
import type { DietaGuardada } from '../../dieta/almacen'
import type { VentanaDictado } from '../../dieta/dictado'
import { CampoNumero, Plegable } from '../ui/Controles'
import { IconoLapiz, IconoPesa } from '../ui/Iconos'
import { nombreCorto } from '../utiles/alimentos'
import { entero, fechaLarga, leerNumero, num, numCorto } from '../utiles/formato'
import { ResumenAlimentos } from './BloquesMenu'
import { NotasCondicion } from './NotasCondicion'
import { FormularioDieta } from './FormularioDieta'
import { localizarAlimento, useAperturaDieta } from './dieta'
import { ERROR_NO_DISPONIBLE } from '../../dieta/api'

// ---- Copy literal (§5.4) -------------------------------------------------

/** [SPEC] §5.4, título del bloque. */
export const TITULO_BLOQUE_DIETA = 'Tu menú, con lo tuyo dentro'

/** [SPEC] §5.4, descripción según el modo de composición. */
const DESCRIPCION_MODO: Record<DiaCompuesto['modo'], string> = {
  completa:
    'Estas son tus comidas. Hemos movido los gramos lo justo para cuadrar tus calorías y tus macros. Cada alimento está en el estado en el que nos lo contaste: si dijiste «en seco», los gramos son en seco.',
  parcial:
    'Las comidas que nos contaste van tal cual (o con los gramos ajustados donde hacía falta); las demás las hemos montado para cuadrar el resto de tu plan.',
  solo_contexto:
    'Hemos montado el día con lo que nos contaste: sin lo que no te gusta, con lo que te gusta y como prefieres cada comida.',
}

/** [SPEC] §5.4, nota fija del pie del bloque. */
const NOTA_FIJA =
  'Las comidas marcadas «tuya» son tu comida real, con los gramos ajustados por un algoritmo a tu plan; las marcadas «propuesta» las hemos montado nosotros. Lo que dictaste lo ha interpretado un modelo de inteligencia artificial: revisa que haya entendido bien cada alimento y corrige lo que haga falta con «Cambiar».'

/** [SPEC] §5.4, al volver al menú propuesto. */
export const ESTADO_MENU_PROPUESTO =
  'Estás viendo el menú propuesto. Lo que nos contaste sigue guardado.'

/** Estado del alimento cuando no es `listo` (§5.4). */
const ESTADO_TEXTO: Record<AlimentoAjustado['estado'], string> = {
  crudo: 'en crudo',
  cocido: 'ya cocido',
  seco: 'en seco',
  listo: '',
}

/** Avisos que se ven sin desplegar nada (§5.4). */
const AVISOS_VISIBLES = 3
/** Segundos que dura el aviso efímero antes de desaparecer (§5.4). */
const SEGUNDOS_DESHACER = 6
/** Desviación por macro a partir de la cual se pinta el sufijo del total (§5.4). */
const UMBRAL_DESVIO = 0.02

// ---- Utilidades ----------------------------------------------------------

/** ¿El alimento se cuenta en unidades? (huevos, cacitos, latas…) */
function esContable(a: AlimentoAjustado): boolean {
  return (
    a.unidad !== undefined &&
    a.unidad.gramos > 0 &&
    typeof a.cantidad_unidades === 'number' &&
    a.cantidad_unidades > 0
  )
}

/** "en crudo · 5 × huevo M": el detalle que acompaña al nombre de un alimento dictado (§5.4). */
function detalleDe(a: AlimentoAjustado): string {
  const partes: string[] = []
  const estado = ESTADO_TEXTO[a.estado] ?? ''
  if (estado !== '') partes.push(estado)
  if (esContable(a) && a.unidad) {
    partes.push(`${num(a.cantidad_unidades ?? 0)} × ${a.unidad.nombre}`)
  }
  return partes.join(' · ')
}

/** El sufijo de desviación de un macro del total del día, o `null` si no llega al 2 % (§5.4). */
function desvioDe(
  valor: number,
  objetivo: number,
  unidad: 'kcal' | 'g',
  macro: string,
): { texto: string; etiqueta: string; sube: boolean } | null {
  if (!Number.isFinite(valor) || !Number.isFinite(objetivo) || objetivo <= 0) return null
  const d = valor - objetivo
  if (Math.abs(d) <= UMBRAL_DESVIO * objetivo) return null
  const sube = d > 0
  const magnitud = unidad === 'kcal' ? entero(Math.abs(d)) : numCorto(Math.abs(d), 1)
  const signo = sube ? '+' : '−'
  const nombre = unidad === 'kcal' ? 'kcal' : `gramos de ${macro}`
  return {
    texto: `${signo}${magnitud} ${unidad}`,
    etiqueta: `${magnitud} ${nombre} por ${sube ? 'encima' : 'debajo'} del plan`,
    sube,
  }
}

function Desvio({
  valor,
  objetivo,
  unidad,
  macro,
}: {
  valor: number
  objetivo: number
  unidad: 'kcal' | 'g'
  macro: string
}) {
  const d = desvioDe(valor, objetivo, unidad, macro)
  if (d === null) return null
  return (
    <span
      className={`dieta-desvio ${d.sube ? 'dieta-desvio-sube' : 'dieta-desvio-baja'}`}
      aria-label={d.etiqueta}
    >
      {d.texto}
    </span>
  )
}

// ---- Fila de alimento dictado --------------------------------------------

interface PropsFila {
  alimento: AlimentoAjustado
  /** `parcial` no pinta "igual" cuando nada se ha movido (§5.4). */
  modo: DiaCompuesto['modo']
  onGuardar: (cambios: Partial<AlimentoPropio>, aviso?: string) => void
  onQuitar: () => void
}

function macrosDelEnvase(
  base: MacrosPropio,
  campos: Record<'kcal' | 'prot' | 'carb' | 'fat' | 'fibra', string>,
): MacrosPropio | null {
  const leidos = {
    kcal: leerNumero(campos.kcal),
    prot: leerNumero(campos.prot),
    carb: leerNumero(campos.carb),
    fat: leerNumero(campos.fat),
    fibra: leerNumero(campos.fibra),
  }
  if (Object.values(leidos).every((v) => v === null)) return null
  return {
    kcal: leidos.kcal ?? base.kcal,
    prot: leidos.prot ?? base.prot,
    carb: leidos.carb ?? base.carb,
    fat: leidos.fat ?? base.fat,
    fibra: leidos.fibra ?? base.fibra,
    alcohol: base.alcohol,
  }
}

function FilaAlimento({ alimento, modo, onGuardar, onQuitar }: PropsFila) {
  const contable = esContable(alimento)
  const [abierta, setAbierta] = useState(false)
  const [cantidad, setCantidad] = useState(
    contable ? String(alimento.cantidad_unidades ?? 1) : String(alimento.gramos ?? ''),
  )
  const [envase, setEnvase] = useState({ kcal: '', prot: '', carb: '', fat: '', fibra: '' })
  const pendiente = alimento.estado_ajuste === 'pendiente'
  const detalle = detalleDe(alimento)
  const estimado = alimento.origen_macros === 'estimado'
  const delEnvase = alimento.origen_macros === 'envase'
  const cambio = alimento.cambio

  const guardar = () => {
    const cambios: Partial<AlimentoPropio> = {}
    const escrito = leerNumero(cantidad)
    if (escrito !== null && alimento.unidad && contable) {
      const unidades = Math.max(0, Math.min(60, Math.round(escrito)))
      cambios.cantidad_unidades = unidades
      cambios.gramos = Math.round(unidades * alimento.unidad.gramos)
    } else if (escrito !== null) {
      cambios.gramos = Math.max(0, Math.min(3000, Math.round(escrito)))
    }
    const macros = macrosDelEnvase(alimento.macros_100g, envase)
    if (macros !== null) {
      cambios.macros_100g = macros
      cambios.origen_macros = 'envase'
    }
    setAbierta(false)
    if (Object.keys(cambios).length === 0) return
    // Completar un pendiente mueve los gramos de todo el día: se dice (§5.4).
    onGuardar(
      cambios,
      pendiente
        ? `Añadido ${alimento.nombre}. Hemos recalculado: algunos gramos han cambiado.`
        : undefined,
    )
  }

  return (
    <li className="dieta-alimento">
      <span className="cifra menu-gramos">
        {pendiente ? '—' : `${entero(alimento.gramos_ajustados)} g`}
      </span>
      <span className="dieta-alimento-nombre">
        {alimento.nombre}
        {detalle !== '' ? <span className="dieta-nota"> · {detalle}</span> : null}
      </span>

      <span className="dieta-etiquetas">
        {!pendiente && cambio !== 'igual' ? (
          <span
            className={`dieta-etiqueta ${cambio === 'sube' ? 'dieta-etiqueta-sube' : 'dieta-etiqueta-baja'}`}
          >
            {cambio === 'sube' ? '+' : '−'}
            {entero(Math.abs(alimento.delta_g))} g
          </span>
        ) : null}
        {/* En modo parcial, "igual" sería ruido en todas las filas: solo se pinta en `completa`. */}
        {!pendiente && cambio === 'igual' && modo === 'completa' ? (
          <span className="dieta-etiqueta">igual</span>
        ) : null}
        {estimado ? (
          <span
            className="dieta-etiqueta dieta-etiqueta-macros"
            aria-label="macros estimados, no está en nuestra base"
          >
            estimado
          </span>
        ) : null}
        {delEnvase ? (
          <span className="dieta-etiqueta dieta-etiqueta-macros">del envase</span>
        ) : null}
      </span>

      {alimento.nota ? <p className="dieta-nota">{alimento.nota}</p> : null}

      {pendiente ? (
        <div className="dieta-pendiente">
          <CampoNumero
            etiqueta={`${alimento.nombre}: ¿cuántos gramos?`}
            unidad={contable && alimento.unidad ? alimento.unidad.nombre : 'g'}
            valor={cantidad}
            entero
            onCambio={setCantidad}
          />
          <button type="button" className="btn-plano" onClick={guardar}>
            Añadir
          </button>
        </div>
      ) : (
        <div className="dieta-acciones-fila">
          <button
            type="button"
            className="dieta-cambiar"
            aria-label={`Cambiar ${alimento.nombre}`}
            aria-expanded={abierta}
            onClick={() => setAbierta((v) => !v)}
          >
            <IconoLapiz tam={15} />
            Cambiar
          </button>
          <button
            type="button"
            className="menu-quitar"
            aria-label={`Quitar ${alimento.nombre} de mis comidas`}
            onClick={onQuitar}
          >
            <span aria-hidden="true">✕</span> Esto no lo como
          </button>
        </div>
      )}

      {abierta && !pendiente ? (
        <div className="dieta-edicion">
          <CampoNumero
            etiqueta={contable ? 'Cuántas unidades' : 'Gramos que comes'}
            unidad={contable && alimento.unidad ? alimento.unidad.nombre : 'g'}
            valor={cantidad}
            entero
            max={contable ? 60 : 3000}
            onCambio={setCantidad}
          />
          {/* El envase solo se ofrece donde nuestros macros no son del catálogo (§5.4). */}
          {estimado || delEnvase ? (
            <Plegable titulo="Escribir los macros del envase">
              <div className="dieta-envase">
                <CampoNumero
                  etiqueta="Calorías"
                  unidad="kcal/100 g"
                  valor={envase.kcal}
                  entero
                  placeholder={entero(alimento.macros_100g.kcal)}
                  onCambio={(v) => setEnvase((p) => ({ ...p, kcal: v }))}
                />
                <CampoNumero
                  etiqueta="Proteína"
                  unidad="g/100 g"
                  valor={envase.prot}
                  placeholder={numCorto(alimento.macros_100g.prot, 1)}
                  onCambio={(v) => setEnvase((p) => ({ ...p, prot: v }))}
                />
                <CampoNumero
                  etiqueta="Hidratos"
                  unidad="g/100 g"
                  valor={envase.carb}
                  placeholder={numCorto(alimento.macros_100g.carb, 1)}
                  onCambio={(v) => setEnvase((p) => ({ ...p, carb: v }))}
                />
                <CampoNumero
                  etiqueta="Grasa"
                  unidad="g/100 g"
                  valor={envase.fat}
                  placeholder={numCorto(alimento.macros_100g.fat, 1)}
                  onCambio={(v) => setEnvase((p) => ({ ...p, fat: v }))}
                />
                <CampoNumero
                  etiqueta="Fibra"
                  unidad="g/100 g"
                  valor={envase.fibra}
                  placeholder={numCorto(alimento.macros_100g.fibra, 1)}
                  onCambio={(v) => setEnvase((p) => ({ ...p, fibra: v }))}
                />
              </div>
              <p className="dieta-nota">
                Los hidratos van con la fibra dentro, como los calculamos nosotros.
              </p>
            </Plegable>
          ) : null}
          <div className="acciones-menu">
            <button type="button" className="btn btn-secundario" onClick={guardar}>
              Guardar
            </button>
          </div>
        </div>
      ) : null}
    </li>
  )
}

// ---- Una comida del día compuesto ----------------------------------------

function totalesTexto(t: MacrosPropio): string {
  return `${entero(t.kcal)} kcal · ${entero(t.prot)} g de proteína · ${entero(t.fat)} g de grasa · ${entero(t.carb)} g de hidratos`
}

interface PropsComida {
  comida: ComidaCompuesta
  modo: DiaCompuesto['modo']
  onGuardar: (visible: number, cambios: Partial<AlimentoPropio>, aviso?: string) => void
  onQuitar: (visible: number, nombre: string) => void
  onExcluirAlimento?: (id: string, nombre: string) => void
}

function ComidaDelDia({ comida, modo, onGuardar, onQuitar, onExcluirAlimento }: PropsComida) {
  const propia = comida.origen === 'propia'
  return (
    <li className="menu-comida">
      <div className="menu-comida-cabecera">
        <h3>{comida.nombre}</h3>
        {comida.hora ? <span className="comida-hora cifra">{comida.hora}</span> : null}
        <span className="cifra dieta-pct">{numCorto(comida.pct_kcal, 1)} % de tus kcal</span>
        <span className={`dieta-origen${propia ? ' dieta-origen-propia' : ''}`}>
          {propia ? 'tuya' : 'propuesta'}
        </span>
        {comida.peri ? (
          <span className="etiqueta-peri">
            <IconoPesa tam={14} /> cerca de tu entreno
          </span>
        ) : null}
      </div>

      {propia ? (
        <ul className="menu-alimentos">
          {comida.alimentos.map((alimento, i) => (
            <FilaAlimento
              key={`${alimento.nombre}-${i}`}
              alimento={alimento}
              modo={modo}
              onGuardar={(cambios, aviso) => onGuardar(i, cambios, aviso)}
              onQuitar={() => onQuitar(i, alimento.nombre)}
            />
          ))}
        </ul>
      ) : comida.ejemplo ? (
        <ul className="menu-alimentos">
          {comida.ejemplo.alimentos.map((alimento) => (
            <li key={alimento.id}>
              <span className="cifra menu-gramos">{entero(alimento.gramos)} g</span>
              <span className="menu-alimento">{alimento.nombre}</span>
              <span className="menu-medida">{alimento.medida}</span>
              {onExcluirAlimento ? (
                <button
                  type="button"
                  className="menu-quitar"
                  aria-label={`Quitar ${alimento.nombre} de mi menú`}
                  onClick={() => onExcluirAlimento(alimento.id, alimento.nombre)}
                >
                  <span aria-hidden="true">✕</span> No me gusta
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="menu-totales cifra">{totalesTexto(comida.totales)}</p>

      {comida.ejemplo && comida.ejemplo.alternativas.length > 0 ? (
        <ul className="menu-alternativas">
          {comida.ejemplo.alternativas.map((alternativa) => (
            <li key={alternativa}>{alternativa}</li>
          ))}
        </ul>
      ) : null}
    </li>
  )
}

// ---- El bloque -----------------------------------------------------------

interface Props {
  compuesto: DiaCompuesto
  dieta: DietaGuardada
  inputs: InputCalculo
  /** Para el resumen "Sin: … · Favoritos: …" que baja del menú propuesto (§5.1). */
  ejemplos?: Ejemplos
  comidasPlan: string[]
  /** Corrección de una fila: cambia la `DietaInterpretada` guardada y recompone (§5.4). */
  onCorregir: (comida: number, alimento: number, cambios: Partial<AlimentoPropio>) => void
  /** "Editar lo que conté": una interpretación nueva sustituye a la actual. */
  onValidada: (texto: string, interpretada: DietaInterpretada) => void
  onOtroEjemplo?: () => void
  onVerPropuesto?: () => void
  onExcluirAlimento?: (id: string) => void
  onDeshacerExclusion?: (id: string) => void
  onCambiarAlimentos?: () => void
  onFormulario?: (abierto: boolean) => void
  /** Contador: cada vez que sube, el bloque hace scroll y mueve el foco a su h2 (§5.3). */
  foco?: number
  /** Solo para los tests: en producción se usa `window`. */
  ventana?: VentanaDictado
}

export function BloqueDietaPropia({
  compuesto,
  dieta,
  inputs,
  ejemplos,
  comidasPlan,
  onCorregir,
  onValidada,
  onOtroEjemplo,
  onVerPropuesto,
  onExcluirAlimento,
  onDeshacerExclusion,
  onCambiarAlimentos,
  onFormulario,
  foco = 0,
  ventana,
}: Props) {
  const [verAvisos, setVerAvisos] = useState(false)
  const [efimero, setEfimero] = useState<{ texto: string; deshacer: () => void } | null>(null)
  const [estado, setEstado] = useState('')
  const apertura = useAperturaDieta()
  const titulo = useRef<HTMLHeadingElement>(null)
  const deshacer = useRef<HTMLButtonElement>(null)
  const editar = useRef<HTMLButtonElement>(null)

  // Al validar una interpretación el bloque se lleva el foco y el scroll (§5.3).
  useEffect(() => {
    if (foco <= 0) return
    titulo.current?.scrollIntoView({ block: 'start' })
    titulo.current?.focus()
  }, [foco])

  useEffect(() => {
    if (efimero === null) return
    deshacer.current?.focus()
    const temporizador = window.setTimeout(() => setEfimero(null), SEGUNDOS_DESHACER * 1000)
    return () => window.clearTimeout(temporizador)
  }, [efimero])

  const localizar = (nombreComida: string, visible: number) =>
    localizarAlimento(dieta.interpretada, nombreComida, visible)

  const guardarFila = (
    nombreComida: string,
    visible: number,
    cambios: Partial<AlimentoPropio>,
    aviso?: string,
  ) => {
    const sitio = localizar(nombreComida, visible)
    if (sitio === null) return
    onCorregir(sitio.comida, sitio.alimento, cambios)
    if (aviso !== undefined) setEstado(aviso)
  }

  const quitarFila = (nombreComida: string, visible: number, nombre: string) => {
    const sitio = localizar(nombreComida, visible)
    if (sitio === null) return
    onCorregir(sitio.comida, sitio.alimento, { retirado: true })
    setEfimero({
      texto: `Fuera ${nombre}. Hemos recalculado.`,
      deshacer: () => onCorregir(sitio.comida, sitio.alimento, { retirado: false }),
    })
  }

  const avisos = compuesto.avisos
  const visibles = verAvisos ? avisos : avisos.slice(0, AVISOS_VISIBLES)
  const ocultos = avisos.length - visibles.length
  const hayHuecos = compuesto.comidas.some((c) => c.origen === 'propuesta')
  const objetivo = compuesto.objetivo
  const t = compuesto.totales

  return (
    <section className="seccion">
      <NotasCondicion condiciones={inputs.condiciones} dietaPropia />

      <header className="seccion-cabecera">
        <h2 ref={titulo} tabIndex={-1}>
          {TITULO_BLOQUE_DIETA}
          <span className="dieta-distintivos">
            <span className="etiqueta-ajustado">con tus comidas</span>
            {compuesto.provisional ? (
              <span className="dieta-origen dieta-origen-provisional">provisional</span>
            ) : null}
          </span>
        </h2>
        <p className="seccion-descripcion">{DESCRIPCION_MODO[compuesto.modo]}</p>
        {dieta.fecha !== '' ? (
          <p className="dieta-fecha">Nos lo contaste el {fechaLarga(dieta.fecha)}.</p>
        ) : null}
      </header>

      <ListaChips
        titulo="Lo que hemos tenido en cuenta"
        textos={compuesto.aplicado}
        clase="dieta-chip"
      />
      <ListaChips
        titulo="Apuntado, pero aún no lo aplicamos"
        textos={compuesto.apuntado}
        clase="dieta-chip dieta-chip-apuntado"
      />

      <ol className="lista-menu">
        {compuesto.comidas.map((comida, i) => (
          <ComidaDelDia
            key={`${comida.nombre}-${i}`}
            comida={comida}
            modo={compuesto.modo}
            onGuardar={(visible, cambios, aviso) =>
              guardarFila(comida.nombre, visible, cambios, aviso)
            }
            onQuitar={(visible, nombre) => quitarFila(comida.nombre, visible, nombre)}
            onExcluirAlimento={
              onExcluirAlimento
                ? (id, nombre) => {
                    const corto = nombreCorto(id) ?? nombre
                    onExcluirAlimento(id)
                    setEfimero({
                      texto: `Fuera ${corto}. Hemos rehecho el menú y la compra.`,
                      deshacer: () => onDeshacerExclusion?.(id),
                    })
                  }
                : undefined
            }
          />
        ))}
      </ol>

      <p className="dieta-total cifra">
        Total: {entero(t.kcal)} kcal
        <Desvio valor={t.kcal} objetivo={objetivo.kcal} unidad="kcal" macro="calorías" /> ·{' '}
        {entero(t.prot)} g de proteína
        <Desvio valor={t.prot} objetivo={objetivo.prot} unidad="g" macro="proteína" /> ·{' '}
        {entero(t.fat)} g de grasa
        <Desvio valor={t.fat} objetivo={objetivo.fat} unidad="g" macro="grasa" /> · {entero(t.carb)}{' '}
        g de hidratos
        <Desvio valor={t.carb} objetivo={objetivo.carb} unidad="g" macro="hidratos" /> ·{' '}
        {entero(t.fibra)} g de fibra
      </p>
      <p className="dieta-total-plan">
        Tu plan pedía: {entero(objetivo.kcal)} kcal · {entero(objetivo.prot)} g de proteína ·{' '}
        {entero(objetivo.fat)} g de grasa · {entero(objetivo.carb)} g de hidratos
      </p>

      {avisos.length > 0 ? (
        <div className="dieta-avisos">
          {visibles.map((aviso) => (
            <p className="nota nota-recuadro" key={aviso.codigo}>
              {aviso.texto}
            </p>
          ))}
          {ocultos > 0 ? (
            <button
              type="button"
              className="btn-plano"
              aria-expanded={verAvisos}
              onClick={() => setVerAvisos(true)}
            >
              Ver {num(ocultos)} {ocultos === 1 ? 'aviso más' : 'avisos más'}
            </button>
          ) : null}
        </div>
      ) : null}

      {compuesto.no_entendido.map((suelto, i) => (
        <p className="dieta-no-entendido" key={`${suelto.texto}-${i}`}>
          No hemos entendido: «{suelto.texto}»{suelto.sugerencia ? ` (${suelto.sugerencia})` : ''}.
          Edita el texto y vuelve a intentarlo.
        </p>
      ))}

      {compuesto.notas.map((nota) => (
        <p className="nota" key={nota}>
          {nota}
        </p>
      ))}

      <p className="nota">{NOTA_FIJA}</p>

      {estado !== '' ? (
        <p className="nota" role="status">
          {estado}
        </p>
      ) : null}

      {efimero ? (
        <p className="aviso-efimero aviso-flotante" role="status">
          {efimero.texto}
          <button
            type="button"
            className="btn-plano"
            ref={deshacer}
            onClick={() => {
              efimero.deshacer()
              setEfimero(null)
            }}
          >
            Deshacer
          </button>
        </p>
      ) : null}

      {apertura.estado === 'abierto' ? (
        <FormularioDieta
          comidasPlan={comidasPlan}
          token={apertura.token}
          textoInicial={dieta.texto}
          onValidada={(texto, interpretada) => {
            onFormulario?.(false)
            apertura.cerrar()
            onValidada(texto, interpretada)
          }}
          onCancelar={() => {
            onFormulario?.(false)
            apertura.cerrar()
            window.setTimeout(() => editar.current?.focus(), 0)
          }}
          onNoDisponible={() => {
            onFormulario?.(false)
            apertura.noDisponible()
          }}
          ventana={ventana}
        />
      ) : (
        <div className="acciones-menu">
          {hayHuecos && onOtroEjemplo ? (
            <button type="button" className="btn btn-secundario" onClick={onOtroEjemplo}>
              Ver otro ejemplo
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-secundario"
            ref={editar}
            aria-busy={apertura.estado === 'pidiendo'}
            disabled={apertura.estado === 'pidiendo'}
            onClick={() => {
              onFormulario?.(true)
              apertura.abrir()
            }}
          >
            Editar lo que conté
          </button>
          {onVerPropuesto ? (
            <button type="button" className="btn-plano" onClick={onVerPropuesto}>
              Ver el menú propuesto
            </button>
          ) : null}
        </div>
      )}

      {apertura.estado === 'no_disponible' ? (
        <p className="nota nota-recuadro" role="status">
          {ERROR_NO_DISPONIBLE}
        </p>
      ) : null}

      <ResumenAlimentos inputs={inputs} ejemplos={ejemplos} onCambiar={onCambiarAlimentos} />
    </section>
  )
}

/** "Lo que hemos tenido en cuenta" y "Apuntado…": chips, plegables si pasan de cuatro (§5.4). */
function ListaChips({
  titulo,
  textos,
  clase,
}: {
  titulo: string
  textos: string[]
  clase: string
}) {
  if (textos.length === 0) return null
  const lista = (
    <ul className="dieta-chips">
      {textos.map((texto) => (
        <li className={clase} key={texto}>
          {texto}
        </li>
      ))}
    </ul>
  )
  if (textos.length > 4) {
    return <Plegable titulo={`${titulo} (${num(textos.length)})`}>{lista}</Plegable>
  }
  return (
    <div className="dieta-aplicado">
      <h3 className="dieta-subtitulo">{titulo}</h3>
      {lista}
    </div>
  )
}
