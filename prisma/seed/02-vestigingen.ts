import type {
  Prisma,
  PrismaClient,
} from "../../generated/prisma/client";

type PrismaTx =
  | Prisma.TransactionClient
  | PrismaClient;

const VESTIGINGEN = [
  {
    code: "NIJ",
    naam: "Nijmegen",
  },
  {
    code: "ROE",
    naam: "Roermond",
  },
] as const;

export interface SeedVestigingenResult {
  nijmegen: {
    id: string;
    code: string;
    naam: string;
  };
  roermond: {
    id: string;
    code: string;
    naam: string;
  };
}

export async function seedVestigingen(
  prisma: PrismaTx,
  organisatieId: string,
): Promise<SeedVestigingenResult> {
  console.log("→ Vestigingen");

  const resultaten: Record<
    string,
    SeedVestigingenResult["nijmegen"]
  > = {};

  for (const vestiging of VESTIGINGEN) {
    resultaten[vestiging.code] =
      await prisma.vestiging.upsert({
        where: {
          organisatieId_code: {
            organisatieId,
            code: vestiging.code,
          },
        },

        update: {
          naam: vestiging.naam,
          actief: true,
        },

        create: {
          organisatie: {
            connect: {
              id: organisatieId,
            },
          },
          code: vestiging.code,
          naam: vestiging.naam,
          actief: true,
        },

        select: {
          id: true,
          code: true,
          naam: true,
        },
      });
  }

  console.log(
    `   ✓ ${VESTIGINGEN.length} vestigingen`,
  );

  return {
    nijmegen: resultaten.NIJ,
    roermond: resultaten.ROE,
  };
}