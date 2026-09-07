// El cuestionario de la v1.1: fuera el cribado, dentro la regla, la prioridad de recomposición
// y las preferencias combinables. Se comprueba también que un borrador guardado con la v1.0
// (una sola `preferencia`) se restaura sin perder la respuesta.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CLAVE_ALMACEN,
  aInputs,
  anclarPlan,
  borradorInicial,
  cargarBorrador,
  cargarSesion,
  estadoPaso,
  guardarPasoSesion,
  guardarSesion,
  pasoDeCampo,
  pasosVisibles,
  preferenciaHeredada,
  type Borrador,
} from '../borrador'

// El proyecto no arrastra jsdom: basta con un `localStorage` de mentira.
const almacen = new Map<string, string>()
vi.stubGlobal('window', {
  localStorage: {
    getItem: (clave: string) => almacen.get(clave) ?? null,
    setItem: (clave: string, valor: string) => void almacen.set(clave, valor),
    removeItem: (clave: string) => void almacen.delete(clave),
  },
})

/** Un cuestionario contestado de punta a punta. */
function completo(cambios: Partial<Borrador> = {}): Borrador {
  return {
    ...borradorInicial(),
    sexo: 'hombre',
    edad: '35',
    altura_cm: '178',
    peso_kg: '80',
    sinCondiciones: true,
    grasa: { ...borradorInicial().grasa, metodo: 'desconocido' },
    somatotipoElegido: 'saltar',
    actividad_diaria: 'ligero',
    entrena: false,
    objetivo: 'mantener',
    ...cambios,
  }
}

beforeEach(() => almacen.clear())

describe('mapa de pasos', () => {
  it('el cribado del paso 5b ya no existe para nadie', () => {
    expect(pasosVisibles(completo())).not.toContain('cribado' as never)
    expect(pasosVisibles(completo({ sexo: 'mujer' }))).not.toContain('cribado' as never)
  })

  it('la regla solo se pregunta a mujeres, justo detrás de embarazo o lactancia', () => {
    const mujer = pasosVisibles(completo({ sexo: 'mujer' }))
    expect(mujer.indexOf('regla')).toBe(mujer.indexOf('embarazo') + 1)
    expect(pasosVisibles(completo({ sexo: 'hombre' }))).not.toContain('regla')
  })

  it('el peso objetivo depende solo del objetivo, sin más condiciones', () => {
    expect(pasosVisibles(completo({ objetivo: 'perder' }))).toContain('pesoObjetivo')
    expect(pasosVisibles(completo({ objetivo: 'recomposicion' }))).not.toContain('pesoObjetivo')
  })

  it('la regla se puede saltar y las preferencias nunca bloquean el botón', () => {
    expect(estadoPaso(completo(), 'regla').completo).toBe(true)
    expect(estadoPaso(completo(), 'preferencias').completo).toBe(true)
  })

  it('un campo fuera de rango del motor lleva a su pantalla', () => {
    expect(pasoDeCampo('menstruacion')).toBe('regla')
    expect(pasoDeCampo('preferencia_base')).toBe('preferencias')
    expect(pasoDeCampo('recomposicion_prioridad')).toBe('objetivo')
  })
})

describe('conversión a InputCalculo', () => {
  it('el cribado viaja siempre en null (decisión A)', () => {
    expect(aInputs(completo()).cribado_tca).toBeNull()
  })

  it('manda los tres campos nuevos y el antiguo `preferencia` traducido', () => {
    const inputs = aInputs(
      completo({ preferencia_base: 'vegano', restricciones: ['sin_gluten'], low_carb: false }),
    )
    expect(inputs.preferencia_base).toBe('vegano')
    expect(inputs.restricciones).toEqual(['sin_gluten'])
    expect(inputs.low_carb).toBe(false)
    // Regla inversa de SPEC-calculo §1.1: la base manda sobre las restricciones.
    expect(inputs.preferencia).toBe('vegano')
  })

  it('la regla inversa respeta el orden low_carb → base → sin_gluten → sin_lactosa', () => {
    expect(preferenciaHeredada('vegano', ['sin_gluten'], true)).toBe('low_carb')
    expect(preferenciaHeredada('vegetariano', ['sin_lactosa'], false)).toBe('vegetariano')
    expect(preferenciaHeredada('omnivoro', ['sin_lactosa', 'sin_gluten'], false)).toBe('sin_gluten')
    expect(preferenciaHeredada('omnivoro', ['sin_lactosa'], false)).toBe('sin_lactosa')
    expect(preferenciaHeredada('omnivoro', [], false)).toBe('omnivoro')
  })

  it('las restricciones salen deduplicadas y en orden canónico', () => {
    const inputs = aInputs(completo({ restricciones: ['sin_gluten', 'sin_lactosa'] }))
    expect(inputs.restricciones).toEqual(['sin_lactosa', 'sin_gluten'])
  })

  it('la prioridad de recomposición solo viaja con ese objetivo', () => {
    expect(
      aInputs(completo({ objetivo: 'recomposicion', recomposicion_prioridad: 'perder' }))
        .recomposicion_prioridad,
    ).toBe('perder')
    expect(
      aInputs(completo({ objetivo: 'perder', ritmo: 'suave', recomposicion_prioridad: 'perder' }))
        .recomposicion_prioridad,
    ).toBeNull()
  })

  it('la regla solo viaja en mujeres', () => {
    expect(aInputs(completo({ sexo: 'mujer', menstruacion: 'irregular' })).menstruacion).toBe(
      'irregular',
    )
    expect(aInputs(completo({ sexo: 'hombre', menstruacion: 'irregular' })).menstruacion).toBeNull()
  })
})

describe('arranque del plan', () => {
  it('se fija la primera vez y se conserva mientras el peso no cambie', () => {
    const primero = anclarPlan(completo())
    expect(primero.fecha_inicio).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(primero.peso_inicio).toBe('80')
    // Volver a pedir el plan con los mismos datos no mueve la fecha: la proyección y los
    // pesajes de §2.6c seguirían hablando del mismo punto de partida.
    expect(anclarPlan(primero)).toBe(primero)
  })

  it('un peso nuevo reinicia el plan (la proyección arranca en el peso actual)', () => {
    const primero = { ...anclarPlan(completo()), fecha_inicio: '2026-01-05' }
    const segundo = anclarPlan({ ...primero, peso_kg: '78' })
    expect(segundo.fecha_inicio).not.toBe('2026-01-05')
    expect(segundo.peso_inicio).toBe('78')
  })

  it('la fecha anclada es la que viaja al motor', () => {
    const anclado = { ...completo(), fecha_inicio: '2026-01-05', peso_inicio: '80' }
    expect(aInputs(anclado).fecha_inicio).toBe('2026-01-05')
  })
})

describe('borrador guardado con la v1.0', () => {
  it('la preferencia antigua se reparte en base, restricciones e interruptor', () => {
    almacen.set(
      CLAVE_ALMACEN,
      JSON.stringify({ sexo: 'mujer', edad: '41', preferencia: 'sin_lactosa' }),
    )
    const restaurado = cargarBorrador()
    expect(restaurado.sexo).toBe('mujer')
    expect(restaurado.edad).toBe('41')
    expect(restaurado.preferencia_base).toBe('omnivoro')
    expect(restaurado.restricciones).toEqual(['sin_lactosa'])
    expect(restaurado.low_carb).toBe(false)
  })

  it('"bajo en hidratos" antiguo enciende el interruptor', () => {
    almacen.set(CLAVE_ALMACEN, JSON.stringify({ preferencia: 'low_carb' }))
    expect(cargarBorrador().low_carb).toBe(true)
    expect(cargarBorrador().preferencia_base).toBe('omnivoro')
  })

  it('un cribado guardado se descarta y la regla arranca sin respuesta', () => {
    almacen.set(
      CLAVE_ALMACEN,
      JSON.stringify({ preferencia: 'vegano', cribado: { q1: 'si', q2: 'si' } }),
    )
    const restaurado = cargarBorrador()
    expect(restaurado.preferencia_base).toBe('vegano')
    expect(restaurado.menstruacion).toBeNull()
    expect((restaurado as unknown as { cribado?: unknown }).cribado).toBeUndefined()
    // Y, sobre todo, que no llega al motor.
    expect(aInputs({ ...completo(), ...restaurado }).cribado_tca).toBeNull()
  })

  it('la preferencia "sin gluten" de la v1.0 se convierte en restricción, no en base', () => {
    almacen.set(
      CLAVE_ALMACEN,
      JSON.stringify({ sexo: 'hombre', peso_kg: '80', preferencia: 'sin_gluten' }),
    )
    const restaurado = cargarBorrador()
    expect(restaurado.preferencia_base).toBe('omnivoro')
    expect(restaurado.restricciones).toEqual(['sin_gluten'])
    expect(restaurado.low_carb).toBe(false)
    // La preferencia muerta no se vuelve a guardar, pero el motor sigue recibiendo su equivalente.
    expect((restaurado as unknown as { preferencia?: unknown }).preferencia).toBeUndefined()
    const inputs = aInputs({ ...completo(), ...restaurado })
    expect(inputs.preferencia).toBe('sin_gluten')
    expect(inputs.restricciones).toEqual(['sin_gluten'])
  })
})

describe('sesión: paso actual y huella del plan', () => {
  it('guardar el paso no borra la huella del último plan', () => {
    // El wizard escribe su paso nada más montarse: al recargar con un plan hecho, o al volver
    // desde los resultados con "Editar tus datos", esa escritura llegaba antes que nada.
    guardarSesion({ paso: null, planGenerado: true, firmaPlan: 'huella-del-plan' })
    guardarPasoSesion('preferencias')
    const sesion = cargarSesion()
    expect(sesion.paso).toBe('preferencias')
    expect(sesion.planGenerado).toBe(false)
    // Sin esto, el ajuste manual guardado se descartaba aunque el usuario no cambiara ni un dato.
    expect(sesion.firmaPlan).toBe('huella-del-plan')
  })

  it('sin plan previo no se inventa ninguna huella', () => {
    guardarPasoSesion('sexo')
    expect(cargarSesion().firmaPlan).toBeUndefined()
  })
})

