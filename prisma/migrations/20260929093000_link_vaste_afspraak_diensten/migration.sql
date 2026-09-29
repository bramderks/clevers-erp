-- Link automatically generated duty assignments to their fixed-hours source.
ALTER TABLE "DienstBezetting"
  ADD COLUMN IF NOT EXISTS "vasteUrenAfspraakId" TEXT;

CREATE INDEX IF NOT EXISTS "DienstBezetting_vasteUrenAfspraakId_idx"
  ON "DienstBezetting"("vasteUrenAfspraakId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'DienstBezetting_vasteUrenAfspraakId_fkey'
  ) THEN
    ALTER TABLE "DienstBezetting"
      ADD CONSTRAINT "DienstBezetting_vasteUrenAfspraakId_fkey"
      FOREIGN KEY ("vasteUrenAfspraakId")
      REFERENCES "VasteUrenAfspraak"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;
