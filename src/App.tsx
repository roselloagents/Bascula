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
  guardarDieta,
  retirarGustos,
  sumarGustos,
  VERSION_DIETA,
  type DietaGuardada,
} from './dieta/almacen'
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

  const irAResultados = (inputs: InputCalculo) => {
    setFase({ nombre: 'calculando' })
    setVariante(0)
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

          const { generarEjemplos, componerDia, compraDeDia } = await menus
          const ejemplos = generarEjemplos(inputs, ajustado)
          const avisos = textosAvisos(ajustado, inputs)
          // v1.3 (§5.5): lo que la persona contó vive en este móvil y no depende de `firmaPlan`;
          // con otro plan simplemente se vuelve a componer, porque `componerDia` es puro.
          const dieta = cargarDieta()
          const compone = dieta !== null && dieta.activa && ofreceDietaPropia(inputs, ejemplos)
          const compuesto = compone ? componerDia(dieta.interpretada, inputs, ajustado, 0) : null
          const compraDieta = compuesto
            ? compraDeDia(compuesto, ejemplos.compra?.opcional_ciclo)
            : null
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
  ) => {
    void import('./meals').then(({ generarEjemplos, componerDia, compraDeDia }) => {
      const ejemplos = generarEjemplos(inputs, resultado, v)
      const compone = dieta !== null && dieta.activa && ofreceDietaPropia(inputs, ejemplos)
      const compuesto = compone ? componerDia(dieta.interpretada, inputs, resultado, v) : null
      const compraDieta = compuesto ? compraDeDia(compuesto, ejemplos.compra?.opcional_ciclo) : null
      setFase((previa) =>
        previa.nombre === 'resultados'
          ? { ...previa, ...extra, inputs, resultado, ejemplos, dieta, compuesto, compraDieta }
          : previa,
      )
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
    rehacer(fase.inputs, fase.resultado, fase.dieta, siguiente)
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
    // "Empezar de cero" se lleva también lo que la persona nos contó y su borrador (§5.5).
    borrarDieta()
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
