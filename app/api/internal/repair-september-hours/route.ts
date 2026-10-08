import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { berekenGewerkteUren } from "@/lib/verloning/pauze";

const TOKEN = "sep-hours-2026-10-08-7f4c2a";

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== TOKEN) {
    return NextResponse.json({ error: "Niet toegestaan" }, { status: 403 });
  }

  const start = new Date("2026-08-31T00:00:00.000Z");
  const end = new Date("2026-10-02T00:00:00.000Z");

  const alleBezettingen = await prisma.dienstBezetting.findMany({
    where: {
      medewerkerId: { not: null },
      dienst: {
        datum: { gte: start, lt: end },
        week: {
          vestiging: {
            naam: { contains: "Nijmegen", mode: "insensitive" },
          },
        },
      },
    },
    select: {
      id: true,
      medewerkerId: true,
      dienst: {
        select: {
          datum: true,
          begintijd: true,
          eindtijd: true,
          week: {
            select: { vestigingId: true },
          },
        },
      },
    },
    orderBy: [{ dienst: { datum: "asc" } }, { aangemaaktOp: "asc" }],
  });

  const bezettingen = alleBezettingen.filter((bezetting) => {
    const lokaleDatum = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Amsterdam",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(bezetting.dienst.datum));
    return lokaleDatum >= "2026-09-01" && lokaleDatum < "2026-10-01";
  });

  let aangemaakt = 0;
  let bijgewerkt = 0;

  for (const bezetting of bezettingen) {
    if (!bezetting.medewerkerId) continue;

    const berekening = berekenGewerkteUren(
      bezetting.dienst.begintijd,
      bezetting.dienst.eindtijd,
    );

    const bestaande = await prisma.urenRegistratie.findUnique({
      where: { dienstBezettingId: bezetting.id },
      select: { id: true },
    });

    await prisma.urenRegistratie.upsert({
      where: { dienstBezettingId: bezetting.id },
      create: {
        dienstBezettingId: bezetting.id,
        medewerkerId: bezetting.medewerkerId,
        vestigingId: bezetting.dienst.week.vestigingId,
        datum: bezetting.dienst.datum,
        werkelijkeBegintijd: bezetting.dienst.begintijd,
        werkelijkeEindtijd: bezetting.dienst.eindtijd,
        pauzeMinuten: berekening.pauzeMinuten,
        gewerkteUren: berekening.gewerkteUren,
        status: "TE_CONTROLEREN",
      },
      update: {
        medewerkerId: bezetting.medewerkerId,
        vestigingId: bezetting.dienst.week.vestigingId,
        datum: bezetting.dienst.datum,
        werkelijkeBegintijd: bezetting.dienst.begintijd,
        werkelijkeEindtijd: bezetting.dienst.eindtijd,
        pauzeMinuten: berekening.pauzeMinuten,
        gewerkteUren: berekening.gewerkteUren,
        status: "TE_CONTROLEREN",
        gecontroleerdDoorId: null,
        gecontroleerdOp: null,
      },
    });

    if (bestaande) bijgewerkt++;
    else aangemaakt++;
  }

  return NextResponse.json({
    succes: true,
    diensten: bezettingen.length,
    aangemaakt,
    bijgewerkt,
    status: "TE_CONTROLEREN",
  });
}
