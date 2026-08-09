import { NextResponse } from "next/server";

import { hasPermissionForVestiging } from "@/lib/auth";
import { permissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const TOEGESTANE_STATUSSEN = [
  "OPEN",
  "GEPLAND",
  "BEVESTIGD",
  "AFGEZEGD",
  "GEWERKT",
] as const;

type BezettingStatus =
  (typeof TOEGESTANE_STATUSSEN)[number];

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

async function haalBezettingOp(
  id: string,
) {
  return prisma.dienstBezetting.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      dienstId: true,
      dienst: {
        select: {
          week: {
            select: {
              vestigingId: true,
            },
          },
        },
      },
    },
  });
}

export async function PATCH(
  request: Request,
  context: RouteContext,
) {
  try {
    const { id } =
      await context.params;

    const body = await request.json();

    const bestaandeBezetting =
      await haalBezettingOp(id);

    if (!bestaandeBezetting) {
      return NextResponse.json(
        {
          fout:
            "Bezetting niet gevonden.",
        },
        { status: 404 },
      );
    }

    const toegang =
      await hasPermissionForVestiging(
        permissions.planning.update,
        bestaandeBezetting.dienst.week
          .vestigingId,
      );

    if (!toegang) {
      return NextResponse.json(
        {
          fout:
            "Je hebt geen rechten om de bezetting te wijzigen.",
        },
        { status: 403 },
      );
    }

    const data: {
      medewerkerId?: string | null;
      status?: BezettingStatus;
    } = {};

    if (
      body.medewerkerId !== undefined
    ) {
      if (
        body.medewerkerId !== null &&
        typeof body.medewerkerId !==
          "string"
      ) {
        return NextResponse.json(
          {
            fout:
              "medewerkerId is ongeldig.",
          },
          { status: 400 },
        );
      }

      if (body.medewerkerId) {
        const medewerker =
          await prisma.medewerker.findUnique(
            {
              where: {
                id: body.medewerkerId,
              },
              select: {
                id: true,
                actief: true,
                vestigingen: {
                  where: {
                    vestigingId:
                      bestaandeBezetting
                        .dienst.week
                        .vestigingId,
                  },
                  select: {
                    id: true,
                  },
                },
              },
            },
          );

        if (!medewerker) {
          return NextResponse.json(
            {
              fout:
                "Medewerker niet gevonden.",
            },
            { status: 404 },
          );
        }

        if (!medewerker.actief) {
          return NextResponse.json(
            {
              fout:
                "Een inactieve medewerker kan niet worden ingepland.",
            },
            { status: 400 },
          );
        }

        if (
          medewerker.vestigingen
            .length === 0
        ) {
          return NextResponse.json(
            {
              fout:
                "Deze medewerker hoort niet bij deze vestiging.",
            },
            { status: 400 },
          );
        }

        const dubbeleBezetting =
          await prisma.dienstBezetting.findFirst(
            {
              where: {
                dienstId:
                  bestaandeBezetting.dienstId,
                medewerkerId:
                  body.medewerkerId,
                id: {
                  not: id,
                },
              },
              select: {
                id: true,
              },
            },
          );

        if (dubbeleBezetting) {
          return NextResponse.json(
            {
              fout:
                "Deze medewerker staat al op deze dienst.",
            },
            { status: 409 },
          );
        }
      }

      data.medewerkerId =
        body.medewerkerId;
    }

    if (body.status !== undefined) {
      if (
        typeof body.status !== "string" ||
        !TOEGESTANE_STATUSSEN.includes(
          body.status as BezettingStatus,
        )
      ) {
        return NextResponse.json(
          {
            fout:
              "Ongeldige bezettingsstatus.",
          },
          { status: 400 },
        );
      }

      data.status =
        body.status as BezettingStatus;
    }

    const bezetting =
      await prisma.dienstBezetting.update(
        {
          where: {
            id,
          },
          data,
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
      );

    return NextResponse.json(
      bezetting,
    );
  } catch (error) {
    console.error(
      "Fout bij wijzigen bezetting:",
      error,
    );

    return NextResponse.json(
      {
        fout:
          "De bezetting kon niet worden gewijzigd.",
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
    const { id } =
      await context.params;

    const bestaandeBezetting =
      await haalBezettingOp(id);

    if (!bestaandeBezetting) {
      return NextResponse.json(
        {
          fout:
            "Bezetting niet gevonden.",
        },
        { status: 404 },
      );
    }

    const toegang =
      await hasPermissionForVestiging(
        permissions.planning.update,
        bestaandeBezetting.dienst.week
          .vestigingId,
      );

    if (!toegang) {
      return NextResponse.json(
        {
          fout:
            "Je hebt geen rechten om de bezetting te verwijderen.",
        },
        { status: 403 },
      );
    }

    await prisma.dienstBezetting.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({
      succes: true,
    });
  } catch (error) {
    console.error(
      "Fout bij verwijderen bezetting:",
      error,
    );

    return NextResponse.json(
      {
        fout:
          "De bezetting kon niet worden verwijderd.",
      },
      { status: 500 },
    );
  }
}