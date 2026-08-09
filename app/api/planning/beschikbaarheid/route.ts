import { NextResponse } from "next/server";

import { hasPermissionForVestiging } from "@/lib/auth";
import { permissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const TOEGESTANE_STATUSSEN = [
  "BESCHIKBAAR",
  "NIET_BESCHIKBAAR",
  "VOORKEUR",
] as const;

type BeschikbaarheidStatus =
  (typeof TOEGESTANE_STATUSSEN)[number];

async function haalWeekOp(
  weekId: string,
) {
  return prisma.week.findUnique({
    where: {
      id: weekId,
    },
    select: {
      id: true,
      vestigingId: true,
      beschikbaarheidDeadline: true,
    },
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } =
      new URL(request.url);

    const weekId =
      searchParams.get("weekId");

    const medewerkerId =
      searchParams.get(
        "medewerkerId",
      );

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
      await haalWeekOp(weekId);

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

    const beschikbaarheden =
      await prisma.beschikbaarheid.findMany(
        {
          where: {
            weekId,
            ...(medewerkerId
              ? {
                  medewerkerId,
                }
              : {}),
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
      beschikbaarheden,
    );
  } catch (error) {
    console.error(
      "Fout bij ophalen beschikbaarheden:",
      error,
    );

    return NextResponse.json(
      {
        fout:
          "De beschikbaarheden konden niet worden opgehaald.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      weekId,
      medewerkerId,
      datum,
      begintijd,
      eindtijd,
      status,
      opmerking,
    } = body;

    if (
      !weekId ||
      !medewerkerId ||
      !datum ||
      !begintijd ||
      !eindtijd
    ) {
      return NextResponse.json(
        {
          fout:
            "weekId, medewerkerId, datum, begintijd en eindtijd zijn verplicht.",
        },
        { status: 400 },
      );
    }

    const week =
      await haalWeekOp(weekId);

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
        permissions.planning.update,
        week.vestigingId,
      );

    if (!toegang) {
      return NextResponse.json(
        {
          fout:
            "Je hebt geen rechten om beschikbaarheid te wijzigen.",
        },
        { status: 403 },
      );
    }

    const medewerker =
      await prisma.medewerker.findUnique(
        {
          where: {
            id: medewerkerId,
          },
          select: {
            id: true,
            actief: true,
            vestigingen: {
              where: {
                vestigingId:
                  week.vestigingId,
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
            "Een inactieve medewerker kan geen beschikbaarheid opgeven.",
        },
        { status: 400 },
      );
    }

    if (
      medewerker.vestigingen.length ===
      0
    ) {
      return NextResponse.json(
        {
          fout:
            "Deze medewerker hoort niet bij deze vestiging.",
        },
        { status: 400 },
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
      ) ||
      Number.isNaN(
        begintijdWaarde.getTime(),
      ) ||
      Number.isNaN(
        eindtijdWaarde.getTime(),
      )
    ) {
      return NextResponse.json(
        {
          fout:
            "Datum en tijden moeten geldig zijn.",
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
      status !== undefined &&
      (
        typeof status !== "string" ||
        !TOEGESTANE_STATUSSEN.includes(
          status as BeschikbaarheidStatus,
        )
      )
    ) {
      return NextResponse.json(
        {
          fout:
            "Ongeldige beschikbaarheidsstatus.",
        },
        { status: 400 },
      );
    }

    const beschikbaarheid =
      await prisma.beschikbaarheid.create(
        {
          data: {
            weekId,
            medewerkerId,
            datum: datumWaarde,
            begintijd:
              begintijdWaarde,
            eindtijd:
              eindtijdWaarde,
            status:
              (status as BeschikbaarheidStatus) ??
              "BESCHIKBAAR",
            opmerking:
              typeof opmerking ===
                "string" &&
              opmerking.trim()
                .length > 0
                ? opmerking.trim()
                : null,
          },
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
      beschikbaarheid,
      { status: 201 },
    );
  } catch (error) {
    console.error(
      "Fout bij aanmaken beschikbaarheid:",
      error,
    );

    return NextResponse.json(
      {
        fout:
          "De beschikbaarheid kon niet worden aangemaakt.",
      },
      { status: 500 },
    );
  }
}