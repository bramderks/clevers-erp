import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { hasPermissionForVestiging, isEigenaar } from "@/lib/auth";
import { permissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { verstuurDirecteDienstMelding } from "@/lib/push/dienst-direct";

const TOEGESTANE_STATUSSEN = [
  "OPEN",
  "GEPLAND",
  "BEVESTIGD",
  "AFGEZEGD",
  "GEWERKT",
] as const;

type BezettingStatus =
  (typeof TOEGESTANE_STATUSSEN)[number];

type BhvControle = {
  vereist: boolean;
  gedekt: boolean;
  aantalBhv: number;
};

async function haalDienstOp(
  dienstId: string,
) {
  return prisma.dienst.findUnique({
    where: {
      id: dienstId,
    },

    select: {
      id: true,
      datum: true,
      begintijd: true,
      eindtijd: true,

      tags: {
        select: {
          aantal: true,
        },
      },

      week: {
        select: {
          vestigingId: true,
          vestiging: {
            select: {
              organisatieId: true,
            },
          },
        },
      },
    },
  });
}

async function controleerBhv(
  dienstId: string,
): Promise<BhvControle> {
  const bezettingen =
    await prisma.dienstBezetting.findMany({
      where: {
        dienstId,

        medewerkerId: {
          not: null,
        },

        status: {
          not: "AFGEZEGD",
        },

        medewerker: {
          actief: true,
        },
      },

      select: {
        medewerker: {
          select: {
            tags: {
              where: {
                tag: {
                  actief: true,
                },
              },

              select: {
                tag: {
                  select: {
                    naam: true,
                  },
                },
              },
            },
          },
        },
      },
    });

  const aantalBhv =
    bezettingen.filter(
      (bezetting) =>
        bezetting.medewerker?.tags.some(
          (medewerkerTag) =>
            medewerkerTag.tag.naam
              .trim()
              .toLowerCase() === "bhv",
        ) ?? false,
    ).length;

  return {
    vereist: true,
    gedekt: aantalBhv > 0,
    aantalBhv,
  };
}

async function haalBezettingOp(
  dienstId: string,
) {
  return prisma.dienstBezetting.findMany({
    where: {
      dienstId,
    },

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

    orderBy: {
      aangemaaktOp: "asc",
    },
  });
}

export async function GET(
  request: Request,
) {
  try {
    const { searchParams } =
      new URL(request.url);

    const dienstId =
      searchParams.get("dienstId");

    if (!dienstId) {
      return NextResponse.json(
        {
          fout:
            "dienstId is verplicht.",
        },
        {
          status: 400,
        },
      );
    }

    const dienst =
      await haalDienstOp(dienstId);

    if (!dienst) {
      return NextResponse.json(
        {
          fout:
            "Dienst niet gevonden.",
        },
        {
          status: 404,
        },
      );
    }

    const toegang =
      await hasPermissionForVestiging(
        permissions.planning.view,
        dienst.week.vestigingId,
      );

    if (!toegang) {
      return NextResponse.json(
        {
          fout:
            "Geen toegang tot deze planning.",
        },
        {
          status: 403,
        },
      );
    }

    const [
      bezetting,
      bhvControle,
    ] = await Promise.all([
      haalBezettingOp(dienstId),
      controleerBhv(dienstId),
    ]);

    return NextResponse.json({
      bezetting,
      bhvControle,
    });
  } catch (error) {
    console.error(
      "Fout bij ophalen bezetting:",
      error,
    );

    return NextResponse.json(
      {
        fout:
          "De bezetting kon niet worden opgehaald.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(
  request: Request,
) {
  try {
    const body =
      await request.json();

    const dienstId =
      body?.dienstId;

    const medewerkerId =
      body?.medewerkerId;

    const status =
      body?.status;

    if (
      typeof dienstId !== "string" ||
      dienstId.length === 0
    ) {
      return NextResponse.json(
        {
          fout:
            "dienstId is verplicht.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      medewerkerId !== undefined &&
      medewerkerId !== null &&
      typeof medewerkerId !== "string"
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

    const dienst =
      await haalDienstOp(dienstId);

    if (!dienst) {
      return NextResponse.json(
        {
          fout:
            "Dienst niet gevonden.",
        },
        {
          status: 404,
        },
      );
    }

    const eigenaar =
      await isEigenaar(
        dienst.week.vestiging.organisatieId,
      );

    if (!eigenaar) {
      return NextResponse.json(
        {
          fout:
            "Alleen de eigenaar kan de bezetting wijzigen.",
        },
        {
          status: 403,
        },
      );
    }

    const toegang =
      await hasPermissionForVestiging(
        permissions.planning.update,
        dienst.week.vestigingId,
      );

    if (!toegang) {
      return NextResponse.json(
        {
          fout:
            "Je hebt geen rechten om de bezetting te wijzigen.",
        },
        {
          status: 403,
        },
      );
    }

    if (
      status !== undefined &&
      (
        typeof status !== "string" ||
        !TOEGESTANE_STATUSSEN.includes(
          status as BezettingStatus,
        )
      )
    ) {
      return NextResponse.json(
        {
          fout:
            "Ongeldige bezettingsstatus.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * Een daadwerkelijk gekoppelde medewerker
     * wordt altijd direct BEVESTIGD.
     *
     * OPEN blijft alleen bedoeld voor een
     * lege/open dienstpositie.
     */
    const gekozenStatus: BezettingStatus =
      medewerkerId
        ? "BEVESTIGD"
        : status !== undefined
          ? (status as BezettingStatus)
          : "OPEN";

    if (medewerkerId) {
      const maximaalAantalMedewerkers = Math.max(
        1,
        dienst.tags.reduce(
          (totaal, tag) => totaal + Math.max(1, Number(tag.aantal) || 1),
          0,
        ),
      );

      const huidigAantalMedewerkers =
        await prisma.dienstBezetting.count({
          where: {
            dienstId,
            medewerkerId: { not: null },
            status: { not: "AFGEZEGD" },
          },
        });

      if (huidigAantalMedewerkers >= maximaalAantalMedewerkers) {
        return NextResponse.json(
          {
            fout:
              `Deze dienst heeft ruimte voor maximaal ${maximaalAantalMedewerkers} medewerker(s), op basis van de aantallen bij de planningstags.`,
            code: "MAXIMAAL_AANTAL_MEDEWERKERS_BEREIKT",
          },
          { status: 409 },
        );
      }

      const medewerker =
        await prisma.medewerker.findUnique({
          where: {
            id: medewerkerId,
          },

          select: {
            id: true,
            actief: true,
            systeemGebruikerId: true,

            vestigingen: {
              where: {
                vestigingId:
                  dienst.week.vestigingId,
              },

              select: {
                id: true,
              },
            },
          },
        });

      if (!medewerker) {
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

      if (!medewerker.actief) {
        return NextResponse.json(
          {
            fout:
              "Een inactieve medewerker kan niet worden ingepland.",
          },
          {
            status: 400,
          },
        );
      }

      if (medewerker.vestigingen.length === 0) {
        const beheerder = medewerker.systeemGebruikerId
          ? await prisma.organisatieGebruiker.findFirst({
              where: {
                systeemGebruikerId: medewerker.systeemGebruikerId,
                organisatieId: dienst.week.vestiging.organisatieId,
                actief: true,
                rol: {
                  naam: {
                    in: ["Eigenaar", "Super Admin", "eigenaar", "super admin"],
                  },
                },
              },
              select: { id: true },
            })
          : null;

        if (!beheerder) {
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

      const bestaandeBezetting =
        await prisma.dienstBezetting.findFirst({
          where: {
            dienstId,
            medewerkerId,
            status: { not: "AFGEZEGD" },
          },
          select: { id: true },
        });

      if (bestaandeBezetting) {
        return NextResponse.json(
          { fout: "Deze medewerker staat al op deze dienst." },
          { status: 409 },
        );
      }

      /*
       * Een medewerker mag niet op twee vestigingen
       * van dezelfde organisatie worden ingepland.
       * Tussen vestigingen houden we standaard 1 uur reistijd
       * vrij. De controle geldt dus één uur vóór en één uur ná
       * een bestaande dienst.
       */
      const medewerkerDienstenZelfdeOrganisatie =
        await prisma.dienstBezetting.findMany({
          where: {
            medewerkerId,
            status: { not: "AFGEZEGD" },
            dienst: {
              id: { not: dienstId },
              datum: dienst.datum,
              week: {
                vestiging: {
                  organisatieId:
                    dienst.week.vestiging.organisatieId,
                },
              },
            },
          },
          select: {
            dienst: {
              select: {
                begintijd: true,
                eindtijd: true,
                week: {
                  select: {
                    vestiging: {
                      select: { id: true, naam: true },
                    },
                  },
                },
              },
            },
          },
        });

      const conflict = medewerkerDienstenZelfdeOrganisatie.find(
        (bezetting) => {
          const andereVestiging =
            bezetting.dienst.week.vestiging.id !==
            dienst.week.vestigingId;

          if (!andereVestiging) {
            // Meerdere functies op dezelfde locatie mogen bewust overlappen.
            // De centrale urenberekening voorkomt dubbele uren.
            return false;
          }

          const buffer = 60 * 60 * 1000;

          return (
            dienst.begintijd.getTime() <
              bezetting.dienst.eindtijd.getTime() + buffer &&
            dienst.eindtijd.getTime() >
              bezetting.dienst.begintijd.getTime() - buffer
          );
        },
      );

      if (conflict) {
        const vestigingNaam =
          conflict.dienst.week.vestiging.naam;

        const andereVestiging =
          conflict.dienst.week.vestiging.id !==
          dienst.week.vestigingId;

        return NextResponse.json(
          {
            fout: andereVestiging
              ? `Deze medewerker heeft op dezelfde dag al een dienst in ${vestigingNaam}. Tussen vestigingen is 1 uur reistijd gereserveerd.`
              : "Deze medewerker heeft al een overlappende dienst.",
            code: andereVestiging
              ? "ANDERE_VESTIGING_ZELFDE_DAG"
              : "OVERLAPPENDE_DIENST",
          },
          { status: 409 },
        );
      }

      if (bestaandeBezetting) {
        return NextResponse.json(
          {
            fout:
              "Deze medewerker staat al op deze dienst.",
          },
          {
            status: 409,
          },
        );
      }

      // Overlap op dezelfde vestiging is toegestaan voor meerdere functies.
      // Overlap tussen vestigingen wordt hierboven met één uur reistijd geblokkeerd.
    }

    const bezetting =
      await prisma.dienstBezetting.create({
        data: {
          dienstId,

          medewerkerId:
            typeof medewerkerId ===
            "string"
              ? medewerkerId
              : null,

          status:
            gekozenStatus,
        },

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

    /*
     * Een rechtstreeks ingeplande medewerker krijgt direct een
     * persoonlijke pushmelding. Push is aanvullend: de bezetting
     * is al opgeslagen en blijft bestaan wanneer push niet lukt.
     */
    if (typeof medewerkerId === "string") {
      revalidatePath("/app");
      revalidatePath("/app/planning");
      revalidatePath("/dashboard");
      revalidatePath(`/medewerkers/${medewerkerId}`);

      try {
        await verstuurDirecteDienstMelding(bezetting.id);
      } catch (pushError) {
        console.error(
          "Directe dienstpush kon niet worden verwerkt:",
          pushError,
        );
      }
    }

    /*
     * BHV wordt nooit door de planner
     * handmatig ingesteld.
     *
     * Na iedere wijziging aan de bezetting
     * wordt automatisch gecontroleerd of
     * er minimaal één actieve BHV'er op
     * de dienst staat.
     */
    const bhvControle =
      await controleerBhv(
        dienstId,
      );

    return NextResponse.json(
      {
        ...bezetting,
        bhvControle,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(
      "Fout bij toevoegen bezetting:",
      error,
    );

    return NextResponse.json(
      {
        fout:
          "De bezetting kon niet worden toegevoegd.",
      },
      {
        status: 500,
      },
    );
  }
}