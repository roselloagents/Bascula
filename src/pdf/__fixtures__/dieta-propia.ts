// Fixtures de "Tu menú, con lo tuyo dentro" (docs/SPEC-dieta-propia.md §6.2) para revisar y testar
// el PDF sin arrancar la aplicación ni llamar a ningún servicio.
//
// Son tres `DiaCompuesto` escritos a mano —el desayuno solo (modo `parcial`), el día entero del §0
// (modo `completa`) y el caso máximo que declara §6.2— montados sobre el plan de `MUESTRA_COMPLETA`
// (2.190 kcal, 185 g de proteína, 70 g de grasa, 205 g de hidratos, cuatro comidas).
//
// Los números NO se copian a mano: los aportes, los totales por comida, los del día y el desvío se
// derivan aquí de los macros por 100 g y de los gramos finales, que es lo que hace `componerDia` en
// el navegador. Así la fixture no puede contradecirse a sí misma cuando se toca un gramaje.
//
// Si `src/meals/__tests__/dieta-fixtures.ts` llega a existir, estos días se pueden sustituir por los
// que salgan de `componerDia`; el PDF no cambia, porque solo lee el tipo.
import type {
  AlimentoAjustado,
  ComidaCompuesta,
  DatosPdf,
  DiaCompuesto,
  EjemploComida,
  EstadoAlimentoPropio,
  GrupoAprox,
  Macros,
  MacrosPropio,
} from '../../engine/types'
import { MUESTRA_COMPLETA } from './muestra'

// ---------- utilidades de la fixture (aritmética, no reglas de negocio) ----------

const CERO: MacrosPropio = { kcal: 0, prot: 0, carb: 0, fat: 0, fibra: 0, alcohol: 0 }

function r1(valor: number): number {
  return Math.round(valor * 10) / 10
}

/** Aporte real de un alimento con sus gramos finales, a partir de sus macros por 100 g. */
function aporteDe(macros: MacrosPropio, gramos: number): MacrosPropio {
  const f = gramos / 100
  return {
    kcal: Math.round(macros.kcal * f),
    prot: r1(macros.prot * f),
    carb: r1(macros.carb * f),
    fat: r1(macros.fat * f),
    fibra: r1(macros.fibra * f),
    alcohol: r1(macros.alcohol * f),
  }
}

function sumaMacros(partes: readonly MacrosPropio[]): MacrosPropio {
  return partes.reduce<MacrosPropio>(
    (a, m) => ({
      kcal: a.kcal + m.kcal,
      prot: r1(a.prot + m.prot),
      carb: r1(a.carb + m.carb),
      fat: r1(a.fat + m.fat),
      fibra: r1(a.fibra + m.fibra),
      alcohol: r1(a.alcohol + m.alcohol),
    }),
    CERO,
  )
}

interface OpcionesPropio {
  nombre: string
  /** Gramos dictados; `null` = la persona no dijo la cantidad (pendiente). */
  gramos: number | null
  /** Macros por 100 g. */
  macros: MacrosPropio
  alimento_id?: string | null
  estado?: EstadoAlimentoPropio
  grupo?: GrupoAprox
  /** Gramos finales tras el ajuste; por defecto, los dictados. */
  ajustados?: number
  origen?: AlimentoAjustado['origen_macros']
  unidad?: { nombre: string; gramos: number }
  unidades?: number
  /** El ajuste no lo toca (fijo) frente a variable. Los pendientes se detectan solos. */
  fijo?: boolean
  ajustable?: boolean
  en_limite?: AlimentoAjustado['en_limite']
  nota?: string
  texto?: string
  retirado?: boolean
}

function propio(o: OpcionesPropio): AlimentoAjustado {
  const origen = o.origen ?? (o.alimento_id ? 'catalogo' : 'estimado')
  const pendiente = o.gramos === null
  const gramos_ajustados = pendiente ? 0 : (o.ajustados ?? (o.gramos as number))
  const delta_g = r1(gramos_ajustados - (o.gramos ?? 0))
  return {
    texto: o.texto ?? `${o.gramos ?? ''} ${o.nombre}`.trim().toLowerCase(),
    nombre: o.nombre,
    alimento_id: o.alimento_id ?? null,
    estado: o.estado ?? 'listo',
    grupo_aprox: o.grupo ?? 'otro',
    gramos: o.gramos,
    unidad: o.unidad,
    cantidad_unidades: o.unidades ?? null,
    macros_100g: o.macros,
    origen_macros: origen,
    ajustable: o.ajustable ?? !o.fijo,
    confianza: origen === 'catalogo' ? 'alta' : 'media',
    nota: o.nota,
    retirado: o.retirado,
    estado_ajuste: pendiente ? 'pendiente' : o.fijo ? 'fijo' : 'variable',
    gramos_ajustados,
    delta_g,
    cambio: delta_g > 0 ? 'sube' : delta_g < 0 ? 'baja' : 'igual',
    factor: o.gramos ? Math.round((gramos_ajustados / o.gramos) * 1000) / 1000 : 1,
    en_limite: o.en_limite ?? 'no',
    aporte: aporteDe(o.macros, gramos_ajustados),
  }
}

function comidaPropia(
  nombre: string,
  hora: string | null,
  objetivo: Macros | null,
  alimentos: readonly AlimentoAjustado[],
  peri = false,
): ComidaCompuesta {
  const cuentan = alimentos.filter((a) => !a.retirado && a.estado_ajuste !== 'pendiente')
  return {
    nombre,
    hora,
    peri,
    origen: 'propia',
    objetivo,
    alimentos: [...alimentos],
    ejemplo: null,
    totales: sumaMacros(cuentan.map((a) => a.aporte)),
    pct_kcal: 0,
  }
}

/**
 * Un hueco que ha montado el modelo y que el algoritmo ha cuadrado (§4bis.3): por dentro es una
 * comida como la dictada —`AlimentoAjustado[]` con los gramos ya cuadrados y `ejemplo: null`—, solo
 * cambia el origen, que es lo que le pone al PDF la etiqueta "propuesta IA".
 */
function comidaPropuestaIa(
  nombre: string,
  hora: string | null,
  objetivo: Macros | null,
  alimentos: readonly AlimentoAjustado[],
  peri = false,
): ComidaCompuesta {
  return { ...comidaPropia(nombre, hora, objetivo, alimentos, peri), origen: 'propuesta_ia' }
}

function comidaPropuesta(ejemplo: EjemploComida, objetivo: Macros, fibra: number): ComidaCompuesta {
  return {
    nombre: ejemplo.comida,
    hora: ejemplo.hora,
    peri: ejemplo.peri,
    origen: 'propuesta',
    objetivo,
    alimentos: [],
    ejemplo,
    totales: { ...ejemplo.totales, fibra, alcohol: 0 },
    pct_kcal: 0,
  }
}

/** Cierra el día: porcentajes por comida, totales y desvío contra el objetivo del plan. */
function montarDia(
  modo: DiaCompuesto['modo'],
  comidas: readonly ComidaCompuesta[],
  objetivo: Macros,
  resto: Omit<DiaCompuesto, 'modo' | 'comidas' | 'totales' | 'objetivo' | 'desvio' | 'provisional'>,
): DiaCompuesto {
  const totales = sumaMacros(comidas.map((c) => c.totales))
  const conPct = comidas.map((c) => ({
    ...c,
    pct_kcal: totales.kcal > 0 ? r1((c.totales.kcal / totales.kcal) * 100) : 0,
  }))
  return {
    modo,
    comidas: conPct,
    totales,
    objetivo,
    desvio: {
      kcal: Math.round(totales.kcal - objetivo.kcal),
      prot: r1(totales.prot - objetivo.prot),
      carb: r1(totales.carb - objetivo.carb),
      fat: r1(totales.fat - objetivo.fat),
    },
    provisional: resto.pendientes.length > 0,
    ...resto,
  }
}

// ---------- macros por 100 g de lo que se dicta en el §0 ----------

const M = {
  kefir: { kcal: 62, prot: 3.3, carb: 4.5, fat: 3.3, fibra: 0, alcohol: 0 },
  chia: { kcal: 486, prot: 17, carb: 42, fat: 31, fibra: 34, alcohol: 0 },
  almendras: { kcal: 579, prot: 21, carb: 22, fat: 50, fibra: 12.5, alcohol: 0 },
  nueces: { kcal: 654, prot: 15, carb: 14, fat: 65, fibra: 6.7, alcohol: 0 },
  proteina: { kcal: 395, prot: 78, carb: 6, fat: 6, fibra: 0, alcohol: 0 },
  cereales: { kcal: 370, prot: 10, carb: 73, fat: 3, fibra: 8, alcohol: 0 },
  pollo: { kcal: 120, prot: 23, carb: 0, fat: 2.6, fibra: 0, alcohol: 0 },
  arroz: { kcal: 356, prot: 6.7, carb: 79, fat: 0.6, fibra: 1.3, alcohol: 0 },
  huevo: { kcal: 143, prot: 12.6, carb: 0.7, fat: 9.9, fibra: 0, alcohol: 0 },
  fiambre: { kcal: 110, prot: 17, carb: 2, fat: 3.5, fibra: 0, alcohol: 0 },
  aceite: { kcal: 899, prot: 0, carb: 0, fat: 99.9, fibra: 0, alcohol: 0 },
  brocoli: { kcal: 34, prot: 2.8, carb: 6.6, fat: 0.4, fibra: 2.6, alcohol: 0 },
  vino: { kcal: 83, prot: 0.1, carb: 2.6, fat: 0, fibra: 0, alcohol: 10.3 },
  // v1.3 (§4bis): lo que propone el modelo para los huecos del fixture D.
  calabacin: { kcal: 17, prot: 1.3, carb: 3.1, fat: 0.3, fibra: 1.1, alcohol: 0 },
  salmon: { kcal: 208, prot: 20, carb: 0, fat: 13.4, fibra: 0, alcohol: 0 },
  patata: { kcal: 87, prot: 2, carb: 20, fat: 0.1, fibra: 1.8, alcohol: 0 },
  tomate: { kcal: 18, prot: 0.9, carb: 3.5, fat: 0.2, fibra: 1.2, alcohol: 0 },
  pan_centeno: { kcal: 250, prot: 8.5, carb: 48, fat: 1.6, fibra: 8, alcohol: 0 },
} satisfies Record<string, MacrosPropio>

const OBJETIVO: Macros = { kcal: 2190, prot: 185, carb: 205, fat: 70 }

// ---------- comidas propuestas (las monta el generador, §4.3) ----------

const COMIDA_PROPUESTA: EjemploComida = {
  comida: 'Comida',
  hora: '14:00',
  peri: false,
  objetivo: { kcal: 620, prot: 55, carb: 55, fat: 20 },
  alimentos: [
    {
      id: 'pechuga_pollo',
      nombre: 'Pechuga de pollo',
      gramos: 190,
      medida: '1 pechuga mediana',
      kcal: 228,
      prot: 43.7,
      carb: 0,
      fat: 4.9,
    },
    {
      id: 'arroz_blanco_cocido',
      nombre: 'Arroz blanco (cocido)',
      gramos: 180,
      medida: '2 cazos',
      kcal: 234,
      prot: 4.7,
      carb: 50.4,
      fat: 0.5,
    },
    {
      id: 'aceite_oliva',
      nombre: 'Aceite de oliva virgen extra',
      gramos: 12,
      medida: '1 cucharada',
      kcal: 108,
      prot: 0,
      carb: 0,
      fat: 12,
    },
    {
      id: 'brocoli',
      nombre: 'Brócoli',
      gramos: 150,
      medida: '1 plato hondo',
      kcal: 51,
      prot: 4.2,
      carb: 9.9,
      fat: 0.6,
    },
  ],
  totales: { kcal: 621, prot: 52.6, carb: 60.3, fat: 18 },
  alternativas: [
    'Cambia 190 g de pechuga de pollo por 200 g de merluza',
    'Cambia 180 g de arroz blanco cocido por 200 g de patata cocida',
  ],
}

const MERIENDA_PROPUESTA: EjemploComida = {
  comida: 'Merienda',
  hora: '17:30',
  peri: true,
  objetivo: { kcal: 370, prot: 30, carb: 40, fat: 10 },
  alimentos: [
    {
      id: 'yogur_griego_0',
      nombre: 'Yogur griego 0 %',
      gramos: 250,
      medida: '2 tarrinas',
      kcal: 143,
      prot: 25,
      carb: 9,
      fat: 0.5,
    },
    {
      id: 'platano',
      nombre: 'Plátano',
      gramos: 130,
      medida: '1 pieza mediana',
      kcal: 118,
      prot: 1.4,
      carb: 30.3,
      fat: 0.4,
    },
    {
      id: 'tortitas_arroz',
      nombre: 'Tortitas de arroz',
      gramos: 20,
      medida: '2 tortitas',
      kcal: 77,
      prot: 1.6,
      carb: 16.4,
      fat: 0.6,
    },
  ],
  totales: { kcal: 338, prot: 28, carb: 55.7, fat: 1.5 },
  alternativas: ['Cambia 130 g de plátano por 150 g de manzana'],
}

const CENA_PROPUESTA: EjemploComida = {
  comida: 'Cena',
  hora: '21:00',
  peri: false,
  objetivo: { kcal: 640, prot: 55, carb: 60, fat: 20 },
  alimentos: [
    {
      id: 'merluza',
      nombre: 'Merluza',
      gramos: 220,
      medida: '1 lomo grande',
      kcal: 194,
      prot: 37.4,
      carb: 0,
      fat: 4.4,
    },
    {
      id: 'patata_cocida',
      nombre: 'Patata (cocida)',
      gramos: 250,
      medida: '2 patatas medianas',
      kcal: 215,
      prot: 4.8,
      carb: 50,
      fat: 0.3,
    },
    {
      id: 'aceite_oliva',
      nombre: 'Aceite de oliva virgen extra',
      gramos: 10,
      medida: '1 cucharada',
      kcal: 90,
      prot: 0,
      carb: 0,
      fat: 10,
    },
    {
      id: 'ensalada_mixta',
      nombre: 'Ensalada mixta',
      gramos: 150,
      medida: '1 bol',
      kcal: 30,
      prot: 1.8,
      carb: 4.5,
      fat: 0.3,
    },
  ],
  totales: { kcal: 529, prot: 44, carb: 54.5, fat: 15 },
  alternativas: [
    'Cambia 220 g de merluza por 200 g de bacalao',
    'Cambia 250 g de patata cocida por 180 g de arroz blanco cocido',
  ],
}

// ---------- A. Solo el desayuno dictado (modo `parcial`) ----------

const DESAYUNO_DICTADO: AlimentoAjustado[] = [
  propio({
    nombre: 'Kéfir natural entero',
    alimento_id: 'kefir_entero',
    grupo: 'lacteo',
    gramos: 250,
    macros: M.kefir,
    texto: '250 g de kéfir',
  }),
  propio({
    nombre: 'Semillas de chía',
    grupo: 'grasa',
    estado: 'seco',
    gramos: 5,
    macros: M.chia,
    fijo: true,
    texto: '5 g de chía',
  }),
  propio({
    nombre: 'Almendras',
    alimento_id: 'almendras',
    grupo: 'grasa',
    gramos: 25,
    macros: M.almendras,
    texto: '25 g de almendras',
  }),
  propio({
    nombre: 'Nueces',
    alimento_id: 'nueces',
    grupo: 'grasa',
    gramos: 18,
    macros: M.nueces,
    texto: '18 de nueces',
  }),
  propio({
    nombre: 'Proteína de suero en polvo',
    alimento_id: 'proteina_suero_polvo',
    grupo: 'proteina',
    estado: 'seco',
    gramos: 60,
    macros: M.proteina,
    unidad: { nombre: 'cacito', gramos: 30 },
    unidades: 2,
    nota: 'He tomado el scoop como 60 g, como has dicho.',
    texto: 'un scoop de proteína de unos 60 g en total',
  }),
  propio({
    nombre: 'Cereales de arroz y avena 0 %',
    grupo: 'carbohidrato',
    gramos: null,
    macros: M.cereales,
    nota: 'No has dicho la cantidad.',
    texto: 'unos cereales del Mercadona 0 % grasa',
  }),
]

/** §4.7: el desayuno del §0 con un plan de cuatro comidas; los tres huecos los monta el generador. */
export const DIA_PARCIAL: DiaCompuesto = montarDia(
  'parcial',
  [
    comidaPropia('Desayuno', '08:00', { kcal: 560, prot: 45, carb: 50, fat: 20 }, DESAYUNO_DICTADO),
    comidaPropuesta(COMIDA_PROPUESTA, { kcal: 620, prot: 55, carb: 55, fat: 20 }, 6.4),
    comidaPropuesta(MERIENDA_PROPUESTA, { kcal: 370, prot: 30, carb: 40, fat: 10 }, 4.1),
    comidaPropuesta(CENA_PROPUESTA, { kcal: 640, prot: 55, carb: 60, fat: 20 }, 7.2),
  ],
  OBJETIVO,
  {
    avisos: [
      {
        codigo: 'DIETA_PENDIENTES',
        texto:
          'Nos falta la cantidad de Cereales de arroz y avena 0 %. Hasta que la pongas en su comida, ' +
          'estos gramos son provisionales: lo que falta cambia el resto.',
      },
      {
        codigo: 'DIETA_ESTIMADOS',
        texto:
          'Los alimentos marcados con «estimado» no están en nuestra base: sus macros son una ' +
          'estimación. Si tienes el envase a mano, escríbelos desde «Cambiar».',
      },
    ],
    aplicado: ['Desayuno: la tuya, cada día', 'Sin brócoli', 'Favorito: pollo'],
    apuntado: [
      '«Como pescado dos veces por semana»: el menú es de un día tipo; la semana aún no la repartimos',
    ],
    pendientes: [{ comida: 'Desayuno', nombre: 'Cereales de arroz y avena 0 %' }],
    no_entendido: [{ texto: 'tiras de fibra', sugerencia: '¿Quizá «tiras de fiambre de pavo»?' }],
    notas: ['He tomado el scoop como 60 g, como has dicho.'],
    n_variables: 4,
  },
)

// ---------- B. El día entero del §0 (modo `completa`) ----------

const COMIDA_DICTADA: AlimentoAjustado[] = [
  propio({
    nombre: 'Pechuga de pollo',
    alimento_id: 'pechuga_pollo',
    grupo: 'proteina',
    estado: 'crudo',
    gramos: 200,
    ajustados: 230,
    macros: M.pollo,
    texto: '200 g de pollo',
  }),
  propio({
    nombre: 'Arroz basmati (crudo)',
    alimento_id: 'arroz_blanco_crudo',
    grupo: 'carbohidrato',
    estado: 'crudo',
    gramos: 100,
    ajustados: 90,
    macros: M.arroz,
    nota: 'Basmati ≈ arroz blanco.',
    texto: '100 g de arroz basmati pesado en seco',
  }),
  propio({
    nombre: 'Aceite de oliva virgen extra',
    alimento_id: 'aceite_oliva',
    grupo: 'grasa',
    gramos: 10,
    macros: M.aceite,
    fijo: true,
    texto: 'una cucharada de aceite',
  }),
  propio({
    nombre: 'Brócoli',
    alimento_id: 'brocoli',
    grupo: 'verdura',
    estado: 'cocido',
    gramos: 150,
    macros: M.brocoli,
    fijo: true,
    texto: 'brócoli al vapor',
  }),
]

const MERIENDA_DICTADA: AlimentoAjustado[] = [
  propio({
    nombre: 'Proteína de suero en polvo',
    alimento_id: 'proteina_suero_polvo',
    grupo: 'proteina',
    estado: 'seco',
    gramos: 30,
    macros: M.proteina,
    unidad: { nombre: 'cacito', gramos: 30 },
    unidades: 1,
    fijo: true,
    texto: 'un batido de proteína',
  }),
  propio({
    nombre: 'Copa de vino tinto',
    grupo: 'bebida',
    gramos: 150,
    macros: M.vino,
    ajustable: false,
    fijo: true,
    texto: 'una copa de vino con la merienda',
  }),
]

const CENA_DICTADA: AlimentoAjustado[] = [
  propio({
    nombre: 'Huevo entero',
    alimento_id: 'huevo_entero',
    grupo: 'proteina',
    gramos: 275,
    ajustados: 220,
    macros: M.huevo,
    unidad: { nombre: 'huevo M', gramos: 55 },
    unidades: 4,
    en_limite: 'factor',
    texto: '5 huevos',
  }),
  propio({
    nombre: 'Fiambre de pavo',
    grupo: 'proteina',
    gramos: null,
    macros: M.fiambre,
    nota: 'No has dicho la cantidad.',
    texto: 'unas tiras de fiambre',
  }),
]

/** §4.7: el día completo del §0 (desayuno, comida, merienda y cena dictadas). */
export const DIA_COMPLETO: DiaCompuesto = montarDia(
  'completa',
  [
    comidaPropia('Desayuno', '08:00', { kcal: 560, prot: 45, carb: 50, fat: 20 }, DESAYUNO_DICTADO),
    comidaPropia('Comida', '14:00', { kcal: 620, prot: 55, carb: 55, fat: 20 }, COMIDA_DICTADA),
    comidaPropia(
      'Merienda',
      '17:30',
      { kcal: 370, prot: 30, carb: 40, fat: 10 },
      MERIENDA_DICTADA,
      true,
    ),
    comidaPropia('Cena', '21:00', { kcal: 640, prot: 55, carb: 60, fat: 20 }, CENA_DICTADA),
  ],
  OBJETIVO,
  {
    avisos: [
      {
        codigo: 'DIETA_PENDIENTES',
        texto:
          'Nos falta la cantidad de Fiambre de pavo. Hasta que la pongas en su comida, estos gramos ' +
          'son provisionales: lo que falta cambia el resto.',
      },
      {
        codigo: 'DIETA_KCAL_LEJOS',
        texto:
          'Con estas comidas te quedas 180 kcal por debajo de tu plan: no se puede cuadrar más sin ' +
          'cambiar tus raciones.',
      },
      {
        codigo: 'DIETA_ALCOHOL',
        texto:
          'El alcohol se lleva 125 kcal de tu día. Las contamos, pero no las repartimos como comida.',
      },
      {
        codigo: 'DIETA_LIMITE',
        texto:
          'Hemos movido Huevo entero todo lo que nos parece razonable (entre la mitad y casi el doble ' +
          'de lo que comes). Si quieres más cambio, cambia el alimento.',
      },
      {
        codigo: 'DIETA_ESTIMADOS',
        texto:
          'Los alimentos marcados con «estimado» no están en nuestra base: sus macros son una ' +
          'estimación. Si tienes el envase a mano, escríbelos desde «Cambiar».',
      },
    ],
    aplicado: [
      'Desayuno: la tuya, cada día',
      'Sin brócoli, coliflor',
      'Favorito: pollo, arroz',
      'Cena sin hidratos',
    ],
    apuntado: [
      '«Ceno ligero»: lo que nos contaste de esa comida manda',
      '«Hago cinco comidas»: cambia el número de comidas en «Editar tus datos» y volvemos a montarlo',
      '«Como de táper al mediodía»',
    ],
    pendientes: [{ comida: 'Cena', nombre: 'Fiambre de pavo' }],
    no_entendido: [{ texto: 'tiras de fibra', sugerencia: '¿Quizá «tiras de fiambre de pavo»?' }],
    notas: [
      'He tomado el scoop como 60 g, como has dicho.',
      'Lo hemos tomado en crudo; si lo pesas cocinado, dilo.',
    ],
    n_variables: 7,
  },
)

// ---------- C. El máximo de §6.2: 8 comidas, 40 alimentos, 32 gustos y hábitos, todos los avisos ----------

const NOMBRES_MAXIMO = [
  'Desayuno',
  'Media mañana',
  'Comida',
  'Merienda',
  'Pre-entreno',
  'Post-entreno',
  'Cena',
  'Recena',
] as const

const HORAS_MAXIMO = [
  '07:30',
  '10:30',
  '14:00',
  '17:00',
  '18:30',
  '20:00',
  '21:30',
  '23:00',
] as const

/** Cinco alimentos por comida, con nombres largos de verdad (§3.5 los recorta a 40 caracteres). */
const PLANTILLA_MAXIMO: readonly OpcionesPropio[] = [
  {
    nombre: 'Pechuga de pollo a la plancha',
    alimento_id: 'pechuga_pollo',
    grupo: 'proteina',
    estado: 'crudo',
    gramos: 150,
    ajustados: 130,
    macros: M.pollo,
    nota: 'Lo hemos tomado en crudo; si lo pesas cocinado, dilo.',
  },
  {
    nombre: 'Arroz basmati integral (crudo)',
    alimento_id: 'arroz_blanco_crudo',
    grupo: 'carbohidrato',
    estado: 'crudo',
    gramos: 70,
    ajustados: 80,
    macros: M.arroz,
    nota: 'Basmati ≈ arroz blanco.',
  },
  {
    nombre: 'Aceite de oliva virgen extra',
    alimento_id: 'aceite_oliva',
    grupo: 'grasa',
    gramos: 8,
    macros: M.aceite,
    fijo: true,
  },
  {
    nombre: 'Brócoli al vapor',
    alimento_id: 'brocoli',
    grupo: 'verdura',
    estado: 'cocido',
    gramos: 120,
    macros: M.brocoli,
    fijo: true,
  },
  {
    nombre: 'Kéfir natural entero',
    alimento_id: 'kefir_entero',
    grupo: 'lacteo',
    gramos: 125,
    ajustados: 115,
    macros: M.kefir,
    origen: 'envase',
  },
]

const COMIDAS_MAXIMO: ComidaCompuesta[] = NOMBRES_MAXIMO.map((nombre, i) =>
  comidaPropia(
    nombre,
    HORAS_MAXIMO[i],
    { kcal: 274, prot: 23.1, carb: 25.6, fat: 8.8 },
    PLANTILLA_MAXIMO.map((base, j) =>
      propio({
        ...base,
        nombre: `${base.nombre}${j === 4 ? ` (${nombre.toLowerCase()})` : ''}`.slice(0, 40),
        texto: `${base.gramos} g de ${base.nombre.toLowerCase()} en ${nombre.toLowerCase()}`,
      }),
    ),
    i === 4,
  ),
)

const GUSTOS_MAXIMO = [
  'Sin brócoli',
  'Sin coliflor',
  'Sin judías verdes',
  'Sin hígado',
  'Sin morcilla',
  'Sin callos',
  'Sin sardinas en lata',
  'Sin anchoas',
  'Sin queso azul',
  'Sin cuajada',
  'Favorito: pollo',
  'Favorito: arroz',
  'Favorito: salmón',
  'Favorito: aguacate',
  'Favorito: plátano',
  'Favorito: avena',
  'Favorito: huevo',
  'Favorito: atún',
  'Favorito: yogur griego 0 %',
  'Favorito: pavo',
] as const

const HABITOS_MAXIMO = [
  'Cena sin hidratos',
  'Recena ligera',
  'Comida más abundante',
  'Desayuno: la tuya, cada día',
  '«Hago ocho comidas»: cambia el número de comidas en «Editar tus datos» y volvemos a montarlo',
  '«Como pescado dos veces por semana»: el menú es de un día tipo; la semana aún no la repartimos',
  '«Ceno a las once»: las horas del reparto son orientativas, muévelas sin miedo',
  '«Desayuno nada más levantarme»: las horas del reparto son orientativas, muévelas sin miedo',
  '«Como de táper al mediodía»',
  '«Los domingos como fuera»',
  '«Entre semana repito la cena»',
  '«No desayuno los fines de semana»',
] as const

const AVISOS_MAXIMO: DiaCompuesto['avisos'] = [
  {
    codigo: 'DIETA_NO_CUADRA',
    texto:
      'Con estas comidas el plan no cuadra bien. Lo de abajo es lo mejor que hemos podido hacer sin ' +
      'cambiar lo que comes: lee los avisos y cambia algún alimento.',
  },
  {
    codigo: 'DIETA_PENDIENTES',
    texto:
      'Nos falta la cantidad de Fiambre de pavo y Pan de molde integral. Hasta que la pongas en su ' +
      'comida, estos gramos son provisionales: lo que falta cambia el resto.',
  },
  {
    codigo: 'DIETA_PROPIAS_GRANDES',
    texto:
      'Lo que nos contaste ya se lleva 108 % de tus calorías. Hemos hecho el resto del día lo más ' +
      'ligero que podemos y hemos bajado un poco Pechuga de pollo a la plancha y Kéfir natural entero.',
  },
  {
    codigo: 'DIETA_PROTEINA_CORTA',
    texto:
      'Con estas comidas no llegamos a la proteína: te quedas en 160 g de los 185 g del plan. Sube un ' +
      'poco más Pechuga de pollo a la plancha.',
  },
  {
    codigo: 'DIETA_GRASA_BAJA',
    texto:
      'Tus comidas se quedan en 52 g de grasa frente a los 70 g de tu plan. Por debajo se resienten ' +
      'las hormonas y la absorción de las vitaminas A, D, E y K: añade aceite de oliva, frutos secos, ' +
      'aguacate o pescado azul.',
  },
  {
    codigo: 'DIETA_GRASA_ALTA',
    texto:
      'La grasa se queda en 96 g frente a los 70 g del plan. Lo que más la sube es Aceite de oliva ' +
      'virgen extra y Kéfir natural entero: mira si puedes recortar ahí.',
  },
  {
    codigo: 'DIETA_KCAL_LEJOS',
    texto:
      'Con estas comidas te quedas 240 kcal por debajo de tu plan: no se puede cuadrar más sin cambiar ' +
      'tus raciones.',
  },
  {
    codigo: 'DIETA_HC_LEJOS',
    texto: 'Los hidratos quedan en 148 g frente a los 205 g del plan.',
  },
  {
    codigo: 'DIETA_FIBRA_BAJA',
    texto:
      'Tus comidas se quedan en 18 g de fibra frente a los 31 g de tu plan: añade una ración de ' +
      'verdura, legumbre o fruta.',
  },
  {
    codigo: 'DIETA_SIN_VEGETALES',
    texto:
      'En lo que nos has contado casi no hay verdura ni fruta. Los números cuadran, pero un plan sin ' +
      'vegetales se queda corto de fibra, potasio y vitaminas: añade una ración de verdura a la comida ' +
      'y a la cena y una pieza de fruta.',
  },
  {
    codigo: 'DIETA_SIN_ACEITE',
    texto:
      'No nos has dicho el aceite de cocinar ni el de aliñar. Suelen ser una o dos cucharadas al día, ' +
      'entre 90 y 180 kcal: dilo y los gramos saldrán mejor.',
  },
  {
    codigo: 'DIETA_ALCOHOL',
    texto:
      'El alcohol se lleva 125 kcal de tu día. Las contamos, pero no las repartimos como comida.',
  },
  {
    codigo: 'DIETA_LIMITE',
    texto: 'No subimos más Pechuga de pollo a la plancha: 300 g ya es una ración grande.',
  },
  {
    codigo: 'DIETA_ESTIMADOS',
    texto:
      'Los alimentos marcados con «estimado» no están en nuestra base: sus macros son una estimación. ' +
      'Si tienes el envase a mano, escríbelos desde «Cambiar».',
  },
]

const NO_ENTENDIDO_MAXIMO = Array.from({ length: 20 }, (_, i) => ({
  texto: `fragmento sin entender número ${i + 1}`,
  sugerencia: i % 2 === 0 ? '¿Quizá «tiras de fiambre de pavo»?' : undefined,
}))

/** El caso máximo que declara §6.2: con él el bloque compacta (más de 30 alimentos). */
export const DIA_MAXIMO: DiaCompuesto = montarDia('completa', COMIDAS_MAXIMO, OBJETIVO, {
  avisos: AVISOS_MAXIMO,
  aplicado: [...GUSTOS_MAXIMO.slice(0, 10), ...HABITOS_MAXIMO.slice(0, 4)],
  apuntado: [...GUSTOS_MAXIMO.slice(10), ...HABITOS_MAXIMO.slice(4)],
  pendientes: [
    { comida: 'Cena', nombre: 'Fiambre de pavo' },
    { comida: 'Recena', nombre: 'Pan de molde integral' },
  ],
  no_entendido: NO_ENTENDIDO_MAXIMO,
  notas: [
    'He tomado el scoop como 60 g, como has dicho.',
    'Lo hemos tomado en crudo; si lo pesas cocinado, dilo.',
    'Hemos leído solo las primeras 8 comidas.',
  ],
  n_variables: 24,
})

// ---------- D. Huecos propuestos por la IA (§4bis): mixto, con consejo y con preguntas ----------
// El desayuno es el dictado del §0; la Comida y la Cena las ha propuesto el modelo y las ha cuadrado
// el algoritmo (`propuesta_ia`); la Merienda no convenció (fuera del ±15 %) y cayó al generador de
// plantillas (`propuesta`), de ahí `origen_huecos: 'mixto'` y su nota apuntada.

const COMIDA_PROPUESTA_IA: AlimentoAjustado[] = [
  propio({
    nombre: 'Pechuga de pollo',
    alimento_id: 'pechuga_pollo',
    grupo: 'proteina',
    estado: 'crudo',
    gramos: 200,
    ajustados: 210,
    macros: M.pollo,
    texto: 'pechuga de pollo',
  }),
  propio({
    nombre: 'Arroz blanco (crudo)',
    alimento_id: 'arroz_blanco_crudo',
    grupo: 'carbohidrato',
    estado: 'crudo',
    gramos: 70,
    ajustados: 65,
    macros: M.arroz,
    texto: 'arroz blanco',
  }),
  propio({
    nombre: 'Calabacín',
    alimento_id: 'calabacin',
    grupo: 'verdura',
    gramos: 200,
    macros: M.calabacin,
    fijo: true,
    texto: 'calabacín',
  }),
  propio({
    nombre: 'Aceite de oliva virgen extra',
    alimento_id: 'aove',
    grupo: 'grasa',
    gramos: 10,
    macros: M.aceite,
    fijo: true,
    texto: 'aceite de oliva',
  }),
]

const CENA_PROPUESTA_IA: AlimentoAjustado[] = [
  propio({
    nombre: 'Salmón',
    alimento_id: 'salmon',
    grupo: 'proteina',
    estado: 'crudo',
    gramos: 160,
    ajustados: 150,
    macros: M.salmon,
    texto: 'salmón',
  }),
  propio({
    nombre: 'Patata cocida',
    alimento_id: 'patata_cocida',
    grupo: 'carbohidrato',
    estado: 'cocido',
    gramos: 250,
    ajustados: 270,
    macros: M.patata,
    texto: 'patata cocida',
  }),
  propio({
    nombre: 'Pan de centeno de panadería',
    grupo: 'carbohidrato',
    gramos: 40,
    macros: M.pan_centeno,
    nota: 'No está en nuestra base: sus macros son una estimación.',
    texto: 'pan de centeno',
  }),
  propio({
    nombre: 'Tomate',
    alimento_id: 'tomate',
    grupo: 'verdura',
    gramos: 150,
    macros: M.tomate,
    fijo: true,
    texto: 'tomate',
  }),
  propio({
    nombre: 'Aceite de oliva virgen extra',
    alimento_id: 'aove',
    grupo: 'grasa',
    gramos: 8,
    macros: M.aceite,
    fijo: true,
    texto: 'aceite de oliva',
  }),
]

/** §4bis.6: el día con huecos de la IA, su consejo y sus dos preguntas (que el PDF no imprime). */
export const DIA_PROPUESTA_IA: DiaCompuesto = montarDia(
  'parcial',
  [
    comidaPropia('Desayuno', '08:00', { kcal: 560, prot: 45, carb: 50, fat: 20 }, DESAYUNO_DICTADO),
    comidaPropuestaIa(
      'Comida',
      '14:00',
      { kcal: 620, prot: 55, carb: 55, fat: 20 },
      COMIDA_PROPUESTA_IA,
    ),
    comidaPropuesta(MERIENDA_PROPUESTA, { kcal: 370, prot: 30, carb: 40, fat: 10 }, 4.1),
    comidaPropuestaIa(
      'Cena',
      '21:00',
      { kcal: 640, prot: 55, carb: 60, fat: 20 },
      CENA_PROPUESTA_IA,
    ),
  ],
  OBJETIVO,
  {
    avisos: [
      {
        // §4bis.3: el consejo también llega como aviso informativo; el PDF lo imprime UNA vez.
        codigo: 'DIETA_CONSEJO_IA',
        texto:
          'Pollo y arroz cuadran en calorías y proteína, pero se quedan cortos de fibra y de potasio: ' +
          'hemos metido una verdura en cada comida.',
      },
      {
        codigo: 'DIETA_PENDIENTES',
        texto:
          'Nos falta la cantidad de Cereales de arroz y avena 0 %. Hasta que la pongas en su comida, ' +
          'estos gramos son provisionales: lo que falta cambia el resto.',
      },
      {
        codigo: 'DIETA_ESTIMADOS',
        texto:
          'Los alimentos marcados con «estimado» no están en nuestra base: sus macros son una ' +
          'estimación. Si tienes el envase a mano, escríbelos desde «Cambiar».',
      },
    ],
    aplicado: ['Desayuno: la tuya, cada día', 'Sin brócoli', 'Favorito: salmón'],
    apuntado: ['Para Merienda no nos ha convencido la propuesta y hemos usado la nuestra.'],
    pendientes: [{ comida: 'Desayuno', nombre: 'Cereales de arroz y avena 0 %' }],
    no_entendido: [{ texto: 'tiras de fibra', sugerencia: '¿Quizá «tiras de fiambre de pavo»?' }],
    notas: ['He tomado el scoop como 60 g, como has dicho.'],
    n_variables: 8,
    preguntas: [
      {
        texto: '¿Metemos alguna verdura que sí te guste?',
        opciones: ['No, así está bien', 'Sí, dime cuáles', 'Solo en la cena'],
      },
      {
        texto: '¿Repetimos el mismo desayuno todos los días?',
        opciones: ['Sí, siempre igual', 'Prefiero variar'],
      },
    ],
    consejo_ia:
      'Pollo y arroz cuadran en calorías y proteína, pero se quedan cortos de fibra y de potasio: ' +
      'hemos metido una verdura en cada comida.',
    origen_huecos: 'mixto',
  },
)

// ---------- DatosPdf listos para renderizar ----------

/** La compra de §6.1: los alimentos que no están en nuestra base van sin formato de venta. */
const COMPRA_CON_PROPIOS = MUESTRA_COMPLETA.ejemplos.compra
  ? {
      ...MUESTRA_COMPLETA.ejemplos.compra,
      items: [
        ...MUESTRA_COMPLETA.ejemplos.compra.items,
        {
          alimento_id: 'propio:cereales-de-arroz-y-avena-0:listo',
          nombre: 'Cereales de arroz y avena 0 %',
          producto: 'Cereales de arroz y avena 0 %',
          gramos_semana: 350,
          gramos_dia: 50,
          envases: 0,
          envase_g: 0,
          envase_descripcion: '',
          dura_dias: 0,
          seccion: 'despensa' as const,
          conservacion: 'despensa' as const,
          consejo: 'No está en nuestra base: mira el formato en el envase.',
        },
      ],
      alimentos_distintos: MUESTRA_COMPLETA.ejemplos.compra.items.length + 1,
      notas: [
        ...MUESTRA_COMPLETA.ejemplos.compra.notas,
        'Las cantidades salen de tu menú con lo tuyo dentro. Los alimentos que no están en nuestra base no llevan formato de venta.',
      ],
    }
  : undefined

function conDieta(dia: DiaCompuesto): DatosPdf {
  return {
    ...MUESTRA_COMPLETA,
    ejemplos: { ...MUESTRA_COMPLETA.ejemplos, compra: COMPRA_CON_PROPIOS },
    dieta_propia: dia,
  }
}

/** Desayuno dictado y el resto del día montado por el generador. */
export const MUESTRA_DIETA_PARCIAL: DatosPdf = conDieta(DIA_PARCIAL)
/** Las cuatro comidas dictadas (el día entero del §0). */
export const MUESTRA_DIETA_COMPLETA: DatosPdf = conDieta(DIA_COMPLETO)
/** El máximo de §6.2, con el que el bloque tiene que compactar para caber. */
export const MUESTRA_DIETA_MAXIMA: DatosPdf = conDieta(DIA_MAXIMO)
/** v1.3 (§4bis): desayuno dictado, dos huecos de la IA y uno caído a plantillas. */
export const MUESTRA_DIETA_PROPUESTA_IA: DatosPdf = conDieta(DIA_PROPUESTA_IA)
