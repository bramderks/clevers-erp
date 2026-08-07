export interface MedewerkerAanmelden {
  aanhef: "DHR" | "MEVR" | "ANDERS" | "GEEN_OPGAVE";

  voornaam: string;
  tussenvoegsel?: string;
  achternaam: string;
  roepnaam?: string;

  geboortedatum: Date;

  email: string;
  telefoon: string;

  wachtwoord: string;
  wachtwoordBevestiging: string;

  privacyAkkoord: boolean;
}

export interface MedewerkerAanmeldenResult {
  id: string;

  status: "AANGEMELD";

  melding: string;
}