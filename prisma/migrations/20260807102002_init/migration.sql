-- CreateTable
CREATE TABLE "Vestiging" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "naam" TEXT NOT NULL,
    "actief" BOOLEAN NOT NULL DEFAULT true,
    "aangemaaktOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gewijzigdOp" TIMESTAMP(3) NOT NULL,
    "aangemaaktDoor" TEXT,
    "gewijzigdDoor" TEXT,

    CONSTRAINT "Vestiging_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rol" (
    "id" TEXT NOT NULL,
    "naam" TEXT NOT NULL,
    "omschrijving" TEXT,
    "aangemaaktOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gewijzigdOp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SysteemGebruiker" (
    "id" TEXT NOT NULL,
    "naam" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "wachtwoordHash" TEXT NOT NULL,
    "actief" BOOLEAN NOT NULL DEFAULT true,
    "laatsteLoginOp" TIMESTAMP(3),
    "aangemaaktOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gewijzigdOp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SysteemGebruiker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SysteemGebruikerRol" (
    "id" TEXT NOT NULL,
    "systeemGebruikerId" TEXT NOT NULL,
    "rolId" TEXT NOT NULL,

    CONSTRAINT "SysteemGebruikerRol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "systeemGebruikerId" TEXT,
    "module" TEXT NOT NULL,
    "actie" TEXT NOT NULL,
    "recordId" TEXT,
    "details" JSONB,
    "aangemaaktOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Medewerker" (
    "id" TEXT NOT NULL,
    "personeelsnummer" TEXT,
    "voornaam" TEXT NOT NULL,
    "tussenvoegsel" TEXT,
    "achternaam" TEXT NOT NULL,
    "roepnaam" TEXT,
    "email" TEXT,
    "telefoon" TEXT,
    "wachtwoordHash" TEXT,
    "geboortedatum" TIMESTAMP(3),
    "actief" BOOLEAN NOT NULL DEFAULT true,
    "contractType" TEXT,
    "contractUren" DECIMAL(5,2),
    "aangemaaktOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gewijzigdOp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Medewerker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedewerkerVestiging" (
    "id" TEXT NOT NULL,
    "medewerkerId" TEXT NOT NULL,
    "vestigingId" TEXT NOT NULL,
    "hoofdvestiging" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MedewerkerVestiging_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedewerkerRol" (
    "id" TEXT NOT NULL,
    "medewerkerId" TEXT NOT NULL,
    "rolId" TEXT NOT NULL,

    CONSTRAINT "MedewerkerRol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "naam" TEXT NOT NULL,
    "volgorde" INTEGER NOT NULL,
    "actief" BOOLEAN NOT NULL DEFAULT true,
    "aangemaaktOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gewijzigdOp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedewerkerTag" (
    "id" TEXT NOT NULL,
    "medewerkerId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "MedewerkerTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Week" (
    "id" TEXT NOT NULL,
    "vestigingId" TEXT NOT NULL,
    "jaar" INTEGER NOT NULL,
    "weeknummer" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "aangemaaktOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gewijzigdOp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Week_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dienst" (
    "id" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "datum" TIMESTAMP(3) NOT NULL,
    "begintijd" TIMESTAMP(3) NOT NULL,
    "eindtijd" TIMESTAMP(3) NOT NULL,
    "opmerkingen" TEXT,
    "aangemaaktOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gewijzigdOp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dienst_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DienstTag" (
    "id" TEXT NOT NULL,
    "dienstId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "aantal" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "DienstTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DienstBezetting" (
    "id" TEXT NOT NULL,
    "dienstId" TEXT NOT NULL,
    "medewerkerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "aangemaaktOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DienstBezetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "naam" TEXT NOT NULL,
    "volgorde" INTEGER NOT NULL,
    "actief" BOOLEAN NOT NULL DEFAULT true,
    "aangemaaktOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gewijzigdOp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "naam" TEXT NOT NULL,
    "productTypeId" TEXT NOT NULL,
    "actief" BOOLEAN NOT NULL DEFAULT true,
    "volgorde" INTEGER NOT NULL,
    "leverancier" TEXT,
    "artikelnummer" TEXT,
    "bestelEenheid" TEXT,
    "voorraadEenheid" TEXT,
    "aangemaaktOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gewijzigdOp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VestigingProduct" (
    "id" TEXT NOT NULL,
    "vestigingId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "minimumVoorraad" DECIMAL(10,2),
    "bufferVoorraad" DECIMAL(10,2),
    "standaardBestelling" DECIMAL(10,2),
    "actief" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "VestigingProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bestelling" (
    "id" TEXT NOT NULL,
    "vestigingId" TEXT NOT NULL,
    "besteldatum" TIMESTAMP(3) NOT NULL,
    "leverdatum" TIMESTAMP(3),
    "statusId" TEXT NOT NULL,
    "opmerkingen" TEXT,
    "aangemaaktOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gewijzigdOp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bestelling_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BestelRegel" (
    "id" TEXT NOT NULL,
    "bestellingId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "adviesAantal" DECIMAL(10,2) NOT NULL,
    "besteldAantal" DECIMAL(10,2) NOT NULL,
    "geleverdAantal" DECIMAL(10,2),

    CONSTRAINT "BestelRegel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoorraadTelling" (
    "id" TEXT NOT NULL,
    "vestigingId" TEXT NOT NULL,
    "teldatum" TIMESTAMP(3) NOT NULL,
    "statusId" TEXT NOT NULL,
    "opmerkingen" TEXT,
    "aangemaaktOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gewijzigdOp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoorraadTelling_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoorraadTellingRegel" (
    "id" TEXT NOT NULL,
    "tellingId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "geteld" DECIMAL(10,2) NOT NULL,
    "advies" DECIMAL(10,2),
    "bestelling" DECIMAL(10,2),

    CONSTRAINT "VoorraadTellingRegel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoorraadMutatie" (
    "id" TEXT NOT NULL,
    "vestigingId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "aantal" DECIMAL(10,2) NOT NULL,
    "reden" TEXT NOT NULL,
    "referentie" TEXT,
    "opmerkingen" TEXT,
    "aangemaaktOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoorraadMutatie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Levering" (
    "id" TEXT NOT NULL,
    "bestellingId" TEXT NOT NULL,
    "leverdatum" TIMESTAMP(3) NOT NULL,
    "pakbonNummer" TEXT,
    "opmerkingen" TEXT,
    "aangemaaktOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gewijzigdOp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Levering_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeveringRegel" (
    "id" TEXT NOT NULL,
    "leveringId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "besteld" DECIMAL(10,2) NOT NULL,
    "geleverd" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "LeveringRegel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Status" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "naam" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "volgorde" INTEGER NOT NULL,
    "actief" BOOLEAN NOT NULL DEFAULT true,
    "aangemaaktOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gewijzigdOp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Instelling" (
    "id" TEXT NOT NULL,
    "sleutel" TEXT NOT NULL,
    "waarde" TEXT NOT NULL,
    "omschrijving" TEXT,
    "aangemaaktOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gewijzigdOp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Instelling_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vestiging_code_key" ON "Vestiging"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Vestiging_naam_key" ON "Vestiging"("naam");

-- CreateIndex
CREATE INDEX "Vestiging_actief_idx" ON "Vestiging"("actief");

-- CreateIndex
CREATE UNIQUE INDEX "Rol_naam_key" ON "Rol"("naam");

-- CreateIndex
CREATE UNIQUE INDEX "SysteemGebruiker_email_key" ON "SysteemGebruiker"("email");

-- CreateIndex
CREATE INDEX "SysteemGebruiker_actief_idx" ON "SysteemGebruiker"("actief");

-- CreateIndex
CREATE UNIQUE INDEX "SysteemGebruikerRol_systeemGebruikerId_rolId_key" ON "SysteemGebruikerRol"("systeemGebruikerId", "rolId");

-- CreateIndex
CREATE INDEX "AuditLog_module_idx" ON "AuditLog"("module");

-- CreateIndex
CREATE INDEX "AuditLog_aangemaaktOp_idx" ON "AuditLog"("aangemaaktOp");

-- CreateIndex
CREATE UNIQUE INDEX "Medewerker_personeelsnummer_key" ON "Medewerker"("personeelsnummer");

-- CreateIndex
CREATE UNIQUE INDEX "Medewerker_email_key" ON "Medewerker"("email");

-- CreateIndex
CREATE INDEX "Medewerker_actief_idx" ON "Medewerker"("actief");

-- CreateIndex
CREATE INDEX "Medewerker_achternaam_idx" ON "Medewerker"("achternaam");

-- CreateIndex
CREATE INDEX "MedewerkerVestiging_medewerkerId_idx" ON "MedewerkerVestiging"("medewerkerId");

-- CreateIndex
CREATE INDEX "MedewerkerVestiging_vestigingId_idx" ON "MedewerkerVestiging"("vestigingId");

-- CreateIndex
CREATE UNIQUE INDEX "MedewerkerVestiging_medewerkerId_vestigingId_key" ON "MedewerkerVestiging"("medewerkerId", "vestigingId");

-- CreateIndex
CREATE INDEX "MedewerkerRol_medewerkerId_idx" ON "MedewerkerRol"("medewerkerId");

-- CreateIndex
CREATE INDEX "MedewerkerRol_rolId_idx" ON "MedewerkerRol"("rolId");

-- CreateIndex
CREATE UNIQUE INDEX "MedewerkerRol_medewerkerId_rolId_key" ON "MedewerkerRol"("medewerkerId", "rolId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_naam_key" ON "Tag"("naam");

-- CreateIndex
CREATE INDEX "Tag_volgorde_idx" ON "Tag"("volgorde");

-- CreateIndex
CREATE INDEX "Tag_actief_idx" ON "Tag"("actief");

-- CreateIndex
CREATE INDEX "MedewerkerTag_medewerkerId_idx" ON "MedewerkerTag"("medewerkerId");

-- CreateIndex
CREATE INDEX "MedewerkerTag_tagId_idx" ON "MedewerkerTag"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "MedewerkerTag_medewerkerId_tagId_key" ON "MedewerkerTag"("medewerkerId", "tagId");

-- CreateIndex
CREATE UNIQUE INDEX "Week_vestigingId_jaar_weeknummer_key" ON "Week"("vestigingId", "jaar", "weeknummer");

-- CreateIndex
CREATE INDEX "Dienst_datum_idx" ON "Dienst"("datum");

-- CreateIndex
CREATE UNIQUE INDEX "DienstTag_dienstId_tagId_key" ON "DienstTag"("dienstId", "tagId");

-- CreateIndex
CREATE INDEX "DienstBezetting_status_idx" ON "DienstBezetting"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ProductType_code_key" ON "ProductType"("code");

-- CreateIndex
CREATE INDEX "ProductType_volgorde_idx" ON "ProductType"("volgorde");

-- CreateIndex
CREATE INDEX "ProductType_actief_idx" ON "ProductType"("actief");

-- CreateIndex
CREATE UNIQUE INDEX "Product_code_key" ON "Product"("code");

-- CreateIndex
CREATE INDEX "Product_naam_idx" ON "Product"("naam");

-- CreateIndex
CREATE INDEX "Product_actief_idx" ON "Product"("actief");

-- CreateIndex
CREATE INDEX "Product_volgorde_idx" ON "Product"("volgorde");

-- CreateIndex
CREATE INDEX "VestigingProduct_vestigingId_idx" ON "VestigingProduct"("vestigingId");

-- CreateIndex
CREATE INDEX "VestigingProduct_productId_idx" ON "VestigingProduct"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "VestigingProduct_vestigingId_productId_key" ON "VestigingProduct"("vestigingId", "productId");

-- CreateIndex
CREATE INDEX "Bestelling_vestigingId_idx" ON "Bestelling"("vestigingId");

-- CreateIndex
CREATE INDEX "Bestelling_besteldatum_idx" ON "Bestelling"("besteldatum");

-- CreateIndex
CREATE INDEX "Bestelling_statusId_idx" ON "Bestelling"("statusId");

-- CreateIndex
CREATE INDEX "BestelRegel_bestellingId_idx" ON "BestelRegel"("bestellingId");

-- CreateIndex
CREATE INDEX "BestelRegel_productId_idx" ON "BestelRegel"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "BestelRegel_bestellingId_productId_key" ON "BestelRegel"("bestellingId", "productId");

-- CreateIndex
CREATE INDEX "VoorraadTelling_vestigingId_idx" ON "VoorraadTelling"("vestigingId");

-- CreateIndex
CREATE INDEX "VoorraadTelling_teldatum_idx" ON "VoorraadTelling"("teldatum");

-- CreateIndex
CREATE INDEX "VoorraadTellingRegel_tellingId_idx" ON "VoorraadTellingRegel"("tellingId");

-- CreateIndex
CREATE INDEX "VoorraadTellingRegel_productId_idx" ON "VoorraadTellingRegel"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "VoorraadTellingRegel_tellingId_productId_key" ON "VoorraadTellingRegel"("tellingId", "productId");

-- CreateIndex
CREATE INDEX "VoorraadMutatie_vestigingId_idx" ON "VoorraadMutatie"("vestigingId");

-- CreateIndex
CREATE INDEX "VoorraadMutatie_productId_idx" ON "VoorraadMutatie"("productId");

-- CreateIndex
CREATE INDEX "Levering_leverdatum_idx" ON "Levering"("leverdatum");

-- CreateIndex
CREATE INDEX "LeveringRegel_leveringId_idx" ON "LeveringRegel"("leveringId");

-- CreateIndex
CREATE INDEX "LeveringRegel_productId_idx" ON "LeveringRegel"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "LeveringRegel_leveringId_productId_key" ON "LeveringRegel"("leveringId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "Status_code_key" ON "Status"("code");

-- CreateIndex
CREATE INDEX "Status_module_idx" ON "Status"("module");

-- CreateIndex
CREATE INDEX "Status_volgorde_idx" ON "Status"("volgorde");

-- CreateIndex
CREATE UNIQUE INDEX "Instelling_sleutel_key" ON "Instelling"("sleutel");

-- AddForeignKey
ALTER TABLE "SysteemGebruikerRol" ADD CONSTRAINT "SysteemGebruikerRol_systeemGebruikerId_fkey" FOREIGN KEY ("systeemGebruikerId") REFERENCES "SysteemGebruiker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SysteemGebruikerRol" ADD CONSTRAINT "SysteemGebruikerRol_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "Rol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_systeemGebruikerId_fkey" FOREIGN KEY ("systeemGebruikerId") REFERENCES "SysteemGebruiker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedewerkerVestiging" ADD CONSTRAINT "MedewerkerVestiging_medewerkerId_fkey" FOREIGN KEY ("medewerkerId") REFERENCES "Medewerker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedewerkerVestiging" ADD CONSTRAINT "MedewerkerVestiging_vestigingId_fkey" FOREIGN KEY ("vestigingId") REFERENCES "Vestiging"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedewerkerRol" ADD CONSTRAINT "MedewerkerRol_medewerkerId_fkey" FOREIGN KEY ("medewerkerId") REFERENCES "Medewerker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedewerkerRol" ADD CONSTRAINT "MedewerkerRol_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "Rol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedewerkerTag" ADD CONSTRAINT "MedewerkerTag_medewerkerId_fkey" FOREIGN KEY ("medewerkerId") REFERENCES "Medewerker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedewerkerTag" ADD CONSTRAINT "MedewerkerTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Week" ADD CONSTRAINT "Week_vestigingId_fkey" FOREIGN KEY ("vestigingId") REFERENCES "Vestiging"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dienst" ADD CONSTRAINT "Dienst_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "Week"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DienstTag" ADD CONSTRAINT "DienstTag_dienstId_fkey" FOREIGN KEY ("dienstId") REFERENCES "Dienst"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DienstTag" ADD CONSTRAINT "DienstTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DienstBezetting" ADD CONSTRAINT "DienstBezetting_dienstId_fkey" FOREIGN KEY ("dienstId") REFERENCES "Dienst"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DienstBezetting" ADD CONSTRAINT "DienstBezetting_medewerkerId_fkey" FOREIGN KEY ("medewerkerId") REFERENCES "Medewerker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_productTypeId_fkey" FOREIGN KEY ("productTypeId") REFERENCES "ProductType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VestigingProduct" ADD CONSTRAINT "VestigingProduct_vestigingId_fkey" FOREIGN KEY ("vestigingId") REFERENCES "Vestiging"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VestigingProduct" ADD CONSTRAINT "VestigingProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bestelling" ADD CONSTRAINT "Bestelling_vestigingId_fkey" FOREIGN KEY ("vestigingId") REFERENCES "Vestiging"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bestelling" ADD CONSTRAINT "Bestelling_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "Status"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BestelRegel" ADD CONSTRAINT "BestelRegel_bestellingId_fkey" FOREIGN KEY ("bestellingId") REFERENCES "Bestelling"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BestelRegel" ADD CONSTRAINT "BestelRegel_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoorraadTelling" ADD CONSTRAINT "VoorraadTelling_vestigingId_fkey" FOREIGN KEY ("vestigingId") REFERENCES "Vestiging"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoorraadTelling" ADD CONSTRAINT "VoorraadTelling_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "Status"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoorraadTellingRegel" ADD CONSTRAINT "VoorraadTellingRegel_tellingId_fkey" FOREIGN KEY ("tellingId") REFERENCES "VoorraadTelling"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoorraadTellingRegel" ADD CONSTRAINT "VoorraadTellingRegel_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoorraadMutatie" ADD CONSTRAINT "VoorraadMutatie_vestigingId_fkey" FOREIGN KEY ("vestigingId") REFERENCES "Vestiging"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoorraadMutatie" ADD CONSTRAINT "VoorraadMutatie_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Levering" ADD CONSTRAINT "Levering_bestellingId_fkey" FOREIGN KEY ("bestellingId") REFERENCES "Bestelling"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeveringRegel" ADD CONSTRAINT "LeveringRegel_leveringId_fkey" FOREIGN KEY ("leveringId") REFERENCES "Levering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeveringRegel" ADD CONSTRAINT "LeveringRegel_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
