import { NextResponse } from "next/server";

import { hasPermissionForVestiging } from "@/lib/auth";
import { permissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

async function haalDienstOp(id: string) {
  return prisma.dienst.findUnique({
    where: {
      id,
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

async function haalDienstVolledigOp(id: string) {
  return prisma.dienst.findUnique({
    where: {
      id,
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
        .map((tag) => [tag.tagId, tag]),
    ).values(),
  );
}

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  try {
    const { id } = await context.params;

    const dienst = await haalDienstOp(id);

    if (!dienst) {
      return NextResponse.json(
        { fout: "Dienst niet gevonden." },
        { status: 404 },
      );
    }

    const toegang = await hasPermissionForVestiging(
      permissions.planning.view,
      dienst.week.vestigingId,
    );

    if (!toegang) {
      return NextResponse.json(
        {
          fout: "Geen toegang tot deze planning.",
        },
        { status: 403 },
      );
    }

    const volledigeDienst =
      await haalDienstVolledigOp(id);

    return NextResponse.json(volledigeDienst);
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
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext,
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const bestaandeDienst = await haalDienstOp(id);

    if (!bestaandeDienst) {
      return NextResponse.json(
        { fout: "Dienst niet gevonden." },
        { status: 404 },
      );
    }

    const toegang = await hasPermissionForVestiging(
      permissions.planning.update,
      bestaandeDienst.week.vestigingId,
    );

    if (!toegang) {
      return NextResponse.json(
        {
          fout:
            "Je hebt geen rechten om deze dienst te wijzigen.",
        },
        { status: 403 },
      );
    }

    const huidigeDienst =
      await prisma.dienst.findUnique({
        where: {
          id,
        },
        select: {
          datum: true,
          begintijd: true,
          eindtijd: true,
        },
      });

    if (!huidigeDienst) {
      return NextResponse.json(
        { fout: "Dienst niet gevonden." },
        { status: 404 },
      );
    }

    const data: {
      datum?: Date;
      begintijd?: Date;
      eindtijd?: Date;
      opmerkingen?: string | null;
    } = {};

    if (body.datum !== undefined) {
      const datum = new Date(body.datum);

      if (Number.isNaN(datum.getTime())) {
        return NextResponse.json(
          {
            fout: "Datum moet geldig zijn.",
          },
          { status: 400 },
        );
      }

      data.datum = datum;
    }

    if (body.begintijd !== undefined) {
      const begintijd = new Date(
        body.begintijd,
      );

      if (Number.isNaN(begintijd.getTime())) {
        return NextResponse.json(
          {
            fout:
              "Begintijd moet geldig zijn.",
          },
          { status: 400 },
        );
      }

      data.begintijd = begintijd;
    }

    if (body.eindtijd !== undefined) {
      const eindtijd = new Date(
        body.eindtijd,
      );

      if (Number.isNaN(eindtijd.getTime())) {
        return NextResponse.json(
          {
            fout:
              "Eindtijd moet geldig zijn.",
          },
          { status: 400 },
        );
      }

      data.eindtijd = eindtijd;
    }

    const begintijd =
      data.begintijd ??
      huidigeDienst.begintijd;

    const eindtijd =
      data.eindtijd ??
      huidigeDienst.eindtijd;

    if (eindtijd <= begintijd) {
      return NextResponse.json(
        {
          fout:
            "Eindtijd moet na de begintijd liggen.",
        },
        { status: 400 },
      );
    }

    if (body.opmerkingen !== undefined) {
      data.opmerkingen =
        typeof body.opmerkingen === "string" &&
        body.opmerkingen.trim().length > 0
          ? body.opmerkingen.trim()
          : null;
    }

    let geldigeTags:
      | {
          tagId: string;
          aantal: number;
        }[]
      | undefined;

    if (body.tags !== undefined) {
      const tags = verwerkTags(body.tags);
      const tagIds = tags.map(
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

      const bestaandeTagIds = new Set(
        bestaandeTags.map((tag) => tag.id),
      );

      geldigeTags = tags.filter((tag) =>
        bestaandeTagIds.has(tag.tagId),
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.dienst.update({
        where: {
          id,
        },
        data,
      });

      if (geldigeTags !== undefined) {
        await tx.dienstTag.deleteMany({
          where: {
            dienstId: id,
          },
        });

        if (geldigeTags.length > 0) {
          await tx.dienstTag.createMany({
            data: geldigeTags.map((tag) => ({
              dienstId: id,
              tagId: tag.tagId,
              aantal: tag.aantal,
            })),
          });
        }
      }
    });

    const dienst =
      await haalDienstVolledigOp(id);

    return NextResponse.json(dienst);
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
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext,
) {
  try {
    const { id } = await context.params;

    const dienst = await haalDienstOp(id);

    if (!dienst) {
      return NextResponse.json(
        { fout: "Dienst niet gevonden." },
        { status: 404 },
      );
    }

    const toegang = await hasPermissionForVestiging(
      permissions.planning.delete,
      dienst.week.vestigingId,
    );

    if (!toegang) {
      return NextResponse.json(
        {
          fout:
            "Je hebt geen rechten om deze dienst te verwijderen.",
        },
        { status: 403 },
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
      { status: 500 },
    );
  }
}