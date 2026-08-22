-- CreateTable
CREATE TABLE "VakantieAanvraag" (
    "id" TEXT NOT NULL,
    "medewerkerId" TEXT NOT NULL,
    "vestigingId" TEXT NOT NULL,
    "startDatum" TIMESTAMP(3) NOT NULL,
    "eindDatum" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'VAKANTIE',
    "opmerking" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AANGEVRAAGD',
    "beoordeeldDoorId" TEXT,
    "beoordeeldOp" TIMESTAMP(3),
    "redenAfwijzing" TEXT,
    "aangevraagdOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aangemaaktOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gewijzigdOp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VakantieAanvraag_pkey"
        PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "VakantieAanvraag_medewerkerId_idx"
    ON "VakantieAanvraag"("medewerkerId");

CREATE INDEX "VakantieAanvraag_vestigingId_idx"
    ON "VakantieAanvraag"("vestigingId");

CREATE INDEX "VakantieAanvraag_startDatum_idx"
    ON "VakantieAanvraag"("startDatum");

CREATE INDEX "VakantieAanvraag_eindDatum_idx"
    ON "VakantieAanvraag"("eindDatum");

CREATE INDEX "VakantieAanvraag_status_idx"
    ON "VakantieAanvraag"("status");

CREATE INDEX "VakantieAanvraag_beoordeeldDoorId_idx"
    ON "VakantieAanvraag"("beoordeeldDoorId");

-- Foreign keys
ALTER TABLE "VakantieAanvraag"
ADD CONSTRAINT "VakantieAanvraag_medewerkerId_fkey"
FOREIGN KEY ("medewerkerId")
REFERENCES "Medewerker"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "VakantieAanvraag"
ADD CONSTRAINT "VakantieAanvraag_vestigingId_fkey"
FOREIGN KEY ("vestigingId")
REFERENCES "Vestiging"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;