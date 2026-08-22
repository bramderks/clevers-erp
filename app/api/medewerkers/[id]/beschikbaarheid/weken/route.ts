import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type SelectorWeek = {
  id: string;
  jaar: number;
  weeknummer: number;
  status: string;
  startdatum: string;
  einddatum: string;
  beschikbaarheidDeadline: string;
};

/*
 * ============================================================
 * RESPONSE HELPERS
 * ============================================================
 */

function jsonError(error: string, status: number) {
  return NextResponse.json(
    { error },
    { status },
  );
}

/*
 * ============================================================
 * ISO-WEEK FUNCTIES
 * ============================================================
 */

function beginVanISOWeek(
  jaar: number,
  weeknummer: number,
): Date {
  const vierJanuari = new Date(
    Date.UTC(jaar, 0, 4),
  );

  const dagVanDeWeek =
    vierJanuari.getUTCDay() || 7;

  const maandag = new Date(
    vierJanuari,
  );

  maandag.setUTCDate(
    vierJanuari.getUTCDate() -
      dagVanDeWeek +
      1 +
      (weeknummer - 1) * 7,
  );

  maandag.setUTCHours(
    0,
    0,
    0,
    0,
  );

  return maandag;
}

function eindeVanISOWeek(
  jaar: number,
  weeknummer: number,
): Date {
  const maandag =
    beginVanISOWeek(
      jaar,
      weeknummer,
    );

  const zondag = new Date(
    maandag,
  );

  zondag.setUTCDate(
    zondag.getUTCDate() + 6,
  );

  zondag.setUTCHours(
    23,
    59,
    59,
    999,
  );

  return zondag;
}

/*
 * ============================================================
 * BESCHIKBAARHEIDSDEADLINE
 * ============================================================
 *
 * Standaard:
 * 28 dagen vóór de maandag van de planningweek.
 *
 * De deadline eindigt op die maandag om 23:59:59.999.
 * ============================================================
 */

function berekenBeschikbaarheidDeadline(
  jaar: number,
  weeknummer: number,
): Date {
  const beginWeek =
    beginVanISOWeek(
      jaar,
      weeknummer,
    );

  const deadline = new Date(
    beginWeek,
  );

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
 * GET
 * ============================================================
 */

export async function GET(
  request: Request,
  { params }: RouteContext,
) {
  try {
    /*
     * --------------------------------------------------------
     * INGELOGDE GEBRUIKER
     * --------------------------------------------------------
     */

    const gebruiker =
      await getCurrentUser();

    if (!gebruiker) {
      return jsonError(
        "Je bent niet ingelogd.",
        401,
      );
    }

    const { id: medewerkerId } =
      await params;

    /*
     * --------------------------------------------------------
     * QUERY PARAMETERS
     * --------------------------------------------------------
     */

    const { searchParams } =
      new URL(request.url);

    const vestigingId =
      searchParams.get(
        "vestigingId",
      );

    if (!vestigingId) {
      return jsonError(
        "vestigingId is verplicht.",
        400,
      );
    }

    /*
     * --------------------------------------------------------
     * MEDEWERKER CONTROLEREN
     * --------------------------------------------------------
     */

    const medewerker =
      await prisma.medewerker.findUnique({
        where: {
          id: medewerkerId,
        },

        select: {
          id: true,
          actief: true,

          vestigingen: {
            where: {
              vestigingId,
            },

            select: {
              vestigingId: true,

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
        },
      });

    if (!medewerker) {
      return jsonError(
        "Medewerker niet gevonden.",
        404,
      );
    }

    if (!medewerker.actief) {
      return jsonError(
        "Deze medewerker is niet actief.",
        403,
      );
    }

    const medewerkerVestiging =
      medewerker.vestigingen[0];

    if (
      !medewerkerVestiging ||
      !medewerkerVestiging.vestiging.actief
    ) {
      return jsonError(
        "De medewerker is niet gekoppeld aan deze vestiging.",
        403,
      );
    }

    const organisatieId =
      medewerkerVestiging.vestiging
        .organisatieId;

    /*
     * --------------------------------------------------------
     * ORGANISATIETOEGANG
     * --------------------------------------------------------
     */

    const organisatieRelaties =
      gebruiker.organisaties.filter(
        (relatie) =>
          relatie.organisatieId ===
            organisatieId &&
          relatie.actief &&
          relatie.organisatie.actief,
      );

    if (
      organisatieRelaties.length === 0
    ) {
      return jsonError(
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
      return jsonError(
        "Je hebt geen toegang tot de beschikbaarheid van deze medewerker.",
        403,
      );
    }

    /*
     * --------------------------------------------------------
     * PLANNINGWEKEN OPHALEN
     * --------------------------------------------------------
     *
     * Voor eigenaar/teamleider:
     * alle weken blijven zichtbaar.
     *
     * Voor de medewerker zelf:
     * alleen weken waarvan de deadline nog niet
     * verstreken is worden teruggegeven.
     *
     * Een gesloten week wordt dus niet meer in de
     * weekselector van de medewerker getoond.
     * --------------------------------------------------------
     */

    const weken =
      await prisma.week.findMany({
        where: {
          vestigingId,

          vestiging: {
            actief: true,
          },
        },

        select: {
          id: true,
          jaar: true,
          weeknummer: true,
          status: true,
          beschikbaarheidDeadline: true,
        },

        orderBy: [
          {
            jaar: "asc",
          },
          {
            weeknummer: "asc",
          },
        ],
      });

    const nu = new Date();

    /*
     * --------------------------------------------------------
     * WEKEN OPBOUWEN
     * --------------------------------------------------------
     */

    const alleWeken: SelectorWeek[] =
      weken
        .map((week) => {
          const startdatum =
            beginVanISOWeek(
              week.jaar,
              week.weeknummer,
            );

          const einddatum =
            eindeVanISOWeek(
              week.jaar,
              week.weeknummer,
            );

          const deadline =
            week.beschikbaarheidDeadline ??
            berekenBeschikbaarheidDeadline(
              week.jaar,
              week.weeknummer,
            );

          return {
            id: week.id,

            jaar: week.jaar,

            weeknummer:
              week.weeknummer,

            status: week.status,

            startdatum:
              startdatum.toISOString(),

            einddatum:
              einddatum.toISOString(),

            beschikbaarheidDeadline:
              deadline.toISOString(),
          };
        })
        .filter((week) => {
          /*
           * Eigenaar/teamleider ziet alle weken.
           *
           * Een medewerker ziet uitsluitend weken waarvan
           * de deadline nog open is.
           */
          if (isBeheerder) {
            return true;
          }

          return (
            new Date(
              week.beschikbaarheidDeadline,
            ).getTime() > nu.getTime()
          );
        });

    /*
     * --------------------------------------------------------
     * EERSTE OPENSTAANDE WEEK
     * --------------------------------------------------------
     *
     * Voor een medewerker is dit de eerste week uit de
     * daadwerkelijk beschikbare lijst.
     * --------------------------------------------------------
     */

    const eersteOpenstaandeWeek =
      !isBeheerder
        ? alleWeken[0] ?? null
        : null;

    /*
     * --------------------------------------------------------
     * RESPONSE
     * --------------------------------------------------------
     */

    return NextResponse.json({
      weken: alleWeken,

      eersteOpenstaandeWeek:
        eersteOpenstaandeWeek,

      isEigenaar,

      isTeamleider,

      isBeheerder,
    });
  } catch (error) {
    console.error(
      "Fout bij ophalen planningweken voor beschikbaarheid:",
      error,
    );

    return jsonError(
      "De planningweken konden niet worden opgehaald.",
      500,
    );
  }
}