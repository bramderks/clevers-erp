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
  altijdBeschikbaarSeizoen?: boolean;
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
    11 * 60 + 30
  ) {
    throw new RouteFout(
      "Beschikbaarheid kan niet eerder dan 11:30 beginnen.",
      400,
    );
  }

  if (
    einde.totaal >
    21 * 60
  ) {
    throw new RouteFout(
      "Beschikbaarheid kan niet later dan 21:00 eindigen.",
      400,
    );
  }

  if (
    begin.totaal % 15 !== 0 ||
    einde.totaal % 15 !== 0
  ) {
    throw new RouteFout(
      "Beschikbaarheidstijden moeten in stappen van 15 minuten worden opgegeven.",
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

const BESCHIKBAARHEID_TEST_EINDDATUM = new Date(
  "2026-12-01T00:00:00.000Z",
);

function volgendeWeekStart(): Date {
  const nu = new Date();
  const vandaag = new Date(
    Date.UTC(
      nu.getUTCFullYear(),
      nu.getUTCMonth(),
      nu.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );

  const dag = vandaag.getUTCDay() || 7;
  vandaag.setUTCDate(
    vandaag.getUTCDate() + (8 - dag),
  );

  return vandaag;
}

function isTestOpenVoorWeek(
  jaar: number,
  weeknummer: number,
): boolean {
  return (
    new Date() < BESCHIKBAARHEID_TEST_EINDDATUM &&
    beginVanISOWeek(jaar, weeknummer) >=
      volgendeWeekStart()
  );
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

  const isEigenMedewerker =
    gebruiker.medewerker?.id === medewerkerId;

  if (
    organisatieRelaties.length === 0 &&
    !isEigenMedewerker
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

  const isSuperAdmin =
    organisatieRelaties.some(
      (relatie) =>
        relatie.rol.naam
          .trim()
          .toLowerCase() ===
        "super admin",
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
    isEigenaar || isSuperAdmin;

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

  const standaardDeadline =
    week.beschikbaarheidDeadline ??
    berekenDeadline(
      week.jaar,
      week.weeknummer,
    );

  const deadline =
    isTestOpenVoorWeek(
      week.jaar,
      week.weeknummer,
    )
      ? BESCHIKBAARHEID_TEST_EINDDATUM
      : standaardDeadline;

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
    isSuperAdmin,
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

        isSuperAdmin:
          toegang.isSuperAdmin,

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
     * Een teamleider mag via de expliciete knop
     * "Altijd beschikbaar deze week" een volledige
     * week als beschikbaar instellen. Gewone dagelijkse
     * wijzigingen blijven voor de teamleider geblokkeerd.
     */
    if (body.altijdBeschikbaarWeek === true) {
      if (!toegang.isTeamleider && !toegang.isEigenaar && !toegang.isSuperAdmin && !toegang.isEigenMedewerker) {
        return fout("Je hebt geen toestemming om deze week als altijd beschikbaar in te stellen.", 403);
      }

      const weekStart = beginVanISOWeek(toegang.week.jaar, toegang.week.weeknummer);
      const transacties = Array.from({ length: 7 }, (_, index) => {
        const dag = new Date(weekStart);
        dag.setUTCDate(dag.getUTCDate() + index);
        const begintijd = new Date(dag);
        begintijd.setUTCHours(11, 30, 0, 0);
        const eindtijd = new Date(dag);
        eindtijd.setUTCHours(21, 0, 0, 0);

        return prisma.beschikbaarheid.upsert({
          where: {
            weekId_medewerkerId_datum: {
              weekId: weekId,
              medewerkerId,
              datum: dag,
            },
          },
          update: {
            datum: dag,
            begintijd,
            eindtijd,
            status: "BESCHIKBAAR",
            opmerking: "Altijd beschikbaar — deze week",
          },
          create: {
            weekId,
            medewerkerId,
            datum: dag,
            begintijd,
            eindtijd,
            status: "BESCHIKBAAR",
            opmerking: "Altijd beschikbaar — deze week",
          },
        });
      });

      await prisma.$transaction(transacties);

      return NextResponse.json({
        success: true,
        week: true,
        dagen: 7,
      });
    }

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

    if (body.altijdBeschikbaarSeizoen === true) {
      if (!toegang.isEigenaar && !toegang.isSuperAdmin) {
        return fout(
          "Alleen eigenaar of Super Admin kan iemand voor het hele seizoen altijd beschikbaar zetten.",
          403,
        );
      }

      const vestiging = await prisma.vestiging.findUnique({
        where: { id: toegang.week.vestigingId },
        select: {
          seizoenStart: true,
          seizoenEinde: true,
        },
      });

      if (!vestiging?.seizoenStart || !vestiging.seizoenEinde) {
        return fout(
          "Voor deze vestiging is geen seizoen ingesteld.",
          400,
        );
      }

      const weken = await prisma.week.findMany({
        where: {
          vestigingId: toegang.week.vestigingId,
          OR: [
            {
              AND: [
                { jaar: { gte: vestiging.seizoenStart.getUTCFullYear() } },
                { jaar: { lte: vestiging.seizoenEinde.getUTCFullYear() } },
              ],
            },
          ],
        },
        select: {
          id: true,
          jaar: true,
          weeknummer: true,
        },
        orderBy: [
          { jaar: "asc" },
          { weeknummer: "asc" },
        ],
      });

      const relevanteWeken = weken.filter((week) => {
        const start = beginVanISOWeek(week.jaar, week.weeknummer);
        const einde = eindeVanISOWeek(week.jaar, week.weeknummer);
        return start <= vestiging.seizoenEinde! && einde >= vestiging.seizoenStart!;
      });

      const transacties = relevanteWeken.flatMap((week) => {
        const weekStart = beginVanISOWeek(week.jaar, week.weeknummer);
        return Array.from({ length: 7 }, (_, index) => {
          const datum = new Date(weekStart);
          datum.setUTCDate(datum.getUTCDate() + index);
          return prisma.beschikbaarheid.upsert({
            where: {
              weekId_medewerkerId_datum: {
                weekId: week.id,
                medewerkerId,
                datum,
              },
            },
            update: {
              begintijd: new Date(`${datum.toISOString().slice(0, 10)}T11:30:00.000Z`),
              eindtijd: new Date(`${datum.toISOString().slice(0, 10)}T21:00:00.000Z`),
              status: "BESCHIKBAAR",
              opmerking: "Altijd beschikbaar — hele seizoen",
            },
            create: {
              weekId: week.id,
              medewerkerId,
              datum,
              begintijd: new Date(`${datum.toISOString().slice(0, 10)}T11:30:00.000Z`),
              eindtijd: new Date(`${datum.toISOString().slice(0, 10)}T21:00:00.000Z`),
              status: "BESCHIKBAAR",
              opmerking: "Altijd beschikbaar — hele seizoen",
            },
          });
        });
      });

      await prisma.$transaction(transacties);

      return NextResponse.json({
        success: true,
        seizoen: true,
        weken: relevanteWeken.length,
        dagen: relevanteWeken.length * 7,
      });
    }

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
                data,
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