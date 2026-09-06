-- Add control period fields to existing payroll periods.
ALTER TABLE "VerloningsPeriode"
  ADD COLUMN IF NOT EXISTS "controleStart" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "controleDeadline" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "gecontroleerdDoorId" TEXT,
  ADD COLUMN IF NOT EXISTS "gecontroleerdOp" TIMESTAMP(3);

-- Create employee-level payroll control records.
CREATE TABLE IF NOT EXISTS "VerloningsControle" (
  "id" TEXT NOT NULL,
  "verloningsPeriodeId" TEXT NOT NULL,
  "medewerkerId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "gecontroleerdOp" TIMESTAMP(3),
  "automatischAkkoordOp" TIMESTAMP(3),
  "aangemaaktOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "gewijzigdOp" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "VerloningsControle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "VerloningsControle_verloningsPeriodeId_medewerkerId_key"
  ON "VerloningsControle"("verloningsPeriodeId", "medewerkerId");

CREATE INDEX IF NOT EXISTS "VerloningsControle_verloningsPeriodeId_idx"
  ON "VerloningsControle"("verloningsPeriodeId");

CREATE INDEX IF NOT EXISTS "VerloningsControle_medewerkerId_idx"
  ON "VerloningsControle"("medewerkerId");

CREATE INDEX IF NOT EXISTS "VerloningsControle_status_idx"
  ON "VerloningsControle"("status");

CREATE INDEX IF NOT EXISTS "VerloningsControle_verloningsPeriodeId_status_idx"
  ON "VerloningsControle"("verloningsPeriodeId", "status");

CREATE INDEX IF NOT EXISTS "VerloningsPeriode_controleStart_idx"
  ON "VerloningsPeriode"("controleStart");

CREATE INDEX IF NOT EXISTS "VerloningsPeriode_controleDeadline_idx"
  ON "VerloningsPeriode"("controleDeadline");

CREATE INDEX IF NOT EXISTS "VerloningsPeriode_gecontroleerdDoorId_idx"
  ON "VerloningsPeriode"("gecontroleerdDoorId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'VerloningsControle_verloningsPeriodeId_fkey'
  ) THEN
    ALTER TABLE "VerloningsControle"
      ADD CONSTRAINT "VerloningsControle_verloningsPeriodeId_fkey"
      FOREIGN KEY ("verloningsPeriodeId")
      REFERENCES "VerloningsPeriode"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'VerloningsControle_medewerkerId_fkey'
  ) THEN
    ALTER TABLE "VerloningsControle"
      ADD CONSTRAINT "VerloningsControle_medewerkerId_fkey"
      FOREIGN KEY ("medewerkerId")
      REFERENCES "Medewerker"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END $$;
