import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  Phone,
  User,
} from "lucide-react";

import {
  hasPermission,
} from "@/lib/auth";
import {
  permissions,
} from "@/lib/permissions";
import {
  vereisPermission,
} from "@/lib/requirePermission";
import {
  medewerkerService,
} from "@/lib/services/medewerker.service";

import PageLayout from "@/components/ui/PageLayout";
import PageToolbar from "@/components/ui/PageToolbar";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

import MedewerkerForm from "@/modules/medewerkers/beheren/components/MedewerkerForm";
import BeschikbaarheidPanel from "@/components/medewerkers/beschikbaarheid/components/BeschikbaarheidPanel";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    tab?: string;
  }>;
};

const TABS = [
  {
    id: "algemeen",
    label: "Algemeen",
  },
  {
    id: "contract",
    label: "Contract",
  },
  {
    id: "vestigingen",
    label: "Vestigingen",
  },
  {
    id: "beschikbaarheid",
    label: "Beschikbaarheid",
  },
  {
    id: "planning",
    label: "Planning",
  },
  {
    id: "verloning",
    label: "Verloning",
  },
  {
    id: "bewerken",
    label: "Gegevens bewerken",
  },
] as const;

type TabId = (typeof TABS)[number]["id"];

function isTabId(value: string | undefined): value is TabId {
  return TABS.some((tab) => tab.id === value);
}

function formatteerDatum(
  datum: Date | null | undefined,
) {
  if (!datum) {
    return "—";
  }

  return datum.toLocaleDateString("nl-NL");
}

function formatteerNaam(medewerker: {
  voornaam: string;
  tussenvoegsel: string | null;
  achternaam: string;
}) {
  return [
    medewerker.voornaam,
    medewerker.tussenvoegsel,
    medewerker.achternaam,
  ]
    .filter(Boolean)
    .join(" ");
}

export default async function MedewerkerPage({
  params,
  searchParams,
}: PageProps) {
  await vereisPermission(
    permissions.medewerkers.view,
  );

  const { id } = await params;
  const { tab } = await searchParams;

  const medewerker =
    await medewerkerService.getById(id);

  const magBewerken =
    await hasPermission(
      permissions.medewerkers.update,
    );

  const actieveTab: TabId =
    isTabId(tab)
      ? tab
      : "algemeen";

  const volledigeNaam =
    formatteerNaam(medewerker);

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
      medewerker.contractType ?? null,
    contractUren:
      medewerker.contractUren != null
        ? medewerker.contractUren.toString()
        : null,
    uurloon:
      medewerker.uurloon != null
        ? medewerker.uurloon.toString()
        : null,
    datumInDienst:
      medewerker.datumInDienst,
    datumUitDienst:
      medewerker.datumUitDienst,
    tags: medewerker.tags.map(
      (medewerkerTag) => ({
        id: medewerkerTag.tag.id,
        naam: medewerkerTag.tag.naam,
      }),
    ),
  };

  const vestigingen =
    medewerker.vestigingen.map(
      (medewerkerVestiging) => ({
        id: medewerkerVestiging.vestiging.id,
        naam: medewerkerVestiging.vestiging.naam,
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

      <div className="rounded-xl border bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 pt-4">
          <div className="flex gap-1 overflow-x-auto">
            {TABS.map((tabItem) => {
              const actief =
                actieveTab === tabItem.id;

              return (
                <Link
                  key={tabItem.id}
                  href={`/medewerkers/${medewerker.id}?tab=${tabItem.id}`}
                  className={`whitespace-nowrap rounded-t-lg border-b-2 px-4 py-3 text-sm font-medium transition ${
                    actief
                      ? "border-slate-900 text-slate-900"
                      : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
                  }`}
                >
                  {tabItem.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="p-6">
          {actieveTab === "algemeen" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Algemeen
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Algemene gegevens van de medewerker.
                </p>
              </div>

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
                        {medewerker.email ||
                          "Geen e-mailadres"}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <Phone
                        size={18}
                        className="text-slate-400"
                      />

                      <span className="text-sm text-slate-700">
                        {medewerker.telefoon ||
                          "Geen telefoonnummer"}
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

              <Card
                title="Persoonsgegevens"
                description="Persoonlijke gegevens van de medewerker."
              >
                <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
                      Voornaam
                    </dt>

                    <dd className="mt-1 text-sm text-slate-700">
                      {medewerker.voornaam}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Tussenvoegsel
                    </dt>

                    <dd className="mt-1 text-sm text-slate-700">
                      {medewerker.tussenvoegsel ||
                        "—"}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Achternaam
                    </dt>

                    <dd className="mt-1 text-sm text-slate-700">
                      {medewerker.achternaam}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Roepnaam
                    </dt>

                    <dd className="mt-1 text-sm text-slate-700">
                      {medewerker.roepnaam ||
                        "—"}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Geboortedatum
                    </dt>

                    <dd className="mt-1 text-sm text-slate-700">
                      {formatteerDatum(
                        medewerker.geboortedatum,
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Aangemeld op
                    </dt>

                    <dd className="mt-1 text-sm text-slate-700">
                      {formatteerDatum(
                        medewerker.aanmeldingOp,
                      )}
                    </dd>
                  </div>
                </dl>
              </Card>

              <div className="grid gap-6 lg:grid-cols-2">
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
                              medewerkerRol
                                .rol.naam
                            }
                          </Badge>
                        ),
                      )}
                    </div>
                  )}
                </Card>

                <Card
                  title="Planningstags"
                  description="Tags die deze medewerker kan uitvoeren."
                >
                  {medewerker.tags.length ===
                  0 ? (
                    <p className="text-sm text-slate-500">
                      Nog geen planningstags
                      gekoppeld.
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
            </div>
          )}

          {actieveTab === "contract" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Contract
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Gegevens over het dienstverband.
                </p>
              </div>

              <Card
                title="Dienstverband"
                description="Interne gegevens over het contract."
              >
                <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
                      {medewerker.contractUren !=
                      null
                        ? `${medewerker.contractUren} uur`
                        : "Nog niet ingevuld"}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      In dienst
                    </dt>

                    <dd className="mt-1 text-sm text-slate-700">
                      {formatteerDatum(
                        medewerker.datumInDienst,
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Uit dienst
                    </dt>

                    <dd className="mt-1 text-sm text-slate-700">
                      {formatteerDatum(
                        medewerker.datumUitDienst,
                      )}
                    </dd>
                  </div>
                </dl>
              </Card>
            </div>
          )}

          {actieveTab === "vestigingen" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Vestigingen
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Vestigingen waar deze medewerker werkt.
                </p>
              </div>

              <Card
                title="Gekoppelde vestigingen"
                description="Vestigingen waarvoor de medewerker beschikbaar is."
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
                          className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                        >
                          <span className="text-sm font-medium text-slate-700">
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
            </div>
          )}

          {actieveTab === "beschikbaarheid" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Beschikbaarheid
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Beschikbaarheid van deze medewerker per vestiging.
                </p>
              </div>

              <BeschikbaarheidPanel
  medewerkerId={medewerker.id}
  vestigingen={vestigingen}
  isBeheerder={magBewerken}
              />
            </div>
          )}

          {actieveTab === "planning" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Planning
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Overzicht van de planning van deze medewerker.
                </p>
              </div>

              <Card
                title="Planningsoverzicht"
                description="Samenvatting van diensten en beschikbaarheden."
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-2xl font-semibold text-slate-900">
                      {
                        medewerker.diensten
                          .length
                      }
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      Diensten gepland
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-2xl font-semibold text-slate-900">
                      {
                        medewerker
                          .beschikbaarheden
                          .length
                      }
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      Beschikbaarheden
                      geregistreerd
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {actieveTab === "verloning" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Verloning
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Gegevens die relevant zijn voor de verloning.
                </p>
              </div>

              <Card
                title="Verloningsgegevens"
                description="Deze ERP-module verzorgt geen daadwerkelijke salarisverwerking."
              >
                <dl className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Uurloon
                    </dt>

                    <dd className="mt-1 text-sm font-medium text-slate-700">
                      {medewerker.uurloon !=
                      null
                        ? `€ ${Number(
                            medewerker.uurloon,
                          ).toFixed(2)}`
                        : "Nog niet ingevuld"}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Contracturen
                    </dt>

                    <dd className="mt-1 text-sm text-slate-700">
                      {medewerker.contractUren !=
                      null
                        ? `${medewerker.contractUren} uur`
                        : "Nog niet ingevuld"}
                    </dd>
                  </div>
                </dl>

                <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  Clevers ERP registreert deze gegevens
                  voor de planning en interne controle.
                  De daadwerkelijke verloning vindt
                  buiten dit pakket plaats.
                </div>
              </Card>
            </div>
          )}

          {actieveTab === "bewerken" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Gegevens bewerken
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Wijzig de persoonlijke en interne gegevens van deze medewerker.
                </p>
              </div>

              {magBewerken ? (
                <Card
                  title="Medewerkergegevens"
                  description="Wijzig hier de gegevens van de medewerker."
                >
                  <MedewerkerForm
                    medewerker={
                      medewerkerFormData
                    }
                    vestigingId={
                      medewerker
                        .vestigingen[0]
                        ?.vestiging.id ?? ""
                    }
                  />
                </Card>
              ) : (
                <Card
                  title="Geen bewerkrechten"
                  description="Je hebt geen toestemming om deze medewerkergegevens te wijzigen."
                >
                  <p className="text-sm text-slate-500">
                    De gegevens zijn alleen-lezen
                    beschikbaar voor jouw rol.
                  </p>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}