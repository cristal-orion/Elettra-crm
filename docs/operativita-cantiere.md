# Operatività cantiere — implementazione e collaudo

Stato al 29 ottobre 2026. La release operativa `b461bf9` e la migrazione `20261029100000_operativita_cantiere` sono pubblicate e verificate online. La tranche SAL ponderato / personale / squadre è implementata nella worktree `elettra-crm-sal-risorse`, branch `feat/sal-risorse`, con collaudo su database isolati e pubblicazione su `main` autorizzata dall'utente. Deploy e nuova migrazione in produzione restano da verificare. Il commit chatbot locale `66b0c12` non è incluso nel branch.

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
- Una persona appartiene a una squadra centrale. Assegnare la squadra aggiunge atomicamente i membri attivi; un conflitto temporale di un componente annulla tutto. Le persone già nel cantiere mantengono date, ruolo e note locali.
- Le modifiche alla composizione e l'archiviazione della squadra centrale valgono per nuove assegnazioni. Il cantiere conserva quelle già presenti, modificabili singolarmente. Personale con assegnazioni viene disattivato invece di eliminato.
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
- Nuova migrazione `20261029140000_sal_durata_squadre`: durata nullable con vincolo DB, tabella `Squadra` e conversione esatta dei raggruppamenti preesistenti, anche di personale inattivo. `Operaio.squadra` resta il nome, ora FK verso `Squadra.nome` con rinomina in cascata. Assegnazioni e snapshot rimangono intatti. Verificata su schemi isolati, ancora da applicare in produzione.
- Servizi personale/squadre in `src/lib/risorse.ts`: transazioni serializzabili, controllo versioni di personale e squadra, rollback dell'assegnazione completa. Cambiare un membro invalida la versione della squadra; cambiare la composizione invalida le versioni delle persone coinvolte.
- L'entrypoint Docker esegue `prisma migrate deploy` all'avvio con `RUN_MIGRATIONS=true` (valore predefinito). Il redeploy deve includere questa migrazione prima di avviare la nuova versione dell'applicazione.

## Collaudo eseguito

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

La fixture di `scripts/operativo-preview.ts` contiene Officina Nord, Marco Rinaldi, Luca Marini, Giulia Ferri, Paolo Bassi, la squadra Installazioni, un cantiere con luogo a Belluno, quattro milestone e un problema: dati esclusivamente di collaudo in uno schema temporaneo, non contenuto da caricare in produzione.

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
- Rilascio della tranche SAL/squadre con la nuova migrazione e verifica nell'ambiente di destinazione; chatbot Elettro `66b0c12` gestito separatamente nell'albero originale.
