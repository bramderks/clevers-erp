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

-- Existing automatically generated services are linked only when there is
-- exactly one possible source appointment. Ambiguous records remain untouched.
WITH candidates AS (
  SELECT
    db2."id" AS "bezettingId",
    a."id" AS "afspraakId"
  FROM "DienstBezetting" db2
  JOIN "Dienst" d ON d."id" = db2."dienstId"
  JOIN "DienstTag" dt ON dt."dienstId" = d."id"
  JOIN "VasteUrenAfspraak" a
    ON a."medewerkerId" = db2."medewerkerId"
   AND a."tagId" = dt."tagId"
   AND EXTRACT(ISODOW FROM d."datum")::int = a."dagVanWeek"
   AND d."datum" >= a."startDatum"
   AND d."datum" <= a."eindDatum"
   AND to_char(d."begintijd" AT TIME ZONE 'Europe/Amsterdam', 'HH24:MI') = a."begintijd"
   AND to_char(d."eindtijd" AT TIME ZONE 'Europe/Amsterdam', 'HH24:MI') = a."eindtijd"
  WHERE db2."medewerkerId" IS NOT NULL
    AND db2."vasteUrenAfspraakId" IS NULL
    AND d."opmerkingen" = 'Automatisch ingevuld vanuit een vaste urenafspraak.'
    AND db2."status" NOT IN ('BEVESTIGD', 'GEWERKT')
),
unique_candidates AS (
  SELECT
    "bezettingId",
    MIN("afspraakId") AS "afspraakId"
  FROM candidates
  GROUP BY "bezettingId"
  HAVING COUNT(*) = 1
)
UPDATE "DienstBezetting" db
SET "vasteUrenAfspraakId" = uc."afspraakId"
FROM unique_candidates uc
WHERE db."id" = uc."bezettingId"
  AND db."vasteUrenAfspraakId" IS NULL;
