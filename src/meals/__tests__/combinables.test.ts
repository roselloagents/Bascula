// Preferencias combinables (docs/SPEC-ux-comidas-pdf.md §3.2 y §3.7.2, decisión E de la v1.1).
//
// El filtro de alimentos deja de ser un `switch` sobre un único valor y pasa a ser la CONJUNCIÓN
// de la base (omnívoro / vegetariano / vegano) y de TODAS las restricciones (sin lactosa, sin
// gluten). El banco de plantillas lo sigue eligiendo `preferencia_efectiva`, que puede llevar solo
// una parte de lo que el usuario ha pedido: un vegetariano sin gluten usa el banco `vegetariano` y,
// encima, el filtro de `sin_gluten`. Nada —ni el fallback de §3.2, ni el respaldo del modo
// sencillo, ni el relleno de la lista corta— puede servir un alimento que incumpla la base o una
// restricción.
import { describe, expect, it } from 'vitest'
import type { Alimento } from '../../data/foods'
import { ALIMENTOS, alimentoPorId } from '../../data/foods'
import type { NComidas, PreferenciaBase, Restriccion } from '../../engine/types'
import { MAX_ALIMENTOS_SENCILLO, bancoSencilloEfectivo } from '../bancoSencillo'
import { TOLERANCIA_KCAL, TOLERANCIA_PROTEINA } from '../escalado'
import type { PerfilDietetico } from '../filtros'
import { pasaPerfil } from '../filtros'
import { generarEjemplos, generarListaCompra } from '../index'
import { bancoDe, inputsDe, resultadoDe } from './fixtures'

interface Combinacion {
  nombre: string
  base: PreferenciaBase
  restricciones: Restriccion[]
  lowCarb?: boolean
}

/** Las seis combinaciones de base y restricciones, más las tres que además piden bajo en hidratos. */
const COMBINACIONES: Combinacion[] = [
  { nombre: 'omnívoro', base: 'omnivoro', restricciones: [] },
  { nombre: 'omnívoro + sin lactosa', base: 'omnivoro', restricciones: ['sin_lactosa'] },
  { nombre: 'omnívoro + sin gluten', base: 'omnivoro', restricciones: ['sin_gluten'] },
  { nombre: 'omnívoro + sin lactosa + sin gluten', base: 'omnivoro', restricciones: ['sin_lactosa', 'sin_gluten'] },
  { nombre: 'vegetariano', base: 'vegetariano', restricciones: [] },
  { nombre: 'vegetariano + sin lactosa', base: 'vegetariano', restricciones: ['sin_lactosa'] },
  { nombre: 'vegetariano + sin gluten', base: 'vegetariano', restricciones: ['sin_gluten'] },
  { nombre: 'vegano', base: 'vegano', restricciones: [] },
  { nombre: 'vegano + sin gluten', base: 'vegano', restricciones: ['sin_gluten'] },
  { nombre: 'vegano + sin lactosa', base: 'vegano', restricciones: ['sin_lactosa'] },
  { nombre: 'omnívoro + bajo en hidratos', base: 'omnivoro', restricciones: [], lowCarb: true },
  { nombre: 'vegetariano + sin gluten + bajo en hidratos', base: 'vegetariano', restricciones: ['sin_gluten'], lowCarb: true },
  { nombre: 'vegano + bajo en hidratos', base: 'vegano', restricciones: [], lowCarb: true },
]

const KCAL = [1600, 2200, 2800]
const COMIDAS: NComidas[] = [3, 4, 5]

/** Nombre corto de un alimento, tal como lo escriben las alternativas de §2.5. */
function nombreCortoDe(a: Alimento): string {
  return a.nombre.replace(/\s*\([^)]*\)/g, '').trim().toLowerCase()
}

/**
 * Nombres cortos que no pueden aparecer en un texto de alternativa con este perfil. Se descartan
 * los que son subcadena del nombre de algún alimento permitido ("arroz blanco" dentro de "arroz
 * blanco integral"), que darían un falso positivo.
 */
function nombresProhibidos(perfil: PerfilDietetico): string[] {
  const permitidos = ALIMENTOS.filter((a) => pasaPerfil(a, perfil)).map(nombreCortoDe)
  return ALIMENTOS.filter((a) => !pasaPerfil(a, perfil))
    .map(nombreCortoDe)
    .filter((n) => !permitidos.some((p) => p.includes(n)))
}

function perfilDe(c: Combinacion): PerfilDietetico {
  return {
    banco: bancoDe(c.base, c.restricciones, c.lowCarb === true),
    base: c.base,
    restricciones: c.restricciones,
    low_carb: c.lowCarb === true,
    // v1.2 (§3.2b): estas combinaciones no marcan nada en el paso 14.
    excluidos: new Set<string>(),
    favoritos: [],
  }
}

function planDe(c: Combinacion, kcal: number, nComidas: NComidas, hcAjustado?: number) {
  return {
    kcal,
    nComidas,
    preferencia: bancoDe(c.base, c.restricciones, c.lowCarb === true),
    objetivo: 'mantener' as const,
    base: c.base,
    restricciones: c.restricciones,
    lowCarb: c.lowCarb === true,
    hcAjustado,
  }
}

function menu(c: Combinacion, kcal: number, nComidas: NComidas, sencillo: boolean, hcAjustado?: number) {
  const o = planDe(c, kcal, nComidas, hcAjustado)
  return generarEjemplos({ ...inputsDe(o), menu_sencillo: sencillo }, resultadoDe(o))
}

/** Todos los ids que el usuario acaba viendo: menú, equivalencias y lista de la compra. */
function idsVisibles(e: ReturnType<typeof menu>): { id: string; donde: string }[] {
  const ids: { id: string; donde: string }[] = []
  for (const c of e.entreno.comidas) {
    for (const a of c.alimentos) ids.push({ id: a.id, donde: `menú/${c.comida}` })
  }
  for (const t of e.equivalencias?.tablas ?? []) {
    for (const f of t.filas) ids.push({ id: f.id, donde: `equivalencias/${t.titulo}` })
  }
  for (const item of e.compra?.items ?? []) ids.push({ id: item.alimento_id, donde: 'compra' })
  return ids
}

describe('filtro combinable (§3.2): ningún alimento prohibido', () => {
  for (const c of COMBINACIONES) {
    for (const sencillo of [false, true]) {
      it(`${c.nombre}${sencillo ? ' (sencillo)' : ''}: nada incumple la base ni las restricciones`, () => {
        const perfil = perfilDe(c)
        for (const kcal of KCAL) {
          for (const n of COMIDAS) {
            const e = menu(c, kcal, n, sencillo)
            for (const { id, donde } of idsVisibles(e)) {
              const a = alimentoPorId(id)
              expect(a, id).toBeDefined()
              expect(pasaPerfil(a!, perfil), `${c.nombre} ${kcal} ${n} ${donde}: ${id}`).toBe(true)
            }
          }
        }
      })
    }
  }

  it('las alternativas por comida tampoco nombran un alimento prohibido', () => {
    // `alternativas` es texto ("Cambia el pollo por 150 g de merluza"), no ids: se comprueba por
    // el nombre corto de los alimentos que el perfil descarta.
    for (const c of COMBINACIONES) {
      const prohibidos = nombresProhibidos(perfilDe(c))
      for (const sencillo of [false, true]) {
        for (const toma of menu(c, 2200, 4, sencillo).entreno.comidas) {
          for (const texto of toma.alternativas) {
            const t = texto.toLowerCase()
            for (const nombre of prohibidos) {
              expect(t.includes(nombre), `${c.nombre}: "${texto}" nombra "${nombre}"`).toBe(false)
            }
          }
        }
      }
    }
  })

  it('el banco de plantillas es el de la regla inversa de §1.1', () => {
    expect(bancoDe('vegetariano', ['sin_gluten'])).toBe('vegetariano')
    expect(bancoDe('omnivoro', ['sin_lactosa', 'sin_gluten'])).toBe('sin_gluten')
    expect(bancoDe('omnivoro', ['sin_lactosa'])).toBe('sin_lactosa')
    expect(bancoDe('vegano', ['sin_gluten'], true)).toBe('low_carb')
    for (const c of COMBINACIONES) {
      const e = menu(c, 2200, 4, false)
      expect(e.preferencia_efectiva, c.nombre).toBe(bancoDe(c.base, c.restricciones, c.lowCarb === true))
    }
  })
})

describe('filtro combinable: tolerancias de §3.3', () => {
  for (const sencillo of [false, true]) {
    it(`cada toma cierra dentro del ±10 % de kcal o lleva su nota${sencillo ? ' (sencillo)' : ''}`, () => {
      for (const c of COMBINACIONES) {
        for (const kcal of KCAL) {
          for (const n of COMIDAS) {
            const e = menu(c, kcal, n, sencillo)
            for (const toma of e.entreno.comidas) {
              const desv = Math.abs(toma.totales.kcal - toma.objetivo.kcal) / toma.objetivo.kcal
              if (desv <= TOLERANCIA_KCAL) continue
              expect(
                e.entreno.notas.some((t) => t.startsWith(`${toma.comida}:`)),
                `${c.nombre} ${kcal} ${n} ${toma.comida} ${toma.totales.kcal}/${toma.objetivo.kcal}`,
              ).toBe(true)
            }
          }
        }
      }
    })

    it(`cada toma cierra dentro del ±15 % de proteína o lleva su nota${sencillo ? ' (sencillo)' : ''}`, () => {
      for (const c of COMBINACIONES) {
        for (const kcal of KCAL) {
          for (const n of COMIDAS) {
            const e = menu(c, kcal, n, sencillo)
            for (const toma of e.entreno.comidas) {
              if (toma.objetivo.prot <= 0) continue
              const desv = Math.abs(toma.totales.prot - toma.objetivo.prot) / toma.objetivo.prot
              if (desv <= TOLERANCIA_PROTEINA) continue
              expect(
                e.entreno.notas.some((t) => t.startsWith(`${toma.comida}:`)),
                `${c.nombre} ${kcal} ${n} ${toma.comida} ${toma.totales.prot}/${toma.objetivo.prot}`,
              ).toBe(true)
            }
          }
        }
      }
    })
  }

  it('todas las tomas llevan alimentos y gramajes positivos', () => {
    for (const c of COMBINACIONES) {
      for (const sencillo of [false, true]) {
        for (const n of COMIDAS) {
          for (const toma of menu(c, 1800, n, sencillo).entreno.comidas) {
            expect(toma.alimentos.length, `${c.nombre} ${n} ${toma.comida}`).toBeGreaterThan(0)
            for (const a of toma.alimentos) expect(a.gramos).toBeGreaterThan(0)
          }
        }
      }
    }
  })
})

describe('modo sencillo con restricciones combinadas (§3.7.2)', () => {
  it('la semana no pasa de 12 alimentos distintos', () => {
    for (const c of COMBINACIONES) {
      for (const kcal of KCAL) {
        for (const n of COMIDAS) {
          const e = menu(c, kcal, n, true)
          if (!e.modo_sencillo) continue
          expect(e.compra, `${c.nombre} ${kcal} ${n}`).toBeDefined()
          expect(e.compra!.alimentos_distintos, `${c.nombre} ${kcal} ${n}`).toBeLessThanOrEqual(
            MAX_ALIMENTOS_SENCILLO,
          )
        }
      }
    }
  })

  it('todas las combinaciones conservan el modo sencillo (el relleno de la regla 4 basta)', () => {
    for (const c of COMBINACIONES) {
      expect(bancoSencilloEfectivo(perfilDe(c)), c.nombre).not.toBeNull()
      expect(menu(c, 2200, 4, true).modo_sencillo, c.nombre).toBe(true)
    }
  })

  it('vegano + sin gluten: el rol de hidrato queda en arroz y patata (ejemplo de la spec)', () => {
    const banco = bancoSencilloEfectivo(perfilDe(COMBINACIONES.find((c) => c.nombre === 'vegano + sin gluten')!))!
    const hidratos = banco.candidatos.filter((id) => alimentoPorId(id)!.roles.includes('carbohidrato'))
    expect(hidratos).not.toContain('avena_copos')
    expect(hidratos).not.toContain('pan_integral')
    expect(hidratos).toContain('arroz_blanco_cocido')
    expect(hidratos).toContain('patata_cocida')
  })

  it('vegetariano + sin lactosa: los dos lácteos se sustituyen por su variante `_sl`', () => {
    const combinacion = COMBINACIONES.find((c) => c.nombre === 'vegetariano + sin lactosa')!
    const banco = bancoSencilloEfectivo(perfilDe(combinacion))!
    expect(banco.candidatos).toContain('queso_fresco_batido_0_sl')
    expect(banco.candidatos).toContain('yogur_griego_0_sl')
    expect(banco.candidatos).not.toContain('queso_fresco_batido_0')
    expect(banco.candidatos).not.toContain('yogur_griego_0')
    // Y la sustitución llega al plato: el menú usa la variante, no cae a la reserva.
    const ids = new Set(menu(combinacion, 2200, 4, true).entreno.comidas.flatMap((c) => c.alimentos.map((a) => a.id)))
    expect([...ids].some((id) => id.endsWith('_sl'))).toBe(true)
  })

  it('las variantes `_sl` no se cuelan en quien no las ha pedido', () => {
    for (const c of COMBINACIONES) {
      if (c.restricciones.includes('sin_lactosa')) continue
      for (const sencillo of [false, true]) {
        for (const n of COMIDAS) {
          for (const { id, donde } of idsVisibles(menu(c, 2200, n, sencillo))) {
            expect(id.endsWith('_sl'), `${c.nombre} ${n} ${donde}: ${id}`).toBe(false)
          }
        }
      }
    }
  })
})

describe('lista de la compra con restricciones combinadas (§3.7.3)', () => {
  it('reconstruye el día B con el perfil de `Inputs` y da la misma lista', () => {
    for (const c of COMBINACIONES) {
      for (const n of COMIDAS) {
        const o = planDe(c, 2200, n)
        const inputs = { ...inputsDe(o), menu_sencillo: true }
        const e = menu(c, 2200, n, true)
        const recalculada = generarListaCompra({ ...e, compra: undefined }, inputs)
        expect(JSON.stringify(recalculada), `${c.nombre} ${n}`).toBe(JSON.stringify(e.compra))
      }
    }
  })

  it('ningún artículo de la compra incumple la base ni las restricciones', () => {
    for (const c of COMBINACIONES) {
      const perfil = perfilDe(c)
      for (const sencillo of [false, true]) {
        for (const item of menu(c, 2400, 4, sencillo).compra!.items) {
          const a = alimentoPorId(item.alimento_id)
          expect(pasaPerfil(a!, perfil), `${c.nombre}: ${item.alimento_id}`).toBe(true)
        }
      }
    }
  })
})

describe('determinismo y compatibilidad con la v1.0', () => {
  it('dos llamadas idénticas dan el mismo menú y la misma lista', () => {
    for (const c of COMBINACIONES) {
      for (const sencillo of [false, true]) {
        const a = menu(c, 2000, 4, sencillo)
        const b = menu(c, 2000, 4, sencillo)
        expect(JSON.stringify(b), c.nombre).toBe(JSON.stringify(a))
      }
    }
  })

  it('un `Resultado` de la v1.0 (sin los campos nuevos) da exactamente el mismo menú', () => {
    // Regla de traducción de `SPEC-calculo.md` §1.1: sin `preferencia_base`, el perfil se deduce
    // de `preferencia_efectiva`. Los menús de la v1.0 no pueden cambiar.
    const equivalentes: Combinacion[] = [
      { nombre: 'omnívoro', base: 'omnivoro', restricciones: [] },
      { nombre: 'vegetariano', base: 'vegetariano', restricciones: [] },
      { nombre: 'vegano', base: 'vegano', restricciones: [] },
      { nombre: 'sin lactosa', base: 'omnivoro', restricciones: ['sin_lactosa'] },
      { nombre: 'sin gluten', base: 'omnivoro', restricciones: ['sin_gluten'] },
      { nombre: 'low carb', base: 'omnivoro', restricciones: [], lowCarb: true },
    ]
    for (const c of equivalentes) {
      for (const sencillo of [false, true]) {
        const o = planDe(c, 2200, 4)
        const nuevo = generarEjemplos({ ...inputsDe(o), menu_sencillo: sencillo }, resultadoDe(o))
        const viejo = generarEjemplos(
          { ...inputsDe({ ...o, base: undefined }), menu_sencillo: sencillo },
          resultadoDe({ ...o, base: undefined }),
        )
        expect(JSON.stringify(viejo), `${c.nombre} ${sencillo}`).toBe(JSON.stringify(nuevo))
      }
    }
  })
})

describe('menú de un plan AJUSTADO por el usuario (§2.2b, decisión B)', () => {
  // "Ajusta tus macros" baja los hidratos y sube la grasa sin tocar la proteína ni las kcal. El
  // menú, el reparto y la lista de la compra se rehacen con esos números: si el generador siguiera
  // mirando los macros recomendados, la persona que ha bajado a 120 g de hidrato vería otra vez el
  // arroz de siempre.
  const AJUSTADAS: Combinacion[] = [
    { nombre: 'omnívoro', base: 'omnivoro', restricciones: [] },
    { nombre: 'vegetariano + sin gluten', base: 'vegetariano', restricciones: ['sin_gluten'] },
    { nombre: 'vegano', base: 'vegano', restricciones: [] },
  ]

  it('con menos hidratos el menú sigue cuadrando en kcal y proteína', () => {
    for (const c of AJUSTADAS) {
      for (const sencillo of [false, true]) {
        for (const n of COMIDAS) {
          const e = menu(c, 2400, n, sencillo, 120)
          for (const toma of e.entreno.comidas) {
            const desvKcal = Math.abs(toma.totales.kcal - toma.objetivo.kcal) / toma.objetivo.kcal
            if (desvKcal > TOLERANCIA_KCAL) {
              expect(
                e.entreno.notas.some((t) => t.startsWith(`${toma.comida}:`)),
                `${c.nombre} ${n} ${toma.comida} ${toma.totales.kcal}/${toma.objetivo.kcal}`,
              ).toBe(true)
            }
            if (toma.objetivo.prot <= 0) continue
            const desvProt = Math.abs(toma.totales.prot - toma.objetivo.prot) / toma.objetivo.prot
            if (desvProt > TOLERANCIA_PROTEINA) {
              expect(
                e.entreno.notas.some((t) => t.startsWith(`${toma.comida}:`)),
                `${c.nombre} ${n} ${toma.comida} ${toma.totales.prot}/${toma.objetivo.prot}`,
              ).toBe(true)
            }
          }
        }
      }
    }
  })

  it('el menú ajustado lleva de verdad menos hidratos que el recomendado', () => {
    for (const c of AJUSTADAS) {
      for (const sencillo of [false, true]) {
        const recomendado = menu(c, 2400, 4, sencillo)
        const ajustado = menu(c, 2400, 4, sencillo, 120)
        expect(ajustado.entreno.totales.carb, `${c.nombre} ${sencillo}`).toBeLessThan(
          recomendado.entreno.totales.carb,
        )
        // El menú cierra sobre kcal y proteína, no macro a macro (§3.3), así que el hidrato puede
        // quedarse por encima del ajuste; lo que no puede es callárselo: la nota diaria de §3.3 lo
        // dice con el número que de verdad suma el menú.
        const desviacion = Math.abs(ajustado.entreno.totales.carb - 120) / 120
        if (desviacion > 0.2) {
          expect(
            ajustado.entreno.notas.some((t) => t.includes('g de hidratos al día')),
            `${c.nombre} ${sencillo}: ${ajustado.entreno.totales.carb} g frente a 120 g`,
          ).toBe(true)
        }
      }
    }
  })

  it('la lista de la compra del plan ajustado sale del menú ajustado', () => {
    for (const c of AJUSTADAS) {
      const ajustado = menu(c, 2400, 4, true, 120)
      expect(ajustado.compra).toBeDefined()
      expect(ajustado.compra!.alimentos_distintos).toBeLessThanOrEqual(MAX_ALIMENTOS_SENCILLO)
      const perfil = perfilDe(c)
      for (const item of ajustado.compra!.items) {
        expect(pasaPerfil(alimentoPorId(item.alimento_id)!, perfil), item.alimento_id).toBe(true)
      }
    }
  })
})

describe('barrido de combinaciones (todas las bases × todas las restricciones × low_carb)', () => {
  // Las 24 combinaciones posibles del paso 13 (3 bases × 4 juegos de restricciones × interruptor),
  // en los dos modos. Es el barrido que garantiza que ninguna esquina rara —vegano + bajo en
  // hidratos, vegetariano sin gluten y sin lactosa— sirve un alimento prohibido, deja una toma
  // vacía, rompe el tope de 12 o se sale de las tolerancias sin decirlo.
  const BASES: PreferenciaBase[] = ['omnivoro', 'vegetariano', 'vegano']
  const JUEGOS: Restriccion[][] = [[], ['sin_lactosa'], ['sin_gluten'], ['sin_lactosa', 'sin_gluten']]
  const KCAL_BARRIDO = [1400, 2000, 2600, 3200]
  const COMIDAS_BARRIDO: NComidas[] = [2, 3, 4, 5, 6]

  const todas: Combinacion[] = []
  for (const base of BASES) {
    for (const restricciones of JUEGOS) {
      for (const lowCarb of [false, true]) {
        todas.push({ nombre: `${base} + ${restricciones.join(' + ') || 'sin restricciones'}${lowCarb ? ' + bajo en hidratos' : ''}`, base, restricciones, lowCarb })
      }
    }
  }

  for (const sencillo of [false, true]) {
    it(`ninguna combinación sirve algo prohibido ni calla una desviación${sencillo ? ' (sencillo)' : ''}`, () => {
      for (const c of todas) {
        const perfil = perfilDe(c)
        for (const kcal of KCAL_BARRIDO) {
          for (const n of COMIDAS_BARRIDO) {
            const e = menu(c, kcal, n, sencillo)
            const etiqueta = `${c.nombre} · ${kcal} kcal · ${n} comidas`
            if (sencillo) {
              expect(e.modo_sencillo, etiqueta).toBe(true)
              expect(e.compra!.alimentos_distintos, etiqueta).toBeLessThanOrEqual(MAX_ALIMENTOS_SENCILLO)
            }
            for (const { id, donde } of idsVisibles(e)) {
              expect(pasaPerfil(alimentoPorId(id)!, perfil), `${etiqueta} ${donde}: ${id}`).toBe(true)
            }
            for (const toma of e.entreno.comidas) {
              expect(toma.alimentos.length, `${etiqueta} ${toma.comida}`).toBeGreaterThan(0)
              const dKcal = Math.abs(toma.totales.kcal - toma.objetivo.kcal) / toma.objetivo.kcal
              const dProt =
                toma.objetivo.prot > 0 ? Math.abs(toma.totales.prot - toma.objetivo.prot) / toma.objetivo.prot : 0
              if (dKcal <= TOLERANCIA_KCAL && dProt <= TOLERANCIA_PROTEINA) continue
              expect(
                e.entreno.notas.some((t) => t.startsWith(`${toma.comida}:`)),
                `${etiqueta} ${toma.comida}: ${toma.totales.kcal}/${toma.objetivo.kcal} kcal, ${toma.totales.prot}/${toma.objetivo.prot} g de proteína, sin nota`,
              ).toBe(true)
            }
          }
        }
      }
    })
  }
})
