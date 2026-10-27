ALTER TABLE "Commessa" ADD COLUMN "indirizzoCantiere" TEXT;
CREATE TABLE "BozzaCommessa" (
    "id" TEXT NOT NULL,
    "autoreId" TEXT,
    "versione" INTEGER NOT NULL DEFAULT 1,
    "passo" INTEGER NOT NULL DEFAULT 0,
    "dati" JSONB NOT NULL,
    "commessaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BozzaCommessa_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BozzaCommessa_autoreId_fkey" FOREIGN KEY ("autoreId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BozzaCommessa_commessaId_fkey" FOREIGN KEY ("commessaId") REFERENCES "Commessa"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BozzaCommessa_passo_check" CHECK ("passo" BETWEEN 0 AND 4)
);
CREATE UNIQUE INDEX "BozzaCommessa_commessaId_key" ON "BozzaCommessa"("commessaId");
CREATE INDEX "BozzaCommessa_autoreId_updatedAt_idx" ON "BozzaCommessa"("autoreId", "updatedAt");
ALTER TABLE "Documento" ADD COLUMN "bozzaId" TEXT;
ALTER TABLE "Documento" DROP CONSTRAINT "Documento_parent_check";
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_parent_check" CHECK (
  ("bozzaId" IS NOT NULL AND "commessaId" IS NULL AND "opportunitaId" IS NULL)
  OR ("bozzaId" IS NULL AND ("commessaId" IS NOT NULL OR "opportunitaId" IS NOT NULL))
);
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_bozzaId_fkey" FOREIGN KEY ("bozzaId") REFERENCES "BozzaCommessa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Documento_bozzaId_idx" ON "Documento"("bozzaId");
