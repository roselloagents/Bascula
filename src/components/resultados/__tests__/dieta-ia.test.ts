// Los huecos propuestos por la IA en la pantalla (SPEC-dieta-propia §4bis.3 y §4bis.5).
//
// Mismo enfoque que `dieta.test.ts`: `renderToStaticMarkup`, sin jsdom, y días compuestos de
// verdad —`DIAS_CON_PROPUESTA` sale de `componerDia` con una `PropuestaIA` puesta—, así que lo
// que se comprueba es la salida real del algoritmo pintada por el bloque.

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { ComidaCompuesta, DiaCompuesto, DietaInterpretada } from '../../../engine/types'
import type { DietaGuardada } from '../../../dieta/almacen'
import type { VentanaDictado } from '../../../dieta/dictado'
import {
  DIAS_COMPUESTOS,
  DIAS_CON_PROPUESTA,
  PLAN_1780,
} from '../../../meals/__tests__/dieta-fixtures'
import {
  BloqueDietaPropia,
  BOTON_OTRA_PROPUESTA,
  BOTON_OTRO_EJEMPLO,
  LINEA_PROPUESTA_IA,
  LINEA_SIN_IA,
  PIDIENDO_PROPUESTA,
} from '../BloqueDietaPropia'
import {
  BOTON_RESPONDER,
  BOTON_SEGUIR,
  ETIQUETA_OTRA_RESPUESTA,
  TITULO_PREGUNTA_IA,
} from '../PreguntaIA'
import { ERROR_CUOTA } from '../../../dieta/api'

const INPUTS = PLAN_1780.inputs
const COMIDAS_PLAN = PLAN_1780.resultado.comidas.map((c) => c.nombre)

const CON_MICRO: VentanaDictado = {
  SpeechRecognition: function () {} as unknown as VentanaDictado['SpeechRecognition'],
  navigator: { userAgent: 'Chrome', maxTouchPoints: 0 },
}

/** Una `DietaGuardada` cualquiera: el bloque solo lee de ella el texto y la fecha. */
function guardada(interpretada: DietaInterpretada): DietaGuardada {
  return {
    version: 1,
    texto: 'Desayuno 250 g de kéfir con 25 g de almendras.',
    interpretada,
    fecha: '2026-09-12',
    activa: true,
    gustos_sumados: { excluidos: [], favoritos: [] },
  }
}

const DIETA = guardada({
  comidas: [],
  gustos: [],
  habitos: [],
  no_entendido: [],
  notas: [],
  falta_aceite: false,
})

function pinta(compuesto: DiaCompuesto, props: Record<string, unknown> = {}): string {
  return renderToStaticMarkup(
    createElement(BloqueDietaPropia, {
      compuesto,
      dieta: DIETA,
      inputs: INPUTS,
      comidasPlan: COMIDAS_PLAN,
      onCorregir: () => {},
      onValidada: () => {},
      onOtroEjemplo: () => {},
      onVerPropuesto: () => {},
      onExcluirAlimento: () => {},
      onResponderPregunta: () => {},
      ventana: CON_MICRO,
      ...props,
    }),
  )
}

const PARCIAL = DIAS_CON_PROPUESTA.desayuno_solo
const CONTEXTO = DIAS_CON_PROPUESTA.solo_contexto

/** El mismo día pero con un hueco caído a plantillas: la pantalla enseña las dos etiquetas. */
const MIXTO: DiaCompuesto = {
  ...PARCIAL,
  origen_huecos: 'mixto',
  apuntado: ['Para Cena no nos ha convencido la propuesta y hemos usado la nuestra.'],
  comidas: PARCIAL.comidas.map((comida): ComidaCompuesta => {
    if (comida.nombre !== 'Cena') return comida
    const plantilla = DIAS_COMPUESTOS.desayuno_solo.comidas.find((c) => c.nombre === 'Cena')
    return plantilla ?? comida
  }),
}

// ---- §4bis.5: el distintivo y la línea que lo explica ---------------------

describe('distintivo "propuesta IA" (§4bis.5)', () => {
  it('marca las comidas del modelo y explica quién pone los gramos', () => {
    const html = pinta(PARCIAL)
    expect(html).toContain('>propuesta IA<')
    expect(html).toContain('dieta-origen-ia')
    expect(html).toContain(LINEA_PROPUESTA_IA)
    // El desayuno sigue siendo suyo: la etiqueta "tuya" no se va.
    expect(html).toContain('>tuya<')
  })

  it('un hueco que no convenció conserva su etiqueta "propuesta" y su nota apuntada', () => {
    const html = pinta(MIXTO)
    expect(html).toContain('>propuesta IA<')
    expect(html).toContain('>propuesta<')
    expect(html).toContain('Para Cena no nos ha convencido la propuesta y hemos usado la nuestra.')
  })

  it('sin propuesta el bloque no dice nada de la IA ni entra en aria-busy', () => {
    const html = pinta(DIAS_COMPUESTOS.desayuno_solo)
    expect(html).not.toContain('propuesta IA')
    expect(html).not.toContain(LINEA_PROPUESTA_IA)
    expect(html).not.toContain(PIDIENDO_PROPUESTA)
    expect(html).not.toContain('aria-busy="true"')
    expect(html).toContain(BOTON_OTRO_EJEMPLO)
  })
})

// ---- §4bis.3: la fila de una comida propuesta por el modelo ---------------

describe('fila de una comida "propuesta_ia" (§4bis.3)', () => {
  it('lleva gramos, estado y totales, como una comida propia', () => {
    const html = pinta(PARCIAL)
    expect(html).toContain('140 g')
    expect(html).toContain('Pechuga de pollo (cruda, sin piel)')
    // El estado se sigue diciendo: 70 g de arroz son 70 g EN CRUDO.
    expect(html).toContain('en crudo')
  })

  it('no ofrece "Cambiar" ni "Esto no lo como": lo que se cambia es la propuesta entera', () => {
    const html = pinta(PARCIAL)
    expect(html).not.toContain('aria-label="Cambiar Pechuga de pollo (cruda, sin piel)"')
    expect(html).not.toContain('aria-label="Quitar Merluza de mis comidas"')
    // Las comidas dictadas sí las conservan.
    expect(html).toContain('aria-label="Cambiar Kéfir natural entero"')
    expect(html).toContain('aria-label="Quitar Kéfir natural entero de mis comidas"')
  })

  it('no pinta "(antes N g)" ni las etiquetas de cambio: ese gramaje no lo dijo nadie', () => {
    const html = pinta(PARCIAL)
    expect(html).not.toContain('(antes ')
    expect(html).not.toContain('dieta-etiqueta-baja')
    expect(html).not.toContain('dieta-etiqueta-sube')
  })

  it('"estimado" sí se sigue diciendo en una fila de la IA', () => {
    const conEstimado: DiaCompuesto = {
      ...PARCIAL,
      comidas: PARCIAL.comidas.map((comida) =>
        comida.origen !== 'propuesta_ia'
          ? comida
          : {
              ...comida,
              alimentos: comida.alimentos.map((a, i) =>
                i === 0 ? { ...a, origen_macros: 'estimado' as const } : a,
              ),
            },
      ),
    }
    expect(pinta(conEstimado)).toContain('aria-label="macros estimados, no está en nuestra base"')
  })
})

// ---- §4bis.5: la tarjeta de pregunta --------------------------------------

describe('tarjeta "Una pregunta antes de seguir" (§4bis.5)', () => {
  it('pinta la pregunta, sus opciones y las tres acciones', () => {
    const html = pinta(PARCIAL)
    expect(html).toContain(TITULO_PREGUNTA_IA)
    expect(html).toContain('¿Repetimos el pollo también en la cena?')
    // Opciones como botones secundarios.
    expect(html).toContain('class="btn btn-secundario">No, mejor variar</button>')
    expect(html).toContain('Sí, me da igual')
    expect(html).toContain(ETIQUETA_OTRA_RESPUESTA)
    expect(html).toContain(BOTON_RESPONDER)
    expect(html).toContain(BOTON_SEGUIR)
  })

  it('las dos preguntas de una propuesta caben en la misma tarjeta, con su campo cada una', () => {
    const html = pinta(CONTEXTO)
    expect(html).toContain('¿Te va bien la avena por las mañanas?')
    expect(html).toContain('¿Metemos alguna verdura más en la cena?')
    expect(html.match(/Otra respuesta/g)?.length).toBe(2)
    // Un solo "Seguir así": cierra la tarjeta entera.
    expect(html.match(/Seguir así/g)?.length).toBe(1)
  })

  it('sin preguntas no hay tarjeta', () => {
    const html = pinta({ ...PARCIAL, preguntas: [] })
    expect(html).not.toContain(TITULO_PREGUNTA_IA)
  })

  it('sin quien reciba la respuesta tampoco se pinta: sería un botón que no hace nada', () => {
    const html = pinta(PARCIAL, { onResponderPregunta: undefined })
    expect(html).not.toContain(TITULO_PREGUNTA_IA)
  })
})

// ---- §4bis.4: pidiendo, sin IA y errores ---------------------------------

describe('estados de la propuesta (§4bis.4 y §4bis.5)', () => {
  it('mientras la propuesta viaja el bloque lo dice y entra en aria-busy', () => {
    const html = pinta(DIAS_COMPUESTOS.desayuno_solo, { pidiendoIa: true })
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain(PIDIENDO_PROPUESTA)
    // Y mientras tanto se sigue viendo lo que había: las plantillas.
    expect(html).toContain('>propuesta<')
  })

  it('sin IA, y solo si antes la hubo, se dice de dónde sale el menú', () => {
    const html = pinta(DIAS_COMPUESTOS.desayuno_solo, { sinIa: true })
    expect(html).toContain(LINEA_SIN_IA)
    expect(pinta(DIAS_COMPUESTOS.desayuno_solo)).not.toContain(LINEA_SIN_IA)
    // Con huecos de la IA en pantalla la línea sobraría: no es verdad.
    expect(pinta(PARCIAL, { sinIa: true })).not.toContain(LINEA_SIN_IA)
  })

  it('el error de §5.3 sale en un role="alert" y no se lleva por delante lo que había', () => {
    const html = pinta(PARCIAL, { errorIa: ERROR_CUOTA })
    expect(html).toContain('role="alert"')
    expect(html).toContain(ERROR_CUOTA)
    expect(html).toContain('>propuesta IA<')
    expect(html).toContain('140 g')
  })
})

// ---- §4bis.3: "Otra propuesta" y el consejo -------------------------------

describe('"Otra propuesta" y el consejo del modelo (§4bis.3 y §4bis.5)', () => {
  it('con huecos de la IA el botón pide otra propuesta', () => {
    const html = pinta(PARCIAL)
    expect(html).toContain(BOTON_OTRA_PROPUESTA)
    expect(html).not.toContain(BOTON_OTRO_EJEMPLO)
  })

  it('sin huecos de la IA sigue diciendo "Ver otro ejemplo"', () => {
    const html = pinta(DIAS_COMPUESTOS.solo_contexto)
    expect(html).toContain(BOTON_OTRO_EJEMPLO)
    expect(html).not.toContain(BOTON_OTRA_PROPUESTA)
  })

  it('el consejo se pinta una sola vez, aunque llegue también como aviso', () => {
    const consejo = PARCIAL.consejo_ia ?? ''
    expect(consejo).not.toBe('')
    // El día trae el aviso DIETA_CONSEJO_IA con ese mismo texto (§4bis.3).
    expect(PARCIAL.avisos.some((a) => a.codigo === 'DIETA_CONSEJO_IA')).toBe(true)
    const html = pinta(PARCIAL)
    expect(html).toContain('dieta-consejo')
    expect(html.split(consejo).length - 1).toBe(1)
  })

  it('un aviso DIETA_CONSEJO_IA sin `consejo_ia` se sigue imprimiendo como aviso', () => {
    const html = pinta({ ...PARCIAL, consejo_ia: null })
    expect(html).toContain('Tu desayuno ya trae casi toda la grasa del día')
    expect(html).not.toContain('dieta-consejo')
  })
})
