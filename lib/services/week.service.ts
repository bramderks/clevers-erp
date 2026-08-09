import { weekRepository } from "@/lib/repositories/week.repository";

function getISOWeek(
  date: Date,
): {
  jaar: number;
  weeknummer: number;
} {
  const donderdag = new Date(
    Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    ),
  );

  const dag =
    donderdag.getUTCDay() || 7;

  donderdag.setUTCDate(
    donderdag.getUTCDate() + 4 - dag,
  );

  const jaar =
    donderdag.getUTCFullYear();

  const eersteDonderdag =
    new Date(
      Date.UTC(jaar, 0, 4),
    );

  const eersteDag =
    eersteDonderdag.getUTCDay() || 7;

  const weeknummer = Math.ceil(
    (
      (donderdag.getTime() -
        eersteDonderdag.getTime()) /
        86400000 +
      eersteDag -
      1
    ) /
      7,
  );

  return {
    jaar,
    weeknummer,
  };
}

export const weekService = {
  async getById(id: string) {
    const week =
      await weekRepository.findById(id);

    if (!week) {
      throw new Error(
        "Week niet gevonden.",
      );
    }

    return week;
  },

  async getByVestiging(
    vestigingId: string,
  ) {
    return weekRepository.findByVestiging(
      vestigingId,
    );
  },

  async getByVestigingAndWeek(
    vestigingId: string,
    jaar: number,
    weeknummer: number,
  ) {
    return weekRepository.findByVestigingAndWeek(
      vestigingId,
      jaar,
      weeknummer,
    );
  },

  async getOfMaakVoorDatum(
    vestigingId: string,
    datum: Date,
  ) {
    const { jaar, weeknummer } =
      getISOWeek(datum);

    return weekRepository.findOrCreate(
      vestigingId,
      jaar,
      weeknummer,
    );
  },

  async getOfMaak(
    vestigingId: string,
    jaar: number,
    weeknummer: number,
  ) {
    if (
      weeknummer < 1 ||
      weeknummer > 53
    ) {
      throw new Error(
        "Het weeknummer moet tussen 1 en 53 liggen.",
      );
    }

    return weekRepository.findOrCreate(
      vestigingId,
      jaar,
      weeknummer,
    );
  },

  async wijzigBeschikbaarheidDeadline(
    id: string,
    deadline: Date | null,
  ) {
    await this.getById(id);

    if (deadline) {
      if (
        Number.isNaN(
          deadline.getTime(),
        )
      ) {
        throw new Error(
          "De beschikbaarheidsdeadline is ongeldig.",
        );
      }
    }

    return weekRepository.updateBeschikbaarheidDeadline(
      id,
      deadline,
    );
  },
};