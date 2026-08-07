export const permissions = {
  dashboard: {
    view: "dashboard.view",
  },

  medewerkers: {
    view: "medewerkers.view",
    create: "medewerkers.create",
    update: "medewerkers.update",
    delete: "medewerkers.delete",
  },

  planning: {
    view: "planning.view",
    create: "planning.create",
    update: "planning.update",
    delete: "planning.delete",
  },

  producten: {
    view: "producten.view",
    create: "producten.create",
    update: "producten.update",
    delete: "producten.delete",
  },

  voorraad: {
    view: "voorraad.view",
    muteren: "voorraad.muteren",
    tellen: "voorraad.tellen",
  },

  bestellingen: {
    view: "bestellingen.view",
    create: "bestellingen.create",
    goedkeuren: "bestellingen.goedkeuren",
  },

  leveringen: {
    view: "leveringen.view",
    verwerken: "leveringen.verwerken",
  },

  rapportages: {
    view: "rapportages.view",
  },

  instellingen: {
    view: "instellingen.view",
    update: "instellingen.update",
  },
} as const;

export type Permission =
  (typeof permissions)[keyof typeof permissions][keyof (typeof permissions)[keyof typeof permissions]];