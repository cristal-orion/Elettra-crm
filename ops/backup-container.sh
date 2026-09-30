#!/bin/sh
# Richiede che tutti gli scrittori dell'app siano fermi (wrapper backup.sh).
set -eu
umask 077
: "${BACKUP_DATABASE_URL:?URL libpq senza parametri Prisma}"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
partial="/backups/.${stamp}.partial"
final="/backups/${stamp}"
mkdir "$partial"
trap 'rm -rf "$partial"' EXIT
pg_dump --dbname="$BACKUP_DATABASE_URL" --format=custom --no-owner --no-acl --file="$partial/database.dump"
tar -czf "$partial/uploads.tar.gz" -C /data uploads
pg_restore --list "$partial/database.dump" > /dev/null
tar -tzf "$partial/uploads.tar.gz" > /dev/null
(cd "$partial" && sha256sum database.dump uploads.tar.gz > SHA256SUMS)
mv "$partial" "$final"
trap - EXIT
printf 'Backup locale completato: %s\n' "$stamp"
