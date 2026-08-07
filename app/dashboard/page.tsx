import { prisma } from "@/lib/prisma";

import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";

export default async function DashboardPage() {
  const [
    gebruikers,
    medewerkers,
    vestigingen,
    producten,
    bestellingen,
  ] = await Promise.all([
    prisma.systeemGebruiker.count(),
    prisma.medewerker.count(),
    prisma.vestiging.count(),
    prisma.product.count(),
    prisma.bestelling.count(),
  ]);

  return (
    <main className="space-y-8">
      <PageHeader
        title="Dashboard"
        subtitle="Welkom in Clevers ERP."
      />

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-5">
        <Card
          title="Vestigingen"
          description="Actieve vestigingen"
        >
          <p className="text-4xl font-bold text-slate-900">
            {vestigingen}
          </p>
        </Card>

        <Card
          title="Systeemgebruikers"
          description="ERP gebruikers"
        >
          <p className="text-4xl font-bold text-slate-900">
            {gebruikers}
          </p>
        </Card>

        <Card
          title="Medewerkers"
          description="Totaal medewerkers"
        >
          <p className="text-4xl font-bold text-slate-900">
            {medewerkers}
          </p>
        </Card>

        <Card
          title="Producten"
          description="Actieve producten"
        >
          <p className="text-4xl font-bold text-slate-900">
            {producten}
          </p>
        </Card>

        <Card
          title="Bestellingen"
          description="Totaal geregistreerd"
        >
          <p className="text-4xl font-bold text-slate-900">
            {bestellingen}
          </p>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card
          title="Systeemstatus"
          description="Controle van de basisomgeving"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span>Database</span>
              <Badge variant="success">Online</Badge>
            </div>

            <div className="flex items-center justify-between">
              <span>Prisma</span>
              <Badge variant="success">Verbonden</Badge>
            </div>

            <div className="flex items-center justify-between">
              <span>Build</span>
              <Badge variant="success">Succesvol</Badge>
            </div>

            <div className="flex items-center justify-between">
              <span>Seed</span>
              <Badge variant="success">Voltooid</Badge>
            </div>
          </div>
        </Card>

        <Card
          title="Projectstatus"
          description="Clevers ERP"
        >
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span>Database</span>
              <strong>100%</strong>
            </div>

            <div className="flex justify-between">
              <span>Authenticatie</span>
              <strong>Start</strong>
            </div>

            <div className="flex justify-between">
              <span>Planning</span>
              <strong>0%</strong>
            </div>

            <div className="flex justify-between">
              <span>Voorraad</span>
              <strong>0%</strong>
            </div>

            <div className="flex justify-between">
              <span>Bestellingen</span>
              <strong>0%</strong>
            </div>
          </div>
        </Card>
      </section>
    </main>
  );
}