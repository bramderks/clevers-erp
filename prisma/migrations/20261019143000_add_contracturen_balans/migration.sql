-- Contracturen en verloftegoed voor vaste medewerkers.
ALTER TABLE "Medewerker"
  ADD COLUMN IF NOT EXISTS "jaarUrenNorm" DECIMAL(7,2),
  ADD COLUMN IF NOT EXISTS "verlofUrenStart" DECIMAL(7,2),
  ADD COLUMN IF NOT EXISTS "verlofUrenOpgenomen" DECIMAL(7,2) NOT NULL DEFAULT 0;
