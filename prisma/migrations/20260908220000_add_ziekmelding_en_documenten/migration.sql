-- CreateTable
CREATE TABLE "Ziekmelding" (
    "id" TEXT NOT NULL,
    "medewerkerId" TEXT NOT NULL,
    "ziekVanaf" TIMESTAMP(3) NOT NULL,
    "verwachtHersteldOp" TIMESTAMP(3),
    "hersteldOp" TIMESTAMP(3),
    "opmerking" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ZIEK',
    "aangemaaktOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gewijzigdOp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ziekmelding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedewerkerDocument" (
    "id" TEXT NOT NULL,
    "medewerkerId" TEXT NOT NULL,
    "categorie" TEXT NOT NULL,
    "naam" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "verloopDatum" TIMESTAMP(3),
    "opmerkingen" TEXT,
    "aangemaaktDoorId" TEXT,
    "aangemaaktOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gewijzigdOp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedewerkerDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Ziekmelding_medewerkerId_idx" ON "Ziekmelding"("medewerkerId");
CREATE INDEX "Ziekmelding_status_idx" ON "Ziekmelding"("status");
CREATE INDEX "MedewerkerDocument_medewerkerId_idx" ON "MedewerkerDocument"("medewerkerId");
CREATE INDEX "MedewerkerDocument_categorie_idx" ON "MedewerkerDocument"("categorie");
CREATE INDEX "MedewerkerDocument_verloopDatum_idx" ON "MedewerkerDocument"("verloopDatum");

ALTER TABLE "Ziekmelding" ADD CONSTRAINT "Ziekmelding_medewerkerId_fkey"
FOREIGN KEY ("medewerkerId") REFERENCES "Medewerker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MedewerkerDocument" ADD CONSTRAINT "MedewerkerDocument_medewerkerId_fkey"
FOREIGN KEY ("medewerkerId") REFERENCES "Medewerker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
