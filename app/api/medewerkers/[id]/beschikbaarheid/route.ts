import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type BeschikbaarheidStatus =
  | "BESCHIKBAAR"
  | "NIET_BESCHIKBAAR";

type RequestBody = {
  weekId?: string;
  datum?: string;
  begintijd?: string | null;
  eindtijd?: string | null;
  status?: BeschikbaarheidStatus;
  opmerking?: string | null;
};

class RouteFout extends Error {
  status: number;

  constructor(
    message: string,
    status: number,
  ) {
    super(message);
    this.name = "RouteFout";
    this.status = status;
  }
}

function fout(
  message: string,
  status: number,
) {
  return NextResponse.json(
    {
      error: message,
    },
    {
      status,
    },
  );
}

/*
 * ============================================================
 * DATUM / TIJD
 * ============================================================
 */

function parseDatum(
  waarde: unknown,
): Date | null {
  if (
    typeof waarde !== "string" ||
    !waarde.trim()
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

function isGeldigeStatus(
  waarde: unknown,
): waarde is BeschikbaarheidStatus {
  return (
    waarde === "BESCHIKBAAR" ||
    waarde === "NIET_BESCHIKBAAR"
  );
}

function controleerTijden(
  begintijd: Date,
  eindtijd: Date,
) {
  if (eindtijd <= begintijd) {
    throw new RouteFout(
      "De eindtijd moet na de begintijd liggen.",
      400,
    );
  }

  /*
   * Beschikbaarheid mag alleen binnen
   * 09:00 t/m 23:00 worden opgegeven.
   */
  const beginTotaal =
    begintijd.getHours() * 60 +
    begintijd.getMinutes();

  const eindTotaal =
    eindtijd.getHours() * 60 +
    eindtijd.getMinutes();

  if (beginTotaal < 9 * 60) {
    throw new RouteFout(
      "Beschikbaarheid kan niet eerder dan 09:00 beginnen.",
      400,
    );
  }

  if (eindTotaal > 23 * 60) {
    throw new RouteFout(
      "Beschikbaarheid kan niet later dan 23:00 eindigen.",
      400,
    );
  }
}

/*
 * ============================================================
 * ISO WEEK
 * ============================================================
 */

function beginVanISOWeek(
  jaar: number,
  weeknummer: number,
): Date {
  const datum = new Date(
    Date.UTC(
      jaar,
      0,
      4,
    ),
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

function eindeVanISOWeek(
  jaar: number,
  weeknummer: number,
): Date {
  const begin =
    beginVanISOWeek(
      jaar,
      weeknummer,
    );

  const einde =
    new Date(begin);

  einde.setUTCDate(
    einde.getUTCDate() + 6,
  );

  einde.setUTCHours(
    23,
    59,
    59,
    999,
  );

  return einde;
}

function berekenDeadline(
  jaar: number,
  weeknummer: number,
): Date {
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

function deadlineVerstreken(
  deadline: Date,
): boolean {
  return (
    new Date().getTime() >
    deadline.getTime()
  );
}

/*
 * ============================================================
 * AUTHENTICATIE
 * ============================================================
 */

async function haalGebruiker() {
  const gebruiker =
    await getCurrentUser();

  if (!gebruiker) {
    throw new RouteFout(
      "Je moet ingelogd zijn.",
      401,
    );
  }

  return gebruiker;
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
    await prisma.medewerker.findUnique(
      {
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
      },
    );

  if (!medewerker) {
    throw new RouteFout(
      "Medewerker niet gevonden.",
      404,
    );
  }

  if (!medewerker.actief) {
    throw new RouteFout(
      "Deze medewerker is niet actief.",
      403,
    );
  }

  return medewerker;
}

/*
 * ============================================================
 * PLANNINGWEEK
 * ============================================================
 */

async function haalWeek(
  weekId: string,
) {
  const week =
    await prisma.week.findUnique(
      {
        where: {
          id: weekId,
        },

        select: {
          id: true,
          jaar: true,
          weeknummer: true,
          status: true,
          vestigingId: true,
          beschikbaarheidDeadline: true,

          vestiging: {
            select: {
              id: true,
              naam: true,
              organisatieId: true,
              actief: true,
            },
          },
        },
      },
    );

  if (!week) {
    throw new RouteFout(
      "Planningweek niet gevonden.",
      404,
    );
  }

  if (!week.vestiging.actief) {
    throw new RouteFout(
      "Deze vestiging is niet actief.",
      403,
    );
  }

  return week;
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
    await haalGebruiker();

  const medewerker =
    await haalMedewerker(
      medewerkerId,
    );

  const week =
    await haalWeek(weekId);

  const organisatieId =
    week.vestiging.organisatieId;

  const medewerkerHeeftVestiging =
    medewerker.vestigingen.some(
      (relatie) =>
        relatie.vestigingId ===
          week.vestigingId &&
        relatie.vestiging.actief &&
        relatie.vestiging.organisatieId ===
          organisatieId,
    );

  if (!medewerkerHeeftVestiging) {
    throw new RouteFout(
      "De medewerker is niet gekoppeld aan deze vestiging.",
      403,
    );
  }

  const organisatieRelaties =
    gebruiker.organisaties.filter(
      (relatie) =>
        relatie.organisatieId ===
          organisatieId &&
        relatie.actief &&
        relatie.organisatie.actief,
    );

  if (
    organisatieRelaties.length ===
    0
  ) {
    throw new RouteFout(
      "Je hebt geen toegang tot deze organisatie.",
      403,
    );
  }

  const isEigenaar =
    organisatieRelaties.some(
      (relatie) =>
        relatie.rol.naam
          .trim()
          .toLowerCase() ===
        "eigenaar",
    );

  const isTeamleider =
    organisatieRelaties.some(
      (relatie) =>
        relatie.rol.naam
          .trim()
          .toLowerCase() ===
        "teamleider",
    );

  const isBeheerder =
    isEigenaar ||
    isTeamleider;

  const isEigenMedewerker =
    gebruiker.medewerker?.id ===
    medewerkerId;

  if (
    !isBeheerder &&
    !isEigenMedewerker
  ) {
    throw new RouteFout(
      "Je hebt geen toestemming om deze beschikbaarheid te bekijken.",
      403,
    );
  }

  const deadline =
    week.beschikbaarheidDeadline ??
    berekenDeadline(
      week.jaar,
      week.weeknummer,
    );

  return {
    gebruiker,
    medewerker,
    week,
    deadline,
    isEigenaar,
    isTeamleider,
    isBeheerder,
    isEigenMedewerker,
  };
}

/*
 * ============================================================
 * FORMATTEREN
 * ============================================================
 */

function formatteerBeschikbaarheid(
  beschikbaarheid: {
    id: string;
    medewerkerId: string;
    weekId: string;
    datum: Date;
    begintijd: Date | null;
    eindtijd: Date | null;
    status: string;
    opmerking: string | null;
  },
) {
  return {
    id: beschikbaarheid.id,

    medewerkerId:
      beschikbaarheid.medewerkerId,

    weekId:
      beschikbaarheid.weekId,

    datum:
      beschikbaarheid.datum.toISOString(),

    begintijd:
      beschikbaarheid.begintijd
        ? beschikbaarheid.begintijd.toISOString()
        : null,

    eindtijd:
      beschikbaarheid.eindtijd
        ? beschikbaarheid.eindtijd.toISOString()
        : null,

    status:
      beschikbaarheid.status,

    opmerking:
      beschikbaarheid.opmerking,
  };
}

/*
 * ============================================================
 * DATUM MOET BINNEN WEEK VALLEN
 * ============================================================
 */

function controleerDatumBinnenWeek(
  datum: Date,
  jaar: number,
  weeknummer: number,
) {
  const weekStart =
    beginVanISOWeek(
      jaar,
      weeknummer,
    );

  const weekEinde =
    eindeVanISOWeek(
      jaar,
      weeknummer,
    );

  const datumControle =
    new Date(datum);

  datumControle.setUTCHours(
    0,
    0,
    0,
    0,
  );

  if (
    datumControle < weekStart ||
    datumControle > weekEinde
  ) {
    throw new RouteFout(
      `De gekozen datum valt niet binnen week ${weeknummer}.`,
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

    const url =
      new URL(request.url);

    const weekId =
      url.searchParams.get(
        "weekId",
      );

    if (!weekId) {
      return fout(
        "weekId is verplicht.",
        400,
      );
    }

    const toegang =
      await bepaalToegang(
        medewerkerId,
        weekId,
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

    const gesloten =
      deadlineVerstreken(
        toegang.deadline,
      );

    return NextResponse.json({
      beschikbaarheden:
        beschikbaarheden.map(
          formatteerBeschikbaarheid,
        ),

      week: {
        id: toegang.week.id,

        jaar:
          toegang.week.jaar,

        weeknummer:
          toegang.week.weeknummer,

        status:
          toegang.week.status,

        beschikbaarheidDeadline:
          toegang.deadline.toISOString(),
      },

      rechten: {
        isEigenaar:
          toegang.isEigenaar,

        isTeamleider:
          toegang.isTeamleider,

        isBeheerder:
          toegang.isBeheerder,

        isEigenMedewerker:
          toegang.isEigenMedewerker,

        magWijzigen:
          toegang.isBeheerder ||
          (
            toegang.isEigenMedewerker &&
            !gesloten
          ),

        magVerwijderen:
          toegang.isBeheerder ||
          (
            toegang.isEigenMedewerker &&
            !gesloten
          ),
      },
    });
  } catch (error) {
    console.error(
      "Beschikbaarheid ophalen mislukt:",
      error,
    );

    if (
      error instanceof RouteFout
    ) {
      return fout(
        error.message,
        error.status,
      );
    }

    return fout(
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

    let body: RequestBody;

    try {
      body =
        (await request.json()) as RequestBody;
    } catch {
      return fout(
        "De aanvraag bevat geen geldige JSON.",
        400,
      );
    }

    const weekId =
      typeof body.weekId ===
      "string"
        ? body.weekId.trim()
        : "";

    if (!weekId) {
      return fout(
        "weekId is verplicht.",
        400,
      );
    }

    const toegang =
      await bepaalToegang(
        medewerkerId,
        weekId,
      );

    /*
     * Eigenaar/teamleider mag ook na de
     * deadline wijzigingen invoeren.
     *
     * Een normale medewerker niet.
     */
    if (
      deadlineVerstreken(
        toegang.deadline,
      ) &&
      !toegang.isBeheerder
    ) {
      return fout(
        "De deadline voor het doorgeven van beschikbaarheid is verstreken.",
        403,
      );
    }

    const datum =
      parseDatum(
        body.datum,
      );

    if (!datum) {
      return fout(
        "Datum is ongeldig.",
        400,
      );
    }

    controleerDatumBinnenWeek(
      datum,
      toegang.week.jaar,
      toegang.week.weeknummer,
    );

    const status =
      body.status ??
      "BESCHIKBAAR";

    if (
      !isGeldigeStatus(status)
    ) {
      return fout(
        "De beschikbaarheidsstatus is ongeldig. Gebruik BESCHIKBAAR of NIET_BESCHIKBAAR.",
        400,
      );
    }

    /*
     * ========================================================
     * NIET BESCHIKBAAR
     * ========================================================
     *
     * Geen begin- of eindtijd.
     *
     * We gebruiken hier bewust een kleine typebrug
     * omdat de lokaal gegenereerde Prisma Client
     * kennelijk nog een ouder type bevat waarin
     * begintijd/eindtijd verplicht zijn.
     *
     * De databasevelden zijn in schema.prisma:
     *
     * begintijd DateTime?
     * eindtijd DateTime?
     */

    if (
      status ===
      "NIET_BESCHIKBAAR"
    ) {
      const data = {
        medewerkerId,
        weekId,
        datum,
        begintijd: null,
        eindtijd: null,
        status,
        opmerking:
          typeof body.opmerking ===
          "string"
            ? body.opmerking.trim() ||
              null
            : null,
      };

      const beschikbaarheid =
        await prisma.beschikbaarheid.create(
          {
            data: data as any,
          },
        );

      return NextResponse.json(
        {
          success: true,

          beschikbaarheid:
            formatteerBeschikbaarheid(
              beschikbaarheid,
            ),
        },
        {
          status: 201,
        },
      );
    }

    /*
     * ========================================================
     * BESCHIKBAAR
     * ========================================================
     */

    const begintijd =
      parseDatum(
        body.begintijd,
      );

    const eindtijd =
      parseDatum(
        body.eindtijd,
      );

    if (!begintijd) {
      return fout(
        "Begintijd is ongeldig.",
        400,
      );
    }

    if (!eindtijd) {
      return fout(
        "Eindtijd is ongeldig.",
        400,
      );
    }

    controleerTijden(
      begintijd,
      eindtijd,
    );

    const beschikbaarheid =
      await prisma.beschikbaarheid.create(
        {
          data: {
            medewerkerId,
            weekId,
            datum,
            begintijd,
            eindtijd,
            status,
            opmerking:
              typeof body.opmerking ===
              "string"
                ? body.opmerking.trim() ||
                  null
                : null,
          },
        },
      );

    return NextResponse.json(
      {
        success: true,

        beschikbaarheid:
          formatteerBeschikbaarheid(
            beschikbaarheid,
          ),
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(
      "Beschikbaarheid opslaan mislukt:",
      error,
    );

    if (
      error instanceof RouteFout
    ) {
      return fout(
        error.message,
        error.status,
      );
    }

    return fout(
      "De beschikbaarheid kon niet worden opgeslagen.",
      500,
    );
  }
}