-- AlterTable
ALTER TABLE "Prodotto" ADD COLUMN "datiTecnici" TEXT;
ALTER TABLE "Prodotto" ADD COLUMN "marca" TEXT;
ALTER TABLE "Prodotto" ADD COLUMN "note" TEXT;
ALTER TABLE "Prodotto" ADD COLUMN "prezzoListino" DECIMAL;
ALTER TABLE "Prodotto" ADD COLUMN "schedaDimensione" INTEGER;
ALTER TABLE "Prodotto" ADD COLUMN "schedaMime" TEXT;
ALTER TABLE "Prodotto" ADD COLUMN "schedaNomeFile" TEXT;
ALTER TABLE "Prodotto" ADD COLUMN "schedaPercorso" TEXT;

-- CreateIndex
CREATE INDEX "Prodotto_categoria_idx" ON "Prodotto"("categoria");
