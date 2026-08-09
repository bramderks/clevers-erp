import { prisma } from "@/lib/prisma";
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

async function controleerSeizoen(
  vestigingId: string,
  datum: Date,
) {
  const vestiging =
    await prisma.vestiging.findUnique({
      where: {
        id: vestigingId,
      },
      select: {
        id: true,
        seizoenStart: true,
        seizoenEinde: true,
      },
    });

  if (!vestiging) {
    throw new Error(
      "Vestiging niet gevonden.",
    );
  }

  if (
    !vestiging.seizoenStart ||
    !vestiging.seizoenEinde
  ) {
    throw new Error(
      "Voor deze vestiging is geen volledig seizoen ingesteld.",
    );
  }

  const controleDatum =
    new Date(datum);

  controleDatum.setHours(
    0,
    0,
    0,
    0,
  );

  const seizoenStart =
    new Date(
      vestiging.seizoenStart,
    );

  seizoenStart.setHours(
    0,
    0,
    0,
    0,
  );

  const seizoenEinde =
    new Date(
      vestiging.seizoenEinde,
    );

  seizoenEinde.setHours(
    23,
    59,
    59,
    999,
  );

  if (
    controleDatum < seizoenStart ||
    controleDatum > seizoenEinde
  ) {
    throw new Error(
      "Deze datum valt buiten het ingestelde seizoen.",
    );
  }

  return vestiging;
}

async function getDatumVanISOWeek(
  jaar: number,
  weeknummer: number,
): Promise<Date> {
  const januariVier =
    new Date(
      Date.UTC(jaar, 0, 4),
    );

  const dag =
    januariVier.getUTCDay() || 7;

  const maandagEersteWeek =
    new Date(januariVier);

  maandagEersteWeek.setUTCDate(
    januariVier.getUTCDate() -
      dag +
      1,
  );

  const maandag =
    new Date(
      maandagEersteWeek,
    );

  maandag.setUTCDate(
    maandag.getUTCDate() +
      (weeknummer - 1) * 7,
  );

  return maandag;
}

async function controleerWeekBinnenSeizoen(
  vestigingId: string,
  jaar: number,
  weeknummer: number,
) {
  const weekStart =
    await getDatumVanISOWeek(
      jaar,
      weeknummer,
    );

  const weekEinde =
    new Date(weekStart);

  weekEinde.setUTCDate(
    weekEinde.getUTCDate() + 6,
  );

  const vestiging =
    await prisma.vestiging.findUnique({
      where: {
        id: vestigingId,
      },
      select: {
        id: true,
        seizoenStart: true,
        seizoenEinde: true,
      },
    });

  if (!vestiging) {
    throw new Error(
      "Vestiging niet gevonden.",
    );
  }

  if (
    !vestiging.seizoenStart ||
    !vestiging.seizoenEinde
  ) {
    throw new Error(
      "Voor deze vestiging is geen volledig seizoen ingesteld.",
    );
  }

  const seizoenStart =
    new Date(
      vestiging.seizoenStart,
    );

  const seizoenEinde =
    new Date(
      vestiging.seizoenEinde,
    );

  seizoenStart.setHours(
    0,
    0,
    0,
    0,
  );

  seizoenEinde.setHours(
    23,
    59,
    59,
    999,
  );

  const start =
    new Date(weekStart);

  const einde =
    new Date(weekEinde);

  start.setHours(
    0,
    0,
    0,
    0,
  );

  einde.setHours(
    23,
    59,
    59,
    999,
  );

  if (
    einde < seizoenStart ||
    start > seizoenEinde
  ) {
    throw new Error(
      "Deze planningweek valt buiten het ingestelde seizoen.",
    );
  }

  return vestiging;
}

export const weekService = {
  async getById(
    id: string,
  ) {
    const week =
      await weekRepository.findById(
        id,
      );

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
    if (
      !(datum instanceof Date) ||
      Number.isNaN(
        datum.getTime(),
      )
    ) {
      throw new Error(
        "Ongeldige datum.",
      );
    }

    await controleerSeizoen(
      vestigingId,
      datum,
    );

    const {
      jaar,
      weeknummer,
    } = getISOWeek(datum);

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

    await controleerWeekBinnenSeizoen(
      vestigingId,
      jaar,
      weeknummer,
    );

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