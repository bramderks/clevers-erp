import { NextResponse } from "next/server";

import {
  hasPermissionForVestiging,
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

type ISOWeek = {
  jaar: number;
  weeknummer: number;
};

function isGeldigeDatum(
  waarde: Date | null | undefined,
): waarde is Date {
  return (
    waarde instanceof Date &&
    !Number.isNaN(waarde.getTime())
  );
}

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

function eindeVanISOWeek(
  jaar: number,
  weeknummer: number,
): Date {
  const datum =
    beginVanISOWeek(
      jaar,
      weeknummer,
    );

  datum.setUTCDate(
    datum.getUTCDate() + 6,
  );

  datum.setUTCHours(
    23,
    59,
    59,
    999,
  );

  return datum;
}

function isoWeekVanDatum(
  datum: Date,
): ISOWeek {
  const donderdag =
    new Date(
      Date.UTC(
        datum.getUTCFullYear(),
        datum.getUTCMonth(),
        datum.getUTCDate(),
      ),
    );

  const dag =
    donderdag.getUTCDay() || 7;

  donderdag.setUTCDate(
    donderdag.getUTCDate() +
      4 -
      dag,
  );

  const jaar =
    donderdag.getUTCFullYear();

  const eersteDonderdag =
    new Date(
      Date.UTC(jaar, 0, 4),
    );

  const eersteDag =
    eersteDonderdag.getUTCDay() ||
    7;

  eersteDonderdag.setUTCDate(
    eersteDonderdag.getUTCDate() +
      4 -
      eersteDag,
  );

  const verschil =
    donderdag.getTime() -
    eersteDonderdag.getTime();

  const weeknummer =
    1 +
    Math.round(
      verschil /
        (7 * 24 * 60 * 60 * 1000),
    );

  return {
    jaar,
    weeknummer,
  };
}

function vergelijkWeken(
  a: ISOWeek,
  b: ISOWeek,
) {
  if (a.jaar !== b.jaar) {
    return a.jaar - b.jaar;
  }

  return a.weeknummer - b.weeknummer;
}

function genereerSeizoenWeken(
  seizoenStart: Date,
  seizoenEinde: Date,
): ISOWeek[] {
  const eersteWeek =
    isoWeekVanDatum(
      seizoenStart,
    );

  const laatsteWeek =
    isoWeekVanDatum(
      seizoenEinde,
    );

  const weken: ISOWeek[] = [];

  let huidige =
    beginVanISOWeek(
      eersteWeek.jaar,
      eersteWeek.weeknummer,
    );

  const einde =
    eindeVanISOWeek(
      laatsteWeek.jaar,
      laatsteWeek.weeknummer,
    );

  while (huidige <= einde) {
    weken.push(
      isoWeekVanDatum(huidige),
    );

    huidige.setUTCDate(
      huidige.getUTCDate() + 7,
    );
  }

  return weken;
}

function valtWeekBinnenSeizoen(
  week: ISOWeek,
  seizoenStart: Date,
  seizoenEinde: Date,
) {
  const weekStart =
    beginVanISOWeek(
      week.jaar,
      week.weeknummer,
    );

  const weekEinde =
    eindeVanISOWeek(
      week.jaar,
      week.weeknummer,
    );

  return (
    weekEinde >= seizoenStart &&
    weekStart <= seizoenEinde
  );
}

async function synchroniseerSeizoen(
  vestigingId: string,
) {
  const vestiging =
    await prisma.vestiging.findUnique({
      where: {
        id: vestigingId,
      },
      select: {
        id: true,
        seizoenStart: true,
        seizoenEinde: true,
      },
    });

  if (!vestiging) {
    throw new Error(
      "Vestiging bestaat niet.",
    );
  }

  /*
   * Zolang het seizoen nog niet is ingesteld,
   * laten we bestaande planningweken ongemoeid.
   */
  if (
    !isGeldigeDatum(
      vestiging.seizoenStart,
    ) ||
    !isGeldigeDatum(
      vestiging.seizoenEinde,
    )
  ) {
    return;
  }

  const seizoenStart =
    vestiging.seizoenStart;

  const seizoenEinde =
    vestiging.seizoenEinde;

  if (seizoenStart > seizoenEinde) {
    throw new Error(
      "De seizoenstart moet vóór de seizoeneinde liggen.",
    );
  }

  const seizoenWeken =
    genereerSeizoenWeken(
      seizoenStart,
      seizoenEinde,
    );

  if (seizoenWeken.length === 0) {
    return;
  }

  const bestaandeWeken =
    await prisma.week.findMany({
      where: {
        vestigingId,
      },
      select: {
        id: true,
        jaar: true,
        weeknummer: true,
        status: true,
      },
    });

  const bestaandeSleutels =
    new Set(
      bestaandeWeken.map(
        (week) =>
          `${week.jaar}-${week.weeknummer}`,
      ),
    );

  const nieuweWeken =
    seizoenWeken.filter(
      (week) =>
        !bestaandeSleutels.has(
          `${week.jaar}-${week.weeknummer}`,
        ),
    );

  if (nieuweWeken.length > 0) {
    await prisma.week.createMany({
      data: nieuweWeken.map(
        (week) => ({
          vestigingId,
          jaar: week.jaar,
          weeknummer:
            week.weeknummer,
          status: "OPEN",
        }),
      ),
      skipDuplicates: true,
    });
  }

  /*
   * Alle bestaande weken buiten het seizoen
   * worden afgesloten.
   *
   * Bestaande weken binnen het seizoen behouden
   * hun huidige status.
   */
  const buitenSeizoen =
    bestaandeWeken.filter(
      (week) =>
        !valtWeekBinnenSeizoen(
          {
            jaar: week.jaar,
            weeknummer:
              week.weeknummer,
          },
          seizoenStart,
          seizoenEinde,
        ) &&
        week.status !==
          "AFGESLOTEN",
    );

  if (buitenSeizoen.length > 0) {
    await prisma.week.updateMany({
      where: {
        id: {
          in: buitenSeizoen.map(
            (week) => week.id,
          ),
        },
      },
      data: {
        status: "AFGESLOTEN",
      },
    });
  }
}

async function haalPlanningOp(
  vestigingId: string,
  jaar?: number,
  weeknummer?: number,
) {
  return prisma.week.findMany({
    where: {
      vestigingId,
      ...(jaar !== undefined
        ? { jaar }
        : {}),
      ...(weeknummer !== undefined
        ? { weeknummer }
        : {}),
    },
    orderBy: [
      {
        jaar: "desc",
      },
      {
        weeknummer: "desc",
      },
    ],
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
      },
    },
  });
}

export async function GET(
  request: Request,
) {
  try {
    const { searchParams } =
      new URL(request.url);

    const vestigingId =
      searchParams.get(
        "vestigingId",
      );

    const jaarParam =
      searchParams.get("jaar");

    const weeknummerParam =
      searchParams.get(
        "weeknummer",
      );

    if (!vestigingId) {
      return NextResponse.json(
        {
          fout:
            "vestigingId is verplicht.",
        },
        { status: 400 },
      );
    }

    const toegang =
      await hasPermissionForVestiging(
        permissions.planning.view,
        vestigingId,
      );

    if (!toegang) {
      return NextResponse.json(
        {
          fout:
            "Geen toegang tot deze planning.",
        },
        { status: 403 },
      );
    }

    const jaar =
      jaarParam !== null
        ? Number(jaarParam)
        : undefined;

    const weeknummer =
      weeknummerParam !== null
        ? Number(weeknummerParam)
        : undefined;

    if (
      (jaarParam !== null &&
        !Number.isInteger(jaar)) ||
      (weeknummerParam !== null &&
        !Number.isInteger(
          weeknummer,
        ))
    ) {
      return NextResponse.json(
        {
          fout:
            "Jaar en weeknummer moeten geldige getallen zijn.",
        },
        { status: 400 },
      );
    }

    if (
      weeknummer !== undefined &&
      (weeknummer < 1 ||
        weeknummer > 53)
    ) {
      return NextResponse.json(
        {
          fout:
            "Weeknummer moet tussen 1 en 53 liggen.",
        },
        { status: 400 },
      );
    }

    /*
     * Elke keer dat Planning wordt geladen,
     * controleren we of de weken overeenkomen
     * met het ingestelde seizoen.
     */
    await synchroniseerSeizoen(
      vestigingId,
    );

    const weken =
      await haalPlanningOp(
        vestigingId,
        jaar,
        weeknummer,
      );

    return NextResponse.json(
      weken,
    );
  } catch (error) {
    console.error(
      "Fout bij ophalen planning:",
      error,
    );

    return NextResponse.json(
      {
        fout:
          error instanceof Error
            ? error.message
            : "De planning kon niet worden opgehaald.",
      },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
) {
  try {
    const body =
      await request.json();

    const {
      vestigingId,
      jaar,
      weeknummer,
      status,
      beschikbaarheidDeadline,
    } = body;

    if (
      typeof vestigingId !==
        "string" ||
      vestigingId.length === 0 ||
      !Number.isInteger(jaar) ||
      !Number.isInteger(
        weeknummer,
      )
    ) {
      return NextResponse.json(
        {
          fout:
            "vestigingId, jaar en weeknummer zijn verplicht.",
        },
        { status: 400 },
      );
    }

    const toegang =
      await hasPermissionForVestiging(
        permissions.planning.create,
        vestigingId,
      );

    if (!toegang) {
      return NextResponse.json(
        {
          fout:
            "Je hebt geen rechten om een planningweek aan te maken.",
        },
        { status: 403 },
      );
    }

    if (
      weeknummer < 1 ||
      weeknummer > 53
    ) {
      return NextResponse.json(
        {
          fout:
            "Weeknummer moet tussen 1 en 53 liggen.",
        },
        { status: 400 },
      );
    }

    if (
      status !== undefined &&
      !TOEGESTANE_STATUSSEN.includes(
        status as PlanningStatus,
      )
    ) {
      return NextResponse.json(
        {
          fout:
            "Ongeldige planningstatus.",
        },
        { status: 400 },
      );
    }

    const vestiging =
      await prisma.vestiging.findUnique({
        where: {
          id: vestigingId,
        },
        select: {
          id: true,
          seizoenStart: true,
          seizoenEinde: true,
        },
      });

    if (!vestiging) {
      return NextResponse.json(
        {
          fout:
            "Vestiging bestaat niet.",
        },
        { status: 404 },
      );
    }

    /*
     * Als een seizoen is ingesteld,
     * mag een handmatig aangemaakte week
     * niet buiten dat seizoen vallen.
     */
    if (
      isGeldigeDatum(
        vestiging.seizoenStart,
      ) &&
      isGeldigeDatum(
        vestiging.seizoenEinde,
      )
    ) {
      if (
        vestiging.seizoenStart >
        vestiging.seizoenEinde
      ) {
        return NextResponse.json(
          {
            fout:
              "De seizoenstart moet vóór de seizoeneinde liggen.",
          },
          { status: 400 },
        );
      }

      const valtBinnen =
        valtWeekBinnenSeizoen(
          {
            jaar,
            weeknummer,
          },
          vestiging.seizoenStart,
          vestiging.seizoenEinde,
        );

      if (!valtBinnen) {
        return NextResponse.json(
          {
            fout:
              "Deze planningweek valt buiten het ingestelde seizoen.",
          },
          { status: 400 },
        );
      }
    }

    let deadline:
      | Date
      | null
      | undefined;

    if (
      beschikbaarheidDeadline !==
      undefined
    ) {
      if (
        beschikbaarheidDeadline ===
        null
      ) {
        deadline = null;
      } else {
        deadline = new Date(
          beschikbaarheidDeadline,
        );

        if (
          Number.isNaN(
            deadline.getTime(),
          )
        ) {
          return NextResponse.json(
            {
              fout:
                "Ongeldige beschikbaarheidsdeadline.",
            },
            { status: 400 },
          );
        }
      }
    }

    const bestaandeWeek =
      await prisma.week.findUnique({
        where: {
          vestigingId_jaar_weeknummer: {
            vestigingId,
            jaar,
            weeknummer,
          },
        },
        select: {
          id: true,
        },
      });

    if (bestaandeWeek) {
      return NextResponse.json(
        {
          fout:
            "Deze planningweek bestaat al.",
        },
        { status: 409 },
      );
    }

    const week =
      await prisma.week.create({
        data: {
          vestigingId,
          jaar,
          weeknummer,
          status:
            status ?? "OPEN",
          beschikbaarheidDeadline:
            deadline ?? null,
        },
      });

    return NextResponse.json(
      week,
      { status: 201 },
    );
  } catch (error) {
    console.error(
      "Fout bij aanmaken planningweek:",
      error,
    );

    return NextResponse.json(
      {
        fout:
          "De planningweek kon niet worden aangemaakt.",
      },
      { status: 500 },
    );
  }
}