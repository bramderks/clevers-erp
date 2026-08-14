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

  tags: {
    id: string;
    naam: string;
    volgorde: number;
    actief: boolean;
  }[];

  beschikbaarheden: {
    id: string;
    weekId: string;
    medewerkerId: string;
    datum: string;
    begintijd: string;
    eindtijd: string;
    status: string;
    opmerking: string | null;
  }[];

  diensten: {
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
  }[];
};

type DienstFormProps = {
  weekId: string;
  vestigingId: string;
  initialDatum?: string;
  initialTagNaam?: string | null;
  onAangemaakt?: () => void;
};

const START_MINUTEN = 9 * 60;
const EINDE_MINUTEN = 23 * 60;

function minutenNaarTijd(minuten: number) {
  const uren = Math.floor(minuten / 60);
  const minutenDeel = minuten % 60;

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
) {
  const tijden: string[] = [];

  for (
    let minuten = vanaf;
    minuten <= tot;
    minuten += 15
  ) {
    tijden.push(
      minutenNaarTijd(minuten),
    );
  }

  return tijden;
}

function tijdNaarMinuten(tijd: string) {
  const [uren, minuten] =
    tijd.split(":").map(Number);

  if (
    Number.isNaN(uren) ||
    Number.isNaN(minuten)
  ) {
    return null;
  }

  return uren * 60 + minuten;
}

function volledigeNaam(
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

function datumVanDienst(
  dienst: Dienst,
) {
  return new Date(dienst.datum)
    .toISOString()
    .slice(0, 10);
}

function dienstOverlapt(
  dienst: Dienst,
  datum: string,
  begintijd: string,
  eindtijd: string | null,
) {
  if (
    datumVanDienst(dienst) !== datum
  ) {
    return false;
  }

  const bestaandeStart =
    new Date(
      dienst.begintijd,
    ).getTime();

  const bestaandeEinde =
    new Date(
      dienst.eindtijd ?? `${datum}T23:00:00`,
    ).getTime();

  const nieuweStart =
    new Date(
      `${datum}T${begintijd}`,
    ).getTime();

  const nieuweEinde =
    new Date(
      `${datum}T${eindtijd ?? "23:00"}`,
    ).getTime();

  if (
    Number.isNaN(
      bestaandeStart,
    ) ||
    Number.isNaN(
      bestaandeEinde,
    ) ||
    Number.isNaN(
      nieuweStart,
    ) ||
    Number.isNaN(
      nieuweEinde,
    )
  ) {
    return false;
  }

  return (
    nieuweStart <
      bestaandeEinde &&
    nieuweEinde >
      bestaandeStart
  );
}

function tijdUitDatum(
  waarde: string,
) {
  const datum = new Date(waarde);

  if (Number.isNaN(datum.getTime())) {
    return null;
  }

  return datum
    .toISOString()
    .slice(11, 16);
}

function beschikbaarheidsNiveau(
  medewerker: PlanningMedewerker,
  datum: string,
  begintijd: string,
  eindtijd: string | null,
) {
  const beschikbaarheden =
    medewerker.beschikbaarheden.filter(
      (beschikbaarheid) =>
        beschikbaarheid.datum.slice(
          0,
          10,
        ) === datum &&
        beschikbaarheid.status !==
          "NIET_BESCHIKBAAR",
    );

  if (
    beschikbaarheden.length === 0
  ) {
    return "rood" as const;
  }

  const dienstStart =
    tijdNaarMinuten(
      begintijd,
    );

  const dienstEinde =
    tijdNaarMinuten(
      eindtijd ?? "23:00",
    );

  if (
    dienstStart === null ||
    dienstEinde === null
  ) {
    return "rood" as const;
  }

  const volledigeBeschikbaarheid =
    beschikbaarheden.some(
      (beschikbaarheid) => {
        const beschikbaarStart =
          tijdNaarMinuten(
            tijdUitDatum(
              beschikbaarheid.begintijd,
            ) ?? "",
          );

        const beschikbaarEinde =
          tijdNaarMinuten(
            tijdUitDatum(
              beschikbaarheid.eindtijd,
            ) ?? "",
          );

        if (
          beschikbaarStart === null ||
          beschikbaarEinde === null
        ) {
          return false;
        }

        return (
          dienstStart >=
            beschikbaarStart &&
          dienstEinde <=
            beschikbaarEinde
        );
      },
    );

  if (volledigeBeschikbaarheid) {
    return "groen" as const;
  }

  const gedeeltelijkeBeschikbaarheid =
    beschikbaarheden.some(
      (beschikbaarheid) => {
        const beschikbaarStart =
          tijdNaarMinuten(
            tijdUitDatum(
              beschikbaarheid.begintijd,
            ) ?? "",
          );

        const beschikbaarEinde =
          tijdNaarMinuten(
            tijdUitDatum(
              beschikbaarheid.eindtijd,
            ) ?? "",
          );

        if (
          beschikbaarStart === null ||
          beschikbaarEinde === null
        ) {
          return false;
        }

        return (
          dienstStart <
            beschikbaarEinde &&
          dienstEinde >
            beschikbaarStart
        );
      },
    );

  if (gedeeltelijkeBeschikbaarheid) {
    return "geel" as const;
  }

  return "rood" as const;
}

function medewerkerHeeftTag(
  medewerker: PlanningMedewerker,
  tagNamen: string[],
) {
  return medewerker.tags.some(
    (tag) =>
      tagNamen.some(
        (tagNaam) =>
          tagNaam.toLowerCase() ===
          tag.naam.toLowerCase(),
      ),
  );
}

function medewerkerHeeftDienstOverlap(
  medewerker: PlanningMedewerker,
  datum: string,
  begintijd: string,
  eindtijd: string | null,
) {
  return medewerker.diensten.some(
    (bezetting) => {
      if (
        bezetting.status ===
        "AFGEZEGD"
      ) {
        return false;
      }

      const bestaandeStart =
        new Date(
          bezetting.dienst.begintijd,
        ).getTime();

      const bestaandeEinde =
        new Date(
          bezetting.dienst.eindtijd ?? `${datum}T23:00:00`,
        ).getTime();

      const nieuweStart =
        new Date(
          `${datum}T${begintijd}`,
        ).getTime();

      const nieuweEinde =
        new Date(
          `${datum}T${eindtijd ?? "23:00"}`,
        ).getTime();

      if (
        Number.isNaN(
          bestaandeStart,
        ) ||
        Number.isNaN(
          bestaandeEinde,
        ) ||
        Number.isNaN(
          nieuweStart,
        ) ||
        Number.isNaN(
          nieuweEinde,
        )
      ) {
        return false;
      }

      return (
        nieuweStart <
          bestaandeEinde &&
        nieuweEinde >
          bestaandeStart
      );
    },
  );
}

function dienstHeeftTag(
  dienst: Dienst,
  tagNamen: string[],
) {
  return dienst.tags.some(
    (dienstTag) =>
      tagNamen.some(
        (tagNaam) =>
          tagNaam.toLowerCase() ===
          dienstTag.tag.naam.toLowerCase(),
      ),
  );
}

function formatteerDienstTijd(
  datum: string | null,
) {
  if (!datum) {
    return "geen eindtijd";
  }

  return new Intl.DateTimeFormat(
    "nl-NL",
    {
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(new Date(datum));
}

export default function DienstForm({
  weekId,
  vestigingId,
  initialDatum = "",
  initialTagNaam = null,
  onAangemaakt,
}: DienstFormProps) {
  const [datum, setDatum] =
    useState(initialDatum);

  const [begintijd, setBegintijd] =
    useState("");

  const [eindtijd, setEindtijd] =
    useState("");

  const [
    totSluit,
    setTotSluit,
  ] = useState(false);

  const [
    opmerkingen,
    setOpmerkingen,
  ] = useState("");

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
  ] = useState<
    PlanningMedewerker[]
  >([]);

  const [diensten, setDiensten] =
    useState<Dienst[]>([]);

  const [
    geselecteerdeMedewerkers,
    setGeselecteerdeMedewerkers,
  ] = useState<
    Record<string, boolean>
  >({});

  const [ladenTags, setLadenTags] =
    useState(true);

  const [
    ladenMedewerkers,
    setLadenMedewerkers,
  ] = useState(false);

  const [
    ladenDiensten,
    setLadenDiensten,
  ] = useState(false);

  const [laden, setLaden] =
    useState(false);

  const [fout, setFout] =
    useState<string | null>(null);

  const [
    waarschuwingen,
    setWaarschuwingen,
  ] = useState<string[]>([]);

  useEffect(() => {
    setDatum(initialDatum);
  }, [initialDatum]);

  useEffect(() => {
    async function laadTags() {
      try {
        setLadenTags(true);
        setFout(null);

        const response = await fetch(
          `/api/planning/tags?vestigingId=${encodeURIComponent(
            vestigingId,
          )}`,
          {
            method: "GET",
            cache: "no-store",
          },
        );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data?.fout ??
              "De planningtags konden niet worden opgehaald.",
          );
        }

        if (!Array.isArray(data)) {
          throw new Error(
            "De planningtags hebben een ongeldig formaat.",
          );
        }

        setTags(data);
      } catch (error) {
        console.error(
          "Fout bij laden planningtags:",
          error,
        );

        setFout(
          error instanceof Error
            ? error.message
            : "De planningtags konden niet worden opgehaald.",
        );
      } finally {
        setLadenTags(false);
      }
    }

    void laadTags();
  }, [vestigingId]);

  useEffect(() => {
    if (
      !initialTagNaam ||
      tags.length === 0
    ) {
      return;
    }

    const tag = tags.find(
      (item) =>
        item.naam.toLowerCase() ===
        initialTagNaam.toLowerCase(),
    );

    if (!tag) {
      return;
    }

    setGeselecteerdeTags(
      (huidig) => ({
        ...huidig,
        [tag.id]:
          huidig[tag.id] ?? 1,
      }),
    );
  }, [initialTagNaam, tags]);

  useEffect(() => {
    if (!datum) {
      setMedewerkers([]);
      return;
    }

    async function laadMedewerkers() {
      try {
        setLadenMedewerkers(true);

        const response = await fetch(
          `/api/planning/medewerkers?vestigingId=${encodeURIComponent(
            vestigingId,
          )}&datum=${encodeURIComponent(
            datum,
          )}`,
          {
            method: "GET",
            cache: "no-store",
          },
        );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data?.fout ??
              "De medewerkers konden niet worden opgehaald.",
          );
        }

        if (!Array.isArray(data)) {
          throw new Error(
            "De medewerkers hebben een ongeldig formaat.",
          );
        }

        setMedewerkers(data);
      } catch (error) {
        console.error(
          "Fout bij laden medewerkers planning:",
          error,
        );

        setMedewerkers([]);
      } finally {
        setLadenMedewerkers(false);
      }
    }

    void laadMedewerkers();
  }, [vestigingId, datum]);

  useEffect(() => {
    if (!datum) {
      setDiensten([]);
      return;
    }

    async function laadDiensten() {
      try {
        setLadenDiensten(true);

        const response = await fetch(
          `/api/planning/diensten?weekId=${encodeURIComponent(
            weekId,
          )}`,
          {
            method: "GET",
            cache: "no-store",
          },
        );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data?.fout ??
              "De bestaande diensten konden niet worden opgehaald.",
          );
        }

        if (!Array.isArray(data)) {
          throw new Error(
            "De diensten hebben een ongeldig formaat.",
          );
        }

        setDiensten(data);
      } catch (error) {
        console.error(
          "Fout bij laden diensten:",
          error,
        );

        setDiensten([]);
      } finally {
        setLadenDiensten(false);
      }
    }

    void laadDiensten();
  }, [weekId, datum]);

  useEffect(() => {
    if (
      !begintijd ||
      !datum ||
      Object.keys(
        geselecteerdeTags,
      ).length === 0
    ) {
      setWaarschuwingen([]);
      return;
    }

    const gekozenTagNamen =
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

    const gevonden =
      diensten
        .filter((dienst) =>
          dienstOverlapt(
            dienst,
            datum,
            begintijd,
            eindtijd,
          ),
        )
        .filter((dienst) =>
          dienstHeeftTag(
            dienst,
            gekozenTagNamen,
          ),
        )
        .map((dienst) => {
          const dienstTags =
            dienst.tags
              .filter(
                (dienstTag) =>
                  gekozenTagNamen.some(
                    (naam) =>
                      naam.toLowerCase() ===
                      dienstTag.tag.naam.toLowerCase(),
                  ),
              )
              .map(
                (dienstTag) =>
                  dienstTag.tag.naam,
              )
              .join(", ");

          const start =
            formatteerDienstTijd(
              dienst.begintijd,
            );

          const einde =
            formatteerDienstTijd(
              dienst.eindtijd,
            );

          return `${dienstTags} heeft al een dienst van ${start} - ${einde}.`;
        });

    setWaarschuwingen(
      Array.from(
        new Set(gevonden),
      ),
    );
  }, [
    begintijd,
    eindtijd,
    datum,
    diensten,
    geselecteerdeTags,
    tags,
  ]);

  const passendeMedewerkers =
    useMemo(() => {
      if (
        !datum ||
        !begintijd ||
        Object.keys(
          geselecteerdeTags,
        ).length === 0
      ) {
        return [];
      }

      const gekozenTagNamen =
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

      return medewerkers
        .filter((medewerker) =>
          medewerkerHeeftTag(
            medewerker,
            gekozenTagNamen,
          ),
        )
        .sort((a, b) =>
          volledigeNaam(
            a,
          ).localeCompare(
            volledigeNaam(b),
            "nl",
          ),
        );
    }, [
      medewerkers,
      datum,
      begintijd,
      eindtijd,
      geselecteerdeTags,
      tags,
    ]);

  const startTijden =
    useMemo(
      () =>
        maakTijden(
          START_MINUTEN,
          EINDE_MINUTEN - 15,
        ),
      [],
    );

  const eindTijden =
    useMemo(() => {
      if (!begintijd) {
        return maakTijden(
          START_MINUTEN + 15,
          EINDE_MINUTEN,
        );
      }

      const start =
        tijdNaarMinuten(
          begintijd,
        );

      if (start === null) {
        return [];
      }

      return maakTijden(
        start + 15,
        EINDE_MINUTEN,
      );
    }, [begintijd]);

  function toggleTag(tagId: string) {
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
    aantal: string,
  ) {
    const waarde =
      Number(aantal);

    if (
      !Number.isInteger(
        waarde,
      ) ||
      waarde < 1
    ) {
      return;
    }

    setGeselecteerdeTags(
      (huidig) => ({
        ...huidig,
        [tagId]: waarde,
      }),
    );
  }

  function toggleMedewerker(
    medewerkerId: string,
  ) {
    setGeselecteerdeMedewerkers(
      (huidig) => ({
        ...huidig,
        [medewerkerId]:
          !huidig[medewerkerId],
      }),
    );
  }

  async function planMedewerkers(
    dienstId: string,
  ) {
    const geselecteerd =
      Object.entries(
        geselecteerdeMedewerkers,
      )
        .filter(
          ([, waarde]) =>
            waarde,
        )
        .map(
          ([medewerkerId]) =>
            medewerkerId,
        );

    for (
      const medewerkerId of geselecteerd
    ) {
      const medewerker =
        medewerkers.find(
          (item) =>
            item.id ===
            medewerkerId,
        );

      const niveau =
        medewerker
          ? beschikbaarheidsNiveau(
              medewerker,
              datum,
              begintijd,
              eindtijd,
            )
          : "rood";

      const response =
        await fetch(
          "/api/planning/bezetting",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              dienstId,
              medewerkerId,
              status:
                niveau === "groen"
                  ? "BEVESTIGD"
                  : "GEPLAND",
            }),
          },
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.fout ??
            "Een medewerker kon niet worden ingepland.",
        );
      }
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setFout(null);

    if (
      !datum ||
      !begintijd
    ) {
      setFout(
        "Datum en begintijd zijn verplicht.",
      );

      return;
    }

    const startMinuten =
      tijdNaarMinuten(
        begintijd,
      );

    const eindeMinuten =
      eindtijd
        ? tijdNaarMinuten(eindtijd)
        : null;

    if (startMinuten === null) {
      setFout(
        "Vul een geldige begintijd in.",
      );

      return;
    }

    if (eindtijd && eindeMinuten === null) {
      setFout(
        "Vul een geldige eindtijd in.",
      );

      return;
    }

    if (
      eindeMinuten !== null &&
      eindeMinuten <= startMinuten
    ) {
      setFout(
        "Eindtijd moet na de begintijd liggen.",
      );

      return;
    }

    if (
      startMinuten % 15 !== 0 ||
      (eindeMinuten !== null &&
        eindeMinuten % 15 !== 0)
    ) {
      setFout(
        "Diensten kunnen alleen per 15 minuten worden gepland.",
      );

      return;
    }

    if (
      startMinuten <
      START_MINUTEN
    ) {
      setFout(
        "Een dienst kan niet vóór 09:00 starten.",
      );

      return;
    }

    if (
      eindeMinuten !== null &&
      eindeMinuten > EINDE_MINUTEN
    ) {
      setFout(
        "Een dienst kan niet na 23:00 eindigen.",
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
      setLaden(true);

      const start = new Date(
        `${datum}T${begintijd}`,
      );

      const einde = eindtijd
        ? new Date(
            `${datum}T${eindtijd}`,
          )
        : null;

      const response =
        await fetch(
          "/api/planning/diensten",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              weekId,
              datum: new Date(
                `${datum}T00:00`,
              ).toISOString(),
              begintijd:
                start.toISOString(),
              eindtijd:
                einde
                  ? einde.toISOString()
                  : null,
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

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.fout ??
            "De dienst kon niet worden aangemaakt.",
        );
      }

      if (data?.id) {
        await planMedewerkers(
          data.id,
        );
      }

      setBegintijd("");
      setEindtijd("");
      setTotSluit(false);
      setOpmerkingen("");
      setGeselecteerdeTags({});
      setGeselecteerdeMedewerkers(
        {},
      );
      setWaarschuwingen([]);

      onAangemaakt?.();
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
      setLaden(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      <div>
        <h3 className="text-lg font-semibold text-gray-900">
          Dienst toevoegen
        </h3>

        <p className="mt-1 text-sm text-gray-600">
          Maak de dienst aan en
          plan medewerkers
          direct in.
        </p>

        {initialTagNaam && (
          <p className="mt-2 text-sm font-medium text-cyan-700">
            Taak: {initialTagNaam}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label
            htmlFor="dienst-datum"
            className="block text-sm font-medium text-gray-900"
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
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
            required
          />
        </div>

        <div>
          <label
            htmlFor="dienst-begintijd"
            className="block text-sm font-medium text-gray-900"
          >
            Begintijd
          </label>

          <select
            id="dienst-begintijd"
            value={begintijd}
            onChange={(event) => {
              setBegintijd(
                event.target.value,
              );
              setEindtijd("");
            }}
            className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-900"
            required
          >
            <option value="">
              Kies tijd
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
            className="block text-sm font-medium text-gray-900"
          >
            Eindtijd (optioneel)
          </label>

          <select
            id="dienst-eindtijd"
            value={eindtijd}
            onChange={(event) => {
              const waarde = event.target.value;
              setEindtijd(waarde);
              setTotSluit(waarde === "23:00");
            }}
            className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-900"
          >
            <option value="">
              Geen eindtijd
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

          <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={totSluit}
              onChange={(event) => {
                const aangevinkt =
                  event.target.checked;
                setTotSluit(aangevinkt);
                setEindtijd(
                  aangevinkt ? "23:00" : "",
                );
              }}
            />

            <span>
              Tot sluit
            </span>
          </label>
        </div>
      </div>

      <div>
        <label
          htmlFor="dienst-opmerkingen"
          className="block text-sm font-medium text-gray-900"
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
          rows={3}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-900">
            Benodigde functies
          </label>

          {ladenTags && (
            <span className="text-xs text-gray-500">
              Laden...
            </span>
          )}
        </div>

        {!ladenTags &&
        tags.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">
            Er zijn nog geen
            actieve
            planningtags.
          </p>
        ) : (
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {tags.map((tag) => {
              const geselecteerd =
                geselecteerdeTags[
                  tag.id
                ] !== undefined;

              const isBhv =
                tag.naam.toLowerCase() ===
                "bhv";

              return (
                <div
                  key={tag.id}
                  className={`flex items-center gap-3 rounded-lg border p-3 ${
                    isBhv
                      ? "border-amber-200 bg-amber-50"
                      : "border-gray-200"
                  }`}
                >
                  <label className="flex flex-1 cursor-pointer items-center gap-2">
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
                    />

                    <span className="text-sm text-gray-800">
                      {tag.naam}
                    </span>
                  </label>

                  {geselecteerd &&
                    !isBhv && (
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
                        className="w-20 rounded-lg border border-gray-300 px-2 py-1 text-sm"
                        aria-label={`Aantal ${tag.naam}`}
                      />
                    )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {waarschuwingen.length >
        0 && (
        <div className="rounded-xl border border-amber-400 bg-amber-100 p-4">
          <p className="text-sm font-semibold text-amber-950">
            ⚠️ Let op: overlap
            in functie
          </p>

          <div className="mt-2 space-y-1">
            {waarschuwingen.map(
              (waarschuwing) => (
                <p
                  key={
                    waarschuwing
                  }
                  className="text-sm text-amber-900"
                >
                  {waarschuwing}
                </p>
              ),
            )}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">
            Medewerkers voor deze
            dienst
          </h4>

          <p className="mt-1 text-xs text-gray-500">
            Groen = volledig
            beschikbaar · Geel =
            gedeeltelijk beschikbaar
            · Rood = niet beschikbaar.
          </p>
        </div>

        <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-gray-600">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full border border-green-300 bg-green-100" />
            Volledig beschikbaar
          </span>

          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full border border-amber-300 bg-amber-100" />
            Gedeeltelijk beschikbaar
          </span>

          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full border border-red-300 bg-red-100" />
            Niet beschikbaar
          </span>
        </div>

        {ladenMedewerkers ||
        ladenDiensten ? (
          <p className="mt-4 text-sm text-gray-500">
            Medewerkers en
            beschikbaarheid laden...
          </p>
        ) : !begintijd ? (
          <p className="mt-4 text-sm text-gray-500">
            Kies eerst een begintijd.
          </p>
        ) : passendeMedewerkers.length ===
          0 ? (
          <p className="mt-4 text-sm text-gray-500">
            Er zijn geen
            medewerkers met de
            gekozen functie(s).
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {passendeMedewerkers.map(
              (medewerker) => {
                const niveau =
                  beschikbaarheidsNiveau(
                    medewerker,
                    datum,
                    begintijd,
                    eindtijd,
                  );

                const geselecteerd =
                  geselecteerdeMedewerkers[
                    medewerker.id
                  ] ?? false;

                const heeftOverlap =
                  medewerkerHeeftDienstOverlap(
                    medewerker,
                    datum,
                    begintijd,
                    eindtijd,
                  );

                const beschikbaarheden =
                  medewerker.beschikbaarheden.filter(
                    (beschikbaarheid) =>
                      beschikbaarheid.datum.slice(
                        0,
                        10,
                      ) === datum,
                  );

                const heeftVoorkeur =
                  beschikbaarheden.some(
                    (beschikbaarheid) =>
                      beschikbaarheid.status ===
                      "VOORKEUR",
                  );

                const niveauKlassen =
                  niveau === "groen"
                    ? "border-green-300 bg-green-50"
                    : niveau === "geel"
                      ? "border-amber-300 bg-amber-50"
                      : "border-red-300 bg-red-50";

                const statusTekst =
                  niveau === "groen"
                    ? "Volledig beschikbaar"
                    : niveau === "geel"
                      ? "Gedeeltelijk beschikbaar"
                      : "Niet beschikbaar";

                return (
                  <label
                    key={
                      medewerker.id
                    }
                    className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 transition ${niveauKlassen} ${
                      heeftOverlap
                        ? "cursor-not-allowed opacity-60"
                        : niveau ===
                            "rood"
                          ? "cursor-pointer"
                          : "cursor-pointer"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {volledigeNaam(
                          medewerker,
                        )}
                      </p>

                      <p
                        className={`text-xs ${
                          niveau ===
                          "groen"
                            ? "text-green-700"
                            : niveau ===
                                "geel"
                              ? "text-amber-700"
                              : "text-red-700"
                        }`}
                      >
                        {heeftOverlap
                          ? "Heeft al een overlappende dienst"
                          : statusTekst}

                        {heeftVoorkeur &&
                          !heeftOverlap &&
                          " · voorkeur"}
                      </p>
                    </div>

                    <input
                      type="checkbox"
                      checked={
                        geselecteerd
                      }
                      disabled={
                        heeftOverlap
                      }
                      onChange={() =>
                        toggleMedewerker(
                          medewerker.id,
                        )
                      }
                    />
                  </label>
                );
              },
            )}
          </div>
        )}
      </div>

      {fout && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700">
            {fout}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-gray-500">
          Geselecteerde
          medewerkers:{" "}
          {
            Object.values(
              geselecteerdeMedewerkers,
            ).filter(Boolean)
              .length
          }
        </p>

        <button
          type="submit"
          disabled={laden}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {laden
            ? "Dienst opslaan..."
            : "Dienst aanmaken"}
        </button>
      </div>
    </form>
  );
}