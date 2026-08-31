"use client";

import type { DienstBezetting } from "@/types/planning";

type BezettingOverzichtProps = {
  bezetting: DienstBezetting[];
};

function volledigeNaam(
  medewerker: DienstBezetting["medewerker"],
) {
  if (!medewerker) {
    return null;
  }

  return [
    medewerker.voornaam,
    medewerker.tussenvoegsel,
    medewerker.achternaam,
  ]
    .filter(Boolean)
    .join(" ");
}

function statusKlassen(
  status: DienstBezetting["status"],
) {
  switch (status) {
    case "BEVESTIGD":
    case "GEWERKT":
      return "text-emerald-700";

    case "GEPLAND":
      return "text-amber-700";

    case "AFGEZEGD":
      return "text-slate-400";

    case "OPEN":
    default:
      return "text-red-700";
  }
}

export default function BezettingOverzicht({
  bezetting,
}: BezettingOverzichtProps) {
  const actieveBezetting =
    bezetting.filter(
      (regel) =>
        regel.status !== "AFGEZEGD",
    );

  if (actieveBezetting.length === 0) {
    return (
      <span className="text-[11px] font-medium text-red-700">
        Nog niet ingepland
      </span>
    );
  }

  return (
    <div className="space-y-0.5">
      {actieveBezetting.map(
        (regel) => (
          <div
            key={regel.id}
            className={`text-[11px] font-medium ${statusKlassen(
              regel.status,
            )}`}
          >
            {regel.medewerker
              ? volledigeNaam(
                  regel.medewerker,
                )
              : "Nog niet ingepland"}
          </div>
        ),
      )}
    </div>
  );
}