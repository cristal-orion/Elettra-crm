# Operatività cantiere — implementazione e collaudo

Stato al 30 ottobre 2026. La release operativa `b461bf9` e la tranche SAL ponderato / personale / squadre `dee2080` sono pubblicate. L'utente ha confermato online il SAL al 10%, salvataggio, riepilogo e storico e ha autorizzato la successiva modifica multisquadra con avvisi non bloccanti. Questa tranche è sviluppata nella worktree `elettra-crm-sal-risorse`, branch `feat/sal-risorse`; il redeploy sarà avviato dall'utente. Il commit chatbot locale `66b0c12` non è incluso nel branch.

## Percorso disponibile

1. **Progetti → cantiere → Aggiorna SAL:** modifica delle milestone reali, anteprima percentuale, data, nota e foto/PDF; storico con autore e valori prima/dopo.
2. **Segnala problema:** descrizione, priorità, responsabile, scadenza e allegati; creazione facoltativa di un'attività nell'agenda del responsabile.
3. **Problema → attività → notifiche:** assegnazione e aggiornamenti notificati; risoluzione/riapertura, responsabile e scadenza sincronizzati con l'attività. L'attività collegata rimanda al problema per gli aggiornamenti.
4. **Cruscotto:** cantieri aperti, in ritardo e sospesi, problemi aperti, agenda personale, pipeline commerciale e consuntivi reali per i ruoli autorizzati. Indicatori collegati agli elenchi filtrati.
5. **Elettro:** letture contestuali di cantieri, SAL, problemi e consuntivi; fonti e data della lettura, conversazioni riutilizzabili quando il perimetro autorizzativo resta compatibile.
6. **Risorse e squadre:** sezioni Assegnazioni, Personale e Squadre; creazione/modifica del personale, composizione e archiviazione delle squadre centrali, assegnazione completa dal cantiere e adattamenti individuali di date, ruolo e note.

La sospensione/ripresa del cantiere dispone di un motivo e di uno storico dedicato.

## Convenzioni operative

- Cantiere e commessa sono viste della stessa entità; la sospensione è separata dallo stato commerciale.
- SAL = somma dei giorni lavorativi previsti delle milestone reali completate / somma dei giorni previsti di tutte le milestone reali, moltiplicata per 100. Durata esplicita `durataGiorni`, anche frazionaria, nell'intervallo 0,125–36.500 giorni: non viene ricavata automaticamente dalle date.
- La percentuale è arrotondata all'intero e limitata a 99 finché resta una fase incompleta. Solo `COMPLETATA` contribuisce al SAL: `IN_CORSO` e tempo trascorso non assegnano avanzamento parziale. Esempio: sopralluogo completato da 1 giorno e lavorazione incompleta da 9 giorni danno 10%.
- Senza milestone reali o con almeno una durata mancante il SAL è **non disponibile**, distinto da 0%, e il salvataggio è bloccato fino al completamento della pianificazione. Le milestone dimostrative non contribuiscono né al SAL né ai ritardi delle milestone. I dati preesistenti restano senza durata finché pianificati esplicitamente.
- La data del SAL non può essere futura. I nuovi snapshot registrano durate e metodo `DURATA_GIORNI_V1`; un nuovo aggiornamento o una ripianificazione non riscrive lo storico. La UI distingue il metodo ponderato dal precedente a peso uguale.
- Problemi di cantiere e Segnalazioni software sono moduli separati.
- Creare un'attività dal problema richiede responsabile e scadenza. Finché l'attività resta collegata, questi due campi sono obbligatori anche negli aggiornamenti del problema.
- I consuntivi del cruscotto sono valori di ore/materiali **al cliente**, per data del rendiconto: non sono costi interni, acquisti, ordini acquisiti o incassi. L'assenza di rendiconti non viene rappresentata come importo zero.
- Risorse senza assegnazioni registrate non sono automaticamente disponibili. Assegnazioni senza estremi temporali occupano il periodo aperto; quelle dei cantieri sospesi restano visibili.
- Ogni persona può appartenere a più squadre centrali, PM e operai inclusi, senza categorie speciali da autorizzare. Assegnare la squadra aggiunge atomicamente i membri attivi e consente impegni contemporanei: l'avviso elenca le persone coinvolte senza bloccare il salvataggio. Le persone già nel cantiere mantengono date, ruolo e note locali e non sono duplicate da squadre con membri condivisi.
- Gli avvisi considerano gli estremi inclusivi e le date mancanti come intervalli aperti. Si confrontano con i cantieri acquisiti ancora aperti, anche sospesi; sono esclusi quelli conclusi o fatturati. Compaiono nei risultati delle assegnazioni individuali/complete e sono ricalcolati nella scheda Squadra e nel dettaglio economico della commessa, anche all'arrivo dal wizard e dopo refresh.
- Le modifiche alla composizione e l'archiviazione della squadra centrale valgono per nuove assegnazioni. Le altre appartenenze e le assegnazioni nei cantieri sono conservate. Personale con assegnazioni viene disattivato invece di eliminato. Le squadre archiviate già associate possono essere mantenute, ma non aggiunte a nuove persone.
- Numero cantiere, cliente e luogo effettivo compaiono nelle assegnazioni autorizzate. Il luogo usa `Commessa.indirizzoCantiere`, modificabile dalla pianificazione e ricercabile in Progetti; nessun ripiego automatico sulla sede cliente.
- `/risorse/operai` mantiene attiva la voce Risorse e squadre. `/progetti/operai` reindirizza conservando i parametri della lista. I link periodo dei consuntivi in dashboard usano `scroll={false}`.

## Permessi

| Area | Convenzione implementata |
| --- | --- |
| Gestione SAL, sospensione e problemi | Super Admin, Backoffice, Project Manager e Ufficio Tecnico |
| Gestione personale e squadre centrali | Super Admin, Backoffice e Project Manager |
| Assegnazione squadre ai cantieri | Super Admin, Backoffice, Project Manager e Ufficio Tecnico, nel perimetro commessa |
| Perimetro PM | Commesse assegnate al PM oppure con almeno un problema assegnatogli |
| Lettura economica | Super Admin, Backoffice e Amministrazione |
| Gestione commesse e acquisti | Super Admin e Backoffice |
| Attività | Personali; gestione team secondo i permessi esistenti. Attività commerciali escluse dai ruoli non economici |

Il perimetro PM è basato sull'assegnatario, anche per problemi risolti: la sola risoluzione non revoca l'accesso. Una riassegnazione può invece rimuoverlo.

I controlli sono applicati nelle query, nelle azioni server, nei download, nelle stampe e negli strumenti AI. Conteggi e paginazione seguono il perimetro visibile. Le assegnazioni di altri cantieri in Risorse mostrano l'occupazione senza identificarli.

Gli upload generici operativi consentono foto e disegni; nuovi PDF/foto possono essere salvati attraverso SAL e Problemi. Un PM non può collegare un allegato economico preesistente per renderlo accessibile tramite il SAL. Limite dei form operativi: 5 file, 20 MB complessivi.

Le notifiche ricalcolano l'accesso anche ai titoli salvati in passato. `AiConversation.accessKey` e `AiOperation.accessKey` impediscono il riuso dello storico dopo cambi incompatibili di ruolo/perimetro PM; le conversazioni legacy senza chiave sono ammesse solo ai ruoli economici. L'eliminazione account trasferisce problemi e attività, incrementa le versioni e conserva l'audit.

## Persistenza e concorrenza

- Servizi operativi in `src/lib/cantiere.ts`, schemi di input in `src/lib/cantiere-schema.ts`.
- Azioni e upload in `src/app/(app)/progetti/operativo-actions.ts`.
- Transazioni serializzabili, versioni ottimistiche e identificativo richiesta con fingerprint dei dati.
- Il reinvio della stessa richiesta recupera l'esito senza duplicare storico, attività, notifiche o allegati; riusare la richiesta con contenuto diverso viene rifiutato.
- File nuovi rimossi in caso di rollback; file riutilizzati nei retry e copie concorrenti inutilizzate ripulite.
- Migrazione operativa `20261029100000_operativita_cantiere`: storico SAL/sospensioni, problemi/eventi, collegamenti documenti/attività, deduplicazione notifiche e chiavi di accesso AI; già applicata in produzione con `b461bf9`.
- Migrazione `20261029140000_sal_durata_squadre`, pubblicata con `dee2080`: durata nullable con vincolo DB, tabella `Squadra` e conversione esatta dei raggruppamenti preesistenti, anche di personale inattivo. Assegnazioni e snapshot rimangono intatti.
- Migrazione `20261030120000_personale_multisquadra`: crea la relazione molti-a-molti `_ComponentiSquadra`, copia ogni appartenenza dalla precedente FK `Operaio.squadra`, poi elimina la colonna. Conserva ID, metadati, squadre archiviate, personale inattivo, assegnazioni e storico. PK composta e indice inverso coerenti con Prisma 6.
- L'import SQLite storico trasforma la colonna `Operaio.squadra` in appartenenze e verifica il digest delle relazioni, mantenendo nomi esatti e timestamp delle persone; dry run senza scritture e import in un'unica transazione.
- Servizi personale/squadre in `src/lib/risorse.ts`: transazioni serializzabili, controllo versioni di personale e squadra, rollback dell'assegnazione completa. Cambiare un membro invalida la versione della squadra; cambiare la composizione invalida le versioni delle persone coinvolte.
- L'entrypoint Docker esegue `prisma migrate deploy` all'avvio con `RUN_MIGRATIONS=true` (valore predefinito). Il prossimo redeploy applicherà la migrazione multisquadra prima di avviare la nuova versione dell'applicazione.

## Collaudo eseguito

### Tranche multisquadra e avvisi non bloccanti (30 ottobre 2026)

| Controllo | Esito |
| --- | --- |
| `npm test` | 150/150 passati |
| Ricerca e duplicati PostgreSQL | 12/12 passati; ricerca per entrambe le squadre e filtri progetto senza duplicati |
| `npx tsx --test scripts/production.test.ts src/lib/risorse.test.ts` | 17/17 passati nel run finale: import SQLite, schema Prisma senza drift, catena migrazioni, appartenenze multiple, concorrenza, privacy e storico |
| `npm run lint`, `npx tsc --noEmit` | Passati; ricontrollati anche gli ultimi script UI |
| `npm run build` | Passato; restano i 2 warning di tracing del client Prisma generato |
| `UI_PRODUCTION=1 npm run test:ui` | Suite completa passata, compresi wizard con impegno contemporaneo e flusso operativo SAL/problemi |
| `UI_PRODUCTION=1 UI_SUITE=risorse npm run test:ui` | Passata: stessa persona in due squadre, modifica appartenenze, assegnazione sovrapposta salvata, avviso persistente, modifiche locali conservate, privacy PM, testo Excel rimosso e 18 viste responsive |
| Inspector e controllo immagini | 0 FAIL / 0 WARN su Squadra del cantiere e composizione squadra a 1440/768/390 px; esaminate 12 tavole e 3 schermate aggiuntive del form personale aperto |
| `git diff --check` | Passato |

Durante i controlli sono stati corretti la fixture SQLite (la tabella storica delle assegnazioni non ha `updatedAt`), la PK composta della relazione implicita richiesta da Prisma 6, l'attesa effettiva della risposta al salvataggio nel test browser e il conteggio delle assegnazioni preesistenti nella fixture wizard. I test interessati sono stati rieseguiti con esito positivo.

Direzione Accent ladder, seed `2089620649`, palette e caratteri brand mantenuti. La composizione squadra risponde a «chi fa parte di questa squadra, anche se appartiene ad altre?»; il form personale a «quali squadre devo associare?»; la scheda cantiere a «chi è assegnato e quali impegni vanno coordinati?». Checkbox plurime con etichette leggibili, avviso ambra informativo distinto dall'esito di successo, campi a una colonna su telefono e due/tre su tablet/desktop. Nessun controllo inspector disabilitato. Il pulsante globale Segnala conserva il limite di sovrapposizione già annotato sotto; i nuovi campi e avvisi restano raggiungibili scorrendo.

Log in `/tmp/opencode/multisquadra-*.log`, screenshot in `/tmp/opencode/multisquadra-inspect/`. Decisioni e implementazione registrate su Hindsight (memoria di riferimento `68a3c40b-c826-489c-8fee-36b2288bc52a`). Migrazione verificata soltanto su schemi temporanei: l'applicazione in produzione avverrà con il redeploy dell'utente.

### Tranche SAL/personale precedente (`dee2080`)

| Controllo | Esito |
| --- | --- |
| `npm test` | 144/146 al primo run: unica causa, fixture del nuovo test SAL priva di `nota`; corretta e riverificata nel test mirato |
| `npx tsx --test src/lib/risorse.test.ts` | 8/8 passati, inclusa migrazione legacy aggiunta dopo il run generale |
| `npm run test:integration` | 18 test passati |
| `npm run lint` | Passato |
| `npm run build` | Passato, inclusa verifica TypeScript; 2 warning di tracing nel client Prisma generato |
| `UI_PRODUCTION=1 npm run test:ui` | Suite completa passata |
| `UI_PRODUCTION=1 UI_SUITE=operativo npm run test:ui` | Passata anche dopo l'ultima rifinitura visuale SAL |
| `UI_PRODUCTION=1 UI_SUITE=risorse npm run test:ui` | Passata: personale → squadra → cantiere → modifica locale, coerenza SAL, privacy PM, redirect, navigazione e scroll dashboard |
| Browser a 1440 / 768 / 390 px | 18 viste responsive Risorse/SAL, oltre alle 15 della suite operativa |

La suite completa comprende navigazione/back e filtri, anagrafiche, progetti, agenda, consuntivi, Commerciale e wizard commessa. La suite operativa prova PM → SAL/allegato → risposta persa/retry → conflitto/rollback → problema/attività/notifica/risoluzione, dinieghi economici e 15 viste responsive.

Le prove AI verificano strumenti, autorizzazioni, cronologia e integrazione UI/SDK con risposte controllate. Non costituiscono un collaudo live del provider esterno.

Log della tranche in `/tmp/opencode/sal-risorse-*.log`; screenshot/report in `/tmp/opencode/sal-risorse-inspect/`. I precedenti artefatti operativi sono in `/tmp/opencode/elettra-ui-final/`. Sono artefatti temporanei dell'ambiente di sviluppo.

## Verifica UI/UX

Direzione **Accent ladder**, seed `2089620649`, palette e caratteri del brand mantenuti, senza ridisegni della direzione. Blu Elettra su SAL e azioni, fondi chiari e contrasto corretto; sidebar brand esistente preservata. Elemento specifico: SAL derivato dalle milestone del cantiere e percorso problema → attività → risoluzione.

Domanda principale di ciascuna schermata:

- Cantiere: a che punto siamo e quale aggiornamento serve?
- SAL: quali milestone sono cambiate e quale percentuale verrà registrata?
- Problema: chi interviene, entro quando e con quale esito?
- Cruscotto: quali cantieri e attività richiedono attenzione oggi?
- Risorse: quali assegnazioni risultano registrate per questa squadra e questo periodo?

### Critica finale delle schermate

- Titoli, riferimenti al cantiere e CTA sono riconoscibili al primo sguardo. Percentuale SAL e conteggi derivano dai dati; nella fixture 1 giorno completato su 83 previsti dà 1%, mentre le quattro fasi mostrano durate e pesi differenti.
- Margini e pannelli restano allineati; campi e azioni mantengono dimensioni utilizzabili al tocco. Il riepilogo SAL non spezza più la dicitura in righe troppo distanti.
- Stato e azione primaria sono distinguibili senza basarsi solo sul colore. Gli zeri rimangono zeri; dati economici mancanti e SAL assente sono dichiarati.
- Menu ripiegato anche sul tablet; apertura/chiusura da tastiera e navigazione controllate. Filtri Risorse richiudibili sul telefono: la prima risorsa torna nella prima schermata. Il problema offre un collegamento iniziale diretto al form di aggiornamento.
- Personale, elenco squadre e squadra del cantiere verificati anche con form aperti a tutte e tre le larghezze (nove screenshot aggiuntivi). I campi passano a una colonna sul telefono; azioni e assegnazioni rimangono leggibili. La scheda squadra distingue composizione centrale e modifiche nel cantiere.
- Il cruscotto mobile resta una vista verticale articolata; la pianificazione risorse è un elenco di assegnazioni, non ancora un calendario completo.

Inspector della tranche sulla build production locale: **0 FAIL, 0 WARN** in Risorse, dettaglio squadra e form SAL, ciascuno a 1440/768/390 px. Aperte le nove immagini iniziali e le nove tavole con le viste scorse. Nessun controllo disabilitato. Il pulsante globale «Segnala», fisso in basso a destra, può sovrapporsi a contenuti durante lo scorrimento; resta un limite della cornice applicativa esistente.

La fixture di `scripts/operativo-preview.ts` contiene Officina Nord, Marco Rinaldi, Luca Marini, Giulia Ferri, Paolo Bassi, le squadre Installazioni e Manutenzione, due cantieri con un componente condiviso e impegni contemporanei, quattro milestone e un problema: dati esclusivamente di collaudo in uno schema temporaneo, non contenuto da caricare in produzione.

## Anteprima locale riproducibile

Con Postgres di test disponibile:

```sh
npm run build
PREVIEW_PRODUCTION=1 npx tsx scripts/operativo-preview.ts
```

Aprire `http://127.0.0.1:3218/progetti/preview-cantiere`. L'anteprima usa un proxy autenticato solo su loopback, un database temporaneo e upload isolati. SIGINT/SIGTERM del processo preview pulisce schema e file temporanei. L'ID del problema viene stampato all'avvio.

Per convivere con un'altra anteprima, usare `PREVIEW_PORT=3237`: applicazione sulla porta 3237 e proxy autenticato sulla 3238. Altri percorsi: `/risorse`, `/risorse/operai`, `/risorse/squadre/preview-squadra` e `/progetti/preview-cantiere/sal`.

## Da completare e decisioni aziendali

- Business Unit e relativi perimetri.
- Ferie, turni, capacità disponibile e vista calendario delle squadre.
- Suggerimenti materiali e ulteriori automatismi operativi.
- Approvazione aziendale del SAL e manutenzione delle durate previste, ruoli economici e classificazione dello storico reale/dimostrativo.
- what3words resta una proposta da discutere col cliente.
- Redeploy della tranche multisquadra e verifica nell'ambiente di destinazione; chatbot Elettro `66b0c12` gestito separatamente nell'albero originale.
