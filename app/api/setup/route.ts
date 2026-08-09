import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const bestaandeGebruiker =
      await prisma.systeemGebruiker.findFirst();

    if (bestaandeGebruiker) {
      return NextResponse.json({
        melding: "Er bestaat al een systeemgebruiker.",
      });
    }

    const organisatie = await prisma.organisatie.create({
      data: {
        code: "CLE",
        naam: "Clevers",
      },
    });

    const eigenaarRol = await prisma.rol.upsert({
      where: {
        naam: "Eigenaar",
      },
      update: {},
      create: {
        naam: "Eigenaar",
        omschrijving: "Organisatiebrede eigenaar",
      },
    });

    const hash = await bcrypt.hash("Welkom123!", 10);

    const gebruiker = await prisma.systeemGebruiker.create({
      data: {
        naam: "Administrator",
        email: "admin@clevers.local",
        wachtwoordHash: hash,

        organisaties: {
          create: {
            organisatieId: organisatie.id,
            rolId: eigenaarRol.id,
          },
        },
      },
    });

    return NextResponse.json({
      melding: "Basisorganisatie en eigenaar aangemaakt.",
      organisatie: organisatie.naam,
      gebruiker: gebruiker.email,
      wachtwoord: "Welkom123!",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        melding: "Er is een interne fout opgetreden.",
      },
      {
        status: 500,
      },
    );
  }
}