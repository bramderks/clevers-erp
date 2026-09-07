import { randomUUID } from "node:crypto";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getCurrentUser,
} from "@/lib/auth";
import {
  prisma,
} from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function isGeldigeDatum(
  waarde: unknown,
): waarde is string {
  return (
    typeof waarde === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(
      waarde,
    ) &&
    !Number.isNaN(
      new Date(
        `${waarde}T00:00:00`,
      ).getTime(),
    )
  );
}

function isGeldigeTijd(
  waarde: unknown,
): waarde is string {
  if (
    typeof waarde !== "string" ||
    !/^\d{2}:\d{2}$/.test(
      waarde,
    )
  ) {
    return false;
  }

  const [
    uren,
    minuten,
  ] = waarde.split(":").map(Number);

  return (
    uren >= 0 &&
    uren <= 23 &&
    minuten >= 0 &&
    minuten <= 59
  );
}

function isoWeek(
  datum: Date,
) {
  const kopie =
    new Date(
      Date.UTC(
        datum.getFullYear(),
        datum.getMonth(),
        datum.getDate(),
      ),
    );

  const dag =
    kopie.getUTCDay() || 7;

  kopie.setUTCDate(
    kopie.getUTCDate() +
      4 -
      dag,
  );

  const jaar =
    kopie.getUTCFullYear();

  const eerste =
    new Date(
      Date.UTC(
        jaar,
        0,
        4,
      ),
    );

  const eersteDag =
    eerste.getUTCDay() || 7;

  const weeknummer =
    Math.ceil(
      (
        (
          kopie.getTime() -
          eerste.getTime()
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

function dagVanWeek(
  datum: Date,
) {
  const dag =
    datum.getDay();

  return dag === 0
    ? 7
    : dag;
}

function beginDag(
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

function eindeDag(
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

function maakTijd(
  datum: Date,
  tijd: string,
) {
  const [
    uren,
    minuten,
  ] = tijd.split(":").map(Number);

  const resultaat =
    new Date(datum);

  resultaat.setHours(
    uren,
    minuten,
    0,
    0,
  );

  return resultaat;
}

async function vereisEigenaarVoorMedewerker(
  medewerkerId: string,
) {
  const gebruiker =
    await getCurrentUser();

  if (
    !gebruiker ||
    !gebruiker.actief
  ) {
    return null;
  }

  const medewerker =
    await prisma.medewerker.findUnique({
      where: {
        id: medewerkerId,
      },

      select: {
        id: true,

        vestigingen: {
          select: {
            vestiging: {
              select: {
                id: true,
                organisatieId: true,
                actief: true,
              },
            },
          },
        },
      },
    });

  if (!medewerker) {
    return {
      gebruiker,
      medewerker: null,
      toegestaan: false,
    };
  }

  const organisatieIds =
    Array.from(
      new Set(
        medewerker.vestigingen
          .filter(
            (relatie) =>
              relatie.vestiging.actief,
          )
          .map(
            (relatie) =>
              relatie.vestiging
                .organisatieId,
          ),
      ),
    );

  const toegestaan =
    gebruiker.organisaties.some(
      (relatie) =>
        relatie.actief &&
        relatie.organisatie.actief &&
        relatie.rol.naam
          .trim()
          .toLowerCase() ===
          "eigenaar" &&
        organisatieIds.includes(
          relatie.organisatieId,
        ),
    );

  return {
    gebruiker,
    medewerker,
    toegestaan,
  };
}

export async function GET(
  _request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const {
      id,
    } = await params;

    const toegang =
      await vereisEigenaarVoorMedewerker(
        id,
      );

    if (
      !toegang ||
      !toegang.medewerker
    ) {
      return NextResponse.json(
        {
          error:
            "Medewerker niet gevonden.",
        },
        {
          status: 404,
        },
      );
    }

    if (!toegang.toegestaan) {
      return NextResponse.json(
        {
          error:
            "Alleen de eigenaar heeft toegang tot afspraken.",
        },
        {
          status: 403,
        },
      );
    }

    const [
      dossier,
      vasteUren,
    ] = await Promise.all([
      prisma.$queryRawUnsafe<
        Array<{
          id: string;
          type: string;
          titel: string;
          omschrijving: string | null;
          kanaal: string | null;
          documentNaam: string | null;
          documentUrl: string | null;
          datum: Date;
          aangemaaktOp: Date;
        }>
      >(
        `SELECT "id", "type", "titel", "omschrijving", "kanaal", "documentNaam", "documentUrl", "datum", "aangemaaktOp"
         FROM "MedewerkerDossierItem"
         WHERE "medewerkerId" = $1
         ORDER BY "datum" DESC, "aangemaaktOp" DESC`,
        id,
      ),

      prisma.$queryRawUnsafe<
        Array<{
          id: string;
          vestigingId: string;
          vestigingNaam: string;
          tagId: string;
          tagNaam: string;
          dagVanWeek: number;
          begintijd: string;
          eindtijd: string;
          startDatum: Date;
          eindDatum: Date;
          actief: boolean;
          akkoordOp: Date;
        }>
      >(
        `SELECT
           a."id",
           a."vestigingId",
           v."naam" AS "vestigingNaam",
           a."tagId",
           t."naam" AS "tagNaam",
           a."dagVanWeek",
           a."begintijd",
           a."eindtijd",
           a."startDatum",
           a."eindDatum",
           a."actief",
           a."akkoordOp"
         FROM "VasteUrenAfspraak" a
         INNER JOIN "Vestiging" v ON v."id" = a."vestigingId"
         INNER JOIN "Tag" t ON t."id" = a."tagId"
         WHERE a."medewerkerId" = $1
         ORDER BY a."startDatum" ASC, a."dagVanWeek" ASC, a."begintijd" ASC`,
        id,
      ),
    ]);

    return NextResponse.json({
      dossier,
      vasteUren,
    });
  } catch (error) {
    console.error(
      "Afspraken ophalen mislukt:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "De afspraken konden niet worden opgehaald.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const {
      id,
    } = await params;

    const toegang =
      await vereisEigenaarVoorMedewerker(
        id,
      );

    if (
      !toegang ||
      !toegang.medewerker
    ) {
      return NextResponse.json(
        {
          error:
            "Medewerker niet gevonden.",
        },
        {
          status: 404,
        },
      );
    }

    if (!toegang.toegestaan) {
      return NextResponse.json(
        {
          error:
            "Alleen de eigenaar kan afspraken opslaan.",
        },
        {
          status: 403,
        },
      );
    }

    const body:
      | Record<string, unknown>
      | null =
      await request.json();

    if (!body) {
      throw new Error(
        "Ongeldige gegevens.",
      );
    }

    if (body.type === "dossier") {
      const titel =
        typeof body.titel === "string"
          ? body.titel.trim()
          : "";

      if (!titel) {
        throw new Error(
          "Titel is verplicht.",
        );
      }

      const datum =
        isGeldigeDatum(
          body.datum,
        )
          ? new Date(
              `${body.datum}T00:00:00`,
            )
          : new Date();

      const dossierType =
        typeof body.dossierType === "string" &&
        body.dossierType.trim()
          ? body.dossierType.trim()
          : "AFSPRAAK";

      const omschrijving =
        typeof body.omschrijving === "string"
          ? body.omschrijving.trim() ||
            null
          : null;

      const kanaal =
        typeof body.kanaal === "string"
          ? body.kanaal.trim() ||
            null
          : null;

      const documentNaam =
        typeof body.documentNaam === "string"
          ? body.documentNaam.trim() ||
            null
          : null;

      const documentUrl =
        typeof body.documentUrl === "string"
          ? body.documentUrl.trim() ||
            null
          : null;

      const itemId =
        randomUUID();

      await prisma.$executeRawUnsafe(
        `INSERT INTO "MedewerkerDossierItem"
          ("id", "medewerkerId", "type", "titel", "omschrijving", "kanaal", "documentNaam", "documentUrl", "datum", "aangemaaktOp", "gewijzigdOp")
         VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        itemId,
        id,
        dossierType,
        titel,
        omschrijving,
        kanaal,
        documentNaam,
        documentUrl,
        datum,
      );

      return NextResponse.json({
        id: itemId,
        melding:
          "Dossierafspraak is opgeslagen.",
      });
    }

    if (body.type !== "vaste-uren") {
      throw new Error(
        "Onbekend afspraaktype.",
      );
    }

    const vestigingId =
      typeof body.vestigingId === "string"
        ? body.vestigingId
        : "";

    const tagId =
      typeof body.tagId === "string"
        ? body.tagId
        : "";

    const weekdag =
      typeof body.dagVanWeek === "number"
        ? body.dagVanWeek
        : Number(
            body.dagVanWeek,
          );

    if (
      !Number.isInteger(
        weekdag,
      ) ||
      weekdag < 1 ||
      weekdag > 7
    ) {
      throw new Error(
        "Kies een geldige vaste dag.",
      );
    }

    if (
      !isGeldigeDatum(
        body.startDatum,
      ) ||
      !isGeldigeDatum(
        body.eindDatum,
      )
    ) {
      throw new Error(
        "Start- en einddatum zijn verplicht.",
      );
    }

    if (
      !isGeldigeTijd(
        body.begintijd,
      ) ||
      !isGeldigeTijd(
        body.eindtijd,
      )
    ) {
      throw new Error(
        "Begin- en eindtijd zijn verplicht.",
      );
    }

    const startDatum =
      new Date(
        `${body.startDatum}T00:00:00`,
      );

    const eindDatum =
      new Date(
        `${body.eindDatum}T23:59:59.999`,
      );

    if (
      eindDatum <
      startDatum
    ) {
      throw new Error(
        "De einddatum kan niet vóór de startdatum liggen.",
      );
    }

    const beginMinuten =
      Number(
        body.begintijd.slice(
          0,
          2,
        ),
      ) *
        60 +
      Number(
        body.begintijd.slice(
          3,
          5,
        ),
      );

    const eindMinuten =
      Number(
        body.eindtijd.slice(
          0,
          2,
        ),
      ) *
        60 +
      Number(
        body.eindtijd.slice(
          3,
          5,
        ),
      );

    if (
      eindMinuten <=
      beginMinuten
    ) {
      throw new Error(
        "De eindtijd moet na de begintijd liggen.",
      );
    }

    const [
      vestiging,
      tagRelatie,
    ] = await Promise.all([
      prisma.medewerkerVestiging.findFirst({
        where: {
          medewerkerId: id,
          vestigingId,
        },

        select: {
          vestigingId: true,
          vestiging: {
            select: {
              actief: true,
            },
          },
        },
      }),

      prisma.medewerkerTag.findFirst({
        where: {
          medewerkerId: id,
          tagId,
          tag: {
            actief: true,
          },
        },

        select: {
          tagId: true,
        },
      }),
    ]);

    if (
      !vestiging ||
      !vestiging.vestiging.actief
    ) {
      throw new Error(
        "De gekozen vestiging is niet actief of niet gekoppeld aan deze medewerker.",
      );
    }

    if (!tagRelatie) {
      throw new Error(
        "De gekozen planningstag is niet actief of niet gekoppeld aan deze medewerker.",
      );
    }

    const afspraakId =
      randomUUID();

    const akkoordDoorId =
      toegang.gebruiker.id;

    await prisma.$executeRawUnsafe(
      `INSERT INTO "VasteUrenAfspraak"
        ("id", "medewerkerId", "vestigingId", "tagId", "dagVanWeek", "begintijd", "eindtijd", "startDatum", "eindDatum", "actief", "akkoordDoorId", "akkoordOp", "aangemaaktOp", "gewijzigdOp")
       VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      afspraakId,
      id,
      vestigingId,
      tagId,
      weekdag,
      body.begintijd,
      body.eindtijd,
      startDatum,
      eindDatum,
      akkoordDoorId,
    );

    let aangemaakt = 0;
    let overgeslagen = 0;

    const cursor =
      beginDag(startDatum);

    while (
      cursor <=
      eindDatum
    ) {
      if (
        dagVanWeek(cursor) ===
        weekdag
      ) {
        const iso =
          isoWeek(cursor);

        const week =
          await prisma.week.findFirst({
            where: {
              vestigingId,
              jaar: iso.jaar,
              weeknummer:
                iso.weeknummer,
            },

            select: {
              id: true,
            },
          });

        if (!week) {
          overgeslagen += 1;
        } else {
          const begintijd =
            maakTijd(
              cursor,
              body.begintijd,
            );

          const eindtijd =
            maakTijd(
              cursor,
              body.eindtijd,
            );

          const bestaandeBezetting =
            await prisma.dienstBezetting.findFirst({
              where: {
                medewerkerId: id,
                status: {
                  not: "AFGEZEGD",
                },

                dienst: {
                  datum: {
                    gte:
                      beginDag(
                        cursor,
                      ),

                    lte:
                      eindeDag(
                        cursor,
                      ),
                  },
                },
              },

              include: {
                dienst: {
                  select: {
                    begintijd: true,
                    eindtijd: true,
                  },
                },
              },
            });

          const heeftOverlap =
            bestaandeBezetting !== null &&
            bestaandeBezetting.dienst
              .begintijd <
              eindtijd &&
            bestaandeBezetting.dienst
              .eindtijd >
              begintijd;

          if (heeftOverlap) {
            overgeslagen += 1;
          } else {
            await prisma.dienst.create({
              data: {
                weekId:
                  week.id,

                datum:
                  beginDag(
                    cursor,
                  ),

                begintijd,

                eindtijd,

                opmerkingen:
                  "Automatisch ingevuld vanuit een vaste urenafspraak.",

                tags: {
                  create: {
                    tagId,
                    aantal: 1,
                  },
                },

                bezetting: {
                  create: {
                    medewerkerId: id,
                    status:
                      "GEPLAND",
                  },
                },
              },
            });

            aangemaakt += 1;
          }
        }
      }

      cursor.setDate(
        cursor.getDate() +
          1,
      );
    }

    return NextResponse.json({
      id: afspraakId,
      aangemaakt,
      overgeslagen,
      melding:
        "De vaste urenafspraak is akkoord opgeslagen en in de bestaande planning verwerkt.",
    });
  } catch (error) {
    console.error(
      "Afspraken opslaan mislukt:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "De afspraak kon niet worden opgeslagen.",
      },
      {
        status: 400,
      },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const {
      id,
    } = await params;

    const toegang =
      await vereisEigenaarVoorMedewerker(
        id,
      );

    if (
      !toegang ||
      !toegang.medewerker
    ) {
      return NextResponse.json(
        {
          error:
            "Medewerker niet gevonden.",
        },
        {
          status: 404,
        },
      );
    }

    if (!toegang.toegestaan) {
      return NextResponse.json(
        {
          error:
            "Alleen de eigenaar kan afspraken verwijderen.",
        },
        {
          status: 403,
        },
      );
    }

    const {
      searchParams,
    } = new URL(
      request.url,
    );

    const type =
      searchParams.get(
        "type",
      );

    const itemId =
      searchParams.get(
        "id",
      );

    if (
      !itemId ||
      (type !== "dossier" &&
        type !== "vaste-uren")
    ) {
      throw new Error(
        "Ongeldige verwijderopdracht.",
      );
    }

    if (type === "dossier") {
      await prisma.$executeRawUnsafe(
        `DELETE FROM "MedewerkerDossierItem"
         WHERE "id" = $1
           AND "medewerkerId" = $2`,
        itemId,
        id,
      );
    } else {
      await prisma.$executeRawUnsafe(
        `DELETE FROM "VasteUrenAfspraak"
         WHERE "id" = $1
           AND "medewerkerId" = $2`,
        itemId,
        id,
      );
    }

    return NextResponse.json({
      melding:
        "De afspraak is verwijderd.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Verwijderen is mislukt.",
      },
      {
        status: 400,
      },
    );
  }
}
