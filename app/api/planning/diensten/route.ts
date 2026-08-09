import { NextResponse } from "next/server";

import { hasPermissionForVestiging } from "@/lib/auth";
import { permissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const DATUM_FOUT =
  "Datum moet een geldige datum zijn.";

const TIJD_FOUT =
  "Begin- en eindtijd moeten geldige datums zijn.";

async function haalWeekMetVestigingOp(
  weekId: string,
) {
  return prisma.week.findUnique({
    where: {
      id: weekId,
    },
    select: {
      id: true,
      jaar: true,
      weeknummer: true,
      vestigingId: true,
      vestiging: {
        select: {
          id: true,
          seizoenStart: true,
          seizoenEinde: true,
        },
      },
    },
  });
}

async function haalDienstMetVestigingOp(
  dienstId: string,
) {
  return prisma.dienst.findUnique({
    where: {
      id: dienstId,
    },
    select: {
      id: true,
      week: {
        select: {
          vestigingId: true,
        },
      },
    },
  });
}

function verwerkTags(tags: unknown) {
  if (!Array.isArray(tags)) {
    return [];
  }

  return Array.from(
    new Map(
      tags
        .map((tag: unknown) => {
          if (typeof tag === "string") {
            return {
              tagId: tag,
              aantal: 1,
            };
          }

          if (
            typeof tag === "object" &&
            tag !== null &&
            "tagId" in tag &&
            typeof tag.tagId === "string"
          ) {
            const aantal =
              "aantal" in tag &&
              typeof tag.aantal === "number" &&
              Number.isInteger(tag.aantal) &&
              tag.aantal > 0
                ? tag.aantal
                : 1;

            return {
              tagId: tag.tagId,
              aantal,
            };
          }

          return null;
        })
        .filter(
          (
            tag,
          ): tag is {
            tagId: string;
            aantal: number;
          } => tag !== null,
        )
        .map((tag) => [
          tag.tagId,
          tag,
        ]),
    ).values(),
  );
}

function zetBeginVanDag(
  datum: Date,
) {
  const resultaat = new Date(datum);

  resultaat.setHours(
    0,
    0,
    0,
    0,
  );

  return resultaat;
}

function zetEindeVanDag(
  datum: Date,
) {
  const resultaat = new Date(datum);

  resultaat.setHours(
    23,
    59,
    59,
    999,
  );

  return resultaat;
}

function isDatumBinnenSeizoen(
  datum: Date,
  seizoenStart: Date | null,
  seizoenEinde: Date | null,
) {
  if (
    !seizoenStart ||
    !seizoenEinde
  ) {
    return false;
  }

  const controleDatum =
    zetBeginVanDag(datum);

  const start =
    zetBeginVanDag(seizoenStart);

  const einde =
    zetEindeVanDag(seizoenEinde);

  return (
    controleDatum >= start &&
    controleDatum <= einde
  );
}

function getISOWeek(
  datum: Date,
): {
  jaar: number;
  weeknummer: number;
} {
  const donderdag = new Date(
    Date.UTC(
      datum.getFullYear(),
      datum.getMonth(),
      datum.getDate(),
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
      Date.UTC(
        jaar,
        0,
        4,
      ),
    );

  const eersteDag =
    eersteDonderdag.getUTCDay() || 7;

  const weeknummer = Math.ceil(
    (
      (donderdag.getTime() -
        eersteDonderdag.getTime()) /
        86400000 +
      eersteDag -
      1
    ) /
      7,
  );

  return {
    jaar,
    weeknummer,
  };
}

export async function GET(
  request: Request,
) {
  try {
    const { searchParams } =
      new URL(request.url);

    const weekId =
      searchParams.get("weekId");

    if (!weekId) {
      return NextResponse.json(
        {
          fout:
            "weekId is verplicht.",
        },
        { status: 400 },
      );
    }

    const week =
      await haalWeekMetVestigingOp(
        weekId,
      );

    if (!week) {
      return NextResponse.json(
        {
          fout:
            "Planningweek niet gevonden.",
        },
        { status: 404 },
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
        { status: 403 },
      );
    }

    const diensten =
      await prisma.dienst.findMany({
        where: {
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
      });

    return NextResponse.json(
      diensten,
    );
  } catch (error) {
    console.error(
      "Fout bij ophalen diensten:",
      error,
    );

    return NextResponse.json(
      {
        fout:
          "De diensten konden niet worden opgehaald.",
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
      weekId,
      datum,
      begintijd,
      eindtijd,
      opmerkingen,
      tags,
    } = body;

    if (
      !weekId ||
      !datum ||
      !begintijd ||
      !eindtijd
    ) {
      return NextResponse.json(
        {
          fout:
            "weekId, datum, begintijd en eindtijd zijn verplicht.",
        },
        { status: 400 },
      );
    }

    const week =
      await haalWeekMetVestigingOp(
        weekId,
      );

    if (!week) {
      return NextResponse.json(
        {
          fout:
            "Planningweek niet gevonden.",
        },
        { status: 404 },
      );
    }

    const toegang =
      await hasPermissionForVestiging(
        permissions.planning.create,
        week.vestigingId,
      );

    if (!toegang) {
      return NextResponse.json(
        {
          fout:
            "Je hebt geen rechten om een dienst aan te maken.",
        },
        { status: 403 },
      );
    }

    const datumWaarde =
      new Date(datum);

    const begintijdWaarde =
      new Date(begintijd);

    const eindtijdWaarde =
      new Date(eindtijd);

    if (
      Number.isNaN(
        datumWaarde.getTime(),
      )
    ) {
      return NextResponse.json(
        {
          fout: DATUM_FOUT,
        },
        { status: 400 },
      );
    }

    if (
      Number.isNaN(
        begintijdWaarde.getTime(),
      ) ||
      Number.isNaN(
        eindtijdWaarde.getTime(),
      )
    ) {
      return NextResponse.json(
        {
          fout: TIJD_FOUT,
        },
        { status: 400 },
      );
    }

    if (
      eindtijdWaarde <=
      begintijdWaarde
    ) {
      return NextResponse.json(
        {
          fout:
            "Eindtijd moet na de begintijd liggen.",
        },
        { status: 400 },
      );
    }

    if (
      !week.vestiging.seizoenStart ||
      !week.vestiging.seizoenEinde
    ) {
      return NextResponse.json(
        {
          fout:
            "Voor deze vestiging is geen volledig seizoen ingesteld.",
        },
        { status: 400 },
      );
    }

    if (
      !isDatumBinnenSeizoen(
        datumWaarde,
        week.vestiging.seizoenStart,
        week.vestiging.seizoenEinde,
      )
    ) {
      return NextResponse.json(
        {
          fout:
            "Deze dienst valt buiten het ingestelde seizoen.",
        },
        { status: 400 },
      );
    }

    const isoWeek =
      getISOWeek(datumWaarde);

    if (
      isoWeek.jaar !== week.jaar ||
      isoWeek.weeknummer !==
        week.weeknummer
    ) {
      return NextResponse.json(
        {
          fout:
            "De gekozen datum valt niet binnen de geselecteerde planningweek.",
        },
        { status: 400 },
      );
    }

    const geldigeTags =
      verwerkTags(tags);

    const tagIds =
      geldigeTags.map(
        (tag) => tag.tagId,
      );

    const bestaandeTags =
      tagIds.length > 0
        ? await prisma.tag.findMany({
            where: {
              id: {
                in: tagIds,
              },
              actief: true,
            },
            select: {
              id: true,
            },
          })
        : [];

    const bestaandeTagIds =
      new Set(
        bestaandeTags.map(
          (tag) => tag.id,
        ),
      );

    const dienstTags =
      geldigeTags.filter(
        (tag) =>
          bestaandeTagIds.has(
            tag.tagId,
          ),
      );

    const dienst =
      await prisma.dienst.create({
        data: {
          weekId,
          datum: datumWaarde,
          begintijd:
            begintijdWaarde,
          eindtijd:
            eindtijdWaarde,
          opmerkingen:
            typeof opmerkingen ===
              "string" &&
            opmerkingen.trim().length >
              0
              ? opmerkingen.trim()
              : null,
          tags: {
            create: dienstTags,
          },
        },
        include: {
          tags: {
            include: {
              tag: true,
            },
          },
          bezetting: true,
        },
      });

    return NextResponse.json(
      dienst,
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(
      "Fout bij aanmaken dienst:",
      error,
    );

    return NextResponse.json(
      {
        fout:
          "De dienst kon niet worden aangemaakt.",
      },
      { status: 500 },
    );
  }
}