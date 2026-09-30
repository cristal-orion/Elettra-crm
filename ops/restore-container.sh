#!/bin/sh
# Solo destinazioni vuote e isolate. Mai --clean o DROP sul DB esistente.
set -eu
umask 077
: "${RESTORE_DATABASE_URL:?Impostare la destinazione vuota}"
bundle="${1:?Percorso del backup completo}"
(cd "$bundle" && sha256sum -c SHA256SUMS)
tables="$(psql "$RESTORE_DATABASE_URL" -At -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema')")"
[ "$tables" = "0" ] || { printf 'Database di destinazione non vuoto.\n' >&2; exit 1; }
[ -z "$(ls -A /restore-data)" ] || { printf 'Storage di destinazione non vuoto.\n' >&2; exit 1; }
tar -tzf "$bundle/uploads.tar.gz" > /dev/null
pg_restore --dbname="$RESTORE_DATABASE_URL" --single-transaction --exit-on-error --no-owner --no-acl "$bundle/database.dump"
tar -xzf "$bundle/uploads.tar.gz" -C /restore-data
chown -R 1000:1000 /restore-data
printf 'Database e allegati ripristinati; verificare readiness e accesso prima del cambio.\n'
