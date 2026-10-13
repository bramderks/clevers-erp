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
  // Beperk eigenaarshandelingen tot organisaties waar de gebruiker
  // daadwerkelijk eigenaar/superadmin is, niet alleen teamleider of medewerker.
  const organisatieIds = gebruiker.organisaties
    .filter(
      (relatie) =>
        relatie.actief &&
        relatie.organisatie.actief &&
        ["eigenaar", "super admin"].includes(relatie.rol.naam.trim().toLowerCase()),
    )
    .map((relatie) => relatie.organisatieId);

  const openDiensten = await prisma.dienstBezetting.findMany({
    where: {
      status: "OPEN",
      medewerkerId: null,
      dienst: {
        week: {
          vestiging: {
            organisatieId: { in: organisatieIds },
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

  // Beperk eigenaarshandelingen tot organisaties waar de gebruiker
  // daadwerkelijk eigenaar/superadmin is, niet alleen teamleider of medewerker.
  const organisatieIds = gebruiker.organisaties
    .filter(
      (relatie) =>
        relatie.actief &&
        relatie.organisatie.actief &&
        ["eigenaar", "super admin"].includes(relatie.rol.naam.trim().toLowerCase()),
    )
    .map((relatie) => relatie.organisatieId);

  if (!dienstBezettingId || !medewerkerId) {
    return NextResponse.json({ fout: "Dienst of medewerker ontbreekt." }, { status: 400 });
  }

  let resultaat: { id: string; dienstId: string; medewerkerId: string | null; status: string } | null = null;
  try {
    resultaat = await prisma.$transaction(async (tx) => {
    const openDienst = await tx.dienstBezetting.findFirst({
      where: {
        id: dienstBezettingId,
        status: "OPEN",
        medewerkerId: null,
        dienst: {
          week: {
            vestiging: {
              organisatieId: { in: organisatieIds },
            },
          },
        },
      },
      select: {
        id: true,
        dienstId: true,
        dienst: {
          select: {
            datum: true,
            begintijd: true,
            eindtijd: true,
            tags: { select: { tagId: true, aantal: true } },
            week: {
              select: {
                status: true,
                vestigingId: true,
                vestiging: {
                  select: { id: true, naam: true, organisatieId: true },
                },
              },
            },
          },
        },
      },
    });

    if (!openDienst) return null;

    if (openDienst.dienst.week.status === "AFGESLOTEN") {
      throw new Error("Deze open dienst hoort bij een afgesloten planningweek.");
    }

    const medewerker = await tx.medewerker.findFirst({
      where: {
        id: medewerkerId,
        actief: true,
        vestigingen: {
          some: {
            vestigingId: openDienst.dienst.week.vestigingId,
            vestiging: { organisatieId: { in: organisatieIds }, actief: true },
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

    const dubbeleBezetting = await tx.dienstBezetting.findFirst({
      where: {
        dienstId: openDienst.dienstId,
        medewerkerId,
        status: { not: "AFGEZEGD" },
      },
      select: { id: true },
    });

    if (dubbeleBezetting) {
      throw new Error("Deze medewerker staat al op deze dienst.");
    }

    // Gebruik dezelfde vestigingsoverlapregel als de gewone planning:
    // tussen verschillende vestigingen blijft één uur reistijd vrij.
    const andereDiensten = await tx.dienstBezetting.findMany({
      where: {
        medewerkerId,
        status: { not: "AFGEZEGD" },
        dienst: {
          id: { not: openDienst.dienstId },
          datum: openDienst.dienst.datum,
          week: {
            vestiging: {
              organisatieId: openDienst.dienst.week.vestiging.organisatieId,
            },
          },
        },
      },
      select: {
        dienst: {
          select: {
            begintijd: true,
            eindtijd: true,
            week: {
              select: {
                vestiging: { select: { id: true, naam: true } },
              },
            },
          },
        },
      },
    });

    const conflict = andereDiensten.find((bezetting) => {
      if (bezetting.dienst.week.vestiging.id === openDienst.dienst.week.vestigingId) {
        return false;
      }
      const buffer = 60 * 60 * 1000;
      return (
        openDienst.dienst.begintijd.getTime() <
          bezetting.dienst.eindtijd.getTime() + buffer &&
        openDienst.dienst.eindtijd.getTime() >
          bezetting.dienst.begintijd.getTime() - buffer
      );
    });

    if (conflict) {
      throw new Error(
        `Deze medewerker heeft op dezelfde dag al een dienst in ${conflict.dienst.week.vestiging.naam}. Tussen vestigingen is 1 uur reistijd gereserveerd.`,
      );
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

    /*
     * De open positie die de eigenaar zojuist heeft ingevuld is
     * definitief bezet. Er mogen alleen nog OPEN-posities blijven
     * bestaan wanneer de dienst volgens de planningstags nog extra
     * medewerkers nodig heeft.
     *
     * Een eerder aangemaakte overtollige OPEN-positie wordt daarom
     * verwijderd zodra het benodigde aantal medewerkers al is bereikt.
     */
    const benodigdePosities = Math.max(
      1,
      openDienst.dienst.tags.reduce(
        (totaal, tag) => totaal + Math.max(1, Number(tag.aantal) || 1),
        0,
      ),
    );

    const bezettingen = await tx.dienstBezetting.findMany({
      where: { dienstId: openDienst.dienstId },
      select: { id: true, medewerkerId: true, status: true },
      orderBy: { aangemaaktOp: "asc" },
    });

    const toegewezenAantal = bezettingen.filter(
      (item) => item.medewerkerId !== null,
    ).length;

    if (toegewezenAantal >= benodigdePosities) {
      const overtolligeOpenPosities = bezettingen
        .filter((item) => item.status === "OPEN" && item.medewerkerId === null)
        .map((item) => item.id);

      if (overtolligeOpenPosities.length > 0) {
        await tx.dienstBezetting.deleteMany({
          where: { id: { in: overtolligeOpenPosities } },
        });
      }
    }

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
  } catch (error) {
    const message = error instanceof Error ? error.message : "Open dienst kon niet worden toegewezen.";
    if (message === "Deze open dienst hoort bij een afgesloten planningweek.") {
      return NextResponse.json({ fout: message }, { status: 409 });
    }
    if (
      message === "Deze medewerker staat al op deze dienst." ||
      message.includes("Tussen vestigingen is 1 uur reistijd gereserveerd.")
    ) {
      return NextResponse.json({ fout: message }, { status: 409 });
    }
    if (
      message === "Deze medewerker heeft zich niet voor deze open dienst gemeld." ||
      message === "Deze medewerker hoort niet bij de vestiging of heeft niet de juiste planningstags."
    ) {
      return NextResponse.json({ fout: message }, { status: 400 });
    }
    console.error("Fout bij beoordelen open dienst:", error);
    return NextResponse.json({ fout: "De open dienst kon niet worden toegewezen." }, { status: 500 });
  }

  if (!resultaat) {
    return NextResponse.json({ fout: "Dienst is niet meer open." }, { status: 409 });
  }

  return NextResponse.json({ succes: true, bezetting: resultaat });
}
