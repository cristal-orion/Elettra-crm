-- AlterTable
ALTER TABLE "Commessa" ADD COLUMN "oda" TEXT;

-- CreateTable
CREATE TABLE "Destinazione" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "anagraficaId" TEXT NOT NULL,
    "codice" TEXT NOT NULL,
    "descrizione" TEXT,
    "indirizzo" TEXT,
    "cap" TEXT,
    "localita" TEXT,
    "provincia" TEXT,
    "telefono" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Destinazione_anagraficaId_fkey" FOREIGN KEY ("anagraficaId") REFERENCES "Anagrafica" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Destinazione_codice_key" ON "Destinazione"("codice");

-- CreateIndex
CREATE INDEX "Destinazione_anagraficaId_idx" ON "Destinazione"("anagraficaId");

-- CreateIndex
CREATE INDEX "Destinazione_localita_idx" ON "Destinazione"("localita");
