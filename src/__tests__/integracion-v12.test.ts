// Costuras de la v1.2: cuestionario → motor → menús → PDF, y la regeneración sin motor.
//
// Cada capa tiene sus propios tests (`src/engine/__tests__/v12`, `src/meals/__tests__/alimentos`,
// `src/components/**/__tests__/*-v12`, `src/pdf/__tests__/render`), pero las cuatro decisiones de
// la v1.2 se rompen justo entre capas: un `alimentos_excluidos` que la UI envía y el generador no
// mira, un `plazo_semanas` que se queda en el borrador, una tarjeta del ciclo con consejos que el
// motor calcula y el PDF no imprime, o un "No me gusta" que rehace el menú **y** los números. Eso
// solo se ve encadenando los cuatro módulos como los encadena `App.tsx`.
import { describe, expect, it, vi } from 'vitest'
import { renderToBuffer } from '@react-pdf/renderer'
import { calcular, textosAvisos } from '../engine'
import type { DatosPdf, Ejemplos, InputCalculo, Resultado } from '../engine/types'
import { alimentoPorId } from '../data/foods'
import { generarEjemplos } from '../meals'
import { pasaPerfil, perfilDeInputs } from '../meals/filtros'
import { elementoPlan } from '../pdf'
import { textoDelPdf } from '../pdf/__tests__/utiles'
import {
  CLAVE_ALMACEN,
  aInputs,
  anclarPlan,
  borradorInicial,
  cargarBorrador,
  pasosVisibles,
  type Borrador,
} from '../components/wizard/borrador'
import { firmaDeInputs } from '../components/resultados/ajuste'
import { listaNombresCortos } from '../components/utiles/alimentos'
import { resumenAlimentos } from '../pdf/etiquetas'

const almacen = new Map<string, string>()
vi.stubGlobal('window', {
  localStorage: {
    getItem: (clave: string) => almacen.get(clave) ?? null,
    setItem: (clave: string, valor: string) => void almacen.set(clave, valor),
    removeItem: (clave: string) => void almacen.delete(clave),
  },
})

/**
 * La usuaria de los audios que motiva la v1.2: mujer, 68 kg, 165 cm, regla regular. El resto de
 * las respuestas son las del cuestionario entero, ya ancladas en su día de arranque.
 */
function borradorCompleto(cambios: Partial<Borrador> = {}): Borrador {
  const base = borradorInicial()
  return anclarPlan({
    ...base,
    sexo: 'mujer',
    edad: '45',
    altura_cm: '165',
    peso_kg: '68',
    embarazo_lactancia: false,
    menstruacion: 'regular',
    sinCondiciones: true,
    grasa: { ...base.grasa, metodo: 'desconocido' },
    somatotipoElegido: 'saltar',
    actividad_diaria: 'ligero',
    entrena: true,
    entrenamiento: {
      tipo: 'fuerza',
      dias_semana: 3,
      minutos_sesion: 60,
      intensidad: 'media',
      experiencia: 'novato',
      momento: 'tarde',
      momentoRespondido: true,
    },
    objetivo: 'perder',
    ritmo: 'moderado',
    quierePesoObjetivo: false,
    n_comidas: 4,
    fecha_inicio: '2026-09-07',
    peso_inicio: '68',
    ...cambios,
  })
}

/** Todo lo que el usuario acaba viendo de un alimento: plato, equivalencia y lista de la compra. */
function idsVisibles(e: Ejemplos): { id: string; donde: string }[] {
  const ids: { id: string; donde: string }[] = []
  for (const dia of [e.entreno, e.descanso]) {
    for (const c of dia.comidas) {
      for (const a of c.alimentos) ids.push({ id: a.id, donde: c.comida })
    }
  }
  for (const t of e.equivalencias?.tablas ?? []) {
    for (const f of t.filas) ids.push({ id: f.id, donde: t.titulo })
  }
  for (const item of e.compra?.items ?? []) ids.push({ id: item.alimento_id, donde: 'compra' })
  return ids
}

/** Las sustituciones de cada toma son TEXTO ("Cambia el pollo por 150 g de merluza"), no ids. */
function textoAlternativas(e: Ejemplos): string {
  return [e.entreno, e.descanso]
    .flatMap((dia) => [...dia.notas, ...dia.comidas.flatMap((c) => c.alternativas)])
    .join(' | ')
}

/** El plan entero tal y como lo monta `App.tsx`: motor y, encima, generador de menús. */
function plan(borrador: Borrador): { inputs: InputCalculo; resultado: Resultado; ejemplos: Ejemplos } {
  const inputs = aInputs(borrador)
  const resultado = calcular(inputs)
  expect(resultado.excluido).toBeUndefined()
  return { inputs, resultado, ejemplos: generarEjemplos(inputs, resultado) }
}

// ---------------------------------------------------------------------------
// Decisión G — alimentos que no gustan y favoritos
// ---------------------------------------------------------------------------

describe('decisión G: las dos listas del paso de alimentos llegan al menú', () => {
  it('un alimento excluido no aparece en el menú, ni en alternativas, ni en equivalencias, ni en la compra', () => {
    const { ejemplos: antes } = plan(borradorCompleto())
    // Se excluye un alimento que el menú SÍ estaba usando: si no, la prueba no prueba nada.
    const victima = antes.entreno.comidas[1].alimentos[0].id
    expect(idsVisibles(antes).some((v) => v.id === victima)).toBe(true)

    const { ejemplos } = plan(borradorCompleto({ alimentos_excluidos: [victima] }))
    const donde = idsVisibles(ejemplos)
      .filter((v) => v.id === victima)
      .map((v) => v.donde)
    expect(donde, `${victima} sigue apareciendo en: ${donde.join(', ')}`).toEqual([])
    // Tampoco en las sustituciones, que son texto y se escapaban del filtro de ids.
    expect(textoAlternativas(ejemplos)).not.toContain(alimentoPorId(victima)!.nombre)
    // Y el menú no se queda cojo por quitarlo: sigue habiendo un plato entero en esa toma.
    expect(ejemplos.entreno.comidas[1].alimentos.length).toBeGreaterThan(0)
  })

  it('las exclusiones se aplican después de la base y las restricciones, no en su lugar', () => {
    const borrador = borradorCompleto({
      preferencia_base: 'vegetariano',
      restricciones: ['sin_lactosa'],
      alimentos_excluidos: ['lentejas_cocidas'],
    })
    const { inputs, resultado, ejemplos } = plan(borrador)
    const perfil = perfilDeInputs(inputs, resultado.preferencia_efectiva)
    expect(idsVisibles(ejemplos).length).toBeGreaterThan(0)
    for (const { id, donde } of idsVisibles(ejemplos)) {
      const alimento = alimentoPorId(id)
      expect(alimento, id).toBeDefined()
      // Sigue cumpliendo el perfil dietético (nada de carne ni de lácteos con lactosa)…
      expect(pasaPerfil(alimento!, perfil), `${donde}: ${id}`).toBe(true)
      // …y además no es el que ella ha tachado.
      expect(id, donde).not.toBe('lentejas_cocidas')
    }
  })

  it('un favorito que pasa la consulta entra en el menú', () => {
    const { ejemplos: sin } = plan(borradorCompleto())
    const { ejemplos: con } = plan(borradorCompleto({ alimentos_favoritos: ['salmon'] }))
    const enElMenu = (e: Ejemplos) => e.entreno.comidas.some((c) => c.alimentos.some((a) => a.id === 'salmon'))
    expect(enElMenu(sin)).toBe(false)
    expect(enElMenu(con)).toBe(true)
  })

  it('el modo sencillo respeta las dos listas sin pasarse del tope de 12 alimentos', () => {
    const { ejemplos } = plan(
      borradorCompleto({
        menu_sencillo: true,
        alimentos_excluidos: ['brocoli', 'coliflor'],
        alimentos_favoritos: ['salmon'],
      }),
    )
    const ids = idsVisibles(ejemplos).map((v) => v.id)
    expect(ids).not.toContain('brocoli')
    expect(ids).not.toContain('coliflor')
    expect(ejemplos.compra?.alimentos_distintos ?? 0).toBeLessThanOrEqual(12)
    expect(ejemplos.entreno.comidas.some((c) => c.alimentos.some((a) => a.id === 'salmon'))).toBe(true)
  })

  it('cuando la exclusión deja sin candidatos, el respaldo avisa en vez de romper el menú', () => {
    // Una vegana que tacha TODAS las proteínas vegetales: el generador tiene que seguir dando un
    // menú que cuadre los macros, y decir claramente qué no ha podido evitar (§3.2b).
    const { ejemplos } = plan(
      borradorCompleto({
        preferencia_base: 'vegano',
        alimentos_excluidos: [
          'lentejas_cocidas',
          'garbanzos_cocidos',
          'judias_blancas_cocidas',
          'tofu',
          'tofu_firme',
          'tempeh',
          'seitan_cocido',
          'soja_texturizada',
          'soja_texturizada_hidratada',
          'edamame_cocido',
          'proteina_guisante_polvo',
          'proteina_soja_polvo',
          'tiras_soja',
          'altramuces',
          'bebida_soja',
          'yogur_soja_proteico',
          'leche_avena',
          'leche_almendra',
        ],
      }),
    )
    const avisos = ejemplos.avisos_menu ?? []
    expect(avisos.length).toBeGreaterThan(0)
    for (const aviso of avisos) expect(aviso).toContain('No hemos podido evitar')
    // Y el menú sigue en pie: ninguna toma se queda vacía.
    for (const c of ejemplos.entreno.comidas) expect(c.alimentos.length).toBeGreaterThan(0)
  })

  it('sin marcar nada el menú es exactamente el de la v1.1', () => {
    const sinListas = plan(borradorCompleto()).ejemplos
    const conListasVacias = plan(borradorCompleto({ alimentos_excluidos: [], alimentos_favoritos: [] })).ejemplos
    expect(idsVisibles(conListasVacias)).toEqual(idsVisibles(sinListas))
  })
})

describe('"No me gusta" rehace el menú sin volver a llamar al motor (§2.5)', () => {
  it('los números, la huella del plan y la proyección no se mueven; el menú sí', () => {
    const borrador = borradorCompleto()
    const { inputs, resultado, ejemplos } = plan(borrador)
    const victima = ejemplos.entreno.comidas[1].alimentos[0].id

    // Exactamente lo que hace `App.cambiarAlimentos`: cambiar las listas de `InputCalculo` y
    // volver a llamar SOLO a `generarEjemplos`, con el mismo `Resultado` de antes.
    const despues: InputCalculo = { ...inputs, alimentos_excluidos: [victima] }
    const rehecho = generarEjemplos(despues, resultado)

    expect(idsVisibles(rehecho).some((v) => v.id === victima)).toBe(false)
    expect(idsVisibles(rehecho)).not.toEqual(idsVisibles(ejemplos))
    // La huella ignora los campos que el motor ignora: el ajuste manual guardado sobrevive.
    expect(firmaDeInputs(despues)).toBe(firmaDeInputs(inputs))
    // Y por si acaso: recalcular con las listas cambiadas devuelve el mismo plan.
    expect(calcular(despues)).toEqual(resultado)
  })

  it('"Deshacer" devuelve el menú anterior tal cual', () => {
    const borrador = borradorCompleto()
    const { inputs, resultado, ejemplos } = plan(borrador)
    const victima = ejemplos.entreno.comidas[1].alimentos[0].id
    const conExclusion = generarEjemplos({ ...inputs, alimentos_excluidos: [victima] }, resultado)
    expect(idsVisibles(conExclusion)).not.toEqual(idsVisibles(ejemplos))
    const deshecho = generarEjemplos({ ...inputs, alimentos_excluidos: [] }, resultado)
    expect(idsVisibles(deshecho)).toEqual(idsVisibles(ejemplos))
  })
})

// ---------------------------------------------------------------------------
// Decisión H — peso objetivo, plazo y recomposición
// ---------------------------------------------------------------------------

describe('decisión H: el plazo del cuestionario llega al ritmo del plan', () => {
  it('un plazo holgado ablanda el ritmo y lo dice', () => {
    const borrador = borradorCompleto({
      quierePesoObjetivo: true,
      peso_objetivo: '65',
      usarPlazo: true,
      plazo_semanas: 24,
    })
    expect(pasosVisibles(borrador)).toContain('ritmo')
    const { inputs, resultado } = plan(borrador)
    expect(inputs.plazo_semanas).toBe(24)
    expect(resultado.ritmo_efectivo).toBe('suave')
    expect(resultado.avisos).toContain('INFO_RITMO_POR_PLAZO')
    expect(resultado.avisos).not.toContain('WARN_PLAZO_IRREAL')
  })

  it('un plazo imposible no se promete: ritmo agresivo y aviso honesto', () => {
    const borrador = borradorCompleto({
      quierePesoObjetivo: true,
      peso_objetivo: '58',
      usarPlazo: true,
      plazo_semanas: 8,
    })
    const { inputs, resultado } = plan(borrador)
    expect(resultado.ritmo_efectivo).toBe('agresivo')
    expect(resultado.avisos).toContain('WARN_PLAZO_IRREAL')
    // Y el aviso llega a la pantalla con su texto ya relleno, no con los huecos de la plantilla.
    const texto = textosAvisos(resultado, inputs).find((a) => a.codigo === 'WARN_PLAZO_IRREAL')
    expect(texto).toBeDefined()
    expect(texto!.texto).toContain('58 kg')
    expect(texto!.texto).toContain('8 semanas')
    expect(texto!.texto).not.toMatch(/null|undefined|NaN|\{/)
  })

  it('sin plazo el plan es exactamente el de la v1.1', () => {
    const conMeta = borradorCompleto({ quierePesoObjetivo: true, peso_objetivo: '65' })
    const sinPlazo = calcular(aInputs(conMeta))
    const plazoDescartado = calcular(aInputs({ ...conMeta, usarPlazo: false, plazo_semanas: 24 }))
    expect(plazoDescartado).toEqual(sinPlazo)
  })

  it('el plazo se descarta si el cuestionario no lo pudo ofrecer', () => {
    // Sin peso objetivo numérico no hay cuarta opción: lo que quede en el borrador no viaja.
    const inputs = aInputs(borradorCompleto({ quierePesoObjetivo: false, usarPlazo: true, plazo_semanas: 12 }))
    expect(inputs.plazo_semanas).toBeNull()
  })
})

describe('decisión H: recomposición con peso objetivo y proyección con banda', () => {
  const recomp = (prioridad: 'perder' | 'equilibrado' | 'ganar', cambios: Partial<Borrador> = {}) =>
    borradorCompleto({
      objetivo: 'recomposicion',
      recomposicion_prioridad: prioridad,
      quierePesoObjetivo: true,
      peso_objetivo: '63',
      ...cambios,
    })

  it('con prioridad perder se pregunta el peso objetivo pero no el ritmo', () => {
    const pasos = pasosVisibles(recomp('perder'))
    expect(pasos).toContain('pesoObjetivo')
    expect(pasos).not.toContain('ritmo')
  })

  it('con déficit real la proyección tiene banda: el borde de arriba es el peso de hoy', () => {
    const { resultado } = plan(recomp('perder'))
    expect(resultado.peso_objetivo.efectivo).toBe(63)
    const puntos = resultado.proyeccion ?? []
    expect(puntos.length).toBeGreaterThan(1)
    for (const p of puntos) {
      // Todo lo que pierde de grasa lo compensa el músculo: la báscula, como mucho, se queda igual.
      expect(p.peso_max).toBe(68)
      expect(p.peso_min).toBeLessThanOrEqual(p.peso_esp)
      expect(p.peso_esp).toBeLessThanOrEqual(p.peso_max)
    }
    expect(puntos.at(-1)!.peso_min).toBeLessThan(puntos[0].peso_min)
    // No se promete fecha: en recomposición no hay cronograma.
    expect(resultado.cronograma).toBeNull()
    expect(resultado.avisos).toContain('INFO_PROYECCION_RECOMP')
    expect(resultado.avisos).not.toContain('INFO_PROYECCION_PLANA')
  })

  it('con prioridad ganar no hay déficit: ni peso objetivo ni banda', () => {
    const borrador = recomp('ganar')
    expect(pasosVisibles(borrador)).not.toContain('pesoObjetivo')
    const { resultado } = plan(borrador)
    expect(resultado.avisos).toContain('INFO_PROYECCION_PLANA')
    expect(resultado.avisos).not.toContain('INFO_PROYECCION_RECOMP')
  })
})

// ---------------------------------------------------------------------------
// Decisión I — síntomas de la regla
// ---------------------------------------------------------------------------

describe('decisión I: los síntomas de la regla no tocan un número y sí la tarjeta del ciclo', () => {
  const conSintomas = (sintomas: Borrador['sintomas_regla']) =>
    borradorCompleto({ menstruacion: 'regular', sintomas_regla: sintomas })

  it('marcar síntomas no cambia ni las kcal ni los macros ni el menú', () => {
    const sin = plan(conSintomas([]))
    const con = plan(conSintomas(['dolor', 'cansancio', 'sangrado_abundante']))
    expect(con.resultado.kcal).toBe(sin.resultado.kcal)
    expect(con.resultado.macros).toEqual(sin.resultado.macros)
    expect(con.ejemplos.entreno.comidas.map((c) => c.alimentos.map((a) => a.id))).toEqual(
      sin.ejemplos.entreno.comidas.map((c) => c.alimentos.map((a) => a.id)),
    )
  })

  it('cada síntoma marcado produce su consejo, en el orden canónico', () => {
    const { resultado } = plan(conSintomas(['sangrado_abundante', 'dolor']))
    expect(resultado.avisos).toContain('INFO_CICLO')
    expect(resultado.ciclo?.consejos.map((c) => c.clave)).toEqual(['dolor', 'sangrado_abundante'])
    for (const consejo of resultado.ciclo?.consejos ?? []) {
      expect(consejo.titulo.length).toBeGreaterThan(0)
      expect(consejo.texto.length).toBeGreaterThan(0)
    }
  })

  it('sin síntomas hay tarjeta del ciclo pero no consejos ni compra opcional', () => {
    const { resultado, ejemplos } = plan(conSintomas([]))
    expect(resultado.avisos).toContain('INFO_CICLO')
    expect(resultado.ciclo).toBeUndefined()
    expect(ejemplos.alimentos_ciclo).toBeUndefined()
    expect(ejemplos.compra?.opcional_ciclo).toBeUndefined()
  })

  it('los alimentos del ciclo y la compra opcional salen del generador, filtrados', () => {
    const { ejemplos } = plan(conSintomas(['sangrado_abundante']))
    const ciclo = ejemplos.alimentos_ciclo ?? []
    expect(ciclo.length).toBeGreaterThanOrEqual(2)
    for (const a of ciclo) {
      expect(alimentoPorId(a.id), a.id).toBeDefined()
      expect(a.nombre).toBe(alimentoPorId(a.id)!.nombre)
      expect(a.por_que.length).toBeGreaterThan(0)
    }
    const opcional = ejemplos.compra!.opcional_ciclo!
    expect(opcional.items.length).toBeGreaterThanOrEqual(1)
    expect(opcional.items.length).toBeLessThanOrEqual(3)
    // La sección opcional no cuenta en las cantidades del plan.
    expect(ejemplos.compra!.alimentos_distintos).toBe(ejemplos.compra!.items.length)
    const delPlan = new Set(ejemplos.compra!.items.map((i) => i.alimento_id))
    for (const item of opcional.items) expect(delPlan.has(item.alimento_id)).toBe(false)
  })

  it('una vegana no ve carne ni mejillones entre los alimentos del ciclo', () => {
    const { inputs, resultado, ejemplos } = plan(
      borradorCompleto({ preferencia_base: 'vegano', sintomas_regla: ['sangrado_abundante', 'dolor'] }),
    )
    const perfil = perfilDeInputs(inputs, resultado.preferencia_efectiva)
    for (const a of ejemplos.alimentos_ciclo ?? []) {
      expect(pasaPerfil(alimentoPorId(a.id)!, perfil), a.id).toBe(true)
    }
  })

  it('un alimento excluido tampoco entra por la puerta del ciclo', () => {
    const { ejemplos } = plan(
      borradorCompleto({ sintomas_regla: ['dolor'], alimentos_excluidos: ['sardinas_lata', 'nueces'] }),
    )
    const ids = (ejemplos.alimentos_ciclo ?? []).map((a) => a.id)
    expect(ids).not.toContain('sardinas_lata')
    expect(ids).not.toContain('nueces')
    for (const item of ejemplos.compra?.opcional_ciclo?.items ?? []) {
      expect(item.alimento_id).not.toBe('sardinas_lata')
      expect(item.alimento_id).not.toBe('nueces')
    }
  })

  it('los cuatro alimentos `extra` de la v1.2 no se cuelan en el menú del plan', () => {
    const { ejemplos } = plan(conSintomas(['dolor', 'antojos']))
    const extras = ['mejillones_lata', 'sardinas_lata', 'cacao_puro', 'chocolate_85']
    for (const { id, donde } of idsVisibles(ejemplos)) {
      expect(extras, `${donde}: ${id}`).not.toContain(id)
    }
  })
})

// ---------------------------------------------------------------------------
// Migración: un borrador de la v1.1 guardado en el móvil
// ---------------------------------------------------------------------------

describe('un borrador de la v1.1 sigue funcionando con la v1.2', () => {
  /** Lo que dejó la v1.1 en `localStorage`: sin ninguno de los cinco campos nuevos. */
  function guardarVieja(cambios: Partial<Borrador> = {}): void {
    const viejo: Record<string, unknown> = { ...borradorCompleto(cambios) }
    for (const campo of [
      'sintomas_regla',
      'usarPlazo',
      'plazo_semanas',
      'alimentos_excluidos',
      'alimentos_favoritos',
    ]) {
      delete viejo[campo]
    }
    almacen.clear()
    almacen.set(CLAVE_ALMACEN, JSON.stringify(viejo))
  }

  it('los cinco campos nuevos vuelven a su valor inicial y el plan sale igual', () => {
    guardarVieja()
    const restaurado = cargarBorrador()
    expect(restaurado.sintomas_regla).toEqual([])
    expect(restaurado.usarPlazo).toBe(false)
    expect(restaurado.plazo_semanas).toBeNull()
    expect(restaurado.alimentos_excluidos).toEqual([])
    expect(restaurado.alimentos_favoritos).toEqual([])

    const inputs = aInputs(restaurado)
    expect(inputs.plazo_semanas).toBeNull()
    expect(inputs.sintomas_regla).toBeNull()
    expect(calcular(inputs)).toEqual(calcular(aInputs(borradorCompleto())))
  })

  it('una recomposición de la v1.1 pasa a tener paso de peso objetivo sin contestar', () => {
    guardarVieja({ objetivo: 'recomposicion', recomposicion_prioridad: 'perder' })
    const restaurado = cargarBorrador()
    // La v1.1 no preguntaba peso objetivo en recomposición, así que el campo llega sin respuesta:
    // el paso aparece vacío, no con una meta inventada.
    expect(pasosVisibles(restaurado)).toContain('pesoObjetivo')
    expect(aInputs(restaurado).peso_objetivo).toBeNull()
    expect(calcular(aInputs(restaurado)).excluido).toBeUndefined()
  })

  it('basura en las listas nuevas no rompe nada: ids inventados y repetidos se descartan', () => {
    const viejo: Record<string, unknown> = { ...borradorCompleto() }
    viejo.alimentos_excluidos = ['brocoli', 'brocoli', 'no_existe', 42, null]
    viejo.alimentos_favoritos = ['brocoli', 'salmon', 'tampoco_existe']
    viejo.plazo_semanas = 999
    viejo.sintomas_regla = ['dolor', 'inventado']
    almacen.clear()
    almacen.set(CLAVE_ALMACEN, JSON.stringify(viejo))

    const restaurado = cargarBorrador()
    // El borrador solo exige que sean cadenas y que no se repitan; quien decide si un id existe
    // de verdad es `foods.json`, más abajo. Lo que no puede pasar es que ese id llegue a ningún
    // sitio visible.
    expect(restaurado.alimentos_excluidos).toEqual(['brocoli', 'no_existe'])
    // Ningún id puede estar en las dos listas: manda la exclusión.
    expect(restaurado.alimentos_favoritos).toEqual(['salmon', 'tampoco_existe'])
    expect(restaurado.plazo_semanas).toBeNull()
    expect(restaurado.sintomas_regla).toEqual(['dolor'])

    const { ejemplos } = plan(restaurado)
    expect(idsVisibles(ejemplos).map((v) => v.id)).not.toContain('brocoli')
    // Ni el resumen de la pantalla ni el del PDF pueden imprimir un identificador técnico.
    expect(listaNombresCortos(restaurado.alimentos_excluidos)).toBe('Brócoli')
    expect(resumenAlimentos(restaurado.alimentos_excluidos, restaurado.alimentos_favoritos)).not.toContain(
      'no_existe',
    )
  })
})

// ---------------------------------------------------------------------------
// El PDF imprime lo que enseña la pantalla
// ---------------------------------------------------------------------------

describe('el PDF de un plan real de la v1.2 imprime todo lo nuevo', () => {
  it('plazo, alimentos, avisos del generador, consejos del ciclo y compra opcional', async () => {
    const borrador = borradorCompleto({
      quierePesoObjetivo: true,
      peso_objetivo: '58',
      usarPlazo: true,
      plazo_semanas: 8,
      sintomas_regla: ['dolor', 'sangrado_abundante'],
      alimentos_excluidos: ['brocoli', 'coliflor'],
      alimentos_favoritos: ['salmon'],
    })
    const { inputs, resultado, ejemplos } = plan(borrador)
    const datos: DatosPdf = {
      inputs,
      resultado,
      ejemplos,
      avisos: textosAvisos(resultado, inputs),
      fecha: '2026-09-07',
    }
    const buffer = await renderToBuffer(elementoPlan(datos))
    const texto = await textoDelPdf(buffer)

    // Nada a medio rellenar: ese es el fallo que solo aparece al encadenar las capas de verdad.
    expect(texto).not.toContain('undefined')
    expect(texto).not.toContain('NaN')
    // Fila de plazo y fila de alimentos de §4.2.
    expect(texto).toContain('8 semanas')
    expect(texto.toLowerCase()).toContain('brócoli')
    // Tarjeta del ciclo con sus consejos (§4.3b).
    for (const consejo of resultado.ciclo!.consejos) {
      expect(texto.replace(/\s+/g, ' ')).toContain(consejo.titulo)
    }
    // Sección opcional de la compra (§4.4b).
    expect(texto).toContain('Para los días de regla (opcional)')
    // Y ningún alimento excluido se imprime en el menú ni en la compra.
    for (const excluido of ['Brócoli', 'Coliflor']) {
      const menuYCompra = idsVisibles(ejemplos).map((v) => alimentoPorId(v.id)!.nombre)
      expect(menuYCompra).not.toContain(excluido)
    }
  })

  it('una recomposición con meta no promete fecha en el PDF', async () => {
    const { inputs, resultado, ejemplos } = plan(
      borradorCompleto({
        objetivo: 'recomposicion',
        recomposicion_prioridad: 'perder',
        quierePesoObjetivo: true,
        peso_objetivo: '63',
      }),
    )
    const datos: DatosPdf = {
      inputs,
      resultado,
      ejemplos,
      avisos: textosAvisos(resultado, inputs),
      fecha: '2026-09-07',
    }
    const texto = await textoDelPdf(await renderToBuffer(elementoPlan(datos)))
    expect(texto).not.toContain('undefined')
    expect(texto).not.toContain('NaN')
    expect(texto).toContain('63')
    expect(resultado.cronograma).toBeNull()
  })
})
