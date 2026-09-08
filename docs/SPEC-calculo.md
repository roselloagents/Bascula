# Báscula (RS Agents) — Especificación del motor de cálculo v1.2

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
0 exclusiones (+ normalización de condiciones y preferencias) → 1 IMC → 2 %grasa → 3 MLG → 4 BMR
→ 5 TDEE → 6 objetivo efectivo → 7 kcal objetivo (con suelos) → 8 proteína → 9 grasa
→ 10 hidratos (resto + factibilidad) → 10bis segunda pasada de la regla de margen → 11 fibra
→ 12 agua → 13 peso objetivo → 14 cronograma y proyección → 15 FFMI → 16 reparto por comidas
→ 17 avisos finales → 19 ciclo (v1.2)
```

El **Paso 19 (ciclo)** sí forma parte de `calcular` y va el último porque su única condición de entrada es
`INFO_CICLO`, que se decide en el paso 17. No toca ningún número: solo publica `Resultado.ciclo`.
(Se numera 19 y no 18 porque el 18 ya estaba ocupado por el ajuste manual, que no vive dentro de `calcular`.)

El **Paso 18 (ajuste manual)** no forma parte de `calcular`: es una función aparte, `ajustarMacros(resultado,
ajuste)`, que la interfaz llama **después**, con el `Resultado` ya cerrado, cuando el usuario mueve el panel
"Ajusta tus macros". Se documenta al final de la §2 porque reutiliza literalmente los pasos 11, 14 y 16.

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
export type PreferenciaBase = 'omnivoro' | 'vegetariano' | 'vegano';          // v1.1
export type Restriccion = 'sin_lactosa' | 'sin_gluten';                        // v1.1
export type RecomposicionPrioridad = 'perder' | 'equilibrado' | 'ganar';       // v1.1
export type Menstruacion = 'regular' | 'irregular' | 'ausente' | 'no_dice';    // v1.1
export type SintomaRegla = 'dolor' | 'hinchazon' | 'antojos'                   // v1.2, ORDEN CANÓNICO
                         | 'cansancio' | 'sangrado_abundante';
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
  cribado_tca: CribadoTCA | null;   // v1.1: la UI escribe SIEMPRE null (el paso 5b ya no existe)
  fecha_inicio: string;      // ISO 'YYYY-MM-DD'; por defecto hoy
  menu_sencillo?: boolean;   // SPEC-ux §3.7; el motor lo ignora por completo
  // ---- v1.1: todos opcionales; con todos ausentes el motor se comporta exactamente como la v1.0
  recomposicion_prioridad?: RecomposicionPrioridad | null;  // default 'equilibrado'
  menstruacion?: Menstruacion | null;                        // solo mujeres; en hombres se ignora
  preferencia_base?: PreferenciaBase | null;                 // si está, `preferencia` deja de leerse
  restricciones?: Restriccion[] | null;
  low_carb?: boolean | null;
  // ---- v1.2: todos opcionales; con todos ausentes el motor se comporta exactamente como la v1.1
  plazo_semanas?: number | null;        // 4–52 enteras; solo se lee con `peso_objetivo !== null` (Paso 6.7ter)
  sintomas_regla?: SintomaRegla[] | null;  // solo con `menstruacion ∈ {regular, irregular}` (Paso 19)
  alimentos_excluidos?: string[] | null;   // ids de foods.json — EL MOTOR LO IGNORA
  alimentos_favoritos?: string[] | null;   // ids de foods.json, en el orden del usuario — EL MOTOR LO IGNORA
}
```

**Los tres campos que el motor ignora.** `menu_sencillo`, `alimentos_excluidos` y `alimentos_favoritos`
se validan (dominio y tipo) y se paran ahí: **no entran en ningún cálculo**, y dos usuarios idénticos
salvo esos tres campos reciben el mismo `Resultado` bit a bit (invariante **S33**). Solo los lee
`src/meals`. La consecuencia práctica, normativa para la UI: `firmaDeInputs`
(`src/components/resultados/ajuste.ts`) **debe ignorar exactamente esos mismos tres campos** al calcular
la huella del plan, o marcar un alimento como "no me gusta" tiraría el ajuste manual guardado y el
botón "Volver a mi plan" del wizard.

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
| 12 | `preferencia` | `'omnivoro' \| 'vegetariano' \| 'vegano' \| 'sin_lactosa' \| 'sin_gluten' \| 'low_carb'` | — | — | `'omnivoro'` | Sí | **Formato antiguo (una sola opción).** Desde la v1.1 el wizard envía las filas 19-21 y este campo **deja de leerse** en cuanto `preferencia_base` está presente; sigue siendo obligatorio para no romper el tipo ni el código que ya lo escribe. Cuando `preferencia_base` falta, el paso 0 lo traduce con la regla de abajo. |
| 13 | `n_comidas` | entero | — | 2–6 | 3 | Sí | Solo reparte; **no** cambia totales (Schoenfeld 2023). |
| 14 | `clima_caluroso` | boolean | — | — | `false` | No | +400 ml de agua (heurística prudente). |
| 15 | `embarazo_lactancia` | boolean | — | — | `false` | Si sexo=`mujer` | Exclusión total (`EXCL_EMBARAZO_LACTANCIA`). |
| 16 | `condiciones` | `Condicion[]` | — | — | `[]` | No | `diabetes` → aviso + anula `low_carb`; `renal` → aviso + proteína capada a 1,0 g/kg de **peso corporal** como último filtro + sin objetivo de agua; `cardiaca` (insuficiencia cardiaca) → aviso + sin objetivo de agua; `hepatica` → aviso; `tca` → ritmo forzado a `suave` y, si `IMC < 18,5`, exclusión (paso 0); `hipertension` (HTA o enfermedad cardiovascular) → aviso de sodio; `tiroides` → aviso de derivación; `bariatrica` (cirugía bariátrica previa) y `glp1` (semaglutida, tirzepatida y similares) → aviso de derivación + suelo de proteína 1,5 g/kg de `base`; `otra` (otra condición o tomo medicación) → aviso genérico de consulta previa. |
| 17 | `cribado_tca` | `'positivo' \| 'evitado' \| 'negativo' \| null` | — | — | `null` | No | **No expuesto por la UI desde la v1.1.** El paso 5b del wizard ha desaparecido (decisión A) y la conversión a `InputCalculo` escribe siempre `null`. La regla del motor se conserva y sigue siendo normativa —`positivo` y `evitado` añaden `'tca'` a `condiciones` en el paso 0—, pero es una **regla no expuesta**: hoy `'tca'` solo puede llegar en `condiciones` construyendo el input a mano (los vectores de la §5 lo hacen). Ver el recuadro "Reglas no expuestas" más abajo. |
| 18 | `fecha_inicio` | ISO date | — | fecha válida | hoy | No | Fechas del cronograma y semana 0 de la proyección. |
| 19 | `preferencia_base` | `'omnivoro' \| 'vegetariano' \| 'vegano' \| null` | — | — | `null` | No | **Base dietética excluyente** (paso 13 del wizard). `vegano` ×1,15 y `vegetariano` ×1,10 en proteína (digestibilidad/leucina) y baja `pct_cap` al 30 % con `kcal < 1 800`. Presente ⇒ manda sobre `preferencia`. |
| 20 | `restricciones` | `('sin_lactosa' \| 'sin_gluten')[] \| null` | — | — | `[]` | No | **Combinables** (varias a la vez). **No cambian ningún número**: solo filtran los alimentos de los menús, de las equivalencias y de la lista de la compra. Se leen solo si `preferencia_base` está presente. Se deduplican y se ordenan (`sin_lactosa` antes que `sin_gluten`). |
| 21 | `low_carb` | boolean | — | — | `false` | No | Interruptor "bajo en hidratos". Fija la grasa al 45 % (techo 50 %), baja `HC_min` a 75 g, cambia el suelo de fibra y desactiva el ajuste por somatotipo. `diabetes` lo anula (paso 6.8). Se lee solo si `preferencia_base` está presente. |
| 22 | `recomposicion_prioridad` | `'perder' \| 'equilibrado' \| 'ganar' \| null` | — | — | `'equilibrado'` | No | Subpregunta "¿Qué te importa más ahora?" del paso de objetivo, solo visible con `objetivo = 'recomposicion'`. Cambia el déficit de recomposición (paso 7) y el % de grasa (paso 9). `null`/ausente ≡ `'equilibrado'`, que es exactamente el comportamiento v1.0. Se ignora si `objetivo_efectivo` acaba siendo otro. |
| 23 | `menstruacion` | `'regular' \| 'irregular' \| 'ausente' \| 'no_dice' \| null` | — | — | `null` | No | Solo `sexo = 'mujer'`; en hombres el motor lo **ignora** (no es un error de validación). **No cambia macros**: la evidencia dice que el gasto varía poco a lo largo del ciclo. Su único efecto numérico es suavizar el ritmo `agresivo` a `moderado` con `irregular`/`ausente` **en un plan de `perder` o `recomposicion`** (paso 6.7bis) — y con el ritmo cambian las kcal del plan, así que el copy del paso 3b del wizard tiene que decirlo (`SPEC-ux-comidas-pdf.md` §1). Produce `INFO_CICLO` y `WARN_CICLO_AUSENTE`. |
| 24 | `plazo_semanas` | `number \| null` | semanas | 4–52, entero | `null` | No | **v1.2.** "Tengo una fecha en mente" del paso de ritmo. Solo se lee si `peso_objetivo !== null` **y** el objetivo intermedio del paso 6 es `perder` o `ganar`; en cualquier otro caso se ignora sin error. Elige el ritmo **discreto** más suave de la tabla 3.7/3.8 que llega a tiempo (paso 6.7ter) y produce `INFO_RITMO_POR_PLAZO` o `WARN_PLAZO_IRREAL`. Ausente o `null` ⇒ comportamiento idéntico al de la v1.1. |
| 25 | `sintomas_regla` | `SintomaRegla[] \| null` | — | — | `null` | No | **v1.2.** Subpregunta "¿Qué notas esos días?", solo visible con `menstruacion ∈ {regular, irregular}`. **No cambia ningún número**: su único efecto es `Resultado.ciclo` (paso 19). Se deduplica y se ordena al orden canónico del tipo. |
| 26 | `alimentos_excluidos` | `string[] \| null` | ids de `foods.json` | — | `[]` | No | **v1.2. El motor lo IGNORA por completo** (como `menu_sencillo`). Solo lo lee `src/meals`: ningún alimento de esta lista puede aparecer en el menú, en las alternativas, en las equivalencias ni en la lista de la compra (`SPEC-ux-comidas-pdf.md` §3.2b). |
| 27 | `alimentos_favoritos` | `string[] \| null` | ids de `foods.json` | — | `[]` | No | **v1.2. El motor lo IGNORA por completo.** El **orden es normativo** (es el orden en que los marcó el usuario) y fija la prioridad dentro de cada `FoodQuery` (§3.2b). Un id no puede estar a la vez en las dos listas: si llega en las dos, manda `alimentos_excluidos`. |

† **Excepción de la edad (única).** La edad no produce `ERR_INPUT_RANGO` entre 0 y 120: fuera de 0–120 es un error de formato del formulario; dentro de 0–120 el motor **sí se ejecuta** y es el paso 0 quien devuelve `{ excluido: 'EXCL_EDAD' }` si la edad está fuera de 18–75. Así el usuario recibe el copy compasivo de derivación en vez de un error de validación seco, y los casos 0.1/0.2 de la sección 5 son satisfacibles.

‡ **Rango de `grasa.valor`.** Se acepta 3–70 en el formulario, pero el paso 2 lo recorta a [4, 60] en hombres y [10, 60] en mujeres. Si el recorte altera el valor introducido, es obligatorio emitir `WARN_GRASA_FUERA_DE_RANGO` y mostrar en pantalla que el dato se ha ajustado: nunca se usa un valor distinto del introducido en silencio.

### 1.1 Preferencias: regla de traducción y regla inversa (normativo, v1.1)

El wizard v1.1 ya no pide **una** preferencia, sino una **base** excluyente más **restricciones** combinables más un **interruptor** de bajo en hidratos (decisión E). El motor sigue aceptando el campo antiguo, y por eso **ninguno de los 14 vectores de la §5 cambia**.

**Regla de traducción (paso 0, antes de cualquier otro cálculo).** Produce siempre el trío efectivo `(pref_base, restricciones, low_carb_pedido)`:

```
si preferencia_base es null o undefined:                       // formato antiguo
   pref_base       = (preferencia ∈ {omnivoro, vegetariano, vegano}) ? preferencia : 'omnivoro'
   restricciones   = (preferencia === 'sin_lactosa') ? ['sin_lactosa']
                   : (preferencia === 'sin_gluten')  ? ['sin_gluten'] : []
   low_carb_pedido = (preferencia === 'low_carb')
si no:                                                          // formato combinable
   pref_base       = preferencia_base                           // `preferencia` NO se lee
   restricciones   = ['sin_lactosa', 'sin_gluten'].filter(r => (restricciones ?? []).includes(r))
                                                                // deduplicadas y en orden canónico
   low_carb_pedido = (low_carb === true)
```

En el paso 6.8, `diabetes` anula el interruptor: `low_carb_efectivo = low_carb_pedido && 'diabetes' ∉ condiciones`.

**Regla inversa (`preferencia_efectiva`).** El resto del proyecto —el generador de menús, las equivalencias, el PDF— sigue leyendo un único valor `Preferencia`, que a partir de la v1.1 es el **banco de plantillas** que hay que usar:

```
preferencia_efectiva = low_carb_efectivo                 ? 'low_carb'
                     : pref_base === 'vegano'            ? 'vegano'
                     : pref_base === 'vegetariano'       ? 'vegetariano'
                     : restricciones incluye 'sin_gluten'? 'sin_gluten'
                     : restricciones incluye 'sin_lactosa'? 'sin_lactosa'
                     : 'omnivoro'
```

`sin_gluten` va **antes** que `sin_lactosa` porque su banco cambia la estructura de las plantillas (fuera el cereal con gluten), mientras que `sin_lactosa` solo intercambia variantes de lácteo y el filtro de alimentos lo resuelve por sí solo. Las restricciones que no dan nombre al banco **no se pierden**: `SPEC-ux-comidas-pdf.md` §3.2 obliga a filtrar por la base **y** por *todas* las restricciones, con `Resultado.restricciones`.

Comprobación de compatibilidad (invariante **S29d** del barrido): con el formato antiguo, `preferencia_efectiva` coincide siempre con lo que devolvía la v1.0 (`preferencia`, salvo `low_carb` + `diabetes` → `omnivoro`).

**Dónde entra cada pieza en los números:**

| Pieza | Efecto numérico |
|---|---|
| `pref_base = 'vegano'` | proteína ×1,15 (paso 8) · `pct_cap = 0,30` con `kcal < 1 800` · `INFO_VEGANO` |
| `pref_base = 'vegetariano'` | proteína ×1,10 (paso 8) · `pct_cap = 0,30` con `kcal < 1 800` |
| `low_carb_efectivo` | grasa 45 % y techo 50 % (paso 9) · `HC_min = 75` (paso 10) · suelo de fibra `max(20, 10 g/1 000 kcal)` (paso 11) · sin ajuste por somatotipo (paso 9) |
| `restricciones` | **ninguno**. Solo filtran alimentos (`SPEC-ux-comidas-pdf.md` §3.2 y §3.7.2) |

> **Reglas no expuestas (v1.1).** La decisión A retira del wizard el cribado del paso 5b. El motor **conserva sin cambios** las tres reglas que dependían de él, porque `'tca'` sigue siendo una `Condicion` válida y los vectores de la §5 la usan: (1) la normalización de `cribado_tca` a `condiciones` del paso 0; (2) `EXCL_TCA_RIESGO` y el forzado de `ritmo_ef = 'suave'` con `INFO_RITMO_SUAVE` (paso 6.7); (3) el filtro de avisos del paso 17 y la no publicación de `proyeccion` y de `limites_ajuste` (pasos 14 y 18). Lo que desaparece es todo lo que vivía en la capa de presentación: la UI y el PDF **ya no ocultan** el %grasa, el peso objetivo, el cronograma ni el bloque de referencias. En su lugar queda una línea fija en el disclaimer (`SPEC-ux-comidas-pdf.md` §2.10).

**Validación de dominio (obligatoria, produce `ERR_INPUT_RANGO`).** "Se validan antes de calcular" incluye los valores de los enumerados, no solo los rangos numéricos: `sexo`, `grasa.metodo`, `grasa.fuente`, `grasa.categoria`, `actividad_diaria`, `entrenamiento.tipo`, `entrenamiento.intensidad`, `entrenamiento.experiencia`, `entrenamiento.momento`, `objetivo`, `ritmo`, `preferencia`, cada elemento de `condiciones` y `cribado_tca` deben pertenecer al conjunto declarado en esta tabla; `n_comidas ∈ {2,3,4,5,6}`; los cinco campos nuevos de la v1.1 (`recomposicion_prioridad`, `menstruacion`, `preferencia_base`, `restricciones`, `low_carb`) **solo se validan si están presentes y no son `null`** —ausente o `null` es siempre válido— y entonces deben pertenecer a su dominio (`restricciones` debe además ser un array y `low_carb` un boolean); los cuatro campos nuevos de la v1.2 (`plazo_semanas`, `sintomas_regla`, `alimentos_excluidos`, `alimentos_favoritos`) siguen exactamente la misma regla —ausente o `null` es siempre válido— y, presentes, deben ser: `plazo_semanas` un entero entre 4 y 52; `sintomas_regla` un array cuyos elementos pertenezcan a `SintomaRegla`; `alimentos_excluidos` y `alimentos_favoritos`, arrays de cadenas (el motor **no** comprueba que los ids existan en `foods.json`: eso es cosa de `src/meals`, que simplemente descarta los que no conoce); `menstruacion` con `sexo = 'hombre'` **no es un error**: se valida el dominio y después se ignora; `edad`, `entrenamiento.dias_semana` y `entrenamiento.minutos_sesion` deben ser enteros; `fecha_inicio` debe cumplir `/^\d{4}-\d{2}-\d{2}$/` y ser una fecha real. El error devuelve el nombre del campo en `errores`. Sin estas comprobaciones un valor fuera de dominio no producía `ERR_INPUT_RANGO`: o lanzaba una excepción, o —peor— propagaba `NaN` hasta devolver un plan con `kcal = 202 440` y macros `NaN` (`objetivo: 'adelgazar'`). Los campos que el propio §1 declara ignorados con `tipo = 'ninguno'` (`dias_semana`, `minutos_sesion`, `intensidad`, `momento`) siguen sin validarse en ese caso.

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

Y se normalizan las **preferencias** con la regla de traducción de la §1.1, que deja fijados `pref_base`, `restricciones` y `low_carb_pedido` (el interruptor todavía sin la anulación por `diabetes`, que es del paso 6.8), y la **regla**: `menstruacion_ef = (sexo === 'mujer') ? (menstruacion ?? null) : null`.

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

7ter. PLAZO (v1.2, decisión H). **Se evalúa AQUÍ, lo primero del paso 7 y ANTES de cualquier
   suavizado de seguridad**: fija el ritmo de PARTIDA a partir de la fecha que ha pedido el
   usuario, y los suavizados de 6.7 (tca, edad ≥ 65) y 6.7bis (regla) se aplican después sobre
   él y MANDAN. (Se llama 6.7ter porque llegó después, no porque se ejecute después.)

   si plazo_semanas !== null y pobj !== null y obj ∈ {perder, ganar}:
      ritmo_req = |pobj − PC| / plazo_semanas                       // kg por semana que exige la fecha
      perder:  kg_sem(r) = tabla 3.7[banda][r] / 100 · PC
      ganar:   kg_sem(r) = clamp(sup_pct(r) · TDEE, 150, 500) · 7 / 7700
               con sup_pct(r) = (perfil !== 'fuerza') ? 0.05 : tabla 3.8[experiencia][r]
      ritmo_plazo = el PRIMER r de [suave, moderado, agresivo] con kg_sem(r) ≥ ritmo_req − 1e-9
      si existe  → ritmo_ef = ritmo_plazo;  emitir INFO_RITMO_POR_PLAZO
      si no      → ritmo_ef = ritmo_plazo = 'agresivo';  emitir WARN_PLAZO_IRREAL
   (el `ritmo` que eligió el usuario se descarta: ha pedido una fecha, y la fecha es más concreta
    que "moderado". La pantalla lo dice con todas las letras, `SPEC-ux-comidas-pdf.md` §1 paso 11.)

   **Las tres cosas que el plazo NO puede hacer**, y que el paso 17 reevalúa contra el plan final:
   (a) sobrevivir a un suavizado de seguridad —si `ritmo_efectivo !== ritmo_plazo`, la fecha ya no
   se alcanza y `INFO_RITMO_POR_PLAZO` se sustituye por `WARN_PLAZO_IRREAL`—; (b) sobrevivir al
   techo del paso 7 y a los suelos —si el cronograma del paso 14 sale con `semanas[0] > plazo_semanas`,
   misma sustitución—; (c) sobrevivir a una reconversión del objetivo —si `objetivo_efectivo ∉
   {perder, ganar}`, los dos avisos se retiran, porque hablan de una meta de peso que ya no existe—.
   Los tres casos se resuelven en el paso 17, contra los números finales, exactamente como
   `WARN_PERDIDA_MAYOR_65`.

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

7bis. REGLA (solo mujeres, decisión D). Es el ÚNICO efecto numérico de `menstruacion`:
   si menstruacion_ef ∈ {irregular, ausente} y obj ∈ {perder, recomposicion} y ritmo_ef === 'agresivo'
        → ritmo_ef = 'moderado'
   (La guarda `obj ∈ {perder, recomposicion}` es obligatoria. El motivo de la regla es la baja
    disponibilidad energética (RED-S), y ahí el remedio es comer MÁS: recortar el superávit de una mujer
    con amenorrea —o con menopausia, que la UI mete dentro de «no la tengo»— que pide ganar músculo iba
    en dirección contraria a su propio motivo, y le quitaba 100-150 kcal/día. `ganar` es además el único
    objetivo final que garantiza que el paso 6 tampoco lo vio como déficit: los pasos 7 y 10bis solo
    reescriben HACIA `mantener`.)
   (el aviso WARN_CICLO_AUSENTE NO se emite aquí: su condición incluye `objetivo_efectivo === 'perder'`,
    que los pasos 7 y 10bis todavía pueden reescribir, así que se evalúa entera en el paso 17 —contra el
    objetivo FINAL y contra el ritmo ELEGIDO por el usuario, no contra `ritmo_ef`, que ya viene suavizado.)

8. low_carb_efectivo = low_carb_pedido
   si 'diabetes' ∈ condiciones y low_carb_efectivo === true
        → low_carb_efectivo = false; WARN_LOWCARB_DIABETES
   preferencia_efectiva = regla inversa de la §1.1 sobre (pref_base, restricciones, low_carb_efectivo)
   (a partir de aquí, todo el documento usa `low_carb_efectivo` donde decía `preferencia === 'low_carb'`
    y `pref_base` donde decía `preferencia === 'vegano' / 'vegetariano'`)
   Además se publican en `Resultado` los tres campos efectivos (`preferencia_base`, `restricciones`,
   `low_carb`): el generador de menús necesita las restricciones, que la regla inversa no siempre nombra.

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
   prioridad = recomposicion_prioridad ?? 'equilibrado'
   d = tabla 3.9[banda]                                       // déficit leve por banda de grasa
   si prioridad === 'perder' → d = min(d + 0.05, 0.15);  INFO_RECOMP_PRIORIDAD_PERDER
   si prioridad === 'ganar'  → d = 0;                    INFO_RECOMP_PRIORIDAD_GANAR
   kcal_calc = TDEE · (1 − d)

mantener:
   kcal_calc = TDEE
```

**Prioridad de recomposición (decisión C).** Mucha gente dice "recomposición" queriendo decir "perder sin decirlo", y otra tanta queriendo decir "ganar músculo sin engordar". La subpregunta del wizard resuelve la ambigüedad sin inventar un objetivo nuevo: `perder` aprieta el déficit **5 puntos porcentuales**, con tope duro del 15 % del TDEE (el techo del 25/30 % del paso 7 sigue siendo el límite absoluto, pero nunca llega a morder aquí), y sube la grasa 5 puntos en el paso 9 a costa de los hidratos; `ganar` deja el déficit en **cero**. Con `equilibrado` —el valor por defecto y el único que puede llegar cuando el objetivo lo resolvió el motor— la tabla 3.9 se aplica tal cual y **no cambia ni un número de la v1.0**.

**Exención de la regla de margen para `prioridad === 'ganar'`** (normativa, se aplica en este paso y en el 10bis):

```
recomp_sin_deficit = (objetivo_efectivo === 'recomposicion' y prioridad === 'ganar')
si recomp_sin_deficit → la regla de margen NO se evalúa: el plan sigue etiquetado `recomposicion`
                        con kcal ≈ TDEE, y no se emite WARN_SIN_MARGEN_DEFICIT
```

Sin la exención, quien pide recomposición priorizando ganar músculo recibía un plan etiquetado `mantener` y un aviso que le decía literalmente "no podemos proponerte un déficit", cuando cero déficit es exactamente lo que ha pedido. El invariante **S24b** (recomposición ⇒ `TDEE − kcal ≥ 50`) se restringe a `prioridad !== 'ganar'`.

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

si NO recomp_sin_deficit y objetivo_efectivo ∈ {perder, recomposicion} y kcal ≥ TDEE − 50:
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
si pref_base === 'vegano'      → gkg = gkg · 1.15       // la BASE dietética, no el banco: un usuario
si pref_base === 'vegetariano' → gkg = gkg · 1.10       // vegano + bajo en hidratos sigue siendo vegano
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
pct_cap = (pref_base ∈ {vegano, vegetariano} y kcal < 1800) ? 0.30 : 0.35
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
pct_grasa = low_carb_efectivo           ? 0.45
          : objetivo_efectivo === 'perder' ? (ritmo_ef === 'agresivo' ? 0.25 : 0.28)
          : objetivo_efectivo === 'recomposicion' ? (prioridad === 'perder' ? 0.33 : 0.28)
          : objetivo_efectivo === 'mantener' ? 0.32
          : 0.27                                                         // ganar
suelo_gkg = hombre ? 0.7 : 0.8
suelo_g   = max(suelo_gkg · base, 0.20 · kcal / 9)                       // base = PC o PA (paso 8)
techo_g   = (low_carb_efectivo ? 0.50 : 0.40) · kcal / 9

// Suelo y techo pueden cruzarse en planes muy bajos en kcal: la conclusión correcta no es
// forzar la grasa por encima de su techo, sino que faltan calorías para cuadrar los macros.
// Y no basta con que la franja exista: como la grasa se prescribe redondeada a 5 g, tiene que
// CONTENER algún múltiplo de 5, es decir `roundUp5(suelo_g) ≤ techo_g`. Si no lo contiene, el
// redondeo dirigido de más abajo acaba devolviendo `roundDown5(techo_g)`, por debajo del suelo.
mientras roundUp5(suelo_g) > techo_g:                                    // incluye suelo_g > techo_g
   kcal = roundUp10(roundUp5(suelo_g) · 9 / (low_carb_efectivo ? 0.50 : 0.40))
   WARN_KCAL_INSUFICIENTES_PARA_MACROS
   recalcular suelo_g y techo_g con las kcal nuevas (y P_cap del paso 8; si P > P_cap → P = roundDown5(P_cap))
   // converge en dos vueltas como mucho: si el suelo lo fija el 20 % de las kcal, la franja mide
   // 0,20 · kcal / 9 ≥ 5 g y entonces siempre contiene un múltiplo de 5

G0        = clamp(pct_grasa · kcal / 9, suelo_g, techo_g)

// Ajuste por somatotipo (heurística de preferencia, calóricamente neutro)
soma  = clasificarSomatotipo(somatotipo)          // tabla 3.2; null → 'mesomorfo'
delta = 0.10 · (kcal − 4 · P) / 9                 // 10 % de las kcal no proteicas, en g de grasa
si NO low_carb_efectivo y soma === 'endomorfo' → G1 = min(G0 + delta, techo_g); INFO_SOMATOTIPO
si NO low_carb_efectivo y soma === 'ectomorfo' → G1 = max(G0 − delta, suelo_g); INFO_SOMATOTIPO
si no                                                → G1 = G0
G = round5(G1)
si G < suelo_g → G = roundUp5(suelo_g)              // el redondeo nunca deja la grasa bajo el suelo
si G > techo_g → G = roundDown5(techo_g)            // ni por encima del techo del 40 % (50 % low-carb)
```

El orden importa: primero se garantiza el suelo y después el techo. El invariante `suelo_g ≤ G ≤ techo_g` se cumple **siempre** (invariantes **S7c** y **S7d** del barrido) precisamente porque el bloque anterior garantiza antes que la franja contenga un múltiplo de 5 g: con la condición antigua (`si suelo_g > techo_g`) había 56 perfiles válidos en los que `roundUp5(suelo_g)` superaba el techo, la segunda línea devolvía `roundDown5(techo_g)` y la grasa acababa hasta 2 g por debajo de su suelo obligatorio sin emitir ningún aviso. Con el redondeo anterior (`G = G + 5`) la grasa podía acabar en el 41,5 % de las kcal, por encima del techo que la §3.1 declara como constante global.

### Paso 10 — Hidratos de carbono (resto) y factibilidad

```
HC_min = low_carb_efectivo ? 75 : 130       // RDA IOM 130 g; 75 g solo en low-carb declarado
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
si NO recomp_sin_deficit y objetivo_efectivo ∈ {perder, recomposicion} y kcal ≥ TDEE − 50:
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
suelo_fibra = low_carb_efectivo ? max(20, 10 · kcal / 1000) : min(25, 0.15 · HC)
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

mantener / recomposicion SIN déficit real:
   sugerido_central = round05(PC)                        (metodo 'actual')
   sugerido_rango   = [round05(min(lo, PC)), round05(max(hi, PC))]   // la franja por %grasa se ensancha
                                                                    // hasta contener el peso actual
   mostrar_central  = true
   peso_obj_ef = null

recomposicion CON déficit real (v1.2, decisión H):
   recomp_con_deficit = (objetivo_efectivo === 'recomposicion' y TDEE − kcal ≥ 50)
   // se evalúa aquí y no en el paso 7 porque `kcal` no está cerrada hasta el 10bis
   meta_cand = (pobj === null) ? sugerido_central : pobj
   si PC − meta_cand < 0.5 → rama `mantener / recomposicion SIN déficit` TAL CUAL (no hay meta que dar)
   si no                   → rama `perder` LITERAL: mismos suelos (`imc_min`/`min185` y el suelo por
                             `g_min` de grasa esencial), mismos avisos (WARN_OBJETIVO_IMC_BAJO,
                             WARN_OBJETIVO_GRASA_MUY_BAJA, WARN_OBJETIVO_MUY_LEJANO), mismo `hito`,
                             mismo redondeo dirigido y `metodo = 'grasa'`
```

**Por qué la recomposición tiene ahora peso objetivo (decisión H).** Una usuaria de 68 kg que pide
recomposición con prioridad `perder` lleva un déficit real de 250-300 kcal/día y recibía como "peso
objetivo" su propio peso actual y una proyección plana: el informe le decía a la vez "te hemos apretado
el déficit" y "no esperes que la báscula se mueva". Las dos cosas no pueden ser verdad. Con la regla de
arriba, la recomposición **con déficit** propone y valida la meta exactamente igual que `perder` —los
suelos de seguridad son los mismos, y son los que importan— y el paso 14 dibuja la banda honesta. Lo
que **no** cambia: el cronograma sigue siendo `null` (en recomposición no se promete fecha,
`INFO_SIN_CRONOGRAMA`) y las calorías siguen saliendo de la tabla 3.9, no del peso objetivo.

**La comprobación `PC − meta_cand ≥ 0.5` va ANTES de ejecutar la rama**, no después: si se ejecutara
primero y se descartara luego, el informe se llevaría avisos (`WARN_OBJETIVO_MUY_LEJANO`,
`WARN_OBJETIVO_GRASA_MUY_BAJA`) sobre una meta que no se le enseña a nadie. Con prioridad `ganar`
—`recomp_sin_deficit`, `kcal ≈ TDEE`— nunca se llega aquí: `TDEE − kcal < 50`.

**Invariantes del paso 13** (comprobados en los tests para todos los perfiles válidos):

- `sugerido_rango[0] ≤ sugerido_central ≤ sugerido_rango[1]` siempre (nunca un rango invertido ni un valor central fuera de su propio rango).
- En la rama `ganar` con `pobj === null`, `peso_obj_ef === sugerido_central`: el informe enseña **una sola** cifra de peso objetivo, no un "sugerido" y un "efectivo" distintos.
- En la rama `ganar`, si `PC / h² ≤ 27.5` entonces `sugerido_rango[1] / h² ≤ 27.5` y `sugerido_central / h² ≤ 27.5`: el techo de IMC 27,5 que la §3.1 declara como "peso objetivo máximo" se aplica al peso **sugerido** y a su franja, no solo a `peso_obj_ef`. Sin esto la pantalla y el PDF mostraban una franja por encima del máximo que la propia app acababa de imponer (hombre de 175 cm y 80 kg: sugerido 85,5 kg = IMC 27,9 frente a un efectivo de 84,0 kg) y dos "pesos objetivo" distintos en la misma página. Cuando el peso actual ya supera IMC 27,5 el techo no se aplica: bajar la franja por debajo del peso de partida en un plan de ganancia sería peor que no acotarla.
- El redondeo a 0,5 kg **nunca cruza un límite activo**: cuando el peso objetivo (o el extremo inferior de la franja) toca `min185` o el suelo por `g_min` se usa `roundUp05`, y cuando toca el techo de IMC 27,5 de la rama `ganar`, `roundDown05`. Con `round05` a secas un objetivo de 58,62 kg (IMC 18,5 en una mujer de 178 cm) se imprimía como 58,5 kg, es decir, medio kilo por debajo del suelo que la propia app acababa de imponer.
- `peso_obj_ef === null` o `peso_obj_ef / h² ≥ imc_min` — la rama `ganar` valida el objetivo por abajo igual que la rama `perder`, y ninguna de las dos acepta como meta un peso de bajo peso.
- `g_min` (suelo de %grasa de un peso objetivo) nunca es menor que el límite superior de la banda `muy_bajo`. Los 8 % / 16 % anteriores contradecían frontalmente al paso 6, que se niega a poner en déficit a quien ya está en esa banda: la app no dejaba adelgazar a una mujer con 21 % de grasa y a la vez le fijaba como meta un peso del 16 %.
- Las fórmulas clásicas (`clasicas`) solo se calculan entre 150 y 200 cm; fuera de ese intervalo son lineales sin dominio de validez y devuelven pesos de 24–35 kg. `clasicas === null` → el bloque "otros métodos" no se muestra.

### Paso 14 — Cronograma y proyección

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

#### Paso 14b — Proyección semana a semana (decisión F, normativo)

El cronograma dice *cuándo* se llega; la proyección dice *por dónde se pasa*. Se calcula **siempre** (también sin cronograma) y se publica en `Resultado.proyeccion`, un array de `{ semana, peso_min, peso_esp, peso_max }` con `semana` correlativa desde 0 y los tres pesos en kg redondeados con `round1`.

**Con cronograma** (es decir, en el bloque donde se acaba de construir `cronograma`, con `ritmo_kg_sem`, `factor_adapt`, `diet_breaks`, `delta_kg` y `semanas` ya calculados):

```
S = min(semanas[1], 26)                                     // tope duro de 26 semanas
para s = 0 .. S:
   descansos = (diet_breaks > 0) ? min(diet_breaks, floor(s / 9)) : 0   // 8 sem de dieta + 1 de descanso
   s_ef      = max(0, s − descansos)                        // semanas de déficit/superávit reales
   f(s_ef)   = 1 + 0.25 · min(s_ef / 26, 2)                 // MISMA adaptación creciente del cronograma
   rapido = min(ritmo_kg_sem · s_ef, delta_kg)                                   // regla lineal 7 700
   lento  = min(ritmo_kg_sem · s_ef / factor_adapt, delta_kg)                    // adaptación del cronograma
   esp    = min(ritmo_kg_sem · s_ef / min(f(s_ef), factor_adapt), delta_kg)      // curva central

   perder: { semana: s, peso_min: round1(PC − rapido), peso_esp: round1(PC − esp), peso_max: round1(PC − lento) }
   ganar:  { semana: s, peso_min: round1(PC + lento),  peso_esp: round1(PC + esp), peso_max: round1(PC + rapido) }
```

**Por qué estas tres curvas.** Los dos extremos de la banda **son** los dos extremos del cronograma, no una franja inventada: `rapido` alcanza `delta_kg` en `sem_lineal` (el extremo optimista, `semanas[0]`) y `lento` lo alcanza en `sem_lineal · factor_adapt` (el pesimista, `semanas[1]`). Así la gráfica y la frase "entre X e Y semanas" no pueden contradecirse. La curva central usa el factor de adaptación **creciente** `f(s)` —×1,00 en la semana 0, ×1,25 en la 26— acotado por `factor_adapt` para que nunca se salga de su propia banda; `min(f, factor_adapt)` es exactamente ese clamp escrito de forma cerrada. El `min(·, delta_kg)` impide que la curva sobrepase la meta, y el descuento por `descansos` refleja que una semana a mantenimiento no mueve el peso: por eso la curva del caso 15 se aplana en las semanas 9 y 18 y aterriza en 68,0 kg exactamente en la semana 22 = `semanas[1]`.

**Sin cronograma** (`mantener`, `recomposicion`, `peso_obj_ef === null` o cualquiera de los cortes de este paso):

```
para s = 0 .. 12:
   banda = (s === 0) ? 0 : 1                                // ±1 kg de oscilación normal
   { semana: s, peso_min: round1(PC − banda), peso_esp: round1(PC), peso_max: round1(PC + banda) }
emitir INFO_PROYECCION_PLANA
```

**Recomposición con déficit real (v1.2, decisión H).** Sustituye a la proyección plana cuando se
cumplen las cuatro condiciones: `objetivo_efectivo === 'recomposicion'`, `TDEE − kcal ≥ 50`,
`peso_obj_ef !== null` y `PC − peso_obj_ef ≥ 0,5`. **El cronograma sigue siendo `null`** y se sigue
emitiendo `INFO_SIN_CRONOGRAMA`: lo único que cambia es la curva.

```
delta_kcal   = TDEE − kcal
delta_kg     = PC − peso_obj_ef
ritmo_kg_sem = delta_kcal · 7 / 7700
si ritmo_kg_sem < 0.05 → proyección PLANA (e INFO_PROYECCION_PLANA); parar
sem_lineal   = delta_kg / ritmo_kg_sem
S            = clamp(ceil(sem_lineal), 12, 26)      // nunca menos de 12 (los hitos) ni más de 26
para s = 0 .. S:
   rapido = min(ritmo_kg_sem · s, delta_kg)         // MISMA regla lineal de 7 700 que el peso_min de `perder`
   min    = PC − rapido                             // borde inferior: la curva del déficit
   max    = PC                                      // borde superior: todo lo que pierdes de grasa lo compensa el músculo
   esp    = (min + max) / 2                         // esperado: el punto medio
   { semana: s, peso_min: round1(min), peso_esp: round1(esp), peso_max: round1(max) }
emitir INFO_PROYECCION_RECOMP (y NO INFO_PROYECCION_PLANA: son excluyentes, ver §4)
```

**Por qué esta banda y no otra.** Los dos bordes son las dos cosas que de verdad pueden pasar, y las dos
son un buen resultado: por abajo, que todo lo que pierdas sea grasa y la báscula lo marque entero (la
misma curva lineal que se le promete a quien está en `perder`); por arriba, que ganes en músculo
exactamente lo que pierdes en grasa y la báscula no se mueva. El punto medio no es un pronóstico
afinado: es literalmente el centro de esa horquilla, y el copy no lo disfraza de otra cosa. Sin fecha,
porque no la hay: la recomposición no tiene un día de llegada que podamos calcular con esta aritmética.

**Invariantes de la proyección de recomposición** (familia **S31** del barrido): `peso_max` es
`round1(PC)` en todos los puntos; `peso_min` es exactamente la curva del déficit acotada por la meta;
la curva nunca baja de `peso_obj_ef`; `peso_min` y `peso_esp` son monótonas no crecientes; hay al menos
13 puntos (semanas 0-12) y como mucho 27 (0-26); y `cronograma === null` siempre. **S31h** obliga a la
inversa: toda recomposición que cumpla las cuatro condiciones tiene su curva.

**Hitos.** Los "hitos a 4, 8 y 12 semanas" que pintan la pantalla y el PDF son literalmente las entradas con `semana ∈ {4, 8, 12}` de este array; no hay ningún campo adicional ni ningún cálculo extra en la capa de presentación.

**Regla no expuesta:** con `'tca' ∈ condiciones`, `proyeccion` queda `undefined` y `INFO_PROYECCION_PLANA` (o `INFO_PROYECCION_RECOMP`) se retira en el filtro del paso 17, por el mismo motivo que se retiran los avisos de cronograma.

**Invariantes de la proyección** (familia **S26** del barrido): la semana 0 es siempre `round1(PC)` en los tres valores; `peso_min ≤ peso_esp ≤ peso_max`; las semanas son correlativas desde 0; con cronograma la curva es **monótona hacia el objetivo** (no sube nunca en `perder` ni baja nunca en `ganar`) y no lo sobrepasa; nunca pasa de la semana 26; sin cronograma se emite `INFO_PROYECCION_PLANA`.

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
pref_base === 'vegano' → INFO_VEGANO
FFMI_norm ≥ (hombre ? 22 : 19) y IMC ≥ 25 y banda ∈ {muy_bajo, bajo, medio} → INFO_IMC_MUSCULADO
grasa_fiabilidad === 'baja' → INFO_GRASA_ESTIMADA
perfil !== 'sedentario' y dias · minutos_sesion / 60 > 10 → INFO_ALTO_RENDIMIENTO
kcal < (hombre ? 1800 : 1500) → INFO_MICRONUTRIENTES

REGLA (decisión D; `menstruacion_ef` es el del paso 0, ya `null` en hombres):
menstruacion_ef ∈ {regular, irregular} → INFO_CICLO
menstruacion_ef ∈ {irregular, ausente} y (objetivo_efectivo === 'perder'
                                          o banda ∈ {muy_bajo, bajo}
                                          o ritmo === 'agresivo')  → WARN_CICLO_AUSENTE
```

Los dos avisos de la regla se evalúan **aquí y no en el paso 6** por dos motivos: `objetivo_efectivo` ya no puede cambiar (los pasos 7 y 10bis han terminado), así que la condición que declara la §4 es literalmente cierta y comprobable; y la tercera cláusula mira el `ritmo` **elegido por el usuario**, no `ritmo_ef`, porque el paso 6.7bis puede haberlo suavizado ya y entonces la condición se autodestruiría. `INFO_CICLO` y `WARN_CICLO_AUSENTE` pueden coexistir (regla irregular en déficit): la tarjeta informativa y el aviso de seguridad dicen cosas distintas.

**Reevaluación contra `objetivo_efectivo`** (los avisos del paso 6 se emitieron contra el objetivo
intermedio, que el paso 7 todavía podía reescribir):

```
si objetivo_efectivo !== 'perder'        → eliminar WARN_PERDIDA_MAYOR_65
si objetivo_efectivo !== 'recomposicion' → eliminar INFO_RECOMP_PRIORIDAD_PERDER
                                                    INFO_RECOMP_PRIORIDAD_GANAR

REGLA (v1.2, recomposición con déficit): en recomposición el peso objetivo puede SÍ usarse
si objetivo_efectivo === 'recomposicion' y peso_obj_ef !== null → eliminar INFO_OBJETIVO_IGNORADO
   (el aviso afirma que "el peso objetivo no se usa"; con la proyección del paso 14 sí se usa,
    como meta de la curva. Las calorías siguen saliendo de la tabla 3.9, y eso lo explica
    INFO_PROYECCION_RECOMP.)

REGLA (v1.2, PLAZO): los dos avisos del paso 6.7ter se reevalúan contra el plan FINAL
si plazo_semanas === null o pobj === null o objetivo_efectivo ∉ {perder, ganar}:
      eliminar INFO_RITMO_POR_PLAZO y WARN_PLAZO_IRREAL
si no, si ritmo_efectivo !== ritmo_plazo   (un suavizado de seguridad ha bajado el ritmo)
     o (cronograma !== null y cronograma.semanas[0] > plazo_semanas):
      eliminar INFO_RITMO_POR_PLAZO; emitir WARN_PLAZO_IRREAL (si no estaba)
```

La segunda línea es la misma idea que la primera: el paso 10bis puede reescribir `objetivo_efectivo` a
`mantener` después de que el paso 7 haya emitido la prioridad de recomposición. Cuando eso pasa,
`Resultado.recomposicion_prioridad` **no se publica** (solo existe en recomposición), así que el informe
quedaba diciendo "hemos apretado un poco el déficit" sobre un plan de mantenimiento y sin ningún campo que
lo respaldara: pantalla y PDF se contradecían.

**Filtro de protección del cribado TCA** (se aplica al final, después de la tabla de supresión del paso 6):

```
si 'tca' ∈ condiciones → eliminar de `avisos`, si estuvieran:
   INFO_GRASA_ESTIMADA, INFO_PESO_YA_MINIMO, INFO_IMC_MUSCULADO, INFO_ADAPTACION,
   WARN_YA_MAGRO, WARN_YA_EN_OBJETIVO, WARN_OBJETIVO_MUY_LEJANO, WARN_CRONOGRAMA_LARGO,
   INFO_SIN_CRONOGRAMA, INFO_SIN_CRONOGRAMA_SIN_MARGEN,
   INFO_CRONOGRAMA_NO_ESTIMABLE, INFO_CRONOGRAMA_FUERA_DE_HORIZONTE,
   INFO_PROYECCION_PLANA,
   INFO_PROYECCION_RECOMP, INFO_RITMO_POR_PLAZO, WARN_PLAZO_IRREAL      // v1.2
```

Los tres códigos de la v1.2 entran en la lista por el mismo motivo que el resto: `INFO_PROYECCION_RECOMP`
describe una curva de peso que con `'tca'` no se publica (`proyeccion` queda `undefined`), y los dos del
plazo hablan de un ritmo y de una fecha para una meta de peso justo en el informe donde el motor ha
forzado el ritmo más suave y emite `INFO_RITMO_SUAVE` sin nombrar la causa: "hemos puesto el ritmo más
rápido de nuestra tabla" al lado de "hemos elegido el planteamiento más sostenible" es una contradicción
por escrito.

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

### Paso 18 — Ajuste manual de macros (decisión B, normativo)

No lo ejecuta `calcular`. Es una función exportada aparte:

```ts
export function ajustarMacros(resultado: Resultado, ajuste: { kcal?: number; hc_g?: number }): Resultado
```

**Qué resuelve.** Una mujer en recomposición y bajo en hidratos seguía viendo más hidratos de los que come. El panel "Ajusta tus macros" (`SPEC-ux-comidas-pdf.md` §2.2b) le deja mover dos palancas —los **hidratos en gramos** y las **calorías**— dentro de límites que el motor publica, y rehace todo lo derivado. **La proteína no se toca nunca**, porque en déficit es la que preserva la masa magra (Helms 2014, Longland 2016); es la misma razón por la que el orden de sacrificio del paso 10 la deja para el final.

**Autonomía respecto de `Inputs` (por qué la firma tiene dos argumentos).** Todo lo que hace falta viaja en `Resultado.limites_ajuste`, que el motor rellena siempre en el paso 18 —también cuando el usuario no ajusta nada— salvo con `'tca' ∈ condiciones`, donde queda `undefined` y **no hay panel de ajuste**:

```
suelo_ea_aj = (banda === 'muy_alto' ? 25 : 30) · MLG + ejercicio_dia
suelo_aj    = (objetivo_efectivo ∈ {perder, recomposicion}) ? max(suelo_sexo, BMR, suelo_ea_aj) : suelo_sexo

perder:  kcal_min = roundUp10(suelo_aj)                      kcal_max = round10(TDEE)
resto:   kcal_min = max(roundUp10(suelo_aj), round10(0.80 · kcal))
                                                             kcal_max = round10(1.20 · kcal)

kcal_min = min(kcal_min, kcal);  kcal_max = max(kcal_max, kcal)   // el plan recomendado SIEMPRE cabe
si kcal_max < kcal_min → kcal_max = kcal_min

limites_ajuste = {
  kcal_recomendada: kcal, hc_recomendado_g: HC, grasa_recomendada_g: G,
  kcal_min, kcal_max, kcal_paso: 50,
  hc_min_ui_g: 30, hc_min_motor_g: HC_min,          // 130, o 75 con low_carb_efectivo
  suelo_grasa_abs_g: suelo_gkg · base,              // la parte del suelo del paso 9 que no depende de kcal
  peso_kg: PC, fecha_inicio,
  kcal_micronutrientes: hombre ? 1800 : 1500,
}
```

La línea `kcal_min = min(kcal_min, kcal)` es obligatoria: el `round10` del paso 7 puede dejar el plan hasta 5 kcal por debajo del suelo cuando el suelo no llegó a activarse, y sin ella el propio plan recomendado quedaba fuera de su rango de ajuste (476 casos del barrido).

**El algoritmo (en este orden exacto):**

```
si resultado.excluido o limites_ajuste === undefined → devolver `resultado` tal cual
L = limites_ajuste;  P = macros.proteina_g;  TDEE = tdee.valor;  obje = objetivo_efectivo;  PC = L.peso_kg

1. CALORÍAS
   kcal_pedidas = ajuste.kcal ?? L.kcal_recomendada
   kcal = clamp(round10(kcal_pedidas), L.kcal_min, L.kcal_max)

2. HIDRATOS
   suelo_g     = max(L.suelo_grasa_abs_g, 0.20 · kcal / 9)           // el suelo del paso 9, recalculado
   suelo_red_g = roundUp5(suelo_g)                                   // el valor que el punto 3 pone en G
   hc_max  = roundDown5((kcal − 4·P − 9·suelo_red_g) / 4)            // lo que deja el suelo de GRASA
   // El techo se calcula contra el suelo YA REDONDEADO. Contra el suelo exacto, el `roundUp5` del
   // punto 3 podía subir la grasa hasta 5 g (45 kcal) por encima de lo que el techo había previsto y
   // el cierre se salía del 2 % con kcal bajas: el panel lanzaba en posiciones que el usuario alcanza
   // pulsando cuatro veces «−50 kcal» (perfil base de la §5: mujer 30 a, 165 cm, 70 kg, perder
   // moderado; P = 125 g, kcal_min = 1 430, hc = 105 g). Con el techo así, `G ≥ suelo_red_g` siempre y
   // la única desviación del cierre es el redondeo a 5 g de la propia grasa (≤ 22,5 kcal).
   si kcal === L.kcal_recomendada → hc_max = max(hc_max, L.hc_recomendado_g)
   hc_lo   = min(30, hc_max)                                         // el suelo de grasa manda sobre los 30 g
   hc_pedidos = ajuste.hc_g ?? L.hc_recomendado_g
   HC = clamp(round5(hc_pedidos), hc_lo, hc_max)

3. GRASA (el resto)
   cambia_kcal = (kcal !== L.kcal_recomendada);  cambia_hc = (HC !== L.hc_recomendado_g)
   si NO cambia_kcal y NO cambia_hc → G = L.grasa_recomendada_g      // restitución EXACTA
   si no:
      G = round5((kcal − 4·P − 4·HC) / 9)
      si G < suelo_red_g → G = suelo_red_g                           // red de seguridad; con el techo
                                                                     // del punto 2 no llega a saltar
   kcal_cierre = 4·P + 4·HC + 9·G
   afirmar |kcal_cierre − kcal| ≤ 0.02 · kcal                        // si falla, lanzar excepción

4. DERIVADOS
   pct = { p: 4P/kcal, g: 9G/kcal, hc: 4HC/kcal };  gkg = { p: P/PC, g: G/PC, hc: HC/PC }
   fibra y azucares_libres_max: paso 11 completo con las kcal y los HC nuevos
   cronograma y proyeccion: paso 14 completo con las kcal nuevas (misma meta `peso_objetivo.efectivo`)
   comidas: paso 16 completo, con el MISMO vector de % (`comidas[i].pct_kcal`) y la MISMA comida peri
            (`comidas[i].peri`). `P_i` no cambia, así que WARN_PROTEINA_POR_TOMA y
            WARN_PROTEINA_TOMA_ALTA tampoco.

5. AVISOS
   se parte de `resultado.avisos` y se RETIRAN, para reevaluarlos:
      INFO_AJUSTE_MANUAL, WARN_HC_BAJO_MINIMO, WARN_KCAL_AJUSTE_ALTA,
      INFO_ADAPTACION, WARN_CRONOGRAMA_LARGO, INFO_SIN_CRONOGRAMA, INFO_SIN_CRONOGRAMA_SIN_MARGEN,
      INFO_CRONOGRAMA_NO_ESTIMABLE, INFO_CRONOGRAMA_FUERA_DE_HORIZONTE, INFO_PROYECCION_PLANA,
      INFO_FIBRA_AJUSTADA, INFO_MICRONUTRIENTES, WARN_DEFICIT_MINIMO
   se vuelven a emitir los que correspondan (paso 11, paso 14) y además:
      si cambia_kcal o cambia_hc                       → INFO_AJUSTE_MANUAL
      si HC < L.hc_min_motor_g                         → WARN_HC_BAJO_MINIMO
      si cambia_kcal y obje === 'perder' y TDEE − kcal < 100  → WARN_KCAL_AJUSTE_ALTA
      // La guarda `cambia_kcal` es obligatoria. Sin ella, en cualquier plan de perder cuyo déficit
      // recomendado ya esté entre 50 y 99 kcal el aviso salía con el ajuste VACÍO —y por la tabla de
      // supresión borraba el WARN_DEFICIT_MINIMO honesto del motor—, rompiendo S27m y acusando al
      // usuario de unas calorías que no había puesto justo al mover solo el deslizador de hidratos.
      si obje === 'perder' y 50 ≤ TDEE − kcal < 100    → WARN_DEFICIT_MINIMO
      si kcal < L.kcal_micronutrientes                 → INFO_MICRONUTRIENTES
   se aplica entera la tabla de supresión del paso 6 (WARN_KCAL_AJUSTE_ALTA suprime WARN_DEFICIT_MINIMO)

6. SALIDA
   el resto de campos se copia TAL CUAL, `limites_ajuste` incluido: no se toca `peso_objetivo`,
   ni `agua`, ni `ffmi`, ni `grasa`, ni `tdee`, ni `objetivo_efectivo`.
   ajuste = { kcal: cambia_kcal, hc: cambia_hc }; si los dos son false, el campo `ajuste` NO se escribe.
```

**Reglas de diseño que hay que respetar y son comprobables:**

- **`ajustarMacros` nunca lee `macros.grasa_g` ni `macros.hc_g` del resultado que recibe**, solo `macros.proteina_g` (que el ajuste no cambia) y los tres valores recomendados de `limites_ajuste`. De ahí que sea **idempotente respecto al origen**: `ajustarMacros(ajustarMacros(R, a₁), a₂)` da exactamente lo mismo que `ajustarMacros(R, a₂)`, y `ajustarMacros(R, {})` devuelve el plan recomendado **bit a bit** (invariantes **S27l** y **S27m**). Eso es lo que hace trivial el botón "Volver a lo recomendado" y lo que permite guardar en `localStorage` solo el `ajuste`, no el plan entero.
- **El techo de grasa del paso 9 (40 % / 50 % de las kcal) NO se aplica aquí, el suelo sí.** Es deliberado: bajar los hidratos a 30 g con proteína fija empuja la grasa muy por encima del 40 %, y bloquearlo dejaría el deslizador sin recorrido justo para el perfil que motivó la decisión B. El suelo de grasa, en cambio, es inviolable (invariante **S27d**), y por eso es él quien fija `hc_max` y quien gana sobre el mínimo de 30 g cuando los dos entran en conflicto.
- **Bajar de `HC_min` no bloquea: avisa.** `WARN_HC_BAJO_MINIMO` es un `aviso`, no un corte. El usuario ha pedido explícitamente comer menos hidratos.
- **Tolerancia del cierre.** En un plan ajustado los hidratos los fija el usuario y **el único macro que se redondea a 5 g es la grasa**: el desajuste máximo es por tanto `9 · 2,5 = 22,5 kcal` (frente a los 10 kcal del plan recomendado). Es una cota medida, no estimada: el barrido exhaustivo del rectángulo (kcal, HC) que el panel puede alcanzar no encuentra ninguna desviación mayor, y el `roundUp5` del suelo de grasa ya no puede añadir nada porque el techo de hidratos del punto 2 se calcula contra ese suelo redondeado. Sigue dentro del 2 % que exige el paso 10 porque `kcal ≥ 1 200` siempre; la pantalla y el PDF dicen "hasta 25 kcal" en un plan ajustado, con **la misma función de copy en las dos capas** (`notaCierreKcal`, `SPEC-ux-comidas-pdf.md` §1226).
- **El peso objetivo no se mueve.** Cambiar la meta bajo un deslizador de macros sería incomprensible; lo que sí cambia —y es la consecuencia honesta— es el cronograma, que se rehace con el nuevo déficit.

### Paso 19 — Ciclo: consejos por síntomas (v1.2, decisión I, normativo)

Lo ejecuta `calcular` al final, después del paso 17 y sin tocar ni un número del plan. Publica
`Resultado.ciclo`.

```
si INFO_CICLO ∉ avisos                         → ciclo = undefined; parar
sintomas = orden canónico ∩ (sintomas_regla ?? [])      // dedupe + orden, NUNCA el orden de entrada
si sintomas está vacío                          → ciclo = undefined; parar
ciclo = { sintomas, consejos: sintomas.map(consejoDe) }
```

El orden canónico es el del tipo `SintomaRegla`: **dolor · hinchazon · antojos · cansancio ·
sangrado_abundante**. `consejos[i].clave === sintomas[i]` siempre. `INFO_CICLO` se mantiene tal cual y
sigue siendo el texto de cabecera de la tarjeta: los consejos van **debajo**, no en su lugar
(`SPEC-ux-comidas-pdf.md` §2.2c).

**Por qué en el motor y no en la interfaz.** Es copy, sí, pero copy con dos dependencias que solo el
motor conoce: la base dietética efectiva (recomendarle carne roja a una vegana en su propio plan es
justo lo que rompe la confianza) y `low_carb` efectivo. Ponerlo en la UI obligaba a duplicar las dos
reglas en la pantalla y en el PDF, que es como se producen las divergencias que este proyecto ya ha
pagado dos veces.

**Los cinco consejos (copy literal).** `{…}` marca un fragmento condicional.

| clave | `titulo` | `texto` |
|---|---|---|
| `dolor` | Dolor: omega-3, magnesio y calor | El dolor de regla lo producen las prostaglandinas, y el omega-3 compite con ellas: en los ensayos, 1-2 g al día durante dos o tres ciclos reducen el dolor y la necesidad de analgésicos. Es lento, no notarás nada el primer mes. El magnesio tiene evidencia más floja, pero por comida es barato y seguro. A corto plazo lo que mejor funciona sigue siendo el calor local y el movimiento suave. Si el dolor te impide hacer vida normal, eso no es normal: consúltalo. |
| `hinchazon` | Hinchazón: es agua, no grasa | Ese kilo o dos de más de la semana antes es agua, y se va solo. No recortes calorías por eso: si bajas el plan cada vez que la báscula sube, acabas comiendo bastante menos de lo que necesitas. Lo que sí ayuda es quitar sal de la que viene ya puesta (embutido, conservas, precocinados, pan de molde), beber lo mismo o más —nunca menos— y llegar bien al potasio. Y pésate siempre el mismo día de la semana y en la misma fase del ciclo, o estarás comparando dos cosas distintas. |
| `antojos` | Más hambre: cuenta con ella | En la segunda mitad del ciclo el hambre sube de verdad: se han medido entre 100 y 300 kcal más al día. No es falta de fuerza de voluntad. Tienes dos formas de manejarlo y las dos valen: comer 100-200 kcal más esos días y compensarlas en el resto de la semana, o dejar el plan como está y apoyarte en proteína y fibra, que son lo que más sacia. Si te pide dulce, el cacao puro o una o dos onzas de chocolate del 85 % cunden mucho más que una tableta con leche. |
| `cansancio` | Cansancio: duerme y no bajes los hidratos | El cansancio de esos días suele ser una mezcla de dormir peor, hierro justo y menos energía disponible. Lo primero es dormir: es la palanca más grande y la más aburrida. Lo segundo, no recortar hidratos justo esa semana: son el combustible del entrenamiento y del ánimo.{ Como llevas un plan bajo en hidratos, súbelos un poco esos días —una ración más de fruta o de tubérculo— y vuelve a tu plan después.} Si el cansancio dura bastante más que la regla, mira el hierro con tu médico. |
| `sangrado_abundante` | Sangrado abundante: cuida el hierro | Un sangrado abundante mes a mes es la causa más frecuente de falta de hierro en mujeres. No cambiamos tus macros por esto: lo que cambia es qué eliges dentro de ellos. Acompaña el hierro con algo de vitamina C (naranja, kiwi, pimiento o tomate) y deja el café y el té para dos horas antes o después de esa comida, porque reducen bastante lo que absorbes.{ Si además te notas cansada, pide a tu médico una analítica con ferritina: es el dato que dice si tienes las reservas bajas, y un hemograma normal puede no verlo.} |

**Fragmentos condicionales (los dos únicos):**

- `cansancio`: el fragmento de los hidratos se incluye **solo si `low_carb` efectivo es `true`**. Sin la
  guarda, a quien no lleva low-carb se le dice que suba unos hidratos que ya son normales.
- `sangrado_abundante`: el fragmento de la ferritina se incluye **solo si `cansancio` también está
  marcado**. Es la única combinación en la que la analítica es una recomendación y no una alarma
  gratuita; y es exactamente la que describía el audio de la usuaria.

**`alimentos` de cada consejo (nombres legibles, no ids), por base dietética:**

| clave | omnívoro | vegetariano | vegano |
|---|---|---|---|
| `dolor` | Pescado azul (salmón, sardinas en lata) · Nueces · Semillas de lino molidas · Cacao puro | Nueces · Semillas de lino molidas · Semillas de chía · Cacao puro | Nueces · Semillas de lino molidas · Semillas de chía · Cacao puro |
| `hinchazon` | Plátano · Patata cocida · Espinacas · Calabacín | *(igual)* | *(igual)* |
| `antojos` | Yogur griego 0% · Fruta (manzana, plátano) · Cacao puro · Chocolate negro 85% | *(igual que omnívoro)* | Yogur de soja alto en proteína · Fruta (manzana, plátano) · Cacao puro · Almendras |
| `cansancio` | Avena · Patata cocida · Lentejas o garbanzos · Fruta | *(igual)* | *(igual)* |
| `sangrado_abundante` | Lentejas o garbanzos · Carne roja magra (ternera) · Mejillones o berberechos al natural · Espinacas | Lentejas o garbanzos · Espinacas · Tofu · Almendras | *(igual que vegetariano)* |

**Las dos únicas sustituciones por restricción** (se aplican después de elegir la fila por base):

1. `'sin_gluten' ∈ restricciones` → se **retira** "Avena" (no lleva el tag `sin_gluten` en `foods.json`).
2. `'sin_lactosa' ∈ restricciones` → "Yogur griego 0%" pasa a "Yogur griego 0% sin lactosa".

Ninguna otra entrada de la tabla depende de una restricción. Si la lista se quedara vacía, el consejo se
publica igual con `alimentos: []`: su texto vale por sí solo.

**Lo que el paso 19 NO hace:** no cambia kcal, macros, agua, peso objetivo, cronograma ni proyección; no
emite ningún aviso nuevo; y no sustituye a `INFO_CICLO` ni a `WARN_CICLO_AUSENTE`. El invariante **S32**
comprueba la equivalencia `ciclo !== undefined ⟺ INFO_CICLO ∈ avisos ∧ hay al menos un síntoma válido`,
el orden canónico, la correspondencia una-a-una con `sintomas` y que no queda ningún `{` sin resolver;
**S33** comprueba que el resto del `Resultado` es idéntico con y sin síntomas.

**Quién pinta esto:** la tarjeta de `SPEC-ux-comidas-pdf.md` §2.2c (pantalla) y §4.3b (PDF). El
generador de menús lee `Resultado.ciclo.sintomas` para `Ejemplos.alimentos_ciclo` y para la sección
opcional de la lista de la compra (§3.8), y ahí sí aplica además `alimentos_excluidos`.

---

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
  // ---- v1.1: todos opcionales; el motor los rellena siempre salvo donde se indica
  preferencia_base?: 'omnivoro' | 'vegetariano' | 'vegano';   // §1.1, regla de traducción
  restricciones?: Array<'sin_lactosa' | 'sin_gluten'>;        // deduplicadas y en orden canónico
  low_carb?: boolean;                                          // efectivo (el paso 6.8 lo anula con diabetes)
  recomposicion_prioridad?: RecomposicionPrioridad;            // solo si objetivo_efectivo === 'recomposicion'
  proyeccion?: PuntoProyeccion[];                              // paso 14b; undefined con 'tca'
  limites_ajuste?: LimitesAjuste;                              // paso 18; undefined con 'tca'
  ajuste?: { kcal: boolean; hc: boolean };                     // SOLO en la salida de `ajustarMacros`
  // ---- v1.2
  ciclo?: ResultadoCiclo;      // paso 19; undefined sin INFO_CICLO o sin síntomas marcados
}

export interface ConsejoCiclo { clave: SintomaRegla; titulo: string; texto: string; alimentos: string[] }
export interface ResultadoCiclo { sintomas: SintomaRegla[]; consejos: ConsejoCiclo[] }

export interface PuntoProyeccion { semana: number; peso_min: number; peso_esp: number; peso_max: number }

export interface LimitesAjuste {
  kcal_recomendada: number; hc_recomendado_g: number; grasa_recomendada_g: number;
  kcal_min: number; kcal_max: number; kcal_paso: number;      // kcal_paso siempre 50
  hc_min_ui_g: number;                                         // siempre 30
  hc_min_motor_g: number;                                      // 130, o 75 con low_carb
  suelo_grasa_abs_g: number;                                   // (0,7 H / 0,8 M) · base_kg
  peso_kg: number; fecha_inicio: string; kcal_micronutrientes: number;
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
| Proyección (v1.1) | hasta `min(semanas[1], 26)` semanas con cronograma; 12 semanas y banda de ±1 kg sin cronograma; un ciclo de descanso son 9 semanas de calendario |
| Ajuste manual (v1.1) | HC entre 30 g y lo que deje el suelo de grasa; kcal entre el suelo del paso 7 y el TDEE (`perder`) o ±20 % (resto), en múltiplos de 10 y con paso de 50 en la interfaz; la proteína no se toca; el techo de grasa no se aplica, el suelo sí |
| Recomposición con prioridad (v1.1) | `perder`: déficit de la tabla 3.9 +5 puntos, tope 15 % · `ganar`: 0 % · `equilibrado`: tabla 3.9 |
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
| déficit (`equilibrado`, por defecto) | 10 % | 10 % | 7,5 % | 5 % | 0 % |
| déficit con `prioridad = 'perder'` | 15 % | 15 % | 12,5 % | 10 % | 5 % |
| déficit con `prioridad = 'ganar'` | 0 % | 0 % | 0 % | 0 % | 0 % |

La fila `perder` es la de arriba **+5 puntos con tope duro del 15 %** (`min(d + 0,05, 0,15)`), no una tabla independiente: si la primera fila cambiara, la segunda se deriva sola. Con `prioridad = 'ganar'` el plan queda en el gasto estimado y **no** se le aplica la regla de margen del paso 7 (ver allí).

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
| `perder` suave/moderado, `recomposicion` (`equilibrado` o `ganar`) | 28 % |
| `recomposicion` con `prioridad = 'perder'` | 33 % (28 + 5 puntos; menos hidratos) |
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
| `WARN_LOWCARB_DIABETES` | aviso | `'diabetes' ∈ condiciones` y `low_carb_pedido === true` (paso 6.8) | No aplicamos la opción baja en hidratos porque tienes diabetes: reducir los hidratos de golpe puede provocarte una hipoglucemia si tomas insulina o pastillas que la bajan, y con algunos fármacos (los iSGLT2, como la empagliflozina o la dapagliflozina) puede causar cetoacidosis. Habla con tu equipo médico antes de bajar los hidratos. |
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
| `INFO_VEGANO` | info | `pref_base === 'vegano'` (paso 17) | Hemos subido tu proteína un 15 % por la menor digestibilidad de las fuentes vegetales. Recuerda suplementar B12 y vigilar hierro y omega-3. |
| `INFO_IMC_MUSCULADO` | info | `FFMI_norm ≥ 22` (H) / `≥ 19` (M), `IMC ≥ 25` y banda ∈ {muy_bajo, bajo, medio} | Tu IMC sale en "sobrepeso" pero tu masa muscular es alta: en tu caso el IMC no es un buen indicador y no debes tomarlo como problema. |
| `INFO_GRASA_ESTIMADA` | info | `grasa_fiabilidad === 'baja'` | Tu porcentaje de grasa es una estimación con un error típico de ±5 puntos. Una bioimpedancia profesional o una DEXA afinarían el cálculo. |
| `INFO_ALTO_RENDIMIENTO` | info | `perfil !== 'sedentario'` y `dias · minutos_sesion / 60 > 10` | Con más de 10 horas semanales de entrenamiento, un/a dietista-nutricionista deportivo puede afinar mucho más estos números (periodización, timing). Toma esto como punto de partida. |
| `INFO_RECOMP_PRIORIDAD_PERDER` | info | `objetivo_efectivo === 'recomposicion'` y `recomposicion_prioridad === 'perder'` (emitido en el paso 7, **reevaluado en el paso 17**: si el 10bis ha reescrito el objetivo a `mantener`, se retira, igual que `WARN_PERDIDA_MAYOR_65`) | Nos has dicho que ahora te importa más perder grasa, así que dentro de la recomposición hemos apretado un poco el déficit y te hemos subido la grasa a costa de los hidratos. Sigue siendo una recomposición: los cambios serán lentos y la báscula se moverá poco. Mide con fotos y cinta métrica, no solo con el peso. |
| `INFO_RECOMP_PRIORIDAD_GANAR` | info | `objetivo_efectivo === 'recomposicion'` y `recomposicion_prioridad === 'ganar'` (emitido en el paso 7, **reevaluado en el paso 17** igual que el anterior) | Nos has dicho que ahora te importa más ganar músculo, así que no te ponemos déficit: comerás en tu gasto estimado. Con la proteína alta y entrenamiento de fuerza 3-4 días por semana es donde más músculo se gana sin engordar. Si dentro de un par de meses la cintura sube, vuelve a calcular pidiendo prioridad a perder grasa. |
| `INFO_CICLO` | info | `sexo === 'mujer'` y `menstruacion ∈ {regular, irregular}` (paso 17) | Tu gasto energético cambia poco a lo largo del ciclo, así que no ajustamos tus calorías por eso. Lo que sí cambia es lo que marca la báscula: la semana antes de la regla es normal retener 1-2 kg de agua y tener más hambre (unas 100-300 kcal). Pésate siempre en la misma fase del ciclo si quieres comparar, no te asustes con el peso de esa semana, y si comes 100-200 kcal más esos días, compénsalo en el resto de la semana sin cambiar el total. En los días de regla, cuida el hierro: {carne roja, legumbre o verdura de hoja / legumbre, verdura de hoja y frutos secos} acompañados de algo de vitamina C. |
| `WARN_CICLO_AUSENTE` | aviso | `sexo === 'mujer'`, `menstruacion ∈ {irregular, ausente}` y (`objetivo_efectivo === 'perder'` o `banda ∈ {muy_bajo, bajo}` o `ritmo === 'agresivo'`) (paso 17) | Nos has dicho que tu regla es irregular o que no la tienes, y a la vez {tu plan lleva déficit, poca grasa corporal o un ritmo rápido / tienes poca grasa corporal o has pedido un ritmo rápido}. Esa combinación puede indicar baja disponibilidad energética (lo que se llama RED-S): comer por debajo de lo que gastas durante meses altera las hormonas, el hueso y el propio ciclo.{ Hemos suavizado el ritmo a moderado.} Si llevas tres meses o más sin regla y no es por anticonceptivos ni por la menopausia, pide cita con tu médico{ antes de seguir con el déficit}. |
| `INFO_RITMO_POR_PLAZO` | info | `plazo_semanas !== null`, `pobj !== null`, `objetivo_efectivo ∈ {perder, ganar}` y el paso 6.7ter encontró un ritmo de la tabla que llega a tiempo (reevaluado en el paso 17: se retira si un suavizado lo bajó o si el cronograma pasa del plazo) | Nos has dicho que quieres llegar a {peso_objetivo} kg en {plazo_semanas} semanas: son unos {ritmo_req_g} g por semana. Hemos puesto el ritmo {suave/moderado/agresivo}, el más suave de los nuestros que llega a esa fecha, y hemos ignorado el que habías elegido antes. Si la fecha no es tan importante, un ritmo más suave se sostiene mejor y cuesta menos músculo. |
| `WARN_PLAZO_IRREAL` | aviso | Paso 6.7ter: ningún ritmo de la tabla alcanza `ritmo_req`; o, desde el paso 17, un suavizado de seguridad bajó el ritmo del plazo, o `cronograma.semanas[0] > plazo_semanas` | Para llegar a {peso_objetivo} kg en {plazo_semanas} semanas harían falta unos {ritmo_req_g} g por semana, y ese no es un ritmo que podamos proponerte con seguridad. {Hemos puesto el más rápido de nuestra tabla. / Hemos aplicado el ritmo que tu caso permite.} No te prometemos esa fecha: la buena es la que sale de tu plan real.{ Con este plan el cálculo da entre {semanas_min} y {semanas_max} semanas.} Perder más rápido no es perder mejor: por debajo de cierto ritmo lo que se va es músculo. |
| `INFO_PROYECCION_RECOMP` | info | Paso 14: proyección de recomposición con déficit real (las cuatro condiciones de ese paso) | En recomposición la báscula baja mucho más despacio de lo que cambia tu cuerpo: puedes perder grasa y ganar músculo a la vez y quedarte casi en el mismo peso. Por eso no te damos una fecha, sino una banda: por abajo, lo que bajarías si todo lo que pierdes fuese grasa; por arriba, quedarte en el peso de hoy porque el músculo lo compensa. Las dos cosas serían un buen resultado. Mídete también la cintura y hazte fotos cada cuatro semanas: ahí se ve lo que la báscula no enseña. |
| `INFO_PROYECCION_PLANA` | info | `cronograma === null` (paso 14b) | Con este objetivo no proyectamos una curva de peso: lo que esperamos es que tu peso se mantenga, con la oscilación normal de un kilo arriba o abajo por agua, sal e intestino. Lo que sí debería cambiar es cómo te queda la ropa, las medidas y las cargas del entrenamiento. |
| `INFO_AJUSTE_MANUAL` | info | Paso 18 con `ajuste.kcal === true` o `ajuste.hc === true` | Has ajustado a mano las calorías o los hidratos, así que estos ya no son los números que te propusimos. Hemos recalculado con tu ajuste la grasa, el reparto por comidas, el menú, la lista de la compra y el calendario. La proteína no la tocamos: es la que protege tu músculo cuando comes menos. Puedes volver a lo recomendado cuando quieras. |
| `WARN_HC_BAJO_MINIMO` | aviso | Paso 18 y `HC < HC_min` (`{130/75}` según `low_carb`) | Has bajado los hidratos por debajo de los {130/75} g que usamos como mínimo de referencia. No es peligroso a corto plazo y hay gente que se encuentra mejor así, pero cuenta con dos cosas: entrenar fuerte cuesta más y la fibra es más difícil de cubrir. Si te notas sin energía, con mal descanso o con estreñimiento, súbelos otra vez. |
| `WARN_KCAL_AJUSTE_ALTA` | aviso | Paso 18, **`ajuste.kcal === true`** (el usuario ha movido de verdad la palanca), `objetivo_efectivo === 'perder'` y `TDEE − kcal < 100` | Con las calorías que has puesto, el déficit se queda en menos de 100 kcal al día sobre tu gasto estimado: en la práctica esto es un plan de mantenimiento y el calendario que ves deja de tener sentido. Si quieres perder grasa, baja las calorías o sube la actividad diaria; si lo que quieres es mantener, cambia el objetivo y vuelve a calcular. |

**Fragmentos condicionales del texto.** Lo que va entre `{ }` es una parte opcional del mensaje:
- `{35/30}` en `INFO_PROTEINA_CAPADA`: se resuelve leyendo `macros.pct_cap`, el `pct_cap` realmente aplicado en el paso 8 (30 % en dieta vegetal con `kcal < 1800`, 35 % en el resto). **No se recalcula con `resultado.kcal`**: los pasos 9 y 10 pueden subir las kcal por encima de 1.800 después de aplicado el cap, y entonces el informe imprimiría un porcentaje que nunca se aplicó. La interfaz y el PDF deben resolver el placeholder, no escribir el 35 % fijo.
- El placeholder de `INFO_OBJETIVO_RESUELTO` / `INFO_OBJETIVO_RESUELTO_POR_PESO` se resuelve contra `objetivo_propuesto` (lo que decidió la regla 6.1), nunca contra `objetivo_efectivo`: los pasos 6.3, 6.4, 7 y 10bis pueden haberlo reescrito después. La rama `IMC < 20` de 6.1 propone `mantener`, de ahí la cuarta opción del conjunto.
- `{30/25}` en `WARN_SUELO_CALORICO_EA`: se resuelve al suelo de disponibilidad energética realmente aplicado en el paso 7 (25 kcal/kg MLG en banda `muy_alto`, 30 en el resto). Con el 30 fijo el informe afirmaba haber evitado un umbral que en banda `muy_alto` el propio motor no aplica: el plan entregado se quedaba en 25,1 kcal/kg mientras el texto prometía 30.
- `{20/25/30}` en `INFO_DEFICIT_CAPADO_TDEE`: se resuelve al `cap_pct` realmente aplicado, `Math.round(cap_pct · 100)` (20 % a partir de 65 años, 30 % en banda `muy_alto`, 25 % en el resto). Sin el 20 el aviso afirmaba una cifra falsa a todo usuario de 65 años o más (caso 14 de la §5: el déficit aplicado es el 20 % del TDEE). El número impreso debe coincidir siempre con `cap_pct`.
- `{ y alargado el calendario…}` en los tres `WARN_SUELO_CALORICO_*`: se **omite** cuando `cronograma === null`. Sin esa regla el informe prometía haber alargado un calendario que no existe (13 105 casos de 243 457 en el barrido).
- `{ y suavizado el ritmo}` en `WARN_PERDIDA_MAYOR_65`: se **omite** cuando `ritmo_ef === ritmo`. La segunda rama del paso 6.7 emite el aviso también cuando el usuario ya había elegido `suave` o `moderado`, es decir, cuando no se ha suavizado ningún ritmo; el déficit máximo sí se ha limitado siempre (`cap_pct ≤ 0,20`).
- `{A / B}` en `INFO_PESO_YA_MINIMO`: se usa la variante **A** ("el objetivo no es un peso: es recomposición") con `objetivo_efectivo ∈ {mantener, recomposicion, ganar}` y la variante **B** ("hemos fijado tu meta en ese mínimo y no más abajo") con `objetivo_efectivo === 'perder'`. El aviso se emite desde el bloque común del paso 13, antes de ramificar por objetivo, así que con `perder` convivía con un peso objetivo, un déficit y un cronograma mientras afirmaba que no había peso objetivo.
- `{1,2 g/kg · o bien "{X} g al día"…}` en `INFO_MAYOR_60`: ver paso 17.
- `{ Hemos suavizado el ritmo a moderado.}` en `WARN_CICLO_AUSENTE`: se emite **solo** cuando `ritmo === 'agresivo'` **y** `ritmo_efectivo === 'moderado'`, es decir, cuando el paso 6.7bis (o el 6.7 de los 65 años) ha suavizado de verdad. Con la guarda de objetivo del 6.7bis, un plan de `ganar` a ritmo agresivo conserva su ritmo, y el aviso afirmaba haber cambiado algo que no cambió (misma mecánica que `{ y suavizado el ritmo}` de `WARN_PERDIDA_MAYOR_65`).
- Las dos alternativas del déficit en `WARN_CICLO_AUSENTE` —`{tu plan lleva déficit, poca grasa corporal o un ritmo rápido}` al abrir y `{ antes de seguir con el déficit}` al cerrar— se eligen por `objetivo_efectivo ∈ {perder, recomposicion}`. La condición del aviso también se dispara con `banda ∈ {muy_bajo, bajo}` o `ritmo === 'agresivo'` sin mirar el objetivo, así que puede caer sobre un plan de superávit: ahí la frase del déficit era literalmente falsa.
- `{carne roja, legumbre o verdura de hoja / legumbre, verdura de hoja y frutos secos}` en `INFO_CICLO`: la segunda alternativa se usa con `preferencia_base ∈ {vegetariano, vegano}`. Recomendarle carne roja a una vegetariana **en su propio plan** es justo lo que rompe la confianza en una versión cuyo argumento es que las preferencias por fin se combinan de verdad.
- `{130/75}` en `WARN_HC_BAJO_MINIMO`: se resuelve a `limites_ajuste.hc_min_motor_g`, que es 75 con `low_carb` y 130 en el resto. La interfaz y el PDF deben resolverlo, no escribir el 130 fijo.
- `{ritmo_req_g}` en `INFO_RITMO_POR_PLAZO` y `WARN_PLAZO_IRREAL`: `round(|peso_objetivo − PC| / plazo_semanas · 1000)` gramos por semana, con separador de miles español si pasa de 999. Es el ritmo que **exige la fecha**, no el del plan: por eso en `WARN_PLAZO_IRREAL` es siempre mayor que el que se acaba aplicando.
- `{suave/moderado/agresivo}` en `INFO_RITMO_POR_PLAZO`: es `ritmo_efectivo`, que en ese aviso coincide siempre con el que eligió el plazo (si no coincidiera, el paso 17 ya habría cambiado el aviso por `WARN_PLAZO_IRREAL`).
- `{Hemos puesto el más rápido de nuestra tabla. / Hemos aplicado el ritmo que tu caso permite.}` en `WARN_PLAZO_IRREAL`: la primera con `ritmo_efectivo === 'agresivo'`, la segunda en el resto. El aviso lo emiten dos situaciones distintas —ningún ritmo llega, o un suavizado de seguridad ha bajado el que llegaba— y la primera frase sería literalmente falsa en la segunda.
- `{ Con este plan el cálculo da entre {semanas_min} y {semanas_max} semanas.}` en `WARN_PLAZO_IRREAL`: se **omite** cuando `cronograma === null` (misma regla que los `WARN_SUELO_CALORICO_*`). Con cronograma, los dos números son `cronograma.semanas`.
- Los dos fragmentos de los consejos del paso 19 (`cansancio` → low-carb; `sangrado_abundante` → ferritina) los resuelve **el motor**, no la presentación: `Resultado.ciclo.consejos[i].texto` llega ya cerrado y sin ninguna llave (invariante S32f).

**Reglas de supresión añadidas en la v1.1** (se suman a la tabla del paso 6):

| Si se emite | Se suprime |
|---|---|
| `WARN_KCAL_AJUSTE_ALTA` | `WARN_DEFICIT_MINIMO` (la condición del segundo está contenida en la del primero, y el texto del primero ya dice qué hacer) |

**Reglas de supresión añadidas en la v1.2:**

| Si se emite | Se suprime |
|---|---|
| `INFO_PROYECCION_RECOMP` | `INFO_PROYECCION_PLANA` (son las dos formas de la proyección sin cronograma y son excluyentes: la plana afirma "esperamos que tu peso se mantenga", que es justo lo que la de recomposición contradice) |
| `WARN_PLAZO_IRREAL` | `INFO_RITMO_POR_PLAZO` (uno dice que llegamos a la fecha y el otro que no) |

**Avisos retirados con `'tca' ∈ condiciones`** (filtro del paso 17, ver allí la lista cerrada y el motivo):
`INFO_GRASA_ESTIMADA`, `INFO_PESO_YA_MINIMO`, `INFO_IMC_MUSCULADO`, `INFO_ADAPTACION`, `WARN_YA_MAGRO`,
`WARN_YA_EN_OBJETIVO`, `WARN_OBJETIVO_MUY_LEJANO`, `WARN_CRONOGRAMA_LARGO`, `INFO_SIN_CRONOGRAMA`,
`INFO_SIN_CRONOGRAMA_SIN_MARGEN`, `INFO_CRONOGRAMA_NO_ESTIMABLE`, `INFO_CRONOGRAMA_FUERA_DE_HORIZONTE`,
`INFO_PROYECCION_PLANA` y, desde la v1.2, `INFO_PROYECCION_RECOMP`, `INFO_RITMO_POR_PLAZO` y
`WARN_PLAZO_IRREAL`.
El motor no los emite, así que la regla de la SPEC-ux "se listan todos los avisos con su texto íntegro"
sigue siendo cierta sin excepciones de maquetación. Desde la v1.1 esta lista es una **regla no expuesta**
(§1.1): la UI ya no puede producir `'tca'`, pero los vectores de la §5 sí.

Copy fijo del informe (no depende de condiciones):
- Nota TDEE: "A tu gasto estimado le hemos restado un 5 % como margen de seguridad, porque casi todos sobrestimamos lo que nos movemos."
- Nota %grasa: "Ninguna fórmula sin aparato mide la grasa: te mostramos un rango, no una cifra exacta."
- Nota comidas: "No hay evidencia de que comer más o menos veces al día cambie tu metabolismo. Elige el número de comidas que mejor se adapte a tu rutina."
- Nota agua: "Es líquido bebido: el café, el té y las infusiones cuentan si los tomas de forma habitual; la comida aporta además un 20–30 % de agua que no está incluido aquí. El alcohol no cuenta y deshidrata. No fuerces más de 1 litro por hora. Si entrenas más de una hora, sudas mucho o hace calor, añade sal a las comidas o una bebida con electrolitos: beber mucha agua sin sodio puede bajarte el sodio en sangre."
- Nota peso objetivo: "El peso que te proponemos sale de tu masa magra estimada, y esa estimación tiene un margen de varios kilos. Por eso te damos una franja y no un número exacto: la báscula es una señal más, no el objetivo."
- Nota cierre kcal: "Las calorías de los macros pueden diferir hasta 10 kcal del objetivo por el redondeo a 5 g." (en un plan ajustado a mano, hasta 25 kcal: la grasa absorbe todo el residuo y su redondeo a 5 g vale hasta 22,5 kcal.) **La pantalla y el PDF usan la misma función de copy** (`notaCierreKcal(ajustado)`): con una constante fija en la pantalla y un literal en el PDF, la tabla de reparto de un plan ajustado imprimía "hasta 10 kcal" al lado de una diferencia real de 20.
- Nota proyección: "Esta curva es una estimación, no una promesa: sale de tu déficit actual y de un factor de adaptación que crece con el tiempo. Tu peso real va a oscilar por agua, sal e intestino; lo que importa es la tendencia de varias semanas, no el dato de un día."
- Línea de ayuda del disclaimer (v1.1, sustituye a todo lo que hacía el antiguo cribado del paso 5b): "Si la comida o el peso te generan ansiedad, puedes hablar gratis con ADANER (adaner.org) o con tu centro de salud."
- Disclaimer general: "Báscula te ofrece una orientación nutricional general basada en evidencia científica, no un consejo médico ni un plan personalizado por un profesional sanitario. Los resultados son estimaciones: tu cuerpo puede responder de forma distinta. Si tienes una condición médica, tomas medicación, estás embarazada o en periodo de lactancia, o tienes antecedentes de trastornos de conducta alimentaria, consulta con un/a médico o dietista-nutricionista colegiado/a antes de seguir estas recomendaciones."

---

## 5. Vectores de prueba

Los diecinueve casos de esta sección están **generados por `docs/verify-vectors.mjs`**, la implementación de referencia de este documento, y se regeneran con `node docs/verify-vectors.mjs` cada vez que cambia una regla. Los nueve primeros son los vectores originales; del 10 al 14, los que pidió la revisión adversaria (bucle de factibilidad, regla de margen del paso 7, borde de la banda `medio`, cap renal con IMC ≥ 30 y usuario de más de 65 años); el 15 y el 16 son los de la v1.1 (proyección + regla + preferencias combinables, y recomposición con prioridad + ajuste manual); el 17, 18 y 19 son los de la v1.2 (recomposición con déficit real —peso objetivo y proyección—, plazo imposible y plazo holgado). Todos los números de aquí son normativos: un motor que no los reproduzca no cumple la especificación.

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
13. Peso objetivo (**cambia en la v1.2**): recomposición con déficit real (1 879,2 − 1 740 = 139,2 kcal ≥ 50), así que la meta se calcula como en `perder`: método **`grasa`**; sugerido **57,5 kg** (rango 53,0–61,0; `mostrar_central = true`); efectivo **57,5 kg**; hito `null`. Referencia IMC-22 = 59,9 (54,4–67,8); clásicas Devine 56,9 / Robinson 57,4 / Miller 59,8 / Hamwi 56,4. *(Hasta la v1.1: método `actual`, sugerido 60,0 kg y efectivo `null`.)*
14. Cronograma: **`null`**.
15. FFMI = 16,2; normalizado = **16,5** (`medio`).
16. Reparto (3 comidas, peri = Desayuno):

| Comida | Hora | % kcal | P | G | HC | kcal | peri |
|---|---|---|---|---|---|---|---|
| Desayuno | 08:00 | 30 | 35 | 15 | 70 | 555 | sí |
| Comida | 14:00 | 35 | 45 | 15 | 65 | 575 | no |
| Cena | 21:00 | 35 | 40 | 20 | 70 | 620 | no |

17. Avisos: `INFO_RITMO_SUAVE`, `INFO_SOMATOTIPO`, `WARN_PROTEINA_TOMA_ALTA`, `WARN_RECOMPOSICION_SIN_FUERZA`. (`INFO_SIN_CRONOGRAMA` e `INFO_PROYECCION_RECOMP` los retira el filtro de protección del cribado TCA del paso 17, igual que `proyeccion`, que queda `undefined`.)

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

17. Avisos: `INFO_AGUA_MAYORES`, `INFO_MAYOR_60`, `INFO_PROYECCION_PLANA`, `INFO_SIN_CRONOGRAMA`, `WARN_PROTEINA_TOMA_ALTA`.

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

17. Avisos: `INFO_IMC_MUSCULADO`, `INFO_PROYECCION_PLANA`, `INFO_SIN_CRONOGRAMA`, `WARN_SIN_MARGEN_DEFICIT`. (`WARN_SIN_MARGEN_DEFICIT` suprime `WARN_YA_MAGRO` y `WARN_RECOMPOSICION_SIN_FUERZA`: el plan final es `mantener` y esos dos textos prometen una recomposición.)

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

17. Avisos: `INFO_PROYECCION_PLANA`, `INFO_SIN_CRONOGRAMA`, `WARN_PROTEINA_TOMA_ALTA`, `WARN_YA_EN_OBJETIVO`.

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

17. Avisos: `INFO_AGUA_MAYORES`, `INFO_CRONOGRAMA_FUERA_DE_HORIZONTE`, `INFO_DEFICIT_CAPADO_TDEE`, `INFO_FIBRA_AJUSTADA`, `INFO_GRASA_ESTIMADA`, `INFO_MAYOR_60`, `INFO_PROTEINA_CAPADA`, `INFO_PROYECCION_PLANA`, `WARN_DEFICIT_INFACTIBLE`, `WARN_OBJETIVO_MUY_LEJANO`, `WARN_PERDIDA_MAYOR_65`. (`INFO_DEFICIT_CAPADO_TDEE` imprime aquí **20 %**, no 25 ni 30: `cap_pct = min(0,30, 0,20) = 0,20` por la edad, y `deficit_cap = 0,20 · 1781,7 = 356,3` frente a los 618,8 kcal del ritmo pedido. `WARN_PERDIDA_MAYOR_65` **sí** imprime el fragmento «{ y suavizado el ritmo}», porque el ritmo `agresivo` se ha suavizado a `moderado`. `WARN_OBJETIVO_MUY_LEJANO` entra por la corrección de la ronda 2: la meta la propone la app y supone perder el 25,3 % del peso.)

### Caso 15 — Mujer 34 años, `perder` agresivo, regla irregular, omnívora sin lactosa (D, E, F)

Input: mujer, 34 años, 168 cm, 78 kg; grasa `desconocido`; sin somatotipo; actividad `ligero`; fuerza 3 d × 50 min, intensidad media, intermedia, entrena por la tarde; objetivo `perder`, ritmo **`agresivo`**; peso objetivo 68 kg; `preferencia_base: 'omnivoro'`, `restricciones: ['sin_lactosa']`, `low_carb: false`; `menstruacion: 'irregular'`; 4 comidas.

1. IMC = **27,6** → `sobrepeso`.
2. CUN-BAE = 38,5 %; Deurenberg = 35,6 %; método efectivo `desconocido` → **38,5 %** (fiabilidad `baja`, rango 33–43, banda `muy_alto`).
3. MLG = **48,01 kg**.
4. Mifflin = 1499,0; Katch = 1407,0; Harris = 1542,1 → BMR = **1499,0** (`mifflin`).
5. Perfil `fuerza`; PAL 1,50; MET 5,0 → kcal/sesión = 260,0; ejercicio/día = 111,4; bruto = 2359,9; TDEE = **2241,9**.
6. Objetivo efectivo **`perder`**; ritmo efectivo **`moderado`**: el paso 6.7bis lo ha suavizado desde `agresivo` por `menstruacion = 'irregular'`. Preferencias efectivas: base `omnivoro`, restricciones `['sin_lactosa']`, `low_carb = false` → `preferencia_efectiva = 'sin_lactosa'`.
7. **kcal = 1600** (déficit capado al 30 % del TDEE; cierre por macros 1605).
8. Proteína: base 78,00 kg (`peso_corporal`), g/kg efectivo 2,200, `pct_cap` 0,35 → **P = 120 g** (1,54 g/kg PC; 30,0 % de kcal; `INFO_PROTEINA_CAPADA`).
9. Grasa: suelo 62,4 g, techo 71,1 g → **G = 65 g** (0,83 g/kg PC; 36,6 % de kcal).
10. **HC = 135 g** (1,73 g/kg PC; 33,8 % de kcal). Cierre 4·120 + 4·135 + 9·65 = **1605** (Δ +5).
11. Fibra = **22 g** (`INFO_FIBRA_AJUSTADA`); azúcares libres máx. 40,0 g.
12. Agua: **2750 ml** (rango 2500–3000; unos 11 vasos).
13. Peso objetivo: método `grasa`; sugerido 62,5 kg (rango 57,0–67,0; `mostrar_central = false`); **efectivo 68,0 kg** (el del usuario); hito `null`.
14. Cronograma: 0,584 kg/sem (0,75 %/sem), Δ 10,0 kg → **20–22 semanas** (2 diet breaks), 2027-01-25 a 2027-02-08; `precision_fecha = 'mes'`; `tramo_12sem` = [6,0, 7,0].
15. FFMI = 17,0; normalizado = **17,1** (`categoria = null`: banda `muy_alto`).
16. Reparto (4 comidas, peri = Merienda): Desayuno 25 % P30 G15 HC35 395 kcal · Comida 30 % P35 G20 HC35 460 kcal · Merienda 15 % P20 G10 HC25 270 kcal (peri) · Cena 30 % P35 G20 HC40 480 kcal.
17. Avisos: `INFO_ADAPTACION`, `INFO_CICLO`, `INFO_FIBRA_AJUSTADA`, `INFO_GRASA_ESTIMADA`, `INFO_PROTEINA_CAPADA`, `WARN_CICLO_AUSENTE`.
18. Límites de ajuste: kcal [1500, 2240], paso 50; HC mínimo de interfaz 30 g, mínimo del motor 130 g; suelo de grasa absoluto 62,4 g.

**Proyección (`proyeccion`), normativa.** 23 puntos, de la semana 0 a la 22 = `semanas[1]`. Los aplanamientos de las semanas 9 y 18 son los dos diet breaks; la semana 20 es donde la curva optimista alcanza los 68,0 kg (= `semanas[0]`) y la 22 donde lo alcanza la pesimista (= `semanas[1]`).

| Semana | `peso_min` | `peso_esp` | `peso_max` | | Semana | `peso_min` | `peso_esp` | `peso_max` |
|---|---|---|---|---|---|---|---|---|
| 0 | 78,0 | 78,0 | 78,0 | | 12 | 71,6 | 72,2 | 72,5 |
| 1 | 77,4 | 77,4 | 77,5 | | 13 | 71,0 | 71,7 | 72,0 |
| 2 | 76,8 | 76,9 | 77,0 | | 14 | 70,4 | 71,3 | 71,5 |
| 3 | 76,2 | 76,3 | 76,5 | | 15 | 69,8 | 70,8 | 71,0 |
| 4 | 75,7 | 75,8 | 76,0 | | 16 | 69,2 | 70,3 | 70,5 |
| 5 | 75,1 | 75,2 | 75,5 | | 17 | 68,7 | 69,9 | 70,0 |
| 6 | 74,5 | 74,7 | 75,0 | | 18 | 68,7 | 69,9 | 70,0 |
| 7 | 73,9 | 74,2 | 74,5 | | 19 | 68,1 | 69,5 | 69,5 |
| 8 | 73,3 | 73,7 | 74,0 | | 20 | 68,0 | 69,0 | 69,0 |
| 9 | 73,3 | 73,7 | 74,0 | | 21 | 68,0 | 68,5 | 68,5 |
| 10 | 72,7 | 73,2 | 73,5 | | 22 | 68,0 | 68,0 | 68,0 |
| 11 | 72,2 | 72,7 | 73,0 | | | | | |

### Caso 16 — Mujer 31 años, recomposición con prioridad `perder`, y ajuste manual de hidratos (B, C)

Input: mujer, 31 años, 165 cm, 64 kg; grasa `conocido` 27 % `fiable`; sin somatotipo; actividad `ligero`; fuerza 4 d × 55 min, intensidad media, intermedia, entrena por la tarde; objetivo `recomposicion`, ritmo `moderado`; sin peso objetivo; `preferencia_base: 'omnivoro'`, `restricciones: []`, `low_carb: false`; **`recomposicion_prioridad: 'perder'`**; `menstruacion: 'regular'`; 4 comidas.

1. IMC = **23,5** → `normal`.
2. %grasa aportado y fiable → **27,0 %** (fiabilidad `alta`, rango 25–29, banda `medio`). CUN-BAE 32,0; Deurenberg 29,9.
3. MLG = **46,72 kg**.
4. Mifflin = 1355,3; Katch = 1379,2; Harris = 1416,3 → BMR = **1379,2** (`katch_mcardle`, activado por el %grasa fiable).
5. Perfil `fuerza`; PAL 1,50; MET 5,0 → kcal/sesión = 234,7; ejercicio/día = 134,1; bruto = 2202,8; TDEE = **2092,7**.
6. Objetivo efectivo **`recomposicion`**, prioridad **`perder`**, ritmo `moderado`.
7. **kcal = 1830**: déficit de recomposición = tabla 3.9[`medio`] 7,5 % **+ 5 puntos = 12,5 %** del TDEE (`INFO_RECOMP_PRIORIDAD_PERDER`). Con `equilibrado` habrían sido 1940 kcal.
8. Proteína: base 64,00 kg, g/kg efectivo 2,000 → **P = 130 g** (2,03 g/kg PC; 28,4 % de kcal).
9. Grasa: `pct_grasa = 0,33` (28 % + 5 puntos por la prioridad); suelo 51,2 g, techo 81,3 g → **G = 65 g** (1,02 g/kg PC; 32,0 % de kcal).
10. **HC = 180 g** (2,81 g/kg PC; 39,3 % de kcal). Cierre 4·130 + 4·180 + 9·65 = **1825** (Δ −5).
11. Fibra = **26 g**; azúcares libres máx. 45,8 g.
12. Agua: **2500 ml** (rango 2250–2750; unos 10 vasos).
13. Peso objetivo (**cambia en la v1.2**): recomposición con déficit real (2 092,7 − 1 830 = 262,7 kcal ≥ 50) ⇒ meta como en `perder`: método **`grasa`**; sugerido **60,5 kg** (rango 57,5–63,5; `mostrar_central = true`, fiabilidad `alta`); efectivo **60,5 kg**; hito `null`. *(Hasta la v1.1: método `actual`, sugerido 64,0 kg, rango 57,0–64,0 y efectivo `null`.)*
14. Sin cronograma (`INFO_SIN_CRONOGRAMA`, y sigue siendo `null`) ⇒ **proyección de recomposición** (**cambia en la v1.2**): `ritmo_kg_sem` = 262,7 · 7/7 700 = **0,2388 kg/sem**, `delta_kg` = 3,5, `sem_lineal` = 14,66 ⇒ **S = 15**, 16 puntos. Semana 0 = 64,0/64,0/64,0 · s4 = 63,0/63,5/64,0 · s8 = 62,1/63,0/64,0 · s12 = 61,1/62,6/64,0 · s15 = 60,5/62,3/64,0. Aviso `INFO_PROYECCION_RECOMP` (sustituye a `INFO_PROYECCION_PLANA`). *(Hasta la v1.1: proyección plana de 13 puntos, 63,0/64,0/65,0.)*
15. FFMI = 17,2; normalizado = **17,5** (`bueno`).
16. Reparto (4 comidas, peri = Merienda): Desayuno 25 % P35 G15 HC45 455 kcal · Comida 30 % P35 G20 HC45 500 kcal · Merienda 15 % P20 G10 HC35 310 kcal (peri) · Cena 30 % P40 G20 HC55 560 kcal.
17. Avisos: `INFO_BMR_ATLETA`, `INFO_CICLO`, `INFO_PROYECCION_RECOMP`, `INFO_RECOMP_PRIORIDAD_PERDER`, `INFO_SIN_CRONOGRAMA`, `WARN_PROTEINA_TOMA_ALTA`. (`sintomas_regla` va vacío, así que `ciclo` queda `undefined`.)
18. Límites de ajuste: kcal [1540, 2200], paso 50; HC 30 g (interfaz) / 130 g (motor); suelo de grasa absoluto 51,2 g.

**Ajuste manual (normativo):** `ajustarMacros(resultado, { hc_g: 120 })`.

| | Recomendado | Ajustado |
|---|---|---|
| kcal (objetivo) | 1830 | **1830** (no se ha tocado) |
| kcal (cierre) | 1825 | **1810** |
| Proteína | 130 g | **130 g** (intacta, por definición) |
| Grasa | 65 g | **90 g** — el resto: `round5((1830 − 520 − 480)/9) = round5(92,2) = 90`, por encima del suelo 51,2 |
| Hidratos | 180 g | **120 g** |
| Fibra | 26 g | **26 g** |
| `ajuste` | — | `{ kcal: false, hc: true }` |

Reparto ajustado: Desayuno P35 G25 HC30 485 kcal · Comida P35 G25 HC30 485 kcal · Merienda P20 G15 HC25 315 kcal · Cena P40 G25 HC35 525 kcal. La columna de proteína es **idéntica** a la del plan recomendado.

Avisos del plan ajustado: los seis de arriba más `INFO_AJUSTE_MANUAL` y `WARN_HC_BAJO_MINIMO` (120 g < 130 g).

Comprobaciones obligatorias sobre este caso: `ajustarMacros(ajustado, { hc_g: 120 })` devuelve exactamente el mismo objeto (idempotencia, **S27l**) y `ajustarMacros(ajustado, {})` restituye el plan recomendado bit a bit y sin campo `ajuste` (**S27m**).

### Caso 17 — Mujer 45 años, recomposición con prioridad `perder` y peso objetivo 63 kg (v1.2: H, I, G)

Input: mujer, 45 años, 165 cm, 68 kg; grasa `medidas` cuello 33 / cintura 82 / cadera 102; sin somatotipo; actividad `ligero`; fuerza 3 d × 45 min, intensidad media, novata, entrena por la tarde; objetivo `recomposicion`, `recomposicion_prioridad: 'perder'`, ritmo `moderado`; **`peso_objetivo: 63`**; `preferencia_base: 'omnivoro'`, `restricciones: []`, `low_carb: false`; `menstruacion: 'regular'`, **`sintomas_regla: ['sangrado_abundante','cansancio','hinchazon']`**; 4 comidas. Además, y **para comprobar que el motor los ignora**: `menu_sencillo: true`, `alimentos_excluidos: ['brocoli','coliflor']`, `alimentos_favoritos: ['pechuga_pollo','arroz_blanco_cocido']`.

1. IMC = **25,0** → `normal`.
2. CUN-BAE = 36,2 %; Deurenberg = 34,9 %; US Navy = 33,8 %; método efectivo `medidas` → **33,8 %** (fiabilidad `media`, banda `muy_alto`).
3. MLG = **45,01 kg**.
4. Mifflin = 1325,3; Katch = 1342,2; Harris = 1392,7 → BMR = **1325,3** (`mifflin`).
5. Perfil `fuerza`; PAL 1,50; MET 5,0 → kcal/sesión = 204,0; ejercicio/día = 87,4; bruto = 2075,3; TDEE = **1971,5**.
6. Objetivo efectivo **`recomposicion`**, prioridad **`perder`**, ritmo `moderado`. Sin `plazo_semanas`.
7. **kcal = 1680**: tabla 3.9[`muy_alto`] 10 % **+ 5 puntos = 15 %** del TDEE (tope duro), `INFO_RECOMP_PRIORIDAD_PERDER`.
8. Proteína: base 68,00 kg (`peso_corporal`), g/kg efectivo 2,000 → **P = 135 g**.
9. Grasa: `pct_grasa` 0,33 (28 % + 5 puntos por la prioridad) → **G = 60 g**.
10. **HC = 150 g**. Cierre 4·135 + 4·150 + 9·60 = **1680** (Δ 0).
11. Fibra = **24 g** (`INFO_FIBRA_AJUSTADA`); azúcares libres máx. 42,0 g.
12. Agua: **2400 ml** (rango 2150–2650; unos 10 vasos).
13. Peso objetivo: **déficit real de 291,5 kcal ≥ 50 ⇒ rama `perder`**. `meta_cand` = 63 y 68 − 63 = 5 ≥ 0,5, así que se ejecuta entera: grasa implícita en 63 kg = (1 − 45,01/63) = 28,6 % > 20 % (sin aviso) y (68 − 63)/68 = 7,4 % (sin `WARN_OBJETIVO_MUY_LEJANO`). Método `grasa`; sugerido **58,5 kg** (rango 54,0–62,5; `mostrar_central = true`); **efectivo 63,0 kg**; hito `null`.
14. Cronograma **`null`** (`INFO_SIN_CRONOGRAMA`: en recomposición no se promete fecha). **Proyección de recomposición**: `ritmo_kg_sem` = 291,5 · 7/7 700 = **0,265 kg/sem**, `delta_kg` = 5,0, `sem_lineal` = 18,86 ⇒ **S = 19**, 20 puntos. Semana 0 = 68,0/68,0/68,0 · s4 = 66,9/67,5/68,0 · s8 = 65,9/66,9/68,0 · s12 = 64,8/66,4/68,0 · s19 = 63,0/65,5/68,0. Aviso `INFO_PROYECCION_RECOMP`.
15. FFMI = 16,5; normalizado = **16,8**; categoría `null` (banda `muy_alto`).
16. Reparto (4 comidas, peri = Merienda): Desayuno 25 % P35 G15 HC40 435 kcal · Comida 30 % P40 G15 HC35 435 kcal · Merienda 15 % P20 G10 HC30 290 kcal (peri) · Cena 30 % P40 G20 HC45 520 kcal.
17. Avisos: `INFO_CICLO`, `INFO_FIBRA_AJUSTADA`, `INFO_PROYECCION_RECOMP`, `INFO_RECOMP_PRIORIDAD_PERDER`, `INFO_SIN_CRONOGRAMA`, `WARN_PROTEINA_TOMA_ALTA`. **`INFO_OBJETIVO_IGNORADO` no se emite**: lo retira la regla del paso 17, porque aquí el peso objetivo sí se usa (es la meta de la curva).
19. `ciclo.sintomas = ['hinchazon','cansancio','sangrado_abundante']` (orden canónico, **no** el de entrada) y tres consejos en ese mismo orden. `cansancio` va **sin** el fragmento de low-carb (`low_carb = false`) y `sangrado_abundante` **con** el de la ferritina (porque `cansancio` está marcado). Alimentos: hinchazón → Plátano · Patata cocida · Espinacas · Calabacín; cansancio → Avena · Patata cocida · Lentejas o garbanzos · Fruta; sangrado abundante → Lentejas o garbanzos · Carne roja magra (ternera) · Mejillones o berberechos al natural · Espinacas.

**Comprobación obligatoria sobre este caso (S33):** `calcular` con y sin `menu_sencillo`, `alimentos_excluidos` y `alimentos_favoritos` devuelve el **mismo `Resultado` bit a bit**.

### Caso 18 — Hombre 38 años con plazo imposible: 15 kg en 8 semanas (v1.2, H)

Input: hombre, 38 años, 180 cm, 95 kg; grasa `desconocido`; sin somatotipo; actividad `sedentario`; sin entrenamiento; objetivo `perder`, ritmo **`suave`**; `peso_objetivo: 80`, **`plazo_semanas: 8`**; `preferencia_base: 'omnivoro'`; 3 comidas.

1. IMC = **29,3** → `sobrepeso`. 2. CUN-BAE = 29,4 % (fiabilidad `baja`, banda `muy_alto`). 3. MLG = **67,11 kg**. 4. BMR = **1890,0** (`mifflin`; Katch 1819,6). 5. PAL 1,40; TDEE = **2513,7**.
6. **Paso 6.7ter**: `ritmo_req` = |80 − 95| / 8 = **1,875 kg/sem**. Tabla 3.7[`muy_alto`]: suave 0,50 % → 0,475 kg/sem; moderado 0,75 % → 0,7125; agresivo 1,00 % → 0,95. **Ninguno llega** ⇒ `ritmo_ef = 'agresivo'` y **`WARN_PLAZO_IRREAL`** (el ritmo `suave` que había elegido el usuario se descarta). Ningún suavizado posterior aplica (edad < 65, sin `tca`, hombre).
7. Déficit por ritmo = 1,00 % · 95 · 1 100 = 1 045 kcal/día; techo = 30 % · TDEE = 754,1 ⇒ `INFO_DEFICIT_CAPADO_TDEE`; kcal_calc = 1759,6 < suelo BMR 1890 ⇒ **kcal = 1890** con `WARN_SUELO_CALORICO_BMR`.
8-11. **P = 160 g** (1,700 g/kg), **G = 70 g**, **HC = 155 g**, cierre **1890** (Δ 0); fibra **26 g**; azúcares libres máx. 47,3 g.
12. Agua: **2850 ml** (rango 2600–3100; 11 vasos).
13. Peso objetivo: método `grasa`; sugerido 79,0 kg (rango 72,5–85,0; **`mostrar_central = false`**, fiabilidad `baja`); efectivo **80,0 kg**; hito **85,5 kg** ((95 − 80)/95 = 15,8 % > 15 %).
14. Cronograma: `ritmo_kg_sem` = **0,5670** (0,60 %/sem), `delta_kg` = 15,0, `factor_adapt` = 1,2544, `diet_breaks` = 3, **semanas [30, 37]**, fechas 2027-04-05 … 2027-05-24, `precision_fecha = 'mes'`, `tramo_12sem` = [5,5; 7,0]. Proyección con cronograma, 27 puntos (tope de 26 semanas): s4 = 92,7/92,8/93,2 · s12 = 88,8/89,4/90,0 · s26 = 81,4/83,9/84,2.
15. FFMI = 20,7; normalizado **20,7**; categoría `null` (banda `muy_alto`).
16. Reparto (3 comidas, sin peri): Desayuno 30 % P50 G20 HC45 560 kcal · Comida 35 % P55 G25 HC55 665 kcal · Cena 35 % P55 G25 HC55 665 kcal.
17. Avisos: `INFO_ADAPTACION`, `INFO_DEFICIT_CAPADO_TDEE`, `INFO_GRASA_ESTIMADA`, **`WARN_PLAZO_IRREAL`**, `WARN_PROTEINA_TOMA_ALTA`, `WARN_SUELO_CALORICO_BMR`. El aviso se imprime con la variante "Hemos puesto el más rápido de nuestra tabla" (`ritmo_efectivo === 'agresivo'`) y con el fragmento del calendario relleno: **entre 30 y 37 semanas**, frente a las 8 pedidas.

### Caso 19 — Mujer 34 años con plazo holgado: 6 kg en 24 semanas (v1.2, H)

Input: mujer, 34 años, 168 cm, 78 kg; grasa `desconocido`; sin somatotipo; actividad `ligero`; fuerza 3 d × 50 min, intensidad media, intermedia, entrena por la tarde; objetivo `perder`, ritmo **`agresivo`**; `peso_objetivo: 72`, **`plazo_semanas: 24`**; `preferencia_base: 'omnivoro'`; 4 comidas; sin `menstruacion`.

1. IMC = **27,6** → `sobrepeso`. 2. CUN-BAE = 38,5 % (fiabilidad `baja`, banda `muy_alto`). 3. MLG = **48,01 kg**. 4. BMR = **1499,0** (`mifflin`). 5. Perfil `fuerza`; PAL 1,50; MET 5,0 → ejercicio/día 111,4; TDEE = **2241,9**.
6. **Paso 6.7ter**: `ritmo_req` = 6 / 24 = **0,25 kg/sem**. Tabla 3.7[`muy_alto`]: suave 0,50 % · 78 = **0,39 kg/sem ≥ 0,25** ⇒ gana el **primero** de la lista: `ritmo_ef = 'suave'` e **`INFO_RITMO_POR_PLAZO`**. El `agresivo` que había elegido la usuaria se descarta, y el aviso se lo dice.
7. Déficit = 0,50 % · 78 · 1 100 = 429 kcal (techo 25 % · TDEE = 560,5, no muerde) ⇒ kcal_calc = 1812,9; suelos: sexo 1200, BMR 1499, EA 30 · 48,01 + 111,4 = 1551,7, ninguno muerde. **kcal = 1810**.
8-11. **P = 155 g** (2,200 g/kg de base, `INFO_PROTEINA_CAPADA`), **G = 65 g**, **HC = 150 g**, cierre **1805** (Δ −5); fibra **25 g**; azúcares libres máx. 45,3 g.
12. Agua: **2750 ml** (rango 2500–3000; 11 vasos).
13. Peso objetivo: método `grasa`; sugerido 62,5 kg (rango 57,0–67,0; `mostrar_central = false`); efectivo **72,0 kg**; hito `null`.
14. Cronograma: `ritmo_kg_sem` = **0,3927** (0,50 %/sem), `delta_kg` = 6,0, `diet_breaks` = 1, **semanas [17, 19]** ⇒ **llega dentro de las 24 pedidas**, así que `INFO_RITMO_POR_PLAZO` se mantiene (si `semanas[0]` hubiera pasado de 24, el paso 17 lo habría cambiado por `WARN_PLAZO_IRREAL`). Fechas 2027-01-04 … 2027-01-18, `precision_fecha = 'mes'`, `tramo_12sem` = [4,0; 4,5]. Proyección de 20 puntos: s4 = 76,4/76,5/76,6 · s8 = 74,9/75,1/75,3 · s12 = 73,7/74,1/74,2.
15. FFMI = 17,0; normalizado **17,1**; categoría `null`.
16. Reparto (4 comidas, peri = Merienda): Desayuno 25 % P40 G15 HC40 455 kcal · Comida 30 % P45 G20 HC35 500 kcal · Merienda 15 % P25 G10 HC30 310 kcal (peri) · Cena 30 % P45 G20 HC45 540 kcal.
17. Avisos: `INFO_ADAPTACION`, `INFO_GRASA_ESTIMADA`, `INFO_PROTEINA_CAPADA`, **`INFO_RITMO_POR_PLAZO`**, `WARN_PROTEINA_TOMA_ALTA`.

### Resumen de salidas (para tests de regresión)

| Caso | kcal | P g | G g | HC g | Fibra | Agua ml | Peso obj. ef. | Semanas | BMR ecuación |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 2190 | 185 | 70 | 205 | 31 | 3250 | 74,5 | 21–25 | mifflin |
| 2 | 1740 | 120 | 50 | 205 | 25 | 2150 | 57,5 | — | mifflin |
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
| 15 | 1600 | 120 | 65 | 135 | 22 | 2750 | 68,0 | 20–22 | mifflin |
| 16 | 1830 | 130 | 65 | 180 | 26 | 2500 | 60,5 | — | katch_mcardle |
| 17 | 1680 | 135 | 60 | 150 | 24 | 2400 | 63,0 | — | mifflin |
| 18 | 1890 | 160 | 70 | 155 | 26 | 2850 | 80,0 | 30–37 | mifflin |
| 19 | 1810 | 155 | 65 | 150 | 25 | 2750 | 72,0 | 17–19 | mifflin |

Regenerar con `node docs/verify-vectors.mjs` (la tabla se imprime al final, bajo "RESUMEN DE SALIDAS"). El mismo script ejecuta un barrido aleatorio de 112 380 perfiles válidos —sobre la rejilla completa del dominio de la §1: alturas 130-230 cm y pesos 35-300 kg, y ahora también los dos formatos de preferencia, las cuatro prioridades de recomposición, las cinco respuestas de la regla, nueve ajustes manuales distintos y, desde la v1.2, ocho plazos y siete combinaciones de síntomas— contra **40 familias** de invariantes de seguridad y debe terminar con **0 violaciones**.

**Qué cambia y qué no con la v1.2.** Solo dos vectores anteriores se mueven, y solo en el bloque del peso objetivo y de la proyección: el **2** y el **16**, los dos de recomposición **con déficit real** (decisión H). Ningún otro número de ningún otro caso cambia: `plazo_semanas` y `sintomas_regla` por defecto son `null`, y `alimentos_excluidos`, `alimentos_favoritos` y `menu_sencillo` el motor no los lee (invariante S33). Lo único que crece en el resto de casos es la salida, que ahora puede traer `ciclo`.

**Los catorce vectores originales no cambian ni un número con la v1.1.** Es una consecuencia buscada del diseño: `recomposicion_prioridad` por defecto es `equilibrado` (tabla 3.9 tal cual), `menstruacion` por defecto es `null`, y la regla de traducción de la §1.1 aplicada al campo antiguo `preferencia` devuelve exactamente el mismo trío efectivo que leía la v1.0. Lo único que crece en esos catorce casos es la salida: ahora traen `proyeccion`, `limites_ajuste`, `preferencia_base`, `restricciones`, `low_carb` y `macros.pct_cap`.

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


---

### v1.2 — decisiones G-J del feedback real de una usuaria (2026-09-08)

Segunda tanda de feedback real (audios de una usuaria de 68 kg en recomposición con prioridad `perder`).
Cuatro decisiones; el motor solo se toca en tres.

| # | Decisión | Qué cambia en este documento |
|---|---|---|
| G | Alimentos favoritos y "no me gusta" | **Nada del motor.** `alimentos_excluidos` y `alimentos_favoritos` entran en la §1 como inputs que el motor **ignora** (como `menu_sencillo`), con su validación de dominio y el invariante **S33**. Todo el comportamiento vive en `SPEC-ux-comidas-pdf.md` §3.2b. La consecuencia para la UI es que `firmaDeInputs` tiene que ignorar los tres campos. |
| H | Peso objetivo, plazo y recomposición | Paso **6.7ter** (el plazo elige el ritmo discreto más suave que llega, y los suavizados de seguridad mandan sobre él), pasos **13** y **14** (la recomposición con déficit real propone y valida el peso objetivo como `perder` y dibuja su banda honesta, sin fecha), tres avisos nuevos y las reevaluaciones del paso 17. |
| I | Regla: síntomas y alimentos | `sintomas_regla` en la §1 y el paso **19** completo. Ni un número cambia. |
| J | Arreglos menores | Fuera del motor (`SPEC-ux-comidas-pdf.md` §2.6c y README). |

**Por qué el plazo elige un ritmo discreto y no uno continuo.** Un ritmo calculado a medida
(`ritmo_req` tal cual) rompería las tres cosas que sostienen la seguridad del motor: la tabla 3.7 está
acotada por banda de grasa, el techo del paso 7 está expresado como porcentaje del TDEE y los vectores
de la §5 comparan contra ritmos con nombre. Con la regla discreta, el plazo solo puede **elegir entre lo
que ya era seguro**, y cuando ni lo más rápido llega, lo dice en vez de inventarse una fecha.

**Los dos vectores que se mueven.** El 2 y el 16, y solo en el peso objetivo y en la proyección. Es la
consecuencia buscada de la decisión H: los dos son recomposiciones con déficit real, y hasta la v1.1
recibían como "peso objetivo" su propio peso actual y una raya horizontal mientras el informe les decía
que llevaban déficit.

### v1.1 — decisiones A-F del feedback real de usuarios (2026-09-07)

No es una ronda de revisión adversaria: son seis decisiones ya tomadas por el dueño del producto a partir
del uso real, implementadas aquí sin discutirlas. Resumen de lo que toca a este documento:

| # | Decisión | Qué cambia en el motor |
|---|---|---|
| A | Fuera el cribado de "relación con la comida" (paso 5b del wizard) | **Nada de cálculo.** `cribado_tca` pasa a ser un campo *no expuesto* (§1 fila 17 y recuadro de la §1.1): la UI escribe siempre `null`. Las reglas de `'tca'` se conservan íntegras porque siguen siendo alcanzables por `condiciones` y el caso 2 de la §5 las usa. Todo lo que desaparece vive en `SPEC-ux-comidas-pdf.md` |
| B | Ajuste manual de macros | **Paso 18 nuevo** (`ajustarMacros`), `Resultado.limites_ajuste` y `Resultado.ajuste`, tres avisos nuevos y una regla de supresión |
| C | Recomposición con prioridad | Input `recomposicion_prioridad`; paso 7 (déficit ±5 puntos, tope 15 %, o cero) con exención de la regla de margen; paso 9 (grasa 28 → 33 % con prioridad `perder`); dos avisos informativos; tabla 3.9 con tres filas |
| D | Regla (solo mujeres) | Input `menstruacion`; único efecto numérico en el paso 6.7bis (agresivo → moderado, **solo en `perder` y `recomposicion`**); `INFO_CICLO` y `WARN_CICLO_AUSENTE` evaluados en el paso 17 |
| E | Preferencias combinables | Inputs `preferencia_base`, `restricciones`, `low_carb`; regla de traducción y regla inversa de la §1.1; los pasos 8, 9, 10, 11 y 17 pasan a leer `pref_base` y `low_carb_efectivo` en vez de `preferencia` |
| F | Proyección y seguimiento | **Paso 14b nuevo**, `Resultado.proyeccion`, `INFO_PROYECCION_PLANA`. El seguimiento de pesajes es `localStorage` y no toca el motor |

**Estado tras la v1.1:** `node docs/verify-vectors.mjs` → **16 vectores** sin incoherencias y **0 violaciones**
en 115 033 perfiles del barrido, con **36 familias** de invariantes (nuevas: S26 proyección, S27 ajuste
manual, S28 regla, S29 preferencias combinables). **Los catorce vectores de la v1.0 conservan todos sus
números**; lo único que cambia en ellos es que la salida trae los campos nuevos.

**Cierre de la v1.1 (revisión final).** Cuatro invariantes se endurecieron porque certificaban de más:

- **S27m** compara ahora el `Resultado` **entero** (con los avisos ordenados), no tres campos. "Bit a bit"
  incluye los avisos: comparando solo `kcal`, `grasa_g` y `hc_g` no se veía que `WARN_KCAL_AJUSTE_ALTA`
  apareciera con el ajuste vacío y borrase el `WARN_DEFICIT_MINIMO` del motor.
- El generador de ajustes del barrido prueba **siempre** los extremos que el panel alcanza de verdad —el
  ajuste vacío, `{kcal: kcal_min}` y `{kcal: kcal_min, hc_g: <techo>}`— y, cada 32 perfiles, el barrido
  completo del deslizador de hidratos en pasos de 5 g. Ahí es donde el cierre del paso 18 se salía del 2 %.
- **S28** solo exige que no quede ritmo `agresivo` en planes con déficit; **S28c**, nuevo, comprueba lo
  contrario en `ganar`: que el ritmo elegido **no** se haya suavizado.
- **S27d** (la grasa nunca baja del suelo) se mantiene, y ahora es consecuencia directa del techo de
  hidratos en vez de depender del `roundUp5` correctivo del punto 3.

**Deuda saldada de paso:** `macros.pct_cap` —que `CONTRATO.md` declara desde la ronda de cierre— no estaba
en la salida de `verify-vectors.mjs`. Ahora sí, capturado en el paso 8, que es donde el cap se aplica.
