// Textos del día compuesto (docs/SPEC-dieta-propia.md §4.4 y §4.5). Todo el copy de este módulo
// es NORMATIVO y literal: se genera desde el estado del solver, nunca a ojo.
//
// Los números siguen la regla de §4.4: 0 decimales en kcal y 1 en gramos.
import { numero } from '../textos'

/** Códigos de aviso de §4.4, en su orden de prioridad. */
export const CODIGOS_AVISO = [
  'DIETA_PENDIENTES',
  'DIETA_PROPIAS_GRANDES',
  'DIETA_PROTEINA_CORTA',
  'DIETA_GRASA_BAJA',
  'DIETA_GRASA_ALTA',
  'DIETA_KCAL_LEJOS',
  'DIETA_HC_LEJOS',
  'DIETA_FIBRA_BAJA',
  'DIETA_SIN_VEGETALES',
  'DIETA_SIN_ACEITE',
  'DIETA_ALCOHOL',
  'DIETA_LIMITE',
  'DIETA_ESTIMADOS',
] as const

/** Enumeración en español: "A", "A y B", "A, B y C". */
export function enumerar(nombres: readonly string[]): string {
  if (nombres.length === 0) return ''
  if (nombres.length === 1) return nombres[0]
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`
}

const g = (n: number): string => numero(n, 1)
const k = (n: number): string => numero(n, 0)

export function avisoPendientes(nombres: readonly string[]): string {
  return `Nos falta la cantidad de ${enumerar(nombres)}. Hasta que la pongas en su comida, estos gramos son provisionales: lo que falta cambia el resto.`
}

export function avisoPropiasGrandes(pct: number, movidos: readonly string[]): string {
  const cola = movidos.length > 0 ? ` y hemos bajado un poco ${enumerar(movidos)}` : ''
  return `Lo que nos contaste ya se lleva ${k(pct)} % de tus calorías. Hemos hecho el resto del día lo más ligero que podemos${cola}.`
}

export function avisoProteinaCorta(
  prot: number,
  objetivo: number,
  alimento: string | null,
): string {
  const consejo =
    alimento === null
      ? 'Añade una fuente de proteína a alguna comida.'
      : `Sube un poco más ${alimento}.`
  return `Con estas comidas no llegamos a la proteína: te quedas en ${g(prot)} g de los ${g(objetivo)} g del plan. ${consejo}`
}

export function avisoGrasaBaja(fat: number, objetivo: number): string {
  return `Tus comidas se quedan en ${g(fat)} g de grasa frente a los ${g(objetivo)} g de tu plan. Por debajo se resienten las hormonas y la absorción de las vitaminas A, D, E y K: añade aceite de oliva, frutos secos, aguacate o pescado azul.`
}

export function avisoGrasaAlta(
  fat: number,
  objetivo: number,
  alimentos: readonly string[],
): string {
  if (alimentos.length === 0) {
    return `Hemos recortado al máximo la grasa de tus comidas y aun así se queda en ${g(fat)} g frente a los ${g(objetivo)} g del plan: para bajar más habría que cambiar algún alimento, no su cantidad.`
  }
  return `La grasa se queda en ${g(fat)} g frente a los ${g(objetivo)} g del plan. Lo que más la sube es ${enumerar(alimentos)}: mira si puedes recortar ahí.`
}

export function avisoKcalLejos(diferencia: number): string {
  const direccion = diferencia > 0 ? 'encima' : 'debajo'
  return `Con estas comidas te quedas ${k(Math.abs(diferencia))} kcal por ${direccion} de tu plan: no se puede cuadrar más sin cambiar tus raciones.`
}

export function avisoHcLejos(carb: number, objetivo: number): string {
  return `Los hidratos quedan en ${g(carb)} g frente a los ${g(objetivo)} g del plan.`
}

export function avisoFibraBaja(fibra: number, objetivo: number): string {
  return `Tus comidas se quedan en ${g(fibra)} g de fibra frente a los ${g(objetivo)} g de tu plan: añade una ración de verdura, legumbre o fruta.`
}

export const AVISO_SIN_VEGETALES =
  'En lo que nos has contado casi no hay verdura ni fruta. Los números cuadran, pero un plan sin vegetales se queda corto de fibra, potasio y vitaminas: añade una ración de verdura a la comida y a la cena y una pieza de fruta.'

export const AVISO_SIN_ACEITE =
  'No nos has dicho el aceite de cocinar ni el de aliñar. Suelen ser una o dos cucharadas al día, entre 90 y 180 kcal: dilo y los gramos saldrán mejor.'

export function avisoAlcohol(kcal: number): string {
  return `El alcohol se lleva ${k(kcal)} kcal de tu día. Las contamos, pero no las repartimos como comida.`
}

export function avisoLimitePorFactor(nombre: string): string {
  return `Hemos movido ${nombre} todo lo que nos parece razonable (entre la mitad y casi el doble de lo que comes). Si quieres más cambio, cambia el alimento.`
}

export function avisoLimitePorRacion(nombre: string, gramos: number): string {
  return `No subimos más ${nombre}: ${g(gramos)} g ya es una ración grande.`
}

export const AVISO_ESTIMADOS =
  'Los alimentos marcados con «estimado» no están en nuestra base: sus macros son una estimación. Si tienes el envase a mano, escríbelos desde «Cambiar».'

export const AVISO_NO_CUADRA =
  'Con estas comidas el plan no cuadra bien. Lo de abajo es lo mejor que hemos podido hacer sin cambiar lo que comes: lee los avisos y cambia algún alimento.'

/** A partir de cuántos avisos distintos se antepone `DIETA_NO_CUADRA` (§4.4). */
export const AVISOS_NO_CUADRA = 4

// ---------- §4.5: gustos y hábitos, aplicados y apuntados ----------

export function aplicadoSin(nombres: readonly string[]): string {
  return `Sin ${enumerar(nombres)}`
}

export function aplicadoFavorito(nombres: readonly string[]): string {
  return `Favorito: ${enumerar(nombres)}`
}

export function apuntadoSinBase(texto: string): string {
  return `No está en nuestra base: «${texto}»`
}

export function aplicadoHabitoHueco(
  comida: string,
  tipo: 'sin_hidratos' | 'ligera' | 'abundante',
): string {
  const cola =
    tipo === 'sin_hidratos' ? 'sin hidratos' : tipo === 'ligera' ? 'ligera' : 'más abundante'
  return `${comida} ${cola}`
}

export function aplicadoMismaCadaDia(comida: string): string {
  return `${comida}: la tuya, cada día`
}

export function apuntadoComidaDictada(texto: string): string {
  return `«${texto}»: lo que nos contaste de esa comida manda`
}

export function apuntadoNComidas(texto: string): string {
  return `«${texto}»: cambia el número de comidas en «Editar tus datos» y volvemos a montarlo`
}

export function apuntadoFrecuencia(texto: string): string {
  return `«${texto}»: el menú es de un día tipo; la semana aún no la repartimos`
}

export function apuntadoHorario(texto: string): string {
  return `«${texto}»: las horas del reparto son orientativas, muévelas sin miedo`
}

export function apuntadoOtro(texto: string): string {
  return `«${texto}»`
}
