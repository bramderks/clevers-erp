import { prisma } from "@/lib/prisma";

import type { Prisma } from "@/generated/prisma/client";

export async function bestaatEmail(
  email: string,
): Promise<boolean> {
  const medewerker = await prisma.medewerker.findUnique({
    where: {
      email,
    },
    select: {
      id: true,
    },
  });

  return medewerker !== null;
}

export async function medewerkerAanmaken(
  data: Prisma.MedewerkerCreateInput,
) {
  return prisma.medewerker.create({
    data,
    select: {
      id: true,
      voornaam: true,
      achternaam: true,
      email: true,
      status: {
        select: {
          code: true,
          naam: true,
        },
      },
    },
  });
}