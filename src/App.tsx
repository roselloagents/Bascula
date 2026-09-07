// Báscula — orquestación de las tres fases: cuestionario, cálculo y resultados.
// La interfaz no implementa ninguna fórmula: consume `calcular`, `textosAvisos`,
// `textoError` (motor) y `generarEjemplos` (menús).

import { useEffect, useRef, useState } from 'react'
import { calcular, textoError, textosAvisos } from './engine'
import type {
  AvisoTexto,
  CodigoExclusion,
  Ejemplos,
  InputCalculo,
  Resultado,
} from './engine/types'
import { generarEjemplos } from './meals'
import { PantallaExcluido } from './components/PantallaExcluido'
import { Resultados } from './components/resultados/Resultados'
import { Wizard } from './components/wizard/Wizard'
import {
  borradorInicial,
  borrarBorrador,
  cargarBorrador,
  guardarBorrador,
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
  const [pasoInicial, setPasoInicial] = useState<PasoId>('sexo')
  const temporizador = useRef<number | undefined>(undefined)

  useEffect(() => {
    guardarBorrador(borrador)
  }, [borrador])

  useEffect(() => () => window.clearTimeout(temporizador.current), [])

  const irAResultados = (inputs: InputCalculo) => {
    setFase({ nombre: 'calculando' })
    // Transición corta: el cálculo es instantáneo, pero un salto seco desorienta.
    temporizador.current = window.setTimeout(() => {
      try {
        const resultado = calcular(inputs)
        if (resultado.excluido) {
          setFase({
            nombre: 'excluido',
            codigo: resultado.excluido,
            aviso: textoError(resultado.excluido, inputs),
            errores: resultado.errores,
          })
          return
        }
        const ejemplos = generarEjemplos(inputs, resultado)
        const avisos = textosAvisos(resultado, inputs)
        setFase({ nombre: 'resultados', inputs, resultado, ejemplos, avisos })
      } catch {
        setFase({
          nombre: 'excluido',
          codigo: 'ERR_INPUT_RANGO',
          aviso: textoError('ERR_INPUT_RANGO', inputs),
        })
      }
    }, 700)
  }

  const excluirDesdeWizard = (codigo: CodigoExclusion) => {
    setFase({ nombre: 'excluido', codigo, aviso: textoError(codigo) })
  }

  const reiniciar = () => {
    borrarBorrador()
    setBorrador(borradorInicial())
    setPasoInicial('sexo')
    setFase({ nombre: 'wizard' })
    window.scrollTo(0, 0)
  }

  const volverAlWizard = (campos?: string[]) => {
    const primero = campos?.map(pasoDeCampo).find((paso) => paso !== null)
    setPasoInicial(primero ?? 'sexo')
    setFase({ nombre: 'wizard' })
    window.scrollTo(0, 0)
  }

  return (
    <div className="app">
      <header className="marca">
        <Logotipo tam={30} />
        <div>
          <p className="marca-nombre">{MARCA}</p>
          <p className="marca-claim">{CLAIM}</p>
        </div>
      </header>

      <main className="contenido">
        {fase.nombre === 'wizard' ? (
          <Wizard
            borrador={borrador}
            onCambio={setBorrador}
            onTerminar={irAResultados}
            onExclusion={excluirDesdeWizard}
            onReiniciar={reiniciar}
            pasoInicial={pasoInicial}
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
