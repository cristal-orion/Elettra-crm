-- CreateTable
CREATE TABLE "Impostazione" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chiave" TEXT NOT NULL,
    "valore" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Impostazione_chiave_key" ON "Impostazione"("chiave");
