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
  isEigenaar: boolean;
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
  isEigenaar,
  onSelected,
}: BeschikbaarheidWeekSelectorProps) {
  const vandaag = new Date();

  const huidigeWeek =
    getISOWeek(vandaag);

  const [vestigingId, setVestigingId] =
    useState(
      vestigingen[0]?.id ?? "",
    );

  const [jaar, setJaar] = useState(
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

  const [savingDeadline, setSavingDeadline] =
    useState(false);

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
        const response = await fetch(
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
    if (!week) {
      return;
    }

    setSavingDeadline(true);
    setError("");

    try {
      const response = await fetch(
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
      setJaar(
        (waarde) => waarde - 1,
      );

      setWeeknummer(52);

      return;
    }

    setWeeknummer(
      (waarde) => waarde - 1,
    );
  }

  function volgendeWeek() {
    if (weeknummer >= 52) {
      setJaar(
        (waarde) => waarde + 1,
      );

      setWeeknummer(1);

      return;
    }

    setWeeknummer(
      (waarde) => waarde + 1,
    );
  }

  const deadline =
    week?.beschikbaarheidDeadline ??
    null;

  const gesloten =
    deadlineVerstreken(
      deadline,
    );

  return (
    <div className="space-y-6">
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
            ].map((waarde) => (
              <option
                key={waarde}
                value={waarde}
              >
                {waarde}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="weeknummer"
            className="mb-2 block text-sm font-medium text-slate-700"
          >
            Week
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
                length: 53,
              },
              (_, index) =>
                index + 1,
            ).map((waarde) => (
              <option
                key={waarde}
                value={waarde}
              >
                Week {waarde}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={vorigeWeek}
          disabled={loading}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          ← Vorige week
        </button>

        <div className="text-center">
          {loading ? (
            <p className="text-sm text-slate-500">
              Week laden...
            </p>
          ) : (
            <p className="text-sm font-medium text-slate-700">
              Week {weeknummer} ·{" "}
              {jaar}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={volgendeWeek}
          disabled={loading}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Volgende week →
        </button>
      </div>

      {week && (
        <div
          className={[
            "rounded-xl border p-4",
            gesloten
              ? "border-amber-200 bg-amber-50"
              : "border-cyan-200 bg-cyan-50",
          ].join(" ")}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Beschikbaarheidsdeadline
              </p>

              <p className="mt-1 text-sm text-slate-600">
                {deadline
                  ? formatDeadline(
                      deadline,
                    )
                  : "Er is nog geen deadline ingesteld."}
              </p>

              {deadline && (
                <p
                  className={[
                    "mt-2 text-xs font-medium",
                    gesloten
                      ? "text-amber-700"
                      : "text-cyan-700",
                  ].join(" ")}
                >
                  {gesloten
                    ? "Deadline verstreken"
                    : "Beschikbaarheid is geopend"}
                </p>
              )}
            </div>

            {isEigenaar && (
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
                    onChange={(event) =>
                      setDeadlineWaarde(
                        event.target
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

          {isEigenaar && (
            <p className="mt-3 text-xs text-slate-500">
              Laat het veld leeg en sla op om
              de deadline te verwijderen.
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
  );
}