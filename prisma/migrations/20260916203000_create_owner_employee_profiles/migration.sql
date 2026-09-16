-- Maak voor bestaande eigenaar-accounts een volwaardig medewerkerprofiel aan.
-- Een eigenaar moet immers ook als planbare medewerker kunnen functioneren.
-- Deze migratie is idempotent.

UPDATE "Medewerker" m
SET "systeemGebruikerId" = sg."id"
FROM "SysteemGebruiker" sg
WHERE LOWER(m."email") = LOWER(sg."email")
  AND LOWER(sg."email") IN ('bram.derks@outlook.com', 'j.derks@clevers.nl')
  AND (m."systeemGebruikerId" IS NULL OR m."systeemGebruikerId" <> sg."id");

INSERT INTO "Medewerker" (
  "id",
  "systeemGebruikerId",
  "aanhef",
  "voornaam",
  "achternaam",
  "geboortedatum",
  "email",
  "telefoon",
  "statusId",
  "actief",
  "aangemaaktOp",
  "gewijzigdOp"
)
SELECT
  md5(sg."id" || ':owner-medewerker'),
  sg."id",
  'GEEN_OPGAVE'::"Aanhef",
  split_part(trim(sg."naam"), ' ', 1),
  CASE
    WHEN position(' ' in trim(sg."naam")) > 0
      THEN substring(trim(sg."naam") from position(' ' in trim(sg."naam")) + 1)
    ELSE trim(sg."naam")
  END,
  DATE '1970-01-01',
  LOWER(trim(sg."email")),
  '',
  st."id",
  TRUE,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "SysteemGebruiker" sg
CROSS JOIN LATERAL (
  SELECT "id"
  FROM "Status"
  WHERE "module" = 'MEDEWERKER'
    AND "code" = 'ACTIEF'
  ORDER BY "id"
  LIMIT 1
) st
WHERE LOWER(sg."email") IN ('bram.derks@outlook.com', 'j.derks@clevers.nl')
  AND NOT EXISTS (
    SELECT 1
    FROM "Medewerker" m
    WHERE m."systeemGebruikerId" = sg."id"
       OR LOWER(m."email") = LOWER(sg."email")
  );

INSERT INTO "MedewerkerRol" (
  "id",
  "medewerkerId",
  "rolId",
  "aangemaaktOp"
)
SELECT
  md5(m."id" || ':medewerker-rol'),
  m."id",
  r."id",
  CURRENT_TIMESTAMP
FROM "Medewerker" m
JOIN "SysteemGebruiker" sg
  ON sg."id" = m."systeemGebruikerId"
JOIN "Rol" r
  ON r."naam" = 'Medewerker'
WHERE LOWER(sg."email") IN ('bram.derks@outlook.com', 'j.derks@clevers.nl')
  AND NOT EXISTS (
    SELECT 1
    FROM "MedewerkerRol" mr
    WHERE mr."medewerkerId" = m."id"
  );
