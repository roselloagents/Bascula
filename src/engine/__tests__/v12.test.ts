// Decisiones G-I de la v1.2 (docs/SPEC-calculo.md §1, pasos 6.7ter, 13, 14, 17 y 19):
// el plazo eligiendo el ritmo discreto, la recomposición con déficit real (meta y banda honesta)
// y los consejos por síntomas de la regla.
//
// Los casos 17, 18 y 19 de la §5 viven en `vectors.test.ts` como vectores completos; aquí se
// comprueban las curvas, el copy del ciclo y las reglas que no caben en un vector.

import { describe, expect, it } from 'vitest'
import { ajustarMacros, calcular, textosAvisos } from '../index'
import type { InputEntrenamiento, Inputs, SintomaRegla } from '../types'

const FECHA = '2026-09-07'

const ent = (o: Partial<InputEntrenamiento> = {}): InputEntrenamiento => ({
  tipo: 'ninguno',
  dias_semana: 0,
  minutos_sesion: 0,
  intensidad: 'media',
  experiencia: 'novato',
  momento: null,
  ...o,
})

const PERFIL_BASE: Inputs = {
  sexo: 'hombre',
  edad: 38,
  altura_cm: 180,
  peso_kg: 95,
  grasa: { metodo: 'desconocido' },
  somatotipo: null,
  actividad_diaria: 'sedentario',
  entrenamiento: ent(),
  objetivo: 'perder',
  ritmo: 'suave',
  peso_objetivo: null,
  preferencia: 'omnivoro',
  n_comidas: 3,
  clima_caluroso: false,
  embarazo_lactancia: false,
  condiciones: [],
  cribado_tca: null,
  fecha_inicio: FECHA,
}
const con = (o: Partial<Inputs>): Inputs => ({ ...PERFIL_BASE, ...o })

// Caso 17 de la §5: mujer 45 años, recomposición con prioridad `perder` y peso objetivo 63 kg.
const CASO_17: Inputs = con({
  sexo: 'mujer',
  edad: 45,
  altura_cm: 165,
  peso_kg: 68,
  grasa: { metodo: 'medidas', cuello_cm: 33, cintura_cm: 82, cadera_cm: 102 },
  actividad_diaria: 'ligero',
  entrenamiento: ent({
    tipo: 'fuerza',
    dias_semana: 3,
    minutos_sesion: 45,
    intensidad: 'media',
    experiencia: 'novato',
    momento: 'tarde',
  }),
  objetivo: 'recomposicion',
  recomposicion_prioridad: 'perder',
  ritmo: 'moderado',
  peso_objetivo: 63,
  n_comidas: 4,
  preferencia_base: 'omnivoro',
  restricciones: [],
  low_carb: false,
  menstruacion: 'regular',
  sintomas_regla: ['sangrado_abundante', 'cansancio', 'hinchazon'],
})

// Caso 18 de la §5: hombre 38 años, 15 kg en 8 semanas (ningún ritmo llega).
const CASO_18: Inputs = con({
  objetivo: 'perder',
  ritmo: 'suave',
  peso_objetivo: 80,
  plazo_semanas: 8,
  preferencia_base: 'omnivoro',
})

// Caso 19 de la §5: mujer 34 años, 6 kg en 24 semanas (llega hasta el ritmo más suave).
const CASO_19: Inputs = con({
  sexo: 'mujer',
  edad: 34,
  altura_cm: 168,
  peso_kg: 78,
  actividad_diaria: 'ligero',
  entrenamiento: ent({
    tipo: 'fuerza',
    dias_semana: 3,
    minutos_sesion: 50,
    intensidad: 'media',
    experiencia: 'intermedio',
    momento: 'tarde',
  }),
  objetivo: 'perder',
  ritmo: 'agresivo',
  peso_objetivo: 72,
  plazo_semanas: 24,
  n_comidas: 4,
  preferencia_base: 'omnivoro',
})

const punto = (r: ReturnType<typeof calcular>, s: number) =>
  (r.proyeccion ?? []).find((p) => p.semana === s)

// ================================================================= H — plazo (paso 6.7ter)

describe('Paso 6.7ter — el plazo elige el ritmo discreto (decisión H)', () => {
  it('plazo holgado: gana el PRIMERO de la lista, y descarta el ritmo que eligió el usuario', () => {
    const r = calcular(CASO_19)
    // 6 kg / 24 sem = 0,25 kg/sem; suave (0,50 % de 78) = 0,39 ≥ 0,25.
    expect(r.ritmo_efectivo).toBe('suave')
    expect(r.avisos).toContain('INFO_RITMO_POR_PLAZO')
    expect(r.avisos).not.toContain('WARN_PLAZO_IRREAL')
  })

  it('plazo justo: gana el más suave cuyas SEMANAS caben, descansos incluidos', () => {
    // 78 kg, banda muy_alto: suave 0,39 y moderado 0,585 kg/sem. El ritmo se juzga con las mismas
    // semanas que va a publicar el cronograma (lineal + una semana de mantenimiento por cada 8),
    // no con la tasa pelada: 7,8 kg al ritmo suave son 20 semanas de dieta + 2 de descanso = 22, y
    // no caben en 20; el moderado son 14 + 1 = 15 y sí. Juzgarlo con la tasa daba el suave y luego
    // el paso 17 lo desmentía con un calendario de 24 semanas.
    const justo = calcular(con({ ...CASO_19, peso_objetivo: 78 - 0.39 * 20, plazo_semanas: 20 }))
    expect(justo.ritmo_efectivo).toBe('moderado')

    // Con margen de sobra vuelve a ganar el más suave de la tabla.
    const holgado = calcular(con({ ...CASO_19, peso_objetivo: 78 - 0.39 * 20, plazo_semanas: 30 }))
    expect(holgado.ritmo_efectivo).toBe('suave')
  })

  it('pedir MÁS plazo nunca da un plan peor (monotonía del paso 6.7ter)', () => {
    const orden = { suave: 0, moderado: 1, agresivo: 2 }
    let previo = 3
    for (const plazo of [8, 12, 15, 16, 20, 24, 30, 40, 52]) {
      const r = calcular(con({ ...CASO_19, peso_objetivo: 72, plazo_semanas: plazo }))
      const actual = orden[r.ritmo_efectivo]
      expect(actual, `plazo ${plazo}`).toBeLessThanOrEqual(previo)
      previo = actual
    }
  })

  it('plazo irreal: ni el agresivo llega ⇒ agresivo y WARN_PLAZO_IRREAL', () => {
    const r = calcular(CASO_18)
    expect(r.ritmo_efectivo).toBe('agresivo')
    expect(r.avisos).toContain('WARN_PLAZO_IRREAL')
    expect(r.avisos).not.toContain('INFO_RITMO_POR_PLAZO')
  })

  it('los dos avisos del plazo nunca conviven', () => {
    for (const plazo of [4, 8, 12, 16, 24, 52]) {
      for (const pobj of [70, 80, 88]) {
        const r = calcular(con({ objetivo: 'perder', peso_objetivo: pobj, plazo_semanas: plazo }))
        const info = r.avisos.includes('INFO_RITMO_POR_PLAZO')
        const warn = r.avisos.includes('WARN_PLAZO_IRREAL')
        expect(info && warn, `plazo ${plazo} / meta ${pobj}`).toBe(false)
      }
    }
  })

  it('sin plazo el motor se comporta como la v1.1 (mismo Resultado bit a bit)', () => {
    const sin = calcular(con({ objetivo: 'perder', ritmo: 'moderado', peso_objetivo: 80 }))
    const nulo = calcular(
      con({ objetivo: 'perder', ritmo: 'moderado', peso_objetivo: 80, plazo_semanas: null }),
    )
    expect(nulo).toEqual(sin)
    expect(sin.ritmo_efectivo).toBe('moderado')
    expect(sin.avisos).not.toContain('INFO_RITMO_POR_PLAZO')
    expect(sin.avisos).not.toContain('WARN_PLAZO_IRREAL')
  })

  it('sin peso objetivo el plazo se ignora sin error', () => {
    const r = calcular(
      con({ objetivo: 'perder', ritmo: 'moderado', peso_objetivo: null, plazo_semanas: 8 }),
    )
    expect(r.excluido).toBeUndefined()
    expect(r.ritmo_efectivo).toBe('moderado')
    expect(r.avisos).not.toContain('INFO_RITMO_POR_PLAZO')
    expect(r.avisos).not.toContain('WARN_PLAZO_IRREAL')
  })

  it('en `ganar` el plazo traduce el superávit de la tabla 3.8 a kg por semana', () => {
    const base = con({
      sexo: 'hombre',
      edad: 30,
      altura_cm: 180,
      peso_kg: 70,
      grasa: { metodo: 'conocido', valor: 12, fuente: 'fiable' },
      actividad_diaria: 'moderado',
      entrenamiento: ent({
        tipo: 'fuerza',
        dias_semana: 4,
        minutos_sesion: 60,
        intensidad: 'media',
        experiencia: 'intermedio',
        momento: 'tarde',
      }),
      objetivo: 'ganar',
      ritmo: 'agresivo',
      peso_objetivo: 74,
    })
    // 4 kg en 40 semanas = 0,10 kg/sem: el superávit `suave` (150-500 kcal) ya lo cubre de sobra.
    const holgado = calcular({ ...base, plazo_semanas: 40 })
    expect(holgado.objetivo_efectivo).toBe('ganar')
    expect(holgado.ritmo_efectivo).toBe('suave')
    // El superávit real de este plan es tan pequeño que el cronograma se va fuera de horizonte y
    // sale `null`: sin calendario no se puede sostener ninguna promesa de fecha (paso 17).
    expect(holgado.cronograma).toBeNull()
    expect(holgado.avisos).not.toContain('INFO_RITMO_POR_PLAZO')
    expect(holgado.avisos).toContain('WARN_PLAZO_IRREAL')
    // 4 kg en 4 semanas = 1 kg/sem: ni el techo de 500 kcal/día (0,4545 kg/sem) llega.
    const imposible = calcular({ ...base, plazo_semanas: 4 })
    expect(imposible.ritmo_efectivo).toBe('agresivo')
    expect(imposible.avisos).toContain('WARN_PLAZO_IRREAL')
  })
})

describe('Paso 17 — el plazo no sobrevive a los suavizados ni al calendario', () => {
  // Mujer 70 kg, banda `medio`: 5 kg en 17 semanas = 0,294 kg/sem. El moderado (0,40 % = 0,28)
  // se queda corto y gana el agresivo (0,50 % = 0,35), cuyo calendario sale [16, 18] y cabe en
  // las 17 pedidas: por eso aquí `INFO_RITMO_POR_PLAZO` sobrevive al paso 17 y sirve de control.
  const CON_PLAZO_QUE_CABE = con({
    sexo: 'mujer',
    edad: 45,
    altura_cm: 165,
    peso_kg: 70,
    grasa: { metodo: 'conocido', valor: 27, fuente: 'fiable' },
    actividad_diaria: 'moderado',
    entrenamiento: ent({
      tipo: 'fuerza',
      dias_semana: 4,
      minutos_sesion: 60,
      intensidad: 'media',
      experiencia: 'intermedio',
      momento: 'tarde',
    }),
    objetivo: 'perder',
    ritmo: 'suave',
    peso_objetivo: 65,
    plazo_semanas: 17,
    n_comidas: 4,
    preferencia_base: 'omnivoro',
  })

  it('el plazo sobrevive cuando nada lo suaviza y el calendario cabe', () => {
    const r = calcular(CON_PLAZO_QUE_CABE)
    expect(r.ritmo_efectivo).toBe('agresivo')
    expect(r.cronograma?.semanas[0]).toBeLessThanOrEqual(17)
    expect(r.avisos).toContain('INFO_RITMO_POR_PLAZO')
    expect(r.avisos).not.toContain('WARN_PLAZO_IRREAL')
  })

  it('el suavizado de los 65 años manda: INFO_RITMO_POR_PLAZO pasa a WARN_PLAZO_IRREAL', () => {
    const mayor = calcular({ ...CON_PLAZO_QUE_CABE, edad: 68 })
    expect(mayor.ritmo_efectivo).toBe('moderado') // el paso 6.7 baja el agresivo del plazo
    expect(mayor.avisos).toContain('WARN_PLAZO_IRREAL')
    expect(mayor.avisos).not.toContain('INFO_RITMO_POR_PLAZO')
    expect(mayor.avisos).toContain('WARN_PERDIDA_MAYOR_65')
  })

  it('el suavizado de la regla (6.7bis) también manda sobre el plazo', () => {
    const regular = calcular({ ...CON_PLAZO_QUE_CABE, menstruacion: 'regular' })
    expect(regular.ritmo_efectivo).toBe('agresivo')
    expect(regular.avisos).toContain('INFO_RITMO_POR_PLAZO')

    const irregular = calcular({ ...CON_PLAZO_QUE_CABE, menstruacion: 'irregular' })
    expect(irregular.ritmo_efectivo).toBe('moderado')
    expect(irregular.avisos).toContain('WARN_PLAZO_IRREAL')
    expect(irregular.avisos).not.toContain('INFO_RITMO_POR_PLAZO')
  })

  it('un calendario más largo que el plazo retira INFO_RITMO_POR_PLAZO', () => {
    for (const plazo of [4, 8, 12, 16, 24, 52]) {
      for (const pobj of [70, 76, 84, 90]) {
        const r = calcular(con({ objetivo: 'perder', peso_objetivo: pobj, plazo_semanas: plazo }))
        if (r.avisos.includes('INFO_RITMO_POR_PLAZO') && r.cronograma) {
          expect(r.cronograma.semanas[0], `plazo ${plazo} / meta ${pobj}`).toBeLessThanOrEqual(
            plazo,
          )
        }
      }
    }
    // El caso 19 llega dentro de las 24 pedidas (17 semanas en el mejor escenario).
    const r19 = calcular(CASO_19)
    expect(r19.cronograma?.semanas[0]).toBe(17)
    expect(r19.avisos).toContain('INFO_RITMO_POR_PLAZO')
  })

  it('si el objetivo final ya no es perder ni ganar, los dos avisos se retiran', () => {
    // Meta a menos de 1 kg: la regla 6.2 reescribe el objetivo a `mantener`.
    const r = calcular(con({ objetivo: 'perder', peso_objetivo: 94.5, plazo_semanas: 8 }))
    expect(r.objetivo_efectivo).toBe('mantener')
    expect(r.avisos).not.toContain('INFO_RITMO_POR_PLAZO')
    expect(r.avisos).not.toContain('WARN_PLAZO_IRREAL')
  })

  it("con 'tca' ninguno de los dos avisos del plazo se emite", () => {
    const r = calcular(
      con({ objetivo: 'perder', peso_objetivo: 80, plazo_semanas: 8, condiciones: ['tca'] }),
    )
    expect(r.avisos).not.toContain('INFO_RITMO_POR_PLAZO')
    expect(r.avisos).not.toContain('WARN_PLAZO_IRREAL')
    expect(r.ritmo_efectivo).toBe('suave')
  })

  it('los textos del plazo resuelven los gramos exigidos y la variante del calendario', () => {
    const irreal = calcular(CASO_18)
    const t18 = textosAvisos(irreal, CASO_18).find((t) => t.codigo === 'WARN_PLAZO_IRREAL')
    expect(t18?.texto).toContain('80 kg en 8 semanas')
    expect(t18?.texto).toContain('1.875 g por semana') // |80 − 95| / 8 · 1000
    expect(t18?.texto).toContain('Hemos puesto el más rápido de nuestra tabla.')
    expect(t18?.texto).toContain('entre 30 y 37 semanas')
    // La moraleja va en el sentido correcto: el músculo se pierde yendo demasiado RÁPIDO.
    expect(t18?.texto).toContain('por encima de cierto ritmo lo que se va es músculo')
    expect(t18?.texto).not.toContain('{')

    const holgado = calcular(CASO_19)
    const t19 = textosAvisos(holgado, CASO_19).find((t) => t.codigo === 'INFO_RITMO_POR_PLAZO')
    expect(t19?.texto).toContain('24 semanas')
    expect(t19?.texto).toContain('72 kg')
    expect(t19?.texto).toContain('250 g por semana')
    expect(t19?.texto).toContain('el ritmo suave')
    // Con el ritmo suave ya puesto no se sugiere "uno más suave": no existe.
    expect(t19?.texto).not.toContain('un ritmo más suave')
    expect(t19?.texto).not.toContain('{')

    // Variante "el ritmo que tu caso permite": el aviso llega desde un suavizado, no del 6.7ter.
    const suavizado: Inputs = { ...CON_PLAZO_QUE_CABE, edad: 68 }
    const rs = calcular(suavizado)
    const ts = textosAvisos(rs, suavizado).find((t) => t.codigo === 'WARN_PLAZO_IRREAL')
    expect(ts?.texto).toContain('Hemos aplicado el ritmo que tu caso permite.')
    expect(ts?.texto).not.toContain('{')
  })
})

// ================================================================= H — recomposición con déficit

describe('Pasos 13 y 14 — recomposición con déficit real (decisión H)', () => {
  it('caso 17: meta 63 kg y banda [curva del déficit, peso actual] de 20 puntos', () => {
    const r = calcular(CASO_17)
    expect(r.objetivo_efectivo).toBe('recomposicion')
    expect(r.peso_objetivo.metodo).toBe('grasa')
    expect(r.peso_objetivo.efectivo).toBe(63.0)
    expect(r.peso_objetivo.sugerido).toBe(58.5)
    expect(r.peso_objetivo.mostrar_central).toBe(true)
    expect(r.peso_objetivo.hito_intermedio).toBeNull()
    // En recomposición no se promete fecha: el cronograma sigue siendo `null`.
    expect(r.cronograma).toBeNull()
    expect(r.avisos).toContain('INFO_SIN_CRONOGRAMA')
    expect(r.avisos).toContain('INFO_PROYECCION_RECOMP')
    expect(r.avisos).not.toContain('INFO_PROYECCION_PLANA')
    // ritmo_kg_sem = 291,5 · 7/7 700 = 0,265; delta 5,0; sem_lineal 18,86 ⇒ S = 19.
    const p = r.proyeccion ?? []
    expect(p).toHaveLength(20)
    expect(p[0]).toEqual({ semana: 0, peso_min: 68.0, peso_esp: 68.0, peso_max: 68.0 })
    expect(punto(r, 4)).toEqual({ semana: 4, peso_min: 66.9, peso_esp: 67.5, peso_max: 68.0 })
    expect(punto(r, 8)).toEqual({ semana: 8, peso_min: 65.9, peso_esp: 66.9, peso_max: 68.0 })
    expect(punto(r, 12)).toEqual({ semana: 12, peso_min: 64.8, peso_esp: 66.4, peso_max: 68.0 })
    expect(punto(r, 19)).toEqual({ semana: 19, peso_min: 63.0, peso_esp: 65.5, peso_max: 68.0 })
  })

  it('INFO_OBJETIVO_IGNORADO se retira: aquí el peso objetivo sí se usa', () => {
    const r = calcular(CASO_17)
    expect(r.avisos).not.toContain('INFO_OBJETIVO_IGNORADO')
  })

  it('prioridad `equilibrado` también tiene meta y curva si el déficit es real', () => {
    const r = calcular({ ...CASO_17, recomposicion_prioridad: 'equilibrado' })
    expect(r.tdee.valor - r.kcal).toBeGreaterThanOrEqual(50)
    expect(r.peso_objetivo.efectivo).not.toBeNull()
    expect(r.avisos).toContain('INFO_PROYECCION_RECOMP')
  })

  it('prioridad `ganar` no tiene déficit: meta `null` y proyección plana', () => {
    const r = calcular({ ...CASO_17, recomposicion_prioridad: 'ganar' })
    expect(r.tdee.valor - r.kcal).toBeLessThan(50)
    expect(r.peso_objetivo.metodo).toBe('actual')
    expect(r.peso_objetivo.efectivo).toBeNull()
    expect(r.avisos).toContain('INFO_PROYECCION_PLANA')
    expect(r.avisos).not.toContain('INFO_PROYECCION_RECOMP')
    expect(r.proyeccion).toHaveLength(13)
  })

  it('ya en el peso propuesto (o por debajo): plana y sin avisos de una meta que no se enseña', () => {
    // El peso actual queda a menos de 0,5 kg de la meta pedida ⇒ no hay meta que dar.
    const r = calcular({ ...CASO_17, peso_objetivo: 67.8 })
    expect(r.peso_objetivo.metodo).toBe('actual')
    expect(r.peso_objetivo.efectivo).toBeNull()
    expect(r.avisos).toContain('INFO_PROYECCION_PLANA')
    expect(r.avisos).not.toContain('INFO_PROYECCION_RECOMP')
    expect(r.avisos).not.toContain('WARN_OBJETIVO_MUY_LEJANO')
    expect(r.avisos).not.toContain('WARN_OBJETIVO_GRASA_MUY_BAJA')
  })

  it('los suelos de `perder` siguen mandando sobre la meta de la recomposición', () => {
    // Meta absurda: la grasa esencial (20 % en mujeres) la sube al piso por `g_min`.
    const r = calcular({ ...CASO_17, peso_objetivo: 45 })
    expect(r.avisos).toContain('WARN_OBJETIVO_GRASA_MUY_BAJA')
    expect(r.peso_objetivo.efectivo).not.toBeNull()
    expect((r.peso_objetivo.efectivo as number) / (1.65 * 1.65)).toBeGreaterThanOrEqual(18.5)
  })

  it('invariantes S31 de la curva de recomposición sobre un barrido', () => {
    let casos = 0
    for (const peso of [58, 68, 82, 110]) {
      for (const prio of ['perder', 'equilibrado', 'ganar'] as const) {
        for (const pobj of [null, peso - 8, peso - 0.2, peso + 5]) {
          const r = calcular({
            ...CASO_17,
            peso_kg: peso,
            recomposicion_prioridad: prio,
            peso_objetivo: pobj,
          })
          if (r.excluido) continue
          casos++
          expect(r.cronograma, 'en recomposición nunca hay cronograma').toBeNull()
          if (!r.avisos.includes('INFO_PROYECCION_RECOMP')) continue
          const p = r.proyeccion ?? []
          expect(p.length).toBeGreaterThanOrEqual(13)
          expect(p.length).toBeLessThanOrEqual(27)
          const meta = r.peso_objetivo.efectivo as number
          for (let i = 0; i < p.length; i++) {
            expect(p[i].peso_max).toBe(Math.round(peso * 10) / 10) // el borde superior es el peso de hoy
            expect(p[i].peso_min).toBeGreaterThanOrEqual(Math.round(meta * 10) / 10 - 0.051)
            expect(p[i].peso_min).toBeLessThanOrEqual(p[i].peso_esp)
            expect(p[i].peso_esp).toBeLessThanOrEqual(p[i].peso_max)
            if (i > 0) {
              expect(p[i].peso_min).toBeLessThanOrEqual(p[i - 1].peso_min + 1e-9)
              expect(p[i].peso_esp).toBeLessThanOrEqual(p[i - 1].peso_esp + 1e-9)
            }
          }
        }
      }
    }
    expect(casos).toBeGreaterThan(20)
  })
})

describe('Paso 18 — el ajuste manual rehace la curva de recomposición', () => {
  it('subir las kcal hasta perder el déficit devuelve la banda plana', () => {
    const r = calcular(CASO_17)
    expect(r.avisos).toContain('INFO_PROYECCION_RECOMP')
    const limites = r.limites_ajuste
    expect(limites).toBeDefined()
    // Con las kcal en el tope del panel el déficit se queda por debajo de 50 kcal.
    const subido = ajustarMacros(r, { kcal: limites?.kcal_max })
    expect(r.tdee.valor - subido.kcal).toBeLessThan(50)
    expect(subido.avisos).toContain('INFO_PROYECCION_PLANA')
    expect(subido.avisos).not.toContain('INFO_PROYECCION_RECOMP')
    expect(subido.proyeccion).toHaveLength(13)
  })

  it('con un ajuste vacío se restituye el plan recomendado, curva incluida', () => {
    const r = calcular(CASO_17)
    const vuelta = ajustarMacros(r, {})
    expect({ ...vuelta, avisos: [...vuelta.avisos].sort() }).toEqual({
      ...r,
      avisos: [...r.avisos].sort(),
    })
  })
})

// ================================================================= I — ciclo (paso 19)

describe('Paso 19 — consejos por síntomas de la regla (decisión I)', () => {
  const mujer = (o: Partial<Inputs> = {}): Inputs =>
    con({
      sexo: 'mujer',
      edad: 34,
      altura_cm: 165,
      peso_kg: 64,
      objetivo: 'mantener',
      menstruacion: 'regular',
      ...o,
    })

  it('caso 17: orden canónico, no el de entrada, y un consejo por síntoma', () => {
    const r = calcular(CASO_17)
    expect(r.ciclo?.sintomas).toEqual(['hinchazon', 'cansancio', 'sangrado_abundante'])
    expect(r.ciclo?.consejos.map((c) => c.clave)).toEqual([
      'hinchazon',
      'cansancio',
      'sangrado_abundante',
    ])
    const consejos = r.ciclo?.consejos ?? []
    // `cansancio` SIN el fragmento de low-carb (`low_carb = false`).
    expect(consejos[1].texto).not.toContain('bajo en hidratos')
    // `sangrado_abundante` CON el de la ferritina, porque `cansancio` está marcado.
    expect(consejos[2].texto).toContain('ferritina')
    expect(consejos.map((c) => c.alimentos)).toEqual([
      ['Plátano', 'Patata cocida', 'Espinacas', 'Calabacín'],
      ['Avena', 'Patata cocida', 'Lentejas o garbanzos', 'Fruta'],
      [
        'Lentejas o garbanzos',
        'Carne roja magra (ternera)',
        'Mejillones o berberechos al natural',
        'Espinacas',
      ],
    ])
    for (const c of consejos) {
      expect(c.titulo.length).toBeGreaterThan(3)
      expect(c.texto.length).toBeGreaterThan(50)
      expect(c.texto, `${c.clave} con llaves sin resolver`).not.toContain('{')
    }
  })

  it('cada síntoma por separado produce su consejo', () => {
    const claves: SintomaRegla[] = [
      'dolor',
      'hinchazon',
      'antojos',
      'cansancio',
      'sangrado_abundante',
    ]
    for (const clave of claves) {
      const r = calcular(mujer({ sintomas_regla: [clave] }))
      expect(r.ciclo?.sintomas, clave).toEqual([clave])
      const c = r.ciclo?.consejos[0]
      expect(c?.clave).toBe(clave)
      expect(c?.alimentos.length, clave).toBeGreaterThan(0)
      expect(c?.texto, clave).not.toContain('{')
    }
  })

  it('el fragmento de low-carb solo aparece con `low_carb` efectivo', () => {
    const sin = calcular(
      mujer({ sintomas_regla: ['cansancio'], preferencia_base: 'omnivoro', low_carb: false }),
    )
    expect(sin.ciclo?.consejos[0].texto).not.toContain('bajo en hidratos')
    const conLc = calcular(
      mujer({ sintomas_regla: ['cansancio'], preferencia_base: 'omnivoro', low_carb: true }),
    )
    expect(conLc.ciclo?.consejos[0].texto).toContain('bajo en hidratos')
    // La diabetes anula el interruptor en el paso 6.8, y el consejo tiene que seguirlo.
    const diabetes = calcular(
      mujer({
        sintomas_regla: ['cansancio'],
        preferencia_base: 'omnivoro',
        low_carb: true,
        condiciones: ['diabetes'],
      }),
    )
    expect(diabetes.low_carb).toBe(false)
    expect(diabetes.ciclo?.consejos[0].texto).not.toContain('bajo en hidratos')
  })

  it('el fragmento de la ferritina solo aparece si además hay cansancio', () => {
    const solo = calcular(mujer({ sintomas_regla: ['sangrado_abundante'] }))
    expect(solo.ciclo?.consejos[0].texto).not.toContain('ferritina')
    expect(solo.ciclo?.consejos[0].texto.endsWith('lo que absorbes.')).toBe(true)
    const con2 = calcular(mujer({ sintomas_regla: ['sangrado_abundante', 'cansancio'] }))
    expect(con2.ciclo?.consejos[1].texto).toContain('ferritina')
  })

  it('a una vegana no se le recomienda carne roja ni pescado en su propio plan', () => {
    const r = calcular(
      mujer({
        sintomas_regla: ['dolor', 'antojos', 'sangrado_abundante'],
        preferencia_base: 'vegano',
        restricciones: [],
        low_carb: false,
      }),
    )
    const todos = (r.ciclo?.consejos ?? []).flatMap((c) => c.alimentos).join(' · ')
    expect(todos).not.toMatch(/Carne roja|Pescado azul|Mejillones|Yogur griego/)
    expect(todos).toContain('Yogur de soja alto en proteína')
    expect(todos).toContain('Tofu')
    expect(todos).toContain('Semillas de chía')
  })

  it('las dos únicas sustituciones por restricción: avena y yogur griego', () => {
    const sinGluten = calcular(
      mujer({
        sintomas_regla: ['cansancio'],
        preferencia_base: 'omnivoro',
        restricciones: ['sin_gluten'],
        low_carb: false,
      }),
    )
    expect(sinGluten.ciclo?.consejos[0].alimentos).toEqual([
      'Patata cocida',
      'Lentejas o garbanzos',
      'Fruta',
    ])
    const sinLactosa = calcular(
      mujer({
        sintomas_regla: ['antojos'],
        preferencia_base: 'omnivoro',
        restricciones: ['sin_lactosa'],
        low_carb: false,
      }),
    )
    expect(sinLactosa.ciclo?.consejos[0].alimentos[0]).toBe('Yogur griego 0% sin lactosa')
  })

  it('`ciclo` es exactamente INFO_CICLO + al menos un síntoma válido', () => {
    expect(calcular(mujer({ sintomas_regla: [] })).ciclo).toBeUndefined()
    expect(calcular(mujer({ sintomas_regla: null })).ciclo).toBeUndefined()
    expect(calcular(mujer({})).ciclo).toBeUndefined()
    // Sin regla (o con `ausente`/`no_dice`) no hay INFO_CICLO y no hay tarjeta.
    expect(
      calcular(mujer({ menstruacion: 'ausente', sintomas_regla: ['dolor'] })).ciclo,
    ).toBeUndefined()
    expect(
      calcular(mujer({ menstruacion: 'no_dice', sintomas_regla: ['dolor'] })).ciclo,
    ).toBeUndefined()
    // En hombres el paso 0 ignora `menstruacion`, así que tampoco hay ciclo.
    expect(
      calcular(con({ menstruacion: 'regular', sintomas_regla: ['dolor'] })).ciclo,
    ).toBeUndefined()
    // Duplicados y orden de entrada: se deduplica y se ordena.
    const r = calcular(mujer({ sintomas_regla: ['antojos', 'dolor', 'antojos'] }))
    expect(r.ciclo?.sintomas).toEqual(['dolor', 'antojos'])
  })

  it('los síntomas no cambian ni un número del plan (S33)', () => {
    const sin = calcular(mujer({ objetivo: 'perder', peso_objetivo: 58 }))
    const conSintomas = calcular(
      mujer({ objetivo: 'perder', peso_objetivo: 58, sintomas_regla: ['dolor', 'antojos'] }),
    )
    expect({ ...conSintomas, ciclo: undefined }).toEqual({ ...sin, ciclo: undefined })
    expect(conSintomas.ciclo).toBeDefined()
  })
})

// ================================================================= G — el motor ignora los alimentos

describe('§1 — los campos de alimentos y `menu_sencillo` no llegan al motor (S33)', () => {
  it('caso 17: con y sin los tres campos, el mismo Resultado bit a bit', () => {
    const limpio: Inputs = { ...CASO_17 }
    const conListas: Inputs = {
      ...CASO_17,
      menu_sencillo: true,
      alimentos_excluidos: ['brocoli', 'coliflor'],
      alimentos_favoritos: ['pechuga_pollo', 'arroz_blanco_cocido'],
    }
    expect(calcular(conListas)).toEqual(calcular(limpio))
  })

  it('el orden de los favoritos tampoco cambia nada', () => {
    const a = calcular({ ...CASO_17, alimentos_favoritos: ['a', 'b', 'c'] })
    const b = calcular({ ...CASO_17, alimentos_favoritos: ['c', 'b', 'a'] })
    expect(a).toEqual(b)
  })

  it('validación de los cuatro campos nuevos: ausente o null es siempre válido', () => {
    expect(
      calcular({
        ...CASO_17,
        plazo_semanas: null,
        sintomas_regla: null,
        alimentos_excluidos: null,
        alimentos_favoritos: null,
      }).excluido,
    ).toBeUndefined()
    expect(calcular({ ...CASO_17, plazo_semanas: 3 }).errores).toEqual(['plazo_semanas'])
    expect(calcular({ ...CASO_17, plazo_semanas: 53 }).errores).toEqual(['plazo_semanas'])
    expect(calcular({ ...CASO_17, plazo_semanas: 8.5 }).errores).toEqual(['plazo_semanas'])
    expect(calcular({ ...CASO_17, sintomas_regla: ['migrana' as SintomaRegla] }).errores).toEqual([
      'sintomas_regla',
    ])
    expect(calcular({ ...CASO_17, alimentos_excluidos: [1 as unknown as string] }).errores).toEqual(
      ['alimentos_excluidos'],
    )
    expect(
      calcular({ ...CASO_17, alimentos_favoritos: 'pollo' as unknown as string[] }).errores,
    ).toEqual(['alimentos_favoritos'])
  })
})
