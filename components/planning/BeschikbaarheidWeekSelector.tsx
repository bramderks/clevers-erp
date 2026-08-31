"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/* ============================================================
   TYPES
   ============================================================ */

type Vestiging = {
  id: string;
  naam: string;
};

export type SelectorWeek = {
  id: string;
  jaar: number;
  weeknummer: number;
  status: string;
  startdatum: string;
  einddatum: string;
  beschikbaarheidDeadline: string | null;
};

type BeschikbaarheidWeekSelectorProps = {
  vestigingen: Vestiging[];
  medewerkerId: string;
  isBeheerder: boolean;
  bewerkmodus?: boolean;
  onSelected?: (
    vestigingId: string,
    week: SelectorWeek,
  ) => void;
};

type WeekStatus =
  | "DOORGEGEVEN"
  | "NOG_DOORGEVEN"
  | "FOUT";

type DagStatus =
  | "BESCHIKBAAR"
  | "NIET_BESCHIKBAAR";

type DagBeschikbaarheid = {
  datum: string;
  status: DagStatus;
  begintijd: string;
  eindtijd: string;
  opmerking: string;
  opgeslagen: boolean;
};

type WeekDag = {
  datum: string;
  naam: string;
  korteNaam: string;
  nummer: number;
  maand: string;
};

type BeschikbaarheidApiResponse = {
  error?: string;
  fout?: string;
  beschikbaarheden?: unknown[];
};

type WekenApiResponse = {
  error?: string;
  fout?: string;
  weken?: SelectorWeek[];
  eersteOpenstaandeWeek?: SelectorWeek | null;
};

/* ============================================================
   CONSTANTEN
   ============================================================ */

const MIN_TIJD = "09:00";
const MAX_TIJD = "23:00";
const TIJD_INTERVAL = 30;

/* ============================================================
   DATUMFUNCTIES
   ============================================================ */

function parseDatum(
  waarde: string | Date | null | undefined,
): Date | null {
  if (!waarde) {
    return null;
  }

  if (waarde instanceof Date) {
    if (Number.isNaN(waarde.getTime())) {
      return null;
    }

    return new Date(waarde);
  }

  if (typeof waarde !== "string") {
    return null;
  }

  const tekst = waarde.trim();

  if (!tekst) {
    return null;
  }

  /*
   * Een losse YYYY-MM-DD moet als lokale kalenderdatum
   * worden behandeld. Zo voorkomen we UTC-verschuivingen.
   */
  const alleenDatum = tekst.match(
    /^(\d{4})-(\d{2})-(\d{2})$/,
  );

  if (alleenDatum) {
    const jaar = Number(alleenDatum[1]);
    const maand = Number(alleenDatum[2]);
    const dag = Number(alleenDatum[3]);

    const datum = new Date(
      jaar,
      maand - 1,
      dag,
      12,
      0,
      0,
      0,
    );

    if (
      datum.getFullYear() !== jaar ||
      datum.getMonth() !== maand - 1 ||
      datum.getDate() !== dag
    ) {
      return null;
    }

    return datum;
  }

  const datum = new Date(tekst);

  if (Number.isNaN(datum.getTime())) {
    return null;
  }

  return datum;
}

function formatteerDatumSleutel(
  datum: Date,
): string {
  const jaar = datum.getFullYear();

  const maand = String(
    datum.getMonth() + 1,
  ).padStart(2, "0");

  const dag = String(
    datum.getDate(),
  ).padStart(2, "0");

  return `${jaar}-${maand}-${dag}`;
}

function eersteDagVanISOWeek(
  jaar: number,
  weeknummer: number,
): Date | null {
  if (
    !Number.isInteger(jaar) ||
    !Number.isInteger(weeknummer) ||
    jaar < 2000 ||
    weeknummer < 1 ||
    weeknummer > 53
  ) {
    return null;
  }

  const donderdag = new Date(
    jaar,
    0,
    4,
    12,
    0,
    0,
    0,
  );

  const dagVanWeek =
    donderdag.getDay() === 0
      ? 7
      : donderdag.getDay();

  const maandagEersteWeek =
    new Date(donderdag);

  maandagEersteWeek.setDate(
    donderdag.getDate() -
      (dagVanWeek - 1),
  );

  const maandag = new Date(
    maandagEersteWeek,
  );

  maandag.setDate(
    maandagEersteWeek.getDate() +
      (weeknummer - 1) * 7,
  );

  maandag.setHours(
    12,
    0,
    0,
    0,
  );

  return maandag;
}

function bepaalWeekStart(
  week: SelectorWeek,
): Date | null {
  const start = parseDatum(
    week.startdatum,
  );

  if (start) {
    start.setHours(
      12,
      0,
      0,
      0,
    );

    return start;
  }

  return eersteDagVanISOWeek(
    week.jaar,
    week.weeknummer,
  );
}

function maakWeekDagen(
  week: SelectorWeek | null,
): WeekDag[] {
  if (!week) {
    return [];
  }

  const start = bepaalWeekStart(week);

  if (!start) {
    return [];
  }

  const dagen: WeekDag[] = [];

  for (
    let index = 0;
    index < 7;
    index += 1
  ) {
    const datum = new Date(start);

    datum.setDate(
      start.getDate() + index,
    );

    datum.setHours(
      12,
      0,
      0,
      0,
    );

    const datumSleutel =
      formatteerDatumSleutel(datum);

    const naam =
      new Intl.DateTimeFormat(
        "nl-NL",
        {
          weekday: "long",
        },
      ).format(datum);

    const korteNaam =
      new Intl.DateTimeFormat(
        "nl-NL",
        {
          weekday: "short",
        },
      ).format(datum);

    const maand =
      new Intl.DateTimeFormat(
        "nl-NL",
        {
          month: "short",
        },
      ).format(datum);

    dagen.push({
      datum: datumSleutel,
      naam,
      korteNaam,
      nummer: datum.getDate(),
      maand,
    });
  }

  return dagen;
}

/* ============================================================
   TIJDEN
   ============================================================ */

function maakTijden(): string[] {
  const tijden: string[] = [];

  for (
    let minuten = 9 * 60;
    minuten <= 23 * 60;
    minuten += TIJD_INTERVAL
  ) {
    const uren = Math.floor(
      minuten / 60,
    );

    const minutenBinnenUur =
      minuten % 60;

    tijden.push(
      `${String(uren).padStart(2, "0")}:${String(
        minutenBinnenUur,
      ).padStart(2, "0")}`,
    );
  }

  return tijden;
}

function tijdNaarMinuten(
  tijd: string,
): number | null {
  const match = tijd.match(
    /^(\d{2}):(\d{2})$/,
  );

  if (!match) {
    return null;
  }

  const uren = Number(match[1]);
  const minuten = Number(match[2]);

  if (
    Number.isNaN(uren) ||
    Number.isNaN(minuten)
  ) {
    return null;
  }

  if (
    uren < 0 ||
    uren > 23 ||
    minuten < 0 ||
    minuten > 59
  ) {
    return null;
  }

  return uren * 60 + minuten;
}

function tijdenGeldig(
  begintijd: string,
  eindtijd: string,
): boolean {
  if (!begintijd || !eindtijd) {
    return false;
  }

  const begin =
    tijdNaarMinuten(begintijd);

  const eind =
    tijdNaarMinuten(eindtijd);

  const minimum =
    tijdNaarMinuten(MIN_TIJD);

  const maximum =
    tijdNaarMinuten(MAX_TIJD);

  if (
    begin === null ||
    eind === null ||
    minimum === null ||
    maximum === null
  ) {
    return false;
  }

  if (
    begin < minimum ||
    begin > maximum ||
    eind < minimum ||
    eind > maximum
  ) {
    return false;
  }

  if (begin >= eind) {
    return false;
  }

  return (
    begin % TIJD_INTERVAL === 0 &&
    eind % TIJD_INTERVAL === 0
  );
}

function normaliseerTijd(
  waarde: unknown,
): string {
  if (
    typeof waarde !== "string" ||
    !waarde
  ) {
    return "";
  }

  const match = waarde.match(
    /^(\d{1,2}):(\d{2})/,
  );

  if (!match) {
    return "";
  }

  const uren = Number(match[1]);
  const minuten = Number(match[2]);

  if (
    Number.isNaN(uren) ||
    Number.isNaN(minuten) ||
    uren < 0 ||
    uren > 23 ||
    minuten < 0 ||
    minuten > 59
  ) {
    return "";
  }

  return `${String(uren).padStart(
    2,
    "0",
  )}:${String(minuten).padStart(
    2,
    "0",
  )}`;
}

function haalTijdUitWaarde(
  waarde: unknown,
): string {
  const directeTijd =
    normaliseerTijd(waarde);

  if (directeTijd) {
    return directeTijd;
  }

  if (
    typeof waarde !== "string" ||
    !waarde
  ) {
    return "";
  }

  const datum = parseDatum(waarde);

  if (!datum) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "nl-NL",
    {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    },
  )
    .format(datum)
    .replace(".", ":");
}

/* ============================================================
   BESCHIKBAARHEID NORMALISEREN
   ============================================================ */

function haalDatumUitWaarde(
  waarde: unknown,
): string | null {
  if (!waarde) {
    return null;
  }

  if (typeof waarde === "string") {
    if (
      /^\d{4}-\d{2}-\d{2}$/.test(
        waarde,
      )
    ) {
      return waarde;
    }

    const datum = parseDatum(waarde);

    return datum
      ? formatteerDatumSleutel(datum)
      : null;
  }

  if (
    typeof waarde === "object" &&
    waarde !== null
  ) {
    const object =
      waarde as Record<
        string,
        unknown
      >;

    const mogelijkeWaarden = [
      object.datum,
      object.date,
      object.startdatum,
    ];

    for (const item of mogelijkeWaarden) {
      const datum =
        haalDatumUitWaarde(item);

      if (datum) {
        return datum;
      }
    }
  }

  return null;
}

function standaardDag(
  datum: string,
): DagBeschikbaarheid {
  return {
    datum,
    status: "NIET_BESCHIKBAAR",
    begintijd: "",
    eindtijd: "",
    opmerking: "",
    opgeslagen: false,
  };
}

/* ============================================================
   DEADLINE
   ============================================================ */

function isDeadlineVerstreken(
  week: SelectorWeek,
): boolean {
  if (!week.beschikbaarheidDeadline) {
    return false;
  }

  const deadline = parseDatum(
    week.beschikbaarheidDeadline,
  );

  if (!deadline) {
    return false;
  }

  return new Date() > deadline;
}

function formatteerDeadline(
  deadline: string,
): string {
  const datum =
    parseDatum(deadline);

  if (!datum) {
    return "Onbekende deadline";
  }

  return new Intl.DateTimeFormat(
    "nl-NL",
    {
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(datum);
}

function formatteerWeekPeriode(
  week: SelectorWeek,
): string {
  const start =
    bepaalWeekStart(week);

  if (!start) {
    return `Week ${week.weeknummer}`;
  }

  const einde = new Date(start);

  einde.setDate(
    start.getDate() + 6,
  );

  const startDag =
    start.getDate();

  const eindDag =
    einde.getDate();

  const startMaand =
    new Intl.DateTimeFormat(
      "nl-NL",
      {
        month: "long",
      },
    ).format(start);

  const eindMaand =
    new Intl.DateTimeFormat(
      "nl-NL",
      {
        month: "long",
      },
    ).format(einde);

  if (
    start.getMonth() ===
    einde.getMonth()
  ) {
    return `${startDag} t/m ${eindDag} ${startMaand}`;
  }

  return `${startDag} ${startMaand} t/m ${eindDag} ${eindMaand}`;
}

/* ============================================================
   API
   ============================================================ */

async function leesJsonResponse<T>(
  response: Response,
): Promise<T> {
  const tekst =
    await response.text();

  if (!tekst) {
    return {} as T;
  }

  try {
    return JSON.parse(
      tekst,
    ) as T;
  } catch {
    throw new Error(
      "De server gaf een ongeldig antwoord terug.",
    );
  }
}

async function haalWeekStatusOp(
  medewerkerId: string,
  weekId: string,
): Promise<WeekStatus> {
  try {
    const response =
      await fetch(
        `/api/medewerkers/${encodeURIComponent(
          medewerkerId,
        )}/beschikbaarheid?weekId=${encodeURIComponent(
          weekId,
        )}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

    const resultaat =
      await leesJsonResponse<BeschikbaarheidApiResponse>(
        response,
      );

    if (!response.ok) {
      throw new Error(
        resultaat.error ??
          resultaat.fout ??
          "Beschikbaarheid kon niet worden opgehaald.",
      );
    }

    const beschikbaarheden =
      Array.isArray(
        resultaat.beschikbaarheden,
      )
        ? resultaat.beschikbaarheden
        : [];

    return beschikbaarheden.length > 0
      ? "DOORGEGEVEN"
      : "NOG_DOORGEVEN";
  } catch (error) {
    console.error(
      "Fout bij ophalen weekstatus:",
      error,
    );

    return "FOUT";
  }
}

/* ============================================================
   STATUS BADGE
   ============================================================ */

function StatusBadge({
  status,
}: {
  status: WeekStatus | undefined;
}) {
  if (status === "DOORGEGEVEN") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800">
        <span className="h-1.5 w-1.5 rounded-full bg-green-600" />
        Doorgegeven
      </span>
    );
  }

  if (status === "NOG_DOORGEVEN") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800">
        <span className="h-1.5 w-1.5 rounded-full bg-red-600" />
        Nog doorgeven
      </span>
    );
  }

  if (status === "FOUT") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
        Status onbekend
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
      Status laden...
    </span>
  );
}

/* ============================================================
   COMPONENT
   ============================================================ */

export default function BeschikbaarheidWeekSelector({
  vestigingen,
  medewerkerId,
  isBeheerder,
  bewerkmodus = false,
  onSelected,
}: BeschikbaarheidWeekSelectorProps) {
  const [vestigingId, setVestigingId] =
    useState<string>(
      vestigingen[0]?.id ?? "",
    );

  const [weken, setWeken] =
    useState<SelectorWeek[]>([]);

  const [weekStatussen, setWeekStatussen] =
    useState<
      Record<string, WeekStatus>
    >({});

  const [weekId, setWeekId] =
    useState<string>("");

  const [loading, setLoading] =
    useState(false);

  const [
    loadingStatussen,
    setLoadingStatussen,
  ] = useState(false);

  const [
    loadingDagen,
    setLoadingDagen,
  ] = useState(false);

  const [
    opslaanDatum,
    setOpslaanDatum,
  ] = useState<string | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  const [dagFouten, setDagFouten] =
    useState<
      Record<string, string>
    >({});

  const [
    dagenInvoer,
    setDagenInvoer,
  ] = useState<
    Record<
      string,
      DagBeschikbaarheid
    >
  >({});

  const planbordRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  const onSelectedRef =
    useRef(onSelected);

  useEffect(() => {
    onSelectedRef.current =
      onSelected;
  }, [onSelected]);

  /*
   * Alleen de Eigenaar krijgt via de pagina
   * daadwerkelijke bewerkrechten.
   *
   * bewerkmodus bepaalt vervolgens of de
   * eigenaar daadwerkelijk aan het wijzigen is.
   */
  const magBewerken =
    isBeheerder && bewerkmodus;

  const geselecteerdeWeek =
    useMemo<SelectorWeek | null>(() => {
      return (
        weken.find(
          (week) =>
            week.id === weekId,
        ) ?? null
      );
    }, [weken, weekId]);

  const geselecteerdeStatus =
    geselecteerdeWeek
      ? weekStatussen[
          geselecteerdeWeek.id
        ]
      : undefined;

  const deadlineVerstreken =
    geselecteerdeWeek
      ? isDeadlineVerstreken(
          geselecteerdeWeek,
        )
      : false;

  /*
   * De eigenaar mag ook na de deadline
   * aanpassen. Andere gebruikers niet.
   */
  const wijzigingToegestaan =
    magBewerken &&
    (!deadlineVerstreken ||
      isBeheerder);

  const weekDagen = useMemo(
    () =>
      maakWeekDagen(
        geselecteerdeWeek,
      ),
    [geselecteerdeWeek],
  );

  const tijden = useMemo(
    () => maakTijden(),
    [],
  );

  /* ==========================================================
     WEKEN LADEN
     ========================================================== */

  useEffect(() => {
    if (!vestigingId) {
      setWeken([]);
      setWeekId("");
      setWeekStatussen({});
      return;
    }

    let actief = true;

    async function laadWeken() {
      setLoading(true);
      setError(null);
      setWeekStatussen({});
      setDagenInvoer({});
      setDagFouten({});

      try {
        const response =
          await fetch(
            `/api/medewerkers/${encodeURIComponent(
              medewerkerId,
            )}/beschikbaarheid/weken?vestigingId=${encodeURIComponent(
              vestigingId,
            )}`,
            {
              method: "GET",
              cache: "no-store",
            },
          );

        const resultaat =
          await leesJsonResponse<WekenApiResponse>(
            response,
          );

        if (!response.ok) {
          throw new Error(
            resultaat.fout ??
              resultaat.error ??
              "De planningweken konden niet worden opgehaald.",
          );
        }

        const opgehaaldeWeken =
          Array.isArray(
            resultaat.weken,
          )
            ? resultaat.weken.filter(
                (week) =>
                  Boolean(
                    week &&
                      typeof week.id ===
                        "string" &&
                      week.id.length > 0 &&
                      Number.isInteger(
                        week.jaar,
                      ) &&
                      Number.isInteger(
                        week.weeknummer,
                      ),
                  ),
              )
            : [];

        if (!actief) {
          return;
        }

        setWeken(
          opgehaaldeWeken,
        );

        const eersteOpenstaandeWeek =
          resultaat.eersteOpenstaandeWeek ??
          null;

        const eersteWeek =
          eersteOpenstaandeWeek &&
          opgehaaldeWeken.some(
            (week) =>
              week.id ===
              eersteOpenstaandeWeek.id,
          )
            ? eersteOpenstaandeWeek
            : opgehaaldeWeken[0] ??
              null;

        if (eersteWeek) {
          setWeekId(
            eersteWeek.id,
          );

          onSelectedRef.current?.(
            vestigingId,
            eersteWeek,
          );
        } else {
          setWeekId("");
        }

        /*
         * De status van iedere zichtbare week
         * wordt parallel opgehaald.
         */
        setLoadingStatussen(true);

        const resultaten =
          await Promise.all(
            opgehaaldeWeken.map(
              async (week) => {
                const status =
                  await haalWeekStatusOp(
                    medewerkerId,
                    week.id,
                  );

                return [
                  week.id,
                  status,
                ] as const;
              },
            ),
          );

        if (!actief) {
          return;
        }

        setWeekStatussen(
          Object.fromEntries(
            resultaten,
          ) as Record<
            string,
            WeekStatus
          >,
        );
      } catch (error) {
        if (!actief) {
          return;
        }

        console.error(
          "Fout bij laden planningweken:",
          error,
        );

        setWeken([]);
        setWeekId("");
        setWeekStatussen({});

        setError(
          error instanceof Error
            ? error.message
            : "De planningweken konden niet worden opgehaald.",
        );
      } finally {
        if (actief) {
          setLoading(false);
          setLoadingStatussen(false);
        }
      }
    }

    void laadWeken();

    return () => {
      actief = false;
    };
  }, [
    vestigingId,
    medewerkerId,
  ]);

  /* ==========================================================
     BESCHIKBAARHEID GESELECTEERDE WEEK LADEN
     ========================================================== */

  useEffect(() => {
    if (!geselecteerdeWeek) {
      setDagenInvoer({});
      setDagFouten({});
      return;
    }

    const week =
      geselecteerdeWeek;

    const dagen =
      maakWeekDagen(week);

    const basis: Record<
      string,
      DagBeschikbaarheid
    > = {};

    for (const dag of dagen) {
      basis[dag.datum] =
        standaardDag(
          dag.datum,
        );
    }

    setDagenInvoer(basis);
    setDagFouten({});
    setError(null);

    let actief = true;

    async function laadBeschikbaarheid() {
      setLoadingDagen(true);

      try {
        const response =
          await fetch(
            `/api/medewerkers/${encodeURIComponent(
              medewerkerId,
            )}/beschikbaarheid?weekId=${encodeURIComponent(
              week.id,
            )}`,
            {
              method: "GET",
              cache: "no-store",
            },
          );

        const resultaat =
          await leesJsonResponse<BeschikbaarheidApiResponse>(
            response,
          );

        if (!response.ok) {
          throw new Error(
            resultaat.error ??
              resultaat.fout ??
              "De beschikbaarheid kon niet worden opgehaald.",
          );
        }

        const records =
          Array.isArray(
            resultaat.beschikbaarheden,
          )
            ? resultaat.beschikbaarheden
            : [];

        if (!actief) {
          return;
        }

        const nieuweInvoer: Record<
          string,
          DagBeschikbaarheid
        > = {
          ...basis,
        };

        for (const record of records) {
          if (
            typeof record !==
              "object" ||
            record === null
          ) {
            continue;
          }

          const item =
            record as Record<
              string,
              unknown
            >;

          const datum =
            haalDatumUitWaarde(
              item.datum ??
                item.date ??
                item.startdatum,
            );

          if (!datum) {
            continue;
          }

          if (!nieuweInvoer[datum]) {
            continue;
          }

          const status: DagStatus =
            item.status ===
            "BESCHIKBAAR"
              ? "BESCHIKBAAR"
              : "NIET_BESCHIKBAAR";

          const begintijd =
            haalTijdUitWaarde(
              item.begintijd,
            );

          const eindtijd =
            haalTijdUitWaarde(
              item.eindtijd,
            );

          nieuweInvoer[datum] = {
            datum,
            status,
            begintijd,
            eindtijd,
            opmerking:
              typeof item.opmerking ===
              "string"
                ? item.opmerking
                : "",
            opgeslagen: true,
          };
        }

        setDagenInvoer(
          nieuweInvoer,
        );
      } catch (error) {
        if (!actief) {
          return;
        }

        console.error(
          "Fout bij laden beschikbaarheid:",
          error,
        );

        setError(
          error instanceof Error
            ? error.message
            : "De beschikbaarheid kon niet worden opgehaald.",
        );
      } finally {
        if (actief) {
          setLoadingDagen(false);
        }
      }
    }

    void laadBeschikbaarheid();

    return () => {
      actief = false;
    };
  }, [
    geselecteerdeWeek?.id,
    medewerkerId,
  ]);

  /* ==========================================================
     WEEK SELECTEREN
     ========================================================== */

  function selecteerWeek(
    nieuweWeekId: string,
  ): void {
    const week =
      weken.find(
        (item) =>
          item.id ===
          nieuweWeekId,
      );

    if (!week) {
      return;
    }

    setWeekId(nieuweWeekId);
    setError(null);
    setDagFouten({});

    onSelectedRef.current?.(
      vestigingId,
      week,
    );

    window.setTimeout(() => {
      planbordRef.current?.scrollIntoView(
        {
          behavior: "smooth",
          block: "start",
        },
      );
    }, 120);
  }

  /* ==========================================================
     DAG WIJZIGEN
     ========================================================== */

  function wijzigDag(
    datum: string,
    wijziging: Partial<
      DagBeschikbaarheid
    >,
  ): void {
    if (!wijzigingToegestaan) {
      return;
    }

    setDagenInvoer(
      (vorige) => {
        const bestaandeDag =
          vorige[datum] ??
          standaardDag(datum);

        return {
          ...vorige,
          [datum]: {
            ...bestaandeDag,
            ...wijziging,
            opgeslagen: false,
          },
        };
      },
    );

    setDagFouten(
      (vorige) => {
        const volgende = {
          ...vorige,
        };

        delete volgende[datum];

        return volgende;
      },
    );
  }

  function maakDagBeschikbaar(
    datum: string,
  ): void {
    if (!wijzigingToegestaan) {
      return;
    }

    const huidigeDag =
      dagenInvoer[datum] ??
      standaardDag(datum);

    wijzigDag(datum, {
      status: "BESCHIKBAAR",
      begintijd:
        huidigeDag.begintijd ||
        MIN_TIJD,
      eindtijd:
        huidigeDag.eindtijd ||
        MAX_TIJD,
    });
  }

  function maakDagNietBeschikbaar(
    datum: string,
  ): void {
    if (!wijzigingToegestaan) {
      return;
    }

    wijzigDag(datum, {
      status: "NIET_BESCHIKBAAR",
      begintijd: "",
      eindtijd: "",
    });
  }

  /* ==========================================================
     DAG OPSLAAN
     ========================================================== */

  async function slaDagOp(
    datum: string,
  ): Promise<void> {
    const week =
      geselecteerdeWeek;

    if (!week) {
      setError(
        "Selecteer eerst een planningweek.",
      );
      return;
    }

    if (!wijzigingToegestaan) {
      return;
    }

    const dag =
      dagenInvoer[datum] ??
      standaardDag(datum);

    setDagFouten(
      (vorige) => {
        const volgende = {
          ...vorige,
        };

        delete volgende[datum];

        return volgende;
      },
    );

    const beschikbaar =
      dag.status ===
      "BESCHIKBAAR";

    if (beschikbaar) {
      if (
        !dag.begintijd ||
        !dag.eindtijd
      ) {
        setDagFouten(
          (vorige) => ({
            ...vorige,
            [datum]:
              "Vul een begin- en eindtijd in.",
          }),
        );

        return;
      }

      if (
        !tijdenGeldig(
          dag.begintijd,
          dag.eindtijd,
        )
      ) {
        setDagFouten(
          (vorige) => ({
            ...vorige,
            [datum]:
              "Kies geldige tijden tussen 09:00 en 23:00 in stappen van 30 minuten.",
          }),
        );

        return;
      }
    }

    if (
      deadlineVerstreken &&
      !isBeheerder
    ) {
      setDagFouten(
        (vorige) => ({
          ...vorige,
          [datum]:
            "De deadline voor deze week is verstreken.",
        }),
      );

      return;
    }

    try {
      setOpslaanDatum(datum);

      const datumWaarde =
        parseDatum(datum);

      if (!datumWaarde) {
        throw new Error(
          "De datum van deze dag kon niet worden bepaald.",
        );
      }

      let begintijd:
        | string
        | null = null;

      let eindtijd:
        | string
        | null = null;

      if (beschikbaar) {
        const beginDatum =
          new Date(
            `${datum}T${dag.begintijd}:00`,
          );

        const eindDatum =
          new Date(
            `${datum}T${dag.eindtijd}:00`,
          );

        if (
          Number.isNaN(
            beginDatum.getTime(),
          ) ||
          Number.isNaN(
            eindDatum.getTime(),
          )
        ) {
          throw new Error(
            "De gekozen tijden konden niet worden verwerkt.",
          );
        }

        begintijd =
          beginDatum.toISOString();

        eindtijd =
          eindDatum.toISOString();
      }

      const response =
        await fetch(
          `/api/medewerkers/${encodeURIComponent(
            medewerkerId,
          )}/beschikbaarheid`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              weekId: week.id,
              datum:
                datumWaarde.toISOString(),
              begintijd,
              eindtijd,
              status: beschikbaar
                ? "BESCHIKBAAR"
                : "NIET_BESCHIKBAAR",
              opmerking:
                dag.opmerking.trim() ||
                null,
            }),
          },
        );

      const resultaat =
        await leesJsonResponse<{
          fout?: string;
          error?: string;
        }>(response);

      if (!response.ok) {
        throw new Error(
          resultaat.fout ??
            resultaat.error ??
            "De beschikbaarheid kon niet worden opgeslagen.",
        );
      }

      setDagenInvoer(
        (vorige) => {
          const bestaandeDag =
            vorige[datum] ??
            standaardDag(datum);

          return {
            ...vorige,
            [datum]: {
              ...bestaandeDag,
              opgeslagen: true,
            },
          };
        },
      );

      const nieuweStatus =
        await haalWeekStatusOp(
          medewerkerId,
          week.id,
        );

      setWeekStatussen(
        (vorige) => ({
          ...vorige,
          [week.id]:
            nieuweStatus,
        }),
      );
    } catch (error) {
      console.error(
        "Fout bij opslaan dag:",
        error,
      );

      setDagFouten(
        (vorige) => ({
          ...vorige,
          [datum]:
            error instanceof Error
              ? error.message
              : "De beschikbaarheid kon niet worden opgeslagen.",
        }),
      );
    } finally {
      setOpslaanDatum(null);
    }
  }

  /* ==========================================================
     GEEN VESTIGINGEN
     ========================================================== */

  if (vestigingen.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-6 text-center">
          <p className="text-sm font-semibold text-slate-700">
            Geen vestiging gekoppeld
          </p>

          <p className="mt-1 text-sm text-slate-500">
            Deze medewerker heeft nog geen vestiging
            waaraan beschikbaarheid kan worden gekoppeld.
          </p>
        </div>
      </section>
    );
  }

  /* ==========================================================
     RENDER
     ========================================================== */

  return (
    <section className="space-y-6">
      {/* ======================================================
          SELECTIE
          ====================================================== */}

      <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
          <div>
            <label
              htmlFor="beschikbaarheid-vestiging"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              Vestiging
            </label>

            <select
              id="beschikbaarheid-vestiging"
              value={vestigingId}
              onChange={(event) => {
                setVestigingId(
                  event.target.value,
                );
                setWeekId("");
                setWeekStatussen({});
                setDagenInvoer({});
                setDagFouten({});
                setError(null);
              }}
              disabled={
                loading ||
                vestigingen.length <= 1
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-medium text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-100 disabled:text-slate-500"
            >
              {vestigingen.map(
                (vestiging) => (
                  <option
                    key={vestiging.id}
                    value={vestiging.id}
                  >
                    {vestiging.naam}
                  </option>
                ),
              )}
            </select>
          </div>

          <div>
            <label
              htmlFor="beschikbaarheid-week"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              Planningweek
            </label>

            <select
              id="beschikbaarheid-week"
              value={weekId}
              onChange={(event) =>
                selecteerWeek(
                  event.target.value,
                )
              }
              disabled={
                loading ||
                weken.length === 0
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-medium text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-100 disabled:text-slate-500"
            >
              {weken.length === 0 ? (
                <option value="">
                  {loading
                    ? "Beschikbare weken laden..."
                    : "Geen weken beschikbaar"}
                </option>
              ) : (
                weken.map((week) => (
                  <option
                    key={week.id}
                    value={week.id}
                  >
                    Week{" "}
                    {week.weeknummer}{" "}
                    · {week.jaar}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* ====================================================
            UITLEG BEWERKRECHTEN
            ==================================================== */}

        {!magBewerken && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs font-medium text-slate-500">
              Beschikbaarheid wordt hier alleen
              bekeken.
            </p>
          </div>
        )}
      </div>

      {/* ======================================================
          WEEKOVERZICHT
          ====================================================== */}

      {weken.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Beschikbaarheid per week
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Selecteer een planningweek om de
                beschikbaarheid per dag te bekijken.
              </p>
            </div>

            {loadingStatussen && (
              <span className="text-xs font-medium text-slate-400">
                Statussen laden...
              </span>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {weken.map((week) => {
              const status =
                weekStatussen[
                  week.id
                ];

              const gesloten =
                isDeadlineVerstreken(
                  week,
                );

              const geselecteerd =
                week.id === weekId;

              return (
                <button
                  key={week.id}
                  type="button"
                  onClick={() =>
                    selecteerWeek(
                      week.id,
                    )
                  }
                  className={[
                    "group rounded-xl border bg-white p-4 text-left shadow-sm transition",
                    "hover:border-slate-300 hover:shadow",
                    "focus:outline-none focus:ring-2 focus:ring-slate-200",
                    geselecteerd
                      ? "border-slate-900 ring-2 ring-slate-100"
                      : "border-slate-200",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-slate-900">
                        Week{" "}
                        {week.weeknummer}
                      </p>

                      <p className="mt-0.5 text-sm text-slate-500">
                        {formatteerWeekPeriode(
                          week,
                        )}
                      </p>
                    </div>

                    <StatusBadge
                      status={status}
                    />
                  </div>

                  <div className="mt-4 border-t border-slate-100 pt-3">
                    {week.beschikbaarheidDeadline ? (
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-medium text-slate-400">
                          Deadline
                        </span>

                        <span
                          className={[
                            "text-xs font-semibold",
                            gesloten
                              ? isBeheerder
                                ? "text-blue-700"
                                : "text-red-700"
                              : "text-slate-600",
                          ].join(" ")}
                        >
                          {formatteerDeadline(
                            week.beschikbaarheidDeadline,
                          )}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">
                        Geen deadline ingesteld
                      </span>
                    )}

                    {gesloten && (
                      <div
                        className={[
                          "mt-2 text-xs font-medium",
                          isBeheerder
                            ? "text-blue-700"
                            : "text-red-700",
                        ].join(" ")}
                      >
                        {isBeheerder
                          ? "Deadline verstreken · eigenaar kan wijzigen"
                          : "Deadline verstreken"}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ======================================================
          WEEKPLANBORD
          ====================================================== */}

      {geselecteerdeWeek && (
        <div
          ref={planbordRef}
          className="scroll-mt-6"
        >
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Beschikbaarheid
                </p>

                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  Week{" "}
                  {
                    geselecteerdeWeek.weeknummer
                  }{" "}
                  ·{" "}
                  {
                    geselecteerdeWeek.jaar
                  }
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {formatteerWeekPeriode(
                    geselecteerdeWeek,
                  )}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge
                  status={
                    geselecteerdeStatus
                  }
                />

                {geselecteerdeWeek.beschikbaarheidDeadline && (
                  <span
                    className={[
                      "rounded-full px-3 py-1 text-xs font-semibold",
                      deadlineVerstreken
                        ? isBeheerder
                          ? "bg-blue-100 text-blue-800"
                          : "bg-red-100 text-red-800"
                        : "bg-slate-100 text-slate-600",
                    ].join(" ")}
                  >
                    {deadlineVerstreken
                      ? isBeheerder
                        ? "Deadline verstreken · aanpassen toegestaan"
                        : "Deadline verstreken"
                      : `Deadline ${formatteerDeadline(
                          geselecteerdeWeek.beschikbaarheidDeadline,
                        )}`}
                  </span>
                )}
              </div>
            </div>

            {!magBewerken &&
              deadlineVerstreken && (
                <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                  <p className="text-sm font-semibold text-red-800">
                    De deadline voor deze week is
                    verstreken.
                  </p>

                  <p className="mt-1 text-sm text-red-700">
                    De beschikbaarheid kan alleen door
                    de eigenaar worden aangepast.
                  </p>
                </div>
              )}

            {loadingDagen ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
                <p className="text-sm font-medium text-slate-600">
                  Beschikbaarheid van deze week laden...
                </p>
              </div>
            ) : weekDagen.length !== 7 ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
                <p className="text-sm font-semibold text-red-800">
                  De week kon niet correct worden
                  opgebouwd.
                </p>

                <p className="mt-1 text-sm text-red-700">
                  De planningweek bevat geen geldige
                  startdatum.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <div className="min-w-[1190px]">
                  <div className="grid grid-cols-7 divide-x divide-slate-200">
                    {weekDagen.map(
                      (dag) => {
                        const invoer =
                          dagenInvoer[
                            dag.datum
                          ] ??
                          standaardDag(
                            dag.datum,
                          );

                        const beschikbaar =
                          invoer.status ===
                          "BESCHIKBAAR";

                        const fout =
                          dagFouten[
                            dag.datum
                          ];

                        const opslaan =
                          opslaanDatum ===
                          dag.datum;

                        return (
                          <div
                            key={
                              dag.datum
                            }
                            className={[
                              "min-h-[420px] bg-white p-4 transition",
                              beschikbaar
                                ? "bg-green-50/30"
                                : "bg-slate-50/40",
                            ].join(
                              " ",
                            )}
                          >
                            {/* DAGKOP */}

                            <div className="border-b border-slate-200 pb-3">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                    {dag.naam}
                                  </p>

                                  <div className="mt-1 flex items-baseline gap-1.5">
                                    <span className="text-2xl font-bold text-slate-900">
                                      {
                                        dag.nummer
                                      }
                                    </span>

                                    <span className="text-xs font-medium text-slate-400">
                                      {dag.maand}
                                    </span>
                                  </div>
                                </div>

                                {invoer.opgeslagen && (
                                  <span className="rounded-full bg-green-100 px-2 py-1 text-[10px] font-semibold text-green-700">
                                    Opgeslagen
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* STATUS */}

                            <div className="mt-4">
                              {beschikbaar ? (
                                <div className="rounded-xl border border-green-200 bg-green-50 p-3">
                                  <p className="text-sm font-bold text-green-800">
                                    Beschikbaar
                                  </p>

                                  <p className="mt-1 text-xs text-green-700">
                                    Beschikbaar tussen de
                                    opgegeven tijden.
                                  </p>
                                </div>
                              ) : (
                                <div className="rounded-xl border border-slate-200 bg-slate-100 p-3">
                                  <p className="text-sm font-bold text-slate-700">
                                    Niet beschikbaar
                                  </p>

                                  <p className="mt-1 text-xs text-slate-500">
                                    Deze dag is niet als
                                    beschikbaar opgegeven.
                                  </p>
                                </div>
                              )}
                            </div>

                            {/* BESCHIKBAARHEID AAN/UIT */}

                            {magBewerken && (
                              <div className="mt-3">
                                {beschikbaar ? (
                                  <button
                                    type="button"
                                    disabled={
                                      opslaan ||
                                      !wijzigingToegestaan
                                    }
                                    onClick={() =>
                                      maakDagNietBeschikbaar(
                                        dag.datum,
                                      )
                                    }
                                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    Niet beschikbaar
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={
                                      opslaan ||
                                      !wijzigingToegestaan
                                    }
                                    onClick={() =>
                                      maakDagBeschikbaar(
                                        dag.datum,
                                      )
                                    }
                                    className="w-full rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-800 transition hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    Beschikbaar maken
                                  </button>
                                )}
                              </div>
                            )}

                            {/* TIJDEN */}

                            {beschikbaar && (
                              <div className="mt-4 space-y-3">
                                <div>
                                  <label
                                    htmlFor={`begin-${dag.datum}`}
                                    className="block text-xs font-semibold text-slate-600"
                                  >
                                    Vanaf
                                  </label>

                                  <select
                                    id={`begin-${dag.datum}`}
                                    value={
                                      invoer.begintijd
                                    }
                                    disabled={
                                      !magBewerken ||
                                      opslaan ||
                                      !wijzigingToegestaan
                                    }
                                    onChange={(
                                      event,
                                    ) =>
                                      wijzigDag(
                                        dag.datum,
                                        {
                                          begintijd:
                                            event
                                              .target
                                              .value,
                                        },
                                      )
                                    }
                                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm font-medium text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-100 disabled:text-slate-500"
                                  >
                                    <option value="">
                                      Kies tijd
                                    </option>

                                    {tijden.map(
                                      (
                                        tijd,
                                      ) => (
                                        <option
                                          key={`begin-${dag.datum}-${tijd}`}
                                          value={
                                            tijd
                                          }
                                        >
                                          {
                                            tijd
                                          }
                                        </option>
                                      ),
                                    )}
                                  </select>
                                </div>

                                <div>
                                  <label
                                    htmlFor={`eind-${dag.datum}`}
                                    className="block text-xs font-semibold text-slate-600"
                                  >
                                    Tot
                                  </label>

                                  <select
                                    id={`eind-${dag.datum}`}
                                    value={
                                      invoer.eindtijd
                                    }
                                    disabled={
                                      !magBewerken ||
                                      opslaan ||
                                      !wijzigingToegestaan
                                    }
                                    onChange={(
                                      event,
                                    ) =>
                                      wijzigDag(
                                        dag.datum,
                                        {
                                          eindtijd:
                                            event
                                              .target
                                              .value,
                                        },
                                      )
                                    }
                                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm font-medium text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-100 disabled:text-slate-500"
                                  >
                                    <option value="">
                                      Kies tijd
                                    </option>

                                    {tijden.map(
                                      (
                                        tijd,
                                      ) => (
                                        <option
                                          key={`eind-${dag.datum}-${tijd}`}
                                          value={
                                            tijd
                                          }
                                        >
                                          {
                                            tijd
                                          }
                                        </option>
                                      ),
                                    )}
                                  </select>
                                </div>

                                <div>
                                  <label
                                    htmlFor={`opmerking-${dag.datum}`}
                                    className="block text-xs font-semibold text-slate-600"
                                  >
                                    Opmerking
                                  </label>

                                  <textarea
                                    id={`opmerking-${dag.datum}`}
                                    value={
                                      invoer.opmerking
                                    }
                                    disabled={
                                      !magBewerken ||
                                      opslaan ||
                                      !wijzigingToegestaan
                                    }
                                    onChange={(
                                      event,
                                    ) =>
                                      wijzigDag(
                                        dag.datum,
                                        {
                                          opmerking:
                                            event
                                              .target
                                              .value,
                                        },
                                      )
                                    }
                                    rows={2}
                                    placeholder="Optioneel"
                                    className="mt-1 w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-100 disabled:text-slate-500"
                                  />
                                </div>
                              </div>
                            )}

                            {/* NIET BESCHIKBAAR */}

                            {!beschikbaar && (
                              <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-white p-3">
                                <p className="text-xs leading-5 text-slate-500">
                                  Geen beschikbaarheid
                                  opgegeven voor deze dag.
                                </p>
                              </div>
                            )}

                            {/* FOUT */}

                            {fout && (
                              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2.5">
                                <p className="text-xs font-medium leading-4 text-red-700">
                                  {fout}
                                </p>
                              </div>
                            )}

                            {/* OPSLAAN */}

                            {magBewerken && (
                              <button
                                type="button"
                                disabled={
                                  opslaan ||
                                  !wijzigingToegestaan
                                }
                                onClick={() =>
                                  void slaDagOp(
                                    dag.datum,
                                  )
                                }
                                className={[
                                  "mt-4 w-full rounded-lg px-3 py-2.5 text-xs font-bold transition",
                                  opslaan
                                    ? "cursor-not-allowed bg-slate-200 text-slate-500"
                                    : !wijzigingToegestaan
                                      ? "cursor-not-allowed bg-slate-200 text-slate-400"
                                      : "bg-slate-900 text-white hover:bg-slate-800",
                                ].join(
                                  " ",
                                )}
                              >
                                {opslaan
                                  ? "Opslaan..."
                                  : "Dag opslaan"}
                              </button>
                            )}
                          </div>
                        );
                      },
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* LEGENDA */}

              <div className="mt-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-green-500" />

                    <span className="text-xs font-medium text-slate-600">
                      Beschikbaar
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-slate-300" />

                    <span className="text-xs font-medium text-slate-600">
                      Niet beschikbaar
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-400">
                  {magBewerken
                    ? "Wijzig per dag je beschikbaarheid en sla de dag op."
                    : "Beschikbaarheid wordt alleen bekeken."}
                </p>
              </div>
            </div>
          </div>
      )}

      {/* ======================================================
          FOUTMELDING
          ====================================================== */}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-semibold text-red-800">
            Beschikbaarheid kon niet worden geladen
          </p>

          <p className="mt-1 text-sm text-red-700">
            {error}
          </p>
        </div>
      )}
    </section>
  );
}