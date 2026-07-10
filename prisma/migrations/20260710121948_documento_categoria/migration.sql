-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Documento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "commessaId" TEXT NOT NULL,
    "nomeFile" TEXT NOT NULL,
    "categoria" TEXT NOT NULL DEFAULT 'ALTRO',
    "tipoMime" TEXT,
    "percorso" TEXT NOT NULL,
    "dimensione" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Documento_commessaId_fkey" FOREIGN KEY ("commessaId") REFERENCES "Commessa" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Documento" ("commessaId", "createdAt", "dimensione", "id", "nomeFile", "percorso", "tipoMime") SELECT "commessaId", "createdAt", "dimensione", "id", "nomeFile", "percorso", "tipoMime" FROM "Documento";
DROP TABLE "Documento";
ALTER TABLE "new_Documento" RENAME TO "Documento";
CREATE INDEX "Documento_commessaId_idx" ON "Documento"("commessaId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
