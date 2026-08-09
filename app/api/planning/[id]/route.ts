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

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

async function haalWeekOp(id: string) {
  return prisma.week.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      vestigingId: true,
    },
  });
}

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  try {
    const { id } = await context.params;

    const week = await prisma.week.findUnique({
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
        },
      },
    });

    if (!week) {
      return NextResponse.json(
        {
          fout: "Planningweek niet gevonden.",
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

    return NextResponse.json(week);
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

    const bestaandeWeek = await haalWeekOp(id);

    if (!bestaandeWeek) {
      return NextResponse.json(
        {
          fout: "Planningweek niet gevonden.",
        },
        { status: 404 },
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
            "Je hebt geen rechten om deze planning te wijzigen.",
        },
        { status: 403 },
      );
    }

    const data: {
      status?: PlanningStatus;
      beschikbaarheidDeadline?: Date | null;
    } = {};

    if (body.status !== undefined) {
      if (
        typeof body.status !== "string" ||
        !TOEGESTANE_STATUSSEN.includes(
          body.status as PlanningStatus,
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

      data.status =
        body.status as PlanningStatus;
    }

    if (
      body.beschikbaarheidDeadline !==
      undefined
    ) {
      if (
        body.beschikbaarheidDeadline === null
      ) {
        data.beschikbaarheidDeadline = null;
      } else {
        const deadline = new Date(
          body.beschikbaarheidDeadline,
        );

        if (Number.isNaN(deadline.getTime())) {
          return NextResponse.json(
            {
              fout:
                "Ongeldige beschikbaarheidsdeadline.",
            },
            { status: 400 },
          );
        }

        data.beschikbaarheidDeadline =
          deadline;
      }
    }

    const week = await prisma.week.update({
      where: {
        id,
      },
      data,
    });

    return NextResponse.json(week);
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

    const bestaandeWeek = await haalWeekOp(id);

    if (!bestaandeWeek) {
      return NextResponse.json(
        {
          fout: "Planningweek niet gevonden.",
        },
        { status: 404 },
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
            "Je hebt geen rechten om deze planning te verwijderen.",
        },
        { status: 403 },
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
      { status: 500 },
    );
  }
}