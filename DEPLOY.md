# Deploy di produzione — PostgreSQL

## Architettura

Una installazione isolata per cliente, trasferibile tra il nostro server e quello
del cliente. Tre componenti: app Next.js, PostgreSQL 16, archivio allegati.

- PostgreSQL vive fuori dal container dell'app, su un volume dedicato.
- `/data/uploads` è un secondo volume persistente; niente allegati in `public/`.
- La build non richiede il DB; al boot si applicano soltanto le migrazioni.
- Mai seed o reset automatico. Bootstrap dell'amministratore solo su DB senza utenti.
- Container app non-root (UID/GID 1000), health check e segreti solo a runtime.
- Una sola istanza web con storage locale condiviso col worker. Per più server
  servono storage oggetti/condiviso e coordinamento cache Next.js: non basta aggiungere repliche.

L'istanza SQLite già esistente **non viene convertita da un semplice deploy**.
Prima del deploy PostgreSQL seguire la migrazione sotto; il volume storico va conservato.

## Variabili di produzione

| Variabile | Uso |
|---|---|
| `DATABASE_URL` | Connessione PostgreSQL, password percent-encoded, `connect_timeout=5&pool_timeout=5&connection_limit=10` |
| `SESSION_SECRET` | Segreto casuale >=32 byte per JWT; `openssl rand -base64 32` |
| `DATA_ENCRYPTION_SECRET` | **Altro** segreto casuale >=32 byte per cifratura dati applicativi |
| `APP_ORIGIN` | Origine HTTPS pubblica esatta, es. `https://crm.example.it`, senza slash finale |
| `UPLOADS_DIR` | `/data/uploads`, su volume persistente scrivibile da UID 1000 |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Opzionali, assistente AI |
| `RUN_MIGRATIONS` | Default `true`; `false` per worker o migrazioni gestite separatamente |

I segreti non vanno nel repository, nei build ARG o in variabili `NEXT_PUBLIC_*`.
Il file `.env` di un server cliente va protetto con permessi 0600. I due segreti
di firma/cifratura devono essere conservati separatamente dal backup dati in un
password manager: senza la chiave di cifratura i valori cifrati non sono recuperabili.

I segreti legacy SQLite sono ancora leggibili con la **vecchia `SESSION_SECRET`**.
Durante la migrazione mantenerla; risalvare le impostazioni sensibili dall'app
per cifrarle in formato v2 prima di ruotarla. I valori v2 dipendono soltanto da
`DATA_ENCRYPTION_SECRET`, che non si può ruotare senza ricifratura.

## Coolify

1. Creare PostgreSQL 16 nello stesso ambiente/rete dell'app, **senza porta pubblica**,
   con storage persistente. Usare l'URL interno.
2. Creare un ruolo applicativo non superuser, senza `CREATEDB`/`CREATEROLE`/replication,
   proprietario solo del DB Elettra. Non usare nell'app il ruolo amministrativo
   creato di default dal container PostgreSQL. `ops/init-postgres.sh` è il modello SQL.
3. Build pack **Dockerfile**, porta interna **3000**, dominio HTTPS.
4. Mount persistente su `/data`; impostare le variabili della tabella come runtime-only.
5. Se si riusa il volume SQLite con file root-owned: a servizio fermo, dopo il backup,
   rendere **solo la directory uploads** di proprietà UID/GID 1000. Non aprire permessi 0777.
6. Readiness: `/api/health/ready`, porta 3000, intervallo 30s, timeout 10s,
   start period 60s, 3 tentativi. `/api/health/live` misura solo il processo HTTP.
7. Nuova installazione: bootstrap esplicito dal terminale del container:

   ```sh
   # ADMIN_EMAIL / ADMIN_PASSWORD passate temporaneamente e in modo riservato.
   npm run auth:bootstrap
   ```

   Password minima 12 caratteri, massimo 72 byte; rimuovere queste variabili dopo
   l'uso. Gli altri utenti si creano da **Utenti**, con password individuali.
   Su un DB migrato gli utenti sono già presenti: **non fare bootstrap**.
8. Per i controlli AI creare un task `npm run ai:scheduled` ogni 5 minuti (`*/5 * * * *`).
   Il task usa le stesse variabili del container; non esporre endpoint cron pubblici.
9. Configurare backup **sia del DB sia degli allegati**, con copia fuori server.
   Un backup del solo database gestito da Coolify non comprende `/data/uploads`.

Nell'istanza Coolify 4.0.0-beta.471 verificata il 30/09/2026 non risultavano backup
di Elettra né task AI. I file di questo repository non attivano da soli backup
o monitoraggio sull'istanza già online.

## Server cliente senza Coolify

Usare `compose.production.yaml` (non il Compose di sviluppo). Configurare `.env`
partendo da `.env.example`, con password DB applicativa e amministrativa **diverse**.
Nel DSN usare host `db`; il DB non pubblica porte sull'host.

```sh
docker compose -f compose.production.yaml up -d --build
docker compose -f compose.production.yaml exec app npm run auth:bootstrap
```

Il worker AI è incluso. Un reverse proxy HTTPS deve inoltrare a `127.0.0.1:3000`;
`ops/nginx.conf` è un template, richiede dominio/certificati reali. I limiti login
per account sono nel DB (10 tentativi/15 minuti, tetto globale 200); il proxy
aggiunge il limite per IP. Consentire 25 MB di body e almeno 180s di timeout per
import/AI, mantenendo streaming senza buffering. Limitare le porte pubbliche a
HTTPS/HTTP e SSH amministrativo; non esporre Node o PostgreSQL direttamente.

`ops/init-postgres.sh` viene eseguito dal container DB soltanto sul volume nuovo.
Modificare le password in `.env` non ruota le credenziali di un DB già inizializzato.

## Migrazione dell'istanza SQLite esistente

La prova può avvenire prima su una copia. Per il cambio definitivo:

1. Preparare DB PostgreSQL vuoto e nuova immagine; concordare una finestra di fermo.
2. Fermare app e tutti i worker/task che scrivono. Conservare un backup completo
   del vecchio volume (SQLite + uploads) e vecchia immagine/configurazione.
3. Applicare la baseline PostgreSQL alla destinazione: `npm run db:deploy`.
4. Aprire una copia SQLite aggiornata in sola lettura; impostare `DATABASE_URL`
   PostgreSQL nella sessione di migrazione. Con Node 22.13+:

   ```sh
   npm run db:from-sqlite -- /percorso/copia/elettra.db
   npm run db:from-sqlite -- /percorso/copia/elettra.db --execute
   ```

   Il primo comando analizza senza scrivere. Il secondo verifica integrità SQLite,
   FK, tabelle/colonne riconosciute e destinazione vuota, poi copia in una sola
   transazione: ID, relazioni, date, decimali, JSON, hash password e percorsi file.
   Rilegge tutti i record e confronta i valori normalizzati; un errore annulla tutto.
   Il riepilogo contiene conteggi e SHA-256, senza dati anagrafici o credenziali.
   Non migra la cronologia `_prisma_migrations` SQLite: è specifica del vecchio motore.
5. Copiare/montare gli stessi allegati, conservando i percorsi relativi e assegnando
   proprietà UID/GID 1000. Confrontare numero file e checksum con il backup.
6. Impostare URL PostgreSQL, vecchia `SESSION_SECRET`, nuova chiave dati e origine;
   avviare la nuova app e verificare readiness, login, liste/importi e download.
7. Fare il primo backup PostgreSQL+uploads e un restore isolato prima della consegna.

Rollback del cambio motore: se la verifica fallisce **prima di riaprire le scritture**,
riavviare vecchia immagine/configurazione sul volume SQLite conservato. Dopo nuove
scritture in PostgreSQL serve riconciliare i dati: non basta tornare alla vecchia immagine.

## Backup automatico e copia cifrata fuori server

Per il Compose produzione sono inclusi wrapper, dump/restore e Restic:

- `BACKUP_DATABASE_URL`: DSN PostgreSQL **libpq**, senza `schema`, `pool_timeout`
  o `connection_limit` di Prisma; mantenere `sslmode=verify-full` per DB remoti.
- `BACKUP_DIR`: directory locale dedicata, preferibilmente `/srv/elettra-backups`.
- `RESTIC_REPOSITORY`: deposito S3/SFTP **fuori da questo server**, non un MinIO
  sullo stesso disco. `RESTIC_PASSWORD` e credenziali deposito in configurazione riservata.

```sh
# Solo al primo utilizzo di un deposito nuovo:
docker compose -f compose.production.yaml run --rm offsite init
# Primo backup manuale (e prova di configurazione):
sh ops/backup.sh
```

Il wrapper verifica il deposito, ferma app e worker per rendere coerenti DB e
allegati, esegue `pg_dump` custom + tar uploads, verifica archivi e checksum,
riavvia i servizi, copia il bundle cifrato con Restic e applica retention:
7 giornalieri, 4 settimanali, 6 mensili; localmente 7 bundle. Un errore di copia
non elimina i backup locali. Lo script termina con errore per poter essere monitorato.

Per pianificare: installare `ops/elettra-backup.service` e `.timer` in systemd,
adattando `WorkingDirectory` al percorso reale, e attivare `elettra-backup.timer`.
Orario 02:00 UTC con jitter massimo 10 minuti. Controllare `journalctl -u
elettra-backup.service` e configurare un alert per esito fallito/mancato backup.
Durante il fermo nessun client esterno deve scrivere nel DB. Il wrapper è per
Compose: per Coolify adattare esplicitamente stop/start dei suoi container e task.

### Ripristino

Recuperare un bundle con `restic restore latest --target /percorso/recupero`.
Creare **DB e storage vuoti e isolati**, non puntare al DB in uso. Eseguire
`ops/restore-container.sh` in un container PostgreSQL 16 con:

- `RESTORE_DATABASE_URL` libpq verso la destinazione vuota;
- bundle montato in sola lettura, passato come primo argomento;
- nuovo storage montato in `/restore-data`.

Lo script verifica SHA-256, rifiuta DB/storage popolati, ripristina il dump in una
transazione e gli allegati con UID/GID 1000. Avviare poi l'app sulla destinazione,
verificare login/documenti e soltanto dopo cambiare il traffico. Non usare `--clean`
o `db:reset` su produzione. Le migrazioni distruttive richiedono recupero dati,
non un semplice rollback dell'immagine. Backup prima di import sostitutivi e aggiornamenti.

## Verifiche ripetibili

```sh
docker compose up -d db
npm test
npm run test:integration
docker build -t elettra-crm:production .
npm run test:ops
npm run lint
npx tsc --noEmit
npm audit
```

I test usano schemi/DB temporanei, non `DATABASE_URL` dell'app. `test:ops` usa il
cluster locale `elettra-crm-db-1` e l'immagine appena costruita: verifica provisioning
non superuser, assenza seed, bootstrap, CSP, sessioni revocate, restart, backup,
integrità Restic e restore di dati/allegati. Il deposito Restic di test è temporaneo:
non dimostra la raggiungibilità del deposito remoto del cliente.

Monitorare readiness dall'esterno, spazio disco, età/esito dei backup e scadenza
certificati. Il repository prepara gli strumenti; il monitor/alert e il deposito
remoto devono essere effettivamente configurati sul server scelto.

## Operazioni host su Coolify (backup locali)

`ops/coolify_ops.py` adatta backup e restore ai container identificati dalle
label Coolify, senza dipendere dai nomi che cambiano a ogni deploy. Eseguire come
root; configurazione e credenziali restano in `/etc/elettra-crm/runtime.json`
(0600), fuori dal repository e dall'immagine. Gli script installati sono in
`/opt/elettra-crm-ops`, di proprietà root; non vengono eseguiti da una directory
scrivibile dal container dell'app.

Il comando `prepare` è riservato all'amministratore della VPS: verifica ambiente
app/DB, crea il ruolo PostgreSQL ristretto, conserva immagine/configurazione
legacy e genera la chiave dati. Il token API di configurazione è temporaneo,
con scadenza e revoca al termine; nessun segreto viene stampato.

`cutover` ferma l'istanza legacy, salva l'intero volume SQLite+uploads in
`/var/lib/elettra-crm/legacy`, migra/verifica i dati e configura le variabili
runtime. Il successivo deploy resta esplicito. `mark-live` verifica readiness,
conteggi e checksum dei file prima di abilitare le operazioni periodiche.

Le unità `elettra-coolify-*` eseguono:

- backup DB+uploads quotidiano alle 02:00 UTC, conservando **14 bundle locali**;
- restore settimanale su DB temporaneo e confronto conteggi/checksum;
- monitor ogni cinque minuti: readiness HTTPS, disco (<80%), backup (<36 ore),
  prova restore (<8 giorni). Esiti strutturati in journal e stato sul server.

I backup sono in `/var/lib/elettra-crm/backups`, accessibili solo a root. Il backup
ferma brevemente l'app e la riavvia anche se il dump fallisce; viene rimandato
quando è in corso un deploy. Il restore non modifica il DB operativo e rimuove
il DB temporaneo anche in caso di errore. Queste unità **non inviano notifiche
esterne**: collegare il journal/stato a un canale di alert e mantenere un controllo
di disponibilità da un sistema esterno alla VPS.

La scelta iniziale di soli backup locali non protegge dalla perdita della VPS:
aggiungere il deposito fuori server prima della consegna. Non eliminare il bundle
legacy finché il passaggio a PostgreSQL e il ripristino sono stati verificati.

### Attivazione dell'istanza Elettra — 30 settembre 2026

L'istanza Coolify `elettra-crm` è stata migrata a PostgreSQL 16, con DB dedicato
`elettra-postgresql` nel progetto Elettra CRM / production, senza porte pubbliche.
Il ruolo dell'app è `elettra` (non superuser); il container DB ha limiti di
512 MiB e 1 CPU. La vecchia immagine SQLite e il backup integrale del volume
sono conservati per recupero; il file SQLite sul volume non è più il DB operativo.

Sono stati confrontati integralmente i record durante la migrazione: 12 utenti,
1.044 anagrafiche, 724 commesse, 1.099 destinazioni, oltre alle altre tabelle.
I percorsi e il checksum dell'allegato esistente sono stati verificati. Sono
passati i controlli HTTP autenticati, download, CSP e rifiuto richieste non
autorizzate/cross-origin. La chiave AI legacy è stata letta e ricifrata in v2.

Sono attivi i timer host `elettra-coolify-backup`, `elettra-coolify-restore` e
`elettra-coolify-monitor`, e il task Coolify `Controlli AI Elettra` ogni cinque
minuti. Backup e restore sono stati eseguiti tramite le unità systemd reali,
con confronto dei conteggi di tutte le tabelle e SHA-256 degli allegati.

La copia fuori server è stata rinviata esplicitamente: per ora i backup sono
locali. Il monitor registra gli esiti nel journal; alert esterni e controllo
di disponibilità da un altro sistema restano da collegare prima della consegna.
