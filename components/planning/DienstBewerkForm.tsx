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

  tags?: {
    id: string;
    naam: string;
    volgorde: number;
    actief: boolean;
  }[];

  beschikbaarheden?: {
    id: string;
    weekId: string;
    medewerkerId: string;
    datum: string;
    begintijd: string | null;
    eindtijd: string | null;
    status: string;
    opmerking: string | null;
  }[];

  diensten?: {
    id: string;
    dienstId: string;
    status: string;
  }[];
};

type MedewerkersResponse = {
  huidigeMedewerkerId: string | null;
  medewerkers: PlanningMedewerker[];
};

type DienstBewerkFormProps = {
  dienst: Dienst;
  vestigingId: string;
  onGewijzigd?: () => void;
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

function tijdUitDatum(
  waarde: string,
) {
  const datum = new Date(waarde);

  if (Number.isNaN(datum.getTime())) {
    return "";
  }

  return datum
    .toISOString()
    .slice(11, 16);
}

function datumUitDatum(
  waarde: string,
) {
  const datum = new Date(waarde);

  if (Number.isNaN(datum.getTime())) {
    return "";
  }

  return datum
    .toISOString()
    .slice(0, 10);
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

function statusLabel(
  status: string,
) {
  switch (status) {
    case "BEVESTIGD":
      return "Bevestigd";

    case "GEPLAND":
      return "Gepland";

    case "AFGEZEGD":
      return "Afgezegd";

    case "GEWERKT":
      return "Gewerkt";

    case "OPEN":
      return "Open";

    default:
      return status;
  }
}

function statusKlassen(
  status: string,
) {
  switch (status) {
    case "BEVESTIGD":
    case "GEWERKT":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";

    case "GEPLAND":
      return "border-amber-300 bg-amber-100 text-amber-800";

    case "AFGEZEGD":
      return "border-slate-200 bg-slate-100 text-slate-500";

    default:
      return "border-red-200 bg-red-50 text-red-700";
  }
}

function bezettingMedewerkerId(
  bezetting: Dienst["bezetting"][number],
) {
  return (
    bezetting.medewerkerId ??
    bezetting.medewerker?.id ??
    null
  );
}

function datumVoorApi(
  waarde: string,
) {
  const datum = new Date(waarde);

  if (Number.isNaN(datum.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(
    "sv-SE",
  ).format(datum);
}

export default function DienstBewerkForm({
  dienst,
  vestigingId,
  onGewijzigd,
}: DienstBewerkFormProps) {
  const [datum, setDatum] =
    useState(
      datumUitDatum(dienst.datum),
    );

  const [begintijd, setBegintijd] =
    useState(
      tijdUitDatum(dienst.begintijd),
    );

  const [eindtijd, setEindtijd] =
    useState(
      tijdUitDatum(dienst.eindtijd),
    );

  const [opmerkingen, setOpmerkingen] =
    useState(
      dienst.opmerkingen ?? "",
    );

  const [tags, setTags] =
    useState<PlanningTag[]>([]);

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

  const [
    succes,
    setSucces,
  ] = useState<string | null>(
    null,
  );

  const startTijden = useMemo(
    () =>
      maakTijden(
        START_MINUTEN,
        EINDE_MINUTEN - 15,
      ),
    [],
  );

  const eindTijden = useMemo(() => {
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
      return maakTijden(
        START_MINUTEN + 15,
        EINDE_MINUTEN,
      );
    }

    return maakTijden(
      start + 15,
      EINDE_MINUTEN,
    );
  }, [begintijd]);

  useEffect(() => {
    setDatum(
      datumUitDatum(dienst.datum),
    );

    setBegintijd(
      tijdUitDatum(dienst.begintijd),
    );

    setEindtijd(
      tijdUitDatum(dienst.eindtijd),
    );

    setOpmerkingen(
      dienst.opmerkingen ?? "",
    );

    const bestaandeTags: Record<
      string,
      number
    > = {};

    for (const dienstTag of dienst.tags) {
      bestaandeTags[
        dienstTag.tag.id
      ] = dienstTag.aantal;
    }

    setGeselecteerdeTags(
      bestaandeTags,
    );
  }, [
    dienst.datum,
    dienst.begintijd,
    dienst.eindtijd,
    dienst.opmerkingen,
    dienst.tags,
  ]);

  useEffect(() => {
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
              credentials: "include",
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
    if (!datum) {
      setMedewerkers([]);
      return;
    }

    const datumVoorRequest =
      datumVoorApi(datum);

    if (!datumVoorRequest) {
      setMedewerkers([]);
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
              datumVoorRequest!,
            )}`,
            {
              method: "GET",
              cache: "no-store",
              credentials: "include",
            },
          );

        const data =
          (await response.json()) as
            | MedewerkersResponse
            | { fout?: string };

        if (!response.ok) {
          throw new Error(
            "fout" in data &&
            typeof data.fout === "string"
              ? data.fout
              : "De medewerkers konden niet worden opgehaald.",
          );
        }

        if (
          !data ||
          typeof data !== "object" ||
          !("medewerkers" in data) ||
          !Array.isArray(
            data.medewerkers,
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
          "Fout bij laden medewerkers:",
          error,
        );

        if (actief) {
          setMedewerkers([]);
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
      eindeMinuten <=
      startMinuten
    ) {
      setFout(
        "Eindtijd moet na de begintijd liggen.",
      );

      return;
    }

    if (
      startMinuten % 15 !== 0 ||
      eindeMinuten % 15 !== 0
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
      eindeMinuten >
      EINDE_MINUTEN
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
      setOpslaanBezig(true);

      const start = new Date(
        `${datum}T${begintijd}`,
      );

      const einde = new Date(
        `${datum}T${eindtijd}`,
      );

      if (
        Number.isNaN(
          start.getTime(),
        ) ||
        Number.isNaN(
          einde.getTime(),
        )
      ) {
        setFout(
          "De datum of tijden zijn ongeldig.",
        );

        return;
      }

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
              datum:
                start
                  .toISOString(),
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

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.fout ??
            "De dienst kon niet worden opgeslagen.",
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
              dienstId:
                dienst.id,
              medewerkerId,
              status:
                "BEVESTIGD",
            }),
          },
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.fout ??
            "De medewerker kon niet aan de dienst worden gekoppeld.",
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

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.fout ??
            "De medewerker kon niet van de dienst worden verwijderd.",
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
            id,
          ): id is string =>
            typeof id ===
            "string",
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
      .sort((a, b) =>
        volledigeNaam(
          a,
        ).localeCompare(
          volledigeNaam(b),
          "nl",
        ),
      );

  return (
    <form
      onSubmit={opslaanDienst}
      className="space-y-6"
    >
      {/* ======================================================
          DIENSTGEGEVENS
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
          TAGS
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
            Er zijn geen actieve
            planningtags beschikbaar.
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
            {
              dienst.bezetting.filter(
                (bezetting) =>
                  bezetting.status !==
                  "AFGEZEGD",
              ).length
            }{" "}
            personen
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
                    key={
                      bezetting.id
                    }
                    className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="font-medium text-slate-900">
                        {medewerker
                          ? volledigeNaam(
                              medewerker as PlanningMedewerker,
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
                          className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {bezettingBezig ===
                          bezetting.id
                            ? "Bezig..."
                            : "Verwijderen"}
                        </button>
                      )}
                  </div>
                );
              },
            )
          )}
        </div>

        {/* ====================================================
            MEDEWERKER TOEVOEGEN
            ==================================================== */}

        <div className="mt-5 border-t border-slate-200 pt-5">
          <h3 className="text-sm font-semibold text-slate-900">
            Medewerker toevoegen
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            Een medewerker die hier wordt
            toegevoegd, wordt direct
            bevestigd.
          </p>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <select
              defaultValue=""
              disabled={
                ladenMedewerkers ||
                bezettingBezig !== null
              }
              onChange={(event) => {
                const medewerkerId =
                  event.target.value;

                if (!medewerkerId) {
                  return;
                }

                void voegMedewerkerToe(
                  medewerkerId,
                );

                event.target.value =
                  "";
              }}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-50"
            >
              <option value="">
                {ladenMedewerkers
                  ? "Medewerkers laden..."
                  : beschikbareMedewerkers.length ===
                      0
                    ? "Geen medewerkers beschikbaar"
                    : "Kies een medewerker..."}
              </option>

              {beschikbareMedewerkers.map(
                (medewerker) => (
                  <option
                    key={
                      medewerker.id
                    }
                    value={
                      medewerker.id
                    }
                  >
                    {volledigeNaam(
                      medewerker,
                    )}
                    {medewerker.personeelsnummer
                      ? ` — ${medewerker.personeelsnummer}`
                      : ""}
                  </option>
                ),
              )}
            </select>
          </div>
        </div>
      </section>

      {/* ======================================================
          MELDINGEN
          ====================================================== */}

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

      {/* ======================================================
          OPSLAAN
          ====================================================== */}

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