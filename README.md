# CRM Elettra S.r.l.

Cruscotto di controllo per anagrafiche, commesse e acquisti — pensato per
sostituire la gestione a fogli Excel su SharePoint.

Questa è la **base di funzionamento (Fase 1)**: fondamenta del progetto,
autenticazione con ruoli e modulo Anagrafiche Clienti/Fornitori.
Il flusso completo di riferimento è in `../docs/FLUSSO_CRM_ELETTRA.md`
(e nel diagramma visivo `../docs/flusso-crm-elettra.html`).

## Stack

- **Next.js 16** (App Router, React 19, TypeScript) — server components + server actions
- **Prisma 6** ORM — **SQLite** in sviluppo, **PostgreSQL**-ready in produzione
- **Tailwind CSS v4** — tema rame/slate coerente col diagramma di flusso
- **Autenticazione** custom: sessione JWT (jose) in cookie httpOnly, password con bcrypt

## Requisiti

- Node.js 20+ (testato su 22)
- npm

## Avvio in sviluppo

```bash
# 1. Installa le dipendenze
npm install

# 2. Crea il database SQLite e applica lo schema
npm run db:migrate      # oppure: npx prisma migrate dev

# 3. Popola dati di esempio (utenti, anagrafiche, commesse)
npm run db:seed

# 4. Avvia il server di sviluppo
npm run dev
```

App su http://localhost:3000 — verrai reindirizzato a `/login`.

> Il file `.env` (con `DATABASE_URL` e `SESSION_SECRET`) è già presente in questo
> ambiente. In un clone pulito va ricreato prima del passo 2.

## Credenziali di sviluppo

La password **non è scritta qui**: il repository è pubblico. Il seed la prende da
`SEED_PASSWORD` nel file `.env` (gitignorato) e si interrompe se manca. Per
ruotarla su un'istanza già avviata: `npm run auth:password -- '<password>'`.

Utenti creati dal seed, tutti con quella password:

| Ruolo | Email |
|---|---|
| Super Admin | `fabio.greco@elettra.it` |
| Backoffice | `roberto.baldares@elettra.it` |
| Project Manager | `tommaso.esposito@elettra.it` · `gianluca.marseglia@elettra.it` · `giuseppe.fiorino@elettra.it` |
| Ufficio Tecnico | `ufficio.tecnico@elettra.it` |
| Amministrazione | `amministrazione@elettra.it` |

## Script utili

| Comando | Descrizione |
|---|---|
| `npm run dev` | Server di sviluppo |
| `npm run build` / `npm start` | Build e avvio di produzione |
| `npm run db:migrate` | Crea/applica migrazioni |
| `npm run db:seed` | Ricarica i dati di esempio (richiede `SEED_PASSWORD`) |
| `npm run db:reset` | Azzera il DB e ri-seeda |
| `npm run db:studio` | Prisma Studio (browser sui dati) |
| `npm run db:import -- <anag.xls> <off.xls>` | Import degli elenchi Excel (`--prova` per l'anteprima) |
| `npm run demo:milestone` | Pianificazione dimostrativa su 4 commesse (`-- --rimuovi` per togliere) |
| `npm run auth:password -- '<password>'` | Ruota la password di tutti gli utenti attivi |

## Struttura

```
src/
  app/
    login/                 # pagina e azioni di login/logout
    (app)/                 # area protetta (shell con sidebar)
      page.tsx             # dashboard (KPI, pipeline, commesse recenti)
      anagrafiche/         # modulo Clienti/Fornitori (lista, nuova, dettaglio, modifica)
  components/              # nav, badge riutilizzabili
  lib/
    prisma.ts              # client Prisma (singleton)
    session.ts             # sessione JWT (cookie)
    dal.ts                 # data access layer + guardie di autorizzazione
    enums.ts               # valori "a scelta chiusa" + permessi
    format.ts              # formattazione euro/date/decimali
  proxy.ts                 # redirect ottimistico login (ex middleware)
prisma/
  schema.prisma            # modello dati
  seed.ts                  # dati di esempio
```

## Ruoli e permessi (Fase 1)

- **Super Admin** (Fabio): accesso completo, gestione utenti e configurazione.
- **Backoffice**: crea/modifica anagrafiche.
- **Project Manager / Ufficio Tecnico / Amministrazione**: lettura.

La creazione/modifica anagrafiche è consentita a Super Admin e Backoffice
(`puoGestireAnagrafiche` in `src/lib/enums.ts`).

## Note tecniche

- **SQLite → PostgreSQL**: lo schema è compatibile. Per la produzione basta
  cambiare `provider` e `url` in `prisma/schema.prisma` / `.env` e rilanciare le
  migrazioni. I campi "a scelta chiusa" (ruolo, stato, tipologia, titolo) sono
  `String` validati in `src/lib/enums.ts` perché SQLite non supporta gli enum
  nativi: su Postgres si possono promuovere a `enum`.
- **Codici C/F**: assegnati automaticamente alla creazione (`C####` per i
  clienti, `F####` per i fornitori). Una stessa azienda può avere entrambi.
- **Referenti normalizzati**: titolo obbligatorio da lista predefinita.

## Prossime fasi (dal flusso)

2. **Pipeline offerte** — commesse, numerazione `AA+NNNN`, stati P/C, invio, follow-up
3. **Acquisti & Regole** — ordini fornitori + **regola bloccante P → C** + storico prezzi
4. **Documentale** — auto-cartelle e upload PDF/disegni/foto
5. **Statistiche** — dashboard cliente-centrica, conversione, fatturato
6. **Integrazioni** — Mexal (Passepartout) + magazzino
