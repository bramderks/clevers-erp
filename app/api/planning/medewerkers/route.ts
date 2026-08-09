import { NextResponse } from "next/server";

import { hasPermissionForVestiging } from "@/lib/auth";
import { permissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } =
      new URL(request.url);

    const vestigingId =
      searchParams.get("vestigingId");

    if (!vestigingId) {
      return NextResponse.json(
        {
          fout:
            "vestigingId is verplicht.",
        },
        { status: 400 },
      );
    }

    const toegang =
      await hasPermissionForVestiging(
        permissions.planning.view,
        vestigingId,
      );

    if (!toegang) {
      return NextResponse.json(
        {
          fout:
            "Geen toegang tot de medewerkers van deze vestiging.",
        },
        { status: 403 },
      );
    }

    const medewerkers =
      await prisma.medewerker.findMany({
        where: {
          actief: true,
          vestigingen: {
            some: {
              vestigingId,
            },
          },
        },
        select: {
          id: true,
          personeelsnummer: true,
          aanhef: true,
          voornaam: true,
          tussenvoegsel: true,
          achternaam: true,
        },
        orderBy: [
          {
            achternaam: "asc",
          },
          {
            voornaam: "asc",
          },
        ],
      });

    return NextResponse.json(
      medewerkers,
    );
  } catch (error) {
    console.error(
      "Fout bij ophalen medewerkers planning:",
      error,
    );

    return NextResponse.json(
      {
        fout:
          "De medewerkers konden niet worden opgehaald.",
      },
      { status: 500 },
    );
  }
}