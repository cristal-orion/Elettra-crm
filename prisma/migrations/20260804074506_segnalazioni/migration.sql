-- CreateTable
CREATE TABLE "Segnalazione" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "titolo" TEXT NOT NULL,
    "descrizione" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'PROBLEMA',
    "priorita" TEXT NOT NULL DEFAULT 'MEDIA',
    "stato" TEXT NOT NULL DEFAULT 'APERTA',
    "pagina" TEXT,
    "autoreId" TEXT NOT NULL,
    "risoluzione" TEXT,
    "conclusaIl" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Segnalazione_autoreId_fkey" FOREIGN KEY ("autoreId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AllegatoSegnalazione" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "segnalazioneId" TEXT NOT NULL,
    "nomeFile" TEXT NOT NULL,
    "tipoMime" TEXT,
    "percorso" TEXT NOT NULL,
    "dimensione" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AllegatoSegnalazione_segnalazioneId_fkey" FOREIGN KEY ("segnalazioneId") REFERENCES "Segnalazione" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Segnalazione_stato_idx" ON "Segnalazione"("stato");

-- CreateIndex
CREATE INDEX "Segnalazione_autoreId_idx" ON "Segnalazione"("autoreId");

-- CreateIndex
CREATE INDEX "Segnalazione_createdAt_idx" ON "Segnalazione"("createdAt");

-- CreateIndex
CREATE INDEX "AllegatoSegnalazione_segnalazioneId_idx" ON "AllegatoSegnalazione"("segnalazioneId");
