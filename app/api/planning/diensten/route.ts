import { NextResponse } from "next/server";

import {
  hasPermissionForVestiging,
  isEigenaar,
} from "@/lib/auth";

import {
  permissions,
} from "@/lib/permissions";

import {
  prisma,
} from "@/lib/prisma";

const DATUM_FOUT =
  "Datum moet een geldige datum zijn.";

const TIJD_FOUT =
  "De begintijd moet een geldige datum zijn.";

const MINIMALE_STARTTIJD_MINUTEN =
  9 * 60;

const TIJDSTAP_MINUTEN =
  15;

/*
 * ============================================================
 * WEEK OPHALEN
 * ============================================================
 */

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
          organisatieId: true,
          seizoenStart: true,
          seizoenEinde: true,
        },
      },
    },
  });
}

/*
 * ============================================================
 * ISO WEEK BEPALEN
 * ============================================================
 */

function getISOWeek(
  datum: Date,
): {
  jaar: number;
  weeknummer: number;
} {
  const donderdag =
    new Date(
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
    eersteDonderdag.getUTCDay() ||
    7;

  const weeknummer =
    Math.ceil(
      (
        (
          donderdag.getTime() -
          eersteDonderdag.getTime()
        ) /
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

/*
 * ============================================================
 * WEEK ZOEKEN OP VESTIGING + DATUM
 * ============================================================
 *
 * Hierdoor hoeft de frontend bij het
 * aanmaken van een dienst niet verplicht
 * zelf een weekId mee te sturen.
 */

async function haalWeekVoorDatumOp(
  vestigingId: string,
  datum: Date,
) {
  const isoWeek =
    getISOWeek(datum);

  return prisma.week.findFirst({
    where: {
      vestigingId,

      jaar: isoWeek.jaar,

      weeknummer:
        isoWeek.weeknummer,
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

/*
 * ============================================================
 * TAGS VERWERKEN
 * ============================================================
 */

function verwerkTags(
  tags: unknown,
) {
  if (!Array.isArray(tags)) {
    return [];
  }

  return Array.from(
    new Map(
      tags
        .map(
          (
            tag: unknown,
          ) => {
            if (
              typeof tag ===
              "string"
            ) {
              return {
                tagId: tag,
                aantal: 1,
              };
            }

            if (
              typeof tag ===
                "object" &&
              tag !== null &&
              "tagId" in tag &&
              typeof tag.tagId ===
                "string"
            ) {
              const aantal =
                "aantal" in tag &&
                typeof tag.aantal ===
                  "number" &&
                Number.isInteger(
                  tag.aantal,
                ) &&
                tag.aantal > 0
                  ? tag.aantal
                  : 1;

              return {
                tagId:
                  tag.tagId,

                aantal,
              };
            }

            return null;
          },
        )
        .filter(
          (
            tag,
          ): tag is {
            tagId: string;
            aantal: number;
          } => tag !== null,
        )
        .map(
          (tag) => [
            tag.tagId,
            tag,
          ],
        ),
    ).values(),
  );
}

/*
 * ============================================================
 * DATUM HELPERS
 * ============================================================
 */

function zetBeginVanDag(
  datum: Date,
) {
  const resultaat =
    new Date(datum);

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
  const resultaat =
    new Date(datum);

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
    zetBeginVanDag(
      seizoenStart,
    );

  const einde =
    zetEindeVanDag(
      seizoenEinde,
    );

  return (
    controleDatum >= start &&
    controleDatum <= einde
  );
}

function minutenVanDag(
  datum: Date,
) {
  return (
    datum.getHours() * 60 +
    datum.getMinutes()
  );
}

function isTijdOpKwartier(
  datum: Date,
) {
  return (
    datum.getSeconds() === 0 &&
    datum.getMilliseconds() === 0 &&
    datum.getMinutes() %
      TIJDSTAP_MINUTEN ===
      0
  );
}

function isZelfdeDag(
  a: Date,
  b: Date,
) {
  return (
    a.getFullYear() ===
      b.getFullYear() &&
    a.getMonth() ===
      b.getMonth() &&
    a.getDate() ===
      b.getDate()
  );
}

/*
 * ============================================================
 * TAG OVERLAPS
 * ============================================================
 */

async function zoekTagOverlaps(
  weekId: string,
  datum: Date,
  begintijd: Date,
  eindtijd: Date | null,
  tagIds: string[],
) {
  if (
    tagIds.length === 0 ||
    !eindtijd
  ) {
    return [];
  }

  const bestaandeDiensten =
    await prisma.dienst.findMany({
      where: {
        weekId,

        datum: {
          gte:
            zetBeginVanDag(
              datum,
            ),

          lte:
            zetEindeVanDag(
              datum,
            ),
        },

        tags: {
          some: {
            tagId: {
              in: tagIds,
            },
          },
        },
      },

      select: {
        id: true,
        begintijd: true,
        eindtijd: true,

        tags: {
          where: {
            tagId: {
              in: tagIds,
            },
          },

          select: {
            tagId: true,

            tag: {
              select: {
                naam: true,
              },
            },
          },
        },
      },

      orderBy: {
        begintijd: "asc",
      },
    });

  const overlaps: {
    dienstId: string;
    tagNaam: string;
    begintijd: Date;
    eindtijd: Date;
  }[] = [];

  for (
    const dienst of bestaandeDiensten
  ) {
    if (!dienst.eindtijd) {
      continue;
    }

    if (
      dienst.id &&
      isZelfdeDag(
        new Date(
          dienst.begintijd,
        ),
        datum,
      ) &&
      new Date(
        dienst.begintijd,
      ) < eindtijd &&
      new Date(
        dienst.eindtijd,
      ) > begintijd
    ) {
      for (
        const tag of dienst.tags
      ) {
        overlaps.push({
          dienstId:
            dienst.id,

          tagNaam:
            tag.tag.naam,

          begintijd:
            new Date(
              dienst.begintijd,
            ),

          eindtijd:
            new Date(
              dienst.eindtijd,
            ),
        });
      }
    }
  }

  return overlaps;
}

/*
 * ============================================================
 * GET DIENSTEN
 * ============================================================
 */

export async function GET(
  request: Request,
) {
  try {
    const {
      searchParams,
    } = new URL(
      request.url,
    );

    const weekId =
      searchParams.get(
        "weekId",
      );

    if (!weekId) {
      return NextResponse.json(
        {
          fout:
            "weekId is verplicht.",
        },
        {
          status: 400,
        },
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
      {
        status: 500,
      },
    );
  }
}

/*
 * ============================================================
 * POST DIENST AANMAKEN
 * ============================================================
 *
 * Ondersteunt:
 *
 * 1. weekId + datum
 *
 * OF
 *
 * 2. vestigingId + datum
 *
 * Hierdoor werkt de huidige popup zonder
 * dat weekId verplicht vanuit de frontend
 * hoeft te worden meegestuurd.
 */

export async function POST(
  request: Request,
) {
  try {
    const body =
      await request.json();

    const {
      weekId,
      vestigingId,
      datum,
      begintijd,
      eindtijd,
      opmerkingen,
      tags,
    } = body;

    /*
     * ========================================================
     * BASIS VALIDATIE
     * ========================================================
     */

    if (
      !datum ||
      !begintijd
    ) {
      return NextResponse.json(
        {
          fout:
            "Datum en begintijd zijn verplicht.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      !weekId &&
      !vestigingId
    ) {
      return NextResponse.json(
        {
          fout:
            "weekId of vestigingId is verplicht.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * ========================================================
     * DATUMS VERWERKEN
     * ========================================================
     */

    const datumWaarde =
      new Date(datum);

    const begintijdWaarde =
      new Date(begintijd);

    const eindtijdWaarde =
      eindtijd
        ? new Date(eindtijd)
        : null;

    if (
      Number.isNaN(
        datumWaarde.getTime(),
      )
    ) {
      return NextResponse.json(
        {
          fout: DATUM_FOUT,
        },
        {
          status: 400,
        },
      );
    }

    if (
      Number.isNaN(
        begintijdWaarde.getTime(),
      )
    ) {
      return NextResponse.json(
        {
          fout: TIJD_FOUT,
        },
        {
          status: 400,
        },
      );
    }

    if (
      eindtijdWaarde &&
      Number.isNaN(
        eindtijdWaarde.getTime(),
      )
    ) {
      return NextResponse.json(
        {
          fout:
            "De eindtijd moet een geldige datum zijn.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * ========================================================
     * PLANNINGWEEK BEPALEN
     * ========================================================
     */

    const week =
      weekId
        ? await haalWeekMetVestigingOp(
            weekId,
          )
        : await haalWeekVoorDatumOp(
            vestigingId,
            datumWaarde,
          );

    if (!week) {
      return NextResponse.json(
        {
          fout:
            "Planningweek niet gevonden voor deze datum en vestiging.",
        },
        {
          status: 404,
        },
      );
    }

    /*
     * ========================================================
     * EXTRA VEILIGHEID
     * ========================================================
     *
     * Als zowel weekId als vestigingId
     * worden meegestuurd, moeten deze
     * bij dezelfde vestiging horen.
     */

    if (
      vestigingId &&
      week.vestigingId !==
        vestigingId
    ) {
      return NextResponse.json(
        {
          fout:
            "De planningweek hoort niet bij de opgegeven vestiging.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * ========================================================
     * RECHTEN
     * ========================================================
     *
     * De backend blijft de definitieve
     * beveiliging.
     *
     * Alleen gebruikers met
     * planning.create mogen daadwerkelijk
     * een dienst aanmaken.
     */

    /*
     * Alleen de Eigenaar mag diensten
     * daadwerkelijk aanmaken. Teamleiders
     * en medewerkers kunnen deze endpoint
     * dus niet via een directe URL of API-call
     * gebruiken om de planning te wijzigen.
     */
    const eigenaar =
      await isEigenaar(
        week.vestiging.organisatieId,
      );

    if (!eigenaar) {
      return NextResponse.json(
        {
          fout:
            "Alleen de eigenaar kan een dienst aanmaken.",
        },
        {
          status: 403,
        },
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
        {
          status: 403,
        },
      );
    }

    /*
     * ========================================================
     * TIJD VALIDATIE
     * ========================================================
     */

    if (
      eindtijdWaarde &&
      eindtijdWaarde <=
        begintijdWaarde
    ) {
      return NextResponse.json(
        {
          fout:
            "Eindtijd moet na de begintijd liggen.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      eindtijdWaarde &&
      !isZelfdeDag(
        begintijdWaarde,
        eindtijdWaarde,
      )
    ) {
      return NextResponse.json(
        {
          fout:
            "Een dienst moet binnen dezelfde kalenderdag vallen.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      minutenVanDag(
        begintijdWaarde,
      ) <
      MINIMALE_STARTTIJD_MINUTEN
    ) {
      return NextResponse.json(
        {
          fout:
            "Een dienst kan niet eerder dan 09:00 beginnen.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      !isTijdOpKwartier(
        begintijdWaarde,
      )
    ) {
      return NextResponse.json(
        {
          fout:
            "De begintijd moet op een kwartier vallen.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      eindtijdWaarde &&
      !isTijdOpKwartier(
        eindtijdWaarde,
      )
    ) {
      return NextResponse.json(
        {
          fout:
            "De eindtijd moet op een kwartier vallen.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * ========================================================
     * SEIZOEN
     * ========================================================
     */

    if (
      !week.vestiging.seizoenStart ||
      !week.vestiging.seizoenEinde
    ) {
      return NextResponse.json(
        {
          fout:
            "Voor deze vestiging is geen volledig seizoen ingesteld.",
        },
        {
          status: 400,
        },
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
        {
          status: 400,
        },
      );
    }

    /*
     * ========================================================
     * CONTROLEREN OF DATUM BIJ WEEK HOORT
     * ========================================================
     */

    const isoWeek =
      getISOWeek(
        datumWaarde,
      );

    if (
      isoWeek.jaar !==
        week.jaar ||
      isoWeek.weeknummer !==
        week.weeknummer
    ) {
      return NextResponse.json(
        {
          fout:
            "De gekozen datum valt niet binnen de geselecteerde planningweek.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * ========================================================
     * TAGS
     * ========================================================
     */

    const geldigeTags =
      verwerkTags(tags);

    const tagIds =
      geldigeTags.map(
        (tag) =>
          tag.tagId,
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
              naam: true,
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

    /*
     * Minimaal één planningstag blijft
     * verplicht.
     *
     * BHV is hierbij niet verplicht.
     */

    if (
      dienstTags.length === 0
    ) {
      return NextResponse.json(
        {
          fout:
            "Selecteer minimaal één geldige planningstag.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * ========================================================
     * TAG OVERLAPS
     * ========================================================
     */

    const overlaps =
      await zoekTagOverlaps(
        week.id,
        datumWaarde,
        begintijdWaarde,
        eindtijdWaarde,
        dienstTags.map(
          (tag) =>
            tag.tagId,
        ),
      );

    const uniekeOverlaps =
      Array.from(
        new Map(
          overlaps.map(
            (overlap) => [
              `${overlap.dienstId}-${overlap.tagNaam}`,
              overlap,
            ],
          ),
        ).values(),
      );

    /*
     * ========================================================
     * DIENST AANMAKEN
     * ========================================================
     *
     * Er wordt bewust GEEN medewerker
     * verplicht.
     *
     * Een nieuwe dienst kan dus open
     * worden aangemaakt.
     */

    const dienst =
      await prisma.dienst.create({
        data: {
          weekId:
            week.id,

          datum:
            datumWaarde,

          begintijd:
            begintijdWaarde,

          eindtijd:
            eindtijdWaarde ??
            new Date(
              datumWaarde.getFullYear(),
              datumWaarde.getMonth(),
              datumWaarde.getDate(),
              23,
              59,
              0,
              0,
            ),

          opmerkingen:
            typeof opmerkingen ===
              "string" &&
            opmerkingen.trim()
              .length > 0
              ? opmerkingen.trim()
              : null,

          tags: {
            create:
              dienstTags,
          },
        },

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

    /*
     * ========================================================
     * RESPONSE
     * ========================================================
     */

    return NextResponse.json(
      {
        ...dienst,

        waarschuwingen:
          uniekeOverlaps.map(
            (overlap) => ({
              type:
                "TAG_OVERLAP",

              melding:
                `Er is al een dienst voor ${overlap.tagNaam} van ${overlap.begintijd.toLocaleTimeString(
                  "nl-NL",
                  {
                    hour: "2-digit",
                    minute: "2-digit",
                  },
                )} tot ${overlap.eindtijd.toLocaleTimeString(
                  "nl-NL",
                  {
                    hour: "2-digit",
                    minute: "2-digit",
                  },
                )}.`,

              dienstId:
                overlap.dienstId,

              tagNaam:
                overlap.tagNaam,
            }),
          ),
      },
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
      {
        status: 500,
      },
    );
  }
}