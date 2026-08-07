import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import type { SeedVestigingenResult } from "./02-vestigingen";

type PrismaTx = Prisma.TransactionClient | PrismaClient;

export async function seedInstellingen(
  prisma: PrismaTx,
  vestigingen: SeedVestigingenResult,
) {
  console.log("→ Instellingen");

  const INSTELLINGEN = [
    {
      sleutel: "bedrijfsnaam",
      waarde: "Clevers ERP",
      omschrijving: "Bedrijfsnaam",
    },
    {
      sleutel: "standaard_vestiging",
      waarde: vestigingen.nijmegen.id,
      omschrijving: "Standaard vestiging",
    },
    {
      sleutel: "standaard_taal",
      waarde: "nl",
      omschrijving: "Applicatietaal",
    },
    {
      sleutel: "timezone",
      waarde: "Europe/Amsterdam",
      omschrijving: "Tijdzone",
    },
    {
      sleutel: "planning_start",
      waarde: "08:00",
      omschrijving: "Starttijd planning",
    },
    {
      sleutel: "planning_einde",
      waarde: "23:00",
      omschrijving: "Eindtijd planning",
    },
    {
      sleutel: "week_startdag",
      waarde: "1",
      omschrijving: "Maandag = 1",
    },
    {
      sleutel: "valuta",
      waarde: "EUR",
      omschrijving: "Standaard valuta",
    },
  ] as const;

  for (const instelling of INSTELLINGEN) {
    await prisma.instelling.upsert({
      where: {
        sleutel: instelling.sleutel,
      },
      update: {
        waarde: instelling.waarde,
        omschrijving: instelling.omschrijving,
      },
      create: {
        sleutel: instelling.sleutel,
        waarde: instelling.waarde,
        omschrijving: instelling.omschrijving,
      },
    });
  }

  console.log(`   ✓ ${INSTELLINGEN.length} instellingen`);
}