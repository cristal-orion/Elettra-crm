-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Milestone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "commessaId" TEXT NOT NULL,
    "titolo" TEXT NOT NULL,
    "ordine" INTEGER NOT NULL,
    "stato" TEXT NOT NULL DEFAULT 'DA_FARE',
    "dataPianificata" DATETIME,
    "dataEffettiva" DATETIME,
    "note" TEXT,
    "dimostrativa" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Milestone_commessaId_fkey" FOREIGN KEY ("commessaId") REFERENCES "Commessa" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Milestone" ("commessaId", "createdAt", "dataEffettiva", "dataPianificata", "id", "note", "ordine", "stato", "titolo", "updatedAt") SELECT "commessaId", "createdAt", "dataEffettiva", "dataPianificata", "id", "note", "ordine", "stato", "titolo", "updatedAt" FROM "Milestone";
DROP TABLE "Milestone";
ALTER TABLE "new_Milestone" RENAME TO "Milestone";
CREATE INDEX "Milestone_commessaId_ordine_idx" ON "Milestone"("commessaId", "ordine");
CREATE INDEX "Milestone_stato_idx" ON "Milestone"("stato");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
