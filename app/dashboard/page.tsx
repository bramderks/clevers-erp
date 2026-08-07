import { prisma } from "@/lib/prisma";

import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import Card from "@/components/ui/Card";

export default async function DashboardPage() {
  const [
    vestigingen,
    gebruikers,
    rollen,
  ] = await Promise.all([
    prisma.vestiging.count(),
    prisma.gebruiker.count(),
    prisma.rol.count(),
  ]);

  return (
    <main>

      <PageHeader
        title="Dashboard"
        subtitle="Welkom bij Clevers ERP"
      />

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">

        <StatCard
          title="Vestigingen"
          value={vestigingen}
        />

        <StatCard
          title="Gebruikers"
          value={gebruikers}
        />

        <StatCard
          title="Rollen"
          value={rollen}
        />

        <StatCard
          title="Medewerkers"
          value={0}
        />

      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">

        <Card>

          <h2 className="mb-4 text-xl font-semibold">
            Systeemstatus
          </h2>

          <div className="space-y-3">

            <div className="flex justify-between">

              <span>Database</span>

              <span className="text-green-600 font-semibold">
                Online
              </span>

            </div>

            <div className="flex justify-between">

              <span>Authenticatie</span>

              <span className="text-green-600 font-semibold">
                Actief
              </span>

            </div>

            <div className="flex justify-between">

              <span>Versie</span>

              <span>1.0</span>

            </div>

          </div>

        </Card>

        <Card>

          <h2 className="mb-4 text-xl font-semibold">
            Vandaag
          </h2>

          <p className="text-slate-500">
            Geen meldingen.
          </p>

        </Card>

      </div>

    </main>
  );
}