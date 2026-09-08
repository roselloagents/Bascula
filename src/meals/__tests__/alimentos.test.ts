// Alimentos excluidos y favoritos (docs/SPEC-ux-comidas-pdf.md §3.2b) y alimentos de los días de
// regla (§3.8). Las dos listas del paso 14 del wizard viajan en `InputCalculo`, el motor las
// ignora y este módulo es el único que las lee.
//
// Lo que estos tests protegen, en orden de importancia:
//   1. un excluido no aparece en NINGÚN sitio (menú, alternativas, equivalencias, compra, ciclo);
//   2. un favorito va primero, sin saltarse ningún filtro y sin romper el tope de 12 del modo
//      sencillo;
//   3. sin exclusiones ni favoritos, el menú es EXACTAMENTE el de la v1.1;
//   4. los `extra` de la v1.2 no entran en ningún menú, ni en las equivalencias, ni en la compra;
//   5. todo sigue siendo determinista.
import { describe, expect, it } from 'vitest'
import { ALIMENTOS, alimentoPorId } from '../../data/foods'
import type { Alimento } from '../../data/foods'
import type { Ejemplos, Inputs, NComidas, Preferencia, Restriccion, Resultado, SintomaRegla } from '../../engine/types'
import { MAX_ALIMENTOS_SENCILLO } from '../bancoSencillo'
import { MAX_ITEMS_OPCIONAL_CICLO, NOTA_OPCIONAL_CICLO, TITULO_OPCIONAL_CICLO } from '../compra'
import { MAX_ALIMENTOS_CICLO, TABLA_CICLO } from '../ciclo'
import { equivalencias } from '../equivalencias'
import { pasaPreferencia } from '../filtros'
import { generarEjemplos, generarListaCompra } from '../index'
import { nombreCorto } from '../textos'
import { bancoDe, inputsDe, resultadoDe } from './fixtures'

interface Caso {
  etiqueta: string
  base: 'omnivoro' | 'vegetariano' | 'vegano'
  restricciones: Restriccion[]
  /** Alimentos que el menú de ese perfil usa de verdad, para que excluirlos signifique algo. */
  excluidos: string[]
  /** Favorito válido para ese perfil (pasa la base y todas las restricciones). */
  favorito: string
  /** Favorito que además cabe dentro del tope de 12 del modo sencillo (§3.7.2). */
  favoritoSencillo: string
}

const CASOS: Caso[] = [
  {
    etiqueta: 'omnívoro',
    base: 'omnivoro',
    restricciones: [],
    excluidos: ['brocoli', 'pechuga_pollo', 'arroz_blanco_cocido', 'platano', 'huevo_entero'],
    favorito: 'ternera_solomillo',
    favoritoSencillo: 'pechuga_pavo',
  },
  {
    etiqueta: 'vegetariano + sin gluten',
    base: 'vegetariano',
    restricciones: ['sin_gluten'],
    excluidos: ['huevo_entero', 'yogur_griego_0', 'arroz_blanco_cocido', 'manzana', 'brocoli'],
    favorito: 'queso_fresco_batido_0',
    favoritoSencillo: 'queso_fresco_batido_0',
  },
  {
    etiqueta: 'vegano',
    base: 'vegano',
    restricciones: [],
    excluidos: ['tofu_firme', 'lentejas_cocidas', 'arroz_blanco_cocido', 'platano', 'brocoli'],
    favorito: 'garbanzos_cocidos',
    favoritoSencillo: 'espinacas',
  },
]

const KCAL = [1600, 2200, 2800]
const COMIDAS: NComidas[] = [3, 4, 5]

function planDe(c: Caso, kcal: number, nComidas: NComidas) {
  return {
    kcal,
    nComidas,
    preferencia: bancoDe(c.base, c.restricciones),
    objetivo: 'mantener' as const,
    base: c.base,
    restricciones: c.restricciones,
  }
}

function generar(c: Caso, kcal: number, nComidas: NComidas, extra: Partial<Inputs>, sencillo = false): Ejemplos {
  const plan = planDe(c, kcal, nComidas)
  return generarEjemplos({ ...inputsDe(plan), menu_sencillo: sencillo, ...extra }, resultadoDe(plan))
}

/** Todos los ids que aparecen en el menú del día que viaja en `Ejemplos`. */
function idsDelMenu(e: Ejemplos): string[] {
  return e.entreno.comidas.flatMap((c) => c.alimentos.map((a) => a.id))
}

/**
 * Nombres de los alimentos prohibidos que pueden buscarse en el texto de las alternativas sin dar
 * falsos positivos: se descartan los que son subcadena del nombre de alguno permitido ("arroz
 * blanco" dentro de "arroz blanco integral").
 */
function nombresBuscables(prohibidos: readonly Alimento[], permitidos: readonly Alimento[]): string[] {
  const nombresPermitidos = permitidos.map(nombreCorto)
  return prohibidos
    .map(nombreCorto)
    .filter((n) => !nombresPermitidos.some((p) => p !== n && p.includes(n)))
}

describe('§3.2b — alimentos excluidos', () => {
  for (const c of CASOS) {
    for (const sencillo of [false, true]) {
      const modo = sencillo ? 'sencillo' : 'normal'

      it(`${c.etiqueta} (${modo}): ningún excluido aparece en el menú ni en la compra`, () => {
        for (const kcal of KCAL) {
          for (const n of COMIDAS) {
            const e = generar(c, kcal, n, { alimentos_excluidos: c.excluidos }, sencillo)
            const etiqueta = `${c.etiqueta} ${modo} ${kcal}/${n}`
            for (const id of idsDelMenu(e)) expect(c.excluidos, `${etiqueta} · menú`).not.toContain(id)
            for (const item of e.compra?.items ?? []) {
              expect(c.excluidos, `${etiqueta} · compra`).not.toContain(item.alimento_id)
            }
            for (const item of e.compra?.opcional_ciclo?.items ?? []) {
              expect(c.excluidos, `${etiqueta} · compra opcional`).not.toContain(item.alimento_id)
            }
            // Sin excluidos en el menú no hay nada que avisar (§3.2b, regla de respaldo).
            expect(e.avisos_menu ?? [], etiqueta).toEqual([])
          }
        }
      })

      it(`${c.etiqueta} (${modo}): ningún excluido se cuela en las alternativas`, () => {
        const e = generar(c, 2200, 4, { alimentos_excluidos: c.excluidos }, sencillo)
        const prohibidos = c.excluidos.map((id) => alimentoPorId(id)!)
        const permitidos = ALIMENTOS.filter((a) => !c.excluidos.includes(a.id))
        const nombres = nombresBuscables(prohibidos, permitidos)
        const texto = e.entreno.comidas.flatMap((x) => x.alternativas).join(' | ').toLowerCase()
        for (const n of nombres) expect(texto, `${c.etiqueta} ${modo}: "${n}"`).not.toContain(n)
      })
    }

    it(`${c.etiqueta}: ningún excluido aparece en las tablas de equivalencias`, () => {
      const plan = planDe(c, 2200, 4)
      const inputs = { ...inputsDe(plan), alimentos_excluidos: c.excluidos }
      const e = generarEjemplos(inputs, resultadoDe(plan))
      for (const tabla of e.equivalencias.tablas) {
        for (const fila of tabla.filas) expect(c.excluidos, tabla.titulo).not.toContain(fila.id)
      }
    })
  }

  it('un id que está en las dos listas cuenta solo como excluido', () => {
    const c = CASOS[0]
    const e = generar(c, 2200, 4, {
      alimentos_excluidos: ['pechuga_pollo'],
      alimentos_favoritos: ['pechuga_pollo', 'ternera_solomillo'],
    })
    expect(idsDelMenu(e)).not.toContain('pechuga_pollo')
    expect(idsDelMenu(e)).toContain('ternera_solomillo')
  })

  it('los ids que no existen en foods.json se descartan sin romper nada', () => {
    const c = CASOS[0]
    const e = generar(c, 2200, 4, {
      alimentos_excluidos: ['no_existe', ''],
      alimentos_favoritos: ['tampoco_existe'],
    })
    const limpio = generar(c, 2200, 4, {})
    expect(e.entreno.comidas).toEqual(limpio.entreno.comidas)
  })

  it('excluir TODAS las verduras no rompe el menú: se omiten y el día sigue cerrando', () => {
    const verduras = ALIMENTOS.filter((a) => a.roles.includes('verdura')).map((a) => a.id)
    for (const sencillo of [false, true]) {
      const e = generar(CASOS[0], 2200, 4, { alimentos_excluidos: verduras }, sencillo)
      const ids = idsDelMenu(e)
      expect(ids.length, `sencillo=${sencillo}`).toBeGreaterThan(0)
      for (const id of ids) expect(verduras).not.toContain(id)
      // La verdura es una consulta OPCIONAL: se omite, no se fuerza un excluido ni se avisa.
      expect(e.avisos_menu ?? []).toEqual([])
      // Sin ninguna verdura que ofrecer, el modo sencillo se desactiva (§3.7.2, regla 4c).
      expect(e.modo_sencillo).toBe(false)
      for (const comida of e.entreno.comidas) {
        const desviacion = Math.abs(comida.totales.kcal - comida.objetivo.kcal) / comida.objetivo.kcal
        expect(desviacion, comida.comida).toBeLessThanOrEqual(0.1)
      }
    }
  })

  it('excluir todas las proteínas fuerza el respaldo con aviso, nunca una comida sin proteína', () => {
    const proteinas = ALIMENTOS.filter((a) => a.roles.includes('proteina')).map((a) => a.id)
    const e = generar(CASOS[0], 2200, 3, { alimentos_excluidos: proteinas })
    const avisos = e.avisos_menu ?? []
    expect(avisos.length).toBeGreaterThan(0)
    expect(new Set(avisos).size, 'sin duplicados').toBe(avisos.length)
    for (const aviso of avisos) {
      expect(aviso).toContain('No hemos podido evitar')
      expect(aviso).toContain('Cámbialo por lo que quieras de la tabla de equivalencias.')
    }
    // Hay un aviso por cada alimento excluido que ha tenido que volver, y ninguno de más.
    const forzados = new Set(idsDelMenu(e).filter((id) => proteinas.includes(id)))
    expect(forzados.size).toBeGreaterThan(0)
    expect(avisos.length).toBe(
      e.entreno.comidas.filter((c) => c.alimentos.some((a) => proteinas.includes(a.id))).length,
    )
    for (const comida of e.entreno.comidas) {
      expect(comida.alimentos.length, comida.comida).toBeGreaterThan(0)
    }
  })

  it('el respaldo NUNCA relaja la base dietética ni una restricción', () => {
    // A un vegano se le vacía el rol de proteína entero: antes que servirle pollo, se le sirve
    // un alimento vegano que él mismo había excluido.
    const c = CASOS[2]
    const veganos = ALIMENTOS.filter((a) => a.tags.includes('vegano') && a.roles.includes('proteina'))
    const e = generar(c, 2200, 3, { alimentos_excluidos: veganos.map((a) => a.id) })
    for (const id of idsDelMenu(e)) {
      expect(pasaPreferencia(alimentoPorId(id)!, 'vegano'), id).toBe(true)
    }
    expect((e.avisos_menu ?? []).length).toBeGreaterThan(0)
  })
})

describe('§3.2b — alimentos favoritos', () => {
  for (const c of CASOS) {
    it(`${c.etiqueta}: el favorito entra en el menú`, () => {
      const e = generar(c, 2200, 4, { alimentos_favoritos: [c.favorito] })
      expect(idsDelMenu(e), c.etiqueta).toContain(c.favorito)
    })

    it(`${c.etiqueta}: en modo sencillo el favorito entra si cabe en la lista corta`, () => {
      const e = generar(c, 2200, 4, { alimentos_favoritos: [c.favoritoSencillo] }, true)
      expect(idsDelMenu(e), c.etiqueta).toContain(c.favoritoSencillo)
      expect(e.compra!.alimentos_distintos).toBeLessThanOrEqual(MAX_ALIMENTOS_SENCILLO)
    })

    it(`${c.etiqueta}: en modo sencillo el favorito no rompe el tope de ${MAX_ALIMENTOS_SENCILLO}`, () => {
      for (const kcal of KCAL) {
        for (const n of COMIDAS) {
          const e = generar(c, kcal, n, { alimentos_favoritos: [c.favorito] }, true)
          expect(e.compra!.alimentos_distintos, `${c.etiqueta} ${kcal}/${n}`).toBeLessThanOrEqual(
            MAX_ALIMENTOS_SENCILLO,
          )
        }
      }
    })
  }

  it('el tope de 12 manda sobre el gusto: si el favorito no cabe, no entra', () => {
    // Banco vegano: sus doce plazas están ocupadas y los garbanzos no ganan todas las consultas
    // de proteína, así que añadirían un decimotercer alimento a la semana. §3.2b es explícita:
    // "sin superar nunca el tope de 12"; el favorito se retira y la semana sigue cabiendo.
    const c = CASOS[2]
    const e = generar(c, 2200, 4, { alimentos_favoritos: ['garbanzos_cocidos'] }, true)
    expect(e.compra!.alimentos_distintos).toBeLessThanOrEqual(MAX_ALIMENTOS_SENCILLO)
    const sinFavorito = generar(c, 2200, 4, {}, true)
    expect(e.entreno.comidas).toEqual(sinFavorito.entreno.comidas)
  })

  it('con varios favoritos se retiran por el final hasta que la semana cabe', () => {
    const c = CASOS[0]
    for (const kcal of KCAL) {
      for (const n of COMIDAS) {
        const e = generar(
          c,
          kcal,
          n,
          { alimentos_favoritos: ['pechuga_pavo', 'garbanzos_cocidos', 'boniato_cocido', 'nueces', 'pera'] },
          true,
        )
        expect(e.compra!.alimentos_distintos, `${kcal}/${n}`).toBeLessThanOrEqual(MAX_ALIMENTOS_SENCILLO)
        // El primero de la lista es el que más aguanta: es el orden del usuario.
        expect(idsDelMenu(e), `${kcal}/${n}`).toContain('pechuga_pavo')
      }
    }
  })

  it('ningún plato repite el mismo alimento en dos anclas', () => {
    for (const c of CASOS) {
      for (const sencillo of [false, true]) {
        const e = generar(
          c,
          2200,
          4,
          { alimentos_favoritos: [c.favorito, c.favoritoSencillo], alimentos_excluidos: c.excluidos },
          sencillo,
        )
        for (const comida of e.entreno.comidas) {
          const ids = comida.alimentos.map((a) => a.id)
          expect(new Set(ids).size, `${c.etiqueta} ${comida.comida}`).toBe(ids.length)
        }
      }
    }
  })

  it('un favorito que no pasa la base no aparece: ser favorito no salta ningún filtro', () => {
    const c = CASOS[2] // vegano
    for (const sencillo of [false, true]) {
      const e = generar(c, 2200, 4, { alimentos_favoritos: ['pechuga_pollo', 'queso_curado'] }, sencillo)
      for (const id of idsDelMenu(e)) {
        expect(pasaPreferencia(alimentoPorId(id)!, 'vegano'), id).toBe(true)
      }
    }
  })

  it('un favorito de otro rol no se mete donde no le toca', () => {
    // "Me encanta el queso" no puede poner queso en la consulta de hidrato: el favorito ordena,
    // no valida. El queso aparece como proteína o lácteo, nunca de acompañamiento de arroz.
    const c = CASOS[0]
    const e = generar(c, 2200, 4, { alimentos_favoritos: ['queso_curado'] })
    for (const comida of e.entreno.comidas) {
      for (const a of comida.alimentos) {
        const alimento = alimentoPorId(a.id)!
        expect(alimento.roles.length, a.id).toBeGreaterThan(0)
      }
    }
    // Y la ración del favorito, si entra, sigue siendo una ración real (§3.3).
    const queso = e.entreno.comidas.flatMap((x) => x.alimentos).find((a) => a.id === 'queso_curado')
    if (queso) expect(queso.gramos).toBeGreaterThan(0)
  })

  it('el orden del usuario manda entre dos favoritos del mismo rol', () => {
    const c = CASOS[0]
    const primero = generar(c, 2200, 4, { alimentos_favoritos: ['salmon', 'ternera_solomillo'] })
    const segundo = generar(c, 2200, 4, { alimentos_favoritos: ['ternera_solomillo', 'salmon'] })
    const desayuno = (e: Ejemplos): string[] => e.entreno.comidas[0].alimentos.map((a) => a.id)
    expect(desayuno(primero)).toContain('salmon')
    expect(desayuno(segundo)).toContain('ternera_solomillo')
  })
})

describe('§3.2b — lo que no cambia', () => {
  it('sin exclusiones ni favoritos el menú es exactamente el de siempre', () => {
    for (const c of CASOS) {
      for (const sencillo of [false, true]) {
        for (const kcal of KCAL) {
          const plan = planDe(c, kcal, 4)
          const base = generarEjemplos({ ...inputsDe(plan), menu_sencillo: sencillo }, resultadoDe(plan))
          const conCampos = generarEjemplos(
            {
              ...inputsDe(plan),
              menu_sencillo: sencillo,
              alimentos_excluidos: [],
              alimentos_favoritos: [],
            },
            resultadoDe(plan),
          )
          const nulos = generarEjemplos(
            {
              ...inputsDe(plan),
              menu_sencillo: sencillo,
              alimentos_excluidos: null,
              alimentos_favoritos: null,
            },
            resultadoDe(plan),
          )
          const etiqueta = `${c.etiqueta} ${kcal} sencillo=${sencillo}`
          expect(conCampos, etiqueta).toEqual(base)
          expect(nulos, etiqueta).toEqual(base)
          expect(base.avisos_menu, etiqueta).toBeUndefined()
        }
      }
    }
  })

  it('es determinista: dos generaciones con las mismas listas dan el mismo menú', () => {
    for (const c of CASOS) {
      for (const sencillo of [false, true]) {
        const extra = { alimentos_excluidos: c.excluidos, alimentos_favoritos: [c.favorito] }
        const a = generar(c, 2400, 5, extra, sencillo)
        const b = generar(c, 2400, 5, extra, sencillo)
        expect(a).toEqual(b)
      }
    }
  })

  it('la lista de la compra suelta respeta las mismas exclusiones', () => {
    for (const c of CASOS) {
      for (const sencillo of [false, true]) {
        const plan = planDe(c, 2200, 4)
        const inputs: Inputs = {
          ...inputsDe(plan),
          menu_sencillo: sencillo,
          alimentos_excluidos: c.excluidos,
        }
        const e = generarEjemplos(inputs, resultadoDe(plan))
        // `generarListaCompra` sobre un `Ejemplos` sin `compra` reconstruye el día B con el
        // mismo perfil (exclusiones incluidas): ningún camino puede meter un excluido.
        const suelta = generarListaCompra({ ...e, compra: undefined }, inputs)
        for (const item of suelta.items) expect(c.excluidos, c.etiqueta).not.toContain(item.alimento_id)
      }
    }
  })
})

describe('§3.0 — el tag `extra` no entra en ningún menú', () => {
  const extras = ALIMENTOS.filter((a) => a.tags.includes('extra')).map((a) => a.id)
  const PREFERENCIAS: Preferencia[] = [
    'omnivoro',
    'vegetariano',
    'vegano',
    'sin_lactosa',
    'sin_gluten',
    'low_carb',
  ]

  it('hay alimentos con tag `extra` en la base (si no, el test no prueba nada)', () => {
    expect(extras.length).toBeGreaterThan(0)
  })

  it('ni en el menú, ni en la compra, ni en las equivalencias, ni en las alternativas', () => {
    for (const preferencia of PREFERENCIAS) {
      for (const sencillo of [false, true]) {
        const plan = { kcal: 2200, nComidas: 4 as NComidas, preferencia, objetivo: 'mantener' as const }
        const e = generarEjemplos({ ...inputsDe(plan), menu_sencillo: sencillo }, resultadoDe(plan))
        for (const id of idsDelMenu(e)) expect(extras, preferencia).not.toContain(id)
        for (const item of e.compra?.items ?? []) expect(extras, preferencia).not.toContain(item.alimento_id)
        for (const tabla of e.equivalencias.tablas) {
          for (const fila of tabla.filas) expect(extras, `${preferencia} · ${tabla.titulo}`).not.toContain(fila.id)
        }
        const texto = e.entreno.comidas.flatMap((c) => c.alternativas).join(' | ').toLowerCase()
        for (const id of extras) {
          expect(texto, `${preferencia} · ${id}`).not.toContain(nombreCorto(alimentoPorId(id)!))
        }
      }
    }
  })

  it('tampoco en las tablas de equivalencias de las seis preferencias sueltas', () => {
    for (const preferencia of PREFERENCIAS) {
      for (const tabla of equivalencias(preferencia).tablas) {
        for (const fila of tabla.filas) expect(extras, `${preferencia} · ${tabla.titulo}`).not.toContain(fila.id)
      }
    }
  })
})

// ---------- §3.8: alimentos de los días de regla ----------

function conCiclo(resultado: Resultado, sintomas: SintomaRegla[]): Resultado {
  return { ...resultado, ciclo: { sintomas, consejos: [] } }
}

function generarConCiclo(c: Caso, sintomas: SintomaRegla[], extra: Partial<Inputs> = {}): Ejemplos {
  const plan = planDe(c, 2200, 4)
  return generarEjemplos({ ...inputsDe(plan), ...extra }, conCiclo(resultadoDe(plan), sintomas))
}

describe('§3.8.1 — alimentos_ciclo', () => {
  it('sin `resultado.ciclo` no se publica nada', () => {
    const e = generar(CASOS[0], 2200, 4, {})
    expect(e.alimentos_ciclo).toBeUndefined()
  })

  it('sangrado abundante: hierro, en el orden de la tabla y con su copy', () => {
    const e = generarConCiclo(CASOS[0], ['sangrado_abundante'])
    expect(e.alimentos_ciclo!.map((a) => a.id)).toEqual([
      'lentejas_cocidas',
      'ternera_solomillo',
      'mejillones_lata',
      'espinacas',
    ])
    for (const a of e.alimentos_ciclo!) {
      expect(a.por_que).toBe(TABLA_CICLO.sangrado_abundante.por_que)
      // `nombre` es el largo de `foods.json`, no el corto de los chips.
      expect(a.nombre).toBe(alimentoPorId(a.id)!.nombre)
    }
  })

  it('la base dietética filtra: una vegana no ve ternera ni mejillones', () => {
    const e = generarConCiclo(CASOS[2], ['sangrado_abundante'])
    expect(e.alimentos_ciclo!.map((a) => a.id)).toEqual(['lentejas_cocidas', 'espinacas'])
  })

  it('las restricciones filtran: sin gluten se lleva la avena del cansancio', () => {
    const e = generarConCiclo(CASOS[1], ['cansancio'])
    expect(e.alimentos_ciclo!.map((a) => a.id)).not.toContain('avena_copos')
  })

  it('los excluidos filtran también aquí', () => {
    const e = generarConCiclo(CASOS[0], ['sangrado_abundante'], {
      alimentos_excluidos: ['lentejas_cocidas', 'espinacas'],
    })
    expect(e.alimentos_ciclo!.map((a) => a.id)).toEqual(['ternera_solomillo', 'mejillones_lata'])
  })

  it(`nunca pasa de ${MAX_ALIMENTOS_CICLO}, sin repetir ids y con el por_que del primer síntoma`, () => {
    const e = generarConCiclo(CASOS[0], ['dolor', 'antojos', 'cansancio', 'sangrado_abundante', 'hinchazon'])
    const ids = e.alimentos_ciclo!.map((a) => a.id)
    expect(ids.length).toBeLessThanOrEqual(MAX_ALIMENTOS_CICLO)
    expect(new Set(ids).size).toBe(ids.length)
    // `cacao_puro` está en `dolor` y en `antojos`: gana el primero en orden canónico.
    const cacao = e.alimentos_ciclo!.find((a) => a.id === 'cacao_puro')
    if (cacao) expect(cacao.por_que).toBe(TABLA_CICLO.dolor.por_que)
  })

  it('los alimentos del ciclo no entran en el menú ni cambian un gramo del plan', () => {
    const plan = planDe(CASOS[0], 2200, 4)
    const inputs = inputsDe(plan)
    const sinCiclo = generarEjemplos(inputs, resultadoDe(plan))
    const conCicloE = generarEjemplos(inputs, conCiclo(resultadoDe(plan), ['dolor', 'sangrado_abundante']))
    expect(conCicloE.entreno.comidas).toEqual(sinCiclo.entreno.comidas)
    expect(conCicloE.compra!.items).toEqual(sinCiclo.compra!.items)
    expect(conCicloE.compra!.alimentos_distintos).toBe(sinCiclo.compra!.alimentos_distintos)
  })
})

describe('§3.8.2 — sección opcional de la compra', () => {
  it('solo con sangrado abundante, cansancio o dolor', () => {
    for (const sintoma of ['sangrado_abundante', 'cansancio', 'dolor'] as SintomaRegla[]) {
      const e = generarConCiclo(CASOS[0], [sintoma])
      expect(e.compra!.opcional_ciclo, sintoma).toBeDefined()
    }
    for (const sintoma of ['hinchazon', 'antojos'] as SintomaRegla[]) {
      const e = generarConCiclo(CASOS[0], [sintoma])
      expect(e.compra!.opcional_ciclo, sintoma).toBeUndefined()
    }
  })

  it('de 1 a 3 líneas, con el título y la nota literales, y sin repetir la compra del plan', () => {
    const e = generarConCiclo(CASOS[0], ['sangrado_abundante', 'dolor'])
    const seccion = e.compra!.opcional_ciclo!
    expect(seccion.titulo).toBe(TITULO_OPCIONAL_CICLO)
    expect(seccion.nota).toBe(NOTA_OPCIONAL_CICLO)
    expect(seccion.items.length).toBeGreaterThanOrEqual(1)
    expect(seccion.items.length).toBeLessThanOrEqual(MAX_ITEMS_OPCIONAL_CICLO)
    const delPlan = new Set(e.compra!.items.map((i) => i.alimento_id))
    for (const item of seccion.items) expect(delPlan.has(item.alimento_id), item.alimento_id).toBe(false)
  })

  it('la cantidad es fija y pequeña: dos raciones típicas', () => {
    const e = generarConCiclo(CASOS[0], ['sangrado_abundante', 'dolor'])
    for (const item of e.compra!.opcional_ciclo!.items) {
      const a = alimentoPorId(item.alimento_id)!
      expect(item.gramos_semana, item.alimento_id).toBe(Math.round(2 * a.racionTipica_g))
      expect(item.envases).toBe(Math.max(1, Math.ceil(item.gramos_semana / item.envase_g)))
      expect(item.producto.length).toBeGreaterThan(0)
    }
  })

  it('no cuenta en `alimentos_distintos` ni en el tope del modo sencillo', () => {
    const plan = planDe(CASOS[0], 2200, 4)
    const inputs: Inputs = { ...inputsDe(plan), menu_sencillo: true }
    const e = generarEjemplos(inputs, conCiclo(resultadoDe(plan), ['sangrado_abundante', 'dolor']))
    expect(e.compra!.alimentos_distintos).toBe(e.compra!.items.length)
    expect(e.compra!.alimentos_distintos).toBeLessThanOrEqual(MAX_ALIMENTOS_SENCILLO)
    expect((e.compra!.opcional_ciclo?.items.length ?? 0)).toBeGreaterThan(0)
  })

  it('sin menú (renal) no hay ni alimentos del ciclo ni sección opcional', () => {
    const plan = planDe(CASOS[0], 2200, 4)
    const inputs: Inputs = { ...inputsDe(plan), condiciones: ['renal'] }
    const e = generarEjemplos(inputs, conCiclo(resultadoDe(plan), ['sangrado_abundante']))
    expect(e.alimentos_ciclo).toBeUndefined()
    expect(e.compra).toBeUndefined()
  })
})
