import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function parseDatum(
  value: unknown,
  veldnaam: string,
): Date | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(
      `${veldnaam} moet een geldige datum zijn.`,
    );
  }

  const datum = new Date(value);

  if (Number.isNaN(datum.getTime())) {
    throw new Error(
      `${veldnaam} is ongeldig.`,
    );
  }

  return datum;
}

function controleerSeizoen(
  seizoenStart: Date | null,
  seizoenEinde: Date | null,
) {
  if (
    seizoenStart &&
    seizoenEinde &&
    seizoenStart > seizoenEinde
  ) {
    throw new Error(
      "Seizoenstart moet vóór de seizoeneinde liggen.",
    );
  }
}

async function haalEigenaar() {
  const gebruiker =
    await getCurrentUser();

  if (!gebruiker) {
    return null;
  }

  if (!gebruiker.actief) {
    return null;
  }

  const eigenaarOrganisaties =
    gebruiker.organisaties.filter(
      (relatie) =>
        relatie.actief &&
        relatie.organisatie.actief &&
        relatie.rol.naam.toLowerCase() ===
          "eigenaar",
    );

  if (
    eigenaarOrganisaties.length === 0
  ) {
    return null;
  }

  return {
    gebruiker,
    organisatieIds:
      eigenaarOrganisaties.map(
        (relatie) =>
          relatie.organisatieId,
      ),
  };
}

export async function GET() {
  try {
    const eigenaar =
      await haalEigenaar();

    if (!eigenaar) {
      return NextResponse.json(
        {
          error:
            "Je hebt geen toegang tot de vestigingen.",
        },
        {
          status: 403,
        },
      );
    }

    const vestigingen =
      await prisma.vestiging.findMany({
        where: {
          organisatieId: {
            in: eigenaar.organisatieIds,
          },
        },
        orderBy: {
          naam: "asc",
        },
      });

    return NextResponse.json(
      vestigingen,
    );
  } catch (error) {
    console.error(
      "Fout bij ophalen vestigingen:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "De vestigingen konden niet worden opgehaald.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(
  request: NextRequest,
) {
  try {
    const eigenaar =
      await haalEigenaar();

    if (!eigenaar) {
      return NextResponse.json(
        {
          error:
            "Alleen een eigenaar kan een vestiging aanmaken.",
        },
        {
          status: 403,
        },
      );
    }

    const body =
      await request.json();

    if (
      typeof body.code !==
        "string" ||
      body.code.trim().length ===
        0
    ) {
      return NextResponse.json(
        {
          error:
            "Code is verplicht.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      typeof body.naam !==
        "string" ||
      body.naam.trim().length ===
        0
    ) {
      return NextResponse.json(
        {
          error:
            "Naam is verplicht.",
        },
        {
          status: 400,
        },
      );
    }

    const seizoenStart =
      parseDatum(
        body.seizoenStart,
        "Seizoenstart",
      );

    const seizoenEinde =
      parseDatum(
        body.seizoenEinde,
        "Seizoeneinde",
      );

    controleerSeizoen(
      seizoenStart,
      seizoenEinde,
    );

    const vestiging =
      await prisma.vestiging.create({
        data: {
          code: body.code.trim(),
          naam: body.naam.trim(),
          seizoenStart,
          seizoenEinde,

          organisatie: {
            connect: {
              id: eigenaar
                .organisatieIds[0],
            },
          },
        },
      });

    return NextResponse.json(
      vestiging,
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(
      "Fout bij aanmaken vestiging:",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "De vestiging kon niet worden aangemaakt.";

    return NextResponse.json(
      {
        error: message,
      },
      {
        status: 400,
      },
    );
  }
}