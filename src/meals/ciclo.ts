// Alimentos para los días de regla (docs/SPEC-ux-comidas-pdf.md §3.8, v1.2, decisión I).
//
// Dos cosas pequeñas y opcionales que NO cambian ni un gramo del plan: no entran en el menú, no
// entran en el cierre de kcal de §3.3 y no cuentan en `alimentos_distintos` de la lista de la
// compra. Salen de los síntomas que el motor publica en `Resultado.ciclo` (SPEC-calculo Paso 19)
// y se filtran por la base, por todas las restricciones y por los alimentos excluidos (§3.2b).
//
// El tag `extra` (§3.0) **no** descarta aquí: esta es justamente la lista para la que existen
// `mejillones_lata`, `sardinas_lata`, `cacao_puro` y `chocolate_85`.
import type { Alimento } from '../data/foods'
import { alimentoPorId } from '../data/foods'
import type { AlimentoCiclo, Resultado, SintomaRegla } from '../engine/types'
import type { PerfilDietetico } from './filtros'
import { pasaPerfil } from './filtros'

/** Orden canónico de `SintomaRegla` (el mismo del motor): fija el orden de la lista. */
export const ORDEN_SINTOMAS: readonly SintomaRegla[] = [
  'dolor',
  'hinchazon',
  'antojos',
  'cansancio',
  'sangrado_abundante',
]

/** De 2 a 4 alimentos (§3.8.1): si salen menos de 2 se publica lo que haya. */
export const MAX_ALIMENTOS_CICLO = 4

/** Tabla normativa de §3.8.1: ids candidatos por síntoma, en orden, con su copy literal. */
export const TABLA_CICLO: Readonly<
  Record<SintomaRegla, { ids: readonly string[]; por_que: string }>
> = {
  dolor: {
    ids: ['sardinas_lata', 'nueces', 'semillas_lino', 'cacao_puro'],
    por_que: 'omega-3 y magnesio, que ayudan con el dolor',
  },
  hinchazon: {
    ids: ['platano', 'patata_cocida', 'calabacin'],
    por_que: 'potasio, que ayuda a soltar el agua retenida',
  },
  antojos: {
    ids: ['cacao_puro', 'chocolate_85', 'yogur_griego_0', 'manzana'],
    por_que: 'cunde más que el dulce típico y sacia más',
  },
  cansancio: {
    ids: ['lentejas_cocidas', 'avena_copos', 'patata_cocida', 'espinacas'],
    por_que: 'hierro e hidratos, para no quedarte sin energía',
  },
  sangrado_abundante: {
    ids: ['lentejas_cocidas', 'ternera_solomillo', 'mejillones_lata', 'espinacas'],
    por_que: 'hierro, para reponer lo que pierdes con el sangrado',
  },
}

/** Síntomas de un `Resultado`, deduplicados y en el orden canónico de arriba. */
export function sintomasDe(resultado: Resultado): SintomaRegla[] {
  const marcados = new Set(resultado.ciclo?.sintomas ?? [])
  return ORDEN_SINTOMAS.filter((s) => marcados.has(s))
}

/** Un alimento del ciclo con el síntoma que lo trajo: lo necesita la sección de la compra (§3.8.2). */
export interface AlimentoCicloConSintoma extends AlimentoCiclo {
  sintoma: SintomaRegla
  alimento: Alimento
}

/**
 * `Ejemplos.alimentos_ciclo` (§3.8.1): las cuatro plazas se reparten POR RONDAS entre los síntomas
 * marcados, en su orden canónico —el primer candidato válido de cada síntoma, después el segundo,
 * etc.—, y el corte a 4 se aplica al final. Llenarlas de forma voraz, síntoma a síntoma, dejaba a
 * quien marcaba «dolor fuerte» (que tiene exactamente cuatro candidatos) con una lista compuesta
 * al 100 % por los alimentos del dolor: el hierro del sangrado abundante, que es el motivo de la
 * decisión I, no aparecía nunca.
 *
 * Cada id se acepta si pasa la base, todas las restricciones y los alimentos excluidos; se
 * deduplica por `id`, y un id que sirva para dos síntomas se publica una vez, con el `por_que` del
 * primero en orden canónico.
 */
export function alimentosCiclo(
  resultado: Resultado,
  perfil: PerfilDietetico,
): AlimentoCicloConSintoma[] {
  const sintomas = sintomasDe(resultado)
  // Un id que sirve para dos síntomas pertenece al PRIMERO en orden canónico: así el `por_que`
  // que se publica es siempre el suyo, como pide §3.8.1, y ninguna ronda se lo quita.
  const dueno = new Map<string, number>()
  sintomas.forEach((sintoma, i) => {
    for (const id of TABLA_CICLO[sintoma].ids) if (!dueno.has(id)) dueno.set(id, i)
  })
  // Una cola por síntoma con sus candidatos ya filtrados, en el orden de la tabla.
  const colas = sintomas.map((sintoma, i) =>
    TABLA_CICLO[sintoma].ids.filter((id) => {
      if (dueno.get(id) !== i) return false
      const a = alimentoPorId(id)
      // El tag `extra` no descarta aquí (§3.8.1, punto 2); las exclusiones del paso 14 sí.
      return !!a && pasaPerfil(a, perfil) && !perfil.excluidos.has(id)
    }),
  )
  const salida: AlimentoCicloConSintoma[] = []
  const posicion = colas.map(() => 0)
  const rondas = Math.max(0, ...colas.map((c) => c.length))
  for (let ronda = 0; ronda < rondas && salida.length < MAX_ALIMENTOS_CICLO; ronda++) {
    for (let i = 0; i < sintomas.length && salida.length < MAX_ALIMENTOS_CICLO; i++) {
      if (posicion[i] >= colas[i].length) continue
      const id = colas[i][posicion[i]]
      posicion[i] += 1
      const a = alimentoPorId(id)
      if (!a) continue
      salida.push({
        id,
        nombre: a.nombre,
        por_que: TABLA_CICLO[sintomas[i]].por_que,
        sintoma: sintomas[i],
        alimento: a,
      })
    }
  }
  return salida
}

/** Los tres síntomas que abren la sección opcional de la compra (§3.8.2). */
const SINTOMAS_CON_COMPRA: readonly SintomaRegla[] = ['sangrado_abundante', 'cansancio', 'dolor']

/**
 * `true` si la lista de la compra lleva la sección "Para los días de regla" (§3.8.2). Con solo
 * `hinchazon` o solo `antojos` no se genera: lo que esos dos piden (plátano, patata, fruta) ya
 * está en la compra del plan y repetirlo sería ruido.
 */
export function llevaSeccionCiclo(resultado: Resultado): boolean {
  const sintomas = sintomasDe(resultado)
  return SINTOMAS_CON_COMPRA.some((s) => sintomas.includes(s))
}

/**
 * Orden de la sección opcional (§3.8.2): **uno por síntoma antes de repetir síntoma**, en el
 * orden canónico. Con `alimentos_ciclo` ya calculado, basta con repartir por síntoma y volver a
 * unir por rondas; el corte a 3 lo hace quien construye la sección.
 */
export function porRondasDeSintoma(
  alimentos: readonly AlimentoCicloConSintoma[],
): AlimentoCicloConSintoma[] {
  const porSintoma = ORDEN_SINTOMAS.map((s) => alimentos.filter((a) => a.sintoma === s))
  const rondas = Math.max(0, ...porSintoma.map((g) => g.length))
  const salida: AlimentoCicloConSintoma[] = []
  for (let i = 0; i < rondas; i++)
    for (const grupo of porSintoma) if (grupo[i]) salida.push(grupo[i])
  return salida
}
