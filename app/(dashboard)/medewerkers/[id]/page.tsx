import Link from "next/link";
import { redirect } from "next/navigation";

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

import {
  medewerkerService,
} from "@/lib/services/medewerker.service";

import PageLayout from "@/components/ui/PageLayout";
import PageToolbar from "@/components/ui/PageToolbar";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

import MedewerkerTabBewerken from "@/components/medewerkers/MedewerkerTabBewerken";

import BeschikbaarheidPanel from "@/components/medewerkers/beschikbaarheid/components/BeschikbaarheidPanel";
import VakantiePlanningPanel from "@/components/medewerkers/VakantiePlanningPanel";
import MedewerkerAfsprakenPanel from "@/components/medewerkers/MedewerkerAfsprakenPanel";

/*
 * ============================================================
 * TYPES
 * ============================================================
 */

type PageProps = {
  params: Promise<{
    id: string;
  }>;

  searchParams: Promise<{
    tab?: string;
    edit?: string;
  }>;
};

/*
 * ============================================================
 * TABBLADEN
 * ============================================================
 */

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
  {
    id: "gegevens",
    label: "Gegevens bewerken",
  },
  {
    id: "vakantie",
    label: "Vakantie",
  },
  {
    id: "afspraken",
    label: "Afspraken",
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

/*
 * ============================================================
 * HELPERS
 * ============================================================
 */

function isTabId(
  value: string | undefined,
): value is TabId {
  return (
    value !== undefined &&
    TABS.some(
      (tab) =>
        tab.id === value,
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
    case "gegevens":
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
    case "gegevens":
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

  return new Intl.DateTimeFormat(
    "nl-NL",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    },
  ).format(
    new Date(datum),
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
  ).format(
    new Date(datum),
  );
}

function formatteerNaam(
  medewerker: {
    voornaam: string;
    tussenvoegsel: string | null;
    achternaam: string;
  },
) {
  return [
    medewerker.voornaam,
    medewerker.tussenvoegsel,
    medewerker.achternaam,
  ]
    .filter(Boolean)
    .join(" ");
}

function formatteerUren(
  uren: number,
) {
  if (Number.isInteger(uren)) {
    return `${uren} uur`;
  }

  return `${uren
    .toFixed(2)
    .replace(".", ",")} uur`;
}

/*
 * ============================================================
 * KNOPPEN
 * ============================================================
 */

function WijzigenKnop({
  href,
  disabled = false,
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

/*
 * ============================================================
 * VERLONING
 * ============================================================
 */

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
      (
        naam,
        index,
      ) => ({
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

  for (
    const registratie of urenregistraties
  ) {
    const datum =
      new Date(
        registratie.datum,
      );

    if (
      datum.getFullYear() !== jaar
    ) {
      continue;
    }

    const maand =
      datum.getMonth() + 1;

    const datumKey =
      new Intl.DateTimeFormat(
        "sv-SE",
      ).format(
        datum,
      );

    gewerkteDagenPerMaand
      .get(maand)
      ?.add(
        datumKey,
      );

    const uren =
      Number(
        registratie.gewerkteUren,
      );

    if (
      Number.isFinite(uren)
    ) {
      overzicht[
        maand - 1
      ].uren += uren;
    }
  }

  for (
    const item of overzicht
  ) {
    item.dagen =
      gewerkteDagenPerMaand
        .get(
          item.maand,
        )
        ?.size ?? 0;

    item.uren =
      Math.round(
        item.uren * 100,
      ) / 100;
  }

  return overzicht;
}

/*
 * ============================================================
 * VAKANTIE
 * ============================================================
 */

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

    case "AANGEVRAAGD":
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

/*
 * ============================================================
 * PAGINA
 * ============================================================
 */

export default async function MedewerkerPage({
  params,
  searchParams,
}: PageProps) {
  const {
    id,
  } = await params;

  const {
    tab,
    edit,
  } = await searchParams;

  const gebruiker =
    await getCurrentUser();

  if (!gebruiker) {
    redirect("/login");
  }

  const medewerker =
    await medewerkerService.getById(
      id,
    );

  const actieveRelaties =
    gebruiker.organisaties.filter(
      (relatie) =>
        relatie.actief &&
        relatie.organisatie.actief,
    );

  const medewerkerOrganisatieIds =
    Array.from(
      new Set(
        medewerker.vestigingen.map(
          (relatie) =>
            relatie.vestiging.organisatieId,
        ),
      ),
    );

  const isEigenaar =
    medewerkerOrganisatieIds.length > 0 &&
    medewerkerOrganisatieIds.every(
      (organisatieId) =>
        actieveRelaties.some(
          (relatie) =>
            relatie.organisatieId === organisatieId &&
            relatie.rol.naam
              .trim()
              .toLowerCase() ===
              "eigenaar",
        ),
    );

  /*
   * Profielpagina wordt vanuit /profiel geopend met het
   * medewerker-id van de ingelogde gebruiker. Vergelijk daarom
   * rechtstreeks met de routeparameter, zodat de eigen-profiel-
   * rechten niet afhankelijk zijn van de geladen relationele data.
   */
  const isEigenProfiel =
    gebruiker.medewerker?.id ===
    id;

  if (
    !isEigenaar &&
    !isEigenProfiel
  ) {
    await vereisPermission(
      permissions.medewerkers.view,
    );
  }

  const actieveTab: TabId =
    isTabId(tab) &&
    ((tab !== "afspraken" && tab !== "gegevens") || isEigenaar)
      ? tab
      : "algemeen";

  /*
   * Bewerkrechten binnen het medewerkerdossier zijn uitsluitend
   * voor de Eigenaar. Teamleiders en medewerkers mogen de relevante
   * informatie bekijken, maar kunnen deze hier niet wijzigen.
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
      actieveTab,
      {
        magAlgemeenBewerken,
        magContractBewerken,
        magVestigingenBewerken,
        magBeschikbaarheidBewerken,
        magVerloningBewerken,
      },
    );

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

  const beschikbareRollen =
    isEigenaar
      ? await prisma.rol.findMany({
          orderBy: {
            naam: "asc",
          },

          select: {
            id: true,
            naam: true,
          },
        })
      : [];

  const beschikbareTags =
    isEigenaar
      ? await prisma.tag.findMany({
          orderBy: {
            naam: "asc",
          },

          select: {
            id: true,
            naam: true,
          },
        })
      : [];

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
        (
          medewerkerVestiging,
        ) => ({
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
        (
          medewerkerVestiging,
        ) =>
          medewerkerVestiging.hoofdvestiging,
      )?.vestiging.id ?? null,

    rollen:
      medewerker.rollen.map(
        (
          medewerkerRol,
        ) => ({
          id:
            medewerkerRol.rol.id,
          naam:
            medewerkerRol.rol.naam,
        }),
      ),

    tags:
      medewerker.tags.map(
        (
          medewerkerTag,
        ) => ({
          id:
            medewerkerTag.tag.id,
          naam:
            medewerkerTag.tag.naam,
        }),
      ),
  };

  const vestigingen =
    medewerker.vestigingen.map(
      (
        medewerkerVestiging,
      ) => ({
        id:
          medewerkerVestiging.vestiging.id,
        naam:
          medewerkerVestiging.vestiging.naam,
      }),
    );

  const [
    dossierItems,
    vasteUrenAfspraken,
  ] = isEigenaar
    ? await Promise.all([
        prisma.$queryRawUnsafe<
          Array<{
            id: string;
            type: string;
            titel: string;
            omschrijving: string | null;
            kanaal: string | null;
            documentNaam: string | null;
            documentUrl: string | null;
            datum: Date;
          }>
        >(
          `SELECT "id", "type", "titel", "omschrijving", "kanaal", "documentNaam", "documentUrl", "datum"
           FROM "MedewerkerDossierItem"
           WHERE "medewerkerId" = $1
           ORDER BY "datum" DESC, "aangemaaktOp" DESC`,
          medewerker.id,
        ),

        prisma.$queryRawUnsafe<
          Array<{
            id: string;
            vestigingId: string;
            vestigingNaam: string;
            tagId: string;
            tagNaam: string;
            dagVanWeek: number;
            begintijd: string;
            eindtijd: string;
            startDatum: Date;
            eindDatum: Date;
            actief: boolean;
            akkoordOp: Date;
          }>
        >(
          `SELECT
             a."id",
             a."vestigingId",
             v."naam" AS "vestigingNaam",
             a."tagId",
             t."naam" AS "tagNaam",
             a."dagVanWeek",
             a."begintijd",
             a."eindtijd",
             a."startDatum",
             a."eindDatum",
             a."actief",
             a."akkoordOp"
           FROM "VasteUrenAfspraak" a
           INNER JOIN "Vestiging" v ON v."id" = a."vestigingId"
           INNER JOIN "Tag" t ON t."id" = a."tagId"
           WHERE a."medewerkerId" = $1
           ORDER BY a."startDatum" ASC, a."dagVanWeek" ASC, a."begintijd" ASC`,
          medewerker.id,
        ),
      ])
    : [
        [],
        [],
      ];

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
        (
          bezetting,
        ) => {
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
      .slice(
        0,
        50,
      );

  const huidigJaar =
    new Date().getFullYear();

  const definitieveUren =
    await prisma.urenRegistratie.findMany(
      {
        where: {
          medewerkerId:
            medewerker.id,

          status:
            "DEFINITIEF",

          datum: {
            gte: new Date(
              huidigJaar,
              0,
              1,
            ),

            lt: new Date(
              huidigJaar + 1,
              0,
              1,
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
    );

  const maandOverzicht =
    maakMaandOverzicht(
      huidigJaar,
      definitieveUren,
    );

  const totaalDagen =
    maandOverzicht.reduce(
      (
        totaal,
        maand,
      ) =>
        totaal +
        maand.dagen,
      0,
    );

  const totaalUren =
    maandOverzicht.reduce(
      (
        totaal,
        maand,
      ) =>
        totaal +
        maand.uren,
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
            {TABS
              .filter(
                (tabItem) =>
                  (tabItem.id !== "afspraken" &&
                    tabItem.id !== "gegevens") ||
                  isEigenaar,
              )
              .map(
              (
                tabItem,
              ) => {
                const actief =
                  actieveTab ===
                  tabItem.id;

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
              },
            )}
          </div>
        </div>

        <div className="p-6">
          {actieveTab ===
            "algemeen" && (
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Algemeen
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Algemene gegevens,
                    rollen en planningstags
                    van de medewerker.
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

                {isBewerken && (
                  <AnnuleerBewerkenKnop
                    href={`/medewerkers/${medewerker.id}?tab=algemeen`}
                  />
                )}
              </div>

              {isBewerken &&
              editSection ===
                "algemeen" ? (
                <Card
                  title="Medewerker wijzigen"
                  description={
                    isEigenaar
                      ? "Wijzig de algemene gegevens, rollen en planningstags van deze medewerker."
                      : "Wijzig je algemene persoonlijke gegevens."
                  }
                >
                  <MedewerkerTabBewerken
                    medewerker={
                      medewerkerFormData
                    }
                    section="algemeen"
                    beschikbareRollen={
                      beschikbareRollen
                    }
                    beschikbareTags={
                      beschikbareTags
                    }
                    beschikbareVestigingen={
                      vestigingen
                    }
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
                            {medewerker.telefoon ?? "—"}
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
                          {medewerker.aanhef ?? "—"}
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
                          {medewerker.tussenvoegsel || "—"}
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
                          {medewerker.roepnaam || "—"}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                          Geboortedatum
                        </dt>

                        <dd className="mt-1 text-sm text-slate-700">
                          {formatteerDatum(medewerker.geboortedatum)}
                        </dd>
                      </div>
                    </dl>
                  </Card>

                  <div className="grid gap-6 lg:grid-cols-2">
                    <Card
                      title="Rollen"
                      description="Rollen die aan deze medewerker zijn gekoppeld."
                    >
                      {medewerker.rollen.length === 0 ? (
                        <p className="text-sm text-slate-500">
                          Nog geen rollen gekoppeld.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {medewerker.rollen.map(
                            (medewerkerRol) => (
                              <Badge
                                key={medewerkerRol.id}
                                variant="default"
                              >
                                {medewerkerRol.rol.naam}
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
                      {medewerker.tags.length === 0 ? (
                        <p className="text-sm text-slate-500">
                          Nog geen planningstags gekoppeld.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {medewerker.tags.map(
                            (medewerkerTag) => (
                              <Badge
                                key={medewerkerTag.id}
                                variant="default"
                              >
                                {medewerkerTag.tag.naam}
                              </Badge>
                            ),
                          )}
                        </div>
                      )}
                    </Card>
                  </div>
                </>
              )}
            </div>
          )}

          {actieveTab === "contract" && (
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
                    disabled={!magContractBewerken}
                  />
                )}

                {isBewerken && (
                  <AnnuleerBewerkenKnop
                    href={`/medewerkers/${medewerker.id}?tab=contract`}
                  />
                )}
              </div>

              {isBewerken && editSection === "contract" ? (
                <Card
                  title="Contractgegevens wijzigen"
                  description="Wijzig de gegevens van het dienstverband."
                >
                  <MedewerkerTabBewerken
                    medewerker={medewerkerFormData}
                    section="contract"
                  />
                </Card>
              ) : (
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
                        {medewerker.contractType ?? "Nog niet ingevuld"}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Contracturen
                      </dt>

                      <dd className="mt-1 text-sm text-slate-700">
                        {medewerker.contractUren != null
                          ? `${medewerker.contractUren} uur`
                          : "Nog niet ingevuld"}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        In dienst
                      </dt>

                      <dd className="mt-1 text-sm text-slate-700">
                        {formatteerDatum(medewerker.datumInDienst)}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Uit dienst
                      </dt>

                      <dd className="mt-1 text-sm text-slate-700">
                        {formatteerDatum(medewerker.datumUitDienst)}
                      </dd>
                    </div>
                  </dl>
                </Card>
              )}
            </div>
          )}

          {actieveTab === "vestigingen" && (
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
                    disabled={!magVestigingenBewerken}
                  />
                )}

                {isBewerken && (
                  <AnnuleerBewerkenKnop
                    href={`/medewerkers/${medewerker.id}?tab=vestigingen`}
                  />
                )}
              </div>

              {isBewerken && editSection === "vestigingen" ? (
                <Card
                  title="Vestigingen wijzigen"
                  description="Wijzig de vestigingen waar deze medewerker werkt en stel de hoofdvestiging in."
                >
                  <MedewerkerTabBewerken
                    medewerker={medewerkerFormData}
                    section="vestigingen"
                  />
                </Card>
              ) : (
                <Card
                  title="Gekoppelde vestigingen"
                  description="Vestigingen waarvoor de medewerker is gekoppeld."
                >
                  {medewerker.vestigingen.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      Nog geen vestiging gekoppeld.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {medewerker.vestigingen.map(
                        (medewerkerVestiging) => (
                          <div
                            key={medewerkerVestiging.id}
                            className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                          >
                            <span className="text-sm font-medium text-slate-700">
                              {medewerkerVestiging.vestiging.naam}
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
              )}
            </div>
          )}

          {actieveTab === "beschikbaarheid" && (
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Beschikbaarheid
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Alleen de huidige en toekomstige weken worden getoond.
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
                medewerkerId={medewerker.id}
                vestigingen={vestigingen}
                isBeheerder={magBeschikbaarheidBewerken}
                isEigenMedewerker={isEigenProfiel}
                bewerkmodus={isBewerken}
              />
            </div>
          )}

          {actieveTab === "vakantie" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Vakantieplanning</h2>
                <p className="mt-1 text-sm text-slate-500">Vakantieplanning voor juni, juli en augustus. De medewerker levert deze uiterlijk 30 april in en de eigenaar beoordeelt de aanvraag.</p>
              </div>
              <Card title="Zomervakantie" description="Maximaal 14 dagen in totaal en maximaal 14 dagen aaneengesloten.">
                <VakantiePlanningPanel medewerkerId={medewerker.id} isEigenaar={isEigenaar} magIndienen={isEigenProfiel} />
              </Card>
            </div>
          )}

          {actieveTab === "planning" && (
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
                  <Button>Naar planning</Button>
                </Link>
              </div>

              <Card
                title="Aankomende diensten"
                description="Alle nog plaats te vinden diensten waarop deze medewerker staat ingepland."
              >
                {aankomendeDiensten.length === 0 ? (
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
                    {aankomendeDiensten.map((bezetting) => {
                      const dienst = bezetting.dienst;
                      const datum = new Date(dienst.datum);
                      const beginTijd = new Intl.DateTimeFormat("nl-NL", {
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(dienst.begintijd));
                      const eindTijd = new Intl.DateTimeFormat("nl-NL", {
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(dienst.eindtijd));

                      return (
                        <div
                          key={bezetting.id}
                          className="rounded-xl border border-slate-200 bg-white p-4"
                        >
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                              <p className="text-sm font-semibold capitalize text-slate-900">
                                {formatteerDatumTijd(datum)}
                              </p>
                              <p className="mt-1 text-sm text-slate-600">
                                {beginTijd} - {eindTijd}
                              </p>
                              <p className="mt-1 text-sm text-slate-600">
                                {dienst.tags?.map((dienstTag) => dienstTag.tag.naam).join(" · ") || "Geen planningstag"}
                              </p>
                              {dienst.opmerkingen && (
                                <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2">
                                  <p className="text-xs font-medium text-slate-500">Opmerking</p>
                                  <p className="mt-1 text-sm text-slate-700">{dienst.opmerkingen}</p>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-3">
                              <span className="rounded-lg bg-green-50 px-3 py-2 text-xs font-semibold text-green-700">
                                {bezetting.status}
                              </span>

                              {isEigenaar && (
                                <Link href={`/planning?dienstId=${dienst.id}`}>
                                  <Button>
                                    <Pencil size={15} />
                                    Dienst wijzigen
                                  </Button>
                                </Link>
                              )}

                              {isEigenProfiel &&
                                !isEigenaar && (
                                  <Link
                                    href={`/planning/dienst/${dienst.id}`}
                                  >
                                    <Button>Ruilen</Button>
                                  </Link>
                                )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>
          )}

          {actieveTab === "afspraken" &&
            isEigenaar && (
            <MedewerkerAfsprakenPanel
              medewerkerId={medewerker.id}
              vestigingen={vestigingen}
              tags={beschikbareTags}
              dossier={dossierItems.map(
                (item) => ({
                  ...item,
                  datum: item.datum.toISOString(),
                }),
              )}
              vasteUren={vasteUrenAfspraken.map(
                (afspraak) => ({
                  ...afspraak,
                  startDatum: afspraak.startDatum.toISOString(),
                  eindDatum: afspraak.eindDatum.toISOString(),
                  akkoordOp: afspraak.akkoordOp.toISOString(),
                }),
              )}
            />
          )}

          {actieveTab === "verloning" && (
            <div className="space-y-6">
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
                    disabled={!magVerloningBewerken}
                  />
                )}

                {isBewerken && (
                  <AnnuleerBewerkenKnop
                    href={`/medewerkers/${medewerker.id}?tab=verloning`}
                  />
                )}
              </div>

              {isBewerken && editSection === "verloning" ? (
                <Card
                  title="Verloningsgegevens wijzigen"
                  description="Wijzig het uurloon van deze medewerker."
                >
                  <MedewerkerTabBewerken
                    medewerker={medewerkerFormData}
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
                          {medewerker.uurloon != null
                            ? new Intl.NumberFormat("nl-NL", {
                                style: "currency",
                                currency: "EUR",
                              }).format(Number(medewerker.uurloon))
                            : "Nog niet ingevuld"}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                          Contracturen
                        </dt>

                        <dd className="mt-1 text-sm text-slate-700">
                          {medewerker.contractUren != null
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
                      {maandOverzicht.map((maand) => (
                        <div
                          key={maand.maand}
                          className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                        >
                          <p className="text-sm font-semibold text-slate-900">{maand.naam}</p>

                          <div className="mt-4">
                            <p className="text-2xl font-semibold text-slate-900">{maand.dagen}</p>
                            <p className="text-xs text-slate-500">
                              {maand.dagen === 1 ? "gewerkte dag" : "gewerkte dagen"}
                            </p>
                          </div>

                          <div className="mt-3 border-t border-slate-200 pt-3">
                            <p className="text-lg font-semibold text-slate-900">
                              {formatteerUren(maand.uren)}
                            </p>
                            <p className="text-xs text-slate-500">definitief geregistreerd</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                            Totaal {huidigJaar}
                          </p>
                          <p className="mt-1 text-lg font-semibold text-slate-900">
                            {totaalDagen} {totaalDagen === 1 ? "dag" : "dagen"}
                          </p>
                        </div>

                        <div className="sm:text-right">
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                            Goedgekeurde uren
                          </p>
                          <p className="mt-1 text-2xl font-semibold text-slate-900">
                            {formatteerUren(Math.round(totaalUren * 100) / 100)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {definitieveUren.length === 0 && (
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
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
