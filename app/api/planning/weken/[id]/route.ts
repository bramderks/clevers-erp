import { NextResponse } from "next/server";

import { hasPermissionForVestiging, isEigenaar } from "@/lib/auth";
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
      jaar: true,
      weeknummer: true,
      status: true,
      beschikbaarheidDeadline: true,
      vestiging: { select: { organisatieId: true } },
    },
  });
}

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  try {
    const { id } = await context.params;

    const week = await haalWeekOp(id);

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

    const bestaandeWeek =
      await haalWeekOp(id);

    if (!bestaandeWeek) {
      return NextResponse.json(
        {
          fout: "Planningweek niet gevonden.",
        },
        { status: 404 },
      );
    }

    const eigenaar = await isEigenaar(bestaandeWeek.vestiging.organisatieId);

    if (!eigenaar) {
      return NextResponse.json({ fout: "Alleen de eigenaar kan deze planningweek wijzigen." }, { status: 403 });
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
        { status: 403 },
      );
    }

    const data: {
      jaar?: number;
      weeknummer?: number;
      status?: PlanningStatus;
      beschikbaarheidDeadline?: Date | null;
    } = {};

    if (body.jaar !== undefined) {
      if (
        !Number.isInteger(body.jaar) ||
        body.jaar < 2020 ||
        body.jaar > 2100
      ) {
        return NextResponse.json(
          {
            fout: "Jaar is ongeldig.",
          },
          { status: 400 },
        );
      }

      data.jaar = body.jaar;
    }

    if (body.weeknummer !== undefined) {
      if (
        !Number.isInteger(body.weeknummer) ||
        body.weeknummer < 1 ||
        body.weeknummer > 53
      ) {
        return NextResponse.json(
          {
            fout:
              "Weeknummer moet tussen 1 en 53 liggen.",
          },
          { status: 400 },
        );
      }

      data.weeknummer =
        body.weeknummer;
    }

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

        if (
          Number.isNaN(deadline.getTime())
        ) {
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

    if (
      Object.keys(data).length === 0
    ) {
      return NextResponse.json(
        {
          fout:
            "Er zijn geen wijzigingen opgegeven.",
        },
        { status: 400 },
      );
    }

    const jaar =
      data.jaar ?? bestaandeWeek.jaar;

    const weeknummer =
      data.weeknummer ??
      bestaandeWeek.weeknummer;

    const dubbeleWeek =
      await prisma.week.findFirst({
        where: {
          vestigingId:
            bestaandeWeek.vestigingId,
          jaar,
          weeknummer,
          id: {
            not: id,
          },
        },
        select: {
          id: true,
        },
      });

    if (dubbeleWeek) {
      return NextResponse.json(
        {
          fout:
            "Deze planningweek bestaat al voor deze vestiging.",
        },
        { status: 409 },
      );
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

    const week = await haalWeekOp(id);

    if (!week) {
      return NextResponse.json(
        {
          fout: "Planningweek niet gevonden.",
        },
        { status: 404 },
      );
    }

    const eigenaar = await isEigenaar(week.vestiging.organisatieId);

    if (!eigenaar) {
      return NextResponse.json({ fout: "Alleen de eigenaar kan deze planningweek verwijderen." }, { status: 403 });
    }

    const toegang =
      await hasPermissionForVestiging(
        permissions.planning.delete,
        week.vestigingId,
      );

    if (!toegang) {
      return NextResponse.json(
        {
          fout:
            "Je hebt geen rechten om deze planningweek te verwijderen.",
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