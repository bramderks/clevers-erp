import { prisma } from "@/lib/prisma";

import {
  berekenGewerkteUren,
} from "@/lib/verloning/pauze";

type GenereerVerloningResultaat = {
  periodeId: string;
  jaar: number;
  maand: number;
  aantalMedewerkers: number;
  aantalRegels: number;
  totaalDagen: number;
  totaalUren: number;
};

type VerloningsGroep = {
  medewerkerId: string;
  vestigingId: string;
  medewerkerNaam: string;
  gewerkteDagen: Set<string>;
  gewerkteUren: number;
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

function beginVanControleperiode(
  jaar: number,
  maand: number,
) {
  return new Date(
    jaar,
    maand,
    1,
    0,
    0,
    0,
    0,
  );
}

function eindeVanControleperiode(
  jaar: number,
  maand: number,
) {
  return new Date(
    jaar,
    maand,
    3,
    23,
    59,
    59,
    999,
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

function urenZijnGelijk(
  eersteWaarde: number,
  tweedeWaarde: number,
) {
  return (
    Math.abs(
      eersteWaarde -
        tweedeWaarde,
    ) < 0.001
  );
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
    !Number.isInteger(jaar) ||
    jaar < 2000
  ) {
    throw new Error(
      "Het opgegeven jaar is ongeldig.",
    );
  }

  if (
    !Number.isInteger(maand) ||
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

  const controleStart =
    beginVanControleperiode(
      jaar,
      maand,
    );

  const controleDeadline =
    eindeVanControleperiode(
      jaar,
      maand,
    );

  /*
   * ==========================================================
   * BESTAANDE PERIODE CONTROLEREN
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

  if (
    totaalUrenregistraties === 0
  ) {
    throw new Error(
      `De verloning van ${maand}-${jaar} kan nog niet worden gegenereerd omdat er geen urenregistraties zijn.`,
    );
  }

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

          werkelijkeBegintijd: true,
          werkelijkeEindtijd: true,

          pauzeMinuten: true,
          gewerkteUren: true,

          medewerker: {
            select: {
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
   * UREN EN PAUZES CONTROLEREN
   * ==========================================================
   */

  const gecontroleerdeUren =
    uren.map(
      (registratie) => {
        const berekening =
          berekenGewerkteUren(
            registratie.werkelijkeBegintijd,
            registratie.werkelijkeEindtijd,
          );

        const opgeslagenPauze =
          registratie.pauzeMinuten;

        const opgeslagenUren =
          Number(
            registratie.gewerkteUren,
          );

        const pauzeKlopt =
          opgeslagenPauze ===
          berekening.pauzeMinuten;

        const urenKloppen =
          urenZijnGelijk(
            opgeslagenUren,
            berekening.gewerkteUren,
          );

        if (
          !pauzeKlopt ||
          !urenKloppen
        ) {
          throw new Error(
            [
              `De urenregistratie van ${volledigeNaam(registratie.medewerker)} op ${datumSleutel(registratie.datum)} komt niet overeen met de centrale pauze- en urenberekening.`,
              `Verwacht: ${berekening.pauzeMinuten} minuten pauze en ${berekening.gewerkteUren.toFixed(2)} uur.`,
              `Opgeslagen: ${opgeslagenPauze} minuten pauze en ${opgeslagenUren.toFixed(2)} uur.`,
            ].join(" "),
          );
        }

        return {
          ...registratie,

          berekendeGewerkteUren:
            berekening.gewerkteUren,
        };
      },
    );

  /*
   * ==========================================================
   * GROEPEREN PER MEDEWERKER EN VESTIGING
   * ==========================================================
   */

  const groepen =
    new Map<
      string,
      VerloningsGroep
    >();

  for (
    const registratie of gecontroleerdeUren
  ) {
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
      registratie.berekendeGewerkteUren;
  }

  if (groepen.size === 0) {
    throw new Error(
      `De verloning van ${maand}-${jaar} kan niet worden gegenereerd omdat er geen definitieve uren beschikbaar zijn.`,
    );
  }

  /*
   * ==========================================================
   * ALFABETISCH SORTEREN
   * ==========================================================
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
   * ==========================================================
   * TOTALEN BEREKENEN
   * ==========================================================
   */

  const totaalDagen =
    gesorteerdeGroepen.reduce(
      (
        totaal,
        groep,
      ) =>
        totaal +
        groep.gewerkteDagen.size,
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
   * ==========================================================
   * VERLONINGSPERIODE EN REGELS OPSLAAN
   * ==========================================================
   */

  const resultaat =
    await prisma.$transaction(
      async (tx) => {
        let periodeId =
          bestaandePeriode?.id;

        if (!periodeId) {
          const nieuwePeriode =
            await tx.verloningsPeriode.create(
              {
                data: {
                  periodeStart,
                  periodeEinde,
                  jaar,
                  maand,
                  status: "AANGEMAAKT",
                },

                select: {
                  id: true,
                },
              },
            );

          periodeId =
            nieuwePeriode.id;
        }

        /*
         * ------------------------------------------------------
         * Oude regels en controles verwijderen.
         * Een regeneratie maakt altijd een volledig nieuwe
         * controlecyclus noodzakelijk.
         * ------------------------------------------------------
         */

        await tx.verloningsRegel.deleteMany(
          {
            where: {
              verloningsPeriodeId:
                periodeId,
            },
          },
        );

        await tx.verloningsControle.deleteMany(
          {
            where: {
              verloningsPeriodeId:
                periodeId,
            },
          },
        );

        /*
         * Een eerdere eigenaarcontrole vervalt wanneer de
         * verloningsregels opnieuw worden samengesteld.
         */

        await tx.verloningsPeriode.update(
          {
            where: {
              id: periodeId,
            },

            data: {
              controleStart,
              controleDeadline,
              gecontroleerdDoorId: null,
              gecontroleerdOp: null,
            },
          },
        );

        /*
         * ======================================================
         * VERLONINGSREGELS AANMAKEN
         * ======================================================
         */

        await tx.verloningsRegel.createMany(
          {
            data:
              gesorteerdeGroepen.map(
                (groep) => ({
                  verloningsPeriodeId:
                    periodeId,

                  medewerkerId:
                    groep.medewerkerId,

                  vestigingId:
                    groep.vestigingId,

                  medewerkerNaam:
                    groep.medewerkerNaam,

                  gewerkteDagen:
                    groep.gewerkteDagen.size,

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
         * MEDEWERKERCONTROLES AANMAKEN
         * ======================================================
         *
         * Eén OPEN controle per unieke medewerker.
         */

        const uniekeMedewerkerIds =
          Array.from(
            new Set(
              gesorteerdeGroepen.map(
                (groep) =>
                  groep.medewerkerId,
              ),
            ),
          );

        await tx.verloningsControle.createMany(
          {
            data:
              uniekeMedewerkerIds.map(
                (medewerkerId) => ({
                  verloningsPeriodeId:
                    periodeId,
                  medewerkerId,
                  status: "OPEN",
                  gecontroleerdOp: null,
                  automatischAkkoordOp: null,
                }),
              ),
          },
        );

        /*
         * ======================================================
         * PERIODE KLAARZETTEN
         * ======================================================
         */

        const gegenereerdOp =
          new Date();

        const bijgewerktePeriode =
          await tx.verloningsPeriode.update(
            {
              where: {
                id: periodeId,
              },

              data: {
                status: "KLAAR",
                gegenereerdOp,
                controleStart,
                controleDeadline,
                gecontroleerdDoorId:
                  null,
                gecontroleerdOp: null,
              },

              select: {
                id: true,
              },
            },
          );

        return {
          periodeId:
            bijgewerktePeriode.id,
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
      new Set(
        gesorteerdeGroepen.map(
          (groep) =>
            groep.medewerkerId,
        ),
      ).size,

    aantalRegels:
      gesorteerdeGroepen.length,

    totaalDagen,

    totaalUren:
      Number(
        totaalUren.toFixed(2),
      ),
  };
}
