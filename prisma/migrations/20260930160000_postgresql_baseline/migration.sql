-- Baseline PostgreSQL. Lo storico SQLite è in prisma/legacy-sqlite.
BEGIN;
CREATE SCHEMA IF NOT EXISTS "public";
CREATE TABLE "User" (
  "id" TEXT NOT NULL PRIMARY KEY, "email" TEXT NOT NULL, "passwordHash" TEXT NOT NULL,
  "nome" TEXT NOT NULL, "cognome" TEXT NOT NULL, "ruolo" TEXT NOT NULL,
  "attivo" BOOLEAN NOT NULL DEFAULT true, "guidaVista" TEXT NOT NULL DEFAULT '',
  "sessionVersion" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "Anagrafica" (
  "id" TEXT NOT NULL PRIMARY KEY, "ragioneSociale" TEXT NOT NULL,
  "codiceCliente" TEXT, "codiceFornitore" TEXT,
  "isCliente" BOOLEAN NOT NULL DEFAULT false, "isFornitore" BOOLEAN NOT NULL DEFAULT false,
  "partitaIva" TEXT, "codiceFiscale" TEXT, "codiceSDI" TEXT, "indirizzo" TEXT,
  "cap" TEXT, "localita" TEXT, "provincia" TEXT, "telefono" TEXT, "fax" TEXT,
  "email" TEXT, "web" TEXT, "modalitaPagamento" TEXT, "prodottiTrattati" TEXT, "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "Destinazione" (
  "id" TEXT NOT NULL PRIMARY KEY, "anagraficaId" TEXT NOT NULL, "codice" TEXT NOT NULL,
  "descrizione" TEXT, "indirizzo" TEXT, "cap" TEXT, "localita" TEXT, "provincia" TEXT,
  "telefono" TEXT, "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "Referente" (
  "id" TEXT NOT NULL PRIMARY KEY, "anagraficaId" TEXT NOT NULL,
  "titolo" TEXT NOT NULL DEFAULT 'NESSUNO', "nome" TEXT NOT NULL, "cognome" TEXT NOT NULL,
  "ruoloAzienda" TEXT, "email" TEXT, "telefono" TEXT, "note" TEXT,
  "principale" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "Commessa" (
  "id" TEXT NOT NULL PRIMARY KEY, "numero" TEXT NOT NULL, "anno" INTEGER NOT NULL,
  "progressivo" INTEGER NOT NULL, "clienteId" TEXT NOT NULL, "pmId" TEXT, "referenteId" TEXT,
  "referenteCommerciale" TEXT, "stato" TEXT NOT NULL DEFAULT 'LEAD', "tipologia" TEXT, "descrizione" TEXT,
  "dataRichiesta" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "dataInvio" TIMESTAMP(3),
  "importoOfferta" DECIMAL(65,30), "importoOrdine" DECIMAL(65,30), "dataOrdine" TIMESTAMP(3),
  "metodoRicezioneOrdine" TEXT, "oda" TEXT, "motivazionePersa" TEXT,
  "dataInizioLavori" TIMESTAMP(3), "scadenzaLavori" TIMESTAMP(3), "dataFineLavori" TIMESTAMP(3), "noteCantiere" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "Milestone" (
  "id" TEXT NOT NULL PRIMARY KEY, "commessaId" TEXT NOT NULL, "titolo" TEXT NOT NULL,
  "ordine" INTEGER NOT NULL, "stato" TEXT NOT NULL DEFAULT 'DA_FARE',
  "dataPianificata" TIMESTAMP(3), "dataEffettiva" TIMESTAMP(3), "note" TEXT,
  "dimostrativa" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "Operaio" (
  "id" TEXT NOT NULL PRIMARY KEY, "nome" TEXT NOT NULL, "cognome" TEXT NOT NULL,
  "qualifica" TEXT, "squadra" TEXT, "telefono" TEXT, "attivo" BOOLEAN NOT NULL DEFAULT true, "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "AssegnazioneOperaio" (
  "id" TEXT NOT NULL PRIMARY KEY, "commessaId" TEXT NOT NULL, "operaioId" TEXT NOT NULL,
  "ruoloCantiere" TEXT, "dal" TIMESTAMP(3), "al" TIMESTAMP(3), "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "Prodotto" (
  "id" TEXT NOT NULL PRIMARY KEY, "codice" TEXT, "descrizione" TEXT NOT NULL,
  "unitaMisura" TEXT, "categoria" TEXT, "marca" TEXT, "datiTecnici" TEXT, "note" TEXT,
  "prezzoListino" DECIMAL(65,30), "schedaNomeFile" TEXT, "schedaMime" TEXT,
  "schedaPercorso" TEXT, "schedaDimensione" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "OrdineFornitore" (
  "id" TEXT NOT NULL PRIMARY KEY, "numero" TEXT, "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fornitoreId" TEXT NOT NULL, "commessaId" TEXT, "stato" TEXT NOT NULL DEFAULT 'ORDINATO',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "RigaOrdineFornitore" (
  "id" TEXT NOT NULL PRIMARY KEY, "ordineId" TEXT NOT NULL, "prodottoId" TEXT,
  "codiceProdotto" TEXT, "descrizione" TEXT NOT NULL, "unitaMisura" TEXT,
  "quantita" DECIMAL(65,30) NOT NULL DEFAULT 0, "prezzoUnitario" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "sconto" DECIMAL(65,30), "imponibile" DECIMAL(65,30) NOT NULL DEFAULT 0, "aliquotaIva" DECIMAL(65,30),
  "dataConsegnaPrevista" TIMESTAMP(3), "quantitaRicevuta" DECIMAL(65,30),
  "ddtNumero" TEXT, "ddtData" TIMESTAMP(3), "fatturaNumero" TEXT, "fatturaData" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "Documento" (
  "id" TEXT NOT NULL PRIMARY KEY, "commessaId" TEXT NOT NULL, "nomeFile" TEXT NOT NULL,
  "categoria" TEXT NOT NULL DEFAULT 'ALTRO', "tipoMime" TEXT, "percorso" TEXT NOT NULL,
  "dimensione" INTEGER, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "Segnalazione" (
  "id" TEXT NOT NULL PRIMARY KEY, "titolo" TEXT NOT NULL, "descrizione" TEXT NOT NULL,
  "tipo" TEXT NOT NULL DEFAULT 'PROBLEMA', "priorita" TEXT NOT NULL DEFAULT 'MEDIA',
  "stato" TEXT NOT NULL DEFAULT 'APERTA', "pagina" TEXT, "autoreId" TEXT NOT NULL,
  "risoluzione" TEXT, "conclusaIl" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "AllegatoSegnalazione" (
  "id" TEXT NOT NULL PRIMARY KEY, "segnalazioneId" TEXT NOT NULL, "nomeFile" TEXT NOT NULL,
  "tipoMime" TEXT, "percorso" TEXT NOT NULL, "dimensione" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "Impostazione" (
  "id" TEXT NOT NULL PRIMARY KEY, "chiave" TEXT NOT NULL, "valore" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "AiConversation" (
  "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "title" TEXT NOT NULL,
  "context" JSONB, "busyUntil" TIMESTAMP(3), "lockToken" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "AiMessage" (
  "id" TEXT NOT NULL PRIMARY KEY, "conversationId" TEXT NOT NULL, "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "AiOperation" (
  "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "conversationId" TEXT,
  "requestKey" TEXT NOT NULL, "command" JSONB NOT NULL, "preview" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING', "result" JSONB, "error" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "AiSchedule" (
  "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "name" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true, "hour" INTEGER NOT NULL DEFAULT 8,
  "minute" INTEGER NOT NULL DEFAULT 0, "weekdaysOnly" BOOLEAN NOT NULL DEFAULT true,
  "timezone" TEXT NOT NULL DEFAULT 'Europe/Rome', "followupDays" INTEGER NOT NULL DEFAULT 14,
  "horizonDays" INTEGER NOT NULL DEFAULT 7, "recipientIds" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "AiRun" (
  "id" TEXT NOT NULL PRIMARY KEY, "scheduleId" TEXT NOT NULL, "slot" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RUNNING', "leaseUntil" TIMESTAMP(3) NOT NULL,
  "summary" TEXT, "findings" JSONB, "usage" JSONB, "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "finishedAt" TIMESTAMP(3)
);
CREATE TABLE "Notifica" (
  "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "runId" TEXT,
  "titolo" TEXT NOT NULL, "testo" TEXT NOT NULL, "href" TEXT NOT NULL,
  "letta" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "Attivita" (
  "id" TEXT NOT NULL PRIMARY KEY, "titolo" TEXT NOT NULL, "note" TEXT, "scadenza" TIMESTAMP(3),
  "stato" TEXT NOT NULL DEFAULT 'DA_FARE', "userId" TEXT NOT NULL, "commessaId" TEXT, "clienteId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "LoginRateLimit" (
  "key" TEXT NOT NULL PRIMARY KEY, "attempts" INTEGER NOT NULL, "windowStartedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_ruolo_idx" ON "User"("ruolo");
CREATE UNIQUE INDEX "Anagrafica_codiceCliente_key" ON "Anagrafica"("codiceCliente");
CREATE UNIQUE INDEX "Anagrafica_codiceFornitore_key" ON "Anagrafica"("codiceFornitore");
CREATE INDEX "Anagrafica_ragioneSociale_idx" ON "Anagrafica"("ragioneSociale");
CREATE UNIQUE INDEX "Destinazione_codice_key" ON "Destinazione"("codice");
CREATE INDEX "Destinazione_anagraficaId_idx" ON "Destinazione"("anagraficaId");
CREATE INDEX "Destinazione_localita_idx" ON "Destinazione"("localita");
CREATE INDEX "Referente_anagraficaId_idx" ON "Referente"("anagraficaId");
CREATE UNIQUE INDEX "Commessa_numero_key" ON "Commessa"("numero");
CREATE INDEX "Commessa_clienteId_idx" ON "Commessa"("clienteId");
CREATE INDEX "Commessa_stato_idx" ON "Commessa"("stato");
CREATE INDEX "Commessa_anno_idx" ON "Commessa"("anno");
CREATE INDEX "Commessa_scadenzaLavori_idx" ON "Commessa"("scadenzaLavori");
CREATE INDEX "Milestone_commessaId_ordine_idx" ON "Milestone"("commessaId", "ordine");
CREATE INDEX "Milestone_stato_idx" ON "Milestone"("stato");
CREATE INDEX "Operaio_cognome_nome_idx" ON "Operaio"("cognome", "nome");
CREATE INDEX "Operaio_squadra_idx" ON "Operaio"("squadra");
CREATE INDEX "AssegnazioneOperaio_commessaId_idx" ON "AssegnazioneOperaio"("commessaId");
CREATE INDEX "AssegnazioneOperaio_operaioId_idx" ON "AssegnazioneOperaio"("operaioId");
CREATE UNIQUE INDEX "AssegnazioneOperaio_commessaId_operaioId_key" ON "AssegnazioneOperaio"("commessaId", "operaioId");
CREATE UNIQUE INDEX "Prodotto_codice_key" ON "Prodotto"("codice");
CREATE INDEX "Prodotto_descrizione_idx" ON "Prodotto"("descrizione");
CREATE INDEX "Prodotto_categoria_idx" ON "Prodotto"("categoria");
CREATE INDEX "OrdineFornitore_fornitoreId_idx" ON "OrdineFornitore"("fornitoreId");
CREATE INDEX "OrdineFornitore_commessaId_idx" ON "OrdineFornitore"("commessaId");
CREATE INDEX "RigaOrdineFornitore_ordineId_idx" ON "RigaOrdineFornitore"("ordineId");
CREATE INDEX "RigaOrdineFornitore_prodottoId_idx" ON "RigaOrdineFornitore"("prodottoId");
CREATE INDEX "Documento_commessaId_idx" ON "Documento"("commessaId");
CREATE INDEX "Segnalazione_stato_idx" ON "Segnalazione"("stato");
CREATE INDEX "Segnalazione_autoreId_idx" ON "Segnalazione"("autoreId");
CREATE INDEX "Segnalazione_createdAt_idx" ON "Segnalazione"("createdAt");
CREATE INDEX "AllegatoSegnalazione_segnalazioneId_idx" ON "AllegatoSegnalazione"("segnalazioneId");
CREATE UNIQUE INDEX "Impostazione_chiave_key" ON "Impostazione"("chiave");
CREATE INDEX "AiConversation_userId_updatedAt_idx" ON "AiConversation"("userId", "updatedAt");
CREATE INDEX "AiMessage_conversationId_createdAt_idx" ON "AiMessage"("conversationId", "createdAt");
CREATE UNIQUE INDEX "AiOperation_requestKey_key" ON "AiOperation"("requestKey");
CREATE INDEX "AiOperation_userId_createdAt_idx" ON "AiOperation"("userId", "createdAt");
CREATE UNIQUE INDEX "AiRun_scheduleId_slot_key" ON "AiRun"("scheduleId", "slot");
CREATE INDEX "Notifica_userId_letta_createdAt_idx" ON "Notifica"("userId", "letta", "createdAt");
CREATE UNIQUE INDEX "Notifica_userId_runId_key" ON "Notifica"("userId", "runId");
CREATE INDEX "Attivita_userId_stato_scadenza_idx" ON "Attivita"("userId", "stato", "scadenza");
CREATE INDEX "LoginRateLimit_windowStartedAt_idx" ON "LoginRateLimit"("windowStartedAt");
ALTER TABLE "Destinazione" ADD CONSTRAINT "Destinazione_anagraficaId_fkey" FOREIGN KEY ("anagraficaId") REFERENCES "Anagrafica"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Referente" ADD CONSTRAINT "Referente_anagraficaId_fkey" FOREIGN KEY ("anagraficaId") REFERENCES "Anagrafica"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Commessa" ADD CONSTRAINT "Commessa_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Anagrafica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Commessa" ADD CONSTRAINT "Commessa_pmId_fkey" FOREIGN KEY ("pmId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Commessa" ADD CONSTRAINT "Commessa_referenteId_fkey" FOREIGN KEY ("referenteId") REFERENCES "Referente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_commessaId_fkey" FOREIGN KEY ("commessaId") REFERENCES "Commessa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssegnazioneOperaio" ADD CONSTRAINT "AssegnazioneOperaio_commessaId_fkey" FOREIGN KEY ("commessaId") REFERENCES "Commessa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssegnazioneOperaio" ADD CONSTRAINT "AssegnazioneOperaio_operaioId_fkey" FOREIGN KEY ("operaioId") REFERENCES "Operaio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrdineFornitore" ADD CONSTRAINT "OrdineFornitore_fornitoreId_fkey" FOREIGN KEY ("fornitoreId") REFERENCES "Anagrafica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrdineFornitore" ADD CONSTRAINT "OrdineFornitore_commessaId_fkey" FOREIGN KEY ("commessaId") REFERENCES "Commessa"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RigaOrdineFornitore" ADD CONSTRAINT "RigaOrdineFornitore_ordineId_fkey" FOREIGN KEY ("ordineId") REFERENCES "OrdineFornitore"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RigaOrdineFornitore" ADD CONSTRAINT "RigaOrdineFornitore_prodottoId_fkey" FOREIGN KEY ("prodottoId") REFERENCES "Prodotto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_commessaId_fkey" FOREIGN KEY ("commessaId") REFERENCES "Commessa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Segnalazione" ADD CONSTRAINT "Segnalazione_autoreId_fkey" FOREIGN KEY ("autoreId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AllegatoSegnalazione" ADD CONSTRAINT "AllegatoSegnalazione_segnalazioneId_fkey" FOREIGN KEY ("segnalazioneId") REFERENCES "Segnalazione"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiConversation" ADD CONSTRAINT "AiConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiMessage" ADD CONSTRAINT "AiMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AiConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiOperation" ADD CONSTRAINT "AiOperation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiOperation" ADD CONSTRAINT "AiOperation_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AiConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiSchedule" ADD CONSTRAINT "AiSchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiRun" ADD CONSTRAINT "AiRun_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "AiSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notifica" ADD CONSTRAINT "Notifica_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notifica" ADD CONSTRAINT "Notifica_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AiRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Attivita" ADD CONSTRAINT "Attivita_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Attivita" ADD CONSTRAINT "Attivita_commessaId_fkey" FOREIGN KEY ("commessaId") REFERENCES "Commessa"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Attivita" ADD CONSTRAINT "Attivita_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Anagrafica"("id") ON DELETE SET NULL ON UPDATE CASCADE;
COMMIT;
