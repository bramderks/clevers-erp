import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";

import { getCurrentUser } from "@/lib/auth";

type DashboardLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default async function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const gebruiker =
    await getCurrentUser();

  const topbarGebruiker = gebruiker
    ? {
        naam: gebruiker.naam,
        rollen: Array.from(
          new Set(
            gebruiker.organisaties.map(
              (relatie) =>
                relatie.rol.naam,
            ),
          ),
        ),
      }
    : {
        naam: "Gast",
        rollen: [],
      };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          gebruiker={topbarGebruiker}
        />

        <main className="min-w-0 flex-1 overflow-auto p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}