// Gráfico de macros: anillo SVG propio, sin librerías.
// Los tres colores son los mismos de la leyenda, de la tabla de comidas y del PDF.

import { entero, num } from '../utiles/formato'

interface DonutProps {
  pct: { p: number; g: number; hc: number }
  kcal: number
}

const RADIO = 54
const GROSOR = 18
const CIRCUNFERENCIA = 2 * Math.PI * RADIO

interface Segmento {
  clave: 'p' | 'g' | 'hc'
  color: string
  fraccion: number
}

export function DonutMacros({ pct, kcal }: DonutProps) {
  const total = pct.p + pct.g + pct.hc || 1
  const segmentos: Segmento[] = [
    { clave: 'p', color: 'var(--proteina)', fraccion: pct.p / total },
    { clave: 'g', color: 'var(--grasa)', fraccion: pct.g / total },
    { clave: 'hc', color: 'var(--carbo)', fraccion: pct.hc / total },
  ]

  let acumulado = 0
  const arcos = segmentos.map((seg) => {
    const largo = seg.fraccion * CIRCUNFERENCIA
    const desfase = -acumulado * CIRCUNFERENCIA
    acumulado += seg.fraccion
    // 2 px de separación entre porciones para que se distingan sin depender del color
    return { ...seg, largo: Math.max(largo - 2, 0), desfase }
  })

  const descripcion = `Proteína ${num(Math.round(pct.p * 100))} %, grasa ${num(
    Math.round(pct.g * 100),
  )} % e hidratos ${num(Math.round(pct.hc * 100))} % de tus ${entero(kcal)} calorías.`

  return (
    <div className="donut">
      <svg viewBox="0 0 140 140" role="img" aria-label={descripcion}>
        <g transform="rotate(-90 70 70)">
          <circle
            cx="70"
            cy="70"
            r={RADIO}
            fill="none"
            stroke="var(--hueso-hundido)"
            strokeWidth={GROSOR}
          />
          {arcos.map((arco) => (
            <circle
              key={arco.clave}
              cx="70"
              cy="70"
              r={RADIO}
              fill="none"
              stroke={arco.color}
              strokeWidth={GROSOR}
              strokeDasharray={`${arco.largo} ${CIRCUNFERENCIA - arco.largo}`}
              strokeDashoffset={arco.desfase}
              strokeLinecap="butt"
            />
          ))}
        </g>
        <text x="70" y="66" textAnchor="middle" className="donut-cifra cifra">
          {entero(kcal)}
        </text>
        <text x="70" y="84" textAnchor="middle" className="donut-unidad">
          kcal al día
        </text>
      </svg>
    </div>
  )
}
