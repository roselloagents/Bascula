// Báscula — orquestación de las tres fases: cuestionario, cálculo y resultados.
// La interfaz no implementa ninguna fórmula: consume `calcular`, `textosAvisos`,
// `textoError` (motor) y `generarEjemplos` (menús, cargado en diferido).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { calcular, textoError, textosAvisos } from './engine'
import type {
  AjusteMacros,
  AlimentoPropio,
  AvisoTexto,
  CodigoExclusion,
  DiaCompuesto,
  DietaInterpretada,
  Ejemplos,
  InputCalculo,
  ListaCompra,
  Pesaje,
  Resultado,
} from './engine/types'
import { PantallaExcluido } from './components/PantallaExcluido'
import { Resultados } from './components/resultados/Resultados'
import { Wizard } from './components/wizard/Wizard'
import {
  aInputs,
  anclarPlan,
  borradorInicial,
  borrarBorrador,
  borrarSesion,
  cargarBorrador,
  cargarSesion,
  guardarBorrador,
  guardarPasoSesion,
  guardarSesion,
  pasoDeCampo,
  type Borrador,
  type PasoId,
} from './components/wizard/borrador'
import {
  aplicarAjuste,
  borrarAjuste,
  cargarAjuste,
  firmaDeInputs,
  guardarAjuste,
} from './components/resultados/ajuste'
import { cargarPesajes, guardarPesajes } from './components/resultados/seguimiento'
import { ofreceDietaPropia } from './components/resultados/dieta'
import {
  borrarBorradorDieta,
  borrarDieta,
  cargarDieta,
  claveHuecos,
  guardarDieta,
  guardarPropuesta,
  retirarGustos,
  CERRADAS_MAX,
  RESPUESTAS_MAX,
  sumarGustos,
  VARIANTE_MAX,
  VERSION_DIETA,
  type DietaGuardada,
  type PropuestaGuardada,
} from './dieta/almacen'
import {
  capacidades,
  ErrorApi,
  esCancelado,
  mensajeDeErrorPropuesta,
  proponerHuecos,
  sinModelo,
  TEXTO_MAX,
  type Capacidades,
  type HuecoPropuesta,
} from './dieta/api'
import { contextoParaProponer } from './dieta/contexto'
import { Logotipo } from './components/ui/Iconos'
import { CLAIM, MARCA, PIE } from './components/utiles/copy'
import { hoyIso } from './components/utiles/formato'

interface FaseResultados {
  nombre: 'resultados'
  inputs: InputCalculo
  /** Plan recomendado por el motor, tal cual: los límites del ajuste salen de aquí. */
  base: Resultado
  /** Plan que se muestra: el recomendado, o el que devuelve `ajustarMacros` (§2.2b). */
  resultado: Resultado
  ejemplos: Ejemplos
  avisos: AvisoTexto[]
  ajuste: AjusteMacros | null
  /** v1.3: lo que la persona nos contó, activo o no (SPEC-dieta-propia §5.5). */
  dieta: DietaGuardada | null
  /** El día compuesto, solo mientras la composición está activa. */
  compuesto: DiaCompuesto | null
  /** La compra de ese día: sustituye a `ejemplos.compra` en pantalla y en el PDF (§5.5). */
  compraDieta: ListaCompra | null
}

type Fase =
  | { nombre: 'wizard' }
  | { nombre: 'calculando' }
  | FaseResultados
  | { nombre: 'excluido'; codigo: CodigoExclusion; aviso: AvisoTexto; errores?: string[] }

/** El módulo diferido de menús, para tipar los helpers que lo reciben ya cargado. */
type ModuloMenus = typeof import('./meals')

/** Cuánto vale lo que sabemos de `/api/capacidades` antes de volver a preguntarlo (§2.2). */
const MS_CAPACIDADES = 5 * 60 * 1000
/** Cuánto esperan las peticiones automáticas después de que la IA falle por red o por 5xx. */
const MS_REPOSO_IA = 60 * 1000

/** El día compuesto más lo que hace falta para decidir si se pide una propuesta (§4bis.4). */
interface DiaConPropuesta {
  compuesto: DiaCompuesto
  /** Los huecos que montaría la IA; vacío en modo `completa`. */
  huecos: HuecoPropuesta[]
  /** `claveHuecos` de esos huecos: es lo que decide si la propuesta guardada sigue valiendo. */
  clave: string
  /** La propuesta guardada vale para estos huecos y es la que se está pintando. */
  vale: boolean
}

/**
 * Compone el día reutilizando la propuesta guardada **solo si su clave de huecos sigue siendo la
 * de ahora** (§4bis.4); si no, el día sale con plantillas y quien llama pide otra propuesta.
 *
 * Se compone una sola vez en el caso normal: un día montado con propuesta y el mismo día montado
 * con plantillas tienen exactamente los mismos huecos —nombre, hora y objetivo salen del plan y de
 * lo dictado, no de quién los monte—, así que la clave se puede leer del primer montaje.
 */
function componerConPropuesta(
  menus: ModuloMenus,
  dieta: DietaGuardada,
  inputs: InputCalculo,
  resultado: Resultado,
  v: number,
): DiaConPropuesta {
  const guardada = dieta.propuesta
  const primero = menus.componerDia(dieta.interpretada, inputs, resultado, v, guardada?.propuesta)
  const huecos = menus.huecosParaProponer(primero)
  const clave = claveHuecos(huecos)
  if (guardada === undefined) return { compuesto: primero, huecos, clave, vale: false }
  if (guardada.huecos_clave === clave) return { compuesto: primero, huecos, clave, vale: true }
  // La propuesta guardada era para otro reparto: se enseñan las plantillas mientras llega otra.
  const plantillas = menus.componerDia(dieta.interpretada, inputs, resultado, v)
  return { compuesto: plantillas, huecos, clave, vale: false }
}

/**
 * ¿El fallo deja a la IA fuera de juego (§4bis.5: fallo de red o 5xx) o es solo este intento? Un
 * `429` o un `422` no son "la IA no está disponible": lo dicen sus propios textos de §5.3, y la
 * línea pequeña mentiría al decir que no la hay.
 */
function iaFueraDeJuego(fallo: unknown): boolean {
  if (!(fallo instanceof ErrorApi)) return true
  return fallo.estado === 0 || fallo.estado >= 500
}

/** ¿Algún hueco del día lo ha montado el modelo? (§4bis.3) */
function conHuecosDeIa(compuesto: DiaCompuesto | null): boolean {
  return (
    compuesto !== null && (compuesto.origen_huecos === 'ia' || compuesto.origen_huecos === 'mixto')
  )
}

export default function App() {
  const [borrador, setBorrador] = useState<Borrador>(() => cargarBorrador())
  const [fase, setFase] = useState<Fase>({ nombre: 'wizard' })
  const sesionInicial = useRef(cargarSesion())
  // Al recargar, se vuelve al paso donde estaba el usuario. Si ya tenía plan, al último paso:
  // el plan no se persiste, así que desde ahí se recupera con una sola pulsación.
  const [pasoInicial, setPasoInicial] = useState<PasoId>(
    // Con un plan hecho se aterriza en la ÚLTIMA pregunta, que desde la v1.2 es la de alimentos:
    // desde ahí el botón devuelve el plan guardado con una sola pulsación.
    sesionInicial.current.planGenerado ? 'alimentos' : (sesionInicial.current.paso ?? 'sexo'),
  )
  // Seguimiento local (§2.6c): solo en este dispositivo, nunca sale del navegador.
  const [pesajes, setPesajes] = useState<Pesaje[]>(() => cargarPesajes())
  const [camposMarcados, setCamposMarcados] = useState<string[]>([])
  const [variante, setVariante] = useState(0)
  // Clave del wizard: cambia en cada "Empezar de cero" para volver a montarlo desde la primera pregunta.
  const [generacion, setGeneracion] = useState(0)
  const temporizador = useRef<number | undefined>(undefined)

  // ---- decisión L (§4bis): la propuesta de la IA ----
  /** Hay una petición de propuesta viajando: el bloque lo dice y entra en `aria-busy` (§4bis.4). */
  const [iaPidiendo, setIaPidiendo] = useState(false)
  /** El texto de §5.3 cuando la petición falla; lo que había en pantalla no se toca. */
  const [iaError, setIaError] = useState('')
  /** En esta sesión hubo propuesta de IA y ahora no la hay: línea pequeña de §4bis.5. */
  const [sinIa, setSinIa] = useState(false)
  /** Si en esta sesión se ha llegado a pintar algún hueco montado por el modelo. */
  const huboPropuesta = useRef(false)
  /** Como mucho UNA propuesta en vuelo: la nueva cancela la anterior (§4bis.4). */
  const enVuelo = useRef<AbortController | null>(null)
  /** `/api/capacidades` se pide una vez por sesión (y se refresca cada 5 min por el token). */
  const capacidadesIa = useRef<{ momento: number; promesa: Promise<Capacidades> } | null>(null)
  /** Cuándo se cayó la IA, para no volver a intentarlo sola cada vez que cambia el plan. */
  const iaFuera = useRef(0)

  useEffect(() => {
    guardarBorrador(borrador)
  }, [borrador])

  useEffect(() => () => window.clearTimeout(temporizador.current), [])

  // Estable a propósito: el `useEffect` del wizard que mueve el foco y el scroll depende de esta
  // función, y una identidad nueva por render la dispararía en cada pulsación de tecla.
  const guardarPaso = useCallback((paso: PasoId) => guardarPasoSesion(paso), [])

  // Al recargar con un plan hecho se aterriza en la última pregunta, y sin decir nada eso se lee
  // como "he perdido mi plan". Sigue guardado en este móvil: si las respuestas son exactamente las
  // que lo calcularon, el último paso lo dice y el botón devuelve el plan tal cual, con su ajuste
  // manual y sus pesajes. Con cualquier respuesta cambiada el plan se rehace, y entonces no se
  // promete nada.
  const planGuardado = useMemo(() => {
    const firma = sesionInicial.current.firmaPlan
    if (firma === undefined) return false
    try {
      return firma === firmaDeInputs(aInputs(anclarPlan(borrador)))
    } catch {
      return false
    }
  }, [borrador])

  // El motor marca los campos de `ERR_INPUT_RANGO`; la marca se retira en cuanto el usuario edita.
  const cambiarBorrador = useCallback((actualizar: (previo: Borrador) => Borrador) => {
    setBorrador(actualizar)
    setCamposMarcados((previos) => (previos.length > 0 ? [] : previos))
  }, [])

  const cambiarPesajes = (nuevos: Pesaje[]) => {
    setPesajes(nuevos)
    guardarPesajes(nuevos)
  }

  // ---- v1.3, decisión L: pedir, guardar y aplicar la propuesta de la IA (§4bis.4) ----

  /** Corta la propuesta que estuviera viajando: cualquier cambio de plan la deja obsoleta. */
  const cancelarPropuesta = () => {
    enVuelo.current?.abort()
    enVuelo.current = null
    setIaPidiendo(false)
  }

  /**
   * `/api/capacidades` (§2.2). Se pide perezosamente —solo cuando hay un hueco que proponer— y se
   * reutiliza cinco minutos: el token efímero vale diez, y un `401` lo renueva solo (§2.3).
   */
  const pedirCapacidades = (): Promise<Capacidades> => {
    const ahora = Date.now()
    const previas = capacidadesIa.current
    if (previas !== null && ahora - previas.momento < MS_CAPACIDADES) return previas.promesa
    const promesa = capacidades()
    capacidadesIa.current = { momento: ahora, promesa }
    return promesa
  }

  /** Escribe en la fase el día compuesto (o su ausencia) y la compra que le corresponde (§5.5). */
  const aplicarDia = (
    menus: ModuloMenus,
    inputs: InputCalculo,
    resultado: Resultado,
    dieta: DietaGuardada | null,
    ejemplos: Ejemplos,
    compuesto: DiaCompuesto | null,
    extra: Partial<FaseResultados> = {},
  ) => {
    const compraDieta =
      compuesto !== null ? menus.compraDeDia(compuesto, ejemplos.compra?.opcional_ciclo) : null
    setFase((previa) =>
      previa.nombre === 'resultados'
        ? { ...previa, ...extra, inputs, resultado, ejemplos, dieta, compuesto, compraDieta }
        : previa,
    )
  }

  /**
   * Una llamada a `POST /api/dieta/proponer` (§4bis.4). Mientras viaja se sigue viendo lo que
   * había —la propuesta anterior o las plantillas— con `aria-busy`; al llegar, el día se vuelve a
   * componer con ella y se guarda con su clave de huecos. Un error no borra nada: enseña el texto
   * de §5.3 y deja la pantalla como estaba.
   *
   * `forzado` son las dos peticiones que pide la persona a propósito ("Otra propuesta" y responder
   * a una pregunta): esas se intentan siempre. Las automáticas descansan un minuto después de que
   * la IA se caiga, para no dejar el bloque esperando en cada corrección de fila mientras el
   * servicio no responde.
   */
  const pedirPropuesta = (
    menus: ModuloMenus,
    inputs: InputCalculo,
    resultado: Resultado,
    dieta: DietaGuardada,
    v: number,
    dia: DiaConPropuesta,
    ejemplos: Ejemplos,
    forzado = false,
  ) => {
    if (dia.huecos.length === 0) return
    if (!forzado && iaFuera.current > 0 && Date.now() - iaFuera.current < MS_REPOSO_IA) return
    cancelarPropuesta()
    const control = new AbortController()
    enVuelo.current = control
    setIaPidiendo(true)
    setIaError('')
    void (async () => {
      try {
        const caps = await pedirCapacidades()
        if (control.signal.aborted) return
        if (!caps.interpretar) {
          // Sin IA todo sigue funcionando con plantillas (§4bis.5); solo se dice si antes la hubo.
          iaFuera.current = Date.now()
          setSinIa(huboPropuesta.current)
          return
        }
        const contexto = contextoParaProponer(dieta, inputs, dia.compuesto, v)
        const respuesta = await proponerHuecos(dia.huecos, contexto, caps.token, control.signal)
        if (control.signal.aborted) return
        const propuesta = sinModelo(respuesta)
        const guardada: PropuestaGuardada = {
          variante: Math.min(Math.max(v, 0), VARIANTE_MAX),
          huecos_clave: dia.clave,
          propuesta,
          respuestas: dieta.propuesta?.respuestas ?? [],
        }
        const conPropuesta = guardarPropuesta(guardada, dieta) ?? { ...dieta, propuesta: guardada }
        const compuesto = menus.componerDia(dieta.interpretada, inputs, resultado, v, propuesta)
        if (conHuecosDeIa(compuesto)) huboPropuesta.current = true
        iaFuera.current = 0
        setSinIa(false)
        setIaError('')
        aplicarDia(menus, inputs, resultado, conPropuesta, ejemplos, compuesto)
      } catch (fallo) {
        if (esCancelado(fallo)) return
        // Los textos de §5.3 son los de LEER el dictado: aquí mienten (§4bis.5).
        setIaError(mensajeDeErrorPropuesta(fallo))
        if (iaFueraDeJuego(fallo)) {
          iaFuera.current = Date.now()
          setSinIa(huboPropuesta.current)
        }
      } finally {
        if (enVuelo.current === control) {
          enVuelo.current = null
          setIaPidiendo(false)
        }
      }
    })()
  }

  const irAResultados = (inputs: InputCalculo) => {
    setFase({ nombre: 'calculando' })
    setVariante(0)
    cancelarPropuesta()
    setIaError('')
    // Transición corta: el cálculo es instantáneo, pero un salto seco desorienta. El módulo de
    // menús (y su base de alimentos) se descarga aquí, no en el arranque: solo hace falta ahora.
    const menus = import('./meals')
    temporizador.current = window.setTimeout(() => {
      void (async () => {
        try {
          const resultado = calcular(inputs)
          if (resultado.excluido) {
            setCamposMarcados(resultado.errores ?? [])
            setFase({
              nombre: 'excluido',
              codigo: resultado.excluido,
              aviso: textoError(resultado.excluido, inputs),
              errores: resultado.errores,
            })
            return
          }
          // El ajuste manual guardado solo vale si el plan se calculó con los mismos datos
          // (§2.2b): si el usuario editó algo, los límites del plan nuevo son otros.
          const firma = firmaDeInputs(inputs)
          const ajuste = firma === cargarSesion().firmaPlan ? cargarAjuste() : null
          if (!ajuste) borrarAjuste()
          const ajustado = aplicarAjuste(resultado, ajuste)

          const modulo = await menus
          const ejemplos = modulo.generarEjemplos(inputs, ajustado)
          const avisos = textosAvisos(ajustado, inputs)
          // v1.3 (§5.5): lo que la persona contó vive en este móvil y no depende de `firmaPlan`;
          // con otro plan simplemente se vuelve a componer, porque `componerDia` es puro.
          const dieta = cargarDieta()
          const compone = dieta !== null && dieta.activa && ofreceDietaPropia(inputs, ejemplos)
          // §4bis.4: con la composición activa se reutiliza la propuesta guardada si su clave de
          // huecos sigue valiendo; si no, se enseñan las plantillas y se pide otra.
          const dia =
            compone && dieta !== null
              ? componerConPropuesta(modulo, dieta, inputs, ajustado, 0)
              : null
          const compuesto = dia?.compuesto ?? null
          const compraDieta = compuesto
            ? modulo.compraDeDia(compuesto, ejemplos.compra?.opcional_ciclo)
            : null
          if (conHuecosDeIa(compuesto)) huboPropuesta.current = true
          setCamposMarcados([])
          guardarSesion({ paso: null, planGenerado: true, firmaPlan: firma })
          setFase({
            nombre: 'resultados',
            inputs,
            base: resultado,
            resultado: ajustado,
            ejemplos,
            avisos,
            ajuste,
            dieta,
            compuesto,
            compraDieta,
          })
          if (dia !== null && dieta !== null && !dia.vale) {
            pedirPropuesta(modulo, inputs, ajustado, dieta, 0, dia, ejemplos)
          }
        } catch {
          setFase({
            nombre: 'excluido',
            codigo: 'ERR_INPUT_RANGO',
            aviso: textoError('ERR_INPUT_RANGO', inputs),
          })
        }
      })()
    }, 700)
  }

  /**
   * Rehace todo lo que cuelga del plan: menú, equivalencias, compra y —si la composición de §5.4
   * está activa— el día compuesto y su lista de la compra. Es el único sitio donde se llama a
   * `componerDia`: nunca en el render de un hijo (§5.5). El módulo de menús sigue siendo diferido.
   */
  const rehacer = (
    inputs: InputCalculo,
    resultado: Resultado,
    dieta: DietaGuardada | null,
    v: number,
    extra: Partial<FaseResultados> = {},
    /** "Otra propuesta" y responder a una pregunta piden aunque la guardada siga valiendo. */
    pedirSiempre = false,
  ) => {
    // Lo que viniera de camino era para el plan de antes (§4bis.4): se corta aquí, no al llegar.
    cancelarPropuesta()
    setIaError('')
    void import('./meals').then((menus) => {
      const ejemplos = menus.generarEjemplos(inputs, resultado, v)
      const compone = dieta !== null && dieta.activa && ofreceDietaPropia(inputs, ejemplos)
      if (!compone || dieta === null) {
        aplicarDia(menus, inputs, resultado, dieta, ejemplos, null, extra)
        return
      }
      const dia = componerConPropuesta(menus, dieta, inputs, resultado, v)
      if (conHuecosDeIa(dia.compuesto)) huboPropuesta.current = true
      aplicarDia(menus, inputs, resultado, dieta, ejemplos, dia.compuesto, extra)
      if (pedirSiempre || !dia.vale) {
        pedirPropuesta(menus, inputs, resultado, dieta, v, dia, ejemplos, pedirSiempre)
      }
    })
  }

  /**
   * Panel "Ajusta tus macros" (§2.2b): el motor rehace el plan y aquí se rehace todo lo que
   * depende de él —reparto, menú, lista de la compra, cronograma, proyección y PDF—.
   */
  const cambiarAjuste = (ajuste: AjusteMacros | null) => {
    if (fase.nombre !== 'resultados') return
    const { inputs, base, dieta } = fase
    const ajustado = aplicarAjuste(base, ajuste)
    guardarAjuste(ajuste)
    const avisos = textosAvisos(ajustado, inputs)
    rehacer(inputs, ajustado, dieta, variante, { avisos, ajuste })
  }

  /**
   * "No me gusta" por alimento (§2.5, v1.2) y su "Deshacer". Cambia las dos listas del borrador y
   * rehace el menú, las equivalencias, la compra y los datos del PDF **sin volver a llamar al
   * motor**: `calcular` ignora estas listas, así que ni las calorías ni los macros ni la
   * proyección pueden moverse, y la huella del plan (`firmaDeInputs`) tampoco cambia, de modo que
   * el ajuste manual guardado y los pesajes siguen en pie.
   */
  const cambiarAlimentos = (excluidos: string[]) => {
    if (fase.nombre !== 'resultados') return
    setBorrador((previo) => ({
      ...previo,
      alimentos_excluidos: excluidos,
      alimentos_favoritos: previo.alimentos_favoritos.filter((id) => !excluidos.includes(id)),
    }))
    const inputs: InputCalculo = {
      ...fase.inputs,
      alimentos_excluidos: excluidos,
      alimentos_favoritos: (fase.inputs.alimentos_favoritos ?? []).filter(
        (id) => !excluidos.includes(id),
      ),
    }
    rehacer(inputs, fase.resultado, fase.dieta, variante)
  }

  const excluirAlimento = (id: string) => {
    if (fase.nombre !== 'resultados') return
    const previos = fase.inputs.alimentos_excluidos ?? []
    if (previos.includes(id)) return
    cambiarAlimentos([...previos, id].sort())
  }

  const deshacerExclusion = (id: string) => {
    if (fase.nombre !== 'resultados') return
    cambiarAlimentos((fase.inputs.alimentos_excluidos ?? []).filter((x) => x !== id))
  }

  /**
   * "Ver otro ejemplo" (§2.5): otra plantilla del mismo banco, sin volver a llamar al motor. Con
   * la composición activa (§5.4) cambia solo lo montado: lo dictado es determinista y no se mueve.
   */
  const otroEjemplo = () => {
    if (fase.nombre !== 'resultados') return
    const siguiente = variante + 1
    setVariante(siguiente)
    // §4bis.3: cuando los huecos los monta la IA el botón dice "Otra propuesta" y es una llamada
    // nueva con `variante + 1`; mientras llega se sigue viendo la propuesta anterior.
    const conIa = fase.compuesto?.comidas.some((c) => c.origen === 'propuesta_ia') === true
    rehacer(fase.inputs, fase.resultado, fase.dieta, siguiente, {}, conIa)
  }

  // ---- v1.3: "Cuéntanos cómo comes" (SPEC-dieta-propia §5.5) ----

  /**
   * Una interpretación nueva: se guarda, sus gustos se suman a las listas del paso 14 (retirando
   * los del audio anterior) y el día se compone. `firmaDeInputs` no cambia: las listas de
   * alimentos están fuera de la huella, así que el plan, el ajuste manual y los pesajes siguen.
   */
  const interpretacionNueva = (texto: string, interpretada: DietaInterpretada) => {
    if (fase.nombre !== 'resultados') return
    const listas = sumarGustos(
      fase.inputs.alimentos_excluidos ?? [],
      fase.inputs.alimentos_favoritos ?? [],
      fase.dieta?.gustos_sumados ?? null,
      interpretada,
    )
    const dieta: DietaGuardada = {
      version: VERSION_DIETA,
      texto,
      interpretada,
      fecha: hoyIso(),
      activa: true,
      gustos_sumados: listas.gustos_sumados,
    }
    guardarDieta(dieta)
    // El borrador ya no hace falta: el texto vive en la dieta guardada y "Editar lo que conté"
    // lo devuelve al cuadro.
    borrarBorradorDieta()
    setBorrador((previo) => ({
      ...previo,
      alimentos_excluidos: listas.excluidos,
      alimentos_favoritos: listas.favoritos,
    }))
    const inputs: InputCalculo = {
      ...fase.inputs,
      alimentos_excluidos: listas.excluidos,
      alimentos_favoritos: listas.favoritos,
    }
    rehacer(inputs, fase.resultado, dieta, variante)
  }

  /** Correcciones de §5.4: cambian la `DietaInterpretada` guardada y recomponen, sin API. */
  const corregirDieta = (comida: number, alimento: number, cambios: Partial<AlimentoPropio>) => {
    if (fase.nombre !== 'resultados' || fase.dieta === null) return
    const previa = fase.dieta
    const comidas = previa.interpretada.comidas.map((c, i) =>
      i !== comida
        ? c
        : {
            ...c,
            alimentos: c.alimentos.map((a, j) => (j !== alimento ? a : { ...a, ...cambios })),
          },
    )
    const dieta: DietaGuardada = {
      ...previa,
      interpretada: { ...previa.interpretada, comidas },
    }
    guardarDieta(dieta)
    rehacer(fase.inputs, fase.resultado, dieta, variante)
  }

  /**
   * Responder a una pregunta del modelo (§4bis.5): la respuesta se guarda, se añade al texto
   * contado como línea nueva —es contexto para la próxima propuesta, igual que lo dictado— y se
   * vuelve a pedir la propuesta con la **misma** variante.
   */
  const responderPregunta = (pregunta: string, respuesta: string) => {
    if (fase.nombre !== 'resultados' || fase.dieta === null) return
    const previa = fase.dieta
    const anteriores = previa.propuesta?.respuestas ?? []
    const respuestas = [
      ...anteriores.filter((r) => r.pregunta !== pregunta),
      { pregunta, respuesta },
    ].slice(-RESPUESTAS_MAX)
    const linea = `${pregunta}: ${respuesta}`
    // Se SUSTITUYE la línea de esa pregunta en vez de añadir otra: `respuestas` ya se deduplica, y
    // sin esto el texto guardado —el que vuelve a "Editar lo que conté" y el que se reinterpreta—
    // acababa con la misma pregunta contestada dos veces y con respuestas opuestas.
    const sinEsa = previa.texto
      .split('\n')
      .filter((l) => !l.startsWith(`${pregunta}: `))
      .join('\n')
    const junto = sinEsa === '' ? linea : `${sinEsa}\n${linea}`
    // El texto guardado es el mismo que vuelve a "Editar lo que conté" y el que se reinterpreta:
    // si la línea no cabe en los 4 000 caracteres, no se añade (la respuesta viaja igual).
    const dieta: DietaGuardada = {
      ...previa,
      texto: junto.length <= TEXTO_MAX ? junto : previa.texto,
    }
    if (previa.propuesta !== undefined) {
      dieta.propuesta = { ...previa.propuesta, respuestas }
    }
    guardarDieta(dieta)
    rehacer(fase.inputs, fase.resultado, dieta, variante, {}, true)
  }

  /**
   * "Seguir así" (§4bis.5): la pregunta se cierra PARA SIEMPRE, no solo hasta recargar. Se guarda
   * dentro de la propuesta y no se pide nada nuevo: cerrar una pregunta no cuesta una llamada.
   */
  const cerrarPreguntas = (textos: readonly string[]) => {
    if (fase.nombre !== 'resultados' || fase.dieta === null) return
    const previa = fase.dieta
    if (previa.propuesta === undefined || textos.length === 0) return
    const cerradas = [...new Set([...(previa.propuesta.cerradas ?? []), ...textos])].slice(
      -CERRADAS_MAX,
    )
    const dieta: DietaGuardada = {
      ...previa,
      propuesta: { ...previa.propuesta, cerradas },
    }
    guardarDieta(dieta)
    setFase({ ...fase, dieta })
  }

  /** "Ver mi menú con lo mío" y "Ver el menú propuesto": el conmutador de §5.2 y §5.4. */
  const activarDieta = (activa: boolean) => () => {
    if (fase.nombre !== 'resultados' || fase.dieta === null) return
    const dieta: DietaGuardada = { ...fase.dieta, activa }
    guardarDieta(dieta)
    rehacer(fase.inputs, fase.resultado, dieta, variante)
  }

  /** "Borrar lo que conté" (§5.2): también retira de las listas los gustos que sumó el audio. */
  const borrarDietaPropia = () => {
    if (fase.nombre !== 'resultados') return
    const listas = retirarGustos(
      fase.inputs.alimentos_excluidos ?? [],
      fase.inputs.alimentos_favoritos ?? [],
      fase.dieta?.gustos_sumados ?? null,
    )
    borrarDieta()
    setBorrador((previo) => ({
      ...previo,
      alimentos_excluidos: listas.excluidos,
      alimentos_favoritos: listas.favoritos,
    }))
    const inputs: InputCalculo = {
      ...fase.inputs,
      alimentos_excluidos: listas.excluidos,
      alimentos_favoritos: listas.favoritos,
    }
    rehacer(inputs, fase.resultado, null, variante)
  }

  const excluirDesdeWizard = (codigo: CodigoExclusion) => {
    setFase({ nombre: 'excluido', codigo, aviso: textoError(codigo) })
  }

  const reiniciar = () => {
    borrarBorrador()
    borrarSesion()
    // El ajuste pertenece a un plan que ya no existe. Los pesajes NO se borran: son el historial
    // del usuario en este dispositivo y sobreviven a un cuestionario nuevo.
    borrarAjuste()
    // "Empezar de cero" se lleva también lo que la persona nos contó y su borrador (§5.5), y con
    // ellos la propuesta de la IA que colgaba de ahí (§4bis.4).
    borrarDieta()
    cancelarPropuesta()
    setIaError('')
    setSinIa(false)
    huboPropuesta.current = false
    setBorrador(borradorInicial())
    setPasoInicial('sexo')
    setCamposMarcados([])
    setFase({ nombre: 'wizard' })
    // El wizard guarda su paso actual en estado propio y solo lee `pasoInicial` al montarse:
    // cambiar la clave lo vuelve a montar, y así "Empezar de cero" lleva de verdad a la primera
    // pregunta en vez de dejar al usuario en el mismo paso con los campos vacíos.
    setGeneracion((g) => g + 1)
    window.scrollTo(0, 0)
  }

  const volverAlWizard = (campos?: string[]) => {
    const primero = campos?.map(pasoDeCampo).find((paso) => paso !== null)
    // Sin campo que corregir se entra por la primera pregunta; desde ahí el índice "Ir a una
    // pregunta" del wizard permite saltar a cualquier paso sin repetirlas todas.
    setPasoInicial(primero ?? 'sexo')
    setFase({ nombre: 'wizard' })
    window.scrollTo(0, 0)
  }

  /** Enlace "Cambiar" del resumen de alimentos (§2.5): lleva al paso 14 con el borrador cargado. */
  const irAlPasoDeAlimentos = () => {
    setPasoInicial('alimentos')
    setFase({ nombre: 'wizard' })
    window.scrollTo(0, 0)
  }

  return (
    <div className="app">
      <header className="marca">
        <Logotipo tam={30} />
        <div>
          <h1 className="marca-nombre">{MARCA}</h1>
          <p className="marca-claim">{CLAIM}</p>
        </div>
      </header>

      <main className="contenido">
        {fase.nombre === 'wizard' ? (
          <Wizard
            key={generacion}
            borrador={borrador}
            onCambio={cambiarBorrador}
            onTerminar={irAResultados}
            onExclusion={excluirDesdeWizard}
            onReiniciar={reiniciar}
            onPaso={guardarPaso}
            pasoInicial={pasoInicial}
            camposMarcados={camposMarcados}
            planGuardado={planGuardado}
          />
        ) : null}

        {fase.nombre === 'calculando' ? (
          <div className="calculando" role="status" aria-live="polite">
            <div className="calculando-barra" aria-hidden="true" />
            <p>Ajustando tus macros…</p>
          </div>
        ) : null}

        {fase.nombre === 'resultados' ? (
          <Resultados
            inputs={fase.inputs}
            resultado={fase.resultado}
            base={fase.base}
            // §5.5: con la composición activa, la compra que ven la pantalla y el PDF es la del
            // día compuesto. `fase.ejemplos` se queda intacto para poder volver al menú propuesto.
            ejemplos={
              fase.compraDieta ? { ...fase.ejemplos, compra: fase.compraDieta } : fase.ejemplos
            }
            avisos={fase.avisos}
            ajuste={fase.ajuste}
            pesajes={pesajes}
            onAjustar={cambiarAjuste}
            onPesajes={cambiarPesajes}
            onEditar={() => volverAlWizard()}
            onOtroEjemplo={otroEjemplo}
            onExcluirAlimento={excluirAlimento}
            onDeshacerExclusion={deshacerExclusion}
            onCambiarAlimentos={irAlPasoDeAlimentos}
            dieta={fase.dieta}
            compuesto={fase.compuesto}
            onDieta={interpretacionNueva}
            onActivarDieta={activarDieta(true)}
            onVerPropuesto={activarDieta(false)}
            onBorrarDieta={borrarDietaPropia}
            onCorregirDieta={corregirDieta}
            pidiendoIa={iaPidiendo}
            errorIa={iaError}
            sinIa={sinIa}
            onResponderPregunta={responderPregunta}
            onCerrarPreguntas={cerrarPreguntas}
          />
        ) : null}

        {fase.nombre === 'excluido' ? (
          <PantallaExcluido
            codigo={fase.codigo}
            aviso={fase.aviso}
            errores={fase.errores}
            onVolver={reiniciar}
            onCorregir={() => volverAlWizard(fase.errores)}
          />
        ) : null}
      </main>

      <footer className="pie">
        <p>{PIE}</p>
      </footer>
    </div>
  )
}
