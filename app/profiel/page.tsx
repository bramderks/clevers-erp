import {
  Mail,
  Shield,
  User,
} from "lucide-react";

import { getCurrentUser } from "@/lib/auth";

import PageLayout from "@/components/ui/PageLayout";
import PageToolbar from "@/components/ui/PageToolbar";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

export default async function ProfielPage() {
  const gebruiker = await getCurrentUser();

  if (!gebruiker) {
    return null;
  }

  const rollen = Array.from(
    new Set(
      gebruiker.organisaties.map(
        (relatie) => relatie.rol.naam,
      ),
    ),
  );

  const initialen =
    gebruiker.naam
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((deel) =>
        deel.charAt(0).toUpperCase(),
      )
      .join("") || "G";

  return (
    <PageLayout>
      <PageToolbar title="Mijn profiel" />

      <div className="mb-6">
        <p className="text-sm text-slate-500">
          Bekijk en beheer je accountgegevens.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card
          title="Account"
          description="Je huidige accountgegevens."
        >
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#A8D8D8] text-xl font-bold text-slate-800">
              {initialen}
            </div>

            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-slate-900">
                {gebruiker.naam}
              </p>

              <p className="mt-1 truncate text-sm text-slate-500">
                {gebruiker.email}
              </p>
            </div>
          </div>
        </Card>

        <Card
          title="Status"
          description="De huidige status van je account."
        >
          <div className="flex items-center gap-3">
            {gebruiker.actief ? (
              <Badge variant="success">
                Actief
              </Badge>
            ) : (
              <Badge variant="danger">
                Niet actief
              </Badge>
            )}
          </div>

          {gebruiker.laatsteLoginOp && (
            <p className="mt-3 text-sm text-slate-500">
              Laatste login:{" "}
              {gebruiker.laatsteLoginOp.toLocaleString(
                "nl-NL",
              )}
            </p>
          )}
        </Card>

        <Card
          title="Rollen"
          description="Rechten die aan je account zijn gekoppeld."
        >
          {rollen.length === 0 ? (
            <p className="text-sm text-slate-500">
              Geen rollen gekoppeld.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {rollen.map((rol) => (
                <Badge
                  key={rol}
                  variant="default"
                >
                  {rol}
                </Badge>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          title="Persoonsgegevens"
          description="Gegevens die bij je account horen."
        >
          <dl className="space-y-5">
            <div className="flex items-start gap-4">
              <User
                size={20}
                className="mt-0.5 text-slate-400"
              />

              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Naam
                </dt>

                <dd className="mt-1 text-sm font-medium text-slate-900">
                  {gebruiker.naam}
                </dd>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <Mail
                size={20}
                className="mt-0.5 text-slate-400"
              />

              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  E-mailadres
                </dt>

                <dd className="mt-1 text-sm font-medium text-slate-900">
                  {gebruiker.email}
                </dd>
              </div>
            </div>
          </dl>
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
                Je wachtwoord is beveiligd
                opgeslagen.
              </p>

              <p className="mt-4 text-sm text-slate-500">
                Wachtwoord wijzigen wordt
                hier beschikbaar gemaakt.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </PageLayout>
  );
}