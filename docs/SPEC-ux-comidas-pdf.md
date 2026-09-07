# Báscula (RS Agents) — Especificación de UX, comidas y PDF v1.0

Documento normativo complementario a `SPEC-calculo.md`. Cubre el cuestionario (wizard), la pantalla de resultados, el generador de ejemplos de comidas y la estructura del PDF exportable. Todo el copy está en español de España, tono cercano y honesto, sin paternalismo. Ningún mensaje afirma cosas que la ciencia no respalda (p. ej. nunca se dice que más comidas "aceleran el metabolismo", ni que el somatotipo determina tus macros).

Convención de referencias: `[Paso N]` remite al algoritmo de `SPEC-calculo.md`; `[Código]` remite a la tabla de mensajes de la sección 4 de ese documento.

---

## 1. Flujo del cuestionario (wizard)

### 1.0 Principios de diseño del wizard

- **Una pregunta (o grupo muy corto) por pantalla.** Nunca un formulario largo de una vez: reduce la carga cognitiva y permite validar y ramificar al momento.
- **Orden de fácil a difícil**, con las preguntas de corte de seguridad muy pronto (edad, embarazo/lactancia) para no hacer perder el tiempo a quien no puede usar la app.
- **Nunca bloquear en silencio.** Si una respuesta desvía el flujo (exclusión, aviso, valor por defecto), se explica en la misma pantalla, con un tono de acompañamiento, nunca de rechazo.
- **Todo paso es editable después** desde la pantalla de resultados ("Editar tus datos"), sin tener que repetir el wizard entero.
- **Barra de progreso con total dinámico.** El denominador NO es una constante: se calcula con las respuestas ya dadas (`total = pasos_obligatorios + pasos_condicionales_que_aplican`) y se recalcula en cuanto una respuesta cambia la ramificación. Pasos obligatorios: 1, 2, 4, 5, 5b, 6, 8, 9, 10, 13 (10 pantallas). Condicionales: 3 (solo `sexo = 'mujer'`), 7 (solo si el usuario no lo salta; cuenta como 1 aunque tenga 4 preguntas), 11 (solo si `objetivo ∈ {perder, ganar, no_se}`), 12 (solo si `objetivo ∈ {perder, ganar, no_se}` **y** `cribado_tca ∉ {positivo, evitado}`). El texto accesible es "Paso X de {total}" con el total ya resuelto; mientras el objetivo sea desconocido se asume que 11 y 12 aplican, y el total se recalcula en cuanto se responde el paso 5b (si el cribado sale `positivo` o `evitado`, el 12 deja de contar: sin este recálculo esos usuarios terminaban el wizard en "Paso N-1 de N"). El paso 5b conserva su etiqueta interna pero se numera de forma correlativa de cara al usuario (es la pantalla 6 de la secuencia visible en un hombre).
- **Botón "Atrás" siempre visible** salvo en el paso 1. El botón "Siguiente" se deshabilita hasta que la pregunta tiene una respuesta válida (o hay un valor por defecto explícito y visible).
- **Ayuda contextual** (icono "¿Por qué lo preguntamos?") en cada pantalla: un texto corto que explica para qué sirve el dato, sin tecnicismos. Nunca oculta información; es opcional de leer.

### 1.1 Mapa de pasos

| Paso | Pantalla | Campo(s) de `InputCalculo` | Corte de seguridad |
|---|---|---|---|
| 1 | Sexo | `sexo` | No |
| 2 | Edad | `edad` | Sí: <18 o >75 → `EXCL_EDAD` |
| 3 | Embarazo o lactancia (solo mujeres, sin filtro de edad) | `embarazo_lactancia` | Sí: true → `EXCL_EMBARAZO_LACTANCIA` |
| 4 | Altura y peso | `altura_cm`, `peso_kg` | No |
| 5 | Condiciones médicas | `condiciones` | No (activa avisos) |
| 5b | Relación con la comida (cribado breve) | (no numérico; ver 1.2.5b) | No (activa `INFO_RITMO_SUAVE` vía `condiciones: ['tca']` si aplica) |
| 6 | Porcentaje de grasa corporal | `grasa.*` | No |
| 7 | Somatotipo (opcional) | `somatotipo` | No |
| 8 | Actividad diaria | `actividad_diaria` | No |
| 9 | Entrenamiento | `entrenamiento.*` | No |
| 10 | Objetivo | `objetivo` | No |
| 11 | Ritmo (si aplica) | `ritmo` | No |
| 12 | Peso objetivo (si aplica) | `peso_objetivo` | No |
| 13 | Preferencia dietética, nº de comidas, clima y comidas sencillas | `preferencia`, `n_comidas`, `clima_caluroso`, `menu_sencillo` | No |

Tras el paso 13: pantalla de "Calculando…" (proceso instantáneo, pero se muestra 600-900 ms de transición con un mensaje breve, p. ej. "Ajustando tus macros…") y salto directo a Resultados.

---

### Paso 1 — Sexo

**Pregunta:** "¿Cuál es tu sexo?"

**Opciones:** Hombre / Mujer.

**Descripción operativa (ayuda contextual):** "Lo usamos porque las fórmulas de gasto energético y de estimación de grasa corporal son distintas entre hombres y mujeres. Todavía no tenemos fórmulas validadas para otras opciones; en cuanto existan, las añadiremos."

**Validación:** obligatorio, una opción. Sin ella no se avanza.

**Lógica condicional:** si `sexo = 'mujer'`, el paso 3 (embarazo/lactancia) se muestra; si `sexo = 'hombre'`, el paso 3 se omite.

---

### Paso 2 — Edad

**Pregunta:** "¿Cuántos años tienes?"

**Input:** numérico, entero, teclado numérico en móvil.

**Ayuda contextual:** "La edad influye en tu metabolismo basal y en cuánta proteína necesitas para mantener el músculo. Báscula está pensada para adultos de 18 a 75 años."

**Validación en tiempo real:**
- Vacío o no numérico → botón deshabilitado, sin mensaje de error agresivo.
- `< 18` o `> 75` (al perder el foco o pulsar Siguiente) → pantalla de derivación de pantalla completa (sustituye al wizard, no es un simple mensaje de error):

  > **No podemos calcular tu plan todavía**
  > "Báscula está pensada para personas adultas de 18 a 75 años. Fuera de ese rango las necesidades cambian mucho: consulta con tu médico o con un/a dietista-nutricionista." `[EXCL_EDAD]`
  >
  > Botón único: "Volver al inicio".

- `13-17` o `76-90` (fuera de rango pero verosímil): mismo mensaje, sin distinción — no se especula sobre "casi".
- Fuera de `0-120`: error de formato simple ("Introduce una edad válida") sin más.

---

### Paso 3 — Embarazo o lactancia (condicional: solo si `sexo = 'mujer'`)

**Pregunta:** "¿Estás embarazada o en periodo de lactancia?"

**Opciones:** Sí / No.

**Ayuda contextual:** "El embarazo y la lactancia cambian tanto las necesidades nutricionales que no pueden calcularse con una calculadora general."

**Lógica condicional:**
- `Sí` → pantalla de derivación de pantalla completa:

  > **Este momento merece un cuidado especial**
  > "Durante el embarazo y la lactancia las necesidades nutricionales cambian por completo y no deben calcularse con una calculadora genérica. Consulta con tu matrona, tu médico o un/a dietista-nutricionista." `[EXCL_EMBARAZO_LACTANCIA]`
  >
  > Botón único: "Volver al inicio".

- `No` → continúa al paso 4.

No se pregunta a hombres ni se pregunta la edad fértil explícitamente: se muestra siempre que `sexo = 'mujer'`, sin importar la edad (evita suposiciones incómodas o intrusivas sobre fertilidad; el coste de preguntar de más es menor que el de asumir).

---

### Paso 4 — Altura y peso

**Preguntas (misma pantalla):**
- "¿Cuánto mides?" — input numérico, **cm**, sin selector de unidades.
- "¿Cuánto pesas?" — input numérico, **kg**, sin selector de unidades.

**Unidades (normativo):** la v1 trabaja solo en centímetros y kilogramos, en coherencia con `SPEC-calculo.md` §0.1 ("nunca se calcula en libras/pulgadas") y con el público objetivo (España, sistema métrico). No hay conversión de pies/pulgadas ni de libras en ninguna pantalla, así que los mensajes de error de rango se escriben directamente en cm y kg. Si en una versión futura se añaden unidades imperiales, la conversión se hará al perder el foco con `cm = round1(pies · 30,48 + pulgadas · 2,54)` y `kg = round1(lb · 0,45359237)`, se validará sobre el valor ya convertido y el mensaje de error se mostrará en la unidad que el usuario esté usando.

**Ayuda contextual:** "Tu altura y tu peso son la base de todos los cálculos: cuánta energía necesitas, cuánta proteína y cuánta agua."

**Validación:**
- Altura fuera de 130-230 cm → "Revisa tu altura: parece fuera de un rango que podamos calcular con seguridad." `[ERR_INPUT_RANGO]`
- Peso fuera de 35-300 kg → "Revisa tu peso: parece fuera de un rango que podamos calcular con seguridad." `[ERR_INPUT_RANGO]`
- Ambos obligatorios.

**Cuándo se pinta el error de rango (normativo, vale para todos los campos numéricos).** Mientras se escribe no se enseña nada:
tecleando "178" el usuario veía un error rojo tras el "1" y tras el "17". El error aparece **al perder el foco**, cuando el motor
marca el campo (`ERR_INPUT_RANGO`) o, además, **en cuanto el número escrito supera el techo del rango**, porque a partir de ahí
ningún dígito más puede volverlo válido. Sin esta tercera condición, quien escribe 300 cm de altura se queda con "Siguiente"
en gris, `aria-invalid="false"` y ninguna explicación; y en móvil pulsar el botón deshabilitado —el gesto natural— ni siquiera
saca el foco del campo, así que el error nunca llega a mostrarse.

**Microcopy adicional:** debajo del input de peso, texto pequeño: "Puedes actualizarlo cuando quieras: recalcularemos tu plan con tu peso real."

---

### Paso 5 — Condiciones médicas

**Pregunta:** "¿Tienes alguna de estas condiciones?"

**Opciones (checkbox múltiple, no excluyentes):**

| Opción en pantalla | Valor en `condiciones` |
|---|---|
| Diabetes (tipo 1 o 2) | `diabetes` |
| Enfermedad renal | `renal` |
| Enfermedad hepática | `hepatica` |
| Insuficiencia cardiaca | `cardiaca` |
| Hipertensión o enfermedad cardiovascular en tratamiento | `hipertension` |
| Problemas de tiroides | `tiroides` |
| Cirugía de estómago (bariátrica) | `bariatrica` |
| Medicación para adelgazar tipo Ozempic, Wegovy o Mounjaro | `glp1` |
| Otra condición o tomo medicación | `otra` |
| Ninguna de las anteriores (excluyente: al marcarla se desmarcan las demás, y viceversa) | — |

**Insuficiencia cardiaca e hipertensión son dos opciones distintas y no deben fundirse en una.** Solo `cardiaca` suprime el objetivo de agua (`[Paso 12]`), porque la restricción hídrica es tratamiento estándar en insuficiencia cardiaca; `hipertension` no la suprime y lo que activa es el aviso de sodio. Ofrecerlas juntas dejaba sin objetivo de hidratación a cualquier persona con la tensión alta, que es una parte enorme del público y no lo necesita.

**Ayuda contextual:** "No usamos esta información para bloquear tu plan, solo para avisarte de cosas importantes antes de que lo apliques. Nunca sustituye a tu equipo médico."

**Validación:** obligatorio elegir al menos una opción (incluida "Ninguna").

**Lógica condicional:** cada opción marcada añade el valor correspondiente a `condiciones` y activa su aviso en resultados (`WARN_DIABETES`, `WARN_RENAL`, `WARN_HEPATICA`, `WARN_CARDIACA`, `WARN_HIPERTENSION`, `WARN_TIROIDES`, `WARN_BARIATRICA_GLP1`, `WARN_CONDICION_OTRA`), sin bloquear el cálculo. Además: `diabetes` anula la preferencia `low_carb` (`WARN_LOWCARB_DIABETES`); `renal` y `cardiaca` suprimen el objetivo de agua (`[Paso 12]`, `INFO_AGUA_NO_PRESCRITA`); `renal` capa la proteína a 1,0 g/kg de peso corporal como último filtro (`[Paso 8]`); `bariatrica` y `glp1` **suben** el suelo de proteína a 1,5 g/kg de `base`. Todo se explica en resultados con el aviso correspondiente, nunca en silencio.

**Nota de cobertura (limitación declarada).** Desde la reconciliación del 2026-09-07 el motor sí define `tiroides`, `bariatrica`, `glp1`, `hipertension` y `otra` en `Condicion` (`SPEC-calculo.md` §0.3 y §1 fila 16), así que las cinco son ya opciones reales del cuestionario y no un texto fijo. Lo que sigue siendo cierto y hay que decir es que **Báscula no ajusta el cálculo a ninguna de ellas más allá de lo anotado arriba**: bajo las opciones se mantiene el texto fijo, no interactivo, "Estas condiciones cambian de verdad tus necesidades y ninguna calculadora general puede afinarlas: enséñale este plan a tu médico o a un/a dietista-nutricionista antes de aplicarlo." Ese texto se repite íntegro en el bloque de avisos de resultados y en el PDF.

---

### Paso 5b — Relación con la comida (cribado breve, siempre visible)

**Dos preguntas en la misma pantalla** (dos ítems, no uno: un único ítem no validado tiene una sensibilidad claramente peor que un instrumento de varios ítems como el SCOFF, validado en español; dos ítems son el compromiso entre sensibilidad y longitud del wizard):

1. "¿Alguna vez la comida o el peso te han generado mucha ansiedad o preocupación?"
2. "¿Dirías que la comida o el peso ocupan tu cabeza gran parte del día?"

**Opciones de cada pregunta:** Sí / Prefiero no responder / No.

**Subtexto (normativo, sustituye a la antigua promesa de privacidad):** "Solo la usamos para ajustar el ritmo de tu plan. En tu informe verás una nota diciendo que hemos aplicado el ritmo más suave, pero **no aparece esta pregunta ni tu respuesta**."

> La versión anterior prometía que la respuesta "es privada y no aparece en tu informe" y a la vez imprimía el antiguo `WARN_TCA` —un texto que explicitaba el motivo— en la página 2 del PDF. El PDF es un documento que el usuario imprime, comparte o deja en un ordenador familiar: la promesa se rompía. Se corrige por los dos lados: se rebaja lo que se promete (arriba) y se elimina de la salida cualquier rastro del cribado (abajo).

**Ayuda contextual (enlace discreto, visible siempre, no solo si se marca "Sí"):** "Si en algún momento la comida o el peso te generan mucha ansiedad, no tienes que gestionarlo solo/a: puedes hablar gratis con ADANER (Asociación en Defensa de la Atención a la Anorexia y la Bulimia) o con tu centro de salud." Este enlace se repite igual en el pie de la pantalla de resultados y en el PDF, independientemente de la respuesta, precisamente para que su presencia no revele nada.

**Lógica condicional (cribado precautorio):**

| Respuestas | `cribado_tca` | Efecto |
|---|---|---|
| Al menos un `Sí` | `positivo` | Se añade `'tca'` a `condiciones` |
| Ningún `Sí` y al menos un `Prefiero no responder` | `evitado` | Se añade `'tca'` a `condiciones` (**mismo trato que un `Sí`**) |
| Dos `No` | `negativo` | No se añade nada |

La evitación se trata como un positivo porque es la respuesta más probable de quien tiene un trastorno activo: dejarla sin efecto convertía la opción más protectora del usuario en la menos protegida. **Esto no se le dice con ese marco**: la pantalla no cambia de tono, no aparece ningún mensaje distinto y "Prefiero no responder" sigue siendo una opción de primera clase con el mismo estilo visual que las otras dos.

**Consecuencias de `cribado_tca ∈ {positivo, evitado}`** (todas silenciosas, ninguna se anuncia como consecuencia de esta pantalla):

1. `'tca' ∈ condiciones` → el motor fuerza `ritmo_ef = 'suave'` sea cual sea el objetivo (`[Paso 6.7]`) y excluye el cálculo si `IMC < 18,5` (`EXCL_TCA_RIESGO`, `[Paso 0]`).
2. **Se salta el paso 6.C** (selector visual de siluetas) y se usa directamente `grasa.metodo = 'desconocido'`: comparar el propio cuerpo con siluetas es un desencadenante documentado. Al usuario se le presenta como una simplificación del flujo, no como una restricción (ver paso 6).
3. **En resultados y en el PDF se ocultan el %grasa estimado y el peso objetivo** (bloques §2.1 tercera fila y §2.6), y en su lugar se muestran calorías, macros, agua, reparto por comidas y menús. El cronograma tampoco se muestra.
4. **`'tca'` nunca se serializa**: no aparece en la tabla de datos de entrada del PDF (§4.2), ni en la lista de condiciones de ninguna pantalla, ni en el nombre de fichero, ni en ningún metadato del PDF.
5. El motor **ya no emite `WARN_TCA`**: emite `INFO_RITMO_SUAVE`, un aviso de severidad `info` cuyo texto —el de la tabla §4 de `SPEC-calculo.md`, que es la única copia normativa y no se reproduce aquí— no menciona la causa ni habla de "ritmo" (R5-18 lo reescribió precisamente porque en `mantener` y `recomposicion` el motor ignora el ritmo, §1 campo 10, y §2.1 ni siquiera imprime el sufijo). La pantalla y el PDF lo imprimen **íntegro, como cualquier otro aviso**, en el grupo de notas informativas; ya no hace falta ninguna sustitución de texto en la capa de presentación. El enlace de ADANER ya es un pie fijo universal (§2.10), así que su presencia no distingue a este usuario de ningún otro.

**Nota de diseño:** las preguntas se formulan una sola vez, en tono neutro, sin iconografía alarmante (no usar caras tristes ni colores de "alerta"). Colocarlas justo después de las condiciones médicas y antes de pedir el %grasa (que puede ser sensible para algunas personas) reduce la sorpresa.

---

### Paso 6 — Porcentaje de grasa corporal

**Pregunta:** "¿Sabes tu porcentaje de grasa corporal?"

**Opciones (tarjetas grandes, con icono):**
1. **"Sí, lo sé"** → `grasa.metodo = 'conocido'`
2. **"Puedo medirme con cinta métrica"** → `grasa.metodo = 'medidas'`
3. **"No lo sé, ayúdame a estimarlo"** → `grasa.metodo = 'visual'`
4. **"Prefiero que lo estiméis por mi altura y peso"** → `grasa.metodo = 'desconocido'`

**Ayuda contextual (siempre visible, no plegada):** "Ninguna fórmula sin aparato mide la grasa corporal con precisión absoluta: te daremos siempre un rango, no una cifra exacta. Cuanto mejor sea el dato de partida, más ajustado será tu plan."

**Condicional por el cribado del paso 5b:** si `cribado_tca ∈ {positivo, evitado}`, la opción 3 ("No lo sé, ayúdame a estimarlo") **no se ofrece** y el bloque 6.C no existe en ese recorrido. La pantalla muestra solo las opciones 1, 2 y 4, sin ninguna explicación que delate el motivo; si el usuario no elige ninguna y pulsa "Siguiente", se aplica `grasa.metodo = 'desconocido'` (opción 4).

#### 6.A Si "Sí, lo sé" (`conocido`)

- Input numérico: "¿Qué porcentaje de grasa tienes?" (rango 3-70, con teclado numérico y slider opcional).
- Pregunta siguiente, con opciones tipo radio: "¿Cómo lo has obtenido?"
  - "Con una prueba profesional (DEXA, bioimpedancia de clínica o pliegues cutáneos hechos por un profesional)" → `fuente = 'fiable'`
  - "Con una báscula de bioimpedancia doméstica, una app o a ojo" → `fuente = 'estimado'`
- **Microcopy de honestidad si elige "profesional":** "Perfecto: con un dato fiable podemos usar una fórmula más precisa para tu metabolismo basal (Katch-McArdle)."
- **Microcopy si elige "doméstica/app/a ojo":** "Vale, lo usaremos igualmente, pero como estimación: las básculas domésticas pueden tener errores de varios puntos. Usaremos la fórmula estándar (Mifflin-St Jeor), que es más fiable cuando el %grasa no es un dato de precisión clínica."
- Validación: `valor` obligatorio, 3-70; fuera de rango → "Revisa el dato: un porcentaje de grasa fuera de 3-70% no es habitual. Si no estás seguro/a, elige 'No lo sé, ayúdame a estimarlo'."

#### 6.B Si "Puedo medirme con cinta métrica" (`medidas`)

Pantalla con ilustración de dónde medir (cuello, cintura, y cadera si es mujer):

- "Cuello (cm)": ayuda "Mide justo debajo de la laringe (la 'nuez'), con la cinta ligeramente inclinada hacia abajo por delante." Rango 25-60.
- "Cintura (cm)": ayuda "Mide a la altura del ombligo, después de soltar el aire, sin apretar la cinta." Rango 50-200.
- "Cadera (cm)" (solo si `sexo = 'mujer'`): ayuda "Mide en el punto de mayor anchura de las caderas/glúteos." Rango 60-200.

**Validación cruzada:** si `sexo = 'mujer'` y falta `cadera_cm` → error de validación, no se puede avanzar.

**Manejo de medidas inválidas (detectado tras el cálculo, `[Paso 2]`):** si las medidas producen `x < 15` (hombre) / `x < 60` (mujer) o un resultado fuera de 3-60%, no se bloquea: se usa automáticamente la estimación por altura/peso y, en resultados, se muestra: "Las medidas de cuello, cintura y cadera no cuadran entre sí. Hemos estimado tu grasa corporal a partir de tu altura, peso y edad; revisa las medidas si quieres más precisión." `[WARN_MEDIDAS_INVALIDAS]`

#### 6.C Si "No lo sé, ayúdame a estimarlo" (`visual`)

**Pregunta:** "Elige la silueta o descripción que más se parezca a tu cuerpo ahora mismo."

**Selector visual** (5 tarjetas con silueta ilustrada + descripción, según sexo, tabla 3.3 del motor):

*Hombres:*
| Tarjeta | Descripción (copy) |
|---|---|
| Muy definido | "Abdominales muy marcados, venas visibles en brazos o abdomen" |
| Definido | "Abdominales visibles pero poco marcados, silueta atlética" |
| Medio | "Abdomen liso sin marcar, silueta normal" |
| Con sobrepeso visible | "Acumulación abdominal visible, cintura por encima de la cadera" |
| Con obesidad visible | "Acumulación de grasa evidente en abdomen, pecho y cara" |

*Mujeres:*
| Tarjeta | Descripción (copy) |
|---|---|
| Muy definida | "Definición muscular visible (no es el objetivo por defecto de la mayoría de mujeres, y no pasa nada si no es tu caso)" |
| Tonificada | "Silueta tonificada con algo de definición" |
| Media | "Curvas normales sin marcación muscular" |
| Con sobrepeso visible | "Acumulación de grasa visible en cadera, muslos y abdomen" |
| Con obesidad visible | "Acumulación evidente y generalizada" |

**Microcopy bajo el selector:** "Es normal dudar entre dos opciones: elige la que se parezca más. El margen de error de este método es de unos ±5 puntos, y te lo indicaremos siempre como rango."

#### 6.D Si "Prefiero que lo estiméis por mi altura y peso" (`desconocido`)

Sin pantalla adicional: se usa directamente CUN-BAE. Microcopy de confirmación antes de avanzar: "Vale, estimaremos tu grasa corporal solo con tu altura, peso, edad y sexo (fórmula CUN-BAE). Es la opción menos precisa, pero suficiente para empezar; siempre podrás afinarla más adelante."

---

### Paso 7 — Somatotipo (opcional)

**Pantalla de introducción (antes de las 4 preguntas):**

> **Esto es opcional, y no es una prescripción científica**
> "El somatotipo (ectomorfo, mesomorfo, endomorfo) es una forma antigua de describir la silueta corporal. La ciencia actual no ha demostrado que sirva para calcular calorías o macros con precisión. Si lo rellenas, lo usaremos solo como un ajuste ligero entre carbohidratos y grasa, nunca para decidir cuántas calorías o cuánta proteína necesitas."
>
> Botones: "Prefiero saltarlo" (avanza con `somatotipo = null`) / "Vale, son solo 4 preguntas".

**Si continúa, 4 preguntas de opción única (tarjetas), formuladas como recuerdo histórico, no como autoevaluación estética actual:**

1. "¿Cómo describirías la estructura de tus muñecas y tobillos?" → Fina / Media / Ancha (`q1`)
2. "Históricamente, ¿te ha costado poco o mucho ganar grasa corporal cuando comes de más?" → Poca facilidad / Facilidad moderada / Mucha facilidad (`q2`)
3. "Históricamente, ¿te ha costado poco o mucho ganar músculo cuando entrenas fuerza?" → Poca facilidad / Facilidad moderada / Mucha facilidad (`q3`)
4. "Sin entrenar ni cuidar la alimentación, ¿cuál describe mejor tu apariencia habitual?" → Delgado/a / Atlético/a / Robusto/a (`q4`)

**Validación:** si empieza el bloque, las 4 son obligatorias (o vuelve a `null` si abandona el bloque con "Prefiero saltarlo", disponible en todo momento dentro del bloque).

---

### Paso 8 — Actividad diaria (sin contar el entrenamiento)

**Pregunta:** "Sin contar el ejercicio que hagas de forma programada, ¿cómo describirías tu día a día?"

**Ayuda contextual:** "Esto es la mayor diferencia real de gasto energético entre dos personas: no es lo mismo un trabajo de oficina que uno de reparto, aunque ninguno de los dos entrene."

**Opciones (tarjetas, tabla 3.4 del motor):**
| Opción | Copy |
|---|---|
| Sedentario | "Trabajo sentado, me muevo poco (menos de 5.000 pasos al día)" |
| Ligero | "De pie parte del día o camino algo (5.000-7.500 pasos)" |
| Moderado | "Trabajo activo o camino bastante (7.500-10.000 pasos)" |
| Alto | "Trabajo físico o camino mucho (10.000-12.500 pasos)" |
| Muy alto | "Trabajo físico intenso: obra, reparto, agricultura (más de 12.500 pasos)" |

**Validación:** obligatorio, una opción. Por defecto (si el usuario nunca ha usado podómetro): recomendar en el propio copy "Si no llevas la cuenta de pasos, piensa en cuánto te mueves un día normal de trabajo, no un día de gimnasio."

---

### Paso 9 — Entrenamiento

**Pregunta inicial:** "¿Entrenas de forma regular?"

**Opción "No entreno actualmente"** → `entrenamiento = { tipo: 'ninguno', dias_semana: 0, minutos_sesion: 60, intensidad: 'media', experiencia: 'novato', momento: null }`, salta directamente al paso 10.

**Opción "Sí, entreno"** → continúa con:

1. "¿Qué tipo de entrenamiento haces principalmente?"
   - Fuerza (pesas, calistenia, máquinas)
   - Cardio (correr, bici, nadar, elíptica)
   - Mixto (crossfit, clases dirigidas, combinación de ambos)
2. "¿Cuántos días a la semana?" — slider o stepper **0-7** (el 0 es un valor válido y seleccionable: ver la nota de validación de más abajo).
3. "¿Cuánto dura cada sesión, de media?" — slider o stepper 10-240 min (por defecto 60).
4. "¿Cómo describirías la intensidad?" con anclas del propio tipo elegido (tabla 3.5):
   - Si `fuerza`: Baja "Máquinas, descansos largos" / Media "Pesos libres, series cerca del fallo" / Alta "Circuitos, descansos cortos"
   - Si `cardio`: Baja "Andar rápido, bici suave" / Media "Trote, bici moderada, natación" / Alta "Correr rápido, HIIT, spinning"
   - Si `mixto`: única ancla "Mezcla de fuerza y cardio en la misma sesión (crossfit, clases dirigidas)" con las 3 intensidades genéricas.
5. "¿Cuánto tiempo llevas entrenando de forma constante?"
   - "Menos de 1 año" → `novato`
   - "Entre 1 y 4 años" → `intermedio`
   - "Más de 4 años" → `avanzado`
   - Ayuda: "Esto afecta a cuánto superávit calórico tiene sentido si tu objetivo es ganar músculo: cuanta más experiencia, menos margen de crecimiento y menos superávit necesitas."
6. "¿Prefieres entrenar en algún momento del día en concreto?" (opcional)
   - Mañana / Mediodía / Tarde / Noche / "No tengo preferencia" (→ `momento = null`)
   - Ayuda: "Si nos lo dices, adelantaremos un poco de carbohidrato a la comida más cercana a tu entrenamiento."

**Validación:** si `tipo ≠ 'ninguno'`, `dias_semana`, `minutos_sesion` e `intensidad` son obligatorios. Si el usuario pone `dias_semana = 0` con un tipo elegido, se acepta y se trata como `ninguno` (perfil sedentario) sin mensaje de error, con una nota suave: "Con 0 días a la semana, lo calculamos igual que si no entrenaras: dinos los días reales cuando empieces."

---

### Paso 10 — Objetivo

**Pregunta:** "¿Cuál es tu objetivo principal ahora mismo?"

**Opciones (tarjetas grandes):**
- "Perder grasa" → `objetivo = 'perder'`
- "Mantenerme" → `objetivo = 'mantener'`
- "Ganar músculo" → `objetivo = 'ganar'`
- "Recomposición: perder grasa y ganar músculo a la vez" → `objetivo = 'recomposicion'`
  - Ayuda inline: "Funciona mejor si tienes poca experiencia entrenando fuerza o si tu porcentaje de grasa ya es bajo. Los cambios son más lentos que en una fase específica, y es lo esperable."
- "No lo tengo claro, decídelo vosotros" → `objetivo = 'no_se'`
  - Ayuda inline: "Miraremos tu composición corporal y tu entrenamiento para proponerte lo más sensato. Podrás cambiarlo después."

**Validación:** obligatorio, una opción.

**Lógica condicional posterior (no visible en el wizard, ocurre en el motor, `[Paso 6]`):** el objetivo elegido puede reconvertirse automáticamente (p. ej. `perder` con IMC bajo → `mantener`; `perder` con grasa ya baja → `recomposicion`). Esto **no se pregunta de nuevo** en el wizard: se explica en resultados con el aviso correspondiente (`WARN_IMC_BAJO_NO_DEFICIT`, `WARN_YA_MAGRO`, etc.), nunca como un error del usuario.

---

### Paso 11 — Ritmo (condicional: se omite si `objetivo ∈ {mantener, recomposicion}`)

**Pregunta:** "¿A qué ritmo quieres avanzar?"

**Opciones:**
- "Suave — el cambio será más lento, pero más fácil de mantener" → `ritmo = 'suave'`
- "Moderado — un equilibrio entre velocidad y comodidad" → `ritmo = 'moderado'`
- "Agresivo — más rápido, pero exige más disciplina y hambre" → `ritmo = 'agresivo'`

**Ninguna opción viene marcada** y "Siguiente" está deshabilitado hasta que se elige una (QA §1). "Moderado" estuvo preseleccionado y no debía estarlo: a diferencia del número de comidas, del clima o de los deslizadores del entrenamiento —valores medios que no cambian el plan de forma sustantiva—, el ritmo elige el tamaño del déficit y con él el cronograma entero, así que dejarlo marcado permitía atravesar el paso sin responderlo y llevarse el plan de otra persona. `moderado` sigue siendo el valor que recibe el motor cuando el paso **no se muestra** (objetivos que no usan ritmo): eso lo resuelve la conversión a `InputCalculo`, no el estado del formulario.

**Ayuda contextual:** "El ritmo no es solo una preferencia: cuanta menos grasa tengas de partida, menos margen hay para ir rápido sin perder músculo. Ajustaremos el número final a un rango seguro para tu caso."

**Nota si `'tca' ∈ condiciones`:** las tres opciones siguen visibles y con el mismo estilo (no se sanciona ni se delata la respuesta del paso 5b), pero si el usuario elige algo distinto de "suave" el motor lo fuerza a suave **sea cual sea el objetivo** (`[Paso 6.7]`, incondicional; coincide con la consecuencia 1 de §1.2.5b). No es solo prosa: en `ganar`, `ritmo_ef` selecciona la fila de la tabla 3.8 (novato suave 10 % frente a agresivo 20 %), así que forzarlo cambia también el plan de quien no está perdiendo peso. Bajo las opciones se muestra un texto que **no menciona el paso 5b ni la ansiedad**, porque el cribado también se activa con "Prefiero no responder" y nombrarlo revelaría el motivo: "Ajustaremos el ritmo final a lo que sea seguro para tu caso; puede que apliquemos el más suave aunque elijas otro." El mismo texto, palabra por palabra, se muestra a cualquier usuario cuyo ritmo pueda verse recortado por los suelos de seguridad, de modo que su presencia no distingue a nadie.

---

### Paso 12 — Peso objetivo (condicional: se omite si `objetivo ∈ {mantener, recomposicion}` o si `cribado_tca ∈ {positivo, evitado}`)

Se omite por la misma razón que el paso 11: con `mantener` o `recomposicion` el motor descarta el peso objetivo (`[Paso 6.6]`, `INFO_OBJETIVO_IGNORADO`), así que pedirlo para después responder "no lo usamos" es pedir un dato por nada. Con `objetivo = 'no_se'` **sí se pregunta**, porque el objetivo efectivo todavía no está resuelto. `INFO_OBJETIVO_IGNORADO` queda reservado para el caso en que el objetivo se reconvierte después del cuestionario (el usuario dio un peso objetivo con `perder` y el motor lo pasó a `mantener` o `recomposicion`).

Con `cribado_tca ∈ {positivo, evitado}` la pantalla también se omite y `peso_objetivo = null`: el resultado no muestra peso objetivo ni cronograma (paso 5b, consecuencia 3).

**Pregunta:** "¿Tienes un peso objetivo en mente?"

**Opciones:**
- "Sí, quiero llegar a…" → input numérico, kg (30-300) → `peso_objetivo = valor`
- "No lo sé, proponédmelo vosotros" → `peso_objetivo = null`

**Ayuda contextual:** "Si no lo tienes claro, no pasa nada: te proponemos un peso saludable según tu altura y tu situación actual, y podrás cambiarlo cuando quieras."

**Microcopy si elige dar un número:** debajo del input, en cuanto hay un valor, texto dinámico de previsualización simple (sin recalcular el motor completo, solo una estimación de IMC): "Eso supondría un IMC aproximado de {imc}." Si ese IMC cae por debajo de 18,5, se añade: "Es un IMC de bajo peso: en resultados te explicaremos por qué te proponemos ajustarlo." (sin bloquear el avance; el ajuste real ocurre en el motor, `[Paso 13]`, y se comunica como aviso en resultados).

**Validación:** si se elige "Sí" pero se deja vacío → no se avanza. Fuera de 30-300 kg → `[ERR_INPUT_RANGO]`.

---

### Paso 13 — Preferencia dietética, número de comidas y clima

**Pregunta 1:** "¿Sigues alguna preferencia alimentaria?"

**Opciones (una sola, tarjetas):**
- Omnívoro (como de todo)
- Vegetariano
- Vegano
- Sin lactosa
- Sin gluten
- Low-carb (bajo en carbohidratos)

**Ayuda contextual:** "Esto cambia los alimentos de tus menús de ejemplo. En vegano y vegetariano también subimos un poco la proteína total, porque las fuentes vegetales se aprovechan algo peor."

**Pregunta 2:** "¿Cuántas comidas al día prefieres hacer?"

**Opciones:** 2 / 3 / 4 / 5 / 6 (selector tipo stepper o tarjetas numeradas, 3 preseleccionado).

**Ayuda contextual (siempre visible, no plegable — es un mensaje de rigor científico obligatorio):** "No hay evidencia de que comer más o menos veces al día cambie tu metabolismo. Elige el número de comidas que mejor se adapte a tu rutina: lo único que cambia es cómo repartimos las mismas calorías y macros."

**Pregunta 3:** "¿Vives en una zona de clima caluroso o estamos en época de mucho calor?" → Sí/No → `clima_caluroso`

**Ayuda contextual:** "Con calor se suda más y hace falta algo más de agua al día."

**Pregunta 4 (interruptor, no tarjetas):** título "¿Quieres comidas sencillas?", descripción "Menos alimentos distintos, comidas que se repiten y una compra fácil. Ideal si no quieres pensar." → `menu_sencillo` (por defecto **desactivado**). Copy literal y reglas completas en §3.7.

**Validación:** preferencia y nº de comidas obligatorios; clima por defecto `No`; comidas sencillas por defecto `No`.

Al pulsar "Ver mi plan" se ejecuta el motor de cálculo y se navega a Resultados.

---

## 2. Pantalla de resultados

### 2.0 Estructura general (orden de arriba a abajo)

1. Cabecera con resumen (calorías + objetivo + ritmo)
2. Macros (proteína, grasa, carbohidratos, fibra)
3. Hidratación
4. Reparto por comidas (tabla)
5. Ejemplos de menú
6. Peso objetivo y cronograma
7. Qué haría un nutricionista (consejos accionables)
8. Avisos y notas de seguridad (si aplica)
9. Metodología (transparencia: qué fórmula se ha usado y por qué)
10. Disclaimer y enlace de ayuda (TCA)
11. Botón fijo (sticky) "Descargar PDF" + "Editar tus datos" — la fila se repite también arriba del todo (el DESIGN-brief pide verla al entrar), pero la **de abajo es la que va fija** (`position: sticky; bottom: 0`, con `env(safe-area-inset-bottom)`): en móvil el informe ocupa varias pantallas y sin eso el usuario se queda sin acción a la vista durante todo el scroll.

### 2.1 Cabecera — el número en grande

**El número más grande de toda la pantalla es `kcal` (calorías objetivo/día).** Justo debajo, en texto más pequeño:

> "{kcal} kcal al día"
> "{Perder grasa / Mantenerte / Ganar músculo / Recomposición}{sufijo}"

**Regla del sufijo (normativo):** el ritmo solo se muestra cuando el motor lo usa. Si `objetivo_efectivo ∈ {perder, ganar}` → `sufijo = " · ritmo {suave/moderado/agresivo}"` con `ritmo_ef` (el ritmo **efectivo**, que puede diferir del elegido: `[Paso 6.7]` lo fuerza a `suave` con `'tca'`). Si `objetivo_efectivo === 'recomposicion'` → `sufijo = " · cambios lentos, es lo esperable"`. Si `objetivo_efectivo === 'mantener'` → `sufijo = ""`. Nunca se imprime el valor por defecto `moderado` en objetivos donde el motor lo ignora (`SPEC-calculo.md` §1 campo 10).

Si `objetivo_efectivo` fue reconvertido desde `no_se` o desde una incoherencia (pasos 6.1-6.5 del motor), se muestra una etiqueta discreta "Ajustado automáticamente" con tooltip que reproduce el aviso `INFO_OBJETIVO_RESUELTO` / `WARN_*` correspondiente.

Debajo, una fila de 3 datos secundarios (tamaño medio, no compiten con las kcal):
- IMC: "{imc} — {categoría en español: bajo peso/normal/sobrepeso/obesidad I/II/III}"
- % de grasa estimado: "{rango_min}-{rango_max}%" (nunca un decimal, nunca un único número puntual) con etiqueta de fiabilidad ("estimación orientativa" / "estimación con medidas" / "dato aportado por ti")
- Gasto energético (TDEE): "{tdee} kcal/día es lo que estimamos que quemas"

**Si `cribado_tca ∈ {positivo, evitado}`** (paso 5b): la fila baja a 2 datos —IMC y TDEE—, sin el %grasa, y no se muestra el bloque §2.6. La pantalla no explica la omisión.

**Microcopy fijo bajo estos 3 datos:** "A tu gasto estimado le hemos restado un 5% como margen de seguridad, porque casi todos sobrestimamos lo que nos movemos." y "Ninguna fórmula sin aparato mide la grasa corporal exacta: por eso te damos un rango, no una cifra cerrada."

### 2.2 Macros — una frase por macro

Cuatro tarjetas (proteína, grasa, carbohidratos, fibra), cada una con: gramos/día en grande, g/kg de peso corporal, % de las calorías totales, y una frase explicativa fija:

| Macro | Frase explicativa |
|---|---|
| Proteína | "Mantiene y construye tu músculo. En tus comidas principales intenta que haya al menos 20 g; un tentempié pequeño puede llevar menos sin problema, porque lo que más cuenta es el total del día." |
| Grasa | "Esencial para tus hormonas. Nunca debe faltar, aunque tu objetivo sea perder grasa corporal." |
| Carbohidratos | "Tu principal fuente de energía, sobre todo para entrenar fuerte. Es la cifra que más varía según cuántas calorías necesites." |
| Fibra | "Cuida tu digestión y te ayuda a sentirte saciado/a. Repártela entre varias comidas: verdura, fruta y legumbres." |

Si `INFO_PROTEINA_CAPADA` está presente, añadir bajo la tarjeta de proteína: el texto de `INFO_PROTEINA_CAPADA` de la tabla §4 con su placeholder ya resuelto: "Hemos limitado la proteína para que no supere 2,5 g/kg ni el {35/30} % de tus calorías: por encima no hay beneficio demostrado." El `{35/30}` **no es literal**: el motor baja el tope al 30 % en dieta vegetal con `kcal < 1 800` (`[Paso 8]`), y escribir un 35 % fijo afirmaría un límite distinto del aplicado. Con `'renal' ∈ condiciones` este aviso no se emite (lo suprime `WARN_RENAL`): el límite que manda es el tope renal.

Bajo las 4 tarjetas, línea de cierre técnico (texto pequeño, siempre visible): "Las calorías de tus macros pueden diferir hasta 10 kcal del objetivo por el redondeo a múltiplos de 5 gramos." y azúcares libres informativos: "Como referencia, limita los azúcares añadidos a menos de {azucares_libres_max_g} g/día."

### 2.3 Hidratación

Bloque con:
- Número grande: **la franja**, "entre {rango_min} y {rango_max} ml al día". El Paso 12 del motor declara que "el número se presenta **siempre como rango**", así que la cifra puntual nunca es el elemento principal.
- Debajo, como referencia secundaria (texto normal, no destacado): "{agua_ml} ml de referencia, ≈ {vasos} vasos de 250 ml".
- Microcopy fijo (es la "Nota agua" de `SPEC-calculo.md` §4, reproducida íntegra y palabra por palabra): "Es líquido bebido: el café, el té y las infusiones cuentan si los tomas de forma habitual; la comida aporta además un 20–30 % de agua que no está incluido aquí. El alcohol no cuenta y deshidrata. No fuerces más de 1 litro por hora. Si entrenas más de una hora, sudas mucho o hace calor, añade sal a las comidas o una bebida con electrolitos: beber mucha agua sin sodio puede bajarte el sodio en sangre." La frase del sodio es **fija**, no condicional: el único sitio donde vivía era `WARN_AGUA_ALTA`, que solo se emite con `agua_ml ≥ 3 500`, así que el grueso de los usuarios activos (3 000–3 499 ml) no la veía en ninguna parte.
- **Si el motor no devuelve objetivo de agua** (`renal` o `cardiaca` ∈ `condiciones`, `[Paso 12]`): no se muestra ningún número ni ningún rango —tampoco "0 ml"—, solo el texto del aviso correspondiente del motor. La restricción de líquidos es tratamiento estándar en esas condiciones y una cifra grande de agua es justo lo contrario de lo que necesitan.
- Si `edad ≥ 65`: nota adicional `INFO_AGUA_MAYORES`: "A partir de los 65 años la sensación de sed se reduce: reparte el agua en tomas regulares en vez de esperar a tener sed."

### 2.4 Tabla de reparto por comidas

Tabla responsive (en móvil, tarjetas apiladas en vez de tabla) con una fila por comida (nombres según tabla 3.13 del motor: Desayuno, Media mañana, Comida, Merienda, Cena, Recena, según `n_comidas`):

| Comida | % kcal | Proteína | Grasa | Hidratos | Calorías |
|---|---|---|---|---|---|
| {nombre} | {pct_kcal}% | {proteina_g} g | {grasa_g} g | {hc_g} g | {kcal} kcal |

Fila de totales al final. **Los números salen del motor** (`macros.proteina_g`, `macros.grasa_g`, `macros.hc_g` y `kcal_cierre`), no de sumar la tabla en la interfaz: el CONTRATO prohíbe mostrar cifras que no vengan del motor, y la suma de la columna de kcal no coincide con la cifra grande de la cabecera (`kcal`) por el redondeo a 5 g. Debajo de la tabla se repite la línea de redondeo: «Total de tus macros: {kcal_cierre} kcal» más la nota de §2.2. El único valor que suma la interfaz es el porcentaje (100 %), que no es un macro.

Cada fila sale de `resultado.comidas[i]` —**un solo array**: en la v1 el motor no devuelve reparto de día de entreno y de día de descanso (`[Paso 16]`)— y lleva su `hora` nominal (Desayuno 08:00 · Media mañana 11:00 · Comida 14:00 · Merienda 17:30 · Cena 21:00 · Recena 23:00, tabla 3.13) como etiqueta secundaria bajo el nombre, con el copy fijo "son horas de referencia: puedes desplazarlas sin que cambie ningún número".

Si `comidas[i].peri === true`, mostrar un icono/etiqueta discreta "🏋️ cerca de tu entreno" junto al nombre. El motor marca como mucho una comida.

Si `WARN_PROTEINA_POR_TOMA` está presente: caja de aviso justo encima de la tabla, con el texto íntegro del aviso tal y como lo define la tabla §4 de `SPEC-calculo.md` (el copy no menciona "tantas comidas": la condición se dispara igual con 2 o 3).

Si `WARN_PROTEINA_TOMA_ALTA` está presente (alguna comida concentra más de 0,55 g/kg de peso corporal de proteína): segunda caja, del mismo estilo, también encima de la tabla. Las dos cajas pueden coexistir.

Nota fija bajo la tabla: "No hay evidencia de que comer más o menos veces al día cambie tu metabolismo. Elige el número de comidas que mejor se adapte a tu rutina."

### 2.5 Ejemplos de menú

Ver sección 3 (algoritmo). **No hay conmutador de día de entreno / día de descanso**: en la v1 el motor devuelve un único reparto (`[Paso 16]`), así que los dos días serían idénticos y el control prometería una variación que no existe. En resultados se muestra un ejemplo de menú completo (un día tipo) con los alimentos y gramajes ya escalados a los macros del usuario, agrupado por comida, con:
- Nombre del alimento + gramos + medida casera aproximada, calculada con la regla de §3.5 (nunca copiando literalmente `medidaCasera` sobre un gramaje distinto de `racionTipica_g`).
- Botón "Ver otro ejemplo" que regenera el menú con una plantilla alternativa dentro de la misma preferencia dietética (no llama de nuevo al motor de cálculo, solo cambia de plantilla/alimentos). Se implementa con el tercer parámetro de `generarEjemplos(inputs, resultado, variante)`, que desplaza en +1 el índice de arranque de la rotación: sigue siendo determinista (mismo `variante` → mismo menú).
- Nota fija: "Son ejemplos para orientarte, no un menú obligatorio. Puedes sustituir cualquier alimento por otro de la misma familia sin descuadrar tus macros de forma relevante: mira la tabla de equivalencias justo debajo."
- Si el generador no ha producido menú (ver §3.1, `condiciones` con `renal` o `hepatica`), este bloque se sustituye íntegro por el texto de §3.1 y el bloque de equivalencias tampoco se muestra.

**Bloque "Equivalencias" (plegable, justo debajo de los menús).** Existe porque §2.5 lo prometía sin definirlo. Se genera a partir de `foods.json`, sin datos del usuario:
- Una tabla por rol (`proteina`, `carbohidrato`, `grasa`), con los alimentos de ese rol que superen el filtro de `preferencia` del usuario.
- Para el rol `proteina`, la columna de equivalencia es **isoproteica**: gramos que aportan 20 g de proteína, `round5(2000 / alimento.proteina)`, omitiendo el alimento si el resultado supera su máximo de ración (§3.3).
- Para `carbohidrato`, equivalencia **isoglucídica**: gramos que aportan 30 g de hidratos, `round5(3000 / alimento.carbohidratos)`.
- Para `grasa`, equivalencia **isolipídica**: gramos que aportan 10 g de grasa, `round5(1000 / alimento.grasa)`. La tabla de grasa se restringe a alimentos cuyo **`grupo` sea `grasa`**, y se excluyen los que además tengan rol `proteina`: filtrando solo por `roles.includes('grasa')` entraban 75 g de salmón (15 g de proteína), 235 g de salmón ahumado (42 g de proteína y varios gramos de sal) o 125 g de jamón serrano presentados como intercambiables con 10 g de AOVE.
- **Guarda de ración, obligatoria en las tres tablas** (no solo en la isoproteica): se omite el alimento si la ración equivalente **supera el máximo o queda por debajo del mínimo** de su fila de `clampRacion` (§3.3). Sin ella, la tabla de carbohidrato ofrecía `round5(3000/3,1)` = **970 g de arroz de coliflor**, más del triple del máximo de 300 g que la propia §3.3 fija para un carbohidrato cocido. Un test de la base debe fallar si alguna equivalencia cae fuera de esos límites.
- Verdura y fruta no llevan tabla: nota fija "Las verduras y las frutas son intercambiables entre sí sin recalcular nada."
- Cabecera del bloque: "Cambiar un alimento por otro de la misma tabla te deja los macros casi iguales; no hace falta que recalcules nada." La promesa solo es cierta con las dos guardas anteriores aplicadas; si se relajan, hay que relajar también la cabecera.

Este mismo bloque aparece en el PDF (§4.4).

### 2.5b Lista de la compra semanal

Va **justo debajo del bloque de ejemplos de menú y de sus equivalencias**, plegada por defecto en móvil con el encabezado "Tu lista de la compra de la semana". Se muestra **siempre que haya menú** (con `menu_sencillo` activo o no); si el generador no ha producido menú (§3.1, `renal` o `hepatica`), este bloque tampoco aparece. Las reglas de cálculo, las fórmulas y los textos fijos están en §3.7; la pantalla no recalcula nada: pinta `ejemplos.compra` tal cual.

- **Subtítulo:** "Para 7 días, con el formato en el que se vende cada cosa en Mercadona. Sin precios: cambian de una tienda a otra y de una semana a otra."
- Si `ejemplos.modo_sencillo` es `true`, distintivo encima de la lista: "Modo sencillo: {alimentos_distintos} alimentos para toda la semana."
- **Una tabla por sección** (`SeccionSuper`, en el orden de §3.7), con el nombre visible de la sección como encabezado y cuatro columnas: **Producto** (`producto`, con el alimento del menú en línea secundaria), **Cantidad** ("{gramos_semana} g en la semana", y debajo "{gramos_dia} g al día"), **Comprar** ("{envases} × {envase_descripcion}") y **Dura** ("{dura_dias} días").
- El `consejo` de cada línea, si existe, va en letra pequeña bajo el producto; los `fresco` que no llegan a la semana lo llevan siempre (§3.7).
- Al pie, las tres notas fijas de `compra.notas`, en el orden en que vienen.
- Botón secundario "Ver otro ejemplo" (§2.5): al cambiar el menú cambia también la lista, porque se recalcula desde el mismo `Ejemplos`.

### 2.6 Peso objetivo y cronograma

**El bloque completo se omite si `cribado_tca ∈ {positivo, evitado}`** (paso 5b): ni peso objetivo, ni hito, ni cronograma, ni sustituto explicativo. El resto de la pantalla (calorías, macros, agua, reparto y menús) se muestra igual.

**Qué número se enseña (regla normativa, `peso_objetivo.mostrar_central`).** El motor devuelve `mostrar_central: boolean`. Cuando es `false` —fiabilidad `baja` del %grasa, que es el caso por defecto, o un peso objetivo corregido por `WARN_OBJETIVO_GRASA_MUY_BAJA`— **no se muestra ningún número grande**: solo la franja, "entre {rango[0]} y {rango[1]} kg", con el copy "tu masa magra es una estimación con varios kilos de margen, así que te damos una franja y no un número". El valor central sigue existiendo en la salida porque el cronograma necesita un punto de llegada, pero no se presenta como "tu objetivo". Esta regla vale igual en pantalla y en el PDF (§4.5).

- Si `peso_objetivo.efectivo !== null` **y** `mostrar_central === true`: número grande "{peso_objetivo.efectivo} kg" con etiqueta "tu objetivo" y, si venía de "no lo sé", nota: "Te proponemos este peso según tu altura y tu %grasa actual; puedes cambiarlo cuando quieras."
- Si `peso_objetivo.efectivo !== null` y `mostrar_central === false`: franja "entre {rango[0]} y {rango[1]} kg" con el mismo tamaño de tipografía que el resto de cifras secundarias, sin número destacado.
- Si hay `hito_intermedio`: tarjeta secundaria "Primer hito: {hito_intermedio} kg" con copy: "Cuando el camino es largo, ir por etapas ayuda a no perder la motivación."
- Si `cronograma !== null`: línea de tiempo simple con:
  - "Entre {semanas[0]} y {semanas[1]} semanas". El formato de las fechas lo manda `cronograma.precision_fecha`: con `'dia'` se imprime la fecha completa ("de {fecha_min} a {fecha_max}"); con `'mes'` **solo mes y año** ("hacia junio de 2027"), porque un calendario exacto a 40 semanas es el mecanismo clásico de abandono cuando no se cumple.
  - Si `cronograma.tramo_12sem !== null` (siempre que `precision_fecha === 'mes'`), el bloque principal muestra **el primer tramo, no el horizonte completo**: "en las próximas 12 semanas, entre {tramo_12sem[0]} y {tramo_12sem[1]} kg", más el hito intermedio. El horizonte total queda como línea secundaria.
  - "Eso es un ritmo de unos {ritmo_kg_sem} kg ({ritmo_pct_sem}%) por semana"
  - Si `diet_breaks > 0`: "Hemos incluido {diet_breaks} semana(s) a mantenimiento dentro del cálculo, para que el cuerpo descanse del déficit."
  - Nota fija `INFO_ADAPTACION`, con su texto íntegro de la tabla §4 del motor.
- Si `cronograma === null` **por corte** (`INFO_SIN_CRONOGRAMA_SIN_MARGEN`, `INFO_CRONOGRAMA_NO_ESTIMABLE` o `INFO_CRONOGRAMA_FUERA_DE_HORIZONTE`): se muestra el texto íntegro de ese aviso en lugar de la línea de tiempo, y **no** se muestra `INFO_ADAPTACION` (el motor ya lo suprime).
- Si `cronograma === null` (mantener/recomposición): "Con este objetivo no hay un peso al que llegar en una fecha. Reevalúa medidas, fotos y rendimiento cada 8-12 semanas." `[INFO_SIN_CRONOGRAMA]`

### 2.7 "Qué haría un nutricionista" (3-5 consejos accionables)

Bloque destacado visualmente (icono de bombilla o similar), con 3 a 5 consejos elegidos dinámicamente de la siguiente lista maestra según el perfil del usuario (siempre en español de España, tono cercano):

1. **Siempre incluido:** "Prioriza que cada comida principal lleve una ración de proteína del tamaño de la palma de tu mano (unos 20-30 g de proteína): es más fácil de recordar que pesar todo."
2. **Siempre incluido:** "Deja margen de flexibilidad: comer bien el 80% del tiempo y disfrutar el 20% restante es más sostenible que la perfección absoluta."
3. Si `entrenamiento.tipo !== 'ninguno'`: "Come una ración de proteína (20-40 g) en las 1-3 horas antes o después de entrenar: no es obligatorio, pero ayuda a recuperar mejor."
4. Si `n_comidas ≤ 3`: "Si algún día solo puedes hacer 1 o 2 comidas, no pasa nada: reparte tu proteína y tus calorías del día entre esas tomas. Lo que cuenta es el total de la semana, no un día suelto."
5. Si `objetivo_efectivo === 'perder'`: "Prepara comida para 2-3 días (batch cooking) de los alimentos base —arroz, pollo, legumbres— para no depender de decisiones bajo hambre o cansancio."
6. **Siempre incluido:** "Bebe agua antes de las comidas y a lo largo del día: la sed a veces se confunde con hambre."
7. Si `entrenamiento.tipo ∈ {'fuerza','mixto'}`: "No hace falta un suplemento de proteína si puedes llegar a tu objetivo con comida real: el batido es solo una herramienta de conveniencia."
8. Si `preferencia === 'vegano'`: "Suplementa vitamina B12 sí o sí, y vigila el hierro y el omega-3 (semillas de lino/chía o algas)."
9. Si `objetivo_efectivo === 'recomposicion'`: "Ten paciencia: la recomposición es el proceso más lento de todos. Mide con fotos y cinta métrica cada 3-4 semanas, no solo con la báscula."

**Regla de selección (normativo):** siempre los **3** marcados como "siempre incluido" (1, 2 y 6, en ese orden) más **0-2 adicionales** de los condicionales cuya condición se cumpla, evaluados en el orden de la lista (3, 4, 5, 7, 8, 9). Total: entre 3 y 5 consejos. Si se cumplen más de dos condiciones adicionales, se toman las dos primeras según ese orden y las demás se descartan (no se rota ni se aleatoriza: el PDF debe reproducir la pantalla).

### 2.8 Avisos y notas de seguridad

Todos los `avisos` devueltos por el motor (`WARN_*` y `INFO_*`) se listan aquí, con dos estilos visuales:
- `WARN_*` → caja con borde/color de atención (ámbar, nunca rojo alarmante) y texto completo del mensaje (tabla 4 de `SPEC-calculo.md`).
- `INFO_*` → nota más discreta (fondo neutro), mismo texto completo.

La regla "todos, con su texto completo" es literal y **no admite excepciones de maquetación**: la lista que llega en `resultado.avisos` se pinta entera. La protección del cribado no vive aquí, vive en el motor.

**Protección del cribado del paso 5b (normativo).** Con `cribado_tca ∈ {positivo, evitado}` → `'tca' ∈ condiciones` → el **motor no emite** (filtro del `[Paso 17]` de `SPEC-calculo.md`): `INFO_GRASA_ESTIMADA`, `INFO_PESO_YA_MINIMO`, `INFO_IMC_MUSCULADO`, `INFO_ADAPTACION`, `WARN_YA_MAGRO`, `WARN_YA_EN_OBJETIVO`, `WARN_OBJETIVO_MUY_LEJANO`, `WARN_CRONOGRAMA_LARGO`, `INFO_SIN_CRONOGRAMA`, `INFO_SIN_CRONOGRAMA_SIN_MARGEN`, `INFO_CRONOGRAMA_NO_ESTIMABLE` e `INFO_CRONOGRAMA_FUERA_DE_HORIZONTE`. Son avisos que enuncian literalmente el %grasa, el peso objetivo o el cronograma, precisamente los tres bloques que §2.1 y §2.6 ocultan a estos usuarios: sin el filtro, quien ha dado positivo en el cribado leía en la lista de avisos "tu porcentaje de grasa es una estimación con un error típico de ±5 puntos" (sin %grasa en pantalla), "tu objetivo supone perder más del 25 % de tu peso" (sin peso objetivo) o "el calendario es una estimación" (sin calendario). Al no emitirse, la UI no tiene nada que filtrar y la regla del listado íntegro sigue siendo cierta.

`INFO_RITMO_SUAVE` **sí** se lista, íntegro y con estilo `INFO_*` como cualquier otra nota: su texto de la tabla §4 es neutro y no menciona el cribado. Lo que sí sigue siendo excepción de serialización: `'tca'` no se muestra en ninguna lista de condiciones, ni en pantalla ni en el PDF, ni se serializa en ningún sitio.

**Condición de prioridad visual (normativa, escrita una sola vez y referenciada desde §4.2).** Este bloque se muestra **antes** que los ejemplos de menú (no al final) cuando hay:

> cualquier `WARN_*` de condición médica —`WARN_DIABETES`, `WARN_RENAL`, `WARN_HEPATICA`, `WARN_CARDIACA`, `WARN_HIPERTENSION`, `WARN_TIROIDES`, `WARN_BARIATRICA_GLP1`, `WARN_CONDICION_OTRA`—, **o** `WARN_IMC_35` / `WARN_IMC_40`, **o** `edad ≥ 65`.

La lista es la de la tabla §4 de `SPEC-calculo.md` completa, no un subconjunto: al ampliar `Condicion` (issue 22) quedaron fuera `WARN_HIPERTENSION`, `WARN_TIROIDES`, `WARN_CONDICION_OTRA` y sobre todo `WARN_BARIATRICA_GLP1`, que es la condición con más riesgo de pérdida rápida y déficit proteico y la que motivó el suelo de 1,5 g/kg. `edad ≥ 65` estaba en §4.2 y no aquí, de modo que pantalla y PDF no eran la misma instantánea. `'tca'` **no** entra en esa condición: subir de prioridad visual el bloque solo cuando hay cribado positivo lo delataría.

### 2.9 Metodología (transparencia)

Bloque plegable (acordeón, cerrado por defecto) "¿Cómo hemos calculado esto?" con:
- Fórmula de metabolismo basal usada: "Mifflin-St Jeor" o "Katch-McArdle (porque nos diste un %grasa de una prueba fiable)", con el valor de BMR.
- "Tu gasto total estimado (TDEE) es de {tdee_bruto} kcal, al que restamos un 5% de margen de seguridad: {tdee} kcal."
- Si se usó somatotipo: "El somatotipo es una forma antigua de describir la silueta corporal, pero la ciencia actual no ha demostrado que sirva para calcular calorías o macros de forma precisa. Lo hemos usado solo como un ajuste ligero entre carbohidratos y grasa (nunca en tus calorías ni tu proteína)." `[INFO_SOMATOTIPO]`
- Referencias informativas (visibles aquí salvo por la guarda de abajo, nunca como número principal): CUN-BAE, Deurenberg, US Navy (si aplica), FFMI y categoría, fórmulas de peso ideal clásicas (Devine/Robinson/Miller/Hamwi) etiquetadas explícitamente como "otras referencias, no un objetivo".

**Guarda del cribado (normativa, misma frase que §4.5).** Si `cribado_tca ∈ {positivo, evitado}`, el bloque de referencias informativas **no se muestra**: ni el %grasa por CUN-BAE, Deurenberg o US Navy, ni el FFMI, ni las cuatro fórmulas clásicas de peso ideal. El acordeón conserva solo la ecuación de BMR usada, su valor, el TDEE bruto y el TDEE final, y la nota de somatotipo si aplica. Sin esta guarda la protección se anulaba a sí misma: §2.1 oculta el %grasa y §2.6 oculta el peso objetivo, y tres bloques más abajo se imprimían tres estimaciones de %grasa y cuatro pesos ideales del mismo usuario (caso 2 de la §5 de `SPEC-calculo.md`: CUN-BAE 29,1 %, Deurenberg 27,5 %, Navy 26,4 %, Devine 56,9 / Robinson 57,4 / Miller 59,8 / Hamwi 56,4 kg). El filtro del `[Paso 17]` del motor no puede evitarlo: no son avisos, son campos de `Resultado` que decide pintar la capa de presentación, así que **esta regla se comprueba con un test de presentación** (pantalla y PDF) que falla si algún número derivado del %grasa o del peso objetivo se renderiza con `'tca' ∈ condiciones`.

### 2.10 Disclaimer y ayuda

Texto fijo, siempre visible (no oculto en acordeón), en la parte inferior:

> "Báscula te ofrece una orientación nutricional general basada en evidencia científica, no un consejo médico ni un plan personalizado por un profesional sanitario. Los resultados son estimaciones: tu cuerpo puede responder de forma distinta. Si tienes una condición médica, tomas medicación, estás embarazada o en periodo de lactancia, o tienes antecedentes de trastornos de conducta alimentaria, consulta con un/a médico o dietista-nutricionista colegiado/a antes de seguir estas recomendaciones."

Enlace discreto permanente (mismo en todas las pantallas de resultados, no solo si se detectó riesgo): "¿La comida o el peso te generan ansiedad? Habla gratis con ADANER."

---

## 3. Generador de ejemplos de comidas

### 3.0 Contrato de datos de `foods.json` (normativo)

`foods.json` es la única fuente de alimentos del generador. Cada entrada tiene este esquema y estas garantías; cualquier alimento nuevo debe cumplirlas antes de entrar en la base:

| Campo | Tipo | Significado |
|---|---|---|
| `id` | string | Identificador único (validado: no hay duplicados) |
| `nombre` | string | Nombre en español de España, con el estado entre paréntesis cuando importa ("Arroz blanco (cocido)") |
| `grupo` | `'proteina' \| 'lacteo' \| 'carbohidrato' \| 'grasa' \| 'verdura' \| 'fruta'` | Familia alimentaria (se usa para las equivalencias y para el filtro `sin_lactosa`) |
| `roles` | `('proteina' \| 'carbohidrato' \| 'grasa' \| 'verdura' \| 'fruta' \| 'complemento')[]` | **Rol funcional en el menú, independiente del grupo.** Las legumbres declaran `['proteina','carbohidrato']`; el yogur griego 0 %, `['proteina']`; el salmón, `['proteina','grasa']`. `'complemento'` es el rol de las bebidas de baja densidad que acompañan a un ancla sin ser ellas mismas el ancla (leches, kéfir, bebidas vegetales: 9 alimentos de la base). `FoodQuery` filtra por `roles`, no por `grupo` |
| `estado` | `'crudo' \| 'cocido' \| 'seco' \| 'listo'` | Estado en que están medidos los macros. Determina los límites de ración (§3.3) |
| `kcal` | number | **Energía por 100 g y única fuente de verdad energética.** Es el valor de tabla (BEDCA/USDA), no el resultado de 4/4/9 |
| `proteina`, `grasa`, `carbohidratos`, `fibra` | number | g por 100 g. **`carbohidratos` es hidrato TOTAL, con la fibra incluida** (convención BEDCA/USDA) |
| `hc_netos` | number | `carbohidratos − fibra`, precalculado. Lo usa solo la presentación de perfiles low-carb; el generador escala siempre con `carbohidratos` |
| `racionTipica_g` | number | Ración habitual, base de la medida casera |
| `medidaCasera` | string | Texto de la medida casera correspondiente a `racionTipica_g` |
| `unidad_g`, `unidad_nombre` | number, string (opcionales) | Solo en alimentos contables (huevo, clara, lata, rebanada, tortita, tarrina, pieza de fruta): peso y nombre de UNA unidad |
| `tags` | string[] | Enum cerrado: `vegetariano`, `vegano`, `sin_lactosa`, `con_lactosa`, `sin_gluten`, `low_carb`. `con_lactosa` marca los 9 lácteos que el filtro `sin_lactosa` debe excluir |
| `fuente` | string | Referencia (BEDCA/USDA) |

**Consecuencias normativas de este contrato:**

1. **Las kcal de una comida se calculan siempre como `Σ (alimento.kcal · gramos / 100)`**, nunca como `4·P + 4·HC + 9·G`. La diferencia entre ambos métodos llega a 47 kcal por 100 g en alimentos ricos en fibra o en grasa (nueces 654 vs 701; almendras 579 vs 622; avena 389 vs 357), suficiente para hacer fallar por sí sola la validación del ±10 % de §3.3.
2. Como `carbohidratos` incluye la fibra, el objetivo de HC del motor (que también es hidrato total) y el del menú son directamente comparables. `hc_netos` no entra en ningún cálculo del generador.
3. `estado` es obligatorio y limita qué alimentos pueden entrar en una plantilla: **los cereales, pastas y arroces con `estado = 'crudo'` están excluidos del banco de plantillas** (solo aparecen en la tabla de equivalencias, etiquetados "en crudo"), porque las reglas de ración de §3.3 están escritas para el alimento tal y como se come.
4. La validación de la base (test automático) comprueba: ids únicos; presencia de todos los campos obligatorios; `|kcal − (4P + 4HC + 9G)| / kcal ≤ 0,15`; `fibra ≤ carbohidratos`; `hc_netos = carbohidratos − fibra`; que todo alimento con `unidad_g` tenga también `unidad_nombre`; **que `grupo`, `estado`, `roles` y `tags` solo contengan valores del enum declarado en la tabla de arriba**; y **que todo alimento encaje en exactamente una fila de la tabla de `clampRacion` (§3.3): ni cero, ni dos o más**. Las dos últimas comprobaciones son nuevas: sin ellas, nueve alimentos con `roles: ['complemento']` —un valor que no existía en el enum— pasaban la validación entera siendo inalcanzables por rol para el generador, y una plantilla del banco vegano (VGN-DES-2) dependía de uno de ellos (`bebida_soja`). La cota **por arriba** (una sola fila aplicable) es igual de necesaria que la cota por abajo: con la tabla anterior la mantequilla encajaba en dos filas con mínimos de 5 g y de 100 g, y la validación no lo detectaba porque solo exigía "al menos una".

**Excepción declarada del tag `sin_lactosa`.** `mantequilla` es `grupo: 'lacteo'` y lleva `sin_lactosa` sin ser una variante declarada sin lactosa ni un queso curado: su lactosa residual (≈0,6 g/100 g) queda por debajo de 0,15 g en la ración máxima de su fila (25 g), muy por debajo del umbral de tolerancia habitual. La regla general sigue siendo la de §3.2 (un lácteo sin el tag lo excluye el filtro); esta es la única excepción y está aquí para que no se lea como un error de datos.

### 3.1 Objetivo del módulo

Recibe la salida `comidas: Array<{nombre, pct_kcal, proteina_g, grasa_g, hc_g, kcal}>` del motor (`[Paso 16]` de `SPEC-calculo.md`), más **`resultado.preferencia_efectiva`** (nunca `inputs.preferencia`: con `diabetes` + `low_carb` el motor ya ha anulado el low-carb en el `[Paso 6.8]`, y elegir el banco LCB-* para un plan de 330 g de hidrato al día agota el banco entero sin cerrar dentro del ±10 % de kcal), **`resultado.macros.fibra_g`** (el `fibra_objetivo` de la comprobación de fibra de §3.3, sin el cual esa comprobación no es implementable) y, **de `InputCalculo` y no de `Resultado`**, `inputs.condiciones` y `inputs.peso_kg`. La lista de condiciones que recibe es la **cruda del usuario**, no la normalizada del `[Paso 0]`: así `'tca'` no llega nunca a este módulo, que no lo necesita para nada (el motor ya ha aplicado su efecto en el ritmo) y que no debe poder serializarlo. Devuelve, para cada comida, una lista de alimentos de `foods.json` con gramajes concretos que se aproximan a esos macros. Es un módulo puro y determinista: mismos inputs → mismo resultado (salvo el botón "Ver otro ejemplo", que elige la siguiente plantilla de una lista fija en vez de aleatoriedad real, para que el resultado sea reproducible en el PDF).

**Corte de seguridad por condiciones (normativo, se evalúa antes que nada):**

```
si 'renal' ∈ condiciones o 'hepatica' ∈ condiciones → devolver { menu: null, motivo: 'CONDICION_CLINICA' }
```

Con `menu: null`, los bloques §2.5 y §4.4 (ejemplos de menú y equivalencias) se sustituyen íntegros por este texto, sin gramajes de ningún tipo:

> "No te proponemos menús de ejemplo. Con tu condición, la elección concreta de alimentos (potasio, fósforo, sodio y tipo de proteína) cambia mucho el resultado y debe hacerla un/a dietista-nutricionista especializado/a. Tus calorías y tus macros siguen siendo una referencia orientativa que puedes llevarle."

El motivo es que `foods.json` no contiene potasio, fósforo ni sodio, así que el generador no puede filtrar lo que en esas patologías se restringe: los menús que producía cargaban precisamente esos nutrientes (plátano, patata, boniato, espinacas, legumbres, lácteos, embutido). Mientras esos tres campos no existan en la base **y** haya umbrales definidos por condición, publicar un menú a esos usuarios no es aceptable. `'diabetes'` y `'cardiaca'` no cortan el menú (el motor ya anula `low_carb` en diabetes), pero sí añaden la nota fija correspondiente sobre el bloque de menús: con `diabetes`, "Estos gramajes de hidratos son un ejemplo: si usas insulina o pastillas que bajan el azúcar, revisa la dosis con tu equipo médico antes de cambiar tu forma de comer."; con `cardiaca`, "Cocina sin sal añadida y evita embutidos y conservas: con tu condición el sodio importa más que los gramos exactos."

### 3.2 Selección de plantilla

Una plantilla es una estructura fija con **roles** de alimento, no alimentos concretos:

```
Plantilla = {
  id: string,
  rol_comida: 'principal' | 'ligera' | 'desayuno',
  ancla_proteina: FoodQuery,       // qué tipo de alimento aporta la proteína
  ancla_proteina_2: FoodQuery | null,  // segunda fuente, si la primera no llega (ver 3.3)
  ancla_carbohidrato: FoodQuery | null,
  ancla_grasa: FoodQuery | null,   // null si la grasa ya viene cubierta por la proteína (p. ej. salmón)
  verdura: FoodQuery | null,       // ración fija, sí se descuenta de los macros (ver 3.3)
  fruta: FoodQuery | null          // ración fija, sí se descuenta de los macros
}
FoodQuery = {
  rol?: 'proteina' | 'carbohidrato' | 'grasa' | 'verdura' | 'fruta' | 'complemento',  // filtra por foods.roles
  grupo?: string,                  // filtra por familia alimentaria, solo cuando importa
  estado_excluye?: string[],       // por defecto ['crudo'] en carbohidratos
  proteina_min?: number,           // g/100 g
  hc_max?: number,                 // g/100 g
  grasa_min?: number,              // g/100 g
  grasa_max?: number,              // g/100 g
  tags_incluye?: string[],
  tags_excluye?: string[],
  ids_preferidos?: string[]        // orden de preferencia; el primero que pase los filtros gana
}
```

Los filtros numéricos existen porque `grupo` no basta: "alimento denso en proteína" no es un grupo (el yogur griego 0 % es `lacteo` y los garbanzos cocidos son `proteina` con 27 g de HC/100 g). Un ancla de proteína realista se expresa como `{ rol: 'proteina', proteina_min: 10, ids_preferidos: [...] }`.

**Filtro por preferencia (se aplica a TODAS las `FoodQuery` antes que ningún otro criterio):**
- `vegetariano` → excluye los alimentos sin tag `vegetariano`.
- `vegano` → excluye los alimentos sin tag `vegano`.
- `sin_lactosa` → excluye `grupo = 'lacteo'` sin tag `sin_lactosa`. La base incluye las variantes españolas sin lactosa (leche, yogur griego 0 %, queso fresco batido 0 %, kéfir) y los quesos curados, naturalmente por debajo de 0,1 g de lactosa, todos con ese tag, de modo que la preferencia ya no vacía el grupo entero.
- `sin_gluten` → excluye los alimentos sin tag `sin_gluten`.
- `low_carb` → ver el banco propio más abajo.
- `omnivoro` → sin exclusión.

**Los seis bancos (normativo).** Cada preferencia tiene su banco, con 2 plantillas por rol de comida como mínimo. Los identificadores son estables porque el PDF debe reproducir el menú de la pantalla.

| Preferencia | Desayuno | Principal (Comida/Cena) | Ligera (Media mañana/Merienda/Recena) |
|---|---|---|---|
| `omnivoro` | **OMN-DES-1** lácteo proteico + huevo + pan/avena + fruta · **OMN-DES-2** huevo + fiambre magro + pan + verdura | **OMN-PRI-1** carne magra + cereal cocido + AOVE + verdura · **OMN-PRI-2** pescado blanco (+ huevo si falta P) + patata/boniato + AOVE + verdura · **OMN-PRI-3** pescado azul + tubérculo + verdura (sin ancla de grasa) | **OMN-LIG-1** requesón/queso batido + tortitas de arroz + fruta · **OMN-LIG-2** atún al natural + pan + fruta |
| `vegetariano` | **VEG-DES-1** yogur griego + avena + fruta · **VEG-DES-2** queso batido + pan + fruta + frutos secos | **VEG-PRI-1** queso batido/huevo + arroz + verdura · **VEG-PRI-2** legumbre + huevo + pan + verdura | **VEG-LIG-1** yogur griego + fruta + frutos secos · **VEG-LIG-2** queso fresco + tortitas de arroz + fruta |
| `vegano` | **VGN-DES-1** yogur de soja proteico + avena + fruta + semillas · **VGN-DES-2** bebida de soja + proteína vegetal en polvo + avena + fruta | **VGN-PRI-1** tofu firme/tiras de soja + cereal cocido + AOVE + verdura · **VGN-PRI-2** legumbre + soja texturizada hidratada + AOVE + verdura · **VGN-PRI-3** tempeh + boniato + verdura (sin ancla de grasa) | **VGN-LIG-1** yogur de soja proteico + fruta + frutos secos · **VGN-LIG-2** altramuces/edamame + fruta |
| `sin_lactosa` | **SLA-DES-1** = OMN-DES-1 con lácteos sin lactosa · **SLA-DES-2** = OMN-DES-2 | = banco `omnivoro` (ninguna plantilla principal depende de lácteos) | **SLA-LIG-1** = OMN-LIG-1 con queso batido sin lactosa · **SLA-LIG-2** = OMN-LIG-2 |
| `sin_gluten` | **SGL-DES-1** lácteo proteico + huevo + fruta (sin cereal) · **SGL-DES-2** huevo + patata + verdura | **SGL-PRI-1** = OMN-PRI-1 con arroz/quinoa · **SGL-PRI-2** = OMN-PRI-2 (patata/boniato) | **SGL-LIG-1** = OMN-LIG-1 (tortitas de arroz llevan tag `sin_gluten`) · **SGL-LIG-2** atún + fruta |
| `low_carb` | **LCB-DES-1** huevo + fiambre magro + verdura + aguacate · **LCB-DES-2** lácteo proteico con tag `low_carb` (yogur griego, queso batido 0 %) + frutos secos + fruta roja (fresas) | **LCB-PRI-1** carne/pescado + verdura + AOVE (**sin ancla de carbohidrato**) · **LCB-PRI-2** carne/pescado + arroz de coliflor o pan proteico + verdura + AOVE | **LCB-LIG-1** queso batido + frutos secos · **LCB-LIG-2** huevo cocido + aceitunas |

**Variantes «sin lactosa».** Los ids `*_sl` de `foods.json` existen para que el filtro `sin_lactosa` no vacíe el grupo de lácteos: **solo entran en la rotación con `preferencia_efectiva === 'sin_lactosa'`**; para el resto de preferencias quedan como reserva. Sin esta regla la rotación por `n_comidas + edad` servía a usuarios omnívoros un producto más caro sin ningún motivo en su perfil.

**Regla propia de `low_carb`:** el ancla de carbohidrato es **opcional**. Si `hc_pendiente < 20 g` tras la proteína, la verdura y la fruta, no se añade ancla de carbohidrato y en su lugar se sube la ración de verdura al doble de `racionTipica_g` (respetando el máximo de ración). Si `hc_pendiente ≥ 20 g`, se usa un alimento con tag `low_carb` del rol `carbohidrato` (`arroz_coliflor`, `pan_proteico`); si el ancla low-carb elegida no puede cubrir `hc_pendiente` **ni con su ración máxima** (el arroz de coliflor aporta 9 g de hidrato en 300 g y el pan proteico 18 g en 100 g), se permite un cereal normal y se rebaja la ración: se escala al hidrato pendiente, con sus límites de `clampRacion`. La lectura anterior —«si ninguno pasa los filtros»— era letra muerta, porque el arroz de coliflor pasa siempre: el menú entregaba 61 g de hidrato frente a los 170 g del plan (−64 %). La antigua regla ("prioriza alimentos con tag `low_carb`") era letra muerta: cuando se escribió no había ni un solo alimento con ese tag en el grupo.

**LCB-DES-2 es obligatoria, no un extra.** El banco `low_carb` tenía una sola plantilla de desayuno, incumpliendo el mínimo de 2 por rol de comida que fija el párrafo introductorio de esta tabla. Con una sola: el botón "Ver otro ejemplo" de §2.5 no tenía a qué rotar en el desayuno, y la escalada del cierre de kcal de §3.3 ("se prueba la siguiente plantilla del banco") caía directamente al fallback omnívoro, que para un usuario low-carb significa un desayuno con ancla de carbohidrato. Y `low_carb` es la única preferencia que además cambia números del motor (grasa 45 %, `HC_min` 75), así que ese fallback no era cosmético.

**Elección dentro del banco (normativa, determinista).** Las plantillas de cada `rol_comida` están ordenadas dentro del banco por su identificador (`OMN-PRI-1`, `OMN-PRI-2`, `OMN-PRI-3`, …) y **el día consume esa lista en orden, sin repetir mientras queden plantillas válidas**:

1. Las comidas se recorren en el orden de `resultado.comidas` (que es el de la tabla 3.13: Desayuno, Media mañana, Comida, Merienda, Cena, Recena).
2. Para cada comida se toma la **siguiente plantilla no usada aún ese día** dentro de su `rol_comida`, empezando por el índice 0. Se descarta y se pasa a la siguiente cuando (a) alguna de sus `FoodQuery` obligatorias se queda sin ningún alimento válido tras los filtros de preferencia, o (b) el cierre de kcal de §3.3 no converge dentro del ±10 % con ella.
3. Si se agotan las plantillas del rol antes de agotar las comidas de ese rol, la rotación vuelve al índice 0 (rotación circular): con `n_comidas = 6` hay tres comidas ligeras y solo dos plantillas `LIG`, así que la tercera repite la primera.
3bis. Agotado el propio rol, **la lista se cierra con las plantillas del rol contrario**: una comida principal o un desayuno terminan en las `LIG` (una toma demasiado pequeña para su rol) y una comida ligera, en las `PRI` (una toma demasiado grande para el suyo). El caso que lo obliga: en un plan de 3.500 kcal repartido en cuatro tomas, la merienda pide 615 kcal, y ninguna plantilla ligera —yogur o queso batido más fruta, con el lácteo ya topeándose en 250 g— baja del 11 % de desviación. Con la escalada, la merienda se resuelve con una plantilla principal y cierra en el −5,9 %.
4. "Ver otro ejemplo" desplaza el índice de arranque del día en +1 (módulo el número de plantillas válidas del rol) y vuelve a aplicar la regla, de modo que el menú alternativo también es determinista y reproducible en el PDF.

Sin esta regla escrita, la lectura literal de la versión anterior ("la primera plantilla del banco cuyas `FoodQuery` tengan al menos un alimento válido") daba **la misma plantilla a la Comida y a la Cena** de todos los días, y los tres vectores de §3.6 —que este documento declara vectores de prueba reproducibles por un test— no eran derivables de la especificación. Con la regla de arriba: el Ejemplo A da Comida = OMN-PRI-1 y Cena = OMN-PRI-2; el B, VEG-PRI-1 y VEG-PRI-2; y el C salta OMN-PRI-2 en la cena por el motivo (b) —no converge dentro del ±10 %— y usa OMN-PRI-3.

Si **ninguna** plantilla del banco es válida (situación que la validación de `foods.json` debe hacer imposible), se cae al banco `omnivoro` filtrado por la preferencia y se anota el fallback en el log; nunca se muestra una comida vacía. Con `preferencia_efectiva === 'low_carb'` ese fallback aplica además la regla propia del ancla de carbohidrato opcional descrita más arriba (`hc_pendiente < 20 g` → sin ancla de carbohidrato, verdura al doble), porque el filtro por tags no elimina nada en low-carb y un desayuno omnívoro entraría con su ancla de carbohidrato tal cual, que es justo lo que la preferencia excluye.

### 3.3 Algoritmo de escalado de gramajes (por comida)

Dada una comida con objetivo `{proteina_g, grasa_g, hc_g, kcal}` (del reparto del motor) y una plantilla ya resuelta a alimentos concretos. Todas las sumas de macros se hacen sobre los alimentos ya añadidos, incluidas la verdura y la fruta: **no hay ninguna constante de aporte estimado**.

```
función escalarComida(objetivo, alimentos):
  seleccion = []
  P(x)  = x.alimento.proteina      * x.gramos / 100     // ídem G(x), HC(x), FIB(x)
  KCAL(x) = x.alimento.kcal        * x.gramos / 100     // fuente de verdad: campo kcal (§3.0)
  ΣP    = suma de P sobre seleccion                     // ídem ΣG, ΣHC, ΣKCAL

  // 0. VERDURA Y FRUTA — ración fija, PERO se descuentan de los objetivos
  si alimentos.verdura → añadir(verdura, verdura.racionTipica_g)
  si alimentos.fruta   → añadir(fruta,   fruta.racionTipica_g)

  // 1. ANCLA DE PROTEÍNA — determina la ración principal
  g1 = (objetivo.proteina_g - ΣP) / (ancla_p.proteina / 100)
  // topes cruzados: un ancla que arrastra otro macro no puede reventarlo
  si ancla_p.grasa > 5         → g1 = min(g1, (objetivo.grasa_g - ΣG) / (ancla_p.grasa / 100))
  si ancla_p.carbohidratos > 5 → g1 = min(g1, (objetivo.hc_g   - ΣHC) / (ancla_p.carbohidratos / 100))
  g1 = redondear(clampRacion(g1, ancla_p), ancla_p)
  añadir(ancla_p, g1)

  // 1b. SEGUNDA FUENTE DE PROTEÍNA — si la primera se quedó corta por un tope
  si (objetivo.proteina_g - ΣP) > 5 y existe ancla_proteina_2:
      g1b = mismos topes cruzados aplicados a ancla_p2
      añadir(ancla_p2, redondear(clampRacion(g1b, ancla_p2), ancla_p2))

  // 2. ANCLA DE CARBOHIDRATO — cubre lo que falta, con lo ya aportado descontado
  hc_pendiente = max(0, objetivo.hc_g - ΣHC)
  si preferencia === 'low_carb' y hc_pendiente < 20 → sin ancla de HC (ver 3.2)
  si existe ancla_hc:
      añadir(ancla_hc, redondear(clampRacion(hc_pendiente / (ancla_hc.carbohidratos/100), ancla_hc), ancla_hc))

  // 3. ANCLA DE GRASA — completa lo que falta
  grasa_pendiente = objetivo.grasa_g - ΣG
  si existe ancla_grasa y grasa_pendiente ≥ 4:
      añadir(ancla_grasa, redondear(clampRacion(grasa_pendiente / (ancla_grasa.grasa/100), ancla_grasa), ancla_grasa))
  // con grasa_pendiente < 4 g el ancla NO se añade: 5 g de aceite ya se pasarían

  // 4. CIERRE DE KCAL (ver más abajo)
  // 5. COMPROBACIÓN DE FIBRA (ver más abajo)
  devolver seleccion
```

**Corrección respecto de la v1.** La v1 declaraba la fruta "libre, no se escala por macro" y nunca la descontaba, mientras usaba una constante `APORTE_HC_VERDURA_FIJO = 5 g` para la verdura. Las dos cosas estaban mal: un plátano de 120 g aporta 27,6 g de HC (el 39 % del objetivo de un desayuno) y la verdura real aporta el doble de la constante (brócoli 175 g = 11,6 g; zanahoria 125 g = 12,5 g; calabaza 175 g = 11,4 g). El resultado era que el ancla de HC se pasaba en todas las comidas principales. **La constante `APORTE_HC_VERDURA_FIJO` queda eliminada**: verdura y fruta se eligen antes que las anclas y se descuentan con sus macros reales de `foods.json`.

**Límites de ración (`clampRacion`).** Cada fila lleva un **predicado formal** sobre los campos de `foods.json`, no un nombre de producto, y los predicados son **mutuamente excluyentes**: todo alimento de la base encaja en exactamente una fila (lo comprueba la validación de §3.0).

| Fila | Predicado sobre el alimento | Mínimo | Máximo |
|---|---|---|---|
| Proteína animal o vegetal | `grupo = 'proteina'`, `estado ∈ {crudo, cocido, listo}`, sin rol `carbohidrato` | 50 g | 250 g |
| Proteína con rol también de carbohidrato (legumbres cocidas) | `grupo = 'proteina'` y `roles` incluye `carbohidrato` | 50 g | 300 g |
| Proteína deshidratada (soja texturizada, proteína en polvo) | `grupo = 'proteina'` y `estado = 'seco'` | 15 g | 60 g |
| Queso curado | `grupo = 'lacteo'`, `roles` incluye `proteina` y `grasa ≥ 20 g/100 g` | 20 g | 80 g |
| Lácteo proteico (yogur, requesón, queso batido, cottage) | `grupo = 'lacteo'`, `roles` incluye `proteina` y `grasa < 20 g/100 g` | 100 g | 250 g |
| Bebidas lácteas y vegetales (leche, kéfir, bebida de soja) | `grupo = 'lacteo'` y `roles` incluye `complemento`, sin rol `proteina` | 100 g | 300 g |
| Carbohidrato cocido (arroz, pasta, patata, quinoa, cuscús) | `grupo = 'carbohidrato'` y `estado = 'cocido'` | 50 g | 300 g |
| Carbohidrato seco (copos de avena) | `grupo = 'carbohidrato'` y `estado = 'seco'` | 30 g | 100 g |
| Carbohidrato listo (pan, tortitas) | `grupo = 'carbohidrato'` y `estado = 'listo'` | 15 g | 100 g |
| Carbohidrato crudo | `grupo = 'carbohidrato'` y `estado = 'crudo'` | — | **excluido del banco** (§3.0) |
| Grasas puras (AOVE, mantequilla) | `roles` incluye `grasa` y `grasa ≥ 80 g/100 g` | 5 g | 25 g |
| Frutos secos y semillas enteros | `grupo = 'grasa'`, `25 ≤ grasa < 80 g/100 g` y no es una crema | 10 g | 50 g |
| Crema de frutos secos (`mantequilla_cacahuete` y similares) | `grupo = 'grasa'` y el `id` está en la lista de cremas | 10 g | 30 g |
| Aceitunas | `id = 'aceitunas'` | 10 g | 40 g |
| Aguacate | `id = 'aguacate'` | 50 g | 150 g |
| Verdura y fruta | `grupo ∈ {verdura, fruta}` | `racionTipica_g` (o el doble en low-carb sin ancla de HC) | |

**Por qué el lácteo proteico se corta en 250 g.** La fila era una sola, con 300 g para todo, y el cierre de kcal empujaba el gramaje hasta el tope: el desayuno del perfil de la QA salía con **280 g de queso fresco batido 0 %** y una variante con **300 g de requesón**, que es exactamente la mitad no corregida del punto §7 de la QA (la otra mitad, las cinco claras, se arregló con `TOPE_UNIDADES`). 250 g es la tarrina entera de queso batido o de requesón del supermercado: el límite deja de ser un número y pasa a ser un formato que se compra. Las bebidas se quedan en 300 g porque un vaso grande de leche o de bebida de soja no tiene ese problema, y por eso la fila se parte en dos.

**Por qué el predicado y no el nombre.** La tabla se declaraba "indexada por (grupo, estado, rol)" pero sus filas estaban escritas por nombre de producto, y una de ellas colisionaba: `mantequilla` tiene `grupo: 'lacteo'`, `roles: ['grasa']` y `racionTipica_g: 10`, de modo que por la clave declarada le correspondía "Lácteos y bebidas vegetales" (mínimo **100 g** = 717 kcal y 81 g de grasa, más grasa que el objetivo de un día entero en los casos 8 y 14 de la §5) y por su nombre, "Aceite y mantequilla" (5-25 g). La validación de §3.0 ("que todo alimento tenga al menos una fila aplicable") pasaba igualmente porque había dos, no cero. Con los predicados de arriba la mantequilla cae solo en "Grasas puras" (`grasa = 81`), y el queso manchego curado —el otro lácteo con la misma ambigüedad, al que la fila genérica permitía **300 g**— tiene ahora su propia fila. Es el mismo tipo de defecto que R5-12 corrigió en la tabla de equivalencias restringiendo por `grupo`.

**Los máximos de esta tabla son duros.** Una toma que no cabe en un plato (más de 900 kcal) se reparte en varios platos —hasta cuatro—, cada uno con su propia plantilla y su parte del objetivo; en ningún caso se amplían los límites de ración ni la ración fija de verdura y fruta. Con la ampliación por número de platos salían menús de 900 g de boniato, 45 g de aceite y 5 tarrinas de queso batido en una sola toma.

**Los platos se agrupan en la tabla.** `EjemploComida.alimentos` es una lista plana y ni la pantalla ni el PDF titulan los platos, así que cuando la toma va repartida se **agrupa por `id`**, sumando gramos y macros (los valores ya redondeados de cada porción, para que los totales de la comida no se muevan). Sin agrupar, un desayuno de 955 kcal en dos platos imprimía "plátano 120 g · huevo 55 g · avena 65 g" dos veces seguidas dentro de la misma comida. La nota de §3.6 sigue diciendo en cuántos platos va.

**Topes de plausibilidad de los alimentos contables** (además del máximo de la fila): 5 claras de huevo, 2 latas de atún y 8 tortitas de arroz. Un gramaje puede caber en su fila y aun así no parecerse a un plato real («231 g de clara de huevo (7 claras)», «208 g de atún (4 latas)»).

En los alimentos contables (`unidad_g`) el mínimo es una unidad y el máximo, el mayor múltiplo de `unidad_g` que no supere el máximo de su fila: eso baja el mínimo de 50 g para el huevo (55 g = 1 huevo) y para la clara (33 g = 1 clara), que con el mínimo genérico de 50 g nunca podían mostrarse como "1 clara".

Si el cálculo pide menos del mínimo, se sube al mínimo y el exceso de macro se descuenta de las anclas posteriores (nunca de la verdura ni de la fruta). Si pide más del máximo, se recorta al máximo y el déficit lo absorbe la segunda fuente del mismo rol; si no hay segunda fuente, lo absorbe el cierre de kcal.

**Redondeo final:** múltiplos de 5 g por debajo de 100 g y múltiplos de 10 g a partir de 100 g, para que sea utilizable con una báscula de cocina doméstica. En los alimentos contables, a unidades enteras de `unidad_g`.

**Cierre de kcal.** Tras escalar y redondear se calculan las kcal reales de la comida como `Σ (alimento.kcal · gramos / 100)` —**nunca** como `4·P + 4·HC + 9·G`, por lo dicho en §3.0— y se acepta si `|kcal_menu − objetivo.kcal| / objetivo.kcal ≤ 0,10`. Si se supera ese margen, se corrige en pasos de 5 g (10 g por encima de 100 g) respetando siempre los límites de ración, en este orden:

1. **Ancla de carbohidrato** (la más flexible dentro de la comida).
2. **Ancla de grasa**, hasta su mínimo de ración.
3. **Ancla de proteína**, solo como último recurso.

Este orden es coherente con el orden de sacrificio del motor (`[Paso 10]`: primero grasa, después proteína, y la proteína siempre la última), con un escalón previo —el hidrato— que en el motor no existe porque allí el hidrato es residual. Si tras agotar los tres pasos la desviación sigue por encima del 10 %, se prueba la siguiente plantilla del banco; si el banco se agota, se muestra el menú más cercano con la nota "Este ejemplo se queda a {X} kcal de tu objetivo de esta comida: ajusta la ración de {alimento} a tu gusto."

**Caso terminal de proteína (`WARN_MENU_PROTEINA_VEGETAL`).** Si tras agotar el banco la desviación de **proteína** de una comida supera el 15 % por defecto —situación alcanzable con `preferencia ∈ {vegano, vegetariano}` y objetivos de proteína altos con pocas comidas—, no se imprime un gramaje imposible en silencio: se muestra el mejor menú disponible y, encima, el aviso "Con fuentes solo vegetales y {n} comidas al día, llegar a {P} g de proteína exige raciones muy grandes. Repártela en una comida más o apóyate en un suplemento de proteína vegetal (guisante o soja): es la forma realista de llegar." Este aviso lo genera el módulo de menús, no el motor, y se lista en §2.8 y en el PDF como el resto.

**Desviación de hidrato y de grasa (nota del día).** El cierre trabaja sobre kcal y proteína, así que el hidrato y la grasa del menú pueden alejarse del reparto que la propia pantalla imprime dos bloques más arriba. Cuando la desviación **diaria** supera el 20 % (el **10 %** en el hidrato con `'diabetes' ∈ condiciones`, que es el macro que ajusta la medicación), el bloque de menús lleva su nota diciendo la cifra real y la del plan. Sin ella, un menú con 37 g de hidrato de más se publicaba en silencio junto a la nota de diabetes, que presupone que los gramajes son fieles al plan.

**Comprobación de fibra.** Tras el cierre, se suma la fibra real del menú del día, `fibra_menu = Σ (alimento.fibra · gramos / 100)`, **sin redondear ninguno de los dos lados**: si `fibra_menu < 0,70 · fibra_objetivo` (`fibra_objetivo` = `resultado.macros.fibra_g`, `[Paso 11]`), se rota primero la verdura y la legumbre a las de mayor fibra que pasen los filtros; si aun así no llega, se muestra bajo los menús la nota "Este menú de ejemplo se queda en {X} g de fibra frente a los {Y} g de tu objetivo: añade una ración de verdura, legumbre o fruta." Sin esta comprobación, la tarjeta de fibra de §2.2 podía prometer 25 g mientras el menú entregaba la mitad.

### 3.4 Verdura y fruta: qué alimentos y cuándo

- Toda comida "principal" incluye una verdura de `foods.json` (rol `verdura`), elegida por rotación dentro de las que cumplan los tags de la preferencia (todas las verduras de `foods.json` son aptas para cualquier preferencia dietética).
- Las comidas "ligeras" (snacks) incluyen fruta con más frecuencia que verdura, salvo que la plantilla indique lo contrario (p. ej. un snack salado tipo "atún + tortitas de arroz").
- El desayuno puede llevar fruta en vez de o además de verdura, según la plantilla.
- La ración es fija (`racionTipica_g`), pero **sus macros sí se descuentan** de los objetivos de la comida: son los primeros alimentos que se colocan (§3.3, paso 0). "Ración fija" significa que el gramaje no se escala, no que sus hidratos sean gratis.

### 3.5 Medida casera: cómo se escribe un gramaje

`medidaCasera` está redactada para `racionTipica_g`, así que copiarla tal cual sobre cualquier gramaje produce textos falsos ("280 g de pechuga de pollo (1 pechuga mediana)"). Regla normativa, aplicable en §2.5 y §4.4:

- **Alimento contable** (tiene `unidad_g` y `unidad_nombre`): `n = round(gramos / unidad_g)` y el texto es "{n} {unidad_nombre}", pluralizando el sustantivo y no el calificativo ("3 huevos M", "2 latas pequeñas", "1 clara"). El gramaje mostrado es siempre `n · unidad_g`, para que las dos cifras concuerden.
- **Alimento no contable:** `r = gramos / racionTipica_g` y se antepone un cuantificador a `medidaCasera`:

| `r` | Texto |
|---|---|
| < 0,75 | "ración pequeña, {medidaCasera}" |
| 0,75 – 1,35 | "{medidaCasera}" |
| 1,36 – 2,25 | "ración generosa, {medidaCasera}" |
| > 2,25 | "ración doble, {medidaCasera}: puedes repartirla en dos platos" |

El formato final de línea es "{gramos} g de {nombre} ({texto de medida casera})".

### 3.6 Tres ejemplos completos calculados

Se usan los tres primeros casos de prueba de `SPEC-calculo.md` (sección 5) como base, aplicando el algoritmo de §3.3 a su reparto por comidas ya calculado por el motor.

**Estas tablas son vectores de prueba, no ilustraciones.** Están **regeneradas** con el código actual (`calcular()` → `generarEjemplos()` sobre `src/data/foods.json`, 101 alimentos), no escritas a mano, y las fija el test `src/meals/__tests__/vectores36.test.ts`: falla si cambia un solo gramaje, un alimento o las kcal del día. Si cambia el reparto por comidas de la sección 5 de `SPEC-calculo.md`, o cambian los macros de un alimento usado aquí, **estas tres tablas se regeneran**; no se corrigen a mano.

La columna "Plantilla" de la versión anterior desaparece: el módulo no publica el id de plantilla (es un detalle interno de §3.2, y el algoritmo prueba varias hasta que una cierra), así que el vector comprobable es el menú, no la plantilla que lo produjo.

Convenio de las tablas: la columna "P / G / HC" y la de kcal son los valores **reales del menú** calculados con `foods.json` (kcal = `Σ alimento.kcal · g / 100`), y "Δ kcal" es la desviación frente al objetivo de esa comida.

#### Ejemplo A — Caso 1 del motor (hombre 84 kg, `perder`, fuerza, omnívoro, 4 comidas, entrena por la tarde)

Objetivo por comida (motor): Desayuno 45P/20G/50HC (560 kcal) · Comida 55P/20G/55HC (620 kcal) · Merienda 30P/10G/40HC (370 kcal, peri-entreno) · Cena 55P/20G/60HC (640 kcal).

| Comida | Alimentos y gramaje | P / G / HC | kcal | Δ kcal |
|---|---|---|---|---|
| Desayuno | Plátano 120 g · Queso fresco batido 0% 250 g · Clara de huevo 132 g · Pan integral 30 g · Almendras 35 g | 46,2 / 19,6 / 57,3 | 566 | +1,1 % |
| Comida | Tomate 180 g · Pechuga de pavo 220 g · Pasta cocida 150 g · AOVE 15 g | 63,1 / 19,0 / 53,5 | 639 | +3,1 % |
| Merienda | Pera 170 g · Requesón 230 g · Pan blanco 30 g | 28,6 / 9,9 / 48,3 | 402 | +8,6 % |
| Cena | Lechuga 90 g · Merluza 250 g · Clara de huevo 99 g · Patata cocida 280 g · AOVE 20 g | 60,0 / 22,2 / 59,3 | 670 | +4,7 % |

Total del día: 197,9 P / 70,7 G / 218,4 HC, 2.277 kcal (objetivo del motor 2.190 kcal, +4,0 %). Fibra del menú: 26,7 g, por encima del umbral `0,70 · 31 = 21,7 g`. Ninguna nota.

Nota de producto: la Merienda ilustra por qué las comidas ligeras necesitan una segunda fuente. El requesón solo no llega ni a las kcal ni al hidrato; la fruta de la plantilla lo cierra. El algoritmo lo resuelve sin intervención: la fruta se coloca en el paso 0 y el ancla de HC se calcula ya con su aporte descontado.

#### Ejemplo B — Caso 2 del motor (mujer 60 kg, `recomposicion`, cardio, vegetariana, 3 comidas, entrena por la mañana)

Objetivo por comida: Desayuno 35P/15G/70HC (555 kcal, peri-entreno) · Comida 45P/15G/65HC (575 kcal) · Cena 40P/20G/70HC (620 kcal).

| Comida | Alimentos y gramaje | P / G / HC | kcal | Δ kcal |
|---|---|---|---|---|
| Desayuno | Kiwi 150 g · Requesón 250 g · Pan integral 90 g | 38,2 / 13,5 / 66,9 | 559 | +0,7 % |
| Comida | Calabacín 180 g · Queso cottage 250 g · Huevo entero 55 g · Quinoa cocida 220 g | 46,6 / 21,6 / 60,9 | 630 | +9,6 % |
| Cena | Berenjena 180 g · Garbanzos cocidos 240 g · Huevo entero 55 g · Avena en copos 30 g | 34,5 / 14,8 / 94,2 | 650 | +4,8 % |

Total del día: 119,3 P / 49,9 G / 222,0 HC, 1.839 kcal (objetivo 1.740 kcal, +5,7 %). Fibra del menú: 45,4 g.

Observación: la cena se pasa un 35 % del objetivo de hidrato porque los garbanzos arrastran hidrato junto con la proteína y el tope cruzado del paso 1 ya limita su ración a 240 g. La tolerancia del módulo es sobre kcal y proteína, no sobre cada macro por separado; la desviación **diaria** de hidrato de este menú (+5 %) queda por debajo del umbral que dispara la nota del día.

#### Ejemplo C — Caso 3 del motor (hombre 105 kg, obesidad II, `perder` agresivo, sedentario, omnívoro, 3 comidas)

Objetivo por comida: Desayuno 50P/25G/40HC (585 kcal) · Comida 55P/25G/50HC (645 kcal) · Cena 55P/30G/50HC (690 kcal).

| Comida | Alimentos y gramaje | P / G / HC | kcal | Δ kcal |
|---|---|---|---|---|
| Desayuno | Naranja 180 g · Queso cottage 250 g · Clara de huevo 132 g · Pan integral 30 g · Semillas de lino molidas 30 g | 52,0 / 24,8 / 52,0 | 633 | +8,2 % |
| Comida | Berenjena 180 g · Muslo de pollo 250 g · Pasta cocida 130 g · AOVE 15 g | 59,3 / 26,1 / 51,1 | 692 | +7,3 % |
| Cena | Champiñones 130 g · Merluza 250 g · Clara de huevo 66 g · Arroz blanco cocido 160 g · AOVE 25 g | 58,1 / 27,5 / 49,6 | 681 | −1,3 % |

Total del día: 169,4 P / 78,4 G / 152,7 HC, 2.006 kcal (objetivo 1.910 kcal, +5,0 %). Fibra del menú: 24,2 g, por encima del umbral `0,70 · 27 = 18,9 g`, así que este menú no dispara la nota de fibra (con 20 g de lino en vez de 30 el vector se quedaba a 2,6 g del umbral: era el más frágil de los tres).

**Última regeneración.** Al bajar a 250 g el máximo de ración del lácteo proteico (la mitad no corregida de la QA §7), al cerrar las claras en cuatro unidades, al mandar el solomillo al final de la lista de carne magra y al añadir la escalada de rol de §3.2 (regla 3bis). Los tres menús los fija `src/meals/__tests__/vectores36.test.ts`.

**Diferencias con la versión anterior de estas tablas.** Se regeneran por cuatro cambios de la ronda de cierre, todos con su issue: los máximos de ración vuelven a ser duros (nada de ampliarlos por número de platos), las variantes «sin lactosa» salen de la rotación de las demás preferencias, los alimentos contables tienen topes de plausibilidad, y las alternativas de cada comida se filtran por preferencia. Las tablas anteriores tampoco eran reproducibles con el código: citaban plantillas y gramajes que el algoritmo no producía.

Estas plantillas —OMN-DES-1/2, OMN-PRI-1/2/3, OMN-LIG-1, VEG-DES-1, VEG-PRI-1/2— son parte del banco de §3.2, no un catálogo aparte. Los bancos `vegano`, `sin_lactosa`, `sin_gluten` y `low_carb` están definidos en la tabla de §3.2 con el mismo formato y se validan con el mismo test.

### 3.7 Modo sencillo y lista de la compra

**El problema que resuelve.** El menú de §3.2-§3.6 rota plantillas y alimentos para que el ejemplo no sea monótono, y eso produce un día con ocho o diez alimentos distintos que, extrapolado a la semana, se convierte en una compra grande, cara y con mucha merma. Quien abandona una dieta rara vez lo hace por los macros: lo hace porque comprar y cocinar quince cosas distintas no le cabe en la semana. El modo sencillo es la respuesta a eso, y la lista de la compra es la que convierte los gramos del menú en algo que se puede meter en un carro.

#### 3.7.1 El interruptor del paso 13

Se añade al paso 13 del wizard, después del clima, como interruptor (no tarjetas):

- **Título (copy literal):** "¿Quieres comidas sencillas?"
- **Descripción (copy literal):** "Menos alimentos distintos, comidas que se repiten y una compra fácil. Ideal si no quieres pensar."
- Campo: `InputCalculo.menu_sencillo?: boolean`, **`false` por defecto** (ausente equivale a `false`).
- **El motor de cálculo lo ignora por completo.** No entra en kcal, macros, agua, peso objetivo ni cronograma: dos usuarios idénticos salvo este interruptor reciben exactamente el mismo `Resultado`. Solo lo lee `src/meals`, que con `true` cambia de banco de alimentos. Esto es deliberado: el modo sencillo es una restricción de variedad, no una dieta distinta, y no debe poder verse como "el plan cambia según cómo de vago seas".

#### 3.7.2 Banco sencillo (normativo)

Con `menu_sencillo === true`, el generador sustituye la rotación de §3.2 por estas reglas. **Todo lo demás sigue igual**: mismas plantillas, mismo algoritmo de escalado de §3.3, mismas tolerancias (±10 % de kcal, ±15 % de proteína), mismos avisos y mismo determinismo (sin `Math.random`).

1. **Tope de variedad: como mucho 12 alimentos distintos en toda la semana.** Se cuentan los `id` distintos que aparecen en los dos días del par, incluidas verduras, frutas y el AOVE. La implementación lo garantiza **por construcción**, separando dos listas: la **lista blanca** de la preferencia (la tabla de candidatos de abajo, hasta 16 ids) marca lo que *puede* llegar a la lista de la compra, y las **plantillas** de los días A y B usan un subconjunto de como mucho 12 ids distintos, así que la unión de los dos días nunca pasa de 12 aunque se usen todas las plantillas. Un banco cuyas plantillas declaren un decimotercer id es un error, y un test lo tumba.
2. **Dos variantes por rol de comida, que se alternan por día par/impar.** El generador construye un **día A** y un **día B** con la misma estructura de comidas y los mismos objetivos por toma, cambiando solo la plantilla dentro del rol (`…-1` en A, `…-2` en B). El calendario del usuario es: días 1, 3, 5, 7 → día A; días 2, 4, 6 → día B. Con `n_comidas = 3` eso son 2 desayunos, 2 comidas y 2 cenas para toda la semana.
3. **Solo alimentos básicos y repetibles.** Cada `FoodQuery` de la plantilla se resuelve **únicamente** contra la lista de candidatos de su preferencia (tabla de abajo), en el orden en que está escrita: gana el primero que pase los filtros de §3.2 y los límites de ración de §3.3. Si ninguno pasa (situación que la validación de la base debe hacer imposible), se cae a la rotación normal de §3.2 para esa `FoodQuery` y se anota el fallback en el log.

   **El respaldo por toma tampoco sale de la lista blanca.** Una toma que el banco corto no consigue meter en el ±10 % de kcal se rehace con las **plantillas** del banco normal de §3.2 —que reparten los papeles de otra manera y suelen cerrar mejor— pero **resolviendo sus `FoodQuery` solo contra los candidatos de la preferencia**. Una sustitución se acepta únicamente si la semana resultante sigue cabiendo en los 12 alimentos y ninguno de ellos está fuera de la lista blanca; si ninguna lo cumple, se conserva el menú sencillo con su nota de desviación. Sin esta condición el modo "sencillo" acababa metiendo en la compra proteína de guisante en polvo, semillas de lino o requesón, que es exactamente lo que el modo promete no hacer.

   **La vía de escape de low-carb se limita a una toma al día.** §3.2 permite un cereal normal cuando el ancla low-carb no cubre el hidrato del plan ni con su ración máxima. En modo sencillo ese escape se autoriza en **una sola toma**, la de más hidrato del reparto (empates: la primera), y con un único id (`patata_cocida`). Sin ese tope el escape ganaba en las tres comidas: la lista de la compra de quien había pedido low-carb salía encabezada por patatas y las dos anclas propias de la tabla (`arroz_coliflor` y `pan_proteico`) no aparecían nunca.
4. **La preferencia dietética manda siempre.** El banco sencillo es un subconjunto del banco de la preferencia, nunca una excepción: un usuario vegano en modo sencillo no ve huevo ni atún, y uno sin gluten no ve avena ni pan integral (ninguno de los dos lleva el tag `sin_gluten` en `foods.json`).

**Candidatos del banco sencillo, por preferencia** (ids de `foods.json`, en orden de preferencia):

| Preferencia | Proteína | Carbohidrato | Grasa | Verdura y fruta |
|---|---|---|---|---|
| `omnivoro` | `pechuga_pollo`, `huevo_entero`, `atun_natural`, `pechuga_pavo`, `lentejas_cocidas` | `arroz_blanco_cocido`, `patata_cocida`, `avena_copos`, `pan_integral` | `aove`, `almendras` | `brocoli`, `judia_verde`, `tomate`, `platano`, `manzana` |
| `vegetariano` | `huevo_entero`, `queso_fresco_batido_0`, `yogur_griego_0`, `lentejas_cocidas`, `garbanzos_cocidos` | `arroz_blanco_cocido`, `patata_cocida`, `avena_copos`, `pan_integral` | `aove`, `almendras` | `brocoli`, `judia_verde`, `tomate`, `platano`, `manzana` |
| `vegano` | `tofu_firme`, `lentejas_cocidas`, `garbanzos_cocidos`, `yogur_soja_proteico`, `soja_texturizada_hidratada` | `arroz_blanco_cocido`, `patata_cocida`, `avena_copos`, `pan_integral` | `aove`, `almendras` | `brocoli`, `judia_verde`, `tomate`, `platano`, `manzana` |
| `sin_lactosa` | `pechuga_pollo`, `huevo_entero`, `atun_natural`, `queso_fresco_batido_0_sl`, `lentejas_cocidas` | `arroz_blanco_cocido`, `patata_cocida`, `avena_copos`, `pan_integral` | `aove`, `almendras` | `brocoli`, `judia_verde`, `tomate`, `platano`, `manzana` |
| `sin_gluten` | `pechuga_pollo`, `huevo_entero`, `atun_natural`, `yogur_griego_0`, `lentejas_cocidas` | `arroz_blanco_cocido`, `patata_cocida`, `tortitas_arroz` | `aove`, `almendras` | `brocoli`, `judia_verde`, `tomate`, `platano`, `manzana` |
| `low_carb` | `huevo_entero`, `pechuga_pollo`, `atun_natural`, `queso_fresco_batido_0`, `yogur_griego_0` | (ancla opcional, regla propia de §3.2) `arroz_coliflor`, `pan_proteico` | `aove`, `aguacate`, `almendras` | `brocoli`, `judia_verde`, `tomate`, `fresas` |

Ninguna lista tiene más de 16 candidatos y ningún menú usa los 16: el tope duro de la regla 1 son los **12 alimentos distintos** que llegan a la lista de la compra. `patata_cocida` no es un candidato de `low_carb`: entra solo como vía de escape de §3.2, con el tope de una toma al día de la regla 3.

**Cada preferencia lleva dos anclas de proteína.** Las tomas grandes (mucha proteína en pocas kcal) no caben en una sola ancla sin pasarse de los límites de ración de §3.3, así que las plantillas principales y los desayunos declaran `ancla_proteina_2`, y al menos una de las dos es de **baja densidad energética** (kcal por gramo de proteína): la lenteja en `omnivoro`, `sin_lactosa` y `sin_gluten`; el queso fresco batido 0 % en `vegetariano`; el tofu y la soja texturizada en `vegano`; el huevo en `low_carb`. Con una sola ancla, las tomas de proteína alta se quedaban a treinta puntos porcentuales del objetivo.

#### 3.7.3 Lista de la compra semanal (normativo)

Se genera **siempre que haya menú**, con `menu_sencillo` activo o no; en modo sencillo es más corta y más barata de ejecutar, pero no es una función exclusiva de ese modo. Con `renal` o `hepatica` (§3.1) no hay menú y tampoco hay lista: `Ejemplos.compra` queda `undefined`.

**Fuente de los formatos:** `src/data/mercadona.json`, con **una fila por cada alimento de `foods.json`** y este esquema (validado por `src/data/__tests__/mercadona.test.ts`):

| Campo | Significado |
|---|---|
| `alimento_id` | `id` de `foods.json` (cobertura total, sin duplicados) |
| `producto` | Nombre comercial típico en Mercadona, con "Hacendado" cuando es lo habitual. **Nunca lleva precio** |
| `envase_g` | Peso neto aproximado de un envase o unidad de compra, **en la misma base en la que `foods.json` mide ese alimento**: en crudo para los `crudo`, ya cocido para los `cocido` (1 kg de arroz crudo ≈ 2,6 kg cocido), escurrido para las conservas y **peso comestible** para huevos y piezas de fruta (docena de huevos L ≈ 660 g). Siempre > 0 y ≥ `racionTipica_g` |
| `envase_descripcion` | Formato en texto ("bandeja ≈ 1 kg", "docena", "bote 570 g (≈ 400 g escurridos)", "malla ≈ 3 kg") |
| `seccion` | `SeccionSuper`: `carniceria`, `pescaderia`, `huevos_lacteos`, `fruteria`, `despensa`, `congelados`, `panaderia`, `otros` |
| `conservacion` | `fresco`, `despensa` o `congelado` |
| `conservacion_dias` | Días razonables que aguanta lo comprado en nevera, congelador o despensa |
| `consejo` | Opcional, breve, en español de España |

**Sin precios, y es una decisión, no un olvido:** varían por tienda, por semana y por formato, y un precio equivocado en un PDF descargado envejece mucho peor que un gramaje. Por el mismo motivo los formatos que no son estándar se escriben con "≈" y la lista lleva su nota fija.

**Fórmulas (todas deterministas, sin redondeos ocultos):**

```
g_A           = Σ gramos de ese alimento en el día A del menú (0 si no aparece)
g_B           = Σ gramos de ese alimento en el día B (modo sencillo; 0 si no aparece)
gramos_semana = round(4 · g_A + 3 · g_B)          // modo sencillo: el calendario de §3.7.2
              = round(g_A · 7)                     // modo normal: un solo día repetido
gramos_dia    = round1(gramos_semana / 7)          // media diaria, a 1 decimal
envases       = ceil(gramos_semana / envase_g)                       // ≥ 1
dura_bruto    = floor(envases · envase_g / gramos_dia)               // días que da lo comprado
dura_dias     = min(dura_bruto, conservacion_dias)
```

**La semana del modo sencillo se pondera 4/3, no 1/2.** El calendario que publica §3.7.2 son cuatro días del día A (1, 3, 5 y 7) y tres del día B (2, 4 y 6). Usar la media aritmética de los dos días equivalía a comprar 3,5 días de cada uno e **infracompraba** todo alimento que pesa más en el día A; en algún caso cruzaba el borde de envase y el usuario se quedaba sin producto a mitad de semana. `gramos_dia` es una media derivada de la semana real, no al revés, y es lo que la pantalla imprime como "… g al día".

- Si `conservacion === 'fresco'`, `dura_bruto > conservacion_dias` **y además `envases ≥ 2` y `gramos_semana > envase_g`**, la línea lleva el consejo fijo **"Es fresco: cómpralo en dos veces, mitad al principio de la semana y mitad a mitad."** (sustituye al `consejo` del catálogo, que se pierde en ese caso). Es la única regla que reescribe el consejo. Con **un solo envase** el consejo no se aplica: partir en dos una única docena de huevos o un único paquete de pan de molde es materialmente imposible y contradice el consejo de conservación de la ficha.
- `alimentos_distintos = items.length`. En modo sencillo, un test debe fallar si pasa de 12.
- **Orden:** por `seccion`, en el orden en que `SeccionSuper` declara sus valores (carnicería → pescadería → huevos y lácteos → frutería → despensa → congelados → panadería → otros); dentro de cada sección, por `nombre` del alimento (`localeCompare('es')`).
- **Notas fijas, literales y en este orden**, en `ListaCompra.notas`:
  1. "Formatos aproximados; pueden variar por tienda"
  2. "Compra fresco dos veces por semana"
  3. "Pesa en crudo"
- `supermercado` es siempre `'Mercadona'` y `dias` siempre `7`: son literales del tipo para que la UI no invente otros.

**API (ver `docs/CONTRATO.md`):**

```ts
export function generarListaCompra(ejemplos: Ejemplos, inputs: Inputs): ListaCompra
```

- Recorre `ejemplos.entreno.comidas[].alimentos[]` y agrupa por `id`. Con `inputs.menu_sencillo === true` reconstruye internamente el día B con la misma regla determinista de §3.7.2 y pondera los dos días 4/3; no necesita que el día B viaje en `Ejemplos`. La preferencia con la que reconstruye el día B sale de `Ejemplos.preferencia_efectiva` cuando el generador la ha dejado escrita (campo opcional del contrato); si no está, se deduce por mayoría de ids del día A.
- `generarEjemplos` la llama y deja el resultado en `Ejemplos.compra`, y marca `Ejemplos.modo_sencillo = inputs.menu_sencillo === true`. La UI y el PDF **pintan `ejemplos.compra` tal cual**: no recalculan gramos ni envases.
- Determinista y pura: mismos `Ejemplos` e `Inputs` → misma lista, incluido el orden de `items`.

#### 3.7.4 Dónde se ve

- **Pantalla:** §2.5b, justo debajo de los ejemplos de menú y sus equivalencias.
- **PDF:** §4.4b, **página nueva inmediatamente después de los menús y las equivalencias**, para que se pueda imprimir suelta y llevarla al supermercado.

---

## 4. Estructura del PDF exportable

### 4.0 Principios

- El PDF es una **instantánea fiel** de la pantalla de resultados en el momento de la descarga: mismos números, mismos avisos, mismo ejemplo de menú (el que estuviera activo, no uno aleatorio nuevo). "Fiel" es una obligación verificable: todo número visible en pantalla tiene que estar también en el PDF. Las páginas 3 y 5 recogen los bloques que la v1 dejaba fuera (azúcares libres, MLG, metodología ampliada, marca de objetivo reconvertido).
- **Única excepción, y es en sentido contrario:** el PDF nunca contiene el cribado del paso 5b ni `'tca'` en ninguna lista, y con `'tca' ∈ condiciones` el motor tampoco emite los avisos que enunciarían el %grasa, el peso objetivo o el cronograma —los bloques que §2.1 y §2.6 ocultan— (lista cerrada en §2.8 y en el `[Paso 17]` de `SPEC-calculo.md`). El aviso que sí aparece es `INFO_RITMO_SUAVE`, con su texto íntegro, que no menciona la causa. No es un recorte de información del plan: es la contrapartida de lo que se le promete al usuario en la pantalla donde se le pregunta.
- Formato A4, orientación vertical, tipografía legible (mínimo 10pt cuerpo de texto), **6-8 páginas**. El límite original (4-6) no era compatible con el contenido que las §4.2-§4.6 obligan a imprimir: los nueve vectores de la §5 salían en 6-8 páginas ya antes de añadir la tabla de equivalencias que exige la §4.4. Se han fundido la página de peso objetivo/consejos/referencias y la de avisos en un solo flujo (sin salto forzado) y se ha compactado el interlineado; el test de integración del exportador falla si algún vector pasa de 8 páginas. **Con la página de lista de la compra de §4.4b el rango pasa a 6-9 páginas y el test, a 9**: la lista es una página entera y no se puede fundir con los menús, porque está pensada para imprimirse suelta y llevarla al supermercado.
- Cada bloque de contenido lleva su fuente/cita si aplica (p. ej. "Mifflin-St Jeor, 1990"), en letra pequeña al pie del bloque, no como nota académica invasiva.
- El PDF nunca omite el disclaimer completo ni los avisos activos: no es una versión "resumida y sin avisos" del resultado.

### 4.1 Página 1 — Portada

- Logo/nombre "Báscula" (RS Agents).
- Título: "Tu plan nutricional personalizado".
- Datos básicos del usuario en una tarjeta: sexo, edad, altura, peso, fecha de generación (`fecha_inicio` o fecha de descarga).
- Objetivo principal en grande: "{Perder grasa / Mantenerte / Ganar músculo / Recomposición}".
- Pie de portada: "Documento informativo generado automáticamente. No sustituye una valoración nutricional individualizada. RS Agents / Báscula no se hace responsable del uso que se haga de esta información sin supervisión profesional."

### 4.2 Página 2 — Resumen de datos y resultados

- Tabla de datos de entrada: sexo, edad, altura, peso, **%grasa (rango + método) salvo la guarda de abajo**, actividad diaria, entrenamiento (tipo/días/duración/intensidad), objetivo, ritmo, preferencia dietética, nº de comidas.
- Bloque de resultados clave (igual que la cabecera de la pantalla de resultados, sección 2.1): kcal, IMC + categoría, **%grasa rango salvo la guarda de abajo**, TDEE.
- **Guarda del cribado (normativa, misma regla que §2.1 y §4.5).** Si `cribado_tca ∈ {positivo, evitado}`, la fila "%grasa (rango + método)" de la tabla de datos de entrada y el "%grasa rango" del bloque de resultados clave **se omiten**, igual que §2.1 los omite en pantalla: la tabla queda con sexo, edad, altura, peso, actividad, entrenamiento, objetivo, ritmo, preferencia y nº de comidas, y el bloque de resultados clave con kcal, IMC + categoría y TDEE. Sin esta guarda el PDF reimprimía en la página 2 exactamente el dato que la pantalla acababa de ocultar.
- Si hay algún aviso de condición médica (`WARN_DIABETES`, `WARN_RENAL`, `WARN_HEPATICA`, `WARN_CARDIACA`, `WARN_HIPERTENSION`, `WARN_TIROIDES`, `WARN_BARIATRICA_GLP1`, `WARN_CONDICION_OTRA`), o `WARN_IMC_35` / `WARN_IMC_40`, o `edad ≥ 65`: sección destacada **"Avisos para tu caso"** en esta misma página, antes de seguir con el plan (según instrucción explícita de la investigación), con el texto completo de cada aviso relevante. Es **la misma condición, palabra por palabra, que la de prioridad visual de §2.8**, para que pantalla y PDF sigan siendo "la misma instantánea" que exige §4.0. `'tca'` **no** activa esta sección ni aparece en la tabla de datos de entrada (§1.2, paso 5b).
- Si el objetivo se reconvirtió (`INFO_OBJETIVO_RESUELTO` o cualquier `WARN_*` de reconversión), etiqueta "Ajustado automáticamente" junto al objetivo, con el texto del aviso debajo — la misma marca que muestra la pantalla en §2.1.

### 4.3 Página 3 — Macros y agua

- Las 4 tarjetas de macro (proteína, grasa, carbohidratos, fibra) con gramos, g/kg, % y la frase explicativa de la tabla de la sección 2.2.
- Nota de cierre de kcal por redondeo.
- **Línea de azúcares libres** (estaba solo en pantalla): "Como referencia, limita los azúcares añadidos a menos de {azucares_libres_max_g} g/día."
- Bloque de hidratación, idéntico al de §2.3: **la franja "entre {rango_min} y {rango_max} ml al día" como cifra principal** y "{agua_ml} ml de referencia, ≈ {vasos} vasos" como línea secundaria, más la "Nota agua" de `SPEC-calculo.md` §4 reproducida íntegra (incluidas la frase del 20–30 % de agua de los alimentos y la del sodio/electrolitos). Si el motor no da objetivo de agua (`renal` o `cardiaca`, `[Paso 12]`), en su lugar va el texto del aviso correspondiente, nunca una cifra.
- Nota de metodología corta: fórmula de BMR usada y por qué (Mifflin-St Jeor / Katch-McArdle), con el número de TDEE bruto y el TDEE final tras el margen del 5%.

### 4.4 Página 4 — Reparto por comidas y ejemplos de menú

- Tabla de reparto por comidas (idéntica a la de pantalla, sección 2.4), con nota fija sobre la falta de evidencia de "más comidas = más metabolismo".
- Ejemplo de menú de un día completo (el que estuviera activo en pantalla), con alimento + gramos + medida casera calculada con la regla de §3.5, agrupado por comida — formato de lista, no tabla densa, para que sea legible impreso.
- Tabla de equivalencias (§2.5), en la misma página o en la siguiente si no cabe.
- Nota: "Son ejemplos para orientarte, no un menú obligatorio. Puedes sustituir cualquier alimento por otro de la misma familia sin descuadrar tus macros de forma relevante: mira la tabla de equivalencias."
- Si el generador no ha producido menú (`renal` o `hepatica`, §3.1), la página contiene solo la tabla de reparto y el texto de derivación de §3.1; no se imprime ningún gramaje de alimento.
- La tabla de reparto sale de `resultado.comidas` (un único array; en la v1 no hay reparto de día de entreno y de día de descanso, `[Paso 16]`), y usa el campo `hora` de cada comida como etiqueta de referencia y `peri` para marcar la toma de alrededor del entrenamiento.

### 4.4b Página — Lista de la compra semanal

- **Página nueva** (salto forzado) inmediatamente después de los menús y las equivalencias, para poder imprimirla suelta. Título: "Tu lista de la compra de la semana"; bajo el título, el subtítulo de §2.5b.
- Contenido: `ejemplos.compra` **tal cual**, sin recalcular nada, agrupado por sección en el orden de §3.7 y con las mismas cuatro columnas de §2.5b (producto, cantidad, envases a comprar, duración) más el consejo de cada línea en letra pequeña.
- **Mismas cuatro columnas quiere decir el mismo texto.** Las dos celdas de cantidad y el rótulo del modo sencillo salen de `textoCantidadSemana`, `textoCantidadDia` y `textoModoSencillo` (en `src/meals/compra.ts`), que usan la pantalla y el PDF. Con una función de formato en cada capa, la pantalla imprimía "1,93 kg en la semana · 82,5 g al día" y el PDF "1.925 g en la semana · 83 g al día" para la misma línea, y el PDF fijaba el plural ("1 alimentos").
- Si `ejemplos.modo_sencillo` es `true`, línea bajo el subtítulo: "Modo sencillo: {alimentos_distintos} alimentos para toda la semana."
- Al pie, las tres notas fijas de `compra.notas`, íntegras y en orden.
- **Nunca lleva precios** (§3.7): un precio impreso en un PDF que el usuario guarda meses envejece mucho peor que un gramaje.
- Si no hay menú (`renal` o `hepatica`, §3.1) o `ejemplos.compra` es `undefined`, **la página no se imprime**; no se sustituye por ningún texto, porque §4.4 ya explica por qué no hay menú.
- El límite de 6-8 páginas de §4.0 pasa a ser **6-9** con esta página: el test de integración del exportador falla si algún vector se pasa de 9.

### 4.5 Página 5 — Peso objetivo, cronograma y consejos

- Si aplica: peso objetivo (sugerido o dado por el usuario), hito intermedio si existe, cronograma con rango de semanas y fechas, nota `INFO_ADAPTACION`. Se aplican **las mismas dos reglas de presentación que en pantalla (§2.6)**: con `peso_objetivo.mostrar_central === false` se imprime solo la franja "entre X e Y kg", sin número grande; y con `cronograma.precision_fecha === 'mes'` se imprimen mes y año en vez de fechas exactas, y el bloque principal es el primer tramo de 12 semanas (`tramo_12sem`), no el horizonte completo.
- Si no aplica (mantener/recomposición): nota `INFO_SIN_CRONOGRAMA`. Si el bloque se omite por el cribado del paso 5b, no se imprime ni el peso objetivo ni ninguna nota que lo sustituya.
- Bloque "Qué haría un nutricionista": los 3-5 consejos seleccionados (sección 2.7), en formato de lista con viñetas.
- **Bloque "Otras referencias" (nuevo, cierra el hueco de §4.0).** Reproduce la metodología ampliada de §2.9, que la v1 dejaba solo en pantalla: %grasa por CUN-BAE, Deurenberg y US Navy (las que apliquen), masa libre de grasa (`mlg`, que es la base del suelo de disponibilidad energética citado en `WARN_SUELO_CALORICO_EA`), FFMI con su categoría, y las cuatro fórmulas clásicas de peso ideal (Devine, Robinson, Miller, Hamwi). Encabezado obligatorio del bloque: "Otras referencias, no son un objetivo." Si el %grasa está oculto por el cribado del paso 5b, este bloque se omite entero.

### 4.6 Última página — Avisos completos y disclaimer

- Listado completo de todos los avisos (`WARN_*` e `INFO_*`) activos, con su texto íntegro (no resumido), agrupados visualmente en "Avisos importantes" (WARN) y "Notas informativas" (INFO). Sin excepciones de texto ni de maquetación: el PDF pinta íntegra la lista de `resultado.avisos`. `INFO_RITMO_SUAVE` cae en el grupo de notas informativas por ser `info`, y su texto de la tabla §4 ya es neutro. La protección del cribado del paso 5b la aplica el motor, no el exportador: con `'tca' ∈ condiciones` no llegan aquí `INFO_GRASA_ESTIMADA`, `INFO_PESO_YA_MINIMO`, `INFO_IMC_MUSCULADO`, `INFO_ADAPTACION`, `WARN_YA_MAGRO`, `WARN_YA_EN_OBJETIVO`, `WARN_OBJETIVO_MUY_LEJANO`, `WARN_CRONOGRAMA_LARGO`, `INFO_SIN_CRONOGRAMA`, `INFO_SIN_CRONOGRAMA_SIN_MARGEN`, `INFO_CRONOGRAMA_NO_ESTIMABLE` e `INFO_CRONOGRAMA_FUERA_DE_HORIZONTE` (filtro del `[Paso 17]`, ver §2.8).
- El aviso `WARN_MENU_PROTEINA_VEGETAL` y la nota de fibra, si el generador los ha emitido (§3.3), se listan aquí igual que el resto.
- Disclaimer legal completo (texto íntegro de la sección 2.10 de este documento / sección 3 de la investigación).
- Enlace de ayuda TCA/ADANER, siempre presente, no condicionado a haber marcado riesgo.
- Pie: fecha de generación, versión del motor de cálculo (para poder reproducir el cálculo si el usuario vuelve más adelante con datos distintos).

---

## 5. Referencias cruzadas con `SPEC-calculo.md`

Este documento no redefine ningún número, fórmula, suelo, techo ni tabla del motor de cálculo: todos los valores mostrados en el wizard, en resultados y en el PDF provienen literalmente de la salida `Resultado` de `SPEC-calculo.md` o de sus tablas de la sección 3. Cualquier cambio futuro en una fórmula, suelo o tabla del motor debe reflejarse aquí solo en el copy o la disposición visual, nunca inventando un cálculo alternativo en la capa de UX.

**Lo único que este documento sí define por su cuenta** es el módulo de menús de la sección 3, que no forma parte del motor: sus plantillas, sus límites de ración, su cierre de kcal y sus dos salidas propias (`WARN_MENU_PROTEINA_VEGETAL` y la nota de fibra). Esas dos salidas se listan en el bloque de avisos como cualquier otra, pero las emite el generador, no el motor, y no aparecen en la tabla §4 de `SPEC-calculo.md`.

**Campos que este documento asume y que el motor ya proporciona** (reconciliación del 2026-09-07: todos existen en `SPEC-calculo.md`, ninguno queda pendiente):

| Lo que usa este documento | Dónde vive en el motor |
|---|---|
| `cribado_tca` como entrada que alimenta `condiciones` | §0.3 e `InputCalculo`, §1 fila 17, normalizado en el Paso 0 |
| `INFO_RITMO_SUAVE` (sustituye al antiguo `WARN_TCA`, texto ya neutro) | §4 y Paso 6.7 |
| `WARN_CARDIACA` | §4 y Paso 8 |
| `WARN_PROTEINA_TOMA_ALTA` y `WARN_PROTEINA_POR_TOMA` (sin la fórmula "con tantas comidas") | §4 y Paso 16 |
| `mlg`, `macros.azucares_libres_max_g`, `ffmi.valor` / `ffmi.normalizado` / `ffmi.categoria` | `Resultado` |
| `agua === null` con `renal` o `cardiaca`, más `INFO_AGUA_NO_PRESCRITA` | Paso 12 |
| `peso_objetivo.mostrar_central` | Paso 13 |
| `cronograma.precision_fecha` y `cronograma.tramo_12sem` | Paso 14 |
| `comidas[i].hora` y `comidas[i].peri`, con un único array `comidas` | Paso 16 y tabla 3.13 |
| `excluido: 'ERR_INPUT_RANGO'` con `errores: string[]` | Paso 0 y `Resultado` |
| `condiciones` y `peso_kg` del generador de menús (§3.1) | **`InputCalculo`, no `Resultado`**: el motor no los republica en su salida. Se pasa la lista **cruda** del usuario (`inputs.condiciones`), no la normalizada del Paso 0, para que `'tca'` no llegue nunca al módulo de menús |
| `preferencia_efectiva` y `macros.fibra_g` del generador de menús (§3.1) | `Resultado` (Paso 6.8 y Paso 11) |


---

## 6. Registro de revisión

Decisiones sobre los issues de `docs/ISSUES-verificacion.md` cuya ubicación principal es este documento o `docs/foods.json`. Los issues cuya ubicación principal es `SPEC-calculo.md` se registran en ese documento, aunque aquí se haya aplicado su parte de UX.

| # | Sev. | Decisión | Resumen de lo aplicado |
|---|---|---|---|
| 9 | MAJOR | Aceptado (opción b) | Paso 5b: se sustituye la promesa "tu respuesta es privada y no aparece en tu informe" por lo que de verdad se cumple, y el aviso pasa a ser `INFO_RITMO_SUAVE`, con texto neutro que no menciona la causa. El enlace de ADANER ya era pie universal, así que no delata. |
| 11 | MAJOR | Aceptado | §3.1: el generador recibe `condiciones`; con `renal` o `hepatica` devuelve `menu: null` y §2.5/§4.4 se sustituyen por un texto de derivación. Motivo: `foods.json` no tiene potasio, fósforo ni sodio, así que no puede filtrar lo que esas patologías restringen. |
| 13 | MAJOR | Aceptado (variante de a; b y c completos) | Cribado de dos ítems en vez de uno; "Prefiero no responder" se trata igual que un "Sí" (precautorio, sin decírselo con ese marco); se salta el selector de siluetas (6.C) y se ocultan %grasa, peso objetivo y cronograma. No se adopta el SCOFF de 5 ítems completo: dos ítems son el compromiso entre sensibilidad y longitud del wizard. |
| 15 | MAJOR | Aceptado parcial (punto c) | §3.3: caso terminal `WARN_MENU_PROTEINA_VEGETAL` cuando la desviación de proteína supera el 15 % tras agotar el banco, en vez de imprimir un gramaje imposible. Los puntos a y b (orden de los multiplicadores y techo del 30 %) son del motor. |
| 22 | MINOR | Aceptado (completado en la reconciliación) | El paso 5 ofrece las diez condiciones que el motor declara: `diabetes`, `renal`, `hepatica`, `cardiaca`, `hipertension`, `tiroides`, `bariatrica`, `glp1`, `otra`. Insuficiencia cardiaca e hipertensión van separadas: solo la primera suprime el objetivo de agua, y fundirlas dejaba sin hidratación a todo el público hipertenso. El texto fijo de derivación se mantiene, pero ya no como sustituto de opciones inexistentes. |
| 23 | CRITICAL | Aceptado | §3.6 (antes §3.5): las tres tablas se han regenerado ejecutando el algoritmo de §3.3 contra `foods.json` y se declaran vectores de prueba con tolerancia ±10 % de kcal. Las anteriores estaban escritas a mano y sobreestimaban la proteína entre 8 y 20 g por comida. |
| 24 | CRITICAL | Aceptado (lado UX) | §3.3 ya no afirma que el motor recorte el hidrato primero: describe HC → grasa → proteína dentro de la comida y lo declara coherente con el orden de sacrificio del motor (grasa antes que proteína), que agente A ha fijado en el Paso 10. |
| 26 | CRITICAL | Aceptado | `foods.json` incorpora fuentes veganas densas realistas en España (proteína de guisante y de soja en polvo, soja texturizada hidratada, tofu firme, tiras de soja, altramuces, yogur de soja proteico); §3.2 define el banco `vegano` (VGN-*) y §3.3 el caso terminal con aviso. |
| 27 | CRITICAL | Aceptado (a + b) | `'tca'` no se serializa en ninguna salida; no activa la sección "Avisos para tu caso"; el único rastro es `INFO_RITMO_SUAVE`, cuyo texto es neutro. Documentado como excepción explícita en §4.0 y §4.6. |
| 28 | CRITICAL | Aceptado | §3.2 define los seis bancos (omnívoro, vegetariano, vegano, sin lactosa, sin gluten, low-carb) con plantillas identificadas y estables, más el fallback declarado cuando ninguna es válida. |
| 29 | MAJOR | Aceptado | `foods.json` añade las variantes españolas sin lactosa (leche, yogur griego 0 %, queso fresco batido 0 %, kéfir) con el tag `sin_lactosa`; la preferencia deja de vaciar el grupo `lacteo`. |
| 30 | MAJOR | Aceptado | Nuevo §3.0 (contrato de datos): `carbohidratos` es hidrato total con fibra incluida, `kcal` es la única fuente de verdad energética, y el cierre de §3.3 pasa a usar `Σ kcal · g/100` en vez de 4/4/9. Se documenta `hc_netos`. |
| 31 | MAJOR | Aceptado | `foods.json` incorpora `estado` en todas las entradas; §3.0 excluye del banco los cereales y pastas en crudo y §3.3 fija los límites de ración por (grupo, estado, rol). |
| 32 | MAJOR | Aceptado | Se elimina `APORTE_HC_VERDURA_FIJO`: verdura y fruta se colocan primero y se descuentan con sus macros reales de `foods.json`. |
| 33 | MAJOR | Aceptado | Se etiquetan alimentos `low_carb` reales del rol carbohidrato (arroz de coliflor, pan proteico), se define el banco LCB-* y se hace opcional el ancla de carbohidrato cuando `hc_pendiente < 20 g`. |
| 37 | MAJOR | Aceptado | El PDF recupera azúcares libres (§4.3), el bloque "Otras referencias" con CUN-BAE, Deurenberg, US Navy, MLG, FFMI y las fórmulas clásicas (§4.5) y la marca "Ajustado automáticamente" (§4.2). |
| 38 | MAJOR | Aceptado | El paso 12 se omite con `mantener` y `recomposicion` (se mantiene con `no_se`), igual que el paso 11. `INFO_OBJETIVO_IGNORADO` queda para la reconversión posterior al cuestionario. |
| 39 | MAJOR | Aceptado | El slider de días pasa a 0-7, coherente con `SPEC-calculo.md` §1 campo 8a y con la nota de validación que ya describía el caso 0. |
| 40 | MAJOR | Aceptado | La tabla §1.1 pasa a "solo mujeres, sin filtro de edad"; la regla normativa es la del cuerpo del paso 3. |
| 42 | MAJOR | Aceptado | `foods.json` incorpora `roles` independientes del grupo (las legumbres declaran proteína y carbohidrato); `FoodQuery` gana `rol`, `proteina_min`, `hc_max`, `grasa_min`, `grasa_max` y `estado_excluye`; la mantequilla pasa al grupo `lacteo` con rol `grasa` y tag `sin_lactosa` explícito. |
| 43 | MAJOR | Aceptado (lado UX) | §3.3 añade la comprobación de fibra del menú (rotación a alimentos de más fibra y nota si queda por debajo del 70 % del objetivo). El suelo de fibra en low-carb es del motor. |
| 44 | MAJOR | Aceptado parcial | §2.2 pasa a "en tus comidas principales… al menos 20 g" y §2.4 renderiza `WARN_PROTEINA_POR_TOMA` con el texto de la tabla §4 (sin "tantas comidas") más una caja para `WARN_PROTEINA_TOMA_ALTA`. La definición de ese aviso corresponde al motor. |
| 46 | MINOR | Aceptado | El sufijo de ritmo de la cabecera se condiciona: solo en `perder`/`ganar`, con `ritmo_ef`; "cambios lentos, es lo esperable" en recomposición; nada en mantener. |
| 47 | MINOR | Aceptado parcial | El total de la barra de progreso se calcula dinámicamente con las ramificaciones ya resueltas. No se renumera 5b: renumerar arrastraría todas las referencias cruzadas del documento sin resolver nada que el total dinámico no resuelva ya. |
| 48 | MINOR | Aceptado | La regla pasa a "los 3 marcados como siempre incluido + 0-2 condicionales, máximo 5", con orden de evaluación fijo para que el PDF reproduzca la pantalla. |
| 49 | MINOR | Aceptado | Se especifica el bloque "Equivalencias" (isoproteica, isoglucídica e isolipídica, generado desde `foods.json`) en §2.5 y en §4.4, en vez de retirar la promesa. |
| 50 | MINOR | Aceptado (opción b) | Se eliminan las unidades imperiales de la v1 (público objetivo España), con la conversión y su redondeo documentados por si se reintroducen. |
| 51 | MINOR | Aceptado | `foods.json` incorpora `unidad_g` y `unidad_nombre` en los alimentos contables; el nuevo §3.5 define cómo se escribe la medida casera (unidades enteras en contables, cuantificador por tramos en el resto) y el mínimo de ración baja a 1 unidad para huevo y clara. |

### Ronda 5 — revisión adversaria posterior a la reconciliación (2026-09-07)

Numeración compartida con el registro de `SPEC-calculo.md` §7. Aquí solo los hallazgos que tocan este documento.

| # | Sev. | Decisión | Resumen |
|---|---|---|---|
| R5-9 | CRITICAL | Aceptado (aplicado, en el motor) | La protección del cribado se anulaba a sí misma: §2.1 y §2.6 ocultaban %grasa, peso objetivo y cronograma, y §2.8/§4.6 obligaban a listar íntegros avisos que enuncian justo eso. Se resuelve **en el motor** (filtro del `[Paso 17]`, invariante S10c) en vez de con excepciones de maquetación: la regla "todos los avisos, texto íntegro, sin excepciones" queda intacta y comprobable. §2.8, §4.0 y §4.6 lo declaran y enumeran la lista cerrada. |
| R5-10 | MAJOR | Aceptado (aplicado) | §3.1: el generador recibe y respeta `resultado.preferencia_efectiva`, nunca `inputs.preferencia`. Con `diabetes` + `low_carb` el banco correcto es el omnívoro. Igual en `CONTRATO.md`. |
| R5-11 | MAJOR | Aceptado (aplicado en `CONTRATO.md`) | La tolerancia del contrato se alinea con §3.3 (±10 % kcal, 15 % terminal en proteína) y se elimina el ±15 % por macro que los vectores de §3.6 incumplen. |
| R5-12 | MAJOR | Aceptado (aplicado) | §2.5 y §4.4: guarda de ración en las tres tablas de equivalencias y tabla de grasa restringida a `grupo === 'grasa'` sin rol `proteina`. |
| R5-13 | MAJOR | Aceptado (aplicado) | §2.3 y §4.3: el agua se presenta como franja y el microcopy fijo es la "Nota agua" íntegra de la §4 del motor (agua de los alimentos y sodio/electrolitos incluidos). |
| R5-14 | MAJOR | Aceptado (aplicado) | §3.0: `roles` admite `'complemento'`, `tags` admite `con_lactosa`, `FoodQuery.rol` se amplía y la validación automática comprueba valores de enum y cobertura de `clampRacion`. `foods.json` no cambia. |
| R5-17 | MINOR | Aceptado (aplicado) | §2.2: el texto del cap de proteína usa el placeholder `{35/30}` en vez del 35 % literal, y se anota que con `renal` el aviso no se emite. |
| R5-19 | MINOR | Aceptado (aplicado) | Referencias cruzadas al Paso 6 corregidas (líneas del cribado, del ritmo, del peso objetivo y de las reconversiones). |
| R5-20 | MINOR | Aceptado (aplicado) | §1.0: el paso 12 también es condicional a `cribado_tca ∉ {positivo, evitado}`, con recalculo del total tras el paso 5b. |
| R5-21 | MINOR | Aceptado (aplicado) | §3.1 recibe `fibra_objetivo`; §3.3 gana filas de `clampRacion` para aceitunas y cremas de frutos secos. |

### Ronda 2 de verificación adversaria (`docs/ISSUES-ronda2.md`, 2026-09-07)

17 hallazgos (1 critical, 9 major, 7 minor). Aquí, los que tocan este documento o `foods.json`; los que
viven en `SPEC-calculo.md` o en `verify-vectors.mjs` se registran en el §7 de aquel documento.

| # | Sev. | Decisión | Resumen de lo aplicado |
|---|---|---|---|
| 1 | CRITICAL | **Aceptado (aplicado)** | La protección del cribado se anulaba por dos vías sin guarda. §2.9 gana la guarda explícita ("con `cribado_tca ∈ {positivo, evitado}` el bloque de referencias informativas no se muestra: ni CUN-BAE/Deurenberg/Navy, ni FFMI, ni las fórmulas clásicas; el acordeón conserva solo BMR y TDEE") y §4.2 la misma guarda para "%grasa (rango + método)" y "%grasa rango", con la frase que ya usaba §4.5. Se añade la obligación de un **test de presentación** (pantalla y PDF) que falle si algún número derivado del %grasa o del peso objetivo se renderiza con `'tca' ∈ condiciones`: el invariante S10c del motor no puede cubrirlo porque no son avisos, son campos de `Resultado`. Esto es lo que hace verdadera la justificación de la fila 2 del registro de `SPEC-calculo.md` §7 ("sin %grasa, sin peso objetivo, sin cronograma"). |
| 4 | MAJOR | **Aceptado (aplicado, variante b del issue)** | §1.2.5b consecuencia 5 dejaba de citar entre comillas el texto de `INFO_RITMO_SUAVE` —era la redacción anterior a R5-18, que hablaba de "ritmo" y es falsa en `mantener` y `recomposicion`— y remite a la tabla §4 de `SPEC-calculo.md`. No se sustituye por la cita vigente: dos copias del mismo string en dos documentos normativos es lo que produjo el defecto. |
| 5 | MAJOR | **Aceptado (aplicado)** | §3.2 escribe la regla real de elección de plantilla: dentro de un día, las comidas del mismo `rol_comida` consumen el banco **en orden y sin repetir** mientras queden plantillas válidas (rotación circular si se agotan), una plantilla se descarta cuando alguna `FoodQuery` obligatoria se queda vacía **o cuando el cierre de kcal de §3.3 no converge dentro del ±10 %**, y "Ver otro ejemplo" desplaza el índice de arranque en +1. Con la regla anterior las dos comidas principales del día recibían siempre la misma plantilla y los tres vectores de §3.6 no eran derivables de la spec (el salto de OMN-PRI-2 en el Ejemplo C queda explicado por el motivo de no convergencia). |
| 6 | MAJOR | **Aceptado (aplicado), con una fila extra** | La tabla de `clampRacion` pasa a llevar un **predicado formal** por fila en vez de nombres de producto, con las filas mutuamente excluyentes: `mantequilla` (`grupo: 'lacteo'`, `roles: ['grasa']`, 81 g de grasa) encajaba a la vez en "Lácteos" (mínimo 100 g = 717 kcal y 81 g de grasa) y en "Aceite y mantequilla" (5-25 g). Se añade además una fila propia para el **queso curado** (`grupo: 'lacteo'`, rol `proteina`, `grasa ≥ 20`), que tenía la misma ambigüedad y al que la fila genérica permitía 300 g. La validación de §3.0 se endurece a "exactamente una fila, ni cero ni dos". Comprobado sobre `foods.json`: los 101 alimentos encajan en una sola fila. **`foods.json` no cambia**: el defecto estaba en la tabla, no en el dato. |
| 7 | MAJOR | **Aceptado (aplicado)** | Se añade **LCB-DES-2** (lácteo proteico con tag `low_carb` + frutos secos + fresas; los tres existen ya en `foods.json` con ese tag), con lo que el banco `low_carb` cumple el mínimo de 2 plantillas por rol que fija el propio §3.2. Y se declara que el fallback al banco omnívoro para `low_carb` aplica también la regla del ancla de carbohidrato opcional (`hc_pendiente < 20 g` → sin ancla, verdura al doble), no solo el filtro por tags, que en esta preferencia no elimina nada. |
| 8 | MINOR | **Aceptado (aplicado)** | §1.2 paso 11: el forzado a ritmo suave con `'tca'` es **incondicional** (Paso 6.7), no solo con `perder` —en `ganar` cambia la fila de la tabla 3.8, del 10 % al 20 % de superávit—, y el microcopy visible pierde el condicional "si tu objetivo es perder grasa" para seguir sin distinguir a nadie y además ser cierto. Coincide ya con la consecuencia 1 de §1.2.5b. |
| 10 | MINOR | **Aceptado (aplicado)** | La condición de prioridad visual se escribe **una sola vez** en §2.8 y §4.2 la referencia: cualquier `WARN_*` de condición médica (DIABETES, RENAL, HEPATICA, CARDIACA, HIPERTENSION, TIROIDES, BARIATRICA_GLP1, CONDICION_OTRA), o `WARN_IMC_35`/`WARN_IMC_40`, o `edad ≥ 65`. Faltaba `WARN_BARIATRICA_GLP1` en las dos listas y `edad ≥ 65` en §2.8, de modo que pantalla y PDF no eran la misma instantánea. |
| 11 | MINOR | **Aceptado parcial (aplicado)** | Se corrige la justificación del Ejemplo C (18,875 g frente al umbral `0,70 · 27 = 18,90 g`, no "por debajo del objetivo") y §3.3 declara que la comparación se hace **sin redondear** ninguno de los dos lados, así que el test es determinista. **No se rota la verdura**: cambiar un alimento obliga a regenerar la tabla entera ejecutando el algoritmo (§3.6 prohíbe corregirla a mano) y el generador todavía no existe. Queda anotada en el propio §3.6 la fragilidad del margen de 0,025 g y la obligación de regenerar si cambia la fibra de alguno de esos once alimentos. **No se adopta** la alternativa de comparar sobre `Math.round(fibra_menu)`: 19 > 18,90 invertiría el resultado declarado del vector. |
| 12 | MINOR | **Aceptado (aplicado)** | §5 gana una fila diciendo que `condiciones` y `peso_kg` se leen de `InputCalculo`, no de `Resultado`, y §3.1 precisa que la lista de condiciones es la **cruda del usuario**, no la normalizada del Paso 0, para que `'tca'` no llegue nunca al módulo de menús. Mismo texto en `CONTRATO.md`. |
| 2, 3, 9, 13, 14, 15, 16, 17 | — | Fuera de alcance | Su ubicación principal es `SPEC-calculo.md` / `verify-vectors.mjs`: ver el registro de la ronda 2 en `SPEC-calculo.md` §7. |

