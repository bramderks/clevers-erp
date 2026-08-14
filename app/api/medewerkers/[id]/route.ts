import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  getCurrentUser,
  hasPermission,
} from "@/lib/auth";
import { permissions } from "@/lib/permissions";
import { medewerkerService } from "@/lib/services/medewerker.service";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function maakDatum(
  waarde: unknown,
  verplicht = false,
) {
  if (
    waarde === null ||
    waarde === undefined ||
    waarde === ""
  ) {
    if (verplicht) {
      throw new Error(
        "Geboortedatum is verplicht.",
      );
    }

    return null;
  }

  const datum = new Date(
    String(waarde),
  );

  if (Number.isNaN(datum.getTime())) {
    throw new Error(
      "De opgegeven datum is ongeldig.",
    );
  }

  return datum;
}

function maakNummer(
  waarde: unknown,
) {
  if (
    waarde === null ||
    waarde === undefined ||
    waarde === ""
  ) {
    return null;
  }

  const nummer = Number(waarde);

  if (!Number.isFinite(nummer)) {
    throw new Error(
      "Een opgegeven numerieke waarde is ongeldig.",
    );
  }

  return nummer;
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const { id } = await params;

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

    if (!gebruiker.actief) {
      return NextResponse.json(
        {
          error:
            "Je account is niet actief.",
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
          error:
            "Medewerker niet gevonden.",
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

    if (
      organisatieIds.length === 0
    ) {
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

    let magBewerken = false;

    for (const organisatieId of organisatieIds) {
      if (
        await hasPermission(
          permissions.medewerkers.update,
          organisatieId,
        )
      ) {
        magBewerken = true;
        break;
      }
    }

    if (!magBewerken) {
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

    if (
      body === null ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        {
          error:
            "De meegestuurde gegevens hebben een ongeldig formaat.",
        },
        {
          status: 400,
        },
      );
    }

    const resultaat =
      await medewerkerService.update(
        id,
        {
          personeelsnummer:
            body.personeelsnummer ??
            null,

          aanhef:
            body.aanhef,

          voornaam:
            body.voornaam,

          tussenvoegsel:
            body.tussenvoegsel ??
            null,

          achternaam:
            body.achternaam,

          roepnaam:
            body.roepnaam ??
            null,

          geboortedatum:
            maakDatum(
              body.geboortedatum,
              true,
            ) as Date,

          email:
            body.email,

          telefoon:
            body.telefoon,

          contractType:
            body.contractType ??
            null,

          contractUren:
            maakNummer(
              body.contractUren,
            ),

          uurloon:
            maakNummer(
              body.uurloon,
            ),

          datumInDienst:
            maakDatum(
              body.datumInDienst,
            ),

          datumUitDienst:
            maakDatum(
              body.datumUitDienst,
            ),
        },
      );

    if (
      body.tagIds !==
      undefined
    ) {
      if (
        !Array.isArray(
          body.tagIds,
        )
      ) {
        return NextResponse.json(
          {
            error:
              "De planningstags hebben een ongeldig formaat.",
          },
          {
            status: 400,
          },
        );
      }

      const ongeldigeTagIds =
        body.tagIds.some(
          (tagId: unknown) =>
            typeof tagId !==
            "string",
        );

      if (ongeldigeTagIds) {
        return NextResponse.json(
          {
            error:
              "De planningstags bevatten een ongeldige waarde.",
          },
          {
            status: 400,
          },
        );
      }

      await medewerkerService.setTags(
        id,
        body.tagIds,
      );
    }

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