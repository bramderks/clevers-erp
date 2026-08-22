"use client";

import {
  FormEvent,
  useMemo,
  useState,
} from "react";

type BeschikbaarheidFormProps = {
  weekId: string;
  medewerkerId: string;
  weekStartdatum: string;
  beschikbaarheidDeadline?: string | Date | null;
  isBeheerder?: boolean;
  onAangemaakt?: () => void;
};

type BeschikbaarheidStatus =
  | "BESCHIKBAAR"
  | "NIET_BESCHIKBAAR";

type Dag = {
  datum: string;
  naam: string;
  korteNaam: string;
  nummer: number;
};

type DagInvoer = {
  status: BeschikbaarheidStatus;
  begintijd: string;
  eindtijd: string;
  opmerking: string;
  actief: boolean;
};

const MIN_TIJD = "09:00";
const MAX_TIJD = "23:00";
const TIJD_INTERVAL = 30;

function parseDatum(
  waarde: string | Date | null | undefined,
) {
  if (!waarde) {
    return null;
  }

  const datum =
    waarde instanceof Date
      ? waarde
      : new Date(waarde);

  if (Number.isNaN(datum.getTime())) {
    return null;
  }

  return datum;
}

function isDeadlineVerstreken(
  deadline: string | Date | null | undefined,
) {
  const waarde = parseDatum(deadline);

  if (!waarde) {
    return false;
  }

  return new Date() > waarde;
}

function formatteerDeadline(
  deadline: string | Date | null | undefined,
) {
  const waarde = parseDatum(deadline);

  if (!waarde) {
    return null;
  }

  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(waarde);
}

function maakDagen(
  weekStartdatum: string,
): Dag[] {
  const start = new Date(
    `${weekStartdatum}T12:00:00`,
  );

  if (Number.isNaN(start.getTime())) {
    return [];
  }

  return Array.from(
    { length: 7 },
    (_, index) => {
      const datum = new Date(start);

      datum.setDate(
        start.getDate() + index,
      );

      const jaar =
        datum.getFullYear();

      const maand = String(
        datum.getMonth() + 1,
      ).padStart(2, "0");

      const dag = String(
        datum.getDate(),
      ).padStart(2, "0");

      const volledigeNaam =
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

      return {
        datum: `${jaar}-${maand}-${dag}`,
        naam: volledigeNaam,
        korteNaam:
          korteNaam.replace(
            ".",
            "",
          ),
        nummer:
          datum.getDate(),
      };
    },
  );
}

function standaardDag(): DagInvoer {
  return {
    status: "NIET_BESCHIKBAAR",
    begintijd: "",
    eindtijd: "",
    opmerking: "",
    actief: false,
  };
}

function maakTijden(): string[] {
  const tijden: string[] = [];

  for (
    let minuten = 9 * 60;
    minuten <= 23 * 60;
    minuten += TIJD_INTERVAL
  ) {
    const uren =
      Math.floor(
        minuten / 60,
      );

    const minutenBinnenUur =
      minuten % 60;

    tijden.push(
      `${String(uren).padStart(
        2,
        "0",
      )}:${String(
        minutenBinnenUur,
      ).padStart(2, "0")}`,
    );
  }

  return tijden;
}

function tijdenBinnenInterval(
  tijd: string,
) {
  const [
    uren,
    minuten,
  ] = tijd
    .split(":")
    .map(Number);

  if (
    Number.isNaN(uren) ||
    Number.isNaN(minuten)
  ) {
    return false;
  }

  const totaalMinuten =
    uren * 60 + minuten;

  return (
    totaalMinuten >=
      9 * 60 &&
    totaalMinuten <=
      23 * 60 &&
    totaalMinuten %
        TIJD_INTERVAL ===
      0
  );
}

function tijdenGeldig(
  begintijd: string,
  eindtijd: string,
) {
  return (
    begintijd >= MIN_TIJD &&
    begintijd <= MAX_TIJD &&
    eindtijd >= MIN_TIJD &&
    eindtijd <= MAX_TIJD &&
    begintijd < eindtijd &&
    tijdenBinnenInterval(
      begintijd,
    ) &&
    tijdenBinnenInterval(
      eindtijd,
    )
  );
}

export default function BeschikbaarheidForm({
  weekId,
  medewerkerId,
  weekStartdatum,
  beschikbaarheidDeadline,
  isBeheerder = false,
  onAangemaakt,
}: BeschikbaarheidFormProps) {
  const dagen = useMemo(
    () =>
      maakDagen(
        weekStartdatum,
      ),
    [weekStartdatum],
  );

  const tijden = useMemo(
    () => maakTijden(),
    [],
  );

  const [invoer, setInvoer] =
    useState<
      Record<
        string,
        DagInvoer
      >
    >(() =>
      Object.fromEntries(
        maakDagen(
          weekStartdatum,
        ).map((dag) => [
          dag.datum,
          standaardDag(),
        ]),
      ),
    );

  const [laden, setLaden] =
    useState(false);

  const [fout, setFout] =
    useState<string | null>(
      null,
    );

  const deadlineVerstreken =
    useMemo(
      () =>
        isDeadlineVerstreken(
          beschikbaarheidDeadline,
        ),
      [beschikbaarheidDeadline],
    );

  const deadlineTekst =
    useMemo(
      () =>
        formatteerDeadline(
          beschikbaarheidDeadline,
        ),
      [beschikbaarheidDeadline],
    );

  const invoerGeblokkeerd =
    deadlineVerstreken &&
    !isBeheerder;

  function wijzigDag(
    datum: string,
    wijziging: Partial<DagInvoer>,
  ) {
    setInvoer((vorige) => ({
      ...vorige,
      [datum]: {
        ...(vorige[datum] ??
          standaardDag()),
        ...wijziging,
      },
    }));

    setFout(null);
  }

  function activeerDag(
    datum: string,
  ) {
    wijzigDag(datum, {
      actief: true,
      status:
        "BESCHIKBAAR",
      begintijd:
        MIN_TIJD,
      eindtijd:
        MAX_TIJD,
    });
  }

  function deactiveerDag(
    datum: string,
  ) {
    wijzigDag(datum, {
      actief: false,
      status:
        "NIET_BESCHIKBAAR",
      begintijd: "",
      eindtijd: "",
      opmerking: "",
    });
  }

  async function slaDagOp(
    datum: string,
    dagInvoer: DagInvoer,
  ) {
    const datumWaarde =
      new Date(
        `${datum}T00:00:00`,
      );

    let begintijd:
      | string
      | null = null;

    let eindtijd:
      | string
      | null = null;

    if (
      dagInvoer.actief &&
      dagInvoer.status ===
        "BESCHIKBAAR"
    ) {
      if (
        !dagInvoer.begintijd ||
        !dagInvoer.eindtijd
      ) {
        throw new Error(
          "Vul voor iedere beschikbare dag een begintijd en eindtijd in.",
        );
      }

      if (
        !tijdenGeldig(
          dagInvoer.begintijd,
          dagInvoer.eindtijd,
        )
      ) {
        throw new Error(
          "Tijden moeten tussen 09:00 en 23:00 liggen en in stappen van 30 minuten worden gekozen.",
        );
      }

      begintijd =
        new Date(
          `${datum}T${dagInvoer.begintijd}:00`,
        ).toISOString();

      eindtijd =
        new Date(
          `${datum}T${dagInvoer.eindtijd}:00`,
        ).toISOString();
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
            weekId,
            datum:
              datumWaarde.toISOString(),
            begintijd,
            eindtijd,
            status:
              dagInvoer.actief &&
              dagInvoer.status ===
                "BESCHIKBAAR"
                ? "BESCHIKBAAR"
                : "NIET_BESCHIKBAAR",
            opmerking:
              dagInvoer.opmerking.trim() ||
              null,
          }),
        },
      );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data?.fout ??
          data?.error ??
          "De beschikbaarheid kon niet worden opgeslagen.",
      );
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setFout(null);

    if (invoerGeblokkeerd) {
      setFout(
        "De deadline voor deze beschikbaarheid is verstreken.",
      );

      return;
    }

    if (
      !weekId ||
      !medewerkerId
    ) {
      setFout(
        "Planningweek en medewerker zijn verplicht.",
      );

      return;
    }

    if (dagen.length !== 7) {
      setFout(
        "De week kon niet correct worden bepaald.",
      );

      return;
    }

    try {
      setLaden(true);

      for (const dag of dagen) {
        const dagInvoer =
          invoer[dag.datum] ??
          standaardDag();

        await slaDagOp(
          dag.datum,
          dagInvoer,
        );
      }

      onAangemaakt?.();
    } catch (error) {
      console.error(
        "Fout bij opslaan beschikbaarheid:",
        error,
      );

      setFout(
        error instanceof Error
          ? error.message
          : "De beschikbaarheid kon niet worden opgeslagen.",
      );
    } finally {
      setLaden(false);
    }
  }

  if (invoerGeblokkeerd) {
    return (
      <div className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
              !
            </div>

            <div>
              <h2 className="text-base font-semibold text-red-900">
                Beschikbaarheid gesloten
              </h2>

              <p className="mt-1 text-sm text-red-800">
                De deadline voor het
                doorgeven van de
                beschikbaarheid is
                verstreken.
              </p>

              {deadlineTekst && (
                <p className="mt-2 text-sm font-semibold text-red-900">
                  Deadline:{" "}
                  {deadlineTekst}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      {/* HEADER */}
      <div className="border-b border-slate-200 px-6 py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Beschikbaarheid doorgeven
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Geef per dag aan wanneer
              je beschikbaar bent.
            </p>
          </div>

          {deadlineTekst && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 sm:min-w-[260px]">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                Deadline
              </p>

              <p className="mt-1 text-sm font-semibold text-amber-900">
                {deadlineTekst}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* WEEKKALENDER */}
      <div className="px-6 py-6">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-slate-900">
            Jouw week
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            Iedere dag staat standaard
            op niet beschikbaar. Klik op
            een dag om deze beschikbaar
            te maken.
          </p>
        </div>

        <div className="overflow-x-auto pb-2">
          <div className="grid min-w-[980px] grid-cols-7 gap-3">
            {dagen.map((dag) => {
              const dagInvoer =
                invoer[dag.datum] ??
                standaardDag();

              const actief =
                dagInvoer.actief;

              return (
                <div
                  key={dag.datum}
                  className={[
                    "overflow-hidden rounded-2xl border transition",
                    actief
                      ? "border-emerald-300 bg-white shadow-sm"
                      : "border-slate-200 bg-slate-50",
                  ].join(" ")}
                >
                  {/* DAG HEADER */}
                  <div
                    className={[
                      "px-4 py-4",
                      actief
                        ? "bg-emerald-50"
                        : "bg-slate-100",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p
                          className={[
                            "text-xs font-bold uppercase tracking-wide",
                            actief
                              ? "text-emerald-700"
                              : "text-slate-500",
                          ].join(" ")}
                        >
                          {dag.korteNaam}
                        </p>

                        <p className="mt-1 text-2xl font-bold text-slate-900">
                          {dag.nummer}
                        </p>
                      </div>

                      <div
                        className={[
                          "h-3 w-3 rounded-full",
                          actief
                            ? "bg-emerald-500"
                            : "bg-slate-300",
                        ].join(" ")}
                      />
                    </div>
                  </div>

                  {/* DAG STATUS */}
                  <div className="p-4">
                    {!actief ? (
                      <button
                        type="button"
                        onClick={() =>
                          activeerDag(
                            dag.datum,
                          )
                        }
                        disabled={laden}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-left transition hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className="block text-sm font-semibold text-slate-700">
                          Niet beschikbaar
                        </span>

                        <span className="mt-1 block text-xs text-slate-400">
                          Klik om beschikbaar
                          te maken
                        </span>
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            deactiveerDag(
                              dag.datum,
                            )
                          }
                          disabled={laden}
                          className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-left transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <span className="block text-sm font-semibold text-emerald-800">
                            Beschikbaar
                          </span>

                          <span className="mt-1 block text-xs text-emerald-600">
                            Klik om uit te
                            schakelen
                          </span>
                        </button>

                        {/* TIJDEN */}
                        <div className="mt-4 space-y-3">
                          <div>
                            <label className="block text-xs font-semibold text-slate-600">
                              Vanaf
                            </label>

                            <select
                              value={
                                dagInvoer.begintijd
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
                              disabled={
                                laden
                              }
                              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
                            >
                              <option value="">
                                Kies tijd
                              </option>

                              {tijden.map(
                                (
                                  tijd,
                                ) => (
                                  <option
                                    key={
                                      tijd
                                    }
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
                            <label className="block text-xs font-semibold text-slate-600">
                              Tot
                            </label>

                            <select
                              value={
                                dagInvoer.eindtijd
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
                              disabled={
                                laden
                              }
                              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
                            >
                              <option value="">
                                Kies tijd
                              </option>

                              {tijden.map(
                                (
                                  tijd,
                                ) => (
                                  <option
                                    key={
                                      tijd
                                    }
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
                            <label className="block text-xs font-semibold text-slate-600">
                              Opmerking
                            </label>

                            <textarea
                              value={
                                dagInvoer.opmerking
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
                              disabled={
                                laden
                              }
                              rows={3}
                              placeholder="Optioneel"
                              className="mt-1 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* FOUT */}
        {fout && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm font-medium text-red-800">
              {fout}
            </p>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-700">
            Klaar met je week?
          </p>

          <p className="mt-0.5 text-xs text-slate-500">
            Controleer je tijden en sla
            daarna de volledige week op.
          </p>
        </div>

        <button
          type="submit"
          disabled={laden}
          className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {laden
            ? "Week opslaan..."
            : "Beschikbaarheid opslaan"}
        </button>
      </div>
    </form>
  );
}