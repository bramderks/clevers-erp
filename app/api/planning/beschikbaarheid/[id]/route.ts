import { NextResponse } from "next/server";

import {
  getCurrentUser,
  isEigenaar,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const TOEGESTANE_STATUSSEN = [
  "BESCHIKBAAR",
  "NIET_BESCHIKBAAR",
  "VOORKEUR",
] as const;

type BeschikbaarheidStatus =
  (typeof TOEGESTANE_STATUSSEN)[number];

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

async function haalBeschikbaarheidOp(
  id: string,
) {
  return prisma.beschikbaarheid.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      medewerkerId: true,
      weekId: true,
      datum: true,
      begintijd: true,
      eindtijd: true,
      week: {
        select: {
          vestigingId: true,
          beschikbaarheidDeadline: true,
        },
      },
    },
  });
}

async function controleerToegang(
  medewerkerId: string,
  vestigingId: string,
  deadline: Date | null,
) {
  const gebruiker =
    await getCurrentUser();

  if (!gebruiker) {
    return false;
  }

  const eigenaar =
    await isEigenaar();

  if (eigenaar) {
    return true;
  }

  if (
    !gebruiker.medewerker ||
    gebruiker.medewerker.id !==
      medewerkerId
  ) {
    return false;
  }

  if (
    deadline &&
    new Date() > deadline
  ) {
    return false;
  }

  return gebruiker.vestigingToegang.some(
    (toegang) =>
      toegang.vestigingId ===
        vestigingId &&
      toegang.actief &&
      toegang.vestiging.actief,
  );
}

export async function PATCH(
  request: Request,
  context: RouteContext,
) {
  try {
    const { id } =
      await context.params;

    const body = await request.json();

    const bestaande =
      await haalBeschikbaarheidOp(id);

    if (!bestaande) {
      return NextResponse.json(
        {
          fout:
            "Beschikbaarheid niet gevonden.",
        },
        { status: 404 },
      );
    }

    const eigenaar =
      await isEigenaar();

    const toegang =
      await controleerToegang(
        bestaande.medewerkerId,
        bestaande.week.vestigingId,
        bestaande.week
          .beschikbaarheidDeadline,
      );

    if (!toegang) {
      return NextResponse.json(
        {
          fout:
            "Je hebt geen rechten om deze beschikbaarheid te wijzigen.",
        },
        { status: 403 },
      );
    }

    if (
      body.medewerkerId !==
        undefined &&
      body.medewerkerId !==
        bestaande.medewerkerId
    ) {
      if (!eigenaar) {
        return NextResponse.json(
          {
            fout:
              "Alleen een eigenaar kan de medewerker van een beschikbaarheid wijzigen.",
          },
          { status: 403 },
        );
      }

      if (
        typeof body.medewerkerId !==
          "string" ||
        body.medewerkerId.length ===
          0
      ) {
        return NextResponse.json(
          {
            fout:
              "medewerkerId is ongeldig.",
          },
          { status: 400 },
        );
      }

      const nieuweMedewerker =
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
                    bestaande.week
                      .vestigingId,
                },
                select: {
                  id: true,
                },
              },
            },
          },
        );

      if (!nieuweMedewerker) {
        return NextResponse.json(
          {
            fout:
              "Medewerker niet gevonden.",
          },
          { status: 404 },
        );
      }

      if (!nieuweMedewerker.actief) {
        return NextResponse.json(
          {
            fout:
              "Een inactieve medewerker kan geen beschikbaarheid krijgen.",
          },
          { status: 400 },
        );
      }

      if (
        nieuweMedewerker
          .vestigingen.length === 0
      ) {
        return NextResponse.json(
          {
            fout:
              "Deze medewerker hoort niet bij deze vestiging.",
          },
          { status: 400 },
        );
      }
    }

    const data: {
      medewerkerId?: string;
      datum?: Date;
      begintijd?: Date;
      eindtijd?: Date;
      status?: BeschikbaarheidStatus;
      opmerking?: string | null;
    } = {};

    if (
      body.medewerkerId !==
      undefined
    ) {
      if (
        typeof body.medewerkerId !==
          "string" ||
        body.medewerkerId.length ===
          0
      ) {
        return NextResponse.json(
          {
            fout:
              "medewerkerId is ongeldig.",
          },
          { status: 400 },
        );
      }

      data.medewerkerId =
        body.medewerkerId;
    }

    if (body.datum !== undefined) {
      const datum =
        new Date(body.datum);

      if (
        Number.isNaN(
          datum.getTime(),
        )
      ) {
        return NextResponse.json(
          {
            fout:
              "Datum moet geldig zijn.",
          },
          { status: 400 },
        );
      }

      data.datum = datum;
    }

    if (
      body.begintijd !== undefined
    ) {
      const begintijd =
        new Date(
          body.begintijd,
        );

      if (
        Number.isNaN(
          begintijd.getTime(),
        )
      ) {
        return NextResponse.json(
          {
            fout:
              "Begintijd moet geldig zijn.",
          },
          { status: 400 },
        );
      }

      data.begintijd =
        begintijd;
    }

    if (
      body.eindtijd !== undefined
    ) {
      const eindtijd =
        new Date(
          body.eindtijd,
        );

      if (
        Number.isNaN(
          eindtijd.getTime(),
        )
      ) {
        return NextResponse.json(
          {
            fout:
              "Eindtijd moet geldig zijn.",
          },
          { status: 400 },
        );
      }

      data.eindtijd =
        eindtijd;
    }

    const begintijd =
      data.begintijd ??
      bestaande.begintijd;

    const eindtijd =
      data.eindtijd ??
      bestaande.eindtijd;

    if (eindtijd <= begintijd) {
      return NextResponse.json(
        {
          fout:
            "Eindtijd moet na de begintijd liggen.",
        },
        { status: 400 },
      );
    }

    if (body.status !== undefined) {
      if (
        typeof body.status !==
          "string" ||
        !TOEGESTANE_STATUSSEN.includes(
          body.status as BeschikbaarheidStatus,
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

      data.status =
        body.status as BeschikbaarheidStatus;
    }

    if (
      body.opmerking !==
      undefined
    ) {
      data.opmerking =
        typeof body.opmerking ===
          "string" &&
        body.opmerking.trim()
          .length > 0
          ? body.opmerking.trim()
          : null;
    }

    const beschikbaarheid =
      await prisma.beschikbaarheid.update(
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
      beschikbaarheid,
    );
  } catch (error) {
    console.error(
      "Fout bij wijzigen beschikbaarheid:",
      error,
    );

    return NextResponse.json(
      {
        fout:
          "De beschikbaarheid kon niet worden gewijzigd.",
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

    const bestaande =
      await haalBeschikbaarheidOp(id);

    if (!bestaande) {
      return NextResponse.json(
        {
          fout:
            "Beschikbaarheid niet gevonden.",
        },
        { status: 404 },
      );
    }

    const toegang =
      await controleerToegang(
        bestaande.medewerkerId,
        bestaande.week.vestigingId,
        bestaande.week
          .beschikbaarheidDeadline,
      );

    if (!toegang) {
      return NextResponse.json(
        {
          fout:
            "Je hebt geen rechten om deze beschikbaarheid te verwijderen.",
        },
        { status: 403 },
      );
    }

    await prisma.beschikbaarheid.delete(
      {
        where: {
          id,
        },
      },
    );

    return NextResponse.json({
      succes: true,
    });
  } catch (error) {
    console.error(
      "Fout bij verwijderen beschikbaarheid:",
      error,
    );

    return NextResponse.json(
      {
        fout:
          "De beschikbaarheid kon niet worden verwijderd.",
      },
      { status: 500 },
    );
  }
}