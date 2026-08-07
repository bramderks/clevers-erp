import { Users, UserPlus } from "lucide-react";

import { medewerkerService } from "@/lib/services/medewerker.service";

import PageLayout from "@/components/ui/PageLayout";
import PageToolbar from "@/components/ui/PageToolbar";
import StatCard from "@/components/ui/StatCard";
import Button from "@/components/ui/Button";
import DataGrid from "@/components/ui/DataGrid";
import Badge from "@/components/ui/Badge";

export default async function MedewerkersPage() {
  const medewerkers = await medewerkerService.getAll();

  const actieveMedewerkers = medewerkers.filter(
    (m) => m.actief,
  ).length;

  return (
    <PageLayout>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Medewerkers"
          value={medewerkers.length}
          subtitle="Totaal"
          icon={<Users size={24} />}
        />

        <StatCard
          title="Actief"
          value={actieveMedewerkers}
          subtitle="Beschikbaar"
        />

        <StatCard
          title="Inactief"
          value={medewerkers.length - actieveMedewerkers}
          subtitle="Niet actief"
        />

        <StatCard
          title="Vestigingen"
          value="2"
          subtitle="Nijmegen / Roermond"
        />
      </div>

<PageToolbar
  title="Medewerkers"
  actions={
    <Button>
      <UserPlus size={18} />
      <span>Nieuwe medewerker</span>
    </Button>
  }
/>

      <DataGrid
        data={medewerkers}
        columns={[
          {
            key: "voornaam",
            title: "Naam",
            render: (m) =>
              `${m.voornaam} ${m.achternaam}`,
          },
          {
            key: "email",
            title: "E-mail",
          },
          {
            key: "telefoon",
            title: "Telefoon",
          },
          {
            key: "actief",
            title: "Status",
            render: (m) =>
              m.actief ? (
                <Badge variant="success">
                  Actief
                </Badge>
              ) : (
                <Badge variant="danger">
                  Inactief
                </Badge>
              ),
          },
        ]}
      />
    </PageLayout>
  );
}