# `api/` — el servicio de "Cuéntanos cómo comes" (v1.3)

Servicio HTTP mínimo que interpreta con Claude lo que la persona dicta o escribe sobre cómo come.
La especificación normativa es [`docs/SPEC-dieta-propia.md`](../docs/SPEC-dieta-propia.md) (§1, §2, §3 y §7).

Node 24 ejecuta el TypeScript **sin build** (sintaxis borrable, imports relativos con extensión `.ts`).
La voz nunca pasa por aquí: la transcripción la hace el navegador. Ningún endpoint recibe audio.

## Arrancar en local

```bash
npm --prefix api install        # una vez
cp api/.env.example api/.env    # y rellena lo que quieras cambiar
npm run api                     # = node --env-file-if-exists=api/.env api/src/servidor.ts
```

Con `npm run dev` en otra terminal, Vite manda `/api/*` a `http://127.0.0.1:8787` (`server.proxy`),
así que el front funciona sin nginx delante.

Sin `ANTHROPIC_API_KEY` el servicio arranca igual: `/api/capacidades` devuelve `interpretar: false`
y `/api/dieta/interpretar` responde `503 SIN_CLAVE`. Es el modo en el que se desarrolla el front.

```bash
curl http://127.0.0.1:8787/api/salud          # {"ok":true,"version":"1.3.0"}
# `/api/capacidades` exige `Origin` de la lista (o `Sec-Fetch-Site` del propio sitio): sin ninguna
# de las dos cabeceras son 403 (§7). `/api/salud` no lleva ese control (es el HEALTHCHECK).
curl -H 'Origin: http://localhost:5173' http://127.0.0.1:8787/api/capacidades
node api/scripts/probar-interpretar.mjs       # prueba de punta a punta (necesita clave)
# Contra producción el script deduce el Origin de la url; se puede forzar con BASCULA_ORIGEN=…
node api/scripts/probar-interpretar.mjs https://bascula.rsagents.es
```

## Comprobaciones

```bash
npm run typecheck:api   # tsc --noEmit dentro de api/
npm run test:api        # vitest: el cliente de Anthropic va INYECTADO, ningún test toca la red
```

## Variables de entorno

| Variable | Por defecto | Para qué |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Sin ella no se interpreta (`503 SIN_CLAVE`). Solo llega como `environment` en tiempo de ejecución: nunca como `ARG`. |
| `BASCULA_MODELO` | `claude-sonnet-5` | Lista blanca: `claude-sonnet-5`, `claude-haiku-4-5`, `claude-opus-5`. Cualquier otro se ignora (se avisa en el log) y se usa el de por defecto. |
| `BASCULA_TOPE_EUROS_DIA` | `4` | Presupuesto diario (UTC) de TODAS las llamadas al modelo, reintentos incluidos. Tope duro. |
| `BASCULA_TOPE_GLOBAL_DIA` | `400` | Interpretaciones por día. |
| `BASCULA_TOPE_IP_DIA` | `40` | Interpretaciones por IP y día (IPv6 agregada por /64). |
| `BASCULA_ORIGENES` | `https://bascula.rsagents.es` | Orígenes admitidos, separados por comas. |
| `BASCULA_SECRETO` | aleatorio al arrancar | Clave HMAC del token efímero. Si no se fija, los tokens dejan de valer en cada reinicio. |
| `BASCULA_DATOS` | `/data` | Carpeta donde se persisten las cuotas (`cuotas.json`, escritura atómica). |
| `PORT` | `8787` | Puerto interno. |

## Los ficheros

| Fichero | Qué hace |
|---|---|
| `src/servidor.ts` | Arranque, rutas, cabeceras, origen, token, cuotas y tiempos (§2 y §7). |
| `src/interpretar.ts` | El prompt con las 14 reglas, la llamada con `messages.parse`, el reintento único y la post-validación (§3). |
| `src/catalogo.ts` | Carga `src/data/foods.json` y lo compacta a una línea por alimento (§3.2). |
| `src/esquema.ts` | zod de la entrada HTTP y de la salida del modelo (§2.3 y §3.4). |
| `src/limites.ts` | Cuotas por IP, global y en euros, persistidas en `cuotas.json` (§7). |
| `src/token.ts` | Token efímero HMAC-SHA256 por IP y ventana de 10 minutos (§7). |
| `src/saneado.ts` | Limpieza de todas las cadenas que vienen del modelo (§3.5). |

## Presupuesto de tiempo

De fuera adentro: nginx 90 s > cliente 75 s > servidor 60 s = primer intento 35 s + reintento 20 s.
`maxRetries: 0` en el SDK (el reintento es manual y auditable) y `AbortSignal` al cerrar la conexión:
quien cancela no paga.

## Privacidad

El cuerpo lleva **solo** el texto y los nombres de las comidas del plan: ni sexo, ni edad, ni peso,
ni objetivo. El log es una línea JSON por petición **sin el texto, sin la salida del modelo y sin la
IP** (solo un `ip_hash` con sal del día).
