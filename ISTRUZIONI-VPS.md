# Runbook VPS — PostgreSQL

Le istruzioni aggiornate sono in [DEPLOY.md](DEPLOY.md): configurazione Coolify,
installazione su server cliente, migrazione SQLite, backup e ripristino.

L'istanza SQLite storica non deve essere aggiornata con la nuova immagine prima
di aver preparato PostgreSQL e completato la migrazione controllata. Il vecchio
volume e l'immagine rimangono il punto di rollback fino alla verifica.

## Import degli elenchi Elettra

Da Super Admin: **Impostazioni → Import dati da Excel**. Trascinare Elenco
anagrafiche ed Elenco Offerte, usare prima **Analizza senza scrivere**, confrontare
le somme di controllo con i totali dei fogli e solo dopo importare. Prima di un
import con sostituzione eseguire il backup DB+allegati. L'import aggiorna i record
per codice/numero; non migra un'installazione SQLite a PostgreSQL.

I project manager storici creati dall'import sono disattivati e senza password
utilizzabile. Per abilitare persone reali usare Gestione utenti e credenziali
individuali. Il seed demo e la rotazione collettiva password sono bloccati in
produzione; il container non crea utenti demo al primo avvio.

## Presentazioni e feedback

`npm run demo:milestone` aggiunge pianificazione dimostrativa marcata sui record;
`npm run demo:milestone -- --rimuovi` la elimina prima dell'uso operativo.
La sezione Segnalazioni raccoglie feedback e screenshot in `/data/uploads`.

## Problemi frequenti

- **Boot rifiutato**: controllare variabili obbligatorie, origine HTTPS, storage
  scrivibile da UID 1000, seed automatico disabilitato e URL PostgreSQL interno.
- **Readiness 503**: connessione/schema DB o storage allegati non disponibili.
- **Build senza rete**: le dipendenze richiedono npm e `cdn.sheetjs.com`.
- **Import/AI in timeout**: proxy con almeno 180s e body fino a 25 MB.
- **Segreti AI legacy illeggibili**: la vecchia `SESSION_SECRET` deve essere
  mantenuta finché i valori non sono stati risalvati con la chiave dati v2.
- **Backup fallito**: controllare il journal del servizio, URL libpq senza
  parametri Prisma, spazio locale, repository Restic e credenziali deposito.
