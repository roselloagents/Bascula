# Contrato entre módulos — Báscula

Todos los módulos comparten los tipos de `src/engine/types.ts` (fuente única de verdad en el repo, alineada
con `docs/SPEC-calculo.md` §0.3 "Tipos TypeScript de referencia" y "Salida (`Resultado`)").
**No cambies las firmas exportadas** de los tres puntos de entrada sin avisar: la UI las consume tal cual.

## Motor de cálculo — `src/engine/index.ts`

```ts
export type * from './types'
export function calcular(inputs: Inputs): Resultado                                // SPEC §2, pasos 0-17
export function textosAvisos(resultado: Resultado, inputs: Inputs): AvisoTexto[]   // SPEC §4, placeholders sustituidos, warn antes que info
export function textoError(codigo: string, inputs?: Inputs): AvisoTexto            // SPEC §4 (EXCL_* y ERR_INPUT_RANGO)
```

- TypeScript puro, sin React ni dependencias. Determinista (mismos inputs → misma salida).
- `Inputs` es un alias de `InputCalculo` y `Salida` un alias de `Resultado`: existen para no romper el código
  que ya los importaba, pero el nombre canónico es el de la spec.
- La **implementación de referencia ejecutable** es `docs/verify-vectors.mjs`. Reproduce la spec paso a paso,
  imprime los 14 vectores de la §5 y ejecuta un barrido de 106 724 perfiles contra 31 familias de invariantes
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
  bariatrica | glp1 | otra`, y `InputCalculo` gana `cribado_tca: 'positivo' | 'evitado' | 'negativo' | null`
  (paso 5b del wizard; `positivo` y `evitado` añaden `'tca'` a `condiciones` en el paso 0). `'tca'` no se
  serializa nunca en el informe ni en el PDF.
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

- Usa `src/data/foods.json` (copiado de `docs/foods.json`, 101 alimentos con el esquema de
  `SPEC-ux-comidas-pdf.md` §3.0) y las plantillas/algoritmo de `docs/SPEC-ux-comidas-pdf.md` §3.
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
- Datos: `src/data/mercadona.json`, **una fila por cada alimento de `foods.json`** (cobertura total validada en `src/data/__tests__/mercadona.test.ts`), con el tipado y el índice en `src/data/mercadona.ts` (`MERCADONA`, `formatoCompra`, `ORDEN_SECCIONES`, `NOMBRE_SECCION`). **Sin precios**, por decisión: varían por tienda y por semana y envejecen mal en un PDF descargado. `envase_g` está expresado **en la misma base en la que `foods.json` mide el alimento** (crudo, cocido, escurrido o peso comestible), para que las fórmulas de arriba se apliquen sin conversiones.
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
  `cribado_tca` y `'tca'` no se persisten ni se serializan en el PDF.
- Flujo y copy: `docs/SPEC-ux-comidas-pdf.md` §1-2. Diseño: `docs/DESIGN-brief.md`.

## Reglas de convivencia (varios agentes en paralelo en el mismo repo)

- Cada agente toca solo su carpeta: motor → `src/engine/**`; comidas → `src/meals/**` y `src/data/**`; PDF → `src/pdf/**` y
  `scripts/**`; UI → `src/App.tsx`, `src/main.tsx`, `src/components/**`, `src/styles/**`, `src/index.css`, `index.html`, `public/**`.
- Nadie toca `package.json` salvo para añadir una dependencia imprescindible (anotarlo en el informe final).
- Para comprobar tipos: `npx tsc -p tsconfig.app.json --noEmit`. Para tests: `npx vitest run <ruta>`. Solo la UI arranca
  `vite` (puerto 5173) o `vite build`.
- Los stubs actuales de `src/engine/index.ts`, `src/meals/index.ts` y `src/pdf/index.ts` se sustituyen por completo, pero
  conservando los nombres y firmas exportados.
