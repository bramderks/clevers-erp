import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type ToegangFoutStatus =
  | 401
  | 400
  | 403
  | 404;

class ToegangFout extends Error {
  status: ToegangFoutStatus;

  constructor(
    message: string,
    status: ToegangFoutStatus,
  ) {
    super(message);
    this.name = "ToegangFout";
    this.status = status;
  }
}

function jsonError(
  error: string,
  status: number,
) {
  return NextResponse.json(
    { error },
    { status },
  );
}

/*
 * ============================================================
 * ISO-WEEK
 * ============================================================
 */

function beginVanISOWeek(
  jaar: number,
  weeknummer: number,
) {
  const datum = new Date(
    Date.UTC(jaar, 0, 4),
  );

  const dag =
    datum.getUTCDay() || 7;

  datum.setUTCDate(
    datum.getUTCDate() -
      dag +
      1 +
      (weeknummer - 1) * 7,
  );

  datum.setUTCHours(
    0,
    0,
    0,
    0,
  );

  return datum;
}

/*
 * ============================================================
 * BESCHIKBAARHEIDSDEADLINE
 * ============================================================
 *
 * De beschikbaarheid van een planningweek sluit
 * 28 dagen vóór de maandag van die planningweek.
 *
 * Voorbeeld:
 *
 * Week 36
 * → maandag week 36
 * → 28 dagen terug
 * → einde week 31
 *
 * Dus:
 * Week 36 → deadline einde week 31
 */

function berekenBeschikbaarheidDeadline(
  jaar: number,
  weeknummer: number,
) {
  const weekStart =
    beginVanISOWeek(
      jaar,
      weeknummer,
    );

  const deadline =
    new Date(weekStart);

  deadline.setUTCDate(
    deadline.getUTCDate() - 28,
  );

  deadline.setUTCHours(
    23,
    59,
    59,
    999,
  );

  return deadline;
}

/*
 * ============================================================
 * WEEK
 * ============================================================
 */

async function haalWeek(
  weekId: string,
) {
  const week =
    await prisma.week.findUnique({
      where: {
        id: weekId,
      },
      include: {
        vestiging: {
          select: {
            id: true,
            naam: true,
            organisatieId: true,
            actief: true,
          },
        },
      },
    });

  if (!week) {
    throw new ToegangFout(
      "Planningweek niet gevonden.",
      404,
    );
  }

  if (!week.vestiging.actief) {
    throw new ToegangFout(
      "Deze vestiging is niet actief.",
      403,
    );
  }

  return week;
}

/*
 * ============================================================
 * MEDEWERKER
 * ============================================================
 */

async function haalMedewerker(
  medewerkerId: string,
) {
  const medewerker =
    await prisma.medewerker.findUnique({
      where: {
        id: medewerkerId,
      },
      select: {
        id: true,
        actief: true,

        vestigingen: {
          select: {
            vestigingId: true,

            vestiging: {
              select: {
                organisatieId: true,
                actief: true,
              },
            },
          },
        },
      },
    });

  if (!medewerker) {
    throw new ToegangFout(
      "Medewerker niet gevonden.",
      404,
    );
  }

  if (!medewerker.actief) {
    throw new ToegangFout(
      "Deze medewerker is niet actief.",
      403,
    );
  }

  return medewerker;
}

/*
 * ============================================================
 * TOEGANG
 * ============================================================
 */

async function bepaalToegang(
  medewerkerId: string,
  weekId: string,
) {
  const gebruiker =
    await getCurrentUser();

  if (!gebruiker) {
    throw new ToegangFout(
      "Je bent niet ingelogd.",
      401,
    );
  }

  const week =
    await haalWeek(weekId);

  const medewerker =
    await haalMedewerker(
      medewerkerId,
    );

  const gekoppeldAanVestiging =
    medewerker.vestigingen.some(
      (relatie) =>
        relatie.vestigingId ===
          week.vestigingId &&
        relatie.vestiging.actief &&
        relatie.vestiging
          .organisatieId ===
          week.vestiging
            .organisatieId,
    );

  if (!gekoppeldAanVestiging) {
    throw new ToegangFout(
      "De medewerker is niet gekoppeld aan de vestiging van deze week.",
      403,
    );
  }

  const beheerder =
    gebruiker.organisaties.some(
      (relatie) => {
        if (
          !relatie.actief ||
          !relatie.organisatie
            .actief
        ) {
          return false;
        }

        if (
          relatie.organisatieId !==
          week.vestiging
            .organisatieId
        ) {
          return false;
        }

        const rol =
          relatie.rol.naam.toLowerCase();

        return (
          rol === "eigenaar" ||
          rol === "teamleider"
        );
      },
    );

  const eigenMedewerker =
    gebruiker.medewerker?.id ===
    medewerkerId;

  if (
    !beheerder &&
    !eigenMedewerker
  ) {
    throw new ToegangFout(
      "Je mag alleen je eigen beschikbaarheid beheren.",
      403,
    );
  }

  return {
    week,
    medewerker,
    beheerder,
    eigenMedewerker,
  };
}

/*
 * ============================================================
 * DEADLINE
 * ============================================================
 */

function haalEffectieveDeadline(
  jaar: number,
  weeknummer: number,
  opgeslagenDeadline:
    | Date
    | null,
) {
  if (opgeslagenDeadline) {
    return opgeslagenDeadline;
  }

  return berekenBeschikbaarheidDeadline(
    jaar,
    weeknummer,
  );
}

function deadlineVerstreken(
  deadline: Date,
) {
  return new Date() > deadline;
}

/*
 * ============================================================
 * DATUM / TIJD
 * ============================================================
 */

function parseDate(
  waarde: unknown,
) {
  if (
    typeof waarde !== "string"
  ) {
    return null;
  }

  const datum = new Date(
    waarde,
  );

  if (
    Number.isNaN(
      datum.getTime(),
    )
  ) {
    return null;
  }

  return datum;
}

function controleerTijden(
  begintijd: Date,
  eindtijd: Date,
) {
  if (eindtijd <= begintijd) {
    throw new ToegangFout(
      "De eindtijd moet na de begintijd liggen.",
      400,
    );
  }

  const beginMinuten =
    begintijd.getHours() * 60 +
    begintijd.getMinutes();

  const eindMinuten =
    eindtijd.getHours() * 60 +
    eindtijd.getMinutes();

  const minimum =
    9 * 60;

  const maximum =
    23 * 60;

  if (
    beginMinuten < minimum ||
    eindMinuten > maximum
  ) {
    throw new ToegangFout(
      "Beschikbaarheid kan alleen tussen 09:00 en 23:00 worden opgegeven.",
      400,
    );
  }
}

/*
 * ============================================================
 * GET
 * ============================================================
 */

export async function GET(
  request: Request,
  {
    params,
  }: RouteContext,
) {
  try {
    const {
      id: medewerkerId,
    } = await params;

    const { searchParams } =
      new URL(request.url);

    const weekId =
      searchParams.get(
        "weekId",
      );

    if (!weekId) {
      return jsonError(
        "weekId is verplicht.",
        400,
      );
    }

    const toegang =
      await bepaalToegang(
        medewerkerId,
        weekId,
      );

    const deadline =
      haalEffectieveDeadline(
        toegang.week.jaar,
        toegang.week.weeknummer,
        toegang.week
          .beschikbaarheidDeadline,
      );

    const beschikbaarheden =
      await prisma.beschikbaarheid.findMany(
        {
          where: {
            medewerkerId,
            weekId,
          },
          orderBy: [
            {
              datum: "asc",
            },
            {
              begintijd: "asc",
            },
          ],
        },
      );

    return NextResponse.json({
      beschikbaarheden:
        beschikbaarheden.map(
          (beschikbaarheid) => ({
            id: beschikbaarheid.id,
            datum:
              beschikbaarheid.datum.toISOString(),
            begintijd:
              beschikbaarheid.begintijd.toISOString(),
            eindtijd:
              beschikbaarheid.eindtijd.toISOString(),
            status:
              beschikbaarheid.status,
            opmerking:
              beschikbaarheid.opmerking,
          }),
        ),

      week: {
        id: toegang.week.id,
        jaar: toegang.week.jaar,
        weeknummer:
          toegang.week.weeknummer,
        status: toegang.week.status,
        beschikbaarheidDeadline:
          deadline.toISOString(),
      },
    });
  } catch (error) {
    if (
      error instanceof
      ToegangFout
    ) {
      return jsonError(
        error.message,
        error.status,
      );
    }

    console.error(
      "Fout bij ophalen beschikbaarheid:",
      error,
    );

    return jsonError(
      "De beschikbaarheden konden niet worden opgehaald.",
      500,
    );
  }
}

/*
 * ============================================================
 * POST
 * ============================================================
 */

export async function POST(
  request: Request,
  {
    params,
  }: RouteContext,
) {
  try {
    const {
      id: medewerkerId,
    } = await params;

    const body =
      await request.json();

    const weekId =
      typeof body.weekId ===
      "string"
        ? body.weekId
        : "";

    const datum =
      typeof body.datum ===
      "string"
        ? body.datum
        : "";

    const begintijd =
      typeof body.begintijd ===
      "string"
        ? body.begintijd
        : "";

    const eindtijd =
      typeof body.eindtijd ===
      "string"
        ? body.eindtijd
        : "";

    const opmerking =
      typeof body.opmerking ===
      "string"
        ? body.opmerking.trim()
        : null;

    if (
      !weekId ||
      !datum ||
      !begintijd ||
      !eindtijd
    ) {
      return jsonError(
        "weekId, datum, begintijd en eindtijd zijn verplicht.",
        400,
      );
    }

    const toegang =
      await bepaalToegang(
        medewerkerId,
        weekId,
      );

    /*
     * ========================================================
     * DEADLINE CONTROLEREN
     * ========================================================
     *
     * Een eigenaar of teamleider mag ook na de deadline
     * beschikbaarheid beheren.
     *
     * Een gewone medewerker niet.
     *
     * Wanneer de deadline in Prisma nog NULL is,
     * wordt automatisch de nieuwe standaarddeadline
     * gebruikt.
     */

    const deadline =
      haalEffectieveDeadline(
        toegang.week.jaar,
        toegang.week.weeknummer,
        toegang.week
          .beschikbaarheidDeadline,
      );

    if (
      deadlineVerstreken(
        deadline,
      ) &&
      !toegang.beheerder
    ) {
      return jsonError(
        "De deadline voor het doorgeven van beschikbaarheid is verstreken.",
        403,
      );
    }

    /*
     * ========================================================
     * DATUM EN TIJD CONTROLEREN
     * ========================================================
     */

    const datumWaarde =
      parseDate(datum);

    const begintijdWaarde =
      parseDate(begintijd);

    const eindtijdWaarde =
      parseDate(eindtijd);

    if (!datumWaarde) {
      return jsonError(
        "De datum is ongeldig.",
        400,
      );
    }

    if (
      !begintijdWaarde ||
      !eindtijdWaarde
    ) {
      return jsonError(
        "De begin- of eindtijd is ongeldig.",
        400,
      );
    }

    controleerTijden(
      begintijdWaarde,
      eindtijdWaarde,
    );

    /*
     * ========================================================
     * BESCHIKBAARHEID OPSLAAN
     * ========================================================
     *
     * Een ingevuld tijdsblok betekent automatisch:
     * BESCHIKBAAR.
     */

    const beschikbaarheid =
      await prisma.beschikbaarheid.create(
        {
          data: {
            medewerkerId,
            weekId,
            datum: datumWaarde,
            begintijd:
              begintijdWaarde,
            eindtijd:
              eindtijdWaarde,
            status:
              "BESCHIKBAAR",
            opmerking:
              opmerking || null,
          },
        },
      );

    return NextResponse.json(
      {
        id: beschikbaarheid.id,
        datum:
          beschikbaarheid.datum.toISOString(),
        begintijd:
          beschikbaarheid.begintijd.toISOString(),
        eindtijd:
          beschikbaarheid.eindtijd.toISOString(),
        status:
          beschikbaarheid.status,
        opmerking:
          beschikbaarheid.opmerking,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    if (
      error instanceof
      ToegangFout
    ) {
      return jsonError(
        error.message,
        error.status,
      );
    }

    console.error(
      "Fout bij aanmaken beschikbaarheid:",
      error,
    );

    return jsonError(
      "De beschikbaarheid kon niet worden opgeslagen.",
      500,
    );
  }
}