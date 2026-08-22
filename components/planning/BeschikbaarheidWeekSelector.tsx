"use client";

import {
  useEffect,
  useState,
} from "react";

type Vestiging = {
  id: string;
  naam: string;
};

type SelectorWeek = {
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
    week: SelectorWeek,
  ) => void;
};

type WeekStatus =
  | "DOORGEGEVEN"
  | "NOG_DOORGEVEN"
  | "FOUT";

function deadlineVerstreken(
  week: SelectorWeek,
) {
  if (!week.beschikbaarheidDeadline) {
    return false;
  }

  const deadline = new Date(
    week.beschikbaarheidDeadline,
  );

  if (Number.isNaN(deadline.getTime())) {
    return false;
  }

  return new Date() > deadline;
}

function formatteerDeadline(
  deadline: string,
) {
  const datum = new Date(deadline);

  if (Number.isNaN(datum.getTime())) {
    return "Onbekende deadline";
  }

  return new Intl.DateTimeFormat(
    "nl-NL",
    {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(datum);
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
      await response.json();

    if (!response.ok) {
      throw new Error(
        resultaat?.error ??
          "Beschikbaarheid kon niet worden opgehaald.",
      );
    }

    const beschikbaarheden =
      Array.isArray(
        resultaat?.beschikbaarheden,
      )
        ? resultaat.beschikbaarheden
        : [];

    return beschikbaarheden.length >
      0
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

export default function BeschikbaarheidWeekSelector({
  vestigingen,
  medewerkerId,
  isBeheerder,
  onSelected,
}: BeschikbaarheidWeekSelectorProps) {
  const [
    vestigingId,
    setVestigingId,
  ] = useState(
    vestigingen[0]?.id ?? "",
  );

  const [weken, setWeken] =
    useState<SelectorWeek[]>([]);

  const [
    weekStatussen,
    setWeekStatussen,
  ] = useState<
    Record<string, WeekStatus>
  >({});

  const [weekId, setWeekId] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [
    loadingStatussen,
    setLoadingStatussen,
  ] = useState(false);

  const [error, setError] =
    useState<string | null>(null);

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
          await response.json();

        if (!response.ok) {
          throw new Error(
            resultaat?.fout ??
              resultaat?.error ??
              "De planningweken konden niet worden opgehaald.",
          );
        }

        const opgehaaldeWeken =
          Array.isArray(
            resultaat?.weken,
          )
            ? resultaat.weken
            : [];

        if (!actief) {
          return;
        }

        setWeken(
          opgehaaldeWeken,
        );

        const eersteWeek =
          opgehaaldeWeken[0] ??
          null;

        if (eersteWeek) {
          setWeekId(
            eersteWeek.id,
          );

          onSelected(
            vestigingId,
            eersteWeek,
          );

          void laadWeekStatussen(
            opgehaaldeWeken,
          );
        } else {
          setWeekId("");
        }
      } catch (error) {
        if (!actief) {
          return;
        }

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
        }
      }
    }

    async function laadWeekStatussen(
      wekenOmTeControleren: SelectorWeek[],
    ) {
      setLoadingStatussen(true);

      try {
        const resultaten =
          await Promise.all(
            wekenOmTeControleren.map(
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
          ),
        );
      } finally {
        if (actief) {
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
    onSelected,
  ]);

  function selecteerWeek(
    nieuweWeekId: string,
  ) {
    setWeekId(nieuweWeekId);

    const week =
      weken.find(
        (item) =>
          item.id ===
          nieuweWeekId,
      );

    if (!week) {
      return;
    }

    onSelected(
      vestigingId,
      week,
    );
  }

  const geselecteerdeWeek =
    weken.find(
      (week) =>
        week.id === weekId,
    ) ?? null;

  const geselecteerdeDeadlineVerstreken =
    geselecteerdeWeek
      ? deadlineVerstreken(
          geselecteerdeWeek,
        )
      : false;

  const geselecteerdeStatus =
    geselecteerdeWeek
      ? weekStatussen[
          geselecteerdeWeek.id
        ]
      : undefined;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid gap-4 md:grid-cols-2">
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
            }}
            disabled={
              loading ||
              vestigingen.length <= 1
            }
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-100 disabled:text-slate-500"
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
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-100 disabled:text-slate-500"
          >
            {weken.length === 0 ? (
              <option value="">
                {loading
                  ? "Weken laden..."
                  : "Geen weken beschikbaar"}
              </option>
            ) : (
              weken.map((week) => {
                const gesloten =
                  deadlineVerstreken(
                    week,
                  );

                const status =
                  weekStatussen[
                    week.id
                  ];

                let statusTekst =
                  "Status laden...";

                if (
                  status ===
                  "DOORGEGEVEN"
                ) {
                  statusTekst =
                    "doorgegeven";
                }

                if (
                  status ===
                  "NOG_DOORGEVEN"
                ) {
                  statusTekst =
                    "nog doorgeven";
                }

                if (
                  status === "FOUT"
                ) {
                  statusTekst =
                    "status onbekend";
                }

                if (
                  gesloten &&
                  !isBeheerder
                ) {
                  statusTekst =
                    status ===
                    "DOORGEGEVEN"
                      ? "doorgegeven · gesloten"
                      : "nog doorgeven · gesloten";
                }

                if (
                  gesloten &&
                  isBeheerder
                ) {
                  statusTekst =
                    status ===
                    "DOORGEGEVEN"
                      ? "doorgegeven · eigenaar kan wijzigen"
                      : "nog doorgeven · eigenaar kan wijzigen";
                }

                return (
                  <option
                    key={week.id}
                    value={week.id}
                  >
                    Week{" "}
                    {week.weeknummer}{" "}
                    · {week.jaar}{" "}
                    · {loadingStatussen
                      ? "status laden..."
                      : statusTekst}
                  </option>
                );
              })
            )}
          </select>
        </div>
      </div>

      {weken.length > 0 && (
        <div className="mt-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Beschikbaarheid per week
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Zo zie je direct welke weken
                al zijn doorgegeven.
              </p>
            </div>

            {loadingStatussen && (
              <span className="text-xs text-slate-400">
                Statussen laden...
              </span>
            )}
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {weken.map((week) => {
              const status =
                weekStatussen[
                  week.id
                ];

              const gesloten =
                deadlineVerstreken(
                  week,
                );

              const geselecteerd =
                week.id === weekId;

              let statusLabel =
                "Status laden";

              if (
                status ===
                "DOORGEGEVEN"
              ) {
                statusLabel =
                  "Doorgegeven";
              }

              if (
                status ===
                "NOG_DOORGEVEN"
              ) {
                statusLabel =
                  "Nog doorgeven";
              }

              if (
                status === "FOUT"
              ) {
                statusLabel =
                  "Status onbekend";
              }

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
                    "rounded-xl border p-3 text-left transition",
                    geselecteerd
                      ? "border-slate-900 ring-2 ring-slate-100"
                      : "border-slate-200 hover:border-slate-300",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Week{" "}
                        {week.weeknummer}{" "}
                        · {week.jaar}
                      </p>

                      {week.beschikbaarheidDeadline && (
                        <p className="mt-1 text-xs text-slate-500">
                          Deadline{" "}
                          {formatteerDeadline(
                            week.beschikbaarheidDeadline,
                          )}
                        </p>
                      )}
                    </div>

                    <span
                      className={[
                        "rounded-full px-2 py-1 text-[11px] font-semibold whitespace-nowrap",
                        status ===
                        "DOORGEGEVEN"
                          ? "bg-green-100 text-green-800"
                          : status ===
                              "NOG_DOORGEVEN"
                            ? "bg-red-100 text-red-800"
                            : "bg-slate-100 text-slate-600",
                      ].join(" ")}
                    >
                      {statusLabel}
                    </span>
                  </div>

                  {gesloten && (
                    <p
                      className={[
                        "mt-2 text-xs font-medium",
                        isBeheerder
                          ? "text-blue-700"
                          : "text-red-700",
                      ].join(" ")}
                    >
                      {isBeheerder
                        ? "Eigenaar kan nog wijzigen"
                        : "Deadline verstreken"}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {geselecteerdeWeek && (
        <div className="mt-5">
          {geselecteerdeStatus ===
            "DOORGEGEVEN" &&
          !geselecteerdeDeadlineVerstreken ? (
            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3">
              <p className="text-sm font-semibold text-green-800">
                Beschikbaarheid is
                doorgegeven.
              </p>

              <p className="mt-1 text-xs text-green-700">
                De opgegeven beschikbaarheid
                kan nog worden gewijzigd.
              </p>

              {geselecteerdeWeek.beschikbaarheidDeadline && (
                <p className="mt-1 text-xs text-green-700">
                  Deadline:{" "}
                  {formatteerDeadline(
                    geselecteerdeWeek.beschikbaarheidDeadline,
                  )}
                </p>
              )}
            </div>
          ) : geselecteerdeStatus ===
              "NOG_DOORGEVEN" &&
            !geselecteerdeDeadlineVerstreken ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm font-semibold text-red-800">
                Beschikbaarheid moet nog
                worden doorgegeven.
              </p>

              <p className="mt-1 text-xs text-red-700">
                Voor deze week is nog geen
                beschikbaarheid geregistreerd.
              </p>

              {geselecteerdeWeek.beschikbaarheidDeadline && (
                <p className="mt-1 text-xs text-red-700">
                  Deadline:{" "}
                  {formatteerDeadline(
                    geselecteerdeWeek.beschikbaarheidDeadline,
                  )}
                </p>
              )}
            </div>
          ) : geselecteerdeDeadlineVerstreken &&
            isBeheerder ? (
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
              <p className="text-sm font-semibold text-blue-800">
                Deadline verstreken —
                eigenaar kan nog wijzigen.
              </p>

              <p className="mt-1 text-xs text-blue-700">
                {geselecteerdeStatus ===
                "DOORGEGEVEN"
                  ? "De medewerker heeft beschikbaarheid doorgegeven. Als eigenaar kun je deze nog aanpassen."
                  : "Er is nog geen beschikbaarheid doorgegeven. Als eigenaar kun je deze alsnog invoeren."}
              </p>

              {geselecteerdeWeek.beschikbaarheidDeadline && (
                <p className="mt-1 text-xs text-blue-700">
                  Deadline:{" "}
                  {formatteerDeadline(
                    geselecteerdeWeek.beschikbaarheidDeadline,
                  )}
                </p>
              )}
            </div>
          ) : geselecteerdeDeadlineVerstreken ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm font-semibold text-red-800">
                Beschikbaarheid voor deze
                week is gesloten.
              </p>

              <p className="mt-1 text-xs text-red-700">
                De deadline is verstreken.
              </p>

              {geselecteerdeWeek.beschikbaarheidDeadline && (
                <p className="mt-1 text-xs text-red-700">
                  Deadline:{" "}
                  {formatteerDeadline(
                    geselecteerdeWeek.beschikbaarheidDeadline,
                  )}
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-sm text-slate-600">
                Voor deze week is geen
                beschikbaarheidsdeadline
                ingesteld.
              </p>
            </div>
          )}
        </div>
      )}

      {isBeheerder && (
        <p className="mt-4 text-xs text-slate-500">
          Als eigenaar/beheerder kun je ook
          beschikbaarheid aanpassen nadat
          de deadline is verstreken.
        </p>
      )}

      {error && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      )}
    </div>
  );
}