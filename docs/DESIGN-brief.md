# Báscula — brief de diseño visual

## Qué es
Calculadora de macros seria y útil para público general de España (hombres y mujeres, 18-75).
Sustituye a una app de broma; la seriedad tiene que notarse sin ser fría. Mobile-first: la mayoría
la usará desde el móvil. Sin backend, todo en el navegador.

## Personalidad
- **Cercana y honesta**: habla de tú, explica el porqué de cada número en una frase, no vende humo.
- **Precisa**: los números son protagonistas. Tipografía numérica grande, tabular, con unidades pequeñas.
- **Cálida, no clínica**: no es una app de hospital ni un panel neón de gimnasio. Evitar el look
  "dark mode con gradientes verde/azul" del proyecto anterior y cualquier estética genérica de IA.

## Dirección
- **Tema claro por defecto** (fondo hueso/arena cálido, no blanco puro), tinta oscura para texto,
  un acento principal profundo (verde bosque, terracota o azul tinta; elegir UNO y usarlo con criterio)
  y un secundario para los tres macros (proteína / grasa / carbohidratos deben tener 3 colores fijos,
  distinguibles también en el PDF y en modo daltónico: p. ej. proteína = rojo teja, grasa = ámbar,
  carbohidratos = azul/verde azulado).
- **Tipografía**: una display con carácter para titulares y cifras (p. ej. Fraunces, Instrument Serif
  o similar vía Google Fonts) + una sans legible para cuerpo y formularios (Inter, Manrope o similar).
  Cifras con `font-variant-numeric: tabular-nums`.
- **Layout**: una sola columna centrada (max ~720 px) para el cuestionario; resultados en tarjetas
  con jerarquía clara: 1) calorías objetivo en grande, 2) los tres macros con barras/donut SVG propio
  (sin librería de gráficos), 3) agua, 4) reparto por comidas, 5) ejemplos de comidas, 6) cronograma
  y peso objetivo, 7) avisos y disclaimer. Botón "Exportar PDF" visible arriba y abajo de resultados.
- **Cuestionario tipo wizard**: un paso por pantalla o grupos pequeños, barra de progreso, botones
  grandes tipo tarjeta para opciones cerradas (con título + descripción operativa), inputs numéricos
  con unidades, "no lo sé" siempre como opción cuando aplica. Se puede volver atrás sin perder datos.
  Guardar el estado en localStorage para no perder el formulario al recargar.
- **Movimiento**: sutil y con propósito (transición entre pasos, aparición de resultados). Nada de
  confeti ni animaciones decorativas.
- **Accesibilidad**: contraste AA mínimo, foco visible, labels reales, navegable con teclado,
  `prefers-reduced-motion` respetado, tamaños táctiles ≥ 44 px.

## Lo que NO hacer
- Emojis como iconografía principal. Si hacen falta iconos, SVG inline sencillos.
- Fondos con blur de colores, glassmorphism, sombras enormes, degradados de texto.
- Textos en inglés en la interfaz. Todo en español de España (tú, "kcal", "g", decimales con coma).
- Tarjetas dentro de tarjetas dentro de tarjetas.

## Identidad
- Nombre: **Báscula**. Claim: "Tus macros, bien calculados." Pie: "Una herramienta de RS Agents".
- Favicon: un SVG simple (una báscula estilizada o la letra B), no el logo de Vite.

## Requisitos añadidos por el usuario (prioritarios)
- **Cero herencia del proyecto anterior**: nada de "brutal", "brutally honest", "BMI checkpoint", insultos ni
  tono de broma. Es una calculadora normal, seria y útil. No reutilizar copy ni estilos antiguos.
- **Para gente sin ni idea de nutrición**: cada pregunta debe entenderse sin conocimientos previos. Nada de
  siglas sin explicar (si sale "TDEE" o "BMR", explicarlo en una línea o usar "gasto diario"/"metabolismo basal").
  Toda opción cerrada lleva título + descripción concreta con la que la persona se pueda identificar.
- **Tipo de cuerpo con ilustración**: en el paso de somatotipo, cada opción (ectomorfo/mesomorfo/endomorfo) muestra
  una silueta SVG inline sencilla y limpia (hombros/cintura/estructura distinta en cada una; misma silueta para
  hombre y mujer o variante según el sexo elegido) más 2-3 rasgos en lenguaje llano ("hombros estrechos, te cuesta
  ganar peso", "ganas músculo con facilidad", "acumulas grasa fácil, estructura ancha"). Al pulsar, la silueta
  se resalta y aparece una frase de confirmación. Lo mismo para el selector visual de % de grasa: siluetas por
  rango con descripción ("abdominales marcados", "cintura definida", etc.).
- **Móvil primero, de verdad**: diseñar a 360-390 px de ancho y luego escalar. Botones de opción a ancho completo,
  inputs numéricos grandes con teclado numérico (`inputmode`), botón "Siguiente" fijo/visible sin hacer scroll,
  resultados legibles sin zoom, PDF descargable desde el móvil. Probar en viewport móvil antes de dar por bueno.
- **Que aporte valor**: el resultado no es solo números; explica en una frase qué hacer con cada uno, da ejemplos
  de comidas reales, agua, reparto por comidas y un cronograma realista. Debe sentirse como el resumen que te
  daría un nutricionista, no como una calculadora fría.
