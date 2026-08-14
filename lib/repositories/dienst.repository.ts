import { prisma } from "@/lib/prisma";

export const dienstRepository = {
  async findById(id: string) {
    return prisma.dienst.findUnique({
      where: {
        id,
      },
      include: {
        week: {
          include: {
            vestiging: true,
          },
        },
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
        bezetting: {
          include: {
            medewerker: true,
          },
          orderBy: {
            aangemaaktOp: "asc",
          },
        },
      },
    });
  },

  async findByWeek(weekId: string) {
    return prisma.dienst.findMany({
      where: {
        weekId,
      },
      include: {
        week: {
          include: {
            vestiging: true,
          },
        },
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
        bezetting: {
          include: {
            medewerker: true,
          },
          orderBy: {
            aangemaaktOp: "asc",
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

  async create(data: {
    weekId: string;
    datum: Date;
    begintijd: Date;
    eindtijd: Date;
    opmerkingen?: string | null;
  }) {
    return prisma.dienst.create({
      data: {
        weekId: data.weekId,
        datum: data.datum,
        begintijd: data.begintijd,
        eindtijd: data.eindtijd,
        opmerkingen:
          data.opmerkingen ?? null,
      },
      include: {
        week: {
          include: {
            vestiging: true,
          },
        },
        tags: {
          include: {
            tag: true,
          },
        },
        bezetting: {
          include: {
            medewerker: true,
          },
        },
      },
    });
  },

  async update(
    id: string,
    data: {
      datum?: Date;
      begintijd?: Date;
      eindtijd?: Date;
      opmerkingen?: string | null;
    },
  ) {
    return prisma.dienst.update({
      where: {
        id,
      },
      data,
      include: {
        week: {
          include: {
            vestiging: true,
          },
        },
        tags: {
          include: {
            tag: true,
          },
        },
        bezetting: {
          include: {
            medewerker: true,
          },
        },
      },
    });
  },

  async delete(id: string) {
    return prisma.dienst.delete({
      where: {
        id,
      },
    });
  },

  async setTags(
    dienstId: string,
    tags: Array<{
      tagId: string;
      aantal: number;
    }>,
  ) {
    return prisma.$transaction(
      async (tx) => {
        await tx.dienstTag.deleteMany({
          where: {
            dienstId,
          },
        });

        if (tags.length > 0) {
          await tx.dienstTag.createMany({
            data: tags.map((tag) => ({
              dienstId,
              tagId: tag.tagId,
              aantal: tag.aantal,
            })),
          });
        }

        return tx.dienst.findUniqueOrThrow({
          where: {
            id: dienstId,
          },
          include: {
            week: {
              include: {
                vestiging: true,
              },
            },
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
            bezetting: {
              include: {
                medewerker: true,
              },
            },
          },
        });
      },
    );
  },

  async createBezetting(
    dienstId: string,
    medewerkerId: string | null,
  ) {
    return prisma.dienstBezetting.create({
      data: {
        dienstId,
        medewerkerId,
        status: medewerkerId
          ? "GEPLAND"
          : "OPEN",
      },
      include: {
        medewerker: true,
        dienst: true,
      },
    });
  },

  async findBezettingById(
    id: string,
  ) {
    return prisma.dienstBezetting.findUnique({
      where: {
        id,
      },
      include: {
        dienst: {
          include: {
            week: {
              include: {
                vestiging: true,
              },
            },
            tags: {
              include: {
                tag: true,
              },
            },
          },
        },
        medewerker: true,
      },
    });
  },

  async assignMedewerker(
    bezettingId: string,
    medewerkerId: string,
  ) {
    return prisma.dienstBezetting.update({
      where: {
        id: bezettingId,
      },
      data: {
        medewerkerId,
        status: "GEPLAND",
      },
      include: {
        dienst: true,
        medewerker: true,
      },
    });
  },

  async removeMedewerker(
    bezettingId: string,
  ) {
    return prisma.dienstBezetting.update({
      where: {
        id: bezettingId,
      },
      data: {
        medewerkerId: null,
        status: "OPEN",
      },
      include: {
        dienst: true,
        medewerker: true,
      },
    });
  },

  async updateBezettingStatus(
    bezettingId: string,
    status: string,
  ) {
    return prisma.dienstBezetting.update({
      where: {
        id: bezettingId,
      },
      data: {
        status,
      },
      include: {
        dienst: true,
        medewerker: true,
      },
    });
  },

  async deleteBezetting(
    bezettingId: string,
  ) {
    return prisma.dienstBezetting.delete({
      where: {
        id: bezettingId,
      },
    });
  },
};