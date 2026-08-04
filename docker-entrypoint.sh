#!/bin/sh
# Avvio container: prepara /data, applica le migrazioni e — solo al primissimo
# avvio — carica i dati demo. Il seed è distruttivo (deleteMany su tutte le
# tabelle), quindi non deve mai girare su un DB già popolato.
set -e

DB_PATH="${DATABASE_URL#file:}"
mkdir -p "$(dirname "$DB_PATH")" "${UPLOADS_DIR:-/data/uploads}"

# Da valutare PRIMA di migrate deploy, che crea il file del DB.
FIRST_BOOT=0
[ -f "$DB_PATH" ] || FIRST_BOOT=1

echo "› prisma migrate deploy"
npx prisma migrate deploy

if [ "$FIRST_BOOT" = "1" ] && [ "${SEED_ON_FIRST_BOOT:-true}" = "true" ]; then
  # Senza SEED_PASSWORD il seed userebbe il default scritto nel repo, che è
  # pubblico: su un'istanza raggiungibile da internet significherebbe consegnare
  # un Super Admin a chiunque. Meglio fermarsi che partire insicuri.
  if [ -z "$SEED_PASSWORD" ]; then
    echo "ERRORE: SEED_PASSWORD non impostata." >&2
    echo "  Il seed creerebbe gli utenti con la password di default, che è" >&2
    echo "  pubblica nel repository. Imposta SEED_PASSWORD fra le variabili" >&2
    echo "  d'ambiente, oppure SEED_ON_FIRST_BOOT=false per partire a vuoto." >&2
    exit 1
  fi
  echo "› primo avvio rilevato: carico i dati demo"
  npx prisma db seed
fi

exec "$@"
