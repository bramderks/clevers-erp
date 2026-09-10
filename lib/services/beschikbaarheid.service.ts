  import { prisma } from "@/lib/prisma";

  type BeschikbaarheidStatus =
    | "BESCHIKBAAR"
    | "NIET_BESCHIKBAAR"
    | "VOORKEUR";

  type BeschikbaarheidData = {
    datum: Date;
    begintijd: Date;
    eindtijd: Date;
    status?: BeschikbaarheidStatus;
    opmerking?: string | null;
  };

  async function getBeschikbaarheid(id: string) {
    const beschikbaarheid =
      await prisma.beschikbaarheid.findUnique({
        where: {
          id,
        },

        include: {
          week: {
            include: {
              vestiging: true,
            },
          },

          medewerker: true,
        },
      });

    if (!beschikbaarheid) {
      throw new Error(
        "Beschikbaarheid niet gevonden.",
      );
    }

    return beschikbaarheid;
  }

  async function getWeek(weekId: string) {
    const week =
      await prisma.week.findUnique({
        where: {
          id: weekId,
        },

        include: {
          vestiging: true,
        },
      });

    if (!week) {
      throw new Error(
        "Week niet gevonden.",
      );
    }

    return week;
  }

  function deadlineVerstreken(
    deadline: Date | null,
  ) {
    if (!deadline) {
      return false;
    }

    return new Date() > deadline;
  }

  async function isBeheerder(
    gebruikerId: string,
    organisatieId: string,
  ) {
    const gebruiker =
      await prisma.systeemGebruiker.findUnique({
        where: {
          id: gebruikerId,
        },

        include: {
          organisaties: {
            include: {
              organisatie: true,
              rol: true,
            },
          },
        },
      });

    if (
      !gebruiker ||
      !gebruiker.actief
    ) {
      return false;
    }

    return gebruiker.organisaties.some(
      (relatie) => {
        if (
          !relatie.actief ||
          !relatie.organisatie.actief
        ) {
          return false;
        }

        if (
          relatie.organisatieId !==
          organisatieId
        ) {
          return false;
        }

        const rol =
          relatie.rol.naam.toLowerCase();

        return (
          rol === "eigenaar" ||
          rol === "teamleider"
        );
      },
    );
  }

  function controleerTijden(
    begintijd: Date,
    eindtijd: Date,
  ) {
    if (eindtijd <= begintijd) {
      throw new Error(
        "De eindtijd moet na de begintijd liggen.",
      );
    }

    const beginMinuten =
      begintijd.getHours() * 60 +
      begintijd.getMinutes();

    const eindMinuten =
      eindtijd.getHours() * 60 +
      eindtijd.getMinutes();

    const minimum = 9 * 60;
    const maximum = 23 * 60;

    if (
      beginMinuten < minimum ||
      eindMinuten > maximum
    ) {
      throw new Error(
        "Beschikbaarheid kan alleen tussen 09:00 en 23:00 worden opgegeven.",
      );
    }
  }

  function controleerStatus(
    status:
      | BeschikbaarheidStatus
      | undefined,
  ) {
    if (!status) {
      return;
    }

    const geldigeStatussen: BeschikbaarheidStatus[] =
      [
        "BESCHIKBAAR",
        "NIET_BESCHIKBAAR",
        "VOORKEUR",
      ];

    if (
      !geldigeStatussen.includes(status)
    ) {
      throw new Error(
        "De opgegeven beschikbaarheidsstatus is ongeldig.",
      );
    }
  }

  async function controleerToegangTotMedewerker(
    medewerkerId: string,
    weekId: string,
    gebruikerId: string,
  ) {
    const week =
      await getWeek(weekId);

    const medewerker =
      await prisma.medewerker.findUnique({
        where: {
          id: medewerkerId,
        },

        select: {
          id: true,
          actief: true,

          vestigingen: {
            select: {
              vestigingId: true,

              vestiging: {
                select: {
                  organisatieId: true,
                  actief: true,
                },
              },
            },
          },
        },
      });

    if (!medewerker) {
      throw new Error(
        "Medewerker niet gevonden.",
      );
    }

    if (!medewerker.actief) {
      throw new Error(
        "Een inactieve medewerker kan geen beschikbaarheid doorgeven.",
      );
    }

    const hoortBijOrganisatie =
      medewerker.vestigingen.some(
        (relatie) =>
          relatie.vestiging.actief &&
          relatie.vestigingId ===
            week.vestigingId &&
          relatie.vestiging
            .organisatieId ===
            week.vestiging
              .organisatieId,
      );

    if (!hoortBijOrganisatie) {
      throw new Error(
        "De medewerker is niet gekoppeld aan de vestiging van deze week.",
      );
    }

    const beheerder =
      await isBeheerder(
        gebruikerId,
        week.vestiging
          .organisatieId,
      );

    const gebruiker =
      await prisma.systeemGebruiker.findUnique(
        {
          where: {
            id: gebruikerId,
          },

          select: {
            id: true,
            actief: true,

            medewerker: {
              select: {
                id: true,
              },
            },
          },
        },
      );

    if (!gebruiker) {
      throw new Error(
        "Systeemgebruiker niet gevonden.",
      );
    }

    if (!gebruiker.actief) {
      throw new Error(
        "Deze systeemgebruiker is niet actief.",
      );
    }

    const isEigenMedewerker =
      gebruiker.medewerker?.id ===
      medewerkerId;

    if (
      !isEigenMedewerker &&
      !beheerder
    ) {
      throw new Error(
        "Je mag alleen je eigen beschikbaarheid beheren.",
      );
    }

    return {
      week,
      medewerker,
      beheerder,
      isEigenMedewerker,
    };
  }

  export const beschikbaarheidService = {
    async getByWeek(
      weekId: string,
      medewerkerId?: string,
    ) {
      return prisma.beschikbaarheid.findMany({
        where: {
          weekId,

          ...(medewerkerId
            ? {
                medewerkerId,
              }
            : {}),
        },

        orderBy: [
          {
            datum: "asc",
          },
          {
            begintijd: "asc",
          },
        ],
      });
    },

    async getByMedewerker(
      medewerkerId: string,
    ) {
      return prisma.beschikbaarheid.findMany({
        where: {
          medewerkerId,
        },

        include: {
          week: {
            include: {
              vestiging: true,
            },
          },
        },

        orderBy: [
          {
            datum: "asc",
          },
          {
            begintijd: "asc",
          },
        ],
      });
    },

    async getById(id: string) {
      return getBeschikbaarheid(id);
    },

    async create(data: {
      medewerkerId: string;
      weekId: string;
      datum: Date;
      begintijd: Date;
      eindtijd: Date;
      status?: BeschikbaarheidStatus;
      opmerking?: string | null;
      gebruikerId?: string;
    }) {
      if (!data.gebruikerId) {
        throw new Error(
          "Een ingelogde gebruiker is vereist.",
        );
      }

      return this.aanmaken(
        data.medewerkerId,
        data.weekId,
        {
          datum: data.datum,
          begintijd: data.begintijd,
          eindtijd: data.eindtijd,
          status: data.status,
          opmerking: data.opmerking,
        },
        data.gebruikerId,
      );
    },

    async aanmaken(
      medewerkerId: string,
      weekId: string,
      data: BeschikbaarheidData,
      gebruikerId: string,
    ) {
      const toegang =
        await controleerToegangTotMedewerker(
          medewerkerId,
          weekId,
          gebruikerId,
        );

      controleerTijden(
        data.begintijd,
        data.eindtijd,
      );

      controleerStatus(
        data.status,
      );

      if (
        deadlineVerstreken(
          toegang.week
            .beschikbaarheidDeadline,
        ) &&
        !toegang.beheerder
      ) {
        throw new Error(
          "De deadline voor het doorgeven van beschikbaarheid is verstreken.",
        );
      }

      return prisma.beschikbaarheid.create({
        data: {
          weekId,
          medewerkerId,
          datum: data.datum,
          begintijd: data.begintijd,
          eindtijd: data.eindtijd,
          status:
            data.status ??
            "BESCHIKBAAR",
          opmerking:
            data.opmerking ?? null,
        },
      });
    },

    async update(
      id: string,
      data: BeschikbaarheidData,
      medewerkerId?: string,
      gebruikerId?: string,
    ) {
      if (!gebruikerId) {
        throw new Error(
          "Een ingelogde gebruiker is vereist.",
        );
      }

      const bestaande =
        await getBeschikbaarheid(id);

      if (
        medewerkerId &&
        bestaande.medewerkerId !==
          medewerkerId
      ) {
        throw new Error(
          "Je mag alleen je eigen beschikbaarheid wijzigen.",
        );
      }

      const toegang =
        await controleerToegangTotMedewerker(
          bestaande.medewerkerId,
          bestaande.weekId,
          gebruikerId,
        );

      controleerTijden(
        data.begintijd,
        data.eindtijd,
      );

      controleerStatus(
        data.status,
      );

      if (
        deadlineVerstreken(
          bestaande.week
            .beschikbaarheidDeadline,
        ) &&
        !toegang.beheerder
      ) {
        throw new Error(
          "De deadline voor het wijzigen van beschikbaarheid is verstreken. Alleen een eigenaar of teamleider kan nog wijzigingen uitvoeren.",
        );
      }

      return prisma.beschikbaarheid.update({
        where: {
          id,
        },

        data: {
          datum: data.datum,
          begintijd: data.begintijd,
          eindtijd: data.eindtijd,
          status:
            data.status ??
            bestaande.status,
          opmerking:
            data.opmerking ?? null,
        },
      });
    },

    async wijzigen(
      id: string,
      medewerkerId: string,
      data: BeschikbaarheidData,
      gebruikerId: string,
    ) {
      return this.update(
        id,
        data,
        medewerkerId,
        gebruikerId,
      );
    },

    async delete(
      id: string,
      medewerkerId?: string,
      gebruikerId?: string,
    ) {
      if (!gebruikerId) {
        throw new Error(
          "Een ingelogde gebruiker is vereist.",
        );
      }

      const bestaande =
        await getBeschikbaarheid(id);

      if (
        medewerkerId &&
        bestaande.medewerkerId !==
          medewerkerId
      ) {
        throw new Error(
          "Je mag alleen je eigen beschikbaarheid verwijderen.",
        );
      }

      const toegang =
        await controleerToegangTotMedewerker(
          bestaande.medewerkerId,
          bestaande.weekId,
          gebruikerId,
        );

      if (
        deadlineVerstreken(
          bestaande.week
            .beschikbaarheidDeadline,
        ) &&
        !toegang.beheerder
      ) {
        throw new Error(
          "De deadline voor het verwijderen van beschikbaarheid is verstreken. Alleen een eigenaar of teamleider kan nog wijzigingen uitvoeren.",
        );
      }

      return prisma.beschikbaarheid.delete({
        where: {
          id,
        },
      });
    },

    async verwijderen(
      id: string,
      medewerkerId: string,
      gebruikerId: string,
    ) {
      return this.delete(
        id,
        medewerkerId,
        gebruikerId,
      );
    },

    async isBeheerder(
      gebruikerId: string,
      organisatieId?: string,
    ) {
      if (!organisatieId) {
        return false;
      }

      return isBeheerder(
        gebruikerId,
        organisatieId,
      );
    },
  };