import { NextRequest, NextResponse } from "next/server";

import {
  getCurrentUser,
  hasPermissionForVestiging,
  isEigenaar,
} from "@/lib/auth";
import { permissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { weekService } from "@/lib/services/week.service";

type RouteContext = {
  params: Promise<{
    vestigingId: string;
  }>;
};

function parseDeadline(
  value: unknown,
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
      "De beschikbaarheidsdeadline moet een geldige datum en tijd zijn.",
    );
  }

  const deadline = new Date(value);

  if (Number.isNaN(deadline.getTime())) {
    throw new Error(
      "De beschikbaarheidsdeadline is ongeldig.",
    );
  }

  return deadline;
}

async function controleerVestiging(
  vestigingId: string,
) {
  return prisma.vestiging.findUnique({
    where: {
      id: vestigingId,
    },
    select: {
      id: true,
      organisatieId: true,
      actief: true,
    },
  });
}

export async function GET(
  request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const { vestigingId } =
      await params;

    const gebruiker =
      await getCurrentUser();

    if (!gebruiker) {
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

    const vestiging =
      await controleerVestiging(
        vestigingId,
      );

    if (!vestiging) {
      return NextResponse.json(
        {
          error:
            "Vestiging niet gevonden.",
        },
        {
          status: 404,
        },
      );
    }

    if (!vestiging.actief) {
      return NextResponse.json(
        {
          error:
            "Deze vestiging is niet actief.",
        },
        {
          status: 403,
        },
      );
    }

    const toegang =
      await hasPermissionForVestiging(
        permissions.planning.view,
        vestigingId,
      );

    if (!toegang) {
      return NextResponse.json(
        {
          error:
            "Je hebt geen toegang tot de planning van deze vestiging.",
        },
        {
          status: 403,
        },
      );
    }

    const zoekParams =
      request.nextUrl.searchParams;

    const jaarParam =
      zoekParams.get("jaar");

    const weeknummerParam =
      zoekParams.get(
        "weeknummer",
      );

    if (
      jaarParam &&
      weeknummerParam
    ) {
      const jaar = Number(
        jaarParam,
      );

      const weeknummer =
        Number(
          weeknummerParam,
        );

      if (
        !Number.isInteger(jaar) ||
        !Number.isInteger(
          weeknummer,
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Jaar en weeknummer moeten geldige getallen zijn.",
          },
          {
            status: 400,
          },
        );
      }

      const week =
        await weekService.getByVestigingAndWeek(
          vestigingId,
          jaar,
          weeknummer,
        );

      return NextResponse.json({
        week,
      });
    }

    const weken =
      await weekService.getByVestiging(
        vestigingId,
      );

    return NextResponse.json({
      weken,
    });
  } catch (error) {
    console.error(
      "Planningweken ophalen mislukt:",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "De planning kon niet worden opgehaald.";

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
    const { vestigingId } =
      await params;

    const gebruiker =
      await getCurrentUser();

    if (!gebruiker) {
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

    const vestiging =
      await controleerVestiging(
        vestigingId,
      );

    if (!vestiging) {
      return NextResponse.json(
        {
          error:
            "Vestiging niet gevonden.",
        },
        {
          status: 404,
        },
      );
    }

    if (!vestiging.actief) {
      return NextResponse.json(
        {
          error:
            "Deze vestiging is niet actief.",
        },
        {
          status: 403,
        },
      );
    }

    const eigenaar = await isEigenaar(vestiging.organisatieId);

    if (!eigenaar) {
      return NextResponse.json({ error: "Alleen de eigenaar kan een planningweek aanmaken." }, { status: 403 });
    }

    const toegang =
      await hasPermissionForVestiging(
        permissions.planning.create,
        vestigingId,
      );

    if (!toegang) {
      return NextResponse.json(
        {
          error:
            "Je hebt geen toestemming om een planningweek aan te maken.",
        },
        {
          status: 403,
        },
      );
    }

    const body =
      await request.json();

    const jaar = Number(
      body.jaar,
    );

    const weeknummer =
      Number(
        body.weeknummer,
      );

    if (
      !Number.isInteger(jaar) ||
      !Number.isInteger(
        weeknummer,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Jaar en weeknummer moeten geldige getallen zijn.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      weeknummer < 1 ||
      weeknummer > 53
    ) {
      return NextResponse.json(
        {
          error:
            "Het weeknummer moet tussen 1 en 53 liggen.",
        },
        {
          status: 400,
        },
      );
    }

    const week =
      await weekService.getOfMaak(
        vestigingId,
        jaar,
        weeknummer,
      );

    return NextResponse.json(
      week,
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(
      "Planningweek aanmaken mislukt:",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "De planningweek kon niet worden aangemaakt.";

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

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const { vestigingId } =
      await params;

    const gebruiker =
      await getCurrentUser();

    if (!gebruiker) {
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

    const vestiging =
      await controleerVestiging(
        vestigingId,
      );

    if (!vestiging) {
      return NextResponse.json(
        {
          error:
            "Vestiging niet gevonden.",
        },
        {
          status: 404,
        },
      );
    }

    if (!vestiging.actief) {
      return NextResponse.json(
        {
          error:
            "Deze vestiging is niet actief.",
        },
        {
          status: 403,
        },
      );
    }

    const eigenaar = await isEigenaar(vestiging.organisatieId);

    if (!eigenaar) {
      return NextResponse.json({ error: "Alleen de eigenaar kan de planning wijzigen." }, { status: 403 });
    }

    const toegang =
      await hasPermissionForVestiging(
        permissions.planning.update,
        vestigingId,
      );

    if (!toegang) {
      return NextResponse.json(
        {
          error:
            "Je hebt geen toestemming om de planning te wijzigen.",
        },
        {
          status: 403,
        },
      );
    }

    const body =
      await request.json();

    const weekId =
      typeof body.weekId ===
      "string"
        ? body.weekId
        : "";

    if (!weekId) {
      return NextResponse.json(
        {
          error:
            "WeekId is verplicht.",
        },
        {
          status: 400,
        },
      );
    }

    const week =
      await weekService.getById(
        weekId,
      );

    if (
      week.vestigingId !==
      vestigingId
    ) {
      return NextResponse.json(
        {
          error:
            "De week hoort niet bij deze vestiging.",
        },
        {
          status: 400,
        },
      );
    }

    const deadline =
      parseDeadline(
        body.beschikbaarheidDeadline,
      );

    const bijgewerkteWeek =
      await weekService.wijzigBeschikbaarheidDeadline(
        weekId,
        deadline,
      );

    return NextResponse.json({
      week: bijgewerkteWeek,
    });
  } catch (error) {
    console.error(
      "Planningweek wijzigen mislukt:",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "De planning kon niet worden gewijzigd.";

    const status =
      message ===
      "Week niet gevonden."
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