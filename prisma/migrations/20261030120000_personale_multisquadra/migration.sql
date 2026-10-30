-- Relazione molti-a-molti. Conserva ogni appartenenza precedente, anche inattiva.
CREATE TABLE "_ComponentiSquadra" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL,
  CONSTRAINT "_ComponentiSquadra_AB_pkey" PRIMARY KEY ("A", "B")
);
CREATE INDEX "_ComponentiSquadra_B_index" ON "_ComponentiSquadra"("B");
ALTER TABLE "_ComponentiSquadra" ADD CONSTRAINT "_ComponentiSquadra_A_fkey"
  FOREIGN KEY ("A") REFERENCES "Operaio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_ComponentiSquadra" ADD CONSTRAINT "_ComponentiSquadra_B_fkey"
  FOREIGN KEY ("B") REFERENCES "Squadra"("id") ON DELETE CASCADE ON UPDATE CASCADE;
INSERT INTO "_ComponentiSquadra" ("A", "B")
  SELECT o.id, s.id FROM "Operaio" o JOIN "Squadra" s ON s.nome = o.squadra;
ALTER TABLE "Operaio" DROP CONSTRAINT "Operaio_squadra_fkey";
DROP INDEX "Operaio_squadra_idx";
ALTER TABLE "Operaio" DROP COLUMN "squadra";
