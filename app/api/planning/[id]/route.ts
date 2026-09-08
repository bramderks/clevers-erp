import { NextResponse } from "next/server";

import {
  hasPermissionForVestiging,
  isEigenaar,
} from "@/lib/auth";
import { permissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const TOEGESTANE_STATUSSEN = [
  "OPEN",
  "IN_PLANNING",
  "GEPUBLICEERD",
  "AFGESLOTEN",
] as const;

type PlanningStatus =
  (typeof TOEGESTANE_STATUSSEN)[number];

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function beginVanISOWeek(
  jaar: number,
  weeknummer: number,
): Date {
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
 * De beschikbaarheidsdeadline ligt:
 *
 * planningweek - 5 weken
 *
 * en loopt tot en met zondag 23:59:59.999
 * van die deadlineweek.
 *
 * Voorbeeld:
 *
 * planningweek 36
 * deadlineweek 31
 * deadline = zondag einde week 31
 */
function berekenBeschikbaarheidDeadline(
  jaar: number,
  weeknummer: number,
): Date {
  const deadlineWeekStart =
    beginVanISOWeek(
      jaar,
      weeknummer - 5,
    );

  deadlineWeekStart.setUTCDate(
    deadlineWeekStart.getUTCDate() +
      6,
  );

  deadlineWeekStart.setUTCHours(
    23,
    59,
    59,
    999,
  );

  return deadlineWeekStart;
}

async function haalWeekOp(
  id: string,
) {
  return prisma.week.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      vestigingId: true,
      vestiging: {
        select: {
          organisatieId: true,
        },
      },
      jaar: true,
      weeknummer: true,
      status: true,
      beschikbaarheidDeadline: true,
    },
  });
}

/*
 * ============================================================
 * GET
 * ============================================================
 */

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  try {
    const { id } =
      await context.params;

    const week =
      await haalWeekOp(id);

    if (!week) {
      return NextResponse.json(
        {
          fout:
            "Planningweek niet gevonden.",
        },
        {
          status: 404,
        },
      );
    }

    const toegang =
      await hasPermissionForVestiging(
        permissions.planning.view,
        week.vestigingId,
      );

    if (!toegang) {
      return NextResponse.json(
        {
          fout:
            "Geen toegang tot deze planning.",
        },
        {
          status: 403,
        },
      );
    }

    const volledigeWeek =
      await prisma.week.findUnique({
        where: {
          id,
        },

        include: {
          diensten: {
            orderBy: [
              {
                datum: "asc",
              },
              {
                begintijd: "asc",
              },
            ],

            include: {
              tags: {
                include: {
                  tag: true,
                },

                orderBy: {
                  tag: {
                    volgorde: "asc",
                  },
                },
              },

              bezetting: {
                include: {
                  medewerker: {
                    select: {
                      id: true,
                      personeelsnummer: true,
                      aanhef: true,
                      voornaam: true,
                      tussenvoegsel: true,
                      achternaam: true,
                    },
                  },
                },

                orderBy: {
                  aangemaaktOp: "asc",
                },
              },
            },
          },

          beschikbaarheden: {
            orderBy: [
              {
                datum: "asc",
              },
              {
                begintijd: "asc",
              },
            ],

            include: {
              medewerker: {
                select: {
                  id: true,
                  personeelsnummer: true,
                  aanhef: true,
                  voornaam: true,
                  tussenvoegsel: true,
                  achternaam: true,
                },
              },
            },
          },
        },
      });

    if (!volledigeWeek) {
      return NextResponse.json(
        {
          fout:
            "Planningweek niet gevonden.",
        },
        {
          status: 404,
        },
      );
    }

    /*
     * Zorg dat een bestaande week altijd
     * de juiste automatische deadline heeft.
     */
    const correcteDeadline =
      berekenBeschikbaarheidDeadline(
        volledigeWeek.jaar,
        volledigeWeek.weeknummer,
      );

    const opgeslagenDeadline =
      volledigeWeek
        .beschikbaarheidDeadline;

    if (
      !opgeslagenDeadline ||
      opgeslagenDeadline.getTime() !==
        correcteDeadline.getTime()
    ) {
      await prisma.week.update({
        where: {
          id: volledigeWeek.id,
        },
        data: {
          beschikbaarheidDeadline:
            correcteDeadline,
        },
      });

      volledigeWeek.beschikbaarheidDeadline =
        correcteDeadline;
    }

    return NextResponse.json(
      volledigeWeek,
    );
  } catch (error) {
    console.error(
      "Fout bij ophalen planningweek:",
      error,
    );

    return NextResponse.json(
      {
        fout:
          "De planningweek kon niet worden opgehaald.",
      },
      {
        status: 500,
      },
    );
  }
}

/*
 * ============================================================
 * PATCH
 * ============================================================
 */

export async function PATCH(
  request: Request,
  context: RouteContext,
) {
  try {
    const { id } =
      await context.params;

    const body =
      await request.json();

    const bestaandeWeek =
      await haalWeekOp(id);

    if (!bestaandeWeek) {
      return NextResponse.json(
        {
          fout:
            "Planningweek niet gevonden.",
        },
        {
          status: 404,
        },
      );
    }

    const eigenaar =
      await isEigenaar(
        bestaandeWeek.vestiging.organisatieId,
      );

    if (!eigenaar) {
      return NextResponse.json(
        {
          fout:
            "Alleen de eigenaar kan deze planningweek wijzigen.",
        },
        {
          status: 403,
        },
      );
    }

    const toegang =
      await hasPermissionForVestiging(
        permissions.planning.update,
        bestaandeWeek.vestigingId,
      );

    if (!toegang) {
      return NextResponse.json(
        {
          fout:
            "Je hebt geen rechten om deze planningweek te wijzigen.",
        },
        {
          status: 403,
        },
      );
    }

    /*
     * Alleen status mag handmatig worden gewijzigd.
     *
     * De beschikbaarheidsdeadline wordt automatisch
     * bepaald aan de hand van jaar + weeknummer.
     */
    const data: {
      status?: PlanningStatus;
      beschikbaarheidDeadline: Date;
    } = {
      beschikbaarheidDeadline:
        berekenBeschikbaarheidDeadline(
          bestaandeWeek.jaar,
          bestaandeWeek.weeknummer,
        ),
    };

    /*
     * --------------------------------------------------------
     * STATUS
     * --------------------------------------------------------
     */

    if (
      body.status !== undefined
    ) {
      if (
        typeof body.status !==
          "string" ||
        !TOEGESTANE_STATUSSEN.includes(
          body.status as PlanningStatus,
        )
      ) {
        return NextResponse.json(
          {
            fout:
              "Ongeldige planningstatus.",
          },
          {
            status: 400,
          },
        );
      }

      data.status =
        body.status as PlanningStatus;
    }

    /*
     * --------------------------------------------------------
     * DEADLINE NIET HANDMATIG INSTELBAAR
     * --------------------------------------------------------
     */

    if (
      body.beschikbaarheidDeadline !==
      undefined
    ) {
      return NextResponse.json(
        {
          fout:
            "De beschikbaarheidsdeadline wordt automatisch bepaald en kan niet handmatig worden gewijzigd.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * --------------------------------------------------------
     * GEEN WIJZIGING
     * --------------------------------------------------------
     */

    if (
      data.status === undefined &&
      bestaandeWeek
        .beschikbaarheidDeadline
        ?.getTime() ===
        data.beschikbaarheidDeadline.getTime()
    ) {
      return NextResponse.json(
        {
          fout:
            "Er zijn geen wijzigingen opgegeven.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * --------------------------------------------------------
     * OPSLAAN
     * --------------------------------------------------------
     */

    const week =
      await prisma.week.update({
        where: {
          id,
        },

        data,
      });

    return NextResponse.json(
      week,
    );
  } catch (error) {
    console.error(
      "Fout bij wijzigen planningweek:",
      error,
    );

    return NextResponse.json(
      {
        fout:
          "De planningweek kon niet worden gewijzigd.",
      },
      {
        status: 500,
      },
    );
  }
}

/*
 * ============================================================
 * DELETE
 * ============================================================
 */

export async function DELETE(
  _request: Request,
  context: RouteContext,
) {
  try {
    const { id } =
      await context.params;

    const bestaandeWeek =
      await haalWeekOp(id);

    if (!bestaandeWeek) {
      return NextResponse.json(
        {
          fout:
            "Planningweek niet gevonden.",
        },
        {
          status: 404,
        },
      );
    }

    const eigenaar =
      await isEigenaar(
        bestaandeWeek.vestiging.organisatieId,
      );

    if (!eigenaar) {
      return NextResponse.json(
        {
          fout:
            "Alleen de eigenaar kan deze planningweek verwijderen.",
        },
        {
          status: 403,
        },
      );
    }

    const toegang =
      await hasPermissionForVestiging(
        permissions.planning.delete,
        bestaandeWeek.vestigingId,
      );

    if (!toegang) {
      return NextResponse.json(
        {
          fout:
            "Je hebt geen rechten om deze planningweek te verwijderen.",
        },
        {
          status: 403,
        },
      );
    }

    await prisma.week.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({
      succes: true,
    });
  } catch (error) {
    console.error(
      "Fout bij verwijderen planningweek:",
      error,
    );

    return NextResponse.json(
      {
        fout:
          "De planningweek kon niet worden verwijderd.",
      },
      {
        status: 500,
      },
    );
  }
}