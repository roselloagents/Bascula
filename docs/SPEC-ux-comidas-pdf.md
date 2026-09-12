# Báscula (RS Agents) — Especificación de UX, comidas y PDF v1.3

Documento normativo complementario a `SPEC-calculo.md` y a `SPEC-dieta-propia.md` (v1.3: en lo que la persona nos cuenta de sus propias comidas manda aquella; el menú propuesto sigue siendo el de aquí). Cubre el cuestionario (wizard), la pantalla de resultados, el generador de ejemplos de comidas y la estructura del PDF exportable. Todo el copy está en español de España, tono cercano y honesto, sin paternalismo. Ningún mensaje afirma cosas que la ciencia no respalda (p. ej. nunca se dice que más comidas "aceleran el metabolismo", ni que el somatotipo determina tus macros).

Convención de referencias: `[Paso N]` remite al algoritmo de `SPEC-calculo.md`; `[Código]` remite a la tabla de mensajes de la sección 4 de ese documento.

---

## 1. Flujo del cuestionario (wizard)

### 1.0 Principios de diseño del wizard

- **Una pregunta (o grupo muy corto) por pantalla.** Nunca un formulario largo de una vez: reduce la carga cognitiva y permite validar y ramificar al momento.
- **Orden de fácil a difícil**, con las preguntas de corte de seguridad muy pronto (edad, embarazo/lactancia) para no hacer perder el tiempo a quien no puede usar la app.
- **Nunca bloquear en silencio.** Si una respuesta desvía el flujo (exclusión, aviso, valor por defecto), se explica en la misma pantalla, con un tono de acompañamiento, nunca de rechazo.
- **Todo paso es editable después** desde la pantalla de resultados ("Editar tus datos"), sin tener que repetir el wizard entero.
- **Barra de progreso con total dinámico.** El denominador NO es una constante: se calcula con las respuestas ya dadas (`total = pasos_obligatorios + pasos_condicionales_que_aplican`) y se recalcula en cuanto una respuesta cambia la ramificación. Pasos obligatorios: 1, 2, 4, 5, 6, 8, 9, 10, 13, 14 (**10** pantallas, v1.2: el paso 14 de alimentos se ve siempre aunque no se marque nada). Condicionales: 3 y 3b (solo `sexo = 'mujer'`), 7 (solo si el usuario no lo salta; cuenta como 1 aunque tenga 4 preguntas), 11 —peso objetivo— (`objetivo ∈ {perder, ganar, no_se}` **o** `objetivo === 'recomposicion'` con `recomposicion_prioridad !== 'ganar'`, v1.2) y 12 —ritmo— (solo si `objetivo ∈ {perder, ganar, no_se}`). El texto accesible es "Paso X de {total}" con el total ya resuelto; mientras el objetivo sea desconocido se asume que 11 y 12 aplican. **El selector de plazo no es un paso**: vive dentro del 12, igual que la subpregunta de recomposición vive dentro del 10 y la de síntomas dentro del 3b. **La subpregunta de recomposición no es un paso**: vive dentro del paso 10 y aparece en la misma pantalla al elegir esa tarjeta, así que no toca el denominador (v1.1). El antiguo paso 5b ya no existe (decisión A), y con él desaparece el único caso en que el denominador cambiaba a mitad del wizard.
- **Botón "Atrás" siempre visible** salvo en el paso 1. El botón "Siguiente" se deshabilita hasta que la pregunta tiene una respuesta válida (o hay un valor por defecto explícito y visible).
- **Un botón apagado siempre dice qué le falta.** En los pasos con varias subpreguntas en una sola pantalla —entrenamiento (cinco), constitución (cuatro), grasa conocida (dos)— el botón deshabilitado sin mensaje ni campo marcado deja al usuario mirando un botón muerto; en 375 px la subpregunta sin contestar suele estar fuera de la vista. Sobre la barra de navegación va una línea en `aria-live="polite"`: **"Para seguir, falta {qué}."**, con los elementos que faltan enumerados y separados por comas y una "y" final ("la intensidad y si prefieres entrenar en algún momento del día"). Solo aparece cuando no hay ningún error de rango: si lo hay, manda el mensaje del campo. Ojo con las subpreguntas que **se leen como opcionales y no lo son**: "¿Prefieres entrenar en algún momento del día en concreto?" tiene "No tengo preferencia" como respuesta de primera clase, y hasta que no se marca una, el paso está incompleto.
- **Al volver con un plan ya hecho.** Tras recargar la página, la app aterriza en la última pregunta del cuestionario (el plan no se persiste, solo el ajuste y los pesajes). Si la huella de las respuestas actuales coincide con la del último plan calculado (`bascula:sesion:v1`, campo `firmaPlan`), sobre el botón va la línea **"Tu plan sigue guardado en este móvil, con tu ajuste manual y tus pesajes."** y el botón se rotula **"Volver a mi plan"** en lugar de "Ver mi plan". Sin esa señal, la pantalla se lee como "he perdido mi plan". Si el usuario cambia cualquier respuesta, la huella deja de coincidir y no se promete nada.
- **Ayuda contextual** (icono "¿Por qué lo preguntamos?") en cada pantalla: un texto corto que explica para qué sirve el dato, sin tecnicismos. Nunca oculta información; es opcional de leer.

### 1.1 Mapa de pasos

| Paso | Pantalla | Campo(s) de `InputCalculo` | Corte de seguridad |
|---|---|---|---|
| 1 | Sexo | `sexo` | No |
| 2 | Edad | `edad` | Sí: <18 o >75 → `EXCL_EDAD` |
| 3 | Embarazo o lactancia (solo mujeres, sin filtro de edad) | `embarazo_lactancia` | Sí: true → `EXCL_EMBARAZO_LACTANCIA` |
| 3b | **Regla** (solo mujeres, justo después del paso 3) + subpregunta de síntomas | `menstruacion`, `sintomas_regla` | No (activa `INFO_CICLO` / `WARN_CICLO_AUSENTE`) |
| 4 | Altura y peso | `altura_cm`, `peso_kg` | No |
| 5 | Condiciones médicas | `condiciones` | No (activa avisos) |
| 6 | Porcentaje de grasa corporal | `grasa.*` | No |
| 7 | Somatotipo (opcional) | `somatotipo` | No |
| 8 | Actividad diaria | `actividad_diaria` | No |
| 9 | Entrenamiento | `entrenamiento.*` | No |
| 10 | Objetivo (+ subpregunta de prioridad si se elige recomposición) | `objetivo`, `recomposicion_prioridad` | No |
| 11 | **Peso objetivo** (si aplica) | `peso_objetivo` | No |
| 12 | **Ritmo** (si aplica) + selector de plazo si hay peso objetivo | `ritmo`, `plazo_semanas` | No |
| 13 | Preferencias alimentarias (base + restricciones + bajo en hidratos), nº de comidas, clima y comidas sencillas | `preferencia_base`, `restricciones`, `low_carb`, `preferencia`, `n_comidas`, `clima_caluroso`, `menu_sencillo` | No |
| 14 | **Alimentos**: "no me gusta" y favoritos | `alimentos_excluidos`, `alimentos_favoritos` | No |

**Condiciones de visibilidad exactas (v1.2):**

| Paso | Se muestra si |
|---|---|
| 3 y 3b | `sexo === 'mujer'` |
| 7 | siempre (el usuario puede saltarlo desde la propia pantalla) |
| 11 — peso objetivo | `objetivo ∈ {perder, ganar, no_se}` **o** (`objetivo === 'recomposicion'` y `recomposicion_prioridad !== 'ganar'`) |
| 12 — ritmo | `objetivo ∈ {perder, ganar, no_se}` |
| 12, opción "Tengo una fecha en mente" | además, `peso_objetivo !== null` |
| 14 — alimentos | siempre |

El **orden nuevo es objetivo → peso objetivo → ritmo → preferencias → alimentos**: el ritmo va después
del peso objetivo porque su cuarta opción (la fecha) no existe sin una meta, y los alimentos van al
final porque solo se pueden pintar cuando ya se conocen la base y las restricciones del paso 13. Los
números 11 y 12 se **intercambian** respecto a la v1.1; las entradas del registro de revisión anteriores
a esta versión usan la numeración vieja (11 = ritmo, 12 = peso objetivo).

Tras el paso 14: pantalla de "Calculando…" (proceso instantáneo, pero se muestra 600-900 ms de transición con un mensaje breve, p. ej. "Ajustando tus macros…") y salto directo a Resultados.

**Cambios de la v1.1 en el mapa (decisiones A, C, D y E):**

- **Fuera el paso 5b** ("Relación con la comida"). Bloqueaba a una persona real que marcó "sí" y no pudo llegar a su PDF. La conversión a `InputCalculo` escribe `cribado_tca: null` **siempre**, y con él desaparecen todas las ocultaciones que dependían de él: el %grasa, el peso objetivo, el cronograma y el bloque de referencias se muestran a todo el mundo. Lo único que queda es una línea fija en el disclaimer (§2.10). El motor conserva las reglas de `'tca'` como *reglas no expuestas* (`SPEC-calculo.md` §1.1), pero la UI ya no puede producir ese valor.
- **Nuevo paso 3b**, "¿Cómo es tu regla?", justo detrás del de embarazo/lactancia y solo para mujeres.
- **La subpregunta de recomposición vive dentro del paso 10**, no es una pantalla propia.
- **El paso 13 pasa de "una preferencia" a base + restricciones + interruptor.**

**Cambios de la v1.2 en el mapa (decisiones G, H y I):**

- **Los pasos 11 y 12 se intercambian** y el 11 (peso objetivo) se muestra también en recomposición
  salvo con prioridad `ganar`.
- **El paso 12 gana una cuarta opción**, "Tengo una fecha en mente", con su selector de plazo dentro de
  la misma pantalla. No es un paso y no toca el denominador.
- **Nuevo paso 14**, el último: alimentos que no gustan y favoritos.
- **El paso 3b gana una subpregunta** de síntomas, dentro de la misma pantalla y solo con `regular` o
  `irregular`. Tampoco es un paso.

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

### Paso 3b — Regla (condicional: solo si `sexo = 'mujer'`; v1.1, decisión D)

**Pregunta:** "¿Cómo es tu regla?"

**Opciones (tarjetas, ninguna preseleccionada):**

| Opción en pantalla | Valor en `menstruacion` |
|---|---|
| "Regular — me viene más o menos cada mes" | `regular` |
| "Irregular — se me adelanta, se me atrasa o se me salta" | `irregular` |
| "No la tengo — menopausia, anticonceptivo continuo u otra causa" | `ausente` |
| "Prefiero no decirlo" | `no_dice` |

**Se puede saltar.** El botón "Prefiero no decirlo" es una opción de primera clase, con el mismo estilo visual que las otras tres. Si el usuario pulsa "Atrás" o "Siguiente" sin elegir nada, se envía `null` y el efecto es idéntico al de `no_dice`.

**Intro de la pantalla:** "Puedes saltarte esta pregunta: no cambia tus calorías ni tus macros. Lo único que puede cambiar: si has elegido ritmo agresivo y tu regla es irregular o no la tienes, lo suavizamos a moderado por seguridad."

**Ayuda contextual ("¿Por qué lo preguntamos?"):** "No cambia tus macros: el gasto energético varía muy poco a lo largo del ciclo. Lo preguntamos por dos motivos. Uno, para explicarte por qué la báscula sube un par de kilos la semana antes de la regla sin que hayas hecho nada mal. Y dos, porque una regla irregular o ausente junto con un déficit puede ser una señal de que estás comiendo demasiado poco, y eso sí conviene mirarlo: en ese caso, si habías pedido ritmo agresivo, lo suavizamos a moderado (y con él cambian las calorías del plan)."

> **El copy no puede decir "no cambia ningún número".** El paso 6.7bis sí cambia uno —el ritmo—, y el ritmo se imprime en la cabecera del resultado ("Perder grasa · ritmo agresivo" pasa a "ritmo moderado") y, cuando el suelo de seguridad no recorta el déficit, mueve también las kcal. Prometer que no cambia nada y cambiarlo es exactamente el tipo de mentira pequeña que esta app no se puede permitir. La salvedad va **en los dos sitios**: intro y ayuda.

#### Subpregunta "¿Qué notas esos días?" (v1.2, decisión I)

Al marcar **"Regular"** o **"Irregular"** se despliega **en la misma pantalla**, justo debajo, un grupo de
casillas de selección múltiple. No es un paso y no toca la barra de progreso. Con "No la tengo" o
"Prefiero no decirlo" **no aparece**, y si estaba desplegada se cierra y su valor se descarta.

> **"¿Qué notas esos días?"** *(opcional, puedes marcar varias)*
>
> | Opción en pantalla | Valor en `sintomas_regla` |
> |---|---|
> | "Dolor fuerte" | `dolor` |
> | "Hinchazón y retención" | `hinchazon` |
> | "Más hambre o antojos" | `antojos` |
> | "Cansancio" | `cansancio` |
> | "Sangrado abundante" | `sangrado_abundante` |

**Nota fija bajo las casillas (copy literal):** "Esto no cambia tus calorías ni tus macros. Te damos
consejos de alimentos para esos días, que es donde sí se puede hacer algo."

**Ayuda contextual de la subpregunta:** "A los números no les afecta: lo que cambia en esos días son los
micronutrientes, sobre todo el hierro si sangras mucho. Con lo que marques te preparamos una tarjeta con
qué priorizar antes y durante la regla, y una sección opcional en la lista de la compra."

**Reglas:** no hay ninguna preseleccionada; se puede seguir sin marcar nada (se envía `null`); el orden
en que se marcan **no importa** (el motor las ordena, `SPEC-calculo.md` paso 19); y la pantalla **no
cambia de tono** según lo marcado —ni iconos de alarma, ni colores de alerta, ni preguntas de
seguimiento—, igual que el resto de este paso. El efecto es `Resultado.ciclo` y solo eso.

**Consecuencias (todas explicadas después, en resultados, nunca en esta pantalla):**

1. `regular` o `irregular` → tarjeta **"Tu ciclo y tu plan"** en resultados y en el PDF (`INFO_CICLO`, §2.2c).
2. `irregular` o `ausente` **y** (objetivo `perder`, o %grasa en banda baja, o ritmo `agresivo`) → aviso `WARN_CICLO_AUSENTE`. Si además el plan resta calorías (`perder` o `recomposicion`) y el ritmo elegido era `agresivo`, el motor lo suaviza a `moderado` (`[Paso 6.7bis]`). En `ganar` **no** se suaviza: el motivo de la regla es la baja disponibilidad energética, y recortar un superávit iría contra ese mismo motivo.
3. Los síntomas marcados producen los bloques de consejos de la tarjeta (`Resultado.ciclo`, §2.2c), los
   alimentos sugeridos del menú (§3.8) y, con `sangrado_abundante`, `cansancio` o `dolor`, la sección
   opcional de la lista de la compra (§3.8).
4. `ausente` y `no_dice` no producen la tarjeta informativa: hablar de "pesarse en la misma fase del ciclo" a quien está en menopausia o con anticonceptivo continuo no le sirve de nada.

**Nota de diseño:** ningún icono de alarma, ningún color de alerta, ninguna pregunta de seguimiento. La pantalla no cambia de tono según lo que se responda, y "No la tengo" incluye explícitamente la menopausia y el anticonceptivo continuo en el propio texto de la opción para que la respuesta más frecuente no se lea como un problema.

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

### Paso 5b — RETIRADO en la v1.1 (decisión A)

El cribado breve de "relación con la comida" **ya no existe**. Se retira entero, con todo lo que colgaba de él:

- La conversión a `InputCalculo` escribe **siempre** `cribado_tca: null`. Ningún camino de la interfaz puede producir `'positivo'` ni `'evitado'`, y por tanto tampoco `'tca'` en `condiciones`.
- **Desaparecen las ocultaciones.** El %grasa (§2.1), el peso objetivo y el cronograma (§2.6), el bloque de referencias de la metodología (§2.9) y sus equivalentes del PDF (§4.2 y §4.5) se muestran a **todo el mundo**, sin guardas ni excepciones. Los párrafos que describían esas guardas se han eliminado de este documento, no reescrito.
- **Vuelve el selector visual de siluetas** del paso 6.C para todos los usuarios.
- **El paso del peso objetivo deja de tener la condición del cribado**: se muestra siempre que el objetivo lo necesite (en la v1.2 pasa a ser el paso 11, ver §1.1).
- **Lo único que queda** es una línea fija en el disclaimer de la §2.10 y de la última página del PDF: *"Si la comida o el peso te generan ansiedad, puedes hablar gratis con ADANER (adaner.org) o con tu centro de salud."* No es condicional, no depende de ninguna respuesta y se muestra idéntica a todo el mundo.

**Por qué.** Una persona real marcó "sí" y se quedó sin poder llegar a su PDF: la protección, pensada para no hacer daño, acabó siendo el único muro de la aplicación. Báscula es una herramienta para el dueño y sus amigos, no un cribado clínico, y dos ítems no validados no dan para sostener una intervención que bloquea el producto entero.

**Lo que NO se toca.** `SPEC-calculo.md` conserva íntegras las reglas del motor asociadas a `'tca'` —`EXCL_TCA_RIESGO`, `INFO_RITMO_SUAVE`, el filtro de avisos del paso 17 y la no publicación de `proyeccion` y `limites_ajuste`— como *reglas no expuestas*: siguen siendo normativas, siguen teniendo vectores (caso 2 de la §5) y siguen siendo alcanzables construyendo el input a mano. Si alguna vez vuelve a haber un camino de interfaz que produzca `'tca'`, funcionan sin tocar nada.

---

### Paso 6 — Porcentaje de grasa corporal

**Pregunta:** "¿Sabes tu porcentaje de grasa corporal?"

**Opciones (tarjetas grandes, con icono):**
1. **"Sí, lo sé"** → `grasa.metodo = 'conocido'`
2. **"Puedo medirme con cinta métrica"** → `grasa.metodo = 'medidas'`
3. **"No lo sé, ayúdame a estimarlo"** → `grasa.metodo = 'visual'`
4. **"Prefiero que lo estiméis por mi altura y peso"** → `grasa.metodo = 'desconocido'`

**Ayuda contextual (siempre visible, no plegada):** "Ninguna fórmula sin aparato mide la grasa corporal con precisión absoluta: te daremos siempre un rango, no una cifra exacta. Cuanto mejor sea el dato de partida, más ajustado será tu plan."

**v1.1:** la condición que ocultaba la opción 3 ("No lo sé, ayúdame a estimarlo") y el bloque 6.C con `cribado_tca ∈ {positivo, evitado}` **queda retirada** con el paso 5b (decisión A). Las cuatro opciones se ofrecen siempre y a todo el mundo.

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

**Subpregunta de recomposición (v1.1, decisión C).** Al marcar la tarjeta de recomposición se despliega **en la misma pantalla**, justo debajo de ella, un segundo grupo de tres opciones. No es un paso nuevo y no cuenta en la barra de progreso.

> **"¿Qué te importa más ahora?"**
> - "Perder grasa" → `recomposicion_prioridad = 'perder'`
> - "Las dos por igual" → `recomposicion_prioridad = 'equilibrado'` *(preseleccionada)*
> - "Ganar músculo" → `recomposicion_prioridad = 'ganar'`

**Nudge bajo la subpregunta (v1.2, decisión H).** Cuando dentro de la subpregunta se marca **"Perder
grasa"**, aparece debajo, en tono de nota y sin ningún botón ni bloqueo:

> "Si lo que quieres sobre todo es que la báscula baje varios kilos, vuelve arriba y elige el objetivo
> «Perder grasa» en vez de Recomposición: tendrás ritmo, peso objetivo y fecha."

El texto nombra **el objetivo de arriba**, no la opción de la subpregunta (v1.2, revisión): las dos se
llaman "Perder grasa" y están en la misma pantalla, a dos centímetros una de otra, así que el nudge se
leía como "elige la opción que ya tienes elegida".

Solo se muestra con `recomposicion_prioridad === 'perder'`, y no cambia nada por sí mismo: es
información, no una corrección. Viene del feedback real —*"estoy en el rango normal hacia arriba, por lo
menos 5 kilos me los bajaría, y la progresión semana a semana es que voy a pesar lo mismo"*—: quien
quiere perder cinco kilos y elige recomposición está eligiendo el plan más lento sin saberlo. Desde la
v1.2 esa combinación ya no se queda sin peso objetivo ni sin proyección (`[Paso 13]` y `[Paso 14]` del
motor), pero sigue sin tener fecha, y eso conviene decirlo antes y no después.

**Ayuda contextual de la subpregunta:** "La recomposición es un equilibrio, y el equilibrio se puede inclinar. Si ahora te importa más perder grasa, bajamos algo más las calorías y te subimos la grasa a costa de los hidratos. Si te importa más ganar músculo, te dejamos comiendo en tu gasto, sin déficit. En los dos casos sigue siendo un proceso lento."

**Por qué existe:** mucha gente elige "recomposición" queriendo decir "perder sin decirlo", y otra tanta queriendo decir justo lo contrario. La subpregunta desambigua sin obligar a nadie a etiquetarse.

**Reglas:**
- Solo se muestra con `objetivo = 'recomposicion'`. Si el usuario cambia de tarjeta, el valor se descarta y se envía `null`.
- `'equilibrado'` viene preseleccionada porque es el comportamiento de la v1.0 y no cambia ningún número; a diferencia del ritmo (paso 12), aquí la opción por defecto es la conservadora y no elige el tamaño de ningún déficit por el usuario.
- Cuando el objetivo lo resuelve el motor (`objetivo = 'no_se'` → `recomposicion`, o una reconversión de los pasos 6.3/6.4), el usuario **no ha visto** la subpregunta: se envía `null`, que el motor trata como `'equilibrado'`.
- El efecto exacto (déficit y % de grasa) está en `SPEC-calculo.md` pasos 7 y 9, y se explica en resultados con `INFO_RECOMP_PRIORIDAD_PERDER` / `INFO_RECOMP_PRIORIDAD_GANAR`.

**Validación:** obligatorio, una opción (la subpregunta siempre tiene valor por defecto, así que no bloquea "Siguiente").

**Lógica condicional posterior (no visible en el wizard, ocurre en el motor, `[Paso 6]`):** el objetivo elegido puede reconvertirse automáticamente (p. ej. `perder` con IMC bajo → `mantener`; `perder` con grasa ya baja → `recomposicion`). Esto **no se pregunta de nuevo** en el wizard: se explica en resultados con el aviso correspondiente (`WARN_IMC_BAJO_NO_DEFICIT`, `WARN_YA_MAGRO`, etc.), nunca como un error del usuario.

---

### Paso 11 — Peso objetivo (condicional; **v1.2: se muestra también en recomposición**)

**Cuándo se muestra (condición exacta):**

```
objetivo ∈ {perder, ganar, no_se}
o (objetivo === 'recomposicion' y recomposicion_prioridad !== 'ganar')
```

Con `mantener` no se muestra: el motor descarta el peso objetivo (`[Paso 6.6]`) y pedir un dato para
después decir "no lo usamos" es pedirlo por nada. Con `objetivo = 'no_se'` **sí se pregunta**, porque el
objetivo efectivo todavía no está resuelto. **Con `recomposicion` se pregunta desde la v1.2**, salvo con
prioridad `ganar`: las otras dos prioridades producen un déficit real, y el `[Paso 13]` del motor propone
y valida la meta exactamente como en `perder` (mismos suelos, mismos avisos). Con prioridad `ganar` no
hay déficit, así que no hay meta que dar y la pantalla se salta.

`INFO_OBJETIVO_IGNORADO` queda reservado para el caso en que el objetivo se reconvierte después del
cuestionario (el usuario dio un peso objetivo con `perder` y el motor lo pasó a `mantener`). En
recomposición con meta el motor **retira** ese aviso (`SPEC-calculo.md` paso 17), porque ahí el peso
objetivo sí se usa.

**v1.1:** la segunda condición (`cribado_tca ∈ {positivo, evitado}`) quedó retirada con el paso 5b
(decisión A).

**Pregunta:** "¿Tienes un peso objetivo en mente?"

**Opciones:**
- "Sí, quiero llegar a…" → input numérico, kg (30-300) → `peso_objetivo = valor`
- "No lo sé, proponédmelo vosotros" → `peso_objetivo = null`

**Ayuda contextual:** "Si no lo tienes claro, no pasa nada: te proponemos un peso saludable según tu altura y tu situación actual, y podrás cambiarlo cuando quieras."

**Intro solo en recomposición (v1.2, copy literal):** "Aunque tu plan sea de recomposición, con este
déficit la báscula debería bajar algo. Dinos a dónde te gustaría llegar y te dibujamos por dónde debería
ir el peso. No te vamos a dar una fecha: en recomposición no se puede."

**Microcopy si elige dar un número:** debajo del input, en cuanto hay un valor, texto dinámico de previsualización simple (sin recalcular el motor completo, solo una estimación de IMC): "Eso supondría un IMC aproximado de {imc}." Si ese IMC cae por debajo de 18,5, se añade: "Es un IMC de bajo peso: en resultados te explicaremos por qué te proponemos ajustarlo." (sin bloquear el avance; el ajuste real ocurre en el motor, `[Paso 13]`, y se comunica como aviso en resultados).

**La nota es un aviso de seguridad y tiene que llegar a todo el mundo** (v1.2, revisión): lleva `id`,
`role="status"` y `aria-live="polite"`, y el campo numérico la referencia con `aria-describedby`, el
mismo patrón que la nota de "Para seguir, falta …" del cuestionario. Era la única nota del wizard que
no se anunciaba, y justamente la que el dueño pidió con todas las letras ("si digo 40 kilos, que
avise").

**Y avisa también en el sentido contrario** (v1.2, revisión): con `objetivo === 'perder'` y un peso
objetivo **por encima** del actual (o `ganar` con uno por debajo), a partir de 1 kg de diferencia, la
misma nota añade "Ese peso está por encima del que tienes ahora y tu objetivo es perder grasa: revisa
uno de los dos." No bloquea nada —la regla 6.2 del motor ya reconvierte el objetivo—, pero el paso
sabía detectar la incoherencia por abajo (IMC < 18,5) y callaba en la simétrica.

**Validación:** si se elige "Sí" pero se deja vacío → no se avanza. Fuera de 30-300 kg → `[ERR_INPUT_RANGO]`.

---

### Paso 12 — Ritmo (condicional: se muestra solo si `objetivo ∈ {perder, ganar, no_se}`)

Va **después** del peso objetivo desde la v1.2, y no por capricho: la cuarta opción de esta pantalla
—la fecha— solo tiene sentido si ya sabemos a dónde quiere llegar el usuario.

**Pregunta:** "¿A qué ritmo quieres avanzar?"

**Opciones:**
- "Suave — el cambio será más lento, pero más fácil de mantener" → `ritmo = 'suave'`
- "Moderado — un equilibrio entre velocidad y comodidad" → `ritmo = 'moderado'`
- "Agresivo — más rápido, pero exige más disciplina y hambre" → `ritmo = 'agresivo'`
- **"Tengo una fecha en mente" (v1.2, decisión H)** → despliega el selector de plazo de más abajo.
  **Solo aparece si `peso_objetivo` es un número**; con "no lo sé, proponédmelo vosotros" no se pinta,
  porque sin meta no hay nada que fechar.

**Ninguna opción viene marcada** y "Siguiente" está deshabilitado hasta que se elige una (QA §1). "Moderado" estuvo preseleccionado y no debía estarlo: a diferencia del número de comidas, del clima o de los deslizadores del entrenamiento —valores medios que no cambian el plan de forma sustantiva—, el ritmo elige el tamaño del déficit y con él el cronograma entero, así que dejarlo marcado permitía atravesar el paso sin responderlo y llevarse el plan de otra persona. `moderado` sigue siendo el valor que recibe el motor cuando el paso **no se muestra** (objetivos que no usan ritmo): eso lo resuelve la conversión a `InputCalculo`, no el estado del formulario.

**Ayuda contextual:** "El ritmo no es solo una preferencia: cuanta menos grasa tengas de partida, menos margen hay para ir rápido sin perder músculo. Ajustaremos el número final a un rango seguro para tu caso."

**Nota fija bajo las opciones (se muestra siempre, a todo el mundo):** "Ajustaremos el ritmo final a lo que sea seguro para tu caso; puede que apliquemos el más suave aunque elijas otro." El motor puede recortar el ritmo elegido por varias vías —los suelos de seguridad del `[Paso 7]`, la edad ≥ 65 (`[Paso 6.7]`), una regla irregular o ausente (`[Paso 6.7bis]`, v1.1) o la condición `'tca'`—, y en todas se explica después con su aviso en resultados. El texto es el mismo palabra por palabra para todos los usuarios, así que su presencia no distingue a nadie.

#### Selector de plazo (v1.2, dentro de la misma pantalla)

Al marcar "Tengo una fecha en mente" se despliega justo debajo, sin cambiar de pantalla y sin tocar la
barra de progreso (no es un paso):

- **Título:** "¿En cuánto tiempo?"
- **Chips de semanas:** `8` · `12` · `16` · `24` semanas, ninguno preseleccionado.
- **Enlace secundario:** "Prefiero poner una fecha" → abre un `<input type="date">` con `min` = hoy + 28
  días y `max` = hoy + 364 días. La fecha se convierte a semanas con
  `plazo_semanas = round((fecha − hoy) / 7)` y se **acota a [4, 52]**; el chip correspondiente queda
  marcado si coincide. En `InputCalculo` viaja siempre `plazo_semanas`, nunca una fecha.
  **Al abrir el campo se desmarca el chip elegido antes y `plazo_semanas` vuelve a `null`** (v1.2,
  revisión): con el campo vacío y el chip todavía marcado no se sabía cuál manda, la previsualización
  seguía enseñando el número viejo y, si el usuario no llegaba a escribir una fecha, el plan salía con
  el chip anterior sin decírselo. Mientras no haya fecha, la previsualización dice "Pon la fecha y te
  decimos cuántos gramos por semana serían.".
- **Previsualización honesta (obligatoria, `aria-live="polite"`).** En cuanto hay plazo, debajo del
  selector, con el signo correcto según la dirección:
  > "Son {|peso_objetivo − peso| con un decimal} kg en {plazo_semanas} semanas: unos
  > {round(|Δkg| / plazo · 1000)} g por semana."
  Se calcula **en la interfaz** con una resta, no con el motor: es aritmética de una línea, no un plan.
  Ejemplo del feedback: "Son 5 kg en 12 semanas: unos 400 g por semana."
- **Segunda línea fija, siempre:** "Elegiremos el ritmo más suave que llegue a esa fecha. Si no hay
  ninguno seguro que llegue, te lo diremos en el resultado y no te prometeremos la fecha."

**Qué hace el motor con esto (`[Paso 6.7ter]`).** El plazo **sustituye** al ritmo elegido: se calcula el
ritmo que exige la fecha y se toma el **más suave** de la tabla que llega a tiempo. Si ninguno llega, se
aplica el agresivo y se emite `WARN_PLAZO_IRREAL`; si sí llega, `INFO_RITMO_POR_PLAZO`. Los suavizados de
seguridad (edad ≥ 65, regla irregular o ausente, `'tca'`) se aplican **después** y mandan sobre el plazo.

**Por qué el plazo manda sobre el ritmo elegido, y por qué se dice.** Una fecha es una respuesta más
concreta que "moderado": quien la da ya ha decidido. Pero cambiar en silencio la respuesta anterior del
usuario es el tipo de cosa que rompe la confianza, así que se dice dos veces: aquí (segunda línea fija) y
en resultados, con el texto íntegro de `INFO_RITMO_POR_PLAZO`, que nombra el ritmo aplicado.

**Validación:** con "Tengo una fecha en mente" marcada, "Siguiente" está deshabilitado hasta que hay un
plazo válido; el mensaje de la barra de navegación es "Para seguir, falta el plazo." Si el usuario vuelve
a marcar uno de los tres ritmos, `plazo_semanas` se descarta y se envía `null`. Si edita el peso objetivo
en el paso 11 y lo deja vacío, esta opción desaparece y el plazo se descarta igual.

---

### Paso 13 — Preferencias alimentarias, número de comidas y clima

**Pregunta 1 (v1.1, decisión E — tres controles, no uno).** Hasta la v1.0 solo se podía elegir **una** opción, así que un vegano sin gluten tenía que renunciar a una de las dos. Ahora la pantalla tiene tres partes:

**1a. Base (tarjetas, una sola, obligatoria):** "¿Cómo comes?"
- "Como de todo" → `preferencia_base = 'omnivoro'` *(preseleccionada)*
- "Vegetariano" → `preferencia_base = 'vegetariano'`
- "Vegano" → `preferencia_base = 'vegano'`

**1b. Restricciones (casillas, varias a la vez, opcional):** "¿Evitas algo?"
- "Sin lactosa" → añade `'sin_lactosa'` a `restricciones`
- "Sin gluten" → añade `'sin_gluten'` a `restricciones`

**1c. Interruptor (opcional, desactivado por defecto):** título "Bajo en hidratos", descripción "Menos pan, arroz y pasta; más grasa. Cambia de verdad tus macros, no solo el menú." → `low_carb`

**Ayuda contextual (1a):** "La base cambia los alimentos de tus menús. En vegano y vegetariano además subimos un poco la proteína total, porque las fuentes vegetales se aprovechan algo peor."
**Ayuda contextual (1b):** "Puedes marcar las dos. Solo cambian los alimentos que te proponemos: tus calorías y tus macros son exactamente los mismos."
**Ayuda contextual (1c):** "Este sí cambia los números: te subimos la grasa al 45 % de las calorías y bajamos el mínimo de hidratos. Si tienes diabetes no lo aplicaremos y te lo explicaremos en el resultado."

**Compatibilidad (normativa).** La conversión a `InputCalculo` envía **los tres campos nuevos y también el antiguo** `preferencia`, con el valor de la regla inversa de `SPEC-calculo.md` §1.1 (`low_carb` → `'low_carb'`; si no, la base; si la base es omnívora y hay restricciones, la primera de ellas en el orden `sin_gluten`, `sin_lactosa`). El motor ignora `preferencia` en cuanto ve `preferencia_base`, así que el valor enviado solo importa para el código antiguo que todavía lo lea. Un borrador de `localStorage` guardado con la v1.0 —que solo tiene `preferencia`— sigue funcionando: al restaurarlo, el wizard aplica la **regla de traducción** de la §1.1 y rellena los tres controles.

**El borrador guardado no es de fiar (normativa).** Lo que hay en `bascula:inputs:v1` lo escribió otra versión de la app —el esquema del borrador acaba de cambiar en la v1.1: fuera `cribado`, `preferencia` → `preferencia_base`/`restricciones`/`low_carb`—, otra pestaña o la consola del navegador, y cada push despliega solo. Al restaurarlo se comprueban **campo a campo el tipo y el dominio**, y lo que no cuadra vuelve a su valor inicial: los campos numéricos del cuestionario viajan como **cadena** (`peso_kg: 95` en vez de `'95'` hacía saltar `texto.trim is not a function` en pleno render), los de opción tienen que pertenecer a su dominio, los arrays se filtran contra su lista de valores válidos y los objetos anidados (`grasa`, `entrenamiento`, `somatotipo`) se reconstruyen entrada por entrada en vez de copiarse con `...spread`. En la misma línea, `leerNumero` acepta `unknown` y devuelve `null` con cualquier cosa que no sea una cadena.

**Error boundary (normativa).** `<App/>` va envuelto en un límite de error que pinta **"Algo se ha roto"** con un botón **"Empezar de cero"** que borra todas las claves `bascula:*` y recarga. Sin él, un fallo durante el render dejaba `#root` vacío de forma **permanente**: cero botones, `body.innerText` vacío, y cada recarga repitiendo el mismo fallo porque el dato malo seguía en `localStorage`; la única salida era borrar los datos del sitio a mano. Las dos redes son independientes a propósito: la validación evita la causa conocida, el límite de error cubre la que no hemos previsto.

**Aviso de diabetes.** Si el usuario ha marcado `diabetes` en el paso 5 y activa el interruptor, **no se bloquea aquí**: se deja marcar y el motor lo anula en el `[Paso 6.8]` con `WARN_LOWCARB_DIABETES`, que se muestra en resultados con su texto íntegro. Bloquearlo en el wizard obligaría a explicar el motivo en una pantalla que no es el sitio.

**Pregunta 2:** "¿Cuántas comidas al día prefieres hacer?"

**Opciones:** 2 / 3 / 4 / 5 / 6 (selector tipo stepper o tarjetas numeradas, 3 preseleccionado).

**Ayuda contextual (siempre visible, no plegable — es un mensaje de rigor científico obligatorio):** "No hay evidencia de que comer más o menos veces al día cambie tu metabolismo. Elige el número de comidas que mejor se adapte a tu rutina: lo único que cambia es cómo repartimos las mismas calorías y macros."

**Pregunta 3:** "¿Vives en una zona de clima caluroso o estamos en época de mucho calor?" → Sí/No → `clima_caluroso`

**Ayuda contextual:** "Con calor se suda más y hace falta algo más de agua al día."

**Pregunta 4 (interruptor, no tarjetas):** título "¿Quieres comidas sencillas?", descripción "Menos alimentos distintos, comidas que se repiten y una compra fácil. Ideal si no quieres pensar." → `menu_sencillo` (por defecto **desactivado**). Copy literal y reglas completas en §3.7.

**Validación:** base y nº de comidas obligatorios; restricciones por defecto ninguna; bajo en hidratos por defecto `No`; clima por defecto `No`; comidas sencillas por defecto `No`.

Al pulsar "Siguiente" se pasa al paso 14 (alimentos), que es el último.

---

### Paso 14 — Alimentos: lo que no te gusta y lo que sí (v1.2, decisión G)

**Es el último paso del wizard**, después de las preferencias, y es **opcional de rellenar** (no de
mostrar: la pantalla se ve siempre, y cuenta en la barra de progreso). Sale del feedback literal de una
usuaria: *"lo primero que me ha puesto es el brócoli y a mí el brócoli no me gusta"*.

**Pregunta:** "¿Hay alimentos que no quieres ver en tu menú?"

**Intro (copy literal):** "Márcalos y no aparecerán ni en tus menús ni en tu lista de la compra. Y si
hay alguno que te encanta, márcalo como favorito y lo pondremos primero. Esto no cambia ni una caloría
de tu plan: solo cambia qué comes."

**Control segmentado, arriba y fijo al hacer scroll (dos opciones, `role="radiogroup"`).** Cumple el
patrón ARIA completo: **un solo botón en el orden de tabulación** (`tabIndex = 0` el seleccionado, `-1`
el otro) y las flechas izquierda/derecha y arriba/abajo mueven la selección y el foco. La barra fija
lleva además el **resumen vivo** repetido (abajo), porque la pantalla mide cuatro pantallas de móvil y
el recuento del final no se veía nunca.

| Segmento | Valor | Estado inicial |
|---|---|---|
| "✕ No me gusta" | modo `excluir` | **seleccionado** |
| "★ Favorito" | modo `favorito` | — |

**Qué alimentos se ven.** Solo los que pasan **la base dietética y las restricciones ya elegidas en el
paso 13** (`pasaBase && restricciones.every(pasaRestriccion)`, §3.2). Una vegana no ve pollo, y quien ha
marcado "sin gluten" no ve pan integral: enseñar un alimento que el generador nunca va a servir es
ruido, y marcar "no me gusta" sobre él, una decisión inútil. Los alimentos con estado `crudo` del grupo
`carbohidrato` (arroz y pasta crudos, §3.0) **tampoco se muestran**: no entran nunca en un menú. Los
alimentos con el tag `extra` (§3.0) **sí** se muestran: no salen en el menú, pero pueden salir en la
tarjeta del ciclo y en la sección opcional de la compra, así que tienen que poder rechazarse.

**Chips agrupados, en este orden exacto** (encabezado de grupo visible, chips en rejilla que envuelve):

| Grupo en pantalla | Regla de pertenencia (determinista, sobre `foods.json`) |
|---|---|
| Carne y pescado | `grupo === 'proteina'` y no cae en ninguna de las dos filas siguientes |
| Huevos, lácteos y bebidas vegetales | `grupo === 'lacteo'`, o `id ∈ {huevo_entero, clara_huevo}` |
| Legumbres y soja | `grupo === 'proteina'` y (`tags` incluye `vegano` o `roles` incluye `carbohidrato`) |
| Arroz, pasta, pan y patata | `grupo === 'carbohidrato'` |
| Frutas | `grupo === 'fruta'` |
| Verduras | `grupo === 'verdura'` |
| Grasas y frutos secos | `grupo === 'grasa'` |

Las tres filas de `grupo === 'proteina'` se evalúan **en el orden de la tabla**: primero huevos, después
legumbres y soja, y lo que queda es carne y pescado. Así `huevo_entero` (vegetariano pero no vegano) cae
en el grupo de los lácteos y `tofu` o `lentejas_cocidas`, en "Legumbres y soja". El rótulo de ese
grupo nombra las bebidas vegetales (v1.2, revisión): viven en `grupo === 'lacteo'` por su papel en el
menú, pero quien no toma lácteos las busca justo ahí y leía "Huevos y lácteos" como "aquí no hay nada
para mí". Un grupo sin ningún alimento
que pase el filtro **no se pinta** (una vegana no ve el encabezado "Carne y pescado" vacío). Dentro de
cada grupo, los chips van ordenados por `nombre_corto` con `localeCompare('es')`.

**El texto del chip es `nombre_corto`** (campo nuevo de `foods.json`, §3.0), no `nombre`: "Yogur griego
0%" y no "Yogur griego 0% (natural, sin azúcar)". El nombre largo se sigue usando en el menú, en las
equivalencias y en la lista de la compra.

**Interacción (normativa):**

1. Tocar un chip sin marcar le aplica el **modo activo** del control segmentado.
2. Tocar un chip que ya está marcado **en ese mismo modo** lo desmarca.
3. Tocar un chip marcado en el **otro** modo lo cambia de lista: **un alimento nunca está en las dos**.
4. Estado visual: excluido → chip tachado, con la ✕ delante y fondo apagado; favorito → chip con ★
   delante y el color de acento. `aria-pressed` en los dos casos, y el `aria-label` dice el estado
   completo ("Brócoli, no me gusta" / "Pollo, favorito").
5. Sin límite de marcados por arriba. La app **no** avisa de que "te quedan pocos alimentos": lo resuelve
   la regla de respaldo de §3.2b, que es donde se puede hacer bien.

**Buscador (v1.2.1).** En la barra fija, **debajo del control segmentado**: un `<input type="search">`
con etiqueta accesible (no visible: no cabe) y el placeholder literal **"Busca un alimento (p. ej.
brócoli)"**. **Sin `autofocus`**: al entrar en el paso el foco sigue en el contenedor, como en el resto
del cuestionario, y abrir el teclado del móvil nada más llegar taparía la pantalla entera. Con algo
escrito aparece a su derecha un botón **"Borrar"**, que vacía el campo y **le devuelve el foco**: se
desmonta al pulsarlo y sin eso el foco caía al `<body>` y quien va con teclado o con lector volvía a
empezar por la barra de progreso (v1.2.1, revisión).

**Intro en el buscador no envía el cuestionario** (v1.2.1, revisión). El campo vive dentro del
`<form onSubmit={avanzar}>` del wizard y es el único de texto del paso: por la submisión implícita de
HTML, un Intro —o la tecla "Buscar"/"Ir" que el teclado del móvil enseña justo por ser
`type="search"`— llamaba a `avanzar`, y como el paso 14 es el último y siempre está completo,
generaba el plan y sacaba al usuario de la pantalla con cero alimentos marcados. La tecla **filtra y
cierra el teclado** (`preventDefault` + `blur`, helper puro `teclaEnBuscador` con test), y el campo
declara `enterKeyHint="search"` para no prometer navegación.

La coincidencia es **por subcadena, sin distinguir mayúsculas ni acentos** —se normaliza con NFD y se
tiran los diacríticos, así que "brocoli" encuentra "Brócoli"— y se busca en **`nombre_corto` y en
`nombre`**: el chip pone "Semillas de lino" pero también "Pechuga de pollo", y quien escribe "sin piel"
espera encontrarla. Lo escrito se parte en palabras y **todas** tienen que aparecer, aunque sea sueltas:
así "yogur 0" encuentra "Yogur griego 0%". El helper vive en `src/components/utiles/alimentos.ts`
(`normalizarTexto`, `coincide`, `filtrarGrupos`) y es una función pura con test unitario.

Con texto en el buscador **solo se pintan los grupos que tienen alguna coincidencia, y todos abiertos**
(ahí no hay nada que plegar, así que la cabecera es un encabezado a secas y no un botón que no haría
nada visible; eso sí, enseña el mismo recuento y las mismas marcas que la cabecera-botón, porque
marcar chips buscando es un flujo previsto y esa es la única señal por grupo).

El recuento vive **dentro de la barra fija**, en la fila del resumen y en su sitio: mientras se busca
sustituye al resumen vivo (v1.2.1, revisión; debajo de la barra quedaba tapado por ella en cuanto se
bajaba un poco y el usuario no veía ningún recuento). Es una línea en `aria-live="polite"` que existe
**siempre en el DOM** —aunque vacía, recortada como `.etiqueta-oculta` y no con `display: none`, que
la sacaría del árbol de accesibilidad y no se anunciaría al aparecer— y que **cabe en una sola
línea**, porque la barra no puede crecer: **"{n} alimentos para «{lo escrito}»"** (en singular,
"1 alimento para «…»") o, sin ninguno, **"Ningún alimento para «{lo escrito}»"**. La frase larga que
dice qué hacer se pinta **donde estarían los grupos**: **"Ningún alimento se llama así. Prueba con
otro nombre o mira los grupos."** **Marcar un chip durante la búsqueda no la borra**: el texto, la
lista filtrada y el recuento siguen donde estaban.

**Grupos plegables (v1.2.1).** Cada grupo es un desplegable con **cabecera-botón** (`aria-expanded`,
`aria-controls`, 44 px de alto) que enseña el nombre del grupo, el número de alimentos y, si los hay,
las marcas en corto **"✕ 2 · ★ 1"** (en `aria-hidden`, con la versión hablada —"15 alimentos, 2 que no
te gustan"— en texto solo para lectores de pantalla). **Por defecto entran todos plegados salvo los que
ya tienen alguna marca**: quien vuelve desde el enlace "Cambiar" de resultados ve lo suyo abierto y el
resto recogido. Junto al buscador, un botón de texto **"Mostrar todos"** / **"Plegar todos"** según haya
o no algún grupo cerrado: comparte fila con el resumen vivo, justo debajo del campo, y **no se pinta
mientras hay algo escrito** (buscando salen todos los grupos abiertos y no hay nada que plegar). Mide
24 px de alto —el mínimo de WCAG 2.5.8— y guarda **8 px con el campo de búsqueda**, que está encima y
también se toca: con los 4 px de antes, un pulgar que apuntara al borde de abajo del buscador caía en
"Mostrar todos" y desplegaba los siete grupos de golpe (v1.2.1, revisión). El estado de plegado es
**estado local del componente y no se persiste**, y **la búsqueda no lo destruye**: al borrarla se
vuelve exactamente a lo que había.

**Presupuesto de la barra fija:** con el control segmentado, el buscador y la fila del resumen no puede
pasar de **130 px de alto en 375 px** (medida real: 126 px, y no cambia al escribir; los 8 px del
párrafo anterior salen del `padding-bottom` que tenía la barra, no del presupuesto). Sin scroll
horizontal. La transición de la flecha del desplegable usa el token `--dur`, que con
`prefers-reduced-motion: reduce` ya vale 1 ms. Plegada, la pantalla mide **1 331 px** en vez de los
3 553 px de la v1.2: poco más de una pantalla de móvil en vez de cuatro.

**Resumen vivo**, justo encima de la barra de navegación, en una región `aria-live="polite"`:
"{n} que no te gustan · {m} favoritos". Con cero de los dos no se pinta. El mismo texto se repite en la
barra pegada arriba, junto al control segmentado —salvo mientras se busca, que esa fila la ocupa el
recuento de resultados; el de abajo sigue ahí.

**Botón de salida (copy literal):** "Seguir sin marcar nada", como acción secundaria junto a "Ver mi
plan". Envía las dos listas vacías. **Solo se pinta mientras no hay nada marcado** (v1.2, revisión):
en cuanto el usuario marca un alimento, ese botón pasa a ser uno que borra sus dos listas sin
confirmación y con un rótulo que miente —y el momento en que más tiene que perder es justo cuando llega
desde el enlace "Cambiar" de resultados, con sus exclusiones ya guardadas—. Con algo marcado queda solo
"Ver mi plan". El botón primario **nunca** está deshabilitado en este paso.

**Campos:** `alimentos_excluidos: string[]` y `alimentos_favoritos: string[]` (ids de `foods.json`).
`alimentos_favoritos` viaja **en el orden en que el usuario los marcó** —ese orden es normativo (§3.2b)—;
`alimentos_excluidos`, en orden de `id` para que el borrador sea estable. Los dos se guardan en el
borrador (`bascula:inputs:v1`) como el resto de respuestas.

**Lo que estas dos listas NO tocan.** Ni una caloría: el motor las ignora igual que `menu_sencillo`
(`SPEC-calculo.md` §0.3). Y **`firmaDeInputs` tiene que ignorarlas** (`src/components/resultados/ajuste.ts`):
si entraran en la huella, marcar "no me gusta" en un alimento tiraría el ajuste manual guardado y el
"Volver a mi plan" del arranque.

**Al pulsar "Ver mi plan"** se ejecuta el motor y se navega a Resultados, igual que antes.

---


## 2. Pantalla de resultados

### 2.0 Estructura general (orden de arriba a abajo)

1. Cabecera con resumen (calorías + objetivo + ritmo)
2. Macros (proteína, grasa, carbohidratos, fibra)
2b. **"Ajusta tus macros"** (plegado por defecto, justo debajo de las tarjetas de macro) — v1.1
2c. **"Tu ciclo y tu plan"** (solo si `INFO_CICLO` está presente) — v1.1
3. Hidratación
4. Reparto por comidas (tabla)
5. Ejemplos de menú
6. Peso objetivo y cronograma
6b. **Proyección** (gráfica de peso semana a semana) — v1.1
6c. **"Tu seguimiento en este móvil"** (pesajes locales) — v1.1
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

**v1.1:** la regla que bajaba la fila a 2 datos y ocultaba el bloque §2.6 con `cribado_tca ∈ {positivo, evitado}` **queda retirada** (decisión A). La fila lleva siempre sus tres datos y el bloque §2.6 se muestra siempre.

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

Bajo las 4 tarjetas, línea de cierre técnico (texto pequeño, siempre visible): "Las calorías de tus macros pueden diferir hasta {10/25} kcal del objetivo por el redondeo a múltiplos de 5 gramos." —**25 con `resultado.ajuste` presente**, y sale de la misma función que usa el PDF (`notaCierreKcal(ajustado)`, §4.3)— y azúcares libres informativos: "Como referencia, limita los azúcares añadidos a menos de {azucares_libres_max_g} g/día."

### 2.2b "Ajusta tus macros" (v1.1, decisión B)

**Dónde va.** Bloque plegable (`<details>` o acordeón equivalente), **cerrado por defecto**, inmediatamente debajo de las cuatro tarjetas de macro y de su línea de cierre técnico. Encabezado: **"Ajusta tus macros"**, con el subtítulo *"¿Comes menos hidratos de los que te proponemos? Cámbialos aquí."*

**Qué resuelve.** Una usuaria en recomposición y acostumbrada a comer pocos hidratos seguía viendo en su plan más hidratos de los que come en su vida. El plan recomendado se quedaba en la pantalla como un número imposible en vez de convertirse en algo que se pueda seguir.

**Los dos controles.** Los dos leen sus límites de `resultado.limites_ajuste` (`[Paso 18]`); la pantalla **no calcula ningún límite por su cuenta**.

| Control | Tipo | Rango | Paso |
|---|---|---|---|
| **Hidratos** | deslizador (`<input type="range">`) con el número editable al lado | `[hc_min_ui_g, hc_max]`, donde `hc_max = roundDown5((kcal − 4·P − 9·suelo_grasa)/4)` recalculado con las kcal que haya en ese momento | 5 g |
| **Calorías** | dos botones "−50" y "+50" con el número en medio | `[kcal_min, kcal_max]` | `kcal_paso` = 50 kcal |

Bajo los controles, y actualizándose **en vivo** (llamando a `ajustarMacros` en cada cambio, que es puro y determinista), se muestran los tres macros resultantes con el mismo formato que las tarjetas de arriba: `{P} g de proteína · {G} g de grasa · {HC} g de hidratos` y `{kcal} kcal`.

**Copy exacto:**

- Encabezado: "Ajusta tus macros"
- Subtítulo: "¿Comes menos hidratos de los que te proponemos? Cámbialos aquí."
- Etiqueta del deslizador: "Hidratos al día"
- Etiqueta del control de calorías: "Calorías al día"
- **Nota fija sobre la proteína (siempre visible, no plegable):** "La proteína no se toca: es la que protege tu músculo cuando comes menos, y es lo último que un nutricionista recorta. Lo que cambia es la grasa, que absorbe lo que le quites o le des a los hidratos."
- Nota fija bajo los controles: "Al mover cualquiera de los dos recalculamos todo lo que depende de ellos: el reparto por comidas, el menú de ejemplo, la lista de la compra, el calendario y el PDF."
- Botón secundario, **siempre visible dentro del bloque**: **"Volver a lo recomendado"**. Deshabilitado mientras no haya ajuste.
- Cuando hay ajuste activo, distintivo permanente en la cabecera del bloque y junto a la cifra grande de calorías de §2.1: **"ajustado por ti"**.

**Comportamiento normativo:**

1. Mover solo las calorías **no cambia los hidratos** salvo que el nuevo `hc_max` los deje fuera de rango; en ese caso el deslizador se recorta solo hasta `hc_max` y la grasa absorbe el resto. Es la consecuencia de que la grasa sea "el resto" (`[Paso 18]`).
2. **Nada se bloquea.** Si los hidratos caen por debajo del mínimo del motor, aparece el aviso `WARN_HC_BAJO_MINIMO` con su texto íntegro dentro del propio bloque (además de en §2.8), pero el deslizador sigue funcionando.
3. Si el deslizador se queda **sin recorrido por abajo** (`hc_max ≤ 30 g`, o sea `hc_lo === hc_max` en `[Paso 18]`), es porque el **suelo de grasa** no da para más: se muestra la nota "Con estas calorías no puedes bajar más los hidratos sin quedarte por debajo de la grasa mínima. Baja también las calorías si quieres seguir bajándolos." (El extremo inferior nunca puede ser mayor que 30 g: `hc_lo = min(30, hc_max)`.)
4. El resumen de macros del propio bloque se rehace **en vivo** con `ajustarMacros` mientras se mueven los controles; el menú de ejemplo, la lista de la compra, el cronograma y la proyección se **regeneran al pulsar "Aplicar"** con el `Resultado` ajustado (`generarEjemplos(inputs, resultado_ajustado)`). Son funciones puras, así que no hay estado que sincronizar; el botón existe para no rehacer el menú entero —y hacer saltar la página— en cada píxel del deslizador.
5. El PDF descargado con un ajuste activo lleva la marca "ajustado por ti" (§4.3).

**Persistencia.** Se guarda en `localStorage`, junto al plan, **solo el ajuste**, nunca el `Resultado` ajustado: clave `bascula:ajuste:v1`, contenido `{ kcal?: number, hc_g?: number }`. Al cargar la pantalla se recalcula con `ajustarMacros(resultado, ajuste_guardado)`. Se puede hacer así porque `ajustarMacros` es idempotente respecto al origen (`[Paso 18]`), y evita guardar un objeto grande que quedaría desincronizado si el usuario edita sus datos. **Al pulsar "Volver a lo recomendado" se borra la clave** y se vuelve a pintar `resultado` tal cual. Si el usuario edita sus datos y recalcula, el ajuste guardado se **descarta**: los límites del plan nuevo pueden no tener nada que ver con los del anterior.

**Accesibilidad.** El deslizador lleva `aria-valuetext` con el texto completo ("140 gramos de hidratos al día"), los botones de calorías son botones reales con `aria-label` ("Bajar 50 calorías" / "Subir 50 calorías"), y el resumen de macros bajo los controles vive en una región `aria-live="polite"` para que un lector de pantalla anuncie el resultado del cambio.

### 2.2c Tarjeta "Tu ciclo y tu plan" (v1.1, decisión D)

**Cuándo se muestra:** exactamente cuando `INFO_CICLO` está en `resultado.avisos` (es decir, `sexo = 'mujer'` y `menstruacion ∈ {regular, irregular}`). Va justo debajo del bloque de ajuste, antes de la hidratación.

**Formato:** tarjeta informativa con estilo `INFO_*` (fondo neutro, sin color de alerta), encabezado **"Tu ciclo y tu plan"** y el texto **íntegro** de `INFO_CICLO` de la tabla §4 de `SPEC-calculo.md`. La pantalla no reescribe ese texto ni lo trocea.

**Bloques por síntoma (v1.2, decisión I).** Si `resultado.ciclo` existe, **debajo** del texto de
`INFO_CICLO` y dentro de la misma tarjeta se pintan los consejos, **uno por síntoma y en el orden en que
vienen en `resultado.ciclo.consejos`** (que ya es el canónico: dolor · hinchazón · antojos · cansancio ·
sangrado abundante). Cada bloque es:

- `titulo` como encabezado pequeño (`<h4>`), en negrita y sin icono.
- `texto` íntegro, tal cual. **La pantalla no lo reescribe ni lo trocea**, y los fragmentos condicionales
  ya vienen resueltos por el motor.
- `alimentos` como una línea de chips o de texto separado por "·", precedida de la etiqueta fija
  **"Prioriza:"**. Si `alimentos` viene vacío, la línea entera no se pinta.

Debajo del último bloque, **y solo si `ejemplos.alimentos_ciclo` tiene entradas**, una línea más:
"En tu lista de la compra te hemos dejado una sección opcional para esos días." (enlace ancla a §2.5b).

**Lo que la tarjeta NO hace:** no cambia ningún número, y el copy lo dice con todas las letras. No hay
"modo ciclo", ni calorías distintas por fase, ni ningún control asociado. Los consejos por síntoma
**tampoco** cambian nada: son qué priorizar dentro de los mismos macros.

Si además está `WARN_CICLO_AUSENTE`, ese aviso **no va aquí**: va en §2.8 con el resto de los `WARN_*`, con su estilo de atención y su texto íntegro. Las dos cosas pueden coexistir y dicen cosas distintas: una explica la báscula, la otra es una señal de seguridad.

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
- **Alternativas por comida** (`EjemploComida.alternativas`, 2-3 líneas del tipo "Cambia 120 g de pechuga de pavo por 130 g de pechuga de pollo"). La ración del sustituto se calcula sobre el macro que define el papel del alimento en esa toma y se pasa por `redondearGramos`, que la **recorta** a los límites de ración del alimento (§3.3). Ese recorte puede dejar la sustitución muy lejos del original, así que **es obligatoria la misma guarda de ración que la §2.5 exige en las tablas de equivalencias**: si la desviación real del macro supera el **±15 %**, el candidato se descarta y se prueba el siguiente; si ninguno cuadra, esa comida se queda sin esa alternativa. Sin la guarda se publicaban líneas como "Cambia 7 g de tortitas de arroz por 50 g de arroz blanco" (+147 % de hidratos, porque el mínimo de ración del arroz cocido son 50 g) o "Cambia 220 g de seitán por 300 g de lentejas" (−42 % de proteína, por el tope de 300 g), justo debajo de una nota que promete lo contrario.
- Si el generador no ha producido menú (ver §3.1, `condiciones` con `renal` o `hepatica`), este bloque se sustituye íntegro por el texto de §3.1 y el bloque de equivalencias tampoco se muestra.

**Acción "No me gusta" por alimento (v1.2, decisión G).** Cada línea de alimento del menú lleva a su
derecha una acción pequeña y secundaria —icono ✕ más el texto "No me gusta", `aria-label` "Quitar
{nombre} de mi menú"—, del tamaño de un botón de icono (mínimo 44 × 44 px de área táctil) y sin color de
alerta. Al pulsarla, **en este orden y sin salir de la pantalla**:

1. Se añade el `id` a `alimentos_excluidos` del borrador y se **guarda** (`bascula:inputs:v1`).
2. Se **regeneran** el menú, sus alternativas, las equivalencias, la lista de la compra y los datos del
   PDF llamando otra vez a `generarEjemplos(inputs, resultado, variante)` y a `generarListaCompra`.
   **No se vuelve a llamar al motor**: `calcular` ignora estas listas (`SPEC-calculo.md` §0.3), así que
   ni las calorías ni los macros ni la proyección pueden moverse. Tampoco cambia `firmaDeInputs`, así que
   el ajuste manual guardado y los pesajes siguen en pie.
3. Aparece un aviso efímero (`role="status"`) durante **6 segundos**, como **barra fija abajo** y con
   el foco puesto en su botón: **"Fuera {nombre}. Hemos rehecho el menú y la compra."** con un botón
   **"Deshacer"** que retira el id de la lista y vuelve a regenerar. Pasados los 6 s el aviso
   desaparece; el cambio, no. La barra fija y el foco son de la v1.2 (revisión): pintado al final del
   día, el aviso quedaba a tres pantallas por debajo del alimento que se acababa de quitar —2 725 px
   en un móvil de 375 × 812 al quitar algo del desayuno—, desaparecía a los ocho segundos sin que
   nadie lo viera y la acción era, de hecho, irreversible desde resultados. Con el foco en "Deshacer"
   es además alcanzable con teclado y con lector de pantalla.
4. Si al regenerar el generador ha tenido que usar igualmente el alimento en algún rol obligatorio
   (regla de respaldo de §3.2b), su aviso —"No hemos podido evitar {alimento} en {comida}"— se pinta
   donde el resto de notas del menú, con el texto que trae `ejemplos.avisos_menu`.

**Resumen bajo el menú (v1.2).** Si hay alguna de las dos listas, una línea en letra pequeña justo debajo
del menú y encima de las equivalencias:

> "Sin: brócoli, coliflor · Favoritos: pollo, arroz  ·  [Cambiar]"

Los nombres son `nombre_corto` (§3.0), separados por ", " y **ordenados alfabéticamente en español**
(`localeCompare('es')`): el orden interno de los excluidos es por `id`, que es estable para el borrador
pero se lee como una lista desordenada ("Brócoli, Lomo de cerdo, Coliflor, Judía verde"). Cada mitad se
**corta en seis nombres** y sigue con "y N más" —con 54 exclusiones el bloque medía 421 px de alto y
748 caracteres—, y de los favoritos se nombran los de `ejemplos.favoritos_aplicados` (§3.2b), no los del
cuestionario. Si algún favorito marcado no ha entrado, una línea pequeña lo dice ("2 favoritos más no
han entrado en el menú de esta semana"). Cada mitad se omite si su lista está vacía. **"Cambiar"** es un enlace que lleva al
**paso 14** del wizard con el borrador cargado; al volver a "Ver mi plan" desde ahí, la huella del plan
no ha cambiado, así que se recupera el ajuste manual tal cual.

**Bloque "Equivalencias" (plegable, justo debajo de los menús).** Existe porque §2.5 lo prometía sin definirlo. Se genera a partir de `foods.json`, sin datos del usuario:
- Una tabla por rol (`proteina`, `carbohidrato`, `grasa`), con los alimentos de ese rol que superen el filtro de `preferencia` del usuario.
- Para el rol `proteina`, la columna de equivalencia es **isoproteica**: gramos que aportan 20 g de proteína, `round5(2000 / alimento.proteina)`, omitiendo el alimento si el resultado supera su máximo de ración (§3.3).
- Para `carbohidrato`, equivalencia **isoglucídica**: gramos que aportan 30 g de hidratos, `round5(3000 / alimento.carbohidratos)`.
- Para `grasa`, equivalencia **isolipídica**: gramos que aportan 10 g de grasa, `round5(1000 / alimento.grasa)`. La tabla de grasa se restringe a alimentos cuyo **`grupo` sea `grasa`**, y se excluyen los que además tengan rol `proteina`: filtrando solo por `roles.includes('grasa')` entraban 75 g de salmón (15 g de proteína), 235 g de salmón ahumado (42 g de proteína y varios gramos de sal) o 125 g de jamón serrano presentados como intercambiables con 10 g de AOVE.
- **Guarda de ración, obligatoria en las tres tablas** (no solo en la isoproteica): se omite el alimento si la ración equivalente **supera el máximo o queda por debajo del mínimo** de su fila de `clampRacion` (§3.3). Sin ella, la tabla de carbohidrato ofrecía `round5(3000/3,1)` = **970 g de arroz de coliflor**, más del triple del máximo de 300 g que la propia §3.3 fija para un carbohidrato cocido. Un test de la base debe fallar si alguna equivalencia cae fuera de esos límites.
- Verdura y fruta no llevan tabla: nota fija "Las verduras y las frutas son intercambiables entre sí sin recalcular nada."
- Cabecera del bloque: "Cambiar un alimento por otro de la misma tabla te deja los macros casi iguales; no hace falta que recalcules nada." La promesa solo es cierta con las dos guardas anteriores aplicadas; si se relajan, hay que relajar también la cabecera.

Este mismo bloque aparece en el PDF (§4.4).

**v1.3 — "Cuéntanos cómo comes".** Encima de este bloque va la tarjeta "¿Ya tienes tus comidas o tus
costumbres?", y **mientras hay una composición activa este bloque entero lo sustituye** "Tu menú, con lo
tuyo dentro": las comidas dictadas se conservan con los gramos ajustados a tu plan y los huecos los monta
este mismo generador con el resto. Todo eso —cuándo se ofrece, el copy literal, las etiquetas "tuya" y
"propuesta", los avisos y cómo se corrige cada alimento— está en
[`docs/SPEC-dieta-propia.md`](SPEC-dieta-propia.md) §5; el algoritmo que compone el día, en su §4. El
menú propuesto que describe esta sección **no desaparece**: se vuelve a él con "Ver el menú propuesto", y
es lo único que existe para quien no cuenta nada.

### 2.5b Lista de la compra semanal

Va **justo debajo del bloque de ejemplos de menú y de sus equivalencias**, plegada por defecto en móvil con el encabezado "Tu lista de la compra de la semana". Se muestra **siempre que haya menú** (con `menu_sencillo` activo o no); si el generador no ha producido menú (§3.1, `renal` o `hepatica`), este bloque tampoco aparece. Las reglas de cálculo, las fórmulas y los textos fijos están en §3.7; la pantalla no recalcula nada: pinta `ejemplos.compra` tal cual.

- **Subtítulo:** "Para 7 días, con el formato en el que se vende cada cosa en Mercadona. Sin precios: cambian de una tienda a otra y de una semana a otra."
- Si `ejemplos.modo_sencillo` es `true`, distintivo encima de la lista: "Modo sencillo: {alimentos_distintos} alimentos para toda la semana."
- **Una tabla por sección** (`SeccionSuper`, en el orden de §3.7), con el nombre visible de la sección como encabezado y cuatro columnas: **Producto** (`producto`, con el alimento del menú en línea secundaria), **Cantidad** ("{gramos_semana} g en la semana", y debajo "{gramos_dia} g al día"), **Comprar** ("{envases} × {envase_descripcion}") y **Dura** ("{dura_dias} días").
- El `consejo` de cada línea, si existe, va en letra pequeña bajo el producto; los `fresco` que no llegan a la semana lo llevan siempre (§3.7).
- **Sección opcional "Para los días de regla" (v1.2, decisión I).** Si `ejemplos.compra.opcional_ciclo`
  existe, va **al final**, después de la última sección del supermercado y **antes** de las notas fijas,
  con su `titulo` como encabezado y su `nota` justo debajo, en letra pequeña. Sus 1-3 líneas usan
  exactamente las mismas cuatro columnas que el resto. Va visualmente separada (un filete o un fondo
  distinto) y **no** entra en el recuento de "{alimentos_distintos} alimentos": son compras pequeñas y
  opcionales que no forman parte del plan, y el copy de la nota lo dice.
- Al pie, las tres notas fijas de `compra.notas`, en el orden en que vienen.
- Botón secundario "Ver otro ejemplo" (§2.5): al cambiar el menú cambia también la lista, porque se recalcula desde el mismo `Ejemplos`.

**v1.3 — "Cuéntanos cómo comes".** Con una composición activa, la lista que se pinta aquí (y en el PDF)
es la del día compuesto, agrupada como dice [`docs/SPEC-dieta-propia.md`](SPEC-dieta-propia.md) §6.1: las
mismas cuatro columnas y las mismas notas, más una nota propia, y **"—" en "Comprar" y en "Dura"** para
los alimentos dictados que no están en nuestra base (llegan con `envases: 0` y `dura_dias: 0`, que no es
"cero envases" sino "no lo sabemos"). El resto de esta sección no cambia.

### 2.6 Peso objetivo y cronograma

**Qué número se enseña (regla normativa, v1.2 revisión).** El motor devuelve `mostrar_central: boolean`, `false` cuando la fiabilidad del %grasa es `baja` (el caso por defecto) o cuando el peso objetivo se corrigió por `WARN_OBJETIVO_GRASA_MUY_BAJA`. La franja como titular se reserva ahora para **quien no ha dado ninguna meta**: si el usuario ha escrito un peso objetivo, su cifra manda siempre. Titular una franja propuesta —que además dejaba su número fuera: "Entre 53 y 62 kg" para quien había pedido 63— mientras la gráfica, la tabla de la proyección y los avisos del plazo sí hablaban de sus 63 kg era romper la promesa de la decisión H en la única tarjeta donde se responde. Esta regla vale igual en pantalla y en el PDF (§4.5).

- Si `peso_objetivo.efectivo !== null` **y** (`mostrar_central === true` **o** `inputs.peso_objetivo !== null`): número grande "{peso_objetivo.efectivo} kg". La etiqueta es "tu objetivo" si el número lo dio el usuario y "el peso que te proponemos" si lo propuso el motor, y en ese segundo caso va con la nota: "Te proponemos este peso según tu altura y tu %grasa actual; puedes cambiarlo cuando quieras."
- Si además `mostrar_central === false` (grasa estimada), debajo del número van dos notas: "Por tu masa magra estimada te propondríamos entre {rango[0]} y {rango[1]} kg, pero el número que manda es el tuyo" y la nota fija de peso objetivo. La franja no desaparece: baja a nota.
- Si `peso_objetivo.efectivo !== null`, `mostrar_central === false` **y** el usuario no dio meta: franja "entre {rango[0]} y {rango[1]} kg" como titular, con el mismo tamaño de tipografía que el resto de cifras secundarias y el copy "tu masa magra es una estimación con varios kilos de margen, así que te damos una franja y no un número".
- Si hay `hito_intermedio`: tarjeta secundaria "Primer hito: {hito_intermedio} kg" con copy: "Cuando el camino es largo, ir por etapas ayuda a no perder la motivación."
- Si `cronograma !== null`: línea de tiempo simple con:
  - "Entre {semanas[0]} y {semanas[1]} semanas". El formato de las fechas lo manda `cronograma.precision_fecha`: con `'dia'` se imprime la fecha completa ("de {fecha_min} a {fecha_max}"); con `'mes'` **solo mes y año** ("hacia junio de 2027"), porque un calendario exacto a 40 semanas es el mecanismo clásico de abandono cuando no se cumple.
  - Si `cronograma.tramo_12sem !== null` (siempre que `precision_fecha === 'mes'`), el bloque principal muestra **el primer tramo, no el horizonte completo**: "en las próximas 12 semanas, entre {tramo_12sem[0]} y {tramo_12sem[1]} kg", más el hito intermedio. El horizonte total queda como línea secundaria.
  - "Eso es un ritmo de unos {ritmo_kg_sem} kg ({ritmo_pct_sem}%) por semana"
  - Si `diet_breaks > 0`: "Hemos incluido {diet_breaks} semana(s) a mantenimiento dentro del cálculo, para que el cuerpo descanse del déficit."
  - Nota fija `INFO_ADAPTACION`, con su texto íntegro de la tabla §4 del motor.
- Si `cronograma === null` **por corte** (`INFO_SIN_CRONOGRAMA_SIN_MARGEN`, `INFO_CRONOGRAMA_NO_ESTIMABLE` o `INFO_CRONOGRAMA_FUERA_DE_HORIZONTE`): se muestra el texto íntegro de ese aviso en lugar de la línea de tiempo, y **no** se muestra `INFO_ADAPTACION` (el motor ya lo suprime).
- Si `cronograma === null` (mantener/recomposición): "Con este objetivo no hay un peso al que llegar en una fecha. Reevalúa medidas, fotos y rendimiento cada 8-12 semanas." `[INFO_SIN_CRONOGRAMA]`

### 2.6b Proyección (v1.1, decisión F)

Va inmediatamente debajo del bloque de peso objetivo y cronograma, con el encabezado **"Cómo debería ir la cosa"** y el subtítulo *"Semana a semana, con el margen que toca."* Se pinta desde `resultado.proyeccion` (`[Paso 14b]`) y **no se calcula nada aquí**.

**La gráfica (SVG propio, sin librerías).**

- **Ejes.** Horizontal: semanas, de 0 al último punto del array, con marcas cada 4 semanas y etiqueta "semana {n}". Vertical: kilos, con el rango `[min(peso_min) − 1, max(peso_max) + 1]` redondeado al kilo y 4-5 marcas; la etiqueta del eje es "kg" una sola vez, arriba.
- **Banda.** Un `<path>` relleno con el color de acento al 15-20 % de opacidad, que va por `peso_max` de izquierda a derecha y vuelve por `peso_min`. Es la banda de "entre lo optimista y lo pesimista".
- **Curva central.** `peso_esp`, línea de 2 px del color de acento, sin puntos salvo en los hitos.
- **Hitos.** Círculos rellenos en las semanas **4, 8 y 12** (las que existan en el array), cada uno con su etiqueta `{peso_esp} kg` encima. Son literalmente las entradas con `semana ∈ {4, 8, 12}`: no hay ningún cálculo extra.
- **Línea del objetivo.** Si `peso_objetivo.efectivo !== null`, una línea horizontal discontinua a esa altura con la etiqueta "objetivo {x} kg".
- **Móvil primero.** `viewBox` fijo con `preserveAspectRatio="xMidYMid meet"` y `width: 100%`, altura entre 180 y 220 px. Nada de scroll horizontal: si no caben las etiquetas del eje X, se pintan una de cada dos.
- **Temas.** Todos los colores salen de variables CSS; la gráfica se ve igual en claro y en oscuro.

**Accesibilidad (obligatoria).** El `<svg>` lleva `role="img"` y un `aria-label` con el resumen ("Proyección de peso: de 78,0 kg en la semana 0 a entre 71,0 y 74,0 kg en la semana 22"). **Cuando los dos extremos de la banda final redondean al mismo número, la frase dice "a 63 kg en la semana 18"** y no "entre 63 y 63 kg" (v1.2, revisión): quien no ve la gráfica recibía una frase rota justo en el caso más frecuente, el de la banda cerrada sobre la meta. Además, **debajo de la gráfica y siempre presente en el DOM**, un `<details>` con el rótulo "Ver los números" que contiene la **tabla equivalente** con una fila por semana y las columnas *Semana · Mínimo · Esperado · Máximo*. La tabla no es un extra: es la versión accesible de la gráfica y tiene que llevar exactamente los mismos números.

**Copy fijo bajo la gráfica** (la "Nota proyección" de `SPEC-calculo.md` §4, íntegra): "Esta curva es una estimación, no una promesa: sale de tu déficit actual y de un factor de adaptación que crece con el tiempo. Tu peso real va a oscilar por agua, sal e intestino; lo que importa es la tendencia de varias semanas, no el dato de un día."

**Sin cronograma** (`INFO_PROYECCION_PLANA` presente): la gráfica se pinta igual, con la banda plana de ±1 kg, y el copy fijo se sustituye por el texto íntegro de `INFO_PROYECCION_PLANA`. No se oculta el bloque: una línea plana con banda es exactamente la información correcta.

Si `resultado.proyeccion` es `undefined`, el bloque **no se pinta** (y tampoco §2.6c).

### 2.6c "Tu seguimiento en este móvil" (v1.1, decisión F)

Debajo de la proyección, plegado por defecto. Encabezado **"Tu seguimiento en este móvil"**, con un distintivo permanente y bien visible: **"Solo en este dispositivo"**.

**Copy fijo del encabezado:** "Apunta tu peso cuando te peses y lo dibujamos sobre la curva. Se guarda solo en este navegador: no hay cuenta, no hay nube y nadie más lo ve. Si borras los datos del navegador o cambias de móvil, se pierde."

**Formulario.** Dos campos en una fila y un botón:
- "Fecha" → `<input type="date">`, por defecto hoy, no admite fechas anteriores a `fecha_inicio` ni posteriores a hoy.
- "Peso (kg)" → `<input type="number" step="0.1" min="30" max="300">`.
- Botón primario "Añadir pesaje". Deshabilitado hasta que los dos campos son válidos.
- **Mensaje de fecha no válida (v1.2, decisión J — obligatorio).** Hasta ahora una fecha fuera de rango
  se rechazaba **en silencio**: el botón se quedaba apagado y no había ni mensaje ni campo marcado, que
  es exactamente el defecto que la §1.0 prohíbe en el wizard. Bajo el campo de fecha, en cuanto hay un
  valor fuera de rango, va el texto correspondiente en un `<p>` con `role="alert"` y el `<input>` con
  `aria-invalid="true"`:
  - anterior a `fecha_inicio` → **"Esa fecha es anterior al día en que empezaste el plan ({fecha}).
    Elige una entre ese día y hoy."**
  - posterior a hoy → **"Todavía no puedes apuntar un peso de una fecha futura."**
  - vacía o no interpretable → **"Pon la fecha del día en que te pesaste."**
  - **el primer día del plan** (`fecha_inicio === hoy`, y por tanto el rango válido es un único día),
    los dos primeros mensajes se sustituyen por uno solo: **"Hoy es el primer día de tu plan: de
    momento solo puedes apuntar el pesaje del {hoy}."** Con los mensajes generales, quien ponía una
    fecha anterior leía "elige una posterior", ponía una posterior y leía "no puedes apuntar una fecha
    futura", y se quedaba dando vueltas entre los dos (v1.2, revisión).
  El mensaje del peso sigue las mismas reglas: fuera de 30-300 kg → **"Pon un peso entre 30 y 300 kg."**
- Si ya existe un pesaje en esa fecha, se **sustituye** (no se duplica) y se avisa con un texto breve: "Ya tenías un pesaje ese día; lo hemos actualizado."

**Lista.** Los pesajes ordenados **del más reciente al más antiguo**, una fila por pesaje: `{fecha en formato d/m/aaaa} · {kg} kg` y un botón de borrar por fila (icono con `aria-label` "Borrar el pesaje del {fecha}"). Debajo, un botón secundario "Borrar todo el seguimiento" con confirmación.

**Pintado sobre la proyección.** Los pesajes se dibujan como puntos sobre la misma gráfica de §2.6b, unidos por una línea fina de un color distinto al de la curva. La semana de cada pesaje es `s = floor((fecha_pesaje − fecha_inicio) / 7 días)`, acotada a `[0, última semana de proyeccion]`. La leyenda dice "tu peso real".

**Frase de balance (normativa).** Se calcula **solo con el pesaje más reciente**, contra el punto `p = proyeccion[s]` de su semana:

| Objetivo | Condición | Estado |
|---|---|---|
| `perder` | `peso < p.peso_min` | **por delante** |
| `perder` | `p.peso_min ≤ peso ≤ p.peso_max` | **en la banda** |
| `perder` | `peso > p.peso_max` | **por detrás** |
| `ganar` | `peso > p.peso_max` | **por delante** |
| `ganar` | `p.peso_min ≤ peso ≤ p.peso_max` | **en la banda** |
| `ganar` | `peso < p.peso_min` | **por detrás** |
| proyección plana | `p.peso_min ≤ peso ≤ p.peso_max` | **en la banda** |
| proyección plana | fuera de esa franja | **fuera de la banda** |

**Textos exactos (uno solo, el que corresponda):**

- **por delante:** "Vas por delante de la previsión: {x} kg por debajo de lo que esperábamos para la semana {n}." (en `ganar`: "por encima"). Y a continuación, siempre: "Ojo con acelerar: ir más rápido de lo previsto suele costar músculo. Si el ritmo se mantiene así, recalcula."
- **en la banda:** "Vas dentro de lo previsto para la semana {n}. No hay nada que cambiar."
- **por detrás:** "Vas por detrás de la previsión: {x} kg por encima de lo que esperábamos para la semana {n}." (en `ganar`: "por debajo"). Y después: "Una semana no dice nada: el peso oscila por agua, sal e intestino. Si en tres o cuatro semanas seguidas sigue así, es que el gasto estimado no era el tuyo."
- **fuera de la banda** (proyección plana): "Tu peso se ha movido más de un kilo respecto al de partida. En un plan de mantenimiento o de recomposición eso suele ser agua; si se mantiene tres o cuatro semanas, recalcula con tu peso real."
- **Cierre fijo, siempre, debajo de cualquiera de las anteriores:** "Recalcula tu plan cada 4-6 semanas, o antes si has cambiado 5 kg."

**Reglas de honestidad:** ninguna frase promete un resultado, ninguna felicita ni regaña, ninguna usa emojis ni signos de exclamación, y **con menos de dos pesajes no se muestra ninguna frase de balance**, solo la lista (un punto suelto no es una tendencia).

**Estado vacío (obligatorio).** Con 0 o 1 pesajes, donde iría la frase de balance va una línea explicando por qué no la hay: **"Con dos pesajes en semanas distintas te decimos si vas por delante o por detrás de la previsión."** El día que se crea el plan el campo de fecha solo admite un valor (`min` y `max` son la misma fecha), así que quien estrena el plan añade su peso y **no pasa nada visible**: sin esta línea, el silencio se lee como un fallo.

**Almacenamiento.** Clave `bascula:pesajes:v1`, contenido `Pesaje[]` = `{ fecha: string; kg: number }[]`, ordenado por fecha ascendente al guardar. Es el mismo array que viaja en `DatosPdf.pesajes`. Nunca sale del dispositivo.

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

La regla "todos, con su texto completo" es literal y **no admite excepciones de maquetación**: la lista que llega en `resultado.avisos` se pinta entera.

**v1.1 — el filtro del `[Paso 17]` sigue en el motor, pero la UI ya no puede activarlo.** Retirado el paso 5b, ningún camino de la interfaz produce `'tca' ∈ condiciones`, así que en la práctica la lista de avisos que llega aquí es siempre la completa. El filtro del motor se mantiene como *regla no expuesta* (`SPEC-calculo.md` §1.1) y esta pantalla no tiene que saber nada de él: pinta `resultado.avisos` entera, sea cual sea. Sigue valiendo la regla de serialización: `'tca'` no se muestra en ninguna lista de condiciones ni en pantalla ni en el PDF.

**Condición de prioridad visual (normativa, escrita una sola vez y referenciada desde §4.2).** Este bloque se muestra **antes** que los ejemplos de menú (no al final) cuando hay:

> cualquier `WARN_*` de condición médica —`WARN_DIABETES`, `WARN_RENAL`, `WARN_HEPATICA`, `WARN_CARDIACA`, `WARN_HIPERTENSION`, `WARN_TIROIDES`, `WARN_BARIATRICA_GLP1`, `WARN_CONDICION_OTRA`—, **o** `WARN_IMC_35` / `WARN_IMC_40`, **o** `edad ≥ 65`.

La lista es la de la tabla §4 de `SPEC-calculo.md` completa, no un subconjunto: al ampliar `Condicion` (issue 22) quedaron fuera `WARN_HIPERTENSION`, `WARN_TIROIDES`, `WARN_CONDICION_OTRA` y sobre todo `WARN_BARIATRICA_GLP1`, que es la condición con más riesgo de pérdida rápida y déficit proteico y la que motivó el suelo de 1,5 g/kg. `edad ≥ 65` estaba en §4.2 y no aquí, de modo que pantalla y PDF no eran la misma instantánea. `'tca'` **no** entra en esa condición.

### 2.9 Metodología (transparencia)

Bloque plegable (acordeón, cerrado por defecto) "¿Cómo hemos calculado esto?" con:
- Fórmula de metabolismo basal usada: "Mifflin-St Jeor" o "Katch-McArdle (porque nos diste un %grasa de una prueba fiable)", con el valor de BMR.
- "Tu gasto total estimado (TDEE) es de {tdee_bruto} kcal, al que restamos un 5% de margen de seguridad: {tdee} kcal."
- Si se usó somatotipo: "El somatotipo es una forma antigua de describir la silueta corporal, pero la ciencia actual no ha demostrado que sirva para calcular calorías o macros de forma precisa. Lo hemos usado solo como un ajuste ligero entre carbohidratos y grasa (nunca en tus calorías ni tu proteína)." `[INFO_SOMATOTIPO]`
- Referencias informativas (visibles aquí salvo por la guarda de abajo, nunca como número principal): CUN-BAE, Deurenberg, US Navy (si aplica), FFMI y categoría, fórmulas de peso ideal clásicas (Devine/Robinson/Miller/Hamwi) etiquetadas explícitamente como "otras referencias, no un objetivo".

**v1.1:** la guarda del cribado que ocultaba este bloque de referencias **queda retirada** (decisión A). El acordeón se muestra completo a todo el mundo, y con él el test de presentación que la acompañaba.

### 2.10 Disclaimer y ayuda

Texto fijo, siempre visible (no oculto en acordeón), en la parte inferior:

> "Báscula te ofrece una orientación nutricional general basada en evidencia científica, no un consejo médico ni un plan personalizado por un profesional sanitario. Los resultados son estimaciones: tu cuerpo puede responder de forma distinta. Si tienes una condición médica, tomas medicación, estás embarazada o en periodo de lactancia, o tienes antecedentes de trastornos de conducta alimentaria, consulta con un/a médico o dietista-nutricionista colegiado/a antes de seguir estas recomendaciones."

**Línea de ayuda (v1.1, normativa y literal).** Retirado el cribado del paso 5b, esta línea es **todo lo que queda** de aquella funcionalidad, y por eso su texto es fijo y no se reescribe. Va como última línea del disclaimer, en el mismo tamaño que el resto (discreta, no destacada), con `adaner.org` como enlace:

> "Si la comida o el peso te generan ansiedad, puedes hablar gratis con ADANER (adaner.org) o con tu centro de salud."

Se muestra **siempre**, a todo el mundo, sin depender de ninguna respuesta, y aparece exactamente igual en la última página del PDF (§4.6).

---

## 3. Generador de ejemplos de comidas

### 3.0 Contrato de datos de `foods.json` (normativo)

`foods.json` es la única fuente de alimentos del generador. Son **107 alimentos** (101 del plan + 6 extra):
los 101 que entran en los menús más los 6 con tag `extra`, que nunca entran en ninguna `FoodQuery` —los 4
de la tarjeta del ciclo (v1.2) y los 2 de la v1.3 (proteína de suero en polvo y kéfir), que existen para
emparejar lo que la persona dicta (`SPEC-dieta-propia.md` §3.6)—. Cada entrada tiene este esquema y estas
garantías; cualquier alimento nuevo debe cumplirlas antes de entrar en la base:

| Campo | Tipo | Significado |
|---|---|---|
| `id` | string | Identificador único (validado: no hay duplicados) |
| `nombre` | string | Nombre en español de España, con el estado entre paréntesis cuando importa ("Arroz blanco (cocido)") |
| `nombre_corto` | string | **v1.2.** Nombre corto para los chips del paso 14 del wizard, para el resumen de §2.5 y para las notas del generador: **máximo 24 caracteres** (18 hasta la revisión de la v1.2: abreviar "Prot. de guisante" o "Queso batido s/lac" hacía el chip más corto y la pantalla peor, y en 375 px un chip largo simplemente ocupa su fila entera), en español, sin el estado entre paréntesis y sin la marca ("Pollo", "Brócoli", "Yogur griego 0%"). Obligatorio en todos los alimentos y **único**: dos alimentos que el usuario no pueda distinguir en un chip son un error de datos ("Soja seca" / "Soja hidratada", no "Soja text. seca" / "Soja texturizada"). El nombre largo se sigue usando en el menú, en las equivalencias, en la compra y en `Ejemplos.alimentos_ciclo` |
| `grupo` | `'proteina' \| 'lacteo' \| 'carbohidrato' \| 'grasa' \| 'verdura' \| 'fruta'` | Familia alimentaria (se usa para las equivalencias y para el filtro `sin_lactosa`) |
| `roles` | `('proteina' \| 'carbohidrato' \| 'grasa' \| 'verdura' \| 'fruta' \| 'complemento')[]` | **Rol funcional en el menú, independiente del grupo.** Las legumbres declaran `['proteina','carbohidrato']`; el yogur griego 0 %, `['proteina']`; el salmón, `['proteina','grasa']`. `'complemento'` es el rol de las bebidas de baja densidad que acompañan a un ancla sin ser ellas mismas el ancla (leches, kéfir, bebidas vegetales: 9 alimentos de la base). `FoodQuery` filtra por `roles`, no por `grupo` |
| `estado` | `'crudo' \| 'cocido' \| 'seco' \| 'listo'` | Estado en que están medidos los macros. Determina los límites de ración (§3.3) |
| `kcal` | number | **Energía por 100 g y única fuente de verdad energética.** Es el valor de tabla (BEDCA/USDA), no el resultado de 4/4/9 |
| `proteina`, `grasa`, `carbohidratos`, `fibra` | number | g por 100 g. **`carbohidratos` es hidrato TOTAL, con la fibra incluida** (convención BEDCA/USDA) |
| `hc_netos` | number | `carbohidratos − fibra`, precalculado. Lo usa solo la presentación de perfiles low-carb; el generador escala siempre con `carbohidratos` |
| `racionTipica_g` | number | Ración habitual, base de la medida casera |
| `medidaCasera` | string | Texto de la medida casera correspondiente a `racionTipica_g` |
| `unidad_g`, `unidad_nombre` | number, string (opcionales) | Solo en alimentos contables (huevo, clara, lata, rebanada, tortita, tarrina, pieza de fruta): peso y nombre de UNA unidad |
| `tags` | string[] | Enum cerrado: `vegetariano`, `vegano`, `sin_lactosa`, `con_lactosa`, `sin_gluten`, `low_carb`, `extra`. `con_lactosa` marca los 9 lácteos que el filtro `sin_lactosa` debe excluir. **`extra` (v1.2)** marca los alimentos que existen para la tarjeta del ciclo (§3.8) y **no pueden entrar en ninguna `FoodQuery` del menú**: ni en la rotación, ni en la reserva, ni en las alternativas, ni en las tablas de equivalencias. Sirve para añadir alimentos a la base sin cambiar ni un menú existente |
| `fuente` | string | Referencia (BEDCA/USDA) |

**Consecuencias normativas de este contrato:**

1. **Las kcal de una comida se calculan siempre como `Σ (alimento.kcal · gramos / 100)`**, nunca como `4·P + 4·HC + 9·G`. La diferencia entre ambos métodos llega a 47 kcal por 100 g en alimentos ricos en fibra o en grasa (nueces 654 vs 701; almendras 579 vs 622; avena 389 vs 357), suficiente para hacer fallar por sí sola la validación del ±10 % de §3.3.
2. Como `carbohidratos` incluye la fibra, el objetivo de HC del motor (que también es hidrato total) y el del menú son directamente comparables. `hc_netos` no entra en ningún cálculo del generador.
3. `estado` es obligatorio y limita qué alimentos pueden entrar en una plantilla: **los cereales, pastas y arroces con `estado = 'crudo'` están excluidos del banco de plantillas** (solo aparecen en la tabla de equivalencias, etiquetados "en crudo"), porque las reglas de ración de §3.3 están escritas para el alimento tal y como se come.
4. La validación de la base (test automático) comprueba: ids únicos; presencia de todos los campos obligatorios (incluido `nombre_corto`, no vacío, **único** y de **24 caracteres o menos**); `|kcal − (4P + 4HC + 9G)| / kcal ≤ 0,15`; `fibra ≤ carbohidratos`; `hc_netos = carbohidratos − fibra`; que todo alimento con `unidad_g` tenga también `unidad_nombre`; **que `grupo`, `estado`, `roles` y `tags` solo contengan valores del enum declarado en la tabla de arriba**; y **que todo alimento encaje en exactamente una fila de la tabla de `clampRacion` (§3.3): ni cero, ni dos o más**. Las dos últimas comprobaciones son nuevas: sin ellas, nueve alimentos con `roles: ['complemento']` —un valor que no existía en el enum— pasaban la validación entera siendo inalcanzables por rol para el generador, y una plantilla del banco vegano (VGN-DES-2) dependía de uno de ellos (`bebida_soja`). La cota **por arriba** (una sola fila aplicable) es igual de necesaria que la cota por abajo: con la tabla anterior la mantequilla encajaba en dos filas con mínimos de 5 g y de 100 g, y la validación no lo detectaba porque solo exigía "al menos una".

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

**Filtro de alimentos (v1.1, normativo — se aplica a TODAS las `FoodQuery` antes que ningún otro criterio).** Desde la decisión E el filtro es una **conjunción** de la base y de *todas* las restricciones, no un `switch` sobre un único valor:

```
pasaFiltro(alimento) = pasaBase(alimento, resultado.preferencia_base)
                    && restricciones.every(r => pasaRestriccion(alimento, r))

pasaBase(a, 'omnivoro')    = true
pasaBase(a, 'vegetariano') = a.tags incluye 'vegetariano'
pasaBase(a, 'vegano')      = a.tags incluye 'vegano'

pasaRestriccion(a, 'sin_lactosa') = a.grupo !== 'lacteo' || a.tags incluye 'sin_lactosa'
pasaRestriccion(a, 'sin_gluten')  = a.tags incluye 'sin_gluten'
```

La base de alimentos incluye las variantes españolas sin lactosa (leche, yogur griego 0 %, queso fresco batido 0 %, kéfir) y los quesos curados, naturalmente por debajo de 0,1 g de lactosa, todos con el tag `sin_lactosa`, de modo que la restricción no vacía el grupo entero.

**De dónde salen los tres valores.** De `Resultado`, nunca de `Inputs`: `resultado.preferencia_base`, `resultado.restricciones` y `resultado.low_carb`, que el motor publica ya normalizados (`SPEC-calculo.md` §1.1 y Paso 6.8, donde `diabetes` anula el low-carb). Si un `Resultado` antiguo no los trae, se deducen de `resultado.preferencia_efectiva` con la regla de traducción de la §1.1 aplicada a ese valor.

**El banco de plantillas** lo sigue eligiendo `resultado.preferencia_efectiva` (la "regla inversa" de `SPEC-calculo.md` §1.1), que es exactamente uno de los seis de la tabla de abajo. La diferencia con la v1.0 es que **el banco ya no es lo único que filtra**: un usuario vegano + sin gluten usa el banco `vegano` y, encima, el filtro de `sin_gluten`; uno omnívoro + sin lactosa + sin gluten usa el banco `sin_gluten` (la regla inversa lo prefiere porque cambia la estructura de las plantillas) y, encima, el filtro de `sin_lactosa`.

- `low_carb` (el interruptor, no un banco excluyente) → además de elegir el banco LCB-*, activa la regla propia del ancla de carbohidrato opcional descrita más abajo.
- **Variantes `*_sl`:** cuando `'sin_lactosa' ∈ restricciones`, si una `FoodQuery` resuelve a un lácteo cuya variante `_sl` existe en `foods.json`, **se usa la variante**. Fuera de esa restricción los ids `*_sl` siguen siendo reserva y no entran en la rotación (regla de la v1.0, ahora expresada sobre `restricciones` en vez de sobre la preferencia única).

**Regla de fallback con restricciones combinadas (normativa).** Si una `FoodQuery` obligatoria se queda **sin ningún alimento válido** tras la conjunción, se degrada en este orden exacto y se anota el fallback en el log:

1. Se prueba la **siguiente plantilla** del mismo `rol_comida` (es el motivo (a) de la regla de elección de más abajo).
2. Agotado el rol, se prueban las plantillas del **rol contrario** (regla 3bis).
3. Agotado el banco, se cae al banco **`omnivoro`** con el **mismo filtro completo** (base + todas las restricciones): el fallback nunca relaja una restricción del usuario.
4. Si ni así hay candidatos —situación que la validación de `foods.json` debe hacer imposible—, se omite esa `FoodQuery` (nunca una comida vacía) y se anota. **Bajo ninguna circunstancia se sirve un alimento que incumpla la base o una restricción**: antes se entrega una comida con un ancla menos.

**Los seis bancos (normativo).** Cada preferencia tiene su banco, con 2 plantillas por rol de comida como mínimo. Los identificadores son estables porque el PDF debe reproducir el menú de la pantalla.

| Preferencia | Desayuno | Principal (Comida/Cena) | Ligera (Media mañana/Merienda/Recena) |
|---|---|---|---|
| `omnivoro` | **OMN-DES-1** lácteo proteico + huevo + pan/avena + fruta · **OMN-DES-2** huevo + fiambre magro + pan + verdura | **OMN-PRI-1** carne magra + cereal cocido + AOVE + verdura · **OMN-PRI-2** pescado blanco (+ huevo si falta P) + patata/boniato + AOVE + verdura · **OMN-PRI-3** pescado azul + tubérculo + verdura (sin ancla de grasa) | **OMN-LIG-1** requesón/queso batido + tortitas de arroz + fruta · **OMN-LIG-2** atún al natural + pan + fruta |
| `vegetariano` | **VEG-DES-1** yogur griego + avena + fruta · **VEG-DES-2** queso batido + pan + fruta + frutos secos | **VEG-PRI-1** queso batido/huevo + arroz + verdura · **VEG-PRI-2** legumbre + huevo + pan + verdura | **VEG-LIG-1** yogur griego + fruta + frutos secos · **VEG-LIG-2** queso fresco + tortitas de arroz + fruta |
| `vegano` | **VGN-DES-1** yogur de soja proteico + avena + fruta + semillas · **VGN-DES-2** bebida de soja + proteína vegetal en polvo + avena + fruta | **VGN-PRI-1** tofu firme/tiras de soja + cereal cocido + AOVE + verdura · **VGN-PRI-2** legumbre + soja texturizada hidratada + AOVE + verdura · **VGN-PRI-3** tempeh + boniato + verdura (sin ancla de grasa) | **VGN-LIG-1** yogur de soja proteico + fruta + frutos secos · **VGN-LIG-2** altramuces/edamame + fruta |
| `sin_lactosa` | **SLA-DES-1** = OMN-DES-1 con lácteos sin lactosa · **SLA-DES-2** = OMN-DES-2 | = banco `omnivoro` (ninguna plantilla principal depende de lácteos) | **SLA-LIG-1** = OMN-LIG-1 con queso batido sin lactosa · **SLA-LIG-2** = OMN-LIG-2 |
| `sin_gluten` | **SGL-DES-1** lácteo proteico + huevo + fruta (sin cereal) · **SGL-DES-2** huevo + patata + verdura | **SGL-PRI-1** = OMN-PRI-1 con arroz/quinoa · **SGL-PRI-2** = OMN-PRI-2 (patata/boniato) | **SGL-LIG-1** = OMN-LIG-1 (tortitas de arroz llevan tag `sin_gluten`) · **SGL-LIG-2** atún + fruta |
| `low_carb` | **LCB-DES-1** huevo + fiambre magro + verdura + aguacate · **LCB-DES-2** lácteo proteico con tag `low_carb` (yogur griego, queso batido 0 %) + frutos secos + fruta roja (fresas) | **LCB-PRI-1** carne/pescado + verdura + AOVE (**sin ancla de carbohidrato**) · **LCB-PRI-2** carne/pescado + arroz de coliflor o pan proteico + verdura + AOVE | **LCB-LIG-1** queso batido + frutos secos · **LCB-LIG-2** huevo cocido + aceitunas |

**Variantes «sin lactosa».** Los ids `*_sl` de `foods.json` existen para que el filtro de lactosa no vacíe el grupo de lácteos: **solo entran en la rotación cuando `'sin_lactosa' ∈ resultado.restricciones`**; en el resto de casos quedan como reserva. Sin esta regla la rotación por `n_comidas + edad` servía a usuarios omnívoros un producto más caro sin ningún motivo en su perfil. (v1.1: la condición era `preferencia_efectiva === 'sin_lactosa'`, que dejaba fuera al vegetariano sin lactosa, cuyo banco es el `vegetariano`.)

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

### 3.2b Alimentos excluidos y favoritos (v1.2, decisión G, normativo)

El paso 14 del wizard entrega dos listas de ids de `foods.json`, que el motor **ignora** y este módulo
**no**: `alimentos_excluidos` (lo que el usuario no quiere ver) y `alimentos_favoritos` (lo que quiere
ver primero, **en su orden**). Entran en `PerfilDietetico` (`src/meals/filtros.ts`), que gana dos campos:

```ts
export interface PerfilDietetico {
  banco: Preferencia
  base: PreferenciaBase
  restricciones: readonly Restriccion[]
  low_carb: boolean
  excluidos: ReadonlySet<string>       // v1.2, ids; se construye una vez por generación
  favoritos: readonly string[]         // v1.2, ids EN EL ORDEN DEL USUARIO
}
```

**Normalización (una sola vez, al construir el perfil).** Se descartan los ids que no existen en
`foods.json`; se deduplica; y **un id que esté en las dos listas cuenta solo como excluido** (se retira
de favoritos). Las dos listas salen de `InputCalculo`, no de `Resultado`: el motor no las publica porque
no las lee.

#### Orden exacto dentro de `candidatos()`

La función `candidatos(q, perfil, permitidos)` de `src/meals/index.ts` pasa a filtrar y ordenar así, y
el orden de los pasos es normativo:

```
1. base + restricciones (§3.2)          ← lo que ya hacía; NUNCA se relaja
2. filtros de la FoodQuery (rol, grupo, estado, macros, tags)
3. tag `extra` (§3.0): fuera de toda FoodQuery del menú
4. EXCLUIDOS: se retira todo id de perfil.excluidos          ← v1.2, ANTES de cualquier otro criterio
5. variantes `_sl` (§3.2) y lista blanca `permitidos` (§3.7.2)
6. partición en `preferidos` y `reserva`, con este orden dentro de `preferidos`:
      a) los FAVORITOS que han sobrevivido a 1-5 **y que pueden adelantar en esta toma**
         (regla de abajo), en el orden del usuario
      b) el resto de `ids_preferidos` de la plantilla, en el orden de la plantilla
      c) (si la consulta no trae `ids_preferidos`) los favoritos primero y el resto por `id`
   `reserva` = lo que queda, ordenado por `id` como hasta ahora
```

**Dónde adelanta un favorito (v1.2, revisión):** en las tomas **principales** —las que
`rolComidaDe` clasifica como `principal`, es decir, Comida y Cena— manda el gusto y el favorito va
delante de todo lo que comparta su rol. En el desayuno, la merienda y los tentempiés manda la
plantilla: el favorito solo adelanta si ya está en los `ids_preferidos` de esa consulta. Una
consulta sin `ids_preferidos` —donde la plantilla no opina— siempre deja pasar al favorito.

Sin esta regla, marcar "pechuga de pollo" y "arroz blanco" convertía el desayuno en una comida
(«08:00 · 180 g de naranja · 250 g de requesón · 70 g de pechuga de pollo · 55 g de arroz»), y en
modo sencillo era peor todavía. La plantilla es quien sabe qué alimentos tienen sentido a las ocho
de la mañana; el favorito ordena dentro de lo que ella considera apto.

Los puntos importantes, escritos como reglas y no como intención:

- **Los excluidos se filtran después de la base y las restricciones y antes que nada más.** Da igual que
  el alimento sea el primero de `ids_preferidos`, que sea el único que cierra las kcal o que venga de la
  lista blanca del modo sencillo: si está excluido, no entra en `preferidos` **ni en `reserva`**.
- **Los favoritos no saltan ningún filtro.** Un favorito que no pasa la base, las restricciones o la
  `FoodQuery` simplemente no aparece en esa consulta; ser favorito solo cambia el **orden**, nunca la
  validez. Esto es lo que impide que "me encanta el queso" meta queso en la consulta de carbohidrato.
- **Los favoritos son una cabecera fija: la rotación se aplica solo al resto de la lista.** El
  desplazamiento por usuario y por comida sigue siendo el de §3.2, pero se calcula **sobre la lista sin
  los favoritos**, y estos se anteponen después. Escrito como "la rotación desplaza la lista entera" la
  regla se vuelve contra sí misma: marcar la ternera como favorita corría la lista y podía **sacar** la
  ternera del menú, que es exactamente lo contrario de lo que pide el usuario. Con la cabecera fija,
  sin favoritos el orden que sale es idéntico al de la v1.1 (verificado con un volcado alimento a
  alimento de los catorce vectores en los dos modos) y con favoritos el alimento entra de verdad.
- **Ningún alimento ocupa dos anclas del mismo plato.** Un favorito que sirve para dos roles (el atún
  como proteína y la legumbre como proteína *y* carbohidrato) producía "atún, atún y arroz" o una
  comida entera de garbanzos. Cada ancla posterior de un plato descarta primero lo que ya está en ese
  plato —en `preferidos` y, si ahí no queda nada, en `reserva`—; solo si no queda ningún otro
  candidato se permite la repetición, porque antes un plato con el mismo alimento dos veces que un
  plato sin ancla (§3.2, punto 4). La guarda **solo se activa para quien ha marcado algo en el paso
  14**: sin listas, ni un menú de la v1.1 se mueve.
- **Con favoritos, el hidrato y la grasa también esquivan lo ya usado en el día.** Las anclas de esos
  dos roles se pedían con `evitarUsados = false` (la variedad la daba la rotación), así que un favorito
  de hidrato o de grasa ganaba **todas** las tomas del día: boniato en las cuatro comidas, arroz en el
  desayuno incluido. Cuando el perfil trae favoritos, esas dos consultas pasan a evitar lo ya servido y
  sus ids se anotan en `usados` junto a los de proteína, verdura y fruta. **Sin favoritos no cambia
  nada**: la regla solo se activa con listas marcadas, y ningún menú de la v1.1 se mueve.
- **Determinismo total.** Las dos listas son entradas del generador como cualquier otra: mismos inputs →
  mismo menú, sin `Math.random` en ninguna parte.

#### Dónde más se aplican los excluidos (lista cerrada)

Un alimento excluido **no puede aparecer en ningún sitio**. En la práctica, eso son cinco:

| Sitio | Regla |
|---|---|
| Menú (`EjemploComida.alimentos`) | `candidatos()`, punto 4 |
| Alternativas por comida (§2.5) | se descartan los candidatos excluidos antes de la guarda del ±15 % |
| Tablas de equivalencias (§2.5) | `equivalencias()` recibe el `PerfilDietetico` y filtra igual |
| Lista de la compra (§3.7.3) | sale del menú, así que no puede traerlos; ningún camino la rellena aparte |
| Alimentos del ciclo y sección opcional de la compra (§3.8) | se filtran también por `excluidos` |
| Lista "Prioriza:" de la tarjeta del ciclo (§2.2c y §4.3b) | v1.2, revisión: el paso 19 del motor retira los nombres cuyos ids estén todos excluidos, y la pantalla y el PDF lo vuelven a aplicar (`consejosSinExcluidos`) porque el "No me gusta" de §2.5 cambia las listas sin llamar al motor |

**Exclusiones encadenadas.** Hay alimentos que son otro alimento con otra forma: excluir `coliflor`
excluye también `arroz_coliflor`, que es coliflor rallada y salteada. La cadena va en un solo
sentido (excluir el arroz de coliflor no retira la coliflor) y vive en `normalizarListasAlimentos`,
así que la aplican por igual el menú, las equivalencias, la compra y la tarjeta del ciclo.

Los favoritos, en cambio, **solo** afectan al menú y al orden de las alternativas: las tablas de
equivalencias siguen ordenadas como estaban (son una referencia, no una recomendación).

**Favoritos realmente servidos (`Ejemplos.favoritos_aplicados`).** El generador publica la lista de
los favoritos que han llegado a la semana (menú o lista de la compra). El resumen de §2.5 y la fila
de §4.2/§4.4 imprimen **esa** lista y no la del cuestionario: el tope de 12 del modo sencillo puede
dejar alguno fuera, y prometer en el informe un favorito que no está en ninguna parte era
exactamente lo que la decisión G venía a evitar. Cuando hay marcados que no entran, la pantalla lo
dice en una línea pequeña ("2 favoritos más no han entrado en el menú de esta semana").

#### Modo sencillo (§3.7.2) con excluidos y favoritos

Las mismas reglas, aplicadas sobre las listas cerradas del banco sencillo y **sin superar nunca el tope
de 12 alimentos distintos**:

1. Se parte de la lista de candidatos de la preferencia y se le aplican los pasos 2 (variante `_sl`) y 3
   (filtrado) de §3.7.2 tal cual.
2. **Se retiran los excluidos**, justo después de ese filtrado.
3. **Los favoritos que pasan el filtro y el rol se colocan en las primeras posiciones** de la lista
   corta de su rol, en el orden del usuario, delante de los candidatos de la tabla. Un favorito que no
   estaba en la lista corta **entra** en ella (es la única forma de que "me encanta el pavo" signifique
   algo en modo sencillo), y para mantener el tope se descarta el **último** candidato de ese rol que
   ninguna plantilla del día A ni del día B esté usando; si todos están en uso, el favorito no entra.
4. El **relleno** del punto 4 de §3.7.2 se evalúa **después** de retirar los excluidos, con los mismos
   mínimos (2 candidatos en `proteina` y en `carbohidrato`, 1 en `grasa`, `verdura` y `fruta`) y en el
   mismo orden (fila `omnivoro` → resto de la base por `id` → desactivar el modo sencillo). Ningún
   relleno puede meter un excluido.
5. **El tope de 12 se comprueba sobre la semana ya construida, no sobre la lista corta.** El
   intercambio del punto 3 no basta: un favorito puede ganar unas consultas y no otras, y sumar así un
   decimotercer alimento distinto. Se genera la semana entera, se cuentan los alimentos distintos y, si
   pasan de 12, **se retira el último favorito** (el orden del usuario es la prioridad) y se vuelve a
   generar, hasta que quepa. Un favorito que no cabe no entra, que es lo que ya autoriza el punto 3.
   En la práctica esto pasa con las bases más cortas: en vegano y en vegetariano, `garbanzos_cocidos`
   marcado como favorito se queda fuera y el menú sale igual que sin marcarlo.
6. **El día B se construye con un solo favorito, el primero de la lista** (v1.2, revisión). En modo
   sencillo la rotación por día está apagada, así que tres favoritos ganaban las dos tomas
   principales de los siete días y la semana entera se quedaba en **cinco** alimentos distintos,
   con la promesa del modo ("hasta doce") incumplida por abajo. Con esta regla los días 1, 3, 5 y 7
   llevan todo lo que le gusta al usuario y los días 2, 4 y 6 llevan su favorito principal y la
   otra opción de la lista corta: medido sobre el perfil de la usuaria de la v1.2, con tres
   favoritos la semana pasa de 5 a 12 alimentos distintos.

#### Regla de respaldo cuando las exclusiones vacían una consulta (normativa)

```
si una FoodQuery se queda SIN candidatos por culpa de las exclusiones:
   1. se aplica el respaldo que ya existía (§3.2 puntos 1-3 y §3.7.2 punto 3), con la lista blanca
      correspondiente y SIEMPRE con la base y las restricciones puestas
   2. si aun así no hay ningún candidato y la FoodQuery es OBLIGATORIA (el ancla de proteína de la
      toma, o el ancla de carbohidrato fuera de low-carb):
         se usa el MEJOR candidato excluido — el primero de la lista que la consulta habría elegido
         si el usuario no lo hubiera marcado — y se anota en `Ejemplos.avisos_menu`:
         "No hemos podido evitar {nombre_corto} en {comida}: sin ese alimento no salen los macros
          de esa toma. Puedes cambiarlo por lo que quieras de la tabla de equivalencias."
         ({nombre_corto} es el `nombre_corto` de `foods.json` con la inicial en minúscula, y la
          frase no tiene género: "gambas" es femenino plural y "lomo de cerdo" masculino singular.)
   3. si la FoodQuery es OPCIONAL (verdura, fruta, ancla de grasa, segunda proteína), no se usa ningún
      excluido: se omite la consulta, como ya hacía el punto 4 de §3.2
```

Un aviso por alimento y por comida, sin duplicados, en el orden en que se generan las tomas. La razón de
preferir "un alimento que no te gusta con su aviso" a "una comida sin proteína" es la misma que sostiene
toda la §3.3: el plan tiene que cerrar los macros que la pantalla acaba de imprimir dos bloques más
arriba. Lo que no es aceptable es hacerlo **en silencio**.

**Lo que NUNCA hace el respaldo:** relajar la base dietética o una restricción. Antes se entrega una
comida con un ancla menos (§3.2, punto 4). Las exclusiones son una preferencia; `vegano` y `sin_gluten`
no lo son.

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

**Límites de ración (`clampRacion`).** Cada fila lleva un **predicado formal** sobre los campos de `foods.json`, no un nombre de producto, y los predicados son **mutuamente excluyentes**: todo alimento de la base encaja en exactamente una fila (lo comprueba la validación de §3.0). **La primera fila, la de los alimentos `extra`, tiene precedencia sobre todas las demás** (v1.2): un alimento con ese tag encaja solo en ella, y la exclusividad mutua del resto se evalúa entre los alimentos **sin** ese tag. Su ración es fija —nunca se escalan, porque nunca entran en una comida—, y la fila existe para que la validación de §3.0 siga siendo una comprobación real y no un caso especial escrito en prosa.

| Fila | Predicado sobre el alimento | Mínimo | Máximo |
|---|---|---|---|
| **Alimento `extra` (v1.2)** — tiene precedencia sobre todas las demás | `tags` incluye `extra` | `racionTipica_g` | `racionTipica_g` |
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

**Desviación de kcal del DÍA (nota del día).** El cierre vigila el ±10 % **por toma**, pero las desviaciones de cada toma se suman y el total del día puede irse más lejos. Cuando `|kcal_menu_dia − resultado.kcal| / resultado.kcal > 0,05`, el bloque de menús lleva su nota con la misma redacción honesta que las de hidrato y grasa: "El menú de ejemplo suma {X} kcal al día, {por encima/por debajo} de las {Y} kcal de tu plan. El ejemplo cierra comida a comida y esas diferencias se suman: si quieres cuadrarlo, sube o baja la ración del acompañamiento de la comida más grande." Sin ella, el PDF imprimía a pocos centímetros el "Total del día" del menú (1 893 kcal) y el total del reparto por comidas (1 730 kcal) sin nada que explicara la diferencia, mientras la desviación de hidratos sí llevaba su nota.

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

**Restricciones combinadas en el banco sencillo (v1.1, normativo).** La tabla de arriba está indexada por `preferencia_efectiva` (el banco), que con la decisión E puede llevar solo una parte de lo que el usuario ha pedido. La lista de candidatos efectiva se construye así, en este orden:

1. Se parte de la fila de `resultado.preferencia_efectiva`.
2. **Sustitución por variante sin lactosa:** si `'sin_lactosa' ∈ restricciones`, cada id cuya variante `_sl` exista se cambia por ella (`queso_fresco_batido_0` → `queso_fresco_batido_0_sl`), conservando su posición en la lista.
3. **Filtrado:** se retira todo candidato que no pase la conjunción base + todas las restricciones de §3.2.
4. **Relleno si un rol se queda corto** (menos de **2** candidatos en `proteina` o en `carbohidrato`, o **0** en `grasa`, `verdura` o `fruta`), en este orden y parando en cuanto se llega al mínimo:
   a. se añaden, por su orden, los candidatos de la fila **`omnivoro`** de la tabla que sí pasen el filtro;
   b. si aún falta, se añaden alimentos de `foods.json` que pasen el filtro y el rol, ordenados por `id` (`localeCompare('es')`) para que siga siendo determinista, hasta llegar al mínimo;
   c. si ni así se llega, **el modo sencillo se desactiva para ese usuario**: se genera el menú con la rotación normal de §3.2 (que sí tiene toda la base disponible), `Ejemplos.modo_sencillo` queda en `false` y se anota el fallback en el log. Nunca se sirve un alimento que incumpla la base o una restricción para salvar el modo sencillo.
5. El **tope de 12 alimentos distintos** de la regla 1 se mantiene intacto en todos los casos, y su test también.

Dos ejemplos que la implementación debe reproducir: `vegano + sin_gluten` deja el rol carbohidrato en `arroz_blanco_cocido` y `patata_cocida` (fuera `avena_copos` y `pan_integral`, sin tag `sin_gluten`), que son 2 y por tanto no dispara el relleno; `vegetariano + sin_lactosa` sustituye los dos lácteos por sus variantes (`queso_fresco_batido_0` → `queso_fresco_batido_0_sl` y `yogur_griego_0` → `yogur_griego_0_sl`, las dos existen en `foods.json`) y deja los cinco candidatos de proteína en pie, sin disparar ningún relleno.

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

### 3.8 Alimentos para los días de regla (v1.2, decisión I, normativo)

Cuando `resultado.ciclo` existe (`SPEC-calculo.md` paso 19), el generador produce dos cosas más. Las dos
son **opcionales, pequeñas y no cambian ni un gramo del plan**: no entran en el menú, no entran en el
cierre de kcal de §3.3 y no cuentan en `alimentos_distintos`.

#### 3.8.1 `Ejemplos.alimentos_ciclo`

De 2 a 4 alimentos, con esta regla, en este orden:

1. Cada id pertenece al **primer** síntoma que lo lista en el orden canónico (así el `por_que` que se
   publica es siempre el suyo), y se acepta si pasa **la base, todas las restricciones y
   `alimentos_excluidos`** (§3.2b). El tag `extra` **no** lo descarta aquí: esta es justamente la lista
   para la que existen esos alimentos.
2. Las cuatro plazas se reparten **POR RONDAS entre los síntomas marcados**, en su orden canónico: el
   primer candidato válido de cada síntoma, después el segundo, y así hasta llenar. El corte se aplica
   **al final**, no mientras se llena.
3. Si salen menos de 2, se publica lo que haya (o `undefined` si no hay ninguno). No se rellena con
   nada que no venga de la tabla.

El reparto por rondas es de la revisión de la v1.2, y no es cosmético: llenar las plazas de forma
voraz, síntoma a síntoma, dejaba a quien marcaba «dolor fuerte» —que tiene exactamente cuatro
candidatos y va el primero del orden canónico— con una lista compuesta al 100 % por los alimentos del
dolor. El hierro del sangrado abundante, que es el motivo declarado de la decisión I, no aparecía
nunca: la tarjeta prometía hierro y la sección de la compra de al lado traía omega-3. Con las rondas,
dolor + sangrado abundante da **dos de cada uno**.

| Síntoma | Ids candidatos, en orden | `por_que` (copy literal) |
|---|---|---|
| `sangrado_abundante` | `lentejas_cocidas`, `ternera_solomillo`, `mejillones_lata`, `espinacas` | "hierro, para reponer lo que pierdes con el sangrado" |
| `dolor` | `sardinas_lata`, `nueces`, `semillas_lino`, `cacao_puro` | "omega-3 y magnesio, que ayudan con el dolor" |
| `cansancio` | `lentejas_cocidas`, `avena_copos`, `patata_cocida`, `espinacas` | "hierro e hidratos, para no quedarte sin energía" |
| `antojos` | `cacao_puro`, `chocolate_85`, `yogur_griego_0`, `manzana` | "cunde más que el dulce típico y sacia más" |
| `hinchazon` | `platano`, `patata_cocida`, `calabacin` | "potasio, que ayuda a soltar el agua retenida" |

`nombre` es el `nombre` largo de `foods.json`, no `nombre_corto`. Un mismo id que aparezca por dos
síntomas se publica una vez, con el `por_que` del **primer** síntoma en orden canónico.

#### 3.8.2 Sección opcional de la lista de la compra

`ListaCompra.opcional_ciclo` se rellena **solo si** `resultado.ciclo.sintomas` contiene alguno de
`sangrado_abundante`, `cansancio` o `dolor`. Con solo `hinchazon` o solo `antojos` no se genera: lo que
esos dos necesitan (plátano, patata, fruta) ya está en la compra del plan, y añadir una sección para
repetirlo sería ruido.

```
titulo = "Para los días de regla (opcional)"
nota   = "No está contado en las cantidades de tu plan: son compras pequeñas para 2-3 días al mes.
          Si no te apetece, sáltatela."
items  = de 1 a 3 líneas
```

**Qué entra, en este orden y parando en 3:** los `alimentos_ciclo` cuyo `id` **no esté ya** en
`compra.items` (si ya lo compras para el plan, no hace falta una línea nueva), tomando **uno por
síntoma** antes de repetir síntoma. Cada línea se calcula con las mismas fórmulas de §3.7.3, con una
única diferencia: **la cantidad es fija y pequeña**, `gramos_semana = 2 · racionTipica_g` redondeado, en
vez de salir del menú. `gramos_dia`, `envases`, `dura_dias` y el consejo se derivan de ahí exactamente
igual.

**Y la línea NO habla el idioma semanal del plan** (v1.2, revisión). La sección se presenta como lo que
es —dos raciones para dos o tres días al mes— y decía a la vez "120 g en la semana · 17,1 g al día · te
dura 10 días", que es el vocabulario de la compra de siete días y contradecía su propia nota dos líneas
más arriba. En esta sección, y solo en esta, las columnas son **tres** (producto · cantidad · comprar),
la cantidad se redacta con `textoCantidadCiclo` —«120 g en total, unas 2 raciones»— y la columna DURA
no se imprime. Pantalla y PDF comparten ese formateador, como comparten los otros dos.

**Y no cuenta en el plan:** `alimentos_distintos` sigue siendo `items.length`, sin la sección opcional; el
tope de 12 del modo sencillo (§3.7.2) tampoco la cuenta, y su test tampoco.

---

## 4. Estructura del PDF exportable

### 4.0 Principios

- El PDF es una **instantánea fiel** de la pantalla de resultados en el momento de la descarga: mismos números, mismos avisos, mismo ejemplo de menú (el que estuviera activo, no uno aleatorio nuevo). "Fiel" es una obligación verificable: todo número visible en pantalla tiene que estar también en el PDF. Las páginas 3 y 5 recogen los bloques que la v1 dejaba fuera (azúcares libres, MLG, metodología ampliada, marca de objetivo reconvertido).
- **Única excepción, y es en sentido contrario:** `'tca'` nunca aparece en ninguna lista de condiciones del PDF. Desde la v1.1 esa excepción es teórica —la interfaz ya no puede producir ese valor (decisión A)—, pero la regla de serialización se mantiene escrita.
- Formato A4, orientación vertical, tipografía legible (mínimo 10pt cuerpo de texto), **6-8 páginas**. El límite original (4-6) no era compatible con el contenido que las §4.2-§4.6 obligan a imprimir: los nueve vectores de la §5 salían en 6-8 páginas ya antes de añadir la tabla de equivalencias que exige la §4.4. Se han fundido la página de peso objetivo/consejos/referencias y la de avisos en un solo flujo (sin salto forzado) y se ha compactado el interlineado; el test de integración del exportador falla si algún vector pasa de 8 páginas. **Con la página de lista de la compra de §4.4b el rango pasa a 6-9 páginas y el test, a 9**: la lista es una página entera y no se puede fundir con los menús, porque está pensada para imprimirse suelta y llevarla al supermercado. **Con la proyección y el seguimiento de la v1.1 (§4.5b) el rango pasa a 6-10 páginas y el test, a 10**: los dos bloques van en la misma página de peso objetivo y cronograma cuando caben, y en una página propia cuando no.
- **La línea "Para esos días" agrupa por motivo** (v1.2, revisión): los alimentos se agrupan por su `por_que` —que es uno por síntoma— y el motivo se imprime **una vez por grupo** ("sardinas, nueces, lino y cacao puro (omega-3 y magnesio, que ayudan con el dolor); lentejas y ternera (hierro…)"), en vez de repetir el mismo paréntesis detrás de cada alimento y atribuirle a cada uno las propiedades de todo el grupo. Y la coletilla solo promete lo que de verdad está en la lista: si algún alimento nombrado no ha entrado en la sección opcional (que corta en tres), se escribe "Los que hemos podido, los tienes al final de tu lista de la compra…".
- **La variante breve del resumen de alimentos de §4.2 va toda en minúscula**, etiqueta y nombres ("sin brócoli, coliflor · favoritos pechuga de pollo"): mezclar la etiqueta en minúscula con los `nombre_corto` capitalizados de `foods.json` dejaba la fila en "sin Brócoli, Coliflor", que es lo peor de las dos opciones.
- **Sin guionado automático.** `@react-pdf/renderer` parte las palabras con patrones de partición **ingleses**, y este documento está entero en español de España: imprimía "escur-ridos" (partiendo el dígrafo `rr`), "rebland-ecen", "de-scongelar" y "solomil-lo", sobre todo en la lista de la compra, que es la página pensada para imprimir y llevar al súper. Se desactiva con `Font.registerHyphenationCallback(palabra => [palabra])` en la cabecera del documento: el texto pasa a partirse solo entre palabras.
- **Ninguna página del documento puede quedar casi vacía.** Una sección que no cabe viaja entera a la siguiente en vez de partirse por la mitad (`wrap={false}` en "Cómo lo calculamos" y en la tabla de equivalencias). **Excepción obligatoria: la tarjeta del ciclo se parte** (v1.2, revisión). Con cuatro o cinco síntomas marcados mide más que una página A4 completa, y `@react-pdf` no divide un nodo que declara `wrap={false}`: lo deja entero en la página en curso y lo que sobresale se imprime **fuera del MediaBox**, es decir, recortado e invisible. La firma del fallo era que el documento *encogía* al añadir contenido (10 páginas con tres síntomas, 9 con cinco). Lo que sigue sin partirse es cada bloque de síntoma por separado, que siempre cabe, y hay un test que comprueba que el número de páginas con cinco síntomas no baja del de tres. Una página con el último párrafo de una sección y nada más se lee como un fallo de maquetación y, además, es la que empuja el documento contra el tope de páginas.
- Cada bloque de contenido lleva su fuente/cita si aplica (p. ej. "Mifflin-St Jeor, 1990"), en letra pequeña al pie del bloque, no como nota académica invasiva.
- El PDF nunca omite el disclaimer completo ni los avisos activos: no es una versión "resumida y sin avisos" del resultado.

### 4.1 Página 1 — Portada

- Logo/nombre "Báscula" (RS Agents).
- Título: "Tu plan nutricional personalizado".
- Datos básicos del usuario en una tarjeta: sexo, edad, altura, peso, fecha de generación (`fecha_inicio` o fecha de descarga).
- Objetivo principal en grande: "{Perder grasa / Mantenerte / Ganar músculo / Recomposición}".
- Pie de portada: "Documento informativo generado automáticamente. No sustituye una valoración nutricional individualizada. RS Agents / Báscula no se hace responsable del uso que se haga de esta información sin supervisión profesional."

### 4.2 Página 2 — Resumen de datos y resultados

- Tabla de datos de entrada: sexo, edad, altura, peso, %grasa (rango + método), actividad diaria, entrenamiento (tipo/días/duración/intensidad), objetivo, ritmo, **preferencias alimentarias** y nº de comidas.
- **Preferencias alimentarias (v1.1).** Ya no es una sola fila con un valor: se imprime como "{base}{, sin lactosa}{, sin gluten}{ · bajo en hidratos}" a partir de `resultado.preferencia_base`, `resultado.restricciones` y `resultado.low_carb` — nunca de `inputs.preferencia`, que puede no reflejar lo que el usuario marcó. Ejemplo: "Vegano, sin gluten · bajo en hidratos".
- **Prioridad de recomposición (v1.1).** Con `objetivo_efectivo === 'recomposicion'` y `recomposicion_prioridad !== 'equilibrado'`, la fila de objetivo lleva el matiz: "Recomposición · prioridad: perder grasa" o "· prioridad: ganar músculo".
- **Plazo (v1.2).** Si `inputs.plazo_semanas` es un número **y `resultado.objetivo_efectivo` es `perder` o `ganar`**, la fila de ritmo lleva el matiz "{ritmo} · fecha pedida: {plazo_semanas} semanas". El ritmo que se imprime es siempre `resultado.ritmo_efectivo`, no el que marcó el usuario: es el del plan. El aviso `INFO_RITMO_POR_PLAZO` o `WARN_PLAZO_IRREAL` explica la diferencia en la última página. La guarda del objetivo es de la v1.2 (revisión): con `objetivo: 'no_se'` el asistente enseña el paso de ritmo y el de peso objetivo, así que `plazo_semanas` llega relleno, y si el paso 6.1 resuelve a `mantener` o `recomposicion` el motor lo ignora en silencio; el PDF imprimía entonces "Ritmo no aplica con este objetivo · fecha pedida: 12 semanas", una línea que se contradice y que ningún aviso explicaba.
- **Alimentos (v1.2).** Si hay `alimentos_excluidos` o `alimentos_favoritos`, una fila más: "Alimentos: sin {lista de `nombre_corto`} · favoritos {lista}", con la mitad que no aplique omitida. Es la misma línea que la pantalla imprime bajo el menú (§2.5), y va aquí porque forma parte de lo que el usuario respondió.
- **Regla (v1.1).** `menstruacion` **no se imprime nunca** en la tabla de datos de entrada. Sus consecuencias sí (la tarjeta de §4.3b y los avisos de la última página), pero el dato en sí es innecesario en un documento que el usuario imprime o comparte. **Lo mismo vale para `sintomas_regla` (v1.2):** los consejos de la tarjeta del ciclo se imprimen, la lista de síntomas marcados **no**.
- Bloque de resultados clave (igual que la cabecera de la pantalla de resultados, sección 2.1): kcal, IMC + categoría, %grasa rango, TDEE.
- **v1.1:** la guarda del cribado que omitía el %grasa de esta página **queda retirada** (decisión A). La tabla y el bloque de resultados clave se imprimen completos siempre.
- Si hay algún aviso de condición médica (`WARN_DIABETES`, `WARN_RENAL`, `WARN_HEPATICA`, `WARN_CARDIACA`, `WARN_HIPERTENSION`, `WARN_TIROIDES`, `WARN_BARIATRICA_GLP1`, `WARN_CONDICION_OTRA`), o `WARN_IMC_35` / `WARN_IMC_40`, o `edad ≥ 65`: sección destacada **"Avisos para tu caso"** en esta misma página, antes de seguir con el plan (según instrucción explícita de la investigación), con el texto completo de cada aviso relevante. Es **la misma condición, palabra por palabra, que la de prioridad visual de §2.8**, para que pantalla y PDF sigan siendo "la misma instantánea" que exige §4.0. `'tca'` **no** activa esta sección ni aparece en la tabla de datos de entrada (regla de serialización, §4.0).
- Si el objetivo se reconvirtió (`INFO_OBJETIVO_RESUELTO` o cualquier `WARN_*` de reconversión), etiqueta "Ajustado automáticamente" junto al objetivo, con el texto del aviso debajo — la misma marca que muestra la pantalla en §2.1.

### 4.3 Página 3 — Macros y agua

- Las 4 tarjetas de macro (proteína, grasa, carbohidratos, fibra) con gramos, g/kg, % y la frase explicativa de la tabla de la sección 2.2.
- Nota de cierre de kcal por redondeo.
- **Línea de azúcares libres** (estaba solo en pantalla): "Como referencia, limita los azúcares añadidos a menos de {azucares_libres_max_g} g/día."
- Bloque de hidratación, idéntico al de §2.3: **la franja "entre {rango_min} y {rango_max} ml al día" como cifra principal** y "{agua_ml} ml de referencia, ≈ {vasos} vasos" como línea secundaria, más la "Nota agua" de `SPEC-calculo.md` §4 reproducida íntegra (incluidas la frase del 20–30 % de agua de los alimentos y la del sodio/electrolitos). Si el motor no da objetivo de agua (`renal` o `cardiaca`, `[Paso 12]`), en su lugar va el texto del aviso correspondiente, nunca una cifra.
- La **nota de metodología** ("Cómo lo calculamos": fórmula de BMR usada y por qué, TDEE bruto y TDEE final tras el margen del 5 %) ya **no cierra esta página: abre la de §4.4**, y viaja entera (nunca se parte). Con la tarjeta del ciclo (§4.3b) o con la banda de plan ajustado, esta página se desbordaba y la sección quedaba cortada, dejando su último párrafo solo en una página vacía al 85 % —36 de 90 renders ajustados del barrido, y esa página de más era la que empujaba 23 documentos al tope duro de 10 páginas de §4.0.

**Marca de plan ajustado (v1.1, decisión B).** Si `resultado.ajuste` está presente, esta página lleva, **encima de las cuatro tarjetas de macro**, una banda bien visible de **dos líneas**, con **"Plan ajustado por ti."** en negrita abriendo el propio párrafo (no en una línea aparte: la marca se repite en la portada y en el pie de cada página, así que aquí no necesita un titular propio y ese ahorro es lo que impide que la página se desborde) y, seguido, qué se movió: *"Has cambiado {los hidratos / las calorías / las calorías y los hidratos} respecto a lo que te propusimos. Lo que te propusimos era: {kcal_recomendada} kcal y {hc_recomendado_g} g de hidratos."* Los dos números salen de `resultado.limites_ajuste`. La misma marca aparece junto a las calorías de la portada (§4.1) y en el pie de cada página, para que un PDF ajustado no pueda confundirse con uno recomendado. El texto íntegro de `INFO_AJUSTE_MANUAL` va, como cualquier otro aviso, en la última página.

La nota de cierre de kcal dice **"hasta 25 kcal"** en vez de "hasta 10 kcal" cuando `resultado.ajuste` está presente (`SPEC-calculo.md` §4, "Nota cierre kcal"). **La pantalla y el PDF la sacan de la misma función**, `notaCierreKcal(ajustado)`: mientras la pantalla usó una constante fija, la tabla de reparto de un plan ajustado imprimía "pueden diferir hasta 10 kcal" justo debajo de un total que se desviaba 20, y el PDF decía 25 para el mismo plan. Los dos sitios donde la pantalla la pinta —bajo las tarjetas de macro y bajo la tabla de reparto— reciben el mismo `resultado.ajuste !== undefined`.

### 4.3b Tarjeta "Tu ciclo y tu plan" (v1.1, decisión D)

Si `INFO_CICLO` está entre los avisos, se imprime la tarjeta de §2.2c **en la página 3, debajo del bloque de hidratación**, con el mismo encabezado y el texto íntegro del aviso.

**Con síntomas (v1.2).** Si `resultado.ciclo` existe, debajo del texto de `INFO_CICLO` van sus consejos,
**uno por síntoma y en el orden de `resultado.ciclo.consejos`**, con la misma estructura que la pantalla:
`titulo` en negrita, `texto` íntegro y la línea "Prioriza: {alimentos separados por ·}" cuando la lista no
está vacía. La tarjeta **crece**, así que deja de caber junto a la hidratación con tres o más síntomas:
en ese caso viaja **entera** a la página siguiente (`wrap={false}`, §4.0), nunca se parte y nunca se
resume. Con cinco síntomas puede ocupar una página propia, y es aceptable: sigue dentro del tope de 10
páginas porque es una página de texto, sin tablas ni gráficas. Si no cabe, pasa entera a la página siguiente; nunca se parte ni se resume. `WARN_CICLO_AUSENTE`, si existe, va donde van todos los `WARN_*`: en la sección destacada de la página 2 (es un aviso de seguridad) **y** en el listado íntegro de la última página, como cualquier otro.

### 4.4 Página 4 — Método, reparto por comidas y ejemplos de menú

- **Abre con la nota de metodología** ("Cómo lo calculamos", §4.3), que ya no cierra la página de macros. Va entera o pasa entera a la siguiente: partida dejaba una página al 85 % en blanco.

- Tabla de reparto por comidas (idéntica a la de pantalla, sección 2.4), con nota fija sobre la falta de evidencia de "más comidas = más metabolismo".
- Ejemplo de menú de un día completo (el que estuviera activo en pantalla), con alimento + gramos + medida casera calculada con la regla de §3.5, agrupado por comida — formato de lista, no tabla densa, para que sea legible impreso.
- Tabla de equivalencias (§2.5), en la misma página o en la siguiente si no cabe, **entera**: partida dejaba la última tabla (grasas) y su nota de cierre solas en una página casi vacía.
- **Resumen de alimentos (v1.2).** Si hay alguna de las dos listas, la misma línea de §2.5 justo debajo del menú, en letra pequeña: "Sin: {nombre_corto…} · Favoritos: {nombre_corto…}", sin el enlace "Cambiar" (en papel no lleva a ninguna parte). Si `ejemplos.avisos_menu` trae algo, sus textos van a continuación, con el mismo estilo que las notas de desviación de §3.3.
- Nota: "Son ejemplos para orientarte, no un menú obligatorio. Puedes sustituir cualquier alimento por otro de la misma familia sin descuadrar tus macros de forma relevante: mira la tabla de equivalencias."
- Si el generador no ha producido menú (`renal` o `hepatica`, §3.1), la página contiene solo la tabla de reparto y el texto de derivación de §3.1; no se imprime ningún gramaje de alimento.
- La tabla de reparto sale de `resultado.comidas` (un único array; en la v1 no hay reparto de día de entreno y de día de descanso, `[Paso 16]`), y usa el campo `hora` de cada comida como etiqueta de referencia y `peri` para marcar la toma de alrededor del entrenamiento.
- **v1.3 — "Cuéntanos cómo comes".** Con `DatosPdf.dieta_propia`, esta sección pasa a titularse **"Tu menú,
  con lo tuyo dentro"** y la pinta el bloque de [`docs/SPEC-dieta-propia.md`](SPEC-dieta-propia.md) §6.2:
  la descripción del modo, "Lo que hemos tenido en cuenta", "Apuntado", las comidas etiquetadas **tuya** o
  **propuesta**, los totales por comida y del día con "Tu plan pedía: …", las notas por condición, todos
  los avisos, los pendientes y la nota fija. La tabla de reparto de arriba lleva entonces su nota de §5.1,
  el pie de todas las páginas añade la marca "con tus comidas" y la página de la compra usa la lista de
  §6.1. Sin ese campo el PDF es **idéntico** al de la v1.2, incluido este título. Las equivalencias y el
  resumen "Sin: … · Favoritos: …" se siguen imprimiendo igual.

### 4.4b Página — Lista de la compra semanal

- **Página nueva** (salto forzado) inmediatamente después de los menús y las equivalencias, para poder imprimirla suelta. Con **más de 14 líneas** las filas se aprietan (menos aire vertical y menos interlineado en la letra pequeña): sin eso, una lista larga se desbordaba y dejaba una fila suelta y las tres notas fijas solas en la página siguiente. Cuando ni así cabe —vegano, 6 comidas, 3 000 kcal—, **el título y el subtítulo se repiten arriba de la continuación** (`fixed`), para que la segunda hoja se sostenga sola en el súper. Título: "Tu lista de la compra de la semana"; bajo el título, el subtítulo de §2.5b.
- Contenido: `ejemplos.compra` **tal cual**, sin recalcular nada, agrupado por sección en el orden de §3.7 y con las mismas cuatro columnas de §2.5b (producto, cantidad, envases a comprar, duración) más el consejo de cada línea en letra pequeña.
- **Mismas cuatro columnas quiere decir el mismo texto.** Las dos celdas de cantidad y el rótulo del modo sencillo salen de `textoCantidadSemana`, `textoCantidadDia` y `textoModoSencillo` (en `src/meals/compra.ts`), que usan la pantalla y el PDF. Con una función de formato en cada capa, la pantalla imprimía "1,93 kg en la semana · 82,5 g al día" y el PDF "1.925 g en la semana · 83 g al día" para la misma línea, y el PDF fijaba el plural ("1 alimentos").
- Si `ejemplos.modo_sencillo` es `true`, línea bajo el subtítulo: "Modo sencillo: {alimentos_distintos} alimentos para toda la semana."
- **Sección opcional "Para los días de regla" (v1.2).** Si `ejemplos.compra.opcional_ciclo` existe, va al final de la lista y **antes** de las notas fijas, con su `titulo`, su `nota` en letra pequeña y sus 1-3 líneas en las mismas cuatro columnas. Separada con un filete, y sin sumar al recuento del modo sencillo. Si no cabe en la página, viaja entera a la continuación (que ya repite título y subtítulo, ver arriba).
- Al pie, las tres notas fijas de `compra.notas`, íntegras y en orden.
- **Nunca lleva precios** (§3.7): un precio impreso en un PDF que el usuario guarda meses envejece mucho peor que un gramaje.
- Si no hay menú (`renal` o `hepatica`, §3.1) o `ejemplos.compra` es `undefined`, **la página no se imprime**; no se sustituye por ningún texto, porque §4.4 ya explica por qué no hay menú.
- El límite de 6-8 páginas de §4.0 pasa a ser **6-9** con esta página (y **6-10** con la proyección y el seguimiento de §4.5b): el test de integración del exportador falla si algún vector se pasa de 10.

### 4.5 Página 5 — Peso objetivo, cronograma y consejos

- Si aplica: peso objetivo (sugerido o dado por el usuario), hito intermedio si existe, cronograma con rango de semanas y fechas, nota `INFO_ADAPTACION`. Se aplican **las mismas dos reglas de presentación que en pantalla (§2.6)**: con `peso_objetivo.mostrar_central === false` se imprime solo la franja "entre X e Y kg", sin número grande; y con `cronograma.precision_fecha === 'mes'` se imprimen mes y año en vez de fechas exactas, y el bloque principal es el primer tramo de 12 semanas (`tramo_12sem`), no el horizonte completo.
- Si no aplica (mantener/recomposición): nota `INFO_SIN_CRONOGRAMA`.
- Bloque "Qué haría un nutricionista": los 3-5 consejos seleccionados (sección 2.7), en formato de lista con viñetas.
- **Bloque "Otras referencias" (nuevo, cierra el hueco de §4.0).** Reproduce la metodología ampliada de §2.9, que la v1 dejaba solo en pantalla: %grasa por CUN-BAE, Deurenberg y US Navy (las que apliquen), masa libre de grasa (`mlg`, que es la base del suelo de disponibilidad energética citado en `WARN_SUELO_CALORICO_EA`), FFMI con su categoría, y las cuatro fórmulas clásicas de peso ideal (Devine, Robinson, Miller, Hamwi). Encabezado obligatorio del bloque: "Otras referencias, no son un objetivo." (v1.1: la guarda del cribado que omitía este bloque queda retirada.)

### 4.5b Proyección y seguimiento (v1.1, decisión F)

Va **justo después** del cronograma de §4.5, en la misma página si cabe y en una página propia si no (con eso el límite de §4.0 sube a 10 páginas).

- **Título:** "Cómo debería ir la cosa". Debajo, el subtítulo de §2.6b.
- **La gráfica.** El mismo SVG de §2.6b, con la misma banda, la misma curva, los mismos hitos de 4, 8 y 12 semanas y la misma línea de objetivo. `@react-pdf/renderer` no admite SVG arbitrario del DOM, así que se dibuja con sus primitivas (`Svg`, `Path`, `Line`, `Circle`, `Text`) a partir de los mismos `resultado.proyeccion` y las mismas fórmulas de escala: no se recalcula ningún peso.
- **Tabla equivalente, obligatoria.** Debajo de la gráfica, la tabla de *Semana · Mínimo · Esperado · Máximo* con **una fila por semana**, la misma que la pantalla esconde tras "Ver los números". En el PDF no se esconde: es un documento impreso y la tabla es lo que sobrevive a una fotocopia en blanco y negro.
- **Copy fijo:** la "Nota proyección" de `SPEC-calculo.md` §4, íntegra; o el texto de `INFO_PROYECCION_PLANA` cuando la proyección es plana; o el de **`INFO_PROYECCION_RECOMP`** cuando es la banda de recomposición (v1.2). Es una de las tres, nunca dos.
- **Proyección de recomposición (v1.2).** Se dibuja **igual** que las demás: misma banda, misma curva central, mismos hitos de 4, 8 y 12 semanas y misma línea de objetivo (`peso_objetivo.efectivo`, que en recomposición con déficit ya no es `null`). No hace falta ningún caso especial en el dibujo: el borde superior es plano porque los datos lo son. Lo único que cambia es el copy fijo de debajo y que **no hay fechas** (el cronograma es `null`, así que §4.5 imprime `INFO_SIN_CRONOGRAMA` en su lugar).
- **Seguimiento.** Si `datos.pesajes` existe y tiene **al menos un** pesaje, se imprimen los puntos sobre la gráfica y, debajo, la lista de pesajes (*fecha · kg*) en orden cronológico. Con **dos o más** se imprime además la frase de balance de §2.6c, elegida con la misma tabla de reglas y con su cierre fijo. Con `datos.pesajes` vacío o ausente **no se imprime nada de esto**, ni un hueco ni una nota.
- **Etiqueta obligatoria del bloque de seguimiento:** "Estos pesajes estaban guardados solo en tu móvil el {fecha de generación}. Este PDF es la única copia que sale de él."
- Si `resultado.proyeccion` es `undefined`, la sección entera **no se imprime**.

### 4.6 Última página — Avisos completos y disclaimer

- Listado completo de todos los avisos (`WARN_*` e `INFO_*`) activos, con su texto íntegro (no resumido), agrupados visualmente en "Avisos importantes" (WARN) y "Notas informativas" (INFO). Sin excepciones de texto ni de maquetación: el PDF pinta íntegra la lista de `resultado.avisos`. `INFO_RITMO_SUAVE` cae en el grupo de notas informativas por ser `info`. El exportador no filtra nada: cualquier protección vive en el motor (`[Paso 17]`, ver §2.8).
- El aviso `WARN_MENU_PROTEINA_VEGETAL` y la nota de fibra, si el generador los ha emitido (§3.3), se listan aquí igual que el resto.
- Disclaimer legal completo (texto íntegro de la sección 2.10 de este documento / sección 3 de la investigación).
- **Línea de ayuda (v1.1, literal y siempre presente):** "Si la comida o el peso te generan ansiedad, puedes hablar gratis con ADANER (adaner.org) o con tu centro de salud." Es la misma frase, palabra por palabra, que la §2.10 de la pantalla, y no depende de ninguna respuesta del cuestionario.
- Pie: fecha de generación, versión del motor de cálculo (para poder reproducir el cálculo si el usuario vuelve más adelante con datos distintos).

---

## 5. Referencias cruzadas con `SPEC-calculo.md`

Este documento no redefine ningún número, fórmula, suelo, techo ni tabla del motor de cálculo: todos los valores mostrados en el wizard, en resultados y en el PDF provienen literalmente de la salida `Resultado` de `SPEC-calculo.md` o de sus tablas de la sección 3. Cualquier cambio futuro en una fórmula, suelo o tabla del motor debe reflejarse aquí solo en el copy o la disposición visual, nunca inventando un cálculo alternativo en la capa de UX.

**Lo único que este documento sí define por su cuenta** es el módulo de menús de la sección 3, que no forma parte del motor: sus plantillas, sus límites de ración, su cierre de kcal y sus dos salidas propias (`WARN_MENU_PROTEINA_VEGETAL` y la nota de fibra). Esas dos salidas se listan en el bloque de avisos como cualquier otra, pero las emite el generador, no el motor, y no aparecen en la tabla §4 de `SPEC-calculo.md`.

**Campos que este documento asume y que el motor ya proporciona** (reconciliación del 2026-09-07: todos existen en `SPEC-calculo.md`, ninguno queda pendiente):

| Lo que usa este documento | Dónde vive en el motor |
|---|---|
| `cribado_tca` (v1.1: ya no lo escribe la UI; regla no expuesta) | §0.3 e `InputCalculo`, §1 fila 17, normalizado en el Paso 0 |
| `recomposicion_prioridad`, `menstruacion`, `preferencia_base`, `restricciones`, `low_carb` | §1 filas 19-23 y §1.1 (regla de traducción y regla inversa) |
| `Resultado.proyeccion` | Paso 14b |
| `Resultado.limites_ajuste`, `Resultado.ajuste` y `ajustarMacros` | Paso 18 |
| `Resultado.preferencia_base` / `.restricciones` / `.low_carb` para el filtro de menús | Paso 6.8 y §1.1 |
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
| `plazo_semanas` (paso 12 del wizard) | §1 fila 24 y **Paso 6.7ter**; avisos `INFO_RITMO_POR_PLAZO` y `WARN_PLAZO_IRREAL` |
| `sintomas_regla` (subpregunta del paso 3b) y `Resultado.ciclo` | §1 fila 25 y **Paso 19** (copy completo de los cinco consejos) |
| `peso_objetivo.efectivo` en recomposición y `INFO_PROYECCION_RECOMP` | **Pasos 13 y 14** (recomposición con déficit real) |
| `alimentos_excluidos` y `alimentos_favoritos` (paso 14 del wizard) | §1 filas 26-27: **el motor los ignora**; todo el comportamiento vive en §3.2b de este documento |


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


---

### v1.3 — "Cuéntanos cómo comes" (2026-09-12)

Decisión K. La especificación normativa es [`docs/SPEC-dieta-propia.md`](SPEC-dieta-propia.md); aquí solo
queda lo que cambia en este documento.

| # | Sev. | Dónde | Resumen de lo aplicado |
|---|---|---|---|
| K-1 | major | §2.5, §2.5b | La pantalla de resultados gana la tarjeta "¿Ya tienes tus comidas o tus costumbres?" y, con una composición activa, el bloque "Tu menú, con lo tuyo dentro" **sustituye** al de ejemplos de menú y la compra pasa a ser la del día compuesto (§6.1 de la spec nueva), con "—" en "Comprar" y en "Dura" para lo que no está en nuestra base. El menú propuesto no desaparece: se vuelve a él sin perder nada. |
| K-2 | major | §4.4, §4.4b | Con `DatosPdf.dieta_propia`, la sección "Ejemplo de menú" del PDF pasa a "Tu menú, con lo tuyo dentro" (§6.2 de la spec nueva): etiquetas tuya/propuesta, totales del día contra lo que pedía el plan, notas por condición, todos los avisos, pendientes y nota fija; nota de §5.1 sobre la tabla de reparto y marca "con tus comidas" en el pie. Sin ese campo el PDF es idéntico al de la v1.2. El tope de 10 páginas se mantiene: con más de 30 alimentos dictados el bloque compacta. |
| K-3 | minor | §3.0 | `foods.json` pasa a **107 alimentos** (101 del plan + 6 con tag `extra`): los 2 nuevos —proteína de suero en polvo y kéfir— existen para emparejar lo dictado y **no entran en ningún menú**, como el resto de `extra`. |

### v1.2.1 — buscador y grupos plegables del paso 14 (2026-09-08)

| # | Sev. | Dónde | Resumen de lo aplicado |
|---|---|---|---|
| P14-1 | major | paso 14 | Los 103 chips repartidos en siete grupos median 3 553 px, cuatro pantallas de móvil, sin buscador ni plegado. Se añade el **buscador** en la barra fija (subcadena sobre `nombre_corto` y `nombre`, sin acentos ni mayúsculas, palabra a palabra, línea de resultados en `aria-live` y mensaje propio cuando no hay ninguno) y los **grupos plegables** (cabecera-botón de 44 px con recuento y marcas, todos plegados salvo los que ya traen algo marcado, "Mostrar todos" / "Plegar todos"). La búsqueda no destruye el plegado y marcar un chip no borra la búsqueda. Plegada, la pantalla baja a 1 331 px y la barra fija se queda en 126 px de los 130 de presupuesto. Reabre el hallazgo U-11 que la v1.2 dejó fuera por cierre de ronda. |

#### Ronda de cierre de la v1.2.1 (revisión adversaria del paso 14, 2026-09-08)

Recorrido real en móvil (375 × 812) sobre el build de producción y revisión adversaria del código, la
spec y los tests. Aceptados y aplicados los cinco; la sección de cada uno queda arriba con la marca
"(v1.2.1, revisión)".

| # | Sev. | Dónde | Resumen |
|---|---|---|---|
| B-1 | critical | paso 14 | Intro —o la tecla "Buscar" del teclado del móvil— en el buscador enviaba el formulario del wizard por submisión implícita: como el paso 14 es el último y siempre está completo, generaba el plan y sacaba al usuario de la pantalla con cero alimentos marcados. Ahora la tecla filtra y cierra el teclado (`preventDefault` + `blur`), y el campo declara `enterKeyHint="search"`. |
| B-2 | major | paso 14 | "Borrar" se desmonta al pulsarlo y el foco caía al `<body>`: quien va con teclado o con lector volvía a empezar por la barra de progreso. Ahora el foco vuelve al campo. |
| B-3 | major | paso 14 | La línea de resultados se escondía con `display: none` mientras estaba vacía, así que la región `aria-live` no estaba registrada y al aparecer con el texto ya dentro no se anunciaba —justo lo contrario de lo que prometía esta sección—. Vacía se recorta como `.etiqueta-oculta`: fuera del flujo, dentro del árbol de accesibilidad. |
| B-4 | minor | paso 14 | El recuento "{n} alimentos para «…»" se pintaba **debajo** de la barra fija y la barra lo tapaba en cuanto se bajaba un poco: con muchos resultados no se veía nunca. Sube a la fila del resumen, dentro de la barra, en una sola línea; la frase larga del vacío se queda donde estarían los grupos. Buscando, la cabecera del grupo recupera el recuento y las marcas que sí lleva la cabecera-botón. |
| B-5 | minor | paso 14 | "Mostrar todos" quedaba a 4 px del campo de búsqueda, que también se toca: 8 px, sacados del `padding-bottom` de la barra para no tocar el presupuesto de 130 px. La spec no decía que el botón comparte fila con el resumen ni que desaparece al buscar; ahora sí. |

### v1.2 — decisiones G-J del segundo feedback real (2026-09-08)

| Decisión | Dónde se ha escrito |
|---|---|
| G — Alimentos favoritos y "no me gusta" | §1.0 (barra de progreso), §1.1 (mapa y condiciones de visibilidad), **paso 14** (pantalla nueva, control segmentado, grupos de chips y reglas de interacción), §2.5 (acción "No me gusta" con deshacer y resumen), **§3.2b** (orden exacto en `candidatos()`, banco sencillo, respaldo y aviso), §3.0 (`nombre_corto`), §4.2 y §4.4 (PDF) |
| H — Peso objetivo, plazo y recomposición | §1.1 (orden nuevo: 11 peso objetivo, 12 ritmo), **paso 11** (visible también en recomposición), **paso 12** (selector de plazo y previsualización), paso 10 (nudge de recomposición), §2.6b y §4.5b (la banda de recomposición se dibuja igual), §4.2 (fila de plazo) |
| I — Regla: síntomas y alimentos | **paso 3b** (subpregunta de síntomas), §2.2c y §4.3b (tarjeta ampliada), **§3.8** (alimentos del ciclo y sección opcional de la compra), §2.5b (dónde va), §3.0 (tag `extra`) |
| J — Arreglos menores | §2.6c (mensajes de fecha y de peso no válidos, que hasta ahora se rechazaban en silencio) |

**Lo que NO cambia con la v1.2:** ninguna plantilla, ningún banco, ningún límite de ración, ninguna
fórmula de la lista de la compra y ningún menú existente. Los cuatro alimentos nuevos llevan el tag
`extra` justamente para eso: entran en la base y en `mercadona.json` sin tocar la rotación ni la reserva
de ninguna `FoodQuery`, así que los vectores de §3.6 siguen siendo los mismos.

#### Ronda de cierre de la v1.2 (revisión adversaria de UX, menús y PDF, 2026-09-08)

Recorrido real en móvil (375 × 812) y revisión adversaria del generador y del exportador. Aceptados y
aplicados; la sección de cada uno queda arriba con la marca "(v1.2, revisión)".

| # | Sev. | Dónde | Resumen |
|---|---|---|---|
| U-1 | critical | paso 14 | "Seguir sin marcar nada" borraba las dos listas sin confirmación y con un rótulo falso, justo cuando se llega desde "Cambiar" con exclusiones guardadas. Ahora solo se pinta si no hay nada marcado. |
| U-2 | major | §2.5 | El "Deshacer" de "No me gusta" aparecía al final del día (2 725 px por debajo del pliegue) y moría en 8 s: pasa a barra fija abajo y recibe el foco. |
| U-3 | major | §2.6 | El peso objetivo escrito por el usuario no se enseñaba como cifra principal con la grasa estimada: la franja propuesta baja a nota y el titular es siempre su número. |
| U-4 | major | §3.8.1 | `alimentosCiclo` repartía las cuatro plazas de forma voraz y el dolor se las llevaba todas: reparto por rondas de síntoma. |
| U-5 | major | §3.2b | Los favoritos se anteponían sin mirar la toma y metían pollo y arroz en el desayuno: solo adelantan en comida y cena, o si la plantilla ya los lista. |
| U-6 | major | §3.2b | Un favorito de hidrato o de grasa ganaba las cuatro tomas del día; en modo sencillo la semana se quedaba en cinco alimentos. `evitarUsados` para esos dos roles y día B con un solo favorito. |
| U-7 | major | paso 11 | La nota del IMC del peso objetivo no era anunciable (sin `role`, sin `aria-live`, sin `aria-describedby`). |
| U-8 | major | §3.2b | El aviso del excluido inevitable usaba un nombre derivado y género masculino ("sin él", "Cámbialo") para alimentos femeninos y plurales. |
| U-9 | major | §4.0 | La tarjeta del ciclo, con `wrap={false}`, se imprimía fuera del papel a partir de cuatro síntomas. |
| U-10 | major | §3.2b | Los consejos del ciclo recomendaban alimentos excluidos mientras la compra sí los respetaba (ver también `SPEC-calculo.md`, paso 19). |
| U-11 | minor | paso 10, §2.6b, §2.6c, §3.8.2, §4.2, §4.4b, paso 12, paso 14, §3.0 | Copy y detalle: el nudge nombra el objetivo de arriba; la descripción de la gráfica no dice "entre 63 y 63 kg"; el primer día del plan da un solo mensaje de fecha; la compra de los días de regla tiene su propia cantidad y tres columnas; el plazo solo se imprime si el motor lo ha leído; la variante breve va en minúscula; abrir el campo de fecha limpia el chip; el resumen de alimentos se ordena y se corta en seis; el radiogroup del paso 14 cumple el patrón ARIA; `nombre_corto` distingue soja seca/hidratada, proteína de guisante/soja y queso batido sin lactosa, y el grupo de lácteos nombra las bebidas vegetales. |

**Rechazado:** nada. El único hallazgo que no se aplicó tal cual en esta ronda es el buscador del paso 14
(U-11, "3 553 px de página"): se resolvió con la alternativa barata que el propio hallazgo propone
—repetir el resumen vivo en la barra pegada arriba—, porque un buscador dentro del wizard es una
pantalla nueva y esa ronda cerraba la v1.2, no la ampliaba. **Reabierto y hecho en la v1.2.1**, junto
con el plegado de los grupos, que es lo que de verdad devuelve la pantalla a un tamaño razonable.

### v1.1 — decisiones A-F del feedback real de usuarios (2026-09-07)

| # | Decisión | Dónde se implementa en este documento |
|---|---|---|
| A | Fuera el cribado del paso 5b | §1.0 (barra de progreso), §1.1 (mapa), §1.2 paso 5b (retirada y motivos), paso 6.C, paso 11, paso 12, §2.1, §2.6, §2.8, §2.9, §2.10 (línea de ADANER), §4.0, §4.2, §4.5, §4.6 |
| B | Ajuste manual de macros | §2.0 (bloque 2b), **§2.2b** (panel completo: controles, copy, "Volver a lo recomendado", persistencia, accesibilidad), §4.1 y §4.3 (marca "ajustado por ti") |
| C | Recomposición con prioridad | §1.1 (mapa), paso 10 (subpregunta dentro de la pantalla), §4.2 (matiz en la fila de objetivo) |
| D | Regla | §1.1 (mapa), **paso 3b** (pantalla nueva), §2.0 (bloque 2c), **§2.2c** (tarjeta), §4.3b |
| E | Preferencias combinables | §1.1 (mapa), **paso 13** (base + restricciones + interruptor y compatibilidad), **§3.2** (filtro como conjunción y regla de fallback), **§3.7.2** (banco sencillo con restricciones combinadas), §4.2 |
| F | Proyección y seguimiento | §2.0 (bloques 6b y 6c), **§2.6b** (gráfica SVG y tabla accesible), **§2.6c** (pesajes locales y frase de balance), **§4.5b** |

**Reglas de reparto entre documentos que siguen valiendo.** Este documento no define ningún número del motor: la proyección, los límites del ajuste, el déficit de recomposición y el efecto de la regla viven en `SPEC-calculo.md` (pasos 6.7bis, 7, 9, 14b y 18) y aquí solo se pintan. Lo único que este documento define por su cuenta sigue siendo el módulo de menús de la §3 — al que la v1.1 añade el filtro por restricciones combinadas y su regla de fallback, que tampoco son números del motor.
