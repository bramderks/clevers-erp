import { prisma } from "@/lib/prisma";
import { medewerkerRepository } from "@/lib/repositories/medewerker.repository";

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

type EigenGegevensUpdateData = {
  aanhef?:
    | "DHR"
    | "MEVR"
    | "ANDERS"
    | "GEEN_OPGAVE";

  voornaam?: string;
  tussenvoegsel?: string | null;
  achternaam?: string;
  roepnaam?: string | null;
  email?: string;
  telefoon?: string;
};

type MedewerkerFilter = {
  vestigingIds?: string[];
};

async function getStatusId(
  code: string,
) {
  const status =
    await prisma.status.findUnique({
      where: {
        module_code: {
          module: "MEDEWERKER",
          code,
        },
      },
    });

  if (!status) {
    throw new Error(
      `Medewerkerstatus '${code}' is niet gevonden. Controleer de database-seed.`,
    );
  }

  return status.id;
}

function controleerEigenGegevens(
  data: EigenGegevensUpdateData,
) {
  if (
    data.voornaam !== undefined &&
    !data.voornaam.trim()
  ) {
    throw new Error(
      "Voornaam mag niet leeg zijn.",
    );
  }

  if (
    data.achternaam !== undefined &&
    !data.achternaam.trim()
  ) {
    throw new Error(
      "Achternaam mag niet leeg zijn.",
    );
  }

  if (data.email !== undefined) {
    const email =
      data.email.trim();

    if (!email) {
      throw new Error(
        "E-mailadres mag niet leeg zijn.",
      );
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        email,
      )
    ) {
      throw new Error(
        "Het e-mailadres is ongeldig.",
      );
    }
  }

  if (data.telefoon !== undefined) {
    const telefoon =
      data.telefoon.trim();

    if (!telefoon) {
      throw new Error(
        "Telefoonnummer mag niet leeg zijn.",
      );
    }
  }
}

async function haalActieveOrganisatieIds(
  organisatieIds: string[],
) {
  if (organisatieIds.length === 0) {
    return [];
  }

  const organisaties =
    await prisma.organisatie.findMany({
      where: {
        id: {
          in: organisatieIds,
        },
        actief: true,
      },
      select: {
        id: true,
      },
    });

  return organisaties.map(
    (organisatie) =>
      organisatie.id,
  );
}

async function haalActieveVestigingIds(
  vestigingIds: string[],
  organisatieIds: string[],
) {
  if (
    vestigingIds.length === 0 ||
    organisatieIds.length === 0
  ) {
    return [];
  }

  const vestigingen =
    await prisma.vestiging.findMany({
      where: {
        id: {
          in: vestigingIds,
        },
        organisatieId: {
          in: organisatieIds,
        },
        actief: true,
      },
      select: {
        id: true,
      },
    });

  return vestigingen.map(
    (vestiging) =>
      vestiging.id,
  );
}

export const medewerkerService = {
  /**
   * Haalt medewerkers op binnen de
   * organisaties waartoe de gebruiker
   * toegang heeft.
   *
   * organisatieIds:
   *   organisaties waartoe de gebruiker
   *   toegang heeft.
   *
   * vestigingIds:
   *   optionele beperking tot één of
   *   meerdere vestigingen.
   */
  async getAll(
    organisatieIds: string[] = [],
    filter: MedewerkerFilter = {},
  ) {
    const actieveOrganisatieIds =
      await haalActieveOrganisatieIds(
        organisatieIds,
      );

    if (
      actieveOrganisatieIds.length === 0
    ) {
      return [];
    }

    const gevraagdeVestigingIds =
      filter.vestigingIds;

    let actieveVestigingIds:
      | string[]
      | undefined;

    if (
      gevraagdeVestigingIds !==
      undefined
    ) {
      actieveVestigingIds =
        await haalActieveVestigingIds(
          gevraagdeVestigingIds,
          actieveOrganisatieIds,
        );

      if (
        actieveVestigingIds.length ===
        0
      ) {
        return [];
      }
    }

    return medewerkerRepository.findAll({
      organisatieIds:
        actieveOrganisatieIds,

      vestigingIds:
        actieveVestigingIds,
    });
  },

  async getById(id: string) {
    const medewerker =
      await medewerkerRepository.findById(
        id,
      );

    if (!medewerker) {
      throw new Error(
        "Medewerker niet gevonden.",
      );
    }

    return medewerker;
  },

  async update(
    id: string,
    data: MedewerkerUpdateData,
  ) {
    await this.getById(id);

    return medewerkerRepository.update(
      id,
      data,
    );
  },

  /**
   * Wijzigt uitsluitend persoonlijke
   * gegevens die een medewerker zelf
   * mag beheren.
   *
   * Niet toegestaan via deze methode:
   * - actief / inactief
   * - status
   * - personeelsnummer
   * - contractgegevens
   * - uurloon
   * - datum in/uit dienst
   * - vestigingen
   * - rollen
   * - tags
   */
  async updateEigenGegevens(
    id: string,
    data: EigenGegevensUpdateData,
  ) {
    await this.getById(id);

    controleerEigenGegevens(
      data,
    );

    const opgeschoondeData: EigenGegevensUpdateData =
      {
        ...(data.aanhef !==
          undefined && {
          aanhef: data.aanhef,
        }),

        ...(data.voornaam !==
          undefined && {
          voornaam:
            data.voornaam.trim(),
        }),

        ...(data.tussenvoegsel !==
          undefined && {
          tussenvoegsel:
            data.tussenvoegsel?.trim() ||
            null,
        }),

        ...(data.achternaam !==
          undefined && {
          achternaam:
            data.achternaam.trim(),
        }),

        ...(data.roepnaam !==
          undefined && {
          roepnaam:
            data.roepnaam?.trim() ||
            null,
        }),

        ...(data.email !==
          undefined && {
          email: data.email
            .trim()
            .toLowerCase(),
        }),

        ...(data.telefoon !==
          undefined && {
          telefoon:
            data.telefoon.trim(),
        }),
      };

    return medewerkerRepository.update(
      id,
      opgeschoondeData,
    );
  },

  async inBehandeling(id: string) {
    await this.getById(id);

    const statusId =
      await getStatusId(
        "IN_BEHANDELING",
      );

    return medewerkerRepository.updateStatus(
      id,
      statusId,
      false,
    );
  },

  async setVestigingen(
    id: string,
    vestigingIds: string[],
    hoofdvestigingId: string,
  ) {
    await this.getById(id);

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

    const actieveVestigingen =
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
      actieveVestigingen.length !==
      uniekeVestigingIds.length
    ) {
      throw new Error(
        "Een medewerker kan alleen aan actieve vestigingen worden gekoppeld.",
      );
    }

    return medewerkerRepository.setVestigingen(
      id,
      uniekeVestigingIds,
      hoofdvestigingId,
    );
  },

  async setRollen(
    id: string,
    rolIds: string[],
  ) {
    await this.getById(id);

    const uniekeRolIds =
      Array.from(
        new Set(rolIds),
      );

    return medewerkerRepository.setRollen(
      id,
      uniekeRolIds,
    );
  },

  async setTags(
    id: string,
    tagIds: string[],
  ) {
    await this.getById(id);

    const uniekeTagIds =
      Array.from(
        new Set(tagIds),
      );

    return medewerkerRepository.setTags(
      id,
      uniekeTagIds,
    );
  },

  async activeer(
    id: string,
    geactiveerdDoor: string,
  ) {
    const medewerker =
      await this.getById(id);

    if (medewerker.actief) {
      throw new Error(
        "Deze medewerker is al actief.",
      );
    }

    if (!geactiveerdDoor) {
      throw new Error(
        "Een medewerker kan alleen worden geactiveerd door een ingelogde systeemgebruiker.",
      );
    }

    const statusId =
      await getStatusId("ACTIEF");

    return medewerkerRepository.setActivatie(
      id,
      statusId,
      geactiveerdDoor,
    );
  },

  async deactiveer(id: string) {
    const medewerker =
      await this.getById(id);

    if (!medewerker.actief) {
      throw new Error(
        "Deze medewerker is al inactief.",
      );
    }

    const statusId =
      await getStatusId(
        "GEBLOKKEERD",
      );

    return medewerkerRepository.updateStatus(
      id,
      statusId,
      false,
    );
  },

  async uitDienst(id: string) {
    await this.getById(id);

    const statusId =
      await getStatusId(
        "UIT_DIENST",
      );

    return medewerkerRepository.updateStatus(
      id,
      statusId,
      false,
    );
  },
};