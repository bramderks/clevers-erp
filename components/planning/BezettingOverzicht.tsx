"use client";

import type { DienstBezetting } from "@/types/planning";

type BezettingOverzichtProps = {
  bezetting: DienstBezetting[];
};

function naamMedewerker(
  medewerker: DienstBezetting["medewerker"],
) {
  if (!medewerker) {
    return "Open plek";
  }

  return [
    medewerker.voornaam,
    medewerker.tussenvoegsel,
    medewerker.achternaam,
  ]
    .filter(Boolean)
    .join(" ");
}

function statusLabel(
  status: DienstBezetting["status"],
) {
  switch (status) {
    case "OPEN":
      return "Open";
    case "GEPLAND":
      return "Gepland";
    case "BEVESTIGD":
      return "Bevestigd";
    case "AFGEZEGD":
      return "Afgezegd";
    case "GEWERKT":
      return "Gewerkt";
    default:
      return status;
  }
}

export default function BezettingOverzicht({
  bezetting,
}: BezettingOverzichtProps) {
  if (bezetting.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
        <p className="text-sm text-gray-500">
          Er zijn nog geen medewerkers ingepland.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {bezetting.map((item) => (
        <div
          key={item.id}
          className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 p-3"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900">
              {naamMedewerker(item.medewerker)}
            </p>

            {item.medewerker?.personeelsnummer && (
              <p className="mt-1 text-xs text-gray-500">
                {item.medewerker.personeelsnummer}
              </p>
            )}
          </div>

          <span className="shrink-0 rounded-full border px-3 py-1 text-xs text-gray-700">
            {statusLabel(item.status)}
          </span>
        </div>
      ))}
    </div>
  );
}