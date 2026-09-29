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

-- Existing automatically generated services are linked when the source
-- can be identified unambiguously by employee, tag, weekday, period and
-- the marker used by the existing generator.
UPDATE "DienstBezetting" db
SET "vasteUrenAfspraakId" = match."id"
FROM (
  SELECT db2."id" AS "bezettingId", a."id"
  FROM "DienstBezetting" db2
  JOIN "Dienst" d ON d."id" = db2."dienstId"
  JOIN "DienstTag" dt ON dt."dienstId" = d."id"
  JOIN "VasteUrenAfspraak" a
    ON a."medewerkerId" = db2."medewerkerId"
   AND a."tagId" = dt."tagId"
   AND EXTRACT(ISODOW FROM d."datum")::int = a."dagVanWeek"
   AND d."datum" >= a."startDatum"
   AND d."datum" <= a."eindDatum"
   AND d."begintijd"::time = make_time(split_part(a."begintijd", ':', 1)::int, split_part(a."begintijd", ':', 2)::int, 0)
   AND d."eindtijd"::time = make_time(split_part(a."eindtijd", ':', 1)::int, split_part(a."eindtijd", ':', 2)::int, 0)
  WHERE db2."medewerkerId" IS NOT NULL
    AND d."opmerkingen" = 'Automatisch ingevuld vanuit een vaste urenafspraak.'
    AND db2."status" NOT IN ('BEVESTIGD', 'GEWERKT')
  GROUP BY db2."id", a."id"
  HAVING COUNT(*) = 1
) match
WHERE db."id" = match."bezettingId"
  AND db."vasteUrenAfspraakId" IS NULL;