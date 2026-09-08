-- Clevers web push subscriptions and delivery log.

CREATE TABLE IF NOT EXISTS "PushSubscription" (
  "id" TEXT NOT NULL,
  "systeemGebruikerId" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "actief" BOOLEAN NOT NULL DEFAULT TRUE,
  "laatsteFoutOp" TIMESTAMP(3),
  "aangemaaktOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "gewijzigdOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PushMelding" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "sleutel" TEXT NOT NULL,
  "pushSubscriptionId" TEXT NOT NULL,
  "systeemGebruikerId" TEXT NOT NULL,
  "dienstBezettingId" TEXT,
  "geplandVoor" TIMESTAMP(3) NOT NULL,
  "verstuurdOp" TIMESTAMP(3),
  "foutmelding" TEXT,
  "aangemaaktOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "gewijzigdOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PushMelding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_endpoint_key"
  ON "PushSubscription"("endpoint");

CREATE UNIQUE INDEX IF NOT EXISTS "PushMelding_sleutel_key"
  ON "PushMelding"("sleutel");

CREATE INDEX IF NOT EXISTS "PushSubscription_systeemGebruikerId_idx"
  ON "PushSubscription"("systeemGebruikerId");

CREATE INDEX IF NOT EXISTS "PushSubscription_actief_idx"
  ON "PushSubscription"("actief");

CREATE INDEX IF NOT EXISTS "PushMelding_systeemGebruikerId_idx"
  ON "PushMelding"("systeemGebruikerId");

CREATE INDEX IF NOT EXISTS "PushMelding_dienstBezettingId_idx"
  ON "PushMelding"("dienstBezettingId");

CREATE INDEX IF NOT EXISTS "PushMelding_geplandVoor_idx"
  ON "PushMelding"("geplandVoor");

CREATE INDEX IF NOT EXISTS "PushMelding_verstuurdOp_idx"
  ON "PushMelding"("verstuurdOp");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'PushSubscription_systeemGebruikerId_fkey'
  ) THEN
    ALTER TABLE "PushSubscription"
      ADD CONSTRAINT "PushSubscription_systeemGebruikerId_fkey"
      FOREIGN KEY ("systeemGebruikerId")
      REFERENCES "SysteemGebruiker"("id")
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'PushMelding_pushSubscriptionId_fkey'
  ) THEN
    ALTER TABLE "PushMelding"
      ADD CONSTRAINT "PushMelding_pushSubscriptionId_fkey"
      FOREIGN KEY ("pushSubscriptionId")
      REFERENCES "PushSubscription"("id")
      ON DELETE CASCADE;
  END IF;
END $$;
