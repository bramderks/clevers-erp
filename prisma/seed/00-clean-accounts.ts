import type { PrismaClient } from "../../generated/prisma/client";

const BEHOUDEN_EMAILS = [
  "bram.derks@outlook.com",
  "j.derks@clevers.nl",
  "test.medewerker@clevers.nl",
] as const;

export async function cleanAccounts(prisma: PrismaClient) {
  console.log("→ Oude medewerkers en gebruikers opschonen");

  await prisma.medewerker.deleteMany({
    where: { email: { notIn: ["test.medewerker@clevers.nl"] } },
  });

  await prisma.systeemGebruiker.deleteMany({
    where: { email: { notIn: [...BEHOUDEN_EMAILS] } },
  });

  await prisma.medewerkerUitnodiging.deleteMany({
    where: { email: { notIn: ["test.medewerker@clevers.nl"] } },
  });

  console.log("   ✓ Alleen Bram, Jessica en de testmedewerker blijven behouden.");
}
