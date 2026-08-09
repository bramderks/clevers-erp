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
  const week = await prisma.week.findUnique({
    where: {
      id: weekId,
    },
    include: {
      vestiging: true,
    },
  });

  if (!week) {
    throw new Error("Week niet gevonden.");
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

async function controleerDeadline(
  weekId: string,
) {
  const week = await getWeek(weekId);

  if (
    deadlineVerstreken(
      week.beschikbaarheidDeadline,
    )
  ) {
    throw new Error(
      "De deadline voor het doorgeven van beschikbaarheid is verstreken.",
    );
  }

  return week;
}

async function controleerEigenaar(
  gebruikerId: string,
  organisatieId: string,
) {
  if (!gebruikerId) {
    throw new Error(
      "Een ingelogde gebruiker is vereist.",
    );
  }

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

  const isEigenaar =
    gebruiker.organisaties.some(
      (relatie) =>
        relatie.organisatieId === organisatieId &&
        relatie.actief &&
        relatie.organisatie.actief &&
        relatie.rol.naam.toLowerCase() ===
          "eigenaar",
    );

  if (!isEigenaar) {
    throw new Error(
      "Alleen een eigenaar mag beschikbaarheid na de deadline wijzigen.",
    );
  }

  return gebruiker;
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
          ? { medewerkerId }
          : {}),
      },
      orderBy: [
        { datum: "asc" },
        { begintijd: "asc" },
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
        { datum: "asc" },
        { begintijd: "asc" },
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
  }) {
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
    );
  },

  async aanmaken(
    medewerkerId: string,
    weekId: string,
    data: BeschikbaarheidData,
  ) {
    await controleerDeadline(weekId);

    const medewerker =
      await prisma.medewerker.findUnique({
        where: {
          id: medewerkerId,
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

    controleerTijden(
      data.begintijd,
      data.eindtijd,
    );

    return prisma.beschikbaarheid.create({
      data: {
        weekId,
        medewerkerId,
        datum: data.datum,
        begintijd: data.begintijd,
        eindtijd: data.eindtijd,
        status:
          data.status ?? "BESCHIKBAAR",
        opmerking:
          data.opmerking ?? null,
      },
    });
  },

  async update(
    id: string,
    data: BeschikbaarheidData,
    medewerkerId?: string,
    eigenaarId?: string,
  ) {
    const bestaande =
      await getBeschikbaarheid(id);

    const isEigenaar =
      eigenaarId
        ? await this.isEigenaar(
            eigenaarId,
            bestaande.week.vestiging.organisatieId,
          )
        : false;

    if (
      medewerkerId &&
      bestaande.medewerkerId !== medewerkerId &&
      !isEigenaar
    ) {
      throw new Error(
        "Je mag alleen je eigen beschikbaarheid wijzigen.",
      );
    }

    const deadlineIsVerstreken =
      deadlineVerstreken(
        bestaande.week.beschikbaarheidDeadline,
      );

    if (
      deadlineIsVerstreken &&
      !isEigenaar
    ) {
      throw new Error(
        "De deadline voor het wijzigen van beschikbaarheid is verstreken. Alleen een eigenaar kan nog wijzigingen uitvoeren.",
      );
    }

    controleerTijden(
      data.begintijd,
      data.eindtijd,
    );

    return prisma.beschikbaarheid.update({
      where: {
        id,
      },
      data: {
        datum: data.datum,
        begintijd: data.begintijd,
        eindtijd: data.eindtijd,
        status:
          data.status ?? bestaande.status,
        opmerking:
          data.opmerking ?? null,
      },
    });
  },

  async wijzigen(
    id: string,
    medewerkerId: string,
    data: BeschikbaarheidData,
    eigenaarId?: string,
  ) {
    return this.update(
      id,
      data,
      medewerkerId,
      eigenaarId,
    );
  },

  async delete(
    id: string,
    medewerkerId?: string,
    eigenaarId?: string,
  ) {
    const bestaande =
      await getBeschikbaarheid(id);

    const isEigenaar =
      eigenaarId
        ? await this.isEigenaar(
            eigenaarId,
            bestaande.week.vestiging.organisatieId,
          )
        : false;

    if (
      medewerkerId &&
      bestaande.medewerkerId !== medewerkerId &&
      !isEigenaar
    ) {
      throw new Error(
        "Je mag alleen je eigen beschikbaarheid verwijderen.",
      );
    }

    const deadlineIsVerstreken =
      deadlineVerstreken(
        bestaande.week.beschikbaarheidDeadline,
      );

    if (
      deadlineIsVerstreken &&
      !isEigenaar
    ) {
      throw new Error(
        "De deadline voor het verwijderen van beschikbaarheid is verstreken. Alleen een eigenaar kan nog wijzigingen uitvoeren.",
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
    eigenaarId?: string,
  ) {
    return this.delete(
      id,
      medewerkerId,
      eigenaarId,
    );
  },

  async wijzigNaDeadlineDoorEigenaar(
    id: string,
    eigenaarId: string,
    data: BeschikbaarheidData,
  ) {
    const bestaande =
      await getBeschikbaarheid(id);

    await controleerEigenaar(
      eigenaarId,
      bestaande.week.vestiging.organisatieId,
    );

    controleerTijden(
      data.begintijd,
      data.eindtijd,
    );

    return prisma.beschikbaarheid.update({
      where: {
        id,
      },
      data: {
        datum: data.datum,
        begintijd: data.begintijd,
        eindtijd: data.eindtijd,
        status:
          data.status ?? bestaande.status,
        opmerking:
          data.opmerking ?? null,
      },
    });
  },

  async verwijderenDoorEigenaar(
    id: string,
    eigenaarId: string,
  ) {
    const bestaande =
      await getBeschikbaarheid(id);

    await controleerEigenaar(
      eigenaarId,
      bestaande.week.vestiging.organisatieId,
    );

    return prisma.beschikbaarheid.delete({
      where: {
        id,
      },
    });
  },

  async isEigenaar(
    gebruikerId: string,
    organisatieId?: string,
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

    if (!gebruiker || !gebruiker.actief) {
      return false;
    }

    return gebruiker.organisaties.some(
      (relatie) =>
        relatie.actief &&
        relatie.organisatie.actief &&
        (!organisatieId ||
          relatie.organisatieId ===
            organisatieId) &&
        relatie.rol.naam.toLowerCase() ===
          "eigenaar",
    );
  },
};