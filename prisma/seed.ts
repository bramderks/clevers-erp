import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";


const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  }),
});

async function main() {
  console.log("Seed gestart...");

  const vestiging = await prisma.vestiging.upsert({
    where: {
      code: "HK",
    },
    update: {},
    create: {
      code: "HK",
      naam: "Hoofdkantoor",
    },
  });

  const superAdmin = await prisma.rol.upsert({
    where: {
      naam: "Super Administrator",
    },
    update: {},
    create: {
      naam: "Super Administrator",
      omschrijving: "Volledige toegang",
    },
  });

  const hash = await bcrypt.hash("Br@m4128", 12);

  const gebruiker = await prisma.gebruiker.upsert({
    where: {
      email: "bram.derks@outlook.com",
    },
    update: {},
    create: {
      naam: "Bram Derks",
      email: "bram.derks@outlook.com",
      wachtwoordHash: hash,
      vestigingId: vestiging.id,
    },
  });

  await prisma.gebruikerRol.upsert({
    where: {
      gebruikerId_rolId: {
        gebruikerId: gebruiker.id,
        rolId: superAdmin.id,
      },
    },
    update: {},
    create: {
      gebruikerId: gebruiker.id,
      rolId: superAdmin.id,
    },
  });

  console.log("Seed voltooid.");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });