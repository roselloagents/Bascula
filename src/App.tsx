// Báscula — orquestación de las tres fases: cuestionario, cálculo y resultados.
// La interfaz no implementa ninguna fórmula: consume `calcular`, `textosAvisos`,
// `textoError` (motor) y `generarEjemplos` (menús, cargado en diferido).

import { useCallback, useEffect, useRef, useState } from 'react'
import { calcular, textoError, textosAvisos } from './engine'
import type {
  AjusteMacros,
  AvisoTexto,
  CodigoExclusion,
  Ejemplos,
  InputCalculo,
  Pesaje,
  Resultado,
} from './engine/types'
import { PantallaExcluido } from './components/PantallaExcluido'
import { Resultados } from './components/resultados/Resultados'
import { Wizard } from './components/wizard/Wizard'
import {
  borradorInicial,
  borrarBorrador,
  borrarSesion,
  cargarBorrador,
  cargarSesion,
  guardarBorrador,
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
import { Logotipo } from './components/ui/Iconos'
import { CLAIM, MARCA, PIE } from './components/utiles/copy'

type Fase =
  | { nombre: 'wizard' }
  | { nombre: 'calculando' }
  | {
      nombre: 'resultados'
      inputs: InputCalculo
      /** Plan recomendado por el motor, tal cual: los límites del ajuste salen de aquí. */
      base: Resultado
      /** Plan que se muestra: el recomendado, o el que devuelve `ajustarMacros` (§2.2b). */
      resultado: Resultado
      ejemplos: Ejemplos
      avisos: AvisoTexto[]
      ajuste: AjusteMacros | null
    }
  | { nombre: 'excluido'; codigo: CodigoExclusion; aviso: AvisoTexto; errores?: string[] }

export default function App() {
  const [borrador, setBorrador] = useState<Borrador>(() => cargarBorrador())
  const [fase, setFase] = useState<Fase>({ nombre: 'wizard' })
  const sesionInicial = useRef(cargarSesion())
  // Al recargar, se vuelve al paso donde estaba el usuario. Si ya tenía plan, al último paso:
  // el plan no se persiste, así que desde ahí se recupera con una sola pulsación.
  const [pasoInicial, setPasoInicial] = useState<PasoId>(
    sesionInicial.current.planGenerado ? 'preferencias' : (sesionInicial.current.paso ?? 'sexo'),
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
  const guardarPaso = useCallback((paso: PasoId) => guardarSesion({ paso, planGenerado: false }), [])

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

          const { generarEjemplos } = await menus
          const ejemplos = generarEjemplos(inputs, ajustado)
          const avisos = textosAvisos(ajustado, inputs)
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
   * Panel "Ajusta tus macros" (§2.2b): el motor rehace el plan y aquí se rehace todo lo que
   * depende de él —reparto, menú, lista de la compra, cronograma, proyección y PDF—.
   */
  const cambiarAjuste = (ajuste: AjusteMacros | null) => {
    if (fase.nombre !== 'resultados') return
    const { inputs, base } = fase
    const ajustado = aplicarAjuste(base, ajuste)
    guardarAjuste(ajuste)
    const avisos = textosAvisos(ajustado, inputs)
    void import('./meals').then(({ generarEjemplos }) => {
      setFase((previa) =>
        previa.nombre === 'resultados'
          ? {
              ...previa,
              resultado: ajustado,
              ejemplos: generarEjemplos(inputs, ajustado, variante),
              avisos,
              ajuste,
            }
          : previa,
      )
    })
  }

  /** "Ver otro ejemplo" (§2.5): otra plantilla del mismo banco, sin volver a llamar al motor. */
  const otroEjemplo = () => {
    if (fase.nombre !== 'resultados') return
    const siguiente = variante + 1
    setVariante(siguiente)
    const { inputs, resultado } = fase
    void import('./meals').then(({ generarEjemplos }) => {
      setFase((previa) =>
        previa.nombre === 'resultados'
          ? { ...previa, ejemplos: generarEjemplos(inputs, resultado, siguiente) }
          : previa,
      )
    })
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
            ejemplos={fase.ejemplos}
            avisos={fase.avisos}
            ajuste={fase.ajuste}
            pesajes={pesajes}
            onAjustar={cambiarAjuste}
            onPesajes={cambiarPesajes}
            onEditar={() => volverAlWizard()}
            onOtroEjemplo={otroEjemplo}
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
