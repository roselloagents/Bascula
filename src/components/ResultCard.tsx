import type { BmiResult } from '../types'

interface Props {
  result: BmiResult | null
}

const toneClass: Record<BmiResult['tone'], string> = {
  good: 'tone-good',
  low: 'tone-low',
  high: 'tone-high',
  'slightly-low': 'tone-slightly-low',
  'slightly-high': 'tone-slightly-high',
}

const bodyTypeCopy = {
  ectomorph: 'Ectomorph',
  mesomorph: 'Mesomorph',
  endomorph: 'Endomorph',
}

export function ResultCard({ result }: Props) {
  if (!result) {
    return (
      <div className="card result-card muted-card">
        <p className="eyebrow">Result</p>
        <h2>Waiting for your numbers</h2>
        <p className="muted">
          Tell me your stats and I&apos;ll let you know if you&apos;re cruising or crashing your target.
        </p>
      </div>
    )
  }

  const toneClassName = toneClass[result.tone] ?? ''
  const range = `${result.targetRange.min.toFixed(1)} – ${result.targetRange.max.toFixed(1)}`

  return (
    <div className={`card result-card ${toneClassName}`}>
      <div className="result-header">
        <p className="eyebrow">Result</p>
        <h2>{result.name}&apos;s checkpoint</h2>
        <p className="muted">
          Age {result.age} · {bodyTypeCopy[result.bodyType]}
        </p>
      </div>

      <div className="stats">
        <div className="stat">
          <span className="stat-label">BMI</span>
          <span className="stat-value">{result.bmi.toFixed(1)}</span>
          <span className="stat-caption">Rounded to the nearest tenth</span>
        </div>
        <div className="stat">
          <span className="stat-label">Target BMI</span>
          <span className="stat-value">{range}</span>
          <span className="stat-caption">For {bodyTypeCopy[result.bodyType]}</span>
        </div>
      </div>

      <div className="verdict">
        <p className="verdict-title">{result.verdict}</p>
        <p className="muted">{result.detail}</p>
      </div>
    </div>
  )
}
