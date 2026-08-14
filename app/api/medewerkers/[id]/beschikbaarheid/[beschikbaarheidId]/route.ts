import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import {
  beschikbaarheidService,
} from "@/lib/services/beschikbaarheid.service";

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
    throw new Error(
      `${veld} is verplicht.`,
    );
  }

  const datum = new Date(value);

  if (Number.isNaN(datum.getTime())) {
    throw new Error(
      `${veld} bevat geen geldige datum.`,
    );
  }

  return datum;
}

async function bepaalToegang(
  medewerkerId: string,
  beschikbaarheidId: string,
) {
  const gebruiker =
    await getCurrentUser();

  if (!gebruiker) {
    return {
      gebruiker: null,
      toegestaan: false,
      isBeheerder: false,
      beschikbaarheid: null,
    };
  }

  const beschikbaarheid =
    await beschikbaarheidService.getById(
      beschikbaarheidId,
    );

  if (
    beschikbaarheid.medewerkerId !==
    medewerkerId
  ) {
    return {
      gebruiker,
      toegestaan: false,
      isBeheerder: false,
      beschikbaarheid,
    };
  }

  const organisatieId =
    beschikbaarheid.week.vestiging
      .organisatieId;

  const isEigenMedewerker =
    gebruiker.medewerker?.id ===
    medewerkerId;

  const isBeheerder =
    await beschikbaarheidService.isBeheerder(
      gebruiker.id,
      organisatieId,
    );

  return {
    gebruiker,
    toegestaan:
      isEigenMedewerker ||
      isBeheerder,
    isBeheerder,
    beschikbaarheid,
  };
}

function foutStatus(
  message: string,
) {
  if (
    message ===
    "Beschikbaarheid niet gevonden."
  ) {
    return 404;
  }

  if (
    message.includes("deadline") ||
    message.includes(
      "Alleen een eigenaar",
    ) ||
    message.includes(
      "Alleen een eigenaar of teamleider",
    ) ||
    message.includes(
      "Je mag alleen",
    ) ||
    message.includes(
      "geen toestemming",
    )
  ) {
    return 403;
  }

  return 400;
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

    const toegang =
      await bepaalToegang(
        medewerkerId,
        beschikbaarheidId,
      );

    if (!toegang.gebruiker) {
      return NextResponse.json(
        {
          error:
            "Je moet ingelogd zijn.",
        },
        {
          status: 401,
        },
      );
    }

    if (
      !toegang.beschikbaarheid
    ) {
      return NextResponse.json(
        {
          error:
            "Beschikbaarheid niet gevonden.",
        },
        {
          status: 404,
        },
      );
    }

    if (!toegang.toegestaan) {
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
      toegang.beschikbaarheid,
    );
  } catch (error) {
    console.error(
      "Beschikbaarheid ophalen mislukt:",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "Beschikbaarheid ophalen is mislukt.";

    return NextResponse.json(
      {
        error: message,
      },
      {
        status: foutStatus(
          message,
        ),
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

    const toegang =
      await bepaalToegang(
        medewerkerId,
        beschikbaarheidId,
      );

    if (!toegang.gebruiker) {
      return NextResponse.json(
        {
          error:
            "Je moet ingelogd zijn.",
        },
        {
          status: 401,
        },
      );
    }

    if (
      !toegang.beschikbaarheid
    ) {
      return NextResponse.json(
        {
          error:
            "Beschikbaarheid niet gevonden.",
        },
        {
          status: 404,
        },
      );
    }

    if (!toegang.toegestaan) {
      return NextResponse.json(
        {
          error:
            "Je hebt geen toestemming om deze beschikbaarheid te wijzigen.",
        },
        {
          status: 403,
        },
      );
    }

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

    const resultaat =
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
        toegang.isBeheerder
          ? undefined
          : medewerkerId,
        toegang.gebruiker.id,
      );

    return NextResponse.json(
      resultaat,
    );
  } catch (error) {
    console.error(
      "Beschikbaarheid wijzigen mislukt:",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "Beschikbaarheid wijzigen is mislukt.";

    return NextResponse.json(
      {
        error: message,
      },
      {
        status: foutStatus(
          message,
        ),
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

    const toegang =
      await bepaalToegang(
        medewerkerId,
        beschikbaarheidId,
      );

    if (!toegang.gebruiker) {
      return NextResponse.json(
        {
          error:
            "Je moet ingelogd zijn.",
        },
        {
          status: 401,
        },
      );
    }

    if (
      !toegang.beschikbaarheid
    ) {
      return NextResponse.json(
        {
          error:
            "Beschikbaarheid niet gevonden.",
        },
        {
          status: 404,
        },
      );
    }

    if (!toegang.toegestaan) {
      return NextResponse.json(
        {
          error:
            "Je hebt geen toestemming om deze beschikbaarheid te verwijderen.",
        },
        {
          status: 403,
        },
      );
    }

    await beschikbaarheidService.delete(
      beschikbaarheidId,
      toegang.isBeheerder
        ? undefined
        : medewerkerId,
      toegang.gebruiker.id,
    );

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "Beschikbaarheid verwijderen mislukt:",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "Beschikbaarheid verwijderen is mislukt.";

    return NextResponse.json(
      {
        error: message,
      },
      {
        status: foutStatus(
          message,
        ),
      },
    );
  }
}