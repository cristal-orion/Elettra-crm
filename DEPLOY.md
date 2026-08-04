# Deploy su Coolify

Istanza dimostrativa del CRM: build da `Dockerfile`, dati su un volume
persistente, SQLite. Testato con l'immagine di questo repo (build + boot +
migrazioni + seed).

## 1. Risorsa su Coolify

- **New Resource → Public Repository**
  (il repo è pubblico: non serve deploy key)
- Repository: `https://github.com/cristal-orion/Elettra-crm`
- Branch: `main`
- **Build Pack: `Dockerfile`** — non Nixpacks: il client Prisma va rigenerato
  in build e le migrazioni girano all'avvio
- **Port exposed: `3000`**

## 2. Volume persistente — da fare PRIMA del primo deploy

**Storage → Add volume mount**, destinazione `/data`.

Su `/data` vivono il database (`/data/elettra.db`) e i documenti caricati
(`/data/uploads`). Senza il volume l'app parte comunque, ma **ogni redeploy
azzera dati e allegati**.

## 3. Variabili d'ambiente

| Variabile | Obbligatoria | Note |
|---|---|---|
| `SESSION_SECRET` | **sì** | Firma le sessioni JWT e cifra i segreti nel DB. Genera con `openssl rand -base64 32`. Cambiarla invalida le sessioni e rende illeggibile la chiave AI salvata |
| `SEED_PASSWORD` | **sì** | Password degli utenti creati al primo avvio. Il default nel codice è pubblico in questo repo, quindi **senza questa variabile il container si rifiuta di partire** (a meno di `SEED_ON_FIRST_BOOT=false`). Usane una lunga e casuale |
| `GEMINI_API_KEY` | no | Assistente AI e lettura visure. Senza chiave il resto del CRM funziona |
| `GEMINI_MODEL` | no | Default `gemini-3.5-flash` |
| `SEED_ON_FIRST_BOOT` | no | `false` per partire con un DB vuoto |

`DATABASE_URL` e `UPLOADS_DIR` sono già impostate nel `Dockerfile` e puntano a
`/data`: non serve dichiararle.

## 4. Dominio

Coolify assegna un dominio `sslip.io` con certificato Let's Encrypt: è il link
provvisorio da far provare. Sostituibile con un dominio reale da
**Configuration → Domains**.

## Cosa accade all'avvio

`docker-entrypoint.sh`:

1. crea `/data` e `/data/uploads`;
2. esegue `prisma migrate deploy`;
3. **solo se il file del DB non esisteva**, esegue `prisma db seed`.

Il seed è distruttivo (`deleteMany` su tutte le tabelle): il controllo sul
primo avvio evita che un redeploy cancelli i dati inseriti durante la prova.
Per ricaricare i dati demo da zero, elimina il volume e rilancia il deploy.

## Caricare i dati reali di Elettra

**Dall'applicazione, in drag & drop** — è la via consigliata: i file non passano
da GitHub, non serve copiare database e non serve accedere al server.

1. Accedi come Super Admin
2. **Impostazioni → Import dati da Excel**
3. Trascina i due elenchi (`Elenco anagrafiche`, `Elenco Offerte`)
4. **Analizza senza scrivere** e controlla il riepilogo
5. Confronta le **somme di controllo** con i totali scritti in testa al foglio
   offerte: se coincidono, non si è perso nulla
6. **Importa nel database**

L'import dura circa 25 secondi e sostituisce anagrafiche e commesse quando la
casella "sostituisci i dati esistenti" è spuntata. È **ripetibile**: le
anagrafiche hanno per chiave i codici `C####`/`F####` e le commesse il numero,
quindi rilanciarlo aggiorna invece di duplicare.

I `.xls` si leggono con SheetJS dentro il container: **non serve LibreOffice**.

In alternativa, da riga di comando:

```bash
npm run db:import -- "<anagrafiche.xls>" "<offerte.xls>" --pulisci   # --prova per l'anteprima
```

> ⚠️ **`npm run db:seed` cancella tutto e riscrive i dati demo.** Dopo un import
> reale non va più eseguito. Sul container il seed parte solo al primissimo
> avvio, quindi il rischio riguarda l'uso locale.

## Pianificazione dimostrativa per la presentazione

Gli elenchi Excel non contengono milestone di cantiere: dopo l'import la sezione
Progetti mostra centinaia di cantieri "da pianificare". Per mostrarla all'opera:

```bash
npm run demo:milestone              # 22 milestone su 4 commesse reali
npm run demo:milestone -- --rimuovi # le elimina tutte
```

Le milestone sono marcate `dimostrativa` nel database e l'interfaccia lo dichiara
con un banner nel dettaglio e un badge in lista: commesse, clienti e importi
restano reali, di esempio sono solo milestone, date di cantiere e note.

## Limiti noti di questa configurazione

- **SQLite**: adeguato alla demo, un solo processo in scrittura. Lo schema è
  scritto per essere compatibile con PostgreSQL (vedi note in
  `prisma/schema.prisma`) quando servirà la produzione.
- **Nessun backup automatico**: i dati stanno solo nel volume. Per conservare
  quanto inserito durante la prova, fare uno snapshot del volume.
- **Upload su filesystem**: gli allegati sono legati al volume, non replicabili
  su più istanze.
