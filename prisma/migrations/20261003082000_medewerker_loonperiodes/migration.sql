CREATE TABLE "MedewerkerLoonPeriode" (
  "id" TEXT NOT NULL,
  "medewerkerId" TEXT NOT NULL,
  "uurloon" DECIMAL(8,2) NOT NULL,
  "periodeStart" TIMESTAMP(3) NOT NULL,
  "periodeEinde" TIMESTAMP(3) NOT NULL,
  "actief" BOOLEAN NOT NULL DEFAULT true,
  "aangemaaktOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "gewijzigdOp" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MedewerkerLoonPeriode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MedewerkerLoonPeriode_medewerkerId_periodeStart_periodeEinde_key"
ON "MedewerkerLoonPeriode"("medewerkerId","periodeStart","periodeEinde");
CREATE INDEX "MedewerkerLoonPeriode_medewerkerId_periodeStart_idx"
ON "MedewerkerLoonPeriode"("medewerkerId","periodeStart");
CREATE INDEX "MedewerkerLoonPeriode_medewerkerId_periodeEinde_idx"
ON "MedewerkerLoonPeriode"("medewerkerId","periodeEinde");
CREATE INDEX "MedewerkerLoonPeriode_medewerkerId_actief_idx"
ON "MedewerkerLoonPeriode"("medewerkerId","actief");

ALTER TABLE "MedewerkerLoonPeriode"
ADD CONSTRAINT "MedewerkerLoonPeriode_medewerkerId_fkey"
FOREIGN KEY ("medewerkerId") REFERENCES "Medewerker"("id")
ON DELETE CASCADE ON UPDATE CASCADE;