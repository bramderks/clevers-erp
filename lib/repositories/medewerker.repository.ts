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
  /*
   * ============================================================
   * ALLE MEDEWERKERS
   * ============================================================
   */

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
        /*
         * STATUS
         */

        status: true,

        /*
         * VESTIGINGEN
         */

        vestigingen: {
          include: {
            vestiging: true,
          },

          orderBy: {
            hoofdvestiging: "desc",
          },
        },

        /*
         * ROLLEN
         */

        rollen: {
          include: {
            rol: true,
          },

          orderBy: {
            rol: {
              naam: "asc",
            },
          },
        },

        /*
         * TAGS
         */

        tags: {
          include: {
            tag: true,
          },

          orderBy: {
            tag: {
              volgorde: "asc",
            },
          },
        },

        /*
         * BESCHIKBAARHEID
         */

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

        /*
         * VAKANTIE
         */

        vakantieAanvragen: {
          orderBy: [
            {
              startDatum: "asc",
            },
            {
              eindDatum: "asc",
            },
          ],

          include: {
            vestiging: true,
          },
        },

        /*
         * PLANNING
         */

        diensten: {
          include: {
            dienst: {
              include: {
                week: true,

                tags: {
                  include: {
                    tag: true,
                  },

                  orderBy: {
                    tag: {
                      volgorde: "asc",
                    },
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

        /*
         * VERLONING
         */

        verloningsRegels: {
          include: {
            verloningsPeriode: true,
            vestiging: true,
          },

          orderBy: {
            verloningsPeriode: {
              periodeStart: "desc",
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

  /*
   * ============================================================
   * MEDEWERKER OP ID
   * ============================================================
   */

  async findById(id: string) {
    return prisma.medewerker.findUnique({
      where: {
        id,
      },

      include: {
        /*
         * SYSTEEMGEBRUIKER
         */

        systeemGebruiker: {
          select: {
            id: true,
            naam: true,
            email: true,
            actief: true,
            laatsteLoginOp: true,
          },
        },

        /*
         * STATUS
         */

        status: true,

        /*
         * VESTIGINGEN
         */

        vestigingen: {
          include: {
            vestiging: true,
          },

          orderBy: {
            hoofdvestiging: "desc",
          },
        },

        /*
         * ROLLEN
         */

        rollen: {
          include: {
            rol: true,
          },

          orderBy: {
            rol: {
              naam: "asc",
            },
          },
        },

        /*
         * TAGS
         */

        tags: {
          include: {
            tag: true,
          },

          orderBy: {
            tag: {
              volgorde: "asc",
            },
          },
        },

        /*
         * BESCHIKBAARHEID
         */

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

        /*
         * VAKANTIE
         */

        vakantieAanvragen: {
          include: {
            vestiging: true,
          },

          orderBy: [
            {
              startDatum: "desc",
            },
            {
              eindDatum: "desc",
            },
          ],
        },

        /*
         * PLANNING
         */

        diensten: {
          include: {
            dienst: {
              include: {
                week: true,

                tags: {
                  include: {
                    tag: true,
                  },

                  orderBy: {
                    tag: {
                      volgorde: "asc",
                    },
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

        /*
         * VERLONING
         */

        verloningsRegels: {
          include: {
            verloningsPeriode: true,
            vestiging: true,
          },

          orderBy: {
            verloningsPeriode: {
              periodeStart: "desc",
            },
          },
        },
      },
    });
  },

  /*
   * ============================================================
   * MEDEWERKER BIJWERKEN
   * ============================================================
   *
   * De repository voert alleen de database-update uit.
   *
   * Welke velden iemand daadwerkelijk mag wijzigen wordt
   * bepaald door de service/API-laag.
   *
   * Vestigingen, rollen, tags en status hebben afzonderlijke
   * methodes.
   */

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
          uurloon:
            data.uurloon,
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

  /*
   * ============================================================
   * STATUS BIJWERKEN
   * ============================================================
   */

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

  /*
   * ============================================================
   * ACTIVEREN
   * ============================================================
   */

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

  /*
   * ============================================================
   * VESTIGINGEN INSTELLEN
   * ============================================================
   */

  async setVestigingen(
    medewerkerId: string,
    vestigingIds: string[],
    hoofdvestigingId: string,
  ) {
    const uniekeVestigingIds =
      Array.from(
        new Set(vestigingIds),
      );

    if (
      uniekeVestigingIds.length ===
      0
    ) {
      throw new Error(
        "Een medewerker moet aan minimaal één vestiging gekoppeld zijn.",
      );
    }

    if (
      !uniekeVestigingIds.includes(
        hoofdvestigingId,
      )
    ) {
      throw new Error(
        "De hoofdvestiging moet ook aan de medewerker gekoppeld zijn.",
      );
    }

    const vestigingen =
      await prisma.vestiging.findMany({
        where: {
          id: {
            in: uniekeVestigingIds,
          },

          actief: true,
        },

        select: {
          id: true,
        },
      });

    if (
      vestigingen.length !==
      uniekeVestigingIds.length
    ) {
      throw new Error(
        "Een medewerker kan alleen aan bestaande en actieve vestigingen worden gekoppeld.",
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

        await tx.medewerkerVestiging.createMany(
          {
            data: uniekeVestigingIds.map(
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

  /*
   * ============================================================
   * ROLLEN INSTELLEN
   * ============================================================
   */

  async setRollen(
    medewerkerId: string,
    rolIds: string[],
  ) {
    const uniekeRolIds =
      Array.from(
        new Set(rolIds),
      );

    return prisma.$transaction(
      async (tx) => {
        await tx.medewerkerRol.deleteMany(
          {
            where: {
              medewerkerId,
            },
          },
        );

        if (
          uniekeRolIds.length > 0
        ) {
          await tx.medewerkerRol.createMany(
            {
              data: uniekeRolIds.map(
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

  /*
   * ============================================================
   * TAGS INSTELLEN
   * ============================================================
   */

  async setTags(
    medewerkerId: string,
    tagIds: string[],
  ) {
    const uniekeTagIds =
      Array.from(
        new Set(tagIds),
      );

    return prisma.$transaction(
      async (tx) => {
        await tx.medewerkerTag.deleteMany(
          {
            where: {
              medewerkerId,
            },
          },
        );

        if (
          uniekeTagIds.length > 0
        ) {
          await tx.medewerkerTag.createMany(
            {
              data: uniekeTagIds.map(
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