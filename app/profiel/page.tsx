import { redirect } from "next/navigation";

import {
  Shield,
} from "lucide-react";

import {
  getCurrentUser,
} from "@/lib/auth";

import { prisma } from "@/lib/prisma";

import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import Card from "@/components/ui/Card";

export default async function ProfielPage() {
  const gebruiker =
    await getCurrentUser();

  if (!gebruiker) {
    redirect("/login");
  }

  /*
   * ============================================================
   * MEDEWERKERSPROFIEL
   * ============================================================
   *
   * Een medewerkerprofiel is normaal rechtstreeks gekoppeld aan
   * het systeemaccount. Voor eigenaren kan die koppeling in een
   * bestaande database echter ontbreken terwijl het
   * medewerkerdossier al wel bestaat. Daarom herstellen we voor
   * een eigenaar de koppeling op basis van het account-e-mailadres.
   * Zo komt /profiel altijd uit op hetzelfde volledige profiel
   * met dezelfde tabbladen als bij een medewerker.
   *
   * Tabbladen:
   * - Algemeen
   * - Contract
   * - Vestigingen
   * - Beschikbaarheid
   * - Vakantie
   * - Planning
   * - Verloning
   * - Afspraken (eigenaar)
   */

  let medewerkerId = gebruiker.medewerker?.id;

  if (!medewerkerId) {
    const isEigenaar = gebruiker.organisaties.some(
      (relatie) =>
        relatie.actief &&
        relatie.organisatie.actief &&
        relatie.rol.naam.trim().toLowerCase() === "eigenaar",
    );

    if (isEigenaar && gebruiker.email) {
      const medewerkerOpEmail = await prisma.medewerker.findFirst({
        where: {
          email: gebruiker.email.trim().toLowerCase(),
        },
        select: { id: true },
      });

      medewerkerId = medewerkerOpEmail?.id;
    }
  }

  if (medewerkerId) {
    redirect(
      `/medewerkers/${encodeURIComponent(
        medewerkerId,
      )}?tab=algemeen`,
    );
  }

  /*
   * ============================================================
   * GEBRUIKER ZONDER MEDEWERKERSPROFIEL
   * ============================================================
   */

  const rollen =
    Array.from(
      new Set(
        gebruiker.organisaties.map(
          (relatie) =>
            relatie.rol.naam,
        ),
      ),
    );

  const topbarGebruiker = {
    naam: gebruiker.naam,
    rollen,
  };

  return (
    <div className="flex min-h-screen min-w-0 bg-slate-50">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          gebruiker={
            topbarGebruiker
          }
        />

        <main className="flex-1 overflow-auto p-4 md:p-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8">
              <h1 className="text-2xl font-semibold text-slate-900">
                Mijn profiel
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Bekijk je accountgegevens.
              </p>
            </div>

            <div className="space-y-6">
              <Card
                title="Account"
                description="Je accountgegevens."
              >
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Naam
                    </p>

                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {gebruiker.naam}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      E-mailadres
                    </p>

                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {gebruiker.email}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Rollen
                    </p>

                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {rollen.length > 0
                        ? rollen.join(
                            ", ",
                          )
                        : "Gebruiker"}
                    </p>
                  </div>
                </div>
              </Card>

              <Card
                title="Beveiliging"
                description="Beheer de beveiliging van je account."
              >
                <div className="flex items-start gap-4">
                  <Shield
                    size={20}
                    className="mt-0.5 text-slate-400"
                  />

                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      Wachtwoord
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      Je wachtwoord is beveiligd opgeslagen.
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
