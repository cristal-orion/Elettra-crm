#!/bin/sh
# Eseguito dall'immagine ufficiale PostgreSQL SOLO su un volume DB vuoto.
set -eu
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set=ON_ERROR_STOP=1 --set=app_password="$POSTGRES_APP_PASSWORD" <<'SQL'
CREATE ROLE elettra LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD :'app_password';
ALTER DATABASE elettra OWNER TO elettra;
ALTER SCHEMA public OWNER TO elettra;
REVOKE ALL ON DATABASE elettra FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
SQL
