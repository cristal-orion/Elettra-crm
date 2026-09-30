#!/bin/sh
# Mai seed, reset o bootstrap automatico. Il DB vive fuori dal container.
set -eu
umask 077
node_modules/.bin/tsx scripts/check-runtime.ts
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  node_modules/.bin/prisma migrate deploy
fi
exec "$@"
