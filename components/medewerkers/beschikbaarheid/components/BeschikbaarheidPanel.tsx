"use client";

import BeschikbaarheidWeekSelector from "@/components/planning/BeschikbaarheidWeekSelector";

type Vestiging = {
  id: string;
  naam: string;
};

type BeschikbaarheidPanelProps = {
  medewerkerId: string;
  vestigingen: Vestiging[];
  isBeheerder: boolean;
  isEigenMedewerker?: boolean;
  bewerkmodus?: boolean;
};

export default function BeschikbaarheidPanel({
  medewerkerId,
  vestigingen,
  isBeheerder,
  isEigenMedewerker = !isBeheerder,
}: BeschikbaarheidPanelProps) {
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">
          Beschikbaarheid
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Bekijk de planningweken en geef per
          dag je beschikbaarheid door.
        </p>
      </div>

      <BeschikbaarheidWeekSelector
        vestigingen={vestigingen}
        medewerkerId={medewerkerId}
        isBeheerder={isBeheerder}
        isEigenMedewerker={isEigenMedewerker}
        onSelected={() => {
          /*
           * Het weekplanbord wordt volledig
           * binnen BeschikbaarheidWeekSelector
           * beheerd.
           */
        }}
      />
    </section>
  );
}