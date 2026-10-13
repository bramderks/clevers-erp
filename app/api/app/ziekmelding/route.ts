import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const gebruiker = await getCurrentUser();

    if (!gebruiker?.actief || !gebruiker.medewerker?.id) {
      return NextResponse.json({ fout: "Geen actief medewerkeraccount." }, { status: 403 });
    }

    const medewerker = await prisma.medewerker.findUnique({
      where: { id: gebruiker.medewerker.id },
      select: { actief: true },
    });
    if (!medewerker?.actief) {
      return NextResponse.json({ fout: "Je medewerkeraccount is niet actief." }, { status: 403 });
    }

    const meldingen = await prisma.ziekmelding.findMany({
      where: { medewerkerId: gebruiker.medewerker.id },
      orderBy: { ziekVanaf: "desc" },
      take: 20,
    });

    return NextResponse.json(meldingen, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Ziekmeldingen van medewerker ophalen mislukt:", error);
    return NextResponse.json({ fout: "Ziekmeldingen konden niet worden opgehaald." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const gebruiker = await getCurrentUser();

    if (!gebruiker?.actief || !gebruiker.medewerker?.id) {
      return NextResponse.json({ fout: "Geen actief medewerkeraccount." }, { status: 403 });
    }

    const medewerker = await prisma.medewerker.findUnique({
      where: { id: gebruiker.medewerker.id },
      select: { actief: true },
    });
    if (!medewerker?.actief) {
      return NextResponse.json({ fout: "Je medewerkeraccount is niet actief." }, { status: 403 });
    }

    let body: { ziekVanaf?: unknown; verwachtHersteldOp?: unknown; opmerking?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ fout: "De aanvraag bevat geen geldige JSON." }, { status: 400 });
    }

    const ziekVanaf = body.ziekVanaf === undefined || body.ziekVanaf === null || body.ziekVanaf === ""
      ? new Date()
      : typeof body.ziekVanaf === "string"
        ? new Date(body.ziekVanaf)
        : new Date(Number.NaN);

    if (Number.isNaN(ziekVanaf.getTime())) {
      return NextResponse.json({ fout: "Ongeldige ziektedatum." }, { status: 400 });
    }

    let verwachtHersteldOp: Date | null = null;
    if (body.verwachtHersteldOp !== undefined && body.verwachtHersteldOp !== null && body.verwachtHersteldOp !== "") {
      if (typeof body.verwachtHersteldOp !== "string") {
        return NextResponse.json({ fout: "Verwachte hersteldatum is ongeldig." }, { status: 400 });
      }
      verwachtHersteldOp = new Date(body.verwachtHersteldOp);
      if (Number.isNaN(verwachtHersteldOp.getTime())) {
        return NextResponse.json({ fout: "Verwachte hersteldatum is ongeldig." }, { status: 400 });
      }
      if (verwachtHersteldOp < ziekVanaf) {
        return NextResponse.json({ fout: "De verwachte hersteldatum kan niet vóór de ziektedatum liggen." }, { status: 400 });
      }
    }

    const actief = await prisma.ziekmelding.findFirst({
      where: {
        medewerkerId: gebruiker.medewerker.id,
        status: "ZIEK",
      },
      select: { id: true },
    });

    if (actief) {
      return NextResponse.json(
        { fout: "Er staat al een actieve ziekmelding open." },
        { status: 409 },
      );
    }

    const melding = await prisma.$transaction(async (tx) => {
      const nieuw = await tx.ziekmelding.create({
        data: {
          medewerkerId: gebruiker.medewerker!.id,
          ziekVanaf,
          verwachtHersteldOp,
          opmerking:
            typeof body.opmerking === "string" && body.opmerking.trim()
              ? body.opmerking.trim()
              : null,
        },
      });

      await tx.auditLog.create({
        data: {
          systeemGebruikerId: gebruiker.id,
          module: "MEDEWERKERS",
          actie: "ZIEKMELDING_AANGEMAAKT",
          recordId: nieuw.id,
          details: {
            medewerkerId: gebruiker.medewerker!.id,
            ziekVanaf: ziekVanaf.toISOString(),
          },
        },
      });

      return nieuw;
    });

    return NextResponse.json({ succes: true, melding });
  } catch (error) {
    console.error("Ziekmelding aanmaken mislukt:", error);
    return NextResponse.json({ fout: "De ziekmelding kon niet worden opgeslagen." }, { status: 500 });
  }
}
