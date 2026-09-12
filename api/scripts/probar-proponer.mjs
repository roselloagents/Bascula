// Prueba manual de la propuesta de huecos (SPEC-dieta-propia §4bis.1): pide capacidades y manda
// dos huecos con el contexto del §0. Uso: node api/scripts/probar-proponer.mjs [url] [--solo-pollo]
// La url por defecto es http://127.0.0.1:8787 (sin nginx delante). El `Origin` sale de la url que
// se pasa; con BASCULA_ORIGEN se fuerza. Con --solo-pollo se manda la petición extrema del tercer
// audio ("alguien puede querer solo pollo y arroz"), que debería traer consejo y una pregunta.
const argumentos = process.argv.slice(2)
const soloPollo = argumentos.includes('--solo-pollo')
const pedida = argumentos.find((a) => !a.startsWith('--'))
const url = (pedida ?? 'http://127.0.0.1:8787').replace(/\/+$/, '')
const origen =
  process.env.BASCULA_ORIGEN ??
  (pedida === undefined ? 'http://localhost:5173' : new URL(url).origin)

const TEXTO = [
  'Por las mañanas 250 g de kéfir, 5 g de chía, 25 g de almendras, 18 de nueces, un scoop de',
  'proteína de unos 60 g en total y unos cereales del Mercadona 0 % grasa; para comer 200 g de pollo',
  'y 100 g de arroz basmati pesado en seco; para cenar 5 huevos y unas tiras de fiambre.',
  'Ceno ligero, sin hidratos. No me gusta el brócoli y me encanta el salmón.',
].join(' ')

const TEXTO_SOLO_POLLO = [
  'Yo como siempre lo mismo: solo pollo y arroz, mañana, tarde y noche. No quiero verdura ninguna',
  'y la fruta no la pruebo. Desayuno 250 g de kéfir con 25 g de almendras.',
].join(' ')

const huecos = [
  {
    nombre: 'Comida',
    hora: '14:00',
    peri: false,
    objetivo: { kcal: 780, prot: 55, carb: 80, fat: 24 },
    sin_hidratos: false,
  },
  {
    nombre: 'Cena',
    hora: '21:00',
    peri: false,
    objetivo: { kcal: 520, prot: 45, carb: 10, fat: 28 },
    sin_hidratos: true,
  },
]

const contexto = {
  texto: soloPollo ? TEXTO_SOLO_POLLO : TEXTO,
  comidas_propias: [
    {
      nombre: 'Desayuno',
      alimentos: ['Kéfir natural entero 250 g', 'Almendras 25 g', 'Semillas de chía 5 g'],
    },
  ],
  gustos: soloPollo
    ? [{ texto: 'no quiero verdura', tipo: 'no_gusta', alimento_ids: [] }]
    : [
        { texto: 'no me gusta el brócoli', tipo: 'no_gusta', alimento_ids: ['brocoli'] },
        { texto: 'me encanta el salmón', tipo: 'gusta', alimento_ids: ['salmon'] },
      ],
  habitos: [
    { texto: 'ceno ligero, sin hidratos', tipo: 'sin_hidratos', comida: 'Cena', valor: null },
  ],
  perfil: {
    base: 'omnivoro',
    restricciones: [],
    low_carb: false,
    excluidos: soloPollo ? [] : ['brocoli'],
    favoritos: soloPollo ? [] : ['salmon'],
  },
  condiciones: [],
  menu_sencillo: false,
  respuestas: [],
  variante: 0,
}

const capacidades = await fetch(`${url}/api/capacidades`, { headers: { origin: origen } })
const datos = await capacidades.json()
console.log('capacidades:', datos)
if (datos.interpretar !== true || typeof datos.token !== 'string') {
  console.error('El servicio no puede proponer (¿falta ANTHROPIC_API_KEY?).')
  process.exit(1)
}

const inicio = Date.now()
const respuesta = await fetch(`${url}/api/dieta/proponer`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    origin: origen,
    'x-bascula-token': datos.token,
  },
  body: JSON.stringify({ huecos, contexto }),
})
console.log('caso:', soloPollo ? 'solo pollo y arroz' : 'contexto del §0')
console.log('estado:', respuesta.status, `(${Date.now() - inicio} ms)`)
console.log(JSON.stringify(await respuesta.json(), null, 2))
process.exit(respuesta.ok ? 0 : 1)
