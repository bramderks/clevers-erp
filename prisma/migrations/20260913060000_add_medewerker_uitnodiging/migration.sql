CREATE TABLE IF NOT EXISTS "MedewerkerUitnodiging" (
  "id" TEXT NOT NULL,
  "organisatieId" TEXT NOT NULL,
  "voornaam" TEXT NOT NULL,
  "achternaam" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "verlooptOp" TIMESTAMP(3) NOT NULL,
  "verstuurdOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "gebruiktOp" TIMESTAMP(3),
  "aangemaaktDoorId" TEXT,
  "aangemaaktOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "gewijzigdOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MedewerkerUitnodiging_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MedewerkerUitnodiging_tokenHash_key" ON "MedewerkerUitnodiging"("tokenHash");
CREATE INDEX IF NOT EXISTS "MedewerkerUitnodiging_organisatieId_idx" ON "MedewerkerUitnodiging"("organisatieId");
CREATE INDEX IF NOT EXISTS "MedewerkerUitnodiging_email_idx" ON "MedewerkerUitnodiging"("email");
CREATE INDEX IF NOT EXISTS "MedewerkerUitnodiging_verlooptOp_idx" ON "MedewerkerUitnodiging"("verlooptOp");
CREATE INDEX IF NOT EXISTS "MedewerkerUitnodiging_gebruiktOp_idx" ON "MedewerkerUitnodiging"("gebruiktOp");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MedewerkerUitnodiging_organisatieId_fkey') THEN
    ALTER TABLE "MedewerkerUitnodiging" ADD CONSTRAINT "MedewerkerUitnodiging_organisatieId_fkey" FOREIGN KEY ("organisatieId") REFERENCES "Organisatie"("id") ON DELETE CASCADE;
  END IF;
END $$;
