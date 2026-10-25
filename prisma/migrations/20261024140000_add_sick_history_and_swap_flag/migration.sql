ALTER TABLE "DienstBezetting"
  ADD COLUMN "isRuilAangeboden" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "statusVoorZiekmelding" TEXT,
  ADD COLUMN "ziekgemeldOp" TIMESTAMP(3);
