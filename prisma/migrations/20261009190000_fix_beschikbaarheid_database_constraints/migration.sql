-- Beschikbaarheid moet een dag zonder beschikbaarheid kunnen opslaan.
-- De Prisma-schema staat NULL toe voor begin- en eindtijd, maar de
-- productie-database had nog NOT NULL constraints.
ALTER TABLE "Beschikbaarheid"
  ALTER COLUMN "begintijd" DROP NOT NULL,
  ALTER COLUMN "eindtijd" DROP NOT NULL,
  ALTER COLUMN "opmerking" DROP NOT NULL;

-- Ruim eventuele dubbele dagrecords op voordat de unieke sleutel wordt
-- aangemaakt. Bewaar per exacte week/medewerker/datum de laatst gewijzigde.
WITH gerangschikt AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "weekId", "medewerkerId", "datum"
      ORDER BY "gewijzigdOp" DESC NULLS LAST, "aangemaaktOp" DESC NULLS LAST, "id" DESC
    ) AS nummer
  FROM "Beschikbaarheid"
)
DELETE FROM "Beschikbaarheid" AS beschikbaarheid
USING gerangschikt
WHERE beschikbaarheid."id" = gerangschikt."id"
  AND gerangschikt.nummer > 1;

-- De API gebruikt deze samengestelde sleutel voor upsert per dag.
CREATE UNIQUE INDEX IF NOT EXISTS "Beschikbaarheid_weekId_medewerkerId_datum_key"
  ON "Beschikbaarheid" ("weekId", "medewerkerId", "datum");
