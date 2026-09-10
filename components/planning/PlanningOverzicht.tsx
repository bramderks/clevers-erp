"use client";

import { useRouter } from "next/navigation";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getISOWeek,
  getISOWeekYear,
} from "date-fns";

import PlanningWeekOverzicht from "@/components/planning/PlanningWeekOverzicht";

import type {
  PlanningWeek,
} from "@/types/planning";

type PlanningOverzichtProps = {
  weken: PlanningWeek[];
  vestigingId: string;

  isEigenaar?: boolean;
  isTeamleider?: boolean;
  isMedewerker?: boolean;

  kanVerwijderen?: boolean;

  huidigeMedewerkerId?: string | null;

  onGewijzigd?: () => void;
};

type PlanningTag = {
  id: string;
  naam: string;
  volgorde?: number;
  actief?: boolean;
};

type MedewerkerTag = {
  id: string;
  naam: string;
  volgorde?: number;
  actief?: boolean;
};

type Beschikbaarheid = {
  id: string;
  weekId: string;
  medewerkerId: string;
  datum: string;
  begintijd: string | null;
  eindtijd: string | null;
  status: string;
  opmerking: string | null;
};

type MedewerkerDienst = {
  id: string;
  dienstId: string;
  status: string;

  dienst: {
    id: string;
    datum: string;
    begintijd: string;
    eindtijd: string | null;

    tags: {
      tag: {
        id: string;
        naam: string;
      };
    }[];
  };
};

type PlanningMedewerker = {
  id: string;
  personeelsnummer: string | null;
  aanhef: string | null;
  voornaam: string;
  tussenvoegsel: string | null;
  achternaam: string;

  tags: MedewerkerTag[];

  beschikbaarheden: Beschikbaarheid[];

  diensten: MedewerkerDienst[];
};

type MedewerkerBeschikbaarheidsStatus =
  | "BESCHIKBAAR"
  | "VOORKEUR"
  | "NIET_BESCHIKBAAR"
  | "GEEN_BESCHIKBAARHEID"
  | "OVERLAPPENDE_DIENST";

const START_MINUTEN = 9 * 60;
const EINDE_MINUTEN = 23 * 60;
const TIJD_INTERVAL = 30;

/*
 * ============================================================
 * WEEK
 * ============================================================
 */

function vindHuidigeWeekIndex(
  weken: PlanningWeek[],
) {
  const vandaag = new Date();

  const weeknummer =
    getISOWeek(vandaag);

  const jaar =
    getISOWeekYear(vandaag);

  const index =
    weken.findIndex(
      (week) =>
        week.weeknummer ===
          weeknummer &&
        week.jaar === jaar,
    );

  return index >= 0
    ? index
    : 0;
}

/*
 * ============================================================
 * TIJD
 * ============================================================
 */

function minutenNaarTijd(
  minuten: number,
) {
  const uren =
    Math.floor(minuten / 60);

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
  vanaf = START_MINUTEN,
  tot = EINDE_MINUTEN,
) {
  const tijden: string[] = [];

  for (
    let minuten = vanaf;
    minuten <= tot;
    minuten += TIJD_INTERVAL
  ) {
    tijden.push(
      minutenNaarTijd(
        minuten,
      ),
    );
  }

  return tijden;
}

function tijdNaarMinuten(
  tijd: string,
) {
  const delen =
    tijd.split(":");

  if (
    delen.length < 2
  ) {
    return null;
  }

  const uren =
    Number(delen[0]);

  const minuten =
    Number(delen[1]);

  if (
    Number.isNaN(uren) ||
    Number.isNaN(minuten)
  ) {
    return null;
  }

  return uren * 60 + minuten;
}

function maakDatumTijd(
  datum: string,
  tijd: string,
) {
  return new Date(
    `${datum}T${tijd}:00`,
  );
}

function datumUitWaarde(
  waarde: string,
) {
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
    return null;
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

function tijdUitWaarde(
  waarde: string,
) {
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
    return null;
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

/*
 * ============================================================
 * MEDEWERKER
 * ============================================================
 */

function medewerkerNaam(
  medewerker: PlanningMedewerker,
) {
  return [
    medewerker.voornaam,
    medewerker.tussenvoegsel,
    medewerker.achternaam,
  ]
    .filter(Boolean)
    .join(" ");
}

function tijdenOverlappen(
  startA: Date,
  eindeA: Date,
  startB: Date,
  eindeB: Date,
) {
  return (
    startA < eindeB &&
    eindeA > startB
  );
}

/*
 * ============================================================
 * BESTAANDE DIENST OVERLAP
 * ============================================================
 */

function medewerkerHeeftOverlappendeDienst(
  medewerker: PlanningMedewerker,
  datum: string,
  begintijd: string,
  eindtijd: string,
) {
  const dienstStart =
    maakDatumTijd(
      datum,
      begintijd,
    );

  const dienstEinde =
    maakDatumTijd(
      datum,
      eindtijd,
    );

  return medewerker.diensten.some(
    (bezetting) => {
      if (
        bezetting.status ===
        "AFGEZEGD"
      ) {
        return false;
      }

      const dienstDatum =
        datumUitWaarde(
          bezetting.dienst.datum,
        );

      const bestaandeBegintijd =
        tijdUitWaarde(
          bezetting.dienst
            .begintijd,
        );

      const bestaandeEindtijd =
        bezetting.dienst.eindtijd
          ? tijdUitWaarde(
              bezetting.dienst
                .eindtijd,
            )
          : null;

      if (
        !dienstDatum ||
        !bestaandeBegintijd ||
        !bestaandeEindtijd
      ) {
        return false;
      }

      if (
        dienstDatum !== datum
      ) {
        return false;
      }

      const bestaandeStart =
        maakDatumTijd(
          dienstDatum,
          bestaandeBegintijd,
        );

      const bestaandeEinde =
        maakDatumTijd(
          dienstDatum,
          bestaandeEindtijd,
        );

      return tijdenOverlappen(
        dienstStart,
        dienstEinde,
        bestaandeStart,
        bestaandeEinde,
      );
    },
  );
}

/*
 * ============================================================
 * BESCHIKBAARHEID STATUS
 * ============================================================
 *
 * De medewerker wordt NIET verborgen.
 *
 * De eigenaar moet juist kunnen zien:
 *
 * GROEN
 * Beschikbaar
 *
 * GEEL
 * Voorkeur
 *
 * ROOD
 * Niet beschikbaar
 *
 * GRIJS
 * Geen beschikbaarheid opgegeven
 *
 * BLAUW
 * Al een overlappende dienst
 */

function bepaalBeschikbaarheidsStatus(
  medewerker: PlanningMedewerker,
  datum: string,
  begintijd: string,
  eindtijd: string,
): MedewerkerBeschikbaarheidsStatus {
  if (
    medewerkerHeeftOverlappendeDienst(
      medewerker,
      datum,
      begintijd,
      eindtijd,
    )
  ) {
    return "OVERLAPPENDE_DIENST";
  }

  const dienstStart =
    maakDatumTijd(
      datum,
      begintijd,
    );

  const dienstEinde =
    maakDatumTijd(
      datum,
      eindtijd,
    );

  const beschikbaarheden =
    medewerker.beschikbaarheden.filter(
      (beschikbaarheid) =>
        datumUitWaarde(
          beschikbaarheid.datum,
        ) === datum,
    );

  if (
    beschikbaarheden.length ===
    0
  ) {
    return "GEEN_BESCHIKBAARHEID";
  }

  /*
   * ==========================================================
   * NIET BESCHIKBAAR
   * ==========================================================
   */

  const heeftNietBeschikbaar =
    beschikbaarheden.some(
      (beschikbaarheid) => {
        if (
          beschikbaarheid.status !==
          "NIET_BESCHIKBAAR"
        ) {
          return false;
        }

        /*
         * Hele dag niet beschikbaar.
         */

        if (
          !beschikbaarheid.begintijd ||
          !beschikbaarheid.eindtijd
        ) {
          return true;
        }

        const begin =
          tijdUitWaarde(
            beschikbaarheid.begintijd,
          );

        const einde =
          tijdUitWaarde(
            beschikbaarheid.eindtijd,
          );

        if (
          !begin ||
          !einde
        ) {
          return true;
        }

        const nietBeschikbaarStart =
          maakDatumTijd(
            datum,
            begin,
          );

        const nietBeschikbaarEinde =
          maakDatumTijd(
            datum,
            einde,
          );

        return tijdenOverlappen(
          dienstStart,
          dienstEinde,
          nietBeschikbaarStart,
          nietBeschikbaarEinde,
        );
      },
    );

  if (heeftNietBeschikbaar) {
    return "NIET_BESCHIKBAAR";
  }

  /*
   * ==========================================================
   * BESCHIKBAAR
   * ==========================================================
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

        if (
          !beschikbaarheid.begintijd ||
          !beschikbaarheid.eindtijd
        ) {
          return true;
        }

        const begin =
          tijdUitWaarde(
            beschikbaarheid.begintijd,
          );

        const einde =
          tijdUitWaarde(
            beschikbaarheid.eindtijd,
          );

        if (
          !begin ||
          !einde
        ) {
          return false;
        }

        const beschikbaarStart =
          maakDatumTijd(
            datum,
            begin,
          );

        const beschikbaarEinde =
          maakDatumTijd(
            datum,
            einde,
          );

        return (
          beschikbaarStart <=
            dienstStart &&
          beschikbaarEinde >=
            dienstEinde
        );
      },
    );

  if (isBeschikbaar) {
    return "BESCHIKBAAR";
  }

  /*
   * ==========================================================
   * VOORKEUR
   * ==========================================================
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

        if (
          !beschikbaarheid.begintijd ||
          !beschikbaarheid.eindtijd
        ) {
          return true;
        }

        const begin =
          tijdUitWaarde(
            beschikbaarheid.begintijd,
          );

        const einde =
          tijdUitWaarde(
            beschikbaarheid.eindtijd,
          );

        if (
          !begin ||
          !einde
        ) {
          return false;
        }

        const voorkeurStart =
          maakDatumTijd(
            datum,
            begin,
          );

        const voorkeurEinde =
          maakDatumTijd(
            datum,
            einde,
          );

        return (
          voorkeurStart <=
            dienstStart &&
          voorkeurEinde >=
            dienstEinde
        );
      },
    );

  if (heeftVoorkeur) {
    return "VOORKEUR";
  }

  return "GEEN_BESCHIKBAARHEID";
}

function beschikbaarheidsWeergave(
  status: MedewerkerBeschikbaarheidsStatus,
) {
  switch (status) {
    case "BESCHIKBAAR":
      return {
        label: "Beschikbaar",
        container:
          "border-emerald-200 bg-emerald-50",
        badge:
          "bg-emerald-100 text-emerald-800",
        tekst:
          "text-emerald-800",
      };

    case "VOORKEUR":
      return {
        label: "Voorkeur",
        container:
          "border-amber-200 bg-amber-50",
        badge:
          "bg-amber-100 text-amber-800",
        tekst:
          "text-amber-800",
      };

    case "NIET_BESCHIKBAAR":
      return {
        label: "Niet beschikbaar",
        container:
          "border-red-200 bg-red-50",
        badge:
          "bg-red-100 text-red-800",
        tekst:
          "text-red-800",
      };

    case "OVERLAPPENDE_DIENST":
      return {
        label:
          "Al ingepland",
        container:
          "border-blue-200 bg-blue-50",
        badge:
          "bg-blue-100 text-blue-800",
        tekst:
          "text-blue-800",
      };

    case "GEEN_BESCHIKBAARHEID":
    default:
      return {
        label:
          "Geen beschikbaarheid",
        container:
          "border-slate-200 bg-slate-50",
        badge:
          "bg-slate-200 text-slate-700",
        tekst:
          "text-slate-700",
      };
  }
}

/*
 * ============================================================
 * COMPONENT
 * ============================================================
 */

export default function PlanningOverzicht({
  weken,
  vestigingId,

  isEigenaar = false,
  isTeamleider = false,
  isMedewerker = false,

  kanVerwijderen = false,

  onGewijzigd,
}: PlanningOverzichtProps) {
  const router = useRouter();
  const gesorteerdeWeken =
    useMemo(
      () =>
        [...weken].sort(
          (a, b) => {
            if (
              a.jaar !==
              b.jaar
            ) {
              return (
                a.jaar -
                b.jaar
              );
            }

            return (
              a.weeknummer -
              b.weeknummer
            );
          },
        ),
      [weken],
    );

  const [
    geselecteerdeWeekIndex,
    setGeselecteerdeWeekIndex,
  ] = useState(0);

  const [
    nieuweDienstDatum,
    setNieuweDienstDatum,
  ] = useState<string | null>(
    null,
  );

  const [
    begintijd,
    setBegintijd,
  ] = useState("09:00");

  const [
    eindtijd,
    setEindtijd,
  ] = useState("17:00");

  const [
    opmerkingen,
    setOpmerkingen,
  ] = useState("");

  const [
    tags,
    setTags,
  ] = useState<PlanningTag[]>([]);

  const [
    geselecteerdeTags,
    setGeselecteerdeTags,
  ] = useState<
    Record<string, number>
  >({});

  const [
    medewerkers,
    setMedewerkers,
  ] = useState<
    PlanningMedewerker[]
  >([]);

  const [
    ladenTags,
    setLadenTags,
  ] = useState(false);

  const [
    ladenMedewerkers,
    setLadenMedewerkers,
  ] = useState(false);

  const [
    medewerkersFout,
    setMedewerkersFout,
  ] = useState<string | null>(
    null,
  );

  const [
    opslaanBezig,
    setOpslaanBezig,
  ] = useState(false);

  const [
    fout,
    setFout,
  ] = useState<string | null>(
    null,
  );

  /*
   * ============================================================
   * HUIDIGE WEEK SELECTEREN
   * ============================================================
   */

  useEffect(() => {
    if (
      gesorteerdeWeken.length ===
      0
    ) {
      setGeselecteerdeWeekIndex(
        0,
      );

      return;
    }

    setGeselecteerdeWeekIndex(
      vindHuidigeWeekIndex(
        gesorteerdeWeken,
      ),
    );
  }, [gesorteerdeWeken]);

  const huidigeWeek =
    gesorteerdeWeken[
      geselecteerdeWeekIndex
    ] ?? null;

  /*
   * ============================================================
   * TAGS LADEN
   * ============================================================
   */

  useEffect(() => {
    let actief = true;

    async function laadTags() {
      if (!vestigingId) {
        return;
      }

      try {
        setLadenTags(true);

        const response =
          await fetch(
            `/api/planning/tags?vestigingId=${encodeURIComponent(
              vestigingId,
            )}`,
            {
              method: "GET",
              credentials:
                "include",
              cache: "no-store",
            },
          );

        const data: unknown =
          await response.json();

        if (!response.ok) {
          throw new Error(
            (
              data as {
                fout?: string;
              }
            )?.fout ??
              "Planningtags konden niet worden geladen.",
          );
        }

        if (!Array.isArray(data)) {
          throw new Error(
            "Planningtags hebben een ongeldig formaat.",
          );
        }

        if (actief) {
          setTags(
            (
              data as PlanningTag[]
            ).filter(
              (tag) =>
                tag.actief !== false,
            ),
          );
        }
      } catch (error) {
        console.error(
          "Fout bij laden tags:",
          error,
        );

        if (actief) {
          setTags([]);
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
   *
   * BELANGRIJK:
   *
   * Medewerkers worden pas geladen zodra:
   *
   * - er een datum is;
   * - minimaal één planningtag is geselecteerd.
   */

  const geselecteerdeTagIds =
    useMemo(
      () =>
        Object.keys(
          geselecteerdeTags,
        ),
      [geselecteerdeTags],
    );

  useEffect(() => {
    if (
      !nieuweDienstDatum ||
      !vestigingId ||
      geselecteerdeTagIds.length ===
        0
    ) {
      setMedewerkers([]);
      setMedewerkersFout(null);
      setLadenMedewerkers(false);

      return;
    }

    let actief = true;

    async function laadMedewerkers() {
  if (
    nieuweDienstDatum === null ||
    !vestigingId
  ) {
    if (actief) {
      setMedewerkers([]);
      setMedewerkersFout(null);
      setLadenMedewerkers(false);
    }

    return;
  }

  const datum: string =
    nieuweDienstDatum;

  try {
    setLadenMedewerkers(true);
    setMedewerkersFout(null);

    const response =
      await fetch(
        `/api/planning/medewerkers?vestigingId=${encodeURIComponent(
          vestigingId,
        )}&datum=${encodeURIComponent(
          datum,
        )}`,
        {
          method: "GET",
          credentials:
            "include",
          cache: "no-store",
        },
      );

    const data: unknown =
      await response.json();

    if (!response.ok) {
      throw new Error(
        (
          data as {
            fout?: string;
          }
        )?.fout ??
          "De medewerkers konden niet worden geladen.",
      );
    }

    if (
      !data ||
      typeof data !== "object" ||
      !Array.isArray(
        (
          data as {
            medewerkers?: unknown;
          }
        ).medewerkers,
      )
    ) {
      throw new Error(
        "De medewerkers hebben een ongeldig formaat.",
      );
    }

    if (actief) {
      setMedewerkers(
        (
          data as {
            medewerkers: PlanningMedewerker[];
          }
        ).medewerkers,
      );
    }
  } catch (error) {
    console.error(
      "Fout bij laden medewerkers:",
      error,
    );

    if (actief) {
      setMedewerkers([]);

      setMedewerkersFout(
        error instanceof Error
          ? error.message
          : "De medewerkers konden niet worden geladen.",
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
    nieuweDienstDatum,
    vestigingId,
    geselecteerdeTagIds,
  ]);

  /*
   * ============================================================
   * FUNCTIONEEL GESCHIKTE MEDEWERKERS
   * ============================================================
   *
   * Een medewerker moet minimaal één van
   * de geselecteerde planningtags hebben.
   *
   * Zonder juiste tag:
   *
   * - niet tonen;
   * - niet inplanbaar.
   */

  const geschikteMedewerkers =
    useMemo(() => {
      if (
        geselecteerdeTagIds.length ===
        0
      ) {
        return [];
      }

      const geselecteerdeSet =
        new Set(
          geselecteerdeTagIds,
        );

      return medewerkers
        .filter(
          (medewerker) =>
            medewerker.tags.some(
              (tag) =>
                geselecteerdeSet.has(
                  tag.id,
                ),
            ),
        )
        .sort((a, b) =>
          medewerkerNaam(
            a,
          ).localeCompare(
            medewerkerNaam(b),
            "nl",
          ),
        );
    }, [
      medewerkers,
      geselecteerdeTagIds,
    ]);

  /*
   * ============================================================
   * TIJDEN
   * ============================================================
   */

  const startTijden =
    useMemo(
      () =>
        maakTijden(
          START_MINUTEN,
          EINDE_MINUTEN -
            TIJD_INTERVAL,
        ),
      [],
    );

  const eindTijden =
    useMemo(() => {
      const beginMinuten =
        tijdNaarMinuten(
          begintijd,
        );

      if (
        beginMinuten === null
      ) {
        return maakTijden(
          START_MINUTEN +
            TIJD_INTERVAL,
          EINDE_MINUTEN,
        );
      }

      return maakTijden(
        beginMinuten +
          TIJD_INTERVAL,
        EINDE_MINUTEN,
      );
    }, [begintijd]);

  /*
   * ============================================================
   * WEEK NAVIGATIE
   * ============================================================
   */

  const kanNaarVorigeWeek =
    geselecteerdeWeekIndex > 0;

  const kanNaarVolgendeWeek =
    geselecteerdeWeekIndex <
    gesorteerdeWeken.length - 1;

  function gaNaarVorigeWeek() {
    if (!kanNaarVorigeWeek) {
      return;
    }

    setGeselecteerdeWeekIndex(
      (index) => index - 1,
    );
  }

  function gaNaarVolgendeWeek() {
    if (!kanNaarVolgendeWeek) {
      return;
    }

    setGeselecteerdeWeekIndex(
      (index) => index + 1,
    );
  }

  /*
   * ============================================================
   * NIEUWE DIENST
   * ============================================================
   */

  function openNieuweDienst(
    datum: string,
  ) {
    if (!isEigenaar) {
      return;
    }

    setNieuweDienstDatum(
      datum,
    );

    setBegintijd("09:00");
    setEindtijd("17:00");
    setOpmerkingen("");
    setGeselecteerdeTags({});
    setMedewerkers([]);
    setMedewerkersFout(null);
    setFout(null);
  }

  /*
   * ============================================================
   * TAG SELECTEREN
   * ============================================================
   */

  function toggleTag(
    tagId: string,
  ) {
    setGeselecteerdeTags(
      (huidig) => {
        if (
          huidig[tagId] !==
          undefined
        ) {
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

  async function maakNieuweDienst() {
    if (
      !huidigeWeek ||
      !nieuweDienstDatum ||
      !begintijd ||
      !eindtijd
    ) {
      setFout(
        "Datum, begintijd en eindtijd zijn verplicht.",
      );

      return;
    }

    const beginMinuten =
      tijdNaarMinuten(
        begintijd,
      );

    const eindeMinuten =
      tijdNaarMinuten(
        eindtijd,
      );

    if (
      beginMinuten === null ||
      eindeMinuten === null
    ) {
      setFout(
        "Vul geldige begin- en eindtijden in.",
      );

      return;
    }

    if (
      eindeMinuten -
        beginMinuten <
      TIJD_INTERVAL
    ) {
      setFout(
        "Een dienst moet minimaal 30 minuten duren.",
      );

      return;
    }

    if (
      geselecteerdeTagIds.length ===
      0
    ) {
      setFout(
        "Selecteer minimaal één planningstag.",
      );

      return;
    }

    try {
      setOpslaanBezig(true);
      setFout(null);

      const start =
        maakDatumTijd(
          nieuweDienstDatum,
          begintijd,
        );

      const einde =
        maakDatumTijd(
          nieuweDienstDatum,
          eindtijd,
        );

      const response =
        await fetch(
          "/api/planning/diensten",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            credentials:
              "include",

            body: JSON.stringify({
              weekId:
                huidigeWeek.id,

              datum:
                start.toISOString(),

              begintijd:
                start.toISOString(),

              eindtijd:
                einde.toISOString(),

              opmerkingen:
                opmerkingen.trim() ||
                null,

              tags: Object.entries(
                geselecteerdeTags,
              ).map(
                ([
                  tagId,
                  aantal,
                ]) => ({
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
          (
            data as {
              fout?: string;
            }
          )?.fout ??
            "De dienst kon niet worden aangemaakt.",
        );
      }

      setNieuweDienstDatum(
        null,
      );

      onGewijzigd?.();
    } catch (error) {
      console.error(
        "Fout bij aanmaken dienst:",
        error,
      );

      setFout(
        error instanceof Error
          ? error.message
          : "De dienst kon niet worden aangemaakt.",
      );
    } finally {
      setOpslaanBezig(false);
    }
  }

  /*
   * ============================================================
   * DIENST WIJZIGEN
   * ============================================================
   */

  function handleWijzigDienst(
    dienstId: string,
  ) {
    router.push(`/planning/dienst/${dienstId}`);
  }

  /*
   * ============================================================
   * DIENST VERWIJDEREN
   * ============================================================
   */

  async function handleVerwijderDienst(
    dienstId: string,
  ) {
    if (
      !isEigenaar ||
      !kanVerwijderen
    ) {
      return;
    }

    const bevestiging =
      window.confirm(
        "Weet je zeker dat je deze dienst wilt verwijderen?",
      );

    if (!bevestiging) {
      return;
    }

    try {
      const response =
        await fetch(
          `/api/planning/diensten/${dienstId}`,
          {
            method: "DELETE",

            credentials:
              "include",
          },
        );

      const data =
        await response
          .json()
          .catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.fout ??
            "De dienst kon niet worden verwijderd.",
        );
      }

      onGewijzigd?.();
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "De dienst kon niet worden verwijderd.",
      );
    }
  }

  /*
   * ============================================================
   * GEEN WEKEN
   * ============================================================
   */

  if (
    gesorteerdeWeken.length ===
    0
  ) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Geen planning beschikbaar
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          Er zijn nog geen planningweken
          beschikbaar.
        </p>
      </section>
    );
  }

  if (!huidigeWeek) {
    return null;
  }

  return (
    <>
      <section className="space-y-5">
        {/* ======================================================
            WEEK NAVIGATIE
            ====================================================== */}

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-4 p-4 sm:p-6">
            <button
              type="button"
              onClick={
                gaNaarVorigeWeek
              }
              disabled={
                !kanNaarVorigeWeek
              }
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-xl font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
            >
              ←
            </button>

            <div className="min-w-0 flex-1 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">
                Planning
              </p>

              <h1 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">
                Week{" "}
                {
                  huidigeWeek.weeknummer
                }{" "}
                ·{" "}
                {
                  huidigeWeek.jaar
                }
              </h1>
            </div>

            <button
              type="button"
              onClick={
                gaNaarVolgendeWeek
              }
              disabled={
                !kanNaarVolgendeWeek
              }
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-xl font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
            >
              →
            </button>
          </div>

          <div className="border-t border-slate-100 px-4 py-3 sm:px-6">
            <p className="text-center text-xs text-slate-500">
              {isEigenaar &&
                "Eigenaar · planning beheren"}

              {!isEigenaar &&
                isTeamleider &&
                "Teamleider · alleen bekijken"}

              {!isEigenaar &&
                !isTeamleider &&
                isMedewerker &&
                "Medewerker · planning bekijken en open diensten invullen"}
            </p>
          </div>
        </div>

        {/* ======================================================
            WEEKWEERGAVE
            ====================================================== */}

        <PlanningWeekOverzicht
          week={huidigeWeek}
          onNieuweDienst={
            isEigenaar
              ? openNieuweDienst
              : undefined
          }
          onWijzigDienst={
            isEigenaar
              ? handleWijzigDienst
              : undefined
          }
          onVerwijderDienst={
            isEigenaar &&
            kanVerwijderen
              ? handleVerwijderDienst
              : undefined
          }
        />
      </section>

      {/* ========================================================
          NIEUWE DIENST MODAL
          ======================================================== */}

      {nieuweDienstDatum && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-4">
          <div className="flex min-h-full items-center justify-center py-8">
            <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
              {/* ==================================================
                  HEADER
                  ================================================== */}

              <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Nieuwe dienst
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Maak een nieuwe dienst aan
                    voor{" "}
                    {nieuweDienstDatum}.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setNieuweDienstDatum(
                      null,
                    )
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-xl text-slate-500 transition hover:bg-slate-100"
                  aria-label="Venster sluiten"
                >
                  ×
                </button>
              </div>

              <div className="space-y-6 p-5">
                {/* =================================================
                    TIJDEN
                    ================================================= */}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Begintijd
                    </label>

                    <select
                      value={begintijd}
                      onChange={(event) =>
                        setBegintijd(
                          event.target.value,
                        )
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                    >
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
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Eindtijd
                    </label>

                    <select
                      value={eindtijd}
                      onChange={(event) =>
                        setEindtijd(
                          event.target.value,
                        )
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                    >
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

                {/* =================================================
                    BENODIGDE FUNCTIES
                    ================================================= */}

                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Benodigde functies
                  </h3>

                  <p className="mt-1 text-xs text-slate-500">
                    Selecteer eerst de benodigde
                    functies. Daarna worden alleen
                    medewerkers met minimaal één
                    van deze functies getoond.
                  </p>

                  {ladenTags ? (
                    <p className="mt-4 text-sm text-slate-500">
                      Tags laden...
                    </p>
                  ) : tags.length === 0 ? (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      Er zijn geen actieve
                      planningtags beschikbaar.
                    </div>
                  ) : (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
                                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                />

                                <span className="text-sm font-semibold text-slate-800">
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
                                    ]
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
                                  className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-center text-sm text-slate-800 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                                />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* =================================================
                    MEDEWERKERS
                    ================================================= */}

                <div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Geschikte medewerkers
                    </h3>

                    <p className="mt-1 text-xs text-slate-500">
                      Alleen medewerkers met een
                      geselecteerde functie worden
                      getoond. De kleur geeft hun
                      beschikbaarheid voor deze
                      dienst weer.
                    </p>
                  </div>

                  {geselecteerdeTagIds.length ===
                  0 ? (
                    <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4">
                      <p className="text-sm font-medium text-slate-700">
                        Selecteer eerst minimaal
                        één benodigde functie.
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Daarna worden de passende
                        medewerkers automatisch
                        geladen.
                      </p>
                    </div>
                  ) : ladenMedewerkers ? (
                    <p className="mt-4 text-sm text-slate-500">
                      Geschikte medewerkers laden...
                    </p>
                  ) : medewerkersFout ? (
                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {medewerkersFout}
                    </div>
                  ) : geschikteMedewerkers.length ===
                    0 ? (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-sm text-slate-600">
                        Er zijn geen medewerkers
                        gevonden met één van de
                        geselecteerde functies.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-2">
                      {geschikteMedewerkers.map(
                        (medewerker) => {
                          const status =
                            bepaalBeschikbaarheidsStatus(
                              medewerker,
                              nieuweDienstDatum,
                              begintijd,
                              eindtijd,
                            );

                          const weergave =
                            beschikbaarheidsWeergave(
                              status,
                            );

                          const relevanteTags =
                            medewerker.tags.filter(
                              (tag) =>
                                geselecteerdeTagIds.includes(
                                  tag.id,
                                ),
                            );

                          return (
                            <div
                              key={medewerker.id}
                              className={`rounded-xl border px-4 py-3 ${weergave.container}`}
                            >
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-slate-900">
                                    {medewerkerNaam(
                                      medewerker,
                                    )}
                                  </p>

                                  {medewerker.personeelsnummer && (
                                    <p className="mt-0.5 text-xs text-slate-500">
                                      Personeelsnummer:{" "}
                                      {
                                        medewerker.personeelsnummer
                                      }
                                    </p>
                                  )}

                                  {relevanteTags.length >
                                    0 && (
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                      {relevanteTags.map(
                                        (tag) => (
                                          <span
                                            key={tag.id}
                                            className="rounded-full border border-white/70 bg-white/70 px-2 py-0.5 text-xs font-medium text-slate-700"
                                          >
                                            {tag.naam}
                                          </span>
                                        ),
                                      )}
                                    </div>
                                  )}
                                </div>

                                <span
                                  className={`w-fit shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${weergave.badge}`}
                                >
                                  {weergave.label}
                                </span>
                              </div>
                            </div>
                          );
                        },
                      )}
                    </div>
                  )}

                  {geselecteerdeTagIds.length >
                    0 &&
                    geschikteMedewerkers.length >
                      0 && (
                      <div className="mt-4 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-emerald-100 px-3 py-1 font-medium text-emerald-800">
                          Groen · Beschikbaar
                        </span>

                        <span className="rounded-full bg-amber-100 px-3 py-1 font-medium text-amber-800">
                          Geel · Voorkeur
                        </span>

                        <span className="rounded-full bg-red-100 px-3 py-1 font-medium text-red-800">
                          Rood · Niet beschikbaar
                        </span>

                        <span className="rounded-full bg-blue-100 px-3 py-1 font-medium text-blue-800">
                          Blauw · Al ingepland
                        </span>

                        <span className="rounded-full bg-slate-200 px-3 py-1 font-medium text-slate-700">
                          Grijs · Geen beschikbaarheid
                        </span>
                      </div>
                    )}
                </div>

                {/* =================================================
                    OPMERKINGEN
                    ================================================= */}

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Opmerkingen
                  </label>

                  <textarea
                    rows={3}
                    value={opmerkingen}
                    onChange={(event) =>
                      setOpmerkingen(
                        event.target.value,
                      )
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                    placeholder="Eventuele opmerkingen..."
                  />
                </div>

                {fout && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {fout}
                  </div>
                )}
              </div>

              {/* ==================================================
                  FOOTER
                  ================================================== */}

              <div className="flex justify-end gap-3 border-t border-slate-200 p-5">
                <button
                  type="button"
                  onClick={() =>
                    setNieuweDienstDatum(
                      null,
                    )
                  }
                  disabled={
                    opslaanBezig
                  }
                  className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Annuleren
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void maakNieuweDienst()
                  }
                  disabled={
                    opslaanBezig
                  }
                  className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {opslaanBezig
                    ? "Aanmaken..."
                    : "Dienst aanmaken"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}