ALTER TABLE "LoonkostenWeek"
  ADD COLUMN "doelPercentage" DECIMAL(5,2) NOT NULL DEFAULT 20,
  ADD COLUMN "totaalUren" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "totaalKosten" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "gemiddeldUurloon" DECIMAL(8,2) NOT NULL DEFAULT 0,
  ADD COLUMN "percentageOmzet" DECIMAL(8,2),
  ADD COLUMN "snapshot" JSONB,
  ADD COLUMN "afgeslotenOp" TIMESTAMP(3),
  ADD COLUMN "afgeslotenDoorId" TEXT;

CREATE INDEX "LoonkostenWeek_afgeslotenOp_idx"
  ON "LoonkostenWeek"("afgeslotenOp");

CREATE INDEX "LoonkostenWeek_afgeslotenDoorId_idx"
  ON "LoonkostenWeek"("afgeslotenDoorId");
