# Operatività cantiere — implementazione e collaudo

Stato al 29 ottobre 2026. Funzionalità implementate e verificate localmente, su database isolati. Sorgenti pronti al rilascio; migrazione e deploy in produzione restano da eseguire.

## Percorso disponibile

1. **Progetti → cantiere → Aggiorna SAL:** modifica delle milestone reali, anteprima percentuale, data, nota e foto/PDF; storico con autore e valori prima/dopo.
2. **Segnala problema:** descrizione, priorità, responsabile, scadenza e allegati; creazione facoltativa di un'attività nell'agenda del responsabile.
3. **Problema → attività → notifiche:** assegnazione e aggiornamenti notificati; risoluzione/riapertura, responsabile e scadenza sincronizzati con l'attività. L'attività collegata rimanda al problema per gli aggiornamenti.
4. **Cruscotto:** cantieri aperti, in ritardo e sospesi, problemi aperti, agenda personale, pipeline commerciale e consuntivi reali per i ruoli autorizzati. Indicatori collegati agli elenchi filtrati.
5. **Elettro:** letture contestuali di cantieri, SAL, problemi e consuntivi; fonti e data della lettura, conversazioni riutilizzabili quando il perimetro autorizzativo resta compatibile.
6. **Risorse e squadre:** operai attivi e assegnazioni nel periodo, filtro squadra e paginazione; collegamenti ai cantieri accessibili e all'anagrafica operai.

La sospensione/ripresa del cantiere dispone di un motivo e di uno storico dedicato.

## Convenzioni operative iniziali

- Cantiere e commessa sono viste della stessa entità; la sospensione è separata dallo stato commerciale.
- SAL = milestone reali completate / milestone reali totali, arrotondato all'intero. Tutte hanno lo stesso peso; `IN_CORSO` non assegna avanzamento parziale.
- Senza milestone reali il SAL è **non disponibile**, distinto da 0%. Le milestone dimostrative non contribuiscono né al SAL né ai ritardi delle milestone.
- La data del SAL non può essere futura. Un nuovo aggiornamento non riscrive gli snapshot storici.
- Problemi di cantiere e Segnalazioni software sono moduli separati.
- Creare un'attività dal problema richiede responsabile e scadenza. Finché l'attività resta collegata, questi due campi sono obbligatori anche negli aggiornamenti del problema.
- I consuntivi del cruscotto sono valori di ore/materiali **al cliente**, per data del rendiconto: non sono costi interni, acquisti, ordini acquisiti o incassi. L'assenza di rendiconti non viene rappresentata come importo zero.
- Risorse senza assegnazioni registrate non sono automaticamente disponibili. Assegnazioni senza estremi temporali occupano il periodo aperto; quelle dei cantieri sospesi restano visibili.

## Permessi

| Area | Convenzione implementata |
| --- | --- |
| Gestione SAL, sospensione e problemi | Super Admin, Backoffice, Project Manager e Ufficio Tecnico |
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
- Migrazione additiva: `prisma/migrations/20261029100000_operativita_cantiere/migration.sql`. Introduce storico SAL/sospensioni, problemi/eventi, collegamenti documenti/attività, deduplicazione notifiche e chiavi di accesso AI. Verificata tramite migrazioni su schemi di test, non applicata in produzione.
- L'entrypoint Docker esegue `prisma migrate deploy` all'avvio con `RUN_MIGRATIONS=true` (valore predefinito). Il redeploy deve includere questa migrazione prima di avviare la nuova versione dell'applicazione.

## Collaudo eseguito

| Controllo | Esito |
| --- | --- |
| `npm test` | 137 test passati |
| `npm run test:integration` | 18 test passati |
| `npm run lint` | Passato |
| `npm run build` | Passato, inclusa verifica TypeScript; 2 warning di tracing nel client Prisma generato |
| `UI_PRODUCTION=1 npm run test:ui` | Suite completa passata |
| `UI_PRODUCTION=1 UI_SUITE=operativo npm run test:ui` | Passata anche dopo l'ultima rifinitura visuale SAL |
| Browser a 1440 / 768 / 390 px | Cinque schermate operative, menu aperto/chiuso, tastiera, filtri e navigazione controllati |

La suite completa comprende navigazione/back e filtri, anagrafiche, progetti, agenda, consuntivi, Commerciale e wizard commessa. La suite operativa prova PM → SAL/allegato → risposta persa/retry → conflitto/rollback → problema/attività/notifica/risoluzione, dinieghi economici e 15 viste responsive.

Le prove AI verificano strumenti, autorizzazioni, cronologia e integrazione UI/SDK con risposte controllate. Non costituiscono un collaudo live del provider esterno.

Log locali in `/tmp/opencode/elettra-{unit,integration,lint,build,ui-production,operativo-ui}.log`. Screenshot/report in `/tmp/opencode/elettra-ui-final/`; sono artefatti temporanei dell'ambiente di sviluppo.

## Verifica UI/UX

Direzione **Accent ladder**, seed `2089620649`, palette e caratteri del brand mantenuti, senza ridisegni della direzione. Blu Elettra su SAL e azioni, fondi chiari e contrasto corretto; sidebar brand esistente preservata. Elemento specifico: SAL derivato dalle milestone del cantiere e percorso problema → attività → risoluzione.

Domanda principale di ciascuna schermata:

- Cantiere: a che punto siamo e quale aggiornamento serve?
- SAL: quali milestone sono cambiate e quale percentuale verrà registrata?
- Problema: chi interviene, entro quando e con quale esito?
- Cruscotto: quali cantieri e attività richiedono attenzione oggi?
- Risorse: quali assegnazioni risultano registrate per questa squadra e questo periodo?

### Critica finale delle schermate

- Titoli, riferimenti al cantiere e CTA sono riconoscibili al primo sguardo. Percentuale SAL e conteggi derivano dai dati; 1 milestone completata su 4 dà 25% sia nel riepilogo sia nel form.
- Margini e pannelli restano allineati; campi e azioni mantengono dimensioni utilizzabili al tocco. Il riepilogo SAL non spezza più la dicitura in righe troppo distanti.
- Stato e azione primaria sono distinguibili senza basarsi solo sul colore. Gli zeri rimangono zeri; dati economici mancanti e SAL assente sono dichiarati.
- Menu ripiegato anche sul tablet; apertura/chiusura da tastiera e navigazione controllate. Filtri Risorse richiudibili sul telefono: la prima risorsa torna nella prima schermata. Il problema offre un collegamento iniziale diretto al form di aggiornamento.
- Il cruscotto mobile resta una vista verticale articolata; la pianificazione risorse è un elenco di assegnazioni, non ancora un calendario completo.

Inspector finale sulla build production locale: **0 FAIL** per tutte le schermate e larghezze. Cantiere, SAL e cruscotto: 0 WARN. Restano due avvisi difendibili: `ragged-row` nel problema, perché dettagli/storico e form sono colonne indipendenti a diversa lunghezza; `hero-void` in Risorse desktop, perché la fixture contiene un solo operaio e l'elenco conserva la propria altezza naturale. Nessun controllo disabilitato.

Sono state aperte tutte le immagini finali, comprese le viste scorse. La fixture di `scripts/operativo-preview.ts` contiene Officina Nord, Marco Rinaldi, Luca Marini, un cantiere, quattro milestone e un problema: dati esclusivamente di collaudo in uno schema temporaneo, non contenuto da caricare in produzione.

## Anteprima locale riproducibile

Con Postgres di test disponibile:

```sh
npm run build
PREVIEW_PRODUCTION=1 npx tsx scripts/operativo-preview.ts
```

Aprire `http://127.0.0.1:3218/progetti/preview-cantiere`. L'anteprima usa un proxy autenticato solo su loopback, un database temporaneo e upload isolati. SIGINT/SIGTERM del processo preview pulisce schema e file temporanei. L'ID del problema viene stampato all'avvio.

## Da completare e decisioni aziendali

- Business Unit e relativi perimetri.
- Ferie, turni, capacità disponibile e squadre avanzate con vista calendario.
- Suggerimenti materiali e ulteriori automatismi operativi.
- Conferma aziendale di formula/pesi e approvazione del SAL, ruoli economici e classificazione dello storico reale/dimostrativo.
- Rilascio con la nuova migrazione e verifica nell'ambiente di destinazione: questa sessione ha completato il collaudo locale, non il deploy.
