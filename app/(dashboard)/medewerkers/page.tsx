import Link from "next/link";
import {
  ArrowRight,
  Upload,
  UserPlus,
  Users,
} from "lucide-react";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { medewerkerService } from "@/lib/services/medewerker.service";

import PageLayout from "@/components/ui/PageLayout";
import PageToolbar from "@/components/ui/PageToolbar";
import StatCard from "@/components/ui/StatCard";
import Button from "@/components/ui/Button";
import DataGrid from "@/components/ui/DataGrid";
import Badge from "@/components/ui/Badge";

import { permissions } from "@/lib/permissions";
import { vereisPermission } from "@/lib/requirePermission";

type PageProps = {
  searchParams: Promise<{
    vestigingId?: string;
  }>;
};

type Vestiging = {
  id: string;
  naam: string;
};

export default async function MedewerkersPage({
  searchParams,
}: PageProps) {
  await vereisPermission(
    permissions.medewerkers.view,
  );

  const gebruiker =
    await getCurrentUser();

  if (!gebruiker) {
    return null;
  }

  const actieveRelaties =
    gebruiker.organisaties.filter(
      (relatie) =>
        relatie.actief &&
        relatie.organisatie.actief,
    );

  const organisatieIds =
    Array.from(
      new Set(
        actieveRelaties.map(
          (relatie) =>
            relatie.organisatieId,
        ),
      ),
    );

  if (organisatieIds.length === 0) {
    return (
      <PageLayout>
        <PageToolbar title="Medewerkers" />

        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Je hebt geen toegang tot een
          actieve organisatie.
        </div>
      </PageLayout>
    );
  }

  const isEigenaar =
    actieveRelaties.some(
      (relatie) =>
        relatie.rol.naam.toLowerCase() ===
        "eigenaar",
    );

  const isTeamleider =
    actieveRelaties.some(
      (relatie) =>
        relatie.rol.naam.toLowerCase() ===
        "teamleider",
    );

  /*
   * Vestigingen die de gebruiker in deze
   * medewerkersmodule mag gebruiken.
   *
   * Eigenaar:
   *   alle actieve vestigingen binnen
   *   de toegankelijke organisaties.
   *
   * Teamleider:
   *   alleen de actieve vestigingen
   *   waaraan de teamleider zelf is
   *   gekoppeld.
   */
  let vestigingen: Vestiging[] = [];

  if (isEigenaar) {
    vestigingen =
      await prisma.vestiging.findMany({
        where: {
          organisatieId: {
            in: organisatieIds,
          },
          actief: true,
        },

        select: {
          id: true,
          naam: true,
        },

        orderBy: {
          naam: "asc",
        },
      });
  } else if (
    isTeamleider &&
    gebruiker.medewerker?.id
  ) {
    const koppelingen =
      await prisma.medewerkerVestiging.findMany(
        {
          where: {
            medewerkerId:
              gebruiker.medewerker.id,

            vestiging: {
              actief: true,
              organisatieId: {
                in: organisatieIds,
              },
            },
          },

          select: {
            vestiging: {
              select: {
                id: true,
                naam: true,
              },
            },
          },

          orderBy: {
            vestiging: {
              naam: "asc",
            },
          },
        },
      );

    vestigingen =
      koppelingen.map(
        (koppeling) =>
          koppeling.vestiging,
      );
  }

  /*
   * De gekozen vestiging komt uit de URL.
   * We accepteren hem uitsluitend wanneer
   * hij daadwerkelijk toegankelijk is.
   */
  const {
    vestigingId,
  } = await searchParams;

  const gekozenVestiging =
    vestigingId &&
    vestigingen.some(
      (vestiging) =>
        vestiging.id ===
        vestigingId,
    )
      ? vestigingId
      : undefined;

  /*
   * Zonder filter:
   *   eigenaar -> alle medewerkers
   *   teamleider -> medewerkers van
   *                 zijn/haar vestigingen
   *
   * Met filter:
   *   alleen medewerkers van de
   *   geselecteerde vestiging.
   */
  const toegestaneVestigingIds =
    vestigingen.map(
      (vestiging) =>
        vestiging.id,
    );

  const filterVestigingIds =
    gekozenVestiging
      ? [gekozenVestiging]
      : isEigenaar
        ? undefined
        : toegestaneVestigingIds;

  const medewerkers =
    await medewerkerService.getAll(
      organisatieIds,
      {
        vestigingIds:
          filterVestigingIds,
      },
    );

  const actieveMedewerkers =
    medewerkers.filter(
      (medewerker) =>
        medewerker.actief,
    ).length;

  const inactieveMedewerkers =
    medewerkers.length -
    actieveMedewerkers;

  return (
    <PageLayout>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
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
          icon={<Users size={20} />}
        />

        <StatCard
          title="Inactief"
          value={inactieveMedewerkers}
          subtitle="Niet actief"
          icon={<Users size={20} />}
        />

        <StatCard
          title="Vestigingen"
          value={vestigingen.length}
          subtitle="Toegankelijke vestigingen"
          icon={<Users size={20} />}
        />
      </div>

      <PageToolbar
        title="Medewerkers"
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {isEigenaar && (
              <Link href="/medewerkers/importeren">
                <Button variant="secondary">
                  <Upload size={18} />
                  Medewerkers importeren
                </Button>
              </Link>
            )}

            <Link href="/medewerkers/nieuw">
              <Button>
                <UserPlus size={18} />
                Nieuwe medewerker
              </Button>
            </Link>
          </div>
        }
      />

      {vestigingen.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <form
            method="GET"
            className="flex flex-col gap-4 sm:flex-row sm:items-end"
          >
            <div className="w-full max-w-sm">
              <label
                htmlFor="vestigingId"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Vestiging
              </label>

              <select
                id="vestigingId"
                name="vestigingId"
                defaultValue={
                  gekozenVestiging ??
                  ""
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              >
                {isEigenaar && (
                  <option value="">
                    Alle vestigingen
                  </option>
                )}

                {!isEigenaar &&
                  vestigingen.length >
                    1 && (
                    <option value="">
                      Alle vestigingen
                    </option>
                  )}

                {vestigingen.map(
                  (vestiging) => (
                    <option
                      key={
                        vestiging.id
                      }
                      value={
                        vestiging.id
                      }
                    >
                      {vestiging.naam}
                    </option>
                  ),
                )}
              </select>
            </div>

            <Button type="submit">
              Filteren
            </Button>

            {gekozenVestiging && (
              <Link
                href="/medewerkers"
                className="inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
              >
                Wissen
              </Link>
            )}
          </form>
        </div>
      )}

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
                  {
                    medewerker.achternaam
                  }
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
                    (
                      medewerkerVestiging,
                    ) => (
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
                            .vestiging
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
                medewerker.rollen
                  .length === 0
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
                            .rol.naam
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