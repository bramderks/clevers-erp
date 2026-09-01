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

const START_MINUTEN = 9 * 60;
const EINDE_MINUTEN = 23 * 60;

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
    if (typeof tag === "string") {
      uniekeTags.set(tag, {
        tagId: tag,
        aantal: 1,
      });

      continue;
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

function datumUitWaarde(
  waarde: unknown,
): Date | null {
  if (typeof waarde !== "string") {
    return null;
  }

  const datum = new Date(waarde);

  if (Number.isNaN(datum.getTime())) {
    return null;
  }

  return datum;
}

function tijdNaarMinuten(
  datum: Date,
): number {
  return (
    datum.getHours() * 60 +
    datum.getMinutes()
  );
}

function isGeldigeKwartierTijd(
  datum: Date,
): boolean {
  return datum.getMinutes() % 15 === 0;
}

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
     * Alleen de Eigenaar mag diensten wijzigen.
     *
     * Teamleider:
     * - volledige inzage
     * - geen wijzigingen
     *
     * Medewerker:
     * - relevante inzage
     * - geen wijzigingen
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
     * TIJDEN
     * ============================================================
     */

    let nieuweBegintijd =
      bestaandeDienst.begintijd;

    let nieuweEindtijd =
      bestaandeDienst.eindtijd;

    if (
      invoer.begintijd !== undefined
    ) {
      const begintijd =
        datumUitWaarde(
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
    } else {
      nieuweBegintijd =
        maakDatumMetTijd(
          nieuweDatum,
          bestaandeDienst.begintijd,
        );
    }

    if (
      invoer.eindtijd !== undefined
    ) {
      const eindtijd =
        datumUitWaarde(
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
    } else {
      nieuweEindtijd =
        maakDatumMetTijd(
          nieuweDatum,
          bestaandeDienst.eindtijd,
        );
    }

    const beginMinuten =
      tijdNaarMinuten(
        nieuweBegintijd,
      );

    const eindeMinuten =
      tijdNaarMinuten(
        nieuweEindtijd,
      );

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

    if (
      !isGeldigeKwartierTijd(
        nieuweBegintijd,
      ) ||
      !isGeldigeKwartierTijd(
        nieuweEindtijd,
      )
    ) {
      return NextResponse.json(
        {
          fout:
            "Diensten kunnen alleen per 15 minuten worden gepland.",
        },
        {
          status: 400,
        },
      );
    }

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

        if (
          geldigeTags !== undefined
        ) {
          await tx.dienstTag.deleteMany(
            {
              where: {
                dienstId: id,
              },
            },
          );

          await tx.dienstTag.createMany(
            {
              data: geldigeTags.map(
                (tag) => ({
                  dienstId: id,
                  tagId: tag.tagId,
                  aantal: tag.aantal,
                }),
              ),
            },
          );
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
     *
     * Alleen de Eigenaar mag een dienst verwijderen.
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