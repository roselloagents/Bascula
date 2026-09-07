// Controles compartidos del cuestionario: tarjetas de opción, campos numéricos,
// ayuda contextual, deslizadores y bloques plegables.

import { useId, useState, type ReactNode } from 'react'
import { IconoChevron, IconoMarca, IconoNota } from './Iconos'

// ---- Tarjeta de opción --------------------------------------------------

interface OpcionProps {
  nombre: string
  titulo: string
  detalle?: ReactNode
  seleccionada: boolean
  onElegir: () => void
  tipo?: 'radio' | 'checkbox'
  compacta?: boolean
  ilustracion?: ReactNode
}

export function Opcion({
  nombre,
  titulo,
  detalle,
  seleccionada,
  onElegir,
  tipo = 'radio',
  compacta = false,
  ilustracion,
}: OpcionProps) {
  const id = useId()
  return (
    <label
      className={`opcion${compacta ? ' opcion-compacta' : ''}${ilustracion ? ' opcion-ilustrada' : ''}`}
      data-sel={seleccionada}
    >
      <input
        className="visualmente-oculto"
        type={tipo}
        name={nombre}
        checked={seleccionada}
        aria-labelledby={detalle ? `${id}-t ${id}-d` : `${id}-t`}
        onChange={onElegir}
      />
      <span className="opcion-cuerpo">
        {ilustracion ? <span className="opcion-figura">{ilustracion}</span> : null}
        <span>
          <span className="opcion-titulo" id={`${id}-t`}>
            {titulo}
          </span>
          {detalle ? (
            <span className="opcion-detalle" id={`${id}-d`}>
              {detalle}
            </span>
          ) : null}
        </span>
      </span>
      <span className={`opcion-marca${tipo === 'checkbox' ? ' cuadro' : ''}`} aria-hidden="true">
        <IconoMarca tam={14} />
      </span>
    </label>
  )
}

interface GrupoProps {
  etiqueta: string
  children: ReactNode
  fila?: boolean
  descripcion?: string
}

export function Grupo({ etiqueta, children, fila = false, descripcion }: GrupoProps) {
  return (
    <fieldset className="grupo">
      <legend className="grupo-titulo">{etiqueta}</legend>
      {descripcion ? <p className="grupo-descripcion">{descripcion}</p> : null}
      <div className={fila ? 'opciones-fila' : 'opciones'}>{children}</div>
    </fieldset>
  )
}

// ---- Campo numérico -----------------------------------------------------

interface CampoNumeroProps {
  etiqueta: string
  unidad: string
  valor: string
  onCambio: (valor: string) => void
  pista?: string
  error?: string
  entero?: boolean
  autoFoco?: boolean
  marcado?: boolean
}

export function CampoNumero({
  etiqueta,
  unidad,
  valor,
  onCambio,
  pista,
  error,
  entero = false,
  autoFoco = false,
  marcado = false,
}: CampoNumeroProps) {
  const id = useId()
  const idError = `${id}-error`
  return (
    <div className="campo">
      <label className="campo-etiqueta" htmlFor={id}>
        {etiqueta}
      </label>
      <div className={`campo-caja${error || marcado ? ' erroneo' : ''}`}>
        <input
          id={id}
          type="text"
          inputMode={entero ? 'numeric' : 'decimal'}
          autoComplete="off"
          value={valor}
          aria-invalid={Boolean(error) || marcado}
          aria-describedby={error ? idError : undefined}
          autoFocus={autoFoco}
          onChange={(evento) => onCambio(evento.target.value.replace(/[^\d.,]/g, ''))}
        />
        <span className="campo-unidad">{unidad}</span>
      </div>
      {pista && !error ? <p className="campo-pista">{pista}</p> : null}
      {error ? (
        <p className="campo-error" id={idError}>
          {error}
        </p>
      ) : null}
    </div>
  )
}

// ---- Deslizador ---------------------------------------------------------

interface DeslizadorProps {
  etiqueta: string
  valor: number
  min: number
  max: number
  paso: number
  sufijo: string
  onCambio: (valor: number) => void
  pista?: string
}

export function Deslizador({
  etiqueta,
  valor,
  min,
  max,
  paso,
  sufijo,
  onCambio,
  pista,
}: DeslizadorProps) {
  const id = useId()
  return (
    <div className="deslizador">
      <div className="deslizador-cabecera">
        <label htmlFor={id}>{etiqueta}</label>
        <output className="cifra deslizador-valor" htmlFor={id}>
          {valor} {sufijo}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={paso}
        value={valor}
        onChange={(evento) => onCambio(Number(evento.target.value))}
      />
      {pista ? <p className="campo-pista">{pista}</p> : null}
    </div>
  )
}

// ---- Ayuda contextual ---------------------------------------------------

export function Ayuda({ children }: { children: ReactNode }) {
  const [abierta, setAbierta] = useState(false)
  const id = useId()
  return (
    <div className="ayuda">
      <button
        type="button"
        className="ayuda-boton"
        aria-expanded={abierta}
        aria-controls={id}
        onClick={() => setAbierta((v) => !v)}
      >
        <IconoNota tam={17} />
        ¿Por qué lo preguntamos?
      </button>
      {abierta ? (
        <p className="ayuda-texto" id={id}>
          {children}
        </p>
      ) : null}
    </div>
  )
}

// ---- Bloque plegable ----------------------------------------------------

interface PlegableProps {
  titulo: string
  children: ReactNode
  abiertoInicial?: boolean
}

export function Plegable({ titulo, children, abiertoInicial = false }: PlegableProps) {
  const [abierto, setAbierto] = useState(abiertoInicial)
  const id = useId()
  return (
    <div className="plegable" data-abierto={abierto}>
      <button
        type="button"
        className="plegable-boton"
        aria-expanded={abierto}
        aria-controls={id}
        onClick={() => setAbierto((v) => !v)}
      >
        <span>{titulo}</span>
        <IconoChevron />
      </button>
      {abierto ? (
        <div className="plegable-cuerpo" id={id}>
          {children}
        </div>
      ) : null}
    </div>
  )
}
