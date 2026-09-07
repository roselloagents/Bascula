# Báscula (RS Agents) — Especificación del motor de cálculo v1.0

Documento normativo para implementar `calcular(input): Resultado` en TypeScript puro (sin backend, sin dependencias). Todo lo que no esté escrito aquí no forma parte del motor. Cualquier número del PDF o de la pantalla de resultados debe poder trazarse a una fórmula o tabla de este documento.

---

## 0. Convenciones generales

### 0.1 Precisión y redondeo

- Todos los cálculos intermedios se hacen en coma flotante de doble precisión **sin redondear**. Solo se redondean los valores que se enumeran en la tabla siguiente, en el punto exacto del algoritmo donde se indica.
- `round(x)` significa **`Math.round` de JavaScript** (la mitad se redondea hacia +∞: `Math.round(2.5) = 3`, `Math.round(3.5) = 4`). No usar redondeo bancario.
- Funciones auxiliares (todas con la semántica de `Math.round`):

```ts
const round1  = (x: number) => Math.round(x * 10) / 10;   // 1 decimal
const round05 = (x: number) => Math.round(x * 2) / 2;     // múltiplo de 0,5 (pesos objetivo)
const round5  = (x: number) => 5  * Math.round(x / 5);    // múltiplo de 5
const round10 = (x: number) => 10 * Math.round(x / 10);   // múltiplo de 10
const round50 = (x: number) => 50 * Math.round(x / 50);   // múltiplo de 50
const clamp   = (x: number, lo: number, hi: number) => Math.min(Math.max(x, lo), hi);
```

| Magnitud | Redondeo de salida | Momento |
|---|---|---|
| kcal objetivo | `round10` | paso 7 (tras aplicar suelos) |
| proteína, grasa, hidratos (g/día) | `round5` | pasos 8, 9, 10 |
| macros por comida (g) | `round5` | paso 16 |
| fibra (g) | `Math.round` | paso 11 |
| agua (ml) | `round50` | paso 12 |
| peso objetivo sugerido y su rango (kg) | `round05` | paso 13 |
| semanas del cronograma | `Math.ceil` | paso 14 |
| valores mostrados (IMC, %grasa, BMR, TDEE, MLG, FFMI, rangos) | `round1` **solo al presentar** | nunca dentro del cálculo |

**Redondeo dirigido (obligatorio cuando hay un límite activo).** Un redondeo al múltiplo más cercano puede violar el límite que se acaba de imponer. Por eso:

```ts
const roundUp10   = (x: number) => 10 * Math.ceil(x / 10);    // kcal cuando se ha activado un suelo
const roundDown5  = (x: number) => 5  * Math.floor(x / 5);    // gramos cuando se ha activado un techo
const roundUp5    = (x: number) => 5  * Math.ceil(x / 5);     // gramos cuando se ha activado un suelo
const roundUp05   = (x: number) => Math.ceil(x * 2) / 2;      // kg cuando se ha activado un suelo de peso
const roundDown05 = (x: number) => Math.floor(x * 2) / 2;     // kg cuando se ha activado un techo de peso
```

| Situación | Redondeo obligatorio |
|---|---|
| kcal tras activarse cualquier suelo del paso 7 | `roundUp10` |
| proteína tras activarse `P_cap` (paso 8) | `roundDown5` |
| proteína tras activarse el cap renal (paso 8) | `roundDown5` |
| grasa tras activarse `suelo_g` (paso 9) | `roundUp5` |
| grasa tras activarse `techo_g` (paso 9) | `roundDown5` |
| peso objetivo cuando queda por debajo de su suelo (`min185`, `g_min`) | `roundUp05` |
| peso objetivo cuando queda por encima del techo de IMC 27,5 (`ganar`) | `roundDown05` |

- Los vectores de prueba (sección 5) muestran intermedios con 1 decimal; los tests deben comparar intermedios con tolerancia ±0,1 y salidas redondeadas con igualdad exacta.
- Unidades internas: kg, cm, años, kcal, g, ml, semanas. Nunca se calcula en libras/pulgadas salvo la conversión puntual de las fórmulas clásicas de peso ideal (paso 13).

### 0.2 Orden de ejecución (obligatorio)

```
0 exclusiones → 1 IMC → 2 %grasa → 3 MLG → 4 BMR → 5 TDEE → 6 objetivo efectivo
→ 7 kcal objetivo (con suelos) → 8 proteína → 9 grasa → 10 hidratos (resto + factibilidad)
→ 10bis segunda pasada de la regla de margen → 11 fibra → 12 agua → 13 peso objetivo
→ 14 cronograma → 15 FFMI → 16 reparto por comidas → 17 avisos finales
```

El orden importa: la proteína usa las kcal ya redondeadas; la grasa usa la proteína ya redondeada; los hidratos absorben el residuo; el paso 10bis reevalúa el margen de déficit contra las kcal ya cerradas (los pasos 9 y 10 pueden haberlas subido); el peso objetivo y el cronograma usan el `objetivo_efectivo` y las kcal finales.

### 0.3 Tipos TypeScript de referencia

```ts
export type Sexo = 'hombre' | 'mujer';
export type MetodoGrasa = 'conocido' | 'medidas' | 'visual' | 'desconocido';
export type FuenteGrasa = 'fiable' | 'estimado';
export type VisualHombre = 'muy_definido' | 'definido' | 'medio' | 'sobrepeso_visible' | 'obesidad_visible';
export type VisualMujer  = 'muy_definida' | 'tonificada' | 'media' | 'sobrepeso_visible' | 'obesidad_visible';
export type ActividadDiaria = 'sedentario' | 'ligero' | 'moderado' | 'alto' | 'muy_alto';
export type TipoEntrenamiento = 'ninguno' | 'fuerza' | 'cardio' | 'mixto';
export type Intensidad = 'baja' | 'media' | 'alta';
export type Experiencia = 'novato' | 'intermedio' | 'avanzado';
export type Momento = 'manana' | 'mediodia' | 'tarde' | 'noche';
export type Objetivo = 'perder' | 'mantener' | 'ganar' | 'recomposicion' | 'no_se';
export type ObjetivoEfectivo = Exclude<Objetivo, 'no_se'>;
export type Ritmo = 'suave' | 'moderado' | 'agresivo';
export type Preferencia = 'omnivoro' | 'vegetariano' | 'vegano' | 'sin_lactosa' | 'sin_gluten' | 'low_carb';
export type Condicion = 'diabetes' | 'renal' | 'hepatica' | 'tca' | 'cardiaca'
                      | 'hipertension' | 'tiroides' | 'bariatrica' | 'glp1' | 'otra';
export type CribadoTCA = 'positivo' | 'evitado' | 'negativo';
export type Somatotipo = 'ectomorfo' | 'mesomorfo' | 'endomorfo';
export type Fiabilidad = 'alta' | 'media' | 'baja';
export type BandaGrasa = 'muy_bajo' | 'bajo' | 'medio' | 'alto' | 'muy_alto';
export type Perfil = 'sedentario' | 'cardio' | 'fuerza';

export interface InputGrasa {
  metodo: MetodoGrasa;
  valor?: number;            // metodo 'conocido' (3–70)
  fuente?: FuenteGrasa;      // metodo 'conocido'
  cuello_cm?: number;        // metodo 'medidas'
  cintura_cm?: number;       // metodo 'medidas'
  cadera_cm?: number;        // metodo 'medidas', solo mujeres
  categoria?: VisualHombre | VisualMujer; // metodo 'visual'
}
export interface InputSomatotipo {
  q1: 'fina' | 'media' | 'ancha';        // estructura ósea (muñecas/tobillos)
  q2: 'poca' | 'moderada' | 'mucha';     // facilidad histórica para ganar grasa
  q3: 'poca' | 'moderada' | 'mucha';     // facilidad histórica para ganar músculo
  q4: 'delgado' | 'atletico' | 'robusto'; // apariencia habitual sin entrenar
}
export interface InputEntrenamiento {
  tipo: TipoEntrenamiento;
  dias_semana: number;       // 0–7
  minutos_sesion: number;    // 10–240
  intensidad: Intensidad;
  experiencia: Experiencia;
  momento: Momento | null;
}
export interface InputCalculo {
  sexo: Sexo;
  edad: number;
  altura_cm: number;
  peso_kg: number;
  grasa: InputGrasa;
  somatotipo: InputSomatotipo | null;
  actividad_diaria: ActividadDiaria;
  entrenamiento: InputEntrenamiento;
  objetivo: Objetivo;
  ritmo: Ritmo;
  peso_objetivo: number | null;
  preferencia: Preferencia;
  n_comidas: 2 | 3 | 4 | 5 | 6;
  clima_caluroso: boolean;
  embarazo_lactancia: boolean;
  condiciones: Condicion[];
  cribado_tca: CribadoTCA | null;   // paso 5b del wizard; 'positivo' y 'evitado' añaden 'tca' a condiciones
  fecha_inicio: string;      // ISO 'YYYY-MM-DD'; por defecto hoy
}
```

---

## 1. Inputs

Todos los inputs se validan antes de calcular. Un valor fuera de rango produce `ERR_INPUT_RANGO` (error de validación, no de cálculo) y no se ejecuta el motor.

| # | Campo | Tipo / valores | Unidad | Rango válido | Por defecto | Oblig. | Por qué importa |
|---|---|---|---|---|---|---|---|
| 1 | `sexo` | `'hombre' \| 'mujer'` | — | — | — | Sí | Constantes distintas en Mifflin-St Jeor, US Navy, CUN-BAE; suelos calóricos, de grasa y de agua; objetivos de %grasa. |
| 2 | `edad` | entero | años | 0–120 (ver nota †) | — | Sí | Coeficiente negativo en BMR; CUN-BAE; modificadores de proteína (≥60 y ≥65); exclusión fuera de 18–75. |
| 3 | `altura_cm` | número | cm | 130–230 | — | Sí | IMC, BMR, US Navy, peso de IMC 30 (peso ajustado), FFMI, peso ideal. |
| 4 | `peso_kg` | número | kg | 35–300 | — | Sí | Base de todo: BMR, MET, g/kg de macros, agua, ritmo de pérdida. |
| 5 | `grasa.metodo` | `'conocido' \| 'medidas' \| 'visual' \| 'desconocido'` | — | — | `'desconocido'` | Sí | Determina el método de estimación de %grasa y su fiabilidad (sección 2.2). |
| 5a | `grasa.valor` | número | % | 3–70 (ver nota ‡) | — | Si metodo=`conocido` | %grasa aportado por el usuario. |
| 5b | `grasa.fuente` | `'fiable' \| 'estimado'` | — | — | `'estimado'` | Si metodo=`conocido` | `fiable` = DEXA, BIA multifrecuencia profesional o pliegues por profesional → activa Katch-McArdle. `estimado` = báscula doméstica, app, "a ojo". |
| 5c | `grasa.cuello_cm` | número | cm | 25–60 | — | Si metodo=`medidas` | US Navy. Medido bajo la laringe. |
| 5d | `grasa.cintura_cm` | número | cm | 50–200 | — | Si metodo=`medidas` | US Navy. A la altura del ombligo, tras exhalar. |
| 5e | `grasa.cadera_cm` | número | cm | 60–200 | — | Si metodo=`medidas` y sexo=`mujer` | US Navy mujeres. Punto de mayor protrusión glútea. |
| 5f | `grasa.categoria` | ver tipos `VisualHombre`/`VisualMujer` | — | — | — | Si metodo=`visual` | Selector por descripción textual (tabla 3.3). |
| 6 | `somatotipo` | `InputSomatotipo \| null` | — | — | `null` | No | **Solo** desplaza ±10 % de las kcal no proteicas entre grasa e hidratos (heurística de preferencia, sin base científica para prescribir; ver 6). Nunca afecta a kcal ni proteína. |
| 7 | `actividad_diaria` | `'sedentario' \| 'ligero' \| 'moderado' \| 'alto' \| 'muy_alto'` | — | — | `'sedentario'` | Sí | PAL base (NEAT + trabajo, **sin** contar ejercicio). Es la mayor fuente de variabilidad del gasto entre personas (Levine). Anclas operativas en tabla 3.4. |
| 8 | `entrenamiento.tipo` | `'ninguno' \| 'fuerza' \| 'cardio' \| 'mixto'` | — | — | `'ninguno'` | Sí | MET y perfil de proteína. `mixto` se trata como `fuerza` para proteína. |
| 8a | `entrenamiento.dias_semana` | entero | días | 0–7 | 0 | Sí | Prorrateo del gasto de ejercicio a media diaria; coeficiente `k` del agua. |
| 8b | `entrenamiento.minutos_sesion` | entero | min | 10–240 | 60 | Si tipo≠`ninguno` | kcal por sesión; ajuste de agua por ejercicio. |
| 8c | `entrenamiento.intensidad` | `'baja' \| 'media' \| 'alta'` | — | — | `'media'` | Si tipo≠`ninguno` | Selecciona el MET (tabla 3.5). |
| 8d | `entrenamiento.experiencia` | `'novato' \| 'intermedio' \| 'avanzado'` | — | novato <1 año fuerza constante; intermedio 1–4; avanzado >4 | `'novato'` | Sí | Tamaño del superávit; regla de recomposición para novatos con %grasa alto. |
| 8e | `entrenamiento.momento` | `Momento \| null` | — | — | `null` | No | Qué comida recibe +5 puntos de hidratos (peri-entreno). |
| 9 | `objetivo` | `'perder' \| 'mantener' \| 'ganar' \| 'recomposicion' \| 'no_se'` | — | — | — | Sí | Rama de kcal (déficit / mantenimiento / superávit / déficit leve). `no_se` se resuelve por %grasa y entrenamiento (paso 6). |
| 10 | `ritmo` | `'suave' \| 'moderado' \| 'agresivo'` | — | — | `'moderado'` | Sí | % de peso/semana en déficit (tabla 3.7) o % de superávit (tabla 3.8). Ignorado en `mantener` y `recomposicion`. |
| 11 | `peso_objetivo` | `number \| null` | kg | 30–300 | `null` | No | `null` = "no lo sé" → el motor sugiere uno. Si se da, se valida (IMC <18,5, grasa implícita, coherencia con el objetivo). |
| 12 | `preferencia` | `'omnivoro' \| 'vegetariano' \| 'vegano' \| 'sin_lactosa' \| 'sin_gluten' \| 'low_carb'` | — | — | `'omnivoro'` | Sí | `vegano` ×1,15 y `vegetariano` ×1,10 en proteína (digestibilidad/leucina); `low_carb` fija grasa al 45 % y mínimo de HC 75 g. `sin_lactosa`/`sin_gluten` no cambian números (solo alimentos de ejemplo). |
| 13 | `n_comidas` | entero | — | 2–6 | 3 | Sí | Solo reparte; **no** cambia totales (Schoenfeld 2023). |
| 14 | `clima_caluroso` | boolean | — | — | `false` | No | +400 ml de agua (heurística prudente). |
| 15 | `embarazo_lactancia` | boolean | — | — | `false` | Si sexo=`mujer` | Exclusión total (`EXCL_EMBARAZO_LACTANCIA`). |
| 16 | `condiciones` | `Condicion[]` | — | — | `[]` | No | `diabetes` → aviso + anula `low_carb`; `renal` → aviso + proteína capada a 1,0 g/kg de **peso corporal** como último filtro + sin objetivo de agua; `cardiaca` (insuficiencia cardiaca) → aviso + sin objetivo de agua; `hepatica` → aviso; `tca` → ritmo forzado a `suave` y, si `IMC < 18,5`, exclusión (paso 0); `hipertension` (HTA o enfermedad cardiovascular) → aviso de sodio; `tiroides` → aviso de derivación; `bariatrica` (cirugía bariátrica previa) y `glp1` (semaglutida, tirzepatida y similares) → aviso de derivación + suelo de proteína 1,5 g/kg de `base`; `otra` (otra condición o tomo medicación) → aviso genérico de consulta previa. |
| 17 | `cribado_tca` | `'positivo' \| 'evitado' \| 'negativo' \| null` | — | — | `null` | No | Resultado del cribado breve del paso 5b del wizard (SPEC-ux §1.2.5b). `positivo` y `evitado` ("prefiero no responder", tratado de forma precautoria) **añaden `'tca'` a `condiciones` en el paso 0**; `negativo` y `null` no hacen nada. El valor nunca se serializa en el informe ni en el PDF. |
| 18 | `fecha_inicio` | ISO date | — | fecha válida | hoy | No | Fechas del cronograma. |

† **Excepción de la edad (única).** La edad no produce `ERR_INPUT_RANGO` entre 0 y 120: fuera de 0–120 es un error de formato del formulario; dentro de 0–120 el motor **sí se ejecuta** y es el paso 0 quien devuelve `{ excluido: 'EXCL_EDAD' }` si la edad está fuera de 18–75. Así el usuario recibe el copy compasivo de derivación en vez de un error de validación seco, y los casos 0.1/0.2 de la sección 5 son satisfacibles.

‡ **Rango de `grasa.valor`.** Se acepta 3–70 en el formulario, pero el paso 2 lo recorta a [4, 60] en hombres y [10, 60] en mujeres. Si el recorte altera el valor introducido, es obligatorio emitir `WARN_GRASA_FUERA_DE_RANGO` y mostrar en pantalla que el dato se ha ajustado: nunca se usa un valor distinto del introducido en silencio.

**Validación de dominio (obligatoria, produce `ERR_INPUT_RANGO`).** "Se validan antes de calcular" incluye los valores de los enumerados, no solo los rangos numéricos: `sexo`, `grasa.metodo`, `grasa.fuente`, `grasa.categoria`, `actividad_diaria`, `entrenamiento.tipo`, `entrenamiento.intensidad`, `entrenamiento.experiencia`, `entrenamiento.momento`, `objetivo`, `ritmo`, `preferencia`, cada elemento de `condiciones` y `cribado_tca` deben pertenecer al conjunto declarado en esta tabla; `n_comidas ∈ {2,3,4,5,6}`; `edad`, `entrenamiento.dias_semana` y `entrenamiento.minutos_sesion` deben ser enteros; `fecha_inicio` debe cumplir `/^\d{4}-\d{2}-\d{2}$/` y ser una fecha real. El error devuelve el nombre del campo en `errores`. Sin estas comprobaciones un valor fuera de dominio no producía `ERR_INPUT_RANGO`: o lanzaba una excepción, o —peor— propagaba `NaN` hasta devolver un plan con `kcal = 202 440` y macros `NaN` (`objetivo: 'adelgazar'`). Los campos que el propio §1 declara ignorados con `tipo = 'ninguno'` (`dias_semana`, `minutos_sesion`, `intensidad`, `momento`) siguen sin validarse en ese caso.

Reglas de validación cruzada (producen `ERR_INPUT_RANGO`):
- `metodo='medidas'` y `sexo='mujer'` sin `cadera_cm`.
- `metodo='conocido'` sin `valor`.
- `metodo='visual'` con `categoria` que no corresponde al sexo.
- `peso_kg / (altura_cm/100)² < 12` o `> 60` (combinación de peso y altura implausible, aunque cada valor esté en rango).
- `tipo≠'ninguno'` y `dias_semana=0` se acepta y se trata como `ninguno` (perfil `sedentario`).
- `tipo='ninguno'`: `dias_semana`, `minutos_sesion`, `intensidad` y `momento` se ignoran (pueden ser 0 / `null`); no se validan sus rangos.

---

## 2. Algoritmo paso a paso

En todo el documento: `h = altura_cm / 100` (metros), `PC = peso_kg`.

### Paso 0 — Exclusiones

Las exclusiones se evalúan en este orden exacto. `IMC = PC / h²` se calcula aquí (el paso 1 solo lo reutiliza y le asigna categoría). Antes de la primera exclusión se normaliza `condiciones`:

```
si cribado_tca ∈ {'positivo', 'evitado'} y 'tca' ∉ condiciones → condiciones = condiciones + ['tca']
```

A partir de aquí, todo el documento usa esa lista normalizada. Después se validan los inputs (§1); si alguno está fuera de rango se devuelve `{ excluido: 'ERR_INPUT_RANGO', errores: [...] }` con los nombres de los campos afectados y no se ejecuta nada más.

```
si edad < 18 o edad > 75            → devolver { excluido: 'EXCL_EDAD' } y parar
si embarazo_lactancia === true      → devolver { excluido: 'EXCL_EMBARAZO_LACTANCIA' } y parar
si IMC < 16                         → devolver { excluido: 'EXCL_IMC_MUY_BAJO' } y parar
si 'tca' ∈ condiciones y IMC < 18.5 → devolver { excluido: 'EXCL_TCA_RIESGO' } y parar
```

En una exclusión no se devuelve ningún número: ni kcal, ni macros, ni %grasa, ni peso objetivo, ni cronograma. Solo el código de exclusión y su texto de derivación (§4). El motor no calcula "por si acaso" y la interfaz no debe poder mostrar un resultado parcial.

### Paso 1 — IMC y categoría

```
IMC = PC / h²
```

| IMC | `imc_categoria` |
|---|---|
| `IMC < 18,5` | `bajo_peso` |
| `18,5 ≤ IMC < 25` | `normal` |
| `25 ≤ IMC < 30` | `sobrepeso` |
| `30 ≤ IMC < 35` | `obesidad_I` |
| `35 ≤ IMC < 40` | `obesidad_II` |
| `IMC ≥ 40` | `obesidad_III` |

Los bordes son desigualdades estrictas por arriba y no estrictas por abajo: no hay huecos ni solapes para ningún valor en coma flotante.

(OMS. Cribado poblacional, no diagnóstico; no distingue masa magra de grasa — ver `INFO_IMC_MUSCULADO`.)

### Paso 2 — Estimación del % de grasa corporal

Se calculan **siempre** (para el informe) los dos estimadores por IMC:

```
sexoCUN = (sexo === 'hombre') ? 0 : 1
CUNBAE  = -44.988 + 0.503·edad + 10.689·sexoCUN + 3.172·IMC − 0.026·IMC² + 0.181·IMC·sexoCUN
          − 0.02·IMC·edad − 0.005·IMC²·sexoCUN + 0.00021·IMC²·edad

sexoDEU = (sexo === 'hombre') ? 1 : 0
DEURENBERG = 1.20·IMC + 0.23·edad − 10.8·sexoDEU − 5.4
```

Prioridad de métodos (se usa el primero aplicable):

| Prioridad | Condición | `grasa_pct` | `fiabilidad` | `±` mostrado |
|---|---|---|---|---|
| 1 | `metodo='conocido'`, `fuente='fiable'` | `valor` | `alta` | ±2 |
| 2 | `metodo='conocido'`, `fuente='estimado'` | `valor` | `media` | ±4 |
| 3 | `metodo='medidas'` | US Navy (abajo) | `media` | ±4 |
| 4 | `metodo='visual'` | tabla 3.3 (punto medio de la categoría) | `baja` | ±5 |
| 5 | `metodo='desconocido'` | `CUNBAE` | `baja` | ±5 |

US Navy (Hodgdon & Beckett 1984), todas las medidas en cm, `log10`:

```
hombre: x = cintura − cuello
        si x < 15 → medidas inválidas
        D = 1.0324 − 0.19077·log10(x) + 0.15456·log10(altura_cm)
mujer:  x = cintura + cadera − cuello
        si x < 60 → medidas inválidas
        D = 1.29579 − 0.35004·log10(x) + 0.22100·log10(altura_cm)
grasa_navy = 495 / D − 450
si grasa_navy < 3 o > 60 → medidas inválidas
```

- Medidas inválidas → `WARN_MEDIDAS_INVALIDAS`, se usa `CUNBAE` con `fiabilidad='baja'` y `metodo_efectivo='desconocido'`.
- Si Navy es válido y `|grasa_navy − CUNBAE| > 10` → `WARN_GRASA_DISCREPANCIA` (se sigue usando Navy).

Clamp final: `grasa_pct = clamp(grasa_pct, 4, 60)` hombres; `clamp(grasa_pct, 10, 60)` mujeres.

```
si metodo_efectivo === 'conocido' y el clamp altera el valor introducido → WARN_GRASA_FUERA_DE_RANGO
```

Banda de grasa (`banda`), usada en pasos 6, 7, 8 y 17. Bordes con desigualdades explícitas (`g = grasa_pct`), sin huecos:

| Banda | Hombre | Mujer |
|---|---|---|
| `muy_bajo` | `g < 12` | `g < 20` |
| `bajo` | `12 ≤ g < 15` | `20 ≤ g < 23` |
| `medio` | `15 ≤ g < 20` | `23 ≤ g < 28` |
| `alto` | `20 ≤ g < 25` | `28 ≤ g < 32` |
| `muy_alto` | `g ≥ 25` | `g ≥ 32` |

Salida: `grasa_pct`, `grasa_fiabilidad`, `grasa_metodo_efectivo`, `grasa_rango`, `banda`. En pantalla el %grasa se muestra **como rango entero**, nunca con decimales.

El rango y los estimadores publicados se acotan al mismo dominio fisiológico que la spec ya exige a Navy,
porque los tres se imprimen tal cual en pantalla y en el PDF:

```
grasa_rango       = [max(3, grasa_pct − ±), min(65, grasa_pct + ±)]
referencias.cunbae     = clamp(CUNBAE, 3, 60)
referencias.deurenberg = clamp(DEURENBERG, 3, 60)
referencias.navy       = grasa_navy            // ya validado en 3–60 arriba
```

Sin el acotado, un hombre de 18 años, 180 cm y 52 kg (IMC 16,05) imprimía "entre −1 % y 9 % de grasa", y
una mujer de 75 años, 150 cm y 130 kg (IMC 57,8) publicaba `deurenberg = 81,2 %` como estimador de
referencia. El clamp de `grasa_pct` (4–60 H / 10–60 M) es independiente y no cambia; el de las referencias
solo afecta al bloque informativo "otros métodos", nunca al valor con el que se calcula.

### Paso 3 — Masa libre de grasa

```
MLG = PC · (1 − grasa_pct / 100)
```

### Paso 4 — BMR

Se calculan las tres ecuaciones (para mostrar el rango en el informe):

```
MIFFLIN  = 10·PC + 6.25·altura_cm − 5·edad + (hombre ? 5 : −161)
KATCH    = 370 + 21.6·MLG
HARRIS   = hombre ? 88.362 + 13.397·PC + 4.799·altura_cm − 5.677·edad
                  : 447.593 + 9.247·PC + 3.098·altura_cm − 4.330·edad
```

Selección del BMR primario:

```
si grasa_metodo_efectivo === 'conocido' y grasa_fiabilidad === 'alta' → BMR = KATCH  (bmr_ecuacion = 'katch_mcardle')
si no                                                                → BMR = MIFFLIN (bmr_ecuacion = 'mifflin')
```

Harris-Benedict nunca es primario. Nunca se promedian ecuaciones. Si `perfil='fuerza'` y `dias_semana ≥ 4` → `INFO_BMR_ATLETA` (Mifflin puede subestimar en atletas; no cambia el número).

### Paso 5 — TDEE (NEAT + ejercicio, sin sobreestimar)

```
dias   = (tipo === 'ninguno') ? 0 : dias_semana
perfil = (tipo === 'ninguno' || dias === 0) ? 'sedentario' : (tipo === 'cardio' ? 'cardio' : 'fuerza')
PAL    = tabla 3.4[actividad_diaria]
MET    = perfil === 'sedentario' ? 0 : tabla 3.5[tipo][intensidad]
kcal_sesion   = (MET − 1) · PC · minutos_sesion / 60        // MET neto: se resta el reposo, ya incluido en BMR·PAL
ejercicio_dia = kcal_sesion · dias / 7
TDEE_bruto    = BMR · PAL + ejercicio_dia
TDEE          = TDEE_bruto · 0.95                           // FACTOR_CORRECCION: margen de seguridad por sobreestimación autoinformada
```

Tres mecanismos evitan sobreestimar: (a) PAL base solo de vida diaria (1,40–1,90, tabla 3.4), no los clásicos 1,2–1,9 "con ejercicio"; (b) MET **neto** (MET − 1); (c) factor 0,95 explícito (Lichtman 1992; práctica MacroFactor/Legion), comunicado en el copy como "margen de seguridad inicial".

### Paso 6 — Objetivo efectivo y ritmo efectivo

Ejecutar en este orden exacto:

```
obj = objetivo; exp = experiencia; pobj = peso_objetivo

1. si obj === 'no_se':
      si pobj !== null y |pobj − PC| ≥ 1           → obj = (pobj < PC) ? 'perder' : 'ganar'
                                                     emitir INFO_OBJETIVO_RESUELTO_POR_PESO
      si no, si pobj !== null (|pobj − PC| < 1)      → obj = 'mantener'; INFO_OBJETIVO_IGUAL
      si no, si IMC < 20                            → obj = 'mantener'
      si no, si banda ∈ {alto, muy_alto}            → obj = 'perder'
      si no, si banda === 'muy_bajo' y perfil === 'fuerza' → obj = 'ganar'
      si no, si perfil === 'fuerza'                 → obj = 'recomposicion'
      si no                                          → obj = 'mantener'
      emitir INFO_OBJETIVO_RESUELTO (salvo que ya se haya emitido INFO_OBJETIVO_RESUELTO_POR_PESO
                                     o INFO_OBJETIVO_IGUAL)
      guardar el objetivo aquí decidido en `objetivo_propuesto`: los pasos 6.3, 6.4, 7 y 10bis pueden
      reescribir `objetivo_efectivo` después, y los textos INFO_OBJETIVO_RESUELTO* hablan de lo que
      se propuso por composición corporal, no del plan final
   (La rama `|pobj − PC| < 1` es la lectura conservadora de la regla 6.2, que no cubre este caso por
    estar restringida a `objetivo !== 'no_se'`: sin ella el motor resolvía el objetivo por composición
    corporal —podía salir `perder`— y el paso 13 tomaba como meta el peso actual, produciendo un
    informe internamente contradictorio y sin INFO_OBJETIVO_IGUAL.)

2. si objetivo !== 'no_se' y pobj !== null y obj ∈ {perder, ganar}:
      si |pobj − PC| < 1                            → obj = 'mantener'; INFO_OBJETIVO_IGUAL
      si no, si obj === 'perder' y pobj > PC        → obj = 'ganar';    WARN_OBJETIVO_INCOHERENTE
      si no, si obj === 'ganar'  y pobj < PC        → obj = 'perder';   WARN_OBJETIVO_INCOHERENTE
   (si el usuario NO eligió objetivo, el peso objetivo ya fijó la dirección en 6.1 y nunca se le
    acusa de incoherencia)

3. GUARDARRAÍL DE BAJO PESO — incondicional, se aplica sea cual sea el objetivo de partida:
      si IMC < 18.5 y obj ∈ {perder, recomposicion} → obj = 'mantener'; WARN_IMC_BAJO_NO_DEFICIT
      si obj === 'perder' y banda ∈ {muy_bajo, bajo} → obj = 'recomposicion'; WARN_YA_MAGRO
      si obj === 'perder' y pobj === null y MLG / (1 − g_c/100) ≥ PC − 0.5
                                                    → obj = 'recomposicion'; WARN_YA_EN_OBJETIVO
      (`g_c` es el %grasa objetivo central del paso 13: 15 H / 23 M, o 18 H / 26 M a partir de 65 años.
       Coincide exactamente con el borde inferior de la banda `medio`, así que sin esta regla un usuario
       justo en ese borde recibía un déficit real y un cronograma de cero semanas.)

4. si obj === 'ganar':
      si IMC ≥ 18.5 y (exp === 'novato' o perfil !== 'fuerza') y banda ∈ {alto, muy_alto}
                                                    → obj = 'recomposicion'; WARN_RECOMPOSICION_SUGERIDA
      si no, si perfil !== 'fuerza'                 → WARN_GANAR_SIN_FUERZA (obj sigue 'ganar', superávit 5 %)
   (La guarda `IMC ≥ 18.5` es obligatoria: el guardarraíl 6.3 ya ha pasado, así que sin ella un usuario
    en bajo peso con banda de grasa alta —perfil «delgado con poco músculo», frecuente en mujeres— salía
    del paso 6 como `recomposicion`, el paso 7 lo devolvía a `mantener` por la regla de margen y quien
    pedía GANAR peso estando en bajo peso recibía un plan de mantenimiento sin ningún aviso que lo
    explicara. Manteniendo `ganar` recibe el superávit —mínimo 150 kcal/día— que la rama `ganar` del
    paso 7 garantiza, y que la prohibición de balance negativo en bajo peso no puede anular.)

5. si obj === 'recomposicion' y perfil !== 'fuerza' → WARN_RECOMPOSICION_SIN_FUERZA

6. si obj ∈ {mantener, recomposicion} y pobj !== null y |pobj − PC| ≥ 1 → INFO_OBJETIVO_IGNORADO

7. ritmo_ef = ritmo
   si 'tca' ∈ condiciones: INFO_RITMO_SUAVE; si ritmo_ef !== 'suave' → ritmo_ef = 'suave'
   // `INFO_RITMO_SUAVE` no menciona la causa: el cuestionario promete que la respuesta del cribado
   // es privada y no aparece en el informe, y el PDF lista todos los avisos con su texto íntegro.
   // El enlace de ADANER es un pie fijo universal del informe, así que su presencia no revela nada.
   si edad ≥ 65 y obj === 'perder' y ritmo_ef === 'agresivo' → ritmo_ef = 'moderado'; WARN_PERDIDA_MAYOR_65
   si edad ≥ 65 y obj === 'perder' y ritmo_ef !== 'agresivo' → WARN_PERDIDA_MAYOR_65
   // En la segunda rama no se ha suavizado ningún ritmo (el usuario ya venía en suave o
   // moderado): el texto del aviso omite entonces el fragmento «{ y suavizado el ritmo}» (§4).
   // Lo que sí se ha limitado siempre a esa edad es el déficit máximo (`cap_pct ≤ 0,20`, paso 7).
   // `WARN_PERDIDA_MAYOR_65` se emite aquí contra el objetivo INTERMEDIO, pero el paso 7 todavía puede
   // reescribir `objetivo_efectivo` a 'mantener' (regla de margen). El paso 17 lo reevalúa contra
   // `objetivo_efectivo` y lo retira si ya no es 'perder', para que la condición exacta que declara
   // la §4 sea literalmente cierta y comprobable por tests.

8. preferencia_efectiva = preferencia
   si 'diabetes' ∈ condiciones y preferencia === 'low_carb'
        → preferencia_efectiva = 'omnivoro'; WARN_LOWCARB_DIABETES
   (a partir de aquí, todo el documento usa `preferencia_efectiva` donde dice `preferencia`)
   `preferencia_efectiva` se publica en `Resultado`: el generador de comidas y el PDF deben leerla de ahí
   y no de `inputs.preferencia`, o seleccionarían el banco low-carb para un plan que el motor ya ha
   convertido en omnívoro (330 g de hidrato al día contra plantillas cuyo ancla de carbohidrato es
   opcional: ninguna cierra dentro del ±10 % de kcal y se agota el banco entero).

objetivo_efectivo = obj
```

**Reglas de supresión de avisos contradictorios** (se aplican al conjunto final de avisos, tras el paso 17):

| Si se emite | Se suprime |
|---|---|
| `INFO_OBJETIVO_IGNORADO` | `WARN_OBJETIVO_INCOHERENTE` (el peso objetivo no se ha usado: no tiene sentido decir que el plan se calculó según él) |
| `WARN_IMC_BAJO_NO_DEFICIT` | `WARN_YA_MAGRO` |
| `EXCL_*` (cualquiera) | todos los demás avisos |
| `WARN_RENAL` | `INFO_MAYOR_60` (se sustituye por `INFO_MAYOR_60_RENAL`, ver paso 17) |
| `WARN_YA_EN_OBJETIVO` | `WARN_YA_MAGRO` |
| `WARN_SIN_MARGEN_DEFICIT` | `WARN_DEFICIT_MINIMO`, `INFO_DEFICIT_CAPADO_TDEE`, `WARN_YA_MAGRO`, `WARN_RECOMPOSICION_SUGERIDA` y `WARN_RECOMPOSICION_SIN_FUERZA` (el plan final es `mantener`: los tres últimos afirman literalmente que "te proponemos una recomposición", que ya no es cierto) |
| `INFO_AGUA_NO_PRESCRITA` | `WARN_AGUA_ALTA` e `INFO_AGUA_MAYORES` |
| Cualquier código de corte del paso 14 —lista cerrada: `INFO_SIN_CRONOGRAMA`, `INFO_SIN_CRONOGRAMA_SIN_MARGEN`, `INFO_CRONOGRAMA_NO_ESTIMABLE`, `INFO_CRONOGRAMA_FUERA_DE_HORIZONTE`— | `INFO_ADAPTACION` y `WARN_CRONOGRAMA_LARGO` |
| `INFO_OBJETIVO_RESUELTO_POR_PESO` | `INFO_OBJETIVO_IGNORADO` (el peso objetivo sí se ha usado: fijó la dirección del plan) |
| `WARN_RENAL` | `INFO_PROTEINA_CAPADA` (el límite que manda es el tope renal de 1,0 g/kg, no los 2,5 g/kg ni el % de kcal que nombra el texto capado; `WARN_RENAL` ya explica el tope y da la cifra) |

La lista es cerrada: los tests comprueban que ningún par de esta tabla aparece junto en `avisos`.

**Avisos dependientes del cronograma.** `WARN_SUELO_CALORICO_SEXO`, `_BMR` y `_EA` prometen que se ha
"alargado el calendario". Cuando `cronograma === null` esa promesa es falsa (no hay calendario), así que
se emite la **variante corta** del texto declarada en la §4, sin la oración final sobre el calendario.
Es una regla de texto, no de supresión: el aviso del suelo sigue siendo información verdadera y necesaria.

### Paso 7 — Objetivo calórico

```
cap_pct = (banda === 'muy_alto') ? 0.30 : 0.25
si edad ≥ 65 → cap_pct = min(cap_pct, 0.20)         // pérdida más conservadora en mayores

perder:
   ritmo_pct     = tabla 3.7[banda][ritmo_ef]                 // % del peso por semana
   deficit_ritmo = ritmo_pct / 100 · PC · 7700 / 7            // kcal/día para ese ritmo
   deficit_cap   = cap_pct · TDEE
   si deficit_ritmo > deficit_cap → INFO_DEFICIT_CAPADO_TDEE
   deficit       = min(deficit_ritmo, deficit_cap)
   kcal_calc     = TDEE − deficit

ganar:
   sup_pct   = (perfil !== 'fuerza') ? 0.05 : tabla 3.8[experiencia][ritmo_ef]
   superavit = clamp(sup_pct · TDEE, 150, 500)
   kcal_calc = TDEE + superavit

recomposicion:
   kcal_calc = TDEE · (1 − tabla 3.9[banda])

mantener:
   kcal_calc = TDEE
```

Prohibición dura de balance negativo en bajo peso (red de seguridad redundante con el paso 6.3):

```
si IMC < 18.5 → kcal_calc = max(kcal_calc, TDEE)
```

Suelos de seguridad (se aplican si `objetivo_efectivo ∈ {perder, recomposicion}`):

```
suelo_sexo = hombre ? 1500 : 1200
suelo_bmr  = BMR                                    // nunca por debajo del BMR primario
suelo_ea   = (banda === 'muy_alto' ? 25 : 30) · MLG + ejercicio_dia
suelo      = max(suelo_sexo, suelo_bmr, suelo_ea)
si kcal_calc < suelo:
   kcal_calc = suelo; suelo_activo = true
   emitir WARN_SUELO_CALORICO_EA   si suelo === suelo_ea  y suelo_ea > max(suelo_sexo, suelo_bmr)
   emitir WARN_SUELO_CALORICO_BMR  si no, y suelo === suelo_bmr y suelo_bmr ≥ suelo_sexo
   emitir WARN_SUELO_CALORICO_SEXO en el resto de casos
```

Suelo por sexo también en `mantener` y `ganar` (la §3.1 lo declara como constante global, no como regla de déficit):

```
si objetivo_efectivo ∈ {mantener, ganar} y kcal_calc < suelo_sexo:
   kcal_calc = suelo_sexo; suelo_activo = true; WARN_GASTO_BAJO_MINIMO
```

Redondeo (dirigido si hubo suelo, §0.1) y **primera pasada** de la comprobación de margen real de déficit:

```
kcal = suelo_activo ? roundUp10(kcal_calc) : round10(kcal_calc)

si objetivo_efectivo ∈ {perder, recomposicion} y kcal ≥ TDEE − 50:
   objetivo_efectivo = 'mantener'
   kcal = round10(max(TDEE, kcal))
   emitir WARN_SIN_MARGEN_DEFICIT
```

`WARN_DEFICIT_MINIMO` **no** se evalúa aquí: los pasos 9 y 10 todavía pueden subir `kcal`, así que su condición (`50 ≤ TDEE − kcal < 100`) solo es comprobable contra las calorías finales. Se calcula en el paso 10bis, igual que la segunda pasada de la regla de margen.

La regla del margen es la que impide que un suelo de seguridad deje `kcal ≥ TDEE` con etiqueta de "pérdida de grasa": un plan así es en realidad un mantenimiento, y llamarlo déficit produce además cronogramas imposibles (paso 14). Se comunica con honestidad: el gasto estimado ya está en el mínimo seguro y la palanca disponible es subir la actividad diaria, no bajar más las calorías.

`suelo_ea` implementa el guardarraíl de disponibilidad energética (< 30 kcal/kg MLG = daño endocrino; IOC REDs 2023). Es la protección real para usuarias mujeres; no existe un "mínimo de grasa dietética femenino" con evidencia. Ya **no se desactiva** en la banda `muy_alto`: se atenúa a 25 kcal/kg MLG. La exención categórica anterior dependía de un %grasa que en la mayoría de los casos es una estimación con ±5 puntos de error, de modo que 0,1 puntos de %grasa hacían desaparecer la protección entera (IOC REDs 2023 no exime a las personas con obesidad en pérdida rápida).

### Paso 8 — Proteína

Base de cálculo:

```
PC30 = 30 · h²
PA   = PC30 + 0.25 · (PC − PC30)                  // peso ajustado
base = (IMC ≥ 30) ? PA : PC
base_tipo = (IMC ≥ 30) ? 'peso_ajustado' : 'peso_corporal'
```

g/kg:

```
si IMC ≥ 30:  gkg = tabla 3.10 fila 'sedentario'[objetivo_efectivo]   // fila de obesidad (Weijs 2024)
              si perfil !== 'sedentario' → gkg += 0.2
si no:        gkg = tabla 3.10[perfil][objetivo_efectivo]

si edad ≥ 60                                       → gkg += 0.2
si objetivo_efectivo === 'perder' y ritmo_ef === 'agresivo' → gkg += 0.2
si objetivo_efectivo ∈ {perder, recomposicion} y banda ∈ {muy_bajo, bajo} → gkg += 0.2
si edad ≥ 60 → gkg = max(gkg, perfil === 'fuerza' ? 1.6 : 1.2)
si 'bariatrica' ∈ condiciones o 'glp1' ∈ condiciones → gkg = max(gkg, 1.5)   // pérdida rápida: proteger masa magra
si preferencia === 'vegano'      → gkg = gkg · 1.15     // digestibilidad / leucina
si preferencia === 'vegetariano' → gkg = gkg · 1.10
gkg = min(gkg, IMC ≥ 30 ? 2.0 : 2.4)               // el techo es SIEMPRE el último filtro de g/kg
si 'hepatica' ∈ condiciones     → WARN_HEPATICA
si 'diabetes' ∈ condiciones     → WARN_DIABETES
si 'cardiaca' ∈ condiciones     → WARN_CARDIACA
si 'hipertension' ∈ condiciones → WARN_HIPERTENSION
si 'tiroides' ∈ condiciones     → WARN_TIROIDES
si 'bariatrica' ∈ condiciones o 'glp1' ∈ condiciones → WARN_BARIATRICA_GLP1
si 'otra' ∈ condiciones         → WARN_CONDICION_OTRA
```

El techo de g/kg va **después** de los multiplicadores por preferencia: así el valor de `gkg` que se publica en el informe nunca supera el 2,4 (2,0 con peso ajustado) que la §3.1 declara como constante. El ajuste por digestibilidad vegetal ya no puede empujarlo a 2,76.

Conversión a gramos y techos:

```
P_raw   = gkg · base
pct_cap = (preferencia ∈ {vegano, vegetariano} y kcal < 1800) ? 0.30 : 0.35
P_cap   = min(2.5 · PC, pct_cap · kcal / 4)        // techo por utilidad y por % de kcal
P       = min(P_raw, P_cap)
P       = max(P, 0.8 · PC)                         // línea roja RDA
si P < P_raw → INFO_PROTEINA_CAPADA

// CAP RENAL: último filtro, sobre PESO CORPORAL, por encima de la línea roja RDA
si 'renal' ∈ condiciones:
   P = min(P, 1.0 · PC)
   P = roundDown5(P)
   WARN_RENAL
si no:
   P = (P === P_cap) ? roundDown5(P) : round5(P)   // redondeo dirigido si el techo está activo
   si P < 0.8 · PC → P = roundUp5(0.8 · PC)

P_min = (edad ≥ 60) ? (perfil === 'fuerza' ? 1.6 : 1.2) · base : 1.2 · base   // mínimo para el bucle del paso 10
si 'renal' ∈ condiciones → P_min = min(P_min, 1.0 · PC)   // el bucle del paso 10 nunca sube P por encima del cap renal
si no                    → P_min = max(P_min, 0.8 · PC)   // el bucle nunca baja P por debajo de la línea roja RDA
```

`P_min` se define sobre `base`, que con `IMC ≥ 30` es el peso ajustado `PA`. Cuando `1,2 · PA < 0,8 · PC`
—lo que ocurre en IMC muy altos— el bucle del paso 10 podía recortar la proteína **por debajo** de la
línea roja de 0,8 g/kg de peso corporal que la §3.1 declara como constante global, porque el guardarraíl
`si P < 0,8 · PC` de este paso ya había quedado atrás (mujer de 130 cm y 95 kg: `P_min = 74,1` frente a
los 76 g de la línea roja, y el bucle dejaba 75 g sin ningún aviso). Por eso `P_min` se cierra ahora por
abajo con la línea roja igual que se cierra por arriba con el cap renal, y **el orden importa**: con
condición `renal` manda el tope de 1,0 g/kg y la línea roja no se aplica (§3.1). Este `P_min` se
recalcula con la misma regla cada vez que el bucle del paso 10 cambia las kcal.

`pct_cap` baja al 30 % en dietas vegetales con menos de 1.800 kcal porque el 35 % en esas calorías produce objetivos que no se pueden componer con alimentos vegetales enteros dentro de los máximos de ración culinaria (y el módulo de comidas acabaría entregando raciones imposibles o incumpliendo su tolerancia).

El cap renal es ahora el **último** filtro y se expresa sobre el peso corporal real, que es lo que dice el copy. Antes se aplicaba sobre `base` (peso ajustado en obesidad) y la línea roja RDA `max(P, 0,8 · PC)` lo pisaba después, entregando hasta un 52 % más de proteína que la cifra prometida al usuario. Báscula no prescribe proteína a pacientes renales: el cap es solo un tope de prudencia y el texto de `WARN_RENAL` debe dejar claro que el rango real (0,55–1,2 g/kg según estadio y diálisis) lo decide el nefrólogo.

### Paso 9 — Grasa

```
pct_grasa = preferencia === 'low_carb'  ? 0.45
          : objetivo_efectivo === 'perder' ? (ritmo_ef === 'agresivo' ? 0.25 : 0.28)
          : objetivo_efectivo === 'recomposicion' ? 0.28
          : objetivo_efectivo === 'mantener' ? 0.32
          : 0.27                                                         // ganar
suelo_gkg = hombre ? 0.7 : 0.8
suelo_g   = max(suelo_gkg · base, 0.20 · kcal / 9)                       // base = PC o PA (paso 8)
techo_g   = (preferencia === 'low_carb' ? 0.50 : 0.40) · kcal / 9

// Suelo y techo pueden cruzarse en planes muy bajos en kcal: la conclusión correcta no es
// forzar la grasa por encima de su techo, sino que faltan calorías para cuadrar los macros.
// Y no basta con que la franja exista: como la grasa se prescribe redondeada a 5 g, tiene que
// CONTENER algún múltiplo de 5, es decir `roundUp5(suelo_g) ≤ techo_g`. Si no lo contiene, el
// redondeo dirigido de más abajo acaba devolviendo `roundDown5(techo_g)`, por debajo del suelo.
mientras roundUp5(suelo_g) > techo_g:                                    // incluye suelo_g > techo_g
   kcal = roundUp10(roundUp5(suelo_g) · 9 / (preferencia === 'low_carb' ? 0.50 : 0.40))
   WARN_KCAL_INSUFICIENTES_PARA_MACROS
   recalcular suelo_g y techo_g con las kcal nuevas (y P_cap del paso 8; si P > P_cap → P = roundDown5(P_cap))
   // converge en dos vueltas como mucho: si el suelo lo fija el 20 % de las kcal, la franja mide
   // 0,20 · kcal / 9 ≥ 5 g y entonces siempre contiene un múltiplo de 5

G0        = clamp(pct_grasa · kcal / 9, suelo_g, techo_g)

// Ajuste por somatotipo (heurística de preferencia, calóricamente neutro)
soma  = clasificarSomatotipo(somatotipo)          // tabla 3.2; null → 'mesomorfo'
delta = 0.10 · (kcal − 4 · P) / 9                 // 10 % de las kcal no proteicas, en g de grasa
si preferencia !== 'low_carb' y soma === 'endomorfo' → G1 = min(G0 + delta, techo_g); INFO_SOMATOTIPO
si preferencia !== 'low_carb' y soma === 'ectomorfo' → G1 = max(G0 − delta, suelo_g); INFO_SOMATOTIPO
si no                                                → G1 = G0
G = round5(G1)
si G < suelo_g → G = roundUp5(suelo_g)              // el redondeo nunca deja la grasa bajo el suelo
si G > techo_g → G = roundDown5(techo_g)            // ni por encima del techo del 40 % (50 % low-carb)
```

El orden importa: primero se garantiza el suelo y después el techo. El invariante `suelo_g ≤ G ≤ techo_g` se cumple **siempre** (invariantes **S7c** y **S7d** del barrido) precisamente porque el bloque anterior garantiza antes que la franja contenga un múltiplo de 5 g: con la condición antigua (`si suelo_g > techo_g`) había 56 perfiles válidos en los que `roundUp5(suelo_g)` superaba el techo, la segunda línea devolvía `roundDown5(techo_g)` y la grasa acababa hasta 2 g por debajo de su suelo obligatorio sin emitir ningún aviso. Con el redondeo anterior (`G = G + 5`) la grasa podía acabar en el 41,5 % de las kcal, por encima del techo que la §3.1 declara como constante global.

### Paso 10 — Hidratos de carbono (resto) y factibilidad

```
HC_min = (preferencia === 'low_carb') ? 75 : 130       // RDA IOM 130 g; 75 g solo en low-carb declarado
bucle:
   HC = (kcal − 4·P − 9·G) / 4
   si HC ≥ HC_min → salir
   si G − 5 ≥ suelo_g     → G = G − 5; repetir        // la grasa se sacrifica PRIMERO
   si P − 5 ≥ P_min       → P = P − 5; repetir        // la proteína es la última variable que se toca
   kcal = kcal + 50; WARN_DEFICIT_INFACTIBLE
   recalcular con las kcal nuevas: suelo_g, techo_g, P_cap (paso 8) y P_min
   si P > P_cap → P = roundDown5(P_cap)
   si G < suelo_g → G = roundUp5(suelo_g);  si G > techo_g → G = roundDown5(techo_g)
   repetir
HC = round5(HC)
kcal_cierre = 4·P + 4·HC + 9·G
afirmar |kcal_cierre − kcal| ≤ 0.02 · kcal    // obligatorio: si falla, lanzar excepción
```

**Orden de sacrificio (normativo, vale también para el generador de menús):** cuando los números no cuadran se recorta primero la **grasa** hasta su suelo, después la **proteína** hasta `P_min`, y solo en último caso se suben las calorías. La proteína es la última variable que se sacrifica, porque en déficit es la que preserva la masa magra (Helms 2014, Longland 2016). Cualquier otro documento del proyecto que describa este orden debe coincidir literalmente con esta regla. Además, cada vez que el bucle modifica `kcal` hay que recalcular los límites que dependen de ella (`suelo_g`, `techo_g`, `P_cap`, `P_min`).

`kcal` (objetivo) es lo que se muestra como calorías; `kcal_cierre` puede diferir ≤ 10 kcal por el redondeo a 5 g (se documenta en el PDF). Porcentajes derivados: `%P = 4P/kcal`, `%G = 9G/kcal`, `%HC = 4HC/kcal`. Se muestran g, g/kg PC y % (el % es un resultado, no un input).

**El bucle siempre converge con inputs válidos** (la validación de dominio de la §1 lo garantiza: sin ella, un enum fuera de rango propaga `NaN` y la comparación `HC ≥ HC_min` nunca se cumple). Una implementación puede llevar un tope de iteraciones como red de seguridad, pero **agotarlo es un fallo del motor, no una salida válida**: debe lanzar una excepción, nunca devolver un plan con `HC < HC_min` o con macros `NaN`.

### Paso 10bis — Segunda pasada de la regla de margen (contra las kcal finales)

Los pasos 9 (`WARN_KCAL_INSUFICIENTES_PARA_MACROS`) y 10 (`WARN_DEFICIT_INFACTIBLE`) pueden **subir** `kcal` después de la primera pasada del paso 7. Por eso la regla de margen y `WARN_DEFICIT_MINIMO` se reevalúan aquí, con los macros ya cerrados y antes de que el peso objetivo (paso 13) y el cronograma (paso 14) lean `objetivo_efectivo`:

```
si objetivo_efectivo ∈ {perder, recomposicion} y kcal ≥ TDEE − 50:
   objetivo_efectivo = 'mantener'
   emitir WARN_SIN_MARGEN_DEFICIT
   (no se tocan `kcal` ni los macros: el paso 10 ya los ha cerrado y volver a subirlos
    obligaría a repetir los pasos 8-10; el plan ya está a menos de 50 kcal del gasto)

si objetivo_efectivo === 'perder' y 50 ≤ TDEE − kcal < 100 → WARN_DEFICIT_MINIMO
```

Sin esta segunda pasada había planes etiquetados `perder` cuyas calorías finales quedaban **al nivel del gasto o por encima** (hasta +539 kcal/día en el barrido) sin emitir `WARN_SIN_MARGEN_DEFICIT`, mientras el informe imprimía `INFO_DEFICIT_CAPADO_TDEE` ("hemos limitado el déficit") sobre un plan en superávit. La condición exacta que declara la §4 para `WARN_SIN_MARGEN_DEFICIT` vuelve a ser literalmente cierta en la salida final, y el invariante **S24** (`objetivo_efectivo === 'perder' ⇒ TDEE − kcal ≥ 50`) la comprueba. El cambio de etiqueta no reabre los macros: se calcularon con los parámetros de `perder` (proteína algo más alta, grasa algo más baja), que en un plan de mantenimiento son conservadores y siguen dentro de todos los suelos y techos.

### Paso 11 — Fibra

```
fibra_prop = 14 · kcal / 1000                             // objetivo proporcional (EFSA 14 g/1000 kcal)
suelo_fibra = (preferencia === 'low_carb') ? max(20, 10 · kcal / 1000) : min(25, 0.15 · HC)
fibra = Math.round(clamp(fibra_prop, suelo_fibra, 40))    // g/día
si fibra < 25 → INFO_FIBRA_AJUSTADA
azucares_libres_max = 0.10 · kcal / 4                       // g/día, solo informativo (OMS <10 %, ideal <5 %)
```

El suelo de 25 g deja de ser duro: en planes de pocas calorías (y sobre todo en low-carb) exigir 25 g de fibra puede suponer más del 30 % de todo el hidrato del día, que no es alcanzable con comida real y se tolera mal si se fuerza. El suelo se ata ahora al hidrato realmente prescrito (`0,15 · HC`) y se declara el compromiso con `INFO_FIBRA_AJUSTADA` en vez de imprimir una cifra de referencia inalcanzable.

### Paso 12 — Agua

```
si 'renal' ∈ condiciones o 'cardiaca' ∈ condiciones:
   agua_ml = null; agua_rango = null; vasos = null
   emitir INFO_AGUA_NO_PRESCRITA
   (no se muestra ningún objetivo de hidratación en pantalla ni en el PDF)
   parar aquí el paso 12

k = (actividad_diaria ∈ {alto, muy_alto} o dias ≥ 4) ? 35
  : (actividad_diaria === 'moderado' o 1 ≤ dias ≤ 3)  ? 33
  : 30                                                   // ml/kg
suelo_agua  = hombre ? 2000 : 1500                        // parte BEBIDA de la referencia EFSA 2010
base_ml     = PC · k
agua_base   = max(base_ml, suelo_agua)
agua_base   = min(agua_base, hombre ? 4000 : 3100)        // techo de referencia IOM/p95 EFSA para sedentarios
min_dia     = perfil === 'sedentario' ? 0 : minutos_sesion · dias / 7
aj_ejercicio = min(1000, min_dia / 60 · 500)              // 500 ml/h, tope 1000 ml
aj_clima    = clima_caluroso ? 400 : 0
agua_ml     = round50(clamp(agua_base + aj_ejercicio + aj_clima, suelo_agua, 4000))
vasos       = Math.round(agua_ml / 250)                   // orientativo: vasos · 250 ≠ agua_ml
agua_rango  = [max(agua_ml − 250, suelo_agua), min(agua_ml + 250, 4000)]
              // el extremo alto se acota al mismo techo duro de 4 000 ml de la §3.1: sin él, el informe
              // recomendaba hasta 4 250 ml justo al lado de WARN_AGUA_ALTA, que advierte de hiponatremia
si agua_ml ≥ 3500 → WARN_AGUA_ALTA
si edad ≥ 65 → INFO_AGUA_MAYORES
```

Tres correcciones respecto a la v1: (a) en enfermedad renal o cardiaca **no se da objetivo de agua**, porque la restricción hídrica es tratamiento estándar en esas condiciones y una sobrecarga de líquidos es causa habitual de ingreso; (b) el suelo se ancla a la parte *bebida* de la referencia EFSA 2010 (los 2,0/2,5 L de EFSA son agua **total**, incluyendo la de los alimentos, que aporta un 20–30 %), y el techo total baja a 4.000 ml; (c) el extremo inferior del rango nunca cae por debajo del propio suelo. El número se presenta siempre como rango y los vasos como aproximación explícita ("unos {vasos} vasos de 250 ml"), nunca como una equivalencia exacta.

### Paso 13 — Peso objetivo: sugerido y validación del dado por el usuario

Cálculos comunes (siempre, para el informe):

```
(g_c, g_lo, g_hi) = hombre ? (15, 12, 17) : (23, 20, 25)          // %grasa objetivo central y rango
si edad ≥ 65 → (g_c, g_lo, g_hi) = hombre ? (18, 15, 20) : (26, 23, 28)
      // a igual salud, el %grasa de referencia sube con la edad (Gallagher 2000) y el IMC de menor
      // mortalidad se desplaza hacia arriba: no se pone a un hombre de 73 años un objetivo del 15 %

pesoA   = MLG / (1 − g_c/100)                                       // método por %grasa
rangoA  = [MLG / (1 − g_lo/100), MLG / (1 − g_hi/100)]
pesoB   = 22 · h²;   rangoB = [20 · h², 24.9 · h²]                  // método por IMC (referencia)
imc_min = (edad ≥ 65) ? 22 : 18.5                                   // suelo de IMC del peso objetivo
min185  = imc_min · h²                                              // nunca sugerir por debajo
±_g     = {alta: 2, media: 4, baja: 5}[grasa_fiabilidad]            // puntos de %grasa (paso 2)
w       = MLG · (±_g/100) / (1 − g_c/100)                           // ensanche en kg, escalado con la MLG
pulg    = altura_cm / 2.54
clasicas = (150 ≤ altura_cm ≤ 200)
   ? { devine:   hombre ? 50 + 2.3·(pulg−60)   : 45.5 + 2.3·(pulg−60),
       robinson: hombre ? 52 + 1.9·(pulg−60)   : 49 + 1.7·(pulg−60),
       miller:   hombre ? 56.2 + 1.41·(pulg−60): 53.1 + 1.36·(pulg−60),
       hamwi:    hombre ? 48 + 2.7·(pulg−60)   : 45.5 + 2.2·(pulg−60) }   // solo informativas
   : null                                                           // fuera de 150–200 cm devuelven valores absurdos

// Rango sugerido: nunca invertido y siempre conteniendo al valor central
lo = max(min(rangoA[0] − w, rangoA[1] + w), min185)
hi = max(rangoA[1] + w, lo)
si min185 > rangoA[1] + w → lo = hi = min185; INFO_PESO_YA_MINIMO
lo05 = roundUp05(lo)                             // redondeo dirigido: el extremo inferior nunca cruza el suelo
hi05 = max(round05(hi), lo05)
sugerido_rango   = [lo05, hi05]
sugerido_central = clamp(round05(clamp(max(pesoA, min185), lo, hi)), lo05, hi05)
mostrar_central  = (grasa_fiabilidad !== 'baja')
piso_peso        = min185                        // suelo duro del peso objetivo, se endurece más abajo
```

**Precisión del peso sugerido.** El peso sugerido se redondea a 0,5 kg, nunca a 0,1: sale de dividir una MLG estimada (±2/±4/±5 puntos de %grasa) entre un objetivo de composición, y un decimal es precisión falsa. El ensanche `w` ya no es una constante de 0/1/3 kg: se escala con la MLG y con el error del método, así que una mujer de 45 kg de MLG con estimación visual obtiene ≈ ±3 kg y no un rango artificialmente estrecho. Cuando `grasa_fiabilidad === 'baja'` (el caso por defecto, CUN-BAE o selector visual) `mostrar_central = false`: la pantalla y el PDF muestran **solo la franja** ("entre X e Y kg"), sin número grande. El motor sigue devolviendo `sugerido_central` porque el cronograma necesita un punto de llegada, pero no se presenta como "tu objetivo".

Por objetivo efectivo:

```
perder:
   si pobj === null:
      peso_obj_ef = sugerido_central                     (metodo 'grasa')
   si no:
      peso_obj_ef = pobj
      si peso_obj_ef / h² < imc_min → WARN_OBJETIVO_IMC_BAJO; peso_obj_ef = min185
      // `WARN_OBJETIVO_IMC_BAJO` NO afirma dónde queda la meta final ("lo hemos subido", §4):
      // el suelo por `g_min` de tres líneas más abajo puede subirla otra vez, y con la
      // redacción anterior ("hemos fijado el objetivo en ese mínimo") los dos avisos se
      // contradecían por escrito en el mismo informe (caso 8 de la §5: 48,6 kg prometidos
      // frente a los 59,5 kg reales). No hace falta suprimir ninguno de los dos.
      grasa_implicita = (1 − MLG / peso_obj_ef) · 100
      g_min = hombre ? 12 : 20                            // límite superior de la banda `muy_bajo`
      si grasa_implicita < g_min:
         WARN_OBJETIVO_GRASA_MUY_BAJA
         piso_peso   = max(MLG / (1 − g_min/100), min185)
         peso_obj_ef = piso_peso
         mostrar_central = false                          // no se fija un número nuevo: se muestra la franja
   peso_obj_ef = round05(peso_obj_ef)
   si peso_obj_ef < piso_peso → peso_obj_ef = roundUp05(piso_peso)   // el redondeo nunca cruza el suelo
   // Se evalúa UNA sola vez, fuera del bloque `si no:`, contra el peso objetivo ya cerrado:
   // la condición que declara la §4 no distingue quién fijó la meta, y con `pobj === null`
   // (meta propuesta por la app) la comprobación no llegaba a ejecutarse nunca.
   si (PC − peso_obj_ef) / PC > 0.25 → WARN_OBJETIVO_MUY_LEJANO
   hito = ((PC − peso_obj_ef) / PC > 0.15) ? round05(PC · 0.90) : null   // hito intermedio −10 %

ganar:
   ritmo_kg = (kcal − TDEE) · 7 / 7700
   sugerido_central = round05(PC + ritmo_kg · 16)         (metodo 'ritmo_16_semanas')
   sugerido_rango   = [round05(PC + ritmo_kg · 12), round05(PC + ritmo_kg · 20)]
   si sugerido_central   < min185 → sugerido_central   = roundUp05(min185)
   si sugerido_rango[0]  < min185 → sugerido_rango[0]  = roundUp05(min185)
   // techo de IMC 27,5 (§3.1) — se aplica también al sugerido, no solo a peso_obj_ef
   techo275 = roundDown05(27.5 · h²)
   si PC / h² ≤ 27.5:                       // el techo nunca baja la meta por debajo del peso actual
      sugerido_rango[0] = min(sugerido_rango[0], techo275)
      sugerido_rango[1] = min(sugerido_rango[1], techo275)
      sugerido_central  = min(sugerido_central,  techo275)
   sugerido_rango[1] = max(sugerido_rango[1], sugerido_rango[0], sugerido_central)
   sugerido_central  = clamp(sugerido_central, sugerido_rango[0], sugerido_rango[1])
   mostrar_central  = true
   si pobj === null: peso_obj_ef = sugerido_central
   si no:
      peso_obj_ef = pobj
      si peso_obj_ef / h² < imc_min → WARN_OBJETIVO_SIGUE_BAJO_PESO; peso_obj_ef = max(peso_obj_ef, min185)
      si peso_obj_ef / h² > 27.5  → WARN_OBJETIVO_IMC_ALTO;          peso_obj_ef = 27.5 · h²
      si (peso_obj_ef − PC) / PC > 0.10 → WARN_GANANCIA_LEJANA
   peso_obj_ef = round05(peso_obj_ef)
   si peso_obj_ef < piso_peso     → peso_obj_ef = roundUp05(piso_peso)
   si peso_obj_ef / h² > 27.5:
      peso_obj_ef = max(roundDown05(27.5 · h²), round05(PC), sugerido_central)
      si peso_obj_ef / h² > 27.5 → WARN_OBJETIVO_IMC_ALTO (si no se emitió ya)
   // Cuando el peso actual ya supera IMC 27,5, el techo no puede aplicarse: recortar a 27,5·h²
   // convertía un plan de GANANCIA en una meta 22 kg por debajo del peso de partida (hombre de 150 cm
   // y 84 kg: sugerido 86 kg y "objetivo" 61,5 kg en la misma pantalla). En ese caso la meta es el
   // propio sugerido y el usuario recibe WARN_OBJETIVO_IMC_ALTO.

mantener / recomposicion:
   sugerido_central = round05(PC)                        (metodo 'actual')
   sugerido_rango   = [round05(min(lo, PC)), round05(max(hi, PC))]   // la franja por %grasa se ensancha
                                                                    // hasta contener el peso actual
   mostrar_central  = true
   peso_obj_ef = null
```

**Invariantes del paso 13** (comprobados en los tests para todos los perfiles válidos):

- `sugerido_rango[0] ≤ sugerido_central ≤ sugerido_rango[1]` siempre (nunca un rango invertido ni un valor central fuera de su propio rango).
- En la rama `ganar` con `pobj === null`, `peso_obj_ef === sugerido_central`: el informe enseña **una sola** cifra de peso objetivo, no un "sugerido" y un "efectivo" distintos.
- En la rama `ganar`, si `PC / h² ≤ 27.5` entonces `sugerido_rango[1] / h² ≤ 27.5` y `sugerido_central / h² ≤ 27.5`: el techo de IMC 27,5 que la §3.1 declara como "peso objetivo máximo" se aplica al peso **sugerido** y a su franja, no solo a `peso_obj_ef`. Sin esto la pantalla y el PDF mostraban una franja por encima del máximo que la propia app acababa de imponer (hombre de 175 cm y 80 kg: sugerido 85,5 kg = IMC 27,9 frente a un efectivo de 84,0 kg) y dos "pesos objetivo" distintos en la misma página. Cuando el peso actual ya supera IMC 27,5 el techo no se aplica: bajar la franja por debajo del peso de partida en un plan de ganancia sería peor que no acotarla.
- El redondeo a 0,5 kg **nunca cruza un límite activo**: cuando el peso objetivo (o el extremo inferior de la franja) toca `min185` o el suelo por `g_min` se usa `roundUp05`, y cuando toca el techo de IMC 27,5 de la rama `ganar`, `roundDown05`. Con `round05` a secas un objetivo de 58,62 kg (IMC 18,5 en una mujer de 178 cm) se imprimía como 58,5 kg, es decir, medio kilo por debajo del suelo que la propia app acababa de imponer.
- `peso_obj_ef === null` o `peso_obj_ef / h² ≥ imc_min` — la rama `ganar` valida el objetivo por abajo igual que la rama `perder`, y ninguna de las dos acepta como meta un peso de bajo peso.
- `g_min` (suelo de %grasa de un peso objetivo) nunca es menor que el límite superior de la banda `muy_bajo`. Los 8 % / 16 % anteriores contradecían frontalmente al paso 6, que se niega a poner en déficit a quien ya está en esa banda: la app no dejaba adelgazar a una mujer con 21 % de grasa y a la vez le fijaba como meta un peso del 16 %.
- Las fórmulas clásicas (`clasicas`) solo se calculan entre 150 y 200 cm; fuera de ese intervalo son lineales sin dominio de validez y devuelven pesos de 24–35 kg. `clasicas === null` → el bloque "otros métodos" no se muestra.

### Paso 14 — Cronograma

```
si objetivo_efectivo ∈ {mantener, recomposicion} → cronograma = null; INFO_SIN_CRONOGRAMA; parar
si peso_obj_ef === null                          → cronograma = null; INFO_SIN_CRONOGRAMA; parar

perder: delta_kcal = TDEE − kcal; delta_kg = PC − peso_obj_ef
ganar:  delta_kcal = kcal − TDEE; delta_kg = peso_obj_ef − PC

// GUARDAS DURAS antes de dividir (ninguna división sin denominador comprobado)
si delta_kg < 0.5     → cronograma = null; INFO_SIN_CRONOGRAMA_SIN_MARGEN; parar
si delta_kcal < 50    → cronograma = null; INFO_CRONOGRAMA_NO_ESTIMABLE;  parar

ritmo_kg_sem  = delta_kcal · 7 / 7700                            // ≥ 0,045 kg/sem por la guarda anterior
si ritmo_kg_sem < 0.05 → cronograma = null; INFO_CRONOGRAMA_NO_ESTIMABLE; parar
ritmo_pct_sem = ritmo_kg_sem / PC · 100
sem_lineal    = delta_kg / ritmo_kg_sem

factor_adapt  = 1 + 0.25 · min(sem_lineal / 26, 2)               // ×1,25 a 6 meses · ×1,75 al año o más
sem_min       = ceil(sem_lineal)
sem_max       = ceil(sem_lineal · factor_adapt)
diet_breaks   = (perder y sem_lineal > 10) ? floor(sem_lineal / 8) : 0   // 1 semana a mantenimiento por cada 8 (MATADOR)
semanas       = [sem_min + diet_breaks, sem_max + diet_breaks]

horizonte_max = (objetivo_efectivo === 'ganar') ? 20 : 104       // volumen: fases de 12–20 semanas
si semanas[0] > horizonte_max → cronograma = null; INFO_CRONOGRAMA_FUERA_DE_HORIZONTE; parar
si semanas[1] > horizonte_max → semanas = [semanas[0], horizonte_max]; WARN_CRONOGRAMA_LARGO

precision_fecha = (semanas[1] > 16) ? 'mes' : 'dia'
fecha_min     = fecha_inicio + 7 · semanas[0] días
fecha_max     = fecha_inicio + 7 · semanas[1] días
tramo_12sem   = (semanas[1] > 16)                                // pérdida/ganancia prevista a 12 semanas
              ? [round05(ritmo_kg_sem · 12 / factor_adapt), round05(ritmo_kg_sem · 12)] : null
si semanas[1] > 52 → WARN_CRONOGRAMA_LARGO
emitir INFO_ADAPTACION (siempre que hay cronograma)
```

**Por qué las guardas.** Los suelos de seguridad del paso 7 pueden dejar el déficit real en cero o negativo; sin guarda, `sem_lineal` salía negativo y el informe imprimía semanas negativas y fechas de 2015. La regla de margen del paso 7 (`WARN_SIN_MARGEN_DEFICIT`) corta ya la mayoría de esos casos convirtiendo el plan en `mantener`; estas guardas son la red redundante para el resto (déficits positivos pero ridículos: 3 kcal/día producían 2.956 semanas y fechas de 2104).

**Por qué el factor de adaptación crece.** La regla lineal de 7.700 kcal/kg sobreestima la pérdida a 12 meses aproximadamente en un factor 2 (Hall): a los 6 meses se cumple razonablemente y al año solo se alcanza cerca de la mitad de lo predicho. Un factor plano de ×1,25 no representa ese sesgo. Con `factor_adapt` el rango superior es ×1,25 a las 26 semanas y ×1,75 a partir de las 52.

**Presentación (normativa para pantalla y PDF).** Cuando `precision_fecha === 'mes'` no se imprimen fechas exactas, sino el mes y el año ("hacia junio de 2027"), y el bloque principal muestra el **primer tramo** (`tramo_12sem`: "en las próximas 12 semanas, entre X e Y kg") más el hito intermedio, no el horizonte completo. Un calendario exacto a 40 semanas es el mecanismo clásico de abandono cuando no se cumple.

### Paso 15 — FFMI

```
FFMI      = MLG / h²
ref_h     = hombre ? 1.80 : 1.70                      // referencia de altura por sexo
FFMI_norm = FFMI + 6.3 · (ref_h − h)
categoria = (banda ∈ {alto, muy_alto}) ? null : tabla 3.12[sexo][FFMI_norm]
```

Categorías informativas (tabla 3.12). Nunca es input de macros.

La normalización de Kouri (constante 6,3 sobre una referencia de 1,80 m) se derivó en varones. Aplicada tal cual a mujeres, cuya estatura media en España ronda 1,63 m, sumaba +1,0 a +1,9 puntos y etiquetaba como "muy desarrollado" o "excepcional" a mujeres con %grasa alto y masa magra ordinaria. Por eso la referencia es ahora 1,70 m en mujeres. Además, cuando `banda ∈ {alto, muy_alto}` la categoría **no se muestra** (`categoria = null`, se sigue mostrando el número): el FFMI con mucha grasa no informa de musculatura, exactamente por el mismo motivo por el que `INFO_IMC_MUSCULADO` tampoco se emite en esas bandas.

### Paso 16 — Reparto por comidas

```
p       = tabla 3.13[n_comidas]                        // % kcal por comida, suma 100
nombres = tabla 3.13[n_comidas].nombres               // Desayuno, Comida, ...
horas   = tabla 3.13[n_comidas].horas                 // hora nominal fija 'HH:MM' de cada comida
hcv     = copia de p                                  // % de HC por comida
i_peri  = (perfil !== 'sedentario' y momento !== null) ? tabla 3.14[n_comidas][momento] : null
si i_peri !== null:
   hcv[i_peri] += 5
   j = índice del mayor p[i] con i ≠ i_peri (empate → índice más bajo); hcv[j] −= 5
peri_i    = (i === i_peri)                            // boolean por comida; todo false si i_peri === null
principal = índice del mayor p[i] (empate → índice más bajo)
repartir(X, vec): parts[i] = round5(X · vec[i] / 100); parts[principal] += X − Σ parts
P_i  = repartir(P, p);  G_i = repartir(G, p);  HC_i = repartir(HC, hcv)
kcal_i = 4·P_i + 9·G_i + 4·HC_i
si existe i con p[i] ≥ 20 y P_i < 20  → WARN_PROTEINA_POR_TOMA
si existe i con P_i > 0.55 · PC       → WARN_PROTEINA_TOMA_ALTA
```

**Hora nominal (obligatoria).** Cada comida lleva una `hora` fija, independiente de las respuestas del usuario; sirve para ordenar la pantalla, el PDF y las plantillas de comidas, y no interviene en ningún cálculo:

| Comida | Hora nominal |
|---|---|
| Desayuno | 08:00 |
| Media mañana | 11:00 |
| Comida | 14:00 |
| Merienda | 17:30 |
| Cena | 21:00 |
| Recena | 23:00 |

Con `n_comidas = 2` las dos comidas son Comida (14:00) y Cena (21:00). Las horas son etiquetas de referencia: el copy debe decir que se pueden desplazar sin ningún efecto sobre el resultado.

**Campo `peri`.** Cada comida lleva además `peri: boolean`, `true` **solo** en el índice `i_peri` de la tabla 3.14 cuando aplica (perfil no sedentario y `momento !== null`), y `false` en todas las demás. Es el mismo índice que recibe los +5 puntos de hidratos, y es lo que permite a la interfaz marcar "comida alrededor del entrenamiento" sin recalcular nada.

El guardarraíl de proteína por toma mira ahora los dos lados. Por abajo (`WARN_PROTEINA_POR_TOMA`) porque una comida principal con menos de 20 g de proteína desaprovecha el estímulo; por arriba (`WARN_PROTEINA_TOMA_ALTA`, > 0,55 g/kg de peso corporal en una sola toma) porque con 2 comidas el reparto concentra fácilmente 70 g en una cena, más del doble del techo de utilización por toma que la propia §6 cita, y hasta ahora la spec no decía nada.

**Un solo reparto en la v1 (decisión normativa).** El motor devuelve **un único** array `comidas`. No hay reparto de día de entreno y reparto de día de descanso: la spec no define de dónde saldrían las kcal del día de descanso (¿TDEE sin `ejercicio_dia`? ¿los mismos totales con otro vector de HC?), y publicar números que no se pueden trazar a una fórmula de este documento contradice la primera línea de la spec. Por tanto `CONTRATO.md` y `repo/src/engine/types.ts` deben simplificarse: fuera `reparto_entreno`, `reparto_descanso` y `comidas_peri` (esta última queda cubierta por el campo `peri` de cada comida), y las referencias a §1.1, §2.16, §3.10 "hora nominal de la plantilla" y a los Anexos A/B deben apuntar a la tabla 3.13 de este documento, que es donde viven ahora las horas.

Este reparto alimenta al módulo de plantillas de comidas (fuera de esta especificación).

### Paso 17 — Avisos finales

```
IMC < 18.5 → WARN_IMC_BAJO;  35 ≤ IMC < 40 → WARN_IMC_35;  IMC ≥ 40 → WARN_IMC_40
edad ≥ 60 y 'renal' ∉ condiciones → INFO_MAYOR_60
edad ≥ 60 y 'renal' ∈ condiciones → INFO_MAYOR_60_RENAL
preferencia === 'vegano' → INFO_VEGANO
FFMI_norm ≥ (hombre ? 22 : 19) y IMC ≥ 25 y banda ∈ {muy_bajo, bajo, medio} → INFO_IMC_MUSCULADO
grasa_fiabilidad === 'baja' → INFO_GRASA_ESTIMADA
perfil !== 'sedentario' y dias · minutos_sesion / 60 > 10 → INFO_ALTO_RENDIMIENTO
kcal < (hombre ? 1800 : 1500) → INFO_MICRONUTRIENTES
```

**Reevaluación contra `objetivo_efectivo`** (los avisos del paso 6 se emitieron contra el objetivo
intermedio, que el paso 7 todavía podía reescribir):

```
si objetivo_efectivo !== 'perder' → eliminar WARN_PERDIDA_MAYOR_65
```

**Filtro de protección del cribado TCA** (se aplica al final, después de la tabla de supresión del paso 6):

```
si 'tca' ∈ condiciones → eliminar de `avisos`, si estuvieran:
   INFO_GRASA_ESTIMADA, INFO_PESO_YA_MINIMO, INFO_IMC_MUSCULADO, INFO_ADAPTACION,
   WARN_YA_MAGRO, WARN_YA_EN_OBJETIVO, WARN_OBJETIVO_MUY_LEJANO, WARN_CRONOGRAMA_LARGO,
   INFO_SIN_CRONOGRAMA, INFO_SIN_CRONOGRAMA_SIN_MARGEN,
   INFO_CRONOGRAMA_NO_ESTIMABLE, INFO_CRONOGRAMA_FUERA_DE_HORIZONTE
```

Con `cribado_tca ∈ {positivo, evitado}` el paso 0 añade `'tca'` a `condiciones` y la capa de UX oculta el
%grasa, el peso objetivo y el cronograma (SPEC-ux §2.1 y §2.6). Pero la §2.8 y la §4.6 obligan a listar
**todos** los avisos con su texto íntegro, y varios de ellos enuncian literalmente lo que se acaba de
ocultar ("tu porcentaje de grasa es una estimación con un error típico de ±5 puntos", "tu objetivo supone
perder más del 25 % de tu peso", "el calendario es una estimación"), además de referirse a bloques que no
existen en ese informe. La protección se implementa **en el motor** —no como excepción de maquetación—
para que sea comprobable: el invariante S10c falla si cualquiera de estos códigos aparece con `'tca'`.
El filtro no toca `INFO_RITMO_SUAVE`, `WARN_IMC_BAJO`, `INFO_FIBRA_AJUSTADA`, `INFO_AGUA_NO_PRESCRITA` ni
ningún `WARN_*` de condición médica: ninguno de ellos revela un dato oculto y todos siguen siendo
información de seguridad. Tampoco revela nada por ausencia, porque los códigos retirados dependen de
variables (fiabilidad del %grasa, existencia de cronograma) que en ese informe ya no se muestran.

`INFO_MAYOR_60` afirma al usuario que "hemos ajustado tu proteína al alza (mínimo 1,2 g/kg)". En un usuario renal el cap de 1,0 g/kg anula ese ajuste, así que el aviso se sustituye por `INFO_MAYOR_60_RENAL`, que reconoce el conflicto en vez de afirmar algo falso sobre su propio plan. Cuando `base_tipo === 'peso_ajustado'` el texto expresa el mínimo en **g/día** (`round5(1.2 · base)`), no en g/kg, porque en g/kg de peso real es sensiblemente menor.

El orden de los avisos en la salida no es significativo (los tests comparan como conjunto).

### Salida (`Resultado`)

```ts
export interface Resultado {
  excluido?: 'EXCL_EDAD' | 'EXCL_EMBARAZO_LACTANCIA' | 'EXCL_IMC_MUY_BAJO' | 'EXCL_TCA_RIESGO' | 'ERR_INPUT_RANGO';
  errores?: string[];        // solo con 'ERR_INPUT_RANGO': nombres de los campos fuera de rango
  imc: number; imc_categoria: string;
  grasa: { pct: number; rango: [number, number]; fiabilidad: Fiabilidad; metodo_efectivo: MetodoGrasa; banda: BandaGrasa;
           referencias: { cunbae: number; deurenberg: number; navy?: number } };
  mlg: number;
  bmr: { valor: number; ecuacion: 'mifflin' | 'katch_mcardle'; referencias: { mifflin: number; katch: number; harris: number } };
  tdee: { valor: number; bruto: number; pal: number; ejercicio_dia: number; perfil: Perfil };
  objetivo_efectivo: ObjetivoEfectivo; ritmo_efectivo: Ritmo;
  objetivo_propuesto?: ObjetivoEfectivo;   // objetivo que resolvió la regla 6.1 con objetivo === 'no_se'
  preferencia_efectiva: Preferencia;   // paso 6.8: diabetes + low_carb → 'omnivoro'
  kcal: number; kcal_cierre: number;
  macros: { proteina_g: number; grasa_g: number; hc_g: number; fibra_g: number; azucares_libres_max_g: number;
            pct: { p: number; g: number; hc: number }; gkg: { p: number; g: number; hc: number };
            base_proteina: 'peso_corporal' | 'peso_ajustado'; base_kg: number; somatotipo: Somatotipo;
            pct_cap: number };        // fracción de kcal del cap de proteína realmente aplicada (0,35 / 0,30)
  agua: null | { ml: number; rango: [number, number]; vasos: number };   // null con 'renal' o 'cardiaca'
  peso_objetivo: { efectivo: number | null; sugerido: number; mostrar_central: boolean;
                   rango: [number, number]; metodo: 'grasa' | 'ritmo_16_semanas' | 'actual';
                   hito_intermedio: number | null;
                   referencias: { imc22: number; rango_imc: [number, number]; clasicas: Record<string, number> | null } };
  cronograma: null | { ritmo_kg_sem: number; ritmo_pct_sem: number; delta_kg: number; semanas: [number, number];
                       diet_breaks: number; fecha_min: string; fecha_max: string;
                       precision_fecha: 'dia' | 'mes'; tramo_12sem: [number, number] | null };
  ffmi: { valor: number; normalizado: number; categoria: string | null };
  comidas: Array<{ nombre: string; hora: string; pct_kcal: number; proteina_g: number; grasa_g: number;
                   hc_g: number; kcal: number; peri: boolean }>;
  avisos: string[];
}
```

---

## 3. Tablas de decisión (todos los valores numéricos)

### 3.1 Constantes globales

| Constante | Valor |
|---|---|
| `FACTOR_CORRECCION` (TDEE) | 0,95 |
| kcal por kg de tejido graso | 7 700 |
| Factores de Atwater | P 4 · HC 4 · G 9 kcal/g (alcohol 7, no se prescribe) |
| Suelo kcal por sexo | hombre 1 500 · mujer 1 200 |
| Disponibilidad energética mínima | 30 kcal/kg MLG (25 kcal/kg si banda `muy_alto`; nunca se desactiva) |
| Techo déficit (% TDEE) | 25 % (30 % si banda `muy_alto`; 20 % a partir de 65 años) |
| Superávit absoluto | clamp 150–500 kcal |
| Proteína: techo | min(2,5 g/kg PC, 35 % kcal — 30 % en dietas vegetales con < 1 800 kcal); g/kg máx 2,4 (2,0 con peso ajustado), aplicado **después** de los multiplicadores de preferencia |
| Proteína: línea roja | 0,8 g/kg PC (no se aplica con condición `renal`). Cierra por abajo tanto `P` (paso 8) como `P_min`, el suelo del bucle del paso 10 |
| Proteína: cap renal | 1,0 g/kg de **peso corporal**, último filtro de todos |
| Grasa: suelo | max(0,7 g/kg H · 0,8 g/kg M sobre `base`, 20 % kcal) |
| Grasa: techo | 40 % kcal (50 % low-carb) |
| HC mínimo | 130 g (RDA IOM); 75 g solo en `low_carb` declarado |
| Somatotipo: desplazamiento | 10 % de las kcal no proteicas |
| Fibra | clamp(14 g/1000 kcal, suelo, 40); suelo = min(25, 0,15 · HC) — en low-carb max(20, 10 g/1000 kcal) |
| Agua | k 30/33/35 ml/kg; suelo bebido 1 500 M · 2 000 H; techo base 3 100 M · 4 000 H; 500 ml/h (tope 1 000); calor +400; clamp suelo–4 000; múltiplo de 50; **null** con `renal` o `cardiaca` |
| %grasa objetivo | hombre 15 (12–17) · mujer 23 (20–25); a partir de 65 años hombre 18 (15–20) · mujer 26 (23–28) |
| %grasa mínimo saludable para un peso objetivo | hombre 12 · mujer 20 (= límite superior de la banda `muy_bajo`) |
| Peso objetivo mínimo | IMC 18,5 (IMC 22 a partir de 65 años) |
| Peso objetivo máximo (`ganar`) | IMC 27,5 |
| Hito intermedio | −10 % del peso si la pérdida prevista > 15 % |
| Cronograma | sem_max = × (1 + 0,25 · min(sem_lineal/26, 2)); diet break 1 semana por cada 8 si > 10 semanas; horizonte máximo 104 semanas (20 en `ganar`) |
| Ensanche del rango de peso sugerido | `MLG · (±/100) / (1 − g_c/100)` con ± = 2 / 4 / 5 puntos de %grasa según fiabilidad |

### 3.2 Somatotipo — clasificación

Puntuaciones: `q1` fina −1 / media 0 / ancha +1; `q2` poca −1 / moderada 0 / mucha +1; `q4` delgado −1 / atletico 0 / robusto +1.

```
S = q1 + q2 + q4                            // −3 … +3
si q3 === 'mucha' y S ≠ 0 → S = S − signo(S)   // facilidad para ganar músculo acerca a mesomorfo
si q3 === 'poca'  y S < 0 → S = max(S − 1, −3) // poca facilidad refuerza ectomorfo
S ≤ −2 → 'ectomorfo';  S ≥ 2 → 'endomorfo';  otro → 'mesomorfo'
somatotipo === null → 'mesomorfo' (sin ajuste)
```

Efecto único: ectomorfo → +10 % kcal no proteicas a HC (desde grasa); endomorfo → +10 % a grasa (desde HC); mesomorfo → nada. Nunca rompe suelo ni techo de grasa. No se aplica con `low_carb`.

### 3.3 Estimación visual (categorías ACE, punto medio usado)

| Hombre | Rango ACE | Valor usado | Descripción (copy) |
|---|---|---|---|
| `muy_definido` | 6–13 | 10,0 | Abdominales muy marcados, venas visibles en brazos/abdomen |
| `definido` | 14–17 | 15,5 | Abdominales visibles pero poco marcados, silueta atlética |
| `medio` | 18–24 | 21,0 | Abdomen liso sin marcar, silueta normal |
| `sobrepeso_visible` | 25–31 | 28,0 | Acumulación abdominal visible, cintura por encima de la cadera |
| `obesidad_visible` | ≥ 32 | 36,0 | Acumulación de grasa evidente en abdomen, pecho y cara |

| Mujer | Rango ACE | Valor usado | Descripción (copy) |
|---|---|---|---|
| `muy_definida` | 14–20 | 17,0 | Definición muscular visible; no es un objetivo por defecto en población general |
| `tonificada` | 21–24 | 22,5 | Silueta tonificada con algo de definición |
| `media` | 25–31 | 28,0 | Curvas normales sin marcación muscular |
| `sobrepeso_visible` | 32–38 | 35,0 | Acumulación de grasa visible en cadera, muslos y abdomen |
| `obesidad_visible` | ≥ 39 | 43,0 | Acumulación evidente y generalizada |

Nota (Gallagher 2000): a igual IMC, el %grasa "saludable" sube con la edad; a partir de 40–50 años no alarmar por 2–3 puntos.

### 3.4 PAL base (solo vida diaria, sin ejercicio)

| `actividad_diaria` | Ancla operativa (copy del cuestionario) | PAL |
|---|---|---|
| `sedentario` | Trabajo sentado, me muevo poco (< 5 000 pasos/día) | 1,40 |
| `ligero` | De pie parte del día o camino algo (5 000–7 500 pasos) | 1,50 |
| `moderado` | Trabajo activo o camino bastante (7 500–10 000 pasos) | 1,60 |
| `alto` | Trabajo físico o camino mucho (10 000–12 500 pasos) | 1,75 |
| `muy_alto` | Trabajo físico intenso: obra, reparto, agricultura (> 12 500 pasos) | 1,90 |

### 3.5 MET por tipo e intensidad (se usa MET − 1)

| `tipo` | `baja` | `media` | `alta` | Ancla (copy) |
|---|---|---|---|---|
| `fuerza` | 3,5 | 5,0 | 6,0 | baja: máquinas, descansos largos · media: pesos libres, series al fallo cercano · alta: circuitos / descansos cortos |
| `cardio` | 4,5 | 7,0 | 9,5 | baja: andar rápido, bici suave · media: trote, bici moderada, natación · alta: correr rápido, HIIT, spinning |
| `mixto` | 4,0 | 6,0 | 8,0 | mezcla de fuerza y cardio en la misma sesión (crossfit, clases dirigidas) |
| `ninguno` | 0 | 0 | 0 | — |

kcal/sesión = (MET − 1) · PC · min/60. Ejemplo: 80 kg, fuerza media, 60 min → (5 − 1) · 80 · 1 = 320 kcal.

### 3.6 Perfil de entrenamiento

| Condición | `perfil` |
|---|---|
| `tipo = 'ninguno'` o `dias_semana = 0` | `sedentario` |
| `tipo = 'cardio'` | `cardio` |
| `tipo ∈ {'fuerza', 'mixto'}` | `fuerza` |

### 3.7 Ritmo de pérdida (% del peso corporal por semana)

| `ritmo` | banda `muy_alto` (H ≥ 25 / M ≥ 32) | banda `alto` (H 20–24,9 / M 28–31,9) | banda `medio` (H 15–19,9 / M 23–27,9) |
|---|---|---|---|
| `suave` | 0,50 | 0,40 | 0,30 |
| `moderado` | 0,75 | 0,60 | 0,40 |
| `agresivo` | 1,00 | 0,80 | 0,50 |

Bandas `bajo` y `muy_bajo` nunca llegan a esta tabla (`perder` se convierte en `recomposicion`, paso 6). Déficit kcal/día = ritmo% · PC · 11 (= 7700/7/100). Después se aplica el techo del 25/30 % de TDEE y los suelos.

### 3.8 Superávit (% del TDEE) por experiencia y ritmo

| `experiencia` | `suave` | `moderado` | `agresivo` |
|---|---|---|---|
| `novato` | 10 % | 15 % | 20 % |
| `intermedio` | 5 % | 10 % | 12,5 % |
| `avanzado` | 5 % | 7,5 % | 10 % |

Perfil ≠ `fuerza` → 5 % fijo. Siempre clamp 150–500 kcal.

### 3.9 Recomposición (déficit leve sobre TDEE) por banda de grasa

| banda | `muy_alto` | `alto` | `medio` | `bajo` | `muy_bajo` |
|---|---|---|---|---|---|
| déficit | 10 % | 10 % | 7,5 % | 5 % | 0 % |

### 3.10 Proteína (g/kg de `base`)

| `perfil` | `perder` | `recomposicion` | `mantener` | `ganar` |
|---|---|---|---|---|
| `sedentario` (y fila de obesidad si IMC ≥ 30) | 1,5 | 1,5 | 1,2 | 1,4 |
| `cardio` | 1,8 | 1,8 | 1,6 | 1,6 |
| `fuerza` (incluye `mixto`) | 2,2 | 2,0 | 1,7 | 1,8 |

Modificadores, **en el orden exacto del paso 8**: IMC ≥ 30 y perfil ≠ sedentario +0,2 · edad ≥ 60 +0,2 · perder agresivo +0,2 · `perder`/`recomposicion` con banda `muy_bajo` o `bajo` +0,2 · suelo ≥ 60 años 1,2 (1,6 si fuerza) · vegano ×1,15 · vegetariano ×1,10 · **techo 2,4 (2,0 si peso ajustado), siempre el último** · después, sobre gramos: `P_cap`, línea roja RDA y, si hay condición `renal`, el cap de 1,0 g/kg de peso corporal como filtro final.

El modificador de banda baja cubre `perder` y `recomposicion` porque el paso 6 convierte todo `perder` con banda `muy_bajo`/`bajo` en `recomposicion`: escrito solo para `perder` era código muerto, y la evidencia (Helms 2014, Longland 2016) respalda más proteína cuanto más magra es la persona y mayor el déficit.

Equivalencias (informe): g/kg MLG = g/kg PC / (1 − grasa/100).

### 3.11 Grasa (% kcal objetivo)

| Situación | % kcal |
|---|---|
| `perder` suave/moderado, `recomposicion` | 28 % |
| `perder` agresivo | 25 % |
| `ganar` | 27 % |
| `mantener` | 32 % |
| `low_carb` (cualquier objetivo) | 45 % (techo 50 %) |

### 3.12 FFMI normalizado — categorías informativas

| Hombre | Mujer | `categoria` |
|---|---|---|
| < 18 | < 15 | `bajo` |
| 18 – 19,9 | 15 – 16,9 | `medio` |
| 20 – 21,9 | 17 – 18,9 | `bueno` |
| 22 – 24,9 | 19 – 21,9 | `muy_desarrollado` |
| ≥ 25 | ≥ 22 | `excepcional` (≈ techo natural observado, Kouri 1995; heurística, no ley) |

Bordes con desigualdades explícitas (`f = FFMI_norm`, hombres): `bajo: f < 18`, `medio: 18 ≤ f < 20`, `bueno: 20 ≤ f < 22`, `muy_desarrollado: 22 ≤ f < 25`, `excepcional: f ≥ 25`; mujeres con los cortes 15 / 17 / 19 / 22. La normalización usa 1,80 m en hombres y 1,70 m en mujeres (paso 15), y la categoría es `null` cuando `banda ∈ {alto, muy_alto}`.

### 3.13 Reparto de kcal por número de comidas (%)

| n | Comidas (en orden) | % kcal | Horas nominales |
|---|---|---|---|
| 2 | Comida, Cena | 45 / 55 | 14:00 / 21:00 |
| 3 | Desayuno, Comida, Cena | 30 / 35 / 35 | 08:00 / 14:00 / 21:00 |
| 4 | Desayuno, Comida, Merienda, Cena | 25 / 30 / 15 / 30 | 08:00 / 14:00 / 17:30 / 21:00 |
| 5 | Desayuno, Media mañana, Comida, Merienda, Cena | 20 / 10 / 30 / 10 / 30 | 08:00 / 11:00 / 14:00 / 17:30 / 21:00 |
| 6 | Desayuno, Media mañana, Comida, Merienda, Cena, Recena | 15 / 10 / 25 / 10 / 25 / 15 | 08:00 / 11:00 / 14:00 / 17:30 / 21:00 / 23:00 |

Proteína y grasa siguen exactamente estos %; los HC usan el vector modificado (+5 en la comida peri-entreno, −5 en la mayor de las restantes).

Las horas nominales son fijas por nombre de comida (Desayuno 08:00 · Media mañana 11:00 · Comida 14:00 · Merienda 17:30 · Cena 21:00 · Recena 23:00), no dependen de ninguna respuesta del usuario y no entran en ningún cálculo: solo ordenan la salida `comidas` y las plantillas de comidas.

### 3.14 Comida peri-entreno (índice, 0 = primera comida) según `momento`

| n | `manana` | `mediodia` | `tarde` | `noche` |
|---|---|---|---|---|
| 2 | 0 | 0 | 1 | 1 |
| 3 | 0 | 1 | 2 | 2 |
| 4 | 0 | 1 | 2 (Merienda) | 3 |
| 5 | 0 | 2 (Comida) | 3 (Merienda) | 4 |
| 6 | 0 | 2 (Comida) | 3 (Merienda) | 5 (Recena) |

### 3.15 Fórmulas de peso ideal clásicas (solo "otras referencias")

Devine, Robinson, Miller, Hamwi (paso 13). Fórmulas clínicas de los años 60–80 pensadas para dosificar fármacos; ignoran la composición corporal. Se muestran como "otros métodos dan X–Y kg", nunca como objetivo.

---

## 4. Mensajes y avisos

`severidad`: `bloqueo` (no se calcula), `aviso` (visible, destacado), `info` (nota).

| Código | Sev. | Condición exacta | Texto (español de España) |
|---|---|---|---|
| `EXCL_EDAD` | bloqueo | `edad < 18 \|\| edad > 75` | Báscula está pensada para personas adultas de 18 a 75 años. Fuera de ese rango las necesidades cambian mucho: consulta con tu médico o con un/a dietista-nutricionista. |
| `EXCL_EMBARAZO_LACTANCIA` | bloqueo | `embarazo_lactancia === true` | Durante el embarazo y la lactancia las necesidades nutricionales cambian por completo y no deben calcularse con una calculadora genérica. Consulta con tu matrona, tu médico o un/a dietista-nutricionista. |
| `EXCL_IMC_MUY_BAJO` | bloqueo | `IMC < 16` (paso 0) | Con tu peso y tu altura, tu IMC está en un rango de delgadez severa. No vamos a darte calorías ni macros: lo que necesitas ahora es una valoración médica, no una calculadora. Habla con tu médico de cabecera; si te apetece hablarlo con alguien antes, ADANER atiende gratis (adaner.org). |
| `EXCL_TCA_RIESGO` | bloqueo | `'tca' ∈ condiciones` y `IMC < 18.5` (paso 0) | Por lo que nos has contado, esta herramienta no es la adecuada para ti ahora mismo. Una calculadora de calorías y de peso objetivo puede empeorar las cosas cuando la relación con la comida está siendo difícil. Puedes contactar gratis con ADANER (adaner.org) o pedir cita en tu centro de salud. |
| `ERR_INPUT_RANGO` | bloqueo | Cualquier input fuera del rango de la sección 1, incluida la validación cruzada `IMC < 12` o `IMC > 60` | Revisa el dato marcado: está fuera del rango que podemos calcular con seguridad. |
| `WARN_MEDIDAS_INVALIDAS` | aviso | Navy: `x < 15` (H) / `x < 60` (M) o resultado < 3 o > 60 | Las medidas de cuello, cintura y cadera no cuadran entre sí. Hemos estimado tu grasa corporal a partir de tu altura, peso y edad; revisa las medidas si quieres más precisión. |
| `WARN_GRASA_DISCREPANCIA` | aviso | `\|grasa_navy − CUNBAE\| > 10` | Tu estimación por medidas difiere bastante de la que dan tu altura y peso. Tómala como orientativa y, si puedes, contrástala con una bioimpedancia profesional. |
| `WARN_GRASA_FUERA_DE_RANGO` | aviso | El clamp del paso 2 altera el `grasa.valor` introducido | El porcentaje de grasa que has introducido está fuera del rango con el que podemos calcular con seguridad, así que hemos usado {valor} %. Todos los números de tu informe parten de ese dato ajustado, no del que escribiste. |
| `WARN_OBJETIVO_INCOHERENTE` | aviso | `perder` con `pobj > PC` o `ganar` con `pobj < PC` (paso 6.2) | Tu peso objetivo va en dirección contraria al objetivo que has elegido. Hemos calculado el plan según el peso objetivo; cámbialo si no era lo que querías. |
| `WARN_IMC_BAJO_NO_DEFICIT` | aviso | `perder` con `IMC < 18.5` | Tu IMC indica bajo peso, así que no te proponemos un déficit calórico. Te mostramos un plan de mantenimiento; si aun así quieres perder peso, habla antes con un profesional sanitario. |
| `WARN_YA_MAGRO` | aviso | `perder` con `banda ∈ {muy_bajo, bajo}` | Tu porcentaje de grasa ya está en un rango bajo y saludable. En vez de una dieta, te proponemos una recomposición: déficit muy ligero, proteína alta y entrenamiento de fuerza. Los cambios serán lentos y sutiles, y eso es lo esperable. |
| `WARN_RECOMPOSICION_SUGERIDA` | aviso | `ganar` con (`novato` o perfil ≠ fuerza) y `banda ∈ {alto, muy_alto}` | Con tu porcentaje de grasa actual y poca experiencia en fuerza, ganarás músculo igual de bien sin comer de más. Te proponemos recomposición: calorías cerca del mantenimiento, proteína alta y entrenamiento de fuerza. |
| `WARN_GANAR_SIN_FUERZA` | aviso | `ganar` con perfil ≠ fuerza | Sin entrenamiento de fuerza, comer de más solo aumenta la grasa. Hemos dejado un superávit mínimo; para ganar músculo necesitas entrenar fuerza al menos 2–3 días por semana. |
| `WARN_RECOMPOSICION_SIN_FUERZA` | aviso | `recomposicion` con perfil ≠ fuerza | Sin entrenamiento de fuerza la recomposición no ocurre: esto es, en la práctica, un mantenimiento con la proteína alta. Empieza por 2–3 días de fuerza a la semana y vuelve a calcular; es la parte del plan que más cambia el resultado. |
| `WARN_YA_EN_OBJETIVO` | aviso | `perder` sin peso objetivo y `MLG/(1 − g_c/100) ≥ PC − 0,5` | Tu peso ya está prácticamente en la franja que te corresponde por composición corporal, así que no tiene sentido ponerte a dieta. Te proponemos recomposición: calorías cerca del mantenimiento, proteína alta y fuerza. |
| `WARN_PERDIDA_MAYOR_65` | aviso | `edad ≥ 65` y `objetivo_efectivo === 'perder'` | A partir de los 65 años perder peso sin supervisión aumenta el riesgo de perder músculo y hueso. Hemos limitado el déficit máximo{ y suavizado el ritmo}. Combina siempre el plan con entrenamiento de fuerza y coméntalo con tu médico. |
| `WARN_LOWCARB_DIABETES` | aviso | `'diabetes' ∈ condiciones` y `preferencia === 'low_carb'` | No aplicamos la opción baja en hidratos porque tienes diabetes: reducir los hidratos de golpe puede provocarte una hipoglucemia si tomas insulina o pastillas que la bajan, y con algunos fármacos (los iSGLT2, como la empagliflozina o la dapagliflozina) puede causar cetoacidosis. Habla con tu equipo médico antes de bajar los hidratos. |
| `INFO_RITMO_SUAVE` | info | `'tca' ∈ condiciones` (sustituye a `WARN_TCA`) | Hemos elegido el planteamiento más sostenible en el tiempo: el que mejor se mantiene mes a mes y el que menos masa muscular cuesta. |
| `WARN_SUELO_CALORICO_SEXO` | aviso | `kcal_calc < suelo` y el suelo activo es 1 200/1 500 | El ritmo que pedías exigiría comer por debajo de un mínimo seguro. Hemos subido las calorías al mínimo{ y alargado el calendario}. |
| `WARN_SUELO_CALORICO_BMR` | aviso | `kcal_calc < suelo` y el suelo activo es el BMR | El ritmo que pedías exigiría comer por debajo de tu metabolismo basal. Hemos fijado las calorías en tu basal{ y alargado el calendario en consecuencia}. |
| `WARN_SUELO_CALORICO_EA` | aviso | `kcal_calc < suelo` y el suelo activo es el de disponibilidad energética (30 kcal/kg MLG; 25 en banda `muy_alto`) | Con ese ritmo tu disponibilidad energética caería por debajo de {30/25} kcal por kilo de masa magra, un nivel asociado a alteraciones hormonales. Hemos subido las calorías hasta ese mínimo{ y alargado el calendario}. |
| `WARN_DEFICIT_MINIMO` | aviso | `perder` y `50 ≤ TDEE − kcal < 100` | Tu gasto estimado es tan cercano al mínimo seguro que el déficit resultante es muy pequeño. Aumentar tu actividad diaria (pasos) es la palanca más eficaz en tu caso. |
| `WARN_SIN_MARGEN_DEFICIT` | aviso | `perder`/`recomposicion` y `kcal ≥ TDEE − 50` tras los suelos (paso 7) | Tu gasto estimado ya está en el mínimo con el que podemos trabajar con seguridad, así que no podemos proponerte un déficit: te damos un plan de mantenimiento. La palanca aquí no es comer menos, es moverte más (pasos y fuerza) y volver a calcular en unas semanas. |
| `WARN_GASTO_BAJO_MINIMO` | aviso | `mantener`/`ganar` y `kcal_calc < suelo_sexo` | Tu gasto estimado queda por debajo del mínimo de referencia (1.500 kcal en hombres, 1.200 en mujeres). Hemos subido las calorías a ese mínimo, pero un plan en esta franja conviene valorarlo con un profesional. |
| `WARN_KCAL_INSUFICIENTES_PARA_MACROS` | aviso | `roundUp5(suelo_g) > techo_g` en el paso 9 (incluye el cruce `suelo_g > techo_g`) | Con esas calorías no caben a la vez una grasa mínima y el resto de macros. Hemos subido ligeramente las calorías en lugar de forzar la grasa por encima de su techo. |
| `WARN_DEFICIT_INFACTIBLE` | aviso | Bucle del paso 10 sube kcal | Con esas calorías no caben una proteína y una grasa mínimas más 130 g de hidratos. Hemos subido ligeramente las calorías: el déficit pedido era demasiado agresivo. |
| `WARN_OBJETIVO_IMC_BAJO` | aviso | `pobj / h² < imc_min` (18,5; 22 a partir de 65 años) | Ese peso objetivo supondría un IMC por debajo del mínimo saludable para tu altura y tu edad, así que lo hemos subido. |
| `WARN_OBJETIVO_GRASA_MUY_BAJA` | aviso | `grasa_implicita < 12` (H) / `< 20` (M) | Para llegar a ese peso tendrías que bajar a un porcentaje de grasa que nosotros mismos consideramos demasiado bajo (por debajo del 12 % en hombres o del 20 % en mujeres). No vamos a fijarte un peso ahí abajo: te mostramos la franja saludable para tu composición corporal, y recuerda que tu porcentaje de grasa actual es una estimación. |
| `WARN_OBJETIVO_SIGUE_BAJO_PESO` | aviso | `ganar` y `pobj / h² < imc_min` | Ese peso objetivo sigue estando en bajo peso para tu altura. Hemos subido la meta al peso mínimo saludable; si vienes de una pérdida importante, conviene revisarlo con un profesional sanitario. |
| `INFO_PESO_YA_MINIMO` | info | `min185 > rangoA[1] + w` (paso 13) | Tu peso mínimo saludable por altura ya está por encima de la franja que te correspondería por porcentaje de grasa. {En tu caso el objetivo no es un peso: es recomposición (ganar algo de músculo manteniendo el peso). / Por eso hemos fijado tu meta en ese mínimo y no más abajo.} |
| `WARN_OBJETIVO_MUY_LEJANO` | aviso | `(PC − peso_obj_ef) / PC > 0.25` | Tu objetivo supone perder más del 25 % de tu peso. Es alcanzable, pero conviene hacerlo por etapas: te marcamos un primer hito del 10 % y te recomendamos acompañamiento profesional. |
| `WARN_OBJETIVO_IMC_ALTO` | aviso | `ganar` y `peso_obj_ef / h² > 27.5` (lo diera el usuario o lo proponga la app) | Ese peso objetivo supondría un IMC por encima de 27,5. Si no eres una persona muy musculada, buena parte de esa ganancia será grasa: hemos ajustado la meta a ese límite. Cuando llegues, recalcula. |
| `WARN_GANANCIA_LEJANA` | aviso | `ganar` y `(pobj − PC) / PC > 0.10` | Ganar más del 10 % de tu peso lleva bastante más de un ciclo de volumen. Te mostramos solo las primeras 20 semanas: al final de esa fase, recalcula con tu peso real. |
| `WARN_CRONOGRAMA_LARGO` | aviso | `semanas[1] > 52` o el horizonte se ha recortado | El calendario estimado es largo: te mostramos solo el primer tramo. Fija hitos intermedios y revisa el plan cada 4–8 semanas con tus datos reales; más allá de dos años una proyección de este tipo no tiene ningún valor predictivo. |
| `WARN_PROTEINA_POR_TOMA` | aviso | Alguna comida con `p_i ≥ 20 %` recibe `< 20 g` de proteína | Alguna de tus comidas principales se queda por debajo de 20 g de proteína. Puedes juntar dos tomas o aceptar que alguna sea un tentempié ligero; el total diario es lo que más cuenta. |
| `WARN_PROTEINA_TOMA_ALTA` | aviso | Alguna comida con `P_i > 0,55 g/kg` de peso corporal | Con este número de comidas concentras mucha proteína en una sola toma. El total diario sigue siendo lo que más cuenta, pero repartirla en 3 tomas se aprovecha algo mejor. |
| `WARN_IMC_BAJO` | aviso | `IMC < 18.5` | Tu IMC indica bajo peso. Si no es algo buscado, conviene descartar causas médicas con tu médico de cabecera. |
| `WARN_IMC_35` | aviso | `35 ≤ IMC < 40` | Con tu IMC actual, un abordaje supervisado por médico o dietista-nutricionista te dará mejores resultados y más seguridad. Aquí tienes una orientación general para empezar. |
| `WARN_IMC_40` | aviso | `IMC ≥ 40` | Con un IMC de este nivel, el plan nutricional debería ir acompañado de supervisión médica. Te mostramos una orientación general, pero busca apoyo profesional antes de aplicarla. |
| `WARN_DIABETES` | aviso | `'diabetes' ∈ condiciones` | Si tienes diabetes, cambiar la cantidad de hidratos puede obligar a ajustar tu medicación. Habla con tu equipo médico antes de aplicar estos macros y mídete la glucemia con más frecuencia las dos primeras semanas. |
| `WARN_RENAL` | aviso | `'renal' ∈ condiciones` | No podemos fijarte la proteína: en enfermedad renal el rango va de 0,55 a 1,2 g por kilo según el estadio y según si estás en diálisis, y eso solo puede decidirlo tu nefrólogo/a. Como tope de prudencia hemos limitado la proteína a 1,0 g por kilo de tu peso corporal ({P} g al día), pero trátalo como pendiente de confirmar con tu especialista, no como tu objetivo. |
| `WARN_HEPATICA` | aviso | `'hepatica' ∈ condiciones` | Con una enfermedad hepática los requerimientos de proteína pueden ser distintos a los estándar. Consulta con tu especialista antes de aplicar este plan. |
| `WARN_CARDIACA` | aviso | `'cardiaca' ∈ condiciones` | Con insuficiencia cardiaca, la cantidad de líquido y de sal que te conviene la fija tu cardiólogo/a, y suele ser bastante menor que la general: por eso no te damos objetivo de agua. Estos macros son una orientación; llévalos a tu revisión antes de aplicarlos y pésate a diario como te hayan indicado. |
| `WARN_HIPERTENSION` | aviso | `'hipertension' ∈ condiciones` | Con hipertensión o enfermedad cardiovascular, la sal importa tanto como las calorías: la OMS recomienda menos de 5 g de sal al día (unos 2 g de sodio). Vigila embutidos, conservas, quesos curados, pan y precocinados, y coméntalo con tu médico. |
| `WARN_TIROIDES` | aviso | `'tiroides' ∈ condiciones` | Con patología tiroidea el gasto energético puede desviarse bastante de lo que estima cualquier fórmula, sobre todo si el tratamiento no está ajustado. Toma estos números como punto de partida y revísalos con tu endocrino. |
| `WARN_BARIATRICA_GLP1` | aviso | `'bariatrica' ∈ condiciones` o `'glp1' ∈ condiciones` | Tras una cirugía bariátrica o con un fármaco tipo GLP-1 (semaglutida, tirzepatida) la pérdida es rápida y el riesgo real es perder músculo y quedarte corto/a de proteína. Hemos subido tu proteína a un mínimo de 1,5 g por kilo, pero este es un caso que debe seguir tu equipo médico o un/a dietista-nutricionista. |
| `WARN_CONDICION_OTRA` | aviso | `'otra' ∈ condiciones` | Nos has dicho que tienes otra condición o que tomas medicación. No podemos tenerla en cuenta: consulta este plan con tu médico o dietista-nutricionista antes de aplicarlo. |
| `WARN_AGUA_ALTA` | aviso | `agua_ml ≥ 3500` | Tu objetivo de líquido es alto. Si entrenas más de una hora, sudas mucho o hace calor, el agua sola no basta: añade sal a las comidas o una bebida con electrolitos. Beber mucha agua sin sodio baja el sodio en sangre y eso sí es peligroso. |
| `INFO_AGUA_NO_PRESCRITA` | info | `'renal' ∈ condiciones` o `'cardiaca' ∈ condiciones` | No te damos un objetivo de agua: con tu condición la cantidad de líquido debe fijarla tu equipo médico, y puede ser bastante menor que la general. |
| `INFO_BMR_ATLETA` | info | perfil `fuerza` y `dias_semana ≥ 4` | Con tu volumen de entrenamiento, la ecuación estándar puede quedarse corta. Si en 3–4 semanas pierdes peso más rápido de lo previsto, sube 100–150 kcal. |
| `INFO_OBJETIVO_RESUELTO` | info | `objetivo === 'no_se'` | Nos has dicho que no tienes claro tu objetivo. Según tu composición corporal y tu entrenamiento te proponemos: {perder grasa / ganar músculo / recomposición / mantener tu peso}. Puedes cambiarlo cuando quieras. |
| `INFO_OBJETIVO_RESUELTO_POR_PESO` | info | `objetivo === 'no_se'` y `pobj !== null` y `\|pobj − PC\| ≥ 1` | No tenías claro tu objetivo, así que hemos usado el peso al que quieres llegar para decidirlo: te proponemos {perder grasa / ganar músculo}. Puedes cambiarlo cuando quieras. |
| `INFO_OBJETIVO_IGUAL` | info | `\|pobj − PC\| < 1` | Tu peso objetivo es prácticamente tu peso actual, así que te mostramos un plan de mantenimiento. |
| `INFO_OBJETIVO_IGNORADO` | info | `mantener`/`recomposicion` con `\|pobj − PC\| ≥ 1` | Con el objetivo elegido el peso objetivo no se usa para calcular calorías; lo mostramos solo como referencia. |
| `INFO_DEFICIT_CAPADO_TDEE` | info | `deficit_ritmo > deficit_cap` | Hemos limitado el déficit al {20/25/30} % de tu gasto para proteger tu masa muscular; el ritmo real será algo menor del que pedías. |
| `INFO_PROTEINA_CAPADA` | info | `P < P_raw` y `'renal' ∉ condiciones` | Hemos limitado la proteína para que no supere 2,5 g/kg ni el {35/30} % de tus calorías: por encima no hay beneficio demostrado. |
| `INFO_SOMATOTIPO` | info | Se aplica desplazamiento ecto/endo | El somatotipo es una forma antigua de describir la silueta corporal, pero la ciencia actual no ha demostrado que sirva para calcular calorías o macros de forma precisa. Lo usamos solo como un ajuste ligero de tu preferencia entre carbohidratos y grasas, nunca para decidir cuántas calorías necesitas. |
| `INFO_ADAPTACION` | info | Existe cronograma | El calendario es una estimación: al cambiar el peso, el gasto también cambia y la regla "7 700 kcal = 1 kg" pierde precisión. A partir del tercer o cuarto mes el ritmo real suele ser aproximadamente la mitad del previsto. Por eso te damos un rango y te recomendamos recalcular cada 2–4 semanas con tu peso real. |
| `INFO_SIN_CRONOGRAMA` | info | `mantener` o `recomposicion`, o `peso_obj_ef === null` | Con este objetivo no hay un peso al que llegar en una fecha. Reevalúa medidas, fotos y rendimiento cada 8–12 semanas. |
| `INFO_SIN_CRONOGRAMA_SIN_MARGEN` | info | `delta_kg < 0,5` (paso 14) | Tu peso ya está donde queríamos llegar, así que no hay calendario. A partir de aquí lo que cambia el cuerpo no es el peso: es el entrenamiento de fuerza y la proteína. |
| `INFO_CRONOGRAMA_NO_ESTIMABLE` | info | `delta_kcal < 50` o `ritmo_kg_sem < 0,05` (paso 14) | Con tus datos, el mínimo seguro está prácticamente en tu gasto estimado: el ritmo saldría de unos pocos gramos por semana y darte una fecha sería inventar. La palanca en tu caso es subir la actividad diaria, no bajar las calorías. |
| `INFO_CRONOGRAMA_FUERA_DE_HORIZONTE` | info | `semanas[0] > horizonte_max` (paso 14) | Tu objetivo queda demasiado lejos para darte un calendario con sentido: una proyección a más de dos años no predice nada. Trabaja por etapas y recalcula al final de cada una. |
| `INFO_FIBRA_AJUSTADA` | info | `fibra < 25` | Con estas calorías (y estos hidratos) es normal quedarse algo por debajo de los 25 g de fibra de referencia. Prioriza verdura, fruta y legumbre antes que un suplemento de fibra. |
| `INFO_MICRONUTRIENTES` | info | `kcal < 1500` (mujer) / `< 1800` (hombre) | Con estas calorías cuesta cubrir hierro, calcio, vitamina D y yodo solo con comida. Prioriza alimentos densos en nutrientes y valora con tu médico un análisis o un suplemento; no es un plan para mantener muchos meses. |
| `INFO_AGUA_MAYORES` | info | `edad ≥ 65` | A partir de los 65 años la sensación de sed se reduce: reparte el agua en tomas regulares a lo largo del día en vez de esperar a tener sed. |
| `INFO_MAYOR_60` | info | `edad ≥ 60` y `'renal' ∉ condiciones` | A partir de los 60 años el cuerpo necesita algo más de proteína y entrenamiento de fuerza para frenar la pérdida de músculo. Hemos ajustado tu proteína al alza (mínimo {1,2 g/kg · o bien "{X} g al día" si la base es el peso ajustado}) y te recomendamos 30–40 g por comida. |
| `INFO_MAYOR_60_RENAL` | info | `edad ≥ 60` y `'renal' ∈ condiciones` | A tu edad convendría algo más de proteína para frenar la pérdida de músculo, pero tu condición renal manda y hemos aplicado el tope de prudencia. Esta es exactamente la decisión que debes tomar con tu nefrólogo/a, no con una calculadora. |
| `INFO_VEGANO` | info | `preferencia === 'vegano'` | Hemos subido tu proteína un 15 % por la menor digestibilidad de las fuentes vegetales. Recuerda suplementar B12 y vigilar hierro y omega-3. |
| `INFO_IMC_MUSCULADO` | info | `FFMI_norm ≥ 22` (H) / `≥ 19` (M), `IMC ≥ 25` y banda ∈ {muy_bajo, bajo, medio} | Tu IMC sale en "sobrepeso" pero tu masa muscular es alta: en tu caso el IMC no es un buen indicador y no debes tomarlo como problema. |
| `INFO_GRASA_ESTIMADA` | info | `grasa_fiabilidad === 'baja'` | Tu porcentaje de grasa es una estimación con un error típico de ±5 puntos. Una bioimpedancia profesional o una DEXA afinarían el cálculo. |
| `INFO_ALTO_RENDIMIENTO` | info | `perfil !== 'sedentario'` y `dias · minutos_sesion / 60 > 10` | Con más de 10 horas semanales de entrenamiento, un/a dietista-nutricionista deportivo puede afinar mucho más estos números (periodización, timing). Toma esto como punto de partida. |

**Fragmentos condicionales del texto.** Lo que va entre `{ }` es una parte opcional del mensaje:
- `{35/30}` en `INFO_PROTEINA_CAPADA`: se resuelve leyendo `macros.pct_cap`, el `pct_cap` realmente aplicado en el paso 8 (30 % en dieta vegetal con `kcal < 1800`, 35 % en el resto). **No se recalcula con `resultado.kcal`**: los pasos 9 y 10 pueden subir las kcal por encima de 1.800 después de aplicado el cap, y entonces el informe imprimiría un porcentaje que nunca se aplicó. La interfaz y el PDF deben resolver el placeholder, no escribir el 35 % fijo.
- El placeholder de `INFO_OBJETIVO_RESUELTO` / `INFO_OBJETIVO_RESUELTO_POR_PESO` se resuelve contra `objetivo_propuesto` (lo que decidió la regla 6.1), nunca contra `objetivo_efectivo`: los pasos 6.3, 6.4, 7 y 10bis pueden haberlo reescrito después. La rama `IMC < 20` de 6.1 propone `mantener`, de ahí la cuarta opción del conjunto.
- `{30/25}` en `WARN_SUELO_CALORICO_EA`: se resuelve al suelo de disponibilidad energética realmente aplicado en el paso 7 (25 kcal/kg MLG en banda `muy_alto`, 30 en el resto). Con el 30 fijo el informe afirmaba haber evitado un umbral que en banda `muy_alto` el propio motor no aplica: el plan entregado se quedaba en 25,1 kcal/kg mientras el texto prometía 30.
- `{20/25/30}` en `INFO_DEFICIT_CAPADO_TDEE`: se resuelve al `cap_pct` realmente aplicado, `Math.round(cap_pct · 100)` (20 % a partir de 65 años, 30 % en banda `muy_alto`, 25 % en el resto). Sin el 20 el aviso afirmaba una cifra falsa a todo usuario de 65 años o más (caso 14 de la §5: el déficit aplicado es el 20 % del TDEE). El número impreso debe coincidir siempre con `cap_pct`.
- `{ y alargado el calendario…}` en los tres `WARN_SUELO_CALORICO_*`: se **omite** cuando `cronograma === null`. Sin esa regla el informe prometía haber alargado un calendario que no existe (13 105 casos de 243 457 en el barrido).
- `{ y suavizado el ritmo}` en `WARN_PERDIDA_MAYOR_65`: se **omite** cuando `ritmo_ef === ritmo`. La segunda rama del paso 6.7 emite el aviso también cuando el usuario ya había elegido `suave` o `moderado`, es decir, cuando no se ha suavizado ningún ritmo; el déficit máximo sí se ha limitado siempre (`cap_pct ≤ 0,20`).
- `{A / B}` en `INFO_PESO_YA_MINIMO`: se usa la variante **A** ("el objetivo no es un peso: es recomposición") con `objetivo_efectivo ∈ {mantener, recomposicion, ganar}` y la variante **B** ("hemos fijado tu meta en ese mínimo y no más abajo") con `objetivo_efectivo === 'perder'`. El aviso se emite desde el bloque común del paso 13, antes de ramificar por objetivo, así que con `perder` convivía con un peso objetivo, un déficit y un cronograma mientras afirmaba que no había peso objetivo.
- `{1,2 g/kg · o bien "{X} g al día"…}` en `INFO_MAYOR_60`: ver paso 17.

**Avisos retirados con `'tca' ∈ condiciones`** (filtro del paso 17, ver allí la lista cerrada y el motivo):
`INFO_GRASA_ESTIMADA`, `INFO_PESO_YA_MINIMO`, `INFO_IMC_MUSCULADO`, `INFO_ADAPTACION`, `WARN_YA_MAGRO`,
`WARN_YA_EN_OBJETIVO`, `WARN_OBJETIVO_MUY_LEJANO`, `WARN_CRONOGRAMA_LARGO`, `INFO_SIN_CRONOGRAMA`,
`INFO_SIN_CRONOGRAMA_SIN_MARGEN`, `INFO_CRONOGRAMA_NO_ESTIMABLE` e `INFO_CRONOGRAMA_FUERA_DE_HORIZONTE`.
El motor no los emite, así que la regla de la SPEC-ux "se listan todos los avisos con su texto íntegro"
sigue siendo cierta sin excepciones de maquetación.

Copy fijo del informe (no depende de condiciones):
- Nota TDEE: "A tu gasto estimado le hemos restado un 5 % como margen de seguridad, porque casi todos sobrestimamos lo que nos movemos."
- Nota %grasa: "Ninguna fórmula sin aparato mide la grasa: te mostramos un rango, no una cifra exacta."
- Nota comidas: "No hay evidencia de que comer más o menos veces al día cambie tu metabolismo. Elige el número de comidas que mejor se adapte a tu rutina."
- Nota agua: "Es líquido bebido: el café, el té y las infusiones cuentan si los tomas de forma habitual; la comida aporta además un 20–30 % de agua que no está incluido aquí. El alcohol no cuenta y deshidrata. No fuerces más de 1 litro por hora. Si entrenas más de una hora, sudas mucho o hace calor, añade sal a las comidas o una bebida con electrolitos: beber mucha agua sin sodio puede bajarte el sodio en sangre."
- Nota peso objetivo: "El peso que te proponemos sale de tu masa magra estimada, y esa estimación tiene un margen de varios kilos. Por eso te damos una franja y no un número exacto: la báscula es una señal más, no el objetivo."
- Nota cierre kcal: "Las calorías de los macros pueden diferir hasta 10 kcal del objetivo por el redondeo a 5 g."
- Disclaimer general: "Báscula te ofrece una orientación nutricional general basada en evidencia científica, no un consejo médico ni un plan personalizado por un profesional sanitario. Los resultados son estimaciones: tu cuerpo puede responder de forma distinta. Si tienes una condición médica, tomas medicación, estás embarazada o en periodo de lactancia, o tienes antecedentes de trastornos de conducta alimentaria, consulta con un/a médico o dietista-nutricionista colegiado/a antes de seguir estas recomendaciones."

---

## 5. Vectores de prueba

Los catorce casos de esta sección están **generados por `docs/verify-vectors.mjs`**, la implementación de referencia de este documento, y se regeneran con `node docs/verify-vectors.mjs` cada vez que cambia una regla. Los nueve primeros son los vectores originales; los cinco últimos son los que pidió la revisión adversaria (bucle de factibilidad, regla de margen del paso 7, borde de la banda `medio`, cap renal con IMC ≥ 30 y usuario de más de 65 años). Todos los números de aquí son normativos: un motor que no los reproduzca no cumple la especificación.

Convenciones: `fecha_inicio = 2026-09-07` en todos; los intermedios se muestran con 1 decimal (tolerancia ±0,15 en tests: con ±0,1 los valores que caen justo en el medio unidad quedaban en el borde exacto de la tolerancia) y las salidas redondeadas se comparan con igualdad exacta. Los avisos se comparan como conjunto, ya aplicadas las reglas de supresión del paso 6.

### Caso 0 — Exclusiones y errores de validación

- `edad = 16` (resto cualquiera) → `{ excluido: 'EXCL_EDAD' }`.
- `edad = 76` → `{ excluido: 'EXCL_EDAD' }`.
- `sexo = 'mujer', embarazo_lactancia = true` → `{ excluido: 'EXCL_EMBARAZO_LACTANCIA' }`.
- `altura_cm = 180, peso_kg = 50` (IMC 15,4) → `{ excluido: 'EXCL_IMC_MUY_BAJO' }`.
- `altura_cm = 180, peso_kg = 58` (IMC 17,9) con `condiciones: ['tca']` → `{ excluido: 'EXCL_TCA_RIESGO' }`.
- `peso_kg = 400` → `{ excluido: 'ERR_INPUT_RANGO', errores: ['peso_kg', 'peso_kg+altura_cm'] }`.

### Caso 1 — Hombre 32 años, sobrepeso ligero, entrena fuerza, pierde grasa, sin peso objetivo

Input: hombre, 32 años, 178 cm, 84 kg; grasa `desconocido`; somatotipo q1 media / q2 moderada / q3 moderada / q4 atletico; actividad `ligero`; fuerza 4 d × 60 min, intensidad media, intermedio, entrena por la tarde; objetivo `perder`, ritmo `moderado`; peso objetivo `null`; omnívoro; 4 comidas; sin calor; sin condiciones.

1. IMC = **26,5** → `sobrepeso`.
2. CUN-BAE = 24,7 %; Deurenberg = 23,0 %; método efectivo `desconocido` → **24,7 %** (fiabilidad `baja`, rango 20–30, banda `alto`).
3. MLG = **63,27 kg**.
4. Mifflin = 1797,5; Katch = 1736,5; Harris = 1886,3 → BMR = **1797,5** (`mifflin`).
5. Perfil `fuerza`; PAL 1,50; MET 5,0 → kcal/sesión = 336,0; ejercicio/día = 192,0; bruto = 2888,3; TDEE = **2743,8**.
6. Objetivo efectivo **`perder`**, ritmo efectivo **`moderado`**.
7. **kcal = 2190** (cierre por macros 2190).
8. Proteína: base 84,00 kg (`peso_corporal`), g/kg efectivo 2,200, techo `P_cap` 191,6 → **P = 185 g** (2,20 g/kg PC; 33,8 % de kcal).
9. Grasa: suelo 58,8 g, techo 97,3 g, somatotipo `mesomorfo` → **G = 70 g** (0,83 g/kg PC; 28,8 % de kcal).
10. **HC = 205 g** (2,44 g/kg PC; 37,4 % de kcal). Cierre 4·185 + 4·205 + 9·70 = **2190** (Δ +0).
11. Fibra = **31 g**; azúcares libres máx. 54,8 g.
12. Agua: **3250 ml** (rango 3000–3500; unos 13 vasos de 250 ml).
13. Peso objetivo: método `grasa`; sugerido **74,5 kg** (rango 68,5–80,0; `mostrar_central = false`); efectivo **74,5 kg**; hito `null`. Referencia IMC-22 = 69,7 (63,4–78,9); clásicas Devine 73,2 / Robinson 71,1 / Miller 70,4 / Hamwi 75,2.
14. Cronograma: 0,503 kg/sem (0,60 %/sem), Δ 9,5 kg → **21–25 semanas** (2 diet breaks), 2027-02-01 a 2027-03-01; `precision_fecha = 'mes'`; `tramo_12sem` = [5,0, 6,0].
15. FFMI = 20,0; normalizado = **20,1** (`categoria = null`: banda de grasa alta, la categoría no se muestra).
16. Reparto (4 comidas, peri = Merienda):

| Comida | Hora | % kcal | P | G | HC | kcal | peri |
|---|---|---|---|---|---|---|---|
| Desayuno | 08:00 | 25 | 45 | 20 | 50 | 560 | no |
| Comida | 14:00 | 30 | 55 | 20 | 55 | 620 | no |
| Merienda | 17:30 | 15 | 30 | 10 | 40 | 370 | sí |
| Cena | 21:00 | 30 | 55 | 20 | 60 | 640 | no |

17. Avisos: `INFO_ADAPTACION`, `INFO_BMR_ATLETA`, `INFO_GRASA_ESTIMADA`, `WARN_PROTEINA_TOMA_ALTA`.

### Caso 2 — Mujer 28 años, medidas US Navy, recomposición, vegetariana, cribado TCA

Input: mujer, 28, 165 cm, 60 kg; grasa `medidas` cuello 32 / cintura 72 / cadera 96; somatotipo fina / poca / moderada / delgado; actividad `sedentario`; cardio 3 d × 45 min media, novata, entrena por la mañana; objetivo `recomposicion`, ritmo `moderado`; sin peso objetivo; vegetariana; 3 comidas; condiciones `['tca']`.

1. IMC = **22,0** → `normal`.
2. CUN-BAE = 29,1 %; Deurenberg = 27,5 %; US Navy = 26,4 %; método efectivo `medidas` → **26,4 %** (fiabilidad `media`, rango 22–30, banda `medio`).
3. MLG = **44,16 kg**.
4. Mifflin = 1330,3; Katch = 1323,8; Harris = 1392,3 → BMR = **1330,2** (`mifflin`).
5. Perfil `cardio`; PAL 1,40; MET 7,0 → kcal/sesión = 270,0; ejercicio/día = 115,7; bruto = 1978,1; TDEE = **1879,2**.
6. Objetivo efectivo **`recomposicion`**, ritmo efectivo **`suave`**.
7. **kcal = 1740** (cierre por macros 1750).
8. Proteína: base 60,00 kg (`peso_corporal`), g/kg efectivo 1,980, techo `P_cap` 130,5 → **P = 120 g** (2,00 g/kg PC; 27,6 % de kcal).
9. Grasa: suelo 48,0 g, techo 77,3 g, somatotipo `ectomorfo` → **G = 50 g** (0,83 g/kg PC; 25,9 % de kcal).
10. **HC = 205 g** (3,42 g/kg PC; 47,1 % de kcal). Cierre 4·120 + 4·205 + 9·50 = **1750** (Δ +10).
11. Fibra = **25 g**; azúcares libres máx. 43,5 g.
12. Agua: **2150 ml** (rango 1900–2400; unos 9 vasos de 250 ml).
13. Peso objetivo: método `actual`; sugerido **60,0 kg** (rango 53,0–61,0; `mostrar_central = true`); efectivo **`null`**; hito `null`. Referencia IMC-22 = 59,9 (54,4–67,8); clásicas Devine 56,9 / Robinson 57,4 / Miller 59,8 / Hamwi 56,4.
14. Cronograma: **`null`**.
15. FFMI = 16,2; normalizado = **16,5** (`medio`).
16. Reparto (3 comidas, peri = Desayuno):

| Comida | Hora | % kcal | P | G | HC | kcal | peri |
|---|---|---|---|---|---|---|---|
| Desayuno | 08:00 | 30 | 35 | 15 | 70 | 555 | sí |
| Comida | 14:00 | 35 | 45 | 15 | 65 | 575 | no |
| Cena | 21:00 | 35 | 40 | 20 | 70 | 620 | no |

17. Avisos: `INFO_RITMO_SUAVE`, `INFO_SOMATOTIPO`, `WARN_PROTEINA_TOMA_ALTA`, `WARN_RECOMPOSICION_SIN_FUERZA`. (`INFO_SIN_CRONOGRAMA` lo retira el filtro de protección del cribado TCA del paso 17.)

### Caso 3 — Hombre 45 años, obesidad grado II, sedentario, ritmo agresivo, peso objetivo 85 kg

Input: hombre, 45, 172 cm, 105 kg; grasa `desconocido`; somatotipo ancha / mucha / moderada / robusto; actividad `sedentario`; entrenamiento `ninguno`; objetivo `perder`, ritmo `agresivo`; peso objetivo 85; omnívoro; 3 comidas.

1. IMC = **35,5** → `obesidad_II`.
2. CUN-BAE = 37,4 %; Deurenberg = 36,7 %; método efectivo `desconocido` → **37,4 %** (fiabilidad `baja`, rango 32–42, banda `muy_alto`).
3. MLG = **65,69 kg**.
4. Mifflin = 1905,0; Katch = 1788,9; Harris = 2065,0 → BMR = **1905,0** (`mifflin`).
5. Perfil `sedentario`; PAL 1,40; MET 0,0 → kcal/sesión = 0,0; ejercicio/día = 0,0; bruto = 2667,0; TDEE = **2533,7**.
6. Objetivo efectivo **`perder`**, ritmo efectivo **`agresivo`**.
7. **kcal = 1910** (cierre por macros 1920).
8. Proteína: base 92,81 kg (`peso_ajustado`), g/kg efectivo 1,700, techo `P_cap` 167,1 → **P = 160 g** (1,52 g/kg PC; 33,5 % de kcal).
9. Grasa: suelo 65,0 g, techo 84,9 g, somatotipo `endomorfo` → **G = 80 g** (0,76 g/kg PC; 37,7 % de kcal).
10. **HC = 140 g** (1,33 g/kg PC; 29,3 % de kcal). Cierre 4·160 + 4·140 + 9·80 = **1920** (Δ +10).
11. Fibra = **27 g**; azúcares libres máx. 47,8 g.
12. Agua: **3150 ml** (rango 2900–3400; unos 13 vasos de 250 ml).
13. Peso objetivo: método `grasa`; sugerido **77,5 kg** (rango 71,0–83,0; `mostrar_central = false`); efectivo **85,0 kg**; hito 94,5 kg. Referencia IMC-22 = 65,1 (59,2–73,7); clásicas Devine 67,7 / Robinson 66,7 / Miller 67,1 / Hamwi 68,8.
14. Cronograma: 0,567 kg/sem (0,54 %/sem), Δ 20,0 kg → **40–52 semanas** (4 diet breaks), 2027-06-14 a 2027-09-06; `precision_fecha = 'mes'`; `tramo_12sem` = [5,0, 7,0].
15. FFMI = 22,2; normalizado = **22,7** (`categoria = null`: banda de grasa alta, la categoría no se muestra).
16. Reparto (3 comidas, sin comida peri):

| Comida | Hora | % kcal | P | G | HC | kcal | peri |
|---|---|---|---|---|---|---|---|
| Desayuno | 08:00 | 30 | 50 | 25 | 40 | 585 | no |
| Comida | 14:00 | 35 | 55 | 25 | 50 | 645 | no |
| Cena | 21:00 | 35 | 55 | 30 | 50 | 690 | no |

17. Avisos: `INFO_ADAPTACION`, `INFO_DEFICIT_CAPADO_TDEE`, `INFO_GRASA_ESTIMADA`, `INFO_SOMATOTIPO`, `WARN_IMC_35`, `WARN_SUELO_CALORICO_BMR`.

### Caso 4 — Mujer 52 años, obesidad grado I, estimación visual, objetivo "no lo sé", diabetes, 5 comidas

Input: mujer, 52, 160 cm, 82 kg; grasa `visual` `sobrepeso_visible`; somatotipo `null`; actividad `moderado`; mixto 2 d × 45 min baja, novata, entrena a mediodía; objetivo `no_se`, ritmo `suave`; sin peso objetivo; `sin_lactosa`; 5 comidas; condiciones `['diabetes']`.

1. IMC = **32,0** → `obesidad_I`.
2. CUN-BAE = 45,3 %; Deurenberg = 45,0 %; método efectivo `visual` → **35,0 %** (fiabilidad `baja`, rango 30–40, banda `muy_alto`).
3. MLG = **53,30 kg**.
4. Mifflin = 1399,0; Katch = 1521,3; Harris = 1476,4 → BMR = **1399,0** (`mifflin`).
5. Perfil `fuerza`; PAL 1,60; MET 4,0 → kcal/sesión = 184,5; ejercicio/día = 52,7; bruto = 2291,1; TDEE = **2176,6**.
6. Objetivo efectivo **`perder`**, ritmo efectivo **`suave`**.
7. **kcal = 1730** (cierre por macros 1725).
8. Proteína: base 78,10 kg (`peso_ajustado`), g/kg efectivo 1,700, techo `P_cap` 151,4 → **P = 135 g** (1,65 g/kg PC; 31,2 % de kcal).
9. Grasa: suelo 62,5 g, techo 76,9 g, somatotipo `mesomorfo` → **G = 65 g** (0,79 g/kg PC; 33,8 % de kcal).
10. **HC = 150 g** (1,83 g/kg PC; 34,7 % de kcal). Cierre 4·135 + 4·150 + 9·65 = **1725** (Δ -5).
11. Fibra = **24 g**; azúcares libres máx. 43,3 g.
12. Agua: **2800 ml** (rango 2550–3050; unos 11 vasos de 250 ml).
13. Peso objetivo: método `grasa`; sugerido **69,0 kg** (rango 63,5–74,5; `mostrar_central = false`); efectivo **69,0 kg**; hito 74,0 kg. Referencia IMC-22 = 56,3 (51,2–63,7); clásicas Devine 52,4 / Robinson 54,1 / Miller 57,2 / Hamwi 52,1.
14. Cronograma: 0,406 kg/sem (0,50 %/sem), Δ 13,0 kg → **37–46 semanas** (4 diet breaks), 2027-05-24 a 2027-07-26; `precision_fecha = 'mes'`; `tramo_12sem` = [3,5, 5,0].
15. FFMI = 20,8; normalizado = **21,5** (`categoria = null`: banda de grasa alta, la categoría no se muestra).
16. Reparto (5 comidas, peri = Comida):

| Comida | Hora | % kcal | P | G | HC | kcal | peri |
|---|---|---|---|---|---|---|---|
| Desayuno | 08:00 | 20 | 25 | 15 | 30 | 355 | no |
| Media mañana | 11:00 | 10 | 15 | 5 | 15 | 165 | no |
| Comida | 14:00 | 30 | 40 | 20 | 50 | 540 | sí |
| Merienda | 17:30 | 10 | 15 | 5 | 15 | 165 | no |
| Cena | 21:00 | 30 | 40 | 20 | 40 | 500 | no |

17. Avisos: `INFO_ADAPTACION`, `INFO_FIBRA_AJUSTADA`, `INFO_GRASA_ESTIMADA`, `INFO_OBJETIVO_RESUELTO`, `WARN_DIABETES`.

### Caso 5 — Hombre 68 años, %grasa fiable (Katch-McArdle), mantenimiento, fuerza ligera

Input: hombre, 68, 175 cm, 78 kg; grasa `conocido` 24 % `fiable`; somatotipo media / moderada / mucha / atletico; actividad `ligero`; fuerza 3 d × 45 min baja, novato, mañana; objetivo `mantener`; sin peso objetivo; omnívoro; 3 comidas.

1. IMC = **25,5** → `sobrepeso`.
2. CUN-BAE = 27,8 %; Deurenberg = 30,0 %; método efectivo `conocido` → **24,0 %** (fiabilidad `alta`, rango 22–26, banda `alto`).
3. MLG = **59,28 kg**.
4. Mifflin = 1538,8; Katch = 1650,4; Harris = 1587,1 → BMR = **1650,4** (`katch_mcardle`).
5. Perfil `fuerza`; PAL 1,50; MET 3,5 → kcal/sesión = 146,3; ejercicio/día = 62,7; bruto = 2538,4; TDEE = **2411,4**.
6. Objetivo efectivo **`mantener`**, ritmo efectivo **`moderado`**.
7. **kcal = 2410** (cierre por macros 2405).
8. Proteína: base 78,00 kg (`peso_corporal`), g/kg efectivo 1,900, techo `P_cap` 195,0 → **P = 150 g** (1,92 g/kg PC; 24,9 % de kcal).
9. Grasa: suelo 54,6 g, techo 107,1 g, somatotipo `mesomorfo` → **G = 85 g** (1,09 g/kg PC; 31,7 % de kcal).
10. **HC = 260 g** (3,33 g/kg PC; 43,2 % de kcal). Cierre 4·150 + 4·260 + 9·85 = **2405** (Δ -5).
11. Fibra = **34 g**; azúcares libres máx. 60,3 g.
12. Agua: **2750 ml** (rango 2500–3000; unos 11 vasos de 250 ml).
13. Peso objetivo: método `actual`; sugerido **78,0 kg** (rango 68,5–78,0; `mostrar_central = true`); efectivo **`null`**; hito `null`. Referencia IMC-22 = 67,4 (61,2–76,3); clásicas Devine 70,5 / Robinson 68,9 / Miller 68,7 / Hamwi 72,0.
14. Cronograma: **`null`**.
15. FFMI = 19,4; normalizado = **19,7** (`categoria = null`: banda de grasa alta, la categoría no se muestra).
16. Reparto (3 comidas, peri = Desayuno):

| Comida | Hora | % kcal | P | G | HC | kcal | peri |
|---|---|---|---|---|---|---|---|
| Desayuno | 08:00 | 30 | 45 | 25 | 90 | 765 | sí |
| Comida | 14:00 | 35 | 50 | 30 | 80 | 790 | no |
| Cena | 21:00 | 35 | 55 | 30 | 90 | 850 | no |

17. Avisos: `INFO_AGUA_MAYORES`, `INFO_MAYOR_60`, `INFO_SIN_CRONOGRAMA`, `WARN_PROTEINA_TOMA_ALTA`.

### Caso 6 — Mujer 35 años, delgada, %grasa estimado (no fiable), gana músculo, peso objetivo 60 kg

Input: mujer, 35, 170 cm, 56 kg; grasa `conocido` 21 % `estimado`; somatotipo fina / poca / poca / delgado; actividad `sedentario`; fuerza 3 d × 60 min media, novata, tarde; objetivo `ganar`, ritmo `moderado`; peso objetivo 60; omnívora; 4 comidas.

1. IMC = **19,4** → `normal`.
2. CUN-BAE = 25,8 %; Deurenberg = 25,9 %; método efectivo `conocido` → **21,0 %** (fiabilidad `media`, rango 17–25, banda `bajo`).
3. MLG = **44,24 kg**.
4. Mifflin = 1286,5; Katch = 1325,6; Harris = 1340,5 → BMR = **1286,5** (`mifflin`).
5. Perfil `fuerza`; PAL 1,40; MET 5,0 → kcal/sesión = 224,0; ejercicio/día = 96,0; bruto = 1897,1; TDEE = **1802,2**.
6. Objetivo efectivo **`ganar`**, ritmo efectivo **`moderado`**.
7. **kcal = 2070** (cierre por macros 2070).
8. Proteína: base 56,00 kg (`peso_corporal`), g/kg efectivo 1,800, techo `P_cap` 140,0 → **P = 100 g** (1,79 g/kg PC; 19,3 % de kcal).
9. Grasa: suelo 46,0 g, techo 92,0 g, somatotipo `ectomorfo` → **G = 50 g** (0,89 g/kg PC; 21,7 % de kcal).
10. **HC = 305 g** (5,45 g/kg PC; 58,9 % de kcal). Cierre 4·100 + 4·305 + 9·50 = **2070** (Δ +0).
11. Fibra = **29 g**; azúcares libres máx. 51,8 g.
12. Agua: **2050 ml** (rango 1800–2300; unos 8 vasos de 250 ml).
13. Peso objetivo: método `ritmo_16_semanas`; sugerido **60,0 kg** (rango 59,0–61,0; `mostrar_central = true`); efectivo **60,0 kg**; hito `null`. Referencia IMC-22 = 63,6 (57,8–72,0); clásicas Devine 61,4 / Robinson 60,8 / Miller 62,5 / Hamwi 60,7.
14. Cronograma: 0,243 kg/sem (0,43 %/sem), Δ 4,0 kg → **17–20 semanas** (0 diet breaks), 2027-01-04 a 2027-01-25; `precision_fecha = 'mes'`; `tramo_12sem` = [2,5, 3,0].
15. FFMI = 15,3; normalizado = **15,3** (`medio`).
16. Reparto (4 comidas, peri = Merienda):

| Comida | Hora | % kcal | P | G | HC | kcal | peri |
|---|---|---|---|---|---|---|---|
| Desayuno | 08:00 | 25 | 25 | 15 | 75 | 535 | no |
| Comida | 14:00 | 30 | 30 | 10 | 80 | 530 | no |
| Merienda | 17:30 | 15 | 15 | 10 | 60 | 390 | sí |
| Cena | 21:00 | 30 | 30 | 15 | 90 | 615 | no |

17. Avisos: `INFO_ADAPTACION`, `INFO_SOMATOTIPO`.

### Caso 7 — Hombre 40 años, trabajo físico, low-carb, endomorfo, clima caluroso, peso objetivo 80 kg

Input: hombre, 40, 180 cm, 92 kg; grasa `desconocido`; somatotipo ancha / mucha / moderada / robusto; actividad `alto`; cardio 2 d × 40 min media, intermedio, noche; objetivo `perder`, ritmo `moderado`; peso objetivo 80; `low_carb`; 3 comidas; clima caluroso.

1. IMC = **28,4** → `sobrepeso`.
2. CUN-BAE = 28,3 %; Deurenberg = 27,1 %; método efectivo `desconocido` → **28,3 %** (fiabilidad `baja`, rango 23–33, banda `muy_alto`).
3. MLG = **65,97 kg**.
4. Mifflin = 1850,0; Katch = 1794,9; Harris = 1957,6 → BMR = **1850,0** (`mifflin`).
5. Perfil `cardio`; PAL 1,75; MET 7,0 → kcal/sesión = 368,0; ejercicio/día = 105,1; bruto = 3342,6; TDEE = **3175,5**.
6. Objetivo efectivo **`perder`**, ritmo efectivo **`moderado`**.
7. **kcal = 2420** (cierre por macros 2420).
8. Proteína: base 92,00 kg (`peso_corporal`), g/kg efectivo 1,800, techo `P_cap` 211,8 → **P = 165 g** (1,79 g/kg PC; 27,3 % de kcal).
9. Grasa: suelo 64,4 g, techo 134,4 g, somatotipo `endomorfo` → **G = 120 g** (1,30 g/kg PC; 44,6 % de kcal).
10. **HC = 170 g** (1,85 g/kg PC; 28,1 % de kcal). Cierre 4·165 + 4·170 + 9·120 = **2420** (Δ +0).
11. Fibra = **34 g**; azúcares libres máx. 60,5 g.
12. Agua: **3700 ml** (rango 3450–3950; unos 15 vasos de 250 ml).
13. Peso objetivo: método `grasa`; sugerido **77,5 kg** (rango 71,5–83,5; `mostrar_central = false`); efectivo **80,0 kg**; hito `null`. Referencia IMC-22 = 71,3 (64,8–80,7); clásicas Devine 75,0 / Robinson 72,6 / Miller 71,5 / Hamwi 77,3.
14. Cronograma: 0,687 kg/sem (0,75 %/sem), Δ 12,0 kg → **20–23 semanas** (2 diet breaks), 2027-01-25 a 2027-02-15; `precision_fecha = 'mes'`; `tramo_12sem` = [7,0, 8,0].
15. FFMI = 20,4; normalizado = **20,4** (`categoria = null`: banda de grasa alta, la categoría no se muestra).
16. Reparto (3 comidas, peri = Cena):

| Comida | Hora | % kcal | P | G | HC | kcal | peri |
|---|---|---|---|---|---|---|---|
| Desayuno | 08:00 | 30 | 50 | 35 | 50 | 715 | no |
| Comida | 14:00 | 35 | 55 | 45 | 50 | 825 | no |
| Cena | 21:00 | 35 | 60 | 40 | 70 | 880 | sí |

17. Avisos: `INFO_ADAPTACION`, `INFO_GRASA_ESTIMADA`, `WARN_AGUA_ALTA`, `WARN_PROTEINA_TOMA_ALTA`.

### Caso 8 — Mujer 29 años, sedentaria, ritmo agresivo, vegana, peso objetivo irreal (48 kg), 2 comidas

Input: mujer, 29, 162 cm, 66 kg; grasa `visual` `media`; somatotipo media / moderada / moderada / atletico; actividad `sedentario`; sin entrenamiento; objetivo `perder`, ritmo `agresivo`; peso objetivo 48; vegana; 2 comidas.

1. IMC = **25,1** → `sobrepeso`.
2. CUN-BAE = 34,3 %; Deurenberg = 31,4 %; método efectivo `visual` → **28,0 %** (fiabilidad `baja`, rango 23–33, banda `alto`).
3. MLG = **47,52 kg**.
4. Mifflin = 1366,5; Katch = 1396,4; Harris = 1434,2 → BMR = **1366,5** (`mifflin`).
5. Perfil `sedentario`; PAL 1,40; MET 0,0 → kcal/sesión = 0,0; ejercicio/día = 0,0; bruto = 1913,1; TDEE = **1817,4**.
6. Objetivo efectivo **`perder`**, ritmo efectivo **`agresivo`**.
7. **kcal = 1430** (cierre por macros 1435).
8. Proteína: base 66,00 kg (`peso_corporal`), g/kg efectivo 1,955, techo `P_cap` 107,2 → **P = 100 g** (1,52 g/kg PC; 28,0 % de kcal).
9. Grasa: suelo 52,8 g, techo 63,6 g, somatotipo `mesomorfo` → **G = 55 g** (0,83 g/kg PC; 34,6 % de kcal).
10. **HC = 135 g** (2,05 g/kg PC; 37,8 % de kcal). Cierre 4·100 + 4·135 + 9·55 = **1435** (Δ +5).
11. Fibra = **20 g**; azúcares libres máx. 35,8 g.
12. Agua: **2000 ml** (rango 1750–2250; unos 8 vasos de 250 ml).
13. Peso objetivo: método `grasa`; sugerido **61,5 kg** (rango 56,5–66,5; `mostrar_central = false`); efectivo **59,5 kg**; hito `null`. Referencia IMC-22 = 57,7 (52,5–65,3); clásicas Devine 54,2 / Robinson 55,4 / Miller 58,2 / Hamwi 53,8.
14. Cronograma: 0,352 kg/sem (0,53 %/sem), Δ 6,5 kg → **21–24 semanas** (2 diet breaks), 2027-02-01 a 2027-02-22; `precision_fecha = 'mes'`; `tramo_12sem` = [3,5, 4,0].
15. FFMI = 18,1; normalizado = **18,6** (`categoria = null`: banda de grasa alta, la categoría no se muestra).
16. Reparto (2 comidas, sin comida peri):

| Comida | Hora | % kcal | P | G | HC | kcal | peri |
|---|---|---|---|---|---|---|---|
| Comida | 14:00 | 45 | 45 | 25 | 60 | 645 | no |
| Cena | 21:00 | 55 | 55 | 30 | 75 | 790 | no |

17. Avisos: `INFO_ADAPTACION`, `INFO_DEFICIT_CAPADO_TDEE`, `INFO_FIBRA_AJUSTADA`, `INFO_GRASA_ESTIMADA`, `INFO_MICRONUTRIENTES`, `INFO_PROTEINA_CAPADA`, `INFO_VEGANO`, `WARN_OBJETIVO_GRASA_MUY_BAJA`, `WARN_OBJETIVO_IMC_BAJO`, `WARN_PROTEINA_TOMA_ALTA`, `WARN_SUELO_CALORICO_EA`.

### Caso 9 — Hombre 25 años, ectomorfo, fuerza 5 días, volumen agresivo, sin peso objetivo, 6 comidas

Input: hombre, 25, 185 cm, 70 kg; grasa `desconocido`; somatotipo fina / poca / poca / delgado; actividad `sedentario`; fuerza 5 d × 75 min alta, novato, noche; objetivo `ganar`, ritmo `agresivo`; peso objetivo `null`; omnívoro; 6 comidas.

1. IMC = **20,5** → `normal`.
2. CUN-BAE = 13,6 %; Deurenberg = 14,1 %; método efectivo `desconocido` → **13,6 %** (fiabilidad `baja`, rango 9–19, banda `bajo`).
3. MLG = **60,51 kg**.
4. Mifflin = 1736,3; Katch = 1677,0; Harris = 1772,0 → BMR = **1736,2** (`mifflin`).
5. Perfil `fuerza`; PAL 1,40; MET 6,0 → kcal/sesión = 437,5; ejercicio/día = 312,5; bruto = 2743,3; TDEE = **2606,1**.
6. Objetivo efectivo **`ganar`**, ritmo efectivo **`agresivo`**.
7. **kcal = 3110** (cierre por macros 3110).
8. Proteína: base 70,00 kg (`peso_corporal`), g/kg efectivo 1,800, techo `P_cap` 175,0 → **P = 125 g** (1,79 g/kg PC; 16,1 % de kcal).
9. Grasa: suelo 69,1 g, techo 138,2 g, somatotipo `ectomorfo` → **G = 70 g** (1,00 g/kg PC; 20,3 % de kcal).
10. **HC = 495 g** (7,07 g/kg PC; 63,7 % de kcal). Cierre 4·125 + 4·495 + 9·70 = **3110** (Δ +0).
11. Fibra = **40 g**; azúcares libres máx. 77,8 g.
12. Agua: **2900 ml** (rango 2650–3150; unos 12 vasos de 250 ml).
13. Peso objetivo: método `ritmo_16_semanas`; sugerido **77,5 kg** (rango 75,5–79,0; `mostrar_central = true`); efectivo **77,5 kg**; hito `null`. Referencia IMC-22 = 75,3 (68,5–85,2); clásicas Devine 79,5 / Robinson 76,4 / Miller 74,3 / Hamwi 82,7.
14. Cronograma: 0,458 kg/sem (0,65 %/sem), Δ 7,5 kg → **17–19 semanas** (0 diet breaks), 2027-01-04 a 2027-01-18; `precision_fecha = 'mes'`; `tramo_12sem` = [4,5, 5,5].
15. FFMI = 17,7; normalizado = **17,4** (`bajo`).
16. Reparto (6 comidas, peri = Recena):

| Comida | Hora | % kcal | P | G | HC | kcal | peri |
|---|---|---|---|---|---|---|---|
| Desayuno | 08:00 | 15 | 20 | 10 | 75 | 470 | no |
| Media mañana | 11:00 | 10 | 15 | 5 | 50 | 305 | no |
| Comida | 14:00 | 25 | 25 | 20 | 95 | 660 | no |
| Merienda | 17:30 | 10 | 15 | 5 | 50 | 305 | no |
| Cena | 21:00 | 25 | 30 | 20 | 125 | 800 | no |
| Recena | 23:00 | 15 | 20 | 10 | 100 | 570 | sí |

17. Avisos: `INFO_ADAPTACION`, `INFO_BMR_ATLETA`, `INFO_GRASA_ESTIMADA`, `INFO_SOMATOTIPO`.

### Caso 10 — Mujer 30 años, 150 cm, obesidad y ritmo agresivo — bucle de factibilidad del paso 10

Input: mujer, 30, 150 cm, 70 kg; grasa `visual` `obesidad_visible`; somatotipo `null`; actividad `sedentario`; entrenamiento `ninguno`; objetivo `perder`, ritmo `agresivo`; sin peso objetivo; omnívora; 3 comidas.

1. IMC = **31,1** → `obesidad_I`.
2. CUN-BAE = 42,5 %; Deurenberg = 38,8 %; método efectivo `visual` → **43,0 %** (fiabilidad `baja`, rango 38–48, banda `muy_alto`).
3. MLG = **39,90 kg**.
4. Mifflin = 1326,5; Katch = 1231,8; Harris = 1429,7 → BMR = **1326,5** (`mifflin`).
5. Perfil `sedentario`; PAL 1,40; MET 0,0 → kcal/sesión = 0,0; ejercicio/día = 0,0; bruto = 1857,1; TDEE = **1764,2**.
6. Objetivo efectivo **`perder`**, ritmo efectivo **`agresivo`**.
7. **kcal = 1380** (cierre por macros 1375).
8. Proteína: base 68,13 kg (`peso_ajustado`), g/kg efectivo 1,700, techo `P_cap` 120,7 → **P = 85 g** (1,21 g/kg PC; 24,6 % de kcal).
9. Grasa: suelo 54,5 g, techo 61,3 g, somatotipo `mesomorfo` → **G = 55 g** (0,79 g/kg PC; 35,9 % de kcal).
10. **HC = 135 g** (1,93 g/kg PC; 39,1 % de kcal). Cierre 4·85 + 4·135 + 9·55 = **1375** (Δ -5).
11. Fibra = **20 g**; azúcares libres máx. 34,5 g.
12. Agua: **2100 ml** (rango 1850–2350; unos 8 vasos de 250 ml).
13. Peso objetivo: método `grasa`; sugerido **52,0 kg** (rango 47,5–56,0; `mostrar_central = false`); efectivo **52,0 kg**; hito 63,0 kg. Referencia IMC-22 = 49,5 (45,0–56,0); clásicas Devine 43,3 / Robinson 47,4 / Miller 51,8 / Hamwi 43,4.
14. Cronograma: 0,349 kg/sem (0,50 %/sem), Δ 18,0 kg → **58–84 semanas** (6 diet breaks), 2027-10-18 a 2028-04-17; `precision_fecha = 'mes'`; `tramo_12sem` = [3,0, 4,0].
15. FFMI = 17,7; normalizado = **19,0** (`categoria = null`: banda de grasa alta, la categoría no se muestra).
16. Reparto (3 comidas, sin comida peri):

| Comida | Hora | % kcal | P | G | HC | kcal | peri |
|---|---|---|---|---|---|---|---|
| Desayuno | 08:00 | 30 | 25 | 15 | 40 | 395 | no |
| Comida | 14:00 | 35 | 30 | 20 | 50 | 500 | no |
| Cena | 21:00 | 35 | 30 | 20 | 45 | 480 | no |

17. Avisos: `INFO_ADAPTACION`, `INFO_DEFICIT_CAPADO_TDEE`, `INFO_FIBRA_AJUSTADA`, `INFO_GRASA_ESTIMADA`, `INFO_MICRONUTRIENTES`, `WARN_CRONOGRAMA_LARGO`, `WARN_DEFICIT_INFACTIBLE`, `WARN_OBJETIVO_MUY_LEJANO`, `WARN_SUELO_CALORICO_BMR`. (`WARN_OBJETIVO_MUY_LEJANO`: la meta la propone la app —`peso_objetivo = null`— y aun así supone perder el 25,7 % del peso; hasta la ronda 2 la comprobación solo se ejecutaba con peso objetivo del usuario.)

### Caso 11 — Hombre 25 años, muy magro y muy pesado — suelo por encima del TDEE (regla de margen del paso 7)

Input: hombre, 25, 195 cm, 100 kg; grasa `conocido` 8 % `fiable`; somatotipo `null`; actividad `sedentario`; entrenamiento `ninguno`; objetivo `perder`, ritmo `moderado`; sin peso objetivo; omnívoro; 3 comidas.

1. IMC = **26,3** → `sobrepeso`.
2. CUN-BAE = 23,5 %; Deurenberg = 21,1 %; método efectivo `conocido` → **8,0 %** (fiabilidad `alta`, rango 6–10, banda `muy_bajo`).
3. MLG = **92,00 kg**.
4. Mifflin = 2098,8; Katch = 2357,2; Harris = 2221,9 → BMR = **2357,2** (`katch_mcardle`).
5. Perfil `sedentario`; PAL 1,40; MET 0,0 → kcal/sesión = 0,0; ejercicio/día = 0,0; bruto = 3300,1; TDEE = **3135,1**.
6. Objetivo efectivo **`mantener`**, ritmo efectivo **`moderado`**.
7. **kcal = 3140** (cierre por macros 3150).
8. Proteína: base 100,00 kg (`peso_corporal`), g/kg efectivo 1,200, techo `P_cap` 250,0 → **P = 120 g** (1,20 g/kg PC; 15,3 % de kcal).
9. Grasa: suelo 70,0 g, techo 139,6 g, somatotipo `mesomorfo` → **G = 110 g** (1,10 g/kg PC; 31,5 % de kcal).
10. **HC = 420 g** (4,20 g/kg PC; 53,5 % de kcal). Cierre 4·120 + 4·420 + 9·110 = **3150** (Δ +10).
11. Fibra = **40 g**; azúcares libres máx. 78,5 g.
12. Agua: **3000 ml** (rango 2750–3250; unos 12 vasos de 250 ml).
13. Peso objetivo: método `actual`; sugerido **100,0 kg** (rango 100,0–113,0; `mostrar_central = true`); efectivo **`null`**; hito `null`. Referencia IMC-22 = 83,7 (76,0–94,7); clásicas Devine 88,6 / Robinson 83,9 / Miller 79,8 / Hamwi 93,3.
14. Cronograma: **`null`**.
15. FFMI = 24,2; normalizado = **23,2** (`muy_desarrollado`).
16. Reparto (3 comidas, sin comida peri):

| Comida | Hora | % kcal | P | G | HC | kcal | peri |
|---|---|---|---|---|---|---|---|
| Desayuno | 08:00 | 30 | 35 | 35 | 125 | 955 | no |
| Comida | 14:00 | 35 | 45 | 35 | 150 | 1095 | no |
| Cena | 21:00 | 35 | 40 | 40 | 145 | 1100 | no |

17. Avisos: `INFO_IMC_MUSCULADO`, `INFO_SIN_CRONOGRAMA`, `WARN_SIN_MARGEN_DEFICIT`. (`WARN_SIN_MARGEN_DEFICIT` suprime `WARN_YA_MAGRO` y `WARN_RECOMPOSICION_SIN_FUERZA`: el plan final es `mantener` y esos dos textos prometen una recomposición.)

### Caso 12 — Hombre 35 años en el borde exacto de la banda `medio` sin peso objetivo — `WARN_YA_EN_OBJETIVO`

Input: hombre, 35, 180 cm, 80 kg; grasa `conocido` 15 % `estimado`; somatotipo `null`; actividad `ligero`; fuerza 3 d × 60 min media, intermedio, tarde; objetivo `perder`, ritmo `moderado`; sin peso objetivo; omnívoro; 4 comidas.

1. IMC = **24,7** → `normal`.
2. CUN-BAE = 22,3 %; Deurenberg = 21,5 %; método efectivo `conocido` → **15,0 %** (fiabilidad `media`, rango 11–19, banda `medio`).
3. MLG = **68,00 kg**.
4. Mifflin = 1755,0; Katch = 1838,8; Harris = 1825,2 → BMR = **1755,0** (`mifflin`).
5. Perfil `fuerza`; PAL 1,50; MET 5,0 → kcal/sesión = 320,0; ejercicio/día = 137,1; bruto = 2769,6; TDEE = **2631,2**.
6. Objetivo efectivo **`recomposicion`**, ritmo efectivo **`moderado`**.
7. **kcal = 2430** (cierre por macros 2435).
8. Proteína: base 80,00 kg (`peso_corporal`), g/kg efectivo 2,000, techo `P_cap` 200,0 → **P = 160 g** (2,00 g/kg PC; 26,3 % de kcal).
9. Grasa: suelo 56,0 g, techo 108,0 g, somatotipo `mesomorfo` → **G = 75 g** (0,94 g/kg PC; 27,8 % de kcal).
10. **HC = 280 g** (3,50 g/kg PC; 46,1 % de kcal). Cierre 4·160 + 4·280 + 9·75 = **2435** (Δ +5).
11. Fibra = **34 g**; azúcares libres máx. 60,8 g.
12. Agua: **2850 ml** (rango 2600–3100; unos 11 vasos de 250 ml).
13. Peso objetivo: método `actual`; sugerido **80,0 kg** (rango 74,0–85,0; `mostrar_central = true`); efectivo **`null`**; hito `null`. Referencia IMC-22 = 71,3 (64,8–80,7); clásicas Devine 75,0 / Robinson 72,6 / Miller 71,5 / Hamwi 77,3.
14. Cronograma: **`null`**.
15. FFMI = 21,0; normalizado = **21,0** (`bueno`).
16. Reparto (4 comidas, peri = Merienda):

| Comida | Hora | % kcal | P | G | HC | kcal | peri |
|---|---|---|---|---|---|---|---|
| Desayuno | 08:00 | 25 | 40 | 20 | 70 | 620 | no |
| Comida | 14:00 | 30 | 45 | 20 | 70 | 640 | no |
| Merienda | 17:30 | 15 | 25 | 10 | 55 | 410 | sí |
| Cena | 21:00 | 30 | 50 | 25 | 85 | 765 | no |

17. Avisos: `INFO_SIN_CRONOGRAMA`, `WARN_PROTEINA_TOMA_ALTA`, `WARN_YA_EN_OBJETIVO`.

### Caso 13 — Hombre 62 años con enfermedad renal e IMC ≥ 30 — cap renal como último filtro

Input: hombre, 62, 170 cm, 95 kg; grasa `desconocido`; somatotipo `null`; actividad `ligero`; fuerza 3 d × 45 min media, novato, mañana; objetivo `perder`, ritmo `moderado`; sin peso objetivo; omnívoro; 3 comidas; condiciones `['renal']`.

1. IMC = **32,9** → `obesidad_I`.
2. CUN-BAE = 35,7 %; Deurenberg = 37,5 %; método efectivo `desconocido` → **35,7 %** (fiabilidad `baja`, rango 31–41, banda `muy_alto`).
3. MLG = **61,10 kg**.
4. Mifflin = 1707,5; Katch = 1689,8; Harris = 1824,9 → BMR = **1707,5** (`mifflin`).
5. Perfil `fuerza`; PAL 1,50; MET 5,0 → kcal/sesión = 285,0; ejercicio/día = 122,1; bruto = 2683,4; TDEE = **2549,2**.
6. Objetivo efectivo **`perder`**, ritmo efectivo **`moderado`**.
7. **kcal = 1780** (cierre por macros 1785).
8. Proteína: base 88,77 kg (`peso_ajustado`), g/kg efectivo 1,900, techo `P_cap` 155,8 → **P = 95 g** (1,00 g/kg PC; 21,3 % de kcal).
9. Grasa: suelo 62,1 g, techo 79,1 g, somatotipo `mesomorfo` → **G = 65 g** (0,68 g/kg PC; 32,9 % de kcal).
10. **HC = 205 g** (2,16 g/kg PC; 46,1 % de kcal). Cierre 4·95 + 4·205 + 9·65 = **1785** (Δ +5).
11. Fibra = **25 g**; azúcares libres máx. 44,5 g.
12. Agua: **null** (condición renal o cardiaca) → `INFO_AGUA_NO_PRESCRITA`.
13. Peso objetivo: método `grasa`; sugerido **72,0 kg** (rango 66,0–77,0; `mostrar_central = false`); efectivo **72,0 kg**; hito 85,5 kg. Referencia IMC-22 = 63,6 (57,8–72,0); clásicas Devine 65,9 / Robinson 65,2 / Miller 66,0 / Hamwi 66,7.
14. Cronograma: 0,699 kg/sem (0,74 %/sem), Δ 23,0 kg → **37–48 semanas** (4 diet breaks), 2027-05-24 a 2027-08-09; `precision_fecha = 'mes'`; `tramo_12sem` = [6,5, 8,5].
15. FFMI = 21,1; normalizado = **21,8** (`categoria = null`: banda de grasa alta, la categoría no se muestra).
16. Reparto (3 comidas, peri = Desayuno):

| Comida | Hora | % kcal | P | G | HC | kcal | peri |
|---|---|---|---|---|---|---|---|
| Desayuno | 08:00 | 30 | 30 | 20 | 70 | 580 | sí |
| Comida | 14:00 | 35 | 30 | 20 | 65 | 560 | no |
| Cena | 21:00 | 35 | 35 | 25 | 70 | 645 | no |

17. Avisos: `INFO_ADAPTACION`, `INFO_AGUA_NO_PRESCRITA`, `INFO_DEFICIT_CAPADO_TDEE`, `INFO_GRASA_ESTIMADA`, `INFO_MAYOR_60_RENAL`, `INFO_MICRONUTRIENTES`, `WARN_RENAL`. (`WARN_RENAL` suprime `INFO_PROTEINA_CAPADA`: el límite que manda es el tope renal de 1,0 g/kg, no los 2,5 g/kg del texto capado.)

### Caso 14 — Mujer 70 años con objetivo `perder` — modificadores de edad ≥ 65

Input: mujer, 70, 158 cm, 75 kg; grasa `desconocido`; somatotipo `null`; actividad `ligero`; fuerza 2 d × 40 min baja, novata, mañana; objetivo `perder`, ritmo `agresivo`; sin peso objetivo; omnívora; 4 comidas.

1. IMC = **30,0** → `obesidad_I`.
2. CUN-BAE = 44,9 %; Deurenberg = 46,8 %; método efectivo `desconocido` → **44,9 %** (fiabilidad `baja`, rango 40–50, banda `muy_alto`).
3. MLG = **41,35 kg**.
4. Mifflin = 1226,5; Katch = 1263,1; Harris = 1327,5 → BMR = **1226,5** (`mifflin`).
5. Perfil `fuerza`; PAL 1,50; MET 3,5 → kcal/sesión = 125,0; ejercicio/día = 35,7; bruto = 1875,5; TDEE = **1781,7**.
6. Objetivo efectivo **`perder`**, ritmo efectivo **`moderado`**.
7. **kcal = 1580** (cierre por macros 1580).
8. Proteína: base 74,92 kg (`peso_ajustado`), g/kg efectivo 1,900, techo `P_cap` 138,2 → **P = 120 g** (1,60 g/kg PC; 30,4 % de kcal).
9. Grasa: suelo 59,9 g, techo 70,2 g, somatotipo `mesomorfo` → **G = 60 g** (0,80 g/kg PC; 34,2 % de kcal).
10. **HC = 140 g** (1,87 g/kg PC; 35,4 % de kcal). Cierre 4·120 + 4·140 + 9·60 = **1580** (Δ +0).
11. Fibra = **22 g**; azúcares libres máx. 39,5 g.
12. Agua: **2550 ml** (rango 2300–2800; unos 10 vasos de 250 ml).
13. Peso objetivo: método `grasa`; sugerido **56,0 kg** (rango 55,0–60,0; `mostrar_central = false`); efectivo **56,0 kg**; hito 67,5 kg. Referencia IMC-22 = 54,9 (49,9–62,2); clásicas Devine 50,6 / Robinson 52,7 / Miller 56,1 / Hamwi 50,4.
14. Cronograma: **`null`**.
15. FFMI = 16,6; normalizado = **17,3** (`categoria = null`: banda de grasa alta, la categoría no se muestra).
16. Reparto (4 comidas, peri = Desayuno):

| Comida | Hora | % kcal | P | G | HC | kcal | peri |
|---|---|---|---|---|---|---|---|
| Desayuno | 08:00 | 25 | 30 | 15 | 40 | 415 | sí |
| Comida | 14:00 | 30 | 35 | 15 | 40 | 435 | no |
| Merienda | 17:30 | 15 | 20 | 10 | 20 | 250 | no |
| Cena | 21:00 | 30 | 35 | 20 | 40 | 480 | no |

17. Avisos: `INFO_AGUA_MAYORES`, `INFO_CRONOGRAMA_FUERA_DE_HORIZONTE`, `INFO_DEFICIT_CAPADO_TDEE`, `INFO_FIBRA_AJUSTADA`, `INFO_GRASA_ESTIMADA`, `INFO_MAYOR_60`, `INFO_PROTEINA_CAPADA`, `WARN_DEFICIT_INFACTIBLE`, `WARN_OBJETIVO_MUY_LEJANO`, `WARN_PERDIDA_MAYOR_65`. (`INFO_DEFICIT_CAPADO_TDEE` imprime aquí **20 %**, no 25 ni 30: `cap_pct = min(0,30, 0,20) = 0,20` por la edad, y `deficit_cap = 0,20 · 1781,7 = 356,3` frente a los 618,8 kcal del ritmo pedido. `WARN_PERDIDA_MAYOR_65` **sí** imprime el fragmento «{ y suavizado el ritmo}», porque el ritmo `agresivo` se ha suavizado a `moderado`. `WARN_OBJETIVO_MUY_LEJANO` entra por la corrección de la ronda 2: la meta la propone la app y supone perder el 25,3 % del peso.)

### Resumen de salidas (para tests de regresión)

| Caso | kcal | P g | G g | HC g | Fibra | Agua ml | Peso obj. ef. | Semanas | BMR ecuación |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 2190 | 185 | 70 | 205 | 31 | 3250 | 74,5 | 21–25 | mifflin |
| 2 | 1740 | 120 | 50 | 205 | 25 | 2150 | — | — | mifflin |
| 3 | 1910 | 160 | 80 | 140 | 27 | 3150 | 85,0 | 40–52 | mifflin |
| 4 | 1730 | 135 | 65 | 150 | 24 | 2800 | 69,0 | 37–46 | mifflin |
| 5 | 2410 | 150 | 85 | 260 | 34 | 2750 | — | — | katch_mcardle |
| 6 | 2070 | 100 | 50 | 305 | 29 | 2050 | 60,0 | 17–20 | mifflin |
| 7 | 2420 | 165 | 120 | 170 | 34 | 3700 | 80,0 | 20–23 | mifflin |
| 8 | 1430 | 100 | 55 | 135 | 20 | 2000 | 59,5 | 21–24 | mifflin |
| 9 | 3110 | 125 | 70 | 495 | 40 | 2900 | 77,5 | 17–19 | mifflin |
| 10 | 1380 | 85 | 55 | 135 | 20 | 2100 | 52,0 | 58–84 | mifflin |
| 11 | 3140 | 120 | 110 | 420 | 40 | 3000 | — | — | katch_mcardle |
| 12 | 2430 | 160 | 75 | 280 | 34 | 2850 | — | — | mifflin |
| 13 | 1780 | 95 | 65 | 205 | 25 | `null` | 72,0 | 37–48 | mifflin |
| 14 | 1580 | 120 | 60 | 140 | 22 | 2550 | 56,0 | — | mifflin |

Regenerar con `node docs/verify-vectors.mjs` (la tabla se imprime al final, bajo "RESUMEN DE SALIDAS"). El mismo script ejecuta un barrido aleatorio de 106 724 perfiles válidos —sobre la rejilla completa del dominio de la §1: alturas 130-230 cm y pesos 35-300 kg— contra 31 familias de invariantes de seguridad y debe terminar con **0 violaciones**.

---

## 6. Notas de honestidad científica (para el copy y el PDF)

### Evidencia fuerte (se puede afirmar sin matices)

- **Balance energético**: perder o ganar peso depende del balance calórico sostenido; ningún reparto de macros lo cambia a igualdad de calorías y proteína (ISSN, Aragon 2017).
- **Mifflin-St Jeor** es la ecuación con mejor validación en población general, normopeso y obesa (Frankenfield 2005, revisión sistemática de la AND). Error típico ±10 % en ~8 de cada 10 personas.
- **Proteína**: 1,6 g/kg/día es el punto a partir del cual no hay más ganancia de masa magra con entrenamiento de fuerza (Morton 2018, meta-análisis, IC 1,0–2,2); en déficit, 2,3–3,1 g/kg de masa magra preserva mejor el músculo (Helms 2014, Longland 2016). Hasta 2,5–3,3 g/kg durante un año no mostró daño en adultos sanos (Antonio 2016).
- **Grasa dietética ≥ 20 % de las kcal** como mínimo (EFSA, ACSM/AND); bajar del 20 % reduce la testosterona un 10–15 % en varones (Whittaker & Wu 2021).
- **Disponibilidad energética < 30 kcal/kg MLG** provoca alteraciones endocrinas en días (Loucks; IOC REDs 2023). Es la protección correcta para mujeres; un "mínimo de grasa femenino" no tiene evidencia.
- **Ritmo de pérdida 0,5–1 %/semana**: más lento conserva o gana masa magra; más rápido no pierde más grasa (Garthe 2011; ISSN 2017).
- **Frecuencia de comidas** no cambia el resultado a igualdad de calorías (Schoenfeld 2023); sí ayuda repartir la proteína en 3–5 tomas de 0,25–0,40 g/kg (ISSN 2017; Schoenfeld & Aragon 2018).
- **Personas mayores**: ≥ 1,0–1,2 g/kg de proteína (PROT-AGE 2013, ESPEN 2014), 30–40 g por toma, y entrenamiento de fuerza.
- **Fibra 25 g/día** (EFSA), **azúcares libres < 10 % kcal** (OMS 2015), **agua 2,0/2,5 L/día** como referencia poblacional (EFSA 2010).

### Heurísticas (se usan, pero se declaran como tales)

- **Somatotipo**: clasificación descriptiva de Sheldon (años 40), nunca validada para prescribir nutrición. Aquí solo mueve un 10 % de las kcal no proteicas entre grasa e hidratos según preferencia declarada. Copy obligatorio: "El somatotipo es una forma antigua de describir la silueta corporal, pero la ciencia actual no ha demostrado que sirva para calcular calorías o macros de forma precisa. Lo usamos solo como un ajuste ligero de tu preferencia entre carbohidratos y grasas, nunca para decidir cuántas calorías necesitas."
- **% de grasa sin aparato**: US Navy, CUN-BAE, Deurenberg y la estimación visual tienen un error típico de 3–5 puntos frente a DEXA; CUN-BAE está validada en población española (Pamplona) y por eso es el método por defecto. Siempre se muestra como rango entero.
- **Katch-McArdle** solo mejora a Mifflin si el %grasa es fiable; con un %grasa estimado puede ser peor. Por eso solo se activa con fuente `fiable`.
- **PAL 1,40–1,90, METs netos y factor 0,95**: los PAL son valores de FAO/WHO/UNU y EFSA adaptados a "solo vida diaria"; el 0,95 es una práctica de producto (MacroFactor, Legion) fundamentada en la sobreestimación documentada de la actividad autoinformada (Lichtman 1992), no un coeficiente validado.
- **7 700 kcal = 1 kg**: aproximación lineal que sobreestima la pérdida a medio plazo por adaptación metabólica (Hall; Trexler 2014); a 12 meses el sesgo se acerca a un factor 2, no al 25 %. Por eso el extremo superior del cronograma crece con el horizonte (×1,25 a los 6 meses, ×1,75 al año), por encima de 16 semanas solo se muestra el primer tramo y en meses (no fechas exactas), y el horizonte se corta a 104 semanas (20 en `ganar`). Se recomienda recalcular cada 2–4 semanas.
- **Peso objetivo y precisión**: sale de `MLG / (1 − %grasa objetivo)`, y la MLG viene de un %grasa con ±2 a ±5 puntos de error. Por eso se redondea a 0,5 kg, el ensanche del rango se escala con la MLG y, cuando la fiabilidad es `baja` (CUN-BAE o selector visual, el caso por defecto), no se muestra número central: solo la franja.
- **FFMI normalizado**: la constante 6,3 y la referencia de 1,80 m son de una muestra de varones (Kouri 1995). En mujeres se usa 1,70 m como referencia y la categoría se oculta cuando el %grasa está en banda `alto` o `muy_alto`, porque ahí el FFMI no informa de musculatura.
- **Diet breaks** cada 8 semanas: apoyados por MATADOR (Byrne 2018), un único ensayo bien hecho; se presentan como recomendación, no como obligación.
- **Suelos 1 200/1 500 kcal y "no bajar del BMR"**: umbrales de práctica clínica y divulgación, no de un position stand; se usan como línea de alarma, no como prescripción.
- **Agua por peso (30–35 ml/kg), 500 ml/h de ejercicio y +400 ml por calor**: heurísticas prácticas coherentes con EFSA/ACSM, no cifras textuales de un position stand. Se muestra rango ±250 ml.
- **Peso objetivo**: el método por %grasa (MLG / (1 − %grasa objetivo)) es la práctica de campo estándar; los rangos ACE (hombre 12–17 %, mujer 20–25 %) son referencias de fitness, no umbrales clínicos. Devine/Robinson/Miller/Hamwi son fórmulas farmacológicas antiguas que ignoran la composición corporal.
- **FFMI ≈ 25 como techo natural**: muestra pequeña y antigua (Kouri 1995); orientativo.
- **Recomposición**: bien documentada en principiantes, personas que retoman el entrenamiento y personas con %grasa alto (Barakat 2020); en entrenados avanzados es posible pero de magnitud pequeña.
- **Superávit por experiencia (5–20 %)**: consenso de campo (Helms, Aragon), no ensayos controlados comparando tamaños de superávit.
- **Low-carb / cetogénica**: sin ventaja isocalórica con proteína igualada (Aragon 2017); es una opción de adherencia legítima, no metabólicamente superior. Báscula ofrece low-carb (45 % grasa) y no cetogénica.

### Lo que el motor no hace (y debe decirse)

- No diagnostica, no sustituye a un profesional sanitario ni a una valoración individualizada.
- No calcula para embarazo, lactancia, menores de 18, mayores de 75, IMC < 16, ni para quien declara una relación difícil con la comida con IMC < 18,5: esos cuatro casos son exclusiones duras del paso 0 y no devuelven ningún número.
- Con enfermedad renal o cardiaca no prescribe: en renal la proteína es un tope de prudencia (1,0 g/kg de peso corporal) explícitamente pendiente de confirmar con el especialista, y en renal o cardiaca no se da objetivo de agua. Con enfermedad hepática solo avisa.
- Con `'tca'` declarado e IMC ≥ 18,5 fuerza el ritmo más suave y no menciona la causa en el informe (el cuestionario prometió que esa respuesta es privada); el enlace de ADANER es un pie fijo universal, no una señal.
- En déficit, la proteína es la **última** variable que se sacrifica: primero baja la grasa hasta su suelo, después la proteína hasta `P_min`, y solo entonces suben las calorías (Helms 2014, Longland 2016). Cualquier otro documento del proyecto debe describir este orden con las mismas palabras.
- No recalibra con datos reales: es un cálculo estático de una sola vez. La v2 debería adaptar el TDEE con el peso registrado (enfoque MacroFactor), que es 120–170 % más preciso tras 3–4 semanas.
- No usa la menopausia como variable: la evidencia atribuye el cambio de gasto a composición corporal y actividad, ya capturadas por peso, edad y %grasa.

### Trazabilidad mínima en el PDF

Cada bloque del informe lleva una nota de fuente abreviada: BMR "Mifflin 1990 / Frankenfield 2005"; TDEE "FAO/WHO/UNU 2004, EFSA 2013, Compendium 2024, ajuste −5 % Lichtman 1992"; proteína "ISSN 2017, Morton 2018, PROT-AGE 2013, Weijs 2024"; grasa "EFSA 2010, ACSM/AND 2016, Whittaker 2021"; hidratos "IOM DRI (RDA 130 g/día), ACSM 2016 — en `low_carb` el mínimo baja a 75 g de forma deliberada e informada, por debajo de esa RDA, y se declara en el aviso correspondiente"; fibra/azúcares "EFSA 2010, OMS 2015"; agua "EFSA 2010, ACSM 2007"; ritmo y cronograma "Helms 2014, Garthe 2011, Byrne 2018, Trexler 2014"; %grasa "Hodgdon 1984, Gómez-Ambrosi 2012, Deurenberg 1991, ACE"; somatotipo "heurística de preferencia, sin evidencia prescriptiva".

---

## 7. Registro de revisión (verificación adversaria, 2026-09-07)

Decisión sobre cada uno de los 75 hallazgos de `docs/ISSUES-verificacion.md`. "Aplicado" = el cambio ya está en este documento. "Fuera de alcance" = el hallazgo es real pero su ubicación principal es `SPEC-ux-comidas-pdf.md` o `docs/foods.json`, y se corrige allí.

| # | Sev. | Decisión | Resumen |
|---|---|---|---|
| 1 | critical | Aceptado (aplicado) | Guardarraíl de bajo peso incondicional en el paso 6.3 (`IMC < 18,5` y obj ∈ {perder, recomposicion} → mantener), fallback de `no_se` a `mantener` con IMC < 20 y prohibición dura `kcal_calc = max(kcal_calc, TDEE)` en el paso 7. |
| 2 | critical | **Aceptado parcial** (aplicado; alcance reducido con justificación) | Nuevas exclusiones duras en el paso 0: `EXCL_IMC_MUY_BAJO` (IMC < 16) y `EXCL_TCA_RIESGO` (`tca` con IMC < 18,5), más validación cruzada `ERR_INPUT_RANGO` si IMC < 12 o > 60. **No se implementa la segunda rama que pedía el issue** (`'tca'` con `objetivo ∈ {perder, recomposicion}` → exclusión): el cribado del paso 5b son dos ítems no validados y su tasa de positivos incluye "Prefiero no responder", así que excluir a todo positivo que quiera perder peso bloquearía a una fracción muy grande de usuarios reales sobre una señal débil, y el bloqueo por sí mismo es un desencadenante documentado. Se opta por **mitigación**, y esa mitigación es la condición que hace defendible la decisión: ritmo suave forzado, sin selector visual de siluetas, sin %grasa, sin peso objetivo, sin cronograma, ADANER como pie fijo — y, desde la ronda R5, **sin los avisos que enunciaban esos tres bloques ocultos** (filtro del paso 17 e invariante S10c). Mientras esa fuga estuvo abierta no había ni exclusión ni mitigación completa; ahora sí. |
| 3 | critical | Aceptado con matiz (aplicado) | El cap renal pasa a ser el último filtro, sobre peso corporal, por encima de la línea roja RDA, y el copy deja de prometer un número: dice el rango real (0,55–1,2 g/kg) y que lo decide el nefrólogo. No se baja el cap a 0,55–0,60 g/kg porque eso sería prescribir una pauta terapéutica desde una calculadora general. |
| 4 | critical | Aceptado (aplicado) | Con `renal` o `cardiaca` no se da objetivo de agua (`agua = null`, `INFO_AGUA_NO_PRESCRITA`); `cardiaca` añadida al tipo `Condicion`. |
| 5 | major | Aceptado (aplicado) | El suelo de disponibilidad energética ya no se desactiva en banda `muy_alto`: se atenúa a 25 kcal/kg MLG. |
| 6 | major | Aceptado (aplicado) | `g_min` sube a 12 % (H) / 20 % (M) — el borde superior de la banda `muy_bajo` — y cuando el objetivo del usuario cae por debajo no se fija un número nuevo: se muestra la franja. |
| 7 | major | Aceptado (aplicado) | Peso sugerido a 0,5 kg, ensanche `w` escalado con la MLG y el error del método, y `mostrar_central = false` con fiabilidad `baja`. |
| 8 | major | Aceptado (aplicado) | Modificadores por edad ≥ 65: `cap_pct ≤ 0,20`, ritmo ≤ `moderado`, `g_c` 18/26 %, suelo de IMC 22 y aviso `WARN_PERDIDA_MAYOR_65`. |
| 9 | major | Aceptado en la parte del motor (aplicado) | `WARN_TCA` se sustituye por `INFO_RITMO_SUAVE`, que no menciona la causa; el enlace de ADANER queda como pie universal. El resto (paso 5b, §4.2/§4.6) es de SPEC-ux. |
| 10 | major | Aceptado (aplicado) | `diabetes` + `low_carb` → `preferencia_efectiva = 'omnivoro'` y `WARN_LOWCARB_DIABETES`; `WARN_DIABETES` añade la monitorización de glucemia. |
| 11 | major | Fuera de alcance | Filtrado del generador de menús por `condiciones`: corresponde a SPEC-ux §3 y a foods.json. |
| 12 | major | Aceptado (aplicado) | Suelo anclado a la parte bebida de EFSA (1 500 M / 2 000 H), techo total 4 000 ml, `WARN_AGUA_ALTA` y nota obligatoria de sodio/electrolitos. |
| 13 | major | Fuera de alcance | Cribado SCOFF y selector de siluetas: SPEC-ux §1.2.5b y §1.2.6C. |
| 14 | major | Aceptado (aplicado) | Factor de adaptación creciente (×1,25 a 6 meses, ×1,75 al año), horizonte cortado, fechas en meses por encima de 16 semanas y primer tramo de 12 semanas; `INFO_ADAPTACION` dice la cifra real. |
| 15 | major | Aceptado (a y b, aplicado) | Techo de g/kg tras los multiplicadores y `pct_cap = 0,30` en dietas vegetales con < 1 800 kcal. El aviso `WARN_PROTEINA_INALCANZABLE` del generador de menús es de SPEC-ux. |
| 16 | minor | Aceptado (aplicado) | `HC_min = 130` (RDA IOM), 75 g solo en `low_carb`, declarado en la trazabilidad de la §6. |
| 17 | minor | Aceptado (aplicado) | El suelo de fibra deja de ser duro: `min(25, 0,15 · HC)` y `INFO_FIBRA_AJUSTADA`. |
| 18 | minor | Aceptado (aplicado) | `INFO_MAYOR_60` no se emite con condición renal (se sustituye por `INFO_MAYOR_60_RENAL`) y expresa el mínimo en g/día cuando la base es el peso ajustado. |
| 19 | minor | Aceptado (aplicado) | El modificador +0,2 g/kg cubre `perder` y `recomposicion` con banda `muy_bajo` o `bajo`; deja de ser código muerto. |
| 20 | minor | Aceptado (aplicado) | La rama `ganar` corrige el peso objetivo a IMC 27,5 y el cronograma de ganancia se acota a 20 semanas. |
| 21 | minor | Aceptado (aplicado) | Nuevo `INFO_MICRONUTRIENTES` con kcal < 1 500 (M) / < 1 800 (H). |
| 22 | minor | Aceptado (aplicado) | `Condicion` amplía a `hipertension`, `tiroides`, `bariatrica`, `glp1` y `otra`, con sus avisos y con suelo de proteína 1,5 g/kg en bariátrica/GLP-1. La lista del cuestionario es de SPEC-ux. |
| 23 | critical | Fuera de alcance | Regenerar los menús de ejemplo de SPEC-ux §3.5 contra foods.json. |
| 24 | critical | Aceptado (aplicado) | Orden de sacrificio unificado y normativo: grasa → proteína → subir kcal, con recálculo de límites en cada iteración. |
| 25 | critical | Aceptado (aplicado) | Guardas duras del paso 14 (`delta_kg < 0,5`, `delta_kcal < 50`, `ritmo_kg_sem < 0,05`) y regla de margen del paso 7. |
| 26 | critical | Fuera de alcance | Banco vegano de foods.json y caso terminal del generador. |
| 27 | critical | Aceptado en la parte del motor (aplicado) | Mismo cambio que el 9: el aviso del cribado deja de revelar su causa. |
| 28 | critical | Fuera de alcance | Bancos de plantillas por preferencia: SPEC-ux §3.2/§3.5. |
| 29 | major | Fuera de alcance | Lácteos sin lactosa en foods.json. |
| 30 | major | Fuera de alcance | Semántica de `carbohidratos`/`kcal` en foods.json. |
| 31 | major | Fuera de alcance | Campo `estado` (crudo/cocido/seco) en foods.json. |
| 32 | major | Fuera de alcance | Descuento real de fruta y verdura en el generador. |
| 33 | major | Fuera de alcance | Regla `low_carb` del generador y tags de foods.json. |
| 34 | major | Aceptado (aplicado) | Nuevo `WARN_RECOMPOSICION_SIN_FUERZA` cuando se asigna recomposición sin entrenamiento de fuerza. |
| 35 | major | Aceptado (aplicado) | Tabla cerrada de supresión de avisos contradictorios al final del paso 6, comprobada en tests. |
| 36 | major | Aceptado (aplicado) | El peso objetivo resuelve la dirección en el paso 6.1 con `INFO_OBJETIVO_RESUELTO_POR_PESO`. |
| 37 | major | Fuera de alcance | Contenido del PDF: SPEC-ux §4. |
| 38 | major | Fuera de alcance | Condicionalidad del paso 12 del wizard. |
| 39 | major | Fuera de alcance | Slider 0–7 del wizard (el motor ya acepta `dias_semana = 0`). |
| 40 | major | Fuera de alcance | Contradicción interna de SPEC-ux §1.1 vs §1.2 paso 3. |
| 41 | major | Aceptado (aplicado) | Nota † del campo `edad`: 0–120 formato, 18–75 cálculo, resto `EXCL_EDAD` desde el paso 0. |
| 42 | major | Fuera de alcance | Taxonomía `grupo`/`roles` y `FoodQuery`. |
| 43 | major | Aceptado en la parte del motor (aplicado) | Suelo de fibra específico para `low_carb` (`max(20, 10 g/1000 kcal)`); la comprobación de fibra del menú es de SPEC-ux. |
| 44 | major | Aceptado en la parte del motor (aplicado) | Nuevo `WARN_PROTEINA_TOMA_ALTA` (> 0,55 g/kg en una toma) y copy de `WARN_PROTEINA_POR_TOMA` reescrito. |
| 45 | minor | Aceptado (aplicado) | Redondeo dirigido (`roundUp10`, `roundUp5`, `roundDown5`) siempre que hay un límite activo. |
| 46 | minor | Fuera de alcance | Sufijo "· ritmo X" de la cabecera de resultados. |
| 47 | minor | Fuera de alcance | Denominador de la barra de progreso. |
| 48 | minor | Fuera de alcance | Regla de selección de consejos. |
| 49 | minor | Fuera de alcance | Listado de equivalencias. |
| 50 | minor | Fuera de alcance | Unidades imperiales del wizard. |
| 51 | minor | Fuera de alcance | `medidaCasera` y `unidad_g` en foods.json. |
| 52 | critical | Aceptado (aplicado) | Regla de margen del paso 7 (`kcal ≥ TDEE − 50` → `mantener` + `WARN_SIN_MARGEN_DEFICIT`) y guardas del paso 14. |
| 53 | major | Aceptado (aplicado) | Denominador mínimo (`ritmo_kg_sem ≥ 0,05`) y tope de 104 semanas. |
| 54 | major | Aceptado (aplicado) | Cruce `suelo_g > techo_g`: se suben las kcal (`WARN_KCAL_INSUFICIENTES_PARA_MACROS`) en vez de forzar la grasa por encima de su techo; redondeos dirigidos por ambos lados. |
| 55 | major | Aceptado (aplicado) | Rango de peso nunca invertido, `lo ≤ sugerido_central ≤ hi` garantizado y nuevo `INFO_PESO_YA_MINIMO`. |
| 56 | major | Aceptado (aplicado) | Orden de recorte invertido y recálculo de `suelo_g`, `techo_g`, `P_cap` y `P_min` cada vez que el bucle cambia las kcal. |
| 57 | major | Aceptado (aplicado) | El techo de g/kg es siempre el último filtro, después de los multiplicadores de preferencia. |
| 58 | major | Aceptado (aplicado) | Misma corrección que el 41: la edad es la única excepción a `ERR_INPUT_RANGO`. |
| 59 | minor | Aceptado (aplicado) | `roundUp10` cuando se ha activado un suelo del paso 7. |
| 60 | minor | Aceptado (aplicado) | Suelo por sexo también en `mantener` y `ganar`, con `WARN_GASTO_BAJO_MINIMO`. |
| 61 | minor | Aceptado (aplicado) | Nota ‡ del campo `grasa.valor` y `WARN_GRASA_FUERA_DE_RANGO` obligatorio cuando el clamp altera el dato. |
| 62 | minor | Aceptado (aplicado) | Mismo cambio que el 3 y el 70: cap renal sobre peso corporal, último filtro, `roundDown5`, sin línea roja RDA. |
| 63 | minor | Aceptado (aplicado) | Regla `WARN_YA_EN_OBJETIVO` en el paso 6 (antes de calcular kcal) y guarda `delta_kg < 0,5` en el paso 14. |
| 64 | minor | Aceptado (aplicado) | `agua_rango` nunca por debajo del suelo y vasos declarados como aproximación. |
| 65 | minor | Aceptado (aplicado) | `ref_h` por sexo (1,80 H / 1,70 M) y categoría de FFMI oculta en bandas `alto`/`muy_alto`. |
| 66 | minor | Aceptado (aplicado) | Fórmulas clásicas solo entre 150 y 200 cm; fuera, `clasicas = null`. |
| 67 | minor | Aceptado (aplicado) | El paso 6.2 no se aplica cuando el usuario no eligió objetivo, y `INFO_OBJETIVO_IGNORADO` suprime `WARN_OBJETIVO_INCOHERENTE`. |
| 68 | minor | Aceptado (aplicado) | Condición completa de `INFO_ALTO_RENDIMIENTO` en la §4 y desigualdades explícitas en las tablas de IMC, bandas de grasa y FFMI. |
| 69 | critical | Aceptado (aplicado) | Mismo cambio que el 52. |
| 70 | critical | Aceptado (aplicado) | Mismo cambio que el 3 y el 62. |
| 71 | major | Rechazado (nota de proceso) | No es un defecto de esta especificación: `verify-vectors.mjs` es una implementación de referencia nueva. Queda anotado que los vectores de la §5 deben regenerarse contra el motor real, no contra una segunda traducción de la spec. |
| 72 | major | Aceptado (aplicado) | El paso 16 define ahora `hora` y `peri` por comida (tabla 3.13) y declara que en la v1 hay un solo reparto: `CONTRATO.md` y `types.ts` deben quitar `reparto_entreno`, `reparto_descanso` y `comidas_peri`. |
| 73 | minor | Aceptado (aplicado) | Mismo cambio que el 45 y el 59. |
| 74 | minor | Aceptado (aplicado) | La rama `ganar` valida el peso objetivo también por abajo (`WARN_OBJETIVO_SIGUE_BAJO_PESO`). |
| 75 | minor | Aceptado (aplicado) | Mismo cambio que el 57. |

**Consecuencia global (cerrada en la reconciliación del 2026-09-07):** `docs/verify-vectors.mjs` se ha reescrito contra esta versión de la especificación y la §5 se ha regenerado con su salida (14 vectores: los 9 originales más los 5 que pedía la revisión). El barrido aleatorio del script recorre 144 553 perfiles válidos contra 23 familias de invariantes y termina con **0 violaciones**.

### Hallazgos de la reconciliación (posteriores a los 75 issues)

| # | Sev. | Decisión | Resumen |
|---|---|---|---|
| R1 | major | Aceptado (aplicado) | `round05` podía cruzar un límite recién impuesto: un objetivo de 58,62 kg (IMC 18,5 exacto) se imprimía como 58,5 kg, por debajo del suelo. Se añaden `roundUp05`/`roundDown05` a la §0.1 y se usan como redondeo dirigido en el paso 13 (`min185`, `g_min`, techo de IMC 27,5), en el extremo inferior de `sugerido_rango` y en la rama `ganar`, que también valida por abajo cuando el peso lo sugiere el motor. Lo detectó el barrido de invariantes (S13, 3 065 casos). |
| R2 | minor | Aceptado (aplicado) | `WARN_CARDIACA` existía en `SPEC-ux` (paso 5 del wizard y §2.4) pero no en la tabla §4 ni en el paso 8: se da de alta el aviso y se emite junto al resto de condiciones. |
| R3 | minor | Aceptado (aplicado) | Entrada `cribado_tca: 'positivo' \| 'evitado' \| 'negativo' \| null` (§0.3, §1 fila 17), normalizada en el paso 0 hacia `condiciones + ['tca']`. El wizard ya la producía; el motor no la declaraba. |
| R4 | minor | Aceptado (aplicado) | `ERR_INPUT_RANGO` se devuelve como `{ excluido: 'ERR_INPUT_RANGO', errores: string[] }`: el campo `errores?` se añade a `Resultado` y sustituye al antiguo `{ ok: false }` de `CONTRATO.md`. |

### Ronda 5 — revisión adversaria posterior a la reconciliación (2026-09-07)

Numeración de la ronda (21 hallazgos: 1 critical, 11 major, 9 minor). Los que solo tocan
`SPEC-ux-comidas-pdf.md`, `foods.json` o `CONTRATO.md` se anotan también en el registro de esos documentos.

| # | Sev. | Decisión | Resumen |
|---|---|---|---|
| R5-1 | major | Aceptado (aplicado) | Paso 6.4 no convierte `ganar` → `recomposicion` con `IMC < 18,5`: quien pide ganar peso estando en bajo peso conserva el objetivo y recibe el superávit (mínimo 150 kcal/día) en vez de un plan de mantenimiento mudo. No hace falta el `WARN_IMC_BAJO_SIN_SUPERAVIT` que proponía el issue: con la guarda, la rama `ganar` del paso 7 ya no puede quedarse sin superávit (la prohibición de balance negativo solo sube kcal y la regla de margen no se aplica a `ganar`). Invariante S15c. |
| R5-2 | major | Aceptado (aplicado) | El techo de IMC 27,5 se aplica también a `sugerido_central` y a `sugerido_rango[1]`, no solo a `peso_obj_ef`. Además, cuando `PC / h² > 27,5` el techo **no** se aplica al sugerido y `peso_obj_ef` pasa a `max(roundDown05(27,5·h²), round05(PC), sugerido_central)` con `WARN_OBJETIVO_IMC_ALTO`: recortar sin más convertía un plan de ganancia en una meta 22 kg por debajo del peso de partida (hallazgo del propio invariante nuevo). Invariantes S14c y S14d. |
| R5-3 | major | Aceptado (aplicado) | `WARN_PERDIDA_MAYOR_65` se reevalúa en el paso 17 contra `objetivo_efectivo` y se retira si ya no es `perder` (opción a del issue, la coherente con el texto del aviso). La condición exacta de la §4 vuelve a ser literalmente cierta. Invariante S21b. |
| R5-4 | major | Aceptado (aplicado) | La tabla de supresión del paso 6 cubre ahora las contradicciones que introduce la regla de margen del paso 7: `WARN_SIN_MARGEN_DEFICIT` suprime `WARN_YA_MAGRO`, `WARN_RECOMPOSICION_SUGERIDA` y `WARN_RECOMPOSICION_SIN_FUERZA`; `INFO_OBJETIVO_RESUELTO_POR_PESO` suprime `INFO_OBJETIVO_IGNORADO`. Los `WARN_SUELO_CALORICO_*` no se suprimen (son información verdadera y necesaria): se les da una **variante corta de texto** sin la promesa de "alargado el calendario", que se usa cuando `cronograma === null`. Invariantes S21c y S21d. |
| R5-5 | minor | Aceptado (aplicado) | `grasa_rango = [max(3, ·), min(65, ·)]` y `referencias.cunbae` / `referencias.deurenberg` acotadas a [3, 60], el mismo dominio que la spec ya exige a Navy. Se acababa imprimiendo "entre −1 % y 9 % de grasa" y un `deurenberg = 81,2 %`. |
| R5-6 | minor | Aceptado (aplicado) | `agua_rango[1] = min(agua_ml + 250, 4000)`. Invariante S11e. (Duplicado del R5-16.) |
| R5-7 | minor | Aceptado (aplicado) | §5 regenerada con la salida de `verify-vectors.mjs`: corregidos los ocho intermedios que estaban redondeados hacia abajo en el medio exacto (casos 1, 2, 4, 5, 9 y 10) y la tolerancia declarada de intermedios sube de ±0,1 a ±0,15. |
| R5-8 | minor | Aceptado (aplicado) | `WARN_RENAL` suprime `INFO_PROTEINA_CAPADA` (fila nueva en la tabla del paso 6 y condición de la §4 ampliada con `'renal' ∉ condiciones`): el límite que manda en un usuario renal es el tope de 1,0 g/kg, no los 2,5 g/kg del texto capado. |
| R5-9 | critical | Aceptado (aplicado, opción robusta) | **Filtro de protección del cribado TCA en el paso 17**: con `'tca' ∈ condiciones` el motor no emite `INFO_GRASA_ESTIMADA`, `INFO_PESO_YA_MINIMO`, `INFO_IMC_MUSCULADO`, `INFO_ADAPTACION`, `WARN_YA_MAGRO`, `WARN_YA_EN_OBJETIVO`, `WARN_OBJETIVO_MUY_LEJANO`, `WARN_CRONOGRAMA_LARGO`, `INFO_SIN_CRONOGRAMA`, `INFO_SIN_CRONOGRAMA_SIN_MARGEN`, `INFO_CRONOGRAMA_NO_ESTIMABLE` ni `INFO_CRONOGRAMA_FUERA_DE_HORIZONTE`. Se resuelve en el motor y no como excepción de maquetación para que sea comprobable: invariante **S10c**. La §2.8 y la §4.6 de SPEC-ux mantienen intacta su regla de "todos los avisos, texto íntegro". Afecta a los vectores 2 y 11 de la §5. |
| R5-10 | major | Aceptado (aplicado) | `preferencia_efectiva: Preferencia` se publica en `Resultado` (y en `types.ts` y en los stubs); `CONTRATO.md` y SPEC-ux §3.1 pasan a exigir que el generador la use en vez de `inputs.preferencia`. |
| R5-11 | major | Aceptado (aplicado en `CONTRATO.md`) | La tolerancia del generador se alinea con §3.3: ±10 % en kcal y el umbral terminal del 15 % en proteína; se elimina el ±15 % por macro de hidrato y grasa, que los propios vectores de §3.6 incumplen. |
| R5-12 | major | Aceptado (aplicado en SPEC-ux §2.5/§4.4) | Guarda de ración en las tres tablas de equivalencias y tabla de grasa restringida a `grupo === 'grasa'` sin rol `proteina`. Comprobado sobre `foods.json`: caen los 970 g de arroz de coliflor, los 90 g de aceitunas y el pan proteico, y desaparecen salmón, huevo, atún en aceite, tofu y jamón de la tabla de grasa. |
| R5-13 | major | Aceptado (aplicado en SPEC-ux §2.3/§4.3) | El agua se presenta como franja (cifra principal) con `{agua_ml} ml` como referencia secundaria, y el microcopy fijo pasa a ser la "Nota agua" íntegra de la §4, con la frase del 20–30 % de agua de los alimentos y la de sodio/electrolitos. |
| R5-14 | major | Aceptado (aplicado en SPEC-ux §3.0) | El enum de `roles` incorpora `'complemento'` y el de `tags`, `con_lactosa`; `FoodQuery.rol` los admite; la validación automática de la base comprueba ahora valores de enum y que todo alimento tenga fila en `clampRacion`. `foods.json` no cambia (ya era coherente con el enum ampliado). |
| R5-15 | major | Aceptado (aplicado) | La fila 2 de este registro pasa a "Aceptado parcial" con la justificación escrita de por qué no se excluye a todo cribado positivo que quiera perder peso, y con la constancia de que la mitigación solo es completa desde el R5-9. |
| R5-16 | minor | Aceptado (aplicado) | Mismo cambio que el R5-6. |
| R5-17 | minor | Aceptado (aplicado en SPEC-ux §2.2) | El texto del cap de proteína usa el placeholder `{35/30}` de la §4 en vez del 35 % literal. |
| R5-18 | minor | Aceptado (opción b: reescritura del texto) | `INFO_RITMO_SUAVE` pasa a "Hemos elegido el planteamiento más sostenible en el tiempo…", cierto en los cuatro objetivos. Se descarta condicionarlo a `objetivo_efectivo ∈ {perder, ganar}`: su presencia constante es parte del camuflaje del cribado y mantiene el invariante S16 tal cual. |
| R5-19 | minor | Aceptado (aplicado en SPEC-ux) | Referencias cruzadas al Paso 6 corregidas (6.6 → 6.7 para el ritmo, 6.5 → 6.6 para `INFO_OBJETIVO_IGNORADO`, "6.1-6.4" → "6.1-6.5"), y "en pérdida" sustituido por "sea cual sea el objetivo". |
| R5-20 | minor | Aceptado (aplicado en SPEC-ux §1.0) | El paso 12 se declara condicional también a `cribado_tca ∉ {positivo, evitado}` y el total se recalcula tras el paso 5b. |
| R5-21 | minor | Aceptado (aplicado en SPEC-ux §3.1/§3.3) | El generador recibe `fibra_objetivo` (vía `resultado.macros`) y la tabla de `clampRacion` gana filas para aceitunas (10–40 g) y cremas de frutos secos (10–30 g). |

**Estado tras la ronda 5:** `node docs/verify-vectors.mjs` → 14 vectores sin incoherencias y **0 violaciones** en 144 553 perfiles del barrido, ahora con 28 familias de invariantes (nuevas: S10c, S11e, S14c, S14d, S15c, S21b, S21c, S21d). `npx tsc -p tsconfig.app.json --noEmit` limpio.

### Ronda 2 de verificación adversaria (`docs/ISSUES-ronda2.md`, 2026-09-07)

17 hallazgos (1 critical, 9 major, 7 minor) de dos revisores independientes. Aquí solo los que tocan este
documento o `verify-vectors.mjs`; los que viven en `SPEC-ux-comidas-pdf.md` o en `foods.json` se registran
en el §6 de aquel documento.

| # | Sev. | Decisión | Resumen |
|---|---|---|---|
| 1 | critical | Fuera de alcance | Guardas del cribado TCA en §2.9 y §4.2 de SPEC-ux: son reglas de presentación, no del motor. Aplicadas allí. |
| 2 | major | **Aceptado** (aplicado) | `INFO_DEFICIT_CAPADO_TDEE` pasa del placeholder `{25/30}` a `{20/25/30}`, resuelto a `Math.round(cap_pct · 100)`, y se declara en el bloque "Fragmentos condicionales del texto". A partir de 65 años `cap_pct = 0,20` y el aviso solo podía imprimir una cifra falsa (caso 14). |
| 3 | major | **Aceptado, opción b** (aplicado) | Se reescribe `WARN_OBJETIVO_IMC_BAJO` ("…así que lo hemos subido") en vez de añadir una fila de supresión: el suelo por `g_min` puede volver a subir la meta y el texto anterior afirmaba dónde quedaba. Preferimos reescribir a suprimir porque los dos avisos son información verdadera y distinta (uno explica el suelo de IMC, el otro el de %grasa), y suprimir uno le quitaría al usuario la mitad de la explicación. La lista de avisos del caso 8 no cambia. |
| 4 | major | Fuera de alcance | Cita obsoleta de `INFO_RITMO_SUAVE` en SPEC-ux §1.2.5b. Corregida allí (se sustituye la copia del string por una remisión a la tabla §4). |
| 5, 6, 7 | major | Fuera de alcance | Regla de selección de plantilla, tabla `clampRacion` y banco `low_carb`: SPEC-ux §3.2/§3.3. |
| 8 | minor | Fuera de alcance | Nota del paso 11 del wizard. Corregida en SPEC-ux (el forzado a suave es incondicional, §1 campo 10 y tabla 3.8). |
| 9 | minor | **Aceptado** (aplicado) | `WARN_PERDIDA_MAYOR_65` pasa a "Hemos limitado el déficit máximo{ y suavizado el ritmo}", con el fragmento omitido cuando `ritmo_ef === ritmo`. La segunda rama del paso 6.7 emite el aviso sin haber tocado el ritmo; el déficit máximo sí baja siempre. |
| 10 | minor | Fuera de alcance | Listas de prioridad visual de SPEC-ux §2.8 y §4.2. Unificadas allí, con la lista completa de `WARN_*` de condición médica. |
| 11, 12 | minor | Fuera de alcance | Vector de fibra del Ejemplo C y campos `condiciones`/`peso_kg` del generador: SPEC-ux §3.6, §3.1 y §5. |
| 13 | major | **Aceptado** (aplicado) | Nuevo **paso 10bis**: la regla de margen y `WARN_DEFICIT_MINIMO` se reevalúan contra las kcal finales, después de que los pasos 9 y 10 puedan haberlas subido. El paso 7 conserva una primera pasada. Se opta por **no** volver a mover `kcal` en 10bis (solo la etiqueta y el aviso): subirlas obligaría a repetir los pasos 8-10 y el plan ya está a menos de 50 kcal del gasto. Invariante nuevo **S24** (`perder ⇒ TDEE − kcal ≥ 50`) y **S24b** para `recomposicion`. Ningún vector de la §5 cambia de números. |
| 14 | major | **Aceptado** (aplicado) | `P_min` se cierra por abajo con la línea roja RDA: `P_min = max(P_min, 0,8 · PC)` sin condición `renal` (con `renal` sigue mandando `min(P_min, 1,0 · PC)`), y se recalcula con la misma regla dentro del bucle del paso 10. Además la rejilla del barrido pasa a cubrir el dominio completo de la §1 (alturas 130-230, pesos 35-300): sin eso, S5a no podía ver los perfiles de IMC > 55 que son los únicos afectados. |
| 15 | major | **Aceptado** (aplicado) | `WARN_OBJETIVO_MUY_LEJANO` sale del bloque `si no:` y se evalúa una sola vez al final de la rama `perder`, con el peso objetivo ya redondeado y por encima de `piso_peso`. La condición de la §4 no distingue quién fijó la meta y ahora es literalmente cierta. Invariante nuevo **S24c**. **Cambia la lista de avisos de los casos 10 y 14** de la §5 (ambos con meta propuesta por la app y pérdida > 25 %); ningún número cambia. |
| 16 | minor | **Aceptado, opción a** (aplicado) | `INFO_PESO_YA_MINIMO` gana una variante de texto para `objetivo_efectivo === 'perder'` ("hemos fijado tu meta en ese mínimo y no más abajo") en vez de suprimirse: la información —la meta está topada por el suelo de IMC— es verdadera y útil precisamente en ese caso. Declarada en "Fragmentos condicionales". |
| 17 | minor | **Aceptado** (aplicado) | La §1 declara ahora la validación de dominio de todos los enumerados, `n_comidas ∈ {2..6}`, enteros y formato de `fecha_inicio`, con `ERR_INPUT_RANGO` y el nombre del campo; `validar()` la implementa. El `break` mudo del bucle del paso 10 pasa a `throw`: un bucle que no converge es un fallo del motor, no una salida válida (era lo que enmascaraba `objetivo: 'adelgazar'` → `kcal = 202 440` con macros `NaN`). Invariante nuevo **S25**: ningún campo numérico de `Resultado` es `NaN`. |

**Estado tras la ronda 2:** `node docs/verify-vectors.mjs` → 14 vectores sin incoherencias y **0 violaciones**
en 106 724 perfiles del barrido (rejilla ampliada al dominio completo), con **31 familias** de invariantes
(nuevas: S24, S24c, S25). Los catorce vectores conservan todos sus números; solo cambian las listas de
avisos de los casos 10 y 14.

