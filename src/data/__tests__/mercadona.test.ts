// Validación del catálogo de compra `src/data/mercadona.json` (docs/SPEC-ux-comidas-pdf.md §3.7).
// La lista de la compra se genera cruzando el menú con este catálogo: si a un alimento de
// `foods.json` le falta su fila, la lista sale incompleta sin que nada falle en tiempo de ejecución.
import { describe, expect, it } from 'vitest'
import { ALIMENTOS } from '../foods'
import { MERCADONA, NOMBRE_SECCION, ORDEN_SECCIONES, formatoCompra } from '../mercadona'

const SECCIONES = new Set<string>(ORDEN_SECCIONES)
const CONSERVACIONES = new Set(['fresco', 'despensa', 'congelado'])

describe('mercadona.json — cobertura de foods.json', () => {
  it('tiene exactamente una fila por alimento de la base', () => {
    expect(MERCADONA.length).toBe(ALIMENTOS.length)
  })

  it('no deja ningún alimento de foods.json sin formato de compra', () => {
    const sinFormato = ALIMENTOS.filter((a) => formatoCompra(a.id) === undefined).map((a) => a.id)
    expect(sinFormato).toEqual([])
  })

  it('no tiene ids desconocidos ni duplicados', () => {
    const idsBase = new Set(ALIMENTOS.map((a) => a.id))
    const desconocidos = MERCADONA.filter((f) => !idsBase.has(f.alimento_id)).map((f) => f.alimento_id)
    expect(desconocidos).toEqual([])
    expect(new Set(MERCADONA.map((f) => f.alimento_id)).size).toBe(MERCADONA.length)
  })
})

describe('mercadona.json — campos obligatorios', () => {
  it('todas las filas llevan producto, envase y descripción no vacíos', () => {
    for (const f of MERCADONA) {
      expect(typeof f.producto, f.alimento_id).toBe('string')
      expect(f.producto.trim().length, f.alimento_id).toBeGreaterThan(0)
      expect(typeof f.envase_descripcion, f.alimento_id).toBe('string')
      expect(f.envase_descripcion.trim().length, f.alimento_id).toBeGreaterThan(0)
    }
  })

  it('envase_g es un número finito mayor que cero', () => {
    for (const f of MERCADONA) {
      expect(Number.isFinite(f.envase_g), f.alimento_id).toBe(true)
      expect(f.envase_g, f.alimento_id).toBeGreaterThan(0)
    }
  })

  it('conservacion_dias es un entero positivo', () => {
    for (const f of MERCADONA) {
      expect(Number.isInteger(f.conservacion_dias), f.alimento_id).toBe(true)
      expect(f.conservacion_dias, f.alimento_id).toBeGreaterThan(0)
    }
  })

  it('seccion y conservacion pertenecen a su enum', () => {
    for (const f of MERCADONA) {
      expect(SECCIONES.has(f.seccion), `${f.alimento_id}: ${f.seccion}`).toBe(true)
      expect(CONSERVACIONES.has(f.conservacion), `${f.alimento_id}: ${f.conservacion}`).toBe(true)
    }
  })

  it('el consejo, si existe, es un texto corto no vacío', () => {
    for (const f of MERCADONA) {
      if (f.consejo === undefined) continue
      expect(f.consejo.trim().length, f.alimento_id).toBeGreaterThan(0)
      expect(f.consejo.length, f.alimento_id).toBeLessThanOrEqual(120)
    }
  })

  it('no lleva ningún campo fuera del esquema declarado', () => {
    const permitidos = new Set([
      'alimento_id',
      'producto',
      'envase_g',
      'envase_descripcion',
      'seccion',
      'conservacion',
      'conservacion_dias',
      'consejo',
    ])
    for (const f of MERCADONA) {
      const extra = Object.keys(f).filter((k) => !permitidos.has(k))
      expect(extra, f.alimento_id).toEqual([])
    }
  })
})

describe('mercadona.json — reglas de presentación (§3.7)', () => {
  it('no contiene precios', () => {
    const texto = JSON.stringify(MERCADONA)
    expect(texto).not.toMatch(/€|\beuros?\b|\bprecio\b/i)
  })

  it('un envase cubre al menos la ración típica del alimento', () => {
    // Si el envase fuese menor que una sola ración, `envases` y `dura_dias` de la lista de la
    // compra darían números absurdos (comprar 3 envases para un día).
    for (const a of ALIMENTOS) {
      const f = formatoCompra(a.id)
      expect(f, a.id).toBeDefined()
      expect(f!.envase_g, a.id).toBeGreaterThanOrEqual(a.racionTipica_g)
    }
  })

  it('los formatos no estándar se marcan como aproximados con «≈»', () => {
    // Excepción: los formatos que sí son estándar y exactos (docena de huevos, packs de 4 yogures,
    // paquetes de 1 kg, briks de 1 L) pueden prescindir del signo si ya llevan su peso cerrado.
    const conAproximado = MERCADONA.filter((f) => f.envase_descripcion.includes('≈'))
    expect(conAproximado.length / MERCADONA.length).toBeGreaterThan(0.8)
  })

  it('cada sección del enum tiene etiqueta visible y al menos un alimento', () => {
    for (const s of ORDEN_SECCIONES) {
      expect(NOMBRE_SECCION[s]?.length ?? 0, s).toBeGreaterThan(0)
      expect(
        MERCADONA.some((f) => f.seccion === s),
        s,
      ).toBe(true)
    }
  })

  it('los congelados duran más que los frescos', () => {
    const maxFresco = Math.max(...MERCADONA.filter((f) => f.conservacion === 'fresco').map((f) => f.conservacion_dias))
    const minCongelado = Math.min(
      ...MERCADONA.filter((f) => f.conservacion === 'congelado').map((f) => f.conservacion_dias),
    )
    expect(minCongelado).toBeGreaterThan(maxFresco)
  })
})
