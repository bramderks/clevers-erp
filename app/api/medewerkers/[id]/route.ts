import { NextRequest, NextResponse } from "next/server";

import { medewerkerService } from "@/lib/services/medewerker.service";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const { id } = await params;

    const body = await request.json();

    const medewerker = await medewerkerService.update(
      id,
      {
        personeelsnummer:
          body.personeelsnummer ?? null,

        aanhef: body.aanhef,

        voornaam: body.voornaam,

        tussenvoegsel:
          body.tussenvoegsel ?? null,

        achternaam: body.achternaam,

        roepnaam:
          body.roepnaam ?? null,

        geboortedatum: new Date(
          body.geboortedatum,
        ),

        email: body.email,

        telefoon: body.telefoon,

        contractType:
          body.contractType ?? null,

        contractUren:
          body.contractUren !== null &&
          body.contractUren !== undefined &&
          body.contractUren !== ""
            ? Number(body.contractUren)
            : null,

        datumInDienst:
          body.datumInDienst
            ? new Date(body.datumInDienst)
            : null,

        datumUitDienst:
          body.datumUitDienst
            ? new Date(body.datumUitDienst)
            : null,
      },
    );

    return NextResponse.json({
      id: medewerker.id,
      melding:
        "De medewerkergegevens zijn succesvol opgeslagen.",
    });
  } catch (error) {
    console.error(
      "Medewerker bijwerken mislukt:",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "De medewerkergegevens konden niet worden opgeslagen.";

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