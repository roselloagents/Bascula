// Genera los PDF de muestra sin navegador, para poder abrirlos e inspeccionarlos.
//   node scripts/pdf-sample.mjs [carpeta-de-salida]
// Usa el servidor de Vite en modo SSR solo para compilar el TSX; no levanta ningún puerto.
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
// Por defecto escribe fuera del repositorio, para no ensuciar el árbol de trabajo.
const salida = resolve(process.argv[2] ?? resolve(tmpdir(), 'bascula-pdf'))

const servidor = await createServer({
  root: raiz,
  configFile: false,
  logLevel: 'warn',
  plugins: [react()],
  server: { middlewareMode: true },
  appType: 'custom',
})

try {
  const { elementoPlan } = await servidor.ssrLoadModule('/src/pdf/index.ts')
  const { MUESTRA_COMPLETA, MUESTRA_MINIMA } = await servidor.ssrLoadModule(
    '/src/pdf/__fixtures__/muestra.ts',
  )
  // v1.3 (SPEC-dieta-propia §6.2): una muestra más con el día compuesto ("Tu menú, con lo tuyo
  // dentro"), para poder revisar el bloque en papel sin dictar nada ni llamar al servicio.
  const { MUESTRA_DIETA_COMPLETA, MUESTRA_DIETA_MAXIMA } = await servidor.ssrLoadModule(
    '/src/pdf/__fixtures__/dieta-propia.ts',
  )
  const { renderToFile } = await import('@react-pdf/renderer')

  mkdirSync(salida, { recursive: true })
  for (const [nombre, datos] of [
    ['plan-muestra.pdf', MUESTRA_COMPLETA],
    ['plan-muestra-minima.pdf', MUESTRA_MINIMA],
    ['plan-muestra-dieta.pdf', MUESTRA_DIETA_COMPLETA],
    ['plan-muestra-dieta-maxima.pdf', MUESTRA_DIETA_MAXIMA],
  ]) {
    const ruta = resolve(salida, nombre)
    await renderToFile(elementoPlan(datos), ruta)
    console.log(`PDF generado: ${ruta}`)
  }
} finally {
  await servidor.close()
}
