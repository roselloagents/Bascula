// Datos de muestra para revisar y testar el PDF sin arrancar la aplicación.
// No son datos reales de nadie: son perfiles plausibles construidos sobre los vectores de SPEC-calculo.md §5.
import type {
  AvisoTexto,
  DatosPdf,
  Ejemplos,
  Inputs,
  ListaCompra,
  Pesaje,
  PuntoProyeccion,
  Resultado,
  ResultadoCiclo,
  SeccionOpcionalCompra,
} from '../../engine/types'
import { equivalencias } from '../../meals/equivalencias'

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
  // v1.1: preferencias combinables (paso 13). `preferencia` se conserva por compatibilidad.
  preferencia_base: 'omnivoro',
  restricciones: ['sin_lactosa'],
  low_carb: false,
  n_comidas: 4,
  clima_caluroso: false,
  embarazo_lactancia: false,
  condiciones: ['hipertension'],
  cribado_tca: 'negativo',
  fecha_inicio: '2026-09-07',
}

/** Proyección del caso A (perder, 22 semanas hasta el objetivo de 74,5 kg). SPEC Paso 14b. */
const PROYECCION_A: PuntoProyeccion[] = [
  { semana: 0, peso_min: 84, peso_esp: 84, peso_max: 84 },
  { semana: 1, peso_min: 83.2, peso_esp: 83.5, peso_max: 83.8 },
  { semana: 2, peso_min: 82.6, peso_esp: 83, peso_max: 83.4 },
  { semana: 3, peso_min: 82, peso_esp: 82.5, peso_max: 83 },
  { semana: 4, peso_min: 81.5, peso_esp: 82, peso_max: 82.6 },
  { semana: 5, peso_min: 80.9, peso_esp: 81.6, peso_max: 82.2 },
  { semana: 6, peso_min: 80.4, peso_esp: 81.1, peso_max: 81.8 },
  { semana: 7, peso_min: 79.9, peso_esp: 80.6, peso_max: 81.4 },
  { semana: 8, peso_min: 79.4, peso_esp: 80.2, peso_max: 81 },
  { semana: 9, peso_min: 78.9, peso_esp: 79.7, peso_max: 80.6 },
  { semana: 10, peso_min: 78.4, peso_esp: 79.3, peso_max: 80.2 },
  { semana: 11, peso_min: 77.9, peso_esp: 78.9, peso_max: 79.8 },
  { semana: 12, peso_min: 77.5, peso_esp: 78.4, peso_max: 79.4 },
  { semana: 13, peso_min: 77, peso_esp: 78, peso_max: 79 },
  { semana: 14, peso_min: 76.6, peso_esp: 77.6, peso_max: 78.6 },
  { semana: 15, peso_min: 76.1, peso_esp: 77.2, peso_max: 78.3 },
  { semana: 16, peso_min: 75.7, peso_esp: 76.8, peso_max: 77.9 },
  { semana: 17, peso_min: 75.2, peso_esp: 76.4, peso_max: 77.5 },
  { semana: 18, peso_min: 74.8, peso_esp: 76, peso_max: 77.2 },
  { semana: 19, peso_min: 74.5, peso_esp: 75.6, peso_max: 76.8 },
  { semana: 20, peso_min: 74.5, peso_esp: 75.2, peso_max: 76.5 },
  { semana: 21, peso_min: 74.5, peso_esp: 74.9, peso_max: 76.2 },
  { semana: 22, peso_min: 74.5, peso_esp: 74.5, peso_max: 75.8 },
]

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
    pct_cap: 0.35,
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
    {
      nombre: 'Desayuno',
      hora: '08:00',
      pct_kcal: 25,
      proteina_g: 45,
      grasa_g: 20,
      hc_g: 50,
      kcal: 560,
      peri: false,
    },
    {
      nombre: 'Comida',
      hora: '14:00',
      pct_kcal: 30,
      proteina_g: 55,
      grasa_g: 20,
      hc_g: 55,
      kcal: 620,
      peri: false,
    },
    {
      nombre: 'Merienda',
      hora: '17:30',
      pct_kcal: 15,
      proteina_g: 30,
      grasa_g: 10,
      hc_g: 40,
      kcal: 370,
      peri: true,
    },
    {
      nombre: 'Cena',
      hora: '21:00',
      pct_kcal: 30,
      proteina_g: 55,
      grasa_g: 20,
      hc_g: 60,
      kcal: 640,
      peri: false,
    },
  ],
  avisos: [
    'WARN_HIPERTENSION',
    'WARN_PROTEINA_TOMA_ALTA',
    'INFO_BMR_ATLETA',
    'INFO_ADAPTACION',
    'INFO_GRASA_ESTIMADA',
  ],
  // ---------- v1.1 ----------
  preferencia_base: 'omnivoro',
  restricciones: ['sin_lactosa'],
  low_carb: false,
  proyeccion: PROYECCION_A,
  limites_ajuste: {
    kcal_recomendada: 2190,
    hc_recomendado_g: 205,
    grasa_recomendada_g: 70,
    kcal_min: 1810,
    kcal_max: 2740,
    kcal_paso: 50,
    hc_min_ui_g: 30,
    hc_min_motor_g: 130,
    suelo_grasa_abs_g: 58.8,
    peso_kg: 84,
    fecha_inicio: '2026-09-07',
    kcal_micronutrientes: 1800,
  },
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

// ---------------------------------------------------------------------
// Lista de la compra (§3.7). Los números siguen las fórmulas normativas:
// gramos_semana = round(gramos_dia · 7); envases = ceil(gramos_semana / envase_g);
// dura_dias = min(floor(envases · envase_g / gramos_dia), conservacion_dias).
// Los productos y formatos salen de `src/data/mercadona.json`. Sin precios.
// ---------------------------------------------------------------------

const CONSEJO_FRESCO =
  'Es fresco: cómpralo en dos veces, mitad al principio de la semana y mitad a mitad.'

const NOTAS_COMPRA = [
  'Formatos aproximados; pueden variar por tienda',
  'Compra fresco dos veces por semana',
  'Pesa en crudo',
]

/** Muestra A: menú variado (no sencillo), 14 alimentos distintos en la semana. */
const COMPRA_A: ListaCompra = {
  supermercado: 'Mercadona',
  dias: 7,
  alimentos_distintos: 14,
  items: [
    {
      alimento_id: 'pollo_pechuga',
      nombre: 'Pechuga de pollo',
      producto: 'Pechuga de pollo fileteada Hacendado',
      seccion: 'carniceria',
      conservacion: 'fresco',
      gramos_dia: 200,
      gramos_semana: 1400,
      envase_g: 1000,
      envase_descripcion: 'bandeja ≈ 1 kg',
      envases: 2,
      dura_dias: 3,
      consejo: CONSEJO_FRESCO,
    },
    {
      alimento_id: 'salmon',
      nombre: 'Salmón fresco',
      producto: 'Lomos de salmón fresco',
      seccion: 'pescaderia',
      conservacion: 'fresco',
      gramos_dia: 180,
      gramos_semana: 1260,
      envase_g: 500,
      envase_descripcion: 'bandeja ≈ 500 g (2 lomos)',
      envases: 3,
      dura_dias: 2,
      consejo: CONSEJO_FRESCO,
    },
    {
      alimento_id: 'clara_huevo',
      nombre: 'Claras de huevo',
      producto: 'Clara de huevo pasteurizada Hacendado',
      seccion: 'huevos_lacteos',
      conservacion: 'fresco',
      gramos_dia: 200,
      gramos_semana: 1400,
      envase_g: 500,
      envase_descripcion: 'botella ≈ 500 g',
      envases: 3,
      dura_dias: 7,
      consejo: 'Una vez abierta, consúmela en 3-4 días.',
    },
    {
      alimento_id: 'yogur_natural',
      nombre: 'Yogur natural',
      producto: 'Yogur natural Hacendado, pack de 4',
      seccion: 'huevos_lacteos',
      conservacion: 'fresco',
      gramos_dia: 250,
      gramos_semana: 1750,
      envase_g: 500,
      envase_descripcion: 'pack de 4 × 125 g',
      envases: 4,
      dura_dias: 8,
    },
    {
      alimento_id: 'ensalada_mixta',
      nombre: 'Ensalada de hoja verde y tomate',
      producto: 'Ensalada lista para consumir Hacendado, bolsa',
      seccion: 'fruteria',
      conservacion: 'fresco',
      gramos_dia: 150,
      gramos_semana: 1050,
      envase_g: 200,
      envase_descripcion: 'bolsa ≈ 200 g',
      envases: 6,
      dura_dias: 5,
      consejo: CONSEJO_FRESCO,
    },
    {
      alimento_id: 'patata',
      nombre: 'Patata cocida',
      producto: 'Patata para cocer, malla',
      seccion: 'fruteria',
      conservacion: 'despensa',
      gramos_dia: 300,
      gramos_semana: 2100,
      envase_g: 2700,
      envase_descripcion: 'malla ≈ 3 kg (≈ 2,7 kg ya cocida y pelada)',
      envases: 1,
      dura_dias: 9,
      consejo: 'En un sitio fresco, seco y sin luz; no en la nevera.',
    },
    {
      alimento_id: 'platano',
      nombre: 'Plátano',
      producto: 'Plátano de Canarias a granel',
      seccion: 'fruteria',
      conservacion: 'fresco',
      gramos_dia: 120,
      gramos_semana: 840,
      envase_g: 640,
      envase_descripcion: '≈ 1 kg con piel (≈ 640 g comestibles, 5-6 piezas)',
      envases: 2,
      dura_dias: 6,
      consejo: CONSEJO_FRESCO,
    },
    {
      alimento_id: 'aove',
      nombre: 'Aceite de oliva virgen extra',
      producto: 'Aceite de oliva virgen extra Hacendado, botella de 1 L',
      seccion: 'despensa',
      conservacion: 'despensa',
      gramos_dia: 15,
      gramos_semana: 105,
      envase_g: 910,
      envase_descripcion: 'botella 1 L (≈ 910 g)',
      envases: 1,
      dura_dias: 60,
      consejo: 'Guárdalo lejos de la luz y del calor de los fogones.',
    },
    {
      alimento_id: 'arroz_cocido',
      nombre: 'Arroz blanco cocido',
      producto: 'Arroz redondo Hacendado, paquete de 1 kg',
      seccion: 'despensa',
      conservacion: 'despensa',
      gramos_dia: 220,
      gramos_semana: 1540,
      envase_g: 2600,
      envase_descripcion: 'paquete 1 kg en crudo (≈ 2,6 kg ya cocido)',
      envases: 1,
      dura_dias: 11,
      consejo: 'Cocido y en táper, tres días en la nevera: cocina para dos o tres días de golpe.',
    },
    {
      alimento_id: 'avena',
      nombre: 'Copos de avena',
      producto: 'Copos de avena finos Hacendado',
      seccion: 'despensa',
      conservacion: 'despensa',
      gramos_dia: 70,
      gramos_semana: 490,
      envase_g: 500,
      envase_descripcion: 'paquete ≈ 500 g',
      envases: 1,
      dura_dias: 7,
    },
    {
      alimento_id: 'leche_semi',
      nombre: 'Leche semidesnatada',
      producto: 'Leche semidesnatada Hacendado, brik de 1 L',
      seccion: 'despensa',
      conservacion: 'despensa',
      gramos_dia: 250,
      gramos_semana: 1750,
      envase_g: 1000,
      envase_descripcion: 'brik 1 L (≈ 1 kg)',
      envases: 2,
      dura_dias: 8,
      consejo: 'Sin abrir, en la despensa; abierta, 3-4 días en la nevera.',
    },
    {
      alimento_id: 'nueces',
      nombre: 'Nueces',
      producto: 'Nueces peladas Hacendado',
      seccion: 'despensa',
      conservacion: 'despensa',
      gramos_dia: 15,
      gramos_semana: 105,
      envase_g: 200,
      envase_descripcion: 'bolsa ≈ 200 g',
      envases: 1,
      dura_dias: 13,
      consejo: 'Si tardas en gastarlas, guárdalas en la nevera.',
    },
    {
      alimento_id: 'brocoli',
      nombre: 'Brócoli al vapor',
      producto: 'Brócoli congelado Hacendado',
      seccion: 'congelados',
      conservacion: 'congelado',
      gramos_dia: 200,
      gramos_semana: 1400,
      envase_g: 1000,
      envase_descripcion: 'bolsa ≈ 1 kg',
      envases: 2,
      dura_dias: 10,
      consejo: 'Del congelador a la sartén o al microondas, sin descongelar.',
    },
    {
      alimento_id: 'pan_integral',
      nombre: 'Pan integral',
      producto: 'Pan de molde integral Hacendado',
      seccion: 'panaderia',
      conservacion: 'fresco',
      gramos_dia: 60,
      gramos_semana: 420,
      envase_g: 460,
      envase_descripcion: 'paquete ≈ 460 g (≈ 18 rebanadas)',
      envases: 1,
      dura_dias: 7,
      consejo: 'Congela media bolsa: tuesta las rebanadas directamente congeladas.',
    },
  ],
  notas: NOTAS_COMPRA,
}

/** Muestra B: modo sencillo, 8 alimentos distintos para toda la semana. */
const COMPRA_B: ListaCompra = {
  supermercado: 'Mercadona',
  dias: 7,
  alimentos_distintos: 8,
  items: [
    {
      alimento_id: 'huevo',
      nombre: 'Huevo',
      producto: 'Huevos frescos talla L Hacendado, docena',
      seccion: 'huevos_lacteos',
      conservacion: 'fresco',
      gramos_dia: 120,
      gramos_semana: 840,
      envase_g: 660,
      envase_descripcion: 'docena (≈ 55 g comestibles por huevo)',
      envases: 2,
      dura_dias: 11,
      consejo: 'Aguantan tres semanas en la nevera; no los laves hasta usarlos.',
    },
    {
      alimento_id: 'queso_fresco',
      nombre: 'Queso fresco batido',
      producto: 'Queso fresco batido 0 % sin lactosa Hacendado',
      seccion: 'huevos_lacteos',
      conservacion: 'fresco',
      gramos_dia: 250,
      gramos_semana: 1750,
      envase_g: 500,
      envase_descripcion: 'tarrina ≈ 500 g',
      envases: 4,
      dura_dias: 8,
      consejo: 'Abierto, cuatro o cinco días.',
    },
    {
      alimento_id: 'patata',
      nombre: 'Patata cocida',
      producto: 'Patata para cocer, malla',
      seccion: 'fruteria',
      conservacion: 'despensa',
      gramos_dia: 250,
      gramos_semana: 1750,
      envase_g: 2700,
      envase_descripcion: 'malla ≈ 3 kg (≈ 2,7 kg ya cocida y pelada)',
      envases: 1,
      dura_dias: 10,
      consejo: 'En un sitio fresco, seco y sin luz; no en la nevera.',
    },
    {
      alimento_id: 'aove',
      nombre: 'Aceite de oliva virgen extra',
      producto: 'Aceite de oliva virgen extra Hacendado, botella de 1 L',
      seccion: 'despensa',
      conservacion: 'despensa',
      gramos_dia: 15,
      gramos_semana: 105,
      envase_g: 910,
      envase_descripcion: 'botella 1 L (≈ 910 g)',
      envases: 1,
      dura_dias: 60,
      consejo: 'Guárdalo lejos de la luz y del calor de los fogones.',
    },
    {
      alimento_id: 'lentejas_cocidas',
      nombre: 'Lentejas cocidas',
      producto: 'Lentejas cocidas Hacendado, bote de cristal',
      seccion: 'despensa',
      conservacion: 'despensa',
      gramos_dia: 300,
      gramos_semana: 2100,
      envase_g: 400,
      envase_descripcion: 'bote 570 g (≈ 400 g escurridos)',
      envases: 6,
      dura_dias: 8,
      consejo: 'Enjuágalas bajo el grifo antes de usarlas.',
    },
    {
      alimento_id: 'verdura_salteada',
      nombre: 'Verdura salteada con 5 g de aceite',
      producto: 'Judía verde plana congelada Hacendado',
      seccion: 'congelados',
      conservacion: 'congelado',
      gramos_dia: 200,
      gramos_semana: 1400,
      envase_g: 1000,
      envase_descripcion: 'bolsa ≈ 1 kg',
      envases: 2,
      dura_dias: 10,
      consejo: 'Del congelador a la olla, sin descongelar.',
    },
    {
      alimento_id: 'pan_integral',
      nombre: 'Pan integral',
      producto: 'Pan de molde integral Hacendado',
      seccion: 'panaderia',
      conservacion: 'fresco',
      gramos_dia: 50,
      gramos_semana: 350,
      envase_g: 460,
      envase_descripcion: 'paquete ≈ 460 g (≈ 18 rebanadas)',
      envases: 1,
      dura_dias: 7,
      consejo: CONSEJO_FRESCO,
    },
    {
      alimento_id: 'tofu_firme',
      nombre: 'Tofu firme',
      producto: 'Tofu firme prensado (mueble de refrigerados vegetales)',
      seccion: 'otros',
      conservacion: 'fresco',
      gramos_dia: 150,
      gramos_semana: 1050,
      envase_g: 300,
      envase_descripcion: 'bloque ≈ 300 g',
      envases: 4,
      dura_dias: 8,
      consejo: 'Abierto, en agua y en la nevera, 3 días.',
    },
  ],
  notas: NOTAS_COMPRA,
}

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
          {
            id: 'avena',
            nombre: 'Copos de avena',
            gramos: 70,
            medida: '7 cucharadas soperas',
            kcal: 263,
            prot: 9,
            carb: 42,
            fat: 5,
          },
          {
            id: 'leche_semi',
            nombre: 'Leche semidesnatada',
            gramos: 250,
            medida: '1 vaso grande',
            kcal: 115,
            prot: 8,
            carb: 12,
            fat: 4,
          },
          {
            id: 'clara_huevo',
            nombre: 'Claras de huevo',
            gramos: 200,
            medida: '6 claras',
            kcal: 96,
            prot: 22,
            carb: 2,
            fat: 0,
          },
          {
            id: 'nueces',
            nombre: 'Nueces',
            gramos: 15,
            medida: '4 unidades',
            kcal: 98,
            prot: 2,
            carb: 1,
            fat: 10,
          },
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
          {
            id: 'pollo_pechuga',
            nombre: 'Pechuga de pollo',
            gramos: 200,
            medida: '1 pechuga grande',
            kcal: 220,
            prot: 46,
            carb: 0,
            fat: 4,
          },
          {
            id: 'arroz_cocido',
            nombre: 'Arroz blanco cocido',
            gramos: 220,
            medida: '4 cucharadas colmadas',
            kcal: 286,
            prot: 6,
            carb: 62,
            fat: 1,
          },
          {
            id: 'aove',
            nombre: 'Aceite de oliva virgen extra',
            gramos: 15,
            medida: '1 cucharada y media',
            kcal: 135,
            prot: 0,
            carb: 0,
            fat: 15,
          },
          {
            id: 'ensalada_mixta',
            nombre: 'Ensalada de hoja verde y tomate',
            gramos: 150,
            medida: '1 bol',
            kcal: 30,
            prot: 2,
            carb: 4,
            fat: 0,
          },
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
          {
            id: 'yogur_natural',
            nombre: 'Yogur natural',
            gramos: 250,
            medida: '2 unidades',
            kcal: 155,
            prot: 10,
            carb: 12,
            fat: 8,
          },
          {
            id: 'platano',
            nombre: 'Plátano',
            gramos: 120,
            medida: '1 unidad mediana',
            kcal: 107,
            prot: 1,
            carb: 25,
            fat: 0,
          },
          {
            id: 'pan_integral',
            nombre: 'Pan integral',
            gramos: 60,
            medida: '2 rebanadas',
            kcal: 147,
            prot: 6,
            carb: 27,
            fat: 2,
          },
        ],
        totales: { kcal: 409, prot: 17, carb: 64, fat: 10 },
        alternativas: [
          'Cambia el plátano por 200 g de manzana',
          'Cambia el yogur por 200 g de queso fresco batido',
        ],
      },
      {
        comida: 'Cena',
        hora: '21:00',
        peri: false,
        objetivo: { kcal: 640, prot: 55, carb: 60, fat: 20 },
        alimentos: [
          {
            id: 'salmon',
            nombre: 'Salmón fresco',
            gramos: 180,
            medida: '1 lomo',
            kcal: 373,
            prot: 36,
            carb: 0,
            fat: 25,
          },
          {
            id: 'patata',
            nombre: 'Patata cocida',
            gramos: 300,
            medida: '2 patatas medianas',
            kcal: 261,
            prot: 6,
            carb: 60,
            fat: 0,
          },
          {
            id: 'brocoli',
            nombre: 'Brócoli al vapor',
            gramos: 200,
            medida: '1 plato',
            kcal: 68,
            prot: 6,
            carb: 7,
            fat: 1,
          },
        ],
        totales: { kcal: 702, prot: 48, carb: 67, fat: 26 },
        alternativas: [
          'Cambia el salmón por 220 g de lomo de bacalao y 15 g de aceite',
          'Cambia la patata por 250 g de boniato',
        ],
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
  equivalencias: equivalencias('omnivoro'),
  compra: COMPRA_A,
  modo_sencillo: false,
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
  preferencia_base: 'vegetariano',
  restricciones: ['sin_lactosa'],
  low_carb: false,
  n_comidas: 2,
  clima_caluroso: false,
  embarazo_lactancia: false,
  condiciones: ['tiroides'],
  cribado_tca: 'negativo',
  fecha_inicio: '2026-09-07',
}

/** Proyección plana del caso B (sin cronograma): 13 puntos, banda de +-1 kg (SPEC Paso 14b). */
const PROYECCION_B: PuntoProyeccion[] = [
  { semana: 0, peso_min: 58.4, peso_esp: 58.4, peso_max: 58.4 },
  { semana: 1, peso_min: 57.4, peso_esp: 58.4, peso_max: 59.4 },
  { semana: 2, peso_min: 57.4, peso_esp: 58.4, peso_max: 59.4 },
  { semana: 3, peso_min: 57.4, peso_esp: 58.4, peso_max: 59.4 },
  { semana: 4, peso_min: 57.4, peso_esp: 58.4, peso_max: 59.4 },
  { semana: 5, peso_min: 57.4, peso_esp: 58.4, peso_max: 59.4 },
  { semana: 6, peso_min: 57.4, peso_esp: 58.4, peso_max: 59.4 },
  { semana: 7, peso_min: 57.4, peso_esp: 58.4, peso_max: 59.4 },
  { semana: 8, peso_min: 57.4, peso_esp: 58.4, peso_max: 59.4 },
  { semana: 9, peso_min: 57.4, peso_esp: 58.4, peso_max: 59.4 },
  { semana: 10, peso_min: 57.4, peso_esp: 58.4, peso_max: 59.4 },
  { semana: 11, peso_min: 57.4, peso_esp: 58.4, peso_max: 59.4 },
  { semana: 12, peso_min: 57.4, peso_esp: 58.4, peso_max: 59.4 },
]

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
  bmr: {
    valor: 1145,
    ecuacion: 'mifflin',
    referencias: { mifflin: 1145, katch: 1187.5, harris: 1198.2 },
  },
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
    pct_cap: 0.35,
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
    {
      nombre: 'Comida',
      hora: '14:00',
      pct_kcal: 55,
      proteina_g: 50,
      grasa_g: 30,
      hc_g: 80,
      kcal: 840,
      peri: false,
    },
    {
      nombre: 'Cena',
      hora: '21:00',
      pct_kcal: 45,
      proteina_g: 40,
      grasa_g: 25,
      hc_g: 65,
      kcal: 680,
      peri: false,
    },
  ],
  avisos: ['WARN_TIROIDES', 'INFO_SIN_CRONOGRAMA', 'INFO_AGUA_MAYORES', 'INFO_PROYECCION_PLANA'],
  // ---------- v1.1 ----------
  preferencia_base: 'vegetariano',
  restricciones: ['sin_lactosa'],
  low_carb: false,
  proyeccion: PROYECCION_B,
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
  {
    codigo: 'INFO_PROYECCION_PLANA',
    severidad: 'info',
    titulo: 'Sin curva de peso',
    texto:
      'Con este objetivo no proyectamos una curva de peso: lo que esperamos es que tu peso se mantenga, con la ' +
      'oscilación normal de un kilo arriba o abajo por agua, sal e intestino. Lo que sí debería cambiar es cómo ' +
      'te queda la ropa, las medidas y las cargas del entrenamiento.',
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
          {
            id: 'lentejas_cocidas',
            nombre: 'Lentejas cocidas',
            gramos: 300,
            medida: '1 plato hondo',
            kcal: 348,
            prot: 26,
            carb: 51,
            fat: 1,
          },
          {
            id: 'tofu_firme',
            nombre: 'Tofu firme',
            gramos: 150,
            medida: '1 taco grande',
            kcal: 218,
            prot: 24,
            carb: 3,
            fat: 13,
          },
          {
            id: 'aove',
            nombre: 'Aceite de oliva virgen extra',
            gramos: 15,
            medida: '1 cucharada y media',
            kcal: 135,
            prot: 0,
            carb: 0,
            fat: 15,
          },
          {
            id: 'pan_integral',
            nombre: 'Pan integral',
            gramos: 50,
            medida: '2 rebanadas finas',
            kcal: 123,
            prot: 5,
            carb: 23,
            fat: 1,
          },
        ],
        totales: { kcal: 824, prot: 55, carb: 77, fat: 30 },
        alternativas: [
          'Cambia el tofu por 150 g de tempeh',
          'Cambia las lentejas por 300 g de garbanzos cocidos',
        ],
      },
      {
        comida: 'Cena',
        hora: '21:00',
        peri: false,
        objetivo: { kcal: 680, prot: 40, carb: 65, fat: 25 },
        alimentos: [
          {
            id: 'huevo',
            nombre: 'Huevo',
            gramos: 120,
            medida: '2 unidades',
            kcal: 172,
            prot: 15,
            carb: 1,
            fat: 12,
          },
          {
            id: 'queso_fresco',
            nombre: 'Queso fresco batido',
            gramos: 250,
            medida: '1 tarrina',
            kcal: 175,
            prot: 20,
            carb: 10,
            fat: 5,
          },
          {
            id: 'patata',
            nombre: 'Patata cocida',
            gramos: 250,
            medida: '2 patatas pequeñas',
            kcal: 218,
            prot: 5,
            carb: 50,
            fat: 0,
          },
          {
            id: 'verdura_salteada',
            nombre: 'Verdura salteada con 5 g de aceite',
            gramos: 200,
            medida: '1 plato',
            kcal: 90,
            prot: 3,
            carb: 8,
            fat: 5,
          },
        ],
        totales: { kcal: 655, prot: 43, carb: 69, fat: 22 },
        alternativas: [
          'Cambia el huevo por 120 g de tofu',
          'Cambia la patata por 200 g de arroz cocido',
        ],
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
  equivalencias: equivalencias('sin_lactosa'),
  compra: COMPRA_B,
  modo_sencillo: true,
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

// =====================================================================
// Muestra C — plan ajustado a mano (v1.1, decisión B) con seguimiento de pesajes.
// Parte del caso A: el usuario ha bajado a 2.000 kcal y a 120 g de hidratos (por debajo del
// mínimo de 130 g del motor, así que aparece WARN_HC_BAJO_MINIMO). La proteína no se toca y la
// grasa absorbe el resto: (2.000 - 4*185 - 4*120) / 9 = 86,7 -> 85 g redondeando a 5.
// =====================================================================

const AVISOS_C: AvisoTexto[] = [
  ...AVISOS_A,
  {
    codigo: 'WARN_HC_BAJO_MINIMO',
    severidad: 'warn',
    titulo: 'Hidratos por debajo del mínimo',
    texto:
      'Has bajado los hidratos por debajo de los 130 g que usamos como mínimo de referencia. No es peligroso a ' +
      'corto plazo y hay gente que se encuentra mejor así, pero cuenta con dos cosas: entrenar fuerte cuesta más ' +
      'y la fibra es más difícil de cubrir. Si te notas sin energía, con mal descanso o con estreñimiento, ' +
      'súbelos otra vez.',
  },
  {
    codigo: 'INFO_AJUSTE_MANUAL',
    severidad: 'info',
    titulo: 'Has ajustado tu plan',
    texto:
      'Has ajustado a mano las calorías o los hidratos, así que estos ya no son los números que te propusimos. ' +
      'Hemos recalculado con tu ajuste la grasa, el reparto por comidas, el menú, la lista de la compra y el ' +
      'calendario. La proteína no la tocamos: es la que protege tu músculo cuando comes menos. Puedes volver a ' +
      'lo recomendado cuando quieras.',
  },
]

const RESULTADO_C: Resultado = {
  ...RESULTADO_A,
  kcal: 2000,
  kcal_cierre: 1985,
  macros: {
    ...RESULTADO_A.macros,
    grasa_g: 85,
    hc_g: 120,
    fibra_g: 28,
    pct: { p: 0.3728, g: 0.3854, hc: 0.2418 },
    gkg: { p: 2.2023809523809526, g: 1.0119047619047619, hc: 1.4285714285714286 },
  },
  comidas: [
    {
      nombre: 'Desayuno',
      hora: '08:00',
      pct_kcal: 25,
      proteina_g: 46,
      grasa_g: 21,
      hc_g: 30,
      kcal: 496,
      peri: false,
    },
    {
      nombre: 'Comida',
      hora: '14:00',
      pct_kcal: 30,
      proteina_g: 56,
      grasa_g: 26,
      hc_g: 36,
      kcal: 602,
      peri: false,
    },
    {
      nombre: 'Merienda',
      hora: '17:30',
      pct_kcal: 15,
      proteina_g: 28,
      grasa_g: 13,
      hc_g: 18,
      kcal: 301,
      peri: true,
    },
    {
      nombre: 'Cena',
      hora: '21:00',
      pct_kcal: 30,
      proteina_g: 55,
      grasa_g: 25,
      hc_g: 36,
      kcal: 589,
      peri: false,
    },
  ],
  avisos: [...RESULTADO_A.avisos, 'WARN_HC_BAJO_MINIMO', 'INFO_AJUSTE_MANUAL'],
  ajuste: { kcal: true, hc: true },
}

/**
 * Pesajes de ejemplo. El último (semana 4, 83,0 kg) queda por encima de `peso_max` de esa semana
 * (82,6 kg), así que la frase de balance es la de "por detrás" de §2.6c.
 */
const PESAJES_C: Pesaje[] = [
  { fecha: '2026-09-07', kg: 84 },
  { fecha: '2026-09-21', kg: 83.6 },
  { fecha: '2026-10-05', kg: 83 },
]

/** Muestra con plan ajustado a mano y con pesajes registrados (§4.3 y §4.5b). */
export const MUESTRA_AJUSTADA: DatosPdf = {
  inputs: INPUTS_A,
  resultado: RESULTADO_C,
  ejemplos: EJEMPLOS_A,
  avisos: AVISOS_C,
  fecha: '2026-10-05',
  pesajes: PESAJES_C,
}

// =====================================================================
// Muestra D — mujer con regla irregular (v1.1, decisión D): tarjeta "Tu ciclo y tu plan",
// aviso de seguridad y proyección plana con pesajes dentro de la banda.
// =====================================================================

/** Texto íntegro de `INFO_CICLO`. Lo comparten las muestras con regla (D, E y F). */
const AVISO_CICLO: AvisoTexto = {
  codigo: 'INFO_CICLO',
  severidad: 'info',
  titulo: 'Tu ciclo y tu plan',
  texto:
    'Tu gasto energético cambia poco a lo largo del ciclo, así que no ajustamos tus calorías por eso. Lo que sí ' +
    'cambia es lo que marca la báscula: la semana antes de la regla es normal retener 1-2 kg de agua y tener ' +
    'más hambre (unas 100-300 kcal). Pésate siempre en la misma fase del ciclo si quieres comparar, no te ' +
    'asustes con el peso de esa semana, y si comes 100-200 kcal más esos días, compénsalo en el resto de la ' +
    'semana sin cambiar el total. En los días de regla, cuida el hierro: carne roja, legumbre o verdura de ' +
    'hoja acompañadas de algo de vitamina C.',
}

const AVISOS_D: AvisoTexto[] = [
  ...AVISOS_B.filter((a) => a.codigo !== 'INFO_AGUA_MAYORES'),
  {
    codigo: 'WARN_CICLO_AUSENTE',
    severidad: 'warn',
    titulo: 'Tu regla es una señal',
    texto:
      'Nos has dicho que tu regla es irregular o que no la tienes, y a la vez tu plan lleva déficit, poca grasa ' +
      'corporal o un ritmo rápido. Esa combinación puede indicar baja disponibilidad energética (lo que se llama ' +
      'RED-S): comer por debajo de lo que gastas durante meses altera las hormonas, el hueso y el propio ciclo. ' +
      'Si llevas tres meses o más sin regla y no es por anticonceptivos ni por la menopausia, pide cita con tu ' +
      'médico antes de seguir con el déficit.',
  },
  AVISO_CICLO,
]

const INPUTS_D: Inputs = { ...INPUTS_B, edad: 41, menstruacion: 'irregular' }

const RESULTADO_D: Resultado = {
  ...RESULTADO_B,
  avisos: [
    ...RESULTADO_B.avisos.filter((c) => c !== 'INFO_AGUA_MAYORES'),
    'WARN_CICLO_AUSENTE',
    'INFO_CICLO',
  ],
}

/** Dos pesajes dentro de la banda plana: la frase de balance es la de "en la banda". */
const PESAJES_D: Pesaje[] = [
  { fecha: '2026-09-07', kg: 58.4 },
  { fecha: '2026-10-05', kg: 58.1 },
]

/** Muestra con tarjeta de ciclo, aviso de seguridad, proyección plana y pesajes. */
export const MUESTRA_CICLO: DatosPdf = {
  inputs: INPUTS_D,
  resultado: RESULTADO_D,
  ejemplos: EJEMPLOS_B,
  avisos: AVISOS_D,
  fecha: '2026-10-05',
  pesajes: PESAJES_D,
}

// =====================================================================
// Muestra E — recomposición con déficit real (v1.2, decisión H): mujer de 165 cm y 68 kg con
// prioridad "perder". Tiene peso objetivo (63 kg) y proyección de banda, pero NO tiene cronograma:
// en recomposición no se promete fecha. Sigue la forma del vector 17 de SPEC-calculo.md §5.
// =====================================================================

const INPUTS_E: Inputs = {
  ...INPUTS_B,
  edad: 39,
  altura_cm: 165,
  peso_kg: 68,
  actividad_diaria: 'ligero',
  entrenamiento: {
    tipo: 'fuerza',
    dias_semana: 3,
    minutos_sesion: 50,
    intensidad: 'media',
    experiencia: 'novato',
    momento: 'tarde',
  },
  objetivo: 'recomposicion',
  recomposicion_prioridad: 'perder',
  peso_objetivo: 63,
  menstruacion: 'regular',
  condiciones: [],
}

/**
 * Proyección de recomposición (SPEC Paso 14): `peso_max` es siempre el peso de hoy, `peso_min` es
 * la curva del déficit (0,265 kg/sem) acotada por la meta y `peso_esp`, el punto medio.
 */
const PROYECCION_E: PuntoProyeccion[] = Array.from({ length: 20 }, (_, semana) => {
  const rapido = Math.min(0.265 * semana, 5)
  const redondea = (v: number) => Math.round(v * 10) / 10
  return {
    semana,
    peso_min: redondea(68 - rapido),
    peso_esp: redondea((68 - rapido + 68) / 2),
    peso_max: 68,
  }
})

const RESULTADO_E: Resultado = {
  ...RESULTADO_B,
  imc: 24.977043158861342,
  imc_categoria: 'normal',
  objetivo_efectivo: 'recomposicion',
  recomposicion_prioridad: 'perder',
  ritmo_efectivo: 'suave',
  kcal: 1750,
  kcal_cierre: 1750,
  peso_objetivo: {
    ...RESULTADO_B.peso_objetivo,
    efectivo: 63,
    sugerido: 62.5,
    mostrar_central: true,
    rango: [59.5, 65.5],
    metodo: 'grasa',
    hito_intermedio: null,
  },
  cronograma: null,
  proyeccion: PROYECCION_E,
  avisos: [
    'INFO_CICLO',
    'INFO_RECOMP_PRIORIDAD_PERDER',
    'INFO_SIN_CRONOGRAMA',
    'INFO_PROYECCION_RECOMP',
  ],
}

const AVISOS_E: AvisoTexto[] = [
  AVISO_CICLO,
  {
    codigo: 'INFO_RECOMP_PRIORIDAD_PERDER',
    severidad: 'info',
    titulo: 'Hemos inclinado tu recomposición',
    texto:
      'Nos has dicho que ahora te importa más perder grasa, así que bajamos algo las calorías y te subimos la ' +
      'grasa a costa de los hidratos. Sigue siendo un proceso lento: la báscula se mueve poco aunque tu cuerpo ' +
      'cambie.',
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
    codigo: 'INFO_PROYECCION_RECOMP',
    severidad: 'info',
    titulo: 'Tu proyección en recomposición',
    texto:
      'En recomposición la báscula baja mucho más despacio de lo que cambia tu cuerpo: puedes perder grasa y ' +
      'ganar músculo a la vez y quedarte casi en el mismo peso. Por eso no te damos una fecha, sino una banda: ' +
      'por abajo, lo que bajarías si todo lo que pierdes fuese grasa; por arriba, quedarte en el peso de hoy ' +
      'porque el músculo lo compensa. Las dos cosas serían un buen resultado. Mídete también la cintura y hazte ' +
      'fotos cada cuatro semanas: ahí se ve lo que la báscula no enseña.',
  },
]

/** Muestra de recomposición con meta: banda honesta, sin fechas y con el peso objetivo orientativo. */
export const MUESTRA_RECOMPOSICION: DatosPdf = {
  inputs: INPUTS_E,
  resultado: RESULTADO_E,
  ejemplos: EJEMPLOS_B,
  avisos: AVISOS_E,
  fecha: '2026-09-07',
}

// =====================================================================
// Muestra F — regla con tres síntomas marcados (v1.2, decisión I): la tarjeta del ciclo crece con
// un bloque por síntoma, el generador sugiere alimentos para esos días y la lista de la compra
// gana su sección opcional.
// =====================================================================

const CICLO_F: ResultadoCiclo = {
  sintomas: ['dolor', 'cansancio', 'sangrado_abundante'],
  consejos: [
    {
      clave: 'dolor',
      titulo: 'Dolor: omega-3, magnesio y calor',
      texto:
        'El dolor de regla viene en buena parte de unas sustancias inflamatorias, las prostaglandinas. El ' +
        'omega-3 del pescado azul y de los frutos secos y el magnesio de la legumbre y del cacao puro pueden ' +
        'bajarlo algo, y el calor local y el movimiento suave ayudan tanto como muchos remedios. Si el dolor te ' +
        'impide hacer vida normal, eso no es normal: pide cita.',
      alimentos: ['Sardinas en aceite de oliva (lata, escurridas)', 'Nueces', 'Lentejas (cocidas)'],
    },
    {
      clave: 'cansancio',
      titulo: 'Cansancio: sueño, hierro e hidratos',
      texto:
        'Esos días el cansancio suele ser sueño de menos y hierro de menos, no falta de voluntad. Duerme lo que ' +
        'puedas, cuida el hierro y no bajes demasiado los hidratos esa semana: son la energía más barata que ' +
        'tienes.',
      alimentos: ['Espinacas', 'Lentejas (cocidas)'],
    },
    {
      clave: 'sangrado_abundante',
      titulo: 'Sangrado abundante: hierro con vitamina C',
      texto:
        'Con sangrado abundante se pierde hierro de verdad. Acompaña la legumbre, la carne roja magra o los ' +
        'mejillones con algo de vitamina C (pimiento, tomate, cítricos) y deja el café y el té para otro momento ' +
        'del día, porque estorban su absorción. Si además te notas cansada, pídele a tu médico una ferritina en ' +
        'la próxima analítica.',
      alimentos: ['Mejillones al natural (lata, escurridos)', 'Lentejas (cocidas)', 'Espinacas'],
    },
  ],
}

const OPCIONAL_CICLO_F: SeccionOpcionalCompra = {
  titulo: 'Para los días de regla (opcional)',
  nota: 'No entra en las cantidades del plan: son compras pequeñas para esos días, si te apetecen.',
  items: [
    {
      alimento_id: 'mejillones_lata',
      nombre: 'Mejillones al natural (lata, escurridos)',
      producto: 'Mejillones al natural Hacendado, pack de 3 latas',
      seccion: 'despensa',
      conservacion: 'despensa',
      gramos_dia: 70,
      gramos_semana: 210,
      envase_g: 210,
      envase_descripcion: 'pack de 3 latas ≈ 70 g escurridos cada una',
      envases: 1,
      dura_dias: 3,
      consejo: 'Escúrrelos bien y añádeles limón: llevan bastante hierro.',
    },
    {
      alimento_id: 'cacao_puro',
      nombre: 'Cacao puro desgrasado en polvo',
      producto: 'Cacao puro desgrasado en polvo Hacendado',
      seccion: 'despensa',
      conservacion: 'despensa',
      gramos_dia: 10,
      gramos_semana: 30,
      envase_g: 250,
      envase_descripcion: 'bote 250 g',
      envases: 1,
      dura_dias: 25,
      consejo: 'Que sea cacao puro, no soluble: el soluble es azúcar en su mayor parte.',
    },
  ],
}

const COMPRA_F: ListaCompra = { ...COMPRA_B, opcional_ciclo: OPCIONAL_CICLO_F }

const EJEMPLOS_F: Ejemplos = {
  ...EJEMPLOS_B,
  compra: COMPRA_F,
  alimentos_ciclo: [
    {
      id: 'mejillones_lata',
      nombre: 'Mejillones al natural (lata, escurridos)',
      por_que: 'hierro, para el sangrado abundante',
    },
    {
      id: 'espinacas',
      nombre: 'Espinacas',
      por_que: 'hierro vegetal, mejor con algo de vitamina C',
    },
    {
      id: 'cacao_puro',
      nombre: 'Cacao puro desgrasado en polvo',
      por_que: 'magnesio, para el dolor',
    },
  ],
}

const INPUTS_F: Inputs = {
  ...INPUTS_D,
  menstruacion: 'regular',
  sintomas_regla: ['dolor', 'cansancio', 'sangrado_abundante'],
}

const RESULTADO_F: Resultado = {
  ...RESULTADO_B,
  avisos: [...RESULTADO_B.avisos.filter((c) => c !== 'INFO_AGUA_MAYORES'), 'INFO_CICLO'],
  ciclo: CICLO_F,
}

/** Muestra con tres síntomas de regla: tarjeta ampliada, alimentos sugeridos y sección opcional. */
export const MUESTRA_CICLO_SINTOMAS: DatosPdf = {
  inputs: INPUTS_F,
  resultado: RESULTADO_F,
  ejemplos: EJEMPLOS_F,
  avisos: [...AVISOS_B.filter((a) => a.codigo !== 'INFO_AGUA_MAYORES'), AVISO_CICLO],
  fecha: '2026-09-07',
}

// =====================================================================
// Muestra G — alimentos excluidos y favoritos (decisión G) con plazo irreal (decisión H): el
// usuario pidió llegar en 8 semanas, el motor aplicó el ritmo agresivo y avisa de que no llega.
// =====================================================================

const INPUTS_G: Inputs = {
  ...INPUTS_A,
  peso_objetivo: 74.5,
  ritmo: 'suave',
  plazo_semanas: 8,
  alimentos_excluidos: ['brocoli', 'coliflor'],
  alimentos_favoritos: ['pechuga_pollo', 'arroz_blanco_cocido'],
}

const RESULTADO_G: Resultado = {
  ...RESULTADO_A,
  ritmo_efectivo: 'agresivo',
  avisos: [...RESULTADO_A.avisos, 'WARN_PLAZO_IRREAL'],
}

const EJEMPLOS_G: Ejemplos = {
  ...EJEMPLOS_A,
  avisos_menu: [
    'No hemos podido evitar el brócoli en la cena: era el único que cuadraba con tus macros.',
  ],
}

const AVISOS_G: AvisoTexto[] = [
  ...AVISOS_A,
  {
    codigo: 'WARN_PLAZO_IRREAL',
    severidad: 'warn',
    titulo: 'Esa fecha no nos sale',
    texto:
      'Para llegar a tu peso objetivo en 8 semanas harían falta 1,2 kg por semana, y eso no lo podemos ' +
      'recomendar: se pierde músculo y se recupera casi todo. Hemos aplicado el ritmo más rápido que ' +
      'consideramos seguro; con él llegarías hacia la semana 19.',
  },
]

/** Muestra con alimentos excluidos, favoritos, aviso del generador y plazo que no se puede cumplir. */
export const MUESTRA_ALIMENTOS: DatosPdf = {
  inputs: INPUTS_G,
  resultado: RESULTADO_G,
  ejemplos: EJEMPLOS_G,
  avisos: AVISOS_G,
  fecha: '2026-09-07',
}
