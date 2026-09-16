-- Normaliseer de vaste Clevers ERP rollen en planningstags.
--
-- Rollen:
--   Super Admin  -> uitsluitend Bram
--   Eigenaar
--   Teamleider
--   Medewerker
--
-- Planningstags:
--   Leidinggevende, Coupes, Handijs, Bediening, Vaatstraat
--   BHV blijft een controle-tag en is geen planningstag.

INSERT INTO "Rol" ("id", "naam", "omschrijving", "aangemaaktOp", "gewijzigdOp")
VALUES
  ('rol-clevers-super-admin', 'Super Admin', 'Volledige toegang tot Clevers ERP', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rol-clevers-eigenaar', 'Eigenaar', 'Eigenaar van één of meerdere vestigingen', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rol-clevers-teamleider', 'Teamleider', 'Verantwoordelijk voor de dagelijkse aansturing', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rol-clevers-medewerker', 'Medewerker', 'Standaard medewerker', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("naam") DO NOTHING;

-- Organisatiegebruikers hebben precies één rol per organisatie.
-- Niet-toegestane rollen gaan naar Medewerker.
UPDATE "OrganisatieGebruiker" og
SET "rolId" = (SELECT "id" FROM "Rol" WHERE "naam" = 'Medewerker')
WHERE og."rolId" IN (
  SELECT r."id" FROM "Rol" r
  WHERE r."naam" NOT IN ('Super Admin', 'Eigenaar', 'Teamleider', 'Medewerker')
);

UPDATE "OrganisatieGebruiker" og
SET "rolId" = (SELECT "id" FROM "Rol" WHERE "naam" = 'Medewerker')
WHERE og."rolId" = (SELECT "id" FROM "Rol" WHERE "naam" = 'Super Admin')
  AND LOWER((SELECT sg."email" FROM "SysteemGebruiker" sg WHERE sg."id" = og."systeemGebruikerId")) <> 'bram.derks@outlook.com';

-- Medewerkerrollen kunnen meerdere rollen bevatten. Eerst verwijderen we
-- dubbele ongewenste koppelingen als de medewerker al Medewerker heeft.
DELETE FROM "MedewerkerRol" mr
WHERE mr."rolId" IN (
  SELECT r."id" FROM "Rol" r
  WHERE r."naam" NOT IN ('Super Admin', 'Eigenaar', 'Teamleider', 'Medewerker')
)
AND EXISTS (
  SELECT 1
  FROM "MedewerkerRol" bestaand
  WHERE bestaand."medewerkerId" = mr."medewerkerId"
    AND bestaand."rolId" = (SELECT "id" FROM "Rol" WHERE "naam" = 'Medewerker')
);

DELETE FROM "MedewerkerRol" mr
WHERE mr."rolId" = (SELECT "id" FROM "Rol" WHERE "naam" = 'Super Admin')
  AND LOWER((SELECT m."email" FROM "Medewerker" m WHERE m."id" = mr."medewerkerId")) <> 'bram.derks@outlook.com'
  AND EXISTS (
    SELECT 1
    FROM "MedewerkerRol" bestaand
    WHERE bestaand."medewerkerId" = mr."medewerkerId"
      AND bestaand."rolId" = (SELECT "id" FROM "Rol" WHERE "naam" = 'Medewerker')
  );

-- Resterende oude rollen worden Medewerker.
UPDATE "MedewerkerRol" mr
SET "rolId" = (SELECT "id" FROM "Rol" WHERE "naam" = 'Medewerker')
WHERE mr."rolId" IN (
  SELECT r."id" FROM "Rol" r
  WHERE r."naam" NOT IN ('Super Admin', 'Eigenaar', 'Teamleider', 'Medewerker')
);

UPDATE "MedewerkerRol" mr
SET "rolId" = (SELECT "id" FROM "Rol" WHERE "naam" = 'Medewerker')
WHERE mr."rolId" = (SELECT "id" FROM "Rol" WHERE "naam" = 'Super Admin')
  AND LOWER((SELECT m."email" FROM "Medewerker" m WHERE m."id" = mr."medewerkerId")) <> 'bram.derks@outlook.com';

-- Verwijder eventuele dubbele koppelingen na de omzetting.
DELETE FROM "MedewerkerRol" a
USING "MedewerkerRol" b
WHERE a."id" <> b."id"
  AND a."medewerkerId" = b."medewerkerId"
  AND a."rolId" = b."rolId"
  AND a."id" > b."id";

DELETE FROM "Rol"
WHERE "naam" NOT IN ('Super Admin', 'Eigenaar', 'Teamleider', 'Medewerker');

-- Voeg Coupes toe en zet de definitieve volgorde vast.
INSERT INTO "Tag" ("id", "naam", "volgorde", "actief", "aangemaaktOp", "gewijzigdOp")
VALUES ('tag-clevers-coupes', 'Coupes', 20, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("naam") DO UPDATE
SET "volgorde" = EXCLUDED."volgorde", "actief" = TRUE;

UPDATE "Tag"
SET
  "volgorde" = CASE "naam"
    WHEN 'Leidinggevende' THEN 10
    WHEN 'Coupes' THEN 20
    WHEN 'Handijs' THEN 30
    WHEN 'Bediening' THEN 40
    WHEN 'Vaatstraat' THEN 50
    WHEN 'BHV' THEN 60
    ELSE "volgorde"
  END,
  "actief" = CASE
    WHEN "naam" IN ('Leidinggevende', 'Coupes', 'Handijs', 'Bediening', 'Vaatstraat', 'BHV') THEN TRUE
    ELSE FALSE
  END;

-- Oude/extra tags mogen niet in medewerkerprofielen of bestaande diensten
-- blijven staan. BHV blijft behouden als controletag.
DELETE FROM "DienstTag"
WHERE "tagId" IN (
  SELECT "id" FROM "Tag"
  WHERE "naam" NOT IN ('Leidinggevende', 'Coupes', 'Handijs', 'Bediening', 'Vaatstraat', 'BHV')
);

DELETE FROM "MedewerkerTag"
WHERE "tagId" IN (
  SELECT "id" FROM "Tag"
  WHERE "naam" NOT IN ('Leidinggevende', 'Coupes', 'Handijs', 'Bediening', 'Vaatstraat', 'BHV')
);

DELETE FROM "Tag"
WHERE "naam" NOT IN ('Leidinggevende', 'Coupes', 'Handijs', 'Bediening', 'Vaatstraat', 'BHV');
