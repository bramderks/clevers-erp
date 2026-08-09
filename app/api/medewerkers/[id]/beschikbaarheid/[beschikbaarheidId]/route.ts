import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { beschikbaarheidService } from "@/lib/services/beschikbaarheid.service";

type RouteContext = {
  params: Promise<{
    id: string;
    beschikbaarheidId: string;
  }>;
};

type RequestBody = {
  datum?: string;
  begintijd?: string;
  eindtijd?: string;
  status?:
    | "BESCHIKBAAR"
    | "NIET_BESCHIKBAAR"
    | "VOORKEUR";
  opmerking?: string | null;
};

function parseDate(
  value: string | undefined,
  veld: string,
) {
  if (!value) {
    throw new Error(`${veld} is verplicht.`);
  }

  const datum = new Date(value);

  if (Number.isNaN(datum.getTime())) {
    throw new Error(`${veld} bevat geen geldige datum.`);
  }

  return datum;
}

function isEigenaar(
  gebruiker: Awaited<ReturnType<typeof getCurrentUser>>,
) {
  if (!gebruiker) {
    return false;
  }

  return gebruiker.organisaties.some(
    (relatie) =>
      relatie.actief &&
      relatie.rol.naam.toLowerCase() === "eigenaar",
  );
}

export async function GET(
  _request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const {
      id: medewerkerId,
      beschikbaarheidId,
    } = await params;

    const gebruiker = await getCurrentUser();

    if (!gebruiker) {
      return NextResponse.json(
        {
          error: "Je moet ingelogd zijn.",
        },
        {
          status: 401,
        },
      );
    }

    const beschikbaarheid =
      await beschikbaarheidService.getById(
        beschikbaarheidId,
      );

    if (
      beschikbaarheid.medewerkerId !== medewerkerId &&
      !isEigenaar(gebruiker)
    ) {
      return NextResponse.json(
        {
          error:
            "Je hebt geen toegang tot deze beschikbaarheid.",
        },
        {
          status: 403,
        },
      );
    }

    return NextResponse.json(
      beschikbaarheid,
    );
  } catch (error) {
    console.error(error);

    const message =
      error instanceof Error
        ? error.message
        : "Beschikbaarheid ophalen is mislukt.";

    const status =
      message ===
      "Beschikbaarheid niet gevonden."
        ? 404
        : 400;

    return NextResponse.json(
      {
        error: message,
      },
      {
        status,
      },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const {
      id: medewerkerId,
      beschikbaarheidId,
    } = await params;

    const gebruiker = await getCurrentUser();

    if (!gebruiker) {
      return NextResponse.json(
        {
          error: "Je moet ingelogd zijn.",
        },
        {
          status: 401,
        },
      );
    }

    const eigenaar = isEigenaar(gebruiker);

    const body =
      (await request.json()) as RequestBody;

    const datum = parseDate(
      body.datum,
      "Datum",
    );

    const begintijd = parseDate(
      body.begintijd,
      "Begintijd",
    );

    const eindtijd = parseDate(
      body.eindtijd,
      "Eindtijd",
    );

    if (eindtijd <= begintijd) {
      return NextResponse.json(
        {
          error:
            "De eindtijd moet na de begintijd liggen.",
        },
        {
          status: 400,
        },
      );
    }

    const beschikbaarheid =
      await beschikbaarheidService.update(
        beschikbaarheidId,
        {
          datum,
          begintijd,
          eindtijd,
          status: body.status,
          opmerking:
            body.opmerking ?? null,
        },
        medewerkerId,
        eigenaar
          ? gebruiker.id
          : undefined,
      );

    return NextResponse.json(
      beschikbaarheid,
    );
  } catch (error) {
    console.error(error);

    const message =
      error instanceof Error
        ? error.message
        : "Beschikbaarheid wijzigen is mislukt.";

    let status = 400;

    if (
      message ===
      "Beschikbaarheid niet gevonden."
    ) {
      status = 404;
    }

    if (
      message.includes("deadline") ||
      message.includes(
        "Alleen een eigenaar",
      )
    ) {
      status = 403;
    }

    return NextResponse.json(
      {
        error: message,
      },
      {
        status,
      },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const {
      id: medewerkerId,
      beschikbaarheidId,
    } = await params;

    const gebruiker = await getCurrentUser();

    if (!gebruiker) {
      return NextResponse.json(
        {
          error: "Je moet ingelogd zijn.",
        },
        {
          status: 401,
        },
      );
    }

    const eigenaar = isEigenaar(gebruiker);

    await beschikbaarheidService.delete(
      beschikbaarheidId,
      medewerkerId,
      eigenaar
        ? gebruiker.id
        : undefined,
    );

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(error);

    const message =
      error instanceof Error
        ? error.message
        : "Beschikbaarheid verwijderen is mislukt.";

    let status = 400;

    if (
      message ===
      "Beschikbaarheid niet gevonden."
    ) {
      status = 404;
    }

    if (
      message.includes("deadline") ||
      message.includes(
        "Alleen een eigenaar",
      )
    ) {
      status = 403;
    }

    return NextResponse.json(
      {
        error: message,
      },
      {
        status,
      },
    );
  }
}