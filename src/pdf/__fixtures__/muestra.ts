// Datos de muestra para revisar y testar el PDF sin arrancar la aplicación.
// No son datos reales de nadie: son perfiles plausibles construidos sobre los vectores de SPEC-calculo.md §5.
import type { AvisoTexto, DatosPdf, Ejemplos, Inputs, Resultado } from '../../engine/types'

// =====================================================================
// Muestra A — caso completo: hombre de 38 años que quiere perder grasa,
// entrena fuerza, 4 comidas, hipertensión declarada y cronograma por meses.
// =====================================================================

const INPUTS_A: Inputs = {
  sexo: 'hombre',
  edad: 38,
  altura_cm: 178,
  peso_kg: 84,
  grasa: { metodo: 'desconocido' },
  somatotipo: { q1: 'media', q2: 'moderada', q3: 'moderada', q4: 'atletico' },
  actividad_diaria: 'ligero',
  entrenamiento: {
    tipo: 'fuerza',
    dias_semana: 4,
    minutos_sesion: 60,
    intensidad: 'alta',
    experiencia: 'intermedio',
    momento: 'tarde',
  },
  objetivo: 'perder',
  ritmo: 'moderado',
  peso_objetivo: null,
  preferencia: 'omnivoro',
  n_comidas: 4,
  clima_caluroso: false,
  embarazo_lactancia: false,
  condiciones: ['hipertension'],
  cribado_tca: 'negativo',
  fecha_inicio: '2026-09-07',
}

const RESULTADO_A: Resultado = {
  imc: 26.511804065143288,
  imc_categoria: 'sobrepeso',
  grasa: {
    pct: 24.684443340619598,
    rango: [19.684443340619598, 29.684443340619598],
    fiabilidad: 'baja',
    metodo_efectivo: 'desconocido',
    banda: 'alto',
    referencias: { cunbae: 24.684443340619598, deurenberg: 22.97416487817194 },
  },
  mlg: 63.265067593879536,
  bmr: {
    valor: 1797.5,
    ecuacion: 'mifflin',
    referencias: { mifflin: 1797.5, katch: 1736.525460027798, harris: 1886.2680000000003 },
  },
  tdee: { valor: 2743.8375, bruto: 2888.25, pal: 1.5, ejercicio_dia: 192, perfil: 'fuerza' },
  objetivo_efectivo: 'perder',
  ritmo_efectivo: 'moderado',
  preferencia_efectiva: 'omnivoro',
  kcal: 2190,
  kcal_cierre: 2190,
  macros: {
    proteina_g: 185,
    grasa_g: 70,
    hc_g: 205,
    fibra_g: 31,
    azucares_libres_max_g: 54.75,
    pct: { p: 0.3378995433789954, g: 0.2876712328767123, hc: 0.3744292237442922 },
    gkg: { p: 2.2023809523809526, g: 0.8333333333333334, hc: 2.4404761904761907 },
    base_proteina: 'peso_corporal',
    base_kg: 84,
    somatotipo: 'mesomorfo',
  },
  agua: { ml: 3250, rango: [3000, 3500], vasos: 13 },
  peso_objetivo: {
    efectivo: 74.5,
    sugerido: 74.5,
    mostrar_central: false,
    rango: [68.5, 80],
    metodo: 'grasa',
    hito_intermedio: 79,
    referencias: {
      imc22: 69.7048,
      rango_imc: [63.368, 78.89316],
      clasicas: {
        devine: 73.18110236220471,
        robinson: 71.14960629921259,
        miller: 70.41102362204724,
        hamwi: 75.21259842519684,
      },
    },
  },
  cronograma: {
    ritmo_kg_sem: 0.5034886363636365,
    ritmo_pct_sem: 0.5993912337662339,
    delta_kg: 9.5,
    semanas: [21, 25],
    diet_breaks: 2,
    fecha_min: '2027-02-01',
    fecha_max: '2027-03-01',
    precision_fecha: 'mes',
    tramo_12sem: [5, 6],
  },
  ffmi: { valor: 19.96751281210691, normalizado: 20.093512812106912, categoria: null },
  comidas: [
    { nombre: 'Desayuno', hora: '08:00', pct_kcal: 25, proteina_g: 45, grasa_g: 20, hc_g: 50, kcal: 560, peri: false },
    { nombre: 'Comida', hora: '14:00', pct_kcal: 30, proteina_g: 55, grasa_g: 20, hc_g: 55, kcal: 620, peri: false },
    { nombre: 'Merienda', hora: '17:30', pct_kcal: 15, proteina_g: 30, grasa_g: 10, hc_g: 40, kcal: 370, peri: true },
    { nombre: 'Cena', hora: '21:00', pct_kcal: 30, proteina_g: 55, grasa_g: 20, hc_g: 60, kcal: 640, peri: false },
  ],
  avisos: ['WARN_HIPERTENSION', 'WARN_PROTEINA_TOMA_ALTA', 'INFO_BMR_ATLETA', 'INFO_ADAPTACION', 'INFO_GRASA_ESTIMADA'],
}

const AVISOS_A: AvisoTexto[] = [
  {
    codigo: 'WARN_HIPERTENSION',
    severidad: 'warn',
    titulo: 'La sal importa tanto como las calorías',
    texto:
      'Con hipertensión o enfermedad cardiovascular, la sal importa tanto como las calorías: la OMS recomienda ' +
      'menos de 5 g de sal al día (unos 2 g de sodio). Vigila embutidos, conservas, quesos curados, pan y ' +
      'precocinados, y coméntalo con tu médico.',
  },
  {
    codigo: 'WARN_PROTEINA_TOMA_ALTA',
    severidad: 'warn',
    titulo: 'Mucha proteína en una sola toma',
    texto:
      'Con este número de comidas concentras mucha proteína en una sola toma. El total diario sigue siendo lo que ' +
      'más cuenta, pero repartirla en 3 tomas se aprovecha algo mejor.',
  },
  {
    codigo: 'INFO_BMR_ATLETA',
    severidad: 'info',
    titulo: 'Entrenas mucho volumen',
    texto:
      'Con tu volumen de entrenamiento, la ecuación estándar puede quedarse corta. Si en 3-4 semanas pierdes peso ' +
      'más rápido de lo previsto, sube 100-150 kcal.',
  },
  {
    codigo: 'INFO_ADAPTACION',
    severidad: 'info',
    titulo: 'El calendario es una estimación',
    texto:
      'El calendario es una estimación: al cambiar el peso, el gasto también cambia y la regla "7 700 kcal = 1 kg" ' +
      'pierde precisión. A partir del tercer o cuarto mes el ritmo real suele ser aproximadamente la mitad del ' +
      'previsto. Por eso te damos un rango y te recomendamos recalcular cada 2-4 semanas con tu peso real.',
  },
  {
    codigo: 'INFO_GRASA_ESTIMADA',
    severidad: 'info',
    titulo: 'Tu grasa corporal es una estimación',
    texto:
      'Tu porcentaje de grasa es una estimación con un error típico de ±5 puntos. Una bioimpedancia profesional o ' +
      'una DEXA afinarían el cálculo.',
  },
]

const EJEMPLOS_A: Ejemplos = {
  entreno: {
    tipo: 'entreno',
    comidas: [
      {
        comida: 'Desayuno',
        hora: '08:00',
        peri: false,
        objetivo: { kcal: 560, prot: 45, carb: 50, fat: 20 },
        alimentos: [
          { id: 'avena', nombre: 'Copos de avena', gramos: 70, medida: '7 cucharadas soperas', kcal: 263, prot: 9, carb: 42, fat: 5 },
          { id: 'leche_semi', nombre: 'Leche semidesnatada', gramos: 250, medida: '1 vaso grande', kcal: 115, prot: 8, carb: 12, fat: 4 },
          { id: 'clara_huevo', nombre: 'Claras de huevo', gramos: 200, medida: '6 claras', kcal: 96, prot: 22, carb: 2, fat: 0 },
          { id: 'nueces', nombre: 'Nueces', gramos: 15, medida: '4 unidades', kcal: 98, prot: 2, carb: 1, fat: 10 },
        ],
        totales: { kcal: 572, prot: 41, carb: 57, fat: 19 },
        alternativas: [
          'Cambia la avena por 90 g de pan integral',
          'Cambia las claras por 150 g de queso batido 0 %',
        ],
      },
      {
        comida: 'Comida',
        hora: '14:00',
        peri: false,
        objetivo: { kcal: 620, prot: 55, carb: 55, fat: 20 },
        alimentos: [
          { id: 'pollo_pechuga', nombre: 'Pechuga de pollo', gramos: 200, medida: '1 pechuga grande', kcal: 220, prot: 46, carb: 0, fat: 4 },
          { id: 'arroz_cocido', nombre: 'Arroz blanco cocido', gramos: 220, medida: '4 cucharadas colmadas', kcal: 286, prot: 6, carb: 62, fat: 1 },
          { id: 'aove', nombre: 'Aceite de oliva virgen extra', gramos: 15, medida: '1 cucharada y media', kcal: 135, prot: 0, carb: 0, fat: 15 },
          { id: 'ensalada_mixta', nombre: 'Ensalada de hoja verde y tomate', gramos: 150, medida: '1 bol', kcal: 30, prot: 2, carb: 4, fat: 0 },
        ],
        totales: { kcal: 671, prot: 54, carb: 66, fat: 20 },
        alternativas: [
          'Cambia el pollo por 220 g de merluza',
          'Cambia el arroz por 260 g de patata cocida',
          'Cambia el pollo por 250 g de garbanzos cocidos si prefieres legumbre',
        ],
      },
      {
        comida: 'Merienda',
        hora: '17:30',
        peri: true,
        objetivo: { kcal: 370, prot: 30, carb: 40, fat: 10 },
        alimentos: [
          { id: 'yogur_natural', nombre: 'Yogur natural', gramos: 250, medida: '2 unidades', kcal: 155, prot: 10, carb: 12, fat: 8 },
          { id: 'platano', nombre: 'Plátano', gramos: 120, medida: '1 unidad mediana', kcal: 107, prot: 1, carb: 25, fat: 0 },
          { id: 'pan_integral', nombre: 'Pan integral', gramos: 60, medida: '2 rebanadas', kcal: 147, prot: 6, carb: 27, fat: 2 },
        ],
        totales: { kcal: 409, prot: 17, carb: 64, fat: 10 },
        alternativas: ['Cambia el plátano por 200 g de manzana', 'Cambia el yogur por 200 g de queso fresco batido'],
      },
      {
        comida: 'Cena',
        hora: '21:00',
        peri: false,
        objetivo: { kcal: 640, prot: 55, carb: 60, fat: 20 },
        alimentos: [
          { id: 'salmon', nombre: 'Salmón fresco', gramos: 180, medida: '1 lomo', kcal: 373, prot: 36, carb: 0, fat: 25 },
          { id: 'patata', nombre: 'Patata cocida', gramos: 300, medida: '2 patatas medianas', kcal: 261, prot: 6, carb: 60, fat: 0 },
          { id: 'brocoli', nombre: 'Brócoli al vapor', gramos: 200, medida: '1 plato', kcal: 68, prot: 6, carb: 7, fat: 1 },
        ],
        totales: { kcal: 702, prot: 48, carb: 67, fat: 26 },
        alternativas: ['Cambia el salmón por 220 g de lomo de bacalao y 15 g de aceite', 'Cambia la patata por 250 g de boniato'],
      },
    ],
    totales: { kcal: 2354, prot: 160, carb: 254, fat: 75 },
    notas: [
      'Los gramos son en crudo y en peso neto, sin piel, hueso ni cáscara.',
      'Cocina sin sal añadida y evita embutidos y conservas: con tu condición el sodio importa más que los gramos exactos.',
    ],
  },
  descanso: {
    tipo: 'descanso',
    comidas: [],
    totales: { kcal: 0, prot: 0, carb: 0, fat: 0 },
    notas: [],
  },
  consejos: [
    'Prioriza que cada comida principal lleve una ración de proteína del tamaño de la palma de tu mano (unos 20-30 g de proteína): es más fácil de recordar que pesar todo.',
    'Deja margen de flexibilidad: comer bien el 80 % del tiempo y disfrutar el 20 % restante es más sostenible que la perfección absoluta.',
    'Bebe agua antes de las comidas y a lo largo del día: la sed a veces se confunde con hambre.',
    'Come una ración de proteína (20-40 g) en las 1-3 horas antes o después de entrenar: no es obligatorio, pero ayuda a recuperar mejor.',
    'Prepara comida para 2-3 días (batch cooking) de los alimentos base —arroz, pollo, legumbres— para no depender de decisiones bajo hambre o cansancio.',
  ],
}

// En la v1 el motor devuelve un único reparto: el día de descanso es el mismo que el de entreno.
EJEMPLOS_A.descanso = { ...EJEMPLOS_A.entreno, tipo: 'descanso' }

/** Muestra completa: todos los bloques del PDF con datos. */
export const MUESTRA_COMPLETA: DatosPdf = {
  inputs: INPUTS_A,
  resultado: RESULTADO_A,
  ejemplos: EJEMPLOS_A,
  avisos: AVISOS_A,
  fecha: '2026-09-07',
}

// =====================================================================
// Muestra B — caso mínimo: mujer de 66 años, mantenimiento (sin cronograma),
// 2 comidas, sin entrenamiento, altura fuera de 150-200 cm (sin fórmulas clásicas).
// =====================================================================

const INPUTS_B: Inputs = {
  sexo: 'mujer',
  edad: 66,
  altura_cm: 149,
  peso_kg: 58.4,
  grasa: { metodo: 'medidas', cuello_cm: 32, cintura_cm: 82, cadera_cm: 100 },
  somatotipo: null,
  actividad_diaria: 'sedentario',
  entrenamiento: {
    tipo: 'ninguno',
    dias_semana: 0,
    minutos_sesion: 0,
    intensidad: 'baja',
    experiencia: 'novato',
    momento: null,
  },
  objetivo: 'mantener',
  ritmo: 'moderado',
  peso_objetivo: null,
  preferencia: 'vegetariano',
  n_comidas: 2,
  clima_caluroso: false,
  embarazo_lactancia: false,
  condiciones: ['tiroides'],
  cribado_tca: 'negativo',
  fecha_inicio: '2026-09-07',
}

const RESULTADO_B: Resultado = {
  imc: 26.3,
  imc_categoria: 'sobrepeso',
  grasa: {
    pct: 36.4,
    rango: [33.4, 39.4],
    fiabilidad: 'media',
    metodo_efectivo: 'medidas',
    banda: 'alto',
    referencias: { cunbae: 38.1, deurenberg: 36.9, navy: 34.2 },
  },
  mlg: 37.14,
  bmr: { valor: 1145, ecuacion: 'mifflin', referencias: { mifflin: 1145, katch: 1187.5, harris: 1198.2 } },
  tdee: { valor: 1524, bruto: 1604.2, pal: 1.4, ejercicio_dia: 0, perfil: 'sedentario' },
  objetivo_efectivo: 'mantener',
  ritmo_efectivo: 'moderado',
  preferencia_efectiva: 'vegetariano',
  kcal: 1525,
  kcal_cierre: 1520,
  macros: {
    proteina_g: 90,
    grasa_g: 55,
    hc_g: 145,
    fibra_g: 21,
    azucares_libres_max_g: 38.1,
    pct: { p: 0.2360655737704918, g: 0.32459016393442625, hc: 0.380327868852459 },
    gkg: { p: 1.541095890410959, g: 0.9417808219178082, hc: 2.4828767123287672 },
    base_proteina: 'peso_ajustado',
    base_kg: 58.4,
    somatotipo: 'endomorfo',
  },
  agua: { ml: 2050, rango: [1900, 2200], vasos: 8 },
  peso_objetivo: {
    efectivo: null,
    sugerido: 55.2,
    mostrar_central: false,
    rango: [51.4, 59],
    metodo: 'actual',
    hito_intermedio: null,
    referencias: { imc22: 48.8, rango_imc: [41, 55.4], clasicas: null },
  },
  cronograma: null,
  ffmi: { valor: 16.7, normalizado: 16.6, categoria: null },
  comidas: [
    { nombre: 'Comida', hora: '14:00', pct_kcal: 55, proteina_g: 50, grasa_g: 30, hc_g: 80, kcal: 840, peri: false },
    { nombre: 'Cena', hora: '21:00', pct_kcal: 45, proteina_g: 40, grasa_g: 25, hc_g: 65, kcal: 680, peri: false },
  ],
  avisos: ['WARN_TIROIDES', 'INFO_SIN_CRONOGRAMA', 'INFO_AGUA_MAYORES'],
}

const AVISOS_B: AvisoTexto[] = [
  {
    codigo: 'WARN_TIROIDES',
    severidad: 'warn',
    titulo: 'Revisa los números con tu endocrino',
    texto:
      'Con patología tiroidea el gasto energético puede desviarse bastante de lo que estima cualquier fórmula, ' +
      'sobre todo si el tratamiento no está ajustado. Toma estos números como punto de partida y revísalos con tu ' +
      'endocrino.',
  },
  {
    codigo: 'INFO_SIN_CRONOGRAMA',
    severidad: 'info',
    titulo: 'Sin fecha de llegada',
    texto:
      'Con este objetivo no hay un peso al que llegar en una fecha. Reevalúa medidas, fotos y rendimiento cada ' +
      '8-12 semanas.',
  },
  {
    codigo: 'INFO_AGUA_MAYORES',
    severidad: 'info',
    titulo: 'La sed avisa menos con los años',
    texto:
      'A partir de los 65 años la sensación de sed se reduce: reparte el agua en tomas regulares a lo largo del ' +
      'día en vez de esperar a tener sed.',
  },
]

const EJEMPLOS_B: Ejemplos = {
  entreno: {
    tipo: 'entreno',
    comidas: [
      {
        comida: 'Comida',
        hora: '14:00',
        peri: false,
        objetivo: { kcal: 840, prot: 50, carb: 80, fat: 30 },
        alimentos: [
          { id: 'lentejas_cocidas', nombre: 'Lentejas cocidas', gramos: 300, medida: '1 plato hondo', kcal: 348, prot: 26, carb: 51, fat: 1 },
          { id: 'tofu_firme', nombre: 'Tofu firme', gramos: 150, medida: '1 taco grande', kcal: 218, prot: 24, carb: 3, fat: 13 },
          { id: 'aove', nombre: 'Aceite de oliva virgen extra', gramos: 15, medida: '1 cucharada y media', kcal: 135, prot: 0, carb: 0, fat: 15 },
          { id: 'pan_integral', nombre: 'Pan integral', gramos: 50, medida: '2 rebanadas finas', kcal: 123, prot: 5, carb: 23, fat: 1 },
        ],
        totales: { kcal: 824, prot: 55, carb: 77, fat: 30 },
        alternativas: ['Cambia el tofu por 150 g de tempeh', 'Cambia las lentejas por 300 g de garbanzos cocidos'],
      },
      {
        comida: 'Cena',
        hora: '21:00',
        peri: false,
        objetivo: { kcal: 680, prot: 40, carb: 65, fat: 25 },
        alimentos: [
          { id: 'huevo', nombre: 'Huevo', gramos: 120, medida: '2 unidades', kcal: 172, prot: 15, carb: 1, fat: 12 },
          { id: 'queso_fresco', nombre: 'Queso fresco batido', gramos: 250, medida: '1 tarrina', kcal: 175, prot: 20, carb: 10, fat: 5 },
          { id: 'patata', nombre: 'Patata cocida', gramos: 250, medida: '2 patatas pequeñas', kcal: 218, prot: 5, carb: 50, fat: 0 },
          { id: 'verdura_salteada', nombre: 'Verdura salteada con 5 g de aceite', gramos: 200, medida: '1 plato', kcal: 90, prot: 3, carb: 8, fat: 5 },
        ],
        totales: { kcal: 655, prot: 43, carb: 69, fat: 22 },
        alternativas: ['Cambia el huevo por 120 g de tofu', 'Cambia la patata por 200 g de arroz cocido'],
      },
    ],
    totales: { kcal: 1479, prot: 98, carb: 146, fat: 52 },
    notas: ['Los gramos son en crudo y en peso neto.'],
  },
  descanso: {
    tipo: 'descanso',
    comidas: [],
    totales: { kcal: 0, prot: 0, carb: 0, fat: 0 },
    notas: [],
  },
  consejos: [
    'Prioriza que cada comida principal lleve una ración de proteína del tamaño de la palma de tu mano (unos 20-30 g de proteína): es más fácil de recordar que pesar todo.',
    'Deja margen de flexibilidad: comer bien el 80 % del tiempo y disfrutar el 20 % restante es más sostenible que la perfección absoluta.',
    'Bebe agua antes de las comidas y a lo largo del día: la sed a veces se confunde con hambre.',
    'Si algún día solo puedes hacer 1 o 2 comidas, no pasa nada: reparte tu proteína y tus calorías del día entre esas tomas. Lo que cuenta es el total de la semana, no un día suelto.',
  ],
}

EJEMPLOS_B.descanso = { ...EJEMPLOS_B.entreno, tipo: 'descanso' }

/** Muestra mínima: sin cronograma, 2 comidas, sin entrenamiento y sin fórmulas clásicas de peso ideal. */
export const MUESTRA_MINIMA: DatosPdf = {
  inputs: INPUTS_B,
  resultado: RESULTADO_B,
  ejemplos: EJEMPLOS_B,
  avisos: AVISOS_B,
  fecha: '2026-09-07',
}
