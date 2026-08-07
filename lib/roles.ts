import { permissions } from "./permissions";

export const roles = {
  superAdmin: {
    naam: "Super Admin",
    permissions: [
      permissions.dashboard.view,

      permissions.medewerkers.view,
      permissions.medewerkers.create,
      permissions.medewerkers.update,
      permissions.medewerkers.delete,

      permissions.planning.view,
      permissions.planning.create,
      permissions.planning.update,
      permissions.planning.delete,

      permissions.producten.view,
      permissions.producten.create,
      permissions.producten.update,
      permissions.producten.delete,

      permissions.voorraad.view,
      permissions.voorraad.muteren,
      permissions.voorraad.tellen,

      permissions.bestellingen.view,
      permissions.bestellingen.create,
      permissions.bestellingen.goedkeuren,

      permissions.leveringen.view,
      permissions.leveringen.verwerken,

      permissions.rapportages.view,

      permissions.instellingen.view,
      permissions.instellingen.update,
    ],
  },

  eigenaar: {
    naam: "Eigenaar",
    permissions: [
      permissions.dashboard.view,

      permissions.medewerkers.view,
      permissions.medewerkers.create,
      permissions.medewerkers.update,

      permissions.planning.view,
      permissions.planning.create,
      permissions.planning.update,

      permissions.producten.view,
      permissions.producten.update,

      permissions.voorraad.view,
      permissions.voorraad.muteren,
      permissions.voorraad.tellen,

      permissions.bestellingen.view,
      permissions.bestellingen.create,
      permissions.bestellingen.goedkeuren,

      permissions.leveringen.view,
      permissions.leveringen.verwerken,

      permissions.rapportages.view,
    ],
  },

  vestigingsmanager: {
    naam: "Vestigingsmanager",
    permissions: [
      permissions.dashboard.view,

      permissions.medewerkers.view,
      permissions.medewerkers.update,

      permissions.planning.view,
      permissions.planning.create,
      permissions.planning.update,

      permissions.producten.view,

      permissions.voorraad.view,
      permissions.voorraad.muteren,
      permissions.voorraad.tellen,

      permissions.bestellingen.view,
      permissions.bestellingen.create,

      permissions.leveringen.view,

      permissions.rapportages.view,
    ],
  },

  teamleider: {
    naam: "Teamleider",
    permissions: [
      permissions.dashboard.view,

      permissions.medewerkers.view,

      permissions.planning.view,
      permissions.planning.update,

      permissions.producten.view,

      permissions.voorraad.view,

      permissions.bestellingen.view,

      permissions.leveringen.view,
    ],
  },

  medewerker: {
    naam: "Medewerker",
    permissions: [
      permissions.dashboard.view,
      permissions.planning.view,
    ],
  },
} as const;

export type Rol = keyof typeof roles;