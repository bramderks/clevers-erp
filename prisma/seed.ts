import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

import { cleanAccounts } from "./seed/00-clean-accounts";
import { seedRollen } from "./seed/01-rollen";
import { seedVestigingen } from "./seed/02-vestigingen";
import { seedGebruikers } from "./seed/03-gebruikers";
import { seedTags } from "./seed/04-tags";
import { seedProductTypes } from "./seed/05-producttypes";
import { seedStatussen } from "./seed/06-statussen";
import { seedInstellingen } from "./seed/07-instellingen";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.clear();
  console.log("\n========================================");
  console.log("🌱 Clevers ERP Database Seed");
  console.log("========================================\n");

  const organisatie = await prisma.organisatie.upsert({ where: { code: "CLEVERS" }, update: { naam: "Clevers", actief: true }, create: { code: "CLEVERS", naam: "Clevers", actief: true } });
  await cleanAccounts(prisma);
  await seedRollen(prisma);
  const vestigingen = await seedVestigingen(prisma, organisatie.id);
  await seedStatussen(prisma);
  await seedGebruikers(prisma, organisatie.id);
  await seedTags(prisma);
  await seedProductTypes(prisma);
  await seedInstellingen(prisma, vestigingen);

  console.log("\n========================================");
  console.log("✅ Database succesvol gevuld");
  console.log("========================================\n");
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
