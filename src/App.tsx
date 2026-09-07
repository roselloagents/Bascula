// Báscula — orquestación de las tres fases: cuestionario, cálculo y resultados.
// La interfaz no implementa ninguna fórmula: consume `calcular`, `textosAvisos`,
// `textoError` (motor) y `generarEjemplos` (menús, cargado en diferido).

import { useCallback, useEffect, useRef, useState } from 'react'
import { calcular, textoError, textosAvisos } from './engine'
import type {
  AvisoTexto,
  CodigoExclusion,
  Ejemplos,
  InputCalculo,
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
import { Logotipo } from './components/ui/Iconos'
import { CLAIM, MARCA, PIE } from './components/utiles/copy'

type Fase =
  | { nombre: 'wizard' }
  | { nombre: 'calculando' }
  | { nombre: 'resultados'; inputs: InputCalculo; resultado: Resultado; ejemplos: Ejemplos; avisos: AvisoTexto[] }
  | { nombre: 'excluido'; codigo: CodigoExclusion; aviso: AvisoTexto; errores?: string[] }

export default function App() {
  const [borrador, setBorrador] = useState<Borrador>(() => cargarBorrador())
  const [fase, setFase] = useState<Fase>({ nombre: 'wizard' })
  const sesionInicial = useRef(cargarSesion())
  // Al recargar, se vuelve al paso donde estaba el usuario. Si ya tenía plan, se vuelve al
  // cribado del paso 5b, que es lo único que no se persiste (CONTRATO.md).
  const [pasoInicial, setPasoInicial] = useState<PasoId>(
    sesionInicial.current.planGenerado ? 'cribado' : (sesionInicial.current.paso ?? 'sexo'),
  )
  const [camposMarcados, setCamposMarcados] = useState<string[]>([])
  const [variante, setVariante] = useState(0)
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
          const { generarEjemplos } = await menus
          const ejemplos = generarEjemplos(inputs, resultado)
          const avisos = textosAvisos(resultado, inputs)
          setCamposMarcados([])
          guardarSesion({ paso: null, planGenerado: true })
          setFase({ nombre: 'resultados', inputs, resultado, ejemplos, avisos })
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
    setBorrador(borradorInicial())
    setPasoInicial('sexo')
    setCamposMarcados([])
    setFase({ nombre: 'wizard' })
    window.scrollTo(0, 0)
  }

  const volverAlWizard = (campos?: string[]) => {
    const primero = campos?.map(pasoDeCampo).find((paso) => paso !== null)
    setPasoInicial(primero ?? 'cribado')
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
            ejemplos={fase.ejemplos}
            avisos={fase.avisos}
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
