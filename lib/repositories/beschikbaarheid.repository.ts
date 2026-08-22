import { prisma } from "@/lib/prisma";

type BeschikbaarheidStatus =
  | "BESCHIKBAAR"
  | "NIET_BESCHIKBAAR"
  | "VOORKEUR";

type BeschikbaarheidCreateData = {
  weekId: string;
  medewerkerId: string;
  datum: Date;
  begintijd: Date;
  eindtijd: Date;
  status?: BeschikbaarheidStatus;
  opmerking?: string | null;
};

type BeschikbaarheidUpdateData = {
  datum?: Date;
  begintijd?: Date;
  eindtijd?: Date;
  status?: BeschikbaarheidStatus;
  opmerking?: string | null;
};

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

  async create(
    data: BeschikbaarheidCreateData,
  ) {
    return prisma.beschikbaarheid.create({
      data: {
        weekId: data.weekId,
        medewerkerId: data.medewerkerId,
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
    data: BeschikbaarheidUpdateData,
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