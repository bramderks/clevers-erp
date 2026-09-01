export type PlanningStatus =
  | "OPEN"
  | "IN_PLANNING"
  | "GEPUBLICEERD"
  | "AFGESLOTEN";

export type BeschikbaarheidStatus =
  | "BESCHIKBAAR"
  | "NIET_BESCHIKBAAR"
  | "VOORKEUR";

export type DienstBezettingStatus =
  | "OPEN"
  | "GEPLAND"
  | "BEVESTIGD"
  | "AFGEZEGD"
  | "GEWERKT";

export type PlanningTag = {
  id: string;
  naam: string;
  volgorde: number;
  actief: boolean;
};

export type MedewerkerTag = {
  id: string;
  medewerkerId: string;
  tagId: string;
  tag: PlanningTag;
};

export type Beschikbaarheid = {
  id: string;
  weekId: string;
  medewerkerId: string;
  datum: string;
  begintijd: string | null;
  eindtijd: string | null;
  status: BeschikbaarheidStatus;
  opmerking: string | null;
};

export type DienstTag = {
  id: string;
  dienstId: string;
  tagId: string;
  aantal: number;
  tag: PlanningTag;
};

export type PlanningMedewerker = {
  id: string;
  personeelsnummer: string | null;

  aanhef:
    | "DHR"
    | "MEVR"
    | "ANDERS"
    | "GEEN_OPGAVE";

  voornaam: string;
  tussenvoegsel: string | null;
  achternaam: string;

  tags: MedewerkerTag[];
};

export type DienstBezetting = {
  id: string;
  dienstId: string;
  medewerkerId: string | null;
  status: DienstBezettingStatus;

  medewerker: PlanningMedewerker | null;
};

export type Dienst = {
  id: string;
  weekId: string;

  datum: string;
  begintijd: string;
  eindtijd: string;

  opmerkingen: string | null;

  tags: DienstTag[];
  bezetting: DienstBezetting[];
};

export type PlanningWeek = {
  id: string;
  vestigingId: string;

  jaar: number;
  weeknummer: number;

  status: PlanningStatus;

  beschikbaarheidDeadline: string | null;

  diensten: Dienst[];
  beschikbaarheden: Beschikbaarheid[];
};