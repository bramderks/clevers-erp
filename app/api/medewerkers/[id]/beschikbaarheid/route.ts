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

function haalNederlandseTijd(
  datum: Date,
) {
  const formatter =
    new Intl.DateTimeFormat(
      "nl-NL",
      {
        timeZone:
          "Europe/Amsterdam",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      },
    );

  const delen =
    formatter.formatToParts(datum);

  const uur = Number(
    delen.find(
      (deel) =>
        deel.type === "hour",
    )?.value ?? "0",
  );

  const minuut = Number(
    delen.find(
      (deel) =>
        deel.type === "minute",
    )?.value ?? "0",
  );

  return {
    uur,
    minuut,
    totaal:
      uur * 60 + minuut,
  };
}

function controleerTijden(
  begintijd: Date,
  eindtijd: Date,
) {
  if (
    eindtijd <= begintijd
  ) {
    throw new RouteFout(
      "De eindtijd moet na de begintijd liggen.",
      400,
    );
  }

  /*
   * Beschikbaarheid wordt altijd
   * beoordeeld volgens de Nederlandse
   * lokale tijd.
   */
  const begin =
    haalNederlandseTijd(
      begintijd,
    );

  const einde =
    haalNederlandseTijd(
      eindtijd,
    );

  if (
    begin.totaal <
    9 * 60
  ) {
    throw new RouteFout(
      "Beschikbaarheid kan niet eerder dan 09:00 beginnen.",
      400,
    );
  }

  if (
    einde.totaal >
    23 * 60
  ) {
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
  const datum =
    new Date(
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

  /*
   * Standaarddeadline:
   * vier weken vóór de betreffende
   * planningweek, tot 23:59:59.
   *
   * Als er op de week zelf een
   * beschikbaarheidDeadline staat,
   * wordt die gebruikt.
   */
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

  /*
   * BELANGRIJK:
   *
   * Teamleider is GEEN beheerder voor
   * wijzigingen.
   *
   * Alleen Eigenaar krijgt
   * beheerdersrechten voor
   * beschikbaarheid.
   */
  const isBeheerder =
    isEigenaar;

  const isEigenMedewerker =
    gebruiker.medewerker?.id ===
    medewerkerId;

  if (
    !isBeheerder &&
    !isTeamleider &&
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

  const gesloten =
    deadlineVerstreken(
      deadline,
    );

  /*
   * Alleen:
   *
   * - Eigenaar altijd
   * - Eigen medewerker vóór deadline
   *
   * mogen wijzigen.
   */
  const magWijzigen =
    isEigenaar ||
    (
      isEigenMedewerker &&
      !gesloten
    );

  return {
    gebruiker,
    medewerker,
    week,
    deadline,
    gesloten,
    isEigenaar,
    isTeamleider,
    isBeheerder,
    isEigenMedewerker,
    magWijzigen,
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

        startdatum:
          beginVanISOWeek(
            toegang.week.jaar,
            toegang.week.weeknummer,
          ).toISOString(),

        einddatum:
          eindeVanISOWeek(
            toegang.week.jaar,
            toegang.week.weeknummer,
          ).toISOString(),

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

        magBekijken: true,

        magWijzigen:
          toegang.magWijzigen,

        magVerwijderen:
          toegang.magWijzigen,
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
 *
 * POST wordt gebruikt voor:
 *
 * - nieuwe beschikbaarheid
 * - bestaande beschikbaarheid
 *   van dezelfde medewerker/week/dag
 *   opnieuw opslaan
 *
 * Daardoor ontstaan geen dubbele
 * dagrecords bij opnieuw opslaan.
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
     * Alleen Eigenaar of de medewerker
     * zelf vóór de deadline mag wijzigen.
     *
     * Teamleider valt hier dus buiten.
     */
    if (!toegang.magWijzigen) {
      return fout(
        toegang.isTeamleider
          ? "Een teamleider kan beschikbaarheid alleen bekijken. Alleen de eigenaar kan beschikbaarheid wijzigen."
          : "Je hebt geen toestemming om deze beschikbaarheid te wijzigen.",
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

    const opmerking =
      typeof body.opmerking ===
      "string"
        ? body.opmerking.trim() ||
          null
        : null;

    /*
     * Zoek eerst of deze medewerker
     * voor deze week en deze dag al
     * een record heeft.
     *
     * Hierdoor kunnen we bestaande
     * beschikbaarheid aanpassen zonder
     * dubbele records te creëren.
     */
    const bestaande =
      await prisma.beschikbaarheid.findFirst(
        {
          where: {
            medewerkerId,
            weekId,
            datum: {
              gte: new Date(
                Date.UTC(
                  datum.getUTCFullYear(),
                  datum.getUTCMonth(),
                  datum.getUTCDate(),
                  0,
                  0,
                  0,
                  0,
                ),
              ),

              lt: new Date(
                Date.UTC(
                  datum.getUTCFullYear(),
                  datum.getUTCMonth(),
                  datum.getUTCDate() + 1,
                  0,
                  0,
                  0,
                  0,
                ),
              ),
            },
          },
        },
      );

    /*
     * ========================================================
     * NIET BESCHIKBAAR
     * ========================================================
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
        opmerking,
      };

      const beschikbaarheid =
        bestaande
          ? await prisma.beschikbaarheid.update(
              {
                where: {
                  id: bestaande.id,
                },
                data: {
                  datum,
                  begintijd: null,
                  eindtijd: null,
                  status,
                  opmerking,
                },
              },
            )
          : await prisma.beschikbaarheid.create(
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
          status: bestaande
            ? 200
            : 201,
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
      bestaande
        ? await prisma.beschikbaarheid.update(
            {
              where: {
                id: bestaande.id,
              },

              data: {
                datum,
                begintijd,
                eindtijd,
                status,
                opmerking,
              },
            },
          )
        : await prisma.beschikbaarheid.create(
            {
              data: {
                medewerkerId,
                weekId,
                datum,
                begintijd,
                eindtijd,
                status,
                opmerking,
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
        status: bestaande
          ? 200
          : 201,
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