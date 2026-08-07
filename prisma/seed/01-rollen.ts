import type { Prisma, PrismaClient } from "../../generated/prisma/client";

type PrismaTx = Prisma.TransactionClient | PrismaClient;

const ROLLEN = [
  {
    naam: "Super Admin",
    omschrijving: "Volledige toegang tot Clevers ERP",
  },
  {
    naam: "Eigenaar",
    omschrijving: "Eigenaar van één of meerdere vestigingen",
  },
  {
    naam: "Vestigingsmanager",
    omschrijving: "Beheerder van een vestiging",
  },
  {
    naam: "Teamleider",
    omschrijving: "Verantwoordelijk voor de dagelijkse aansturing",
  },
  {
    naam: "Medewerker",
    omschrijving: "Standaard medewerker",
  },
] as const;

export async function seedRollen(prisma: PrismaTx) {
  console.log("→ Rollen");

  for (const rol of ROLLEN) {
    await prisma.rol.upsert({
      where: {
        naam: rol.naam,
      },
      update: {
        omschrijving: rol.omschrijving,
      },
      create: {
        naam: rol.naam,
        omschrijving: rol.omschrijving,
      },
    });
  }

  console.log(`   ✓ ${ROLLEN.length} rollen`);
}