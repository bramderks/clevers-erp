export interface MedewerkerAanmeldenDto {
  aanhef: "DHR" | "MEVR" | "ANDERS" | "GEEN_OPGAVE";

  voornaam: string;
  tussenvoegsel?: string;
  achternaam: string;
  roepnaam?: string;

  geboortedatum: string;

  email: string;
  telefoon: string;

  wachtwoord: string;
  wachtwoordBevestiging: string;

  privacyAkkoord: boolean;
}