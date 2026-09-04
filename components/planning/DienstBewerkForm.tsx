"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  Dienst,
  PlanningTag,
} from "@/types/planning";

type PlanningBeschikbaarheid = {
  id: string;
  weekId: string;
  medewerkerId: string;
  datum: string;
  begintijd: string | null;
  eindtijd: string | null;
  status: string;
  opmerking: string | null;
};

type PlanningDienst = {
  id: string;
  datum: string;
  begintijd: string | null;
  eindtijd: string | null;

  tags?: {
    tag: {
      id: string;
      naam: string;
    };
  }[];
};

type PlanningMedewerker = {
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

  tags?: {
    id: string;
    naam: string;
    volgorde: number;
    actief: boolean;
  }[];

  beschikbaarheden?: PlanningBeschikbaarheid[];

  diensten?: {
    id: string;
    dienstId: string;
    status: string;
    dienst: PlanningDienst;
  }[];
};

type MedewerkersResponse = {
  huidigeMedewerkerId: string | null;
  medewerkers: PlanningMedewerker[];
};

type ApiFoutResponse = {
  fout?: string;
};

type DienstBewerkFormProps = {
  dienst: Dienst;
  vestigingId: string;
  onGewijzigd?: () => void;
};

/*
 * ============================================================
 * TIJDINSTELLINGEN
 * ============================================================
 *
 * Alle diensten binnen Clevers ERP:
 *
 * - starten vanaf 09:00
 * - eindigen uiterlijk om 23:00
 * - gebruiken intervallen van 30 minuten
 */

const START_MINUTEN = 9 * 60;
const EINDE_MINUTEN = 23 * 60;
const TIJD_INTERVAL = 30;

function minutenNaarTijd(
  minuten: number,
): string {
  const uren = Math.floor(
    minuten / 60,
  );

  const minutenDeel =
    minuten % 60;

  return `${String(uren).padStart(
    2,
    "0",
  )}:${String(minutenDeel).padStart(
    2,
    "0",
  )}`;
}

function maakTijden(
  vanaf: number,
  tot: number,
): string[] {
  const tijden: string[] = [];

  for (
    let minuten = vanaf;
    minuten <= tot;
    minuten += TIJD_INTERVAL
  ) {
    tijden.push(
      minutenNaarTijd(minuten),
    );
  }

  return tijden;
}

function tijdNaarMinuten(
  tijd: string | null | undefined,
): number | null {
  if (!tijd) {
    return null;
  }

  const directeTijd =
    /^(\d{1,2}):(\d{2})/.exec(
      tijd,
    );

  if (!directeTijd) {
    const datum = new Date(tijd);

    if (
      Number.isNaN(
        datum.getTime(),
      )
    ) {
      return null;
    }

    return (
      datum.getHours() * 60 +
      datum.getMinutes()
    );
  }

  const uren = Number(
    directeTijd[1],
  );

  const minuten = Number(
    directeTijd[2],
  );

  if (
    Number.isNaN(uren) ||
    Number.isNaN(minuten) ||
    uren < 0 ||
    uren > 23 ||
    minuten < 0 ||
    minuten > 59
  ) {
    return null;
  }

  return uren * 60 + minuten;
}

function datumNaarInput(
  waarde: string | null | undefined,
): string {
  if (!waarde) {
    return "";
  }

  if (
    /^\d{4}-\d{2}-\d{2}$/.test(
      waarde,
    )
  ) {
    return waarde;
  }

  const datum =
    new Date(waarde);

  if (
    Number.isNaN(
      datum.getTime(),
    )
  ) {
    return "";
  }

  return [
    datum.getFullYear(),
    String(
      datum.getMonth() + 1,
    ).padStart(2, "0"),
    String(
      datum.getDate(),
    ).padStart(2, "0"),
  ].join("-");
}

function tijdNaarInput(
  waarde: string | null | undefined,
): string {
  if (!waarde) {
    return "";
  }

  const directeTijd =
    /^(\d{1,2}):(\d{2})/.exec(
      waarde,
    );

  if (directeTijd) {
    return `${directeTijd[1].padStart(
      2,
      "0",
    )}:${directeTijd[2]}`;
  }

  const datum =
    new Date(waarde);

  if (
    Number.isNaN(
      datum.getTime(),
    )
  ) {
    return "";
  }

  return [
    String(
      datum.getHours(),
    ).padStart(2, "0"),
    String(
      datum.getMinutes(),
    ).padStart(2, "0"),
  ].join(":");
}

function volledigeNaam(
  medewerker: {
    voornaam: string;
    tussenvoegsel:
      | string
      | null
      | undefined;
    achternaam: string;
  },
): string {
  return [
    medewerker.voornaam,
    medewerker.tussenvoegsel,
    medewerker.achternaam,
  ]
    .filter(
      (
        onderdeel,
      ): onderdeel is string =>
        typeof onderdeel === "string" &&
        onderdeel.trim().length > 0,
    )
    .join(" ");
}

function statusLabel(
  status: string,
): string {
  switch (status) {
    case "OPEN":
      return "Open";

    case "GEPLAND":
      return "Gepland";

    case "BEVESTIGD":
      return "Bevestigd";

    case "AFGEZEGD":
      return "Afgezegd";

    case "GEWERKT":
      return "Gewerkt";

    default:
      return status;
  }
}

function statusKlassen(
  status: string,
): string {
  switch (status) {
    case "BEVESTIGD":
    case "GEWERKT":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";

    case "GEPLAND":
      return "border-amber-300 bg-amber-100 text-amber-800";

    case "AFGEZEGD":
      return "border-slate-200 bg-slate-100 text-slate-500";

    case "OPEN":
      return "border-blue-200 bg-blue-50 text-blue-700";

    default:
      return "border-slate-200 bg-slate-100 text-slate-600";
  }
}

/*
 * ============================================================
 * BESCHIKBAARHEID
 * ============================================================
 */

type BeschikbaarheidWeergave =
  | "BESCHIKBAAR"
  | "VOORKEUR"
  | "NIET_BESCHIKBAAR"
  | "GEEN_OPGAVE"
  | "ANDERE_DIENST";

function beschikbaarheidLabel(
  status: BeschikbaarheidWeergave,
): string {
  switch (status) {
    case "BESCHIKBAAR":
      return "Beschikbaar";

    case "VOORKEUR":
      return "Voorkeur";

    case "NIET_BESCHIKBAAR":
      return "Niet beschikbaar";

    case "ANDERE_DIENST":
      return "Al ingepland";

    case "GEEN_OPGAVE":
      return "Geen beschikbaarheid";

    default:
      return status;
  }
}

function beschikbaarheidKlassen(
  status: BeschikbaarheidWeergave,
): string {
  switch (status) {
    case "BESCHIKBAAR":
      return "border-emerald-300 bg-emerald-50";

    case "VOORKEUR":
      return "border-amber-300 bg-amber-50";

    case "NIET_BESCHIKBAAR":
      return "border-red-300 bg-red-50";

    case "ANDERE_DIENST":
      return "border-red-300 bg-red-50";

    case "GEEN_OPGAVE":
      return "border-slate-200 bg-slate-50";

    default:
      return "border-slate-200 bg-slate-50";
  }
}

function beschikbaarheidBadgeKlassen(
  status: BeschikbaarheidWeergave,
): string {
  switch (status) {
    case "BESCHIKBAAR":
      return "bg-emerald-100 text-emerald-800";

    case "VOORKEUR":
      return "bg-amber-100 text-amber-800";

    case "NIET_BESCHIKBAAR":
      return "bg-red-100 text-red-800";

    case "ANDERE_DIENST":
      return "bg-red-100 text-red-800";

    case "GEEN_OPGAVE":
      return "bg-slate-200 text-slate-700";

    default:
      return "bg-slate-100 text-slate-600";
  }
}

function tijdenOverlappen(
  beginA: number,
  eindeA: number,
  beginB: number,
  eindeB: number,
): boolean {
  return (
    beginA < eindeB &&
    eindeA > beginB
  );
}

function bepaalBeschikbaarheid(
  medewerker: PlanningMedewerker,
  dienstId: string,
  begintijd: string,
  eindtijd: string,
): BeschikbaarheidWeergave {
  const dienstBegin =
    tijdNaarMinuten(begintijd);

  const dienstEinde =
    tijdNaarMinuten(eindtijd);

  if (
    dienstBegin === null ||
    dienstEinde === null
  ) {
    return "GEEN_OPGAVE";
  }

  /*
   * ----------------------------------------------------------
   * EERST CONTROLEREN OF MEDEWERKER AL OP EEN ANDERE DIENST
   * STAAT DIE OVERLAPT
   * ----------------------------------------------------------
   */

  const heeftOverlappendeDienst =
    medewerker.diensten?.some(
      (bezetting) => {
        if (
          bezetting.dienstId === dienstId
        ) {
          return false;
        }

        if (
          bezetting.status ===
            "AFGEZEGD"
        ) {
          return false;
        }

        const andereBegin =
          tijdNaarMinuten(
            bezetting.dienst.begintijd,
          );

        const andereEinde =
          tijdNaarMinuten(
            bezetting.dienst.eindtijd,
          );

        if (
          andereBegin === null ||
          andereEinde === null
        ) {
          return false;
        }

        return tijdenOverlappen(
          dienstBegin,
          dienstEinde,
          andereBegin,
          andereEinde,
        );
      },
    ) ?? false;

  if (heeftOverlappendeDienst) {
    return "ANDERE_DIENST";
  }

  /*
   * ----------------------------------------------------------
   * GEEN BESCHIKBAARHEID OPGEGEVEN
   * ----------------------------------------------------------
   */

  const beschikbaarheden =
    medewerker.beschikbaarheden ?? [];

  if (
    beschikbaarheden.length === 0
  ) {
    return "GEEN_OPGAVE";
  }

  /*
   * ----------------------------------------------------------
   * NIET BESCHIKBAAR HEEFT VOORRANG
   * ----------------------------------------------------------
   */

  for (
    const beschikbaarheid of beschikbaarheden
  ) {
    if (
      beschikbaarheid.status !==
      "NIET_BESCHIKBAAR"
    ) {
      continue;
    }

    const begin =
      tijdNaarMinuten(
        beschikbaarheid.begintijd,
      );

    const einde =
      tijdNaarMinuten(
        beschikbaarheid.eindtijd,
      );

    /*
     * Geen tijden betekent:
     * de volledige dag niet beschikbaar.
     */

    if (
      begin === null ||
      einde === null
    ) {
      return "NIET_BESCHIKBAAR";
    }

    if (
      tijdenOverlappen(
        dienstBegin,
        dienstEinde,
        begin,
        einde,
      )
    ) {
      return "NIET_BESCHIKBAAR";
    }
  }

  /*
   * ----------------------------------------------------------
   * BESCHIKBAAR
   * ----------------------------------------------------------
   */

  const isBeschikbaar =
    beschikbaarheden.some(
      (beschikbaarheid) => {
        if (
          beschikbaarheid.status !==
          "BESCHIKBAAR"
        ) {
          return false;
        }

        const begin =
          tijdNaarMinuten(
            beschikbaarheid.begintijd,
          );

        const einde =
          tijdNaarMinuten(
            beschikbaarheid.eindtijd,
          );

        /*
         * Geen tijden betekent:
         * de volledige dag beschikbaar.
         */

        if (
          begin === null ||
          einde === null
        ) {
          return true;
        }

        return (
          begin <= dienstBegin &&
          einde >= dienstEinde
        );
      },
    );

  if (isBeschikbaar) {
    return "BESCHIKBAAR";
  }

  /*
   * ----------------------------------------------------------
   * VOORKEUR
   * ----------------------------------------------------------
   */

  const heeftVoorkeur =
    beschikbaarheden.some(
      (beschikbaarheid) => {
        if (
          beschikbaarheid.status !==
          "VOORKEUR"
        ) {
          return false;
        }

        const begin =
          tijdNaarMinuten(
            beschikbaarheid.begintijd,
          );

        const einde =
          tijdNaarMinuten(
            beschikbaarheid.eindtijd,
          );

        if (
          begin === null ||
          einde === null
        ) {
          return true;
        }

        return (
          begin <= dienstBegin &&
          einde >= dienstEinde
        );
      },
    );

  if (heeftVoorkeur) {
    return "VOORKEUR";
  }

  return "GEEN_OPGAVE";
}

function bezettingMedewerkerId(
  bezetting: Dienst["bezetting"][number],
): string | null {
  return (
    bezetting.medewerkerId ??
    bezetting.medewerker?.id ??
    null
  );
}

function foutmeldingUitResponse(
  data: unknown,
  standaardFout: string,
): string {
  if (
    data &&
    typeof data === "object" &&
    "fout" in data &&
    typeof (
      data as ApiFoutResponse
    ).fout === "string"
  ) {
    return (
      (
        data as ApiFoutResponse
      ).fout ?? standaardFout
    );
  }

  return standaardFout;
}

export default function DienstBewerkForm({
  dienst,
  vestigingId,
  onGewijzigd,
}: DienstBewerkFormProps) {
  const [datum, setDatum] =
    useState(
      datumNaarInput(
        dienst.datum,
      ),
    );

  const [
    begintijd,
    setBegintijd,
  ] = useState(
    tijdNaarInput(
      dienst.begintijd,
    ),
  );

  const [
    eindtijd,
    setEindtijd,
  ] = useState(
    tijdNaarInput(
      dienst.eindtijd,
    ),
  );

  const [
    opmerkingen,
    setOpmerkingen,
  ] = useState(
    dienst.opmerkingen ?? "",
  );

  const [tags, setTags] =
    useState<PlanningTag[]>([]);

  const [
    geselecteerdeTags,
    setGeselecteerdeTags,
  ] = useState<Record<string, number>>(
    {},
  );

  const [
    medewerkers,
    setMedewerkers,
  ] = useState<PlanningMedewerker[]>(
    [],
  );

  const [
    ladenTags,
    setLadenTags,
  ] = useState(true);

  const [
    ladenMedewerkers,
    setLadenMedewerkers,
  ] = useState(false);

  const [
    opslaanBezig,
    setOpslaanBezig,
  ] = useState(false);

  const [
    bezettingBezig,
    setBezettingBezig,
  ] = useState<string | null>(
    null,
  );

  const [fout, setFout] =
    useState<string | null>(null);

  const [succes, setSucces] =
    useState<string | null>(null);

  /*
   * ============================================================
   * BEGINTIJDEN
   * ============================================================
   */

  const startTijden = useMemo(
    () =>
      maakTijden(
        START_MINUTEN,
        EINDE_MINUTEN -
          TIJD_INTERVAL,
      ),
    [],
  );

  /*
   * ============================================================
   * EINDTIJDEN
   * ============================================================
   */

  const eindTijden = useMemo(() => {
    const startMinuten =
      tijdNaarMinuten(
        begintijd,
      );

    if (startMinuten === null) {
      return maakTijden(
        START_MINUTEN +
          TIJD_INTERVAL,
        EINDE_MINUTEN,
      );
    }

    return maakTijden(
      startMinuten +
        TIJD_INTERVAL,
      EINDE_MINUTEN,
    );
  }, [begintijd]);

  /*
   * ============================================================
   * BESTAANDE DIENSTGEGEVENS
   * ============================================================
   */

  useEffect(() => {
    setDatum(
      datumNaarInput(
        dienst.datum,
      ),
    );

    setBegintijd(
      tijdNaarInput(
        dienst.begintijd,
      ),
    );

    setEindtijd(
      tijdNaarInput(
        dienst.eindtijd,
      ),
    );

    setOpmerkingen(
      dienst.opmerkingen ?? "",
    );

    const bestaandeTags: Record<
      string,
      number
    > = {};

    for (
      const dienstTag of dienst.tags
    ) {
      bestaandeTags[
        dienstTag.tagId
      ] = dienstTag.aantal;
    }

    setGeselecteerdeTags(
      bestaandeTags,
    );
  }, [
    dienst.id,
    dienst.datum,
    dienst.begintijd,
    dienst.eindtijd,
    dienst.opmerkingen,
    dienst.tags,
  ]);

  /*
   * ============================================================
   * PLANNINGTAGS LADEN
   * ============================================================
   */

  useEffect(() => {
    let actief = true;

    async function laadTags() {
      try {
        setLadenTags(true);

        const response =
          await fetch(
            `/api/planning/tags?vestigingId=${encodeURIComponent(
              vestigingId,
            )}`,
            {
              method: "GET",
              cache: "no-store",
              credentials: "include",
            },
          );

        const data: unknown =
          await response.json();

        if (!response.ok) {
          throw new Error(
            foutmeldingUitResponse(
              data,
              "De planningtags konden niet worden opgehaald.",
            ),
          );
        }

        if (!Array.isArray(data)) {
          throw new Error(
            "De planningtags hebben een ongeldig formaat.",
          );
        }

        if (actief) {
          setTags(
            data as PlanningTag[],
          );
        }
      } catch (error) {
        console.error(
          "Fout bij laden planningtags:",
          error,
        );

        if (actief) {
          setTags([]);

          setFout(
            error instanceof Error
              ? error.message
              : "De planningtags konden niet worden opgehaald.",
          );
        }
      } finally {
        if (actief) {
          setLadenTags(false);
        }
      }
    }

    void laadTags();

    return () => {
      actief = false;
    };
  }, [vestigingId]);

  /*
   * ============================================================
   * MEDEWERKERS LADEN
   * ============================================================
   */

  useEffect(() => {
    if (!datum) {
      setMedewerkers([]);
      setLadenMedewerkers(false);

      return;
    }

    let actief = true;

    async function laadMedewerkers() {
      try {
        setLadenMedewerkers(true);

        const response =
          await fetch(
            `/api/planning/medewerkers?vestigingId=${encodeURIComponent(
              vestigingId,
            )}&datum=${encodeURIComponent(
              datum,
            )}`,
            {
              method: "GET",
              cache: "no-store",
              credentials: "include",
            },
          );

        const data: unknown =
          await response.json();

        if (!response.ok) {
          throw new Error(
            foutmeldingUitResponse(
              data,
              "De medewerkers konden niet worden opgehaald.",
            ),
          );
        }

        if (
          !data ||
          typeof data !== "object" ||
          !("medewerkers" in data)
        ) {
          throw new Error(
            "De medewerkers hebben een ongeldig formaat.",
          );
        }

        const medewerkersData =
          (
            data as MedewerkersResponse
          ).medewerkers;

        if (
          !Array.isArray(
            medewerkersData,
          )
        ) {
          throw new Error(
            "De medewerkers hebben een ongeldig formaat.",
          );
        }

        if (actief) {
          setMedewerkers(
            medewerkersData,
          );
        }
      } catch (error) {
        console.error(
          "Fout bij laden medewerkers:",
          error,
        );

        if (actief) {
          setMedewerkers([]);

          setFout(
            error instanceof Error
              ? error.message
              : "De medewerkers konden niet worden opgehaald.",
          );
        }
      } finally {
        if (actief) {
          setLadenMedewerkers(false);
        }
      }
    }

    void laadMedewerkers();

    return () => {
      actief = false;
    };
  }, [
    vestigingId,
    datum,
  ]);

  /*
   * ============================================================
   * TAGS
   * ============================================================
   */

  function toggleTag(
    tagId: string,
  ) {
    setGeselecteerdeTags(
      (huidig) => {
        if (tagId in huidig) {
          const nieuw = {
            ...huidig,
          };

          delete nieuw[tagId];

          return nieuw;
        }

        return {
          ...huidig,
          [tagId]: 1,
        };
      },
    );
  }

  function wijzigAantal(
    tagId: string,
    waarde: string,
  ) {
    const aantal =
      Number(waarde);

    if (
      !Number.isInteger(aantal) ||
      aantal < 1
    ) {
      return;
    }

    setGeselecteerdeTags(
      (huidig) => ({
        ...huidig,
        [tagId]: aantal,
      }),
    );
  }

  /*
   * ============================================================
   * DIENST OPSLAAN
   * ============================================================
   */

  async function opslaanDienst(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setFout(null);
    setSucces(null);

    if (
      !datum ||
      !begintijd ||
      !eindtijd
    ) {
      setFout(
        "Datum, begintijd en eindtijd zijn verplicht.",
      );

      return;
    }

    const startMinuten =
      tijdNaarMinuten(
        begintijd,
      );

    const eindeMinuten =
      tijdNaarMinuten(
        eindtijd,
      );

    if (
      startMinuten === null ||
      eindeMinuten === null
    ) {
      setFout(
        "Vul geldige begin- en eindtijden in.",
      );

      return;
    }

    if (
      startMinuten < START_MINUTEN
    ) {
      setFout(
        "Een dienst kan niet vóór 09:00 starten.",
      );

      return;
    }

    if (
      eindeMinuten > EINDE_MINUTEN
    ) {
      setFout(
        "Een dienst kan niet na 23:00 eindigen.",
      );

      return;
    }

    if (
      startMinuten %
        TIJD_INTERVAL !==
        0 ||
      eindeMinuten %
        TIJD_INTERVAL !==
        0
    ) {
      setFout(
        "Diensten kunnen alleen per 30 minuten worden gepland.",
      );

      return;
    }

    if (
      eindeMinuten -
        startMinuten <
      TIJD_INTERVAL
    ) {
      setFout(
        "Een dienst moet minimaal 30 minuten duren.",
      );

      return;
    }

    if (
      Object.keys(
        geselecteerdeTags,
      ).length === 0
    ) {
      setFout(
        "Selecteer minimaal één planningstag.",
      );

      return;
    }

    try {
      setOpslaanBezig(true);

      const response =
        await fetch(
          `/api/planning/diensten/${dienst.id}`,
          {
            method: "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            credentials: "include",

            body: JSON.stringify({
              datum,
              begintijd,
              eindtijd,

              opmerkingen:
                opmerkingen.trim() ||
                null,

              tags: Object.entries(
                geselecteerdeTags,
              ).map(
                ([tagId, aantal]) => ({
                  tagId,
                  aantal,
                }),
              ),
            }),
          },
        );

      const data: unknown =
        await response.json();

      if (!response.ok) {
        throw new Error(
          foutmeldingUitResponse(
            data,
            "De dienst kon niet worden opgeslagen.",
          ),
        );
      }

      setSucces(
        "Dienst succesvol opgeslagen.",
      );

      onGewijzigd?.();
    } catch (error) {
      console.error(
        "Fout bij opslaan dienst:",
        error,
      );

      setFout(
        error instanceof Error
          ? error.message
          : "De dienst kon niet worden opgeslagen.",
      );
    } finally {
      setOpslaanBezig(false);
    }
  }

  /*
   * ============================================================
   * MEDEWERKER TOEVOEGEN
   * ============================================================
   */

  async function voegMedewerkerToe(
    medewerkerId: string,
  ) {
    if (!medewerkerId) {
      return;
    }

    const bestaatAl =
      dienst.bezetting.some(
        (bezetting) =>
          bezettingMedewerkerId(
            bezetting,
          ) === medewerkerId &&
          bezetting.status !==
            "AFGEZEGD",
      );

    if (bestaatAl) {
      setFout(
        "Deze medewerker staat al op deze dienst.",
      );

      return;
    }

    try {
      setBezettingBezig(
        medewerkerId,
      );

      setFout(null);
      setSucces(null);

      const response =
        await fetch(
          "/api/planning/bezetting",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            credentials: "include",

            body: JSON.stringify({
              dienstId: dienst.id,
              medewerkerId,
              status: "BEVESTIGD",
            }),
          },
        );

      const data: unknown =
        await response.json();

      if (!response.ok) {
        throw new Error(
          foutmeldingUitResponse(
            data,
            "De medewerker kon niet aan de dienst worden gekoppeld.",
          ),
        );
      }

      setSucces(
        "Medewerker direct bevestigd aan de dienst.",
      );

      onGewijzigd?.();
    } catch (error) {
      console.error(
        "Fout bij toevoegen medewerker:",
        error,
      );

      setFout(
        error instanceof Error
          ? error.message
          : "De medewerker kon niet aan de dienst worden gekoppeld.",
      );
    } finally {
      setBezettingBezig(null);
    }
  }

  /*
   * ============================================================
   * BEZETTING VERWIJDEREN
   * ============================================================
   */

  async function verwijderBezetting(
    bezettingId: string,
  ) {
    if (
      !window.confirm(
        "Deze medewerker van de dienst verwijderen?",
      )
    ) {
      return;
    }

    try {
      setBezettingBezig(
        bezettingId,
      );

      setFout(null);
      setSucces(null);

      const response =
        await fetch(
          `/api/planning/bezetting/${bezettingId}`,
          {
            method: "DELETE",
            credentials: "include",
          },
        );

      const data: unknown =
        await response.json();

      if (!response.ok) {
        throw new Error(
          foutmeldingUitResponse(
            data,
            "De medewerker kon niet van de dienst worden verwijderd.",
          ),
        );
      }

      setSucces(
        "Medewerker van de dienst verwijderd.",
      );

      onGewijzigd?.();
    } catch (error) {
      console.error(
        "Fout bij verwijderen bezetting:",
        error,
      );

      setFout(
        error instanceof Error
          ? error.message
          : "De medewerker kon niet van de dienst worden verwijderd.",
      );
    } finally {
      setBezettingBezig(null);
    }
  }

  /*
   * ============================================================
   * BESCHIKBARE MEDEWERKERS
   * ============================================================
   */

  const gekoppeldeMedewerkerIds =
    new Set(
      dienst.bezetting
        .filter(
          (bezetting) =>
            bezetting.status !==
            "AFGEZEGD",
        )
        .map(
          (bezetting) =>
            bezettingMedewerkerId(
              bezetting,
            ),
        )
        .filter(
          (
            medewerkerId,
          ): medewerkerId is string =>
            medewerkerId !== null,
        ),
    );

  const beschikbareMedewerkers =
    medewerkers
      .filter(
        (medewerker) =>
          !gekoppeldeMedewerkerIds.has(
            medewerker.id,
          ),
      )
      .map((medewerker) => ({
        medewerker,

        beschikbaarheid:
          bepaalBeschikbaarheid(
            medewerker,
            dienst.id,
            begintijd,
            eindtijd,
          ),
      }))
      .sort((a, b) => {
        const volgorde: Record<
          BeschikbaarheidWeergave,
          number
        > = {
          BESCHIKBAAR: 1,
          VOORKEUR: 2,
          GEEN_OPGAVE: 3,
          NIET_BESCHIKBAAR: 4,
          ANDERE_DIENST: 5,
        };

        const verschil =
          volgorde[a.beschikbaarheid] -
          volgorde[b.beschikbaarheid];

        if (verschil !== 0) {
          return verschil;
        }

        return volledigeNaam(
          a.medewerker,
        ).localeCompare(
          volledigeNaam(
            b.medewerker,
          ),
          "nl",
        );
      });

  const aantalActieveBezetting =
    dienst.bezetting.filter(
      (bezetting) =>
        bezetting.status !==
        "AFGEZEGD",
    ).length;

  return (
    <form
      onSubmit={opslaanDienst}
      className="space-y-6"
    >
      {/* ======================================================
          DIENST BEWERKEN
          ====================================================== */}

      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-slate-900">
            Dienst bewerken
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Wijzig hier de datum, tijden,
            planningtags en opmerkingen van
            deze dienst.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label
              htmlFor="dienst-datum"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Datum
            </label>

            <input
              id="dienst-datum"
              type="date"
              value={datum}
              onChange={(event) =>
                setDatum(
                  event.target.value,
                )
              }
              disabled={opslaanBezig}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-50"
            />
          </div>

          <div>
            <label
              htmlFor="dienst-begintijd"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Begintijd
            </label>

            <select
              id="dienst-begintijd"
              value={begintijd}
              onChange={(event) =>
                setBegintijd(
                  event.target.value,
                )
              }
              disabled={opslaanBezig}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-50"
            >
              <option value="">
                Kies begintijd...
              </option>

              {startTijden.map(
                (tijd) => (
                  <option
                    key={tijd}
                    value={tijd}
                  >
                    {tijd}
                  </option>
                ),
              )}
            </select>
          </div>

          <div>
            <label
              htmlFor="dienst-eindtijd"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Eindtijd
            </label>

            <select
              id="dienst-eindtijd"
              value={eindtijd}
              onChange={(event) =>
                setEindtijd(
                  event.target.value,
                )
              }
              disabled={opslaanBezig}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-50"
            >
              <option value="">
                Kies eindtijd...
              </option>

              {eindTijden.map(
                (tijd) => (
                  <option
                    key={tijd}
                    value={tijd}
                  >
                    {tijd}
                  </option>
                ),
              )}
            </select>
          </div>
        </div>

        <div className="mt-4">
          <label
            htmlFor="dienst-opmerkingen"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Opmerkingen
          </label>

          <textarea
            id="dienst-opmerkingen"
            value={opmerkingen}
            onChange={(event) =>
              setOpmerkingen(
                event.target.value,
              )
            }
            rows={4}
            disabled={opslaanBezig}
            placeholder="Eventuele opmerkingen bij deze dienst..."
            className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-50"
          />
        </div>
      </section>

      {/* ======================================================
          PLANNINGTAGS
          ====================================================== */}

      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-slate-900">
            Planningtags
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Bepaal welke planningtags bij
            deze dienst horen en hoeveel
            medewerkers daarvoor nodig zijn.
          </p>
        </div>

        {ladenTags ? (
          <p className="text-sm text-slate-500">
            Planningtags laden...
          </p>
        ) : tags.length === 0 ? (
          <p className="text-sm text-slate-500">
            Er zijn geen actieve planningtags
            beschikbaar.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tags.map((tag) => {
              const geselecteerd =
                geselecteerdeTags[
                  tag.id
                ] !== undefined;

              return (
                <div
                  key={tag.id}
                  className={`rounded-xl border p-3 transition ${
                    geselecteerd
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={
                          geselecteerd
                        }
                        onChange={() =>
                          toggleTag(
                            tag.id,
                          )
                        }
                        disabled={
                          opslaanBezig
                        }
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />

                      <span className="text-sm font-medium text-slate-800">
                        {tag.naam}
                      </span>
                    </label>

                    {geselecteerd && (
                      <input
                        type="number"
                        min={1}
                        value={
                          geselecteerdeTags[
                            tag.id
                          ] ?? 1
                        }
                        onChange={(
                          event,
                        ) =>
                          wijzigAantal(
                            tag.id,
                            event.target
                              .value,
                          )
                        }
                        disabled={
                          opslaanBezig
                        }
                        className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-center text-sm text-slate-800 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ======================================================
          BEZETTING
          ====================================================== */}

      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Bezetting
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Medewerkers die aan deze dienst
              gekoppeld zijn.
            </p>
          </div>

          <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
            {aantalActieveBezetting}{" "}
            {aantalActieveBezetting ===
            1
              ? "persoon"
              : "personen"}
          </span>
        </div>

        <div className="space-y-3">
          {dienst.bezetting.length ===
          0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
              Er is nog geen medewerker
              gekoppeld.
            </div>
          ) : (
            dienst.bezetting.map(
              (bezetting) => {
                const medewerker =
                  bezetting.medewerker;

                return (
                  <div
                    key={bezetting.id}
                    className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="font-medium text-slate-900">
                        {medewerker
                          ? volledigeNaam(
                              medewerker,
                            )
                          : "Open positie"}
                      </div>

                      {medewerker?.personeelsnummer && (
                        <div className="mt-0.5 text-xs text-slate-500">
                          Personeelsnummer:{" "}
                          {
                            medewerker.personeelsnummer
                          }
                        </div>
                      )}

                      <span
                        className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusKlassen(
                          bezetting.status,
                        )}`}
                      >
                        {statusLabel(
                          bezetting.status,
                        )}
                      </span>
                    </div>

                    {bezetting.status !==
                      "GEWERKT" &&
                    bezetting.status !==
                      "AFGEZEGD" && (
                      <button
                        type="button"
                        onClick={() =>
                          void verwijderBezetting(
                            bezetting.id,
                          )
                        }
                        disabled={
                          bezettingBezig ===
                          bezetting.id
                        }
                        className="rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        title="Medewerker verwijderen"
                      >
                        {bezettingBezig ===
                        bezetting.id
                          ? "Bezig..."
                          : "✕ Verwijderen"}
                      </button>
                    )}
                  </div>
                );
              },
            )
          )}
        </div>

        {/* ==================================================
            MEDEWERKER TOEVOEGEN
            ================================================== */}

        <div className="mt-5 border-t border-slate-200 pt-5">
          <h3 className="text-sm font-semibold text-slate-900">
            Medewerker toevoegen
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            Beschikbaarheid wordt gecontroleerd
            op basis van de datum en tijden
            van deze dienst.
          </p>

          {/* LEGENDA */}

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
              Beschikbaar
            </span>

            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
              Voorkeur
            </span>

            <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-800">
              Niet beschikbaar / al ingepland
            </span>

            <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-700">
              Geen beschikbaarheid opgegeven
            </span>
          </div>

          {ladenMedewerkers ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              Medewerkers laden...
            </div>
          ) : beschikbareMedewerkers.length ===
            0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
              Geen medewerkers beschikbaar
              om toe te voegen.
            </div>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {beschikbareMedewerkers.map(
                ({
                  medewerker,
                  beschikbaarheid,
                }) => {
                  const kanToevoegen =
                    beschikbaarheid !==
                      "NIET_BESCHIKBAAR" &&
                    beschikbaarheid !==
                      "ANDERE_DIENST";

                  return (
                    <button
                      key={medewerker.id}
                      type="button"
                      disabled={
                        !kanToevoegen ||
                        bezettingBezig !==
                          null
                      }
                      onClick={() =>
                        void voegMedewerkerToe(
                          medewerker.id,
                        )
                      }
                      className={`flex w-full items-center justify-between gap-4 rounded-xl border p-4 text-left transition ${
                        beschikbaarheidKlassen(
                          beschikbaarheid,
                        )
                      } ${
                        kanToevoegen
                          ? "hover:shadow-sm"
                          : "cursor-not-allowed opacity-70"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {volledigeNaam(
                            medewerker,
                          )}
                        </p>

                        {medewerker.personeelsnummer && (
                          <p className="mt-1 text-xs text-slate-500">
                            Personeelsnummer:{" "}
                            {
                              medewerker.personeelsnummer
                            }
                          </p>
                        )}

                        {medewerker.tags &&
                          medewerker.tags.length >
                            0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {medewerker.tags.map(
                                (tag) => (
                                  <span
                                    key={tag.id}
                                    className="rounded-md bg-white/70 px-2 py-0.5 text-xs text-slate-600"
                                  >
                                    {tag.naam}
                                  </span>
                                ),
                              )}
                            </div>
                          )}
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${beschikbaarheidBadgeKlassen(
                            beschikbaarheid,
                          )}`}
                        >
                          {beschikbaarheidLabel(
                            beschikbaarheid,
                          )}
                        </span>

                        {bezettingBezig ===
                        medewerker.id ? (
                          <span className="text-xs font-medium text-slate-500">
                            Toevoegen...
                          </span>
                        ) : kanToevoegen ? (
                          <span className="text-xs font-semibold text-slate-600">
                            + Toevoegen
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                },
              )}
            </div>
          )}
        </div>
      </section>

      {fout && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {fout}
        </div>
      )}

      {succes && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {succes}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={opslaanBezig}
          className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {opslaanBezig
            ? "Opslaan..."
            : "Dienst opslaan"}
        </button>
      </div>
    </form>
  );
}