#!/bin/sh
# Eseguire dalla radice del progetto. Breve fermo per coerenza DB/allegati.
set -eu
exec 9>/tmp/elettra-production-backup.lock
flock -n 9 || { printf 'Backup già in corso.\n' >&2; exit 1; }
compose() { docker compose -f compose.production.yaml "$@"; }
# Verifica deposito remoto prima di interrompere il servizio.
compose run --rm -T offsite snapshots > /dev/null
running="$(compose ps --status running --services app scheduler)"
resume() {
  if [ -n "$running" ]; then
    # Nomi generati da Compose, nessun input esterno.
    compose start $running
  fi
}
trap resume EXIT
compose stop app scheduler
compose run --rm -T backup
resume
trap - EXIT
compose run --rm -T offsite backup /backups --tag elettra --host elettra-production
compose run --rm -T offsite forget --tag elettra --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --prune
compose run --rm -T offsite check
# Conserva localmente i 7 backup completi più recenti; mai prima della copia remota.
compose run --rm -T --entrypoint sh backup /ops/prune-local.sh
