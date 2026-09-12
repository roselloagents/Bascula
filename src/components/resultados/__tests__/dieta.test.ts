// "Cuéntanos cómo comes" en la pantalla de resultados (SPEC-dieta-propia §5 y §8).
//
// Se usa `renderToStaticMarkup`, como el resto de tests de componentes: no hace falta jsdom para
// comprobar qué pinta cada bloque con un `DiaCompuesto` dado. Los días compuestos salen de los
// fixtures del algoritmo (`src/meals/__tests__/dieta-fixtures.ts`), así que lo que se comprueba es
// la salida real de `componerDia`, no una maqueta.

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type {
  AlimentoAjustado,
  DiaCompuesto,
  DietaInterpretada,
  Ejemplos,
  EjemploDia,
  InputCalculo,
  Resultado,
} from '../../../engine/types'
import type { DietaGuardada } from '../../../dieta/almacen'
import type { VentanaDictado } from '../../../dieta/dictado'
import { DIAS_COMPUESTOS, PLAN_1780 } from '../../../meals/__tests__/dieta-fixtures'
import { BloqueDietaPropia } from '../BloqueDietaPropia'
import { FormularioDieta } from '../FormularioDieta'
import { TarjetaDietaPropia } from '../TarjetaDietaPropia'
import { Resultados } from '../Resultados'
import { localizarAlimento, ofreceDietaPropia, textoListo } from '../dieta'

// ---- Dobles ---------------------------------------------------------------

/** Una `window` con Web Speech API; sin ella no se pinta el botón de micrófono (§5.3). */
const CON_MICRO: VentanaDictado = {
  SpeechRecognition: function () {} as unknown as VentanaDictado['SpeechRecognition'],
  navigator: { userAgent: 'Chrome', maxTouchPoints: 0 },
}
/** WebView de WhatsApp: sin dictado. */
const SIN_MICRO: VentanaDictado = {
  navigator: { userAgent: 'Mozilla/5.0 (Linux; Android 13) FBAN/FB4A', maxTouchPoints: 5 },
}

const INPUTS = PLAN_1780.inputs
const RESULTADO = PLAN_1780.resultado
const COMIDAS_PLAN = RESULTADO.comidas.map((c) => c.nombre)

function guardada(parcial: Partial<DietaGuardada> = {}): DietaGuardada {
  return {
    version: 1,
    texto: 'Desayuno 250 g de kéfir con 25 g de almendras.',
    interpretada: DIETA_DEL_DESAYUNO,
    fecha: '2026-09-12',
    activa: true,
    gustos_sumados: { excluidos: [], favoritos: [] },
    ...parcial,
  }
}

/** La interpretación del desayuno del §0, tal y como la guarda `bascula:dieta:v1`. */
const DIETA_DEL_DESAYUNO: DietaInterpretada = {
  comidas: [
    {
      nombre: 'Desayuno',
      alimentos: [
        {
          texto: '250 g de kéfir',
          nombre: 'Kéfir natural entero',
          alimento_id: 'kefir_entero',
          estado: 'listo',
          grupo_aprox: 'lacteo',
          gramos: 250,
          macros_100g: { kcal: 62, prot: 3.3, carb: 4.5, fat: 3.3, fibra: 0, alcohol: 0 },
          origen_macros: 'catalogo',
          ajustable: true,
          confianza: 'alta',
        },
        {
          texto: 'unos cereales del Mercadona',
          nombre: 'Cereales de arroz integral y avena 0 %',
          alimento_id: null,
          estado: 'listo',
          grupo_aprox: 'carbohidrato',
          gramos: null,
          macros_100g: { kcal: 370, prot: 8, carb: 80, fat: 1.5, fibra: 6, alcohol: 0 },
          origen_macros: 'estimado',
          ajustable: true,
          confianza: 'media',
          nota: 'No has dicho la cantidad',
        },
      ],
    },
  ],
  gustos: [],
  habitos: [],
  no_entendido: [],
  notas: [],
  falta_aceite: false,
}

function pintaTarjeta(props: Partial<Parameters<typeof TarjetaDietaPropia>[0]> = {}): string {
  return renderToStaticMarkup(
    createElement(TarjetaDietaPropia, {
      dieta: null,
      comidasPlan: COMIDAS_PLAN,
      onValidada: () => {},
      onActivar: () => {},
      onBorrar: () => {},
      ventana: CON_MICRO,
      ...props,
    }),
  )
}

function pintaFormulario(ventana: VentanaDictado = CON_MICRO): string {
  return renderToStaticMarkup(
    createElement(FormularioDieta, {
      comidasPlan: COMIDAS_PLAN,
      token: 'abc',
      textoInicial: '',
      onValidada: () => {},
      onCancelar: () => {},
      ventana,
    }),
  )
}

function pintaBloque(compuesto: DiaCompuesto, props: Record<string, unknown> = {}): string {
  return renderToStaticMarkup(
    createElement(BloqueDietaPropia, {
      compuesto,
      dieta: guardada(),
      inputs: INPUTS,
      comidasPlan: COMIDAS_PLAN,
      onCorregir: () => {},
      onValidada: () => {},
      onOtroEjemplo: () => {},
      onVerPropuesto: () => {},
      onExcluirAlimento: () => {},
      ventana: CON_MICRO,
      ...props,
    }),
  )
}

// ---- §5.2: la tarjeta en sus tres estados ---------------------------------

describe('tarjeta de entrada (§5.2)', () => {
  it('sin nada guardado ofrece dictar o escribir, con el título y la descripción literales', () => {
    const html = pintaTarjeta()
    expect(html).toContain('¿Ya tienes tus comidas o tus costumbres?')
    expect(html).toContain(
      'Montamos tu menú alrededor de lo tuyo y ajustamos los gramos a tu plan.',
    )
    expect(html).toContain('Dictar o escribir cómo como')
    expect(html).not.toContain('Ver mi menú con lo mío')
  })

  it('sin Web Speech API el botón solo habla de escribir', () => {
    const html = pintaTarjeta({ ventana: SIN_MICRO })
    expect(html).toContain('Escribir cómo como')
    expect(html).not.toContain('Dictar o escribir cómo como')
  })

  it('con algo guardado y no activo ofrece verlo y borrarlo, con su confirmación', () => {
    const html = pintaTarjeta({ dieta: guardada({ activa: false }) })
    expect(html).toContain('Tienes guardado lo que nos contaste de tus comidas.')
    expect(html).toContain('Ver mi menú con lo mío')
    expect(html).toContain('Borrar lo que conté')
    expect(html).toContain('¿Borrar lo que nos contaste de tus comidas?')
    expect(html).toContain('Tendrás que dictarlo otra vez.')
  })

  it('sin la función disponible enseña la nota de §5.2 en un role="status"', () => {
    const html = pintaTarjeta({ aperturaInicial: 'no_disponible' })
    expect(html).toContain('role="status"')
    expect(html).toContain('Esta función no está disponible ahora mismo.')
  })

  it('el formulario se despliega dentro de la tarjeta cuando hay capacidades', () => {
    const html = pintaTarjeta({ aperturaInicial: 'abierto' })
    expect(html).toContain('Cómo comes un día normal')
    expect(html).toContain('Montar mi menú con esto')
  })
})

describe('cuándo se ofrece la función (§5.1)', () => {
  const ejemplos = (comidas: number): Ejemplos =>
    ({
      entreno: { comidas: new Array(comidas).fill({}) } as unknown as EjemploDia,
    }) as Ejemplos

  it('no se ofrece con renal, hepatica, tca ni sin menú', () => {
    expect(ofreceDietaPropia(INPUTS, ejemplos(3))).toBe(true)
    expect(ofreceDietaPropia({ ...INPUTS, condiciones: ['renal'] }, ejemplos(3))).toBe(false)
    expect(ofreceDietaPropia({ ...INPUTS, condiciones: ['hepatica'] }, ejemplos(3))).toBe(false)
    expect(ofreceDietaPropia({ ...INPUTS, condiciones: ['tca'] }, ejemplos(3))).toBe(false)
    expect(ofreceDietaPropia(INPUTS, ejemplos(0))).toBe(false)
  })
})

// ---- §5.3: el formulario ---------------------------------------------------

describe('formulario (§5.3)', () => {
  it('trae etiqueta, ejemplo, contador enlazado, pista y privacidad completa con dictado', () => {
    const html = pintaFormulario()
    expect(html).toContain('Cómo comes un día normal')
    expect(html).toContain('Desayuno siempre 250 g de kéfir con 25 g de almendras.')
    expect(html).toContain('/ 4 000')
    expect(html).toContain('aria-describedby=')
    // El contador se anuncia solo: con 4 800 caracteres hay que verlo venir antes de pulsar.
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('Puedes contarnos una sola comida o el día entero')
    expect(html).toContain('Al dictar, tu navegador usa el servicio de voz de Google')
    expect(html).toContain('Para entenderlo, el texto viaja a nuestro servidor')
  })

  it('con dictado pinta el botón de micrófono con nombre estable y aria-pressed', () => {
    const html = pintaFormulario()
    expect(html).toContain('aria-label="Dictar"')
    expect(html).toContain('aria-pressed="false"')
    expect(html).toContain('Si prefieres que tu voz no salga del móvil, escríbelo.')
  })

  it('sin dictado no hay botón, se explica el WebView y se ofrece copiar el enlace', () => {
    const html = pintaFormulario(SIN_MICRO)
    expect(html).not.toContain('aria-label="Dictar"')
    expect(html).toContain('Aquí no podemos usar el micrófono.')
    expect(html).toContain('Abrir en el navegador')
    expect(html).toContain('Copiar el enlace')
    // La primera frase de la privacidad es la del dictado: sin micrófono no se dice.
    expect(html).not.toContain('Al dictar, tu navegador usa el servicio de voz')
  })

  it('el botón principal está siempre operable: con poco texto solo queda aria-disabled', () => {
    const html = pintaFormulario()
    expect(html).toContain('Montar mi menú con esto')
    expect(html).toContain('aria-disabled="true"')
    expect(html).not.toContain('<button type="button" class="btn btn-principal" disabled')
  })

  it('el resumen del status omite los ceros y concuerda en singular', () => {
    expect(textoListo({ ...DIETA_DEL_DESAYUNO })).toBe(
      'Listo: hemos leído 1 comida. Revisa que sea lo tuyo.',
    )
    expect(
      textoListo({
        ...DIETA_DEL_DESAYUNO,
        gustos: [{ texto: 'no me gusta el brócoli', tipo: 'no_gusta', alimento_ids: ['brocoli'] }],
        habitos: [{ texto: 'ceno ligero', tipo: 'ligera', comida: 'Cena', valor: null }],
      }),
    ).toBe('Listo: hemos leído 1 comida, 1 gusto y 1 costumbre. Revisa que sea lo tuyo.')
  })
})

// ---- §5.4: el bloque compuesto --------------------------------------------

describe('bloque compuesto (§5.4)', () => {
  it('modo parcial: título, distintivo, descripción, fecha y etiquetas tuya/propuesta', () => {
    const html = pintaBloque(DIAS_COMPUESTOS.desayuno_solo)
    expect(html).toContain('Tu menú, con lo tuyo dentro')
    expect(html).toContain('con tus comidas')
    expect(html).toContain('Las comidas que nos contaste van tal cual')
    expect(html).toContain('Nos lo contaste el 12 de septiembre de 2026.')
    expect(html).toContain('>tuya<')
    expect(html).toContain('>propuesta<')
    // Con pendientes, el día es provisional (§4.4 DIETA_PENDIENTES).
    expect(html).toContain('provisional')
  })

  it('modo completa: su descripción y ningún hueco montado, así que no hay "Ver otro ejemplo"', () => {
    const html = pintaBloque(DIAS_COMPUESTOS.dia_completo)
    expect(html).toContain('Estas son tus comidas. Hemos movido los gramos lo justo')
    expect(html).not.toContain('>propuesta<')
    expect(html).not.toContain('Ver otro ejemplo')
  })

  it('modo solo contexto: su descripción, todo propuesto y "Ver otro ejemplo"', () => {
    const html = pintaBloque(DIAS_COMPUESTOS.solo_contexto)
    expect(html).toContain('Hemos montado el día con lo que nos contaste')
    expect(html).not.toContain('>tuya<')
    expect(html).toContain('Ver otro ejemplo')
  })

  it('cada fila dictada lleva sus gramos, su estado, su cambio y sus acciones', () => {
    const html = pintaBloque(DIAS_COMPUESTOS.dia_completo)
    expect(html).toContain('en crudo')
    expect(html).toContain('aria-label="Cambiar Pechuga de pollo (cruda, sin piel)"')
    expect(html).toContain('aria-label="Quitar Pechuga de pollo (cruda, sin piel) de mis comidas"')
    // Contable: la cuenta que se pinta es la de los gramos FINALES (165 g = 3 huevos), no la
    // dictada (5): la fila no puede contradecirse a sí misma (§5.4).
    expect(html).toContain('165 g')
    expect(html).toContain('3 × huevo M')
    expect(html).not.toContain('5 × huevo M')
    // Y se dice de dónde viene ese gramaje: "(antes N g)", como en el PDF.
    expect(html).toContain('(antes 275 g)')
    // El distintivo "provisional" se explica sin bajar tres comidas.
    expect(html).toContain('nos falta la cantidad de algún alimento')
    // La desviación necesita un rol que admita `aria-label` (ARIA 1.2 §5.2.8.6).
    expect(html).toContain('class="dieta-desvio dieta-desvio-baja" role="img"')
    expect(html).toContain('Esto no lo como')
  })

  it('los pendientes preguntan la cantidad y no enseñan gramos', () => {
    const html = pintaBloque(DIAS_COMPUESTOS.desayuno_solo)
    expect(html).toContain('¿cuántos gramos?')
    expect(html).toContain('Añadir')
    expect(html).toContain('—')
  })

  it('"estimado" lleva su nombre accesible y "del envase" se distingue', () => {
    const dia = conAlimento(DIAS_COMPUESTOS.desayuno_solo, (a) => ({
      ...a,
      origen_macros: 'estimado',
    }))
    expect(pintaBloque(dia)).toContain('aria-label="macros estimados, no está en nuestra base"')
    const envase = conAlimento(DIAS_COMPUESTOS.desayuno_solo, (a) => ({
      ...a,
      origen_macros: 'envase',
    }))
    expect(pintaBloque(envase)).toContain('del envase')
  })

  it('aplicado y apuntado se pintan como chips con su título', () => {
    const dia: DiaCompuesto = {
      ...DIAS_COMPUESTOS.desayuno_solo,
      aplicado: ['Sin brócoli'],
      apuntado: ['«hago cinco comidas»: cambia el número de comidas en «Editar tus datos»'],
    }
    const html = pintaBloque(dia)
    expect(html).toContain('Lo que hemos tenido en cuenta')
    expect(html).toContain('Sin brócoli')
    expect(html).toContain('Apuntado, pero aún no lo aplicamos')
  })

  it('solo se ven tres avisos y el resto queda tras "Ver n avisos más"', () => {
    const dia: DiaCompuesto = {
      ...DIAS_COMPUESTOS.desayuno_solo,
      avisos: [1, 2, 3, 4, 5].map((n) => ({ codigo: `A${n}`, texto: `Aviso número ${n}.` })),
    }
    const html = pintaBloque(dia)
    expect(html).toContain('Aviso número 1.')
    expect(html).toContain('Aviso número 3.')
    expect(html).not.toContain('Aviso número 4.')
    expect(html).toContain('Ver 2 avisos más')
  })

  it('lo no entendido se cita y se dice qué hacer; las notas se pintan enteras', () => {
    const dia: DiaCompuesto = {
      ...DIAS_COMPUESTOS.desayuno_solo,
      no_entendido: [{ texto: 'tiras de fibra', sugerencia: '¿Quizá «tiras de fiambre de pavo»?' }],
      notas: ['He tomado el scoop como 60 g, como has dicho'],
    }
    const html = pintaBloque(dia)
    expect(html).toContain('No hemos entendido: «tiras de fibra»')
    expect(html).toContain('¿Quizá «tiras de fiambre de pavo»?')
    expect(html).toContain('Edita el texto y vuelve a intentarlo.')
    expect(html).toContain('He tomado el scoop como 60 g, como has dicho')
  })

  it('el total del día lleva el plan pedido, la fibra y la nota fija', () => {
    const html = pintaBloque(DIAS_COMPUESTOS.dia_completo)
    expect(html).toContain('Total:')
    expect(html).toContain('g de fibra')
    expect(html).toContain('Tu plan pedía:')
    expect(html).toContain('Las comidas marcadas «tuya» son tu comida real')
  })

  it('la desviación por macro se pinta con su nombre accesible cuando pasa del 2 %', () => {
    const dia: DiaCompuesto = {
      ...DIAS_COMPUESTOS.dia_completo,
      totales: { ...DIAS_COMPUESTOS.dia_completo.totales, prot: 100 },
      objetivo: { ...DIAS_COMPUESTOS.dia_completo.objetivo, prot: 145 },
    }
    const html = pintaBloque(dia)
    expect(html).toContain('aria-label="45 gramos de proteína por debajo del plan"')
    expect(html).toContain('−45 g')
  })

  it('las notas por condición van encima del bloque, con la línea extra de diabetes', () => {
    const html = pintaBloque(DIAS_COMPUESTOS.desayuno_solo, {
      inputs: { ...INPUTS, condiciones: ['diabetes'] },
    })
    expect(html).toContain('revisa la dosis con tu equipo médico')
    expect(html).toContain('Hemos movido gramos de hidratos para cuadrar el plan')
  })

  it('las comidas propuestas traen el "No me gusta" del menú de hoy', () => {
    const html = pintaBloque(DIAS_COMPUESTOS.solo_contexto)
    expect(html).toContain('de mi menú"')
    expect(html).toContain('No me gusta')
  })

  it('ofrece editar lo contado y volver al menú propuesto', () => {
    const html = pintaBloque(DIAS_COMPUESTOS.desayuno_solo)
    expect(html).toContain('Editar lo que conté')
    expect(html).toContain('Ver el menú propuesto')
  })
})

/** Devuelve el día con el primer alimento dictado transformado (para probar una etiqueta). */
function conAlimento(
  dia: DiaCompuesto,
  cambiar: (a: AlimentoAjustado) => AlimentoAjustado,
): DiaCompuesto {
  let hecho = false
  return {
    ...dia,
    comidas: dia.comidas.map((c) =>
      c.origen !== 'propia' || hecho
        ? c
        : {
            ...c,
            alimentos: c.alimentos.map((a, i) => {
              if (i > 0) return a
              hecho = true
              return cambiar(a)
            }),
          },
    ),
  }
}

// ---- De la fila que se ve a lo guardado -----------------------------------

describe('localizarAlimento', () => {
  it('empareja la comida por nombre normalizado y salta los retirados', () => {
    const interpretada: DietaInterpretada = {
      ...DIETA_DEL_DESAYUNO,
      comidas: [
        {
          nombre: 'desayuno',
          alimentos: [
            { ...DIETA_DEL_DESAYUNO.comidas[0].alimentos[0], retirado: true },
            DIETA_DEL_DESAYUNO.comidas[0].alimentos[1],
          ],
        },
      ],
    }
    expect(localizarAlimento(interpretada, 'Desayuno', 0)).toEqual({ comida: 0, alimento: 1 })
    expect(localizarAlimento(interpretada, 'Desayuno', 1)).toBeNull()
    expect(localizarAlimento(interpretada, 'Cena', 0)).toBeNull()
  })
})

// ---- §5.1: la pantalla entera ---------------------------------------------

const DIA_MENU: EjemploDia = {
  tipo: 'entreno',
  comidas: [
    {
      comida: 'Comida',
      hora: '14:00',
      peri: false,
      objetivo: { kcal: 600, prot: 40, carb: 60, fat: 18 },
      alimentos: [
        {
          id: 'brocoli',
          nombre: 'Brócoli (cocido)',
          gramos: 200,
          medida: '2 puñados',
          kcal: 70,
          prot: 6,
          carb: 8,
          fat: 1,
        },
      ],
      totales: { kcal: 70, prot: 6, carb: 8, fat: 1 },
      alternativas: [],
    },
  ],
  totales: { kcal: 70, prot: 6, carb: 8, fat: 1 },
  notas: [],
}

const EJEMPLOS: Ejemplos = {
  entreno: DIA_MENU,
  descanso: DIA_MENU,
  consejos: [],
  equivalencias: { cabecera: '', nota_verdura_fruta: '', tablas: [] },
}

function pintaPantalla(extra: Record<string, unknown> = {}): string {
  return renderToStaticMarkup(
    createElement(Resultados, {
      inputs: INPUTS as InputCalculo,
      resultado: RESULTADO as Resultado,
      base: RESULTADO as Resultado,
      ejemplos: EJEMPLOS,
      avisos: [],
      ajuste: null,
      pesajes: [],
      onAjustar: () => {},
      onPesajes: () => {},
      onEditar: () => {},
      onOtroEjemplo: () => {},
      onDieta: () => {},
      ...extra,
    }),
  )
}

describe('pantalla de resultados con y sin composición (§5.1)', () => {
  it('sin composición: la tarjeta encima del menú y el enlace de la cabecera', () => {
    const html = pintaPantalla()
    expect(html).toContain('¿Ya tienes tus comidas o tus costumbres? Cuéntanoslas')
    expect(html).toContain('href="#tarjeta-dieta"')
    expect(html).toContain('Un día de ejemplo')
    expect(html).not.toContain('Tu menú, con lo tuyo dentro')
    expect(html).not.toContain('Este reparto es el que te proponíamos')
  })

  it('con composición activa: el bloque sustituye al menú y el reparto lleva su nota', () => {
    const html = pintaPantalla({
      dieta: guardada(),
      compuesto: DIAS_COMPUESTOS.desayuno_solo,
    })
    expect(html).toContain('Tu menú, con lo tuyo dentro')
    expect(html).not.toContain('Un día de ejemplo')
    expect(html).toContain('Este reparto es el que te proponíamos')
    // El enlace de descubribilidad solo tiene sentido con la tarjeta en pantalla.
    expect(html).not.toContain('href="#tarjeta-dieta"')
  })

  it('sin `onDieta` (vistas de solo lectura) la función no aparece por ninguna parte', () => {
    const html = pintaPantalla({ onDieta: undefined })
    expect(html).not.toContain('¿Ya tienes tus comidas o tus costumbres?')
  })
})
