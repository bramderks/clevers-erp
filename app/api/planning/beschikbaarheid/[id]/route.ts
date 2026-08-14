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

type BeschikbaarheidMetWeek = {
  id: string;
  medewerkerId: string;
  weekId: string;
  datum: Date;
  begintijd: Date;
  eindtijd: Date;
  week: {
    vestigingId: string;
    beschikbaarheidDeadline: Date | null;
  };
};

/*
 * ============================================================
 * BESCHIKBAARHEID
 * ============================================================
 */

async function haalBeschikbaarheidOp(
  id: string,
): Promise<BeschikbaarheidMetWeek | null> {
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
          vestigingId: true,
          beschikbaarheidDeadline: true,
        },
      },
    },
  });
}

/*
 * ============================================================
 * DEADLINE
 * ============================================================
 */

function deadlineVerstreken(
  deadline: Date | null,
): boolean {
  if (!deadline) {
    return false;
  }

  return new Date() > deadline;
}

function deadlineFout() {
  return NextResponse.json(
    {
      fout:
        "De beschikbaarheidsdeadline voor deze planningweek is verstreken. Je kunt deze beschikbaarheid niet meer wijzigen.",
    },
    {
      status: 403,
    },
  );
}

/*
 * ============================================================
 * TOEGANG
 * ============================================================
 *
 * Eigenaar:
 * - mag altijd beschikbaarheden beheren
 *
 * Medewerker:
 * - mag uitsluitend zijn eigen beschikbaarheid beheren
 * - moet toegang hebben tot de betreffende vestiging
 * - mag alleen vóór de deadline wijzigen/verwijderen
 *
 * Andere gebruikers:
 * - geen toegang via deze route
 */

async function controleerToegang(
  medewerkerId: string,
  vestigingId: string,
  deadline: Date | null,
) {
  const gebruiker =
    await getCurrentUser();

  if (!gebruiker) {
    return {
      toegestaan: false,
      eigenaar: false,
      reden: "niet_ingelogd",
    };
  }

  const eigenaar =
    await isEigenaar();

  if (eigenaar) {
    return {
      toegestaan: true,
      eigenaar: true,
      reden: null,
    };
  }

  if (
    !gebruiker.medewerker ||
    gebruiker.medewerker.id !==
      medewerkerId
  ) {
    return {
      toegestaan: false,
      eigenaar: false,
      reden: "geen_eigen_beschikbaarheid",
    };
  }

  const vestigingToegang =
    gebruiker.vestigingToegang.some(
      (toegang) =>
        toegang.vestigingId ===
          vestigingId &&
        toegang.actief &&
        toegang.vestiging.actief,
    );

  if (!vestigingToegang) {
    return {
      toegestaan: false,
      eigenaar: false,
      reden: "geen_vestigingstoegang",
    };
  }

  if (
    deadlineVerstreken(deadline)
  ) {
    return {
      toegestaan: false,
      eigenaar: false,
      reden: "deadline_verstreken",
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
      await haalBeschikbaarheidOp(id);

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

    /*
     * --------------------------------------------------------
     * TOEGANG
     * --------------------------------------------------------
     */

    const toegang =
      await controleerToegang(
        bestaande.medewerkerId,
        bestaande.week.vestigingId,
        bestaande.week
          .beschikbaarheidDeadline,
      );

    if (!toegang.toegestaan) {
      if (
        toegang.reden ===
        "deadline_verstreken"
      ) {
        return deadlineFout();
      }

      return NextResponse.json(
        {
          fout:
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
     * Alleen eigenaar mag de medewerker wijzigen.
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
        body.medewerkerId.length ===
          0
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
        await prisma.medewerker.findUnique(
          {
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
                },

                select: {
                  id: true,
                },
              },
            },
          },
        );

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
          .vestigingen.length ===
        0
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
     * Medewerker-ID
     */

    if (
      body.medewerkerId !==
      undefined
    ) {
      if (
        typeof body.medewerkerId !==
          "string" ||
        body.medewerkerId.length ===
          0
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

      data.medewerkerId =
        body.medewerkerId;
    }

    /*
     * Datum
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
     * Begintijd
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
     * Eindtijd
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
     * --------------------------------------------------------
     * TIJD CONTROLE
     * --------------------------------------------------------
     */

    const begintijd =
      data.begintijd ??
      bestaande.begintijd;

    const eindtijd =
      data.eindtijd ??
      bestaande.eindtijd;

    if (eindtijd <= begintijd) {
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
      body.status !==
      undefined
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
     * OPSLAAN
     * --------------------------------------------------------
     */

    const beschikbaarheid =
      await prisma.beschikbaarheid.update(
        {
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
        },
      );

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
      await haalBeschikbaarheidOp(id);

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

    /*
     * --------------------------------------------------------
     * TOEGANG
     * --------------------------------------------------------
     */

    const toegang =
      await controleerToegang(
        bestaande.medewerkerId,
        bestaande.week.vestigingId,
        bestaande.week
          .beschikbaarheidDeadline,
      );

    if (!toegang.toegestaan) {
      if (
        toegang.reden ===
        "deadline_verstreken"
      ) {
        return deadlineFout();
      }

      return NextResponse.json(
        {
          fout:
            "Je hebt geen rechten om deze beschikbaarheid te verwijderen.",
        },
        {
          status: 403,
        },
      );
    }

    /*
     * --------------------------------------------------------
     * VERWIJDEREN
     * --------------------------------------------------------
     */

    await prisma.beschikbaarheid.delete(
      {
        where: {
          id,
        },
      },
    );

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