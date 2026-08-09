ALTER TABLE "Vestiging"
ADD COLUMN "seizoenEinde" TIMESTAMP(3),
ADD COLUMN "seizoenStart" TIMESTAMP(3);

CREATE INDEX "Vestiging_seizoenStart_idx"
ON "Vestiging"("seizoenStart");

CREATE INDEX "Vestiging_seizoenEinde_idx"
ON "Vestiging"("seizoenEinde");