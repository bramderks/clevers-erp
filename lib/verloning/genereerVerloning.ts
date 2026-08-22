import { prisma } from "@/lib/prisma";

type GenereerVerloningResultaat = {
  periodeId: string;
  jaar: number;
  maand: number;
  aantalMedewerkers: number;
  aantalRegels: number;
  totaalDagen: number;
  totaalUren: number;
};

function beginVanMaand(
  jaar: number,
  maand: number,
) {
  return new Date(
    jaar,
    maand - 1,
    1,
  );
}

function beginVanVolgendeMaand(
  jaar: number,
  maand: number,
) {
  return new Date(
    jaar,
    maand,
    1,
  );
}

function datumSleutel(
  datum: Date,
) {
  return [
    datum.getFullYear(),
    String(
      datum.getMonth() + 1,
    ).padStart(2, "0"),
    String(
      datum.getDate(),
    ).padStart(2, "0"),
  ].join("-");
}

function volledigeNaam(
  medewerker: {
    voornaam: string;
    tussenvoegsel: string | null;
    achternaam: string;
  },
) {
  return [
    medewerker.voornaam,
    medewerker.tussenvoegsel,
    medewerker.achternaam,
  ]
    .filter(Boolean)
    .join(" ");
}

export async function genereerVerloning(
  jaar: number,
  maand: number,
): Promise<GenereerVerloningResultaat> {
  /*
   * ==========================================================
   * PERIODE CONTROLEREN
   * ==========================================================
   */

  if (
    maand < 1 ||
    maand > 12
  ) {
    throw new Error(
      "De maand moet tussen 1 en 12 liggen.",
    );
  }

  const periodeStart =
    beginVanMaand(
      jaar,
      maand,
    );

  const periodeEinde =
    beginVanVolgendeMaand(
      jaar,
      maand,
    );

  /*
   * ==========================================================
   * BESTAANDE PERIODE
   * ==========================================================
   */

  const bestaandePeriode =
    await prisma.verloningsPeriode.findUnique(
      {
        where: {
          jaar_maand: {
            jaar,
            maand,
          },
        },
        select: {
          id: true,
          status: true,
        },
      },
    );

  /*
   * Een reeds verwerkte periode mag nooit automatisch
   * opnieuw worden opgebouwd.
   */

  if (
    bestaandePeriode?.status ===
    "VERWERKT"
  ) {
    throw new Error(
      `De verloningsperiode ${maand}-${jaar} is al verwerkt en kan niet opnieuw worden gegenereerd.`,
    );
  }

  /*
   * ==========================================================
   * ALLE URENREGISTRATIES CONTROLEREN
   * ==========================================================
   *
   * Voor een maandrapportage moet iedere urenregistratie
   * binnen de periode definitief zijn.
   *
   * We controleren bewust het totaal en het aantal definitieve
   * registraties. Hierdoor kan geen enkele andere status
   * ongemerkt door de controle heen komen.
   */

  const [
    totaalUrenregistraties,
    definitieveUrenregistraties,
  ] = await Promise.all([
    prisma.urenRegistratie.count({
      where: {
        datum: {
          gte: periodeStart,
          lt: periodeEinde,
        },
      },
    }),

    prisma.urenRegistratie.count({
      where: {
        datum: {
          gte: periodeStart,
          lt: periodeEinde,
        },
        status: "DEFINITIEF",
      },
    }),
  ]);

  /*
   * Er moeten daadwerkelijk uren zijn geregistreerd.
   */

  if (
    totaalUrenregistraties === 0
  ) {
    throw new Error(
      `De verloning van ${maand}-${jaar} kan nog niet worden gegenereerd omdat er geen urenregistraties zijn.`,
    );
  }

  /*
   * Niet iedere registratie is definitief.
   */

  if (
    totaalUrenregistraties !==
    definitieveUrenregistraties
  ) {
    const openstaandeUren =
      totaalUrenregistraties -
      definitieveUrenregistraties;

    throw new Error(
      `De verloning van ${maand}-${jaar} kan nog niet worden gegenereerd. Er zijn nog ${openstaandeUren} urenregistraties die niet definitief zijn.`,
    );
  }

  /*
   * ==========================================================
   * DEFINITIEVE UREN OPHALEN
   * ==========================================================
   */

  const uren =
    await prisma.urenRegistratie.findMany(
      {
        where: {
          datum: {
            gte: periodeStart,
            lt: periodeEinde,
          },
          status: "DEFINITIEF",
        },
        select: {
          id: true,
          medewerkerId: true,
          vestigingId: true,
          datum: true,
          gewerkteUren: true,

          medewerker: {
            select: {
              id: true,
              voornaam: true,
              tussenvoegsel: true,
              achternaam: true,
            },
          },
        },

        orderBy: [
          {
            medewerker: {
              achternaam: "asc",
            },
          },
          {
            medewerker: {
              voornaam: "asc",
            },
          },
          {
            datum: "asc",
          },
        ],
      },
    );

  /*
   * ==========================================================
   * GROEPEREN
   * ==========================================================
   *
   * Eén medewerker kan meerdere urenregistraties op één dag
   * hebben.
   *
   * Gewerkte dagen worden daarom bepaald op basis van unieke
   * datums en niet op basis van het aantal registraties.
   *
   * De combinatie medewerker + vestiging blijft bepalend.
   */

  type Groep = {
    medewerkerId: string;
    vestigingId: string;
    medewerkerNaam: string;
    gewerkteDagen: Set<string>;
    gewerkteUren: number;
  };

  const groepen =
    new Map<string, Groep>();

  for (const registratie of uren) {
    const sleutel = [
      registratie.medewerkerId,
      registratie.vestigingId,
    ].join(":");

    let groep =
      groepen.get(sleutel);

    if (!groep) {
      groep = {
        medewerkerId:
          registratie.medewerkerId,

        vestigingId:
          registratie.vestigingId,

        medewerkerNaam:
          volledigeNaam(
            registratie.medewerker,
          ),

        gewerkteDagen:
          new Set<string>(),

        gewerkteUren: 0,
      };

      groepen.set(
        sleutel,
        groep,
      );
    }

    groep.gewerkteDagen.add(
      datumSleutel(
        registratie.datum,
      ),
    );

    groep.gewerkteUren +=
      Number(
        registratie.gewerkteUren,
      );
  }

  /*
   * ==========================================================
   * EXTRA VEILIGHEIDSCONTROLE
   * ==========================================================
   *
   * Er moeten daadwerkelijk regels uit de definitieve uren
   * kunnen worden opgebouwd.
   */

  if (groepen.size === 0) {
    throw new Error(
      `De verloning van ${maand}-${jaar} kan niet worden gegenereerd omdat er geen definitieve uren beschikbaar zijn.`,
    );
  }

  /*
   * ==========================================================
   * RAPPORTAGE AANMAKEN
   * ==========================================================
   */

  const resultaat =
    await prisma.$transaction(
      async (tx) => {
        let periode =
          bestaandePeriode;

        /*
         * Nieuwe verloningsperiode aanmaken.
         */

        if (!periode) {
          periode =
            await tx.verloningsPeriode.create(
              {
                data: {
                  periodeStart,
                  periodeEinde,
                  jaar,
                  maand,
                  status:
                    "AANGEMAAKT",
                },

                select: {
                  id: true,
                  status: true,
                },
              },
            );
        }

        /*
         * Een bestaande periode die nog niet verwerkt is,
         * mag opnieuw worden opgebouwd.
         *
         * Hierdoor kunnen we een eerdere incomplete poging
         * veilig vervangen zodra alle uren definitief zijn.
         */

        await tx.verloningsRegel.deleteMany(
          {
            where: {
              verloningsPeriodeId:
                periode.id,
            },
          },
        );

        /*
         * ======================================================
         * ALFABETISCH SORTEREN
         * ======================================================
         *
         * De rapportage wordt alfabetisch op medewerkernaam
         * opgebouwd.
         */

        const gesorteerdeGroepen =
          Array.from(
            groepen.values(),
          ).sort((a, b) =>
            a.medewerkerNaam.localeCompare(
              b.medewerkerNaam,
              "nl",
            ),
          );

        /*
         * ======================================================
         * REGELS AANMAKEN
         * ======================================================
         */

        await tx.verloningsRegel.createMany(
          {
            data:
              gesorteerdeGroepen.map(
                (groep) => ({
                  verloningsPeriodeId:
                    periode!.id,

                  medewerkerId:
                    groep.medewerkerId,

                  vestigingId:
                    groep.vestigingId,

                  medewerkerNaam:
                    groep.medewerkerNaam,

                  gewerkteDagen:
                    groep
                      .gewerkteDagen
                      .size,

                  gewerkteUren:
                    Number(
                      groep.gewerkteUren.toFixed(
                        2,
                      ),
                    ),
                }),
              ),
          },
        );

        /*
         * ======================================================
         * TOTALEN
         * ======================================================
         */

        const totaalDagen =
          gesorteerdeGroepen.reduce(
            (
              totaal,
              groep,
            ) =>
              totaal +
              groep
                .gewerkteDagen
                .size,
            0,
          );

        const totaalUren =
          gesorteerdeGroepen.reduce(
            (
              totaal,
              groep,
            ) =>
              totaal +
              groep.gewerkteUren,
            0,
          );

        /*
         * ======================================================
         * PERIODE OP KLAAR ZETTEN
         * ======================================================
         *
         * Dit is het moment waarop het dashboard de taak
         * "Verloning staat klaar" mag tonen.
         */

        const bijgewerktePeriode =
          await tx.verloningsPeriode.update(
            {
              where: {
                id: periode.id,
              },

              data: {
                status: "KLAAR",
                gegenereerdOp:
                  new Date(),
              },

              select: {
                id: true,
              },
            },
          );

        return {
          periodeId:
            bijgewerktePeriode.id,

          aantalMedewerkers:
            new Set(
              gesorteerdeGroepen.map(
                (groep) =>
                  groep.medewerkerId,
              ),
            ).size,

          aantalRegels:
            gesorteerdeGroepen.length,

          totaalDagen,

          totaalUren,
        };
      },
    );

  /*
   * ==========================================================
   * RESULTAAT
   * ==========================================================
   */

  return {
    periodeId:
      resultaat.periodeId,

    jaar,

    maand,

    aantalMedewerkers:
      resultaat.aantalMedewerkers,

    aantalRegels:
      resultaat.aantalRegels,

    totaalDagen:
      resultaat.totaalDagen,

    totaalUren:
      Number(
        resultaat.totaalUren.toFixed(
          2,
        ),
      ),
  };
}