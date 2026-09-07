// Costuras de la v1.1: cuestionario → motor → menús → ajuste manual → seguimiento.
//
// Cada módulo tiene sus propios tests, pero nadie prueba la cadena entera tal como la recorre la
// interfaz: un borrador de la v1.0 restaurado de `localStorage`, convertido a `InputCalculo`,
// calculado, servido de menú, ajustado a mano con `ajustarMacros` y contrastado con los pesajes
// guardados en este dispositivo. Los fallos de integración (un campo nuevo que la UI no envía, un
// ajuste que no rehace el menú, una proyección que no casa con la fecha de arranque) solo se ven
// aquí.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { calcular, textosAvisos } from '../engine'
import type { Pesaje } from '../engine/types'
import { alimentoPorId } from '../data/foods'
import { generarEjemplos } from '../meals'
import { pasaPerfil, perfilDeInputs } from '../meals/filtros'
import {
  CLAVE_ALMACEN,
  aInputs,
  anclarPlan,
  borradorInicial,
  cargarBorrador,
  type Borrador,
} from '../components/wizard/borrador'
import {
  aplicarAjuste,
  cargarAjuste,
  firmaDeInputs,
  guardarAjuste,
  hayPanelAjuste,
} from '../components/resultados/ajuste'
import { calcularBalance, cargarPesajes, guardarPesajes } from '../components/resultados/seguimiento'

const almacen = new Map<string, string>()
vi.stubGlobal('window', {
  localStorage: {
    getItem: (clave: string) => almacen.get(clave) ?? null,
    setItem: (clave: string, valor: string) => void almacen.set(clave, valor),
    removeItem: (clave: string) => void almacen.delete(clave),
  },
})

beforeEach(() => almacen.clear())

/** Un cuestionario contestado entero, ya anclado en su día de arranque. */
function borradorCompleto(cambios: Partial<Borrador> = {}): Borrador {
  return anclarPlan({
    ...borradorInicial(),
    sexo: 'hombre',
    edad: '38',
    altura_cm: '178',
    peso_kg: '86',
    sinCondiciones: true,
    grasa: { ...borradorInicial().grasa, metodo: 'desconocido' },
    somatotipoElegido: 'saltar',
    actividad_diaria: 'ligero',
    entrena: true,
    entrenamiento: {
      tipo: 'fuerza',
      dias_semana: 4,
      minutos_sesion: 60,
      intensidad: 'media',
      experiencia: 'intermedio',
      momento: 'tarde',
      momentoRespondido: true,
    },
    objetivo: 'perder',
    ritmo: 'moderado',
    quierePesoObjetivo: false,
    n_comidas: 4,
    fecha_inicio: '2026-09-07',
    peso_inicio: '86',
    ...cambios,
  })
}

/** Todo lo que el usuario acaba viendo del menú: platos, equivalencias y lista de la compra. */
function idsVisibles(e: ReturnType<typeof generarEjemplos>): { id: string; donde: string }[] {
  const ids: { id: string; donde: string }[] = []
  for (const c of e.entreno.comidas) {
    for (const a of c.alimentos) ids.push({ id: a.id, donde: c.comida })
  }
  for (const t of e.equivalencias?.tablas ?? []) {
    for (const f of t.filas) ids.push({ id: f.id, donde: t.titulo })
  }
  for (const item of e.compra?.items ?? []) ids.push({ id: item.alimento_id, donde: 'compra' })
  return ids
}

describe('un borrador de la v1.0 sigue funcionando de punta a punta', () => {
  it('"sin gluten" del cuestionario viejo llega al menú como restricción', () => {
    // Exactamente lo que dejó la v1.0 en el navegador de quien ya usó la calculadora: una sola
    // `preferencia`, el cribado del paso 5b y ninguno de los tres campos nuevos.
    const viejo: Record<string, unknown> = { ...borradorCompleto(), preferencia: 'sin_gluten' }
    delete viejo.preferencia_base
    delete viejo.restricciones
    delete viejo.low_carb
    viejo.cribado = { q1: 'si', q2: 'no', q3: 'no' }
    almacen.set(CLAVE_ALMACEN, JSON.stringify(viejo))

    const inputs = aInputs(cargarBorrador())
    expect(inputs.restricciones).toEqual(['sin_gluten'])
    expect(inputs.preferencia).toBe('sin_gluten')
    // Decisión A: ningún camino de la interfaz puede volver a producir 'tca'.
    expect(inputs.cribado_tca).toBeNull()

    const resultado = calcular(inputs)
    expect(resultado.excluido).toBeUndefined()
    // Y, por tanto, el panel de ajuste existe también para él: el motor solo lo retira con
    // `'tca' ∈ condiciones`, que la v1.1 ya no puede producir (§2.2b).
    expect(hayPanelAjuste(resultado)).toBe(true)

    const ejemplos = generarEjemplos(inputs, resultado)
    const perfil = perfilDeInputs(inputs, resultado.preferencia_efectiva)
    expect(idsVisibles(ejemplos).length).toBeGreaterThan(0)
    for (const { id, donde } of idsVisibles(ejemplos)) {
      const alimento = alimentoPorId(id)
      expect(alimento, id).toBeDefined()
      expect(pasaPerfil(alimento!, perfil), `${donde}: ${id}`).toBe(true)
    }
  })

  it('un cribado positivo guardado ya no oculta el %grasa ni el peso objetivo', () => {
    const viejo = {
      ...borradorCompleto({ quierePesoObjetivo: true, peso_objetivo: '78' }),
      cribado: { q1: 'si', q2: 'si', q3: 'si' },
    }
    almacen.set(CLAVE_ALMACEN, JSON.stringify(viejo))
    const resultado = calcular(aInputs(cargarBorrador()))
    expect(resultado.excluido).toBeUndefined()
    // Las dos "protecciones" de la v1.0 desaparecen: %grasa y peso objetivo se enseñan siempre.
    expect(resultado.grasa.pct).toBeGreaterThan(0)
    expect(resultado.peso_objetivo.efectivo).toBe(78)
    expect(resultado.proyeccion).toBeDefined()
  })
})

describe('los campos nuevos del cuestionario llegan al motor', () => {
  it('la prioridad de recomposición cambia el plan y se anuncia', () => {
    const inputsDe = (prioridad: 'perder' | 'equilibrado' | 'ganar') =>
      aInputs(borradorCompleto({ objetivo: 'recomposicion', recomposicion_prioridad: prioridad }))
    const equilibrado = calcular(inputsDe('equilibrado'))
    const perder = calcular(inputsDe('perder'))
    const ganar = calcular(inputsDe('ganar'))
    expect(perder.kcal).toBeLessThan(equilibrado.kcal)
    expect(ganar.kcal).toBeGreaterThan(equilibrado.kcal)
    expect(perder.avisos).toContain('INFO_RECOMP_PRIORIDAD_PERDER')
    // El aviso llega a la pantalla con texto, no solo como código.
    expect(textosAvisos(perder, inputsDe('perder')).map((a) => a.codigo)).toContain(
      'INFO_RECOMP_PRIORIDAD_PERDER',
    )
  })

  it('la regla no cambia números, pero sí produce la tarjeta del ciclo', () => {
    const mujer = borradorCompleto({
      sexo: 'mujer',
      peso_kg: '68',
      peso_inicio: '68',
      altura_cm: '165',
    })
    const sinRegla = calcular(aInputs({ ...mujer, menstruacion: null }))
    const conRegla = calcular(aInputs({ ...mujer, menstruacion: 'regular' }))
    expect(conRegla.kcal).toBe(sinRegla.kcal)
    expect(conRegla.macros).toEqual(sinRegla.macros)
    expect(conRegla.avisos).toContain('INFO_CICLO')
    expect(sinRegla.avisos).not.toContain('INFO_CICLO')
  })

  it('la regla ausente con déficit suaviza el ritmo agresivo y avisa', () => {
    const mujer = borradorCompleto({
      sexo: 'mujer',
      peso_kg: '58',
      peso_inicio: '58',
      altura_cm: '167',
      ritmo: 'agresivo',
      menstruacion: 'ausente',
    })
    const resultado = calcular(aInputs(mujer))
    expect(resultado.avisos).toContain('WARN_CICLO_AUSENTE')
    expect(resultado.ritmo_efectivo).not.toBe('agresivo')
  })
})

describe('ajuste manual: la pantalla y el motor dicen lo mismo', () => {
  const inputs = aInputs(borradorCompleto())
  const base = calcular(inputs)

  it('bajar los hidratos rehace el menú y la lista de la compra', () => {
    expect(hayPanelAjuste(base)).toBe(true)
    const limites = base.limites_ajuste!
    const objetivoHc = Math.max(limites.hc_min_motor_g - 20, limites.hc_min_ui_g)
    const ajustado = aplicarAjuste(base, { hc_g: objetivoHc })
    expect(ajustado.macros.proteina_g).toBe(base.macros.proteina_g)
    expect(ajustado.macros.hc_g).toBe(objetivoHc)
    expect(ajustado.macros.grasa_g).toBeGreaterThan(base.macros.grasa_g)

    const hcDe = (e: ReturnType<typeof generarEjemplos>) => e.entreno.totales.carb
    const menuBase = generarEjemplos(inputs, base)
    const menuAjustado = generarEjemplos(inputs, ajustado)
    expect(hcDe(menuAjustado)).toBeLessThan(hcDe(menuBase))
    expect(menuAjustado.compra?.items.length ?? 0).toBeGreaterThan(0)
  })

  it('"volver a lo recomendado" devuelve el plan del motor tal cual', () => {
    expect(aplicarAjuste(base, null)).toBe(base)
    expect(aplicarAjuste(base, {})).toBe(base)
  })

  it('el ajuste guardado solo vale mientras los datos no cambien', () => {
    guardarAjuste({ hc_g: 120 })
    expect(cargarAjuste()).toEqual({ hc_g: 120 })
    // Misma huella con las mismas respuestas (la fecha de arranque está anclada, no es "hoy").
    expect(firmaDeInputs(aInputs(borradorCompleto()))).toBe(firmaDeInputs(inputs))
    // Y huella distinta en cuanto el usuario dice otro peso.
    const otros = aInputs(borradorCompleto({ peso_kg: '84', peso_inicio: '84' }))
    expect(firmaDeInputs(otros)).not.toBe(firmaDeInputs(inputs))
  })
})

describe('seguimiento local sobre la proyección real del motor', () => {
  it('un pesaje en el peso esperado cae dentro de la banda de su semana', () => {
    const borrador = borradorCompleto()
    const inputs = aInputs(borrador)
    const resultado = calcular(inputs)
    const proyeccion = resultado.proyeccion
    expect(proyeccion, 'el motor tiene que publicar la proyección').toBeDefined()
    expect(proyeccion!.length).toBeGreaterThan(1)

    const semana4 = proyeccion!.find((p) => p.semana === 4)
    expect(semana4).toBeDefined()
    const pesajes: Pesaje[] = [
      { fecha: borrador.fecha_inicio, kg: 86 },
      // Cuatro semanas justas después del arranque, en el peso esperado.
      { fecha: '2026-10-05', kg: semana4!.peso_esp },
    ]
    guardarPesajes(pesajes)
    expect(cargarPesajes()).toEqual(pesajes)

    const balance = calcularBalance(
      pesajes,
      proyeccion!,
      resultado.objetivo_efectivo,
      borrador.fecha_inicio,
      resultado.cronograma === null,
    )
    expect(balance).not.toBeNull()
    expect(balance!.semana).toBe(4)
    expect(balance!.estado).toBe('en_banda')
  })
})
