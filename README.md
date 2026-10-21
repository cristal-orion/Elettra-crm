# CRM Elettra S.r.l.

Cruscotto di controllo per anagrafiche, commesse e acquisti — pensato per
sostituire la gestione a fogli Excel su SharePoint.

Il CRM comprende autenticazione con ruoli, anagrafiche, commesse, acquisti,
catalogo materiali, progetti di cantiere e assistente AI operativo.
Il flusso completo di riferimento è in `../docs/FLUSSO_CRM_ELETTRA.md`
(e nel diagramma visivo `../docs/flusso-crm-elettra.html`).

## Stack

- **Next.js 16** (App Router, React 19, TypeScript) — server components + server actions
- **Prisma 6** ORM — **PostgreSQL 16** in sviluppo e produzione
- **Tailwind CSS v4** — tema rame/slate coerente col diagramma di flusso
- **Autenticazione** custom: sessione JWT (jose) in cookie httpOnly, password con bcrypt

## Requisiti

- Node.js 22+ (richiesto dall'AI SDK 7)
- npm

## Avvio in sviluppo

```bash
# 1. Copia .env.example in .env e genera due segreti casuali indipendenti.
# Avvia il PostgreSQL locale (porta 55432, solo loopback):
docker compose up -d db
# Installa le dipendenze
npm install

# 2. Applica lo schema PostgreSQL
npm run db:migrate      # oppure: npx prisma migrate dev

# 3. Popola dati di esempio (utenti, anagrafiche, commesse)
npm run db:seed

# 4. Avvia il server di sviluppo
npm run dev
```

App su http://localhost:3000 — verrai reindirizzato a `/login`.

Il file `.env` va creato da `.env.example` e non va versionato. Il seed è solo
per sviluppo; in produzione si inizializza un amministratore con `auth:bootstrap`.
La migrazione dell'istanza SQLite esistente è descritta in [DEPLOY.md](DEPLOY.md).

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
| `npm test` | Test di regressione (validazione dati, sessioni, documenti, economics) |
| `npm run test:integration` | Migrazione SQLite, rollback, concorrenza, ricerca e paginazione su PostgreSQL temporaneo |
| `npm run test:ui` | Chromium: ricerca live, filtri, indietro/breadcrumb, scroll e mobile su dati isolati |
| `npm run test:ops` | Immagine Docker, backup Restic e restore completo (richiede build e DB locale) |
| `npm run lint` | Analisi statica del codice applicativo |
| `npm run ai:scheduled` | Esegue i controlli AI programmati dovuti (da pianificare ogni 5 minuti) |
| `npm run build` / `npm start` | Build e avvio di produzione |
| `npm run db:migrate` | Crea/applica migrazioni |
| `npm run db:deploy` | Applica migrazioni esistenti senza reset |
| `npm run db:from-sqlite -- <copia.db> [--execute]` | Analisi/migrazione atomica su PostgreSQL vuoto |
| `npm run auth:bootstrap` | Crea solo il primo amministratore, richiede ADMIN_EMAIL/ADMIN_PASSWORD |
| `npm run db:seed` | Ricarica i dati di esempio (richiede `SEED_PASSWORD`) |
| `npm run db:reset` | Azzera il DB e ri-seeda |
| `npm run db:studio` | Prisma Studio (browser sui dati) |
| `npm run db:import -- <anag.xls> <off.xls>` | Import degli elenchi Excel (`--prova` per l'anteprima) |
| `npm run demo:milestone` | Pianificazione dimostrativa su 4 commesse (`-- --rimuovi` per togliere) |
| `npm run auth:password -- '<password>'` | Ruota la password di tutti gli utenti attivi |

## Collaudo navigazione e ricerca

Per `npm run test:ui`, installare prima Chromium con `npx playwright install chromium`
e avviare il PostgreSQL locale. Come i test integrativi, il collaudo usa uno schema
temporaneo su `TEST_DATABASE_URL` (default: PostgreSQL locale sulla porta 55432),
crea dati sintetici e li rimuove al termine. Avvia una propria istanza Next in
sviluppo su porta loopback libera: eseguirlo senza un altro `next dev` del progetto.

Copre ricerca senza Invio, accenti e parole riordinate, risposte fuori ordine,
Applica/Azzera, lista paginata → dettaglio → indietro, breadcrumb, ingresso diretto
e layout mobile. Include Anagrafiche, Commesse, Progetti, Attività, Notifiche,
Ordini, Materiali, Segnalazioni, Operai, Utenti e Storico prezzi.

Anagrafiche, Commesse/Progetti, Ordini, Materiali, Segnalazioni, Operai e Utenti
cercano prima corrispondenze esatte normalizzate nei filtri attivi. Solo in assenza
di risultati provano un refuso per parola (inserimento, cancellazione, sostituzione
o trasposizione), mostrando un avviso esplicito. Il fallback riguarda token
alfabetici normalizzati di 4–32 lettere, con al massimo 8 token nella query;
numeri e token con punteggiatura, come codici ed email, restano letterali.
Attività, Notifiche e Storico prezzi mantengono la propria semantica di ricerca.

Le liste con ricerca normalizzata contano, ordinano e paginano nel database:
l'applicazione carica al massimo 30 record per pagina. Anche ritardo/urgenza dei
Progetti vengono calcolati nel database, conservando le regole esistenti e
caricando le milestone di dettaglio solo per la pagina corrente. I test PostgreSQL
confrontano il risultato SQL con i calcoli applicativi e verificano i filtri
prima della paginazione e della ricerca approssimata.

Misura locale indicativa su 4.000 anagrafiche sintetiche (19/10/2026): 43 ms per
ricerca esatta, 704 ms per fallback con refuso, conteggio e pagina inclusi.
Non è una misura di produzione: normalizzazione e fallback restano scansioni
senza indici di ricerca dedicati. Sono ancora da verificare volumi, contatti e
concorrenza reali; Storico prezzi conserva l'aggregazione applicativa esistente.

## Progetti e cantieri

La lista combina situazione, avanzamento, PM (anche non assegnato), cliente e
squadra con la ricerca. Il filtro squadra usa il gruppo dell'operaio collegato
alle assegnazioni registrate, anche passate/future: non misura la disponibilità
odierna. I filtri sono applicati nel database prima di conteggio e paginazione.

Il dettaglio ha quattro sezioni condivisibili tramite `?tab=`: Riepilogo con
attività collegate, Avanzamento con pianificazione/milestone, Squadra e Documenti.
I documenti usano lo stesso archivio e le stesse autorizzazioni della commessa;
upload ed eliminazione aggiornano entrambe le viste. Il progetto resta una vista
della commessa e l'avanzamento conserva il calcolo derivato esistente.

Il test Chromium verifica filtri combinati, sezione dopo refresh/indietro,
aggiornamento milestone, upload/download condiviso con la commessa, rifiuto
server dell'upload da utente di sola lettura e sezioni a 390px senza overflow.
Database e allegati del collaudo vengono creati in spazi temporanei isolati.

## Assistente operativo

L'assistente gestisce commesse/clienti, pianificazione, milestone, squadre e
attività con i permessi dell'utente. La chat conserva lo storico e mostra gli
esiti dei tool; importi, cambi di stato commerciale, tipologie ed eliminazioni
producono proposte da confermare, valide per 30 minuti. Le conferme sono legate
all'utente e al contenuto salvato sul server: cambiare i dati nel frattempo
invalida la proposta. Interrompere una risposta non annulla operazioni già salvate.

- Le schede cliente, commessa e progetto hanno azioni AI contestuali.
- **Attività** raccoglie follow-up e prossimi passi con responsabile/scadenza.
- **Assistente → Controlli programmati** configura riepiloghi con notifiche interne.
- I PDF materiali mostrano un confronto dei valori prima di applicare l'estrazione.

Aggiornamento di un'istanza esistente, senza azzerare i dati:

```bash
npx prisma generate
npx prisma migrate deploy
npm run build
```

La migrazione `20260917090000_assistente_operativo` aggiunge cronologia, registro
operazioni, attività, pianificazioni e notifiche. Per i controlli automatici
vedere [DEPLOY.md](DEPLOY.md#controlli-ai-programmati).

### Limiti operativi AI

Chat: massimo 100 messaggi per conversazione, ultimi 30 messaggi nel contesto
del modello (entro 180.000 caratteri), 10 passaggi modello, 30 operazioni e 3
documenti per richiesta, timeout 120 secondi. Analisi contestuali: timeout 60
secondi e 10 richieste ogni 15 minuti per utente. Il limite della chat è 60
messaggi registrati ogni 15 minuti per utente. I PDF analizzati dalla chat
devono essere al massimo 10 MB. Lo storico e gli esiti completati rimangono
consultabili anche quando il modello o la connessione non rispondono.

Le analisi contestuali ritentano gli errori transitori del provider fino a tre
volte con attese progressive (entro il timeout complessivo). Se Gemini resta
indisponibile, il pannello distingue sovraccarico, quota, configurazione e risposta
incompleta; permette di riprovare la stessa richiesta rispettando una breve attesa.
Il registro operazioni riporta il codice di errore; i log `[ai.analysis]` includono
anche l'eventuale stato HTTP del provider, senza prompt, documenti o credenziali.

Il toolset disponibile dipende dal ruolo; ogni scrittura riverifica l'utente
attivo nel database. I tool usano gli stessi servizi dei form (`src/lib/crm/`).
Le proposte commerciali sono record `AiOperation` persistenti e vengono
confermate tramite endpoint autenticato, senza accettare comandi dal browser.
Gli esiti dei tool nel client sono presentazione: lo storico autorevole è nel DB.

## Struttura applicativa

```
src/
  app/
    login/                 # pagina e azioni di login/logout
    (app)/                 # area protetta (shell con sidebar)
      page.tsx             # dashboard (KPI, pipeline, commesse recenti)
      anagrafiche/         # modulo Clienti/Fornitori (lista, nuova, dettaglio, modifica)
      commerciale/        # opportunità, Kanban/elenco, contatti e conferma incarico
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

## Anagrafiche già presenti

In creazione, modifica e nel modulo precompilato da visura, il controllo live
propone fino a cinque schede simili dopo 300 ms di pausa nella compilazione.
Confronta ragione sociale (accenti, parole riordinate, sigle societarie e un refuso
per parola), P. IVA/CF esatti ignorando spazi esterni e maiuscole, email e telefono.
I contatti vengono cercati anche nei referenti delle schede esistenti; i numeri
ignorano separatori e la differenza tra `+` e `00`, senza inferire il prefisso paese.
Le corrispondenze fiscali hanno priorità; ogni suggerimento spiega il motivo.

Il controllo è consultivo: non fonde schede e non blocca gli omonimi. Il servizio
di salvataggio conserva il controllo fiscale transazionale e la gestione dei
duplicati storici invariati. In modifica la scheda corrente è esclusa dai suggerimenti.
L'apertura dei risultati in un'altra scheda conserva il modulo in compilazione.

L'endpoint `POST /anagrafiche/simili` è di sola lettura, riservato a Super Admin e
Backoffice, con verifica sessione/origine, input limitato e risposta `no-store`.
La ricerca è PostgreSQL senza modifiche allo schema né servizi AI; rimane una
scansione normalizzata da valutare sui volumi reali. I test PostgreSQL dedicati
sono in `scripts/anagrafica-duplicates.test.ts` (`npm run test:integration`).

## Dashboard: Da fare oggi

Il riquadro iniziale mostra le attività assegnate all'utente corrente, anche per
gli amministratori. I quattro contatori aprono le liste personali di attività
scadute, in scadenza oggi, nei prossimi sette giorni (da domani) e senza data.
Il totale delle attività aperte include anche quelle pianificate oltre sette giorni.

L'anteprima contiene al massimo sei attività scadute o in scadenza oggi, dalla
scadenza più vecchia; il link «Vedi tutte» apre il filtro `scadenza=entro_oggi`,
disponibile anche nella lista e nella stampa. Conteggi e anteprima vengono letti
nella stessa transazione e riusano `attivitaWhere` e il giorno italiano.

«Segna completata» usa l'azione attività esistente con controllo autorizzazioni
e versione; l'attività scompare dall'anteprima e i conteggi vengono aggiornati.
I collegamenti portano alla scheda attività, commessa o cliente. Il riquadro
personale è una prima tranche della home operativa, disponibile per tutti i ruoli.

`src/lib/today-tasks.test.ts` verifica perimetro, soglie temporali, conteggi,
destinazioni, limite anteprima e completamento. Il collaudo Chromium include
navigazione da tastiera, ritorno al cruscotto, stampa coerente e mobile a 390 px.

## Tariffari cliente e consuntivi ore/materiali

Da **Anagrafiche → cliente → Tariffario cliente** si configurano fino a 50 mansioni
con tariffe ordinarie, straordinarie feriali e straordinarie festive, e fino a 500
materiali del catalogo con ricarico specifico per cliente. Le tariffe orarie sono
valori di addebito al cliente, distinti dai costi interni del personale.

Da **Commesse → dettaglio → Consuntivo ore e materiali** si compila un rendiconto
per lavoro, con data, note e fino a 200 righe. Il tariffario propone i valori delle
nuove righe; ore, quantità, tariffe applicate, costo base unitario e ricarichi sono
modificabili per quel lavoro. Il costo base materiale va inserito esplicitamente;
il prezzo applicato è `costo base × (1 + ricarico / 100)`. La fonte tariffaria e la
descrizione sono conservate sulle righe: una revisione del listino vale per nuove
righe e non rivaluta quelle già salvate. Per cambiare la mansione, fascia o voce
di una riga salvata si rimuove la riga e se ne aggiunge una nuova.

Calcoli server con decimali: prezzo unitario a 4 cifre decimali, importo riga a
2 cifre (`ROUND_HALF_UP`), totale come somma delle righe. I totali visualizzati
sono quelli dell'ultimo salvataggio; la stampa riporta quantità, prezzi e importi
applicati. Il rendiconto è la base ore/materiali e non emette una fattura né
calcola IVA, SAL o margini completi di commessa. Le sue somme non vengono
copiate automaticamente negli importi offerta/ordine o nei KPI esistenti.

**Autorizzazioni:** Super Admin e Backoffice gestiscono il tariffario; gli stessi
ruoli e i Project Manager compilano i consuntivi. Gli altri ruoli autenticati
consultano e stampano, coerentemente con la visibilità economica esistente.
Il servizio riverifica ruolo e account attivo dentro la transazione.

Ogni modifica effettiva produce una revisione con autore, ruolo, data e valori
prima/dopo, consultabile nello **Storico modifiche** (20 revisioni per pagina).
Il registro applicativo non espone azioni di modifica/eliminazione; il nome
storico dell'autore resta leggibile anche dopo la cancellazione dell'account.
Scrittura e audit sono atomici in transazione Serializable. Le versioni impediscono
sovrascritture da moduli obsoleti; gli errori conservano i dati del form. A consuntivo
creato, il cliente della commessa resta vincolato a quello del rendiconto.

La migrazione additiva `20261021140000_tariffari_consuntivi` introduce tre tabelle,
senza riclassificare i record storici `C`/`CONSUNTIVO` o cambiare la regola P→C.
Il test `src/lib/consuntivi.test.ts` usa PostgreSQL isolato e copre calcoli, audit,
rollback, override, versioni e autorizzazioni. `npm run test:ui` verifica anche
default, fasce, salvataggi successivi, conflitti, lettura/stampa e mobile.

## Commerciale: dal contatto alla commessa

**Commerciale** gestisce nuove opportunità distinte dalle commesse. Le fasi iniziali
sono Lead → Contattato → Qualificato → Preventivo → Offerta inviata → Negoziazione →
Vinta/Persa. Il Super Admin personalizza nomi e ordine, aggiunge fasi aperte o di
offerta inviata e disattiva quelle inutilizzate. La categoria semantica è stabile:
Vinta e Persa restano disponibili, una fase in uso va prima svuotata.

La vista **Kanban** mostra fino a dieci schede per fase e permette di spostarle
con il comando «Sposta fase», utilizzabile anche da tastiera/mobile. «Mostra tutte»
apre l'elenco paginato da 30 righe. Ricerca normalizzata, filtri cliente/responsabile,
fase, situazione e periodo di creazione, ordinamento e ritorno alla lista seguono
i componenti condivisi. I contatori coprono l'intero risultato, non la sola pagina.

Ogni opportunità collega un cliente o un **potenziale cliente** dell'anagrafica
unica, un referente della stessa azienda, responsabile, origine, descrizione,
valore previsto e dati di offerta. Una società può essere potenziale cliente e
fornitore. Il potenziale cliente non riceve il codice C fino alla promozione;
ricerca e controllo duplicati delle anagrafiche restano disponibili.

Nella scheda si registrano chiamate, email, incontri, sopralluoghi e note con data
effettiva, esito e indicazione «Risposta ricevuta». Il prossimo contatto genera
una sola **Attività**, condivisa con agenda, notifiche, lista e stampa. Le attività
rispettano il perimetro personale/team esistente. La cronologia, 20 eventi per
pagina, conserva autore, ruolo, data di registrazione e valori prima/dopo delle
modifiche commerciali; i nomi storici restano anche eliminando un account.
L'eliminazione del responsabile richiede un subentrante abilitato e registra il
trasferimento. Gli allegati usano archivio, download e permessi documentali comuni.

### Conferma incarico

- «Vinta» si raggiunge con **Conferma incarico e crea commessa**, inserendo data,
  riferimento, canale della conferma, importo effettivo e PM facoltativo. Per
  Preventivo/Gara servono riferimento, importo e data di invio offerta completi.
  L'importo suggerito dall'offerta resta modificabile e richiede conferma esplicita.
- Il **Consuntivo** consente la conferma diretta senza offerta e senza importo:
  il valore sarà determinato dal lavoro effettivo. La stima commerciale non diventa
  automaticamente un ricavo approvato.
- Transazione Serializable, versione ottimistica e relazione univoca rendono
  conversione e retry idempotenti. Il cliente potenziale viene promosso sullo
  stesso record dopo il controllo fiscale; eventuali duplicati richiedono di
  ricollegare la trattativa al cliente esistente.
- La commessa nasce in `ORDINE_CONFERMATO` con cliente, referente, descrizione,
  tipologia e dati offerta/conferma. File e attività conservano l'identificativo
  originale e risultano collegati anche alla commessa; il link di origine è
  bidirezionale. Il cliente della commessa convertita rimane vincolato.
- «Persa» richiede il motivo; si può riaprire conservando la cronologia. La
  trattativa già convertita resta consultabile con nuovi contatti/allegati,
  mentre i dati dell'incarico si gestiscono nella commessa.

### Indicatori e permessi

Valore pipeline = somma dei **valori previsti delle aperte** (le stime mancanti
sono contate separatamente). Tasso di successo = vinte / (vinte + perse), vuoto
se non ci sono chiuse. Le offerte senza risposta sono aperte con invio da almeno
7 giorni e senza risposta registrata da quella data; una revisione dei dati offerta
azzera la risposta precedente. «Ferme» significa oltre 14 giorni dall'ultima
interazione o passaggio di fase. I prossimi contatti usano il giorno italiano:
entro oggi, oppure da domani ai successivi sette giorni. L'attività assegnata ad
altri produce la notifica esistente; le scadenze usano i promemoria giornalieri
già configurati. Tutti gli indicatori rispettano i filtri correnti.

Super Admin, Backoffice e PM gestiscono trattative, contatti e conferme;
configurazione fasi riservata al Super Admin. Gli altri utenti autenticati leggono;
gli allegati seguono `puoGestireDocumenti`. Ogni mutazione verifica ruolo e account
attivo sul server. Le versioni impediscono aggiornamenti obsoleti; contatto e
follow-up sono atomici e una chiave richiesta impedisce duplicati su retry.

La migrazione additiva `20261021150000_commerciale` crea fasi, opportunità e timeline,
aggiungendo i collegamenti a documenti/attività/commesse e il ruolo prospect.
Le vecchie commesse non sono convertite né reinterpretate: i KPI Commerciale
riguardano le nuove opportunità, quelli storici restano basati sulle commesse.
La mappatura storica, l'integrazione del nuovo dominio nei tool Elettro e il
cruscotto unificato appartengono alle tranche successive. L'import SQLite
conserva la configurazione fasi installata dalla migrazione quando assente dalla
sorgente, richiedendo comunque tutte le tabelle operative di destinazione vuote.

Verifiche: `src/lib/commerciale.test.ts` copre il flusso su PostgreSQL isolato,
conversioni concorrenti, rollback, permessi, audit, filtri e conteggi oltre pagina.
`npm run test:ui` include prospect → interazione/follow-up → allegato → cambi fase
→ conversione, conflitto tra due schede, navigazione, autorizzazione server e 390 px.
`npm run test:ui:commerciale` esegue solo questo percorso su dati isolati.
Il superamento dei test tecnici non sostituisce l'accettazione con casi aziendali.

## Ruoli e permessi (Fase 1)

- **Super Admin** (Fabio): accesso completo, gestione utenti e configurazione.
- **Backoffice**: crea/modifica anagrafiche.
- **Project Manager / Ufficio Tecnico / Amministrazione**: lettura.

La creazione/modifica anagrafiche è consentita a Super Admin e Backoffice
(`puoGestireAnagrafiche` in `src/lib/enums.ts`).

## Note tecniche

- **PostgreSQL**: baseline dedicata, storico SQLite archiviato e script di
  migrazione dati con confronto integrale. Non basta cambiare il DSN di un DB SQLite.
- **Produzione**: no seed automatico, container non-root, login limitato nel DB,
  revoca sessioni al cambio credenziali/ruolo, CSRF su origine canonica e CSP con nonce.
- **Backup**: strumenti Compose per DB+allegati, copia cifrata Restic e restore
  su destinazione vuota. Configurazione e attivazione reali in [DEPLOY.md](DEPLOY.md).
- **Codici C/F**: assegnati automaticamente alla creazione (`C####` per i
  clienti, `F####` per i fornitori). Una stessa azienda può avere entrambi.
- **Referenti normalizzati**: titolo obbligatorio da lista predefinita.

## Prossime fasi (dal flusso)

2. **Pipeline offerte** — commesse, numerazione `AA+NNNN`, stati P/C, invio, follow-up
3. **Acquisti & Regole** — ordini fornitori + **regola bloccante P → C** + storico prezzi
4. **Documentale** — auto-cartelle e upload PDF/disegni/foto
5. **Statistiche** — dashboard cliente-centrica, conversione, fatturato
6. **Integrazioni** — Mexal (Passepartout) + magazzino
