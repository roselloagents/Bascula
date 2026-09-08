// Buscador y plegado del paso 14 (SPEC-ux §1 paso 14, v1.2.1): helpers puros.
//
// Lo que se comprueba aquí es la regla de coincidencia —acentos, mayúsculas, subcadena y el
// nombre largo, que no se ve en el chip pero sí se busca— y lo que el filtro deja en pie. El
// marcado de la pantalla se comprueba en `src/components/wizard/__tests__/wizard-v12.test.ts`.

import { describe, expect, it } from 'vitest'
import { alimentoPorId } from '../../../data/foods'
import {
  coincide,
  cuentaAlimentos,
  filtrarGrupos,
  gruposDeAlimentos,
  lineaBusqueda,
  marcadosDelGrupo,
  marcasDeGrupo,
  normalizarTexto,
} from '../alimentos'

const TODOS = gruposDeAlimentos({ base: 'omnivoro', restricciones: [] })

/** Los ids que sobreviven a una búsqueda, en el orden en que se pintan. */
function ids(consulta: string): string[] {
  return filtrarGrupos(TODOS, consulta).flatMap((grupo) => grupo.alimentos.map((a) => a.id))
}

function alimento(id: string) {
  const encontrado = alimentoPorId(id)
  if (!encontrado) throw new Error(`falta ${id} en foods.json`)
  return encontrado
}

describe('normalizarTexto', () => {
  it('quita acentos y baja a minúsculas', () => {
    expect(normalizarTexto('Brócoli')).toBe('brocoli')
    expect(normalizarTexto('  ATÚN  ')).toBe('atun')
    expect(normalizarTexto('Calabacín')).toBe('calabacin')
  })

  it('la eñe también pierde la tilde, así que "pina" encuentra "piña"', () => {
    expect(normalizarTexto('Piña')).toBe('pina')
  })
})

describe('coincide', () => {
  const brocoli = alimento('brocoli')
  const lino = alimento('semillas_lino')
  const yogur0 = alimento('yogur_griego_0')
  const pollo = alimento('pechuga_pollo')

  it('no distingue acentos ni mayúsculas', () => {
    expect(coincide(brocoli, 'brocoli')).toBe(true)
    expect(coincide(brocoli, 'BRÓCOLI')).toBe(true)
    expect(coincide(brocoli, 'BrOcOlI')).toBe(true)
  })

  it('busca por subcadena, no solo por el principio del nombre', () => {
    expect(coincide(lino, 'lino')).toBe(true)
    expect(coincide(lino, 'semi')).toBe(true)
  })

  it('busca también en el nombre largo, que no se ve en el chip', () => {
    // El chip pone "Pechuga de pollo"; "sin piel" solo está en "Pechuga de pollo (cruda, sin piel)".
    expect(pollo.nombre_corto).not.toContain('piel')
    expect(coincide(pollo, 'sin piel')).toBe(true)
  })

  it('los trozos sueltos valen: "yogur 0" encuentra "Yogur griego 0%"', () => {
    expect(coincide(yogur0, 'yogur 0')).toBe(true)
    expect(coincide(yogur0, 'griego yogur')).toBe(true)
    expect(coincide(yogur0, 'yogur soja')).toBe(false)
  })

  it('con el buscador vacío o en blanco pasan todos', () => {
    expect(coincide(brocoli, '')).toBe(true)
    expect(coincide(brocoli, '   ')).toBe(true)
  })
})

describe('filtrarGrupos', () => {
  it('sin texto devuelve los siete grupos enteros y no reordena nada', () => {
    const sinTexto = filtrarGrupos(TODOS, '')
    expect(sinTexto.map((g) => g.clave)).toEqual(TODOS.map((g) => g.clave))
    expect(cuentaAlimentos(sinTexto)).toBe(cuentaAlimentos(TODOS))
  })

  it('deja solo los grupos con coincidencias', () => {
    const grupos = filtrarGrupos(TODOS, 'brocoli')
    expect(grupos.map((g) => g.clave)).toEqual(['verduras'])
    expect(grupos[0].alimentos.map((a) => a.id)).toEqual(['brocoli'])
  })

  it('una búsqueda sin resultados devuelve cero grupos, no un grupo vacío', () => {
    expect(filtrarGrupos(TODOS, 'chuletón de unicornio')).toEqual([])
    expect(cuentaAlimentos(filtrarGrupos(TODOS, 'zzzz'))).toBe(0)
  })

  it('los acentos y las mayúsculas dan el mismo resultado', () => {
    expect(ids('BRÓCOLI')).toEqual(ids('brocoli'))
  })

  it('no toca los grupos originales', () => {
    const antes = cuentaAlimentos(TODOS)
    filtrarGrupos(TODOS, 'pollo')
    expect(cuentaAlimentos(TODOS)).toBe(antes)
  })
})

describe('lineaBusqueda', () => {
  it('cuenta en singular y en plural, con la consulta entre comillas latinas', () => {
    expect(lineaBusqueda(1, 'brocoli')).toBe('1 alimento para «brocoli»')
    expect(lineaBusqueda(4, 'yogur')).toBe('4 alimentos para «yogur»')
    expect(lineaBusqueda(2, '  pollo  ')).toBe('2 alimentos para «pollo»')
  })

  it('[SPEC] sin resultados da el mensaje literal de §1 paso 14', () => {
    expect(lineaBusqueda(0, 'unicornio')).toBe(
      'Ningún alimento se llama así. Prueba con otro nombre o mira los grupos.',
    )
  })
})

describe('marcas de un grupo', () => {
  const verduras = TODOS.find((g) => g.clave === 'verduras')
  const frutas = TODOS.find((g) => g.clave === 'frutas')

  it('solo cuenta lo que cae dentro del grupo', () => {
    const marcados = marcadosDelGrupo(verduras!, ['brocoli', 'zanahoria', 'manzana'], [])
    expect(marcados.excluidos).toEqual(['brocoli', 'zanahoria'])
    expect(marcadosDelGrupo(frutas!, ['brocoli', 'manzana'], []).excluidos).toEqual(['manzana'])
  })

  it('resume en corto y desaparece si no hay nada marcado', () => {
    expect(marcasDeGrupo({ excluidos: ['a', 'b'], favoritos: ['c'] })).toBe('✕ 2 · ★ 1')
    expect(marcasDeGrupo({ excluidos: [], favoritos: ['c'] })).toBe('★ 1')
    expect(marcasDeGrupo({ excluidos: [], favoritos: [] })).toBe('')
  })
})
