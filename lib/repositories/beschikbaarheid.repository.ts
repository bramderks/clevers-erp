import { prisma } from "@/lib/prisma";

export const beschikbaarheidRepository = {
  async findByMedewerker(
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

  async findByMedewerkerAndWeek(
    medewerkerId: string,
    weekId: string,
  ) {
    return prisma.beschikbaarheid.findMany({
      where: {
        medewerkerId,
        weekId,
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

  async findById(id: string) {
    return prisma.beschikbaarheid.findUnique({
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
  },

  async create(data: {
    weekId: string;
    medewerkerId: string;
    datum: Date;
    begintijd: Date;
    eindtijd: Date;
    status?: string;
    opmerking?: string | null;
  }) {
    return prisma.beschikbaarheid.create({
      data: {
        weekId: data.weekId,
        medewerkerId: data.medewerkerId,
        datum: data.datum,
        begintijd: data.begintijd,
        eindtijd: data.eindtijd,
        status: data.status ?? "BESCHIKBAAR",
        opmerking: data.opmerking ?? null,
      },
    });
  },

  async update(
    id: string,
    data: {
      datum?: Date;
      begintijd?: Date;
      eindtijd?: Date;
      status?: string;
      opmerking?: string | null;
    },
  ) {
    return prisma.beschikbaarheid.update({
      where: {
        id,
      },
      data,
    });
  },

  async delete(id: string) {
    return prisma.beschikbaarheid.delete({
      where: {
        id,
      },
    });
  },

  async deleteByMedewerkerAndWeek(
    medewerkerId: string,
    weekId: string,
  ) {
    return prisma.beschikbaarheid.deleteMany({
      where: {
        medewerkerId,
        weekId,
      },
    });
  },
};