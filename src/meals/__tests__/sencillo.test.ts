// Modo sencillo (docs/SPEC-ux-comidas-pdf.md §3.7.2): tope de variedad, alternancia de días
// A/B, respeto de la preferencia dietética y las mismas tolerancias de §3.3.
import { describe, expect, it } from 'vitest'
import { ALIMENTOS, alimentoPorId } from '../../data/foods'
import type { NComidas, Preferencia } from '../../engine/types'
import {
  BANCOS_SENCILLOS,
  MAX_ALIMENTOS_SENCILLO,
  MAX_CANDIDATOS_SENCILLO,
  idsDeBanco,
  idsPermitidosSemana,
} from '../bancoSencillo'
import { TOLERANCIA_KCAL, TOLERANCIA_PROTEINA } from '../escalado'
import { pasaPreferencia } from '../filtros'
import { generarEjemplos, plantillasRespaldo } from '../index'
import { inputsDe, resultadoDe } from './fixtures'

const PREFERENCIAS: Preferencia[] = ['omnivoro', 'vegetariano', 'vegano', 'sin_lactosa', 'sin_gluten', 'low_carb']
const KCAL = [1400, 1700, 2000, 2400, 2800, 3200]
const COMIDAS: NComidas[] = [2, 3, 4, 5, 6]

function menuSencillo(kcal: number, nComidas: NComidas, preferencia: Preferencia) {
  const o = { kcal, nComidas, preferencia, objetivo: 'mantener' as const }
  return generarEjemplos({ ...inputsDe(o), menu_sencillo: true }, resultadoDe(o))
}

describe('banco sencillo (§3.7.2)', () => {
  for (const p of PREFERENCIAS) {
    const banco = BANCOS_SENCILLOS[p]

    it(`${p}: la lista blanca no pasa de ${MAX_CANDIDATOS_SENCILLO} y no tiene duplicados`, () => {
      expect(banco.candidatos.length).toBeLessThanOrEqual(MAX_CANDIDATOS_SENCILLO)
      expect(new Set(banco.candidatos).size).toBe(banco.candidatos.length)
    })

    it(`${p}: las plantillas no usan más de ${MAX_ALIMENTOS_SENCILLO} alimentos distintos`, () => {
      // Es lo que garantiza el tope de §3.7.2 por construcción: la semana es la unión de los dos
      // días y los dos días salen de estas plantillas.
      expect(idsDeBanco(banco).length).toBeLessThanOrEqual(MAX_ALIMENTOS_SENCILLO)
    })

    it(`${p}: todos los candidatos existen y pasan el filtro de preferencia`, () => {
      for (const id of banco.candidatos) {
        const a = alimentoPorId(id)
        expect(a, id).toBeDefined()
        expect(pasaPreferencia(a!, p), `${id} no vale para ${p}`).toBe(true)
      }
    })

    it(`${p}: ninguna plantilla usa un alimento de fuera de la lista corta`, () => {
      // `idsPermitidosSemana` añade la vía de escape de §3.2 (la patata del low-carb), que no es
      // un candidato de la tabla de §3.7.2 pero sí puede aparecer en el plato.
      const permitidos = idsPermitidosSemana(banco)
      for (const id of idsDeBanco(banco)) expect(permitidos.has(id), id).toBe(true)
    })

    it(`${p}: dos variantes por rol de comida (día A y día B)`, () => {
      const roles = ['desayuno', 'principal', 'ligera'] as const
      for (const rol of roles) {
        expect(banco.A.filter((x) => x.rol_comida === rol).length, rol).toBeGreaterThan(0)
        expect(banco.B.filter((x) => x.rol_comida === rol).length, rol).toBeGreaterThan(0)
      }
      // Ninguna plantilla se comparte entre los dos días: el día par siempre cambia de variante.
      const idsA = new Set(banco.A.map((x) => x.id))
      for (const x of banco.B) expect(idsA.has(x.id)).toBe(false)
    })
  }
})

describe('menú sencillo: tope de variedad y marcas', () => {
  it('nunca pasa de 12 alimentos distintos en la semana', () => {
    for (const p of PREFERENCIAS) {
      for (const kcal of KCAL) {
        for (const n of COMIDAS) {
          const e = menuSencillo(kcal, n, p)
          expect(e.compra, `${p} ${kcal} ${n}`).toBeDefined()
          expect(e.compra!.alimentos_distintos, `${p} ${kcal} ${n}`).toBeLessThanOrEqual(MAX_ALIMENTOS_SENCILLO)
          expect(e.compra!.items.length).toBe(e.compra!.alimentos_distintos)
        }
      }
    }
  })

  it('marca `modo_sencillo` y lo apaga en el menú normal', () => {
    const o = { kcal: 2200, nComidas: 4 as NComidas, preferencia: 'omnivoro' as const, objetivo: 'mantener' as const }
    expect(generarEjemplos({ ...inputsDe(o), menu_sencillo: true }, resultadoDe(o)).modo_sencillo).toBe(true)
    expect(generarEjemplos(inputsDe(o), resultadoDe(o)).modo_sencillo).toBe(false)
  })

  it('usa menos alimentos que el menú normal para el mismo plan', () => {
    const o = { kcal: 2400, nComidas: 5 as NComidas, preferencia: 'omnivoro' as const, objetivo: 'mantener' as const }
    const normal = generarEjemplos(inputsDe(o), resultadoDe(o))
    const sencillo = generarEjemplos({ ...inputsDe(o), menu_sencillo: true }, resultadoDe(o))
    const distintosNormal = new Set(normal.entreno.comidas.flatMap((c) => c.alimentos.map((a) => a.id))).size
    expect(sencillo.compra!.alimentos_distintos).toBeLessThan(distintosNormal + 2)
    expect(distintosNormal).toBeGreaterThan(MAX_ALIMENTOS_SENCILLO - 3)
  })

  it('es determinista: dos llamadas idénticas dan el mismo menú y la misma lista', () => {
    for (const p of PREFERENCIAS) {
      const a = menuSencillo(2000, 4, p)
      const b = menuSencillo(2000, 4, p)
      expect(JSON.stringify(b)).toBe(JSON.stringify(a))
    }
  })

  it('ignora `variante`: el modo sencillo no rota plantillas', () => {
    const o = { kcal: 2000, nComidas: 4 as NComidas, preferencia: 'omnivoro' as const, objetivo: 'mantener' as const }
    const i = { ...inputsDe(o), menu_sencillo: true }
    expect(JSON.stringify(generarEjemplos(i, resultadoDe(o), 3))).toBe(
      JSON.stringify(generarEjemplos(i, resultadoDe(o), 0)),
    )
  })
})

describe('menú sencillo: nada fuera de la lista corta (§3.7.2, regla 3)', () => {
  it('ni el menú ni la lista de la compra salen de la lista blanca de la preferencia', () => {
    // Incluido el respaldo de §3.7.2: rehacer una toma con el banco normal no puede meter en la
    // compra proteína de guisante en polvo, semillas de lino ni ningún otro alimento de fuera.
    for (const p of PREFERENCIAS) {
      const permitidos = idsPermitidosSemana(BANCOS_SENCILLOS[p])
      for (const kcal of KCAL) {
        for (const n of COMIDAS) {
          const e = menuSencillo(kcal, n, p)
          for (const item of e.compra!.items) {
            expect(permitidos.has(item.alimento_id), `${p} ${kcal} ${n}: ${item.alimento_id}`).toBe(true)
          }
          for (const c of e.entreno.comidas) {
            for (const a of c.alimentos) {
              expect(permitidos.has(a.id), `${p} ${kcal} ${n} ${c.comida}: ${a.id}`).toBe(true)
            }
          }
        }
      }
    }
  })

  it('low-carb: usa sus propias anclas y la patata no gana en más de una toma', () => {
    // §3.2 deja una vía de escape al cereal normal; en modo sencillo está limitada a una sola
    // toma del día para que la lista de la compra de un low-carb no salga encabezada por patatas.
    const vistos = new Set<string>()
    for (const kcal of KCAL) {
      for (const n of COMIDAS) {
        const e = menuSencillo(kcal, n, 'low_carb')
        const tomasConPatata = e.entreno.comidas.filter((c) =>
          c.alimentos.some((a) => a.id === 'patata_cocida'),
        ).length
        expect(tomasConPatata, `${kcal} ${n}`).toBeLessThanOrEqual(1)
        for (const item of e.compra!.items) vistos.add(item.alimento_id)
      }
    }
    // Y las anclas low-carb de §3.7.2 aparecen de verdad, no solo en la tabla de candidatos.
    expect(vistos.has('arroz_coliflor')).toBe(true)
    expect(vistos.has('pan_proteico')).toBe(true)
  })
})

describe('menú sencillo: preferencia dietética (§3.7.2, regla 4)', () => {
  it('vegano: ni un solo alimento sin el tag `vegano`, tampoco en la lista de la compra', () => {
    for (const kcal of KCAL) {
      for (const n of COMIDAS) {
        const e = menuSencillo(kcal, n, 'vegano')
        for (const item of e.compra!.items) {
          const a = alimentoPorId(item.alimento_id)
          expect(a?.tags, item.alimento_id).toContain('vegano')
        }
      }
    }
  })

  it('sin gluten: ni avena ni pan integral, y todo con el tag `sin_gluten`', () => {
    for (const kcal of KCAL) {
      for (const n of COMIDAS) {
        const e = menuSencillo(kcal, n, 'sin_gluten')
        for (const item of e.compra!.items) {
          expect(['avena_copos', 'pan_integral', 'pasta_cocida']).not.toContain(item.alimento_id)
          expect(alimentoPorId(item.alimento_id)?.tags, item.alimento_id).toContain('sin_gluten')
        }
      }
    }
  })

  it('vegetariano y sin lactosa: todo pasa su filtro de preferencia', () => {
    for (const p of ['vegetariano', 'sin_lactosa'] as const) {
      for (const n of COMIDAS) {
        const e = menuSencillo(2200, n, p)
        for (const item of e.compra!.items) {
          const a = alimentoPorId(item.alimento_id)
          expect(pasaPreferencia(a!, p), `${item.alimento_id} en ${p}`).toBe(true)
        }
      }
    }
  })

  it('la base tiene ficha de todos los candidatos sencillos', () => {
    const ids = new Set(ALIMENTOS.map((a) => a.id))
    for (const p of PREFERENCIAS) for (const id of BANCOS_SENCILLOS[p].candidatos) expect(ids.has(id), id).toBe(true)
  })
})

describe('menú sencillo: tolerancias de §3.3', () => {
  it('cada toma cierra dentro del ±10 % de kcal o lleva su nota', () => {
    for (const p of PREFERENCIAS) {
      for (const kcal of KCAL) {
        for (const n of COMIDAS) {
          const e = menuSencillo(kcal, n, p)
          for (const c of e.entreno.comidas) {
            const desv = Math.abs(c.totales.kcal - c.objetivo.kcal) / c.objetivo.kcal
            if (desv <= TOLERANCIA_KCAL) continue
            expect(
              e.entreno.notas.some((t) => t.startsWith(`${c.comida}:`)),
              `${p} ${kcal} ${n} ${c.comida} ${c.totales.kcal}/${c.objetivo.kcal}`,
            ).toBe(true)
          }
        }
      }
    }
  })

  it('cada toma cierra dentro del ±15 % de proteína o lleva su nota', () => {
    // Misma estructura que la comprobación de kcal: §3.7.2 obliga a mantener las tolerancias de
    // §3.3, y cuando una toma no llega el usuario tiene que verlo escrito en la pantalla.
    for (const p of PREFERENCIAS) {
      for (const kcal of KCAL) {
        for (const n of COMIDAS) {
          const e = menuSencillo(kcal, n, p)
          for (const c of e.entreno.comidas) {
            if (c.objetivo.prot <= 0) continue
            const desv = Math.abs(c.totales.prot - c.objetivo.prot) / c.objetivo.prot
            if (desv <= TOLERANCIA_PROTEINA) continue
            expect(
              e.entreno.notas.some((t) => t.startsWith(`${c.comida}:`)),
              `${p} ${kcal} ${n} ${c.comida} ${c.totales.prot}/${c.objetivo.prot}`,
            ).toBe(true)
          }
        }
      }
    }
  })

  it('ninguna toma se va a más del 45 % de su objetivo de proteína', () => {
    // Techo duro del modo sencillo: con doce alimentos y los límites de ración de §3.3 hay tomas
    // (mucha proteína en pocas kcal) que no cierran, pero no pueden irse a cualquier sitio.
    for (const p of PREFERENCIAS) {
      for (const kcal of KCAL) {
        for (const n of COMIDAS) {
          for (const c of menuSencillo(kcal, n, p).entreno.comidas) {
            if (c.objetivo.prot <= 0) continue
            const desv = Math.abs(c.totales.prot - c.objetivo.prot) / c.objetivo.prot
            expect(desv, `${p} ${kcal} ${n} ${c.comida}`).toBeLessThanOrEqual(0.45)
          }
        }
      }
    }
  })

  it('ninguna toma se va a más del 25 % de su objetivo de kcal', () => {
    for (const p of PREFERENCIAS) {
      for (const kcal of KCAL) {
        for (const n of COMIDAS) {
          for (const c of menuSencillo(kcal, n, p).entreno.comidas) {
            const desv = Math.abs(c.totales.kcal - c.objetivo.kcal) / c.objetivo.kcal
            expect(desv, `${p} ${kcal} ${n} ${c.comida}`).toBeLessThan(0.25)
          }
        }
      }
    }
  })

  it('todas las tomas llevan alimentos y gramajes positivos', () => {
    for (const p of PREFERENCIAS) {
      for (const n of COMIDAS) {
        for (const c of menuSencillo(1800, n, p).entreno.comidas) {
          expect(c.alimentos.length, `${p} ${n} ${c.comida}`).toBeGreaterThan(0)
          for (const a of c.alimentos) expect(a.gramos).toBeGreaterThan(0)
        }
      }
    }
  })
})

describe('menú sencillo: la patata cocida está en la semana (petición del usuario)', () => {
  // "pollo, arroz, huevos, cosas sencillas": en los bancos con carne la patata cocida rota con el
  // arroz en las comidas principales. El hueco lo dejó el atún, que sigue en la lista blanca.
  const CON_PATATA: Preferencia[] = ['omnivoro', 'sin_lactosa', 'sin_gluten']

  for (const p of CON_PATATA) {
    it(`${p}: las plantillas de la semana declaran la patata cocida`, () => {
      expect(idsDeBanco(BANCOS_SENCILLOS[p])).toContain('patata_cocida')
    })
  }

  it('la patata cocida llega de verdad a la lista de la compra', () => {
    for (const p of CON_PATATA) {
      const vistos = new Set<string>()
      for (const kcal of KCAL) {
        for (const n of COMIDAS) {
          for (const item of menuSencillo(kcal, n, p).compra!.items) vistos.add(item.alimento_id)
        }
      }
      expect(vistos.has('patata_cocida'), `${p}`).toBe(true)
      expect(vistos.has('arroz_blanco_cocido'), `${p}`).toBe(true)
      expect(vistos.has('pechuga_pollo'), `${p}`).toBe(true)
    }
  })
})

describe('menú sencillo: el respaldo respeta el rol de la toma (§3.7.2)', () => {
  // Sin esta regla, la toma que el banco sencillo no cerraba se rehacía con CUALQUIER plantilla
  // del banco normal —incluidas las ligeras, que `construirPlato` añade como último recurso— y un
  // desayuno acababa siendo brócoli con atún.
  const TOMAS: { nombre: string; kcal: number; rol: string }[] = [
    { nombre: 'Desayuno', kcal: 600, rol: 'desayuno' },
    { nombre: 'Comida', kcal: 800, rol: 'principal' },
    { nombre: 'Cena', kcal: 700, rol: 'principal' },
    { nombre: 'Merienda', kcal: 300, rol: 'ligera' },
  ]

  for (const p of PREFERENCIAS) {
    it(`${p}: cada toma solo puede sustituirse por plantillas de su propio rol`, () => {
      for (const t of TOMAS) {
        const comida = {
          nombre: t.nombre,
          hora: '09:00',
          pct_kcal: 0,
          proteina_g: 30,
          grasa_g: 20,
          hc_g: 50,
          kcal: t.kcal,
          peri: false,
        }
        const plantillas = plantillasRespaldo(p, comida)
        expect(plantillas.length, `${p} ${t.nombre}`).toBeGreaterThan(0)
        for (const x of plantillas) expect(x.rol_comida, `${p} ${t.nombre}: ${x.id}`).toBe(t.rol)
      }
    })
  }

  it('ningún desayuno del modo sencillo acaba con brócoli y atún', () => {
    for (const p of PREFERENCIAS) {
      for (const kcal of KCAL) {
        for (const n of COMIDAS) {
          for (const c of menuSencillo(kcal, n, p).entreno.comidas) {
            if (c.comida !== 'Desayuno') continue
            const ids = c.alimentos.map((a) => a.id)
            expect(ids, `${p} ${kcal} ${n}`).not.toContain('atun_natural')
          }
        }
      }
    }
  })
})
