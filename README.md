# Báscula

Calculadora de calorías y macronutrientes en español. Contestas trece preguntas cortas —sexo,
edad, altura, peso, condiciones médicas, grasa corporal, constitución, actividad, entrenamiento,
objetivo, ritmo, peso al que quieres llegar y forma de comer— y devuelve tu objetivo de calorías,
el reparto en proteína, grasa, hidratos y fibra, la hidratación, el reparto por comidas, un menú
de ejemplo con gramajes reales, la lista de la compra de la semana y un informe en PDF.

Es una aplicación de una sola página, **sin servidor y sin base de datos**: todo el cálculo ocurre
en el navegador y lo único que se guarda es un borrador en el `localStorage` del propio dispositivo.
No hay cuentas, no hay analítica y ningún dato sale del móvil.

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

Todo es determinista: los mismos datos dan siempre el mismo plan, sin `Math.random` en ninguna
parte. Hay cortes de seguridad —menores de 18 y mayores de 75, embarazo y lactancia, condición
renal o hepática— en los que la aplicación deriva a un profesional en vez de dar un plan.

## Documentación

| Documento | Qué contiene |
| --- | --- |
| [`docs/SPEC-calculo.md`](docs/SPEC-calculo.md) | Los diecisiete pasos del motor, las tablas, los avisos y los catorce vectores de prueba. |
| [`docs/SPEC-ux-comidas-pdf.md`](docs/SPEC-ux-comidas-pdf.md) | El cuestionario, la pantalla de resultados, el generador de menús, la lista de la compra y el PDF. |
| [`docs/CONTRATO.md`](docs/CONTRATO.md) | La API entre módulos: `Inputs`, `Resultado`, `Ejemplos`, `ListaCompra` y `DatosPdf`. |
| [`docs/DESIGN-brief.md`](docs/DESIGN-brief.md) | Identidad visual: paleta, tipografía, tono y reglas de composición. |
| [`docs/verify-vectors.mjs`](docs/verify-vectors.mjs) | Implementación de referencia de la spec de cálculo, independiente del código de la app. |

## Estructura

```
src/
  engine/      Motor de cálculo puro (SPEC-calculo.md). Sin React, sin DOM.
  meals/       Generador de menús de ejemplo y lista de la compra.
  pdf/         Documento PDF del plan (@react-pdf/renderer).
  data/        Base de alimentos (foods.json) y formatos de compra de Mercadona.
  components/  Cuestionario por pasos, pantalla de resultados y controles.
  styles/      Variables de diseño y hojas de estilo.
docker/        Configuración de nginx para la imagen de producción.
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
| `node docs/verify-vectors.mjs` | Verifica los catorce vectores de la §5 y un barrido de invariantes contra la implementación de referencia. |
| `node scripts/pdf-sample.mjs [carpeta]` | Genera los PDF de muestra sin abrir el navegador. |

Requisitos: Node.js 20 o superior y npm. `npm install` y a correr.

## Despliegue

La imagen es un build estático servido por nginx:

```bash
docker build -t bascula .
docker run --rm -p 8080:80 bascula
```

En producción se despliega con **Dokploy** sobre el VPS de RS Agents usando el
`docker-compose.yml` del repositorio (red externa `dokploy-network`), y queda publicado en
**https://bascula.rsagents.es**.

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
