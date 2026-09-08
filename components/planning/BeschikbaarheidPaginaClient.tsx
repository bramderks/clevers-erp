"use client";

import BeschikbaarheidWeekSelector from "@/components/planning/BeschikbaarheidWeekSelector";

type Vestiging = {
  id: string;
  naam: string;
};

type BeschikbaarheidPaginaClientProps = {
  medewerkerId: string;
  medewerkerNaam: string;
  vestigingen: Vestiging[];
  isBeheerder: boolean;
  isEigenMedewerker: boolean;
};

export default function BeschikbaarheidPaginaClient({
  medewerkerId,
  medewerkerNaam,
  vestigingen,
  isBeheerder,
  isEigenMedewerker,
}: BeschikbaarheidPaginaClientProps) {
  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Beschikbaarheid
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          {medewerkerNaam}
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Planningweek
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Kies de vestiging en planningweek
            waarvoor je beschikbaarheid wilt
            bekijken of doorgeven.
          </p>
        </div>

        <div className="mt-5">
          <BeschikbaarheidWeekSelector
            vestigingen={vestigingen}
            medewerkerId={medewerkerId}
            isBeheerder={isBeheerder}
            isEigenMedewerker={isEigenMedewerker}
            onSelected={() => {
              /*
               * De geselecteerde week en het
               * weekplanbord worden volledig
               * binnen de selector beheerd.
               */
            }}
          />
        </div>
      </div>
    </main>
  );
}