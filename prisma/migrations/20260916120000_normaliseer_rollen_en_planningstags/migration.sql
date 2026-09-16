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

-- Zorg dat de vier toegestane rollen bestaan voordat oude verwijzingen
-- worden omgezet.
INSERT INTO "Rol" ("id", "naam", "omschrijving")
VALUES
  ('rol-clevers-super-admin', 'Super Admin', 'Volledige toegang tot Clevers ERP'),
  ('rol-clevers-eigenaar', 'Eigenaar', 'Eigenaar van één of meerdere vestigingen'),
  ('rol-clevers-teamleider', 'Teamleider', 'Verantwoordelijk voor de dagelijkse aansturing'),
  ('rol-clevers-medewerker', 'Medewerker', 'Standaard medewerker')
ON CONFLICT ("naam") DO NOTHING;

-- Oude/extra organisatie-rollen worden teruggebracht naar Medewerker.
UPDATE "OrganisatieGebruiker" og
SET "rolId" = (SELECT "id" FROM "Rol" WHERE "naam" = 'Medewerker')
WHERE og."rolId" IN (
  SELECT r."id" FROM "Rol" r
  WHERE r."naam" NOT IN ('Super Admin', 'Eigenaar', 'Teamleider', 'Medewerker')
);

-- Super Admin blijft uitsluitend aan Bram gekoppeld.
UPDATE "OrganisatieGebruiker" og
SET "rolId" = (SELECT "id" FROM "Rol" WHERE "naam" = 'Medewerker')
WHERE og."rolId" = (SELECT "id" FROM "Rol" WHERE "naam" = 'Super Admin')
  AND og."systeemGebruikerId" NOT IN (
    SELECT sg."id"
    FROM "SysteemGebruiker" sg
    WHERE LOWER(sg."email") = 'bram.derks@outlook.com'
  );

-- Hetzelfde voor rollen die direct aan medewerkers hangen.
UPDATE "MedewerkerRol" mr
SET "rolId" = (SELECT "id" FROM "Rol" WHERE "naam" = 'Medewerker')
WHERE mr."rolId" IN (
  SELECT r."id" FROM "Rol" r
  WHERE r."naam" NOT IN ('Super Admin', 'Eigenaar', 'Teamleider', 'Medewerker')
);

UPDATE "MedewerkerRol" mr
SET "rolId" = (SELECT "id" FROM "Rol" WHERE "naam" = 'Medewerker')
WHERE mr."rolId" = (SELECT "id" FROM "Rol" WHERE "naam" = 'Super Admin')
  AND mr."medewerkerId" NOT IN (
    SELECT m."id"
    FROM "Medewerker" m
    WHERE LOWER(m."email") = 'bram.derks@outlook.com'
  );

-- Verwijder dubbele medewerkerrol-koppelingen die door bovenstaande
-- omzetting kunnen zijn ontstaan.
DELETE FROM "MedewerkerRol" a
USING "MedewerkerRol" b
WHERE a."id" <> b."id"
  AND a."medewerkerId" = b."medewerkerId"
  AND a."rolId" = b."rolId"
  AND a."id" > b."id";

-- Nu kunnen de niet-toegestane rollen veilig worden verwijderd.
DELETE FROM "Rol"
WHERE "naam" NOT IN ('Super Admin', 'Eigenaar', 'Teamleider', 'Medewerker');

-- Voeg Coupes toe en zet de definitieve volgorde vast.
INSERT INTO "Tag" ("id", "naam", "volgorde", "actief")
VALUES ('tag-clevers-coupes', 'Coupes', 20, TRUE)
ON CONFLICT ("naam") DO UPDATE
SET "volgorde" = EXCLUDED."volgorde", "actief" = TRUE;

UPDATE "Tag"
SET "volgorde" = CASE "naam"
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
-- blijven staan. Alleen de zes afgesproken tags blijven behouden.
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
