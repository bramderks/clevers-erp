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
 * Normaal:
 * 28 dagen vóór de maandag van de planningweek.
 *
 * Tijdelijke testperiode:
 * vanaf volgende week t/m 28 februari 2027 mogen medewerkers
 * hun beschikbaarheid voor alle toekomstige weken doorgeven.
 * Vanaf 1 maart 2027 geldt automatisch weer de normale
 * deadline van 28 dagen vóór de planningweek.
 * ============================================================
 */

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

function beschikbaarheidTestOpen(
  jaar: number,
  weeknummer: number,
): boolean {
  const weekStart = beginVanISOWeek(
    jaar,
    weeknummer,
  );

  return (
    new Date() < BESCHIKBAARHEID_TEST_EINDDATUM &&
    weekStart >= volgendeWeekStart()
  );
}

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

    if (!medewerkerVestiging) {
      return jsonError(
        "Je bent niet gekoppeld aan deze vestiging. Laat de eigenaar je aan deze vestiging koppelen.",
        403,
      );
    }

    if (!medewerkerVestiging.vestiging) {
      return jsonError(
        "De gekozen vestiging kon niet worden gevonden.",
        404,
      );
    }

    if (!medewerkerVestiging.vestiging.actief) {
      return jsonError(
        "Deze vestiging is niet actief. Je kunt hier geen beschikbaarheid doorgeven.",
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

    const isEigenMedewerker =
      gebruiker.medewerker?.id ===
      medewerkerId;

    if (
      organisatieRelaties.length === 0 &&
      !isEigenMedewerker
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

    const isBeheerder =
      isEigenaar ||
      isSuperAdmin;

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

          const standaardDeadline =
            week.beschikbaarheidDeadline ??
            berekenBeschikbaarheidDeadline(
              week.jaar,
              week.weeknummer,
            );

          const deadline =
            beschikbaarheidTestOpen(
              week.jaar,
              week.weeknummer,
            )
              ? BESCHIKBAARHEID_TEST_EINDDATUM
              : standaardDeadline;

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

          const weekStart = new Date(
            week.startdatum,
          );

          if (
            new Date() <
              BESCHIKBAARHEID_TEST_EINDDATUM
          ) {
            return (
              weekStart >= volgendeWeekStart()
            );
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

      isSuperAdmin,

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