-- Startsaldocorrectie voor vaste contracturen wanneer historische planningen ontbreken.
ALTER TABLE "Medewerker"
  ADD COLUMN IF NOT EXISTS "contractUrenStartSaldo" DECIMAL(7,2),
  ADD COLUMN IF NOT EXISTS "contractUrenStartPeildatum" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "contractUrenStartNotitie" TEXT;
