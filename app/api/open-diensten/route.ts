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

  const openDienst = await prisma.dienstBezetting.findFirst({
    where: {
      id: dienstBezettingId,
      status: "OPEN",
      medewerkerId: null,
      dienst: { datum: { gte: new Date() } },
    },
    select: {
      id: true,
      dienst: {
        select: {
          week: { select: { vestigingId: true } },
        },
      },
    },
  });

  if (!openDienst) {
    return NextResponse.json(
      { fout: "Deze open dienst is niet meer beschikbaar." },
      { status: 409 },
    );
  }

  const koppeling = await prisma.medewerkerVestiging.findFirst({
    where: {
      medewerkerId: gebruiker.medewerker.id,
      vestigingId: openDienst.dienst.week.vestigingId,
    },
    select: { id: true },
  });

  if (!koppeling) {
    return NextResponse.json(
      { fout: "Je bent niet gekoppeld aan deze vestiging." },
      { status: 403 },
    );
  }

  const bestaand = await prisma.auditLog.findFirst({
    where: {
      systeemGebruikerId: gebruiker.id,
      module: "PLANNING",
      actie: "INTERESSE_OPEN_DIENST",
      recordId: openDienst.id,
    },
    select: { id: true },
  });

  if (!bestaand) {
    await prisma.auditLog.create({
      data: {
        systeemGebruikerId: gebruiker.id,
        module: "PLANNING",
        actie: "INTERESSE_OPEN_DIENST",
        recordId: openDienst.id,
        details: {
          medewerkerId: gebruiker.medewerker.id,
          vestigingId: openDienst.dienst.week.vestigingId,
        },
      },
    });
  }

  return NextResponse.json({
    succes: true,
    bericht: "Je interesse is doorgegeven. De eigenaar beslist over de definitieve indeling.",
  });
}
