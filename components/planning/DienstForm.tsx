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
    begintijd: string | null;
    eindtijd: string | null;
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

type MedewerkersResponse = {
  huidigeMedewerkerId: string | null;
  medewerkers: PlanningMedewerker[];
};

type DienstAangemaaktResponse = Dienst & {
  id: string;
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

function tijdNaarMinuten(
  tijd: string,
) {
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
      dienst.eindtijd ??
        `${datum}T23:00:00`,
    ).getTime();

  const nieuweStart =
    new Date(
      `${datum}T${begintijd}`,
    ).getTime();

  const nieuweEinde =
    new Date(
      `${datum}T${
        eindtijd ?? "23:00"
      }`,
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
  waarde: string | null,
) {
  if (!waarde) {
    return null;
  }

  const datum = new Date(
    waarde,
  );

  if (
    Number.isNaN(
      datum.getTime(),
    )
  ) {
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
      (beschikbaarheid) =>
        beschikbaarheid.begintijd ===
          null &&
        beschikbaarheid.eindtijd ===
          null,
    );

  if (
    volledigeBeschikbaarheid
  ) {
    return "groen" as const;
  }

  const passend =
    beschikbaarheden.some(
      (beschikbaarheid) => {
        const begin =
          tijdNaarMinuten(
            tijdUitDatum(
              beschikbaarheid.begintijd,
            ) ?? "",
          );

        const einde =
          tijdNaarMinuten(
            tijdUitDatum(
              beschikbaarheid.eindtijd,
            ) ?? "",
          );

        if (
          begin === null ||
          einde === null
        ) {
          return false;
        }

        return (
          begin <= dienstStart &&
          einde >= dienstEinde
        );
      },
    );

  return passend
    ? "groen"
    : "oranje";
}

function tijdVoorWeergave(
  waarde: string | null,
) {
  if (!waarde) {
    return "";
  }

  const tijd =
    tijdUitDatum(waarde);

  return tijd ?? "";
}

function datumNaarInput(
  waarde: string | null | undefined,
) {
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

  return new Date(waarde)
    .toISOString()
    .slice(0, 10);
}

function foutUitResponse(
  data: unknown,
  standaard: string,
) {
  if (
    data &&
    typeof data === "object"
  ) {
    const fout =
      (data as {
        fout?: unknown;
        error?: unknown;
      }).fout ??
      (data as {
        error?: unknown;
      }).error;

    if (
      typeof fout === "string" &&
      fout.trim()
    ) {
      return fout;
    }
  }

  return standaard;
}

function isMedewerkersResponse(
  data: unknown,
): data is MedewerkersResponse {
  if (
    !data ||
    typeof data !== "object"
  ) {
    return false;
  }

  const waarde =
    data as {
      huidigeMedewerkerId?: unknown;
      medewerkers?: unknown;
    };

  return (
    (
      waarde.huidigeMedewerkerId ===
        null ||
      typeof waarde.huidigeMedewerkerId ===
        "string"
    ) &&
    Array.isArray(
      waarde.medewerkers,
    )
  );
}

function dienstHeeftTag(
  dienst: Dienst,
  gekozenTagNamen: string[],
) {
  if (
    gekozenTagNamen.length === 0
  ) {
    return false;
  }

  return dienst.tags.some(
    (dienstTag) =>
      gekozenTagNamen.some(
        (naam) =>
          naam.trim().toLowerCase() ===
          dienstTag.tag.naam
            .trim()
            .toLowerCase(),
      ),
  );
}

function formatteerDienstTijd(
  waarde: string | null,
) {
  if (!waarde) {
    return "23:00";
  }

  const tijd =
    tijdUitDatum(waarde);

  return tijd ?? "23:00";
}

export default function DienstForm({
  weekId,
  vestigingId,
  initialDatum,
  initialTagNaam,
  onAangemaakt,
}: DienstFormProps) {
  const [
    datum,
    setDatum,
  ] = useState(
    initialDatum ?? "",
  );

  const [begintijd, setBegintijd] =
    useState("09:00");

  const [eindtijd, setEindtijd] =
    useState("23:00");

  const [
    geselecteerdeTags,
    setGeselecteerdeTags,
  ] = useState<Record<string, number>>(
    {},
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

  const [diensten, setDiensten] =
    useState<Dienst[]>([]);

  const [
    ladenTags,
    setLadenTags,
  ] = useState(true);

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
    setDatum(
      initialDatum ?? "",
    );
  }, [initialDatum]);

  useEffect(() => {
    let actief = true;

    async function laadTags() {
      try {
        setLadenTags(true);
        setFout(null);

        const response =
          await fetch(
            `/api/planning/tags?vestigingId=${encodeURIComponent(
              vestigingId,
            )}`,
            {
              method: "GET",
              cache: "no-store",
            },
          );

        const data: unknown =
          await response.json();

        if (!response.ok) {
          throw new Error(
            foutUitResponse(
              data,
              "De planningtags konden niet worden opgehaald.",
            ),
          );
        }

        if (
          !Array.isArray(data)
        ) {
          throw new Error(
            "De planningtags hebben een ongeldig formaat.",
          );
        }

        if (actief) {
          setTags(
            (data as PlanningTag[]).filter(
              (tag) =>
                tag.naam
                  .trim()
                  .toLowerCase() !==
                "bhv",
            ),
          );
        }
      } catch (error) {
        console.error(
          "Fout bij laden planningtags:",
          error,
        );

        if (actief) {
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
    if (
      !initialTagNaam ||
      tags.length === 0
    ) {
      return;
    }

    if (
      initialTagNaam
        .trim()
        .toLowerCase() ===
      "bhv"
    ) {
      return;
    }

    const tag = tags.find(
      (item) =>
        item.naam
          .trim()
          .toLowerCase() ===
        initialTagNaam
          .trim()
          .toLowerCase(),
    );

    if (!tag) {
      return;
    }

    setGeselecteerdeTags(
      (huidig) => {
        if (huidig[tag.id]) {
          return huidig;
        }

        return {
          ...huidig,
          [tag.id]: 1,
        };
      },
    );
  }, [
    initialTagNaam,
    tags,
  ]);

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
      !datum ||
      !vestigingId ||
      geselecteerdeTagIds.length ===
        0
    ) {
      return;
    }

    let actief = true;

    async function laadMedewerkers() {
      try {
        setLadenMedewerkers(true);
        setFout(null);

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
            },
          );

        const data: unknown =
          await response.json();

        if (!response.ok) {
          throw new Error(
            foutUitResponse(
              data,
              "De medewerkers konden niet worden opgehaald.",
            ),
          );
        }

        if (
          !isMedewerkersResponse(
            data,
          )
        ) {
          throw new Error(
            "De medewerkers hebben een ongeldig formaat.",
          );
        }

        if (actief) {
          setMedewerkers(
            data.medewerkers,
          );
        }
      } catch (error) {
        console.error(
          "Fout bij laden medewerkers planning:",
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
    geselecteerdeTagIds,
  ]);

  useEffect(() => {
    if (!datum || !vestigingId) {
      return;
    }

    let actief = true;

    async function laadDiensten() {
      try {
        setLadenDiensten(true);

        const response =
          await fetch(
            `/api/planning/diensten?weekId=${encodeURIComponent(
              weekId,
            )}`,
            {
              method: "GET",
              cache: "no-store",
            },
          );

        const data: unknown =
          await response.json();

        if (!response.ok) {
          throw new Error(
            foutUitResponse(
              data,
              "De bestaande diensten konden niet worden opgehaald.",
            ),
          );
        }

        if (
          !Array.isArray(data)
        ) {
          throw new Error(
            "De diensten hebben een ongeldig formaat.",
          );
        }

        if (actief) {
          setDiensten(
            data as Dienst[],
          );
        }
      } catch (error) {
        console.error(
          "Fout bij laden diensten:",
          error,
        );

        if (actief) {
          setDiensten([]);

          setFout(
            error instanceof Error
              ? error.message
              : "De bestaande diensten konden niet worden opgehaald.",
          );
        }
      } finally {
        if (actief) {
          setLadenDiensten(false);
        }
      }
    }

    void laadDiensten();

    return () => {
      actief = false;
    };
  }, [weekId, datum, vestigingId]);

  useEffect(() => {
    if (
      !begintijd ||
      !datum ||
      Object.keys(
        geselecteerdeTags,
      ).length === 0
    ) {
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
                      naam
                        .trim()
                        .toLowerCase() ===
                      dienstTag.tag.naam
                        .trim()
                        .toLowerCase(),
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

      return medewerkers.filter(
        (medewerker) =>
          medewerker.tags.some(
            (medewerkerTag) =>
              gekozenTagNamen.some(
                (naam) =>
                  naam
                    .trim()
                    .toLowerCase() ===
                  medewerkerTag.naam
                    .trim()
                    .toLowerCase(),
              ),
          ),
      );
    }, [
      datum,
      begintijd,
      geselecteerdeTags,
      medewerkers,
      tags,
    ]);

  const startTijden = useMemo(
    () =>
      maakTijden(
        START_MINUTEN,
        EINDE_MINUTEN - 15,
      ),
    [],
  );

  const eindTijden = useMemo(
    () => {
      const startMinuten =
        tijdNaarMinuten(
          begintijd,
        );

      if (startMinuten === null) {
        return maakTijden(
          START_MINUTEN + 15,
          EINDE_MINUTEN,
        );
      }

      return maakTijden(
        startMinuten + 15,
        EINDE_MINUTEN,
      );
    }, [begintijd]);

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

  async function maakDienst() {
    if (laden) {
      return;
    }

    setFout(null);

    if (!datum) {
      setFout(
        "Selecteer eerst een datum.",
      );
      return;
    }

    if (!begintijd || !eindtijd) {
      setFout(
        "Vul geldige begin- en eindtijden in.",
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
      eindeMinuten <= startMinuten
    ) {
      setFout(
        "De eindtijd moet na de begintijd liggen.",
      );
      return;
    }

    setLaden(true);

    try {
      const tagsPayload =
        Object.entries(
          geselecteerdeTags,
        ).map(
          ([tagId, aantal]) => ({
            tagId,
            aantal,
          }),
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
            credentials: "include",
            body: JSON.stringify({
              weekId,
              vestigingId,
              datum: `${datum}T00:00:00`,
              begintijd: `${datum}T${begintijd}:00`,
              eindtijd: `${datum}T${eindtijd}:00`,
              tags: tagsPayload,
            }),
          },
        );

      const data: unknown =
        await response.json();

      if (!response.ok) {
        throw new Error(
          foutUitResponse(
            data,
            "De dienst kon niet worden aangemaakt.",
          ),
        );
      }

      const aangemaakteDienst =
        data as DienstAangemaaktResponse;

      setDiensten((huidig) => [
        ...huidig,
        aangemaakteDienst,
      ]);

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
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label
            htmlFor="dienst-datum"
            className="mb-2 block text-sm font-medium text-slate-700"
          >
            Datum
          </label>

          <input
            id="dienst-datum"
            type="date"
            value={datumNaarInput(datum)}
            onChange={(event) =>
              setDatum(
                event.target.value,
              )
            }
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
          />
        </div>

        <div>
          <label
            htmlFor="dienst-begintijd"
            className="mb-2 block text-sm font-medium text-slate-700"
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
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
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
            htmlFor="dienst-eindtijd"
            className="mb-2 block text-sm font-medium text-slate-700"
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
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
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
                      className="h-4 w-4 rounded border-slate-300"
                    />

                    <span className="text-sm font-medium text-slate-800">
                      {tag.naam}
                    </span>
                  </label>

                  {geselecteerd && (
                    <div className="mt-3">
                      <label
                        htmlFor={`aantal-${tag.id}`}
                        className="mb-1 block text-xs text-slate-500"
                      >
                        Aantal
                      </label>

                      <input
                        id={`aantal-${tag.id}`}
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
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {waarschuwingen.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-800">
            Let op
          </p>

          <div className="mt-2 space-y-1">
            {waarschuwingen.map(
              (waarschuwing) => (
                <p
                  key={waarschuwing}
                  className="text-sm text-amber-700"
                >
                  {waarschuwing}
                </p>
              ),
            )}
          </div>
        </div>
      )}

      {fout && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">
            {fout}
          </p>
        </div>
      )}

      {!datum ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-600">
            Kies een datum om geschikte medewerkers te bekijken.
          </p>
        </div>
      ) : geladenFoutloos(
          ladenMedewerkers,
          ladenDiensten,
        ) ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-600">
            Medewerkers en bestaande diensten worden geladen...
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="font-semibold text-slate-900">
              Geschikte medewerkers
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Alleen medewerkers met een passende functie worden getoond.
            </p>
          </div>

          <div className="divide-y divide-slate-100">
            {passendeMedewerkers.length ===
            0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm font-medium text-slate-700">
                  Geen passende medewerkers gevonden.
                </p>
              </div>
            ) : (
              passendeMedewerkers.map(
                (medewerker) => {
                  const niveau =
                    beschikbaarheidsNiveau(
                      medewerker,
                      datum,
                      begintijd,
                      eindtijd,
                    );

                  const niveauKlasse =
                    niveau === "groen"
                      ? "bg-emerald-100 text-emerald-800"
                      : niveau === "oranje"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-red-100 text-red-800";

                  const niveauTekst =
                    niveau === "groen"
                      ? "Beschikbaar"
                      : niveau === "oranje"
                        ? "Gedeeltelijk beschikbaar"
                        : "Niet beschikbaar";

                  return (
                    <div
                      key={medewerker.id}
                      className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-medium text-slate-900">
                          {volledigeNaam(
                            medewerker,
                          )}
                        </p>

                        {medewerker.personeelsnummer && (
                          <p className="mt-1 text-xs text-slate-500">
                            {medewerker.personeelsnummer}
                          </p>
                        )}
                      </div>

                      <span
                        className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${niveauKlasse}`}
                      >
                        {niveauTekst}
                      </span>
                    </div>
                  );
                },
              )
            )}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          disabled={
            laden ||
            !datum ||
            geselecteerdeTagIds.length ===
              0
          }
          onClick={() =>
            void maakDienst()
          }
          className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {laden
            ? "Dienst aanmaken..."
            : "Dienst aanmaken"}
        </button>
      </div>
    </div>
  );
}

function geladenFoutloos(
  ladenMedewerkers: boolean,
  ladenDiensten: boolean,
) {
  return (
    ladenMedewerkers ||
    ladenDiensten
  );
}
