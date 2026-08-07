import type { Prisma, PrismaClient } from "../../generated/prisma/client";

type PrismaTx = Prisma.TransactionClient | PrismaClient;

const STATUSSEN = [
  // ===========================
  // BESTELLINGEN
  // ===========================

  {
    code: "BEST_CONCEPT",
    naam: "Concept",
    module: "BESTELLING",
    volgorde: 10,
  },
  {
    code: "BEST_OPEN",
    naam: "Open",
    module: "BESTELLING",
    volgorde: 20,
  },
  {
    code: "BEST_BESTELD",
    naam: "Besteld",
    module: "BESTELLING",
    volgorde: 30,
  },
  {
    code: "BEST_GELEVERD",
    naam: "Geleverd",
    module: "BESTELLING",
    volgorde: 40,
  },
  {
    code: "BEST_AFGEROND",
    naam: "Afgerond",
    module: "BESTELLING",
    volgorde: 50,
  },
  {
    code: "BEST_GEANNULEERD",
    naam: "Geannuleerd",
    module: "BESTELLING",
    volgorde: 99,
  },

  // ===========================
  // VOORRAAD
  // ===========================

  {
    code: "VOORRAAD_OPEN",
    naam: "Open",
    module: "VOORRAAD",
    volgorde: 10,
  },
  {
    code: "VOORRAAD_CONCEPT",
    naam: "Concept",
    module: "VOORRAAD",
    volgorde: 20,
  },
  {
    code: "VOORRAAD_AFGEROND",
    naam: "Afgerond",
    module: "VOORRAAD",
    volgorde: 30,
  },
] as const;

export async function seedStatussen(prisma: PrismaTx) {
  console.log("→ Statussen");

  for (const status of STATUSSEN) {
    await prisma.status.upsert({
      where: {
        code: status.code,
      },
      update: {
        naam: status.naam,
        module: status.module,
        volgorde: status.volgorde,
        actief: true,
      },
      create: {
        code: status.code,
        naam: status.naam,
        module: status.module,
        volgorde: status.volgorde,
        actief: true,
      },
    });
  }

  console.log(`   ✓ ${STATUSSEN.length} statussen`);
}