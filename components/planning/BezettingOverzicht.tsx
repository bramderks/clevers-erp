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

export default function BezettingOverzicht({
  bezetting,
}: BezettingOverzichtProps) {
  if (bezetting.length === 0) {
    return (
      <span className="text-[11px] font-medium text-red-700">
        Nog niet ingepland
      </span>
    );
  }

  return (
    <div className="space-y-0.5">
      {bezetting.map((regel) => (
        <div
          key={regel.id}
          className="text-[11px] font-medium text-gray-700"
        >
          {regel.medewerker
            ? volledigeNaam(
                regel.medewerker,
              )
            : "Nog niet ingepland"}
        </div>
      ))}
    </div>
  );
}