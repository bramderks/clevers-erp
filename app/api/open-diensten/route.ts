import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const gebruiker = await getCurrentUser();

  if (!gebruiker?.medewerker?.id) {
    return NextResponse.json({ fout: "Geen medewerkeraccount." }, { status: 403 });
  }

  const diensten = await prisma.dienstBezetting.findMany({
    where: {
      status: "OPEN",
      medewerkerId: null,
      dienst: {
        datum: { gte: new Date() },
        week: {
          vestiging: {
            medewerkers: {
              some: { medewerkerId: gebruiker.medewerker.id },
            },
          },
        },
      },
    },
    orderBy: {
      dienst: { datum: "asc" },
    },
    take: 50,
    select: {
      id: true,
      dienst: {
        select: {
          datum: true,
          begintijd: true,
          eindtijd: true,
          week: { select: { vestiging: { select: { naam: true } } } },
        },
      },
    },
  });

  return NextResponse.json(diensten);
}

export async function POST(request: Request) {
  const gebruiker = await getCurrentUser();

  if (!gebruiker?.medewerker?.id) {
    return NextResponse.json({ fout: "Geen medewerkeraccount." }, { status: 403 });
  }

  const body = await request.json();
  const dienstBezettingId = typeof body.dienstBezettingId === "string"
    ? body.dienstBezettingId
    : "";

  if (!dienstBezettingId) {
    return NextResponse.json({ fout: "Dienst ontbreekt." }, { status: 400 });
  }

  const resultaat = await prisma.$transaction(async (tx) => {
    const openDienst = await tx.dienstBezetting.findFirst({
      where: {
        id: dienstBezettingId,
        status: "OPEN",
        medewerkerId: null,
      },
      include: {
        dienst: {
          include: {
            week: { include: { vestiging: true } },
          },
        },
      },
    });

    if (!openDienst) {
      return null;
    }

    const koppeling = await tx.medewerkerVestiging.findFirst({
      where: {
        medewerkerId: gebruiker.medewerker!.id,
        vestigingId: openDienst.dienst.week.vestigingId,
      },
      select: { id: true },
    });

    if (!koppeling) {
      throw new Error("Geen toegang tot deze vestiging.");
    }

    const bezetting = await tx.dienstBezetting.update({
      where: { id: openDienst.id },
      data: {
        medewerkerId: gebruiker.medewerker!.id,
        status: "GEPLAND",
      },
    });

    await tx.auditLog.create({
      data: {
        systeemGebruikerId: gebruiker.id,
        module: "PLANNING",
        actie: "OPEN_DIENST_GEVULD",
        recordId: bezetting.id,
        details: {
          medewerkerId: gebruiker.medewerker!.id,
          vestigingId: openDienst.dienst.week.vestigingId,
        },
      },
    });

    return bezetting;
  });

  if (!resultaat) {
    return NextResponse.json(
      { fout: "Deze open dienst is niet meer beschikbaar." },
      { status: 409 },
    );
  }

  return NextResponse.json({ succes: true, bezetting: resultaat });
}
