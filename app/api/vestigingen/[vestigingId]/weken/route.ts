import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { weekService } from "@/lib/services/week.service";

type RouteContext = {
  params: Promise<{
    vestigingId: string;
  }>;
};

function isEigenaar(
  gebruiker: Awaited<
    ReturnType<typeof getCurrentUser>
  >,
) {
  if (!gebruiker) {
    return false;
  }

  return gebruiker.rollen.some(
    (gebruikerRol) =>
      gebruikerRol.rol.naam.toLowerCase() ===
      "eigenaar",
  );
}

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

  if (
    Number.isNaN(
      deadline.getTime(),
    )
  ) {
    throw new Error(
      "De beschikbaarheidsdeadline is ongeldig.",
    );
  }

  return deadline;
}

export async function GET(
  request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const { vestigingId } =
      await params;

    const zoekParams =
      request.nextUrl.searchParams;

    const jaarParam =
      zoekParams.get("jaar");

    const weeknummerParam =
      zoekParams.get("weeknummer");

    if (
      jaarParam &&
      weeknummerParam
    ) {
      const jaar = Number(
        jaarParam,
      );

      const weeknummer = Number(
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
    console.error(error);

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
    const { vestigingId } =
      await params;

    const body =
      await request.json();

    const jaar = Number(
      body.jaar,
    );

    const weeknummer = Number(
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
    console.error(error);

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

    if (!isEigenaar(gebruiker)) {
      return NextResponse.json(
        {
          error:
            "Alleen een eigenaar kan de beschikbaarheidsdeadline wijzigen.",
        },
        {
          status: 403,
        },
      );
    }

    const body =
      await request.json();

    const weekId =
      typeof body.weekId === "string"
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
    console.error(error);

    const message =
      error instanceof Error
        ? error.message
        : "De beschikbaarheidsdeadline wijzigen is mislukt.";

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