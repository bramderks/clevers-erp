CREATE TABLE IF NOT EXISTS "EmailMelding" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "sleutel" TEXT NOT NULL,
  "systeemGebruikerId" TEXT NOT NULL,
  "geplandVoor" TIMESTAMP(3) NOT NULL,
  "verstuurdOp" TIMESTAMP(3),
  "foutmelding" TEXT,
  "aangemaaktOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "gewijzigdOp" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmailMelding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmailMelding_sleutel_key" ON "EmailMelding"("sleutel");
CREATE INDEX IF NOT EXISTS "EmailMelding_systeemGebruikerId_idx" ON "EmailMelding"("systeemGebruikerId");
CREATE INDEX IF NOT EXISTS "EmailMelding_geplandVoor_idx" ON "EmailMelding"("geplandVoor");
CREATE INDEX IF NOT EXISTS "EmailMelding_verstuurdOp_idx" ON "EmailMelding"("verstuurdOp");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'EmailMelding_systeemGebruikerId_fkey'
  ) THEN
    ALTER TABLE "EmailMelding"
      ADD CONSTRAINT "EmailMelding_systeemGebruikerId_fkey"
      FOREIGN KEY ("systeemGebruikerId")
      REFERENCES "SysteemGebruiker"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;