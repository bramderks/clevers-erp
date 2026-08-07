import bcrypt from "bcryptjs";
import type { Prisma, PrismaClient } from "../../generated/prisma/client";

type PrismaTx = Prisma.TransactionClient | PrismaClient;

const ADMIN = {
  naam: "Bram Derks",
  email: "bram.derks@outlook.com",
  wachtwoord: "Br@m4128",
} as const;

export async function seedGebruikers(prisma: PrismaTx) {
  console.log("→ Systeemgebruikers");

  const wachtwoordHash = await bcrypt.hash(ADMIN.wachtwoord, 12);

  const gebruiker = await prisma.systeemGebruiker.upsert({
    where: {
      email: ADMIN.email,
    },
    update: {
      naam: ADMIN.naam,
      wachtwoordHash,
      actief: true,
    },
    create: {
      naam: ADMIN.naam,
      email: ADMIN.email,
      wachtwoordHash,
      actief: true,
    },
  });

  const rol = await prisma.rol.findUniqueOrThrow({
    where: {
      naam: "Super Admin",
    },
  });

  const bestaandeKoppeling =
    await prisma.systeemGebruikerRol.findFirst({
      where: {
        systeemGebruikerId: gebruiker.id,
        rolId: rol.id,
      },
    });

  if (!bestaandeKoppeling) {
    await prisma.systeemGebruikerRol.create({
      data: {
        systeemGebruikerId: gebruiker.id,
        rolId: rol.id,
      },
    });
  }

  console.log("   ✓ Super Admin");
}