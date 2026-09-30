# CRM Elettra — immagine per il deploy su Coolify (o qualsiasi host Docker).
#
# Il client Prisma non è in repo (/src/generated è ignorato): va rigenerato in
# fase di build. PostgreSQL esterno all'app; /data conserva solo gli allegati.

FROM node:22-alpine AS base
RUN apk add --no-cache openssl
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# --------------------------------- deps ---------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
# --ignore-scripts: il postinstall (prisma generate) girerebbe senza lo schema.
RUN npm ci --ignore-scripts

# -------------------------------- builder --------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# La build non contatta database e non applica migrazioni. URL non sensibile,
# limitato a questo stage; la connessione reale viene passata solo a runtime.
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build"
RUN npx prisma generate \
  && npm run build

# --------------------------------- runner ---------------------------------
# CLI Prisma e tsx servono per migrazioni e comandi operativi espliciti.
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    UPLOADS_DIR="/data/uploads"
COPY --from=builder --chown=node:node /app ./
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
  && mkdir -p /data/uploads && chown -R node:node /data
USER node
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/api/health/ready || exit 1
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "node_modules/next/dist/bin/next", "start"]
