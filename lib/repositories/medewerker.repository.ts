import { prisma } from "@/lib/prisma";

type MedewerkerUpdateData = {
  personeelsnummer?: string | null;

  aanhef?:
    | "DHR"
    | "MEVR"
    | "ANDERS"
    | "GEEN_OPGAVE";

  voornaam?: string;
  tussenvoegsel?: string | null;
  achternaam?: string;
  roepnaam?: string | null;

  geboortedatum?: Date;

  email?: string;
  telefoon?: string;

  contractType?:
    | "OPROEP"
    | "VAST"
    | null;

  contractUren?: number | null;
  uurloon?: number | null;

  datumInDienst?: Date | null;
  datumUitDienst?: Date | null;
};

type FindAllOptions = {
  organisatieIds?: string[];
  vestigingIds?: string[];
};

export const medewerkerRepository = {
  async findAll(
    options: FindAllOptions = {},
  ) {
    const {
      organisatieIds,
      vestigingIds,
    } = options;

    const heeftOrganisatieFilter =
      organisatieIds !== undefined;

    const heeftVestigingFilter =
      vestigingIds !== undefined;

    return prisma.medewerker.findMany({
      where: {
        ...(heeftOrganisatieFilter ||
        heeftVestigingFilter
          ? {
              vestigingen: {
                some: {
                  ...(heeftOrganisatieFilter
                    ? {
                        vestiging: {
                          organisatieId: {
                            in:
                              organisatieIds ?? [],
                          },
                        },
                      }
                    : {}),

                  ...(heeftVestigingFilter
                    ? {
                        vestigingId: {
                          in:
                            vestigingIds ?? [],
                        },
                      }
                    : {}),
                },
              },
            }
          : {}),
      },

      include: {
        status: true,

        vestigingen: {
          include: {
            vestiging: true,
          },
        },

        rollen: {
          include: {
            rol: true,
          },
        },

        tags: {
          include: {
            tag: true,
          },
        },

        beschikbaarheden: {
          orderBy: [
            {
              datum: "asc",
            },
            {
              begintijd: "asc",
            },
          ],
        },

        diensten: {
          include: {
            dienst: {
              include: {
                week: true,

                tags: {
                  include: {
                    tag: true,
                  },
                },
              },
            },
          },

          orderBy: {
            dienst: {
              datum: "asc",
            },
          },
        },
      },

      orderBy: [
        {
          achternaam: "asc",
        },
        {
          voornaam: "asc",
        },
      ],
    });
  },

  async findById(id: string) {
    return prisma.medewerker.findUnique({
      where: {
        id,
      },

      include: {
        status: true,

        vestigingen: {
          include: {
            vestiging: true,
          },
        },

        rollen: {
          include: {
            rol: true,
          },
        },

        tags: {
          include: {
            tag: true,
          },
        },

        beschikbaarheden: {
          orderBy: [
            {
              datum: "asc",
            },
            {
              begintijd: "asc",
            },
          ],
        },

        diensten: {
          include: {
            dienst: {
              include: {
                week: true,

                tags: {
                  include: {
                    tag: true,
                  },
                },
              },
            },
          },

          orderBy: {
            dienst: {
              datum: "asc",
            },
          },
        },
      },
    });
  },

  async update(
    id: string,
    data: MedewerkerUpdateData,
  ) {
    return prisma.medewerker.update({
      where: {
        id,
      },

      data: {
        ...(data.personeelsnummer !==
          undefined && {
          personeelsnummer:
            data.personeelsnummer,
        }),

        ...(data.aanhef !==
          undefined && {
          aanhef: data.aanhef,
        }),

        ...(data.voornaam !==
          undefined && {
          voornaam: data.voornaam,
        }),

        ...(data.tussenvoegsel !==
          undefined && {
          tussenvoegsel:
            data.tussenvoegsel,
        }),

        ...(data.achternaam !==
          undefined && {
          achternaam: data.achternaam,
        }),

        ...(data.roepnaam !==
          undefined && {
          roepnaam: data.roepnaam,
        }),

        ...(data.geboortedatum !==
          undefined && {
          geboortedatum:
            data.geboortedatum,
        }),

        ...(data.email !==
          undefined && {
          email: data.email,
        }),

        ...(data.telefoon !==
          undefined && {
          telefoon: data.telefoon,
        }),

        ...(data.contractType !==
          undefined && {
          contractType:
            data.contractType,
        }),

        ...(data.contractUren !==
          undefined && {
          contractUren:
            data.contractUren,
        }),

        ...(data.uurloon !==
          undefined && {
          uurloon: data.uurloon,
        }),

        ...(data.datumInDienst !==
          undefined && {
          datumInDienst:
            data.datumInDienst,
        }),

        ...(data.datumUitDienst !==
          undefined && {
          datumUitDienst:
            data.datumUitDienst,
        }),
      },
    });
  },

  async updateStatus(
    id: string,
    statusId: string,
    actief?: boolean,
  ) {
    return prisma.medewerker.update({
      where: {
        id,
      },

      data: {
        statusId,

        ...(actief !== undefined && {
          actief,
        }),
      },
    });
  },

  async setActivatie(
    id: string,
    statusId: string,
    geactiveerdDoor: string,
  ) {
    return prisma.medewerker.update({
      where: {
        id,
      },

      data: {
        statusId,
        actief: true,
        geactiveerdOp: new Date(),
        geactiveerdDoor,
      },
    });
  },

  async setVestigingen(
    medewerkerId: string,
    vestigingIds: string[],
    hoofdvestigingId: string,
  ) {
    if (
      !vestigingIds.includes(
        hoofdvestigingId,
      )
    ) {
      throw new Error(
        "De hoofdvestiging moet ook aan de medewerker gekoppeld zijn.",
      );
    }

    return prisma.$transaction(
      async (tx) => {
        await tx.medewerkerVestiging.deleteMany(
          {
            where: {
              medewerkerId,
            },
          },
        );

        if (vestigingIds.length > 0) {
          await tx.medewerkerVestiging.createMany(
            {
              data: vestigingIds.map(
                (vestigingId) => ({
                  medewerkerId,
                  vestigingId,
                  hoofdvestiging:
                    vestigingId ===
                    hoofdvestigingId,
                }),
              ),
            },
          );
        }

        return tx.medewerkerVestiging.findMany(
          {
            where: {
              medewerkerId,
            },

            include: {
              vestiging: true,
            },

            orderBy: {
              hoofdvestiging: "desc",
            },
          },
        );
      },
    );
  },

  async setRollen(
    medewerkerId: string,
    rolIds: string[],
  ) {
    return prisma.$transaction(
      async (tx) => {
        await tx.medewerkerRol.deleteMany(
          {
            where: {
              medewerkerId,
            },
          },
        );

        if (rolIds.length > 0) {
          await tx.medewerkerRol.createMany(
            {
              data: rolIds.map(
                (rolId) => ({
                  medewerkerId,
                  rolId,
                }),
              ),
            },
          );
        }

        return tx.medewerkerRol.findMany(
          {
            where: {
              medewerkerId,
            },

            include: {
              rol: true,
            },

            orderBy: {
              rol: {
                naam: "asc",
              },
            },
          },
        );
      },
    );
  },

  async setTags(
    medewerkerId: string,
    tagIds: string[],
  ) {
    return prisma.$transaction(
      async (tx) => {
        await tx.medewerkerTag.deleteMany(
          {
            where: {
              medewerkerId,
            },
          },
        );

        if (tagIds.length > 0) {
          await tx.medewerkerTag.createMany(
            {
              data: tagIds.map(
                (tagId) => ({
                  medewerkerId,
                  tagId,
                }),
              ),
            },
          );
        }

        return tx.medewerkerTag.findMany(
          {
            where: {
              medewerkerId,
            },

            include: {
              tag: true,
            },

            orderBy: {
              tag: {
                volgorde: "asc",
              },
            },
          },
        );
      },
    );
  },
};