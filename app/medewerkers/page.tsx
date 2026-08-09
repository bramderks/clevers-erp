import Link from "next/link";
import {
  ArrowRight,
  UserPlus,
  Users,
} from "lucide-react";

import { medewerkerService } from "@/lib/services/medewerker.service";

import PageLayout from "@/components/ui/PageLayout";
import PageToolbar from "@/components/ui/PageToolbar";
import StatCard from "@/components/ui/StatCard";
import Button from "@/components/ui/Button";
import DataGrid from "@/components/ui/DataGrid";
import Badge from "@/components/ui/Badge";

export default async function MedewerkersPage() {
  const medewerkers =
    await medewerkerService.getAll();

  const actieveMedewerkers =
    medewerkers.filter(
      (medewerker) => medewerker.actief,
    ).length;

  return (
    <PageLayout>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Medewerkers"
          value={medewerkers.length}
          subtitle="Totaal"
          icon={<Users size={20} />}
        />

        <StatCard
          title="Actief"
          value={actieveMedewerkers}
          subtitle="Actieve medewerkers"
        />

        <StatCard
          title="Inactief"
          value={
            medewerkers.length -
            actieveMedewerkers
          }
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
          <Link href="/medewerkers/nieuw">
            <Button>
              <UserPlus size={18} />
              Nieuwe medewerker
            </Button>
          </Link>
        }
      />

      <DataGrid
        data={medewerkers}
        columns={[
          {
            key: "voornaam",
            title: "Naam",
            render: (medewerker) => (
              <Link
                href={`/medewerkers/${medewerker.id}`}
                className="group inline-flex items-center gap-2 font-medium text-slate-900 transition hover:text-cyan-700"
              >
                <span>
                  {medewerker.voornaam}{" "}
                  {medewerker.tussenvoegsel
                    ? `${medewerker.tussenvoegsel} `
                    : ""}
                  {medewerker.achternaam}
                </span>

                <ArrowRight
                  size={16}
                  className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-cyan-600"
                />
              </Link>
            ),
          },

          {
            key: "vestigingen",
            title: "Vestiging",
            render: (medewerker) => {
              if (
                medewerker.vestigingen
                  .length === 0
              ) {
                return (
                  <span className="text-sm text-slate-400">
                    Geen vestiging
                  </span>
                );
              }

              return (
                <div className="flex flex-wrap gap-2">
                  {medewerker.vestigingen.map(
                    (medewerkerVestiging) => (
                      <Badge
                        key={
                          medewerkerVestiging.id
                        }
                        variant={
                          medewerkerVestiging.hoofdvestiging
                            ? "success"
                            : "default"
                        }
                      >
                        {
                          medewerkerVestiging
                            .vestiging.naam
                        }
                      </Badge>
                    ),
                  )}
                </div>
              );
            },
          },

          {
            key: "email",
            title: "E-mail",
            render: (medewerker) => (
              <span className="text-sm text-slate-600">
                {medewerker.email}
              </span>
            ),
          },

          {
            key: "telefoon",
            title: "Telefoon",
            render: (medewerker) => (
              <span className="text-sm text-slate-600">
                {medewerker.telefoon}
              </span>
            ),
          },

          {
            key: "rollen",
            title: "Rol",
            render: (medewerker) => {
              if (
                medewerker.rollen.length === 0
              ) {
                return (
                  <span className="text-sm text-slate-400">
                    Geen rol
                  </span>
                );
              }

              return (
                <div className="flex flex-wrap gap-2">
                  {medewerker.rollen.map(
                    (medewerkerRol) => (
                      <Badge
                        key={
                          medewerkerRol.id
                        }
                        variant="default"
                      >
                        {
                          medewerkerRol.rol
                            .naam
                        }
                      </Badge>
                    ),
                  )}
                </div>
              );
            },
          },

          {
            key: "actief",
            title: "Status",
            render: (medewerker) =>
              medewerker.actief ? (
                <Badge variant="success">
                  Actief
                </Badge>
              ) : (
                <Badge variant="danger">
                  Inactief
                </Badge>
              ),
          },

          {
            key: "actie",
            title: "",
            render: (medewerker) => (
              <Link
                href={`/medewerkers/${medewerker.id}`}
                className="inline-flex items-center gap-1 text-sm font-medium text-cyan-700 transition hover:text-cyan-900"
              >
                Bekijken
                <ArrowRight size={15} />
              </Link>
            ),
          },
        ]}
      />
    </PageLayout>
  );
}