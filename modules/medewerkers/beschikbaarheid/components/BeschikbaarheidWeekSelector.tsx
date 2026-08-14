"use client";

import {
  useEffect,
  useState,
} from "react";

type Vestiging = {
  id: string;
  naam: string;
};

type Week = {
  id: string;
  jaar: number;
  weeknummer: number;
  status: string;
  beschikbaarheidDeadline:
    | string
    | null;
};

type BeschikbaarheidWeekSelectorProps = {
  vestigingen: Vestiging[];
  medewerkerId: string;
  isBeheerder: boolean;
  onSelected: (
    vestigingId: string,
    week: Week,
  ) => void;
};

function getISOWeek(
  datum: Date,
): {
  jaar: number;
  weeknummer: number;
} {
  const donderdag = new Date(
    Date.UTC(
      datum.getFullYear(),
      datum.getMonth(),
      datum.getDate(),
    ),
  );

  const dag =
    donderdag.getUTCDay() || 7;

  donderdag.setUTCDate(
    donderdag.getUTCDate() + 4 - dag,
  );

  const jaar =
    donderdag.getUTCFullYear();

  const eersteDonderdag =
    new Date(
      Date.UTC(jaar, 0, 4),
    );

  const eersteDag =
    eersteDonderdag.getUTCDay() || 7;

  const weeknummer = Math.ceil(
    (
      (donderdag.getTime() -
        eersteDonderdag.getTime()) /
        86400000 +
      eersteDag -
      1
    ) /
      7,
  );

  return {
    jaar,
    weeknummer,
  };
}

function getAantalISOWeken(
  jaar: number,
): number {
  return getISOWeek(
    new Date(
      jaar,
      11,
      28,
    ),
  ).weeknummer;
}

function getDatumVanISOWeek(
  jaar: number,
  weeknummer: number,
): Date {
  const vierdeJanuari = new Date(
    Date.UTC(
      jaar,
      0,
      4,
    ),
  );

  const dag =
    vierdeJanuari.getUTCDay() || 7;

  const maandag = new Date(
    vierdeJanuari,
  );

  maandag.setUTCDate(
    vierdeJanuari.getUTCDate() -
      dag +
      1 +
      (weeknummer - 1) * 7,
  );

  return maandag;
}

function formatWeekDatum(
  datum: Date,
): string {
  return datum.toLocaleDateString(
    "nl-NL",
    {
      day: "numeric",
      month: "long",
    },
  );
}

function formatWeekDatumKort(
  datum: Date,
): string {
  return datum.toLocaleDateString(
    "nl-NL",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    },
  );
}

function formatDeadline(
  value: string | null,
) {
  if (!value) {
    return "Geen deadline ingesteld";
  }

  const datum = new Date(value);

  if (
    Number.isNaN(
      datum.getTime(),
    )
  ) {
    return "Ongeldige deadline";
  }

  return datum.toLocaleString(
    "nl-NL",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  );
}

function deadlineVerstreken(
  value: string | null,
) {
  if (!value) {
    return false;
  }

  const deadline = new Date(value);

  if (
    Number.isNaN(
      deadline.getTime(),
    )
  ) {
    return false;
  }

  return new Date() > deadline;
}

function naarInputDatumTijd(
  value: string | null,
) {
  if (!value) {
    return "";
  }

  const datum = new Date(value);

  if (
    Number.isNaN(
      datum.getTime(),
    )
  ) {
    return "";
  }

  const jaar =
    datum.getFullYear();

  const maand = String(
    datum.getMonth() + 1,
  ).padStart(2, "0");

  const dag = String(
    datum.getDate(),
  ).padStart(2, "0");

  const uren = String(
    datum.getHours(),
  ).padStart(2, "0");

  const minuten = String(
    datum.getMinutes(),
  ).padStart(2, "0");

  return `${jaar}-${maand}-${dag}T${uren}:${minuten}`;
}

export default function BeschikbaarheidWeekSelector({
  vestigingen,
  medewerkerId,
  isBeheerder,
  onSelected,
}: BeschikbaarheidWeekSelectorProps) {
  const vandaag = new Date();

  const huidigeWeek =
    getISOWeek(vandaag);

  const [vestigingId, setVestigingId] =
    useState(
      vestigingen[0]?.id ?? "",
    );

  const [jaar, setJaar] =
    useState(
      huidigeWeek.jaar,
    );

  const [weeknummer, setWeeknummer] =
    useState(
      huidigeWeek.weeknummer,
    );

  const [week, setWeek] =
    useState<Week | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [
    savingDeadline,
    setSavingDeadline,
  ] = useState(false);

  const [error, setError] =
    useState("");

  const [
    deadlineWaarde,
    setDeadlineWaarde,
  ] = useState("");

  useEffect(() => {
    if (!vestigingId) {
      return;
    }

    let actief = true;

    async function laadWeek() {
      setLoading(true);
      setError("");

      try {
        const response =
          await fetch(
            `/api/vestigingen/${vestigingId}/weken?jaar=${jaar}&weeknummer=${weeknummer}`,
            {
              cache: "no-store",
            },
          );

        const resultaat =
          await response.json();

        if (!response.ok) {
          throw new Error(
            resultaat.error ??
              "Week ophalen is mislukt.",
          );
        }

        let geladenWeek =
          resultaat.week;

        if (!geladenWeek) {
          const createResponse =
            await fetch(
              `/api/vestigingen/${vestigingId}/weken`,
              {
                method: "POST",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                body: JSON.stringify({
                  jaar,
                  weeknummer,
                }),
              },
            );

          const createResultaat =
            await createResponse.json();

          if (!createResponse.ok) {
            throw new Error(
              createResultaat.error ??
                "Week aanmaken is mislukt.",
            );
          }

          geladenWeek =
            createResultaat;
        }

        if (
          actief &&
          geladenWeek
        ) {
          setWeek(
            geladenWeek,
          );

          setDeadlineWaarde(
            naarInputDatumTijd(
              geladenWeek.beschikbaarheidDeadline ??
                null,
            ),
          );

          onSelected(
            vestigingId,
            geladenWeek,
          );
        }
      } catch (error) {
        if (actief) {
          setWeek(null);

          setError(
            error instanceof Error
              ? error.message
              : "Week ophalen is mislukt.",
          );
        }
      } finally {
        if (actief) {
          setLoading(false);
        }
      }
    }

    void laadWeek();

    return () => {
      actief = false;
    };
  }, [
    vestigingId,
    jaar,
    weeknummer,
    onSelected,
    medewerkerId,
  ]);

  async function deadlineOpslaan() {
    if (
      !week ||
      !isBeheerder
    ) {
      return;
    }

    setSavingDeadline(true);
    setError("");

    try {
      const response =
        await fetch(
          `/api/vestigingen/${vestigingId}/weken`,
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              weekId: week.id,
              beschikbaarheidDeadline:
                deadlineWaarde
                  ? new Date(
                      deadlineWaarde,
                    ).toISOString()
                  : null,
            }),
          },
        );

      const resultaat =
        await response.json();

      if (!response.ok) {
        throw new Error(
          resultaat.error ??
            "Deadline opslaan is mislukt.",
        );
      }

      const bijgewerkteWeek =
        resultaat.week;

      setWeek(
        bijgewerkteWeek,
      );

      setDeadlineWaarde(
        naarInputDatumTijd(
          bijgewerkteWeek.beschikbaarheidDeadline ??
            null,
        ),
      );

      onSelected(
        vestigingId,
        bijgewerkteWeek,
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Deadline opslaan is mislukt.",
      );
    } finally {
      setSavingDeadline(false);
    }
  }

  function vorigeWeek() {
    if (weeknummer <= 1) {
      const vorigJaar =
        jaar - 1;

      setJaar(vorigJaar);

      setWeeknummer(
        getAantalISOWeken(
          vorigJaar,
        ),
      );

      return;
    }

    setWeeknummer(
      (waarde) =>
        waarde - 1,
    );
  }

  function volgendeWeek() {
    const aantalWeken =
      getAantalISOWeken(
        jaar,
      );

    if (
      weeknummer >=
      aantalWeken
    ) {
      setJaar(
        (waarde) =>
          waarde + 1,
      );

      setWeeknummer(1);

      return;
    }

    setWeeknummer(
      (waarde) =>
        waarde + 1,
    );
  }

  const weekStart =
    getDatumVanISOWeek(
      jaar,
      weeknummer,
    );

  const weekEinde =
    new Date(
      weekStart,
    );

  weekEinde.setUTCDate(
    weekEinde.getUTCDate() + 6,
  );

  const weekPeriode =
    `${formatWeekDatum(
      weekStart,
    )} t/m ${formatWeekDatum(
      weekEinde,
    )}`;

  const deadline =
    week?.beschikbaarheidDeadline ??
    null;

  const gesloten =
    deadlineVerstreken(
      deadline,
    );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Beschikbaarheidsplanner
            </p>

            <h3 className="mt-1 text-lg font-semibold text-slate-900">
              Week {weeknummer}
            </h3>

            <p className="mt-1 text-sm font-medium text-slate-600">
              {weekPeriode}
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Beschikbaarheid kan worden
              opgegeven tussen 09:00 en 23:00
              in stappen van 30 minuten.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={vorigeWeek}
              disabled={loading}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              ← Vorige
            </button>

            <button
              type="button"
              onClick={volgendeWeek}
              disabled={loading}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Volgende →
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label
              htmlFor="vestiging"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Vestiging
            </label>

            <select
              id="vestiging"
              value={vestigingId}
              onChange={(event) =>
                setVestigingId(
                  event.target.value,
                )
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200"
            >
              {vestigingen.map(
                (vestiging) => (
                  <option
                    key={
                      vestiging.id
                    }
                    value={
                      vestiging.id
                    }
                  >
                    {
                      vestiging.naam
                    }
                  </option>
                ),
              )}
            </select>
          </div>

          <div>
            <label
              htmlFor="jaar"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Jaar
            </label>

            <select
              id="jaar"
              value={jaar}
              onChange={(event) =>
                setJaar(
                  Number(
                    event.target.value,
                  ),
                )
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200"
            >
              {[
                jaar - 1,
                jaar,
                jaar + 1,
              ].map(
                (waarde) => (
                  <option
                    key={waarde}
                    value={waarde}
                  >
                    {waarde}
                  </option>
                ),
              )}
            </select>
          </div>

          <div>
            <label
              htmlFor="weeknummer"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Weeknummer
            </label>

            <select
              id="weeknummer"
              value={weeknummer}
              onChange={(event) =>
                setWeeknummer(
                  Number(
                    event.target.value,
                  ),
                )
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200"
            >
              {Array.from(
                {
                  length:
                    getAantalISOWeken(
                      jaar,
                    ),
                },
                (_, index) =>
                  index + 1,
              ).map(
                (waarde) => (
                  <option
                    key={waarde}
                    value={waarde}
                  >
                    Week {waarde}
                  </option>
                ),
              )}
            </select>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Geselecteerde week
              </p>

              <p className="mt-1 text-base font-semibold text-slate-900">
                Week {weeknummer} ·{" "}
                {jaar}
              </p>

              <p className="mt-1 text-sm text-slate-600">
                {formatWeekDatumKort(
                  weekStart,
                )}{" "}
                –{" "}
                {formatWeekDatumKort(
                  weekEinde,
                )}
              </p>
            </div>

            <div className="text-left sm:text-right">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Beschikbaarheidsvenster
              </p>

              <p className="mt-1 text-sm font-semibold text-slate-900">
                09:00 – 23:00
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Per 30 minuten
              </p>
            </div>
          </div>
        </div>

        {loading && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-6 py-5 text-center">
            <p className="text-sm text-slate-500">
              Week laden...
            </p>
          </div>
        )}

        {week && !loading && (
          <div
            className={[
              "rounded-xl border p-5",
              gesloten
                ? "border-red-200 bg-red-50"
                : "border-green-200 bg-green-50",
            ].join(" ")}
          >
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Beschikbaarheidsdeadline
                </p>

                <p className="mt-1 text-base font-semibold text-slate-900">
                  {deadline
                    ? formatDeadline(
                        deadline,
                      )
                    : "Geen deadline ingesteld"}
                </p>

                <p
                  className={[
                    "mt-2 text-sm font-medium",
                    gesloten
                      ? "text-red-700"
                      : "text-green-700",
                  ].join(" ")}
                >
                  {gesloten
                    ? "Deadline verstreken"
                    : "Beschikbaarheid is geopend"}
                </p>
              </div>

              {isBeheerder && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div>
                    <label
                      htmlFor="beschikbaarheidDeadline"
                      className="mb-2 block text-sm font-medium text-slate-700"
                    >
                      Deadline instellen
                    </label>

                    <input
                      id="beschikbaarheidDeadline"
                      type="datetime-local"
                      value={
                        deadlineWaarde
                      }
                      onChange={(
                        event,
                      ) =>
                        setDeadlineWaarde(
                          event
                            .target
                            .value,
                        )
                      }
                      className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={
                      deadlineOpslaan
                    }
                    disabled={
                      savingDeadline
                    }
                    className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingDeadline
                      ? "Opslaan..."
                      : "Deadline opslaan"}
                  </button>
                </div>
              )}
            </div>

            {isBeheerder && (
              <p className="mt-4 text-xs text-slate-500">
                Laat het veld leeg en sla op
                om de deadline te verwijderen.
              </p>
            )}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}