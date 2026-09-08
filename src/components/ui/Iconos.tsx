// Iconos SVG propios, trazo fino y sin librerías. Decorativos salvo que se les
// pase un título accesible.

interface IconoProps {
  tam?: number
  className?: string
}

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function IconoMarca({ tam = 16, className }: IconoProps) {
  return (
    <svg viewBox="0 0 24 24" width={tam} height={tam} aria-hidden="true" className={className}>
      <path {...base} strokeWidth={2.4} d="M4.5 12.5 9.5 17.5 19.5 6.5" />
    </svg>
  )
}

export function IconoFlecha({ tam = 18, className }: IconoProps) {
  return (
    <svg viewBox="0 0 24 24" width={tam} height={tam} aria-hidden="true" className={className}>
      <path {...base} d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

export function IconoAtras({ tam = 18, className }: IconoProps) {
  return (
    <svg viewBox="0 0 24 24" width={tam} height={tam} aria-hidden="true" className={className}>
      <path {...base} d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  )
}

export function IconoChevron({ tam = 18, className }: IconoProps) {
  return (
    <svg viewBox="0 0 24 24" width={tam} height={tam} aria-hidden="true" className={className}>
      <path {...base} d="M6 9.5 12 15.5 18 9.5" />
    </svg>
  )
}

export function IconoAviso({ tam = 20, className }: IconoProps) {
  return (
    <svg viewBox="0 0 24 24" width={tam} height={tam} aria-hidden="true" className={className}>
      <path {...base} d="M12 4.5 21 19.5H3z" />
      <path {...base} d="M12 10v4.2" />
      <circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconoNota({ tam = 20, className }: IconoProps) {
  return (
    <svg viewBox="0 0 24 24" width={tam} height={tam} aria-hidden="true" className={className}>
      <circle {...base} cx="12" cy="12" r="8.5" />
      <path {...base} d="M12 11v5.5" />
      <circle cx="12" cy="7.8" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconoPesa({ tam = 18, className }: IconoProps) {
  return (
    <svg viewBox="0 0 24 24" width={tam} height={tam} aria-hidden="true" className={className}>
      <path {...base} d="M3 9.5v5M6 7.5v9M18 7.5v9M21 9.5v5M6 12h12" />
    </svg>
  )
}

export function IconoGota({ tam = 20, className }: IconoProps) {
  return (
    <svg viewBox="0 0 24 24" width={tam} height={tam} aria-hidden="true" className={className}>
      <path
        {...base}
        d="M12 3.5c3.4 4 5.5 6.6 5.5 9.4A5.5 5.5 0 0 1 6.5 12.9c0-2.8 2.1-5.4 5.5-9.4Z"
      />
    </svg>
  )
}

export function IconoBombilla({ tam = 20, className }: IconoProps) {
  return (
    <svg viewBox="0 0 24 24" width={tam} height={tam} aria-hidden="true" className={className}>
      <path {...base} d="M9.2 17.2a5.8 5.8 0 1 1 5.6 0v1.6H9.2z" />
      <path {...base} d="M10 21h4" />
    </svg>
  )
}

export function IconoDescarga({ tam = 18, className }: IconoProps) {
  return (
    <svg viewBox="0 0 24 24" width={tam} height={tam} aria-hidden="true" className={className}>
      <path {...base} d="M12 3.5v11M7.5 10.5 12 15l4.5-4.5M4.5 19.5h15" />
    </svg>
  )
}

export function IconoLapiz({ tam = 18, className }: IconoProps) {
  return (
    <svg viewBox="0 0 24 24" width={tam} height={tam} aria-hidden="true" className={className}>
      <path {...base} d="m4.5 19.5.6-3.6 10-10 3 3-10 10z" />
      <path {...base} d="m14.4 6.4 3 3" />
    </svg>
  )
}

export function IconoPapelera({ tam = 18, className }: IconoProps) {
  return (
    <svg viewBox="0 0 24 24" width={tam} height={tam} aria-hidden="true" className={className}>
      <path {...base} d="M4.5 6.5h15M9.5 6.5V4.5h5v2M6.5 6.5l1 13h9l1-13" />
      <path {...base} d="M10.5 10v6M13.5 10v6" />
    </svg>
  )
}

/** Rueda de carga: se detiene con prefers-reduced-motion (regla en el CSS). */
export function Cargador({ tam = 18, className }: IconoProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={tam}
      height={tam}
      aria-hidden="true"
      className={`cargador ${className ?? ''}`}
    >
      <circle
        cx="12"
        cy="12"
        r="8.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.25"
      />
      <path {...base} strokeWidth={2} d="M20.5 12a8.5 8.5 0 0 0-8.5-8.5" />
    </svg>
  )
}

/** Logotipo: una báscula de platillos reducida a tres trazos. */
export function Logotipo({ tam = 26, className }: IconoProps) {
  return (
    <svg viewBox="0 0 32 32" width={tam} height={tam} aria-hidden="true" className={className}>
      <path {...base} strokeWidth={1.8} d="M16 5.5v20M8.5 25.5h15" />
      <path {...base} strokeWidth={1.8} d="M5 10.5h22" />
      <path
        {...base}
        strokeWidth={1.8}
        d="M2.5 19c0-.3 3.5-8.5 3.5-8.5S9.5 18.7 9.5 19a3.5 3.5 0 0 1-7 0Z"
      />
      <path
        {...base}
        strokeWidth={1.8}
        d="M22.5 19c0-.3 3.5-8.5 3.5-8.5S29.5 18.7 29.5 19a3.5 3.5 0 0 1-7 0Z"
      />
    </svg>
  )
}
