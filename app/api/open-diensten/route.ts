import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const gebruiker = await getCurrentUser();

  if (!gebruiker?.medewerker?.id) {
    return NextResponse.json({ fout: "Geen medewerkeraccount." }, { status: 403 });
  }

  const medewerkerId = gebruiker.medewerker.id;

  const diensten = await prisma.dienstBezetting.findMany({
    where: {
      status: "OPEN",
      medewerkerId: null,
      dienst: {
        datum: { gte: new Date() },
        week: { vestiging: { medewerkers: { some: { medewerkerId } } } },
        tags: { some: { tag: { medewerkers: { some: { medewerkerId } } } } },
      },
    },
    orderBy: { dienst: { datum: "asc" } },
    take: 50,
    select: {
      id: true,
      dienst: {
        select: {
          datum: true,
          begintijd: true,
          eindtijd: true,
          tags: { select: { tag: { select: { naam: true } } } },
          week: { select: { vestiging: { select: { naam: true } } } },
        },
      },
    },
  });

  const interesse = await prisma.auditLog.findMany({
    where: {
      systeemGebruikerId: gebruiker.id,
      module: "PLANNING",
      actie: "INTERESSE_OPEN_DIENST",
      recordId: { in: diensten.map((dienst) => dienst.id) },
    },
    select: { recordId: true },
  });
  const interesseIds = new Set(interesse.map((item) => item.recordId));

  return NextResponse.json(
    diensten.map((dienst) => ({
      id: dienst.id,
      datum: dienst.dienst.datum,
      begintijd: dienst.dienst.begintijd,
      eindtijd: dienst.dienst.eindtijd,
      vestigingNaam: dienst.dienst.week.vestiging.naam,
      tags: dienst.dienst.tags.map((item) => item.tag.naam),
      interesseGemeld: interesseIds.has(dienst.id),
    })),
  );
}

export async function POST(request: Request) {
  const gebruiker = await getCurrentUser();

  if (!gebruiker?.medewerker?.id) {
    return NextResponse.json({ fout: "Geen medewerkeraccount." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const dienstBezettingId = typeof body?.dienstBezettingId === "string" ? body.dienstBezettingId : "";
  const medewerkerId = gebruiker.medewerker.id;

  const openDienst = await prisma.dienstBezetting.findFirst({
    where: {
      id: dienstBezettingId,
      status: "OPEN",
      medewerkerId: null,
      dienst: {
        datum: { gte: new Date() },
        week: { vestiging: { medewerkers: { some: { medewerkerId } } } },
        tags: { some: { tag: { medewerkers: { some: { medewerkerId } } } } },
      },
    },
    select: { id: true, dienst: { select: { week: { select: { vestigingId: true } } } } },
  });

  if (!openDienst) {
    return NextResponse.json(
      { fout: "Deze open dienst is niet beschikbaar voor jouw planningstags of is al ingevuld." },
      { status: 409 },
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
        details: { medewerkerId, vestigingId: openDienst.dienst.week.vestigingId },
      },
    });
  }

  return NextResponse.json({
    succes: true,
    bericht: "Je beschikbaarheid is doorgegeven. De eigenaar beslist over de definitieve indeling.",
  });
}
