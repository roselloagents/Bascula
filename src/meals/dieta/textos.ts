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

/**
 * Un día en el que la persona no ha puesto ninguna comida (modo `solo_contexto`) NO se puede
 * describir con "tus comidas" ni con "tus raciones": esos gramos los hemos puesto nosotros o los
 * ha propuesto la IA (§4.4, variante de copy de la decisión L). `menu === true` es ese caso.
 */
export function avisoProteinaCorta(
  prot: number,
  objetivo: number,
  alimento: string | null,
  menu = false,
): string {
  const consejo =
    alimento === null
      ? 'Añade una fuente de proteína a alguna comida.'
      : `Sube un poco más ${alimento}.`
  const cabeza = menu ? 'Con este menú' : 'Con estas comidas'
  return `${cabeza} no llegamos a la proteína: te quedas en ${g(prot)} g de los ${g(objetivo)} g del plan. ${consejo}`
}

export function avisoGrasaBaja(fat: number, objetivo: number, menu = false): string {
  const cabeza = menu ? 'Este menú se queda' : 'Tus comidas se quedan'
  return `${cabeza} en ${g(fat)} g de grasa frente a los ${g(objetivo)} g de tu plan. Por debajo se resienten las hormonas y la absorción de las vitaminas A, D, E y K: añade aceite de oliva, frutos secos, aguacate o pescado azul.`
}

export function avisoGrasaAlta(
  fat: number,
  objetivo: number,
  alimentos: readonly string[],
  menu = false,
): string {
  if (alimentos.length === 0) {
    const donde = menu ? 'de este menú' : 'de tus comidas'
    return `Hemos recortado al máximo la grasa ${donde} y aun así se queda en ${g(fat)} g frente a los ${g(objetivo)} g del plan: para bajar más habría que cambiar algún alimento, no su cantidad.`
  }
  return `La grasa se queda en ${g(fat)} g frente a los ${g(objetivo)} g del plan. Lo que más la sube es ${enumerar(alimentos)}: mira si puedes recortar ahí.`
}

export function avisoKcalLejos(diferencia: number, menu = false): string {
  const direccion = diferencia > 0 ? 'encima' : 'debajo'
  if (menu) {
    return `Con este menú te quedas ${k(Math.abs(diferencia))} kcal por ${direccion} de tu plan: prueba con otra propuesta.`
  }
  return `Con estas comidas te quedas ${k(Math.abs(diferencia))} kcal por ${direccion} de tu plan: no se puede cuadrar más sin cambiar tus raciones.`
}

export function avisoHcLejos(carb: number, objetivo: number): string {
  return `Los hidratos quedan en ${g(carb)} g frente a los ${g(objetivo)} g del plan.`
}

export function avisoFibraBaja(fibra: number, objetivo: number, menu = false): string {
  const cabeza = menu ? 'Este menú se queda' : 'Tus comidas se quedan'
  return `${cabeza} en ${g(fibra)} g de fibra frente a los ${g(objetivo)} g de tu plan: añade una ración de verdura, legumbre o fruta.`
}

export const AVISO_SIN_VEGETALES =
  'En lo que nos has contado casi no hay verdura ni fruta. Los números cuadran, pero un plan sin vegetales se queda corto de fibra, potasio y vitaminas: añade una ración de verdura a la comida y a la cena y una pieza de fruta.'

/**
 * El mismo aviso cuando el día lo ha montado la IA (§4bis.3): "en lo que nos has contado" sería
 * falso —la persona no ha puesto esos platos— y el camino para cambiarlo tampoco es el mismo.
 */
export const AVISO_SIN_VEGETALES_IA =
  'En este menú casi no hay verdura ni fruta. Los números cuadran, pero un día sin vegetales se queda corto de fibra, potasio y vitaminas: pide «Otra propuesta» o añade una ración de verdura a la comida y a la cena.'

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

/**
 * Cuando los únicos alimentos estimados están en comidas `propuesta_ia`, el consejo de arriba no
 * sirve: esas filas no llevan "Cambiar" (§4bis.3). Se dice lo que sí se puede hacer.
 */
export const AVISO_ESTIMADOS_IA =
  'Los alimentos marcados con «estimado» no están en nuestra base: sus macros son una estimación. En las comidas «propuesta IA» no se pueden editar; pide «Otra propuesta» si prefieres otra cosa.'

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

/**
 * Una costumbre que no cabe: no hay otro hueco al que trasladar las kcal, o hacerlo dejaría esa
 * comida por debajo del suelo de §4.2.4. Sin esto la persona veía su instrucción más tajante
 * desobedecida y solo su propia cita, sin motivo (§4.5).
 */
export function apuntadoNoCabe(texto: string): string {
  return `«${texto}»: no lo aplicamos porque esa comida se quedaría demasiado pequeña; cuéntanos también otra comida y lo movemos`
}

// ---------- §4bis: huecos propuestos por la IA (decisión L) ----------

/**
 * Código del aviso informativo que lleva el consejo del modelo (§4bis.3). No está en
 * `CODIGOS_AVISO` porque no es un aviso de §4.4: no señala nada que no cuadre y por eso tampoco
 * cuenta para el umbral de `DIETA_NO_CUADRA`. Su texto es el `consejo` del modelo, literal.
 */
export const CODIGO_CONSEJO_IA = 'DIETA_CONSEJO_IA'

/**
 * Un hueco que la IA proponía y que no ha llegado a convencernos: venía vacío, no validaba o
 * después de cuadrarlo se quedaba a más del 15 % de sus kcal o de su proteína (§4bis.3). Se monta
 * con nuestras plantillas y se dice, porque el bloque enseña el distintivo "propuesta IA" en las
 * demás y quien lea la pantalla tiene que entender por qué esta no lo lleva.
 */
export function apuntadoPropuestaNoConvence(comida: string): string {
  return `Para ${comida} no nos ha convencido la propuesta y hemos usado la nuestra.`
}

/**
 * La propuesta trae un alimento que la persona había excluido (paso 14 o un gusto del audio). No
 * la tiramos por eso —los gramos ya están cuadrados y el resto de la comida vale—, pero se dice:
 * lo contrario sería colarle en el menú justo lo que dijo que no quería. No usa el texto del menú
 * propuesto ("no hemos podido evitar…"): aquí sí se podía evitar, lo ha elegido el modelo.
 */
export function apuntadoExcluidoEnPropuesta(nombre: string, comida: string): string {
  return `La propuesta de ${comida} trae ${nombre}, que no querías: pide «Otra propuesta» si prefieres cambiarla.`
}

/**
 * La costumbre se aplicó al objetivo del hueco, pero la propuesta de la IA trajo guarnición de
 * todas formas (§4.5 comprobada contra lo montado). El texto de `apuntadoNoCabe` mentía aquí: no
 * había ningún problema de tamaño y contar otra comida no arreglaría nada; lo que hay que hacer
 * es pedir otra propuesta.
 */
export function apuntadoPropuestaConHidratos(texto: string, comida: string): string {
  return `«${texto}»: la propuesta de ${comida} trae guarnición; pide «Otra propuesta» y lo intentamos otra vez`
}
