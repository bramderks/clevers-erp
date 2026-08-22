import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
    beschikbaarheidId: string;
  }>;
};

type BeschikbaarheidStatus =
  | "BESCHIKBAAR"
  | "NIET_BESCHIKBAAR";

type RequestBody = {
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
  veld: string,
): Date {
  if (
    typeof waarde !== "string" ||
    !waarde.trim()
  ) {
    throw new RouteFout(
      `${veld} is verplicht.`,
      400,
    );
  }

  const datum = new Date(
    waarde,
  );

  if (
    Number.isNaN(
      datum.getTime(),
    )
  ) {
    throw new RouteFout(
      `${veld} bevat geen geldige datum.`,
      400,
    );
  }

  return datum;
}

function parseOptioneleDatum(
  waarde: unknown,
  veld: string,
): Date | null {
  if (
    waarde === null ||
    waarde === undefined ||
    waarde === ""
  ) {
    return null;
  }

  if (
    typeof waarde !== "string"
  ) {
    throw new RouteFout(
      `${veld} bevat geen geldige datum.`,
      400,
    );
  }

  const datum = new Date(
    waarde,
  );

  if (
    Number.isNaN(
      datum.getTime(),
    )
  ) {
    throw new RouteFout(
      `${veld} bevat geen geldige datum.`,
      400,
    );
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
 * TIJDEN
 * ============================================================
 */

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

  const beginTotaal =
    begintijd.getHours() * 60 +
    begintijd.getMinutes();

  const eindTotaal =
    eindtijd.getHours() * 60 +
    eindtijd.getMinutes();

  if (
    beginTotaal <
    9 * 60
  ) {
    throw new RouteFout(
      "Beschikbaarheid kan niet eerder dan 09:00 beginnen.",
      400,
    );
  }

  if (
    eindTotaal >
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
 * DATUM BINNEN WEEK
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
 * BESCHIKBAARHEID
 * ============================================================
 */

async function haalBeschikbaarheid(
  beschikbaarheidId: string,
) {
  const beschikbaarheid =
    await prisma.beschikbaarheid.findUnique(
      {
        where: {
          id: beschikbaarheidId,
        },

        select: {
          id: true,
          medewerkerId: true,
          weekId: true,
          datum: true,
          begintijd: true,
          eindtijd: true,
          status: true,
          opmerking: true,

          week: {
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
                  actief: true,
                  organisatieId: true,
                },
              },
            },
          },
        },
      },
    );

  if (!beschikbaarheid) {
    throw new RouteFout(
      "Beschikbaarheid niet gevonden.",
      404,
    );
  }

  if (
    !beschikbaarheid.week
      .vestiging.actief
  ) {
    throw new RouteFout(
      "Deze vestiging is niet actief.",
      403,
    );
  }

  return beschikbaarheid;
}

/*
 * ============================================================
 * MEDEWERKER
 * ============================================================
 */

async function controleerMedewerker(
  medewerkerId: string,
  vestigingId: string,
  organisatieId: string,
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

  const gekoppeld =
    medewerker.vestigingen.some(
      (relatie) =>
        relatie.vestigingId ===
          vestigingId &&
        relatie.vestiging.actief &&
        relatie.vestiging
          .organisatieId ===
          organisatieId,
    );

  if (!gekoppeld) {
    throw new RouteFout(
      "De medewerker is niet gekoppeld aan deze vestiging.",
      403,
    );
  }

  return medewerker;
}

/*
 * ============================================================
 * TOEGANG
 * ============================================================
 *
 * Eigenaar:
 * - mag bekijken
 * - mag wijzigen
 * - mag verwijderen
 *
 * Teamleider:
 * - mag bekijken
 * - mag NIET wijzigen
 * - mag NIET verwijderen
 *
 * Medewerker:
 * - mag eigen beschikbaarheid bekijken
 * - mag eigen beschikbaarheid wijzigen zolang
 *   de deadline niet is verstreken
 * - mag eigen beschikbaarheid verwijderen zolang
 *   de deadline niet is verstreken
 *
 * Een medewerker mag nooit beschikbaarheid van
 * een andere medewerker bekijken of wijzigen.
 */

async function bepaalToegang(
  medewerkerId: string,
  beschikbaarheidId: string,
) {
  const gebruiker =
    await haalGebruiker();

  const beschikbaarheid =
    await haalBeschikbaarheid(
      beschikbaarheidId,
    );

  if (
    beschikbaarheid.medewerkerId !==
    medewerkerId
  ) {
    throw new RouteFout(
      "De beschikbaarheid hoort niet bij deze medewerker.",
      403,
    );
  }

  const organisatieId =
    beschikbaarheid.week.vestiging
      .organisatieId;

  await controleerMedewerker(
    medewerkerId,
    beschikbaarheid.week
      .vestigingId,
    organisatieId,
  );

  const organisatieRelaties =
    gebruiker.organisaties.filter(
      (relatie) =>
        relatie.organisatieId ===
          organisatieId &&
        relatie.actief &&
        relatie.organisatie.actief,
    );

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

  const isEigenMedewerker =
    gebruiker.medewerker?.id ===
    medewerkerId;

  const deadline =
    beschikbaarheid.week
      .beschikbaarheidDeadline ??
    berekenDeadline(
      beschikbaarheid.week.jaar,
      beschikbaarheid.week
        .weeknummer,
    );

  const gesloten =
    deadlineVerstreken(
      deadline,
    );

  return {
    gebruiker,
    beschikbaarheid,
    deadline,
    gesloten,
    isEigenaar,
    isTeamleider,
    isEigenMedewerker,

    magBekijken:
      isEigenaar ||
      isTeamleider ||
      isEigenMedewerker,

    magWijzigen:
      isEigenaar ||
      (
        isEigenMedewerker &&
        !gesloten
      ),

    magVerwijderen:
      isEigenaar ||
      (
        isEigenMedewerker &&
        !gesloten
      ),
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
    id:
      beschikbaarheid.id,

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
 * GET
 * ============================================================
 */

export async function GET(
  _request: NextRequest,
  {
    params,
  }: RouteContext,
) {
  try {
    const {
      id: medewerkerId,
      beschikbaarheidId,
    } = await params;

    const toegang =
      await bepaalToegang(
        medewerkerId,
        beschikbaarheidId,
      );

    if (!toegang.magBekijken) {
      throw new RouteFout(
        "Je hebt geen toegang tot deze beschikbaarheid.",
        403,
      );
    }

    return NextResponse.json({
      beschikbaarheid:
        formatteerBeschikbaarheid(
          toegang.beschikbaarheid,
        ),

      week: {
        id:
          toegang.beschikbaarheid
            .week.id,

        jaar:
          toegang.beschikbaarheid
            .week.jaar,

        weeknummer:
          toegang.beschikbaarheid
            .week.weeknummer,

        status:
          toegang.beschikbaarheid
            .week.status,

        beschikbaarheidDeadline:
          toegang.deadline.toISOString(),
      },

      rechten: {
        isEigenaar:
          toegang.isEigenaar,

        isTeamleider:
          toegang.isTeamleider,

        isEigenMedewerker:
          toegang.isEigenMedewerker,

        magWijzigen:
          toegang.magWijzigen,

        magVerwijderen:
          toegang.magVerwijderen,
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
      "De beschikbaarheid kon niet worden opgehaald.",
      500,
    );
  }
}

/*
 * ============================================================
 * PATCH
 * ============================================================
 */

export async function PATCH(
  request: NextRequest,
  {
    params,
  }: RouteContext,
) {
  try {
    const {
      id: medewerkerId,
      beschikbaarheidId,
    } = await params;

    const toegang =
      await bepaalToegang(
        medewerkerId,
        beschikbaarheidId,
      );

    if (!toegang.magWijzigen) {
      if (
        toegang.isTeamleider
      ) {
        throw new RouteFout(
          "Een teamleider mag beschikbaarheid alleen bekijken.",
          403,
        );
      }

      if (
        toegang.gesloten &&
        toegang.isEigenMedewerker
      ) {
        throw new RouteFout(
          "De deadline voor het doorgeven van beschikbaarheid is verstreken.",
          403,
        );
      }

      throw new RouteFout(
        "Je hebt geen toestemming om deze beschikbaarheid te wijzigen.",
        403,
      );
    }

    let body: RequestBody;

    try {
      body =
        (await request.json()) as RequestBody;
    } catch {
      throw new RouteFout(
        "De aanvraag bevat geen geldige JSON.",
        400,
      );
    }

    const datum =
      parseDatum(
        body.datum,
        "Datum",
      );

    controleerDatumBinnenWeek(
      datum,
      toegang.beschikbaarheid
        .week.jaar,
      toegang.beschikbaarheid
        .week.weeknummer,
    );

    const status =
      body.status ??
      toegang.beschikbaarheid
        .status;

    if (
      !isGeldigeStatus(status)
    ) {
      throw new RouteFout(
        "De beschikbaarheidsstatus is ongeldig. Gebruik BESCHIKBAAR of NIET_BESCHIKBAAR.",
        400,
      );
    }

    /*
     * ========================================================
     * NIET BESCHIKBAAR
     * ========================================================
     */

    if (
      status ===
      "NIET_BESCHIKBAAR"
    ) {
      const bijgewerkt =
        await prisma.beschikbaarheid.update(
          {
            where: {
              id: beschikbaarheidId,
            },

            data: {
              datum,
              begintijd: null,
              eindtijd: null,
              status,
              opmerking:
                typeof body.opmerking ===
                "string"
                  ? body.opmerking.trim() ||
                    null
                  : body.opmerking ??
                    null,
            },
          },
        );

      return NextResponse.json({
        success: true,

        beschikbaarheid:
          formatteerBeschikbaarheid(
            bijgewerkt,
          ),
      });
    }

    /*
     * ========================================================
     * BESCHIKBAAR
     * ========================================================
     */

    const begintijd =
      parseOptioneleDatum(
        body.begintijd,
        "Begintijd",
      );

    const eindtijd =
      parseOptioneleDatum(
        body.eindtijd,
        "Eindtijd",
      );

    if (!begintijd) {
      throw new RouteFout(
        "Begintijd is verplicht wanneer de medewerker beschikbaar is.",
        400,
      );
    }

    if (!eindtijd) {
      throw new RouteFout(
        "Eindtijd is verplicht wanneer de medewerker beschikbaar is.",
        400,
      );
    }

    controleerTijden(
      begintijd,
      eindtijd,
    );

    const bijgewerkt =
      await prisma.beschikbaarheid.update(
        {
          where: {
            id: beschikbaarheidId,
          },

          data: {
            datum,
            begintijd,
            eindtijd,
            status,
            opmerking:
              typeof body.opmerking ===
              "string"
                ? body.opmerking.trim() ||
                  null
                : body.opmerking ??
                  null,
          },
        },
      );

    return NextResponse.json({
      success: true,

      beschikbaarheid:
        formatteerBeschikbaarheid(
          bijgewerkt,
        ),
    });
  } catch (error) {
    console.error(
      "Beschikbaarheid wijzigen mislukt:",
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
      "De beschikbaarheid kon niet worden gewijzigd.",
      500,
    );
  }
}

/*
 * ============================================================
 * DELETE
 * ============================================================
 */

export async function DELETE(
  _request: NextRequest,
  {
    params,
  }: RouteContext,
) {
  try {
    const {
      id: medewerkerId,
      beschikbaarheidId,
    } = await params;

    const toegang =
      await bepaalToegang(
        medewerkerId,
        beschikbaarheidId,
      );

    if (!toegang.magVerwijderen) {
      if (
        toegang.isTeamleider
      ) {
        throw new RouteFout(
          "Een teamleider mag beschikbaarheid alleen bekijken.",
          403,
        );
      }

      if (
        toegang.gesloten &&
        toegang.isEigenMedewerker
      ) {
        throw new RouteFout(
          "De deadline voor het doorgeven van beschikbaarheid is verstreken.",
          403,
        );
      }

      throw new RouteFout(
        "Je hebt geen toestemming om deze beschikbaarheid te verwijderen.",
        403,
      );
    }

    await prisma.beschikbaarheid.delete(
      {
        where: {
          id: beschikbaarheidId,
        },
      },
    );

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "Beschikbaarheid verwijderen mislukt:",
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
      "De beschikbaarheid kon niet worden verwijderd.",
      500,
    );
  }
}