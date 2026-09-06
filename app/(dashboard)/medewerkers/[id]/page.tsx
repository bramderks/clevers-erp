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

import { getCurrentUser } from "@/lib/auth";
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
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; edit?: string }>;
};

const TABS = [
  { id: "algemeen", label: "Algemeen" },
  { id: "contract", label: "Contract" },
  { id: "vestigingen", label: "Vestigingen" },
  { id: "beschikbaarheid", label: "Beschikbaarheid" },
  { id: "vakantie", label: "Vakantie" },
  { id: "planning", label: "Planning" },
  { id: "verloning", label: "Verloning" },
] as const;

type TabId = (typeof TABS)[number]["id"];
type EditSection = "algemeen" | "contract" | "vestigingen" | "beschikbaarheid" | "verloning";

type MaandOverzicht = {
  maand: number;
  naam: string;
  dagen: number;
  uren: number;
};

function isTabId(value: string | undefined): value is TabId {
  return value !== undefined && TABS.some((tab) => tab.id === value);
}

function getEditSection(tab: TabId): EditSection | null {
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
  }
}

function formatteerDatum(datum: Date | null | undefined) {
  if (!datum) return "—";
  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(datum));
}

function formatteerDatumTijd(datum: Date | null | undefined) {
  if (!datum) return "—";
  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(datum));
}

function formatteerNaam(medewerker: {
  voornaam: string;
  tussenvoegsel: string | null;
  achternaam: string;
}) {
  return [medewerker.voornaam, medewerker.tussenvoegsel, medewerker.achternaam]
    .filter(Boolean)
    .join(" ");
}

function formatteerUren(uren: number) {
  return Number.isInteger(uren)
    ? `${uren} uur`
    : `${uren.toFixed(2).replace(".", ",")} uur`;
}

function vakantieStatusVariant(status: string) {
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

function vakantieStatusLabel(status: string) {
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

function WijzigenKnop({
  href,
  disabled = false,
}: {
  href: string;
  disabled?: boolean;
}) {
  if (disabled) return null;
  return (
    <Link href={href}>
      <Button>
        <Pencil size={16} />
        Wijzigen
      </Button>
    </Link>
  );
}

function AnnuleerBewerkenKnop({ href }: { href: string }) {
  return (
    <Link href={href}>
      <Button variant="secondary">Annuleren</Button>
    </Link>
  );
}

export default async function MedewerkerPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const { tab, edit } = await searchParams;

  const gebruiker = await getCurrentUser();
  if (!gebruiker) redirect("/login");

  const medewerker = await medewerkerService.getById(id);

  const actieveRelaties = gebruiker.organisaties.filter(
    (relatie) => relatie.actief && relatie.organisatie.actief,
  );

  const isEigenaar = actieveRelaties.some(
    (relatie) => relatie.rol.naam.trim().toLowerCase() === "eigenaar",
  );

  const isEigenProfiel = gebruiker.medewerker?.id === medewerker.id;

  if (!isEigenaar && !isEigenProfiel) {
    await vereisPermission(permissions.medewerkers.view);
  }

  const actieveTab: TabId = isTabId(tab) ? tab : "algemeen";

  const magAlgemeenBewerken = isEigenaar || isEigenProfiel;
  const magContractBewerken = isEigenaar;
  const magVestigingenBewerken = isEigenaar;
  const magBeschikbaarheidBewerken = isEigenaar;
  const magVerloningBewerken = isEigenaar;

  const magTabBewerken = getMagTabBewerken(actieveTab, {
    magAlgemeenBewerken,
    magContractBewerken,
    magVestigingenBewerken,
    magBeschikbaarheidBewerken,
    magVerloningBewerken,
  });

  const editSection = getEditSection(actieveTab);
  const isBewerken = edit === "1" && magTabBewerken && editSection !== null;
  const volledigeNaam = formatteerNaam(medewerker);

  const beschikbareRollen = isEigenaar
    ? await prisma.rol.findMany({
        orderBy: { naam: "asc" },
        select: { id: true, naam: true },
      })
    : [];

  const beschikbareTags = isEigenaar
    ? await prisma.tag.findMany({
        orderBy: { naam: "asc" },
        select: { id: true, naam: true },
      })
    : [];

  const medewerkerFormData = {
    id: medewerker.id,
    personeelsnummer: medewerker.personeelsnummer,
    aanhef: medewerker.aanhef,
    voornaam: medewerker.voornaam,
    tussenvoegsel: medewerker.tussenvoegsel,
    achternaam: medewerker.achternaam,
    roepnaam: medewerker.roepnaam,
    geboortedatum: medewerker.geboortedatum,
    email: medewerker.email,
    telefoon: medewerker.telefoon,
    contractType: medewerker.contractType ?? null,
    contractUren: medewerker.contractUren != null ? medewerker.contractUren.toString() : null,
    uurloon: medewerker.uurloon != null ? medewerker.uurloon.toString() : null,
    datumInDienst: medewerker.datumInDienst,
    datumUitDienst: medewerker.datumUitDienst,
    vestigingen: medewerker.vestigingen.map((relatie) => ({
      id: relatie.vestiging.id,
      naam: relatie.vestiging.naam,
    })),
    hoofdvestigingId:
      medewerker.vestigingen.find((relatie) => relatie.hoofdvestiging)?.vestiging.id ?? null,
    rollen: medewerker.rollen.map((relatie) => ({
      id: relatie.rol.id,
      naam: relatie.rol.naam,
    })),
    tags: medewerker.tags.map((relatie) => ({
      id: relatie.tag.id,
      naam: relatie.tag.naam,
    })),
  };

  const vestigingen = medewerker.vestigingen.map((relatie) => ({
    id: relatie.vestiging.id,
    naam: relatie.vestiging.naam,
  }));

  const vakantieAanvragen = await prisma.vakantieAanvraag.findMany({
    where: { medewerkerId: medewerker.id },
    orderBy: [{ startDatum: "asc" }, { aangevraagdOp: "desc" }],
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
  });

  const vandaag = new Date();
  vandaag.setHours(0, 0, 0, 0);

  const aankomendeDiensten = medewerker.diensten
    .filter((bezetting) => {
      const datum = new Date(bezetting.dienst.datum);
      datum.setHours(0, 0, 0, 0);
      return datum >= vandaag;
    })
    .slice(0, 50);

  const verloningsPeriodes = await prisma.verloningsPeriode.findMany({
    where: {
      regels: {
        some: { medewerkerId: medewerker.id },
      },
    },
    orderBy: [{ jaar: "desc" }, { maand: "desc" }],
    include: {
      regels: {
        where: { medewerkerId: medewerker.id },
        select: {
          gewerkteDagen: true,
          gewerkteUren: true,
        },
      },
      controles: {
        where: { medewerkerId: medewerker.id },
        select: {
          status: true,
          gecontroleerdOp: true,
          automatischAkkoordOp: true,
        },
        take: 1,
      },
    },
  });

  const verloningsJaren = Array.from(
    new Set(verloningsPeriodes.map((periode) => periode.jaar)),
  ).sort((a, b) => b - a);

  const verloningsJaar = verloningsJaren[0] ?? new Date().getFullYear();

  const maandOverzicht: Array<
    MaandOverzicht & {
      status: string;
      statusTekst: string;
    }
  > = Array.from({ length: 12 }, (_, index) => {
    const maand = index + 1;
    const periode = verloningsPeriodes.find(
      (item) => item.jaar === verloningsJaar && item.maand === maand,
    );

    const regel = periode?.regels[0];
    const controle = periode?.controles[0];

    return {
      maand,
      naam: new Intl.DateTimeFormat("nl-NL", { month: "long" }).format(
        new Date(verloningsJaar, maand - 1, 1),
      ),
      dagen: regel?.gewerkteDagen ?? 0,
      uren: regel ? Number(regel.gewerkteUren) : 0,
      status: controle?.status ?? (periode ? "OPEN" : "ONTBREEKT"),
      statusTekst:
        controle?.status === "AKKOORD"
          ? "Goedgekeurd"
          : controle?.status === "AUTOMATISCH_AKKOORD"
            ? "Automatisch akkoord"
            : controle?.status === "OPEN"
              ? "Open – controleren"
              : "Nog niet aangemaakt",
    };
  });

  const totaalDagen = maandOverzicht.reduce((totaal, maand) => totaal + maand.dagen, 0);
  const totaalUren = maandOverzicht.reduce((totaal, maand) => totaal + maand.uren, 0);

  function MedewerkerBewerken({
    section,
  }: {
    section: "algemeen" | "contract" | "vestigingen" | "verloning";
  }) {
    return (
      <div className="mt-6 border-t border-slate-200 pt-6">
        <MedewerkerTabBewerken
          medewerker={medewerkerFormData}
          beschikbareRollen={beschikbareRollen}
          beschikbareTags={beschikbareTags}
          beschikbareVestigingen={vestigingen}
          section={section}
        />
      </div>
    );
  }

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

      <div className="space-y-6">
        <div className="flex flex-wrap gap-2 border-b border-slate-200">
          {TABS.map((item) => (
            <Link
              key={item.id}
              href={`/medewerkers/${medewerker.id}?tab=${item.id}`}
              className={[
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition",
                actieveTab === item.id
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800",
              ].join(" ")}
            >
              {item.label}
            </Link>
          ))}
        </div>

        {actieveTab === "algemeen" && (
          <Card>
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="grid flex-1 gap-6 md:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Naam</p>
                  <p className="mt-1 font-medium text-slate-900">{volledigeNaam}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Personeelsnummer</p>
                  <p className="mt-1 text-slate-900">{medewerker.personeelsnummer || "—"}</p>
                </div>
                <div className="flex items-start gap-3">
                  <User size={18} className="mt-0.5 text-slate-400" />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Status</p>
                    <div className="mt-1"><Badge>{medewerker.status.naam}</Badge></div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Mail size={18} className="mt-0.5 text-slate-400" />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">E-mail</p>
                    <p className="mt-1 text-slate-900">{medewerker.email}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone size={18} className="mt-0.5 text-slate-400" />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Telefoon</p>
                    <p className="mt-1 text-slate-900">{medewerker.telefoon || "—"}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Geboortedatum</p>
                  <p className="mt-1 text-slate-900">{formatteerDatum(medewerker.geboortedatum)}</p>
                </div>
              </div>
              {isBewerken ? (
                <AnnuleerBewerkenKnop href={`/medewerkers/${medewerker.id}?tab=${actieveTab}`} />
              ) : (
                <WijzigenKnop
                  href={`/medewerkers/${medewerker.id}?tab=${actieveTab}&edit=1`}
                  disabled={!magTabBewerken}
                />
              )}
            </div>
            {isBewerken && editSection === "algemeen" && <MedewerkerBewerken section="algemeen" />}
          </Card>
        )}

        {actieveTab === "contract" && (
          <Card>
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="grid flex-1 gap-6 md:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Contracttype</p>
                  <p className="mt-1 font-medium text-slate-900">{medewerker.contractType || "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Contracturen</p>
                  <p className="mt-1 text-slate-900">{medewerker.contractUren != null ? `${medewerker.contractUren.toString().replace(".", ",")} uur` : "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Uurloon</p>
                  <p className="mt-1 text-slate-900">{medewerker.uurloon != null ? `€ ${medewerker.uurloon.toString().replace(".", ",")}` : "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Datum in dienst</p>
                  <p className="mt-1 text-slate-900">{formatteerDatum(medewerker.datumInDienst)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Datum uit dienst</p>
                  <p className="mt-1 text-slate-900">{formatteerDatum(medewerker.datumUitDienst)}</p>
                </div>
              </div>
              {isBewerken ? (
                <AnnuleerBewerkenKnop href={`/medewerkers/${medewerker.id}?tab=${actieveTab}`} />
              ) : (
                <WijzigenKnop
                  href={`/medewerkers/${medewerker.id}?tab=${actieveTab}&edit=1`}
                  disabled={!magTabBewerken}
                />
              )}
            </div>
            {isBewerken && editSection === "contract" && <MedewerkerBewerken section="contract" />}
          </Card>
        )}

        {actieveTab === "vestigingen" && (
          <Card>
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex-1">
                <h2 className="font-semibold text-slate-900">Vestigingen</h2>
                <div className="mt-4 space-y-3">
                  {medewerker.vestigingen.length === 0 ? (
                    <p className="text-sm text-slate-500">Geen vestigingen gekoppeld.</p>
                  ) : (
                    medewerker.vestigingen.map((relatie) => (
                      <div key={relatie.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
                        <div>
                          <p className="font-medium text-slate-900">{relatie.vestiging.naam}</p>
                          <p className="text-xs text-slate-500">{relatie.vestiging.code}</p>
                        </div>
                        {relatie.hoofdvestiging && <Badge variant="success">Hoofdvestiging</Badge>}
                      </div>
                    ))
                  )}
                </div>
              </div>
              {isBewerken ? (
                <AnnuleerBewerkenKnop href={`/medewerkers/${medewerker.id}?tab=${actieveTab}`} />
              ) : (
                <WijzigenKnop
                  href={`/medewerkers/${medewerker.id}?tab=${actieveTab}&edit=1`}
                  disabled={!magTabBewerken}
                />
              )}
            </div>
            {isBewerken && editSection === "vestigingen" && <MedewerkerBewerken section="vestigingen" />}
          </Card>
        )}

        {actieveTab === "beschikbaarheid" && (
          <Card>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold text-slate-900">Beschikbaarheid</h2>
                <p className="mt-1 text-sm text-slate-500">Alle geregistreerde beschikbaarheid van deze medewerker.</p>
              </div>
              {isBewerken ? (
                <AnnuleerBewerkenKnop href={`/medewerkers/${medewerker.id}?tab=${actieveTab}`} />
              ) : (
                <WijzigenKnop
                  href={`/medewerkers/${medewerker.id}?tab=${actieveTab}&edit=1`}
                  disabled={!magTabBewerken}
                />
              )}
            </div>
            <div className="mt-6">
              <BeschikbaarheidPanel medewerkerId={medewerker.id} bewerkbaar={isEigenaar} />
            </div>
          </Card>
        )}

        {actieveTab === "vakantie" && (
          <Card>
            <div>
              <h2 className="font-semibold text-slate-900">Vakantie</h2>
              <p className="mt-1 text-sm text-slate-500">Overzicht van vakantie- en afwezigheidsaanvragen.</p>
            </div>
            <div className="mt-6 overflow-x-auto">
              {vakantieAanvragen.length === 0 ? (
                <p className="text-sm text-slate-500">Geen vakantieaanvragen gevonden.</p>
              ) : (
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="pb-3 pr-4 font-medium">Periode</th>
                      <th className="pb-3 pr-4 font-medium">Type</th>
                      <th className="pb-3 pr-4 font-medium">Status</th>
                      <th className="pb-3 pr-4 font-medium">Aangevraagd</th>
                      <th className="pb-3 font-medium">Opmerking</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vakantieAanvragen.map((aanvraag) => (
                      <tr key={aanvraag.id} className="border-b border-slate-100 last:border-0">
                        <td className="py-4 pr-4 text-slate-900">{formatteerDatum(aanvraag.startDatum)} t/m {formatteerDatum(aanvraag.eindDatum)}</td>
                        <td className="py-4 pr-4 text-slate-700">{aanvraag.type}</td>
                        <td className="py-4 pr-4">
                          <Badge variant={vakantieStatusVariant(aanvraag.status)}>
                            {vakantieStatusLabel(aanvraag.status)}
                          </Badge>
                        </td>
                        <td className="py-4 pr-4 text-slate-700">{formatteerDatumTijd(aanvraag.aangevraagdOp)}</td>
                        <td className="py-4 text-slate-600">{aanvraag.opmerking || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        )}

        {actieveTab === "planning" && (
          <Card>
            <div>
              <h2 className="font-semibold text-slate-900">Planning</h2>
              <p className="mt-1 text-sm text-slate-500">Aankomende ingeplande diensten.</p>
            </div>
            <div className="mt-6 space-y-3">
              {aankomendeDiensten.length === 0 ? (
                <p className="text-sm text-slate-500">Geen aankomende diensten.</p>
              ) : (
                aankomendeDiensten.map((bezetting) => (
                  <div key={bezetting.id} className="rounded-lg border border-slate-200 px-4 py-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium text-slate-900">{formatteerDatumTijd(bezetting.dienst.datum)}</p>
                        <p className="mt-1 text-sm text-slate-500">{bezetting.dienst.begintijd} t/m {bezetting.dienst.eindtijd || "—"}</p>
                      </div>
                      <Badge>{bezetting.status}</Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        )}

        {actieveTab === "verloning" && (
          <Card>
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="font-semibold text-slate-900">Verloning</h2>
                <p className="mt-1 text-sm text-slate-500">Gewerkte dagen en uren per maand op basis van definitief geregistreerde uren en de centrale verloningscontrole.</p>
              </div>
              {isBewerken ? (
                <AnnuleerBewerkenKnop href={`/medewerkers/${medewerker.id}?tab=${actieveTab}`} />
              ) : (
                <WijzigenKnop
                  href={`/medewerkers/${medewerker.id}?tab=${actieveTab}&edit=1`}
                  disabled={!magTabBewerken}
                />
              )}
            </div>

            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Jaar</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{verloningsJaar}</p>
                </div>
                <p className="text-sm text-slate-500">
                  {verloningsJaren.length > 0
                    ? `${verloningsJaren.length} jaar beschikbaar`
                    : "Nog geen aangemaakte verloningsperiodes"}
                </p>
              </div>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="pb-3 pr-4 font-medium">Maand</th>
                    <th className="pb-3 pr-4 font-medium">Gewerkte dagen</th>
                    <th className="pb-3 pr-4 font-medium">Gewerkte uren</th>
                    <th className="pb-3 pr-4 font-medium">Status</th>
                    <th className="pb-3 font-medium">Periode</th>
                  </tr>
                </thead>
                <tbody>
                  {maandOverzicht.map((maand) => {
                    const periode = verloningsPeriodes.find(
                      (item) => item.jaar === verloningsJaar && item.maand === maand.maand,
                    );
                    const statusVariant =
                      maand.status === "AKKOORD"
                        ? "success"
                        : maand.status === "OPEN"
                          ? "warning"
                          : "default";

                    return (
                      <tr key={maand.maand} className="border-b border-slate-100 last:border-0">
                        <td className="py-4 pr-4 font-medium capitalize text-slate-900">{maand.naam}</td>
                        <td className="py-4 pr-4 text-slate-700">{maand.dagen}</td>
                        <td className="py-4 pr-4 text-slate-700">{formatteerUren(maand.uren)}</td>
                        <td className="py-4 pr-4"><Badge variant={statusVariant}>{maand.statusTekst}</Badge></td>
                        <td className="py-4 text-slate-500">{periode ? formatteerDatum(periode.periodeStart) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50 font-semibold text-slate-900">
                    <td className="py-4 pr-4">Totaal</td>
                    <td className="py-4 pr-4">{totaalDagen}</td>
                    <td className="py-4 pr-4">{formatteerUren(totaalUren)}</td>
                    <td className="py-4 pr-4">—</td>
                    <td className="py-4">{verloningsJaar}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {isBewerken && editSection === "verloning" && <MedewerkerBewerken section="verloning" />}
          </Card>
        )}
      </div>
    </PageLayout>
  );
}
