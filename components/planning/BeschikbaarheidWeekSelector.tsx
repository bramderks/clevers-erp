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

function deadlineVerstreken(
  week: SelectorWeek,
) {
  if (!week.beschikbaarheidDeadline) {
    return false;
  }

  return (
    new Date() >
    new Date(
      week.beschikbaarheidDeadline,
    )
  );
}

function formatteerDeadline(
  deadline: string,
) {
  return new Intl.DateTimeFormat(
    "nl-NL",
    {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(new Date(deadline));
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

  const [weekId, setWeekId] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    if (!vestigingId) {
      setWeken([]);
      setWeekId("");
      return;
    }

    let actief = true;

    async function laadWeken() {
      setLoading(true);
      setError(null);

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
        } else {
          setWeekId("");
        }
      } catch (error) {
        if (!actief) {
          return;
        }

        setWeken([]);
        setWeekId("");

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

                return (
                  <option
                    key={week.id}
                    value={week.id}
                  >
                    Week{" "}
                    {week.weeknummer}{" "}
                    · {week.jaar}
                    {gesloten
                      ? " · gesloten"
                      : ""}
                  </option>
                );
              })
            )}
          </select>
        </div>
      </div>

      {geselecteerdeWeek && (
        <div className="mt-4">
          {geselecteerdeDeadlineVerstreken &&
          !isBeheerder ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm font-semibold text-red-800">
                Beschikbaarheid voor deze
                week is gesloten.
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
          ) : geselecteerdeWeek.beschikbaarheidDeadline ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="text-sm font-semibold text-emerald-800">
                Beschikbaarheid kan nog
                worden opgegeven.
              </p>

              <p className="mt-1 text-xs text-emerald-700">
                Deadline:{" "}
                {formatteerDeadline(
                  geselecteerdeWeek.beschikbaarheidDeadline,
                )}
              </p>
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
          Als beheerder kun je ook
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