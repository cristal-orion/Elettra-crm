-- AlterTable
ALTER TABLE "Commessa" ADD COLUMN "dataFineLavori" DATETIME;
ALTER TABLE "Commessa" ADD COLUMN "dataInizioLavori" DATETIME;
ALTER TABLE "Commessa" ADD COLUMN "noteCantiere" TEXT;
ALTER TABLE "Commessa" ADD COLUMN "scadenzaLavori" DATETIME;

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "commessaId" TEXT NOT NULL,
    "titolo" TEXT NOT NULL,
    "ordine" INTEGER NOT NULL,
    "stato" TEXT NOT NULL DEFAULT 'DA_FARE',
    "dataPianificata" DATETIME,
    "dataEffettiva" DATETIME,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Milestone_commessaId_fkey" FOREIGN KEY ("commessaId") REFERENCES "Commessa" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Operaio" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "cognome" TEXT NOT NULL,
    "qualifica" TEXT,
    "squadra" TEXT,
    "telefono" TEXT,
    "attivo" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AssegnazioneOperaio" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "commessaId" TEXT NOT NULL,
    "operaioId" TEXT NOT NULL,
    "ruoloCantiere" TEXT,
    "dal" DATETIME,
    "al" DATETIME,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssegnazioneOperaio_commessaId_fkey" FOREIGN KEY ("commessaId") REFERENCES "Commessa" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssegnazioneOperaio_operaioId_fkey" FOREIGN KEY ("operaioId") REFERENCES "Operaio" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Milestone_commessaId_ordine_idx" ON "Milestone"("commessaId", "ordine");

-- CreateIndex
CREATE INDEX "Milestone_stato_idx" ON "Milestone"("stato");

-- CreateIndex
CREATE INDEX "Operaio_cognome_nome_idx" ON "Operaio"("cognome", "nome");

-- CreateIndex
CREATE INDEX "Operaio_squadra_idx" ON "Operaio"("squadra");

-- CreateIndex
CREATE INDEX "AssegnazioneOperaio_commessaId_idx" ON "AssegnazioneOperaio"("commessaId");

-- CreateIndex
CREATE INDEX "AssegnazioneOperaio_operaioId_idx" ON "AssegnazioneOperaio"("operaioId");

-- CreateIndex
CREATE UNIQUE INDEX "AssegnazioneOperaio_commessaId_operaioId_key" ON "AssegnazioneOperaio"("commessaId", "operaioId");

-- CreateIndex
CREATE INDEX "Commessa_scadenzaLavori_idx" ON "Commessa"("scadenzaLavori");
