import { useEffect, useState } from 'react'
import { BmiForm } from './components/BmiForm'
import { ResultCard } from './components/ResultCard'
import type { BmiInput, BmiResult, BodyType } from './types'
import './App.css'

const TARGET_RANGES: Record<BodyType, { min: number; max: number }> = {
  ectomorph: { min: 18.5, max: 22.9 },
  mesomorph: { min: 20.0, max: 24.9 },
  endomorph: { min: 22.0, max: 27.9 },
}

function App() {
  useEffect(() => {
    document.title = 'Bascula | Brutally Honest BMI'
  }, [])

  const [result, setResult] = useState<BmiResult | null>(null)

  const handleCalculate = (input: BmiInput) => {
    const heightMeters = input.height / 100
    const bmi = Number((input.weight / (heightMeters * heightMeters)).toFixed(1))
    const targetRange = TARGET_RANGES[input.bodyType]

    let verdict = ''
    let detail = ''
    let tone: BmiResult['tone'] = 'good'

    if (bmi < targetRange.min - 2) {
      verdict = 'Come fucking pollo y arroz.'
      detail = 'You are very underweight relative to your body type.'
      tone = 'low'
    } else if (bmi > targetRange.max + 2) {
      verdict = 'You are a fucking gordo.'
      detail = 'You are significantly above the target BMI for your body type.'
      tone = 'high'
    } else if (bmi >= targetRange.min && bmi <= targetRange.max) {
      verdict = 'Fuck, aquí sí que puedo estar.'
      detail = 'You are in a good BMI range for your body type.'
      tone = 'good'
    } else if (bmi < targetRange.min) {
      verdict = 'You are slightly below your target range—grab a burger and chill.'
      detail = 'A light calorie bump will nudge you into range.'
      tone = 'slightly-low'
    } else {
      verdict = 'You are slightly above your target range—ease up on the extra snacks.'
      detail = 'Trim a bit and you will slide back into your target.'
      tone = 'slightly-high'
    }

    setResult({
      ...input,
      bmi,
      targetRange,
      verdict,
      detail,
      tone,
    })
  }

  return (
    <div className="page-shell">
      <div className="bg-blur bg-one" />
      <div className="bg-blur bg-two" />
      <main className="app-card">
        <header className="hero">
          <p className="eyebrow">Bascula</p>
          <h1>Brutally honest BMI checkpoint</h1>
          <p className="subtitle">
            A minimalist calculator with zero sugar-coating—just your numbers and the truth.
          </p>
        </header>

        <section className="content-grid">
          <BmiForm onCalculate={handleCalculate} />
          <ResultCard result={result} />
        </section>
      </main>
    </div>
  )
}

export default App
