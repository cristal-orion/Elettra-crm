CREATE TABLE "TariffarioCliente" (
  "id" TEXT NOT NULL,
  "clienteId" TEXT NOT NULL,
  "versione" INTEGER NOT NULL DEFAULT 1,
  "manodopera" JSONB NOT NULL,
  "materiali" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TariffarioCliente_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Consuntivo" (
  "id" TEXT NOT NULL,
  "commessaId" TEXT NOT NULL,
  "clienteId" TEXT NOT NULL,
  "versione" INTEGER NOT NULL DEFAULT 1,
  "data" DATE NOT NULL,
  "note" TEXT,
  "righe" JSONB NOT NULL,
  "totaleOre" DECIMAL(16,2) NOT NULL,
  "totaleMateriali" DECIMAL(16,2) NOT NULL,
  "totale" DECIMAL(16,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Consuntivo_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ModificaEconomica" (
  "id" TEXT NOT NULL,
  "entita" TEXT NOT NULL,
  "entitaId" TEXT NOT NULL,
  "versione" INTEGER NOT NULL,
  "autoreId" TEXT,
  "autoreNome" TEXT NOT NULL,
  "autoreRuolo" TEXT NOT NULL,
  "prima" JSONB,
  "dopo" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ModificaEconomica_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TariffarioCliente_clienteId_key" ON "TariffarioCliente"("clienteId");
CREATE UNIQUE INDEX "Consuntivo_commessaId_key" ON "Consuntivo"("commessaId");
CREATE INDEX "Consuntivo_clienteId_data_idx" ON "Consuntivo"("clienteId", "data");
CREATE UNIQUE INDEX "ModificaEconomica_entita_entitaId_versione_key" ON "ModificaEconomica"("entita", "entitaId", "versione");
ALTER TABLE "TariffarioCliente" ADD CONSTRAINT "TariffarioCliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Anagrafica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Consuntivo" ADD CONSTRAINT "Consuntivo_commessaId_fkey" FOREIGN KEY ("commessaId") REFERENCES "Commessa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Consuntivo" ADD CONSTRAINT "Consuntivo_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Anagrafica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ModificaEconomica" ADD CONSTRAINT "ModificaEconomica_autoreId_fkey" FOREIGN KEY ("autoreId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
