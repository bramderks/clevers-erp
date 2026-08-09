import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
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

    if (!gebruiker.actief) {
      return NextResponse.json(
        {
          error: "Je account is niet actief.",
        },
        {
          status: 403,
        },
      );
    }

    const medewerker =
      await prisma.medewerker.findUnique({
        where: {
          id,
        },
        select: {
          id: true,
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
      return NextResponse.json(
        {
          error: "Medewerker niet gevonden.",
        },
        {
          status: 404,
        },
      );
    }

    const organisatieIds = [
      ...new Set(
        medewerker.vestigingen.map(
          (medewerkerVestiging) =>
            medewerkerVestiging.vestiging
              .organisatieId,
        ),
      ),
    ];

    if (organisatieIds.length === 0) {
      return NextResponse.json(
        {
          error:
            "Deze medewerker is niet aan een organisatie gekoppeld.",
        },
        {
          status: 400,
        },
      );
    }

    const isEigenaar =
      gebruiker.organisaties.some(
        (relatie) =>
          relatie.actief &&
          relatie.organisatie.actief &&
          organisatieIds.includes(
            relatie.organisatieId,
          ) &&
          relatie.rol.naam
            .toLowerCase() === "eigenaar",
      );

    if (!isEigenaar) {
      return NextResponse.json(
        {
          error:
            "Je hebt geen toestemming om deze medewerker te wijzigen.",
        },
        {
          status: 403,
        },
      );
    }

    const body = await request.json();

    const resultaat =
      await medewerkerService.update(id, {
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

        uurloon:
          body.uurloon !== null &&
          body.uurloon !== undefined &&
          body.uurloon !== ""
            ? Number(body.uurloon)
            : null,

        datumInDienst:
          body.datumInDienst
            ? new Date(body.datumInDienst)
            : null,

        datumUitDienst:
          body.datumUitDienst
            ? new Date(body.datumUitDienst)
            : null,
      });

    return NextResponse.json({
      id: resultaat.id,
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