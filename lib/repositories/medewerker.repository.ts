import { prisma } from "@/lib/prisma";

export const medewerkerRepository = {
  async findAll() {
    return prisma.medewerker.findMany({
      include: {
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
      },

      orderBy: {
        achternaam: "asc",
      },
    });
  },

  async findById(id: string) {
    return prisma.medewerker.findUnique({
      where: {
        id,
      },

      include: {
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
      },
    });
  },
};