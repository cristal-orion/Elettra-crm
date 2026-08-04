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
| `SEED_PASSWORD` | **sì** (istanza pubblica) | Password degli utenti demo. Il default nel codice è pubblico in questo repo: senza questa variabile l'istanza è accessibile a chiunque |
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

I due elenchi storici (`Elenco anagrafiche`, `Elenco Offerte`) si importano con:

```bash
npm run db:import -- "<anagrafiche.xls>" "<offerte.xls>" --pulisci
```

- `--prova` esegue l'analisi e stampa il riepilogo **senza scrivere** nulla: usalo
  sempre la prima volta.
- `--pulisci` svuota anagrafiche e commesse prima di importare, così i dati demo
  del seed non si mescolano ai reali. Utenti, operai e catalogo restano.
- Serve **LibreOffice** nel PATH (converte l'`.xls` in CSV). Non è richiesto
  all'applicazione: solo a chi lancia l'import.
- L'import è **ripetibile**: le anagrafiche sono chiavi sui codici `C####`/`F####`
  e le commesse sul numero, quindi rilanciarlo aggiorna invece di duplicare.

> ⚠️ **`npm run db:seed` cancella tutto e riscrive i dati demo.** Dopo un import
> reale non va più eseguito. Sul container il seed parte solo al primissimo
> avvio, quindi il rischio riguarda l'uso locale.

Per portare i dati reali sull'istanza Coolify: esegui l'import in locale e copia
`prisma/dev.db` dentro il volume `/data` come `elettra.db`, oppure lancia
l'import sul server con i due file a disposizione.

## Limiti noti di questa configurazione

- **SQLite**: adeguato alla demo, un solo processo in scrittura. Lo schema è
  scritto per essere compatibile con PostgreSQL (vedi note in
  `prisma/schema.prisma`) quando servirà la produzione.
- **Nessun backup automatico**: i dati stanno solo nel volume. Per conservare
  quanto inserito durante la prova, fare uno snapshot del volume.
- **Upload su filesystem**: gli allegati sono legati al volume, non replicabili
  su più istanze.
