// Verificador / implementacion de referencia de docs/SPEC-calculo.md (v1.2, decisiones G-J 2026-09-08).
// Implementacion LITERAL de la spec: pasos 0-19, tablas 3.x, avisos §4, reglas de supresion.
// v1.1: prioridad de recomposicion (C), regla (D), preferencias combinables (E), proyeccion (F)
// y ajuste manual `ajustarMacros` (B, paso 18).
// v1.2: plazo -> ritmo discreto (paso 6.7ter), peso objetivo y proyeccion de la recomposicion
// con deficit (pasos 13 y 14), consejos por sintomas de la regla (paso 19) y los tres campos
// que el motor IGNORA (`menu_sencillo`, `alimentos_excluidos`, `alimentos_favoritos`).
//
//   node docs/verify-vectors.mjs            -> vectores §5 + barrido de invariantes
//   node docs/verify-vectors.mjs --json 1   -> Resultado completo del Caso 1 en JSON
//   node docs/verify-vectors.mjs --json 17  -> idem para cualquier caso 1..19

// ---------------------------------------------------------------- helpers §0.1
const round1  = (x) => Math.round(x * 10) / 10;
const round05 = (x) => Math.round(x * 2) / 2;
const round5  = (x) => 5  * Math.round(x / 5);
const round10 = (x) => 10 * Math.round(x / 10);
const round50 = (x) => 50 * Math.round(x / 50);
const clamp   = (x, lo, hi) => Math.min(Math.max(x, lo), hi);
const roundUp10   = (x) => 10 * Math.ceil(x / 10);
const roundDown5  = (x) => 5  * Math.floor(x / 5);
const roundUp5    = (x) => 5  * Math.ceil(x / 5);
const roundUp05   = (x) => Math.ceil(x * 2) / 2;
const roundDown05 = (x) => Math.floor(x * 2) / 2;
const log10 = Math.log10;

// ---------------------------------------------------------------- tablas §3
const PAL_T = { sedentario:1.40, ligero:1.50, moderado:1.60, alto:1.75, muy_alto:1.90 };
const MET_T = {
  fuerza: { baja:3.5, media:5.0, alta:6.0 },
  cardio: { baja:4.5, media:7.0, alta:9.5 },
  mixto:  { baja:4.0, media:6.0, alta:8.0 },
  ninguno:{ baja:0,   media:0,   alta:0 },
};
const RITMO_T = {
  muy_alto: { suave:0.50, moderado:0.75, agresivo:1.00 },
  alto:     { suave:0.40, moderado:0.60, agresivo:0.80 },
  medio:    { suave:0.30, moderado:0.40, agresivo:0.50 },
};
const SUP_T = {
  novato:     { suave:0.10, moderado:0.15, agresivo:0.20 },
  intermedio: { suave:0.05, moderado:0.10, agresivo:0.125 },
  avanzado:   { suave:0.05, moderado:0.075, agresivo:0.10 },
};
const RECOMP_T = { muy_alto:0.10, alto:0.10, medio:0.075, bajo:0.05, muy_bajo:0.0 };
const PROT_T = {
  sedentario: { perder:1.5, recomposicion:1.5, mantener:1.2, ganar:1.4 },
  cardio:     { perder:1.8, recomposicion:1.8, mantener:1.6, ganar:1.6 },
  fuerza:     { perder:2.2, recomposicion:2.0, mantener:1.7, ganar:1.8 },
};
const VISUAL_H = { muy_definido:10.0, definido:15.5, medio:21.0, sobrepeso_visible:28.0, obesidad_visible:36.0 };
const VISUAL_M = { muy_definida:17.0, tonificada:22.5, media:28.0, sobrepeso_visible:35.0, obesidad_visible:43.0 };
const HORAS = { 'Desayuno':'08:00', 'Media manana':'11:00', 'Comida':'14:00', 'Merienda':'17:30', 'Cena':'21:00', 'Recena':'23:00' };
const REPARTO = {
  2: { nombres:['Comida','Cena'], p:[45,55] },
  3: { nombres:['Desayuno','Comida','Cena'], p:[30,35,35] },
  4: { nombres:['Desayuno','Comida','Merienda','Cena'], p:[25,30,15,30] },
  5: { nombres:['Desayuno','Media manana','Comida','Merienda','Cena'], p:[20,10,30,10,30] },
  6: { nombres:['Desayuno','Media manana','Comida','Merienda','Cena','Recena'], p:[15,10,25,10,25,15] },
};
const PERI = {
  2:{manana:0,mediodia:0,tarde:1,noche:1},
  3:{manana:0,mediodia:1,tarde:2,noche:2},
  4:{manana:0,mediodia:1,tarde:2,noche:3},
  5:{manana:0,mediodia:2,tarde:3,noche:4},
  6:{manana:0,mediodia:2,tarde:3,noche:5},
};

// reglas de supresion de avisos (§ paso 6)
const CRONO_CORTE = ['INFO_SIN_CRONOGRAMA','INFO_SIN_CRONOGRAMA_SIN_MARGEN','INFO_CRONOGRAMA_NO_ESTIMABLE','INFO_CRONOGRAMA_FUERA_DE_HORIZONTE'];
const TCA_OCULTOS = ['INFO_GRASA_ESTIMADA','INFO_PESO_YA_MINIMO','INFO_IMC_MUSCULADO','INFO_ADAPTACION',
  'WARN_YA_MAGRO','WARN_YA_EN_OBJETIVO','WARN_OBJETIVO_MUY_LEJANO','WARN_CRONOGRAMA_LARGO',
  'INFO_SIN_CRONOGRAMA','INFO_SIN_CRONOGRAMA_SIN_MARGEN','INFO_CRONOGRAMA_NO_ESTIMABLE','INFO_CRONOGRAMA_FUERA_DE_HORIZONTE',
  'INFO_PROYECCION_PLANA','INFO_PROYECCION_RECOMP','INFO_RITMO_POR_PLAZO','WARN_PLAZO_IRREAL'];
// familia del cronograma: el paso 18 la retira entera y la vuelve a emitir con las kcal ajustadas
const CRONO_FAMILIA = ['INFO_ADAPTACION','WARN_CRONOGRAMA_LARGO', ...CRONO_CORTE,
  'INFO_PROYECCION_PLANA','INFO_PROYECCION_RECOMP'];
const SUPRESION = [
  ['WARN_KCAL_AJUSTE_ALTA', ['WARN_DEFICIT_MINIMO']],
  ['INFO_OBJETIVO_IGNORADO', ['WARN_OBJETIVO_INCOHERENTE']],
  ['WARN_IMC_BAJO_NO_DEFICIT', ['WARN_YA_MAGRO']],
  ['WARN_YA_EN_OBJETIVO', ['WARN_YA_MAGRO']],
  ['WARN_RENAL', ['INFO_MAYOR_60','INFO_PROTEINA_CAPADA']],
  ['WARN_SIN_MARGEN_DEFICIT', ['WARN_DEFICIT_MINIMO','INFO_DEFICIT_CAPADO_TDEE','WARN_YA_MAGRO','WARN_RECOMPOSICION_SUGERIDA','WARN_RECOMPOSICION_SIN_FUERZA']],
  ['INFO_OBJETIVO_RESUELTO_POR_PESO', ['INFO_OBJETIVO_IGNORADO']],
  ['INFO_AGUA_NO_PRESCRITA', ['WARN_AGUA_ALTA','INFO_AGUA_MAYORES']],
  ...CRONO_CORTE.map((c) => [c, ['INFO_ADAPTACION','WARN_CRONOGRAMA_LARGO']]),
  // v1.2: las dos proyecciones sin cronograma son excluyentes, y el plazo no promete nada
  // cuando el plan ya no es de perder/ganar (lo retira el paso 17).
  ['INFO_PROYECCION_RECOMP', ['INFO_PROYECCION_PLANA']],
  ['WARN_PLAZO_IRREAL', ['INFO_RITMO_POR_PLAZO']],
];

// ---------------------------------------------------------------- Paso 19 — ciclo (v1.2)
// OJO: como todo este fichero, los textos van SIN ACENTOS (ASCII). El copy normativo, con
// acentos y tal y como se imprime, es el de la §4 / Paso 19 del documento; aqui solo importa
// la ESTRUCTURA (que consejo, en que orden, con que fragmentos condicionales y que alimentos).
// Copy literal de la §4 / Paso 19. `alimentos` va por base dietetica; las dos unicas
// sustituciones por restriccion son la avena (sin gluten) y el yogur griego (sin lactosa).
const SINTOMAS_ORDEN = ['dolor','hinchazon','antojos','cansancio','sangrado_abundante'];
const CONSEJOS_CICLO = {
  dolor: {
    titulo: 'Dolor: omega-3, magnesio y calor',
    texto: 'El dolor de regla lo producen las prostaglandinas, y el omega-3 compite con ellas: en los ensayos, 1-2 g al dia durante dos o tres ciclos reducen el dolor y la necesidad de analgesicos. Es lento, no notaras nada el primer mes. El magnesio tiene evidencia mas floja, pero por comida es barato y seguro. A corto plazo lo que mejor funciona sigue siendo el calor local y el movimiento suave. Si el dolor te impide hacer vida normal, eso no es normal: consultalo.',
    alimentos: {
      omnivoro:    ['Pescado azul (salmon, sardinas en lata)', 'Nueces', 'Semillas de lino molidas', 'Cacao puro'],
      vegetariano: ['Nueces', 'Semillas de lino molidas', 'Semillas de chia', 'Cacao puro'],
      vegano:      ['Nueces', 'Semillas de lino molidas', 'Semillas de chia', 'Cacao puro'],
    },
  },
  hinchazon: {
    titulo: 'Hinchazon: es agua, no grasa',
    texto: 'Ese kilo o dos de mas de la semana antes es agua, y se va solo. No recortes calorias por eso: si bajas el plan cada vez que la bascula sube, acabas comiendo bastante menos de lo que necesitas. Lo que si ayuda es quitar sal de la que viene ya puesta (embutido, conservas, precocinados, pan de molde), beber lo mismo o mas —nunca menos— y llegar bien al potasio. Y pesate siempre el mismo dia de la semana y en la misma fase del ciclo, o estaras comparando dos cosas distintas.',
    alimentos: {
      omnivoro:    ['Platano', 'Patata cocida', 'Espinacas', 'Calabacin'],
      vegetariano: ['Platano', 'Patata cocida', 'Espinacas', 'Calabacin'],
      vegano:      ['Platano', 'Patata cocida', 'Espinacas', 'Calabacin'],
    },
  },
  antojos: {
    titulo: 'Mas hambre: cuenta con ella',
    texto: 'En la segunda mitad del ciclo el hambre sube de verdad: se han medido entre 100 y 300 kcal mas al dia. No es falta de fuerza de voluntad. Tienes dos formas de manejarlo y las dos valen: comer 100-200 kcal mas esos dias y compensarlas en el resto de la semana, o dejar el plan como esta y apoyarte en proteina y fibra, que son lo que mas sacia. Si te pide dulce, el cacao puro o una o dos onzas de chocolate del 85 % cunden mucho mas que una tableta con leche.',
    alimentos: {
      omnivoro:    ['Yogur griego 0%', 'Fruta (manzana, platano)', 'Cacao puro', 'Chocolate negro 85%'],
      vegetariano: ['Yogur griego 0%', 'Fruta (manzana, platano)', 'Cacao puro', 'Chocolate negro 85%'],
      vegano:      ['Yogur de soja alto en proteina', 'Fruta (manzana, platano)', 'Cacao puro', 'Almendras'],
    },
  },
  cansancio: {
    titulo: 'Cansancio: duerme y no bajes los hidratos',
    texto: 'El cansancio de esos dias suele ser una mezcla de dormir peor, hierro justo y menos energia disponible. Lo primero es dormir: es la palanca mas grande y la mas aburrida. Lo segundo, no recortar hidratos justo esa semana: son el combustible del entrenamiento y del animo.{lc} Si el cansancio dura bastante mas que la regla, mira el hierro con tu medico.',
    lc: ' Como llevas un plan bajo en hidratos, subelos un poco esos dias —una racion mas de fruta o de tuberculo— y vuelve a tu plan despues.',
    alimentos: {
      omnivoro:    ['Avena', 'Patata cocida', 'Lentejas o garbanzos', 'Fruta'],
      vegetariano: ['Avena', 'Patata cocida', 'Lentejas o garbanzos', 'Fruta'],
      vegano:      ['Avena', 'Patata cocida', 'Lentejas o garbanzos', 'Fruta'],
    },
  },
  sangrado_abundante: {
    titulo: 'Sangrado abundante: cuida el hierro',
    texto: 'Un sangrado abundante mes a mes es la causa mas frecuente de falta de hierro en mujeres. No cambiamos tus macros por esto: lo que cambia es que eliges dentro de ellos. Acompana el hierro con algo de vitamina C (naranja, kiwi, pimiento o tomate) y deja el cafe y el te para dos horas antes o despues de esa comida, porque reducen bastante lo que absorbes.{fe} ',
    fe: ' Si ademas te notas cansada, pide a tu medico una analitica con ferritina: es el dato que dice si tienes las reservas bajas, y un hemograma normal puede no verlo.',
    alimentos: {
      omnivoro:    ['Lentejas o garbanzos', 'Carne roja magra (ternera)', 'Mejillones o berberechos al natural', 'Espinacas'],
      vegetariano: ['Lentejas o garbanzos', 'Espinacas', 'Tofu', 'Almendras'],
      vegano:      ['Lentejas o garbanzos', 'Espinacas', 'Tofu', 'Almendras'],
    },
  },
};
/**
 * Ids de `foods.json` que respaldan cada nombre generico de la tabla de arriba (v1.2, §3.2b). Solo
 * sirven para retirar de la lista "Prioriza:" lo que el usuario ha marcado como "no me gusta": un
 * nombre se queda mientras le quede un id sin excluir, y el que no este aqui no se retira nunca.
 */
const IDS_ALIMENTO_CONSEJO = {
  'Pescado azul (salmon, sardinas en lata)': ['salmon','sardinas_lata','salmon_ahumado'],
  'Nueces': ['nueces'],
  'Semillas de lino molidas': ['semillas_lino'],
  'Semillas de chia': ['semillas_chia'],
  'Cacao puro': ['cacao_puro'],
  'Platano': ['platano'],
  'Patata cocida': ['patata_cocida'],
  'Espinacas': ['espinacas'],
  'Calabacin': ['calabacin'],
  'Yogur griego 0%': ['yogur_griego_0'],
  'Yogur griego 0% sin lactosa': ['yogur_griego_0_sl'],
  'Yogur de soja alto en proteina': ['yogur_soja_proteico'],
  'Fruta (manzana, platano)': ['manzana','platano'],
  'Chocolate negro 85%': ['chocolate_85'],
  'Almendras': ['almendras'],
  'Avena': ['avena_copos'],
  'Lentejas o garbanzos': ['lentejas_cocidas','garbanzos_cocidos'],
  'Fruta': ['manzana','platano','naranja','kiwi','pera','mandarina'],
  'Carne roja magra (ternera)': ['ternera_solomillo'],
  'Mejillones o berberechos al natural': ['mejillones_lata'],
  'Tofu': ['tofu','tofu_firme'],
};

/**
 * Las dos unicas sustituciones por restriccion de la lista de alimentos (§4, Paso 19) y, desde la
 * v1.2, la retirada de los alimentos excluidos (§3.2b): la tarjeta no puede recomendar arriba lo
 * que la lista de la compra descarta abajo. Si la lista se queda vacia, el consejo se publica igual.
 */
function alimentosCiclo(clave, pref_base, restr, excluidos) {
  const fuera = new Set(Array.isArray(excluidos) ? excluidos : []);
  const lista = CONSEJOS_CICLO[clave].alimentos[pref_base];
  return lista
    .filter((n) => !(n === 'Avena' && restr.includes('sin_gluten')))
    .map((n) => (n === 'Yogur griego 0%' && restr.includes('sin_lactosa') ? 'Yogur griego 0% sin lactosa' : n))
    .filter((n) => {
      const ids = IDS_ALIMENTO_CONSEJO[n];
      return !ids || ids.some((id) => !fuera.has(id));
    });
}

/** Paso 19: `Resultado.ciclo`, o `undefined`. No cambia ningun numero del plan. */
function paso19(hayInfoCiclo, sintomas_in, pref_base, restr, low_carb, excluidos) {
  if (!hayInfoCiclo) return undefined;
  const marcados = Array.isArray(sintomas_in) ? sintomas_in : [];
  const sintomas = SINTOMAS_ORDEN.filter((s) => marcados.includes(s));
  if (sintomas.length === 0) return undefined;
  const consejos = sintomas.map((clave) => {
    const c = CONSEJOS_CICLO[clave];
    let texto = c.texto;
    if (clave === 'cansancio') texto = texto.replace('{lc}', low_carb ? c.lc : '');
    if (clave === 'sangrado_abundante') texto = texto.replace('{fe}', sintomas.includes('cansancio') ? c.fe : '').trim();
    return { clave, titulo: c.titulo, texto, alimentos: alimentosCiclo(clave, pref_base, restr, excluidos) };
  });
  return { sintomas, consejos };
}

// ---------------------------------------------------------------- proyeccion (Paso 14, F)
const SEM_PROYECCION_MAX = 26;      // tope duro de la curva con cronograma
const SEM_PROYECCION_PLANA = 12;    // semanas de la proyeccion plana (mantener / recomposicion)
const BANDA_PLANA_KG = 1;           // +-1 kg de oscilacion normal
const HC_MIN_AJUSTE = 30;           // suelo del deslizador de hidratos del paso 18 (§3.1)

/** Curva con banda, consistente por construccion con [semanas[0], semanas[1]] del cronograma. */
function proyeccionCurva(PC, gana, delta_kg, ritmo_kg_sem, factor_adapt, diet_breaks, sem_tope) {
  const S = Math.min(sem_tope, SEM_PROYECCION_MAX);
  const out = [];
  for (let s = 0; s <= S; s++) {
    // 1 semana a mantenimiento por cada 8 de dieta (MATADOR): 9 semanas de calendario por ciclo
    const descansos = diet_breaks > 0 ? Math.min(diet_breaks, Math.floor(s / 9)) : 0;
    const s_ef = Math.max(0, s - descansos);
    const f = 1 + 0.25 * Math.min(s_ef / 26, 2);                  // adaptacion CRECIENTE
    const rapido = Math.min(ritmo_kg_sem * s_ef, delta_kg);                          // regla lineal
    const lento  = Math.min(ritmo_kg_sem * s_ef / factor_adapt, delta_kg);           // adaptacion del cronograma
    const esp    = Math.min(ritmo_kg_sem * s_ef / Math.min(f, factor_adapt), delta_kg);
    out.push(gana
      ? { semana:s, peso_min:round1(PC + lento),  peso_esp:round1(PC + esp), peso_max:round1(PC + rapido) }
      : { semana:s, peso_min:round1(PC - rapido), peso_esp:round1(PC - esp), peso_max:round1(PC - lento) });
  }
  return out;
}

/**
 * Proyeccion de RECOMPOSICION CON DEFICIT REAL (v1.2, Paso 14). No hay cronograma —en
 * recomposicion no se promete fecha—, pero si hay deficit, y esconderlo con una banda plana de
 * +-1 kg era mentir en la direccion contraria: quien pide recomposicion con prioridad perder
 * lleva un deficit de verdad y ve una raya horizontal.
 *   borde inferior = la curva del deficit (la misma regla lineal de 7 700 kcal/kg que el
 *                    `peso_min` de `perder`), acotada por la meta;
 *   borde superior = el peso actual (todo lo que pierdes de grasa lo compensa el musculo);
 *   esperado       = el punto medio de los dos.
 */
function proyeccionRecomp(PC, delta_kg, ritmo_kg_sem) {
  const sem_lineal = delta_kg / ritmo_kg_sem;
  // al menos 12 semanas para que existan los hitos de 4, 8 y 12 de la §2.6b; nunca mas de 26
  const S = Math.min(Math.max(Math.ceil(sem_lineal), 12), SEM_PROYECCION_MAX);
  const out = [];
  for (let s = 0; s <= S; s++) {
    const rapido = Math.min(ritmo_kg_sem * s, delta_kg);
    const inf = PC - rapido;
    out.push({ semana:s, peso_min:round1(inf), peso_esp:round1((inf + PC) / 2), peso_max:round1(PC) });
  }
  return out;
}

/** Proyeccion plana: sin cronograma lo esperable es que el peso no cambie (+-1 kg de agua/sal). */
function proyeccionPlana(PC) {
  const out = [];
  for (let s = 0; s <= SEM_PROYECCION_PLANA; s++) {
    const b = s === 0 ? 0 : BANDA_PLANA_KG;
    out.push({ semana:s, peso_min:round1(PC - b), peso_esp:round1(PC), peso_max:round1(PC + b) });
  }
  return out;
}

// ---------------------------------------------------------------- Paso 14 (reutilizable)
// Se extrae en una funcion porque el Paso 18 (ajuste manual) tiene que rehacerlo LITERALMENTE
// con las kcal ajustadas: cualquier divergencia entre las dos copias seria un bug silencioso.
function paso14(obje, PC, peso_obj_ef, TDEE, kcal, fecha_inicio, w) {
  let cronograma = null;
  let proyeccion = null;
  if (obje === 'mantener' || obje === 'recomposicion' || peso_obj_ef === null) {
    w('INFO_SIN_CRONOGRAMA');
    // v1.2: recomposicion CON deficit real y con una meta por debajo del peso actual.
    // El cronograma sigue siendo null (no se promete fecha); lo que cambia es la curva.
    if (obje === 'recomposicion' && peso_obj_ef !== null && TDEE - kcal >= 50 && PC - peso_obj_ef >= 0.5) {
      const ritmo_kg_sem = (TDEE - kcal) * 7 / 7700;
      if (ritmo_kg_sem >= 0.05) {
        proyeccion = proyeccionRecomp(PC, PC - peso_obj_ef, ritmo_kg_sem);
        w('INFO_PROYECCION_RECOMP');
      }
    }
  } else {
    const delta_kcal = obje === 'perder' ? TDEE - kcal : kcal - TDEE;
    const delta_kg   = obje === 'perder' ? PC - peso_obj_ef : peso_obj_ef - PC;
    if (delta_kg < 0.5) w('INFO_SIN_CRONOGRAMA_SIN_MARGEN');
    else if (delta_kcal < 50) w('INFO_CRONOGRAMA_NO_ESTIMABLE');
    else {
      const ritmo_kg_sem = delta_kcal * 7 / 7700;
      if (ritmo_kg_sem < 0.05) w('INFO_CRONOGRAMA_NO_ESTIMABLE');
      else {
        const ritmo_pct_sem = ritmo_kg_sem / PC * 100;
        const sem_lineal = delta_kg / ritmo_kg_sem;
        const factor_adapt = 1 + 0.25 * Math.min(sem_lineal / 26, 2);
        const sem_min = Math.ceil(sem_lineal);
        const sem_max = Math.ceil(sem_lineal * factor_adapt);
        const diet_breaks = (obje === 'perder' && sem_lineal > 10) ? Math.floor(sem_lineal/8) : 0;
        let semanas = [sem_min + diet_breaks, sem_max + diet_breaks];
        const horizonte_max = (obje === 'ganar') ? 20 : 104;
        if (semanas[0] > horizonte_max) w('INFO_CRONOGRAMA_FUERA_DE_HORIZONTE');
        else {
          if (semanas[1] > horizonte_max) { semanas = [semanas[0], horizonte_max]; w('WARN_CRONOGRAMA_LARGO'); }
          const precision_fecha = (semanas[1] > 16) ? 'mes' : 'dia';
          const tramo_12sem = (semanas[1] > 16)
            ? [round05(ritmo_kg_sem * 12 / factor_adapt), round05(ritmo_kg_sem * 12)] : null;
          if (semanas[1] > 52) w('WARN_CRONOGRAMA_LARGO');
          cronograma = { ritmo_kg_sem, ritmo_pct_sem, delta_kg, semanas, diet_breaks,
            fecha_min: addDays(fecha_inicio, 7*semanas[0]),
            fecha_max: addDays(fecha_inicio, 7*semanas[1]),
            precision_fecha, tramo_12sem };
          w('INFO_ADAPTACION');
          proyeccion = proyeccionCurva(PC, obje === 'ganar', delta_kg,
            ritmo_kg_sem, factor_adapt, diet_breaks, semanas[1]);
        }
      }
    }
  }
  if (proyeccion === null) { proyeccion = proyeccionPlana(PC); w('INFO_PROYECCION_PLANA'); }
  return { cronograma, proyeccion };
}

function clasificarSomatotipo(s) {
  if (!s) return 'mesomorfo';
  const m1 = { fina:-1, media:0, ancha:1 };
  const m2 = { poca:-1, moderada:0, mucha:1 };
  const m4 = { delgado:-1, atletico:0, robusto:1 };
  let S = m1[s.q1] + m2[s.q2] + m4[s.q4];
  if (s.q3 === 'mucha' && S !== 0) S = S - Math.sign(S);
  if (s.q3 === 'poca' && S < 0) S = Math.max(S - 1, -3);
  if (S <= -2) return 'ectomorfo';
  if (S >= 2) return 'endomorfo';
  return 'mesomorfo';
}

function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------- validacion §1
// dominios de los enumerados (§1: "todos los inputs se validan antes de calcular")
const DOM = {
  sexo: ['hombre','mujer'],
  metodo: ['conocido','medidas','visual','desconocido'],
  fuente: ['fiable','estimado'],
  actividad_diaria: ['sedentario','ligero','moderado','alto','muy_alto'],
  tipo: ['ninguno','fuerza','cardio','mixto'],
  intensidad: ['baja','media','alta'],
  experiencia: ['novato','intermedio','avanzado'],
  momento: ['manana','mediodia','tarde','noche'],
  objetivo: ['perder','mantener','ganar','recomposicion','no_se'],
  ritmo: ['suave','moderado','agresivo'],
  preferencia: ['omnivoro','vegetariano','vegano','sin_lactosa','sin_gluten','low_carb'],
  condicion: ['diabetes','renal','hepatica','tca','cardiaca','hipertension','tiroides','bariatrica','glp1','otra'],
  cribado_tca: ['positivo','evitado','negativo'],
  // v1.1
  recomposicion_prioridad: ['perder','equilibrado','ganar'],
  menstruacion: ['regular','irregular','ausente','no_dice'],
  preferencia_base: ['omnivoro','vegetariano','vegano'],
  restriccion: ['sin_lactosa','sin_gluten'],
  // v1.2
  sintoma_regla: ['dolor','hinchazon','antojos','cansancio','sangrado_abundante'],
};

// §1 "regla de traduccion": normaliza el trio base/restricciones/low_carb desde cualquiera de los
// dos formatos de entrada. Con `preferencia_base` presente, `preferencia` deja de leerse.
function normalizarPreferencias(I) {
  if (I.preferencia_base === undefined || I.preferencia_base === null) {
    return {
      pref_base: ['omnivoro','vegetariano','vegano'].includes(I.preferencia) ? I.preferencia : 'omnivoro',
      restr: I.preferencia === 'sin_lactosa' ? ['sin_lactosa'] : I.preferencia === 'sin_gluten' ? ['sin_gluten'] : [],
      low_carb: I.preferencia === 'low_carb',
    };
  }
  const rr = Array.isArray(I.restricciones) ? I.restricciones : [];
  return {
    pref_base: I.preferencia_base,
    restr: DOM.restriccion.filter((x) => rr.includes(x)),   // sin duplicados y en orden canonico
    low_carb: I.low_carb === true,
  };
}

// §1 "regla inversa": el banco de plantillas / `preferencia_efectiva` a partir del trio efectivo.
function bancoDe(pref_base, restr, low_carb) {
  if (low_carb) return 'low_carb';
  if (pref_base === 'vegano') return 'vegano';
  if (pref_base === 'vegetariano') return 'vegetariano';
  if (restr.includes('sin_gluten')) return 'sin_gluten';
  if (restr.includes('sin_lactosa')) return 'sin_lactosa';
  return 'omnivoro';
}

function validar(I) {
  const e = [];
  const G = I.grasa || {};
  const T0 = I.entrenamiento || {};
  // --- dominios de enumerados
  if (!DOM.sexo.includes(I.sexo)) e.push('sexo');
  if (!DOM.metodo.includes(G.metodo)) e.push('grasa.metodo');
  if (G.fuente !== undefined && G.fuente !== null && !DOM.fuente.includes(G.fuente)) e.push('grasa.fuente');
  if (!DOM.actividad_diaria.includes(I.actividad_diaria)) e.push('actividad_diaria');
  if (!DOM.tipo.includes(T0.tipo)) e.push('entrenamiento.tipo');
  // `experiencia` no esta entre los campos que la §1 exime con tipo = 'ninguno'
  if (!DOM.experiencia.includes(T0.experiencia)) e.push('entrenamiento.experiencia');
  if (T0.tipo !== 'ninguno') {
    if (!DOM.intensidad.includes(T0.intensidad)) e.push('entrenamiento.intensidad');
    if (T0.momento !== null && T0.momento !== undefined && !DOM.momento.includes(T0.momento)) e.push('entrenamiento.momento');
  }
  if (!DOM.objetivo.includes(I.objetivo)) e.push('objetivo');
  if (!DOM.ritmo.includes(I.ritmo)) e.push('ritmo');
  if (!DOM.preferencia.includes(I.preferencia)) e.push('preferencia');
  if (!Array.isArray(I.condiciones) || I.condiciones.some(c => !DOM.condicion.includes(c))) e.push('condiciones');
  if (I.cribado_tca !== null && I.cribado_tca !== undefined && !DOM.cribado_tca.includes(I.cribado_tca)) e.push('cribado_tca');
  if (![2,3,4,5,6].includes(I.n_comidas)) e.push('n_comidas');
  // --- v1.1: campos opcionales; ausente o null siempre es valido
  const opc = (v, dom, campo) => { if (v !== undefined && v !== null && !dom.includes(v)) e.push(campo); };
  opc(I.recomposicion_prioridad, DOM.recomposicion_prioridad, 'recomposicion_prioridad');
  opc(I.menstruacion, DOM.menstruacion, 'menstruacion');
  opc(I.preferencia_base, DOM.preferencia_base, 'preferencia_base');
  if (I.restricciones !== undefined && I.restricciones !== null
      && (!Array.isArray(I.restricciones) || I.restricciones.some((r) => !DOM.restriccion.includes(r)))) e.push('restricciones');
  if (I.low_carb !== undefined && I.low_carb !== null && typeof I.low_carb !== 'boolean') e.push('low_carb');
  // --- v1.2: plazo, sintomas y listas de alimentos (el motor ignora las dos ultimas)
  if (I.plazo_semanas !== undefined && I.plazo_semanas !== null
      && (!Number.isInteger(I.plazo_semanas) || I.plazo_semanas < 4 || I.plazo_semanas > 52)) e.push('plazo_semanas');
  if (I.sintomas_regla !== undefined && I.sintomas_regla !== null
      && (!Array.isArray(I.sintomas_regla) || I.sintomas_regla.some((s) => !DOM.sintoma_regla.includes(s)))) e.push('sintomas_regla');
  for (const campo of ['alimentos_excluidos','alimentos_favoritos']) {
    const v = I[campo];
    if (v !== undefined && v !== null && (!Array.isArray(v) || v.some((x) => typeof x !== 'string'))) e.push(campo);
  }
  // --- enteros y fecha
  if (!Number.isInteger(I.edad)) e.push('edad');
  if (!Number.isInteger(T0.dias_semana)) e.push('entrenamiento.dias_semana');
  if (T0.tipo !== 'ninguno' && !Number.isInteger(T0.minutos_sesion)) e.push('entrenamiento.minutos_sesion');
  if (typeof I.fecha_inicio !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(I.fecha_inicio) || Number.isNaN(Date.parse(I.fecha_inicio + 'T00:00:00Z')))
    e.push('fecha_inicio');
  if (e.length) return e;                                          // sin dominio valido no se validan rangos

  // --- rangos numericos
  if (!(I.edad >= 0 && I.edad <= 120)) e.push('edad');            // nota † : 18-75 lo decide el paso 0
  if (!(I.altura_cm >= 130 && I.altura_cm <= 230)) e.push('altura_cm');
  if (!(I.peso_kg >= 35 && I.peso_kg <= 300)) e.push('peso_kg');
  if (G.metodo === 'conocido') {
    if (typeof G.valor !== 'number') e.push('grasa.valor');
    else if (!(G.valor >= 3 && G.valor <= 70)) e.push('grasa.valor');
  }
  if (G.metodo === 'medidas') {
    if (!(G.cuello_cm >= 25 && G.cuello_cm <= 60)) e.push('grasa.cuello_cm');
    if (!(G.cintura_cm >= 50 && G.cintura_cm <= 200)) e.push('grasa.cintura_cm');
    if (I.sexo === 'mujer' && !(G.cadera_cm >= 60 && G.cadera_cm <= 200)) e.push('grasa.cadera_cm');
  }
  if (G.metodo === 'visual') {
    const tabla = I.sexo === 'hombre' ? VISUAL_H : VISUAL_M;
    if (!(G.categoria in tabla)) e.push('grasa.categoria');
  }
  if (I.peso_objetivo !== null && I.peso_objetivo !== undefined && !(I.peso_objetivo >= 30 && I.peso_objetivo <= 300)) e.push('peso_objetivo');
  if (I.entrenamiento.tipo !== 'ninguno') {
    if (!(I.entrenamiento.minutos_sesion >= 10 && I.entrenamiento.minutos_sesion <= 240)) e.push('entrenamiento.minutos_sesion');
  }
  if (!(I.entrenamiento.dias_semana >= 0 && I.entrenamiento.dias_semana <= 7)) e.push('entrenamiento.dias_semana');
  const imc = I.peso_kg / ((I.altura_cm / 100) ** 2);
  if (imc < 12 || imc > 60) e.push('peso_kg+altura_cm');
  return e;
}

// ---------------------------------------------------------------- motor
/**
 * Meta que el paso 13 va a publicar para una meta escrita por el usuario, con sus mismos suelos y
 * techos (paso 13): en `perder`, el IMC minimo por edad y la grasa esencial; en `ganar`, ese
 * mismo suelo y el techo de IMC 27,5. La usa el paso 6.7ter para medir el plazo (v1.2).
 */
function metaSegura(pobj, obj, hombre, edad, MLG, h2) {
  const min_imc = (edad >= 65 ? 22 : 18.5) * h2;
  if (obj === 'ganar') return Math.min(Math.max(pobj, min_imc), 27.5 * h2);
  const g_min = hombre ? 12 : 20;
  return Math.max(pobj, min_imc, MLG / (1 - g_min / 100));
}

function calcular(I) {
  const A = [];
  const w = (c) => { if (!A.includes(c)) A.push(c); };
  const hombre = I.sexo === 'hombre';
  const h = I.altura_cm / 100, PC = I.peso_kg, h2 = h * h;

  const errores = validar(I);
  if (errores.length) return { excluido:'ERR_INPUT_RANGO', errores };

  // ---- Paso 0 — exclusiones (el cribado alimenta `condiciones` antes de nada)
  let condiciones = (I.condiciones || []).slice();
  if ((I.cribado_tca === 'positivo' || I.cribado_tca === 'evitado') && !condiciones.includes('tca')) condiciones.push('tca');
  // normalizacion de preferencias (§1, regla de traduccion). Se hace aqui, antes de la primera
  // exclusion, para que todo el documento pueda hablar de `pref_base` / `restr` / `low_carb`.
  const { pref_base, restr, low_carb: low_carb_pedido } = normalizarPreferencias(I);
  const menstruacion = I.sexo === 'mujer' ? (I.menstruacion ?? null) : null;   // en hombres se ignora
  const IMC = PC / h2;
  if (I.edad < 18 || I.edad > 75) return { excluido:'EXCL_EDAD' };
  if (I.embarazo_lactancia === true) return { excluido:'EXCL_EMBARAZO_LACTANCIA' };
  if (IMC < 16) return { excluido:'EXCL_IMC_MUY_BAJO' };
  if (condiciones.includes('tca') && IMC < 18.5) return { excluido:'EXCL_TCA_RIESGO' };

  // ---- Paso 1
  const imc_categoria = IMC < 18.5 ? 'bajo_peso' : IMC < 25 ? 'normal' : IMC < 30 ? 'sobrepeso'
    : IMC < 35 ? 'obesidad_I' : IMC < 40 ? 'obesidad_II' : 'obesidad_III';

  // ---- Paso 2
  const sexoCUN = hombre ? 0 : 1;
  const CUNBAE = -44.988 + 0.503*I.edad + 10.689*sexoCUN + 3.172*IMC - 0.026*IMC*IMC
    + 0.181*IMC*sexoCUN - 0.02*IMC*I.edad - 0.005*IMC*IMC*sexoCUN + 0.00021*IMC*IMC*I.edad;
  const DEURENBERG = 1.20*IMC + 0.23*I.edad - 10.8*(hombre?1:0) - 5.4;

  let grasa_pct, fiab, met_ef = I.grasa.metodo, mas, navy;
  if (I.grasa.metodo === 'conocido') {
    grasa_pct = I.grasa.valor;
    if (I.grasa.fuente === 'fiable') { fiab='alta'; mas=2; } else { fiab='media'; mas=4; }
  } else if (I.grasa.metodo === 'medidas') {
    let ok = true, D;
    if (hombre) {
      const x = I.grasa.cintura_cm - I.grasa.cuello_cm;
      if (x < 15) ok = false; else D = 1.0324 - 0.19077*log10(x) + 0.15456*log10(I.altura_cm);
    } else {
      const x = I.grasa.cintura_cm + I.grasa.cadera_cm - I.grasa.cuello_cm;
      if (x < 60) ok = false; else D = 1.29579 - 0.35004*log10(x) + 0.22100*log10(I.altura_cm);
    }
    if (ok) { navy = 495/D - 450; if (!(navy >= 3 && navy <= 60)) ok = false; }
    if (!ok) { w('WARN_MEDIDAS_INVALIDAS'); grasa_pct = CUNBAE; fiab='baja'; met_ef='desconocido'; mas=5; navy=undefined; }
    else { grasa_pct = navy; fiab='media'; mas=4; if (Math.abs(navy - CUNBAE) > 10) w('WARN_GRASA_DISCREPANCIA'); }
  } else if (I.grasa.metodo === 'visual') {
    grasa_pct = (hombre ? VISUAL_H : VISUAL_M)[I.grasa.categoria]; fiab='baja'; mas=5;
  } else { grasa_pct = CUNBAE; fiab='baja'; mas=5; }
  const grasa_pre = grasa_pct;
  grasa_pct = clamp(grasa_pct, hombre ? 4 : 10, 60);
  if (met_ef === 'conocido' && grasa_pct !== grasa_pre) w('WARN_GRASA_FUERA_DE_RANGO');
  const grasa_rango = [Math.max(3, grasa_pct - mas), Math.min(65, grasa_pct + mas)];
  const banda = hombre
    ? (grasa_pct < 12 ? 'muy_bajo' : grasa_pct < 15 ? 'bajo' : grasa_pct < 20 ? 'medio' : grasa_pct < 25 ? 'alto' : 'muy_alto')
    : (grasa_pct < 20 ? 'muy_bajo' : grasa_pct < 23 ? 'bajo' : grasa_pct < 28 ? 'medio' : grasa_pct < 32 ? 'alto' : 'muy_alto');

  // ---- Paso 3
  const MLG = PC * (1 - grasa_pct/100);

  // ---- Paso 4
  const MIFFLIN = 10*PC + 6.25*I.altura_cm - 5*I.edad + (hombre ? 5 : -161);
  const KATCH = 370 + 21.6*MLG;
  const HARRIS = hombre ? 88.362 + 13.397*PC + 4.799*I.altura_cm - 5.677*I.edad
                        : 447.593 + 9.247*PC + 3.098*I.altura_cm - 4.330*I.edad;
  const usaKatch = (met_ef === 'conocido' && fiab === 'alta');
  const BMR = usaKatch ? KATCH : MIFFLIN;
  const bmr_ecuacion = usaKatch ? 'katch_mcardle' : 'mifflin';

  // ---- Paso 5
  const T = I.entrenamiento;
  const dias = (T.tipo === 'ninguno') ? 0 : T.dias_semana;
  const perfil = (T.tipo === 'ninguno' || dias === 0) ? 'sedentario' : (T.tipo === 'cardio' ? 'cardio' : 'fuerza');
  const PAL = PAL_T[I.actividad_diaria];
  const MET = perfil === 'sedentario' ? 0 : MET_T[T.tipo][T.intensidad];
  const kcal_sesion = perfil === 'sedentario' ? 0 : (MET - 1) * PC * T.minutos_sesion / 60;
  const ejercicio_dia = kcal_sesion * dias / 7;
  const TDEE_bruto = BMR * PAL + ejercicio_dia;
  const TDEE = TDEE_bruto * 0.95;
  if (perfil === 'fuerza' && dias >= 4) w('INFO_BMR_ATLETA');

  // ---- Paso 6
  const g_c  = I.edad >= 65 ? (hombre ? 18 : 26) : (hombre ? 15 : 23);
  const g_lo = I.edad >= 65 ? (hombre ? 15 : 23) : (hombre ? 12 : 20);
  const g_hi = I.edad >= 65 ? (hombre ? 20 : 28) : (hombre ? 17 : 25);
  let objetivo_propuesto;                                          // objetivo resuelto por 6.1 (§4)
  let obj = I.objetivo; const exp = T.experiencia; const pobj = (I.peso_objetivo === undefined) ? null : I.peso_objetivo;

  if (obj === 'no_se') {
    if (pobj !== null && Math.abs(pobj - PC) >= 1) { obj = (pobj < PC) ? 'perder' : 'ganar'; w('INFO_OBJETIVO_RESUELTO_POR_PESO'); }
    else if (pobj !== null) { obj = 'mantener'; w('INFO_OBJETIVO_IGUAL'); }   // 6.1, lectura conservadora de 6.2
    else if (IMC < 20) obj = 'mantener';
    else if (banda === 'alto' || banda === 'muy_alto') obj = 'perder';
    else if (banda === 'muy_bajo' && perfil === 'fuerza') obj = 'ganar';
    else if (perfil === 'fuerza') obj = 'recomposicion';
    else obj = 'mantener';
    if (!A.includes('INFO_OBJETIVO_RESUELTO_POR_PESO') && !A.includes('INFO_OBJETIVO_IGUAL')) w('INFO_OBJETIVO_RESUELTO');
    objetivo_propuesto = obj;
  } else if (pobj !== null && (obj === 'perder' || obj === 'ganar')) {
    if (Math.abs(pobj - PC) < 1) { obj = 'mantener'; w('INFO_OBJETIVO_IGUAL'); }
    else if (obj === 'perder' && pobj > PC) { obj = 'ganar'; w('WARN_OBJETIVO_INCOHERENTE'); }
    else if (obj === 'ganar' && pobj < PC) { obj = 'perder'; w('WARN_OBJETIVO_INCOHERENTE'); }
  }

  // 6.3 guardarrail de bajo peso (incondicional)
  if (IMC < 18.5 && (obj === 'perder' || obj === 'recomposicion')) { obj = 'mantener'; w('WARN_IMC_BAJO_NO_DEFICIT'); }
  if (obj === 'perder' && (banda === 'muy_bajo' || banda === 'bajo')) { obj = 'recomposicion'; w('WARN_YA_MAGRO'); }
  if (obj === 'perder' && pobj === null && MLG / (1 - g_c/100) >= PC - 0.5) { obj = 'recomposicion'; w('WARN_YA_EN_OBJETIVO'); }

  if (obj === 'ganar') {
    if (IMC >= 18.5 && (exp === 'novato' || perfil !== 'fuerza') && (banda === 'alto' || banda === 'muy_alto')) {
      obj = 'recomposicion'; w('WARN_RECOMPOSICION_SUGERIDA');
    } else if (perfil !== 'fuerza') w('WARN_GANAR_SIN_FUERZA');
  }
  if (obj === 'recomposicion' && perfil !== 'fuerza') w('WARN_RECOMPOSICION_SIN_FUERZA');
  if ((obj === 'mantener' || obj === 'recomposicion') && pobj !== null && Math.abs(pobj - PC) >= 1) w('INFO_OBJETIVO_IGNORADO');

  let ritmo_ef = I.ritmo;
  // 6.7ter PLAZO (v1.2). Se evalua AQUI, ANTES que cualquier suavizado de seguridad: fija el
  // ritmo de PARTIDA a partir de la fecha que ha pedido el usuario, y despues los suavizados de
  // 6.7 (tca, >=65) y 6.7bis (regla) se aplican sobre el resultado y MANDAN.
  const plazo = (typeof I.plazo_semanas === 'number' && Number.isFinite(I.plazo_semanas)) ? I.plazo_semanas : null;
  let ritmo_plazo = null;
  // La meta contra la que se mide el plazo es la que el paso 13 va a PUBLICAR, no la cruda: los
  // suelos de seguridad (IMC minimo por edad y grasa esencial) la suben y el techo de `ganar` la
  // baja, y dividir por el plazo una meta que el propio informe rechaza aplicaba un ritmo mas
  // duro que el que exige el plan real.
  const meta_plazo = pobj === null ? null : metaSegura(pobj, obj, hombre, I.edad, MLG, h2);
  const delta_plazo = meta_plazo === null ? 0 : (obj === 'perder' ? PC - meta_plazo : meta_plazo - PC);
  if (plazo !== null && meta_plazo !== null && delta_plazo > 0 && (obj === 'perder' || obj === 'ganar')) {
    const kgSem = (r) => {
      if (obj === 'perder') {
        const t = RITMO_T[banda];
        return t ? t[r] / 100 * PC : null;                        // % del peso corporal por semana
      }
      const sup_pct = perfil !== 'fuerza' ? 0.05 : SUP_T[exp][r];
      return clamp(sup_pct * TDEE, 150, 500) * 7 / 7700;          // el superavit real del paso 7
    };
    // Semanas que ese ritmo produce DE VERDAD, con la aritmetica del paso 14: la parte lineal mas
    // las semanas de mantenimiento. Comparar contra la tasa pelada hacia que el paso 17 juzgara
    // con un modelo distinto del que habia elegido el ritmo.
    const semanasDe = (v) => {
      const sem_lineal = delta_plazo / v;
      const descansos = (obj === 'perder' && sem_lineal > 10) ? Math.floor(sem_lineal / 8) : 0;
      return Math.ceil(sem_lineal - 1e-9) + descansos;
    };
    for (const r of ['suave','moderado','agresivo']) {
      const v = kgSem(r);
      if (v !== null && v > 0 && semanasDe(v) <= plazo) { ritmo_plazo = r; break; }
    }
    if (ritmo_plazo === null) { ritmo_plazo = 'agresivo'; w('WARN_PLAZO_IRREAL'); }
    else w('INFO_RITMO_POR_PLAZO');
    ritmo_ef = ritmo_plazo;
  }
  if (condiciones.includes('tca')) { w('INFO_RITMO_SUAVE'); if (ritmo_ef !== 'suave') ritmo_ef = 'suave'; }
  if (I.edad >= 65 && obj === 'perder') {
    if (ritmo_ef === 'agresivo') ritmo_ef = 'moderado';
    w('WARN_PERDIDA_MAYOR_65');
  }
  // 6.7bis REGLA (solo mujeres): unico efecto numerico, el ritmo agresivo pasa a moderado.
  // Solo en planes que restan calorias (perder / recomposicion): el motivo es la baja
  // disponibilidad energetica (RED-S) y ahi el remedio es comer MAS, no recortar un superavit.
  // El aviso WARN_CICLO_AUSENTE se evalua en el paso 17, contra el objetivo efectivo FINAL.
  if ((menstruacion === 'irregular' || menstruacion === 'ausente')
      && (obj === 'perder' || obj === 'recomposicion')) {
    if (ritmo_ef === 'agresivo') ritmo_ef = 'moderado';
  }

  // 6.8 preferencias: el interruptor low-carb es lo unico que la diabetes anula
  let low_carb_ef = low_carb_pedido;
  if (condiciones.includes('diabetes') && low_carb_ef) { low_carb_ef = false; w('WARN_LOWCARB_DIABETES'); }
  const pref = bancoDe(pref_base, restr, low_carb_ef);          // = preferencia_efectiva

  let objetivo_efectivo = obj;
  const recomp_prio = (I.recomposicion_prioridad ?? 'equilibrado');
  // exencion de la regla de margen: quien pide recomposicion priorizando ganar musculo pide
  // explicitamente CERO deficit; convertirlo en 'mantener' con WARN_SIN_MARGEN_DEFICIT seria
  // contarle que "no podemos proponerte un deficit" cuando es justo lo que ha pedido.
  const recomp_sin_deficit = (objetivo_efectivo === 'recomposicion' && recomp_prio === 'ganar');

  // ---- Paso 7
  let cap_pct = (banda === 'muy_alto') ? 0.30 : 0.25;
  if (I.edad >= 65) cap_pct = Math.min(cap_pct, 0.20);
  let kcal_calc;
  if (objetivo_efectivo === 'perder') {
    const ritmo_pct = RITMO_T[banda][ritmo_ef];
    const deficit_ritmo = ritmo_pct/100 * PC * 7700/7;
    const deficit_cap = cap_pct * TDEE;
    if (deficit_ritmo > deficit_cap) w('INFO_DEFICIT_CAPADO_TDEE');
    kcal_calc = TDEE - Math.min(deficit_ritmo, deficit_cap);
  } else if (objetivo_efectivo === 'ganar') {
    const sup_pct = perfil !== 'fuerza' ? 0.05 : SUP_T[exp][ritmo_ef];
    kcal_calc = TDEE + clamp(sup_pct * TDEE, 150, 500);
  } else if (objetivo_efectivo === 'recomposicion') {
    let d = RECOMP_T[banda];
    if (recomp_prio === 'perder') { d = Math.min(d + 0.05, 0.15); w('INFO_RECOMP_PRIORIDAD_PERDER'); }
    else if (recomp_prio === 'ganar') { d = 0; w('INFO_RECOMP_PRIORIDAD_GANAR'); }
    kcal_calc = TDEE * (1 - d);
  } else kcal_calc = TDEE;

  if (IMC < 18.5) kcal_calc = Math.max(kcal_calc, TDEE);   // prohibicion dura de balance negativo

  const suelo_sexo = hombre ? 1500 : 1200;
  let suelo_activo = false;
  if (objetivo_efectivo === 'perder' || objetivo_efectivo === 'recomposicion') {
    const suelo_bmr = BMR;
    const suelo_ea = (banda === 'muy_alto' ? 25 : 30) * MLG + ejercicio_dia;
    const suelo = Math.max(suelo_sexo, suelo_bmr, suelo_ea);
    if (kcal_calc < suelo) {
      kcal_calc = suelo; suelo_activo = true;
      if (suelo === suelo_ea && suelo_ea > Math.max(suelo_sexo, suelo_bmr)) w('WARN_SUELO_CALORICO_EA');
      else if (suelo === suelo_bmr && suelo_bmr >= suelo_sexo) w('WARN_SUELO_CALORICO_BMR');
      else w('WARN_SUELO_CALORICO_SEXO');
    }
  }
  if ((objetivo_efectivo === 'mantener' || objetivo_efectivo === 'ganar') && kcal_calc < suelo_sexo) {
    kcal_calc = suelo_sexo; suelo_activo = true; w('WARN_GASTO_BAJO_MINIMO');
  }

  let kcal = suelo_activo ? roundUp10(kcal_calc) : round10(kcal_calc);

  // primera pasada de la regla de margen (los pasos 9 y 10 aun pueden subir kcal -> paso 10bis)
  if (!recomp_sin_deficit && (objetivo_efectivo === 'perder' || objetivo_efectivo === 'recomposicion') && kcal >= TDEE - 50) {
    objetivo_efectivo = 'mantener';
    kcal = round10(Math.max(TDEE, kcal));
    w('WARN_SIN_MARGEN_DEFICIT');
  }

  // ---- Paso 8
  const PC30 = 30 * h2;
  const PA = PC30 + 0.25 * (PC - PC30);
  const base = IMC >= 30 ? PA : PC;
  const base_tipo = IMC >= 30 ? 'peso_ajustado' : 'peso_corporal';
  let gkg;
  if (IMC >= 30) { gkg = PROT_T.sedentario[objetivo_efectivo]; if (perfil !== 'sedentario') gkg += 0.2; }
  else gkg = PROT_T[perfil][objetivo_efectivo];
  if (I.edad >= 60) gkg += 0.2;
  if (objetivo_efectivo === 'perder' && ritmo_ef === 'agresivo') gkg += 0.2;
  if ((objetivo_efectivo === 'perder' || objetivo_efectivo === 'recomposicion') && (banda === 'muy_bajo' || banda === 'bajo')) gkg += 0.2;
  if (I.edad >= 60) gkg = Math.max(gkg, perfil === 'fuerza' ? 1.6 : 1.2);
  if (condiciones.includes('bariatrica') || condiciones.includes('glp1')) gkg = Math.max(gkg, 1.5);
  if (pref_base === 'vegano') gkg = gkg * 1.15;      // la BASE dietetica, no el banco
  if (pref_base === 'vegetariano') gkg = gkg * 1.10;
  gkg = Math.min(gkg, IMC >= 30 ? 2.0 : 2.4);
  if (condiciones.includes('hepatica')) w('WARN_HEPATICA');
  if (condiciones.includes('diabetes')) w('WARN_DIABETES');
  if (condiciones.includes('cardiaca')) w('WARN_CARDIACA');
  if (condiciones.includes('hipertension')) w('WARN_HIPERTENSION');
  if (condiciones.includes('tiroides')) w('WARN_TIROIDES');
  if (condiciones.includes('bariatrica') || condiciones.includes('glp1')) w('WARN_BARIATRICA_GLP1');
  if (condiciones.includes('otra')) w('WARN_CONDICION_OTRA');

  const es_renal = condiciones.includes('renal');
  const pctCap = () => ((pref_base === 'vegano' || pref_base === 'vegetariano') && kcal < 1800) ? 0.30 : 0.35;
  const capP = () => Math.min(2.5 * PC, pctCap() * kcal / 4);

  const P_raw = gkg * base;
  const pct_cap = pctCap();          // el que de verdad se aplica en el paso 8 (§4, placeholder {35/30})
  let P_cap = capP();
  let P = Math.min(P_raw, P_cap);
  P = Math.max(P, 0.8 * PC);
  if (P < P_raw) w('INFO_PROTEINA_CAPADA');
  if (es_renal) {
    P = Math.min(P, 1.0 * PC);
    P = roundDown5(P);
    w('WARN_RENAL');
  } else {
    P = (P === P_cap) ? roundDown5(P) : round5(P);
    if (P < 0.8 * PC) P = roundUp5(0.8 * PC);
  }
  // P_min: suelo del bucle del paso 10. Cerrado por arriba con el cap renal y por abajo con
  // la linea roja RDA de 0.8 g/kg de PESO CORPORAL (con `base` = PA el bucle bajaba de ella).
  const calcPmin = () => {
    let v = (I.edad >= 60 ? (perfil === 'fuerza' ? 1.6 : 1.2) : 1.2) * base;
    if (es_renal) v = Math.min(v, 1.0 * PC);
    else v = Math.max(v, 0.8 * PC);
    return v;
  };
  let P_min = calcPmin();

  // ---- Paso 9
  const pct_grasa = low_carb_ef ? 0.45
    : objetivo_efectivo === 'perder' ? (ritmo_ef === 'agresivo' ? 0.25 : 0.28)
    : objetivo_efectivo === 'recomposicion' ? (recomp_prio === 'perder' ? 0.33 : 0.28)
    : objetivo_efectivo === 'mantener' ? 0.32 : 0.27;
  const suelo_gkg = hombre ? 0.7 : 0.8;
  const pctTecho = low_carb_ef ? 0.50 : 0.40;
  const sueloG = () => Math.max(suelo_gkg * base, 0.20 * kcal / 9);
  const techoG = () => pctTecho * kcal / 9;
  let suelo_g = sueloG(), techo_g = techoG();
  // La franja no basta con que exista: tiene que contener algun multiplo de 5 g, porque la grasa
  // se prescribe redondeada a 5. Si no lo contiene, el redondeo dirigido del final del paso 9
  // deja G por debajo del suelo obligatorio (56 casos en el barrido) sin ningun aviso.
  const asegurarFranja = () => {
    for (let it = 0; roundUp5(suelo_g) > techo_g; it++) {
      if (it > 10) throw new Error('paso 9: la franja de grasa no converge');
      kcal = roundUp10(roundUp5(suelo_g) * 9 / pctTecho);
      w('WARN_KCAL_INSUFICIENTES_PARA_MACROS');
      suelo_g = sueloG(); techo_g = techoG();
      P_cap = capP();
      if (P > P_cap) P = roundDown5(P_cap);
    }
  };
  asegurarFranja();
  const G0 = clamp(pct_grasa * kcal / 9, suelo_g, techo_g);
  const soma = clasificarSomatotipo(I.somatotipo);
  const delta = 0.10 * (kcal - 4*P) / 9;
  let G1;
  if (!low_carb_ef && soma === 'endomorfo') { G1 = Math.min(G0 + delta, techo_g); w('INFO_SOMATOTIPO'); }
  else if (!low_carb_ef && soma === 'ectomorfo') { G1 = Math.max(G0 - delta, suelo_g); w('INFO_SOMATOTIPO'); }
  else G1 = G0;
  let G = round5(G1);
  if (G < suelo_g) G = roundUp5(suelo_g);
  if (G > techo_g) G = roundDown5(techo_g);

  // ---- Paso 10
  const HC_min = low_carb_ef ? 75 : 130;
  let HC;
  for (let it = 0; ; it++) {
    // Un bucle que no converge es un FALLO del motor, no una salida valida (§ paso 10):
    // antes salia por un `break` mudo y devolvia macros NaN con inputs fuera de dominio.
    if (it > 4000) throw new Error('paso 10: el bucle de factibilidad no converge');
    HC = (kcal - 4*P - 9*G) / 4;
    if (HC >= HC_min) break;
    if (G - 5 >= suelo_g) { G = G - 5; continue; }        // la grasa se sacrifica PRIMERO
    if (P - 5 >= P_min)   { P = P - 5; continue; }        // la proteina es la ultima
    kcal = kcal + 50; w('WARN_DEFICIT_INFACTIBLE');
    suelo_g = sueloG(); techo_g = techoG(); P_cap = capP();
    P_min = calcPmin();
    if (P > P_cap) P = roundDown5(P_cap);
    asegurarFranja();
    if (G < suelo_g) G = roundUp5(suelo_g);
    if (G > techo_g) G = roundDown5(techo_g);
  }
  HC = round5(HC);
  const kcal_cierre = 4*P + 4*HC + 9*G;
  const cierre_ok = Math.abs(kcal_cierre - kcal) <= 0.02 * kcal;

  // ---- Paso 10bis — segunda pasada de la regla de margen, contra las kcal ya cerradas
  if (!recomp_sin_deficit && (objetivo_efectivo === 'perder' || objetivo_efectivo === 'recomposicion') && kcal >= TDEE - 50) {
    objetivo_efectivo = 'mantener';
    w('WARN_SIN_MARGEN_DEFICIT');
  }
  if (objetivo_efectivo === 'perder' && (TDEE - kcal) >= 50 && (TDEE - kcal) < 100) w('WARN_DEFICIT_MINIMO');

  // ---- Paso 11
  const fibra_prop = 14 * kcal / 1000;
  const suelo_fibra = low_carb_ef ? Math.max(20, 10 * kcal / 1000) : Math.min(25, 0.15 * HC);
  const fibra = Math.round(clamp(fibra_prop, suelo_fibra, 40));
  if (fibra < 25) w('INFO_FIBRA_AJUSTADA');
  const azucares_libres_max_g = 0.10 * kcal / 4;

  // ---- Paso 12
  let agua = null;
  const suelo_agua = hombre ? 2000 : 1500;
  if (es_renal || condiciones.includes('cardiaca')) {
    w('INFO_AGUA_NO_PRESCRITA');
  } else {
    const k = (I.actividad_diaria === 'alto' || I.actividad_diaria === 'muy_alto' || dias >= 4) ? 35
      : (I.actividad_diaria === 'moderado' || (dias >= 1 && dias <= 3)) ? 33 : 30;
    let agua_base = Math.max(PC * k, suelo_agua);
    agua_base = Math.min(agua_base, hombre ? 4000 : 3100);
    const min_dia = perfil === 'sedentario' ? 0 : T.minutos_sesion * dias / 7;
    const aj_ejercicio = Math.min(1000, min_dia/60 * 500);
    const aj_clima = I.clima_caluroso ? 400 : 0;
    const agua_ml = round50(clamp(agua_base + aj_ejercicio + aj_clima, suelo_agua, 4000));
    const vasos = Math.round(agua_ml / 250);
    agua = { ml: agua_ml, rango: [Math.max(agua_ml - 250, suelo_agua), Math.min(agua_ml + 250, 4000)], vasos };
    if (agua_ml >= 3500) w('WARN_AGUA_ALTA');
    if (I.edad >= 65) w('INFO_AGUA_MAYORES');
  }

  // ---- Paso 13
  const pesoA  = MLG / (1 - g_c/100);
  const rangoA = [MLG / (1 - g_lo/100), MLG / (1 - g_hi/100)];
  const pesoB  = 22*h2, rangoB = [20*h2, 24.9*h2];
  const imc_min = (I.edad >= 65) ? 22 : 18.5;
  const min185 = imc_min * h2;
  const mas_g = { alta:2, media:4, baja:5 }[fiab];
  const wKg = MLG * (mas_g/100) / (1 - g_c/100);
  const pulg = I.altura_cm / 2.54;
  const clasicas = (I.altura_cm >= 150 && I.altura_cm <= 200) ? {
    devine:   hombre ? 50 + 2.3*(pulg-60)    : 45.5 + 2.3*(pulg-60),
    robinson: hombre ? 52 + 1.9*(pulg-60)    : 49 + 1.7*(pulg-60),
    miller:   hombre ? 56.2 + 1.41*(pulg-60) : 53.1 + 1.36*(pulg-60),
    hamwi:    hombre ? 48 + 2.7*(pulg-60)    : 45.5 + 2.2*(pulg-60),
  } : null;

  let lo = Math.max(Math.min(rangoA[0] - wKg, rangoA[1] + wKg), min185);
  let hi = Math.max(rangoA[1] + wKg, lo);
  if (min185 > rangoA[1] + wKg) { lo = min185; hi = min185; w('INFO_PESO_YA_MINIMO'); }
  const lo05 = roundUp05(lo);                       // redondeo dirigido: el suelo nunca se cruza
  const hi05 = Math.max(round05(hi), lo05);
  let sugerido_central = clamp(round05(clamp(Math.max(pesoA, min185), lo, hi)), lo05, hi05);
  let sugerido_rango = [lo05, hi05];
  let mostrar_central = (fiab !== 'baja');
  let peso_obj_ef = null, hito = null, metodo_peso = 'actual';
  let piso_peso = min185;                           // suelo duro del peso objetivo

  // v1.2: la recomposicion CON deficit real (kcal <= TDEE - 50, es decir prioridad `perder` o
  // `equilibrado` con banda que si resta) valida y propone el peso objetivo exactamente como
  // `perder`: mismos suelos (IMC minimo y grasa esencial) y mismos avisos. La comprobacion
  // `PC - meta >= 0,5` va ANTES de ejecutar la rama, para no emitir avisos de una meta que
  // despues se descarta: si ya estas en (o por debajo de) la meta, no hay meta que dar.
  const recomp_con_deficit = (objetivo_efectivo === 'recomposicion' && TDEE - kcal >= 50);
  const meta_cand = recomp_con_deficit ? (pobj === null ? sugerido_central : pobj) : null;
  const rama_perder = objetivo_efectivo === 'perder'
    || (recomp_con_deficit && PC - meta_cand >= 0.5);
  if (rama_perder) {
    metodo_peso = 'grasa';
    if (pobj === null) peso_obj_ef = sugerido_central;
    else {
      peso_obj_ef = pobj;
      if (peso_obj_ef / h2 < imc_min) { w('WARN_OBJETIVO_IMC_BAJO'); peso_obj_ef = min185; }
      const gi = (1 - MLG/peso_obj_ef) * 100;
      const g_min = hombre ? 12 : 20;
      if (gi < g_min) {
        w('WARN_OBJETIVO_GRASA_MUY_BAJA');
        piso_peso = Math.max(MLG / (1 - g_min/100), min185);
        peso_obj_ef = piso_peso;
        mostrar_central = false;
      }
    }
    peso_obj_ef = round05(peso_obj_ef);
    if (peso_obj_ef < piso_peso) peso_obj_ef = roundUp05(piso_peso);
    // una sola evaluacion, fuera del bloque `si no:` y contra el objetivo ya cerrado:
    // con pobj === null (meta propuesta por la app) antes no se ejecutaba nunca
    if ((PC - peso_obj_ef)/PC > 0.25) w('WARN_OBJETIVO_MUY_LEJANO');
    hito = ((PC - peso_obj_ef)/PC > 0.15) ? round05(PC*0.90) : null;
  } else if (objetivo_efectivo === 'ganar') {
    metodo_peso = 'ritmo_16_semanas';
    const ritmo_kg = (kcal - TDEE) * 7 / 7700;
    sugerido_central = round05(PC + ritmo_kg*16);
    sugerido_rango = [round05(PC + ritmo_kg*12), round05(PC + ritmo_kg*20)];
    if (sugerido_central < min185) sugerido_central = roundUp05(min185);
    if (sugerido_rango[0] < min185) sugerido_rango[0] = roundUp05(min185);
    const techo275 = roundDown05(27.5 * h2);
    if (PC / h2 <= 27.5) {                                   // el techo nunca baja la meta por debajo del peso actual
      sugerido_rango[0] = Math.min(sugerido_rango[0], techo275);
      sugerido_rango[1] = Math.min(sugerido_rango[1], techo275);
      sugerido_central  = Math.min(sugerido_central,  techo275);
    }
    sugerido_rango[1] = Math.max(sugerido_rango[1], sugerido_central, sugerido_rango[0]);
    sugerido_central = clamp(sugerido_central, sugerido_rango[0], sugerido_rango[1]);
    mostrar_central = true;
    if (pobj === null) peso_obj_ef = sugerido_central;
    else {
      peso_obj_ef = pobj;
      if (peso_obj_ef / h2 < imc_min) { w('WARN_OBJETIVO_SIGUE_BAJO_PESO'); peso_obj_ef = Math.max(peso_obj_ef, min185); }
      if (peso_obj_ef / h2 > 27.5) { w('WARN_OBJETIVO_IMC_ALTO'); peso_obj_ef = 27.5 * h2; }
      if ((peso_obj_ef - PC)/PC > 0.10) w('WARN_GANANCIA_LEJANA');
    }
    peso_obj_ef = round05(peso_obj_ef);
    if (peso_obj_ef < piso_peso) peso_obj_ef = roundUp05(piso_peso);
    if (peso_obj_ef / h2 > 27.5) {
      // el techo nunca convierte un plan de ganancia en una meta por debajo del peso actual
      peso_obj_ef = Math.max(roundDown05(27.5 * h2), round05(PC), sugerido_central);
      if (peso_obj_ef / h2 > 27.5 && !A.includes('WARN_OBJETIVO_IMC_ALTO')) w('WARN_OBJETIVO_IMC_ALTO');
    }
  } else {
    metodo_peso = 'actual';
    sugerido_central = round05(PC);
    sugerido_rango = [round05(Math.min(lo, PC)), round05(Math.max(hi, PC))];
    mostrar_central = true;
    peso_obj_ef = null;
  }

  // ---- Paso 14
  const _p14 = paso14(objetivo_efectivo, PC, peso_obj_ef, TDEE, kcal, I.fecha_inicio, w);
  const cronograma = _p14.cronograma;
  // regla no expuesta: con 'tca' no se publica proyeccion (la UX ocultaba peso y calendario)
  const proyeccion = condiciones.includes('tca') ? undefined : _p14.proyeccion;

  // ---- Paso 15
  const FFMI = MLG / h2;
  const ref_h = hombre ? 1.80 : 1.70;
  const FFMI_norm = FFMI + 6.3 * (ref_h - h);
  const ffmi_cat_raw = hombre
    ? (FFMI_norm < 18 ? 'bajo' : FFMI_norm < 20 ? 'medio' : FFMI_norm < 22 ? 'bueno' : FFMI_norm < 25 ? 'muy_desarrollado' : 'excepcional')
    : (FFMI_norm < 15 ? 'bajo' : FFMI_norm < 17 ? 'medio' : FFMI_norm < 19 ? 'bueno' : FFMI_norm < 22 ? 'muy_desarrollado' : 'excepcional');
  const ffmi_cat = (banda === 'alto' || banda === 'muy_alto') ? null : ffmi_cat_raw;

  // ---- Paso 16
  const R = REPARTO[I.n_comidas];
  const p = R.p.slice();
  const hcv = p.slice();
  const i_peri = (perfil !== 'sedentario' && T.momento !== null && T.momento !== undefined) ? PERI[I.n_comidas][T.momento] : null;
  const argmax = (arr, skip) => { let bi=-1, bv=-Infinity; for (let i=0;i<arr.length;i++){ if(i===skip) continue; if(arr[i]>bv){bv=arr[i];bi=i;} } return bi; };
  if (i_peri !== null) { hcv[i_peri] += 5; const j = argmax(p, i_peri); hcv[j] -= 5; }
  const principal = argmax(p, -1);
  const repartir = (X, vec) => {
    const parts = vec.map(v => round5(X * v / 100));
    parts[principal] += X - parts.reduce((a,b)=>a+b,0);
    return parts;
  };
  const P_i = repartir(P, p), G_i = repartir(G, p), HC_i = repartir(HC, hcv);
  const comidas = R.nombres.map((n,i) => ({
    nombre: n, hora: HORAS[n], pct_kcal: p[i],
    proteina_g: P_i[i], grasa_g: G_i[i], hc_g: HC_i[i],
    kcal: 4*P_i[i] + 9*G_i[i] + 4*HC_i[i], peri: i === i_peri,
  }));
  if (p.some((v,i) => v >= 20 && P_i[i] < 20)) w('WARN_PROTEINA_POR_TOMA');
  if (P_i.some(v => v > 0.55 * PC)) w('WARN_PROTEINA_TOMA_ALTA');

  // ---- Paso 17
  if (IMC < 18.5) w('WARN_IMC_BAJO');
  if (IMC >= 35 && IMC < 40) w('WARN_IMC_35');
  if (IMC >= 40) w('WARN_IMC_40');
  if (I.edad >= 60 && !es_renal) w('INFO_MAYOR_60');
  if (I.edad >= 60 && es_renal) w('INFO_MAYOR_60_RENAL');
  if (pref_base === 'vegano') w('INFO_VEGANO');
  if (FFMI_norm >= (hombre?22:19) && IMC >= 25 && ['muy_bajo','bajo','medio'].includes(banda)) w('INFO_IMC_MUSCULADO');
  if (fiab === 'baja') w('INFO_GRASA_ESTIMADA');
  if (perfil !== 'sedentario' && dias * T.minutos_sesion / 60 > 10) w('INFO_ALTO_RENDIMIENTO');
  if (kcal < (hombre ? 1800 : 1500)) w('INFO_MICRONUTRIENTES');
  // REGLA (D): la tarjeta informativa y el aviso de seguridad. Se evaluan aqui, contra el
  // objetivo efectivo FINAL y contra el ritmo ELEGIDO (ritmo_ef ya puede venir suavizado por 6.7bis).
  if (menstruacion === 'regular' || menstruacion === 'irregular') w('INFO_CICLO');
  if ((menstruacion === 'irregular' || menstruacion === 'ausente')
      && (objetivo_efectivo === 'perder' || banda === 'muy_bajo' || banda === 'bajo' || I.ritmo === 'agresivo'))
    w('WARN_CICLO_AUSENTE');

  // reevaluacion contra objetivo_efectivo (los avisos del paso 6 vieron el objetivo intermedio)
  let avisos = A.slice();
  if (objetivo_efectivo !== 'perder') avisos = avisos.filter(c => c !== 'WARN_PERDIDA_MAYOR_65');
  // el paso 10bis puede reescribir el objetivo a 'mantener' despues del paso 7: entonces
  // `recomposicion_prioridad` no se publica y el aviso hablaria de un deficit que ya no existe
  if (objetivo_efectivo !== 'recomposicion')
    avisos = avisos.filter(c => c !== 'INFO_RECOMP_PRIORIDAD_PERDER' && c !== 'INFO_RECOMP_PRIORIDAD_GANAR');
  // v1.2: en recomposicion con deficit el peso objetivo SI se usa (es la meta de la proyeccion),
  // asi que decir "no se usa" seria falso. Las calorias siguen saliendo de la tabla 3.9, y eso
  // lo explica INFO_PROYECCION_RECOMP.
  if (objetivo_efectivo === 'recomposicion' && peso_obj_ef !== null)
    avisos = avisos.filter(c => c !== 'INFO_OBJETIVO_IGNORADO');
  // v1.2 PLAZO: los dos avisos hablan de una fecha para una meta de peso. Si el plan final ya no
  // es de perder/ganar, se retiran; si un suavizado de seguridad ha bajado el ritmo que el plazo
  // habia elegido, o si el propio cronograma sale mas largo que el plazo, la promesa deja de ser
  // cierta y el aviso pasa a ser el de plazo irreal.
  if (plazo !== null) {
    if (objetivo_efectivo !== 'perder' && objetivo_efectivo !== 'ganar') {
      avisos = avisos.filter(c => c !== 'INFO_RITMO_POR_PLAZO' && c !== 'WARN_PLAZO_IRREAL');
    } else if (ritmo_plazo !== null) {
      // El calendario del paso 14 manda en las dos direcciones. Si llega de sobra (la banda entera
      // cabe en el plazo) no hay nada que avisar; si no llega, o si NO HAY calendario, la promesa
      // no se puede sostener y el aviso pasa a ser el de plazo irreal.
      const llegaHolgado = cronograma !== null && cronograma.semanas[1] <= plazo;
      if (llegaHolgado) {
        avisos = avisos.filter(c => c !== 'WARN_PLAZO_IRREAL');
        if (ritmo_ef !== ritmo_plazo) avisos = avisos.filter(c => c !== 'INFO_RITMO_POR_PLAZO');
      } else {
        const noLlega = ritmo_ef !== ritmo_plazo || cronograma === null || cronograma.semanas[0] > plazo;
        if (noLlega) {
          avisos = avisos.filter(c => c !== 'INFO_RITMO_POR_PLAZO');
          if (!avisos.includes('WARN_PLAZO_IRREAL')) avisos.push('WARN_PLAZO_IRREAL');
        }
      }
    }
  }

  // supresion de avisos contradictorios
  for (const [trigger, suprimidos] of SUPRESION) {
    if (avisos.includes(trigger)) avisos = avisos.filter(c => !suprimidos.includes(c));
  }

  // filtro de proteccion del cribado TCA (paso 17): no se emiten avisos que enuncien
  // el %grasa, el peso objetivo o el cronograma, que la UX oculta con 'tca'
  if (condiciones.includes('tca')) avisos = avisos.filter(c => !TCA_OCULTOS.includes(c));

  // ---- Paso 18 — limites del ajuste manual (se publican SIEMPRE, tambien sin ajuste).
  // Con 'tca' no hay panel de ajuste: `limites_ajuste` queda undefined y `ajustarMacros` no hace nada.
  const suelo_ea_aj = (banda === 'muy_alto' ? 25 : 30) * MLG + ejercicio_dia;
  const suelo_aj = (objetivo_efectivo === 'perder' || objetivo_efectivo === 'recomposicion')
    ? Math.max(suelo_sexo, BMR, suelo_ea_aj) : suelo_sexo;
  let kcal_min_aj = roundUp10(suelo_aj);
  let kcal_max_aj;
  if (objetivo_efectivo === 'perder') kcal_max_aj = round10(TDEE);
  else { kcal_min_aj = Math.max(kcal_min_aj, round10(0.80 * kcal)); kcal_max_aj = round10(1.20 * kcal); }
  // el plan recomendado SIEMPRE cabe dentro de sus propios limites: el `round10` del paso 7 puede
  // dejarlo hasta 5 kcal por debajo del suelo cuando el suelo no llego a activarse.
  kcal_min_aj = Math.min(kcal_min_aj, kcal);
  kcal_max_aj = Math.max(kcal_max_aj, kcal);
  if (kcal_max_aj < kcal_min_aj) kcal_max_aj = kcal_min_aj;
  const limites_ajuste = condiciones.includes('tca') ? undefined : {
    kcal_recomendada: kcal, hc_recomendado_g: HC, grasa_recomendada_g: G,
    kcal_min: kcal_min_aj, kcal_max: kcal_max_aj, kcal_paso: 50,
    hc_min_ui_g: HC_MIN_AJUSTE, hc_min_motor_g: HC_min,
    suelo_grasa_abs_g: suelo_gkg * base,
    peso_kg: PC, fecha_inicio: I.fecha_inicio,
    kcal_micronutrientes: hombre ? 1800 : 1500,
  };

  return {
    imc: IMC, imc_categoria,
    grasa: { pct: grasa_pct, rango: grasa_rango, fiabilidad: fiab, metodo_efectivo: met_ef, banda,
             referencias: navy === undefined ? { cunbae: clamp(CUNBAE,3,60), deurenberg: clamp(DEURENBERG,3,60) }
                                             : { cunbae: clamp(CUNBAE,3,60), deurenberg: clamp(DEURENBERG,3,60), navy } },
    mlg: MLG,
    bmr: { valor: BMR, ecuacion: bmr_ecuacion, referencias: { mifflin: MIFFLIN, katch: KATCH, harris: HARRIS } },
    tdee: { valor: TDEE, bruto: TDEE_bruto, pal: PAL, ejercicio_dia, perfil },
    objetivo_efectivo, objetivo_propuesto, ritmo_efectivo: ritmo_ef, preferencia_efectiva: pref,
    kcal, kcal_cierre,
    macros: { proteina_g: P, grasa_g: G, hc_g: HC, fibra_g: fibra, azucares_libres_max_g,
              pct: { p: 4*P/kcal, g: 9*G/kcal, hc: 4*HC/kcal },
              gkg: { p: P/PC, g: G/PC, hc: HC/PC },
              base_proteina: base_tipo, base_kg: base, somatotipo: soma, pct_cap },
    agua,
    peso_objetivo: { efectivo: peso_obj_ef, sugerido: sugerido_central, mostrar_central,
                     rango: sugerido_rango, metodo: metodo_peso, hito_intermedio: hito,
                     referencias: { imc22: pesoB, rango_imc: rangoB, clasicas } },
    cronograma,
    ffmi: { valor: FFMI, normalizado: FFMI_norm, categoria: ffmi_cat },
    comidas,
    avisos,
    // ---- v1.1
    preferencia_base: pref_base, restricciones: restr, low_carb: low_carb_ef,
    recomposicion_prioridad: objetivo_efectivo === 'recomposicion' ? recomp_prio : undefined,
    proyeccion, limites_ajuste,
    // ---- v1.2 (Paso 19): copy por sintomas de la regla. No cambia ningun numero.
    ciclo: paso19(avisos.includes('INFO_CICLO'), I.sintomas_regla, pref_base, restr, low_carb_ef, I.alimentos_excluidos),
    // ---- campos de diagnostico del verificador (no forman parte de `Resultado`)
    _dbg: { met: MET, kcal_sesion, gkg, P_cap, suelo_g, techo_g, pesoA, cierre_ok, ejercicio_dia, MET },
  };
}

// ================================================================= Paso 18 — ajuste manual (B)
// `ajustarMacros` NO lee `R.macros.grasa_g` ni `R.macros.hc_g`: parte siempre de los valores
// recomendados que viajan en `limites_ajuste`, asi que es idempotente respecto al origen
//   ajustarMacros(ajustarMacros(R, a1), a2) === ajustarMacros(R, a2)
// y con `ajuste` vacio devuelve exactamente el plan recomendado.
const AVISOS_AJUSTE = ['INFO_AJUSTE_MANUAL','WARN_HC_BAJO_MINIMO','WARN_KCAL_AJUSTE_ALTA'];

function ajustarMacros(R, ajuste) {
  if (!R || R.excluido || !R.limites_ajuste) return R;
  const L = R.limites_ajuste;
  const P = R.macros.proteina_g;                 // la PROTEINA no se toca nunca
  const TDEE = R.tdee.valor, obje = R.objetivo_efectivo, PC = L.peso_kg;

  // 1) calorias: multiplo de 10, dentro de [kcal_min, kcal_max]
  const kcal_ped = (ajuste && ajuste.kcal !== undefined && ajuste.kcal !== null) ? ajuste.kcal : L.kcal_recomendada;
  const kcal = clamp(round10(kcal_ped), L.kcal_min, L.kcal_max);

  // 2) hidratos: multiplo de 5, entre 30 g y lo que deja el SUELO de grasa del paso 9
  const suelo_g = Math.max(L.suelo_grasa_abs_g, 0.20 * kcal / 9);
  // el techo se calcula contra el suelo YA REDONDEADO, que es el valor que el punto 3 acaba
  // poniendo en la grasa: contra el suelo exacto se colaban hasta 5 g (45 kcal) y el cierre se
  // salia del 2 % con kcal bajas. Asi G nunca cae por debajo del suelo.
  const suelo_red_g = roundUp5(suelo_g);
  // el redondeo a 5 g del paso 10 puede dejar `hc_recomendado_g` hasta 2,5 g por encima de la cota
  // exacta: sin esta linea, "volver a lo recomendado" no devolvia el plan recomendado.
  let hc_max = roundDown5((kcal - 4*P - 9*suelo_red_g) / 4);
  if (kcal === L.kcal_recomendada) hc_max = Math.max(hc_max, L.hc_recomendado_g);
  const hc_lo  = Math.min(L.hc_min_ui_g, hc_max);          // el suelo de grasa manda sobre los 30 g
  const hc_ped = (ajuste && ajuste.hc_g !== undefined && ajuste.hc_g !== null) ? ajuste.hc_g : L.hc_recomendado_g;
  const HC = clamp(round5(hc_ped), hc_lo, hc_max);

  const cambia_kcal = kcal !== L.kcal_recomendada;
  const cambia_hc   = HC   !== L.hc_recomendado_g;
  const ajustado    = cambia_kcal || cambia_hc;

  // 3) grasa = el resto. Sin ajuste se restituye EXACTAMENTE la del plan recomendado.
  let G;
  if (!ajustado) G = L.grasa_recomendada_g;
  else { G = round5((kcal - 4*P - 4*HC) / 9); if (G < suelo_red_g) G = suelo_red_g; }
  const kcal_cierre = 4*P + 4*HC + 9*G;
  if (Math.abs(kcal_cierre - kcal) > 0.02 * kcal) throw new Error('paso 18: cierre kcal fuera del 2 %');

  // avisos: se retira todo lo que el ajuste puede cambiar y se vuelve a evaluar
  const REEVALUAR = [...AVISOS_AJUSTE, ...CRONO_FAMILIA, 'INFO_FIBRA_AJUSTADA', 'INFO_MICRONUTRIENTES', 'WARN_DEFICIT_MINIMO'];
  let avisos = (R.avisos || []).filter(c => !REEVALUAR.includes(c));
  const w = (c) => { if (!avisos.includes(c)) avisos.push(c); };

  // paso 11 con las kcal y los HC ajustados
  const fibra_prop = 14 * kcal / 1000;
  const suelo_fibra = R.low_carb ? Math.max(20, 10 * kcal / 1000) : Math.min(25, 0.15 * HC);
  const fibra = Math.round(clamp(fibra_prop, suelo_fibra, 40));
  if (fibra < 25) w('INFO_FIBRA_AJUSTADA');
  if (kcal < L.kcal_micronutrientes) w('INFO_MICRONUTRIENTES');

  // paso 14 con las kcal ajustadas (misma funcion que usa `calcular`)
  const { cronograma, proyeccion } = paso14(obje, PC, R.peso_objetivo.efectivo, TDEE, kcal, L.fecha_inicio, w);

  // paso 16: mismos porcentajes y misma comida peri; la proteina por toma no cambia
  const p = R.comidas.map(c => c.pct_kcal);
  const i_peri = R.comidas.findIndex(c => c.peri);
  const hcv = p.slice();
  const argmax = (arr, skip) => { let bi=-1,bv=-Infinity; for(let i=0;i<arr.length;i++){ if(i===skip) continue; if(arr[i]>bv){bv=arr[i];bi=i;} } return bi; };
  if (i_peri !== -1) { hcv[i_peri] += 5; hcv[argmax(p, i_peri)] -= 5; }
  const principal = argmax(p, -1);
  const repartir = (X, vec) => { const parts = vec.map(v => round5(X*v/100)); parts[principal] += X - parts.reduce((a,b)=>a+b,0); return parts; };
  const P_i = repartir(P, p), G_i = repartir(G, p), HC_i = repartir(HC, hcv);
  const comidas = R.comidas.map((c,i) => ({ ...c, proteina_g:P_i[i], grasa_g:G_i[i], hc_g:HC_i[i],
    kcal: 4*P_i[i] + 9*G_i[i] + 4*HC_i[i] }));

  // avisos propios del paso 18
  if (ajustado) w('INFO_AJUSTE_MANUAL');
  if (HC < L.hc_min_motor_g) w('WARN_HC_BAJO_MINIMO');
  // solo si el usuario ha movido de verdad la palanca de las kcal: si no, el plan es el del motor
  // y este aviso borraria por supresion el WARN_DEFICIT_MINIMO honesto que venia de calcular()
  if (cambia_kcal && obje === 'perder' && TDEE - kcal < 100) w('WARN_KCAL_AJUSTE_ALTA');
  if (obje === 'perder' && TDEE - kcal >= 50 && TDEE - kcal < 100) w('WARN_DEFICIT_MINIMO');

  for (const [t, sup] of SUPRESION)
    if (avisos.includes(t)) avisos = avisos.filter(c => !sup.includes(c));

  const out = { ...R, kcal, kcal_cierre, comidas, cronograma, proyeccion, avisos,
    macros: { ...R.macros, grasa_g:G, hc_g:HC, fibra_g:fibra, azucares_libres_max_g: 0.10*kcal/4,
              pct: { p: 4*P/kcal, g: 9*G/kcal, hc: 4*HC/kcal },
              gkg: { p: P/PC, g: G/PC, hc: HC/PC } },
    ajuste: { kcal: cambia_kcal, hc: cambia_hc } };
  if (!ajustado) delete out.ajuste;
  return out;
}

// ================================================================= vectores §5
const F = '2026-09-07';
const B = { clima_caluroso:false, embarazo_lactancia:false, condiciones:[], fecha_inicio:F,
            peso_objetivo:null, somatotipo:null, ritmo:'moderado', preferencia:'omnivoro', cribado_tca:null };
const ent = (o) => ({ tipo:'ninguno', dias_semana:0, minutos_sesion:0, intensidad:'media', experiencia:'novato', momento:null, ...o });

const CASOS = [
  { n:'1', in:{ ...B, sexo:'hombre', edad:32, altura_cm:178, peso_kg:84, grasa:{metodo:'desconocido'},
      somatotipo:{q1:'media',q2:'moderada',q3:'moderada',q4:'atletico'}, actividad_diaria:'ligero',
      entrenamiento:ent({tipo:'fuerza',dias_semana:4,minutos_sesion:60,intensidad:'media',experiencia:'intermedio',momento:'tarde'}),
      objetivo:'perder', ritmo:'moderado', n_comidas:4 } },

  { n:'2', in:{ ...B, sexo:'mujer', edad:28, altura_cm:165, peso_kg:60,
      grasa:{metodo:'medidas',cuello_cm:32,cintura_cm:72,cadera_cm:96},
      somatotipo:{q1:'fina',q2:'poca',q3:'moderada',q4:'delgado'}, actividad_diaria:'sedentario',
      entrenamiento:ent({tipo:'cardio',dias_semana:3,minutos_sesion:45,intensidad:'media',experiencia:'novato',momento:'manana'}),
      objetivo:'recomposicion', ritmo:'moderado', preferencia:'vegetariano', n_comidas:3, condiciones:['tca'] } },

  { n:'3', in:{ ...B, sexo:'hombre', edad:45, altura_cm:172, peso_kg:105, grasa:{metodo:'desconocido'},
      somatotipo:{q1:'ancha',q2:'mucha',q3:'moderada',q4:'robusto'}, actividad_diaria:'sedentario',
      entrenamiento:ent({}), objetivo:'perder', ritmo:'agresivo', peso_objetivo:85, n_comidas:3 } },

  { n:'4', in:{ ...B, sexo:'mujer', edad:52, altura_cm:160, peso_kg:82,
      grasa:{metodo:'visual',categoria:'sobrepeso_visible'}, somatotipo:null, actividad_diaria:'moderado',
      entrenamiento:ent({tipo:'mixto',dias_semana:2,minutos_sesion:45,intensidad:'baja',experiencia:'novato',momento:'mediodia'}),
      objetivo:'no_se', ritmo:'suave', preferencia:'sin_lactosa', n_comidas:5, condiciones:['diabetes'] } },

  { n:'5', in:{ ...B, sexo:'hombre', edad:68, altura_cm:175, peso_kg:78,
      grasa:{metodo:'conocido',valor:24,fuente:'fiable'},
      somatotipo:{q1:'media',q2:'moderada',q3:'mucha',q4:'atletico'}, actividad_diaria:'ligero',
      entrenamiento:ent({tipo:'fuerza',dias_semana:3,minutos_sesion:45,intensidad:'baja',experiencia:'novato',momento:'manana'}),
      objetivo:'mantener', n_comidas:3 } },

  { n:'6', in:{ ...B, sexo:'mujer', edad:35, altura_cm:170, peso_kg:56,
      grasa:{metodo:'conocido',valor:21,fuente:'estimado'},
      somatotipo:{q1:'fina',q2:'poca',q3:'poca',q4:'delgado'}, actividad_diaria:'sedentario',
      entrenamiento:ent({tipo:'fuerza',dias_semana:3,minutos_sesion:60,intensidad:'media',experiencia:'novato',momento:'tarde'}),
      objetivo:'ganar', ritmo:'moderado', peso_objetivo:60, n_comidas:4 } },

  { n:'7', in:{ ...B, sexo:'hombre', edad:40, altura_cm:180, peso_kg:92, grasa:{metodo:'desconocido'},
      somatotipo:{q1:'ancha',q2:'mucha',q3:'moderada',q4:'robusto'}, actividad_diaria:'alto',
      entrenamiento:ent({tipo:'cardio',dias_semana:2,minutos_sesion:40,intensidad:'media',experiencia:'intermedio',momento:'noche'}),
      objetivo:'perder', ritmo:'moderado', peso_objetivo:80, preferencia:'low_carb', n_comidas:3, clima_caluroso:true } },

  { n:'8', in:{ ...B, sexo:'mujer', edad:29, altura_cm:162, peso_kg:66,
      grasa:{metodo:'visual',categoria:'media'},
      somatotipo:{q1:'media',q2:'moderada',q3:'moderada',q4:'atletico'}, actividad_diaria:'sedentario',
      entrenamiento:ent({}), objetivo:'perder', ritmo:'agresivo', peso_objetivo:48, preferencia:'vegano', n_comidas:2 } },

  { n:'9', in:{ ...B, sexo:'hombre', edad:25, altura_cm:185, peso_kg:70, grasa:{metodo:'desconocido'},
      somatotipo:{q1:'fina',q2:'poca',q3:'poca',q4:'delgado'}, actividad_diaria:'sedentario',
      entrenamiento:ent({tipo:'fuerza',dias_semana:5,minutos_sesion:75,intensidad:'alta',experiencia:'novato',momento:'noche'}),
      objetivo:'ganar', ritmo:'agresivo', n_comidas:6 } },

  // vectores nuevos exigidos por la revision adversaria
  { n:'10', titulo:'obesidad + agresivo con kcal bajas (bucle de factibilidad)',
    in:{ ...B, sexo:'mujer', edad:30, altura_cm:150, peso_kg:70, grasa:{metodo:'visual',categoria:'obesidad_visible'},
      actividad_diaria:'sedentario', entrenamiento:ent({}), objetivo:'perder', ritmo:'agresivo', n_comidas:3 } },
  { n:'11', titulo:'suelo por encima del TDEE en perder (regla de margen del paso 7)',
    in:{ ...B, sexo:'hombre', edad:25, altura_cm:195, peso_kg:100, grasa:{metodo:'conocido',valor:8,fuente:'fiable'},
      actividad_diaria:'sedentario', entrenamiento:ent({}), objetivo:'perder', ritmo:'moderado', n_comidas:3 } },
  { n:'12', titulo:'borde exacto de la banda medio sin peso objetivo (WARN_YA_EN_OBJETIVO)',
    in:{ ...B, sexo:'hombre', edad:35, altura_cm:180, peso_kg:80, grasa:{metodo:'conocido',valor:15,fuente:'estimado'},
      actividad_diaria:'ligero', entrenamiento:ent({tipo:'fuerza',dias_semana:3,minutos_sesion:60,intensidad:'media',experiencia:'intermedio',momento:'tarde'}),
      objetivo:'perder', ritmo:'moderado', n_comidas:4 } },
  { n:'13', titulo:'renal con IMC >= 30 (cap renal como ultimo filtro)',
    in:{ ...B, sexo:'hombre', edad:62, altura_cm:170, peso_kg:95, grasa:{metodo:'desconocido'},
      actividad_diaria:'ligero', entrenamiento:ent({tipo:'fuerza',dias_semana:3,minutos_sesion:45,intensidad:'media',experiencia:'novato',momento:'manana'}),
      objetivo:'perder', ritmo:'moderado', n_comidas:3, condiciones:['renal'] } },
  { n:'14', titulo:'usuario de 70 anos con perder',
    in:{ ...B, sexo:'mujer', edad:70, altura_cm:158, peso_kg:75, grasa:{metodo:'desconocido'},
      actividad_diaria:'ligero', entrenamiento:ent({tipo:'fuerza',dias_semana:2,minutos_sesion:40,intensidad:'baja',experiencia:'novato',momento:'manana'}),
      objetivo:'perder', ritmo:'agresivo', n_comidas:4 } },

  // vectores nuevos de la v1.1
  { n:'15', titulo:'proyeccion, regla irregular y preferencias combinables (D, E, F)',
    in:{ ...B, sexo:'mujer', edad:34, altura_cm:168, peso_kg:78, grasa:{metodo:'desconocido'},
      somatotipo:null, actividad_diaria:'ligero',
      entrenamiento:ent({tipo:'fuerza',dias_semana:3,minutos_sesion:50,intensidad:'media',experiencia:'intermedio',momento:'tarde'}),
      objetivo:'perder', ritmo:'agresivo', peso_objetivo:68, n_comidas:4,
      preferencia_base:'omnivoro', restricciones:['sin_lactosa'], low_carb:false, menstruacion:'irregular' } },
  { n:'16', titulo:'recomposicion con prioridad perder + ajuste manual (B, C)',
    in:{ ...B, sexo:'mujer', edad:31, altura_cm:165, peso_kg:64, grasa:{metodo:'conocido',valor:27,fuente:'fiable'},
      somatotipo:null, actividad_diaria:'ligero',
      entrenamiento:ent({tipo:'fuerza',dias_semana:4,minutos_sesion:55,intensidad:'media',experiencia:'intermedio',momento:'tarde'}),
      objetivo:'recomposicion', ritmo:'moderado', n_comidas:4,
      preferencia_base:'omnivoro', restricciones:[], low_carb:false,
      recomposicion_prioridad:'perder', menstruacion:'regular' },
    ajuste:{ hc_g:120 } },

  // vectores nuevos de la v1.2 (G, H, I)
  { n:'17', titulo:'recomposicion con prioridad perder y peso objetivo (proyeccion de recomposicion)',
    in:{ ...B, sexo:'mujer', edad:45, altura_cm:165, peso_kg:68,
      grasa:{metodo:'medidas',cuello_cm:33,cintura_cm:82,cadera_cm:102},
      somatotipo:null, actividad_diaria:'ligero',
      entrenamiento:ent({tipo:'fuerza',dias_semana:3,minutos_sesion:45,intensidad:'media',experiencia:'novato',momento:'tarde'}),
      objetivo:'recomposicion', ritmo:'moderado', peso_objetivo:63, n_comidas:4,
      preferencia_base:'omnivoro', restricciones:[], low_carb:false,
      recomposicion_prioridad:'perder', menstruacion:'regular',
      sintomas_regla:['sangrado_abundante','cansancio','hinchazon'],
      // el motor IGNORA estos tres campos: la comprobacion S33 exige el mismo Resultado sin ellos
      menu_sencillo:true, alimentos_excluidos:['brocoli','coliflor'], alimentos_favoritos:['pechuga_pollo','arroz_blanco_cocido'] } },
  { n:'18', titulo:'perder con plazo imposible (agresivo + WARN_PLAZO_IRREAL)',
    in:{ ...B, sexo:'hombre', edad:38, altura_cm:180, peso_kg:95, grasa:{metodo:'desconocido'},
      somatotipo:null, actividad_diaria:'sedentario', entrenamiento:ent({}),
      objetivo:'perder', ritmo:'suave', peso_objetivo:80, plazo_semanas:8, n_comidas:3,
      preferencia_base:'omnivoro', restricciones:[], low_carb:false } },
  { n:'19', titulo:'perder con plazo holgado (el plazo elige el ritmo mas suave que llega)',
    in:{ ...B, sexo:'mujer', edad:34, altura_cm:168, peso_kg:78, grasa:{metodo:'desconocido'},
      somatotipo:null, actividad_diaria:'ligero',
      entrenamiento:ent({tipo:'fuerza',dias_semana:3,minutos_sesion:50,intensidad:'media',experiencia:'intermedio',momento:'tarde'}),
      objetivo:'perder', ritmo:'agresivo', peso_objetivo:72, plazo_semanas:24, n_comidas:4,
      preferencia_base:'omnivoro', restricciones:[], low_carb:false } },
  { n:'20', titulo:'perder con meta por debajo del suelo y plazo (el ritmo se mide contra la meta EFECTIVA)',
    in:{ ...B, sexo:'hombre', edad:38, altura_cm:150, peso_kg:55, grasa:{metodo:'desconocido'},
      somatotipo:null, actividad_diaria:'ligero',
      entrenamiento:ent({tipo:'fuerza',dias_semana:3,minutos_sesion:50,intensidad:'media',experiencia:'intermedio',momento:'tarde'}),
      objetivo:'perder', ritmo:'moderado', peso_objetivo:38, plazo_semanas:24, n_comidas:3,
      preferencia_base:'omnivoro', restricciones:[], low_carb:false } },
];

// ---------------------------------------------------------------- modo --json
const argv = process.argv.slice(2);
const jix = argv.indexOf('--json');
if (jix !== -1) {
  const which = argv[jix + 1] || '1';
  const caso = CASOS.find(c => c.n === String(which));
  if (!caso) { console.error('Caso desconocido: ' + which); process.exit(2); }
  const r = calcular(caso.in);
  delete r._dbg;
  console.log(JSON.stringify(r, null, 2));
  process.exit(0);
}

// modo --data: vuelca todos los casos (con intermedios) para regenerar la §5 del documento
if (argv.includes('--data')) {
  console.log(JSON.stringify(CASOS.map(c => ({ n:c.n, titulo:c.titulo || null, r: calcular(c.in) })), null, 1));
  process.exit(0);
}

// ---------------------------------------------------------------- Caso 0
const excl = (o) => calcular({ ...B, sexo:'hombre', edad:30, altura_cm:175, peso_kg:70, grasa:{metodo:'desconocido'},
  actividad_diaria:'sedentario', entrenamiento:ent({}), objetivo:'perder', n_comidas:3, ...o });
let fails = 0; const bad = [];
const chk = (caso, campo, got, exp) => {
  if (JSON.stringify(got) !== JSON.stringify(exp)) { fails++; bad.push(`Caso ${caso}  ${campo}: ${JSON.stringify(got)} != ${JSON.stringify(exp)}`); }
};
chk('0a','excluido', excl({edad:16}).excluido, 'EXCL_EDAD');
chk('0b','excluido', excl({edad:76}).excluido, 'EXCL_EDAD');
chk('0c','excluido', excl({sexo:'mujer', embarazo_lactancia:true, peso_kg:60}).excluido, 'EXCL_EMBARAZO_LACTANCIA');
chk('0d','excluido', excl({altura_cm:180, peso_kg:50}).excluido, 'EXCL_IMC_MUY_BAJO');
chk('0e','excluido', excl({altura_cm:180, peso_kg:58, condiciones:['tca']}).excluido, 'EXCL_TCA_RIESGO');
chk('0f','excluido', excl({peso_kg:400}).excluido, 'ERR_INPUT_RANGO');
// dominio de los campos nuevos de la v1.2 (§1 filas 24-27): ausente o null siempre es valido
chk('0g','errores', excl({plazo_semanas:3}).errores, ['plazo_semanas']);
chk('0h','errores', excl({sintomas_regla:['migrana']}).errores, ['sintomas_regla']);
chk('0i','errores', excl({alimentos_excluidos:[7]}).errores, ['alimentos_excluidos']);
chk('0j','excluido', excl({plazo_semanas:null, sintomas_regla:null, alimentos_favoritos:null}).excluido, undefined);
// el motor IGNORA `menu_sencillo` y las dos listas de alimentos: mismo Resultado bit a bit
{
  const c17 = CASOS.find((c) => c.n === '17').in;
  const sinRuido = { ...c17 };
  delete sinRuido.menu_sencillo; delete sinRuido.alimentos_excluidos; delete sinRuido.alimentos_favoritos;
  chk('17','campos ignorados por el motor', JSON.stringify(calcular(sinRuido)), JSON.stringify(calcular(c17)));
}

// ---------------------------------------------------------------- salida legible
const R2 = (x) => x.toFixed(1);
const filas = [];
for (const c of CASOS) {
  const r = calcular(c.in);
  const d = r._dbg, m = r.macros;
  console.log(`\n=== Caso ${c.n}${c.titulo ? ' — ' + c.titulo : ''} ===`);
  console.log(` IMC ${R2(r.imc)} ${r.imc_categoria} | grasa ${R2(r.grasa.pct)}% (${r.grasa.fiabilidad}, ${r.grasa.banda}) | CUNBAE ${R2(r.grasa.referencias.cunbae)} DEU ${R2(r.grasa.referencias.deurenberg)}${r.grasa.referencias.navy!==undefined?' NAVY '+R2(r.grasa.referencias.navy):''}`);
  console.log(` MLG ${r.mlg.toFixed(2)} | Mifflin ${R2(r.bmr.referencias.mifflin)} Katch ${R2(r.bmr.referencias.katch)} Harris ${R2(r.bmr.referencias.harris)} -> BMR ${R2(r.bmr.valor)} (${r.bmr.ecuacion})`);
  console.log(` perfil ${r.tdee.perfil} PAL ${r.tdee.pal} MET ${d.met} sesion ${R2(d.kcal_sesion)} ejdia ${R2(r.tdee.ejercicio_dia)} bruto ${R2(r.tdee.bruto)} TDEE ${R2(r.tdee.valor)}`);
  console.log(` obj_ef ${r.objetivo_efectivo}/${r.ritmo_efectivo} | kcal ${r.kcal} cierre ${r.kcal_cierre} ok=${d.cierre_ok}`);
  console.log(` P ${m.proteina_g} G ${m.grasa_g} HC ${m.hc_g} (base ${m.base_kg.toFixed(2)} ${m.base_proteina}, gkg ${d.gkg.toFixed(3)}) fibra ${m.fibra_g} azucares ${R2(m.azucares_libres_max_g)} agua ${r.agua ? r.agua.ml + ' (' + r.agua.vasos + ' vasos, ' + r.agua.rango.join('-') + ')' : 'null'}`);
  console.log(` pesoA ${R2(d.pesoA)} sug ${r.peso_objetivo.sugerido} rango [${r.peso_objetivo.rango.join(', ')}] central=${r.peso_objetivo.mostrar_central} ef ${r.peso_objetivo.efectivo===null?'-':r.peso_objetivo.efectivo} hito ${r.peso_objetivo.hito_intermedio}`);
  console.log(` FFMI ${R2(r.ffmi.valor)} norm ${R2(r.ffmi.normalizado)} ${r.ffmi.categoria}`);
  if (r.cronograma) { const cg = r.cronograma;
    console.log(` crono ${cg.ritmo_kg_sem.toFixed(4)} kg/sem (${cg.ritmo_pct_sem.toFixed(2)}%) delta ${cg.delta_kg.toFixed(2)} semanas ${JSON.stringify(cg.semanas)} breaks ${cg.diet_breaks} ${cg.fecha_min}..${cg.fecha_max} prec=${cg.precision_fecha} tramo12=${JSON.stringify(cg.tramo_12sem)}`);
  } else console.log(' crono null');
  console.log(' comidas ' + r.comidas.map(x=>`${x.nombre}@${x.hora}:${x.pct_kcal}% P${x.proteina_g} G${x.grasa_g} HC${x.hc_g} ${x.kcal}kcal${x.peri?' [peri]':''}`).join(' | '));
  console.log(' avisos ' + JSON.stringify(r.avisos.slice().sort()));
  console.log(' pref base=' + r.preferencia_base + ' restr=' + JSON.stringify(r.restricciones)
    + ' low_carb=' + r.low_carb + ' -> efectiva ' + r.preferencia_efectiva
    + (r.recomposicion_prioridad ? ' | prioridad ' + r.recomposicion_prioridad : ''));
  if (r.ciclo) console.log(' ciclo ' + JSON.stringify(r.ciclo.sintomas)
    + ' -> ' + r.ciclo.consejos.map(x => x.clave + ' [' + x.alimentos.join(', ') + ']').join(' | '));
  if (r.proyeccion) {
    const ultima = r.proyeccion[r.proyeccion.length-1].semana;
    const hitos = r.proyeccion.filter(x => [0,4,8,12,26,ultima].includes(x.semana));
    console.log(' proyeccion (' + r.proyeccion.length + ' puntos, hasta la semana ' + r.proyeccion[r.proyeccion.length-1].semana + ')');
    console.log('   ' + hitos.map(x => `s${x.semana}: ${x.peso_min}/${x.peso_esp}/${x.peso_max}`).join(' | '));
  } else console.log(' proyeccion undefined');
  if (r.limites_ajuste) { const L = r.limites_ajuste;
    console.log(` ajuste: kcal [${L.kcal_min}, ${L.kcal_max}] paso ${L.kcal_paso} | HC min UI ${L.hc_min_ui_g} motor ${L.hc_min_motor_g} | suelo grasa abs ${L.suelo_grasa_abs_g.toFixed(1)} g`);
  }
  if (c.ajuste) {
    const ra = ajustarMacros(r, c.ajuste);
    console.log(' AJUSTE ' + JSON.stringify(c.ajuste) + ' -> kcal ' + ra.kcal + ' cierre ' + ra.kcal_cierre
      + ' | P ' + ra.macros.proteina_g + ' G ' + ra.macros.grasa_g + ' HC ' + ra.macros.hc_g + ' fibra ' + ra.macros.fibra_g
      + ' | ajuste ' + JSON.stringify(ra.ajuste));
    console.log('   comidas ' + ra.comidas.map(x=>`${x.nombre}:P${x.proteina_g} G${x.grasa_g} HC${x.hc_g} ${x.kcal}kcal`).join(' | '));
    console.log('   avisos ' + JSON.stringify(ra.avisos.slice().sort()));
    if (ra.cronograma) console.log('   crono ' + JSON.stringify(ra.cronograma.semanas) + ' ' + ra.cronograma.fecha_min + '..' + ra.cronograma.fecha_max);
    // idempotencia respecto al origen y vuelta exacta a lo recomendado
    const vuelta = ajustarMacros(ra, {});
    if (vuelta.ajuste !== undefined || vuelta.kcal !== r.kcal || vuelta.macros.grasa_g !== r.macros.grasa_g
        || vuelta.macros.hc_g !== r.macros.hc_g || vuelta.macros.fibra_g !== r.macros.fibra_g) {
      fails++; bad.push(`Caso ${c.n}  "volver a lo recomendado" no restituye el plan original`);
    }
    const doble = ajustarMacros(ra, c.ajuste);
    if (JSON.stringify(doble) !== JSON.stringify(ra)) { fails++; bad.push(`Caso ${c.n}  ajustarMacros no es idempotente`); }
  }
  if (!d.cierre_ok) { fails++; bad.push(`Caso ${c.n}  cierre kcal fuera de tolerancia 2%`); }
  filas.push([c.n, r.kcal, m.proteina_g, m.grasa_g, m.hc_g, m.fibra_g,
    r.agua ? r.agua.ml : 'null',
    r.peso_objetivo.efectivo === null ? '—' : r.peso_objetivo.efectivo,
    r.cronograma ? r.cronograma.semanas.join('–') : '—', r.bmr.ecuacion]);

  // comprobaciones estructurales de la tabla de supresion
  for (const [t, sup] of SUPRESION)
    if (r.avisos.includes(t)) for (const s of sup)
      if (r.avisos.includes(s)) { fails++; bad.push(`Caso ${c.n}  supresion violada: ${t} + ${s}`); }
}

console.log('\n================ RESUMEN DE SALIDAS ================');
console.log('| Caso | kcal | P g | G g | HC g | Fibra | Agua ml | Peso obj. ef. | Semanas | BMR ecuación |');
console.log('|---|---|---|---|---|---|---|---|---|---|');
for (const f of filas) console.log('| ' + f.join(' | ') + ' |');

console.log('\n================ VECTORES ================');
if (fails === 0) console.log('OK: ' + CASOS.length + ' vectores + exclusiones sin incoherencias internas.');
else { console.log('FALLOS: ' + fails); for (const b of bad) console.log('  - ' + b); }

// ============ BARRIDO EXHAUSTIVO DE INVARIANTES DE SEGURIDAD ============
// La rejilla cubre TODO el dominio declarado en la §1 (altura 130-230, peso 35-300): con la
// rejilla anterior (150-195 cm, 45-180 kg) los perfiles de IMC > 55 —los unicos en los que
// 1,2 · PA < 0,8 · PC— no se generaban nunca y S5a no podia ver el fallo de `P_min`.
const sexos=['hombre','mujer'], edades=[18,25,45,60,65,75], alturas=[130,150,165,178,195,230], pesos=[35,45,60,84,95,120,180,300];
const metodos=[{metodo:'desconocido'},{metodo:'conocido',valor:8,fuente:'fiable'},{metodo:'conocido',valor:45,fuente:'estimado'},{metodo:'visual',categoria:null}];
const acts=['sedentario','ligero','moderado','alto','muy_alto'];
const tipos=['ninguno','fuerza','cardio','mixto'];
const objs=['perder','mantener','ganar','recomposicion','no_se'];
const ritmos=['suave','moderado','agresivo'];
const prefs=['omnivoro','vegetariano','vegano','sin_lactosa','sin_gluten','low_carb'];
const conds=[[],['renal'],['tca'],['diabetes','hepatica'],['renal','tca'],['cardiaca'],['hipertension','tiroides'],['bariatrica'],['glp1','otra']];
const soms=[null,{q1:'fina',q2:'poca',q3:'poca',q4:'delgado'},{q1:'ancha',q2:'mucha',q3:'moderada',q4:'robusto'},{q1:'media',q2:'moderada',q3:'mucha',q4:'atletico'}];
// v1.1: el barrido recorre los dos formatos de preferencia (antiguo y combinable) y los campos nuevos
const bases=[null,'omnivoro','vegetariano','vegano'];
const restrs=[[],['sin_lactosa'],['sin_gluten'],['sin_lactosa','sin_gluten']];
const prios=[null,'perder','equilibrado','ganar'];
const regla=[null,'regular','irregular','ausente','no_dice'];
// v1.2
const plazos=[null,null,4,8,12,16,24,52];
const sintomas=[null,[],['dolor'],['hinchazon','antojos'],['sangrado_abundante','cansancio'],
  ['dolor','hinchazon','antojos','cansancio','sangrado_abundante'],['cansancio','dolor']];
const ajustes=[null,{},{kcal:-9999},{kcal:9999},{hc_g:0},{hc_g:9999},{kcal:1800,hc_g:60},{hc_g:30},{kcal:2000}];

const V = {};
const viol = (k, ctx) => { (V[k] = V[k] || []).push(ctx); };
let n = 0;
const rnd = (() => { let s = 12345; return () => (s = (s*1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; })();
const pick = (a) => a[Math.floor(rnd()*a.length)];

for (let iter = 0; iter < 200000; iter++) {
  const sexo = pick(sexos), hombre = sexo === 'hombre';
  let g = pick(metodos);
  if (g.metodo === 'visual') g = { metodo:'visual', categoria: hombre ? pick(Object.keys(VISUAL_H)) : pick(Object.keys(VISUAL_M)) };
  const tipo = pick(tipos);
  const dias = tipo === 'ninguno' ? 0 : Math.floor(rnd()*8);
  const I = {
    sexo, edad: pick(edades), altura_cm: pick(alturas), peso_kg: pick(pesos), grasa: g,
    somatotipo: pick(soms), actividad_diaria: pick(acts),
    entrenamiento: { tipo, dias_semana:dias, minutos_sesion: pick([10,45,60,120,240]), intensidad: pick(['baja','media','alta']), experiencia: pick(['novato','intermedio','avanzado']), momento: pick(['manana','mediodia','tarde','noche',null]) },
    objetivo: pick(objs), ritmo: pick(ritmos), peso_objetivo: pick([null, 30, 48, 60, 85, 120, 300]),
    preferencia: pick(prefs), n_comidas: pick([2,3,4,5,6]), clima_caluroso: rnd()<0.3,
    embarazo_lactancia:false, condiciones: pick(conds), fecha_inicio:F, cribado_tca:null,
  };
  const base_pick = pick(bases);
  if (base_pick !== null) {                      // formato combinable; si no, formato antiguo
    I.preferencia_base = base_pick;
    I.restricciones = pick(restrs);
    I.low_carb = rnd() < 0.25;
  }
  I.recomposicion_prioridad = pick(prios);
  I.menstruacion = pick(regla);
  I.plazo_semanas = pick(plazos);
  I.sintomas_regla = pick(sintomas);
  let r;
  try { r = calcular(I); } catch (e) { viol('EXCEPCION: ' + e.message, I); continue; }
  if (r.excluido) continue;
  n++;
  const m = r.macros, obje = r.objetivo_efectivo, deficit = (obje==='perder'||obje==='recomposicion');
  const hom = hombre, h2 = (I.altura_cm/100)**2;
  const pref_ef = r.preferencia_efectiva;          // el banco que publica el motor (regla inversa §1)
  const ctx = { ...I, kcal:r.kcal, P:m.proteina_g, G:m.grasa_g, HC:m.hc_g, obj:obje, banda:r.grasa.banda,
                bmr:Math.round(r.bmr.valor), tdee:Math.round(r.tdee.valor) };

  // S1 suelo absoluto por sexo (todas las ramas)
  if (r.kcal < (hom?1500:1200)) viol('S1 kcal < suelo sexo', ctx);
  // S2 nunca por debajo del BMR en deficit
  if (deficit && r.kcal < Math.floor(r.bmr.valor/10)*10) viol('S2 kcal < BMR', ctx);
  // S3 disponibilidad energetica (30, o 25 en muy_alto)
  if (deficit) {
    const umbral = r.grasa.banda === 'muy_alto' ? 25 : 30;
    const ea = (r.kcal - r.tdee.ejercicio_dia) / r.mlg;
    if (ea < umbral - 0.06) viol('S3 EA < ' + umbral + ' kcal/kg MLG', { ...ctx, ea:ea.toFixed(2) });
  }
  // S4 deficit nunca supera el techo % TDEE
  if (obje === 'perder') {
    const cap = ((r.grasa.banda==='muy_alto'?0.30:0.25) * (I.edad>=65?Math.min(1,0.20/(r.grasa.banda==='muy_alto'?0.30:0.25)):1)) * r.tdee.valor;
    if (r.tdee.valor - r.kcal > cap + 10.001) viol('S4 deficit > techo TDEE', { ...ctx, def:(r.tdee.valor-r.kcal).toFixed(1), cap:cap.toFixed(1) });
  }
  // S5 proteina: RDA 0.8 g/kg PC (salvo renal) y techos
  if (!I.condiciones.includes('renal') && m.proteina_g < 0.8*I.peso_kg - 0.001) viol('S5a P < 0.8 g/kg PC', ctx);
  if (m.proteina_g > 2.5*I.peso_kg + 0.001) viol('S5b P > 2.5 g/kg PC', ctx);
  // S5c techo por % kcal (solo exigible cuando el cap ha estado activo; el redondeo a 5 g admite 5 g de holgura)
  if (!I.condiciones.includes('renal') && 4*m.proteina_g > (((r.preferencia_base==='vegano'||r.preferencia_base==='vegetariano')&&r.kcal<1800)?0.30:0.35)*r.kcal + 20.001
      && m.proteina_g > 0.8*I.peso_kg + 5.001) viol('S5c P > techo % kcal', ctx);
  // S5d techo de g/kg de `base` (2.4 / 2.0)
  if (m.proteina_g > (I.peso_kg/h2 >= 30 ? 2.0 : 2.4) * m.base_kg + 5.001 && m.proteina_g > 0.8*I.peso_kg + 5.001)
    viol('S5d P > techo g/kg base', ctx);
  // S6 cap renal 1.0 g/kg PESO CORPORAL, ultimo filtro
  if (I.condiciones.includes('renal') && m.proteina_g > 1.0*I.peso_kg + 0.001) viol('S6 renal P > 1.0 g/kg PC', ctx);
  // S7 grasa dentro de suelo/techo
  if (9*m.grasa_g < 0.20*r.kcal - 45.001) viol('S7a G < 20% kcal', ctx);
  if (9*m.grasa_g > (r.low_carb?0.50:0.40)*r.kcal + 45.001) viol('S7b G > techo kcal', ctx);
  // S7c la franja exacta del paso 9: suelo_g <= G <= techo_g, sin holgura de redondeo
  {
    const suelo_gkg = I.sexo === 'hombre' ? 0.7 : 0.8;
    const pctTecho = r.low_carb ? 0.50 : 0.40;
    const suelo = Math.max(suelo_gkg * m.base_kg, 0.20 * r.kcal / 9);
    const techo = pctTecho * r.kcal / 9;
    if (m.grasa_g < suelo - 0.001) viol('S7c G < suelo_g', { ...ctx, G:m.grasa_g, suelo:suelo.toFixed(2) });
    if (m.grasa_g > techo + 0.001) viol('S7d G > techo_g', { ...ctx, G:m.grasa_g, techo:techo.toFixed(2) });
  }
  // S8 HC minimo
  if (m.hc_g < (r.low_carb?75:130) - 2.501) viol('S8 HC < minimo', ctx);
  // S9 cierre calorico dentro del 2%
  if (!r._dbg.cierre_ok) viol('S9 cierre kcal fuera de 2%', { ...ctx, cierre:r.kcal_cierre });
  // S10 TCA: ritmo siempre suave
  if (I.condiciones.includes('tca') && r.ritmo_efectivo !== 'suave') viol('S10 TCA sin ritmo suave', ctx);
  // S10b TCA: nunca se emite un aviso que revele la causa
  if (I.condiciones.includes('tca') && r.avisos.includes('WARN_TCA')) viol('S10b WARN_TCA revelador', ctx);
  // S10c TCA: ningun aviso enuncia el %grasa, el peso objetivo o el cronograma (que la UX oculta)
  if (I.condiciones.includes('tca'))
    for (const c of TCA_OCULTOS)
      if (r.avisos.includes(c)) viol('S10c aviso oculto por TCA presente: ' + c, ctx);
  // S11 agua: null con renal/cardiaca, dentro del clamp en el resto
  if (I.condiciones.includes('renal') || I.condiciones.includes('cardiaca')) {
    if (r.agua !== null) viol('S11a agua no nula con renal/cardiaca', ctx);
    if (!r.avisos.includes('INFO_AGUA_NO_PRESCRITA')) viol('S11b falta INFO_AGUA_NO_PRESCRITA', ctx);
  } else {
    const suelo = hom?2000:1500;
    if (r.agua.ml < suelo || r.agua.ml > 4000) viol('S11c agua fuera del clamp', ctx);
    if (r.agua.rango[0] < suelo) viol('S11d rango de agua por debajo del suelo', ctx);
    if (r.agua.rango[1] > 4000) viol('S11e rango de agua por encima del techo', ctx);
  }
  // S12 fibra dentro del clamp declarado
  if (r.macros.fibra_g < 1 || r.macros.fibra_g > 40) viol('S12 fibra fuera de rango', ctx);
  if (r.macros.fibra_g < 25 && !r.avisos.includes('INFO_FIBRA_AJUSTADA')) viol('S12b fibra < 25 sin aviso', ctx);
  // S13 IMC del peso objetivo nunca por debajo del minimo (18.5, 22 a partir de 65)
  const imc_min = I.edad >= 65 ? 22 : 18.5;
  if (r.peso_objetivo.efectivo !== null && r.peso_objetivo.efectivo / h2 < imc_min - 0.02)
    viol('S13 peso objetivo IMC < minimo', { ...ctx, po:r.peso_objetivo.efectivo });
  // S14 grasa implicita del peso objetivo >= g_min (12 H / 20 M)
  if (r.peso_objetivo.efectivo !== null && obje === 'perder') {
    const gi = (1 - r.mlg/r.peso_objetivo.efectivo)*100;
    if (gi < (hom?12:20) - 0.01) viol('S14 grasa implicita objetivo < g_min', { ...ctx, po:r.peso_objetivo.efectivo, gi:gi.toFixed(1) });
  }
  // S14b el rango sugerido nunca esta invertido y contiene al central
  const pw = r.peso_objetivo;
  if (!(pw.rango[0] <= pw.sugerido && pw.sugerido <= pw.rango[1])) viol('S14b rango sugerido invertido o sin el central', { ...ctx, pw });
  // S14c techo de IMC 27.5 tambien sobre el peso sugerido en la rama `ganar`
  if (obje === 'ganar' && I.peso_kg / h2 <= 27.5) {
    if (pw.rango[1] / h2 > 27.5 + 1e-9) viol('S14c sugerido_rango[1] con IMC > 27.5', { ...ctx, pw });
    if (pw.sugerido / h2 > 27.5 + 1e-9) viol('S14c sugerido_central con IMC > 27.5', { ...ctx, pw });
  }
  // S14d sin peso objetivo del usuario, el sugerido ES el efectivo (una sola cifra en pantalla)
  if (obje === 'ganar' && I.peso_objetivo === null && pw.efectivo !== null && pw.sugerido !== pw.efectivo)
    viol('S14d sugerido != efectivo sin peso objetivo del usuario', { ...ctx, pw });
  // S15c sin superavit anulado en bajo peso: quien pide ganar con IMC < 18.5 recibe superavit
  if (r.imc < 18.5 && I.objetivo === 'ganar' && I.peso_objetivo === null && obje !== 'ganar')
    viol('S15c ganar con IMC < 18.5 convertido a ' + obje, ctx);
  // S15 sin deficit si IMC < 18.5
  if (r.imc < 18.5 && (obje === 'perder' || obje === 'recomposicion')) viol('S15 deficit con IMC < 18.5', ctx);
  if (r.imc < 18.5 && r.kcal < Math.floor(r.tdee.valor/10)*10) viol('S15b kcal < TDEE con IMC < 18.5', ctx);
  // S16 avisos de condiciones siempre presentes
  for (const [c, code] of [['renal','WARN_RENAL'],['hepatica','WARN_HEPATICA'],['diabetes','WARN_DIABETES'],
                           ['cardiaca','WARN_CARDIACA'],['hipertension','WARN_HIPERTENSION'],['tiroides','WARN_TIROIDES'],
                           ['bariatrica','WARN_BARIATRICA_GLP1'],['glp1','WARN_BARIATRICA_GLP1'],['otra','WARN_CONDICION_OTRA'],
                           ['tca','INFO_RITMO_SUAVE']])
    if (I.condiciones.includes(c) && !r.avisos.includes(code)) viol('S16 falta ' + code, ctx);
  // S17 IMC extremo siempre avisado
  if (r.imc >= 40 && !r.avisos.includes('WARN_IMC_40')) viol('S17 falta WARN_IMC_40', ctx);
  if (r.imc < 18.5 && !r.avisos.includes('WARN_IMC_BAJO')) viol('S17 falta WARN_IMC_BAJO', ctx);
  // S18 valores finitos y no negativos
  for (const [kk, vv] of Object.entries({kcal:r.kcal,P:m.proteina_g,G:m.grasa_g,HC:m.hc_g,fibra:m.fibra_g,mlg:r.mlg,bmr:r.bmr.valor,tdee:r.tdee.valor}))
    if (!Number.isFinite(vv) || vv <= 0) viol('S18 valor no finito/<=0: ' + kk, ctx);
  // S19 reparto suma exactamente el total, sin partes negativas, con hora y peri
  const sP = r.comidas.reduce((a,x)=>a+x.proteina_g,0), sG = r.comidas.reduce((a,x)=>a+x.grasa_g,0), sHC = r.comidas.reduce((a,x)=>a+x.hc_g,0);
  if (sP!==m.proteina_g || sG!==m.grasa_g || sHC!==m.hc_g) viol('S19 reparto no suma', { ...ctx, sP, sG, sHC });
  if (r.comidas.some(x=>x.proteina_g<0||x.grasa_g<0||x.hc_g<0)) viol('S19b reparto con parte negativa', ctx);
  if (r.comidas.some(x=>!/^\d{2}:\d{2}$/.test(x.hora) || typeof x.peri !== 'boolean')) viol('S19c comida sin hora/peri validos', ctx);
  if (r.comidas.filter(x=>x.peri).length > 1) viol('S19d mas de una comida peri', ctx);
  // S20 cronograma coherente
  if (r.cronograma) {
    const cg = r.cronograma;
    if (!Number.isFinite(cg.semanas[0]) || cg.semanas[0] <= 0 || cg.semanas[1] < cg.semanas[0]) viol('S20 semanas incoherentes', { ...ctx, cg });
    if (cg.ritmo_kg_sem < 0.05) viol('S20b ritmo < 0.05 kg/sem con cronograma', { ...ctx, cg });
    if (Math.abs(cg.ritmo_pct_sem) > 1.5) viol('S20c ritmo > 1.5 %/sem', { ...ctx, r:cg.ritmo_pct_sem.toFixed(2) });
    if (cg.semanas[1] > (obje === 'ganar' ? 20 : 104)) viol('S20d horizonte superado', { ...ctx, cg });
    if (cg.fecha_min > cg.fecha_max) viol('S20e fechas invertidas', { ...ctx, cg });
  }
  // S21 reglas de supresion de avisos
  for (const [t, sup] of SUPRESION)
    if (r.avisos.includes(t)) for (const s of sup)
      if (r.avisos.includes(s)) viol(`S21 supresion violada: ${t} + ${s}`, ctx);
  // S21b avisos coherentes con el objetivo efectivo final
  if (r.avisos.includes('WARN_PERDIDA_MAYOR_65') && obje !== 'perder') viol('S21b WARN_PERDIDA_MAYOR_65 sin perder', ctx);
  if (r.avisos.includes('WARN_RECOMPOSICION_SUGERIDA') && obje !== 'recomposicion') viol('S21c WARN_RECOMPOSICION_SUGERIDA sin recomposicion', ctx);
  if (r.avisos.includes('WARN_YA_MAGRO') && obje !== 'recomposicion') viol('S21d WARN_YA_MAGRO sin recomposicion', ctx);
  // S22 categoria de FFMI oculta con banda alta
  if ((r.grasa.banda === 'alto' || r.grasa.banda === 'muy_alto') && r.ffmi.categoria !== null) viol('S22 categoria FFMI visible con banda alta', ctx);
  // S23 formulas clasicas solo entre 150 y 200 cm
  if ((I.altura_cm < 150 || I.altura_cm > 200) && r.peso_objetivo.referencias.clasicas !== null) viol('S23 clasicas fuera de 150-200 cm', ctx);
  // S24 un plan etiquetado `perder` tiene deficit real (paso 10bis): TDEE - kcal >= 50
  if (obje === 'perder' && r.tdee.valor - r.kcal < 50) viol('S24 perder sin margen de deficit', { ...ctx, def:(r.tdee.valor-r.kcal).toFixed(1) });
  // S24b: la exencion de C ('recomposicion' con prioridad `ganar` = cero deficit por peticion expresa)
  if (obje === 'recomposicion' && r.recomposicion_prioridad !== 'ganar' && r.tdee.valor - r.kcal < 50)
    viol('S24b recomposicion sin margen de deficit', { ...ctx, def:(r.tdee.valor-r.kcal).toFixed(1) });
  // S24c WARN_OBJETIVO_MUY_LEJANO se evalua tambien cuando la meta la propone la app
  if (obje === 'perder' && r.peso_objetivo.efectivo !== null && !I.condiciones.includes('tca')
      && (I.peso_kg - r.peso_objetivo.efectivo)/I.peso_kg > 0.25 && !r.avisos.includes('WARN_OBJETIVO_MUY_LEJANO'))
    viol('S24c falta WARN_OBJETIVO_MUY_LEJANO', { ...ctx, po:r.peso_objetivo.efectivo });
  // S25 ningun campo numerico de `Resultado` es NaN
  const numeros = [r.imc, r.mlg, r.bmr.valor, r.tdee.valor, r.tdee.bruto, r.kcal, r.kcal_cierre,
    m.proteina_g, m.grasa_g, m.hc_g, m.fibra_g, m.azucares_libres_max_g, m.base_kg,
    m.pct.p, m.pct.g, m.pct.hc, m.gkg.p, m.gkg.g, m.gkg.hc,
    r.grasa.pct, r.grasa.rango[0], r.grasa.rango[1], r.ffmi.valor, r.ffmi.normalizado,
    r.peso_objetivo.sugerido, r.peso_objetivo.rango[0], r.peso_objetivo.rango[1],
    ...(r.peso_objetivo.efectivo === null ? [] : [r.peso_objetivo.efectivo]),
    ...(r.agua === null ? [] : [r.agua.ml, r.agua.vasos, r.agua.rango[0], r.agua.rango[1]]),
    ...(r.cronograma === null ? [] : [r.cronograma.ritmo_kg_sem, r.cronograma.semanas[0], r.cronograma.semanas[1]]),
    ...r.comidas.flatMap(c => [c.proteina_g, c.grasa_g, c.hc_g, c.kcal]),
  ];
  if (numeros.some(v => !Number.isFinite(v))) viol('S25 campo numerico NaN/no finito', ctx);

  // ---------- v1.1 ----------
  // S26 proyeccion (F): banda ordenada, arranca en el peso actual, monotona HACIA el objetivo
  if (I.condiciones.includes('tca')) {
    if (r.proyeccion !== undefined) viol('S26z proyeccion publicada con tca', ctx);
  } else {
    const pr = r.proyeccion;
    if (!Array.isArray(pr) || pr.length < 2) viol('S26 proyeccion ausente o vacia', ctx);
    else {
      if (pr[0].peso_min !== round1(I.peso_kg) || pr[0].peso_esp !== round1(I.peso_kg) || pr[0].peso_max !== round1(I.peso_kg))
        viol('S26a la semana 0 no es el peso actual', { ...ctx, p0:pr[0] });
      for (let i = 0; i < pr.length; i++) {
        const q = pr[i];
        if (!(q.peso_min <= q.peso_esp + 1e-9 && q.peso_esp <= q.peso_max + 1e-9))
          viol('S26b banda invertida', { ...ctx, q });
        if (q.semana !== i) viol('S26c semanas no correlativas', { ...ctx, q, i });
        if (![q.peso_min,q.peso_esp,q.peso_max].every(v => Number.isFinite(v) && v > 0))
          viol('S26d punto de proyeccion no finito', { ...ctx, q });
        if (i > 0) {                                        // monotonia hacia el objetivo
          const a = pr[i-1];
          const baja = r.cronograma && obje === 'perder', sube = r.cronograma && obje === 'ganar';
          if (baja && (q.peso_esp > a.peso_esp + 1e-9 || q.peso_min > a.peso_min + 1e-9 || q.peso_max > a.peso_max + 1e-9))
            viol('S26e proyeccion no monotona en perder', { ...ctx, a, q });
          if (sube && (q.peso_esp < a.peso_esp - 1e-9 || q.peso_min < a.peso_min - 1e-9 || q.peso_max < a.peso_max - 1e-9))
            viol('S26f proyeccion no monotona en ganar', { ...ctx, a, q });
        }
      }
      // nunca se sobrepasa el objetivo, y con cronograma la curva no pasa de 26 semanas
      if (pr.length - 1 > 26) viol('S26g proyeccion mas alla de la semana 26', ctx);
      if (r.cronograma && r.peso_objetivo.efectivo !== null) {
        const po = r.peso_objetivo.efectivo, ult = pr[pr.length-1];
        if (obje === 'perder' && ult.peso_min < round1(po) - 0.051) viol('S26h proyeccion por debajo del objetivo', { ...ctx, ult, po });
        if (obje === 'ganar'  && ult.peso_max > round1(po) + 0.051) viol('S26i proyeccion por encima del objetivo', { ...ctx, ult, po });
      }
      if (!r.cronograma && !r.avisos.includes('INFO_PROYECCION_PLANA')
          && !r.avisos.includes('INFO_PROYECCION_RECOMP')) viol('S26j proyeccion sin cronograma y sin aviso', ctx);

      // S31 (v1.2) proyeccion de RECOMPOSICION con deficit: contenida en [curva del deficit, PC],
      // no creciente, y con el borde superior clavado en el peso actual.
      if (r.avisos.includes('INFO_PROYECCION_RECOMP')) {
        if (r.cronograma !== null) viol('S31 proyeccion de recomposicion con cronograma', ctx);
        if (obje !== 'recomposicion') viol('S31a INFO_PROYECCION_RECOMP sin recomposicion', ctx);
        const po = r.peso_objetivo.efectivo;
        if (po === null) viol('S31b proyeccion de recomposicion sin peso objetivo', ctx);
        const ritmo = (r.tdee.valor - r.kcal) * 7 / 7700;
        for (let i = 0; i < pr.length; i++) {
          const q = pr[i];
          if (q.peso_max !== round1(I.peso_kg)) viol('S31c el borde superior no es el peso actual', { ...ctx, q });
          const inf = I.peso_kg - Math.min(ritmo * q.semana, I.peso_kg - po);
          if (Math.abs(q.peso_min - round1(inf)) > 0.051) viol('S31d el borde inferior no es la curva del deficit', { ...ctx, q, inf });
          if (q.peso_min < round1(po) - 0.051) viol('S31e la proyeccion pasa de la meta', { ...ctx, q, po });
          if (i > 0 && (q.peso_esp > pr[i-1].peso_esp + 1e-9 || q.peso_min > pr[i-1].peso_min + 1e-9))
            viol('S31f proyeccion de recomposicion no monotona', { ...ctx, q });
        }
        if (pr.length - 1 < 12) viol('S31g proyeccion de recomposicion mas corta de 12 semanas', ctx);
      }
    }
  }
  // S31h: recomposicion con deficit real y meta por debajo del peso actual SIEMPRE trae su curva
  if (obje === 'recomposicion' && !I.condiciones.includes('tca') && r.peso_objetivo.efectivo !== null
      && r.tdee.valor - r.kcal >= 50 && I.peso_kg - r.peso_objetivo.efectivo >= 0.5
      && (r.tdee.valor - r.kcal) * 7 / 7700 >= 0.05
      && !r.avisos.includes('INFO_PROYECCION_RECOMP'))
    viol('S31h recomposicion con deficit sin curva de recomposicion', ctx);

  // S27 ajuste manual (B): la proteina no se toca y la grasa nunca baja de su suelo
  if (r.limites_ajuste) {
    const L = r.limites_ajuste;
    if (!(L.kcal_min <= L.kcal_max)) viol('S27 limites de kcal invertidos', { ...ctx, L });
    if (L.kcal_min % 10 !== 0 || L.kcal_max % 10 !== 0) viol('S27a limites de kcal no multiplos de 10', { ...ctx, L });
    if (L.kcal_min < (hom?1500:1200)) viol('S27b kcal_min por debajo del suelo por sexo', { ...ctx, L });
    // Ademas del ajuste aleatorio se prueban SIEMPRE los extremos que el panel alcanza de verdad:
    // el ajuste vacio (identidad bit a bit), el suelo de kcal —donde el cierre se salia del 2 %— y
    // ese suelo con el techo del deslizador. Cada 32 perfiles, el barrido entero del deslizador.
    const techoHc = (kc) => {
      const s = Math.max(L.suelo_grasa_abs_g, 0.20 * kc / 9);
      const t = roundDown5((kc - 4*m.proteina_g - 9*roundUp5(s)) / 4);
      return kc === L.kcal_recomendada ? Math.max(t, L.hc_recomendado_g) : t;
    };
    const lista = [pick(ajustes), {}, { kcal: L.kcal_min }, { kcal: L.kcal_min, hc_g: techoHc(L.kcal_min) }];
    if (n % 32 === 0)
      for (let h = 30; h <= techoHc(L.kcal_min); h += 5) lista.push({ kcal: L.kcal_min, hc_g: h });
    for (const aj of lista) if (aj !== null) {
      let ra;
      try { ra = ajustarMacros(r, aj); } catch (e) { viol('EXCEPCION ajustarMacros: ' + e.message, { ...ctx, aj }); ra = null; }
      if (ra) {
        const ma = ra.macros;
        if (ma.proteina_g !== m.proteina_g) viol('S27c el ajuste ha tocado la proteina', { ...ctx, aj });
        const suelo_aj = Math.max(L.suelo_grasa_abs_g, 0.20 * ra.kcal / 9);
        if (ma.grasa_g < suelo_aj - 0.001) viol('S27d grasa ajustada por debajo del suelo', { ...ctx, aj, G:ma.grasa_g, suelo:suelo_aj.toFixed(2) });
        if (ra.kcal < L.kcal_min || ra.kcal > L.kcal_max) viol('S27e kcal ajustadas fuera de limites', { ...ctx, aj, k:ra.kcal });
        if (ma.hc_g < 0) viol('S27f HC ajustado negativo', { ...ctx, aj });
        if (Math.abs(ra.kcal_cierre - ra.kcal) > 0.02 * ra.kcal) viol('S27g cierre del ajuste fuera del 2%', { ...ctx, aj });
        const sPa = ra.comidas.reduce((a,x)=>a+x.proteina_g,0), sGa = ra.comidas.reduce((a,x)=>a+x.grasa_g,0), sHa = ra.comidas.reduce((a,x)=>a+x.hc_g,0);
        if (sPa !== ma.proteina_g || sGa !== ma.grasa_g || sHa !== ma.hc_g) viol('S27h reparto ajustado no suma', { ...ctx, aj });
        if (ra.comidas.some(x => x.proteina_g < 0 || x.grasa_g < 0 || x.hc_g < 0)) viol('S27i reparto ajustado con parte negativa', { ...ctx, aj });
        if (ma.hc_g < L.hc_min_motor_g && !ra.avisos.includes('WARN_HC_BAJO_MINIMO')) viol('S27j falta WARN_HC_BAJO_MINIMO', { ...ctx, aj });
        const ajustado = ra.ajuste !== undefined;
        if (ajustado !== ra.avisos.includes('INFO_AJUSTE_MANUAL')) viol('S27k INFO_AJUSTE_MANUAL incoherente con `ajuste`', { ...ctx, aj });
        // idempotencia respecto al origen
        const doble = ajustarMacros(ra, aj);
        if (JSON.stringify(doble.macros) !== JSON.stringify(ma) || doble.kcal !== ra.kcal)
          viol('S27l ajustarMacros no es idempotente', { ...ctx, aj });
        // Se compara el `Resultado` ENTERO, no tres campos: los avisos tambien tienen que volver
        // a ser los del motor (el orden de emision no es significativo, por eso se ordenan).
        const norm = (x) => JSON.stringify({ ...x, avisos: [...x.avisos].sort() });
        const vuelta = ajustarMacros(ra, {});
        if (vuelta.ajuste !== undefined || norm(vuelta) !== norm(r))
          viol('S27m volver a lo recomendado no restituye el plan', { ...ctx, aj });
      }
    }
  } else if (!I.condiciones.includes('tca')) viol('S27n falta limites_ajuste sin tca', ctx);

  // S28 regla (D): irregular/ausente nunca deja un ritmo agresivo EN UN PLAN QUE RESTA CALORIAS.
  // En 'ganar' y 'mantener' el ritmo se respeta: el motivo del suavizado es la baja disponibilidad
  // energetica, y ahi recortar un superavit iria en contra de su propio motivo.
  if (I.sexo === 'mujer' && (I.menstruacion === 'irregular' || I.menstruacion === 'ausente')
      && deficit && r.ritmo_efectivo === 'agresivo')
    viol('S28 ritmo agresivo con regla irregular/ausente en un plan con deficit', ctx);
  // 'ganar' es el unico objetivo final que garantiza que el paso 6 tampoco lo vio como deficit
  // (los pasos 7 y 10bis solo reescriben HACIA 'mantener'), asi que es donde se puede comprobar
  // que el suavizado no ha entrado: recortar un superavit iria contra el propio motivo de la regla.
  if (I.sexo === 'mujer' && (I.menstruacion === 'irregular' || I.menstruacion === 'ausente')
      && obje === 'ganar' && I.ritmo === 'agresivo' && r.ritmo_efectivo !== 'agresivo'
      && !I.condiciones.includes('tca'))
    viol('S28c ritmo suavizado en un plan de superavit', ctx);
  if (I.sexo === 'hombre' && (r.avisos.includes('INFO_CICLO') || r.avisos.includes('WARN_CICLO_AUSENTE')))
    viol('S28b aviso de ciclo en un hombre', ctx);

  // S29 preferencias combinables (E): la traduccion es total y coherente
  if (!['omnivoro','vegetariano','vegano'].includes(r.preferencia_base)) viol('S29 preferencia_base invalida', ctx);
  if (r.restricciones.some(x => !['sin_lactosa','sin_gluten'].includes(x))) viol('S29b restriccion invalida', ctx);
  if (r.low_carb && I.condiciones.includes('diabetes')) viol('S29c low_carb no anulado con diabetes', ctx);
  if (r.preferencia_efectiva !== bancoDe(r.preferencia_base, r.restricciones, r.low_carb))
    viol('S29d preferencia_efectiva no es el banco de la regla inversa', ctx);

  // ---------- v1.2 ----------
  // S30 plazo (H): con plazo y peso objetivo, el ritmo es el MAS SUAVE de la tabla que llega a
  // tiempo; si ninguno llega, es 'agresivo' y hay WARN_PLAZO_IRREAL. Los suavizados de seguridad
  // mandan sobre el plazo, y cuando muerden el aviso pasa a ser el de plazo irreal.
  const plazo_i = (I.plazo_semanas === undefined || I.plazo_semanas === null) ? null : I.plazo_semanas;
  const usaPlazo = plazo_i !== null && I.peso_objetivo !== null && (obje === 'perder' || obje === 'ganar');
  // El plazo se mide contra la META EFECTIVA (la que publica el paso 13) y con las SEMANAS que
  // ese ritmo produce, descansos incluidos: es la regla de la v1.2 y la que cierra el bucle con
  // el cronograma del paso 14.
  const h2_i = (I.altura_cm / 100) ** 2;
  const meta_i = I.peso_objetivo === null || I.peso_objetivo === undefined
    ? null
    : metaSegura(I.peso_objetivo, obje, I.sexo === 'hombre', I.edad, r.mlg, h2_i);
  const delta_i = meta_i === null ? 0 : (obje === 'perder' ? I.peso_kg - meta_i : meta_i - I.peso_kg);
  if (usaPlazo && delta_i > 0 && !I.condiciones.includes('tca')) {
    const kgSem = (rr) => obje === 'perder'
      ? (RITMO_T[r.grasa.banda] ? RITMO_T[r.grasa.banda][rr] / 100 * I.peso_kg : null)
      : clamp((r.tdee.perfil !== 'fuerza' ? 0.05 : SUP_T[I.entrenamiento.experiencia][rr]) * r.tdee.valor, 150, 500) * 7 / 7700;
    const semanasDe = (v) => {
      const lin = delta_i / v;
      return Math.ceil(lin - 1e-9) + ((obje === 'perder' && lin > 10) ? Math.floor(lin / 8) : 0);
    };
    const esperado = ['suave','moderado','agresivo']
      .find((rr) => { const v = kgSem(rr); return v !== null && v > 0 && semanasDe(v) <= plazo_i; }) || 'agresivo';
    const info = r.avisos.includes('INFO_RITMO_POR_PLAZO'), warn = r.avisos.includes('WARN_PLAZO_IRREAL');
    if (info && warn) viol('S30 los dos avisos de plazo a la vez', ctx);
    if (info && r.ritmo_efectivo !== esperado) viol('S30b el ritmo no es el mas suave que llega', { ...ctx, esperado, ef:r.ritmo_efectivo });
    // v1.2: INFO_RITMO_POR_PLAZO promete una fecha, asi que exige un calendario que la cumpla.
    if (info && r.cronograma === null)
      viol('S30c INFO_RITMO_POR_PLAZO sin cronograma: promete una fecha que el informe declara incalculable', ctx);
    if (info && r.cronograma && r.cronograma.semanas[0] > plazo_i)
      viol('S30e INFO_RITMO_POR_PLAZO con un calendario mas largo que el plazo', { ...ctx, cg:r.cronograma.semanas });
    // ...y el reciproco: si el calendario cabe entero en el plazo, no se puede negar la fecha.
    if (warn && r.cronograma && r.cronograma.semanas[1] <= plazo_i)
      viol('S30f WARN_PLAZO_IRREAL con un calendario que cabe de sobra', { ...ctx, cg:r.cronograma.semanas });
  }
  if ((r.avisos.includes('INFO_RITMO_POR_PLAZO') || r.avisos.includes('WARN_PLAZO_IRREAL')) && !usaPlazo)
    viol('S30d aviso de plazo en un plan que no lo usa', ctx);
  // Con la meta ya en su suelo de seguridad el camino puede desaparecer (el suelo queda por
  // encima del peso actual): entonces el plazo no emite nada, ni ritmo ni aviso.
  if (usaPlazo && delta_i <= 0 &&
      (r.avisos.includes('INFO_RITMO_POR_PLAZO') || r.avisos.includes('WARN_PLAZO_IRREAL')))
    viol('S30g aviso de plazo con la meta efectiva en el peso actual o mas alla', ctx);

  // S32 ciclo (I): `ciclo` es exactamente "INFO_CICLO + al menos un sintoma valido", y sus
  // consejos van en el orden canonico, uno por sintoma. No toca ningun numero (lo cubre S33).
  const sint_ok = SINTOMAS_ORDEN.filter((s) => (I.sintomas_regla || []).includes(s));
  const deberia = r.avisos.includes('INFO_CICLO') && sint_ok.length > 0;
  if (deberia !== (r.ciclo !== undefined)) viol('S32 `ciclo` no coincide con INFO_CICLO + sintomas', ctx);
  if (r.ciclo) {
    if (I.sexo !== 'mujer') viol('S32a ciclo en un hombre', ctx);
    if (JSON.stringify(r.ciclo.sintomas) !== JSON.stringify(sint_ok)) viol('S32b sintomas fuera del orden canonico', ctx);
    if (r.ciclo.consejos.length !== sint_ok.length) viol('S32c falta algun consejo', ctx);
    r.ciclo.consejos.forEach((c, i) => {
      if (c.clave !== sint_ok[i]) viol('S32d consejo fuera de orden', ctx);
      if (!c.titulo || !c.texto || !Array.isArray(c.alimentos)) viol('S32e consejo incompleto', ctx);
      if (c.texto.includes('{')) viol('S32f fragmento condicional sin resolver', { ...ctx, t:c.texto.slice(0,40) });
      if (r.restricciones.includes('sin_gluten') && c.alimentos.includes('Avena')) viol('S32g avena con sin_gluten', ctx);
      if (r.restricciones.includes('sin_lactosa') && c.alimentos.includes('Yogur griego 0%')) viol('S32h lacteo con sin_lactosa', ctx);
    });
  }

  // S33 campos que el motor IGNORA (G): `menu_sencillo` y las dos listas de alimentos no pueden
  // cambiar ni un numero. Se comprueba en 1 de cada 16 perfiles para no doblar el barrido.
  if (n % 16 === 0) {
    const conRuido = calcular({ ...I, menu_sencillo: !I.menu_sencillo,
      alimentos_excluidos: ['brocoli','pechuga_pollo','espinacas','lentejas_cocidas'],
      alimentos_favoritos: ['huevo_entero'] });
    // `ciclo` queda fuera de la comparacion: desde la v1.2 los excluidos SI retiran nombres de la
    // lista "Prioriza:" (§3.2b). Es lo unico que pueden tocar, y no es un numero.
    const limpio = (x) => JSON.stringify({ ...x, ciclo: undefined, avisos: [...x.avisos].sort() });
    if (limpio(conRuido) !== limpio(r)) viol('S33 el motor ha leido menu_sencillo o alimentos_*', ctx);
    if (conRuido.ciclo) {
      for (const c of conRuido.ciclo.consejos) {
        if (c.alimentos.includes('Espinacas')) viol('S33b consejo del ciclo con un alimento excluido', ctx);
      }
    }
  }
}

console.log('\n============ BARRIDO DE INVARIANTES (' + n + ' casos aleatorios) ============');
const ks = Object.keys(V);
if (!ks.length) console.log('OK: 0 violaciones — las 40 familias de invariantes se cumplen en los ' + n + ' casos.');
else for (const kk of ks) {
  console.log(`\n!! ${kk}  (${V[kk].length} casos)`);
  console.log('   ejemplo: ' + JSON.stringify(V[kk][0]));
}
process.exit((fails || ks.length) ? 1 : 0);
