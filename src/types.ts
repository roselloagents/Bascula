export type BodyType = 'ectomorph' | 'mesomorph' | 'endomorph'

export interface BmiInput {
  name: string
  age: number
  weight: number
  height: number
  bodyType: BodyType
}

export type BmiTone = 'low' | 'high' | 'good' | 'slightly-low' | 'slightly-high'

export interface BmiResult extends BmiInput {
  bmi: number
  targetRange: {
    min: number
    max: number
  }
  verdict: string
  detail: string
  tone: BmiTone
}
