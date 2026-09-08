// Controles compartidos del cuestionario: tarjetas de opción, campos numéricos,
// ayuda contextual, deslizadores y bloques plegables.

import { useId, useState, type ReactNode } from 'react'
import { IconoChevron, IconoMarca, IconoNota } from './Iconos'
import { leerNumero } from '../utiles/formato'

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

/**
 * Tarjeta con el mismo aspecto que `Opcion` pero que es una ACCIÓN de navegación, no una
 * respuesta que se guarde: se renderiza como botón. Un radio que nunca puede aparecer marcado
 * anuncia un estado incoherente a los lectores de pantalla.
 */
export function OpcionAccion({
  titulo,
  detalle,
  onElegir,
}: {
  titulo: string
  detalle?: ReactNode
  onElegir: () => void
}) {
  return (
    <button type="button" className="opcion opcion-accion" onClick={onElegir}>
      <span className="opcion-cuerpo">
        <span>
          <span className="opcion-titulo">{titulo}</span>
          {detalle ? <span className="opcion-detalle">{detalle}</span> : null}
        </span>
      </span>
    </button>
  )
}

/**
 * Interruptor de sí/no con el aspecto de tarjeta seleccionable (SPEC-ux §3.7.1). Es un
 * `checkbox` con `role="switch"`: una sola pulsación cambia la respuesta, sin dos tarjetas
 * que compitan por el mismo dato.
 */
export function Interruptor({
  titulo,
  detalle,
  activo,
  onCambiar,
}: {
  titulo: string
  detalle?: ReactNode
  activo: boolean
  onCambiar: (activo: boolean) => void
}) {
  const id = useId()
  return (
    <label className="opcion interruptor" data-sel={activo}>
      <input
        className="visualmente-oculto"
        type="checkbox"
        role="switch"
        checked={activo}
        aria-labelledby={detalle ? `${id}-t ${id}-d` : `${id}-t`}
        onChange={(evento) => onCambiar(evento.target.checked)}
      />
      <span className="opcion-cuerpo">
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
      <span className="interruptor-carril" aria-hidden="true">
        <span className="interruptor-bola" />
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
  /**
   * Texto de ejemplo que se ve mientras el campo está vacío. Los campos numéricos NUNCA arrancan
   * con un valor escrito (QA §1): un "25" o un "180" ya puestos dejan pulsar "Siguiente" sin haber
   * contestado y devuelven el plan de otra persona.
   */
  placeholder?: string
  /**
   * Techo del rango válido del campo. Solo se usa para decidir **cuándo** se enseña el error:
   * un número que ya lo supera no puede volver a ser válido escribiendo más dígitos, así que
   * esperar al `blur` deja un callejón sin salida (botón gris, sin explicación, y en móvil
   * pulsarlo ni siquiera saca el foco del campo). El rango normativo sigue estando en
   * `estadoPaso`, que es quien produce el texto del error.
   */
  max?: number
  /**
   * Id de un texto de la pantalla que explica el campo (una nota de seguridad, por ejemplo): se
   * añade al `aria-describedby` del input, detrás del error si lo hay.
   */
  describedPor?: string
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
  placeholder,
  max,
  describedPor,
}: CampoNumeroProps) {
  const id = useId()
  const idError = `${id}-error`
  // El error solo se enseña cuando el campo se ha dejado (o cuando el motor lo ha marcado): al
  // teclear "178" el usuario veía un error rojo tras el "1" y tras el "17" (§1.0, paso 2).
  const [tocado, setTocado] = useState(false)
  // Excepción: si el número ya se ha pasado del techo del rango, seguir escribiendo solo puede
  // alejarlo más, así que el error se enseña sin esperar al blur. Sin esto, quien teclea 300 cm
  // de altura ve el botón deshabilitado y ni una palabra que explique por qué.
  const escritoNumero = leerNumero(valor)
  const yaImposible = max !== undefined && escritoNumero !== null && escritoNumero > max
  const errorVisible = tocado || marcado || yaImposible ? error : undefined
  return (
    <div className="campo">
      <label className="campo-etiqueta" htmlFor={id}>
        {etiqueta}
      </label>
      <div className={`campo-caja${errorVisible || marcado ? ' erroneo' : ''}`}>
        <input
          id={id}
          type="text"
          inputMode={entero ? 'numeric' : 'decimal'}
          autoComplete="off"
          placeholder={placeholder}
          value={valor}
          aria-invalid={Boolean(errorVisible) || marcado}
          aria-describedby={
            [errorVisible ? idError : null, describedPor ?? null].filter(Boolean).join(' ') ||
            undefined
          }
          autoFocus={autoFoco}
          onBlur={() => setTocado(true)}
          onChange={(evento) => onCambio(evento.target.value.replace(/[^\d.,]/g, ''))}
        />
        <span className="campo-unidad">{unidad}</span>
      </div>
      {pista && !errorVisible ? <p className="campo-pista">{pista}</p> : null}
      {errorVisible ? (
        <p className="campo-error" id={idError}>
          {errorVisible}
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
      {/* El contenedor se renderiza siempre y se oculta con `hidden`: si no, `aria-controls`
          apunta a un id inexistente mientras la ayuda está plegada. */}
      <p className="ayuda-texto" id={id} hidden={!abierta}>
        {children}
      </p>
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
      <div className="plegable-cuerpo" id={id} hidden={!abierto}>
        {children}
      </div>
    </div>
  )
}
