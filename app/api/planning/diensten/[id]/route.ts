import { NextResponse } from "next/server";

import {
  getCurrentUser,
  hasPermissionForVestiging,
  isEigenaar,
} from "@/lib/auth";
import { permissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type PlanningTagInput = {
  tagId: string;
  aantal: number;
};

/*
 * ============================================================
 * TIJDINSTELLINGEN
 * ============================================================
 *
 * Diensten kunnen worden gepland:
 *
 * - vanaf 09:00
 * - tot maximaal 23:00
 * - uitsluitend per 30 minuten
 *
 * Geldige voorbeelden:
 *
 * 09:00
 * 09:30
 * 10:00
 * 10:30
 * ...
 * 22:30
 * 23:00
 */

const START_MINUTEN = 9 * 60;
const EINDE_MINUTEN = 23 * 60;
const TIJD_INTERVAL = 30;

/*
 * ============================================================
 * ORGANISATIE OPHALEN
 * ============================================================
 */

async function haalOrganisatieIdOp(
  vestigingId: string,
): Promise<string> {
  const vestiging =
    await prisma.vestiging.findUnique({
      where: {
        id: vestigingId,
      },
      select: {
        organisatieId: true,
      },
    });

  if (!vestiging) {
    throw new Error(
      "Vestiging niet gevonden.",
    );
  }

  return vestiging.organisatieId;
}

/*
 * ============================================================
 * DIENST OPHALEN
 * ============================================================
 */

async function haalDienstOp(id: string) {
  return prisma.dienst.findUnique({
    where: {
      id,
    },
    select: {
      id: true,

      week: {
        select: {
          id: true,
          vestigingId: true,
        },
      },
    },
  });
}

/*
 * ============================================================
 * VOLLEDIGE DIENST OPHALEN
 * ============================================================
 */

async function haalDienstVolledigOp(
  id: string,
) {
  return prisma.dienst.findUnique({
    where: {
      id,
    },

    include: {
      week: {
        select: {
          id: true,
          vestigingId: true,

          vestiging: {
            select: {
              id: true,
              naam: true,
            },
          },
        },
      },

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
}

/*
 * ============================================================
 * TAGS VERWERKEN
 * ============================================================
 */

function verwerkTags(
  tags: unknown,
): PlanningTagInput[] {
  if (!Array.isArray(tags)) {
    return [];
  }

  const uniekeTags = new Map<
    string,
    PlanningTagInput
  >();

  for (const tag of tags) {
    /*
     * Ondersteuning voor alleen een tag-ID.
     */

    if (typeof tag === "string") {
      uniekeTags.set(tag, {
        tagId: tag,
        aantal: 1,
      });

      continue;
    }

    /*
     * Ondersteuning voor:
     *
     * {
     *   tagId: "...",
     *   aantal: 2
     * }
     */

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

      uniekeTags.set(tag.tagId, {
        tagId: tag.tagId,
        aantal,
      });
    }
  }

  return Array.from(
    uniekeTags.values(),
  );
}

/*
 * ============================================================
 * DATUM VERWERKEN
 * ============================================================
 */

function datumUitWaarde(
  waarde: unknown,
): Date | null {
  if (typeof waarde !== "string") {
    return null;
  }

  /*
   * HTML date input:
   *
   * YYYY-MM-DD
   *
   * Wordt bewust lokaal opgebouwd zodat
   * timezoneverschuivingen worden voorkomen.
   */

  const datumMatch =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      waarde,
    );

  if (datumMatch) {
    const jaar = Number(datumMatch[1]);
    const maand = Number(datumMatch[2]);
    const dag = Number(datumMatch[3]);

    const datum = new Date(
      jaar,
      maand - 1,
      dag,
      0,
      0,
      0,
      0,
    );

    /*
     * Controleer of de datum daadwerkelijk bestaat.
     */

    if (
      datum.getFullYear() !== jaar ||
      datum.getMonth() !== maand - 1 ||
      datum.getDate() !== dag
    ) {
      return null;
    }

    return datum;
  }

  const datum = new Date(waarde);

  if (Number.isNaN(datum.getTime())) {
    return null;
  }

  return datum;
}

/*
 * ============================================================
 * TIJD VERWERKEN
 * ============================================================
 *
 * Ondersteunt:
 *
 * 09:00
 * 09:30
 * 10:00
 *
 * en eventueel bestaande ISO-datums.
 */

function tijdUitWaarde(
  waarde: unknown,
): Date | null {
  if (typeof waarde !== "string") {
    return null;
  }

  const tijdMatch =
    /^(\d{1,2}):(\d{2})$/.exec(
      waarde,
    );

  if (tijdMatch) {
    const uren = Number(tijdMatch[1]);
    const minuten = Number(tijdMatch[2]);

    if (
      Number.isNaN(uren) ||
      Number.isNaN(minuten) ||
      uren < 0 ||
      uren > 23 ||
      minuten < 0 ||
      minuten > 59
    ) {
      return null;
    }

    return new Date(
      2000,
      0,
      1,
      uren,
      minuten,
      0,
      0,
    );
  }

  const datum = new Date(waarde);

  if (Number.isNaN(datum.getTime())) {
    return null;
  }

  return datum;
}

/*
 * ============================================================
 * TIJD NAAR MINUTEN
 * ============================================================
 */

function tijdNaarMinuten(
  datum: Date,
): number {
  return (
    datum.getHours() * 60 +
    datum.getMinutes()
  );
}

/*
 * ============================================================
 * CONTROLEREN OP 30 MINUTEN
 * ============================================================
 *
 * Geldig:
 *
 * XX:00
 * XX:30
 *
 * Ongeldig:
 *
 * XX:15
 * XX:45
 */

function isGeldigTijdsinterval(
  datum: Date,
): boolean {
  return (
    datum.getMinutes() %
      TIJD_INTERVAL ===
    0
  );
}

/*
 * ============================================================
 * DATUM EN TIJD COMBINEREN
 * ============================================================
 */

function maakDatumMetTijd(
  datum: Date,
  tijd: Date,
): Date {
  return new Date(
    datum.getFullYear(),
    datum.getMonth(),
    datum.getDate(),
    tijd.getHours(),
    tijd.getMinutes(),
    0,
    0,
  );
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
    const gebruiker =
      await getCurrentUser();

    if (!gebruiker) {
      return NextResponse.json(
        {
          fout:
            "Je moet ingelogd zijn.",
        },
        {
          status: 401,
        },
      );
    }

    const { id } =
      await context.params;

    if (!id) {
      return NextResponse.json(
        {
          fout:
            "Dienst-ID ontbreekt.",
        },
        {
          status: 400,
        },
      );
    }

    const dienst =
      await haalDienstOp(id);

    if (!dienst) {
      return NextResponse.json(
        {
          fout:
            "Dienst niet gevonden.",
        },
        {
          status: 404,
        },
      );
    }

    const toegang =
      await hasPermissionForVestiging(
        permissions.planning.view,
        dienst.week.vestigingId,
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

    const volledigeDienst =
      await haalDienstVolledigOp(id);

    if (!volledigeDienst) {
      return NextResponse.json(
        {
          fout:
            "Dienst niet gevonden.",
        },
        {
          status: 404,
        },
      );
    }

    return NextResponse.json(
      volledigeDienst,
    );
  } catch (error) {
    console.error(
      "Fout bij ophalen dienst:",
      error,
    );

    return NextResponse.json(
      {
        fout:
          "De dienst kon niet worden opgehaald.",
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
 *
 * Alleen de Eigenaar mag een dienst wijzigen.
 */

export async function PATCH(
  request: Request,
  context: RouteContext,
) {
  try {
    const gebruiker =
      await getCurrentUser();

    if (!gebruiker) {
      return NextResponse.json(
        {
          fout:
            "Je moet ingelogd zijn.",
        },
        {
          status: 401,
        },
      );
    }

    const { id } =
      await context.params;

    if (!id) {
      return NextResponse.json(
        {
          fout:
            "Dienst-ID ontbreekt.",
        },
        {
          status: 400,
        },
      );
    }

    const bestaandeDienst =
      await prisma.dienst.findUnique({
        where: {
          id,
        },

        select: {
          id: true,
          datum: true,
          begintijd: true,
          eindtijd: true,

          week: {
            select: {
              vestigingId: true,
            },
          },
        },
      });

    if (!bestaandeDienst) {
      return NextResponse.json(
        {
          fout:
            "Dienst niet gevonden.",
        },
        {
          status: 404,
        },
      );
    }

    /*
     * ============================================================
     * RECHTEN
     * ============================================================
     *
     * Alleen de Eigenaar mag wijzigen.
     *
     * Teamleider:
     * - bekijken
     * - niet wijzigen
     *
     * Medewerker:
     * - relevante informatie bekijken
     * - niet wijzigen
     */

    const organisatieId =
      await haalOrganisatieIdOp(
        bestaandeDienst.week.vestigingId,
      );

    const eigenaar =
      await isEigenaar(
        organisatieId,
      );

    if (!eigenaar) {
      return NextResponse.json(
        {
          fout:
            "Alleen de eigenaar kan deze dienst wijzigen.",
        },
        {
          status: 403,
        },
      );
    }

    const toegang =
      await hasPermissionForVestiging(
        permissions.planning.update,
        bestaandeDienst.week.vestigingId,
      );

    if (!toegang) {
      return NextResponse.json(
        {
          fout:
            "Je hebt geen rechten om deze dienst te wijzigen.",
        },
        {
          status: 403,
        },
      );
    }

    /*
     * ============================================================
     * BODY
     * ============================================================
     */

    const body: unknown =
      await request.json();

    if (
      !body ||
      typeof body !== "object"
    ) {
      return NextResponse.json(
        {
          fout:
            "Ongeldige aanvraag.",
        },
        {
          status: 400,
        },
      );
    }

    const invoer =
      body as Record<string, unknown>;

    /*
     * ============================================================
     * DATUM
     * ============================================================
     */

    let nieuweDatum =
      bestaandeDienst.datum;

    if (
      invoer.datum !== undefined
    ) {
      const datum =
        datumUitWaarde(
          invoer.datum,
        );

      if (!datum) {
        return NextResponse.json(
          {
            fout:
              "Datum moet geldig zijn.",
          },
          {
            status: 400,
          },
        );
      }

      nieuweDatum = datum;
    }

    /*
     * ============================================================
     * BEGIN- EN EINDTIJD
     * ============================================================
     */

    let nieuweBegintijd =
      maakDatumMetTijd(
        nieuweDatum,
        bestaandeDienst.begintijd,
      );

    let nieuweEindtijd =
      maakDatumMetTijd(
        nieuweDatum,
        bestaandeDienst.eindtijd,
      );

    /*
     * BEGINTIJD
     */

    if (
      invoer.begintijd !== undefined
    ) {
      const begintijd =
        tijdUitWaarde(
          invoer.begintijd,
        );

      if (!begintijd) {
        return NextResponse.json(
          {
            fout:
              "Begintijd moet geldig zijn.",
          },
          {
            status: 400,
          },
        );
      }

      nieuweBegintijd =
        maakDatumMetTijd(
          nieuweDatum,
          begintijd,
        );
    }

    /*
     * EINDTIJD
     */

    if (
      invoer.eindtijd !== undefined
    ) {
      const eindtijd =
        tijdUitWaarde(
          invoer.eindtijd,
        );

      if (!eindtijd) {
        return NextResponse.json(
          {
            fout:
              "Eindtijd moet geldig zijn.",
          },
          {
            status: 400,
          },
        );
      }

      nieuweEindtijd =
        maakDatumMetTijd(
          nieuweDatum,
          eindtijd,
        );
    }

    /*
     * ============================================================
     * TIJDVALIDATIE
     * ============================================================
     */

    const beginMinuten =
      tijdNaarMinuten(
        nieuweBegintijd,
      );

    const eindeMinuten =
      tijdNaarMinuten(
        nieuweEindtijd,
      );

    /*
     * Eindtijd moet na begintijd liggen.
     */

    if (
      eindeMinuten <= beginMinuten
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

    /*
     * Alleen 30-minutenintervallen.
     */

    if (
      !isGeldigTijdsinterval(
        nieuweBegintijd,
      ) ||
      !isGeldigTijdsinterval(
        nieuweEindtijd,
      )
    ) {
      return NextResponse.json(
        {
          fout:
            "Diensten kunnen alleen per 30 minuten worden gepland.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * Niet vóór 09:00.
     */

    if (
      beginMinuten < START_MINUTEN
    ) {
      return NextResponse.json(
        {
          fout:
            "Een dienst kan niet vóór 09:00 starten.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * Niet na 23:00.
     */

    if (
      eindeMinuten > EINDE_MINUTEN
    ) {
      return NextResponse.json(
        {
          fout:
            "Een dienst kan niet na 23:00 eindigen.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * ============================================================
     * OPMERKINGEN
     * ============================================================
     */

    let opmerkingen:
      | string
      | null
      | undefined;

    if (
      invoer.opmerkingen !== undefined
    ) {
      opmerkingen =
        typeof invoer.opmerkingen ===
          "string" &&
        invoer.opmerkingen.trim()
          .length > 0
          ? invoer.opmerkingen.trim()
          : null;
    }

    /*
     * ============================================================
     * TAGS
     * ============================================================
     */

    let geldigeTags:
      | PlanningTagInput[]
      | undefined;

    if (
      invoer.tags !== undefined
    ) {
      const tags =
        verwerkTags(
          invoer.tags,
        );

      if (tags.length === 0) {
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

      const tagIds =
        tags.map(
          (tag) => tag.tagId,
        );

      const bestaandeTags =
        await prisma.tag.findMany({
          where: {
            id: {
              in: tagIds,
            },

            actief: true,
          },

          select: {
            id: true,
          },
        });

      const bestaandeTagIds =
        new Set(
          bestaandeTags.map(
            (tag) => tag.id,
          ),
        );

      geldigeTags =
        tags.filter(
          (tag) =>
            bestaandeTagIds.has(
              tag.tagId,
            ),
        );

      if (
        geldigeTags.length !==
        tags.length
      ) {
        return NextResponse.json(
          {
            fout:
              "Eén of meerdere planningtags bestaan niet of zijn niet actief.",
          },
          {
            status: 400,
          },
        );
      }
    }

    /*
     * ============================================================
     * OPSLAAN
     * ============================================================
     */

    await prisma.$transaction(
      async (tx) => {
        await tx.dienst.update({
          where: {
            id,
          },

          data: {
            datum: nieuweDatum,
            begintijd:
              nieuweBegintijd,
            eindtijd:
              nieuweEindtijd,

            ...(opmerkingen !==
            undefined
              ? {
                  opmerkingen,
                }
              : {}),
          },
        });

        /*
         * Tags volledig vervangen wanneer
         * nieuwe tags zijn meegestuurd.
         */

        if (
          geldigeTags !== undefined
        ) {
          await tx.dienstTag.deleteMany({
            where: {
              dienstId: id,
            },
          });

          await tx.dienstTag.createMany({
            data: geldigeTags.map(
              (tag) => ({
                dienstId: id,
                tagId: tag.tagId,
                aantal: tag.aantal,
              }),
            ),
          });
        }
      },
    );

    const dienst =
      await haalDienstVolledigOp(id);

    return NextResponse.json(
      dienst,
    );
  } catch (error) {
    console.error(
      "Fout bij wijzigen dienst:",
      error,
    );

    return NextResponse.json(
      {
        fout:
          "De dienst kon niet worden gewijzigd.",
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
 *
 * Alleen de Eigenaar mag een dienst verwijderen.
 */

export async function DELETE(
  _request: Request,
  context: RouteContext,
) {
  try {
    const gebruiker =
      await getCurrentUser();

    if (!gebruiker) {
      return NextResponse.json(
        {
          fout:
            "Je moet ingelogd zijn.",
        },
        {
          status: 401,
        },
      );
    }

    const { id } =
      await context.params;

    if (!id) {
      return NextResponse.json(
        {
          fout:
            "Dienst-ID ontbreekt.",
        },
        {
          status: 400,
        },
      );
    }

    const dienst =
      await haalDienstOp(id);

    if (!dienst) {
      return NextResponse.json(
        {
          fout:
            "Dienst niet gevonden.",
        },
        {
          status: 404,
        },
      );
    }

    /*
     * ============================================================
     * RECHTEN
     * ============================================================
     */

    const organisatieId =
      await haalOrganisatieIdOp(
        dienst.week.vestigingId,
      );

    const eigenaar =
      await isEigenaar(
        organisatieId,
      );

    if (!eigenaar) {
      return NextResponse.json(
        {
          fout:
            "Alleen de eigenaar kan deze dienst verwijderen.",
        },
        {
          status: 403,
        },
      );
    }

    const toegang =
      await hasPermissionForVestiging(
        permissions.planning.delete,
        dienst.week.vestigingId,
      );

    if (!toegang) {
      return NextResponse.json(
        {
          fout:
            "Je hebt geen rechten om deze dienst te verwijderen.",
        },
        {
          status: 403,
        },
      );
    }

    /*
     * ============================================================
     * DIENST VERWIJDEREN
     * ============================================================
     */

    await prisma.dienst.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({
      succes: true,
    });
  } catch (error) {
    console.error(
      "Fout bij verwijderen dienst:",
      error,
    );

    return NextResponse.json(
      {
        fout:
          "De dienst kon niet worden verwijderd.",
      },
      {
        status: 500,
      },
    );
  }
}