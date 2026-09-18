import { NextResponse } from "next/server";

import { getCurrentUser, isEigenaar } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const gebruiker = await getCurrentUser();

  if (!gebruiker) {
    return NextResponse.json({ fout: "Niet ingelogd." }, { status: 401 });
  }

  if (!(await isEigenaar())) {
    return NextResponse.json({ fout: "Alleen eigenaar." }, { status: 403 });
  }

  /*
   * De eigenaar moet ALLE nog lege open dienstplekken kunnen nalopen,
   * ook wanneer nog niemand belangstelling heeft gemeld.
   */
  const openDiensten = await prisma.dienstBezetting.findMany({
    where: {
      status: "OPEN",
      medewerkerId: null,
      dienst: {
        week: {
          vestiging: {
            organisatieId: gebruiker.organisatieId,
          },
        },
      },
    },
    orderBy: [
      { dienst: { datum: "asc" } },
      { dienst: { begintijd: "asc" } },
      { aangemaaktOp: "asc" },
    ],
    select: {
      id: true,
      dienst: {
        select: {
          id: true,
          datum: true,
          begintijd: true,
          eindtijd: true,
          tags: {
            select: {
              aantal: true,
              tag: { select: { id: true, naam: true } },
            },
          },
          week: {
            select: {
              jaar: true,
              weeknummer: true,
              vestiging: { select: { naam: true } },
            },
          },
        },
      },
    },
  });

  const ids = openDiensten.map((item) => item.id);
  const interesseLogs =
    ids.length === 0
      ? []
      : await prisma.auditLog.findMany({
          where: {
            module: "PLANNING",
            actie: "INTERESSE_OPEN_DIENST",
            recordId: { in: ids },
          },
          orderBy: { aangemaaktOp: "asc" },
          select: {
            id: true,
            recordId: true,
            aangemaaktOp: true,
            systeemGebruiker: {
              select: {
                id: true,
                naam: true,
                medewerker: { select: { id: true } },
              },
            },
          },
        });

  const interessesPerDienst = new Map<
    string,
    {
      interesseId: string;
      medewerkerId: string | null;
      medewerkerNaam: string;
      aangemeldOp: Date;
    }[]
  >();

  for (const log of interesseLogs) {
    if (!log.recordId || !log.systeemGebruiker) continue;

    const lijst = interessesPerDienst.get(log.recordId) ?? [];
    const medewerkerId = log.systeemGebruiker.medewerker?.id ?? null;

    if (
      medewerkerId &&
      !lijst.some((item) => item.medewerkerId === medewerkerId)
    ) {
      lijst.push({
        interesseId: log.id,
        medewerkerId,
        medewerkerNaam: log.systeemGebruiker.naam,
        aangemeldOp: log.aangemaaktOp,
      });
    }

    interessesPerDienst.set(log.recordId, lijst);
  }

  return NextResponse.json(
    openDiensten.map((item) => ({
      dienstBezettingId: item.id,
      dienst: item.dienst,
      interesses: interessesPerDienst.get(item.id) ?? [],
    })),
  );
}

export async function POST(request: Request) {
  const gebruiker = await getCurrentUser();

  if (!gebruiker) {
    return NextResponse.json({ fout: "Niet ingelogd." }, { status: 401 });
  }

  if (!(await isEigenaar())) {
    return NextResponse.json({ fout: "Alleen eigenaar." }, { status: 403 });
  }

  const body = await request.json();
  const dienstBezettingId = String(body.dienstBezettingId ?? "");
  const medewerkerId = String(body.medewerkerId ?? "");

  if (!dienstBezettingId || !medewerkerId) {
    return NextResponse.json({ fout: "Dienst of medewerker ontbreekt." }, { status: 400 });
  }

  const resultaat = await prisma.$transaction(async (tx) => {
    const openDienst = await tx.dienstBezetting.findFirst({
      where: {
        id: dienstBezettingId,
        status: "OPEN",
        medewerkerId: null,
        dienst: {
          week: {
            vestiging: {
              organisatieId: gebruiker.organisatieId,
            },
          },
        },
      },
      select: {
        id: true,
        dienstId: true,
        dienst: {
          select: {
            tags: { select: { tagId: true } },
            week: { select: { vestigingId: true } },
          },
        },
      },
    });

    if (!openDienst) return null;

    const medewerker = await tx.medewerker.findFirst({
      where: {
        id: medewerkerId,
        actief: true,
        vestigingen: {
          some: {
            vestigingId: openDienst.dienst.week.vestigingId,
            vestiging: { organisatieId: gebruiker.organisatieId, actief: true },
          },
        },
        AND: openDienst.dienst.tags.map((tag) => ({
          tags: { some: { tagId: tag.tagId } },
        })),
      },
      select: { id: true },
    });

    if (!medewerker) {
      throw new Error("Deze medewerker hoort niet bij de vestiging of heeft niet de juiste planningstags.");
    }

    const heeftInteresse = await tx.auditLog.findFirst({
      where: {
        module: "PLANNING",
        actie: "INTERESSE_OPEN_DIENST",
        recordId: openDienst.id,
        systeemGebruiker: {
          medewerker: { id: medewerkerId },
        },
      },
      select: { id: true },
    });

    if (!heeftInteresse) {
      throw new Error("Deze medewerker heeft zich niet voor deze open dienst gemeld.");
    }

    const bezetting = await tx.dienstBezetting.update({
      where: { id: openDienst.id },
      data: { medewerkerId, status: "GEPLAND" },
    });

    await tx.auditLog.create({
      data: {
        systeemGebruikerId: gebruiker.id,
        module: "PLANNING",
        actie: "OPEN_DIENST_TOEGEWEZEN",
        recordId: bezetting.id,
        details: { medewerkerId },
      },
    });

    return bezetting;
  });

  if (!resultaat) {
    return NextResponse.json({ fout: "Dienst is niet meer open." }, { status: 409 });
  }

  return NextResponse.json({ succes: true, bezetting: resultaat });
}
