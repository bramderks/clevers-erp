import Link from "next/link";
import {
  ArrowLeft,
  FileSpreadsheet,
} from "lucide-react";

import { getCurrentUser } from "@/lib/auth";
import { permissions } from "@/lib/permissions";
import { vereisPermission } from "@/lib/requirePermission";
import { redirect } from "next/navigation";

import PageLayout from "@/components/ui/PageLayout";
import PageToolbar from "@/components/ui/PageToolbar";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

import MedewerkersImportForm from "@/components/medewerkers/MedewerkersImportForm";

export default async function MedewerkersImporterenPage() {
  await vereisPermission(
    permissions.medewerkers.view,
  );

  const gebruiker =
    await getCurrentUser();

  if (!gebruiker) {
    return null;
  }

  const isEigenaar =
    gebruiker.organisaties.some(
      (relatie) =>
        relatie.actief &&
        relatie.organisatie.actief &&
        relatie.rol.naam
          .trim()
          .toLowerCase() ===
          "eigenaar",
    );

  if (!isEigenaar) {
    redirect("/medewerkers");
  }

  return (
    <PageLayout>
      <PageToolbar
        title="Medewerkers importeren"
        actions={
          <Link href="/medewerkers">
            <Button variant="secondary">
              <ArrowLeft size={18} />
              Terug naar medewerkers
            </Button>
          </Link>
        }
      />

      <div className="mx-auto w-full max-w-5xl space-y-6">
        <Card
          title="Medewerkers importeren"
          description="Importeer meerdere medewerkers tegelijk vanuit een Excel- of CSV-bestand."
        >
          <MedewerkersImportForm />
        </Card>

        <Card
          title="Importregels"
          description="Controleer deze punten voordat je het bestand importeert."
        >
          <div className="space-y-4">
            <div className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                1
              </span>

              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Gebruik de juiste kolomnamen
                </p>

                <p className="mt-1 text-sm text-slate-600">
                  Het importbestand moet de
                  afgesproken kolommen voor
                  medewerkers bevatten.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                2
              </span>

              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Verplichte gegevens
                </p>

                <p className="mt-1 text-sm text-slate-600">
                  Personeelsnummer, aanhef,
                  voornaam, tussenvoegsel,
                  achternaam, geboortedatum,
                  e-mailadres, telefoon,
                  vestiging en rol moeten
                  aanwezig zijn.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                3
              </span>

              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Optionele gegevens
                </p>

                <p className="mt-1 text-sm text-slate-600">
                  Roepnaam, contracttype,
                  contracturen, uurloon,
                  datum indienst en datum
                  uitdienst mogen leeg zijn.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                4
              </span>

              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Vestigingen en rollen
                </p>

                <p className="mt-1 text-sm text-slate-600">
                  De opgegeven vestigingen en
                  rollen moeten al binnen de
                  organisatie bestaan.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                5
              </span>

              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Eerst controleren, daarna
                  importeren
                </p>

                <p className="mt-1 text-sm text-slate-600">
                  De volledige import wordt
                  eerst gecontroleerd. Als er
                  fouten worden gevonden, wordt
                  er niets aangemaakt.
                </p>
              </div>
            </div>
          </div>
        </Card>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
              <FileSpreadsheet
                size={20}
                className="text-slate-500"
              />
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-900">
                Ondersteunde bestanden
              </p>

              <p className="mt-1 text-sm text-slate-600">
                Excel-bestanden (.xlsx) en
                CSV-bestanden kunnen worden
                geïmporteerd.
              </p>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}