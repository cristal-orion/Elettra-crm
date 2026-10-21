ALTER TABLE "Anagrafica" ADD COLUMN "isProspect" BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE "FaseCommerciale" (
  "id" TEXT NOT NULL PRIMARY KEY, "nome" TEXT NOT NULL, "categoria" TEXT NOT NULL,
  "ordine" INTEGER NOT NULL, "attiva" BOOLEAN NOT NULL DEFAULT true, "versione" INTEGER NOT NULL DEFAULT 1
);
INSERT INTO "FaseCommerciale" ("id", "nome", "categoria", "ordine") VALUES
  ('lead', 'Lead', 'APERTA', 10), ('contattato', 'Contattato', 'APERTA', 20),
  ('qualificato', 'Qualificato', 'APERTA', 30), ('preventivo', 'Preventivo', 'APERTA', 40),
  ('inviata', 'Offerta inviata', 'INVIATA', 50), ('negoziazione', 'Negoziazione', 'APERTA', 60),
  ('vinta', 'Vinta', 'VINTA', 70), ('persa', 'Persa', 'PERSA', 80);
CREATE TABLE "Opportunita" (
  "id" TEXT NOT NULL PRIMARY KEY, "titolo" TEXT NOT NULL, "anagraficaId" TEXT NOT NULL,
  "referenteId" TEXT, "responsabileId" TEXT, "faseId" TEXT NOT NULL,
  "tipologia" TEXT NOT NULL DEFAULT 'P', "origine" TEXT, "descrizione" TEXT,
  "valorePrevisto" DECIMAL(16,2), "riferimentoOfferta" TEXT, "importoOfferta" DECIMAL(16,2),
  "dataInvioOfferta" DATE, "motivazionePersa" TEXT, "chiusaIl" TIMESTAMP(3),
  "ultimaInterazioneIl" DATE, "ultimaRispostaIl" DATE,
  "faseAggiornataIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "versione" INTEGER NOT NULL DEFAULT 1, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "EventoCommerciale" (
  "id" TEXT NOT NULL PRIMARY KEY, "opportunitaId" TEXT, "autoreId" TEXT,
  "autoreNome" TEXT NOT NULL, "autoreRuolo" TEXT NOT NULL, "tipo" TEXT NOT NULL,
  "data" DATE NOT NULL, "testo" TEXT NOT NULL, "esito" TEXT, "prima" JSONB, "dopo" JSONB,
  "richiestaId" TEXT, "richiestaHash" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE "Commessa" ADD COLUMN "opportunitaId" TEXT;
ALTER TABLE "Attivita" ADD COLUMN "opportunitaId" TEXT;
ALTER TABLE "Documento" ALTER COLUMN "commessaId" DROP NOT NULL;
ALTER TABLE "Documento" ADD COLUMN "opportunitaId" TEXT;
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_parent_check" CHECK ("commessaId" IS NOT NULL OR "opportunitaId" IS NOT NULL);
CREATE UNIQUE INDEX "Commessa_opportunitaId_key" ON "Commessa"("opportunitaId");
CREATE UNIQUE INDEX "EventoCommerciale_richiestaId_key" ON "EventoCommerciale"("richiestaId");
CREATE INDEX "Opportunita_faseId_createdAt_idx" ON "Opportunita"("faseId", "createdAt");
CREATE INDEX "Opportunita_responsabileId_idx" ON "Opportunita"("responsabileId");
CREATE INDEX "Opportunita_anagraficaId_idx" ON "Opportunita"("anagraficaId");
CREATE INDEX "EventoCommerciale_opportunitaId_data_createdAt_idx" ON "EventoCommerciale"("opportunitaId", "data", "createdAt");
CREATE INDEX "Attivita_opportunitaId_stato_scadenza_idx" ON "Attivita"("opportunitaId", "stato", "scadenza");
CREATE INDEX "Documento_opportunitaId_idx" ON "Documento"("opportunitaId");
ALTER TABLE "Opportunita" ADD CONSTRAINT "Opportunita_anagraficaId_fkey" FOREIGN KEY ("anagraficaId") REFERENCES "Anagrafica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Opportunita" ADD CONSTRAINT "Opportunita_referenteId_fkey" FOREIGN KEY ("referenteId") REFERENCES "Referente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Opportunita" ADD CONSTRAINT "Opportunita_responsabileId_fkey" FOREIGN KEY ("responsabileId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Opportunita" ADD CONSTRAINT "Opportunita_faseId_fkey" FOREIGN KEY ("faseId") REFERENCES "FaseCommerciale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventoCommerciale" ADD CONSTRAINT "EventoCommerciale_opportunitaId_fkey" FOREIGN KEY ("opportunitaId") REFERENCES "Opportunita"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventoCommerciale" ADD CONSTRAINT "EventoCommerciale_autoreId_fkey" FOREIGN KEY ("autoreId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Commessa" ADD CONSTRAINT "Commessa_opportunitaId_fkey" FOREIGN KEY ("opportunitaId") REFERENCES "Opportunita"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Attivita" ADD CONSTRAINT "Attivita_opportunitaId_fkey" FOREIGN KEY ("opportunitaId") REFERENCES "Opportunita"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_opportunitaId_fkey" FOREIGN KEY ("opportunitaId") REFERENCES "Opportunita"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
