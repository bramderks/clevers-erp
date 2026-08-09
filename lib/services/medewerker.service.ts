import { prisma } from "@/lib/prisma";

import { medewerkerRepository } from "@/lib/repositories/medewerker.repository";

type MedewerkerUpdateData = {
  personeelsnummer?: string | null;

  aanhef?: "DHR" | "MEVR" | "ANDERS" | "GEEN_OPGAVE";

  voornaam?: string;
  tussenvoegsel?: string | null;
  achternaam?: string;
  roepnaam?: string | null;

  geboortedatum?: Date;

  email?: string;
  telefoon?: string;

  contractType?:
    | "OPROEP"
    | "TIJDELIJK"
    | "VAST"
    | "STAGIAIR"
    | "VAKANTIEKRACHT"
    | null;

  contractUren?: number | null;

  datumInDienst?: Date | null;
  datumUitDienst?: Date | null;
};

async function getStatusId(code: string) {
  const status = await prisma.status.findUnique({
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

export const medewerkerService = {
  async getAll() {
    return medewerkerRepository.findAll();
  },

  async getById(id: string) {
    const medewerker = await medewerkerRepository.findById(id);

    if (!medewerker) {
      throw new Error("Medewerker niet gevonden.");
    }

    return medewerker;
  },

  async update(
    id: string,
    data: MedewerkerUpdateData,
  ) {
    await this.getById(id);

    return medewerkerRepository.update(id, data);
  },

  async inBehandeling(id: string) {
    await this.getById(id);

    const statusId = await getStatusId("IN_BEHANDELING");

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

    if (vestigingIds.length === 0) {
      throw new Error(
        "Een medewerker moet aan minimaal één vestiging gekoppeld zijn.",
      );
    }

    if (!vestigingIds.includes(hoofdvestigingId)) {
      throw new Error(
        "De hoofdvestiging moet ook aan de medewerker gekoppeld zijn.",
      );
    }

    return medewerkerRepository.setVestigingen(
      id,
      vestigingIds,
      hoofdvestigingId,
    );
  },

  async setRollen(
    id: string,
    rolIds: string[],
  ) {
    await this.getById(id);

    return medewerkerRepository.setRollen(
      id,
      rolIds,
    );
  },

  async setTags(
    id: string,
    tagIds: string[],
  ) {
    await this.getById(id);

    return medewerkerRepository.setTags(
      id,
      tagIds,
    );
  },

  async activeer(
    id: string,
    geactiveerdDoor: string,
  ) {
    const medewerker = await this.getById(id);

    if (medewerker.actief) {
      throw new Error("Deze medewerker is al actief.");
    }

    if (!geactiveerdDoor) {
      throw new Error(
        "Een medewerker kan alleen worden geactiveerd door een ingelogde systeemgebruiker.",
      );
    }

    const statusId = await getStatusId("ACTIEF");

    return medewerkerRepository.setActivatie(
      id,
      statusId,
      geactiveerdDoor,
    );
  },

  async deactiveer(id: string) {
    const medewerker = await this.getById(id);

    if (!medewerker.actief) {
      throw new Error("Deze medewerker is al inactief.");
    }

    const statusId = await getStatusId("GEBLOKKEERD");

    return medewerkerRepository.updateStatus(
      id,
      statusId,
      false,
    );
  },

  async uitDienst(id: string) {
    await this.getById(id);

    const statusId = await getStatusId("UIT_DIENST");

    return medewerkerRepository.updateStatus(
      id,
      statusId,
      false,
    );
  },
};