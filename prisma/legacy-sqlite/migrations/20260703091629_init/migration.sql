-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cognome" TEXT NOT NULL,
    "ruolo" TEXT NOT NULL,
    "attivo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Anagrafica" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ragioneSociale" TEXT NOT NULL,
    "codiceCliente" TEXT,
    "codiceFornitore" TEXT,
    "isCliente" BOOLEAN NOT NULL DEFAULT false,
    "isFornitore" BOOLEAN NOT NULL DEFAULT false,
    "partitaIva" TEXT,
    "codiceFiscale" TEXT,
    "codiceSDI" TEXT,
    "indirizzo" TEXT,
    "cap" TEXT,
    "localita" TEXT,
    "provincia" TEXT,
    "telefono" TEXT,
    "fax" TEXT,
    "email" TEXT,
    "web" TEXT,
    "modalitaPagamento" TEXT,
    "prodottiTrattati" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Referente" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "anagraficaId" TEXT NOT NULL,
    "titolo" TEXT NOT NULL DEFAULT 'NESSUNO',
    "nome" TEXT NOT NULL,
    "cognome" TEXT NOT NULL,
    "ruoloAzienda" TEXT,
    "email" TEXT,
    "telefono" TEXT,
    "note" TEXT,
    "principale" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Referente_anagraficaId_fkey" FOREIGN KEY ("anagraficaId") REFERENCES "Anagrafica" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Commessa" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "numero" TEXT NOT NULL,
    "anno" INTEGER NOT NULL,
    "progressivo" INTEGER NOT NULL,
    "clienteId" TEXT NOT NULL,
    "pmId" TEXT,
    "referenteId" TEXT,
    "referenteCommerciale" TEXT,
    "stato" TEXT NOT NULL DEFAULT 'LEAD',
    "tipologia" TEXT,
    "descrizione" TEXT,
    "dataRichiesta" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataInvio" DATETIME,
    "importoOfferta" DECIMAL,
    "importoOrdine" DECIMAL,
    "dataOrdine" DATETIME,
    "metodoRicezioneOrdine" TEXT,
    "motivazionePersa" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Commessa_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Anagrafica" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Commessa_pmId_fkey" FOREIGN KEY ("pmId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Commessa_referenteId_fkey" FOREIGN KEY ("referenteId") REFERENCES "Referente" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Prodotto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codice" TEXT,
    "descrizione" TEXT NOT NULL,
    "unitaMisura" TEXT,
    "categoria" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "OrdineFornitore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "numero" TEXT,
    "data" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fornitoreId" TEXT NOT NULL,
    "commessaId" TEXT,
    "stato" TEXT NOT NULL DEFAULT 'ORDINATO',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OrdineFornitore_fornitoreId_fkey" FOREIGN KEY ("fornitoreId") REFERENCES "Anagrafica" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OrdineFornitore_commessaId_fkey" FOREIGN KEY ("commessaId") REFERENCES "Commessa" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RigaOrdineFornitore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ordineId" TEXT NOT NULL,
    "prodottoId" TEXT,
    "codiceProdotto" TEXT,
    "descrizione" TEXT NOT NULL,
    "unitaMisura" TEXT,
    "quantita" DECIMAL NOT NULL DEFAULT 0,
    "prezzoUnitario" DECIMAL NOT NULL DEFAULT 0,
    "sconto" DECIMAL,
    "imponibile" DECIMAL NOT NULL DEFAULT 0,
    "aliquotaIva" DECIMAL,
    "dataConsegnaPrevista" DATETIME,
    "quantitaRicevuta" DECIMAL,
    "ddtNumero" TEXT,
    "ddtData" DATETIME,
    "fatturaNumero" TEXT,
    "fatturaData" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RigaOrdineFornitore_ordineId_fkey" FOREIGN KEY ("ordineId") REFERENCES "OrdineFornitore" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RigaOrdineFornitore_prodottoId_fkey" FOREIGN KEY ("prodottoId") REFERENCES "Prodotto" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Documento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "commessaId" TEXT NOT NULL,
    "nomeFile" TEXT NOT NULL,
    "tipoMime" TEXT,
    "percorso" TEXT NOT NULL,
    "dimensione" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Documento_commessaId_fkey" FOREIGN KEY ("commessaId") REFERENCES "Commessa" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_ruolo_idx" ON "User"("ruolo");

-- CreateIndex
CREATE UNIQUE INDEX "Anagrafica_codiceCliente_key" ON "Anagrafica"("codiceCliente");

-- CreateIndex
CREATE UNIQUE INDEX "Anagrafica_codiceFornitore_key" ON "Anagrafica"("codiceFornitore");

-- CreateIndex
CREATE INDEX "Anagrafica_ragioneSociale_idx" ON "Anagrafica"("ragioneSociale");

-- CreateIndex
CREATE INDEX "Referente_anagraficaId_idx" ON "Referente"("anagraficaId");

-- CreateIndex
CREATE UNIQUE INDEX "Commessa_numero_key" ON "Commessa"("numero");

-- CreateIndex
CREATE INDEX "Commessa_clienteId_idx" ON "Commessa"("clienteId");

-- CreateIndex
CREATE INDEX "Commessa_stato_idx" ON "Commessa"("stato");

-- CreateIndex
CREATE INDEX "Commessa_anno_idx" ON "Commessa"("anno");

-- CreateIndex
CREATE UNIQUE INDEX "Prodotto_codice_key" ON "Prodotto"("codice");

-- CreateIndex
CREATE INDEX "Prodotto_descrizione_idx" ON "Prodotto"("descrizione");

-- CreateIndex
CREATE INDEX "OrdineFornitore_fornitoreId_idx" ON "OrdineFornitore"("fornitoreId");

-- CreateIndex
CREATE INDEX "OrdineFornitore_commessaId_idx" ON "OrdineFornitore"("commessaId");

-- CreateIndex
CREATE INDEX "RigaOrdineFornitore_ordineId_idx" ON "RigaOrdineFornitore"("ordineId");

-- CreateIndex
CREATE INDEX "RigaOrdineFornitore_prodottoId_idx" ON "RigaOrdineFornitore"("prodottoId");

-- CreateIndex
CREATE INDEX "Documento_commessaId_idx" ON "Documento"("commessaId");
