import { prisma } from "@/lib/prisma";

import { dienstRepository } from "@/lib/repositories/dienst.repository";
import { weekService } from "@/lib/services/week.service";

type DienstTagInput = {
  tagId: string;
  aantal?: number;
};

type DienstCreateInput = {
  datum: Date;
  begintijd: Date;
  eindtijd?: Date;
  opmerkingen?: string | null;
};

type DienstUpdateInput = {
  datum?: Date;
  begintijd?: Date;
  eindtijd?: Date;
  opmerkingen?: string | null;
};

const SLUITINGSTIJD_UUR = 23;
const SLUITINGSTIJD_MINUUT = 0;

function controleerDatum(datum: Date) {
  if (
    !(datum instanceof Date) ||
    Number.isNaN(datum.getTime())
  ) {
    throw new Error("Ongeldige datum.");
  }
}

function controleerTijd(
  tijd: Date,
  veldnaam: string,
) {
  if (
    !(tijd instanceof Date) ||
    Number.isNaN(tijd.getTime())
  ) {
    throw new Error(`${veldnaam} is ongeldig.`);
  }
}

function maakSluitingstijd(datum: Date) {
  const sluiting = new Date(datum);

  sluiting.setHours(
    SLUITINGSTIJD_UUR,
    SLUITINGSTIJD_MINUUT,
    0,
    0,
  );

  return sluiting;
}

function normaliseerEindtijd(
  datum: Date,
  eindtijd?: Date,
) {
  if (!eindtijd) {
    return maakSluitingstijd(datum);
  }

  return eindtijd;
}

function controleerTijden(
  begintijd: Date,
  eindtijd: Date,
) {
  controleerTijd(
    begintijd,
    "Begintijd",
  );

  controleerTijd(
    eindtijd,
    "Eindtijd",
  );

  if (eindtijd <= begintijd) {
    throw new Error(
      "De eindtijd moet na de begintijd liggen.",
    );
  }
}

function zelfdeDag(
  eerste: Date,
  tweede: Date,
) {
  return (
    eerste.getFullYear() ===
      tweede.getFullYear() &&
    eerste.getMonth() ===
      tweede.getMonth() &&
    eerste.getDate() ===
      tweede.getDate()
  );
}

function controleerTijdBinnenDienst(
  datum: Date,
  begintijd: Date,
  eindtijd: Date,
) {
  if (
    !zelfdeDag(datum, begintijd) ||
    !zelfdeDag(datum, eindtijd)
  ) {
    throw new Error(
      "De begin- en eindtijd moeten op dezelfde datum als de dienst liggen.",
    );
  }
}

function normaliseerTags(
  tags: DienstTagInput[] = [],
) {
  const uniekeTags = new Map<
    string,
    number
  >();

  for (const tag of tags) {
    if (
      !tag ||
      typeof tag.tagId !== "string" ||
      tag.tagId.trim() === ""
    ) {
      throw new Error(
        "Iedere planningstag moet een geldig tagId bevatten.",
      );
    }

    const aantal = tag.aantal ?? 1;

    if (
      !Number.isInteger(aantal) ||
      aantal < 1
    ) {
      throw new Error(
        "Het aantal medewerkers per planningstag moet minimaal 1 zijn.",
      );
    }

    uniekeTags.set(
      tag.tagId,
      aantal,
    );
  }

  return Array.from(
    uniekeTags.entries(),
  ).map(([tagId, aantal]) => ({
    tagId,
    aantal,
  }));
}

async function controleerTags(
  tags: Array<{
    tagId: string;
    aantal: number;
  }>,
) {
  if (tags.length === 0) {
    return;
  }

  const tagIds = [
    ...new Set(
      tags.map(
        (tag) => tag.tagId,
      ),
    ),
  ];

  const bestaandeTags =
    await prisma.tag.findMany({
      where: {
        id: {
          in: tagIds,
        },
        actief: true,
      },
      select: {
        id: true,
      },
    });

  if (
    bestaandeTags.length !==
    tagIds.length
  ) {
    throw new Error(
      "Een of meer planningstags bestaan niet of zijn niet actief.",
    );
  }
}

async function controleerWeek(
  weekId: string,
  datum: Date,
) {
  const week =
    await weekService.getById(
      weekId,
    );

  const datumWeek =
    getISOWeek(datum);

  if (
    datumWeek.jaar !== week.jaar ||
    datumWeek.weeknummer !==
      week.weeknummer
  ) {
    throw new Error(
      "De dienstdatum valt niet binnen de opgegeven planningweek.",
    );
  }

  return week;
}

async function controleerOverlap(
  weekId: string,
  datum: Date,
  begintijd: Date,
  eindtijd: Date,
  uitgeslotenDienstId?: string,
) {
  const diensten =
    await dienstRepository.findByWeek(
      weekId,
    );

  const conflict =
    diensten.some((dienst) => {
      if (
        dienst.id ===
        uitgeslotenDienstId
      ) {
        return false;
      }

      if (
        !zelfdeDag(
          dienst.datum,
          datum,
        )
      ) {
        return false;
      }

      return (
        begintijd < dienst.eindtijd &&
        eindtijd > dienst.begintijd
      );
    });

  if (conflict) {
    throw new Error(
      "Deze dienst overlapt met een bestaande dienst op dezelfde datum.",
    );
  }
}

function getISOWeek(date: Date): {
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
    donderdag.getUTCDate() +
      4 -
      dag,
  );

  const jaar =
    donderdag.getUTCFullYear();

  const eersteDonderdag =
    new Date(
      Date.UTC(
        jaar,
        0,
        4,
      ),
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

export const dienstService = {
  async getById(id: string) {
    const dienst =
      await dienstRepository.findById(
        id,
      );

    if (!dienst) {
      throw new Error(
        "Dienst niet gevonden.",
      );
    }

    return dienst;
  },

  async getByWeek(
    weekId: string,
  ) {
    return dienstRepository.findByWeek(
      weekId,
    );
  },

  async create(
    weekId: string,
    data: DienstCreateInput,
  ) {
    controleerDatum(data.datum);

    const eindtijd =
      normaliseerEindtijd(
        data.datum,
        data.eindtijd,
      );

    controleerTijden(
      data.begintijd,
      eindtijd,
    );

    controleerTijdBinnenDienst(
      data.datum,
      data.begintijd,
      eindtijd,
    );

    const week =
      await controleerWeek(
        weekId,
        data.datum,
      );

    const sluitingstijd =
      maakSluitingstijd(
        data.datum,
      );

    if (
      eindtijd >
      sluitingstijd
    ) {
      throw new Error(
        "De eindtijd kan niet na 23:00 liggen.",
      );
    }

    await controleerOverlap(
      week.id,
      data.datum,
      data.begintijd,
      eindtijd,
    );

    return dienstRepository.create({
      weekId: week.id,
      datum: data.datum,
      begintijd: data.begintijd,
      eindtijd,
      opmerkingen:
        data.opmerkingen ?? null,
    });
  },

  async update(
    id: string,
    data: DienstUpdateInput,
  ) {
    const bestaandeDienst =
      await this.getById(id);

    const datum =
      data.datum ??
      bestaandeDienst.datum;

    const begintijd =
      data.begintijd ??
      bestaandeDienst.begintijd;

    const eindtijd =
      normaliseerEindtijd(
        datum,
        data.eindtijd ??
          bestaandeDienst.eindtijd,
      );

    controleerDatum(datum);

    controleerTijden(
      begintijd,
      eindtijd,
    );

    controleerTijdBinnenDienst(
      datum,
      begintijd,
      eindtijd,
    );

    const sluitingstijd =
      maakSluitingstijd(datum);

    if (
      eindtijd >
      sluitingstijd
    ) {
      throw new Error(
        "De eindtijd kan niet na 23:00 liggen.",
      );
    }

    await controleerWeek(
      bestaandeDienst.weekId,
      datum,
    );

    await controleerOverlap(
      bestaandeDienst.weekId,
      datum,
      begintijd,
      eindtijd,
      id,
    );

    const heeftGewerkteBezetting =
      bestaandeDienst.bezetting.some(
        (bezetting) =>
          bezetting.status ===
          "GEWERKT",
      );

    if (
      heeftGewerkteBezetting
    ) {
      throw new Error(
        "Deze dienst kan niet meer worden gewijzigd omdat de dienst als gewerkt is geregistreerd.",
      );
    }

    return dienstRepository.update(
      id,
      {
        datum,
        begintijd,
        eindtijd,
        opmerkingen:
          data.opmerkingen !==
          undefined
            ? data.opmerkingen
            : bestaandeDienst.opmerkingen,
      },
    );
  },

  async setTags(
    dienstId: string,
    tags: DienstTagInput[],
  ) {
    const dienst =
      await this.getById(
        dienstId,
      );

    const heeftGewerkteBezetting =
      dienst.bezetting.some(
        (bezetting) =>
          bezetting.status ===
          "GEWERKT",
      );

    if (
      heeftGewerkteBezetting
    ) {
      throw new Error(
        "De planningstags kunnen niet meer worden gewijzigd omdat de dienst als gewerkt is geregistreerd.",
      );
    }

    const genormaliseerdeTags =
      normaliseerTags(tags);

    await controleerTags(
      genormaliseerdeTags,
    );

    return dienstRepository.setTags(
      dienstId,
      genormaliseerdeTags,
    );
  },

  async delete(id: string) {
    const dienst =
      await this.getById(id);

    const heeftGewerkteBezetting =
      dienst.bezetting.some(
        (bezetting) =>
          bezetting.status ===
          "GEWERKT",
      );

    if (
      heeftGewerkteBezetting
    ) {
      throw new Error(
        "Deze dienst kan niet worden verwijderd omdat de dienst als gewerkt is geregistreerd.",
      );
    }

    return dienstRepository.delete(
      id,
    );
  },

  async createBezetting(
    dienstId: string,
    medewerkerId: string | null = null,
  ) {
    const dienst =
      await this.getById(
        dienstId,
      );

    const heeftGewerkteBezetting =
      dienst.bezetting.some(
        (bezetting) =>
          bezetting.status ===
          "GEWERKT",
      );

    if (
      heeftGewerkteBezetting
    ) {
      throw new Error(
        "Aan een gewerkte dienst kan geen nieuwe bezetting worden toegevoegd.",
      );
    }

    if (medewerkerId) {
      const medewerker =
        await prisma.medewerker.findUnique(
          {
            where: {
              id: medewerkerId,
            },
            select: {
              id: true,
              actief: true,
            },
          },
        );

      if (!medewerker) {
        throw new Error(
          "Medewerker niet gevonden.",
        );
      }

      if (!medewerker.actief) {
        throw new Error(
          "Deze medewerker is niet actief.",
        );
      }

      const alGekoppeld =
        dienst.bezetting.some(
          (bezetting) =>
            bezetting.medewerkerId ===
            medewerkerId,
        );

      if (alGekoppeld) {
        throw new Error(
          "Deze medewerker is al aan deze dienst gekoppeld.",
        );
      }
    }

    return dienstRepository.createBezetting(
      dienstId,
      medewerkerId,
    );
  },

  async assignMedewerker(
    bezettingId: string,
    medewerkerId: string,
  ) {
    const bezetting =
      await dienstRepository.findBezettingById(
        bezettingId,
      );

    if (!bezetting) {
      throw new Error(
        "Dienstbezetting niet gevonden.",
      );
    }

    if (
      bezetting.status ===
      "GEWERKT"
    ) {
      throw new Error(
        "Een gewerkte dienst kan niet opnieuw worden ingepland.",
      );
    }

    const medewerker =
      await prisma.medewerker.findUnique(
        {
          where: {
            id: medewerkerId,
          },
          select: {
            id: true,
            actief: true,
          },
        },
      );

    if (!medewerker) {
      throw new Error(
        "Medewerker niet gevonden.",
      );
    }

    if (!medewerker.actief) {
      throw new Error(
        "Deze medewerker is niet actief.",
      );
    }

    return dienstRepository.assignMedewerker(
      bezettingId,
      medewerkerId,
    );
  },

  async removeMedewerker(
    bezettingId: string,
  ) {
    const bezetting =
      await dienstRepository.findBezettingById(
        bezettingId,
      );

    if (!bezetting) {
      throw new Error(
        "Dienstbezetting niet gevonden.",
      );
    }

    if (
      bezetting.status ===
      "GEWERKT"
    ) {
      throw new Error(
        "Een gewerkte dienst kan niet meer worden gewijzigd.",
      );
    }

    return dienstRepository.removeMedewerker(
      bezettingId,
    );
  },

  async updateBezettingStatus(
    bezettingId: string,
    status:
      | "OPEN"
      | "GEPLAND"
      | "BEVESTIGD"
      | "AFGEZEGD"
      | "GEWERKT",
  ) {
    const bezetting =
      await dienstRepository.findBezettingById(
        bezettingId,
      );

    if (!bezetting) {
      throw new Error(
        "Dienstbezetting niet gevonden.",
      );
    }

    if (
      bezetting.status ===
        "GEWERKT" &&
      status !== "GEWERKT"
    ) {
      throw new Error(
        "Een gewerkte dienst kan niet worden teruggezet.",
      );
    }

    return dienstRepository.updateBezettingStatus(
      bezettingId,
      status,
    );
  },
};