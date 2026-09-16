import type {
  Prisma,
  PrismaClient,
} from "../../generated/prisma/client";

type PrismaTx =
  | Prisma.TransactionClient
  | PrismaClient;

const TAGS = [
  {
    naam: "Leidinggevende",
    volgorde: 10,
  },
  {
    naam: "Coupes",
    volgorde: 20,
  },
  {
    naam: "Handijs",
    volgorde: 30,
  },
  {
    naam: "Bediening",
    volgorde: 40,
  },
  {
    naam: "Vaatstraat",
    volgorde: 50,
  },
  {
    naam: "BHV",
    volgorde: 60,
  },
] as const;

export async function seedTags(
  prisma: PrismaTx,
) {
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

  // De applicatie kent bewust maar zes personeelstags.
  // BHV blijft bestaan als controletag en wordt niet als planningstag gebruikt.
  await prisma.tag.updateMany({
    where: {
      naam: {
        notIn: TAGS.map((tag) => tag.naam),
      },
    },
    data: {
      actief: false,
    },
  });

  console.log(
    `   ✓ ${TAGS.length} tags`,
  );
}