import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  Phone,
  User,
} from "lucide-react";

import { getCurrentUser } from "@/lib/auth";
import { medewerkerService } from "@/lib/services/medewerker.service";

import PageLayout from "@/components/ui/PageLayout";
import PageToolbar from "@/components/ui/PageToolbar";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

import MedewerkerForm from "@/modules/medewerkers/beheren/components/MedewerkerForm";
import BeschikbaarheidPanel from "@/modules/medewerkers/beschikbaarheid/components/BeschikbaarheidPanel";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function MedewerkerPage({
  params,
}: PageProps) {
  const { id } = await params;

  const medewerker =
    await medewerkerService.getById(id);

  const huidigeGebruiker =
    await getCurrentUser();

  const isEigenaar =
    huidigeGebruiker?.rollen.some(
      (gebruikerRol) =>
        gebruikerRol.rol.naam.toLowerCase() ===
        "eigenaar",
    ) ?? false;

  const volledigeNaam = [
    medewerker.voornaam,
    medewerker.tussenvoegsel,
    medewerker.achternaam,
  ]
    .filter(Boolean)
    .join(" ");

  const medewerkerFormData = {
    id: medewerker.id,
    personeelsnummer:
      medewerker.personeelsnummer,
    aanhef: medewerker.aanhef,
    voornaam: medewerker.voornaam,
    tussenvoegsel:
      medewerker.tussenvoegsel,
    achternaam: medewerker.achternaam,
    roepnaam: medewerker.roepnaam,
    geboortedatum:
      medewerker.geboortedatum,
    email: medewerker.email,
    telefoon: medewerker.telefoon,
    contractType:
      medewerker.contractType,
    contractUren:
      medewerker.contractUren === null
        ? null
        : medewerker.contractUren.toString(),
    datumInDienst:
      medewerker.datumInDienst,
    datumUitDienst:
      medewerker.datumUitDienst,
  };

  const vestigingen =
    medewerker.vestigingen.map(
      (medewerkerVestiging) => ({
        id: medewerkerVestiging
          .vestiging.id,
        naam: medewerkerVestiging
          .vestiging.naam,
      }),
    );

  return (
    <PageLayout>
      <PageToolbar
        title={volledigeNaam}
        actions={
          <Link href="/medewerkers">
            <Button>
              <ArrowLeft size={18} />
              Terug naar medewerkers
            </Button>
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card
          title="Status"
          description="Huidige status van de medewerker."
        >
          <div className="flex items-center gap-3">
            {medewerker.actief ? (
              <Badge variant="success">
                Actief
              </Badge>
            ) : (
              <Badge variant="danger">
                Niet actief
              </Badge>
            )}

            <span className="text-sm text-slate-500">
              {medewerker.status.naam}
            </span>
          </div>
        </Card>

        <Card
          title="Contact"
          description="Contactgegevens van de medewerker."
        >
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Mail
                size={18}
                className="text-slate-400"
              />

              <span className="text-sm text-slate-700">
                {medewerker.email}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <Phone
                size={18}
                className="text-slate-400"
              />

              <span className="text-sm text-slate-700">
                {medewerker.telefoon}
              </span>
            </div>
          </div>
        </Card>

        <Card
          title="Personeelsnummer"
          description="Interne identificatie."
        >
          <div className="flex items-center gap-3">
            <User
              size={18}
              className="text-slate-400"
            />

            <span className="text-sm font-medium text-slate-700">
              {medewerker.personeelsnummer ??
                "Nog niet toegewezen"}
            </span>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          title="Persoonsgegevens"
          description="Persoonlijke gegevens van de medewerker."
        >
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Aanhef
              </dt>

              <dd className="mt-1 text-sm text-slate-700">
                {medewerker.aanhef}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Roepnaam
              </dt>

              <dd className="mt-1 text-sm text-slate-700">
                {medewerker.roepnaam ?? "—"}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Geboortedatum
              </dt>

              <dd className="mt-1 text-sm text-slate-700">
                {medewerker.geboortedatum.toLocaleDateString(
                  "nl-NL",
                )}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Aangemeld op
              </dt>

              <dd className="mt-1 text-sm text-slate-700">
                {medewerker.aanmeldingOp.toLocaleDateString(
                  "nl-NL",
                )}
              </dd>
            </div>
          </dl>
        </Card>

        <Card
          title="Dienstverband"
          description="Interne gegevens over het dienstverband."
        >
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Contracttype
              </dt>

              <dd className="mt-1 text-sm text-slate-700">
                {medewerker.contractType ??
                  "Nog niet ingevuld"}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Contracturen
              </dt>

              <dd className="mt-1 text-sm text-slate-700">
                {medewerker.contractUren
                  ? `${medewerker.contractUren} uur`
                  : "Nog niet ingevuld"}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                In dienst
              </dt>

              <dd className="mt-1 text-sm text-slate-700">
                {medewerker.datumInDienst
                  ? medewerker.datumInDienst.toLocaleDateString(
                      "nl-NL",
                    )
                  : "Nog niet ingevuld"}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Uit dienst
              </dt>

              <dd className="mt-1 text-sm text-slate-700">
                {medewerker.datumUitDienst
                  ? medewerker.datumUitDienst.toLocaleDateString(
                      "nl-NL",
                    )
                  : "—"}
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card
          title="Vestigingen"
          description="Vestigingen waar de medewerker werkt."
        >
          {medewerker.vestigingen.length ===
          0 ? (
            <p className="text-sm text-slate-500">
              Nog geen vestiging gekoppeld.
            </p>
          ) : (
            <div className="space-y-3">
              {medewerker.vestigingen.map(
                (medewerkerVestiging) => (
                  <div
                    key={
                      medewerkerVestiging.id
                    }
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm text-slate-700">
                      {
                        medewerkerVestiging
                          .vestiging.naam
                      }
                    </span>

                    {medewerkerVestiging.hoofdvestiging && (
                      <Badge variant="success">
                        Hoofdvestiging
                      </Badge>
                    )}
                  </div>
                ),
              )}
            </div>
          )}
        </Card>

        <Card
          title="Rollen"
          description="Rollen van de medewerker."
        >
          {medewerker.rollen.length ===
          0 ? (
            <p className="text-sm text-slate-500">
              Nog geen rollen gekoppeld.
            </p>
          ) : (
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
          )}
        </Card>

        <Card
          title="Tags"
          description="Kenmerken voor onder andere de planning."
        >
          {medewerker.tags.length ===
          0 ? (
            <p className="text-sm text-slate-500">
              Nog geen tags gekoppeld.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {medewerker.tags.map(
                (medewerkerTag) => (
                  <Badge
                    key={
                      medewerkerTag.id
                    }
                    variant="default"
                  >
                    {
                      medewerkerTag.tag
                        .naam
                    }
                  </Badge>
                ),
              )}
            </div>
          )}
        </Card>
      </div>

      <BeschikbaarheidPanel
        medewerkerId={medewerker.id}
        vestigingen={vestigingen}
        isEigenaar={isEigenaar}
      />

      <Card
        title="Planning"
        description="Ingeplande diensten van deze medewerker."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-2xl font-semibold text-slate-900">
              {medewerker.diensten.length}
            </p>

            <p className="text-sm text-slate-500">
              Diensten gepland
            </p>
          </div>

          <div>
            <p className="text-2xl font-semibold text-slate-900">
              {
                medewerker
                  .beschikbaarheden
                  .length
              }
            </p>

            <p className="text-sm text-slate-500">
              Beschikbaarheden geregistreerd
            </p>
          </div>
        </div>
      </Card>

      <Card
        title="Gegevens bewerken"
        description="Wijzig de persoonlijke en interne gegevens van deze medewerker."
      >
        <MedewerkerForm
          medewerker={medewerkerFormData}
        />
      </Card>
    </PageLayout>
  );
}