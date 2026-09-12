# Báscula

Calculadora de calorías y macronutrientes en español. Contestas trece preguntas cortas —sexo,
edad, altura, peso, condiciones médicas, grasa corporal, constitución, actividad, entrenamiento,
objetivo, peso al que quieres llegar, ritmo, forma de comer y qué alimentos no quieres ver;
quince si eres mujer, con las del embarazo y la regla— y devuelve tu objetivo de calorías, el
reparto en proteína, grasa, hidratos y fibra, la hidratación, el reparto por comidas, un menú de
ejemplo con gramajes reales, la lista de la compra de la semana, la curva de peso esperada semana
a semana y un informe en PDF.

**Todo el cálculo ocurre en el navegador**: no hay cuentas, no hay analítica y no hay base de datos;
lo único que se guarda es un borrador en el `localStorage` del propio dispositivo, y las tipografías
van autoalojadas en `public/fonts`. Desde la v1.3 hay **un único servicio propio** (`api/`), que solo
existe para una cosa: entender lo que le cuentas de tus comidas. Si no lo usas, la página no hace una
sola petición a nadie.

## Qué trae la v1.3

**Cuéntanos cómo comes.** Quien ya tiene sus comidas hechas y pesadas no quiere que le propongan un
menú: quiere que le cuadren el suyo. Desde la pantalla de resultados puedes **dictar o escribir** cómo
comes —"por las mañanas 250 g de kéfir, 5 g de chía y un scoop de proteína; al mediodía como de táper;
ceno ligero, sin hidratos; no me gusta el brócoli"— y la aplicación monta el día alrededor de eso:

- **Lo tuyo se conserva**, con los gramos ajustados a tu plan solo si hace falta, en el estado en que
  lo cuentes (si dices "en seco", los gramos son en seco) y con las unidades de casa traducidas a
  gramos (un scoop, una cucharada, cinco huevos).
- **Los huecos los monta el generador de menús de siempre** con lo que queda de tu plan, así que
  puedes contar solo el desayuno, algunas comidas o el día entero. Cada comida va marcada **"tuya"** o
  **"propuesta"**, en la pantalla y en el PDF.
- **Los gustos y las costumbres cuentan aunque no lleven gramos**: lo que no quieres ver se suma a tus
  alimentos excluidos, lo que te gusta a tus favoritos, y las costumbres se aplican donde se puede
  ("cena sin hidratos") o se apuntan donde todavía no ("hago cinco comidas").
- **Ni una caloría del plan cambia.** El motor no lee nada de esto: kcal, macros, agua, reparto y
  proyección son los mismos. Si algo no cuadra, se dice con todas las letras en vez de maquillarlo.
- **La voz no pasa por nuestro servidor**: el dictado lo hace tu propio navegador (Google en Chrome,
  Apple en Safari). Lo que sí viaja es el **texto**, a nuestro servicio y de ahí a Anthropic (Claude),
  para interpretarlo; no lo guardamos ni lo registramos. Puedes escribirlo en vez de dictarlo, y
  corregir cualquier alimento a mano sin volver a llamar a nadie.

## Qué traía la v1.2

Cuatro cosas que salieron de escuchar a una usuaria de verdad usando la v1.1:

- **Alimentos que no te gustan y favoritos.** La última pregunta del cuestionario deja marcar, con
  chips agrupados por tipo de alimento, lo que no quieres ver y lo que sí te apetece comer. Un
  alimento tachado no aparece en ningún sitio —ni en el menú, ni en las sustituciones, ni en las
  equivalencias, ni en la lista de la compra— y los favoritos entran los primeros. Solo se enseñan
  los alimentos que encajan con tu forma de comer: una vegana no ve pollo. Son 103 chips, así que la
  pantalla trae **buscador** —escribe "brocoli" y sale el Brócoli, sin acentos ni mayúsculas que
  valgan— y los **grupos vienen plegados**, salvo los que ya tienes marcados: una pantalla de móvil
  en vez de cuatro. Desde la pantalla de
  resultados, cada alimento del menú lleva un **"No me gusta"** que rehace el menú y la compra al
  momento (con "Deshacer" en una barra fija abajo), sin tocar ni una caloría del plan. Los favoritos
  se sirven donde tienen sentido —en la comida y en la cena, o donde la plantilla ya los tenía—:
  marcar pollo y arroz no convierte el desayuno en una comida. Y el resumen del plan nombra los que
  de verdad han entrado en la semana, no los que marcaste.
- **Peso objetivo y plazo.** Si tienes una fecha en mente, la dices: "5 kg en 12 semanas". El motor
  elige el ritmo más suave de su tabla que llegue a tiempo —midiendo las semanas de verdad, con sus
  descansos, no una regla de tres— y si no llega ninguno te lo dice en vez de prometerte lo que no
  puede cumplir. Si tu meta está por debajo de lo que es seguro, el ritmo se calcula contra la meta
  que el plan publica, no contra la que se descarta. Los suelos de seguridad siguen mandando por
  encima del plazo, y cuando el plan no puede darte un calendario tampoco te da una fecha.
- **Recomposición con peso objetivo.** Quien recompone con prioridad en perder grasa ya tiene su
  peso objetivo y su proyección: una banda entre lo que baja la báscula por el déficit y lo que se
  queda igual porque el músculo compensa. Sin fecha, porque en recomposición no se puede prometer:
  la báscula baja más despacio de lo que cambia el cuerpo. Mide también la cintura.
- **Síntomas de la regla.** Al decir que la tienes puedes marcar qué notas esos días —dolor,
  hinchazón, antojos, cansancio, sangrado abundante— y la tarjeta del ciclo pasa a dar consejos
  concretos sobre alimentos (hierro con vitamina C para el sangrado, omega-3 y magnesio para el
  dolor, potasio para la hinchazón) y una sección opcional en la lista de la compra, con dos o tres
  cosas pequeñas para esos días. Los alimentos se reparten entre los síntomas que marcas, así que
  con dolor y sangrado abundante salen los dos, y ninguno de ellos es algo que hayas marcado como
  "no me gusta". **No cambia ni un número del plan**, y así se dice.

## Qué traía la v1.1

Cuatro cosas que salieron del uso real, no de una lista de ideas:

- **Ajusta tus macros.** El plan que propone el motor es un punto de partida, no una orden. Desde
  la pantalla de resultados se pueden bajar o subir los **hidratos** con un deslizador y las
  **calorías** de 50 en 50, dentro de los límites de seguridad que publica el propio motor. La
  proteína no se toca (es la que protege el músculo cuando comes menos) y la grasa absorbe el
  resto sin bajar nunca de su suelo. Todo lo derivado se rehace con el ajuste: reparto por comidas,
  menú, lista de la compra, cronograma, proyección y PDF, que sale marcado "ajustado por ti".
  Siempre hay un "Volver a lo recomendado".
- **Preferencias que se combinan de verdad.** Antes solo se podía elegir una. Ahora hay una base
  (omnívoro, vegetariano o vegano), las restricciones que hagan falta (sin lactosa, sin gluten) y
  un interruptor de bajo en hidratos, y los menús filtran por todas a la vez.
- **Proyección de peso.** Curva semana a semana con su banda de incertidumbre, hasta 26 semanas o
  hasta el objetivo, con hitos a 4, 8 y 12 semanas. En pantalla y en el PDF.
- **Seguimiento en este móvil.** Apuntas tus pesajes (fecha y kilos) y se dibujan sobre la
  proyección, con una frase honesta de balance —vas por delante, en la banda o por detrás— y sin
  promesas. Se guarda **solo en el navegador**: no hay cuenta, no hay nube y nadie más lo ve.

Además, quien elige **recomposición** puede decir qué le importa más ahora (perder grasa, las dos
cosas por igual o ganar músculo), y a las mujeres se les pregunta por la regla: no cambia los
macros —el gasto varía poco a lo largo del ciclo—, pero explica por qué la báscula sube un par de
kilos la semana previa y, si es irregular o ausente en un plan con déficit, avisa de la baja
disponibilidad energética y suaviza el ritmo agresivo a moderado.

## Cómo se calcula

Sin magia y sin cajas negras: el cálculo es una implementación literal de
[`docs/SPEC-calculo.md`](docs/SPEC-calculo.md), paso a paso.

1. **Grasa corporal**: del dato que traigas, de las medidas con cinta (US Navy), de la silueta que
   elijas o estimada por altura, peso, edad y sexo (CUN-BAE). Siempre se publica como rango, nunca
   como cifra cerrada.
2. **Metabolismo basal**: Mifflin-St Jeor, o Katch-McArdle cuando el porcentaje de grasa viene de
   una prueba fiable.
3. **Gasto total**: factor de actividad diaria más el gasto del entrenamiento por METs, menos un
   5 % de margen de seguridad, porque casi todo el mundo sobrestima lo que se mueve.
4. **Objetivo y ritmo**: déficit o superávit acotados por suelos calóricos de seguridad; con
   objetivos incoherentes el motor los resuelve y lo dice por escrito.
5. **Macros**: proteína por kilo de peso (o de masa magra), grasa con su mínimo hormonal, hidratos
   con el resto y fibra por cada 1.000 kcal. El somatotipo solo desplaza hidratos frente a grasa.
6. **Agua, comidas y cronograma**: mililitros por kilo con ajustes por entreno y calor, reparto por
   número de tomas con la toma peri-entreno marcada, y semanas estimadas hasta el objetivo.
7. **Menú y lista de la compra**: se resuelven contra `src/data/foods.json` con los límites de
   ración de [`docs/SPEC-ux-comidas-pdf.md`](docs/SPEC-ux-comidas-pdf.md); el modo sencillo cierra
   la semana en como mucho doce alimentos distintos.
8. **Ajuste manual (paso 18)**: una función aparte, `ajustarMacros`, que parte siempre del plan
   recomendado y rehace todo lo derivado. En `localStorage` se guarda solo el ajuste, nunca el plan.
9. **Ciclo (paso 19)**: los síntomas de la regla no entran en ninguna fórmula; solo eligen qué
   consejos y qué alimentos se enseñan en la tarjeta del ciclo y en la compra opcional.

Los alimentos que marcas como favoritos o como "no me gusta" **no entran en ningún cálculo**: solo
ordenan y filtran el menú, la compra y las equivalencias, así que cambiarlos no mueve tus calorías
ni invalida el ajuste manual que tuvieras guardado. La única excepción es la lista de "prioriza
esto" de la tarjeta del ciclo, que tampoco es un número: no puede recomendarte algo que acabas de
marcar como que no te gusta.

**Lo que cuentas de tus comidas (v1.3)** entra por otra puerta y tampoco toca ningún número del plan: un
modelo de Claude, detrás de nuestro servicio, convierte el texto en comidas, gustos y costumbres, y a
partir de ahí manda un algoritmo del navegador, puro y determinista, que ajusta los gramos dentro de unos
límites (nunca menos de la mitad ni mucho más del doble de lo que comes) y monta los huecos que falten con
el generador de menús de siempre. Lo único que no es determinista es la interpretación del texto; por eso
cada alimento se puede corregir a mano y el bloque dice, con esas palabras, que lo ha leído un modelo.

Todo lo demás es determinista: los mismos datos dan siempre el mismo plan, sin `Math.random` en ninguna
parte. Hay cortes de seguridad —menores de 18 y mayores de 75, embarazo y lactancia, condición
renal o hepática— en los que la aplicación deriva a un profesional en vez de dar un plan.

## Documentación

| Documento | Qué contiene |
| --- | --- |
| [`docs/SPEC-calculo.md`](docs/SPEC-calculo.md) | Los diecinueve pasos del motor (el 18 es el ajuste manual y el 19, los consejos del ciclo), las tablas, los avisos y los diecinueve vectores de prueba. |
| [`docs/SPEC-ux-comidas-pdf.md`](docs/SPEC-ux-comidas-pdf.md) | El cuestionario, la pantalla de resultados, el panel de ajuste, la proyección y el seguimiento, el generador de menús, la lista de la compra y el PDF. |
| [`docs/SPEC-dieta-propia.md`](docs/SPEC-dieta-propia.md) | La v1.3: el servicio `api/`, cómo se interpreta lo que cuentas, el algoritmo que compone el día alrededor de tus comidas, la pantalla, la compra y el PDF. |
| [`docs/CONTRATO.md`](docs/CONTRATO.md) | La API entre módulos: `Inputs`, `Resultado`, `Ejemplos`, `ListaCompra`, `DatosPdf` y `DiaCompuesto`. |
| [`docs/DESIGN-brief.md`](docs/DESIGN-brief.md) | Identidad visual: paleta, tipografía, tono y reglas de composición. |
| [`docs/verify-vectors.mjs`](docs/verify-vectors.mjs) | Implementación de referencia de la spec de cálculo, independiente del código de la app. |

## Estructura

```
src/
  engine/      Motor de cálculo puro (SPEC-calculo.md). Sin React, sin DOM.
  meals/       Generador de menús de ejemplo, lista de la compra y composición del día (meals/dieta).
  pdf/         Documento PDF del plan (@react-pdf/renderer).
  data/        Base de alimentos (foods.json) y formatos de compra de Mercadona.
  dieta/       Cliente del servicio, almacén local y dictado del navegador (v1.3).
  components/  Cuestionario por pasos, pantalla de resultados y controles.
  styles/      Variables de diseño y hojas de estilo.
api/           Servicio HTTP de la v1.3 (Node 24, @anthropic-ai/sdk, zod). Su propio package.json y sus tests.
docker/        Configuración de nginx para la imagen de producción (incluido el proxy a /api/).
docs/          Especificaciones y verificador de vectores.
scripts/       Utilidades de desarrollo (generar PDF de muestra sin navegador).
```

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo de Vite con recarga en caliente. |
| `npm run build` | Comprobación de tipos y build de producción en `dist/`. |
| `npm run preview` | Sirve `dist/` para revisar el build. |
| `npm test` | Suite de Vitest: motor, menús, lista de la compra, PDF y accesibilidad. |
| `npm run lint` | ESLint sobre todo el proyecto. |
| `npm run typecheck` | `tsc -b --noEmit` sin generar nada. |
| `node docs/verify-vectors.mjs` | Verifica los diecinueve vectores de la §5 y un barrido de invariantes contra la implementación de referencia. |
| `node scripts/pdf-sample.mjs [carpeta]` | Genera los PDF de muestra sin abrir el navegador (incluidos los dos de "Tu menú, con lo tuyo dentro"). |
| `npm run api` | Arranca el servicio de la v1.3 en el puerto 8787 (lee `api/.env` si existe). Vite ya hace de proxy de `/api`. |
| `npm run test:api` | Tests del servicio. Ninguno toca la red: el cliente de Anthropic se inyecta. |
| `npm run typecheck:api` | Comprobación de tipos del servicio. |

Requisitos: Node.js 20 o superior y npm para la aplicación; **Node.js 24** para el servicio `api/`, que
ejecuta TypeScript sin build con el soporte nativo de Node. `npm install` y a correr. Sin
`ANTHROPIC_API_KEY` todo funciona igual salvo "Cuéntanos cómo comes", que se muestra como no disponible.

## Despliegue

Son **dos servicios** en la misma `docker-compose.yml`: `web` (el build estático servido por nginx, que
además hace de proxy de `/api/`) y `bascula-api` (el servicio de la v1.3). Solo `web` está en la red
externa `dokploy-network`; `bascula-api` vive en una red interna, sin puertos publicados, y es
inalcanzable desde fuera:

```bash
docker build -t bascula .
docker run --rm -p 8080:80 bascula      # solo la aplicación, sin "Cuéntanos cómo comes"
docker compose up --build               # los dos servicios, como en producción
```

En producción se despliega con **Dokploy** sobre el VPS de RS Agents usando el `docker-compose.yml` del
repositorio, y queda publicado en **https://bascula.rsagents.es**.

**Antes del primer despliegue de la v1.3** hay que poner `ANTHROPIC_API_KEY` en la pestaña *Environment*
del compose en Dokploy: es la única variable obligatoria y **nunca viaja al navegador** (la lee solo el
contenedor `bascula-api`, en tiempo de ejecución). Sin ella el sitio funciona igual y la tarjeta de
"Cuéntanos cómo comes" dice que la función no está disponible. Opcionales, con su valor por defecto:
`BASCULA_MODELO` (`claude-sonnet-5`), `BASCULA_TOPE_EUROS_DIA` (`4`), `BASCULA_TOPE_GLOBAL_DIA` (`400`),
`BASCULA_TOPE_IP_DIA` (`40`), `BASCULA_ORIGENES` (`https://bascula.rsagents.es`) y `BASCULA_SECRETO`.
Comprobación rápida tras desplegar: `GET /api/salud` devuelve `{ "ok": true }` y `GET /api/capacidades`,
`"interpretar": true`.

## Aviso

Báscula ofrece una orientación nutricional general basada en evidencia científica; no es consejo
médico ni un plan personalizado por un profesional sanitario. Los resultados son estimaciones y
cada cuerpo responde de forma distinta. Si tienes una condición médica, tomas medicación, estás
embarazada o en periodo de lactancia, o tienes antecedentes de trastornos de la conducta
alimentaria, consulta con un/a médico o dietista-nutricionista colegiado/a antes de seguir estas
recomendaciones.

Si la comida o el peso te generan ansiedad, puedes hablar gratis con ADANER (adaner.org) o con tu
centro de salud.

---

Una herramienta de RS Agents.
