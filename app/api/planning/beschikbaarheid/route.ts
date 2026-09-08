import { NextResponse } from "next/server";

import {
  getCurrentUser,
  isEigenaar,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const TOEGESTANE_STATUSSEN = [
  "BESCHIKBAAR",
  "NIET_BESCHIKBAAR",
  "VOORKEUR",
] as const;

type BeschikbaarheidStatus =
  (typeof TOEGESTANE_STATUSSEN)[number];

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function isDeadlineVerstreken(
  deadline: Date | null,
) {
  if (!deadline) {
    return false;
  }

  return new Date() > deadline;
}

async function haalBeschikbaarheidOp(
  id: string,
) {
  return prisma.beschikbaarheid.findUnique({
    where: {
      id,
    },

    select: {
      id: true,
      medewerkerId: true,
      weekId: true,
      datum: true,
      begintijd: true,
      eindtijd: true,

      week: {
        select: {
          id: true,
          vestigingId: true,
          jaar: true,
          vestiging: {
            select: {
              organisatieId: true,
            },
          },
          weeknummer: true,
          beschikbaarheidDeadline: true,
        },
      },
    },
  });
}

async function controleerToegang(
  medewerkerId: string,
  vestigingId: string,
  organisatieId: string,
  deadline: Date | null,
) {
  const gebruiker =
    await getCurrentUser();

  if (!gebruiker) {
    return {
      toegestaan: false,
      eigenaar: false,
      reden:
        "Je moet ingelogd zijn.",
    };
  }

  const eigenaar =
    await isEigenaar(
      organisatieId,
    );

  /*
   * Eigenaar mag beschikbaarheid altijd
   * corrigeren of verwijderen.
   */
  if (eigenaar) {
    return {
      toegestaan: true,
      eigenaar: true,
      reden: null,
    };
  }

  /*
   * Een medewerker mag uitsluitend zijn
   * eigen beschikbaarheid beheren.
   */
  if (
    !gebruiker.medewerker ||
    gebruiker.medewerker.id !==
      medewerkerId
  ) {
    return {
      toegestaan: false,
      eigenaar: false,
      reden:
        "Je kunt alleen je eigen beschikbaarheid wijzigen.",
    };
  }

  /*
   * Na de deadline staat de beschikbaarheid
   * voor medewerkers definitief op slot.
   */
  if (
    isDeadlineVerstreken(
      deadline,
    )
  ) {
    return {
      toegestaan: false,
      eigenaar: false,
      reden:
        "De deadline voor deze beschikbaarheid is verstreken.",
    };
  }

  /*
   * De medewerker moet aan de betreffende
   * vestiging gekoppeld zijn.
   *
   * Hiervoor gebruiken we het medewerkerrecord
   * zelf. Een medewerker hoeft dus geen aparte
   * vestigingToegang te hebben.
   */
  const medewerker =
    await prisma.medewerker.findUnique({
      where: {
        id: medewerkerId,
      },

      select: {
        id: true,
        actief: true,

        vestigingen: {
          where: {
            vestigingId,
            vestiging: {
              actief: true,
            },
          },

          select: {
            id: true,
          },
        },
      },
    });

  if (!medewerker) {
    return {
      toegestaan: false,
      eigenaar: false,
      reden:
        "Medewerker niet gevonden.",
    };
  }

  if (!medewerker.actief) {
    return {
      toegestaan: false,
      eigenaar: false,
      reden:
        "Een inactieve medewerker kan geen beschikbaarheid wijzigen.",
    };
  }

  if (
    medewerker.vestigingen.length ===
    0
  ) {
    return {
      toegestaan: false,
      eigenaar: false,
      reden:
        "Je hebt geen toegang tot deze vestiging.",
    };
  }

  return {
    toegestaan: true,
    eigenaar: false,
    reden: null,
  };
}

/*
 * ============================================================
 * PATCH
 * ============================================================
 */

export async function PATCH(
  request: Request,
  context: RouteContext,
) {
  try {
    const { id } =
      await context.params;

    const body =
      await request.json();

    const bestaande =
      await haalBeschikbaarheidOp(
        id,
      );

    if (!bestaande) {
      return NextResponse.json(
        {
          fout:
            "Beschikbaarheid niet gevonden.",
        },
        {
          status: 404,
        },
      );
    }

    const toegang =
      await controleerToegang(
        bestaande.medewerkerId,
        bestaande.week.vestigingId,
        bestaande.week.vestiging.organisatieId,
        bestaande.week
          .beschikbaarheidDeadline,
      );

    if (!toegang.toegestaan) {
      return NextResponse.json(
        {
          fout:
            toegang.reden ??
            "Je hebt geen rechten om deze beschikbaarheid te wijzigen.",
        },
        {
          status: 403,
        },
      );
    }

    /*
     * --------------------------------------------------------
     * MEDEWERKER WIJZIGEN
     * --------------------------------------------------------
     *
     * Alleen een eigenaar mag een bestaande
     * beschikbaarheid aan een andere medewerker
     * koppelen.
     */

    if (
      body.medewerkerId !==
        undefined &&
      body.medewerkerId !==
        bestaande.medewerkerId
    ) {
      if (!toegang.eigenaar) {
        return NextResponse.json(
          {
            fout:
              "Alleen een eigenaar kan de medewerker van een beschikbaarheid wijzigen.",
          },
          {
            status: 403,
          },
        );
      }

      if (
        typeof body.medewerkerId !==
          "string" ||
        body.medewerkerId.trim()
          .length === 0
      ) {
        return NextResponse.json(
          {
            fout:
              "medewerkerId is ongeldig.",
          },
          {
            status: 400,
          },
        );
      }

      const nieuweMedewerker =
        await prisma.medewerker.findUnique({
          where: {
            id: body.medewerkerId,
          },

          select: {
            id: true,
            actief: true,

            vestigingen: {
              where: {
                vestigingId:
                  bestaande.week
                    .vestigingId,

                vestiging: {
                  actief: true,
                },
              },

              select: {
                id: true,
              },
            },
          },
        });

      if (!nieuweMedewerker) {
        return NextResponse.json(
          {
            fout:
              "Medewerker niet gevonden.",
          },
          {
            status: 404,
          },
        );
      }

      if (!nieuweMedewerker.actief) {
        return NextResponse.json(
          {
            fout:
              "Een inactieve medewerker kan geen beschikbaarheid krijgen.",
          },
          {
            status: 400,
          },
        );
      }

      if (
        nieuweMedewerker
          .vestigingen.length === 0
      ) {
        return NextResponse.json(
          {
            fout:
              "Deze medewerker hoort niet bij deze vestiging.",
          },
          {
            status: 400,
          },
        );
      }
    }

    /*
     * --------------------------------------------------------
     * UPDATE DATA
     * --------------------------------------------------------
     */

    const data: {
      medewerkerId?: string;
      datum?: Date;
      begintijd?: Date;
      eindtijd?: Date;
      status?: BeschikbaarheidStatus;
      opmerking?: string | null;
    } = {};

    /*
     * --------------------------------------------------------
     * MEDEWERKER
     * --------------------------------------------------------
     */

    if (
      body.medewerkerId !==
      undefined
    ) {
      if (
        typeof body.medewerkerId !==
          "string" ||
        body.medewerkerId.trim()
          .length === 0
      ) {
        return NextResponse.json(
          {
            fout:
              "medewerkerId is ongeldig.",
          },
          {
            status: 400,
          },
        );
      }

      /*
       * Een medewerker mag zijn eigen ID
       * meesturen, maar niet wijzigen.
       */
      if (
        !toegang.eigenaar &&
        body.medewerkerId !==
          bestaande.medewerkerId
      ) {
        return NextResponse.json(
          {
            fout:
              "Je kunt alleen je eigen beschikbaarheid wijzigen.",
          },
          {
            status: 403,
          },
        );
      }

      data.medewerkerId =
        body.medewerkerId;
    }

    /*
     * --------------------------------------------------------
     * DATUM
     * --------------------------------------------------------
     */

    if (
      body.datum !== undefined
    ) {
      const datum =
        new Date(body.datum);

      if (
        Number.isNaN(
          datum.getTime(),
        )
      ) {
        return NextResponse.json(
          {
            fout:
              "Datum moet geldig zijn.",
          },
          {
            status: 400,
          },
        );
      }

      data.datum = datum;
    }

    /*
     * --------------------------------------------------------
     * BEGINTIJD
     * --------------------------------------------------------
     */

    if (
      body.begintijd !==
      undefined
    ) {
      const begintijd =
        new Date(
          body.begintijd,
        );

      if (
        Number.isNaN(
          begintijd.getTime(),
        )
      ) {
        return NextResponse.json(
          {
            fout:
              "Begintijd moet geldig zijn.",
          },
          {
            status: 400,
          },
        );
      }

      data.begintijd =
        begintijd;
    }

    /*
     * --------------------------------------------------------
     * EINDTIJD
     * --------------------------------------------------------
     */

    if (
      body.eindtijd !==
      undefined
    ) {
      const eindtijd =
        new Date(
          body.eindtijd,
        );

      if (
        Number.isNaN(
          eindtijd.getTime(),
        )
      ) {
        return NextResponse.json(
          {
            fout:
              "Eindtijd moet geldig zijn.",
          },
          {
            status: 400,
          },
        );
      }

      data.eindtijd =
        eindtijd;
    }

    /*
     * Controleer ook wanneer slechts één van
     * beide tijden wordt gewijzigd.
     */
    const definitieveBegintijd =
      data.begintijd ??
      bestaande.begintijd;

    const definitieveEindtijd =
      data.eindtijd ??
      bestaande.eindtijd;

if (
  definitieveBegintijd !== null &&
  definitieveEindtijd !== null &&
  definitieveEindtijd <=
    definitieveBegintijd
) {
  return NextResponse.json(
    {
      fout:
        "Eindtijd moet na de begintijd liggen.",
    },
    {
      status: 400,
    },
  );
}

    /*
     * --------------------------------------------------------
     * STATUS
     * --------------------------------------------------------
     */

    if (
      body.status !== undefined
    ) {
      if (
        typeof body.status !==
          "string" ||
        !TOEGESTANE_STATUSSEN.includes(
          body.status as BeschikbaarheidStatus,
        )
      ) {
        return NextResponse.json(
          {
            fout:
              "Ongeldige beschikbaarheidsstatus.",
          },
          {
            status: 400,
          },
        );
      }

      data.status =
        body.status as BeschikbaarheidStatus;
    }

    /*
     * --------------------------------------------------------
     * OPMERKING
     * --------------------------------------------------------
     */

    if (
      body.opmerking !==
      undefined
    ) {
      data.opmerking =
        typeof body.opmerking ===
          "string" &&
        body.opmerking.trim()
          .length > 0
          ? body.opmerking.trim()
          : null;
    }

    /*
     * --------------------------------------------------------
     * GEEN WIJZIGINGEN
     * --------------------------------------------------------
     */

    if (
      Object.keys(data).length ===
      0
    ) {
      return NextResponse.json(
        {
          fout:
            "Er zijn geen wijzigingen opgegeven.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * --------------------------------------------------------
     * OPSLAAN
     * --------------------------------------------------------
     */

    const beschikbaarheid =
      await prisma.beschikbaarheid.update({
        where: {
          id,
        },

        data,

        include: {
          medewerker: {
            select: {
              id: true,
              personeelsnummer: true,
              aanhef: true,
              voornaam: true,
              tussenvoegsel: true,
              achternaam: true,
            },
          },
        },
      });

    return NextResponse.json(
      beschikbaarheid,
    );
  } catch (error) {
    console.error(
      "Fout bij wijzigen beschikbaarheid:",
      error,
    );

    return NextResponse.json(
      {
        fout:
          "De beschikbaarheid kon niet worden gewijzigd.",
      },
      {
        status: 500,
      },
    );
  }
}

/*
 * ============================================================
 * DELETE
 * ============================================================
 */

export async function DELETE(
  _request: Request,
  context: RouteContext,
) {
  try {
    const { id } =
      await context.params;

    const bestaande =
      await haalBeschikbaarheidOp(
        id,
      );

    if (!bestaande) {
      return NextResponse.json(
        {
          fout:
            "Beschikbaarheid niet gevonden.",
        },
        {
          status: 404,
        },
      );
    }

    const toegang =
      await controleerToegang(
        bestaande.medewerkerId,
        bestaande.week.vestigingId,
        bestaande.week
          .beschikbaarheidDeadline,
      );

    if (!toegang.toegestaan) {
      return NextResponse.json(
        {
          fout:
            toegang.reden ??
            "Je hebt geen rechten om deze beschikbaarheid te verwijderen.",
        },
        {
          status: 403,
        },
      );
    }

    await prisma.beschikbaarheid.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({
      succes: true,
    });
  } catch (error) {
    console.error(
      "Fout bij verwijderen beschikbaarheid:",
      error,
    );

    return NextResponse.json(
      {
        fout:
          "De beschikbaarheid kon niet worden verwijderd.",
      },
      {
        status: 500,
      },
    );
  }
}