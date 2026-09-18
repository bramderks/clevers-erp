import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isEigenaar } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const gebruiker = await getCurrentUser();
    if (!gebruiker || !(await isEigenaar())) {
      return NextResponse.json({ error: "Geen toegang." }, { status: 403 });
    }

    const body = await request.json();
    const vestigingId = typeof body.vestigingId === "string" ? body.vestigingId : "";
    const jaar = Number(body.jaar);
    const weeknummer = Number(body.weeknummer);
    const omzet = Number(body.omzet);
    const doelPercentage = Number(body.doelPercentage);

    if (!vestigingId || !Number.isInteger(jaar) || !Number.isInteger(weeknummer) || weeknummer < 1 || weeknummer > 53) {
      throw new Error("Ongeldige week.");
    }
    if (!Number.isFinite(omzet) || omzet < 0) {
      throw new Error("Omzet moet 0 of hoger zijn.");
    }
    if (!Number.isFinite(doelPercentage) || doelPercentage <= 0 || doelPercentage > 100) {
      throw new Error("Doelpercentage moet tussen 0 en 100 liggen.");
    }

    const week = await prisma.week.findUnique({
      where: {
        vestigingId_jaar_weeknummer: { vestigingId, jaar, weeknummer },
      },
      select: { id: true, status: true },
    });

    if (!week) throw new Error("Deze planningweek bestaat nog niet.");
    if (week.status === "AFGESLOTEN") {
      return NextResponse.json({ error: "Deze planningweek is afgesloten en kan niet meer worden gewijzigd." }, { status: 409 });
    }

    await prisma.$transaction([
      prisma.loonkostenWeek.upsert({
        where: { weekId: week.id },
        update: { omzet, doelPercentage },
        create: { weekId: week.id, omzet, doelPercentage },
      }),
      prisma.instelling.upsert({
        where: { sleutel: "loonkosten_doel_percentage" },
        update: {
          waarde: String(doelPercentage),
          omschrijving: "Maximaal gewenst percentage loonkosten van de omzet",
        },
        create: {
          sleutel: "loonkosten_doel_percentage",
          waarde: String(doelPercentage),
          omschrijving: "Maximaal gewenst percentage loonkosten van de omzet",
        },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Opslaan mislukt." },
      { status: 400 },
    );
  }
}
