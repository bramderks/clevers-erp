import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const gebruiker = await getCurrentUser();

  if (!gebruiker?.medewerker?.id) {
    return NextResponse.json({ fout: "Geen medewerkeraccount." }, { status: 403 });
  }

  const meldingen = await prisma.ziekmelding.findMany({
    where: { medewerkerId: gebruiker.medewerker.id },
    orderBy: { ziekVanaf: "desc" },
    take: 20,
  });

  return NextResponse.json(meldingen);
}

export async function POST(request: Request) {
  const gebruiker = await getCurrentUser();

  if (!gebruiker?.medewerker?.id) {
    return NextResponse.json({ fout: "Geen medewerkeraccount." }, { status: 403 });
  }

  const body = await request.json();
  const ziekVanaf = new Date(body.ziekVanaf ?? new Date());

  if (Number.isNaN(ziekVanaf.getTime())) {
    return NextResponse.json({ fout: "Ongeldige datum." }, { status: 400 });
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
        verwachtHersteldOp: body.verwachtHersteldOp
          ? new Date(body.verwachtHersteldOp)
          : null,
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
}
