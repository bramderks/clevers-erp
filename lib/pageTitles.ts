export const pageTitles: Record<
  string,
  {
    title: string;
    subtitle: string;
  }
> = {
  "/dashboard": {
    title: "Dashboard",
    subtitle: "Overzicht van jouw organisatie",
  },

  "/medewerkers": {
    title: "Medewerkers",
    subtitle: "Beheer alle medewerkers",
  },

  "/planning": {
    title: "Planning",
    subtitle: "Roosters en diensten",
  },

  "/producten": {
    title: "Producten",
    subtitle: "Assortiment en productbeheer",
  },

  "/voorraad": {
    title: "Voorraad",
    subtitle: "Voorraadbeheer en tellingen",
  },

  "/bestellingen": {
    title: "Bestellingen",
    subtitle: "Bestellingen beheren",
  },

  "/leveringen": {
    title: "Leveringen",
    subtitle: "Ontvangen leveringen",
  },

  "/rapportages": {
    title: "Rapportages",
    subtitle: "Inzichten en analyses",
  },

  "/instellingen": {
    title: "Instellingen",
    subtitle: "Systeeminstellingen",
  },
};

export const defaultPage = {
  title: "Clevers ERP",
  subtitle: "Professioneel ERP voor ijssalons",
};