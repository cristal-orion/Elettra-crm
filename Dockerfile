# CRM Elettra — immagine per il deploy su Coolify (o qualsiasi host Docker).
#
# Il client Prisma non è in repo (/src/generated è ignorato): va rigenerato in
# fase di build. DB SQLite e archivio documenti vivono su /data, che in
# produzione deve essere un volume persistente: senza volume, ogni redeploy
# riparte da zero.

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
# URL fittizio: "prisma generate" valida il datasource ma non apre il DB.
ENV DATABASE_URL="file:/tmp/build.db"
RUN npx prisma generate && npm run build

# --------------------------------- runner ---------------------------------
# Si tengono anche le devDependencies: "prisma migrate deploy" (CLI prisma) e
# "prisma db seed" (tsx) girano all'avvio del container.
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_URL="file:/data/elettra.db" \
    UPLOADS_DIR="/data/uploads"
COPY --from=builder /app ./
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
VOLUME /data
EXPOSE 3000
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "run", "start"]
