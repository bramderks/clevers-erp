-- Add payroll period control fields and payroll control records.
ALTER TABLE "VerloningsPeriode"
    ADD COLUMN "controleStart" TIMESTAMP(3),
    ADD COLUMN "controleDeadline" TIMESTAMP(3),
    ADD COLUMN "gecontroleerdDoorId" TEXT,
    ADD COLUMN "gecontroleerdOp" TIMESTAMP(3);

CREATE TABLE "VerloningsControle" (
    "id" TEXT NOT NULL,
    "verloningsPeriodeId" TEXT NOT NULL,
    "medewerkerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "gecontroleerdOp" TIMESTAMP(3),
    "automatischAkkoordOp" TIMESTAMP(3),
    "aangemaaktOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gewijzigdOp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerloningsControle_pkey"
        PRIMARY KEY ("id")
);

CREATE INDEX "VerloningsPeriode_controleStart_idx"
    ON "VerloningsPeriode"("controleStart");

CREATE INDEX "VerloningsPeriode_controleDeadline_idx"
    ON "VerloningsPeriode"("controleDeadline");

CREATE INDEX "VerloningsPeriode_gecontroleerdDoorId_idx"
    ON "VerloningsPeriode"("gecontroleerdDoorId");

CREATE UNIQUE INDEX "VerloningsControle_verloningsPeriodeId_medewerkerId_key"
    ON "VerloningsControle"("verloningsPeriodeId", "medewerkerId");

CREATE INDEX "VerloningsControle_verloningsPeriodeId_idx"
    ON "VerloningsControle"("verloningsPeriodeId");

CREATE INDEX "VerloningsControle_medewerkerId_idx"
    ON "VerloningsControle"("medewerkerId");

CREATE INDEX "VerloningsControle_status_idx"
    ON "VerloningsControle"("status");

CREATE INDEX "VerloningsControle_verloningsPeriodeId_status_idx"
    ON "VerloningsControle"("verloningsPeriodeId", "status");

ALTER TABLE "VerloningsControle"
ADD CONSTRAINT "VerloningsControle_verloningsPeriodeId_fkey"
FOREIGN KEY ("verloningsPeriodeId")
REFERENCES "VerloningsPeriode"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "VerloningsControle"
ADD CONSTRAINT "VerloningsControle_medewerkerId_fkey"
FOREIGN KEY ("medewerkerId")
REFERENCES "Medewerker"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "VerloningsPeriode"
ADD CONSTRAINT "VerloningsPeriode_gecontroleerdDoorId_fkey"
FOREIGN KEY ("gecontroleerdDoorId")
REFERENCES "SysteemGebruiker"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
