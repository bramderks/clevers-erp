-- Medewerkerdossier en eigenaar-only afspraken.
CREATE TABLE IF NOT EXISTS "MedewerkerDossierItem" (
  "id" TEXT NOT NULL,
  "medewerkerId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "titel" TEXT NOT NULL,
  "omschrijving" TEXT,
  "kanaal" TEXT,
  "documentNaam" TEXT,
  "documentUrl" TEXT,
  "datum" TIMESTAMP(3) NOT NULL,
  "aangemaaktOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "gewijzigdOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MedewerkerDossierItem_pkey"
    PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "VasteUrenAfspraak" (
  "id" TEXT NOT NULL,
  "medewerkerId" TEXT NOT NULL,
  "vestigingId" TEXT NOT NULL,
  "tagId" TEXT NOT NULL,
  "dagVanWeek" INTEGER NOT NULL,
  "begintijd" TEXT NOT NULL,
  "eindtijd" TEXT NOT NULL,
  "startDatum" TIMESTAMP(3) NOT NULL,
  "eindDatum" TIMESTAMP(3) NOT NULL,
  "actief" BOOLEAN NOT NULL DEFAULT TRUE,
  "akkoordDoorId" TEXT,
  "akkoordOp" TIMESTAMP(3),
  "aangemaaktOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "gewijzigdOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "VasteUrenAfspraak_pkey"
    PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MedewerkerDossierItem_medewerkerId_idx"
  ON "MedewerkerDossierItem"("medewerkerId");

CREATE INDEX IF NOT EXISTS "MedewerkerDossierItem_datum_idx"
  ON "MedewerkerDossierItem"("datum");

CREATE INDEX IF NOT EXISTS "MedewerkerDossierItem_type_idx"
  ON "MedewerkerDossierItem"("type");

CREATE INDEX IF NOT EXISTS "VasteUrenAfspraak_medewerkerId_idx"
  ON "VasteUrenAfspraak"("medewerkerId");

CREATE INDEX IF NOT EXISTS "VasteUrenAfspraak_vestigingId_idx"
  ON "VasteUrenAfspraak"("vestigingId");

CREATE INDEX IF NOT EXISTS "VasteUrenAfspraak_tagId_idx"
  ON "VasteUrenAfspraak"("tagId");

CREATE INDEX IF NOT EXISTS "VasteUrenAfspraak_actief_idx"
  ON "VasteUrenAfspraak"("actief");

CREATE INDEX IF NOT EXISTS "VasteUrenAfspraak_startDatum_eindDatum_idx"
  ON "VasteUrenAfspraak"("startDatum", "eindDatum");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'MedewerkerDossierItem_medewerkerId_fkey'
  ) THEN
    ALTER TABLE "MedewerkerDossierItem"
      ADD CONSTRAINT "MedewerkerDossierItem_medewerkerId_fkey"
      FOREIGN KEY ("medewerkerId")
      REFERENCES "Medewerker"("id")
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'VasteUrenAfspraak_medewerkerId_fkey'
  ) THEN
    ALTER TABLE "VasteUrenAfspraak"
      ADD CONSTRAINT "VasteUrenAfspraak_medewerkerId_fkey"
      FOREIGN KEY ("medewerkerId")
      REFERENCES "Medewerker"("id")
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'VasteUrenAfspraak_vestigingId_fkey'
  ) THEN
    ALTER TABLE "VasteUrenAfspraak"
      ADD CONSTRAINT "VasteUrenAfspraak_vestigingId_fkey"
      FOREIGN KEY ("vestigingId")
      REFERENCES "Vestiging"("id")
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'VasteUrenAfspraak_tagId_fkey'
  ) THEN
    ALTER TABLE "VasteUrenAfspraak"
      ADD CONSTRAINT "VasteUrenAfspraak_tagId_fkey"
      FOREIGN KEY ("tagId")
      REFERENCES "Tag"("id")
      ON DELETE RESTRICT;
  END IF;
END $$;

ALTER TABLE "VasteUrenAfspraak"
  ADD CONSTRAINT "VasteUrenAfspraak_dagVanWeek_check"
  CHECK ("dagVanWeek" BETWEEN 1 AND 7);
