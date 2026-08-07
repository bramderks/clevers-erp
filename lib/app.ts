export const app = {
  name: "Clevers ERP",

  version: "0.1.0",

  company: "Clevers",

  defaultVestiging: "Nijmegen",

  copyright: `© ${new Date().getFullYear()} Clevers ERP`,

  description: "Professioneel ERP voor ijssalons",

  modules: {
    dashboard: true,
    medewerkers: true,
    planning: true,
    producten: true,
    voorraad: true,
    bestellingen: true,
    leveringen: true,
    rapportages: true,
    instellingen: true,
  },
} as const;