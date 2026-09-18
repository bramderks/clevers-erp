CREATE TABLE IF NOT EXISTS "LoonkostenWeek" (
  "id" TEXT NOT NULL,
  "weekId" TEXT NOT NULL,
  "omzet" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "aangemaaktOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "gewijzigdOp" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LoonkostenWeek_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LoonkostenWeek_weekId_key" ON "LoonkostenWeek"("weekId");

ALTER TABLE "LoonkostenWeek"
  ADD CONSTRAINT "LoonkostenWeek_weekId_fkey"
  FOREIGN KEY ("weekId") REFERENCES "Week"("id") ON DELETE CASCADE ON UPDATE CASCADE;