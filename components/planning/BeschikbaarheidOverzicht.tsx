"use client";

import type { Beschikbaarheid } from "@/types/planning";

type BeschikbaarheidOverzichtProps = {
  medewerkerId: string;
  beschikbaarheden: Beschikbaarheid[];
  beschikbaarheidDeadline: string | null;
  magWijzigen: boolean;
  magVerwijderen: boolean;
};

function formatteerDatum(
  datum: string,
) {
  return new Intl.DateTimeFormat(
    "nl-NL",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
    },
  ).format(new Date(datum));
}

function formatteerTijd(
  datum: string,
) {
  return new Intl.DateTimeFormat(
    "nl-NL",
    {
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(new Date(datum));
}

function statusLabel(
  status: Beschikbaarheid["status"],
) {
  switch (status) {
    case "BESCHIKBAAR":
      return "Beschikbaar";

    case "NIET_BESCHIKBAAR":
      return "Niet beschikbaar";

    case "VOORKEUR":
      return "Voorkeur";

    default:
      return status;
  }
}

function statusKlassen(
  status: Beschikbaarheid["status"],
) {
  switch (status) {
    case "BESCHIKBAAR":
      return "border-green-200 bg-green-50 text-green-700";

    case "NIET_BESCHIKBAAR":
      return "border-red-200 bg-red-50 text-red-700";

    case "VOORKEUR":
      return "border-amber-200 bg-amber-50 text-amber-700";

    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

export default function BeschikbaarheidOverzicht({
  medewerkerId,
  beschikbaarheden,
  beschikbaarheidDeadline,
  magWijzigen,
  magVerwijderen,
}: BeschikbaarheidOverzichtProps) {
  void medewerkerId;
  void beschikbaarheidDeadline;
  void magWijzigen;
  void magVerwijderen;

  if (beschikbaarheden.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5">
        <p className="text-sm font-semibold text-slate-700">
          Nog geen beschikbaarheid
          opgegeven.
        </p>

        <p className="mt-1 text-sm text-slate-500">
          Voor deze planningweek zijn
          nog geen beschikbaarheidsblokken
          ingevoerd.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {beschikbaarheden.map(
        (beschikbaarheid) => (
          <div
            key={
              beschikbaarheid.id
            }
            className="rounded-xl border border-slate-200 bg-white p-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-semibold capitalize text-slate-900">
                  {formatteerDatum(
                    beschikbaarheid.datum,
                  )}
                </p>

                <p className="mt-1 text-sm text-slate-600">
                  {formatteerTijd(
                    beschikbaarheid.begintijd,
                  )}{" "}
                  -{" "}
                  {formatteerTijd(
                    beschikbaarheid.eindtijd,
                  )}
                </p>
              </div>

              <span
                className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold ${statusKlassen(
                  beschikbaarheid.status,
                )}`}
              >
                {statusLabel(
                  beschikbaarheid.status,
                )}
              </span>
            </div>

            {beschikbaarheid.opmerking && (
              <div className="mt-3 border-t border-slate-200 pt-3">
                <p className="text-sm text-slate-600">
                  {
                    beschikbaarheid.opmerking
                  }
                </p>
              </div>
            )}
          </div>
        ),
      )}
    </div>
  );
}