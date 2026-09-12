# Contrato entre módulos — Báscula

Todos los módulos comparten los tipos de `src/engine/types.ts` (fuente única de verdad en el repo, alineada
con `docs/SPEC-calculo.md` §0.3 "Tipos TypeScript de referencia" y "Salida (`Resultado`)").
**No cambies las firmas exportadas** de los tres puntos de entrada sin avisar: la UI las consume tal cual.

## Motor de cálculo — `src/engine/index.ts`

```ts
export type * from './types'
export function calcular(inputs: Inputs): Resultado                                // SPEC §2, pasos 0-17 + 19
export function textosAvisos(resultado: Resultado, inputs: Inputs): AvisoTexto[]   // SPEC §4, placeholders sustituidos, warn antes que info
export function textoError(codigo: string, inputs?: Inputs): AvisoTexto            // SPEC §4 (EXCL_* y ERR_INPUT_RANGO)
export function ajustarMacros(resultado: Resultado, ajuste: AjusteMacros): Resultado  // v1.1, SPEC Paso 18
```

**v1.2: no se exporta nada nuevo del motor.** Las cuatro firmas de arriba no cambian. Lo único que crece
es la forma de `InputCalculo` (cuatro campos opcionales) y la de `Resultado` (un campo opcional), y los
pasos 6.7ter, 13, 14 y 19 viven dentro de `calcular`. `textosAvisos` gana tres códigos
(`INFO_RITMO_POR_PLAZO`, `WARN_PLAZO_IRREAL`, `INFO_PROYECCION_RECOMP`) con sus placeholders, y
`ajustarMacros` no necesita ningún dato nuevo: rehace el paso 14 como siempre, y la rama de recomposición
sale sola de `R.tdee.valor`, `R.peso_objetivo.efectivo` y las kcal ajustadas.

**`ajustarMacros` (v1.1).** Es el panel "Ajusta tus macros" de `SPEC-ux-comidas-pdf.md` §2.2b. Pura, determinista y **sin `Inputs`**: todo lo que necesita viaja en `Resultado.limites_ajuste`, que `calcular` rellena siempre (salvo con `'tca' ∈ condiciones`, donde queda `undefined` y `ajustarMacros` devuelve el `Resultado` tal cual). Nunca toca la proteína ni el peso objetivo; rehace la grasa, la fibra, el reparto por comidas, el cronograma y la proyección. Es **idempotente respecto al origen** —no lee `macros.grasa_g` ni `macros.hc_g` del resultado que recibe, sino los valores recomendados de `limites_ajuste`—, así que `ajustarMacros(ajustarMacros(R, a₁), a₂) === ajustarMacros(R, a₂)` y `ajustarMacros(R, {})` devuelve el plan recomendado bit a bit **en todo lo que son números** (kcal, macros, fibra, agua, peso objetivo, comidas, cronograma, proyección y `limites_ajuste`). La única salvedad es el **orden** de `avisos`: un aviso que un ajuste retira y el siguiente vuelve a emitir queda al final del array. Como la §4 declara que el orden no es significativo, la igualdad de `avisos` se comprueba **como conjunto**, no elemento a elemento. Por eso la UI guarda en `localStorage` **solo el ajuste** (`bascula:ajuste:v1`), no el `Resultado` ajustado.

- TypeScript puro, sin React ni dependencias. Determinista (mismos inputs → misma salida).
- `Inputs` es un alias de `InputCalculo` y `Salida` un alias de `Resultado`: existen para no romper el código
  que ya los importaba, pero el nombre canónico es el de la spec.
- La **implementación de referencia ejecutable** es `docs/verify-vectors.mjs`. Reproduce la spec paso a paso,
  imprime los 19 vectores de la §5 y ejecuta un barrido de 112 380 perfiles contra 40 familias de invariantes
  de seguridad; debe terminar con 0 violaciones. Los tests del motor (`src/engine/__tests__/vectors.test.ts`)
  comparan contra los números publicados en la §5, y `node docs/verify-vectors.mjs --json 1` devuelve el
  `Resultado` completo del Caso 1 (es exactamente el `RESULTADO_EJEMPLO` del stub actual).

### Errores y exclusiones: `excluido` sustituye al antiguo `{ ok: false }`

`calcular` **siempre** devuelve un `Resultado`. No hay unión `Resultado | ErrorCalculo` ni campo `ok`:

- Si el plan se ha podido calcular, `excluido` es `undefined` y todos los campos numéricos son válidos.
- Si no, `excluido` lleva uno de `EXCL_EDAD`, `EXCL_EMBARAZO_LACTANCIA`, `EXCL_IMC_MUY_BAJO`,
  `EXCL_TCA_RIESGO` o `ERR_INPUT_RANGO`, y **la UI no debe leer ni mostrar ningún otro campo**: el motor no
  calcula "por si acaso" y no debe poder verse un resultado parcial (SPEC Paso 0).
- La validación de rangos de la §1 se devuelve como
  `{ excluido: 'ERR_INPUT_RANGO', errores: ['peso_kg', 'grasa.cadera_cm', ...] }`. El campo opcional
  `errores?: string[]` existe tanto en la spec (`Resultado`) como en `types.ts`, y lleva los nombres de los
  campos del formulario que hay que marcar.
- Excepción única de la edad: entre 0 y 120 años el motor se ejecuta y es el paso 0 quien devuelve
  `EXCL_EDAD` si está fuera de 18–75, para dar el copy compasivo de derivación en vez de un error seco.

### Cambios de forma respecto a la v0 del contrato

- **Un solo reparto por comidas.** Fuera `reparto_entreno`, `reparto_descanso` y `comidas_peri`: el motor
  devuelve un único array `comidas`, y cada `Comida` lleva `{ nombre, hora, pct_kcal, proteina_g, grasa_g,
  hc_g, kcal, peri }`. `peri` es `true` como mucho en una comida (SPEC Paso 16).
- `Comida.hora` es la hora nominal fija de la **tabla 3.13** de `SPEC-calculo.md` (Desayuno 08:00 ·
  Media mañana 11:00 · Comida 14:00 · Merienda 17:30 · Cena 21:00 · Recena 23:00). No depende de ninguna
  respuesta del usuario y no entra en ningún cálculo. (Las referencias del contrato anterior a §1.1, §2.16,
  §3.10 y a los Anexos A/B ya no existen: todo vive en los pasos 0-17 y en las tablas 3.x.)
- Los macros van agrupados en `macros` (`proteina_g`, `grasa_g`, `hc_g`, `fibra_g`,
  `azucares_libres_max_g`, `pct`, `gkg`, `base_proteina`, `base_kg`, `somatotipo`, `pct_cap`), y las calorías en
  `kcal` (objetivo) y `kcal_cierre` (suma real de los macros, hasta 10 kcal de diferencia por el redondeo a 5 g).
- `agua` es `null` con condición `renal` o `cardiaca`: en ese caso **no se muestra ningún objetivo de
  hidratación**, solo el texto de `INFO_AGUA_NO_PRESCRITA` (SPEC Paso 12).
- `peso_objetivo.mostrar_central: boolean`. Cuando es `false` la pantalla y el PDF muestran solo la franja
  (`rango`), sin número grande. `peso_objetivo.referencias.clasicas` es `null` fuera de 150–200 cm de altura.
- `cronograma` añade `precision_fecha: 'dia' | 'mes'` y `tramo_12sem: [number, number] | null`: con `'mes'`
  no se imprimen fechas exactas y el bloque principal es el primer tramo de 12 semanas (SPEC Paso 14).
- `ffmi.categoria` es `null` cuando la banda de grasa es `alto` o `muy_alto` (SPEC Paso 15).
- `Condicion` se amplía a `diabetes | renal | hepatica | tca | cardiaca | hipertension | tiroides |
  bariatrica | glp1 | otra`, y `InputCalculo` gana `cribado_tca: 'positivo' | 'evitado' | 'negativo' | null`.
  **Desde la v1.1 la UI escribe siempre `null`** (el paso 5b del wizard ya no existe) y las reglas de
  `'tca'` del motor son *reglas no expuestas* (`SPEC-calculo.md` §1.1): siguen siendo normativas y con
  vectores, pero la interfaz no puede activarlas. `'tca'` no se serializa nunca en el informe ni en el PDF.
- `AvisoTexto.titulo`: etiqueta corta (3-6 palabras) para el encabezado de la tarjeta de aviso en la UI.
- **Ronda de cierre.** `Resultado` gana dos campos que solo existen para que los textos de la §4 digan
  el número que de verdad se aplicó: `macros.pct_cap` (la fracción de kcal del cap de proteína del
  paso 8, que no puede deducirse de `kcal` porque los pasos 9 y 10 la suben después) y
  `objetivo_propuesto` (el objetivo que resolvió la regla 6.1 con `objetivo === 'no_se'`, que los
  pasos 6.3, 6.4, 7 y 10bis pueden reescribir). Los dos son aditivos: nadie más tiene que leerlos.

## Generador de ejemplos de comidas — `src/meals/index.ts`

```ts
export function generarEjemplos(inputs: Inputs, resultado: Resultado, variante?: number): Ejemplos
export function generarListaCompra(ejemplos: Ejemplos, inputs: Inputs): ListaCompra
```

- `variante` (opcional, 0 por defecto) es el "Ver otro ejemplo" de `SPEC-ux-comidas-pdf.md` §2.5:
  desplaza el índice de arranque de la rotación de plantillas. Sigue siendo determinista.
- `Ejemplos` incluye `equivalencias` (§2.5 y §4.4): las tres tablas —isoproteica, isoglucídica e
  isolipídica— ya filtradas por `preferencia_efectiva` y con la guarda de ración de §3.3. La
  pantalla y el PDF las pintan tal cual; no las recalculan.

- Usa `src/data/foods.json` (copiado de `docs/foods.json`, **107** alimentos con el esquema de
  `SPEC-ux-comidas-pdf.md` §3.0: los 101 del plan más los 6 con tag `extra` —4 de la tarjeta del ciclo de la v1.2 y 2 de las comidas dictadas de la v1.3—, que no entran en ningún menú) y las plantillas/algoritmo de `docs/SPEC-ux-comidas-pdf.md` §3.
- Recorre `resultado.comidas` (un único array) y devuelve un `EjemploComida` por toma, cuyo campo `comida`
  es el `nombre` de `resultado.comidas[i]`. Tolerancia normativa (la misma que `SPEC-ux-comidas-pdf.md`
  §3.3, y la única que comprueban los tests): `totales.kcal` dentro de ±10 % de `objetivo.kcal`, y
  `totales.proteina_g` dentro del umbral terminal de ±15 % de `objetivo.proteina_g`. **No hay tolerancia
  normativa por macro para carbohidrato ni grasa**: los propios vectores de §3.6 se salen (cena del ejemplo
  B, +19,6 % de hidrato) porque el algoritmo cierra sobre kcal y proteína, no macro a macro. El contrato
  mantiene `entreno` y `descanso` en `Ejemplos`, pero en la v1 ambos salen del mismo reparto.
- Recibe el `Resultado` completo, así que tiene acceso a `resultado.macros.fibra_g` (`fibra_objetivo` de
  la comprobación de fibra de §3.3) y a `resultado.preferencia_efectiva`.
- Recibe también `inputs.condiciones` y `inputs.peso_kg`, que **viven en `InputCalculo`, no en `Resultado`**
  (por eso `generarEjemplos` recibe los dos objetos). La lista de condiciones es la **cruda** del usuario,
  nunca la normalizada del Paso 0: así `'tca'` no llega a este módulo ni puede serializarse desde él.
  Con `renal` o `hepatica` **no genera menú** (`foods.json` no tiene potasio, fósforo ni sodio) y la UI
  muestra el texto de derivación de §3.1.
- **v1.1 — filtro de alimentos combinable (lo único nuevo en `src/meals`).** El banco de plantillas lo
  sigue eligiendo `resultado.preferencia_efectiva`, pero el filtro de cada `FoodQuery` pasa a ser la
  **conjunción** de la base y de todas las restricciones: `pasaBase(a, resultado.preferencia_base) &&
  resultado.restricciones.every(r => pasaRestriccion(a, r))` (`SPEC-ux-comidas-pdf.md` §3.2). Los tres
  campos son opcionales en `Resultado`; si faltan, se deducen de `preferencia_efectiva` con la regla de
  traducción de `SPEC-calculo.md` §1.1. `src/meals/filtros.ts` gana `pasaRestricciones`; **no cambia
  ninguna firma exportada de `src/meals/index.ts`**, y el banco sencillo aplica la regla de sustitución
  por variantes `_sl`, de filtrado y de relleno de §3.7.2. Ningún fallback relaja jamás una restricción.
- Respeta **`resultado.preferencia_efectiva`**, no `inputs.preferencia` (seis bancos: omnívoro,
  vegetariano, vegano, sin lactosa, sin gluten, low-carb) y marca la toma peri-entreno con
  `resultado.comidas[i].peri`. Con `diabetes` + `low_carb` el motor ya ha anulado el low-carb (paso 6.8):
  usar la preferencia cruda seleccionaría el banco LCB-* para un plan de 330 g de hidrato al día y ninguna
  plantilla cerraría dentro del ±10 % de kcal. Test: con esa combinación el banco elegido es el omnívoro.
- Orden de sacrificio del cierre de kcal, literal como en el Paso 10 del motor: **grasa → proteína → subir
  kcal**. La fuente de verdad energética de cada alimento es su campo `kcal`, no 4/4/9.
- Puede emitir dos avisos propios que **no** están en la tabla §4 del motor: `WARN_MENU_PROTEINA_VEGETAL` y
  la nota de fibra (§3.3). Se listan junto al resto.
- Determinista para los mismos inputs (sin `Math.random`): si se quiere variedad, elegir plantilla por un
  índice derivado de los inputs (p. ej. `n_comidas + edad`), nunca aleatorio.
- Tests en `src/meals/__tests__/`; las tres tablas de `SPEC-ux-comidas-pdf.md` §3.6 son vectores de prueba.

### Modo sencillo y lista de la compra (`SPEC-ux-comidas-pdf.md` §3.7)

Campos **nuevos y todos opcionales**: nada de lo anterior cambia de forma y la UI que no los lea sigue funcionando igual.

- `InputCalculo.menu_sencillo?: boolean` (paso 13 del wizard, `false` por defecto). **El motor lo ignora por completo**: no entra en kcal, macros, agua, peso objetivo ni cronograma, y dos usuarios idénticos salvo este campo reciben el mismo `Resultado`. Solo lo lee `src/meals`, que con `true` usa el banco sencillo: ≤ 12 alimentos distintos en la semana y dos variantes por rol de comida que se alternan por día par/impar, siempre dentro de la preferencia dietética y con el mismo algoritmo de escalado y las mismas tolerancias de §3.3.
- `Ejemplos.compra?: ListaCompra` y `Ejemplos.modo_sencillo?: boolean`. `generarEjemplos` rellena los dos; `compra` queda `undefined` cuando no hay menú (`renal` o `hepatica`).
- `Ejemplos.preferencia_efectiva?: Preferencia`: la preferencia con la que se construyó el menú, que **no tiene por qué ser `Inputs.preferencia`** (el Paso 6.8 del motor anula el low-carb con `diabetes`). La escribe `generarEjemplos` para que `generarListaCompra` no tenga que deducirla de los alimentos del día. Opcional: un `Ejemplos` construido a mano puede no traerla, y entonces se deduce por mayoría de ids.
- `EjemploComida.platos?: number`: número de platos en que se sirve una toma que no cabe en uno solo (§3.3). Ausente cuando es 1. `alimentos` viene **agrupado por alimento**, así que sus gramos son los de la toma entera: quien compruebe los límites de ración de §3.3 tiene que dividirlos entre `platos`. La pantalla y el PDF no necesitan leerlo (la nota de §3.6 ya lo dice en palabras).
- Tipos nuevos en `src/engine/types.ts`: `SeccionSuper`, `Conservacion`, `ItemCompra` y `ListaCompra`. `ListaCompra.supermercado` es el literal `'Mercadona'` y `dias`, el literal `7`.
- `generarListaCompra(ejemplos, inputs)` se exporta desde `src/meals/index.ts` y devuelve exactamente lo que `generarEjemplos` deja en `Ejemplos.compra`. Es pura y determinista (mismo `Ejemplos` e `Inputs` → misma lista, incluido el orden de `items`) y recibe `inputs` porque en modo sencillo reconstruye internamente el día B para ponderar los gramos de los dos días.
- Fórmulas normativas (§3.7.3): `gramos_semana = round(7 · g_A)` en modo normal y `round(4 · g_A + 3 · g_B)` en modo sencillo —el calendario real de §3.7.2, no la media de los dos días—; `gramos_dia = round1(gramos_semana / 7)`; `envases = ceil(gramos_semana / envase_g)`; `dura_dias = min(floor(envases · envase_g / gramos_dia), conservacion_dias)`. La línea lleva el consejo fijo de compra en dos veces cuando `conservacion === 'fresco'`, la duración bruta pasa de `conservacion_dias` **y además se compran dos envases o más**.
- Texto de las dos celdas de cantidad y del rótulo del modo sencillo: `textoCantidadSemana`, `textoCantidadDia` y `textoModoSencillo`, exportados desde `src/meals/compra.ts`. **Los usan la pantalla y el PDF**, que así imprimen exactamente la misma cadena (§4.4b: "las mismas cuatro columnas de §2.5b"); `src/components/resultados/compra.ts` los reexporta para la UI.
- Datos: `src/data/mercadona.json`, **una fila por cada alimento de `foods.json`** (las 107, incluidos los `extra`) (cobertura total validada en `src/data/__tests__/mercadona.test.ts`), con el tipado y el índice en `src/data/mercadona.ts` (`MERCADONA`, `formatoCompra`, `ORDEN_SECCIONES`, `NOMBRE_SECCION`). **Sin precios**, por decisión: varían por tienda y por semana y envejecen mal en un PDF descargado. `envase_g` está expresado **en la misma base en la que `foods.json` mide el alimento** (crudo, cocido, escurrido o peso comestible), para que las fórmulas de arriba se apliquen sin conversiones.
- Presentación: la UI la pinta en §2.5b (tabla por sección, debajo de los menús) y el PDF en su propia página, §4.4b, justo después de los menús. Ninguno de los dos recalcula gramos ni envases.

## Exportador PDF — `src/pdf/index.ts`

```ts
export async function generarPdfBlob(datos: DatosPdf): Promise<Blob>
export function nombreFicheroPdf(datos: DatosPdf): string
```

- Implementado con `@react-pdf/renderer` (ya instalado, v4). El documento React vive en `src/pdf/PlanDocument.tsx`.
- La UI hace `const mod = await import('../pdf')` (carga diferida) y descarga el Blob con un `<a download>` creado al vuelo
  (`URL.createObjectURL`), revocando la URL después. En iOS Safari, si `download` no funciona, abrir el Blob en una pestaña nueva.
- Estructura del PDF: `docs/SPEC-ux-comidas-pdf.md` §4. Fuentes: Helvetica (estándar) para no depender de red; acentos y
  «ñ» funcionan con Helvetica (WinAnsi). Colores de macros iguales a los de la UI (ver `docs/DESIGN-brief.md`).
- Reglas de presentación que el PDF comparte con la pantalla y **no** puede recalcular por su cuenta:
  `agua === null` ⇒ ningún número de hidratación; `peso_objetivo.mostrar_central === false` ⇒ solo la franja;
  `cronograma.precision_fecha === 'mes'` ⇒ mes y año, y primer tramo de 12 semanas.
- Para probar sin navegador: `renderToFile` de `@react-pdf/renderer` desde un script node (`scripts/pdf-sample.mjs`) con
  datos de muestra; el fichero resultante se puede abrir con la herramienta Read para inspeccionarlo.

## UI — `src/App.tsx`, `src/components/**`, `src/styles/**`

- Consume `calcular`, `textosAvisos`, `textoError` (motor), `generarEjemplos` (comidas) y `generarPdfBlob` (PDF, carga diferida).
- Comprueba `resultado.excluido` **antes** de leer cualquier otro campo y, si existe, muestra únicamente el texto de
  `textoError(resultado.excluido)` (más `resultado.errores` si es `ERR_INPUT_RANGO`).
- No implementa ninguna fórmula: si un número no viene del motor, no se muestra.
- Guarda las respuestas del cuestionario en `localStorage` (clave `bascula:inputs:v1`) y las restaura al cargar.
  `cribado_tca` y `'tca'` no se persisten ni se serializan en el PDF. Un borrador de la v1.0 que solo tenga
  `preferencia` se restaura aplicando la **regla de traducción** de `SPEC-calculo.md` §1.1.
- **v1.1.** Dos claves más, las dos solo de este dispositivo y ninguna con datos identificativos:
  `bascula:ajuste:v1` con `{ kcal?: number, hc_g?: number }` (el ajuste manual, nunca el `Resultado`
  ajustado: se recalcula con `ajustarMacros`) y `bascula:pesajes:v1` con `Pesaje[]` (el seguimiento de
  §2.6c, que viaja al PDF en `DatosPdf.pesajes`). El ajuste se descarta cuando el usuario recalcula con
  datos distintos: los límites del plan nuevo no tienen por qué parecerse a los del anterior.
- **Cómo se sabe que los datos son "los mismos".** La UI guarda además su propia clave de navegación,
  `bascula:sesion:v1`, con el paso en el que estaba el usuario y una **huella** (`firmaPlan`) de los
  `InputCalculo` del último plan. Al recalcular, el ajuste guardado solo se restaura si la huella coincide;
  si no, se borra. Escribir el paso actual **no puede** perder esa huella: el wizard guarda su paso nada más
  montarse, y si esa escritura la borrase, "Editar tus datos" o una simple recarga tirarían un ajuste válido.
- **Arranque del plan.** El borrador guarda también `fecha_inicio` (y el peso con el que se fijó). No se
  pregunta: se ancla la primera vez que se pide el plan y solo se renueva cuando el usuario dice otro peso.
  Si se recalculara a hoy en cada visita, la semana 0 de la proyección se movería cada día, los pesajes de
  §2.6c quedarían "antes del principio" y la huella del plan cambiaría sola.
- Flujo y copy: `docs/SPEC-ux-comidas-pdf.md` §1-2. Diseño: `docs/DESIGN-brief.md`.

## Campos nuevos de la v1.3 (todos opcionales, nada rompe)

La v1.3 ("Cuéntanos cómo comes", `docs/SPEC-dieta-propia.md`) añade un servicio HTTP propio y un día
compuesto alrededor de lo que la persona dicta o escribe. **Ningún campo existente cambia de forma ni de
tipo** y el código que no lea los nuevos sigue funcionando igual.

**Regla que manda sobre todo lo demás: el motor no lee nada de esto.** `calcular` no recibe el texto, ni
la interpretación, ni el día compuesto: kcal, macros, agua, reparto por comidas, cronograma y proyección
son exactamente los mismos con dieta propia y sin ella (la invariante S33 del barrido se extiende a estos
campos). `firmaDeInputs` **tampoco cambia**: los gustos dictados entran en `alimentos_excluidos` y
`alimentos_favoritos`, que ya estaban fuera de la huella, así que el ajuste manual guardado y los pesajes
sobreviven a una interpretación.

### Tipos (`src/engine/types.ts`, sección "v1.3")

| Tipo | Quién lo escribe | Quién lo lee |
|---|---|---|
| `DietaInterpretada` (con `ComidaPropia`, `AlimentoPropio`, `MacrosPropio`, `GustoPropio`, `HabitoPropio`, `EstadoAlimentoPropio`, `GrupoAprox`, `TipoHabito`) | el servicio `api/` (Claude), ya post-validado (§3.5); las correcciones por fila, la UI | `src/meals/dieta` y la UI |
| `DiaCompuesto` (con `ComidaCompuesta`, `AlimentoAjustado`, `ModoComposicion`, `OrigenComida`) | `componerDia` en el navegador | la UI (§5.4), la compra (§6.1) y el PDF (§6.2) |
| `PropuestaIA` (con `PreguntaIA`) y `RespuestaIA` | el servicio `api/` (Claude) en `POST /api/dieta/proponer`, ya post-validado; las respuestas las escribe la UI | `componerDia` (que cuadra los gramos), la UI (§4bis.5) y la persistencia |
| `DatosPdf.dieta_propia?: DiaCompuesto` | la UI | **solo el PDF** |

**Decisión L (§4bis), toda en campos opcionales.** `OrigenComida` gana un tercer valor, `'propuesta_ia'`:
una comida que ha elegido el modelo y cuyos gramos ha cuadrado el algoritmo. Por dentro es como una
comida `'propia'` —`alimentos: AlimentoAjustado[]` y `ejemplo: null`—, así que **quien ya leía
`origen === 'propia'` para decidir si pinta alimentos o un `ejemplo` tiene que leer ahora
`origen !== 'propuesta'`**; es el único punto en el que la decisión L toca código existente. `DiaCompuesto`
gana `preguntas?: PreguntaIA[]`, `consejo_ia?: string | null` y `origen_huecos?: 'ia' | 'plantillas' |
'mixto' | null`, los tres ausentes cuando los huecos se montan con plantillas. En el PDF (§4bis.5): las
comidas `propuesta_ia` se imprimen como las `propia` con la etiqueta **"propuesta IA"**, `consejo_ia` va
como nota —una sola vez: si además llega el aviso `DIETA_CONSEJO_IA` con el mismo texto, el PDF lo
descarta— y las **preguntas no se imprimen**.

`MacrosPropio` extiende `Macros` con `fibra` y `alcohol` (g por 100 g en `macros_100g`; gramos absolutos
en `aporte` y en los totales). Las kcal de un alimento salen siempre de `macros_100g.kcal`, nunca de
4/4/9, igual que en el resto del generador (§3.0).

### Cuatro funciones nuevas, exportadas desde `src/meals/index.ts`

```ts
export function generarComidas(inputs: Inputs, resultado: Resultado, huecos: Comida[], variante?: number, sinHidratos?: boolean[]): EjemploComida[]
export function componerDia(interpretada: DietaInterpretada, inputs: Inputs, resultado: Resultado, variante?: number, propuesta?: PropuestaIA): DiaCompuesto
export function huecosParaProponer(interpretada: DietaInterpretada, inputs: Inputs, resultado: Resultado): { nombre: string; hora: string | null; peri: boolean; objetivo: Macros; sin_hidratos: boolean }[]
export function compraDeDia(compuesto: DiaCompuesto, opcionalCiclo?: SeccionOpcionalCompra): ListaCompra
```

- `generarComidas` monta **solo los huecos que se le pasan** (mismo `Comida` que `resultado.comidas`, con
  el objetivo ya repartido), con el mismo banco, el mismo perfil dietético y el mismo `offset` que
  `generarEjemplos`. Es el motor de menús de siempre, sin la envoltura del día entero.
- `componerDia` es **pura y determinista** (SPEC-dieta-propia §4): mismas entradas, mismo `DiaCompuesto`
  bit a bit. Conserva las comidas dictadas (ajustando los gramos solo si hace falta), monta los huecos que
  falten con `generarComidas` y emite los avisos de §4.4 en su orden de prioridad. **Con el quinto
  argumento `propuesta`** (§4bis.3) cada hueco lo llenan los alimentos del modelo y el solver de §4.2 les
  cuadra los gramos; el hueco que venga vacío o que tras el cuadre quede fuera del ±15 % en kcal o en
  proteína cae al generador de plantillas. Sin ese argumento se comporta exactamente como en la v1.3.0:
  **llamar a `componerDia` con cuatro argumentos sigue siendo válido y da el mismo resultado de siempre.**
- `huecosParaProponer` devuelve los huecos que hay que pedirle al modelo —los mismos que montaría
  `generarComidas`, con el objetivo ya repartido por §4.3.2 y con `sin_hidratos` hueco a hueco—, con la
  forma estructural de `HuecoPropuesta` (`src/dieta/api.ts`). De ahí salen el cuerpo de
  `POST /api/dieta/proponer` y la `huecos_clave` que decide si una propuesta guardada se puede reutilizar
  (`claveHuecos` en `src/dieta/almacen.ts`: nombres y objetivos **en cubos de 25 kcal y 5 g por macro**,
  sin hora ni `peri`; con una huella exacta, corregir un gramo de una comida dictada invalidaba la
  propuesta y pagaba otra llamada).
- `compraDeDia` devuelve una `ListaCompra` con la forma de siempre. Los alimentos dictados que no están en
  `foods.json` van con `alimento_id: 'propio:{slug}:{estado}'`, `envases: 0`, `envase_descripcion: ''` y
  `dura_dias: 0`: **la pantalla y el PDF imprimen "—"** en "Comprar" y en "Dura" (`textoComprar` /
  `textoDura` en `src/components/resultados/compra.ts`, `comprarTexto` / `duracionTexto` en
  `src/pdf/PlanDocument.tsx`). Con composición activa, la lista que se pasa a la pantalla y al PDF es la de
  esta función, no la de `generarListaCompra`.

### Persistencia (solo en el dispositivo)

- `bascula:dieta:v1` = `{ version: 1, texto, interpretada: DietaInterpretada, fecha: 'YYYY-MM-DD',
  activa: boolean, gustos_sumados: { excluidos: string[]; favoritos: string[] } }`. No depende de
  `firmaPlan`: con otro plan se vuelve a componer, porque `componerDia` es pura. "Empezar de cero" la
  borra; "Editar tus datos", no. `cargarDieta` tolera basura.
  **La misma clave y la misma versión en la v1.3.2** (§4bis.4): se le añade un campo **opcional**
  `propuesta?: { variante: number; huecos_clave: string; propuesta: PropuestaIA; respuestas: RespuestaIA[];
  cerradas?: string[] }` (`cerradas`: las preguntas que se cerraron con "Seguir así", para que no vuelvan).
  Lo guardado por la v1.3.0 y la v1.3.1 se sigue leyendo tal cual (sin `propuesta` se pide otra, o se
  montan los huecos con plantillas), y una `propuesta` ilegible se descarta sin tirar el resto de la
  dieta. `huecos_clave` que ya no coincide con los huecos de ahora ⇒ la propuesta **no** se reutiliza.
- `bascula:dieta:borrador:v1` = el texto del cuadro mientras se escribe (debounce de 500 ms). Se borra con
  "Empezar de cero" y al validar una interpretación.

### Servicio `api/` (contrato HTTP)

Node 24 con `@anthropic-ai/sdk` y `zod`, sin build (TypeScript de sintaxis borrable), detrás del mismo
nginx en `/api/*` y en una red interna: **la clave nunca llega al navegador**. Respuestas JSON UTF-8 con
`Cache-Control: no-store`; los errores son `{ "error": { "codigo": string, "mensaje": string } }`.

| Ruta | Entrada | Salida |
|---|---|---|
| `GET /api/salud` | — | `{ ok: true, version: '1.3.0' }` (es el `HEALTHCHECK`) |
| `GET /api/capacidades` | — | `{ interpretar: boolean, modelo: string \| null, token: string \| null }` |
| `POST /api/dieta/interpretar` | `{ texto: string (10–4 000), comidas_plan: string[] (2–6) }`, ≤ 16 KB, cabecera `X-Bascula-Token` | `DietaInterpretada` + `modelo: string` |
| `POST /api/dieta/proponer` (v1.3.2, §4bis.1) | `{ huecos: HuecoPropuesta[] (1–6), contexto: ContextoPropuesta }`, ≤ 32 KB, cabecera `X-Bascula-Token` | `{ comidas: ComidaPropia[] (una por hueco, en el mismo orden; alimentos vacío en el hueco que el modelo no supo montar), consejo: string \| null, preguntas: PreguntaIA[] (≤ 2), modelo: string }` |

`proponer` comparte con `interpretar` la lista blanca de modelos, el token efímero, la cuota por IP, la
global y el presupuesto en euros: **una propuesta cuenta como una interpretación**. Los alimentos que
devuelve pasan por la misma post-validación de §3.5 (macros del catálogo, unidad, estado y saneado), así
que el navegador recibe `ComidaPropia` de verdad y **los gramos definitivos los pone su propio algoritmo**,
nunca el modelo. Esa post-validación también **retira los excluidos por nombre**, no solo por `alimento_id`,
y **descarta lo que contradice la base o las restricciones** del perfil según los `tags` del catálogo. En el cuerpo viajan los huecos (nombre, hora, `peri`, objetivo y `sin_hidratos`), lo
dictado, los gustos, los hábitos, el perfil dietético, las condiciones `diabetes` / `cardiaca` /
`hipertension`, las respuestas a preguntas anteriores y la `variante`.

Códigos de error: `400 TEXTO_INVALIDO` (en `proponer`, `400 HUECOS_INVALIDOS`), `401 TOKEN_INVALIDO`,
`403 ORIGEN_NO_ADMITIDO`, `404 NO_EXISTE`, `405 METODO_NO_ADMITIDO`, `413 CUERPO_GRANDE`,
`415 TIPO_NO_ADMITIDO`, `422 SIN_CONTENIDO` (y `422 PROPUESTA_VACIA` en `proponer`, **solo cuando TODOS
los huecos quedan vacíos**), `429 CUOTA_IP` / `CUOTA_GLOBAL` /
`PRESUPUESTO`, `502 MODELO_NO_DISPONIBLE`, `503 SIN_CLAVE`, `504 TIEMPO_AGOTADO`. **No viaja ningún otro
dato del usuario** (ni sexo, ni edad, ni peso, ni objetivo, ni las kcal del plan) y el servidor no guarda ni registra el texto. Sin `ANTHROPIC_API_KEY`,
`capacidades` devuelve `interpretar: false` y la pantalla dice que la función no está disponible. El resto
—presupuesto en euros, cuotas por IP, token efímero, tiempos 90/75/60— está en `SPEC-dieta-propia.md` §2,
§3 y §7.

**Reparto del trabajo (cuatro agentes en paralelo).** Backend: `api/**`, `docker/**`, `docker-compose.yml`,
`Dockerfile`, `vite.config.ts` y los scripts de `package.json`. Comidas: `src/meals/dieta/**`, las tres
funciones de arriba y `src/data/**` (los dos alimentos `extra` de §3.6). UI: `src/dieta/**`, `src/App.tsx`,
`src/components/**` y `src/styles/dieta.css`. PDF: `src/pdf/**`, `scripts/pdf-sample.mjs`, la compra con
"—" y esta documentación. Las fronteras de carpeta son las de siempre.

## Campos nuevos de la v1.2 (todos opcionales, nada rompe)

`src/engine/types.ts` gana lo siguiente. **Ningún campo existente cambia de forma ni de tipo** y el código
que no lea los campos nuevos sigue funcionando igual.

| Dónde | Campo | Quién lo escribe | Quién lo lee |
|---|---|---|---|
| `InputCalculo` | `plazo_semanas?`, `sintomas_regla?` | la UI (wizard, pasos 12 y 3b) | el motor |
| `InputCalculo` | `alimentos_excluidos?`, `alimentos_favoritos?` | la UI (wizard, paso 14, y la acción "No me gusta" de §2.5) | **solo `src/meals`** |
| `Resultado` | `ciclo?: ResultadoCiclo` | el motor (paso 19) | la UI (§2.2c), el PDF (§4.3b) y `src/meals` (§3.8) |
| `Resultado` | `peso_objetivo.efectivo` **en recomposición** y `proyeccion` de recomposición | el motor (pasos 13 y 14) | la UI (§2.6/§2.6b) y el PDF (§4.5/§4.5b) |
| `Ejemplos` | `avisos_menu?`, `alimentos_ciclo?` | `src/meals` | la UI (§2.5 y §2.2c) y el PDF (§4.4 y §4.3b) |
| `ListaCompra` | `opcional_ciclo?: SeccionOpcionalCompra` | `src/meals` (§3.8.2) | la UI (§2.5b) y el PDF (§4.4b) |
| tipos nuevos | `SintomaRegla`, `ConsejoCiclo`, `ResultadoCiclo`, `AlimentoCiclo`, `SeccionOpcionalCompra` | — | — |
| `foods.json` | `nombre_corto` (obligatorio en los 107 alimentos) y el tag `extra` | los datos | la UI (chips del paso 14 y resumen de §2.5) y `src/meals` |

**Lo que el motor ignora (y por qué importa fuera de él).** `menu_sencillo`, `alimentos_excluidos` y
`alimentos_favoritos` **no entran en ningún cálculo** de `calcular`: dos usuarios idénticos salvo esos
tres campos reciben el mismo `Resultado` bit a bit (invariante S33 del barrido). De ahí salen dos
obligaciones para la UI:

1. **`firmaDeInputs` (`src/components/resultados/ajuste.ts`) tiene que ignorar exactamente esos tres
   campos.** Hoy es `JSON.stringify(inputs)`, así que marcar "no me gusta" en un alimento cambiaría la
   huella y tiraría el ajuste manual guardado (`bascula:ajuste:v1`) y el "Volver a mi plan" del arranque.
   La forma correcta es serializar el `InputCalculo` **sin** esas tres claves.
2. **La acción "No me gusta" del menú (§2.5) no vuelve a llamar a `calcular`.** Guarda el borrador y
   rellama a `generarEjemplos(inputs, resultado, variante)` y a `generarListaCompra(ejemplos, inputs)`
   con el **mismo** `Resultado`, que no puede haber cambiado.

**Generador de comidas (`src/meals`), v1.2.** No cambia ninguna firma exportada. Lo que cambia por dentro:

- `PerfilDietetico` gana `excluidos: ReadonlySet<string>` y `favoritos: readonly string[]` (en el orden
  del usuario), y `perfilDeResultado` / `perfilDeInputs` los rellenan desde `InputCalculo` —no desde
  `Resultado`, que no los publica—. `SPEC-ux-comidas-pdf.md` §3.2b tiene el orden exacto dentro de
  `candidatos()`: base y restricciones → filtros de la consulta → tag `extra` → **excluidos** →
  variantes `_sl` y lista blanca → favoritos primero.
- Los alimentos con tag `extra` **no entran en ninguna `FoodQuery`**, ni en las alternativas, ni en las
  tablas de equivalencias: solo en `Ejemplos.alimentos_ciclo` y en `ListaCompra.opcional_ciclo` (§3.8).
  Por eso los cuatro alimentos nuevos no cambian ni un menú de los que ya existen.
- Cuando una consulta obligatoria se queda sin candidatos por las exclusiones, se aplica el respaldo de
  siempre y, si aun así no hay nada, se usa el mejor candidato excluido y se avisa en
  `Ejemplos.avisos_menu`. **Ningún respaldo relaja jamás la base dietética ni una restricción.**
- Todo sigue siendo puro y determinista, sin `Math.random`.

**Reparto del trabajo (cuatro agentes en paralelo).** Motor: pasos 6.7ter, 13, 14 y 19 en `src/engine/**`,
más los tres textos nuevos de la §4 y los vectores 2, 16, 17, 18 y 19 de `src/engine/__tests__/`.
Comidas: `PerfilDietetico` con excluidos y favoritos, el respaldo con aviso, el banco sencillo y la §3.8
en `src/meals/**`. UI: pasos 11, 12 (con plazo), 14 (alimentos) y la subpregunta de síntomas del 3b, la
acción "No me gusta" con deshacer y resumen, la tarjeta del ciclo ampliada, la sección opcional de la
compra, el mensaje de fecha no válida de los pesajes y `firmaDeInputs`. PDF: filas nuevas de §4.2,
tarjeta §4.3b ampliada, resumen de alimentos en §4.4, sección opcional en §4.4b y el copy de §4.5b.
Las fronteras de carpeta son las de siempre.

## Reglas de convivencia (varios agentes en paralelo en el mismo repo)

- Cada agente toca solo su carpeta: motor → `src/engine/**`; comidas → `src/meals/**` y `src/data/**`; PDF → `src/pdf/**` y
  `scripts/**`; UI → `src/App.tsx`, `src/main.tsx`, `src/components/**`, `src/styles/**`, `src/index.css`, `index.html`, `public/**`.
- Nadie toca `package.json` salvo para añadir una dependencia imprescindible (anotarlo en el informe final).
- Para comprobar tipos: `npx tsc -p tsconfig.app.json --noEmit`. Para tests: `npx vitest run <ruta>`. Solo la UI arranca
  `vite` (puerto 5173) o `vite build`.
- Los stubs actuales de `src/engine/index.ts`, `src/meals/index.ts` y `src/pdf/index.ts` se sustituyen por completo, pero
  conservando los nombres y firmas exportados.

## Campos nuevos de la v1.1 (todos opcionales, nada rompe)

`src/engine/types.ts` gana lo siguiente. **Ningún campo existente cambia de forma ni de tipo**, `Ejemplos`
no cambia en absoluto y el código que no lea los campos nuevos sigue funcionando igual.

| Dónde | Campo | Quién lo escribe | Quién lo lee |
|---|---|---|---|
| `InputCalculo` | `recomposicion_prioridad?`, `menstruacion?`, `preferencia_base?`, `restricciones?`, `low_carb?` | la UI (wizard, pasos 3b, 10 y 13) | el motor |
| `Resultado` | `preferencia_base?`, `restricciones?`, `low_carb?` | el motor (paso 6.8) | `src/meals` (filtro), el PDF (§4.2) |
| `Resultado` | `recomposicion_prioridad?` | el motor (paso 7) | el PDF (§4.2) |
| `Resultado` | `proyeccion?: PuntoProyeccion[]` | el motor (paso 14b) | la UI (§2.6b, §2.6c) y el PDF (§4.5b) |
| `Resultado` | `limites_ajuste?: LimitesAjuste` | el motor (paso 18) | `ajustarMacros` y el panel de §2.2b |
| `Resultado` | `ajuste?: { kcal, hc }` | **solo `ajustarMacros`** | la UI y el PDF (marca "ajustado por ti") |
| tipos nuevos | `PreferenciaBase`, `Restriccion`, `RecomposicionPrioridad`, `Menstruacion`, `PuntoProyeccion`, `AjusteMacros`, `LimitesAjuste`, `Pesaje` | — | — |
| `DatosPdf` | `pesajes?: Pesaje[]` | la UI (desde `localStorage`) | el PDF (§4.5b) |

**Reparto del trabajo (cuatro agentes en paralelo).** Motor: pasos 6.7bis, 7, 9, 14b, 17, 18 y `ajustarMacros`
en `src/engine/**`. Comidas: solo el filtro combinable y el banco sencillo en `src/meals/**`. UI: pasos 3b,
10 y 13 del wizard, panel §2.2b, tarjeta §2.2c y bloques §2.6b/§2.6c en `src/components/**`. PDF: marca de
plan ajustado, tarjeta §4.3b y página §4.5b en `src/pdf/**`. Las fronteras de carpeta son las de siempre.
