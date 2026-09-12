# Servicio de interpretación (SPEC-dieta-propia §1.1). Sin build: Node 24 ejecuta el TypeScript
# de sintaxis borrable tal cual. El contexto es la RAÍZ del repo porque hace falta src/data/foods.json.
FROM node:24-alpine

ENV NODE_ENV=production
ENV PORT=8787
ENV BASCULA_DATOS=/data

# Dependencias primero: así la capa se reaprovecha mientras no cambien.
WORKDIR /app/api
COPY api/package.json api/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# El código y el catálogo, con la misma distancia relativa que en el repo (api/src → ../../src/data).
WORKDIR /app
COPY api/src ./api/src
COPY src/data/foods.json ./src/data/foods.json

# La carpeta de las cuotas es un volumen; el proceso corre sin privilegios.
RUN mkdir -p /data && chown -R node:node /app /data
USER node

EXPOSE 8787

# alpine no trae curl: se comprueba con el propio Node.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD node -e "fetch('http://127.0.0.1:8787/api/salud').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "api/src/servidor.ts"]
