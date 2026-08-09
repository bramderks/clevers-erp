"use client";

import type { Beschikbaarheid } from "@/types/planning";

type BeschikbaarheidOverzichtProps = {
  beschikbaarheden: Beschikbaarheid[];
};

function formatteerDatum(datum: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(datum));
}

function formatteerTijd(datum: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(datum));
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

export default function BeschikbaarheidOverzicht({
  beschikbaarheden,
}: BeschikbaarheidOverzichtProps) {
  if (beschikbaarheden.length === 0) {
    return (
      <div className="rounded-xl border bg-white p-6">
        <p className="text-sm text-gray-600">
          Er zijn nog geen beschikbaarheden opgegeven.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {beschikbaarheden.map((beschikbaarheid) => (
        <div
          key={beschikbaarheid.id}
          className="rounded-xl border bg-white p-4"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-medium capitalize text-gray-900">
                {formatteerDatum(beschikbaarheid.datum)}
              </p>

              <p className="mt-1 text-sm text-gray-600">
                {formatteerTijd(
                  beschikbaarheid.begintijd,
                )}{" "}
                -{" "}
                {formatteerTijd(
                  beschikbaarheid.eindtijd,
                )}
              </p>
            </div>

            <span className="rounded-full border px-3 py-1 text-xs text-gray-700">
              {statusLabel(beschikbaarheid.status)}
            </span>
          </div>

          {beschikbaarheid.opmerking && (
            <p className="mt-3 border-t pt-3 text-sm text-gray-500">
              {beschikbaarheid.opmerking}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}