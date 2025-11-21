import { useState } from 'react'
import type { FormEvent } from 'react'
import type { BmiInput, BodyType } from '../types'

type Errors = Partial<Record<keyof BmiInput, string>>

interface Props {
  onCalculate: (data: BmiInput) => void
}

const bodyTypeLabels: Record<BodyType, string> = {
  ectomorph: 'Ectomorph',
  mesomorph: 'Mesomorph',
  endomorph: 'Endomorph',
}

export function BmiForm({ onCalculate }: Props) {
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [weight, setWeight] = useState('')
  const [height, setHeight] = useState('')
  const [bodyType, setBodyType] = useState<BodyType>('ectomorph')
  const [errors, setErrors] = useState<Errors>({})

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validationErrors: Errors = {}

    if (!name.trim()) {
      validationErrors.name = 'Name is required.'
    }

    const parsedAge = Number(age)
    if (!age || Number.isNaN(parsedAge) || parsedAge <= 0) {
      validationErrors.age = 'Age must be greater than zero.'
    }

    const parsedWeight = Number(weight)
    if (!weight || Number.isNaN(parsedWeight) || parsedWeight <= 0) {
      validationErrors.weight = 'Weight must be greater than zero.'
    }

    const parsedHeight = Number(height)
    if (!height || Number.isNaN(parsedHeight) || parsedHeight <= 0) {
      validationErrors.height = 'Height must be greater than zero.'
    }

    if (!bodyType) {
      validationErrors.bodyType = 'Select your body type.'
    }

    setErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) return

    onCalculate({
      name: name.trim(),
      age: parsedAge,
      weight: parsedWeight,
      height: parsedHeight,
      bodyType,
    })
  }

  return (
    <form className="card form-card" onSubmit={handleSubmit} noValidate>
      <div className="card-header">
        <p className="eyebrow">Your inputs</p>
        <h2>Drop your stats</h2>
        <p className="muted">
          No fluff, just the numbers I need to calculate your BMI and tell you what&apos;s up.
        </p>
      </div>

      <div className="form-grid">
        <label className="input-group">
          <span>Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoComplete="name"
          />
          {errors.name && <span className="error">{errors.name}</span>}
        </label>

        <div className="input-row">
          <label className="input-group">
            <span>Age</span>
            <input
              type="number"
              min={1}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="Years"
              inputMode="numeric"
            />
            {errors.age && <span className="error">{errors.age}</span>}
          </label>

          <label className="input-group">
            <span>Weight (kg)</span>
            <input
              type="number"
              min={1}
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="e.g., 74"
              inputMode="decimal"
            />
            {errors.weight && <span className="error">{errors.weight}</span>}
          </label>
        </div>

        <label className="input-group">
          <span>Height (cm)</span>
          <input
            type="number"
            min={1}
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            placeholder="e.g., 178"
            inputMode="decimal"
          />
          {errors.height && <span className="error">{errors.height}</span>}
        </label>

        <fieldset className="input-group">
          <legend>Body type</legend>
          <div className="radio-options">
            {Object.keys(bodyTypeLabels).map((key) => {
              const value = key as BodyType
              return (
                <label key={value} className={`radio-pill ${bodyType === value ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="bodyType"
                    value={value}
                    checked={bodyType === value}
                    onChange={() => setBodyType(value)}
                  />
                  <span>{bodyTypeLabels[value]}</span>
                </label>
              )
            })}
          </div>
          {errors.bodyType && <span className="error">{errors.bodyType}</span>}
        </fieldset>
      </div>

      <button type="submit" className="primary-btn">
        Calculate BMI
      </button>
    </form>
  )
}
