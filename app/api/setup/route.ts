import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const bestaat = await prisma.systeemGebruiker.findFirst();

  if (bestaat) {
    return NextResponse.json({
      melding: "Administrator bestaat al.",
    });
  }

  const hash = await bcrypt.hash("Welkom123!", 10);

  const adminRol = await prisma.rol.create({
    data: {
      naam: "Administrator",
      omschrijving: "Volledige toegang",
    },
  });

  const gebruiker = await prisma.systeemGebruiker.create({
    data: {
      naam: "Administrator",
      email: "admin@clevers.local",
      wachtwoordHash: hash,
      rollen: {
        create: {
          rolId: adminRol.id,
        },
      },
    },
  });

  return NextResponse.json({
    melding: "Administrator aangemaakt.",
    gebruiker: gebruiker.email,
    wachtwoord: "Welkom123!",
  });
}