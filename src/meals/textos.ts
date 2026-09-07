// Textos en español del generador de menús: alternativas por comida, notas del día y consejos.
// Ningún número de estos textos se inventa: todos salen del motor o de `foods.json`.
import type { Alimento } from '../data/foods'
import type { ObjetivoEfectivo, Preferencia } from '../engine/types'
import type { Porcion } from './escalado'
import { redondearGramos } from './escalado'

/** Nombre del alimento sin el estado entre paréntesis, para usarlo dentro de una frase. */
export function nombreCorto(a: Alimento): string {
  const sinParentesis = a.nombre.replace(/\s*\([^)]*\)/g, '').trim()
  return sinParentesis.charAt(0).toLowerCase() + sinParentesis.slice(1)
}

/** Formatea un número con coma decimal española y sin decimales innecesarios. */
export function numero(n: number, decimales = 0): string {
  return n.toFixed(decimales).replace('.', ',')
}

/**
 * 2-3 sustituciones equivalentes en texto. La equivalencia se calcula sobre el macro que
 * define el papel del alimento en la comida (proteína, hidrato o grasa).
 */
export function alternativasComida(porciones: readonly Porcion[], candidatos: readonly Alimento[]): string[] {
  const textos: string[] = []
  const usados = new Set(porciones.map((p) => p.alimento.id))
  const roles: { rol: Porcion['rol']; macro: keyof Pick<Alimento, 'proteina' | 'carbohidratos' | 'grasa'> }[] = [
    { rol: 'proteina', macro: 'proteina' },
    { rol: 'carbohidrato', macro: 'carbohidratos' },
    { rol: 'grasa', macro: 'grasa' },
    { rol: 'proteina2', macro: 'proteina' },
    { rol: 'fruta', macro: 'carbohidratos' },
    { rol: 'verdura', macro: 'carbohidratos' },
  ]
  // Dos pasadas: la primera da una alternativa por rol; la segunda insiste sobre los mismos
  // roles cuando la comida tiene tan pocas piezas que no salen dos textos (snacks mínimos).
  for (const pasada of [0, 1]) {
    for (const { rol, macro } of roles) {
      if (textos.length >= 3) break
      if (pasada === 1 && textos.length >= 2) break
      const p = porciones.find((x) => x.rol === rol)
      if (!p) continue
      const aporte = (p.alimento[macro] * p.gramos) / 100
      if (aporte <= 0) continue
      const mismoRol = (c: Alimento): boolean => p.alimento.roles.some((r) => c.roles.includes(r))
      // Un sustituto debe ser servible tal cual: fuera los cereales, pastas y arroces en crudo
      // (§3.0) y los alimentos que comparten nombre corto con el original (arroz crudo/cocido).
      const servible = (c: Alimento): boolean =>
        !usados.has(c.id) &&
        c.id !== p.alimento.id &&
        c[macro] > 0 &&
        !(c.grupo === 'carbohidrato' && c.estado === 'crudo') &&
        nombreCorto(c) !== nombreCorto(p.alimento)
      const sustituto =
        candidatos.find((c) => servible(c) && c.grupo === p.alimento.grupo) ??
        candidatos.find((c) => servible(c) && mismoRol(c))
      if (!sustituto) continue
      const gramos = redondearGramos(sustituto, (aporte / sustituto[macro]) * 100)
      usados.add(sustituto.id)
      textos.push(`Cambia ${p.gramos} g de ${nombreCorto(p.alimento)} por ${gramos} g de ${nombreCorto(sustituto)}.`)
    }
  }
  return textos.slice(0, 3)
}

/** Nota cuando la proteína de la comida se sale del umbral terminal del ±15 % (§3.3). */
export function notaProteinaLejos(comida: string, real: number, objetivo: number, alimento: string): string {
  return `${comida}: la proteína del ejemplo se queda en ${numero(real)} g frente a los ${numero(objetivo)} g del objetivo; sube o baja la ración de ${alimento} para acercarte.`
}

/** Nota fija cuando la comida se queda fuera del ±10 % de kcal (§3.3). */
export function notaComidaLejos(comida: string, diferencia: number, alimento: string): string {
  return `${comida}: este ejemplo se queda a ${numero(Math.abs(diferencia))} kcal de tu objetivo de esta comida; ajusta la ración de ${alimento} a tu gusto.`
}

/** Nota de fibra (§3.3), con los dos números sin redondear del cálculo. */
export function notaFibra(fibraMenu: number, fibraObjetivo: number): string {
  return `Este menú de ejemplo se queda en ${numero(fibraMenu)} g de fibra frente a los ${numero(fibraObjetivo)} g de tu objetivo: añade una ración de verdura, legumbre o fruta.`
}

/** Aviso propio del módulo cuando la proteína vegetal no llega (§3.3). */
export function avisoProteinaVegetal(nComidas: number, proteinaDia: number): string {
  return `Con fuentes solo vegetales y ${nComidas} comidas al día, llegar a ${numero(proteinaDia)} g de proteína exige raciones muy grandes. Repártela en una comida más o apóyate en un suplemento de proteína vegetal (guisante o soja): es la forma realista de llegar.`
}

/**
 * Nota cuando el hidrato (o la grasa) del día se aleja del reparto que imprime la tabla de
 * macros. El algoritmo cierra sobre kcal y proteína, así que estos dos macros pueden desviarse;
 * con `diabetes` el hidrato es justo el que no puede desviarse en silencio.
 */
export function notaMacroDia(macro: 'hidratos' | 'grasa', real: number, objetivo: number, diabetes: boolean): string {
  const direccion = real > objetivo ? 'por encima' : 'por debajo'
  const cola = diabetes
    ? ' Con diabetes esa diferencia importa: ajusta las raciones de hidratos del ejemplo a tu objetivo antes de usarlo, y consúltalo con tu equipo médico.'
    : ' El menú cierra sobre las calorías y la proteína, así que este macro puede moverse; ajusta la ración del acompañamiento si quieres afinarlo.'
  return `El menú de ejemplo suma ${numero(real)} g de ${macro} al día, ${direccion} de los ${numero(objetivo)} g de tu plan.${cola}`
}

/** Nota fija por condición médica sobre el bloque de menús (§3.1). */
export const NOTA_DIABETES =
  'Estos gramajes de hidratos son un ejemplo: si usas insulina o pastillas que bajan el azúcar, revisa la dosis con tu equipo médico antes de cambiar tu forma de comer.'
export const NOTA_CARDIACA =
  'Cocina sin sal añadida y evita embutidos y conservas: con tu condición el sodio importa más que los gramos exactos.'
export const TEXTO_SIN_MENU =
  'No te proponemos menús de ejemplo. Con tu condición, la elección concreta de alimentos (potasio, fósforo, sodio y tipo de proteína) cambia mucho el resultado y debe hacerla un/a dietista-nutricionista especializado/a. Tus calorías y tus macros siguen siendo una referencia orientativa que puedes llevarle.'

/** Nota fija del modo sencillo: explica la alternancia de días A y B (§3.7.2). */
export const NOTA_MODO_SENCILLO =
  'Menú sencillo: te proponemos dos versiones de cada comida que se van alternando. Los días 1, 3, 5 y 7 sigues el menú de abajo; los días 2, 4 y 6 cambias el acompañamiento y la fuente de proteína por la otra opción de la lista de la compra. Con eso te llegan como mucho doce alimentos distintos para toda la semana.'

/** Nota del respaldo de §3.7.2: una toma que no cuadra con el banco sencillo usa el normal. */
export function notaFallbackSencillo(comida: string): string {
  return `${comida}: con la combinación básica no salían las calorías de esa toma, así que ese plato se resuelve con una receta del menú normal. Todo lo que lleva está en la lista de la compra.`
}

/** Nota de la toma muy grande, repartida en varios platos. */
export function notaDosPlatos(comida: string, kcal: number, platos: number): string {
  const cuantos = platos >= 4 ? 'cuatro platos' : platos === 3 ? 'tres platos' : 'dos platos'
  return `${comida}: son ${numero(kcal)} kcal en una sola toma, así que el ejemplo va repartido en ${cuantos}; puedes comerlos seguidos o separados una hora.`
}

/** 3-5 consejos prácticos de adherencia según objetivo y preferencia. */
export function consejos(objetivo: ObjetivoEfectivo, preferencia: Preferencia, nComidas: number): string[] {
  const lista: string[] = [
    'Pesa los alimentos en crudo durante la primera semana: en poco tiempo te bastará con el ojo y la medida casera.',
  ]

  if (objetivo === 'perder') {
    lista.push('Empieza las comidas principales por la verdura: llena el plato y ayuda a llegar saciado al resto.')
    lista.push('No compenses una comida pasada con saltarte la siguiente; el total de la semana pesa más que un día suelto.')
  } else if (objetivo === 'ganar') {
    lista.push('Si te cuesta comer tanto volumen, sube el aceite y los frutos secos antes que el tamaño de los platos.')
    lista.push('Reparte la proteína entre todas las tomas: es más útil que concentrarla en la cena.')
  } else if (objetivo === 'recomposicion') {
    lista.push('Coloca la comida más grande alrededor del entrenamiento: es cuando mejor aprovechas los hidratos.')
    lista.push('Mide el progreso con la cinta métrica y las fotos, no solo con la báscula: el peso puede quedarse quieto.')
  } else {
    lista.push('Mantén una estructura fija de comidas: la regularidad es lo que sostiene el resultado a largo plazo.')
    lista.push('Repite dos o tres desayunos y comidas de referencia: menos decisiones diarias, más adherencia.')
  }

  if (preferencia === 'vegano') {
    lista.push('Combina legumbre, soja y cereal a lo largo del día y revisa con tu médico la vitamina B12.')
  } else if (preferencia === 'vegetariano') {
    lista.push('Apóyate en huevo, lácteos proteicos y legumbre: son las fuentes que más rinden por ración.')
  } else if (preferencia === 'sin_gluten') {
    lista.push('Arroz, patata, boniato, quinoa y tortitas de arroz cubren de sobra los hidratos sin gluten.')
  } else if (preferencia === 'sin_lactosa') {
    lista.push('Los lácteos sin lactosa y los quesos curados aportan la misma proteína que sus versiones normales.')
  } else if (preferencia === 'low_carb') {
    lista.push('Con pocos hidratos, la verdura y el aceite son los que dan volumen y saciedad al plato.')
  } else {
    lista.push('Cocina de una vez la proteína y el cereal de dos comidas: es lo que más tiempo ahorra entre semana.')
  }

  if (nComidas >= 5) {
    lista.push('Con tantas tomas, deja preparados los snacks el día anterior: es donde se rompen casi todos los planes.')
  }

  return lista.slice(0, 5)
}
