ALTER TABLE "DienstBezetting" ADD COLUMN "ziekmeldingId" TEXT;

CREATE INDEX "DienstBezetting_ziekmeldingId_idx" ON "DienstBezetting"("ziekmeldingId");

ALTER TABLE "DienstBezetting"
  ADD CONSTRAINT "DienstBezetting_ziekmeldingId_fkey"
  FOREIGN KEY ("ziekmeldingId") REFERENCES "Ziekmelding"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
