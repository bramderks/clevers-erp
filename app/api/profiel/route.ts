import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { medewerkerService } from "@/lib/services/medewerker.service";

type EigenGegevensBody = {
  aanhef?:
    | "DHR"
    | "MEVR"
    | "ANDERS"
    | "GEEN_OPGAVE";

  voornaam?: string;
  tussenvoegsel?: string | null;
  achternaam?: string;
  roepnaam?: string | null;
  email?: string;
  telefoon?: string;
};

export async function PATCH(
  request: Request,
) {
  try {
    const gebruiker =
      await getCurrentUser();

    if (!gebruiker) {
      return NextResponse.json(
        {
          error:
            "Je bent niet ingelogd.",
        },
        {
          status: 401,
        },
      );
    }

    if (!gebruiker.medewerker?.id) {
      return NextResponse.json(
        {
          error:
            "Er is geen medewerkerprofiel aan dit account gekoppeld.",
        },
        {
          status: 403,
        },
      );
    }

    const body =
      (await request.json()) as EigenGegevensBody;

    const data: EigenGegevensBody =
      {};

    if (body.aanhef !== undefined) {
      data.aanhef = body.aanhef;
    }

    if (body.voornaam !== undefined) {
      data.voornaam =
        body.voornaam;
    }

    if (
      body.tussenvoegsel !==
      undefined
    ) {
      data.tussenvoegsel =
        body.tussenvoegsel;
    }

    if (body.achternaam !== undefined) {
      data.achternaam =
        body.achternaam;
    }

    if (body.roepnaam !== undefined) {
      data.roepnaam =
        body.roepnaam;
    }

    if (body.email !== undefined) {
      data.email = body.email;
    }

    if (body.telefoon !== undefined) {
      data.telefoon =
        body.telefoon;
    }

    const medewerker =
      await medewerkerService.updateEigenGegevens(
        gebruiker.medewerker.id,
        data,
      );

    return NextResponse.json({
      success: true,
      medewerker,
    });
  } catch (error) {
    console.error(
      "Fout bij wijzigen eigen profiel:",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "De profielgegevens konden niet worden gewijzigd.";

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