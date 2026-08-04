# Runbook: deploy del CRM Elettra su Coolify

Istruzioni operative per chi configura l'istanza sulla VPS. Sono pensate per
essere eseguite dall'alto verso il basso, senza conoscere la storia del progetto.

## Contesto in tre righe

CRM interno di Elettra S.r.l.: Next.js 16 + Prisma + SQLite, autenticazione a
sessione con ruoli. Si deploya da questo repo con il `Dockerfile` incluso. Il
database e gli allegati vivono su un volume, **non** nell'immagine.

**Nel repository non c'è nessun dato aziendale.** Anagrafiche e commesse reali si
caricano dopo il deploy, dall'interfaccia, in drag & drop.

---

## 1. Prerequisiti

- Coolify già installato e funzionante sulla VPS
- Un dominio (o l'automatico `sslip.io` che assegna Coolify)
- Nessun altro servizio sulla porta 3000

Non servono Node, npm, Prisma o LibreOffice sull'host: fa tutto il container.

## 2. Creazione della risorsa

**New Resource → Public Repository**

| Campo | Valore |
|---|---|
| Repository | `https://github.com/cristal-orion/Elettra-crm` |
| Branch | `main` |
| Build Pack | **Dockerfile** |
| Port exposed | **3000** |

⚠️ Non usare Nixpacks: il client Prisma non è versionato e va rigenerato in fase
di build, cosa che il `Dockerfile` fa e Nixpacks no.

## 3. Volume persistente — PRIMA del primo deploy

**Storage → Add volume mount**, destinazione **`/data`**.

Ci vivono il database (`/data/elettra.db`) e gli allegati (`/data/uploads`).
Senza volume l'app parte lo stesso, ma **ogni redeploy azzera tutto**.

## 4. Variabili d'ambiente

| Variabile | Obbligatoria | Come ottenerla |
|---|---|---|
| `SESSION_SECRET` | **sì** | `openssl rand -base64 32` |
| `SEED_PASSWORD` | **sì** | `openssl rand -base64 18` — è la password iniziale di tutti gli utenti. **Annotala**: viene mostrata solo qui |
| `GEMINI_API_KEY` | no | Chiave Google AI Studio, per assistente e lettura visure. Senza, il resto funziona |
| `GEMINI_MODEL` | no | Default `gemini-3.5-flash` |

Due avvertenze che evitano guai:

- **Senza `SEED_PASSWORD` il container si rifiuta di partire.** È voluto: il
  seed userebbe la password di default, che è pubblica nel repository.
- **`SESSION_SECRET` non va più cambiata dopo il primo avvio.** Firma le sessioni
  e cifra la chiave AI salvata nel database: cambiandola, quella chiave diventa
  illeggibile e va reinserita.

## 5. Deploy e dominio

Avvia il deploy. Al primo boot il container esegue le migrazioni e crea gli
utenti con `SEED_PASSWORD`, più dei dati dimostrativi.

Poi **Configuration → Domains** per assegnare il dominio. Coolify ottiene il
certificato Let's Encrypt da sé.

## 6. Verifica che sia andata

```bash
# nome del container (l'app è identificata dall'UUID che dà Coolify)
docker ps --format '{{.Names}}\t{{.Status}}' | grep -i elettra

# le migrazioni devono risultare applicate e il seed eseguito una sola volta
docker logs <container> 2>&1 | tail -30
```

Nei log devi vedere `prisma migrate deploy`, poi `primo avvio rilevato: carico i
dati demo`, poi `Ready`. Dal browser, `/login` deve rispondere 200.

Accedi come `fabio.greco@elettra.it` con la `SEED_PASSWORD` scelta.

## 7. Caricare i dati reali

Dall'interfaccia, senza toccare il server:

1. **Impostazioni → Import dati da Excel**
2. Trascina i due elenchi (`Elenco anagrafiche`, `Elenco Offerte`)
3. **Analizza senza scrivere**: controlla il riepilogo
4. Confronta le **somme di controllo** con i totali scritti in testa al foglio
   offerte. Devono coincidere al centesimo — è la prova che non si è perso nulla
5. Lascia spuntato *"sostituisci i dati esistenti"* per rimpiazzare i dati demo
6. **Importa nel database** — dura circa 25 secondi, non chiudere la pagina

Attesi: ~1044 aziende, ~723 commesse, ~1100 destinazioni.

L'import è ripetibile: rilanciarlo aggiorna invece di duplicare.

## 8. Pianificazione dimostrativa (opzionale, per la presentazione)

Gli elenchi Excel non contengono pianificazione di cantiere, quindi dopo
l'import la sezione **Progetti** mostra ~597 cantieri tutti "da pianificare" e
sembra vuota. Per farla vedere all'opera:

```bash
docker exec <container> npm run demo:milestone
```

Aggiunge 22 milestone su **4 commesse reali** (una per stato: in corso, in
ritardo, chiuso, appena partito). Sono marcate `dimostrativa` nel database e
l'interfaccia le dichiara con un banner e un badge, così nessuno le confonde
con pianificazione vera. Commesse, clienti e importi restano reali.

Per rimuoverle prima di andare in uso reale:

```bash
docker exec <container> npm run demo:milestone -- --rimuovi
```

## 9. Raccogliere il feedback di chi prova

Il CRM ha una sezione **Segnalazioni**: chi prova apre una nota da qualunque
schermata col pulsante **Segnala** in basso a destra, allega uno screenshot
(anche incollandolo con `Ctrl+V`) e la nota arriva già con la pagina di
provenienza e il nome di chi l'ha scritta.

Chi sviluppa la prende in carico, la chiude indicando come l'ha risolta, o la
elimina. Le concluse restano consultabili con la vista *Concluse*.

Non serve configurare nulla: basta che gli utenti di prova sappiano che il
pulsante c'è. Gli allegati finiscono sul volume, in `/data/uploads/segnalazioni/`.

## 10. Subito dopo l'import

L'import crea 4 project manager storici **disattivati e senza password**: è
corretto, servono solo a tenere assegnato lo storico. Non attivarli senza che
Elettra lo chieda.

Cambia le password degli utenti reali da **Utenti**, se `SEED_PASSWORD` è stata
condivisa in chiaro durante la configurazione.

---

## Cose da non fare

- **Non eseguire `npm run db:seed`** dopo un import reale: cancella tutto e
  riscrive i dati demo. Sul container il seed parte solo al primissimo avvio.
- **Non committare database, file Excel o cartelle di upload.** Il repository è
  pubblico; `.gitignore` e `.dockerignore` già li escludono, non forzarli.
- **Non cambiare `SESSION_SECRET`** su un'istanza già avviata.
- **Non rimuovere il volume** per "ripartire puliti" senza aver salvato i dati:
  non c'è backup automatico.

## Problemi frequenti

**Il container esce subito con `SEED_PASSWORD non impostata`**
Manca la variabile. Impostala, oppure `SEED_ON_FIRST_BOOT=false` se vuoi un
database vuoto e caricare tutto dall'import.

**Il build fallisce scaricando le dipendenze**
Il pacchetto `xlsx` (lettura dei file Excel) viene dal CDN ufficiale di SheetJS,
non dal registry npm. Serve rete verso `cdn.sheetjs.com` durante il build.

**Dopo un redeploy i dati sono spariti**
Il volume su `/data` non era montato. Verifica con
`docker inspect <container> | grep -A5 Mounts`.

**L'import va in timeout dal browser**
Dura ~25 secondi: se il proxy davanti a Coolify ha un timeout più basso, alzalo.
In alternativa si può usare la riga di comando (`npm run db:import`), ma richiede
i file sul server.

**L'assistente AI risponde "non configurato"**
Manca `GEMINI_API_KEY`, oppure è stata cambiata `SESSION_SECRET` dopo che la
chiave era stata salvata da interfaccia. Reinseriscila in **Impostazioni**.

## Backup, minimo indispensabile

Il database è un singolo file dentro il volume:

```bash
docker run --rm -v <nome-volume>:/data -v "$PWD":/backup alpine \
  cp /data/elettra.db /backup/elettra-$(date +%F).db
```

Da fare prima di ogni import con "sostituisci i dati esistenti".
