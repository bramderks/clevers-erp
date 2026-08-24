import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  Phone,
  User,
  Pencil,
} from "lucide-react";

import { prisma } from "@/lib/prisma";
import {
  getCurrentUser,
} from "@/lib/auth";
import { permissions } from "@/lib/permissions";
import { vereisPermission } from "@/lib/requirePermission";
import { medewerkerService } from "@/lib/services/medewerker.service";

import PageLayout from "@/components/ui/PageLayout";
import PageToolbar from "@/components/ui/PageToolbar";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

import MedewerkerTabBewerken from "@/components/medewerkers/MedewerkerTabBewerken";
import BeschikbaarheidPanel from "@/components/medewerkers/beschikbaarheid/components/BeschikbaarheidPanel";

type PageProps = {
  params: Promise<{
    id: string;
  }>;

  searchParams: Promise<{
    tab?: string;
    edit?: string;
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
    id: "vakantie",
    label: "Vakantie",
  },
  {
    id: "planning",
    label: "Planning",
  },
  {
    id: "verloning",
    label: "Verloning",
  },
] as const;

type TabId =
  (typeof TABS)[number]["id"];

type EditSection =
  | "algemeen"
  | "contract"
  | "vestigingen"
  | "beschikbaarheid"
  | "verloning";

type MaandOverzicht = {
  maand: number;
  naam: string;
  dagen: number;
  uren: number;
};

function isTabId(
  value: string | undefined,
): value is TabId {
  return (
    value !== undefined &&
    TABS.some(
      (tab) => tab.id === value,
    )
  );
}

function getEditSection(
  tab: TabId,
): EditSection | null {
  switch (tab) {
    case "algemeen":
      return "algemeen";

    case "contract":
      return "contract";

    case "vestigingen":
      return "vestigingen";

    case "beschikbaarheid":
      return "beschikbaarheid";

    case "verloning":
      return "verloning";

    case "vakantie":
    case "planning":
      return null;

    default:
      return null;
  }
}

function getMagTabBewerken(
  tab: TabId,
  rechten: {
    magAlgemeenBewerken: boolean;
    magContractBewerken: boolean;
    magVestigingenBewerken: boolean;
    magBeschikbaarheidBewerken: boolean;
    magVerloningBewerken: boolean;
  },
) {
  switch (tab) {
    case "algemeen":
      return rechten.magAlgemeenBewerken;

    case "contract":
      return rechten.magContractBewerken;

    case "vestigingen":
      return rechten.magVestigingenBewerken;

    case "beschikbaarheid":
      return rechten.magBeschikbaarheidBewerken;

    case "verloning":
      return rechten.magVerloningBewerken;

    case "vakantie":
    case "planning":
      return false;

    default:
      return false;
  }
}

function formatteerDatum(
  datum: Date | null | undefined,
) {
  if (!datum) {
    return "—";
  }

  return datum.toLocaleDateString(
    "nl-NL",
  );
}

function formatteerDatumTijd(
  datum: Date | null | undefined,
) {
  if (!datum) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "nl-NL",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(datum);
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

function WijzigenKnop({
  href,
  disabled,
}: {
  href: string;
  disabled?: boolean;
}) {
  if (disabled) {
    return null;
  }

  return (
    <Link href={href}>
      <Button>
        <Pencil size={16} />
        Wijzigen
      </Button>
    </Link>
  );
}

function AnnuleerBewerkenKnop({
  href,
}: {
  href: string;
}) {
  return (
    <Link href={href}>
      <Button variant="secondary">
        Annuleren
      </Button>
    </Link>
  );
}

function maakMaandOverzicht(
  jaar: number,
  urenregistraties: {
    datum: Date;
    gewerkteUren: unknown;
  }[],
): MaandOverzicht[] {
  const maanden = [
    "Januari",
    "Februari",
    "Maart",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Augustus",
    "September",
    "Oktober",
    "November",
    "December",
  ];

  const overzicht =
    maanden.map(
      (naam, index) => ({
        maand: index + 1,
        naam,
        dagen: 0,
        uren: 0,
      }),
    );

  const gewerkteDagenPerMaand =
    new Map<
      number,
      Set<string>
    >();

  for (
    let maand = 1;
    maand <= 12;
    maand++
  ) {
    gewerkteDagenPerMaand.set(
      maand,
      new Set<string>(),
    );
  }

  for (const registratie of urenregistraties) {
    const datum =
      new Date(registratie.datum);

    if (
      datum.getFullYear() !== jaar
    ) {
      continue;
    }

    const maand =
      datum.getMonth() + 1;

    const datumKey =
      datum.toISOString().slice(0, 10);

    gewerkteDagenPerMaand
      .get(maand)
      ?.add(datumKey);

    const uren =
      Number(registratie.gewerkteUren);

    if (Number.isFinite(uren)) {
      overzicht[maand - 1].uren +=
        uren;
    }
  }

  for (const item of overzicht) {
    item.dagen =
      gewerkteDagenPerMaand
        .get(item.maand)?.size ?? 0;

    item.uren =
      Math.round(
        item.uren * 100,
      ) / 100;
  }

  return overzicht;
}

function formatteerUren(
  uren: number,
) {
  return Number.isInteger(uren)
    ? `${uren} uur`
    : `${uren
        .toFixed(2)
        .replace(".", ",")} uur`;
}

function vakantieStatusVariant(
  status: string,
) {
  switch (status) {
    case "GOEDGEKEURD":
      return "success" as const;

    case "AFGEWEZEN":
      return "danger" as const;

    case "GEANNULEERD":
      return "default" as const;

    default:
      return "warning" as const;
  }
}

function vakantieStatusLabel(
  status: string,
) {
  switch (status) {
    case "GOEDGEKEURD":
      return "Goedgekeurd";

    case "AFGEWEZEN":
      return "Afgewezen";

    case "GEANNULEERD":
      return "Geannuleerd";

    case "AANGEVRAAGD":
      return "Aangevraagd";

    default:
      return status;
  }
}

export default async function MedewerkerPage({
  params,
  searchParams,
}: PageProps) {
  await vereisPermission(
    permissions.medewerkers.view,
  );

  const { id } = await params;

  const {
    tab,
    edit,
  } = await searchParams;

  const medewerker =
    await medewerkerService.getById(id);

  const gebruiker =
    await getCurrentUser();

  /*
   * ============================================================
   * ROL
   * ============================================================
   *
   * De Eigenaar is organisatiebreed en dus niet gekoppeld
   * aan één specifieke vestiging.
   */

  const isEigenaar =
    gebruiker?.organisaties.some(
      (relatie) =>
        relatie.actief &&
        relatie.organisatie.actief &&
        relatie.rol.naam
          .trim()
          .toLowerCase() ===
          "eigenaar",
    ) ?? false;

  /*
   * ============================================================
   * RECHTEN
   * ============================================================
   *
   * Eigenaar:
   * - volledige beheerrechten
   *
   * Teamleider:
   * - profiel bekijken
   * - geen beheer van contract, vestigingen,
   *   verloning of andere beheergegevens
   *
   * Medewerker:
   * - profiel bekijken
   * - eigen persoonlijke gegevens kunnen via de daarvoor
   *   bestemde eigen-profiel-flow worden gewijzigd
   *
   * Deze pagina geeft geen algemene beheerrechten aan een
   * Teamleider of medewerker op basis van een brede
   * medewerkers.update permission.
   */

  const magAlgemeenBewerken =
    isEigenaar;

  const magContractBewerken =
    isEigenaar;

  const magVestigingenBewerken =
    isEigenaar;

  const magBeschikbaarheidBewerken =
    isEigenaar;

  const magVerloningBewerken =
    isEigenaar;

  const magTabBewerken =
    getMagTabBewerken(
      isTabId(tab)
        ? tab
        : "algemeen",
      {
        magAlgemeenBewerken,
        magContractBewerken,
        magVestigingenBewerken,
        magBeschikbaarheidBewerken,
        magVerloningBewerken,
      },
    );

  const actieveTab: TabId =
    isTabId(tab)
      ? tab
      : "algemeen";

  const editSection =
    getEditSection(
      actieveTab,
    );

  const isBewerken =
    edit === "1" &&
    magTabBewerken &&
    editSection !== null;

  const volledigeNaam =
    formatteerNaam(
      medewerker,
    );

  /*
   * ============================================================
   * FORMULIERDATA
   * ============================================================
   */

  const medewerkerFormData = {
    id: medewerker.id,

    personeelsnummer:
      medewerker.personeelsnummer,

    aanhef:
      medewerker.aanhef,

    voornaam:
      medewerker.voornaam,

    tussenvoegsel:
      medewerker.tussenvoegsel,

    achternaam:
      medewerker.achternaam,

    roepnaam:
      medewerker.roepnaam,

    geboortedatum:
      medewerker.geboortedatum,

    email:
      medewerker.email,

    telefoon:
      medewerker.telefoon,

    contractType:
      medewerker.contractType ??
      null,

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

    vestigingen:
      medewerker.vestigingen.map(
        (medewerkerVestiging) => ({
          id:
            medewerkerVestiging
              .vestiging.id,

          naam:
            medewerkerVestiging
              .vestiging.naam,
        }),
      ),

    hoofdvestigingId:
      medewerker.vestigingen.find(
        (medewerkerVestiging) =>
          medewerkerVestiging.hoofdvestiging,
      )?.vestiging.id ?? null,
  };

  const vestigingen =
    medewerker.vestigingen.map(
      (medewerkerVestiging) => ({
        id:
          medewerkerVestiging
            .vestiging.id,

        naam:
          medewerkerVestiging
            .vestiging.naam,
      }),
    );

  /*
   * ============================================================
   * VAKANTIE
   * ============================================================
   */

  const vakantieAanvragen =
    await prisma.vakantieAanvraag.findMany(
      {
        where: {
          medewerkerId:
            medewerker.id,
        },

        orderBy: [
          {
            startDatum: "asc",
          },
          {
            aangevraagdOp: "desc",
          },
        ],

        select: {
          id: true,
          startDatum: true,
          eindDatum: true,
          type: true,
          opmerking: true,
          status: true,
          redenAfwijzing: true,
          aangevraagdOp: true,
          beoordeeldOp: true,
        },
      },
    );

  /*
   * ============================================================
   * AANKOMENDE DIENSTEN
   * ============================================================
   */

  const vandaag =
    new Date();

  vandaag.setHours(
    0,
    0,
    0,
    0,
  );

  const aankomendeDiensten =
    medewerker.diensten
      .filter(
        (bezetting) => {
          const datum =
            new Date(
              bezetting.dienst.datum,
            );

          datum.setHours(
            0,
            0,
            0,
            0,
          );

          return datum >= vandaag;
        },
      )
      .slice(0, 50);

  /*
   * ============================================================
   * VERLONING
   * ============================================================
   *
   * Alleen de Eigenaar mag verloningsgegevens zien.
   *
   * Daarom worden de urenregistraties alleen opgehaald wanneer
   * de gebruiker daadwerkelijk Eigenaar is.
   */

  const huidigJaar =
    new Date().getFullYear();

  const definitieveUren =
    isEigenaar
      ? await prisma.urenRegistratie.findMany(
          {
            where: {
              medewerkerId:
                medewerker.id,

              status: "DEFINITIEF",

              datum: {
                gte: new Date(
                  `${huidigJaar}-01-01T00:00:00`,
                ),

                lt: new Date(
                  `${huidigJaar + 1}-01-01T00:00:00`,
                ),
              },
            },

            select: {
              datum: true,
              gewerkteUren: true,
            },

            orderBy: {
              datum: "asc",
            },
          },
        )
      : [];

  const maandOverzicht =
    isEigenaar
      ? maakMaandOverzicht(
          huidigJaar,
          definitieveUren,
        )
      : [];

  const totaalDagen =
    maandOverzicht.reduce(
      (totaal, maand) =>
        totaal + maand.dagen,
      0,
    );

  const totaalUren =
    maandOverzicht.reduce(
      (totaal, maand) =>
        totaal + maand.uren,
      0,
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

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 pt-4">
          <div className="flex gap-1 overflow-x-auto">
            {TABS.map(
              (tabItem) => {
                const actief =
                  actieveTab ===
                  tabItem.id;

                return (
                  <Link
                    key={
                      tabItem.id
                    }
                    href={`/medewerkers/${medewerker.id}?tab=${tabItem.id}`}
                    className={`whitespace-nowrap rounded-t-lg border-b-2 px-4 py-3 text-sm font-medium transition ${
                      actief
                        ? "border-slate-900 text-slate-900"
                        : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
                    }`}
                  >
                    {
                      tabItem.label
                    }
                  </Link>
                );
              },
            )}
          </div>
        </div>

        <div className="p-6">
          {/* =====================================================
              ALGEMEEN
              ===================================================== */}

          {actieveTab ===
            "algemeen" && (
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Algemeen
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Algemene gegevens van de medewerker.
                  </p>
                </div>

                {!isBewerken && (
                  <WijzigenKnop
                    href={`/medewerkers/${medewerker.id}?tab=algemeen&edit=1`}
                    disabled={
                      !magAlgemeenBewerken
                    }
                  />
                )}
              </div>

              {isBewerken &&
              editSection ===
                "algemeen" ? (
                <Card
                  title="Algemene gegevens wijzigen"
                  description="Wijzig de persoonlijke en contactgegevens van deze medewerker."
                >
                  <MedewerkerTabBewerken
                    medewerker={
                      medewerkerFormData
                    }
                    section="algemeen"
                  />
                </Card>
              ) : (
                <>
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
                          {
                            medewerker
                              .status
                              .naam
                          }
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
                            {
                              medewerker.email
                            }
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <Phone
                            size={18}
                            className="text-slate-400"
                          />

                          <span className="text-sm text-slate-700">
                            {
                              medewerker.telefoon
                            }
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
                          {
                            medewerker.aanhef
                          }
                        </dd>
                      </div>

                      <div>
                        <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                          Voornaam
                        </dt>

                        <dd className="mt-1 text-sm text-slate-700">
                          {
                            medewerker.voornaam
                          }
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
                          {
                            medewerker.achternaam
                          }
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
                    </dl>
                  </Card>

                  {isEigenaar && (
                    <div className="grid gap-6 lg:grid-cols-2">
                      <Card
                        title="Rollen"
                        description="Rollen van de medewerker."
                      >
                        {medewerker.rollen
                          .length === 0 ? (
                          <p className="text-sm text-slate-500">
                            Nog geen rollen gekoppeld.
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {medewerker.rollen.map(
                              (
                                medewerkerRol,
                              ) => (
                                <Badge
                                  key={
                                    medewerkerRol.id
                                  }
                                  variant="default"
                                >
                                  {
                                    medewerkerRol
                                      .rol
                                      .naam
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
                        {medewerker.tags
                          .length === 0 ? (
                          <p className="text-sm text-slate-500">
                            Nog geen planningstags gekoppeld.
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {medewerker.tags.map(
                              (
                                medewerkerTag,
                              ) => (
                                <Badge
                                  key={
                                    medewerkerTag.id
                                  }
                                  variant="default"
                                >
                                  {
                                    medewerkerTag
                                      .tag
                                      .naam
                                  }
                                </Badge>
                              ),
                            )}
                          </div>
                        )}
                      </Card>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* =====================================================
              CONTRACT
              ===================================================== */}

          {actieveTab ===
            "contract" && (
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Contract
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Gegevens over het dienstverband.
                  </p>
                </div>

                {!isBewerken && (
                  <WijzigenKnop
                    href={`/medewerkers/${medewerker.id}?tab=contract&edit=1`}
                    disabled={
                      !magContractBewerken
                    }
                  />
                )}
              </div>

              <Card
                title="Dienstverband"
                description="Gegevens van het huidige dienstverband."
              >
                <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
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

              {isBewerken &&
                editSection ===
                  "contract" && (
                  <Card
                    title="Contractgegevens wijzigen"
                    description="Wijzig de gegevens van het dienstverband."
                  >
                    <MedewerkerTabBewerken
                      medewerker={
                        medewerkerFormData
                      }
                      section="contract"
                    />
                  </Card>
                )}
            </div>
          )}

          {/* =====================================================
              VESTIGINGEN
              ===================================================== */}

          {actieveTab ===
            "vestigingen" && (
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Vestigingen
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Vestigingen waar deze medewerker werkt.
                  </p>
                </div>

                {!isBewerken && (
                  <WijzigenKnop
                    href={`/medewerkers/${medewerker.id}?tab=vestigingen&edit=1`}
                    disabled={
                      !magVestigingenBewerken
                    }
                  />
                )}
              </div>

              <Card
                title="Gekoppelde vestigingen"
                description="Vestigingen waarvoor de medewerker is gekoppeld."
              >
                {medewerker.vestigingen
                  .length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Nog geen vestiging gekoppeld.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {medewerker.vestigingen.map(
                      (
                        medewerkerVestiging,
                      ) => (
                        <div
                          key={
                            medewerkerVestiging.id
                          }
                          className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                        >
                          <span className="text-sm font-medium text-slate-700">
                            {
                              medewerkerVestiging
                                .vestiging
                                .naam
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

              {isBewerken &&
                editSection ===
                  "vestigingen" && (
                  <Card
                    title="Vestigingen wijzigen"
                    description="Wijzig de vestigingen waar deze medewerker werkt en stel de hoofdvestiging in."
                  >
                    <MedewerkerTabBewerken
                      medewerker={
                        medewerkerFormData
                      }
                      section="vestigingen"
                    />
                  </Card>
                )}
            </div>
          )}

          {/* =====================================================
              BESCHIKBAARHEID
              ===================================================== */}

          {actieveTab ===
            "beschikbaarheid" && (
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Beschikbaarheid
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Alleen de huidige en toekomstige weken worden getoond. Verleden weken zijn niet meer relevant voor de planning.
                  </p>
                </div>

                {!isBewerken &&
                  magBeschikbaarheidBewerken && (
                    <WijzigenKnop
                      href={`/medewerkers/${medewerker.id}?tab=beschikbaarheid&edit=1`}
                    />
                  )}

                {isBewerken && (
                  <AnnuleerBewerkenKnop
                    href={`/medewerkers/${medewerker.id}?tab=beschikbaarheid`}
                  />
                )}
              </div>

              <BeschikbaarheidPanel
                medewerkerId={
                  medewerker.id
                }
                vestigingen={
                  vestigingen
                }
                isBeheerder={
                  magBeschikbaarheidBewerken
                }
                bewerkmodus={
                  isBewerken
                }
              />
            </div>
          )}

          {/* =====================================================
              VAKANTIE
              ===================================================== */}

          {actieveTab ===
            "vakantie" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Vakantie
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Vakantie en andere geplande afwezigheid van deze medewerker.
                </p>
              </div>

              <Card
                title="Vakantieaanvragen"
                description="Aanvragen worden door de eigenaar beoordeeld. De status van iedere aanvraag blijft zichtbaar."
              >
                {vakantieAanvragen.length ===
                0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-center">
                    <p className="text-sm font-semibold text-slate-700">
                      Geen vakantieaanvragen
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      Er zijn nog geen vakantie- of afwezigheidsaanvragen geregistreerd.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {vakantieAanvragen.map(
                      (aanvraag) => (
                        <div
                          key={
                            aanvraag.id
                          }
                          className="rounded-xl border border-slate-200 bg-white p-4"
                        >
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold text-slate-900">
                                  {formatteerDatum(
                                    aanvraag.startDatum,
                                  )}{" "}
                                  t/m{" "}
                                  {formatteerDatum(
                                    aanvraag.eindDatum,
                                  )}
                                </p>

                                <Badge variant="default">
                                  {aanvraag.type ===
                                  "VAKANTIE"
                                    ? "Vakantie"
                                    : "Overig"}
                                </Badge>
                              </div>

                              {aanvraag.opmerking && (
                                <p className="mt-2 text-sm text-slate-600">
                                  {
                                    aanvraag.opmerking
                                  }
                                </p>
                              )}

                              {aanvraag.status ===
                                "AFGEWEZEN" &&
                                aanvraag.redenAfwijzing && (
                                  <div className="mt-3 rounded-lg bg-red-50 px-3 py-2">
                                    <p className="text-xs font-medium text-red-700">
                                      Reden afwijzing
                                    </p>

                                    <p className="mt-1 text-sm text-red-800">
                                      {
                                        aanvraag.redenAfwijzing
                                      }
                                    </p>
                                  </div>
                                )}

                              <p className="mt-3 text-xs text-slate-400">
                                Aangevraagd op{" "}
                                {formatteerDatum(
                                  aanvraag.aangevraagdOp,
                                )}
                              </p>
                            </div>

                            <Badge
                              variant={vakantieStatusVariant(
                                aanvraag.status,
                              )}
                            >
                              {vakantieStatusLabel(
                                aanvraag.status,
                              )}
                            </Badge>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* =====================================================
              PLANNING
              ===================================================== */}

          {actieveTab ===
            "planning" && (
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Planning
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Alleen huidige en toekomstige diensten van deze medewerker.
                  </p>
                </div>

                <Link href="/planning">
                  <Button>
                    Naar planning
                  </Button>
                </Link>
              </div>

              <Card
                title="Aankomende diensten"
                description="Alle nog plaats te vinden diensten waarop deze medewerker staat ingepland."
              >
                {aankomendeDiensten.length ===
                0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-center">
                    <p className="text-sm font-semibold text-slate-700">
                      Geen aankomende diensten
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      Deze medewerker staat momenteel niet op een toekomstige dienst.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {aankomendeDiensten.map(
                      (bezetting) => {
                        const dienst =
                          bezetting.dienst;

                        const datum =
                          new Date(
                            dienst.datum,
                          );

                        const beginTijd =
                          new Intl.DateTimeFormat(
                            "nl-NL",
                            {
                              hour: "2-digit",
                              minute:
                                "2-digit",
                            },
                          ).format(
                            new Date(
                              dienst.begintijd,
                            ),
                          );

                        const eindTijd =
                          new Intl.DateTimeFormat(
                            "nl-NL",
                            {
                              hour: "2-digit",
                              minute:
                                "2-digit",
                            },
                          ).format(
                            new Date(
                              dienst.eindtijd,
                            ),
                          );

                        return (
                          <div
                            key={
                              bezetting.id
                            }
                            className="rounded-xl border border-slate-200 bg-white p-4"
                          >
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                              <div>
                                <p className="text-sm font-semibold capitalize text-slate-900">
                                  {formatteerDatumTijd(
                                    datum,
                                  )}
                                </p>

                                <p className="mt-1 text-sm text-slate-600">
                                  {beginTijd}{" "}
                                  -{" "}
                                  {eindTijd}
                                </p>

                                <p className="mt-1 text-sm text-slate-600">
                                  {dienst.tags
                                    ?.map(
                                      (
                                        dienstTag,
                                      ) =>
                                        dienstTag
                                          .tag
                                          .naam,
                                    )
                                    .join(
                                      " · ",
                                    ) ||
                                    "Geen planningstag"}
                                </p>

                                {dienst.opmerkingen && (
                                  <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2">
                                    <p className="text-xs font-medium text-slate-500">
                                      Opmerking
                                    </p>

                                    <p className="mt-1 text-sm text-slate-700">
                                      {
                                        dienst.opmerkingen
                                      }
                                    </p>
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-3">
                                <span className="rounded-lg bg-green-50 px-3 py-2 text-xs font-semibold text-green-700">
                                  {
                                    bezetting.status
                                  }
                                </span>

                                {isEigenaar && (
                                  <Link
                                    href={`/planning?dienstId=${dienst.id}`}
                                  >
                                    <Button>
                                      <Pencil
                                        size={
                                          15
                                        }
                                      />
                                      Dienst wijzigen
                                    </Button>
                                  </Link>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* =====================================================
              VERLONING
              ===================================================== */}

          {actieveTab ===
            "verloning" && (
            <div className="space-y-6">
              {!isEigenaar ? (
                <Card
                  title="Verloning"
                  description="Verloningsgegevens zijn alleen beschikbaar voor de eigenaar."
                >
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-6">
                    <p className="text-sm text-slate-600">
                      Je hebt geen toegang tot de verloningsgegevens van deze medewerker.
                    </p>
                  </div>
                </Card>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">
                        Verloning
                      </h2>

                      <p className="mt-1 text-sm text-slate-500">
                        Verloningsgegevens en definitief geregistreerde gewerkte uren.
                      </p>
                    </div>

                    {!isBewerken && (
                      <WijzigenKnop
                        href={`/medewerkers/${medewerker.id}?tab=verloning&edit=1`}
                      />
                    )}
                  </div>

                  {isBewerken &&
                  editSection ===
                    "verloning" ? (
                    <Card
                      title="Verloningsgegevens wijzigen"
                      description="Wijzig het uurloon van deze medewerker."
                    >
                      <MedewerkerTabBewerken
                        medewerker={
                          medewerkerFormData
                        }
                        section="verloning"
                      />
                    </Card>
                  ) : (
                    <>
                      <Card
                        title="Verloningsgegevens"
                        description="Gegevens die relevant zijn voor de verloning."
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
                      </Card>

                      <Card
                        title={`Goedgekeurde uren ${huidigJaar}`}
                        description="Alleen definitief gecontroleerde gewerkte uren worden meegenomen."
                      >
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                          {maandOverzicht.map(
                            (maand) => (
                              <div
                                key={
                                  maand.maand
                                }
                                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                              >
                                <p className="text-sm font-semibold text-slate-900">
                                  {
                                    maand.naam
                                  }
                                </p>

                                <div className="mt-4">
                                  <p className="text-2xl font-semibold text-slate-900">
                                    {
                                      maand.dagen
                                    }
                                  </p>

                                  <p className="text-xs text-slate-500">
                                    {maand.dagen ===
                                    1
                                      ? "gewerkte dag"
                                      : "gewerkte dagen"}
                                  </p>
                                </div>

                                <div className="mt-3 border-t border-slate-200 pt-3">
                                  <p className="text-lg font-semibold text-slate-900">
                                    {formatteerUren(
                                      maand.uren,
                                    )}
                                  </p>

                                  <p className="text-xs text-slate-500">
                                    definitief geregistreerd
                                  </p>
                                </div>
                              </div>
                            ),
                          )}
                        </div>

                        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                                Totaal{" "}
                                {huidigJaar}
                              </p>

                              <p className="mt-1 text-lg font-semibold text-slate-900">
                                {
                                  totaalDagen
                                }{" "}
                                {totaalDagen ===
                                1
                                  ? "dag"
                                  : "dagen"}
                              </p>
                            </div>

                            <div className="sm:text-right">
                              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                                Goedgekeurde uren
                              </p>

                              <p className="mt-1 text-2xl font-semibold text-slate-900">
                                {formatteerUren(
                                  Math.round(
                                    totaalUren *
                                      100,
                                  ) / 100,
                                )}
                              </p>
                            </div>
                          </div>
                        </div>

                        {definitieveUren.length ===
                          0 && (
                          <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-center">
                            <p className="text-sm font-semibold text-slate-700">
                              Nog geen goedgekeurde uren
                            </p>

                            <p className="mt-1 text-sm text-slate-500">
                              Er zijn dit jaar nog geen definitieve urenregistraties voor deze medewerker.
                            </p>
                          </div>
                        )}
                      </Card>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}