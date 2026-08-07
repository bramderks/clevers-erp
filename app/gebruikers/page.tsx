import { prisma } from "@/lib/prisma";

import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";

export default async function GebruikersPage() {
  const gebruikers = await prisma.gebruiker.findMany({
    include: {
      vestiging: true,
      rollen: {
        include: {
          rol: true,
        },
      },
    },
    orderBy: {
      naam: "asc",
    },
  });

  return (
    <main>
      <PageHeader
        title="Gebruikers"
        subtitle="Beheer gebruikers en rechten."
      />

      <Card>

        <table className="w-full">

          <thead>

            <tr className="border-b">

              <th className="py-3 text-left">Naam</th>

              <th className="text-left">E-mail</th>

              <th className="text-left">Vestiging</th>

              <th className="text-left">Rol</th>

              <th className="text-left">Status</th>

            </tr>

          </thead>

          <tbody>

            {gebruikers.map((gebruiker) => (

              <tr
                key={gebruiker.id}
                className="border-b last:border-0"
              >

                <td className="py-3">
                  {gebruiker.naam}
                </td>

                <td>
                  {gebruiker.email}
                </td>

                <td>
                  {gebruiker.vestiging?.naam ?? "-"}
                </td>

                <td>
                  {gebruiker.rollen
                    .map((r) => r.rol.naam)
                    .join(", ")}
                </td>

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

            ))}

          </tbody>

        </table>

      </Card>

    </main>
  );
}