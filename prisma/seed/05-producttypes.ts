import type { Prisma, PrismaClient } from "../../generated/prisma/client";

type PrismaTx = Prisma.TransactionClient | PrismaClient;

const PRODUCT_TYPES = [
  {
    code: "IJS",
    naam: "IJs",
    volgorde: 10,
  },
  {
    code: "TOPPING",
    naam: "Topping",
    volgorde: 20,
  },
  {
    code: "SAUS",
    naam: "Saus",
    volgorde: 30,
  },
  {
    code: "DRANK",
    naam: "Drank",
    volgorde: 40,
  },
  {
    code: "VERPAKKING",
    naam: "Verpakking",
    volgorde: 50,
  },
  {
    code: "SCHOONMAAK",
    naam: "Schoonmaak",
    volgorde: 60,
  },
  {
    code: "KANTOOR",
    naam: "Kantoor",
    volgorde: 70,
  },
  {
    code: "OVERIG",
    naam: "Overig",
    volgorde: 80,
  },
] as const;

export async function seedProductTypes(prisma: PrismaTx) {
  console.log("→ Producttypes");

  for (const productType of PRODUCT_TYPES) {
    await prisma.productType.upsert({
      where: {
        code: productType.code,
      },
      update: {
        naam: productType.naam,
        volgorde: productType.volgorde,
        actief: true,
      },
      create: {
        code: productType.code,
        naam: productType.naam,
        volgorde: productType.volgorde,
        actief: true,
      },
    });
  }

  console.log(`   ✓ ${PRODUCT_TYPES.length} producttypes`);
}