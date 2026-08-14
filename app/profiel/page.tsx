import {
  Shield,
} from "lucide-react";

import { getCurrentUser } from "@/lib/auth";

import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import Card from "@/components/ui/Card";
import ProfielGegevensForm from "@/components/profiel/ProfielGegevensForm";

export default async function ProfielPage() {
  const gebruiker =
    await getCurrentUser();

  if (!gebruiker) {
    return null;
  }

  const rollen = Array.from(
    new Set(
      gebruiker.organisaties.map(
        (relatie) =>
          relatie.rol.naam,
      ),
    ),
  );

  const medewerker =
    gebruiker.medewerker;

  const topbarGebruiker = {
    naam: gebruiker.naam,
    rollen,
  };

  return (
    <div className="flex min-h-screen min-w-0 bg-slate-50">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          gebruiker={topbarGebruiker}
        />

        <main className="flex-1 overflow-auto p-4 md:p-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8">
              <h1 className="text-2xl font-semibold text-slate-900">
                Mijn profiel
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Bekijk en beheer je persoonlijke gegevens.
              </p>
            </div>

            {!medewerker ? (
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
            ) : (
              <div className="space-y-6">
                <Card
                  title="Persoonsgegevens"
                  description="Gegevens die je zelf kunt beheren."
                >
                  <ProfielGegevensForm
                    gegevens={{
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
                      email:
                        medewerker.email,
                      telefoon:
                        medewerker.telefoon,
                    }}
                  />
                </Card>

                <div className="grid gap-6 lg:grid-cols-2">
                  <Card
                    title="Account"
                    description="Gegevens van je gebruikersaccount."
                  >
                    <div className="space-y-5">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Accountnaam
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
                          Rol
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

                        <p className="mt-4 text-sm text-slate-500">
                          Wachtwoord wijzigen wordt later als aparte functie toegevoegd.
                        </p>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}