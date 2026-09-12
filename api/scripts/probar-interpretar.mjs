// Prueba manual del servicio (SPEC-dieta-propia §9.4): pide capacidades, manda el texto del §0 y
// enseña la respuesta. Uso: node api/scripts/probar-interpretar.mjs [url]
// La url por defecto es http://127.0.0.1:8787 (sin nginx delante).
const url = (process.argv[2] ?? 'http://127.0.0.1:8787').replace(/\/+$/, '')
const origen = process.env.BASCULA_ORIGEN ?? 'http://localhost:5173'

const TEXTO = [
  'Por las mañanas 250 g de kéfir, 5 g de chía, 25 g de almendras, 18 de nueces, un scoop de',
  'proteína de unos 60 g en total y unos cereales del Mercadona 0 % grasa; para comer 200 g de pollo',
  'y 100 g de arroz basmati pesado en seco; para cenar 5 huevos y unas tiras de fiambre.',
  'Ceno ligero, sin hidratos. No me gusta el brócoli y me encanta el salmón.',
].join(' ')

const capacidades = await fetch(`${url}/api/capacidades`, { headers: { origin: origen } })
const datos = await capacidades.json()
console.log('capacidades:', datos)
if (datos.interpretar !== true || typeof datos.token !== 'string') {
  console.error('El servicio no puede interpretar (¿falta ANTHROPIC_API_KEY?).')
  process.exit(1)
}

const inicio = Date.now()
const respuesta = await fetch(`${url}/api/dieta/interpretar`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    origin: origen,
    'x-bascula-token': datos.token,
  },
  body: JSON.stringify({ texto: TEXTO, comidas_plan: ['Desayuno', 'Comida', 'Cena'] }),
})
console.log('estado:', respuesta.status, `(${Date.now() - inicio} ms)`)
console.log(JSON.stringify(await respuesta.json(), null, 2))
process.exit(respuesta.ok ? 0 : 1)
