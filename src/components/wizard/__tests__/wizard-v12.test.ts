// El cuestionario de la v1.2 (decisiones G, H e I): orden nuevo de pasos, plazo dentro del paso
// de ritmo, síntomas de la regla y paso de alimentos. Se comprueban la ramificación, la
// conversión a `InputCalculo` y el marcado de las pantallas nuevas.
//
// Como en el resto de la interfaz se usa `renderToStaticMarkup`: el proyecto no arrastra jsdom y
// para comprobar qué se pinta y con qué atributos basta con el HTML que React emite.

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import {
  aInputs,
  borradorInicial,
  cargarBorrador,
  estadoPaso,
  pasoDeCampo,
  pasosVisibles,
  CLAVE_ALMACEN,
  type Borrador,
} from '../borrador'
import { PasoAlimentos } from '../pasos/PasoAlimentos'
import { PasoRegla } from '../pasos/PasosPerfil'
import { PasoRitmo } from '../pasos/PasosVida'
import { gruposDeAlimentos, resumenMarcados } from '../../utiles/alimentos'
import { firmaDeInputs } from '../../resultados/ajuste'

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
    sexo: 'mujer',
    edad: '45',
    embarazo_lactancia: false,
    altura_cm: '165',
    peso_kg: '68',
    sinCondiciones: true,
    grasa: { ...borradorInicial().grasa, metodo: 'desconocido' },
    somatotipoElegido: 'saltar',
    actividad_diaria: 'ligero',
    entrena: false,
    objetivo: 'perder',
    ritmo: 'moderado',
    quierePesoObjetivo: true,
    peso_objetivo: '63',
    ...cambios,
  }
}

function pinta(componente: (props: never) => unknown, b: Borrador): string {
  return renderToStaticMarkup(
    createElement(componente as never, { b, set: () => {}, errores: {}, marcados: [] }),
  )
}

describe('orden de los pasos (v1.2)', () => {
  it('va objetivo → peso objetivo → ritmo → preferencias → alimentos', () => {
    const pasos = pasosVisibles(completo())
    expect(pasos.slice(-5)).toEqual([
      'objetivo',
      'pesoObjetivo',
      'ritmo',
      'preferencias',
      'alimentos',
    ])
  })

  it('el paso de alimentos se ve siempre y es el último', () => {
    for (const objetivo of ['perder', 'mantener', 'ganar', 'recomposicion', 'no_se'] as const) {
      const pasos = pasosVisibles(completo({ objetivo }))
      expect(pasos[pasos.length - 1]).toBe('alimentos')
    }
  })

  it('el ritmo no se pregunta en recomposición, aunque sí el peso objetivo', () => {
    const pasos = pasosVisibles(completo({ objetivo: 'recomposicion', recomposicion_prioridad: 'perder' }))
    expect(pasos).toContain('pesoObjetivo')
    expect(pasos).not.toContain('ritmo')
  })

  it('los campos nuevos del motor llevan a su pantalla', () => {
    expect(pasoDeCampo('plazo_semanas')).toBe('ritmo')
    expect(pasoDeCampo('sintomas_regla')).toBe('regla')
    expect(pasoDeCampo('alimentos_excluidos')).toBe('alimentos')
    expect(pasoDeCampo('alimentos_favoritos')).toBe('alimentos')
  })
})

describe('plazo del paso de ritmo', () => {
  it('la cuarta opción solo aparece con un peso objetivo numérico', () => {
    expect(pinta(PasoRitmo, completo())).toContain('Tengo una fecha en mente')
    expect(pinta(PasoRitmo, completo({ quierePesoObjetivo: false, peso_objetivo: '' }))).not.toContain(
      'Tengo una fecha en mente',
    )
  })

  it('con la fecha marcada y sin plazo el paso no está completo, y dice qué falta', () => {
    const b = completo({ usarPlazo: true })
    expect(estadoPaso(b, 'ritmo').completo).toBe(false)
    expect(estadoPaso(b, 'ritmo').falta).toBe('el plazo')
    expect(estadoPaso(completo({ usarPlazo: true, plazo_semanas: 12 }), 'ritmo').completo).toBe(true)
  })

  it('la previsualización es una resta, no un plan: 5 kg en 12 semanas son 417 g por semana', () => {
    const html = pinta(PasoRitmo, completo({ usarPlazo: true, plazo_semanas: 12 }))
    expect(html).toContain('Son 5 kg en 12 semanas: unos 417 g por semana.')
  })

  it('el plazo solo viaja al motor con meta numérica y con el paso visible', () => {
    expect(aInputs(completo({ usarPlazo: true, plazo_semanas: 12 })).plazo_semanas).toBe(12)
    expect(
      aInputs(completo({ usarPlazo: true, plazo_semanas: 12, quierePesoObjetivo: false }))
        .plazo_semanas,
    ).toBeNull()
    expect(
      aInputs(completo({ objetivo: 'mantener', usarPlazo: true, plazo_semanas: 12 })).plazo_semanas,
    ).toBeNull()
  })

  it('un plazo fuera de 4-52 semanas guardado en el borrador se descarta', () => {
    almacen.set(CLAVE_ALMACEN, JSON.stringify({ ...borradorInicial(), plazo_semanas: 80 }))
    expect(cargarBorrador().plazo_semanas).toBeNull()
    almacen.set(CLAVE_ALMACEN, JSON.stringify({ ...borradorInicial(), plazo_semanas: 24 }))
    expect(cargarBorrador().plazo_semanas).toBe(24)
    almacen.clear()
  })
})

describe('síntomas de la regla', () => {
  it('la subpregunta solo se despliega con regla regular o irregular', () => {
    expect(pinta(PasoRegla, completo({ menstruacion: 'regular' }))).toContain('¿Qué notas esos días?')
    expect(pinta(PasoRegla, completo({ menstruacion: 'irregular' }))).toContain('Sangrado abundante')
    expect(pinta(PasoRegla, completo({ menstruacion: 'ausente' }))).not.toContain(
      '¿Qué notas esos días?',
    )
    expect(pinta(PasoRegla, completo({ menstruacion: null }))).not.toContain('¿Qué notas esos días?')
  })

  it('viajan en el orden canónico y solo con la regla presente', () => {
    const b = completo({
      menstruacion: 'regular',
      sintomas_regla: ['cansancio', 'dolor', 'sangrado_abundante'],
    })
    expect(aInputs(b).sintomas_regla).toEqual(['dolor', 'cansancio', 'sangrado_abundante'])
    expect(aInputs({ ...b, menstruacion: 'ausente' }).sintomas_regla).toBeNull()
    expect(aInputs({ ...b, sexo: 'hombre' }).sintomas_regla).toBeNull()
  })
})

describe('paso de alimentos', () => {
  it('una vegana no ve pollo y quien evita el gluten no ve pan de trigo', () => {
    const omnivora = gruposDeAlimentos({ base: 'omnivoro', restricciones: [] })
    const vegana = gruposDeAlimentos({ base: 'vegano', restricciones: [] })
    const ids = (grupos: typeof omnivora) => grupos.flatMap((g) => g.alimentos.map((a) => a.id))
    expect(ids(omnivora)).toContain('pechuga_pollo')
    expect(ids(vegana)).not.toContain('pechuga_pollo')
    expect(ids(vegana)).toContain('tofu_firme')
    const sinGluten = ids(gruposDeAlimentos({ base: 'omnivoro', restricciones: ['sin_gluten'] }))
    expect(sinGluten).not.toContain('pan_integral')
  })

  it('los cereales crudos no se enseñan y los `extra` de la v1.2 sí', () => {
    const ids = gruposDeAlimentos({ base: 'omnivoro', restricciones: [] }).flatMap((g) =>
      g.alimentos.map((a) => a.id),
    )
    expect(ids).not.toContain('arroz_blanco_crudo')
    expect(ids).toContain('cacao_puro')
  })

  it('los grupos van en el orden de la spec y el huevo cae en el de los lácteos', () => {
    const grupos = gruposDeAlimentos({ base: 'omnivoro', restricciones: [] })
    expect(grupos.map((g) => g.nombre)).toEqual([
      'Carne y pescado',
      'Huevos, lácteos y bebidas vegetales',
      'Legumbres y soja',
      'Arroz, pasta, pan y patata',
      'Frutas',
      'Verduras',
      'Grasas y frutos secos',
    ])
    const huevos = grupos.find((g) => g.clave === 'huevos_lacteos')
    expect(huevos?.alimentos.map((a) => a.id)).toContain('huevo_entero')
    const legumbres = grupos.find((g) => g.clave === 'legumbres')
    expect(legumbres?.alimentos.map((a) => a.id)).toContain('lentejas_cocidas')
    const carne = grupos.find((g) => g.clave === 'carne_pescado')
    expect(carne?.alimentos.map((a) => a.id)).not.toContain('huevo_entero')
  })

  it('un grupo sin alimentos que pasen el filtro no se pinta', () => {
    const grupos = gruposDeAlimentos({ base: 'vegano', restricciones: [] })
    expect(grupos.map((g) => g.clave)).not.toContain('carne_pescado')
  })

  it('el chip dice su estado completo y el resumen cuenta las dos listas', () => {
    const html = pinta(
      PasoAlimentos,
      completo({ alimentos_excluidos: ['brocoli'], alimentos_favoritos: ['pechuga_pollo'] }),
    )
    expect(html).toContain('aria-label="Brócoli, no me gusta"')
    expect(html).toContain('aria-label="Pechuga de pollo, favorito"')
    expect(html).toContain('1 que no te gusta · 1 favorito')
    expect(html).toContain('No me gusta')
    expect(html).toContain('Favorito')
  })

  it('el resumen vivo cuenta en plural y desaparece sin nada marcado', () => {
    expect(resumenMarcados(['a', 'b', 'c'], ['d', 'e'])).toBe('3 que no te gustan · 2 favoritos')
    expect(resumenMarcados([], [])).toBe('')
  })
})

describe('lo que las listas de alimentos NO tocan', () => {
  it('viajan al motor pero no entran en la huella del plan', () => {
    const base = aInputs(completo())
    const conAlimentos = aInputs(
      completo({
        alimentos_excluidos: ['brocoli'],
        alimentos_favoritos: ['pechuga_pollo'],
        menu_sencillo: true,
      }),
    )
    expect(conAlimentos.alimentos_excluidos).toEqual(['brocoli'])
    expect(conAlimentos.alimentos_favoritos).toEqual(['pechuga_pollo'])
    // Cambiar de alimentos no puede tirar el ajuste manual guardado ni el "Volver a mi plan".
    expect(firmaDeInputs(conAlimentos)).toBe(firmaDeInputs(base))
    // Cambiar un dato que sí lee el motor, sí.
    expect(firmaDeInputs(aInputs(completo({ peso_kg: '70' })))).not.toBe(firmaDeInputs(base))
  })

  it('ningún id puede estar a la vez en las dos listas', () => {
    const inputs = aInputs(
      completo({ alimentos_excluidos: ['brocoli'], alimentos_favoritos: ['brocoli', 'manzana'] }),
    )
    expect(inputs.alimentos_favoritos).toEqual(['manzana'])
  })
})
