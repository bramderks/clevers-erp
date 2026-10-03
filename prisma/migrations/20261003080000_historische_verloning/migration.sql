ALTER TABLE "VerloningsRegel"
ADD COLUMN "uurloon" DECIMAL(8,2),
ADD COLUMN "loonkosten" DECIMAL(12,2);

CREATE TABLE "HistorischeVerloningsPeriode" (
  "id" TEXT NOT NULL,
  "vestigingId" TEXT NOT NULL,
  "periodeStart" TIMESTAMP(3) NOT NULL,
  "periodeEinde" TIMESTAMP(3) NOT NULL,
  "omschrijving" TEXT,
  "jaar" INTEGER,
  "weeknummer" INTEGER,
  "gemiddeldeOmzet" DECIMAL(12,2) NOT NULL,
  "loonkosten" DECIMAL(12,2) NOT NULL,
  "loonkostenPercentage" DECIMAL(7,3),
  "gemiddeldUurloon" DECIMAL(8,2),
  "weekUrenInzet" DECIMAL(10,2),
  "dagUrenInzet" DECIMAL(10,2),
  "bron" TEXT,
  "vastgelegdOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "gewijzigdOp" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "HistorischeVerloningsPeriode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HistorischeVerloningsPeriode_vestigingId_periodeStart_periodeEinde_key"
ON "HistorischeVerloningsPeriode"("vestigingId", "periodeStart", "periodeEinde");

CREATE INDEX "HistorischeVerloningsPeriode_vestigingId_periodeStart_idx"
ON "HistorischeVerloningsPeriode"("vestigingId", "periodeStart");

CREATE INDEX "HistorischeVerloningsPeriode_vestigingId_jaar_weeknummer_idx"
ON "HistorischeVerloningsPeriode"("vestigingId", "jaar", "weeknummer");

CREATE INDEX "HistorischeVerloningsPeriode_periodeStart_periodeEinde_idx"
ON "HistorischeVerloningsPeriode"("periodeStart", "periodeEinde");

ALTER TABLE "HistorischeVerloningsPeriode"
ADD CONSTRAINT "HistorischeVerloningsPeriode_vestigingId_fkey"
FOREIGN KEY ("vestigingId") REFERENCES "Vestiging"("id")
ON DELETE CASCADE ON UPDATE CASCADE;