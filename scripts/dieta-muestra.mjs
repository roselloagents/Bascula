// Imprime el día compuesto de los fixtures de "Cuéntanos cómo comes" (SPEC-dieta-propia §4.7).
//   node scripts/dieta-muestra.mjs [clave]
// Sin clave imprime los seis. Usa el servidor de Vite en modo SSR solo para compilar el
// TypeScript (los módulos importan `foods.json` sin `with { type: 'json' }`, así que Node no
// puede cargarlos a pelo); no levanta ningún puerto ni toca la red.
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const filtro = process.argv[2] ?? null

const servidor = await createServer({
  root: raiz,
  configFile: false,
  logLevel: 'warn',
  server: { middlewareMode: true },
  appType: 'custom',
})

const g = (n) => n.toFixed(1).replace('.', ',')

try {
  const { FIXTURES_DIETA, DIAS_COMPUESTOS } = await servidor.ssrLoadModule(
    '/src/meals/__tests__/dieta-fixtures.ts',
  )
  const { compraDeDia } = await servidor.ssrLoadModule('/src/meals/index.ts')

  for (const f of FIXTURES_DIETA) {
    if (filtro && f.clave !== filtro) continue
    const dia = DIAS_COMPUESTOS[f.clave]
    console.log(`\n${'='.repeat(78)}\n${f.clave} — ${f.titulo}  [modo ${dia.modo}]`)
    console.log(
      `Plan: ${dia.objetivo.kcal} kcal · ${g(dia.objetivo.prot)} P · ${g(dia.objetivo.fat)} G · ${g(dia.objetivo.carb)} HC`,
    )
    for (const c of dia.comidas) {
      const hora = c.hora ? ` ${c.hora}` : ''
      console.log(`\n  ${c.nombre}${hora} [${c.origen}] — ${g(c.pct_kcal)} % de las kcal`)
      for (const a of c.alimentos) {
        const cambio =
          a.estado_ajuste === 'pendiente'
            ? 'pendiente'
            : a.delta_g === 0
              ? 'igual'
              : `${a.delta_g > 0 ? '+' : '−'}${g(Math.abs(a.delta_g))} g`
        const limite = a.en_limite === 'no' ? '' : ` [límite: ${a.en_limite}]`
        console.log(
          `    ${String(a.gramos_ajustados).padStart(5)} g  ${a.nombre} (${a.estado_ajuste}, ${cambio})${limite}`,
        )
      }
      for (const a of c.ejemplo?.alimentos ?? []) {
        console.log(`    ${String(a.gramos).padStart(5)} g  ${a.nombre} — ${a.medida}`)
      }
      console.log(
        `    → ${c.totales.kcal} kcal · ${g(c.totales.prot)} P · ${g(c.totales.fat)} G · ${g(c.totales.carb)} HC`,
      )
    }
    console.log(
      `\n  TOTAL: ${dia.totales.kcal} kcal · ${g(dia.totales.prot)} P · ${g(dia.totales.fat)} G · ${g(dia.totales.carb)} HC · ${g(dia.totales.fibra)} g de fibra`,
    )
    console.log(
      `  DESVÍO: ${dia.desvio.kcal} kcal · ${g(dia.desvio.prot)} P · ${g(dia.desvio.fat)} G · ${g(dia.desvio.carb)} HC`,
    )
    if (dia.aplicado.length > 0) console.log(`  Aplicado: ${dia.aplicado.join(' | ')}`)
    if (dia.apuntado.length > 0) console.log(`  Apuntado: ${dia.apuntado.join(' | ')}`)
    if (dia.pendientes.length > 0) {
      console.log(`  Pendientes: ${dia.pendientes.map((p) => p.nombre).join(', ')}`)
    }
    for (const a of dia.avisos) console.log(`  [${a.codigo}] ${a.texto}`)
    for (const n of dia.notas) console.log(`  · ${n}`)
    const compra = compraDeDia(dia)
    console.log(`\n  Compra (${compra.alimentos_distintos} alimentos):`)
    for (const i of compra.items) {
      console.log(
        `    ${i.seccion.padEnd(16)} ${i.nombre} — ${i.gramos_semana} g/semana, ${i.envases} envases`,
      )
    }
  }
} finally {
  await servidor.close()
}
