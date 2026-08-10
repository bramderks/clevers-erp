import { NextRequest, NextResponse } from "next/server";

import {
  getCurrentUser,
  hasPermission,
} from "@/lib/auth";
import { permissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  beschikbaarheidService,
} from "@/lib/services/beschikbaarheid.service";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

async function heeftToegangTotMedewerker(
  medewerkerId: string,
) {
  const gebruiker =
    await getCurrentUser();

  if (!gebruiker) {
    return {
      gebruiker: null,
      toegestaan: false,
      magBewerken: false,
    };
  }

  if (
    gebruiker.medewerker?.id ===
    medewerkerId
  ) {
    return {
      gebruiker,
      toegestaan: true,
      magBewerken: true,
    };
  }

  const medewerker =
    await prisma.medewerker.findUnique({
      where: {
        id: medewerkerId,
      },
      select: {
        vestigingen: {
          select: {
            vestiging: {
              select: {
                organisatieId: true,
              },
            },
          },
        },
      },
    });

  if (!medewerker) {
    return {
      gebruiker,
      toegestaan: false,
      magBewerken: false,
    };
  }

  const organisatieIds =
    Array.from(
      new Set(
        medewerker.vestigingen.map(
          (relatie) =>
            relatie.vestiging
              .organisatieId,
        ),
      ),
    );

  for (const organisatieId of organisatieIds) {
    const magBekijken =
      await hasPermission(
        permissions.medewerkers.view,
        organisatieId,
      );

    if (!magBekijken) {
      continue;
    }

    return {
      gebruiker,
      toegestaan: true,
      magBewerken:
        await hasPermission(
          permissions.medewerkers.update,
          organisatieId,
        ),
    };
  }

  return {
    gebruiker,
    toegestaan: false,
    magBewerken: false,
  };
}

export async function GET(
  _request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const { id } =
      await params;

    const toegang =
      await heeftToegangTotMedewerker(
        id,
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

    if (!toegang.toegestaan) {
      return NextResponse.json(
        {
          error:
            "Je hebt geen toegang tot deze beschikbaarheden.",
        },
        {
          status: 403,
        },
      );
    }

    const beschikbaarheden =
      await beschikbaarheidService.getByMedewerker(
        id,
      );

    return NextResponse.json(
      beschikbaarheden,
    );
  } catch (error) {
    console.error(
      "Beschikbaarheden ophalen mislukt:",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "Er is een onbekende fout opgetreden.";

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

export async function POST(
  request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const { id } =
      await params;

    const toegang =
      await heeftToegangTotMedewerker(
        id,
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

    if (!toegang.toegestaan) {
      return NextResponse.json(
        {
          error:
            "Je hebt geen toegang tot deze medewerker.",
        },
        {
          status: 403,
        },
      );
    }

    if (!toegang.magBewerken) {
      return NextResponse.json(
        {
          error:
            "Je hebt geen toestemming om deze beschikbaarheid toe te voegen.",
        },
        {
          status: 403,
        },
      );
    }

    const body =
      await request.json();

    if (
      !body.weekId ||
      !body.datum ||
      !body.begintijd ||
      !body.eindtijd
    ) {
      return NextResponse.json(
        {
          error:
            "Week, datum, begintijd en eindtijd zijn verplicht.",
        },
        {
          status: 400,
        },
      );
    }

    const datum =
      new Date(body.datum);

    const begintijd =
      new Date(
        body.begintijd,
      );

    const eindtijd =
      new Date(
        body.eindtijd,
      );

    if (
      Number.isNaN(
        datum.getTime(),
      ) ||
      Number.isNaN(
        begintijd.getTime(),
      ) ||
      Number.isNaN(
        eindtijd.getTime(),
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Een of meer datums of tijden zijn ongeldig.",
        },
        {
          status: 400,
        },
      );
    }

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
      await beschikbaarheidService.create(
        {
          weekId:
            body.weekId,
          medewerkerId: id,
          datum,
          begintijd,
          eindtijd,
          status:
            body.status ??
            "BESCHIKBAAR",
          opmerking:
            body.opmerking ??
            null,
        },
      );

    return NextResponse.json(
      beschikbaarheid,
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(
      "Beschikbaarheid aanmaken mislukt:",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "Er is een onbekende fout opgetreden.";

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