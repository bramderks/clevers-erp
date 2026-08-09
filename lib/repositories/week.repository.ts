import { prisma } from "@/lib/prisma";

export const weekRepository = {
  async findById(id: string) {
    return prisma.week.findUnique({
      where: {
        id,
      },
      include: {
        vestiging: true,
        diensten: {
          orderBy: [
            {
              datum: "asc",
            },
            {
              begintijd: "asc",
            },
          ],
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
      },
    });
  },

  async findByVestigingAndWeek(
    vestigingId: string,
    jaar: number,
    weeknummer: number,
  ) {
    return prisma.week.findUnique({
      where: {
        vestigingId_jaar_weeknummer: {
          vestigingId,
          jaar,
          weeknummer,
        },
      },
      include: {
        vestiging: true,
        diensten: {
          orderBy: [
            {
              datum: "asc",
            },
            {
              begintijd: "asc",
            },
          ],
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
      },
    });
  },

  async findByVestiging(
    vestigingId: string,
  ) {
    return prisma.week.findMany({
      where: {
        vestigingId,
      },
      include: {
        vestiging: true,
      },
      orderBy: [
        {
          jaar: "desc",
        },
        {
          weeknummer: "desc",
        },
      ],
    });
  },

  async create(data: {
    vestigingId: string;
    jaar: number;
    weeknummer: number;
    status?: string;
    beschikbaarheidDeadline?: Date | null;
  }) {
    return prisma.week.create({
      data: {
        vestigingId: data.vestigingId,
        jaar: data.jaar,
        weeknummer: data.weeknummer,
        status: data.status ?? "OPEN",
        beschikbaarheidDeadline:
          data.beschikbaarheidDeadline ?? null,
      },
      include: {
        vestiging: true,
      },
    });
  },

  async updateBeschikbaarheidDeadline(
    id: string,
    deadline: Date | null,
  ) {
    return prisma.week.update({
      where: {
        id,
      },
      data: {
        beschikbaarheidDeadline:
          deadline,
      },
      include: {
        vestiging: true,
      },
    });
  },

  async findOrCreate(
    vestigingId: string,
    jaar: number,
    weeknummer: number,
  ) {
    const bestaandeWeek =
      await this.findByVestigingAndWeek(
        vestigingId,
        jaar,
        weeknummer,
      );

    if (bestaandeWeek) {
      return bestaandeWeek;
    }

    return this.create({
      vestigingId,
      jaar,
      weeknummer,
    });
  },
};