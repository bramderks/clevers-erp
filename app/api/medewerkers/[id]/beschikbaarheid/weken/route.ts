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
  beschikbaarheidDeadline:
    | string
    | null;
};

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
 * ISO-WEEK FUNCTIES
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
 * De beschikbaarheid voor een planningweek sluit:
 *
 * - 4 volledige weken vóór de planningweek
 * - plus 1 extra afgesloten week
 *
 * Voorbeeld:
 *
 * Week 36
 * → week 32 is vier weken eerder
 * → week 31 is de extra afgesloten week
 * → deadline = einde week 31
 *
 * De deadline ligt dus 28 dagen vóór de maandag
 * waarop de betreffende planningweek begint.
 */

function berekenBeschikbaarheidDeadline(
  jaar: number,
  weeknummer: number,
) {
  const beginWeek =
    beginVanISOWeek(
      jaar,
      weeknummer,
    );

  const deadline =
    new Date(beginWeek);

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
 * MEDEWERKER + TOEGANG
 * ============================================================
 */

export async function GET(
  request: Request,
  { params }: RouteContext,
) {
  try {
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
     * ========================================================
     * MEDEWERKER CONTROLEREN
     * ========================================================
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
     * ========================================================
     * ORGANISATIETOEGANG
     * ========================================================
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
      organisatieRelaties.length ===
      0
    ) {
      return jsonError(
        "Je hebt geen toegang tot deze organisatie.",
        403,
      );
    }

    const isEigenaar =
      organisatieRelaties.some(
        (relatie) =>
          relatie.rol.naam.toLowerCase() ===
          "eigenaar",
      );

    const isTeamleider =
      organisatieRelaties.some(
        (relatie) =>
          relatie.rol.naam.toLowerCase() ===
          "teamleider",
      );

    const isEigenMedewerker =
      gebruiker.medewerker?.id ===
      medewerkerId;

    if (
      !isEigenaar &&
      !isTeamleider &&
      !isEigenMedewerker
    ) {
      return jsonError(
        "Je hebt geen toegang tot de beschikbaarheid van deze medewerker.",
        403,
      );
    }

    /*
     * ========================================================
     * PLANNINGWEKEN OPHALEN
     * ========================================================
     *
     * We halen de planningweken op.
     *
     * Een bestaande deadline uit de database blijft leidend.
     *
     * Als de deadline nog niet is opgeslagen, gebruiken we
     * automatisch de nieuwe standaardregel:
     *
     * week 36 → einde week 31
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
          beschikbaarheidDeadline:
            true,
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
     * ========================================================
     * OPENSTAANDE WEKEN
     * ========================================================
     */

    const openstaandeWeken: SelectorWeek[] =
      weken
        .map((week) => {
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
            beschikbaarheidDeadline:
              deadline.toISOString(),
          };
        })
        .filter((week) => {
          /*
           * Beheerders mogen ook na de deadline
           * weken blijven bekijken/beheren.
           *
           * Gewone medewerkers krijgen alleen
           * weken waarvan de deadline nog niet
           * verstreken is.
           */

          if (
            isEigenaar ||
            isTeamleider
          ) {
            return true;
          }

          return (
            week.beschikbaarheidDeadline !==
              null &&
            new Date(
              week.beschikbaarheidDeadline,
            ) > nu
          );
        });

    /*
     * ========================================================
     * RESPONSE
     * ========================================================
     */

    return NextResponse.json({
      weken: openstaandeWeken,
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