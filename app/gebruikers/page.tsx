import { prisma } from "@/lib/prisma";

import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";

export default async function GebruikersPage() {
  const gebruikers = await prisma.systeemGebruiker.findMany({
    include: {
      organisaties: {
        include: {
          rol: true,
          organisatie: true,
        },
      },
    },
    orderBy: {
      naam: "asc",
    },
  });

  return (
    <main>
      <PageHeader title="Gebruikers" />

      <Card>
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="py-3 text-left">Naam</th>
              <th className="text-left">E-mail</th>
              <th className="text-left">Rollen</th>
              <th className="text-left">Status</th>
            </tr>
          </thead>

          <tbody>
            {gebruikers.map((gebruiker) => {
              const rollen = Array.from(
                new Set(
                  gebruiker.organisaties.map(
                    (relatie) => relatie.rol.naam,
                  ),
                ),
              );

              return (
                <tr
                  key={gebruiker.id}
                  className="border-b last:border-0"
                >
                  <td className="py-3">{gebruiker.naam}</td>
                  <td>{gebruiker.email}</td>
                  <td>{rollen.join(", ")}</td>
                  <td>
                    {gebruiker.actief ? (
                      <span className="rounded-full bg-green-100 px-3 py-1 text-sm text-green-700">
                        Actief
                      </span>
                    ) : (
                      <span className="rounded-full bg-red-100 px-3 py-1 text-sm text-red-700">
                        Inactief
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}

            {gebruikers.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="py-8 text-center text-gray-500"
                >
                  Geen systeemgebruikers gevonden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </main>
  );
}