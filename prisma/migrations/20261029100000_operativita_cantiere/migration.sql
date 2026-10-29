ALTER TABLE "Commessa" ADD COLUMN "motivoSospensione" TEXT,
ADD COLUMN "sospeso" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "versioneOperativa" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Documento" ADD COLUMN "aggiornamentoId" TEXT, ADD COLUMN "problemaId" TEXT;
ALTER TABLE "Notifica" ADD COLUMN "eventoKey" TEXT;
ALTER TABLE "Attivita" ADD COLUMN "problemaId" TEXT;

CREATE TABLE "AggiornamentoCantiere" (
  "id" TEXT NOT NULL PRIMARY KEY, "richiestaId" TEXT NOT NULL, "richiestaHash" TEXT NOT NULL,
  "commessaId" TEXT NOT NULL, "autoreId" TEXT NOT NULL, "autoreNome" TEXT NOT NULL,
  "tipo" TEXT NOT NULL DEFAULT 'SAL', "data" DATE NOT NULL, "nota" TEXT,
  "prima" JSONB NOT NULL, "dopo" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "ProblemaCantiere" (
  "id" TEXT NOT NULL PRIMARY KEY, "richiestaId" TEXT NOT NULL, "richiestaHash" TEXT NOT NULL,
  "commessaId" TEXT NOT NULL, "titolo" TEXT NOT NULL, "descrizione" TEXT NOT NULL,
  "priorita" TEXT NOT NULL DEFAULT 'MEDIA', "stato" TEXT NOT NULL DEFAULT 'APERTA',
  "autoreId" TEXT NOT NULL, "autoreNome" TEXT NOT NULL, "assegnatarioId" TEXT,
  "scadenza" DATE, "versione" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "EventoProblema" (
  "id" TEXT NOT NULL PRIMARY KEY, "richiestaId" TEXT NOT NULL, "richiestaHash" TEXT NOT NULL,
  "problemaId" TEXT NOT NULL, "autoreId" TEXT NOT NULL, "autoreNome" TEXT NOT NULL,
  "testo" TEXT NOT NULL, "prima" JSONB, "dopo" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "AggiornamentoCantiere_richiestaId_key" ON "AggiornamentoCantiere"("richiestaId");
CREATE INDEX "AggiornamentoCantiere_commessaId_createdAt_idx" ON "AggiornamentoCantiere"("commessaId", "createdAt");
CREATE UNIQUE INDEX "ProblemaCantiere_richiestaId_key" ON "ProblemaCantiere"("richiestaId");
CREATE INDEX "ProblemaCantiere_commessaId_stato_idx" ON "ProblemaCantiere"("commessaId", "stato");
CREATE INDEX "ProblemaCantiere_assegnatarioId_stato_scadenza_idx" ON "ProblemaCantiere"("assegnatarioId", "stato", "scadenza");
CREATE UNIQUE INDEX "EventoProblema_richiestaId_key" ON "EventoProblema"("richiestaId");
CREATE INDEX "EventoProblema_problemaId_createdAt_idx" ON "EventoProblema"("problemaId", "createdAt");
CREATE INDEX "Commessa_pmId_stato_idx" ON "Commessa"("pmId", "stato");
CREATE INDEX "Documento_aggiornamentoId_idx" ON "Documento"("aggiornamentoId");
CREATE INDEX "Documento_problemaId_idx" ON "Documento"("problemaId");
CREATE UNIQUE INDEX "Notifica_eventoKey_key" ON "Notifica"("eventoKey");
CREATE UNIQUE INDEX "Attivita_problemaId_key" ON "Attivita"("problemaId");
ALTER TABLE "AggiornamentoCantiere" ADD CONSTRAINT "AggiornamentoCantiere_commessaId_fkey" FOREIGN KEY ("commessaId") REFERENCES "Commessa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProblemaCantiere" ADD CONSTRAINT "ProblemaCantiere_commessaId_fkey" FOREIGN KEY ("commessaId") REFERENCES "Commessa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventoProblema" ADD CONSTRAINT "EventoProblema_problemaId_fkey" FOREIGN KEY ("problemaId") REFERENCES "ProblemaCantiere"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_aggiornamentoId_fkey" FOREIGN KEY ("aggiornamentoId") REFERENCES "AggiornamentoCantiere"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_problemaId_fkey" FOREIGN KEY ("problemaId") REFERENCES "ProblemaCantiere"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Attivita" ADD CONSTRAINT "Attivita_problemaId_fkey" FOREIGN KEY ("problemaId") REFERENCES "ProblemaCantiere"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Le risposte salvate mantengono il perimetro autorizzativo con cui sono state prodotte.
ALTER TABLE "AiConversation" ADD COLUMN "accessKey" TEXT;
ALTER TABLE "AiOperation" ADD COLUMN "accessKey" TEXT;
