// Decisiones B-F de la v1.1 (docs/SPEC-calculo.md §1.1, pasos 6.7bis, 7, 9, 14b, 17 y 18):
// preferencias combinables, prioridad de recomposición, regla, proyección y ajuste manual.
//
// El caso 15 de la §5 fija la proyección campo a campo y el 16 el ajuste manual; los dos viven
// además en `vectors.test.ts` como vectores completos. Aquí se comprueban las reglas, los límites
// y los invariantes que no caben en un vector.

import { describe, expect, it } from 'vitest'
import { ajustarMacros, calcular, textosAvisos } from '../index'
import { bancoDe, normalizarPreferencias } from '../preferences'
import type { AjusteMacros, InputEntrenamiento, Inputs, Resultado } from '../types'

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
  edad: 30,
  altura_cm: 175,
  peso_kg: 70,
  grasa: { metodo: 'desconocido' },
  somatotipo: null,
  actividad_diaria: 'sedentario',
  entrenamiento: ent(),
  objetivo: 'perder',
  ritmo: 'moderado',
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

/**
 * Normaliza el orden de `avisos` para poder comparar dos `Resultado` con igualdad profunda: la
 * §4 declara que el orden de los avisos no es significativo, y `ajustarMacros` reemite al final
 * los que retira (cronograma, fibra...), así que un aviso puede cambiar de posición sin que el
 * plan cambie en nada. Todo lo demás —números, macros, comidas, límites— se compara tal cual.
 */
const normalizado = (r: Resultado): Resultado => ({ ...r, avisos: [...r.avisos].sort() })

// Caso 15 de la §5: mujer 34 años, perder agresivo, regla irregular, omnívora sin lactosa.
const CASO_15: Inputs = con({
  sexo: 'mujer',
  edad: 34,
  altura_cm: 168,
  peso_kg: 78,
  actividad_diaria: 'ligero',
  entrenamiento: ent({ tipo: 'fuerza', dias_semana: 3, minutos_sesion: 50, intensidad: 'media', experiencia: 'intermedio', momento: 'tarde' }),
  objetivo: 'perder',
  ritmo: 'agresivo',
  peso_objetivo: 68,
  n_comidas: 4,
  preferencia_base: 'omnivoro',
  restricciones: ['sin_lactosa'],
  low_carb: false,
  menstruacion: 'irregular',
})

// Caso 16 de la §5: mujer 31 años, recomposición con prioridad `perder`.
const CASO_16: Inputs = con({
  sexo: 'mujer',
  edad: 31,
  altura_cm: 165,
  peso_kg: 64,
  grasa: { metodo: 'conocido', valor: 27, fuente: 'fiable' },
  actividad_diaria: 'ligero',
  entrenamiento: ent({ tipo: 'fuerza', dias_semana: 4, minutos_sesion: 55, intensidad: 'media', experiencia: 'intermedio', momento: 'tarde' }),
  objetivo: 'recomposicion',
  ritmo: 'moderado',
  n_comidas: 4,
  preferencia_base: 'omnivoro',
  restricciones: [],
  low_carb: false,
  recomposicion_prioridad: 'perder',
  menstruacion: 'regular',
})

// ================================================================= E — preferencias combinables

describe('§1.1 — regla de traducción y regla inversa de las preferencias', () => {
  it('el formato antiguo produce el mismo trío que leía la v1.0', () => {
    const casos: Array<[Inputs['preferencia'], string, string[], boolean]> = [
      ['omnivoro', 'omnivoro', [], false],
      ['vegetariano', 'vegetariano', [], false],
      ['vegano', 'vegano', [], false],
      ['sin_lactosa', 'omnivoro', ['sin_lactosa'], false],
      ['sin_gluten', 'omnivoro', ['sin_gluten'], false],
      ['low_carb', 'omnivoro', [], true],
    ]
    for (const [preferencia, base, restr, low] of casos) {
      const t = normalizarPreferencias(con({ preferencia }))
      expect(t.pref_base, preferencia).toBe(base)
      expect(t.restricciones, preferencia).toEqual(restr)
      expect(t.low_carb_pedido, preferencia).toBe(low)
      // Invariante S29d: `preferencia_efectiva` coincide con lo que devolvía la v1.0.
      expect(calcular(con({ preferencia })).preferencia_efectiva, preferencia).toBe(preferencia)
    }
  })

  it('con `preferencia_base` presente, `preferencia` deja de leerse', () => {
    const t = normalizarPreferencias(
      con({ preferencia: 'low_carb', preferencia_base: 'vegetariano', restricciones: [], low_carb: false }),
    )
    expect(t.pref_base).toBe('vegetariano')
    expect(t.low_carb_pedido).toBe(false)
  })

  it('las restricciones se deduplican y se ordenan (sin_lactosa antes que sin_gluten)', () => {
    const t = normalizarPreferencias(
      con({ preferencia_base: 'omnivoro', restricciones: ['sin_gluten', 'sin_lactosa', 'sin_gluten'] }),
    )
    expect(t.restricciones).toEqual(['sin_lactosa', 'sin_gluten'])
    expect(calcular(con({ preferencia_base: 'omnivoro', restricciones: ['sin_gluten', 'sin_lactosa'] })).restricciones)
      .toEqual(['sin_lactosa', 'sin_gluten'])
  })

  it('la regla inversa elige el banco en el orden de la §1.1', () => {
    expect(bancoDe('omnivoro', [], false)).toBe('omnivoro')
    expect(bancoDe('omnivoro', ['sin_lactosa'], false)).toBe('sin_lactosa')
    // `sin_gluten` manda sobre `sin_lactosa`: su banco cambia la estructura de las plantillas.
    expect(bancoDe('omnivoro', ['sin_lactosa', 'sin_gluten'], false)).toBe('sin_gluten')
    expect(bancoDe('vegetariano', ['sin_gluten'], false)).toBe('vegetariano')
    expect(bancoDe('vegano', ['sin_gluten'], false)).toBe('vegano')
    expect(bancoDe('vegano', [], true)).toBe('low_carb')
  })

  it('las restricciones no cambian ningún número: solo filtran alimentos', () => {
    const sin = calcular(con({ preferencia_base: 'omnivoro', restricciones: [] }))
    const conRestr = calcular(con({ preferencia_base: 'omnivoro', restricciones: ['sin_lactosa', 'sin_gluten'] }))
    expect(conRestr.kcal).toBe(sin.kcal)
    expect(conRestr.macros.proteina_g).toBe(sin.macros.proteina_g)
    expect(conRestr.macros.grasa_g).toBe(sin.macros.grasa_g)
    expect(conRestr.macros.hc_g).toBe(sin.macros.hc_g)
  })

  it('la base multiplica la proteína aunque el banco sea otro (vegano + bajo en hidratos)', () => {
    const veg = calcular(con({ peso_kg: 80, preferencia_base: 'vegano', restricciones: [], low_carb: true }))
    const omn = calcular(con({ peso_kg: 80, preferencia_base: 'omnivoro', restricciones: [], low_carb: true }))
    expect(veg.preferencia_efectiva).toBe('low_carb') // el banco es el low-carb...
    expect(veg.preferencia_base).toBe('vegano') // ...pero la base sigue siendo vegana
    expect(veg.avisos).toContain('INFO_VEGANO')
    expect(veg.macros.proteina_g).toBeGreaterThan(omn.macros.proteina_g)
    expect(veg.low_carb).toBe(true)
    expect(veg.macros.hc_g).toBeGreaterThanOrEqual(75)
  })

  it('`diabetes` anula el interruptor pero no la base ni las restricciones', () => {
    const r = calcular(
      con({ preferencia_base: 'vegetariano', restricciones: ['sin_gluten'], low_carb: true, condiciones: ['diabetes'] }),
    )
    expect(r.low_carb).toBe(false)
    expect(r.preferencia_base).toBe('vegetariano')
    expect(r.restricciones).toEqual(['sin_gluten'])
    expect(r.preferencia_efectiva).toBe('vegetariano')
    expect(r.avisos).toContain('WARN_LOWCARB_DIABETES')
    expect(r.macros.hc_g).toBeGreaterThanOrEqual(130)
  })

  it('los campos nuevos fuera de dominio dan ERR_INPUT_RANGO; ausentes o null, no', () => {
    const malo = calcular({ ...PERFIL_BASE, preferencia_base: 'carnivoro' as never })
    expect(malo.excluido).toBe('ERR_INPUT_RANGO')
    expect(malo.errores).toContain('preferencia_base')
    expect(calcular({ ...PERFIL_BASE, restricciones: ['sin_sal'] as never }).errores).toContain('restricciones')
    expect(calcular({ ...PERFIL_BASE, low_carb: 'si' as never }).errores).toContain('low_carb')
    expect(calcular({ ...PERFIL_BASE, menstruacion: 'a_veces' as never }).errores).toContain('menstruacion')
    expect(calcular({ ...PERFIL_BASE, recomposicion_prioridad: 'todo' as never }).errores).toContain('recomposicion_prioridad')
    // Ausente o `null` es siempre válido.
    const nulos = calcular({
      ...PERFIL_BASE,
      preferencia_base: null,
      restricciones: null,
      low_carb: null,
      menstruacion: null,
      recomposicion_prioridad: null,
    })
    expect(nulos.excluido).toBeUndefined()
  })

  it('`menstruacion` en un hombre se valida pero se ignora', () => {
    const r = calcular(con({ sexo: 'hombre', menstruacion: 'ausente', ritmo: 'agresivo', peso_kg: 95 }))
    expect(r.excluido).toBeUndefined()
    expect(r.ritmo_efectivo).toBe('agresivo')
    expect(r.avisos).not.toContain('INFO_CICLO')
    expect(r.avisos).not.toContain('WARN_CICLO_AUSENTE')
  })
})

// ================================================================= C — prioridad de recomposición

describe('Paso 7 y 9 — recomposición con prioridad (decisión C)', () => {
  const recomp = (prioridad?: Inputs['recomposicion_prioridad']): Resultado =>
    calcular(con({ ...CASO_16, recomposicion_prioridad: prioridad }))

  it('`equilibrado` (y ausente, y null) reproducen exactamente la v1.0', () => {
    const eq = recomp('equilibrado')
    const ausente = recomp(undefined)
    const nulo = recomp(null)
    expect(ausente.kcal).toBe(eq.kcal)
    expect(nulo.kcal).toBe(eq.kcal)
    expect(ausente.macros).toEqual(eq.macros)
    expect(eq.avisos).not.toContain('INFO_RECOMP_PRIORIDAD_PERDER')
    expect(eq.avisos).not.toContain('INFO_RECOMP_PRIORIDAD_GANAR')
    expect(eq.recomposicion_prioridad).toBe('equilibrado')
    // Tabla 3.9[medio] = 7,5 % del TDEE, sin tocar.
    expect(eq.kcal).toBe(1940)
  })

  it('`perder` aprieta el déficit 5 puntos y sube la grasa a costa de los hidratos', () => {
    const p = recomp('perder')
    const eq = recomp('equilibrado')
    expect(p.kcal).toBe(1830) // 12,5 % del TDEE frente al 7,5 %
    expect(p.kcal).toBeLessThan(eq.kcal)
    expect(p.avisos).toContain('INFO_RECOMP_PRIORIDAD_PERDER')
    expect(p.recomposicion_prioridad).toBe('perder')
    // pct_grasa 0,33 en vez de 0,28: más grasa y menos hidratos por kcal.
    expect(p.macros.pct.g).toBeGreaterThan(eq.macros.pct.g)
    expect(p.macros.pct.hc).toBeLessThan(eq.macros.pct.hc)
  })

  it('el déficit de `perder` tiene tope duro del 15 % del TDEE', () => {
    // Banda `alto`/`muy_alto` = 10 % en la tabla 3.9; +5 puntos = 15 %, que es el tope.
    const r = calcular(
      con({ sexo: 'mujer', edad: 30, altura_cm: 165, peso_kg: 85, actividad_diaria: 'ligero',
            entrenamiento: ent({ tipo: 'fuerza', dias_semana: 4, minutos_sesion: 60, intensidad: 'media', experiencia: 'intermedio', momento: 'tarde' }),
            objetivo: 'recomposicion', recomposicion_prioridad: 'perder' }),
    )
    if (r.objetivo_efectivo === 'recomposicion') {
      expect(r.tdee.valor - r.kcal).toBeLessThanOrEqual(0.15 * r.tdee.valor + 10)
    }
  })

  it('`ganar` deja el déficit en cero y exime de la regla de margen', () => {
    const g = recomp('ganar')
    expect(g.objetivo_efectivo).toBe('recomposicion')
    expect(g.kcal).toBe(2090) // round10(TDEE)
    expect(g.avisos).toContain('INFO_RECOMP_PRIORIDAD_GANAR')
    // Sin la exención el plan salía etiquetado `mantener` con un aviso que decía justo lo
    // contrario de lo que el usuario pidió.
    expect(g.avisos).not.toContain('WARN_SIN_MARGEN_DEFICIT')
    expect(g.recomposicion_prioridad).toBe('ganar')
  })

  it('la prioridad se ignora si el objetivo efectivo acaba siendo otro', () => {
    // IMC < 18,5: el guardarraíl 6.3 convierte la recomposición en mantenimiento.
    const r = calcular(con({ sexo: 'mujer', altura_cm: 170, peso_kg: 50, objetivo: 'recomposicion', recomposicion_prioridad: 'perder' }))
    expect(r.objetivo_efectivo).not.toBe('recomposicion')
    expect(r.recomposicion_prioridad).toBeUndefined()
  })

  it('los textos de los dos avisos nuevos existen y no dejan placeholders', () => {
    for (const prioridad of ['perder', 'ganar'] as const) {
      const inputs = con({ ...CASO_16, recomposicion_prioridad: prioridad })
      const t = textosAvisos(calcular(inputs), inputs).find((x) => x.codigo === `INFO_RECOMP_PRIORIDAD_${prioridad.toUpperCase()}`)
      expect(t, prioridad).toBeDefined()
      expect(t?.texto).not.toMatch(/[{}]/)
      expect(t?.texto.length).toBeGreaterThan(50)
    }
  })
})

// ================================================================= D — la regla

describe('Pasos 6.7bis y 17 — la regla (decisión D)', () => {
  const mujer = (o: Partial<Inputs>): Resultado =>
    calcular(con({ sexo: 'mujer', edad: 34, altura_cm: 168, peso_kg: 78, actividad_diaria: 'ligero', objetivo: 'perder', n_comidas: 4, ...o }))

  it('`irregular` y `ausente` suavizan el ritmo agresivo a moderado; el resto no', () => {
    expect(mujer({ ritmo: 'agresivo', menstruacion: 'irregular' }).ritmo_efectivo).toBe('moderado')
    expect(mujer({ ritmo: 'agresivo', menstruacion: 'ausente' }).ritmo_efectivo).toBe('moderado')
    expect(mujer({ ritmo: 'agresivo', menstruacion: 'regular' }).ritmo_efectivo).toBe('agresivo')
    expect(mujer({ ritmo: 'agresivo', menstruacion: 'no_dice' }).ritmo_efectivo).toBe('agresivo')
    expect(mujer({ ritmo: 'agresivo' }).ritmo_efectivo).toBe('agresivo')
    // No toca los ritmos que ya venían suaves.
    expect(mujer({ ritmo: 'suave', menstruacion: 'ausente' }).ritmo_efectivo).toBe('suave')
  })

  it('la regla NO cambia calorías ni macros más allá del ritmo', () => {
    const conRegla = mujer({ ritmo: 'moderado', menstruacion: 'irregular' })
    const sinRegla = mujer({ ritmo: 'moderado' })
    expect(conRegla.kcal).toBe(sinRegla.kcal)
    expect(conRegla.macros.proteina_g).toBe(sinRegla.macros.proteina_g)
    expect(conRegla.macros.grasa_g).toBe(sinRegla.macros.grasa_g)
    expect(conRegla.macros.hc_g).toBe(sinRegla.macros.hc_g)
  })

  it('INFO_CICLO se emite con `regular` e `irregular`, nunca con `ausente` ni `no_dice`', () => {
    expect(mujer({ ritmo: 'moderado', menstruacion: 'regular' }).avisos).toContain('INFO_CICLO')
    expect(mujer({ ritmo: 'moderado', menstruacion: 'irregular' }).avisos).toContain('INFO_CICLO')
    expect(mujer({ ritmo: 'moderado', menstruacion: 'ausente' }).avisos).not.toContain('INFO_CICLO')
    expect(mujer({ ritmo: 'moderado', menstruacion: 'no_dice' }).avisos).not.toContain('INFO_CICLO')
  })

  it('WARN_CICLO_AUSENTE: las tres cláusulas de la condición, contra el objetivo FINAL', () => {
    // (1) objetivo_efectivo === 'perder'
    expect(mujer({ ritmo: 'moderado', menstruacion: 'irregular' }).avisos).toContain('WARN_CICLO_AUSENTE')
    // (2) banda muy_bajo/bajo (aquí el paso 6.3 pasa a recomposición, así que no es `perder`)
    const magra = mujer({ ritmo: 'moderado', menstruacion: 'ausente', grasa: { metodo: 'conocido', valor: 18, fuente: 'fiable' }, peso_kg: 60 })
    expect(magra.objetivo_efectivo).not.toBe('perder')
    expect(magra.grasa.banda === 'muy_bajo' || magra.grasa.banda === 'bajo').toBe(true)
    expect(magra.avisos).toContain('WARN_CICLO_AUSENTE')
    // (3) el ritmo ELEGIDO por el usuario, no el suavizado
    const mantiene = mujer({ objetivo: 'mantener', ritmo: 'agresivo', menstruacion: 'ausente' })
    expect(mantiene.objetivo_efectivo).toBe('mantener')
    expect(mantiene.avisos).toContain('WARN_CICLO_AUSENTE')
    // Ninguna de las tres: no se emite.
    const nada = mujer({ objetivo: 'mantener', ritmo: 'moderado', menstruacion: 'ausente', grasa: { metodo: 'conocido', valor: 30, fuente: 'fiable' } })
    expect(nada.avisos).not.toContain('WARN_CICLO_AUSENTE')
  })

  it('INFO_CICLO y WARN_CICLO_AUSENTE pueden coexistir (regla irregular en déficit)', () => {
    const r = calcular(CASO_15)
    expect(r.avisos).toContain('INFO_CICLO')
    expect(r.avisos).toContain('WARN_CICLO_AUSENTE')
  })

  it('el fragmento del ritmo de WARN_CICLO_AUSENTE solo aparece si se ha suavizado', () => {
    const textoDe = (inputs: Inputs): string =>
      textosAvisos(calcular(inputs), inputs).find((t) => t.codigo === 'WARN_CICLO_AUSENTE')?.texto ?? ''
    const agresivo = con({ ...CASO_15, ritmo: 'agresivo' })
    expect(textoDe(agresivo)).toContain('Hemos suavizado el ritmo a moderado.')
    const moderado = con({ ...CASO_15, ritmo: 'moderado' })
    expect(textoDe(moderado)).not.toContain('suavizado el ritmo')
    expect(textoDe(moderado)).not.toMatch(/[{}]/)
  })
})

// ================================================================= F — proyección

describe('Paso 14b — proyección semana a semana (decisión F)', () => {
  // Tabla normativa del caso 15 de la §5: 23 puntos, de la semana 0 a la 22 = semanas[1].
  const CURVA_15: Array<[number, number, number, number]> = [
    [0, 78.0, 78.0, 78.0], [1, 77.4, 77.4, 77.5], [2, 76.8, 76.9, 77.0], [3, 76.2, 76.3, 76.5],
    [4, 75.7, 75.8, 76.0], [5, 75.1, 75.2, 75.5], [6, 74.5, 74.7, 75.0], [7, 73.9, 74.2, 74.5],
    [8, 73.3, 73.7, 74.0], [9, 73.3, 73.7, 74.0], [10, 72.7, 73.2, 73.5], [11, 72.2, 72.7, 73.0],
    [12, 71.6, 72.2, 72.5], [13, 71.0, 71.7, 72.0], [14, 70.4, 71.3, 71.5], [15, 69.8, 70.8, 71.0],
    [16, 69.2, 70.3, 70.5], [17, 68.7, 69.9, 70.0], [18, 68.7, 69.9, 70.0], [19, 68.1, 69.5, 69.5],
    [20, 68.0, 69.0, 69.0], [21, 68.0, 68.5, 68.5], [22, 68.0, 68.0, 68.0],
  ]

  it('caso 15: la curva coincide campo a campo con la tabla normativa', () => {
    const r = calcular(CASO_15)
    const p = r.proyeccion
    expect(p).toBeDefined()
    expect(p).toHaveLength(CURVA_15.length)
    CURVA_15.forEach(([semana, min, esp, max], i) => {
      expect(p?.[i].semana, `semana ${semana}`).toBe(semana)
      expect(p?.[i].peso_min, `peso_min semana ${semana}`).toBe(min)
      expect(p?.[i].peso_esp, `peso_esp semana ${semana}`).toBe(esp)
      expect(p?.[i].peso_max, `peso_max semana ${semana}`).toBe(max)
    })
    // Los dos extremos de la banda SON los dos extremos del cronograma.
    expect(r.cronograma?.semanas).toEqual([20, 22])
    expect(p?.[20].peso_min).toBe(68.0) // semanas[0]: la curva optimista alcanza la meta
    expect(p?.[22].peso_max).toBe(68.0) // semanas[1]: también la pesimista
    // Aplanamientos de los dos diet breaks (semanas 9 y 18): una semana a mantenimiento no
    // mueve el peso, así que los tres valores repiten los de la semana anterior.
    const pesos = (i: number) => [p?.[i].peso_min, p?.[i].peso_esp, p?.[i].peso_max]
    expect(pesos(9)).toEqual(pesos(8))
    expect(pesos(18)).toEqual(pesos(17))
  })

  it('los hitos de 4, 8 y 12 semanas son entradas del array, sin cálculo extra', () => {
    const p = calcular(CASO_15).proyeccion ?? []
    for (const s of [4, 8, 12]) {
      const punto = p.find((x) => x.semana === s)
      expect(punto, `hito ${s}`).toBeDefined()
      expect(p[s]).toBe(punto)
    }
  })

  it('sin cronograma la proyección es plana: 13 puntos y ±1 kg desde la semana 1', () => {
    const r = calcular(CASO_16)
    expect(r.cronograma).toBeNull()
    expect(r.avisos).toContain('INFO_PROYECCION_PLANA')
    const p = r.proyeccion ?? []
    expect(p).toHaveLength(13)
    expect(p[0]).toEqual({ semana: 0, peso_min: 64.0, peso_esp: 64.0, peso_max: 64.0 })
    for (let s = 1; s <= 12; s++) {
      expect(p[s]).toEqual({ semana: s, peso_min: 63.0, peso_esp: 64.0, peso_max: 65.0 })
    }
  })

  it("con 'tca' no se publica proyección ni INFO_PROYECCION_PLANA (regla no expuesta)", () => {
    const r = calcular(con({ sexo: 'mujer', altura_cm: 165, peso_kg: 78, condiciones: ['tca'], objetivo: 'perder' }))
    expect(r.proyeccion).toBeUndefined()
    expect(r.avisos).not.toContain('INFO_PROYECCION_PLANA')
    expect(r.limites_ajuste).toBeUndefined()
  })

  it('invariantes S26 sobre un barrido de perfiles válidos', () => {
    let casos = 0
    for (const sexo of ['hombre', 'mujer'] as const) {
      for (const edad of [20, 40, 65]) {
        for (const peso of [50, 70, 95, 130]) {
          for (const objetivo of ['perder', 'mantener', 'ganar', 'recomposicion'] as const) {
            for (const pobj of [null, peso - 12, peso + 6]) {
              const r = calcular(con({ sexo, edad, altura_cm: 170, peso_kg: peso, objetivo, peso_objetivo: pobj,
                actividad_diaria: 'moderado',
                entrenamiento: ent({ tipo: 'fuerza', dias_semana: 3, minutos_sesion: 60, intensidad: 'media', experiencia: 'intermedio', momento: 'tarde' }) }))
              if (r.excluido) continue
              casos++
              const p = r.proyeccion
              expect(p, 'la proyección se calcula siempre').toBeDefined()
              if (!p) continue
              expect(p.length).toBeGreaterThan(1)
              expect(p.length - 1).toBeLessThanOrEqual(26) // nunca pasa de la semana 26
              expect(p[0]).toEqual({ semana: 0, peso_min: Math.round(peso * 10) / 10, peso_esp: Math.round(peso * 10) / 10, peso_max: Math.round(peso * 10) / 10 })
              p.forEach((q, i) => {
                expect(q.semana).toBe(i) // semanas correlativas desde 0
                expect(Number.isFinite(q.peso_min) && Number.isFinite(q.peso_esp) && Number.isFinite(q.peso_max)).toBe(true)
                expect(q.peso_min).toBeLessThanOrEqual(q.peso_esp)
                expect(q.peso_esp).toBeLessThanOrEqual(q.peso_max)
                if (i > 0 && r.cronograma) {
                  const a = p[i - 1]
                  // Monótona HACIA el objetivo: no sube nunca en `perder` ni baja en `ganar`.
                  if (r.objetivo_efectivo === 'perder') {
                    expect(q.peso_min).toBeLessThanOrEqual(a.peso_min + 1e-9)
                    expect(q.peso_max).toBeLessThanOrEqual(a.peso_max + 1e-9)
                  } else if (r.objetivo_efectivo === 'ganar') {
                    expect(q.peso_min).toBeGreaterThanOrEqual(a.peso_min - 1e-9)
                    expect(q.peso_max).toBeGreaterThanOrEqual(a.peso_max - 1e-9)
                  }
                }
              })
              if (r.cronograma && r.peso_objetivo.efectivo !== null) {
                const meta = Math.round(r.peso_objetivo.efectivo * 10) / 10
                const ult = p[p.length - 1]
                // Nunca sobrepasa la meta.
                if (r.objetivo_efectivo === 'perder') expect(ult.peso_min).toBeGreaterThanOrEqual(meta - 0.051)
                if (r.objetivo_efectivo === 'ganar') expect(ult.peso_max).toBeLessThanOrEqual(meta + 0.051)
              } else {
                expect(r.avisos).toContain('INFO_PROYECCION_PLANA')
              }
            }
          }
        }
      }
    }
    expect(casos).toBeGreaterThan(100)
  })
})

// ================================================================= B — ajuste manual

describe('Paso 18 — ajustarMacros (decisión B)', () => {
  it('caso 16: `{ hc_g: 120 }` reproduce la tabla normativa de la §5', () => {
    const r = calcular(CASO_16)
    const L = r.limites_ajuste
    expect(L).toBeDefined()
    expect(L?.kcal_recomendada).toBe(1830)
    expect(L?.hc_recomendado_g).toBe(180)
    expect(L?.grasa_recomendada_g).toBe(65)
    expect(L?.kcal_min).toBe(1540)
    expect(L?.kcal_max).toBe(2200)
    expect(L?.kcal_paso).toBe(50)
    expect(L?.hc_min_ui_g).toBe(30)
    expect(L?.hc_min_motor_g).toBe(130)
    expect(L?.suelo_grasa_abs_g).toBeCloseTo(51.2, 6)
    expect(L?.peso_kg).toBe(64)
    expect(L?.fecha_inicio).toBe(FECHA)
    expect(L?.kcal_micronutrientes).toBe(1500)

    const a = ajustarMacros(r, { hc_g: 120 })
    expect(a.kcal).toBe(1830) // las calorías no se han tocado
    expect(a.kcal_cierre).toBe(1810)
    expect(a.macros.proteina_g).toBe(130) // intacta, por definición
    expect(a.macros.grasa_g).toBe(90) // el resto: round5((1830 − 520 − 480)/9) = 90
    expect(a.macros.hc_g).toBe(120)
    expect(a.macros.fibra_g).toBe(26)
    expect(a.ajuste).toEqual({ kcal: false, hc: true })
    expect(a.comidas.map((c) => [c.proteina_g, c.grasa_g, c.hc_g, c.kcal])).toEqual([
      [35, 25, 30, 485],
      [35, 25, 30, 485],
      [20, 15, 25, 315],
      [40, 25, 35, 525],
    ])
    // La columna de proteína es idéntica a la del plan recomendado.
    expect(a.comidas.map((c) => c.proteina_g)).toEqual(r.comidas.map((c) => c.proteina_g))
    expect([...a.avisos].sort()).toEqual([...r.avisos, 'INFO_AJUSTE_MANUAL', 'WARN_HC_BAJO_MINIMO'].sort())
  })

  it('idempotencia respecto al origen y "volver a lo recomendado" bit a bit (S27l y S27m)', () => {
    const r = calcular(CASO_16)
    const a = ajustarMacros(r, { hc_g: 120 })
    expect(normalizado(ajustarMacros(a, { hc_g: 120 }))).toEqual(normalizado(a))
    expect(normalizado(ajustarMacros(a, {}))).toEqual(normalizado(r))
    expect(normalizado(ajustarMacros(r, {}))).toEqual(normalizado(r))
    expect(ajustarMacros(a, {}).ajuste).toBeUndefined()
    // ajustarMacros(ajustarMacros(R, a1), a2) === ajustarMacros(R, a2)
    const a1 = ajustarMacros(r, { kcal: 1600, hc_g: 60 })
    expect(normalizado(ajustarMacros(a1, { hc_g: 120 }))).toEqual(normalizado(a))
  })

  it("con 'tca' (sin `limites_ajuste`) y con `excluido` devuelve el resultado tal cual", () => {
    const tca = calcular(con({ sexo: 'mujer', altura_cm: 165, peso_kg: 78, condiciones: ['tca'], objetivo: 'perder' }))
    expect(ajustarMacros(tca, { hc_g: 50 })).toBe(tca)
    const excluido = calcular(con({ edad: 16 }))
    expect(ajustarMacros(excluido, { kcal: 2000 })).toBe(excluido)
  })

  it('las calorías se recortan a [kcal_min, kcal_max] y a múltiplos de 10', () => {
    const r = calcular(CASO_15)
    const L = r.limites_ajuste
    expect(L?.kcal_min).toBe(1500)
    expect(L?.kcal_max).toBe(2240) // en `perder`, el techo es el TDEE
    expect(ajustarMacros(r, { kcal: 100 }).kcal).toBe(1500)
    expect(ajustarMacros(r, { kcal: 9000 }).kcal).toBe(2240)
    expect(ajustarMacros(r, { kcal: 1743 }).kcal).toBe(1740)
    // El plan recomendado SIEMPRE cabe dentro de sus propios límites.
    expect(L?.kcal_min).toBeLessThanOrEqual(r.kcal)
    expect(L?.kcal_max).toBeGreaterThanOrEqual(r.kcal)
  })

  it('la proteína no se toca nunca y la grasa nunca baja de su suelo', () => {
    const r = calcular(CASO_15)
    const L = r.limites_ajuste
    if (!L) throw new Error('sin límites de ajuste')
    for (const ajuste of [{ hc_g: 0 }, { hc_g: 30 }, { hc_g: 500 }, { kcal: 1500 }, { kcal: 2240, hc_g: 30 }] as AjusteMacros[]) {
      const a = ajustarMacros(r, ajuste)
      expect(a.macros.proteina_g, JSON.stringify(ajuste)).toBe(r.macros.proteina_g)
      const suelo = Math.max(L.suelo_grasa_abs_g, 0.20 * a.kcal / 9)
      expect(a.macros.grasa_g, JSON.stringify(ajuste)).toBeGreaterThanOrEqual(suelo)
      // Cierre dentro del 2 % (hasta 22,5 kcal con dos macros redondeados a 5 g).
      expect(Math.abs(a.kcal_cierre - a.kcal)).toBeLessThanOrEqual(0.02 * a.kcal)
      expect(Math.abs(a.kcal_cierre - a.kcal)).toBeLessThanOrEqual(25)
    }
  })

  it('el deslizador de hidratos llega a 30 g salvo que el suelo de grasa lo impida', () => {
    const r = calcular(CASO_16)
    const bajo = ajustarMacros(r, { hc_g: 0 })
    expect(bajo.macros.hc_g).toBe(30)
    expect(bajo.avisos).toContain('WARN_HC_BAJO_MINIMO')
    // El techo de grasa del paso 9 NO se aplica aquí: es deliberado (§ paso 18).
    expect(9 * bajo.macros.grasa_g).toBeGreaterThan(0.40 * bajo.kcal)
  })

  it('WARN_HC_BAJO_MINIMO avisa pero no bloquea, y su texto imprime el mínimo real', () => {
    const lowcarb = calcular(con({ peso_kg: 85, preferencia_base: 'omnivoro', restricciones: [], low_carb: true }))
    expect(lowcarb.limites_ajuste?.hc_min_motor_g).toBe(75)
    const a = ajustarMacros(lowcarb, { hc_g: 40 })
    expect(a.macros.hc_g).toBe(40) // no bloquea
    expect(a.avisos).toContain('WARN_HC_BAJO_MINIMO')
    const t = textosAvisos(a, PERFIL_BASE).find((x) => x.codigo === 'WARN_HC_BAJO_MINIMO')
    expect(t?.texto).toContain('75 g')
    expect(t?.texto).not.toMatch(/[{}]/)
    const normal = ajustarMacros(calcular(CASO_16), { hc_g: 120 })
    expect(textosAvisos(normal, CASO_16).find((x) => x.codigo === 'WARN_HC_BAJO_MINIMO')?.texto).toContain('130 g')
  })

  it('subir las calorías al TDEE emite WARN_KCAL_AJUSTE_ALTA y suprime WARN_DEFICIT_MINIMO', () => {
    const r = calcular(CASO_15)
    const a = ajustarMacros(r, { kcal: 2240 })
    expect(r.tdee.valor - a.kcal).toBeLessThan(100)
    expect(a.avisos).toContain('WARN_KCAL_AJUSTE_ALTA')
    expect(a.avisos).not.toContain('WARN_DEFICIT_MINIMO')
    expect(a.avisos).toContain('INFO_AJUSTE_MANUAL')
    const t = textosAvisos(a, CASO_15).find((x) => x.codigo === 'WARN_KCAL_AJUSTE_ALTA')
    expect(t?.texto).not.toMatch(/[{}]/)
  })

  it('el cronograma y la proyección se rehacen con las kcal ajustadas; el peso objetivo no se mueve', () => {
    const r = calcular(CASO_15)
    const a = ajustarMacros(r, { kcal: 1500 }) // más déficit ⇒ menos semanas
    expect(a.peso_objetivo).toEqual(r.peso_objetivo)
    expect(a.tdee).toEqual(r.tdee)
    expect(a.agua).toEqual(r.agua)
    expect(a.ffmi).toEqual(r.ffmi)
    expect(a.grasa).toEqual(r.grasa)
    expect(a.objetivo_efectivo).toBe(r.objetivo_efectivo)
    expect(a.limites_ajuste).toEqual(r.limites_ajuste) // se copia tal cual, nunca se recalcula
    expect(a.cronograma).not.toBeNull()
    expect((a.cronograma?.semanas[0] ?? 0)).toBeLessThan(r.cronograma?.semanas[0] ?? 0)
    expect(a.proyeccion?.length).toBe((a.cronograma?.semanas[1] ?? 0) + 1)
    expect(a.proyeccion?.[0].peso_esp).toBe(78)
  })

  it('INFO_MICRONUTRIENTES e INFO_FIBRA_AJUSTADA se reevalúan con el ajuste', () => {
    const r = calcular(CASO_16) // 1830 kcal: por encima del umbral de 1500, fibra 26
    expect(r.avisos).not.toContain('INFO_MICRONUTRIENTES')
    expect(r.avisos).not.toContain('INFO_FIBRA_AJUSTADA')
    const bajo = ajustarMacros(r, { kcal: 1540, hc_g: 60 })
    expect(bajo.kcal).toBe(1540)
    expect(bajo.avisos).toContain('INFO_FIBRA_AJUSTADA')
    expect(bajo.macros.fibra_g).toBeLessThan(25)
    // Y al volver, desaparecen.
    expect(ajustarMacros(bajo, {}).avisos).not.toContain('INFO_FIBRA_AJUSTADA')
  })

  it('barrido de invariantes del ajuste sobre perfiles y ajustes variados', () => {
    const ajustes: AjusteMacros[] = [
      {}, { hc_g: 30 }, { hc_g: 60 }, { hc_g: 120 }, { hc_g: 400 },
      { kcal: 1200 }, { kcal: 3000 }, { kcal: 1800, hc_g: 40 }, { kcal: 2400, hc_g: 300 },
    ]
    let casos = 0
    for (const sexo of ['hombre', 'mujer'] as const) {
      for (const peso of [55, 75, 100, 140]) {
        for (const objetivo of ['perder', 'mantener', 'ganar', 'recomposicion'] as const) {
          for (const low_carb of [false, true]) {
            const inputs = con({ sexo, peso_kg: peso, altura_cm: 172, edad: 35, objetivo,
              peso_objetivo: objetivo === 'perder' ? peso - 10 : null,
              actividad_diaria: 'moderado',
              entrenamiento: ent({ tipo: 'fuerza', dias_semana: 4, minutos_sesion: 60, intensidad: 'media', experiencia: 'intermedio', momento: 'tarde' }),
              preferencia_base: 'omnivoro', restricciones: [], low_carb })
            const r = calcular(inputs)
            if (r.excluido) continue
            const L = r.limites_ajuste
            expect(L, 'limites_ajuste se publica siempre sin tca').toBeDefined()
            if (!L) continue
            expect(L.kcal_min).toBeLessThanOrEqual(L.kcal_max)
            expect(L.kcal_min).toBeLessThanOrEqual(r.kcal)
            expect(L.kcal_max).toBeGreaterThanOrEqual(r.kcal)
            for (const ajuste of ajustes) {
              casos++
              const a = ajustarMacros(r, ajuste)
              const etiqueta = `${sexo}/${peso}/${objetivo}/${low_carb}/${JSON.stringify(ajuste)}`
              // S27a: la proteína nunca cambia.
              expect(a.macros.proteina_g, etiqueta).toBe(r.macros.proteina_g)
              // S27b: las kcal caen dentro de los límites y son múltiplo de 10.
              expect(a.kcal, etiqueta).toBeGreaterThanOrEqual(L.kcal_min)
              expect(a.kcal, etiqueta).toBeLessThanOrEqual(L.kcal_max)
              expect(a.kcal % 10, etiqueta).toBe(0)
              // S27c: los hidratos son múltiplo de 5 y nunca bajan de 30 g salvo por el suelo de grasa.
              expect(a.macros.hc_g % 5, etiqueta).toBe(0)
              // S27d: el suelo de grasa es inviolable.
              const suelo = Math.max(L.suelo_grasa_abs_g, 0.20 * a.kcal / 9)
              expect(a.macros.grasa_g, etiqueta).toBeGreaterThanOrEqual(suelo)
              expect(a.macros.grasa_g % 5, etiqueta).toBe(0)
              // S27e: cierre dentro del 2 % y sin NaN.
              expect(Math.abs(a.kcal_cierre - a.kcal), etiqueta).toBeLessThanOrEqual(0.02 * a.kcal)
              for (const v of [a.macros.grasa_g, a.macros.hc_g, a.macros.fibra_g, a.kcal_cierre]) {
                expect(Number.isFinite(v), etiqueta).toBe(true)
              }
              // S27f: el reparto por comidas vuelve a sumar el total.
              expect(a.comidas.reduce((x, c) => x + c.proteina_g, 0), etiqueta).toBe(a.macros.proteina_g)
              expect(a.comidas.reduce((x, c) => x + c.grasa_g, 0), etiqueta).toBe(a.macros.grasa_g)
              expect(a.comidas.reduce((x, c) => x + c.hc_g, 0), etiqueta).toBe(a.macros.hc_g)
              // S27g: los avisos del ajuste se corresponden con lo que se aplicó.
              const ajustado = a.kcal !== L.kcal_recomendada || a.macros.hc_g !== L.hc_recomendado_g
              expect(a.avisos.includes('INFO_AJUSTE_MANUAL'), etiqueta).toBe(ajustado)
              expect(a.ajuste !== undefined, etiqueta).toBe(ajustado)
              expect(a.avisos.includes('WARN_HC_BAJO_MINIMO'), etiqueta).toBe(a.macros.hc_g < L.hc_min_motor_g)
              if (a.avisos.includes('WARN_KCAL_AJUSTE_ALTA')) {
                expect(a.avisos, etiqueta).not.toContain('WARN_DEFICIT_MINIMO')
              }
              // S27l/S27m: idempotencia respecto al origen.
              expect(normalizado(ajustarMacros(a, ajuste)), etiqueta).toEqual(normalizado(a))
              expect(normalizado(ajustarMacros(a, {})), etiqueta).toEqual(normalizado(r))
            }
          }
        }
      }
    }
    expect(casos).toBeGreaterThan(200)
  })
})
