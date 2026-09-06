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
    tussenvoegsel: string | null;
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

  const heeftOverlappendeDienst =
    medewerker.diensten?.some(
      (bezetting) => {
        if (
          bezetting.dienstId === dienstId ||
          bezetting.status === "AFGEZEGD"
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

  const beschikbaarheden =
    medewerker.beschikbaarheden ?? [];

  if (
    beschikbaarheden.length === 0
  ) {
    return "GEEN_OPGAVE";
  }

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
        tijdNaarInput(
          beschikbaarheid.begintijd,
        ),
      );
    const einde =
      tijdNaarMinuten(
        tijdNaarInput(
          beschikbaarheid.eindtijd,
        ),
      );

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
            tijdNaarInput(
              beschikbaarheid.begintijd,
            ),
          );
        const einde =
          tijdNaarMinuten(
            tijdNaarInput(
              beschikbaarheid.eindtijd,
            ),
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

  if (isBeschikbaar) {
    return "BESCHIKBAAR";
  }

  return "VOORKEUR";
}

export default function DienstBewerkForm({
  dienst,
  vestigingId,
  onGewijzigd,
}: DienstBewerkFormProps) {
  const [datum, setDatum] =
    useState(
      datumNaarInput(dienst.datum),
    );

  const [begintijd, setBegintijd] =
    useState(
      tijdNaarInput(dienst.begintijd),
    );

  const [eindtijd, setEindtijd] =
    useState(
      tijdNaarInput(dienst.eindtijd),
    );

  const [opmerkingen, setOpmerkingen] =
    useState(dienst.opmerkingen ?? "");

  const [
    geselecteerdeTags,
    setGeselecteerdeTags,
  ] = useState<Record<string, number>>(
    () => {
      const resultaat: Record<
        string,
        number
      > = {};

      for (
        const dienstTag of dienst.tags ?? []
      ) {
        resultaat[dienstTag.tagId] =
          dienstTag.aantal;
      }

      return resultaat;
    },
  );

  const [tags, setTags] = useState<
    PlanningTag[]
  >([]);

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

  const startTijden = useMemo(
    () =>
      maakTijden(
        START_MINUTEN,
        EINDE_MINUTEN -
          TIJD_INTERVAL,
      ),
    [],
  );

  const eindTijden = useMemo(() => {
    const startMinuten =
      tijdNaarMinuten(begintijd);

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
              credentials: "include",
              cache: "no-store",
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

  useEffect(() => {
    if (!datum || !vestigingId) {
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
              credentials: "include",
              cache: "no-store",
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
          !("medewerkers" in data) ||
          !Array.isArray(
            (
              data as MedewerkersResponse
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
              data as MedewerkersResponse
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
  }, [vestigingId, datum]);

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
    const aantal = Number(waarde);

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
      tijdNaarMinuten(begintijd);
    const eindeMinuten =
      tijdNaarMinuten(eindtijd);

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
      startMinuten % TIJD_INTERVAL !==
      0 ||
      eindeMinuten % TIJD_INTERVAL !==
      0
    ) {
      setFout(
        "Begin- en eindtijden moeten op halve uren vallen.",
      );
      return;
    }

    if (
      eindeMinuten <= startMinuten
    ) {
      setFout(
        "De eindtijd moet na de begintijd liggen.",
      );
      return;
    }

    setOpslaanBezig(true);

    try {
      const response =
        await fetch(
          `/api/planning/diensten/${encodeURIComponent(
            dienst.id,
          )}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
              datum: `${datum}T00:00:00`,
              begintijd: `${datum}T${begintijd}:00`,
              eindtijd: `${datum}T${eindtijd}:00`,
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
            "De dienst kon niet worden gewijzigd.",
          ),
        );
      }

      setSucces(
        "De dienst is succesvol gewijzigd.",
      );

      onGewijzigd?.();
    } catch (error) {
      console.error(
        "Dienst wijzigen mislukt:",
        error,
      );

      setFout(
        error instanceof Error
          ? error.message
          : "De dienst kon niet worden gewijzigd.",
      );
    } finally {
      setOpslaanBezig(false);
    }
  }

  async function wisselMedewerker(
    medewerkerId: string,
  ) {
    if (bezettingBezig) {
      return;
    }

    setBezettingBezig(
      medewerkerId,
    );
    setFout(null);
    setSucces(null);

    try {
      const response =
        await fetch(
          `/api/planning/diensten/${encodeURIComponent(
            dienst.id,
          )}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
              medewerkerId,
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
        "De medewerker is succesvol gewijzigd.",
      );

      onGewijzigd?.();
    } catch (error) {
      console.error(
        "Medewerker koppelen mislukt:",
        error,
      );

      setFout(
        error instanceof Error
          ? error.message
          : "De medewerker kon niet worden gekoppeld.",
      );
    } finally {
      setBezettingBezig(null);
    }
  }

  const geselecteerdeTagNamen =
    tags
      .filter(
        (tag) =>
          geselecteerdeTags[
            tag.id
          ] !== undefined,
      )
      .map(
        (tag) => tag.naam,
      );

  const tonenMedewerkers =
    medewerkers.filter(
      (medewerker) =>
        medewerker.tags?.some(
          (tag) =>
            geselecteerdeTagNamen.some(
              (naam) =>
                naam.trim().toLowerCase() ===
                tag.naam.trim().toLowerCase(),
            ),
        ) ?? false,
    );

  return (
    <form
      onSubmit={opslaanDienst}
      className="space-y-6"
    >
      {fout && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {fout}
        </div>
      )}

      {succes && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {succes}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label
            htmlFor="dienst-datum-bewerken"
            className="mb-2 block text-sm font-medium text-slate-700"
          >
            Datum
          </label>

          <input
            id="dienst-datum-bewerken"
            type="date"
            value={datum}
            onChange={(event) =>
              setDatum(
                event.target.value,
              )
            }
            disabled={opslaanBezig}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 disabled:bg-slate-50"
          />
        </div>

        <div>
          <label
            htmlFor="dienst-begintijd-bewerken"
            className="mb-2 block text-sm font-medium text-slate-700"
          >
            Begintijd
          </label>

          <select
            id="dienst-begintijd-bewerken"
            value={begintijd}
            onChange={(event) =>
              setBegintijd(
                event.target.value,
              )
            }
            disabled={opslaanBezig}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 disabled:bg-slate-50"
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
          <label
            htmlFor="dienst-eindtijd-bewerken"
            className="mb-2 block text-sm font-medium text-slate-700"
          >
            Eindtijd
          </label>

          <select
            id="dienst-eindtijd-bewerken"
            value={eindtijd}
            onChange={(event) =>
              setEindtijd(
                event.target.value,
              )
            }
            disabled={opslaanBezig}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 disabled:bg-slate-50"
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

      <div>
        <label
          htmlFor="dienst-opmerkingen-bewerken"
          className="mb-2 block text-sm font-medium text-slate-700"
        >
          Opmerkingen
        </label>

        <textarea
          id="dienst-opmerkingen-bewerken"
          value={opmerkingen}
          onChange={(event) =>
            setOpmerkingen(
              event.target.value,
            )
          }
          disabled={opslaanBezig}
          rows={4}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 disabled:bg-slate-50"
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">
          Functies
        </p>

        {ladenTags ? (
          <p className="text-sm text-slate-500">
            Functies laden...
          </p>
        ) : tags.length === 0 ? (
          <p className="text-sm text-slate-500">
            Geen functies beschikbaar.
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
                  className="rounded-xl border border-slate-200 bg-white p-4"
                >
                  <label className="flex items-center gap-3">
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
                      className="h-4 w-4 rounded border-slate-300"
                    />

                    <span className="text-sm font-medium text-slate-800">
                      {tag.naam}
                    </span>
                  </label>

                  {geselecteerd && (
                    <div className="mt-3">
                      <label
                        htmlFor={`aantal-bewerken-${tag.id}`}
                        className="mb-1 block text-xs text-slate-500"
                      >
                        Aantal
                      </label>

                      <input
                        id={`aantal-bewerken-${tag.id}`}
                        type="number"
                        min="1"
                        step="1"
                        value={
                          geselecteerdeTags[
                            tag.id
                          ] ?? 1
                        }
                        onChange={(event) =>
                          wijzigAantal(
                            tag.id,
                            event.target.value,
                          )
                        }
                        disabled={
                          opslaanBezig
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 disabled:bg-slate-50"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Medewerkerbezetting
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Kies de medewerker voor deze dienst.
            </p>
          </div>

          {ladenMedewerkers && (
            <span className="text-xs text-slate-500">
              Laden...
            </span>
          )}
        </div>

        <div className="mt-4 space-y-3">
          {tonenMedewerkers.length ===
          0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5">
              <p className="text-sm font-medium text-slate-700">
                Geen passende medewerkers gevonden.
              </p>
            </div>
          ) : (
            tonenMedewerkers.map(
              (medewerker) => {
                const niveau =
                  bepaalBeschikbaarheid(
                    medewerker,
                    dienst.id,
                    begintijd,
                    eindtijd,
                  );

                const isHuidigeMedewerker =
                  dienst.medewerkers?.some(
                    (relatie) =>
                      relatie.medewerkerId ===
                      medewerker.id,
                  ) ?? false;

                return (
                  <div
                    key={
                      medewerker.id
                    }
                    className={`rounded-xl border p-4 ${beschikbaarheidKlassen(
                      niveau,
                    )}`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-900">
                            {volledigeNaam(
                              medewerker,
                            )}
                          </p>

                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${beschikbaarheidBadgeKlassen(
                              niveau,
                            )}`}
                          >
                            {
                              beschikbaarheidLabel(
                                niveau,
                              )
                            }
                          </span>
                        </div>

                        {medewerker.personeelsnummer && (
                          <p className="mt-1 text-xs text-slate-500">
                            {medewerker.personeelsnummer}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={
                          opslaanBezig ||
                          bezettingBezig !==
                            null ||
                          niveau ===
                            "NIET_BESCHIKBAAR" ||
                          niveau ===
                            "ANDERE_DIENST"
                        }
                        onClick={() =>
                          void wisselMedewerker(
                            medewerker.id,
                          )
                        }
                        className={
                          isHuidigeMedewerker
                            ? "rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
                            : "rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                        }
                      >
                        {bezettingBezig ===
                        medewerker.id
                          ? "Bezig..."
                          : isHuidigeMedewerker
                            ? "Huidige medewerker"
                            : "Deze medewerker kiezen"}
                      </button>
                    </div>
                  </div>
                );
              },
            )
          )}
        </div>
      </div>

      <div className="flex justify-end border-t border-slate-200 pt-5">
        <button
          type="submit"
          disabled={opslaanBezig}
          className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {opslaanBezig
            ? "Opslaan..."
            : "Wijzigingen opslaan"}
        </button>
      </div>
    </form>
  );
}

function foutmeldingUitResponse(
  data: unknown,
  standaard: string,
): string {
  if (
    !data ||
    typeof data !== "object"
  ) {
    return standaard;
  }

  const waarde =
    data as ApiFoutResponse;

  return (
    typeof waarde.fout ===
      "string" &&
    waarde.fout.trim()
      ? waarde.fout
      : standaard
  );
}
