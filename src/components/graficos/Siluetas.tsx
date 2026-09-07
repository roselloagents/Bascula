// Siluetas SVG propias. Una única geometría paramétrica (hombro, cintura,
// cadera, brazo, muslo) genera todas las figuras, así que las cinco categorías
// visuales y los tres somatotipos son la misma persona con proporciones
// distintas y no cinco dibujos sin relación entre sí.

import type { CategoriaVisual, Sexo, Somatotipo } from '../../engine/types'
import { RASGOS_SOMATOTIPO } from '../utiles/copy'

interface Proporciones {
  hombro: number
  cintura: number
  cadera: number
  brazo: number
  muslo: number
}

const CENTRO = 50

function torso({ hombro, cintura, cadera }: Proporciones): string {
  const hi = CENTRO - hombro
  const hd = CENTRO + hombro
  const ci = CENTRO - cintura
  const cd = CENTRO + cintura
  const ki = CENTRO - cadera
  const kd = CENTRO + cadera
  return [
    `M ${hi} 47`,
    `C ${hi - 1} 62, ${ci - 1} 72, ${ci} 86`,
    `C ${ci} 97, ${ki} 100, ${ki} 112`,
    `L ${kd} 112`,
    `C ${kd} 100, ${cd} 97, ${cd} 86`,
    `C ${cd + 1} 72, ${hd + 1} 62, ${hd} 47`,
    `C ${hd - 6} 43, ${CENTRO + 6} 41, ${CENTRO + 5} 38`,
    `L ${CENTRO - 5} 38`,
    `C ${CENTRO - 6} 41, ${hi + 6} 43, ${hi} 47`,
    'Z',
  ].join(' ')
}

/** Silueta genérica. `escala` en píxeles de alto. */
export function Silueta({
  proporciones,
  alto = 88,
  titulo,
}: {
  proporciones: Proporciones
  alto?: number
  titulo?: string
}) {
  const { hombro, cadera, brazo, muslo } = proporciones
  const piernaX = cadera * 0.45
  return (
    <svg
      viewBox="0 0 100 200"
      height={alto}
      width={(alto * 100) / 200}
      className="silueta"
      role={titulo ? 'img' : undefined}
      aria-hidden={titulo ? undefined : true}
      aria-label={titulo}
    >
      {/* piernas y brazos: trazos redondeados; torso y cabeza: relleno */}
      <g
        stroke="currentColor"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.92"
      >
        <path d={`M ${CENTRO - piernaX} 108 L ${CENTRO - piernaX - 1.5} 182`} strokeWidth={muslo} />
        <path d={`M ${CENTRO + piernaX} 108 L ${CENTRO + piernaX + 1.5} 182`} strokeWidth={muslo} />
        <path
          d={`M ${CENTRO - hombro + 2} 51 C ${CENTRO - hombro - 5} 66, ${CENTRO - hombro - 6} 82, ${CENTRO - hombro - 3} 98`}
          strokeWidth={brazo}
        />
        <path
          d={`M ${CENTRO + hombro - 2} 51 C ${CENTRO + hombro + 5} 66, ${CENTRO + hombro + 6} 82, ${CENTRO + hombro + 3} 98`}
          strokeWidth={brazo}
        />
      </g>
      <circle cx={CENTRO} cy="23" r="12.5" fill="currentColor" />
      <path d={torso(proporciones)} fill="currentColor" />
    </svg>
  )
}

// ---- Categorías visuales de %grasa (SPEC-ux §1.2.6.C) -------------------

const GRASA_HOMBRE: Record<string, Proporciones> = {
  muy_definido: { hombro: 26, cintura: 15.5, cadera: 19, brazo: 8, muslo: 13 },
  definido: { hombro: 25, cintura: 18, cadera: 20.5, brazo: 9, muslo: 14 },
  medio: { hombro: 24, cintura: 21.5, cadera: 22.5, brazo: 10.5, muslo: 15.5 },
  sobrepeso_visible: { hombro: 25, cintura: 27.5, cadera: 26, brazo: 12.5, muslo: 17.5 },
  obesidad_visible: { hombro: 27, cintura: 34, cadera: 31.5, brazo: 15, muslo: 20 },
}

const GRASA_MUJER: Record<string, Proporciones> = {
  muy_definida: { hombro: 21, cintura: 14.5, cadera: 23, brazo: 7, muslo: 13 },
  tonificada: { hombro: 21, cintura: 16.5, cadera: 24.5, brazo: 8, muslo: 14 },
  media: { hombro: 21, cintura: 19.5, cadera: 26.5, brazo: 9.5, muslo: 16 },
  sobrepeso_visible: { hombro: 22.5, cintura: 25.5, cadera: 30, brazo: 11.5, muslo: 18.5 },
  obesidad_visible: { hombro: 24, cintura: 32, cadera: 34.5, brazo: 14, muslo: 21 },
}

export function SiluetaGrasa({
  sexo,
  categoria,
  alto = 92,
}: {
  sexo: Sexo
  categoria: CategoriaVisual
  alto?: number
}) {
  const tabla = sexo === 'mujer' ? GRASA_MUJER : GRASA_HOMBRE
  const proporciones = tabla[categoria] ?? (sexo === 'mujer' ? GRASA_MUJER.media : GRASA_HOMBRE.medio)
  return <Silueta proporciones={proporciones} alto={alto} />
}

// ---- Somatotipos ---------------------------------------------------------

const SOMA_HOMBRE: Record<Somatotipo, Proporciones> = {
  ectomorfo: { hombro: 20.5, cintura: 15, cadera: 17.5, brazo: 7, muslo: 11.5 },
  mesomorfo: { hombro: 27, cintura: 18, cadera: 21, brazo: 10.5, muslo: 15.5 },
  endomorfo: { hombro: 25, cintura: 28, cadera: 28, brazo: 13, muslo: 18.5 },
}

const SOMA_MUJER: Record<Somatotipo, Proporciones> = {
  ectomorfo: { hombro: 18.5, cintura: 14, cadera: 20, brazo: 6.5, muslo: 11.5 },
  mesomorfo: { hombro: 22, cintura: 17, cadera: 25, brazo: 9, muslo: 15 },
  endomorfo: { hombro: 22.5, cintura: 27, cadera: 32, brazo: 12.5, muslo: 19 },
}

export function SiluetaSomatotipo({
  tipo,
  sexo,
  alto = 96,
}: {
  tipo: Somatotipo
  sexo: Sexo
  alto?: number
}) {
  const tabla = sexo === 'mujer' ? SOMA_MUJER : SOMA_HOMBRE
  return <Silueta proporciones={tabla[tipo]} alto={alto} />
}

/**
 * Las tres siluetas juntas. `destacado` resalta una: en resultados lo decide el motor y en el
 * paso 7 del cuestionario lo decide `somatotipoProvisional`, que delega en la misma función del
 * motor en cuanto están las cuatro respuestas (la interfaz no reproduce su tabla de decisión).
 * Con `null` no se resalta ninguna.
 */
export function TrioSomatotipos({
  sexo,
  destacado = null,
}: {
  sexo: Sexo
  destacado?: Somatotipo | null
}) {
  return (
    <ul className="trio-siluetas" data-hay-destacado={destacado !== null}>
      {RASGOS_SOMATOTIPO.map(({ tipo, nombre, rasgos }) => (
        <li key={tipo} data-destacado={destacado === tipo}>
          <SiluetaSomatotipo tipo={tipo} sexo={sexo} alto={88} />
          <p className="trio-nombre">
            {nombre}
            {destacado === tipo ? (
              <span className="visualmente-oculto"> (el que más encaja con tus respuestas)</span>
            ) : null}
          </p>
          <p className="trio-rasgos">{rasgos}</p>
        </li>
      ))}
    </ul>
  )
}

// ---- Dónde medir con la cinta métrica (SPEC-ux §1.2.6.B) ----------------

export function IlustracionMedidas({ sexo }: { sexo: Sexo }) {
  const proporciones = sexo === 'mujer' ? SOMA_MUJER.mesomorfo : SOMA_HOMBRE.mesomorfo
  const marcas: { y: number; texto: string; ancho: number }[] = [
    { y: 41, texto: 'Cuello', ancho: 16 },
    { y: 86, texto: 'Cintura', ancho: proporciones.cintura + 6 },
  ]
  if (sexo === 'mujer') marcas.push({ y: 108, texto: 'Cadera', ancho: proporciones.cadera + 6 })

  return (
    <figure className="figura-medidas">
      <svg viewBox="0 0 200 208" height="240" role="img" aria-label="Dónde colocar la cinta métrica">
        <g color="var(--tinta-suave)">
          <Silueta proporciones={proporciones} alto={200} />
        </g>
        {marcas.map(({ y, texto, ancho }) => (
          <g key={texto}>
            <line
              x1={CENTRO - ancho}
              y1={y}
              x2={CENTRO + ancho}
              y2={y}
              stroke="var(--verde)"
              strokeWidth="2.5"
              strokeDasharray="5 3"
            />
            <line
              x1={CENTRO + ancho}
              y1={y}
              x2={112}
              y2={y}
              stroke="var(--verde-borde)"
              strokeWidth="1.2"
            />
            <text x="118" y={y + 4.5} fill="var(--verde)" fontSize="12" fontWeight="600">
              {texto}
            </text>
          </g>
        ))}
      </svg>
    </figure>
  )
}
