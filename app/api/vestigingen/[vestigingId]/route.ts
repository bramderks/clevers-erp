import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    vestigingId: string;
  }>;
};

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

async function haalVestigingOp(
  vestigingId: string,
) {
  return prisma.vestiging.findUnique({
    where: {
      id: vestigingId,
    },
    select: {
      id: true,
      organisatieId: true,
      code: true,
      naam: true,
      actief: true,
      seizoenStart: true,
      seizoenEinde: true,
      aangemaaktOp: true,
      gewijzigdOp: true,
    },
  });
}

async function controleerEigenaar(
  vestigingId: string,
) {
  const gebruiker =
    await getCurrentUser();

  if (!gebruiker) {
    return {
      toegestaan: false,
      status: 401,
      fout: "Je moet ingelogd zijn.",
    };
  }

  const vestiging =
    await prisma.vestiging.findUnique({
      where: {
        id: vestigingId,
      },
      select: {
        id: true,
        organisatieId: true,
      },
    });

  if (!vestiging) {
    return {
      toegestaan: false,
      status: 404,
      fout: "Vestiging niet gevonden.",
    };
  }

  const eigenaar =
    gebruiker.organisaties.some(
      (relatie) =>
        relatie.actief &&
        relatie.organisatie.actief &&
        relatie.organisatieId ===
          vestiging.organisatieId &&
        relatie.rol.naam.toLowerCase() ===
          "eigenaar",
    );

  if (!eigenaar) {
    return {
      toegestaan: false,
      status: 403,
      fout:
        "Alleen een eigenaar kan deze vestiging wijzigen.",
    };
  }

  return {
    toegestaan: true,
    status: 200,
    fout: null,
  };
}

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const { vestigingId } =
      await context.params;

    const vestiging =
      await haalVestigingOp(
        vestigingId,
      );

    if (!vestiging) {
      return NextResponse.json(
        {
          error:
            "Vestiging niet gevonden.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json(
      vestiging,
    );
  } catch (error) {
    console.error(
      "Fout bij ophalen vestiging:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "De vestiging kon niet worden opgehaald.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const { vestigingId } =
      await context.params;

    const toegang =
      await controleerEigenaar(
        vestigingId,
      );

    if (!toegang.toegestaan) {
      return NextResponse.json(
        {
          error: toegang.fout,
        },
        {
          status: toegang.status,
        },
      );
    }

    const bestaandeVestiging =
      await haalVestigingOp(
        vestigingId,
      );

    if (!bestaandeVestiging) {
      return NextResponse.json(
        {
          error:
            "Vestiging niet gevonden.",
        },
        { status: 404 },
      );
    }

    const body =
      await request.json();

    const data: {
      code?: string;
      naam?: string;
      actief?: boolean;
      seizoenStart?: Date | null;
      seizoenEinde?: Date | null;
    } = {};

    if (body.code !== undefined) {
      if (
        typeof body.code !==
          "string" ||
        body.code.trim().length === 0
      ) {
        return NextResponse.json(
          {
            error:
              "Code is verplicht.",
          },
          { status: 400 },
        );
      }

      data.code =
        body.code.trim();
    }

    if (body.naam !== undefined) {
      if (
        typeof body.naam !==
          "string" ||
        body.naam.trim().length === 0
      ) {
        return NextResponse.json(
          {
            error:
              "Naam is verplicht.",
          },
          { status: 400 },
        );
      }

      data.naam =
        body.naam.trim();
    }

    if (body.actief !== undefined) {
      if (
        typeof body.actief !==
        "boolean"
      ) {
        return NextResponse.json(
          {
            error:
              "Actief moet een boolean zijn.",
          },
          { status: 400 },
        );
      }

      data.actief =
        body.actief;
    }

    if (
      body.seizoenStart !==
      undefined
    ) {
      data.seizoenStart =
        parseDatum(
          body.seizoenStart,
          "Seizoenstart",
        );
    }

    if (
      body.seizoenEinde !==
      undefined
    ) {
      data.seizoenEinde =
        parseDatum(
          body.seizoenEinde,
          "Seizoeneinde",
        );
    }

    const seizoenStart =
      data.seizoenStart !==
      undefined
        ? data.seizoenStart
        : bestaandeVestiging.seizoenStart;

    const seizoenEinde =
      data.seizoenEinde !==
      undefined
        ? data.seizoenEinde
        : bestaandeVestiging.seizoenEinde;

    controleerSeizoen(
      seizoenStart,
      seizoenEinde,
    );

    if (
      Object.keys(data).length ===
      0
    ) {
      return NextResponse.json(
        {
          error:
            "Er zijn geen wijzigingen opgegeven.",
        },
        { status: 400 },
      );
    }

    const vestiging =
      await prisma.vestiging.update({
        where: {
          id: vestigingId,
        },
        data,
      });

    return NextResponse.json(
      vestiging,
    );
  } catch (error) {
    console.error(
      "Fout bij wijzigen vestiging:",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "De vestiging kon niet worden gewijzigd.";

    return NextResponse.json(
      {
        error: message,
      },
      { status: 400 },
    );
  }
}