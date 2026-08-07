import type { Prisma, PrismaClient } from "../../generated/prisma/client";

type PrismaTx = Prisma.TransactionClient | PrismaClient;

const TAGS = [
  { naam: "Opening", volgorde: 10 },
  { naam: "Sluiting", volgorde: 20 },
  { naam: "Scheppen", volgorde: 30 },
  { naam: "Kassa", volgorde: 40 },
  { naam: "Coupes", volgorde: 50 },
  { naam: "Keuken", volgorde: 60 },
  { naam: "Schoonmaak", volgorde: 70 },
  { naam: "BHV", volgorde: 80 },
  { naam: "Floormanager", volgorde: 90 },
] as const;

export async function seedTags(prisma: PrismaTx) {
  console.log("→ Tags");

  for (const tag of TAGS) {
    await prisma.tag.upsert({
      where: {
        naam: tag.naam,
      },
      update: {
        volgorde: tag.volgorde,
        actief: true,
      },
      create: {
        naam: tag.naam,
        volgorde: tag.volgorde,
        actief: true,
      },
    });
  }

  console.log(`   ✓ ${TAGS.length} tags`);
}