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
import { GruposPlegables, PasoAlimentos } from '../pasos/PasoAlimentos'
import { PasoRegla } from '../pasos/PasosPerfil'
import { PasoRitmo } from '../pasos/PasosVida'
import { cuentaAlimentos, gruposDeAlimentos, resumenMarcados } from '../../utiles/alimentos'
import { teclaEnBuscador } from '../../utiles/teclado'
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

describe('paso de alimentos: buscador y grupos plegables (v1.2.1)', () => {
  const TODOS = gruposDeAlimentos({ base: 'omnivoro', restricciones: [] })

  /** `GruposPlegables` es puro: se le pasa el texto buscado y el plegado, sin simular tecleo. */
  function pintaGrupos(props: {
    busqueda?: string
    abiertos?: string[]
    excluidos?: string[]
    favoritos?: string[]
  }): string {
    return renderToStaticMarkup(
      createElement(GruposPlegables as never, {
        grupos: TODOS,
        busqueda: props.busqueda ?? '',
        abiertos: props.abiertos ?? [],
        excluidos: props.excluidos ?? [],
        favoritos: props.favoritos ?? [],
        alternarGrupo: () => {},
        alternarChip: () => {},
      } as never),
    )
  }

  /** Un evento de teclado de mentira: `teclaEnBuscador` es puro y no necesita jsdom. */
  function teclaFalsa(key: string) {
    const marcas = { prevenido: false, cerrado: false }
    const evento = {
      key,
      preventDefault: () => void (marcas.prevenido = true),
      currentTarget: { blur: () => void (marcas.cerrado = true) },
    }
    return { evento, marcas }
  }

  it('el buscador está en la barra fija, sin autofocus y sin texto', () => {
    const html = pinta(PasoAlimentos, completo())
    expect(html).toContain('type="search"')
    expect(html).toContain('placeholder="Busca un alimento (p. ej. brócoli)"')
    expect(html).toContain('for="buscador-alimentos"')
    // El foco al entrar en el paso sigue en el contenedor, como en el resto del cuestionario.
    expect(html.toLowerCase()).not.toContain('autofocus')
    // "Borrar" solo se pinta con algo escrito.
    expect(html).not.toContain('buscador-borrar')
  })

  it('sin nada marcado los siete grupos entran plegados, con su recuento', () => {
    const html = pinta(PasoAlimentos, completo())
    // `Ayuda` de la cabecera también es un desplegable: se cuentan solo las cabeceras de grupo.
    const cabeceras = /class="grupo-chips-boton" aria-expanded="(true|false)"/g
    expect(html.match(cabeceras)).toHaveLength(TODOS.length)
    expect(html).not.toContain('class="grupo-chips-boton" aria-expanded="true"')
    expect(html.match(/<ul class="chips" id="chips-[a-z_]+" hidden=""/g)).toHaveLength(TODOS.length)
    const verduras = TODOS.find((g) => g.clave === 'verduras')
    expect(html).toContain(`${verduras?.alimentos.length} alimentos`)
    expect(html).toContain('Mostrar todos')
  })

  it('el grupo que ya tiene algo marcado entra abierto y enseña sus marcas', () => {
    const html = pinta(
      PasoAlimentos,
      completo({ alimentos_excluidos: ['brocoli', 'zanahoria'], alimentos_favoritos: ['manzana'] }),
    )
    expect(html).toContain('aria-expanded="true" aria-controls="chips-verduras"')
    expect(html).toContain('aria-expanded="true" aria-controls="chips-frutas"')
    // Los otros cinco siguen plegados: solo se abre lo que trae marcas.
    const abiertas = /class="grupo-chips-boton" aria-expanded="true"/g
    expect(html.match(abiertas)).toHaveLength(2)
    expect(html).toContain('✕ 2')
    expect(html).toContain('★ 1')
    // Y el recuento hablado acompaña al de símbolos, que va en `aria-hidden`.
    expect(html).toContain('2 que no te gustan')
  })

  it('con texto solo se pintan los grupos que coinciden, abiertos y sin cabecera-botón', () => {
    const html = pintaGrupos({ busqueda: 'brocoli' })
    expect(html).toContain('Verduras')
    expect(html).toContain('Brócoli')
    expect(html).not.toContain('Carne y pescado')
    expect(html).not.toContain('Frutas')
    expect(html).not.toContain('hidden=""')
    expect(html).not.toContain('aria-expanded')
  })

  it('la búsqueda no distingue acentos y mira también el nombre largo', () => {
    expect(pintaGrupos({ busqueda: 'BRÓCOLI' })).toContain('Brócoli')
    // "sin piel" solo aparece en el nombre largo de los pollos, nunca en el chip.
    const pollos = pintaGrupos({ busqueda: 'sin piel' })
    expect(pollos).toContain('Pechuga de pollo')
    expect(pollos).toContain('Muslo de pollo')
    expect(pollos).not.toContain('Verduras')
  })

  it('[SPEC] sin resultados no hay ningún grupo y sale el mensaje literal', () => {
    const html = pintaGrupos({ busqueda: 'chuletón de unicornio' })
    expect(html).toContain(
      'Ningún alimento se llama así. Prueba con otro nombre o mira los grupos.',
    )
    expect(html).not.toContain('grupo-chips')
  })

  it('la línea de resultados vive dentro de la barra fija y siempre en el DOM', () => {
    const html = pinta(PasoAlimentos, completo())
    // Vacía pero presente: un `aria-live` que aparece con el texto ya dentro no se anuncia.
    expect(html).toContain('class="busqueda-resultados" role="status" aria-live="polite"')
    expect(html).not.toContain('alimentos para «')
    // Y dentro de la barra: fuera quedaba tapada por ella en cuanto se bajaba un poco.
    const desdeElPie = html.slice(html.indexOf('class="segmentado-pie"'))
    expect(desdeElPie.indexOf('busqueda-resultados')).toBeGreaterThan(-1)
    expect(desdeElPie.indexOf('busqueda-resultados')).toBeLessThan(
      desdeElPie.indexOf('grupos-alimentos'),
    )
    expect(cuentaAlimentos(TODOS)).toBeGreaterThan(0)
  })

  it('buscando se pintan los chips marcados con su estado y el grupo enseña sus marcas', () => {
    const html = pintaGrupos({ busqueda: 'brocoli', excluidos: ['brocoli'] })
    expect(html).toContain('aria-label="Brócoli, no me gusta"')
    // La cabecera fija dice lo mismo que la cabecera-botón: recuento, marcas y versión hablada.
    expect(html).toContain('1 · ✕ 1')
    expect(html).toContain('1 alimento, 1 que no te gusta')
  })

  it('Intro en el buscador no envía el cuestionario: filtra y cierra el teclado', () => {
    // El campo vive dentro del `<form onSubmit={avanzar}>` del wizard y es el único de texto del
    // paso: sin este guard, la submisión implícita generaba el plan y se llevaba al usuario.
    const intro = teclaFalsa('Enter')
    teclaEnBuscador(intro.evento as never)
    expect(intro.marcas).toEqual({ prevenido: true, cerrado: true })

    // Cualquier otra tecla sigue escribiendo con normalidad.
    const letra = teclaFalsa('b')
    teclaEnBuscador(letra.evento as never)
    expect(letra.marcas).toEqual({ prevenido: false, cerrado: false })
  })

  it('el buscador anuncia al teclado del móvil que su tecla busca, no navega', () => {
    expect(pinta(PasoAlimentos, completo())).toContain('enterKeyHint="search"')
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
