-- Non ricostruisce durate mai registrate e non riscrive gli snapshot SAL.
ALTER TABLE "Milestone" ADD COLUMN "durataGiorni" DOUBLE PRECISION;
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_durataGiorni_check"
  CHECK ("durataGiorni" IS NULL OR ("durataGiorni" >= 0.125 AND "durataGiorni" <= 36500));

CREATE TABLE "Squadra" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "nome" TEXT NOT NULL,
  "note" TEXT,
  "attiva" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "Squadra_nome_key" ON "Squadra"("nome");
-- Conserva esattamente i raggruppamenti preesistenti, incluse le risorse inattive.
INSERT INTO "Squadra" ("id", "nome", "updatedAt")
  SELECT 'legacy-' || md5(squadra), squadra, CURRENT_TIMESTAMP
  FROM "Operaio" WHERE squadra IS NOT NULL GROUP BY squadra;
ALTER TABLE "Operaio" ADD CONSTRAINT "Operaio_squadra_fkey"
  FOREIGN KEY ("squadra") REFERENCES "Squadra"("nome") ON DELETE RESTRICT ON UPDATE CASCADE;
