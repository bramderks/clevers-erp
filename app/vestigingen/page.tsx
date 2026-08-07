import { prisma } from "@/lib/prisma";
import NieuweVestigingForm from "@/components/vestigingen/NieuweVestigingForm";

export default async function VestigingenPage() {
  const vestigingen = await prisma.vestiging.findMany({
    orderBy: {
      naam: "asc",
    },
  });

  return (
    <main className="mx-auto max-w-5xl p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">
          Vestigingen
        </h1>

        <p className="text-gray-500">
          Beheer alle vestigingen.
        </p>
      </div>

      <NieuweVestigingForm />

      <div className="mt-8 rounded-xl border bg-white shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="p-3 text-left">Code</th>
              <th className="p-3 text-left">Naam</th>
              <th className="p-3 text-left">Actief</th>
            </tr>
          </thead>

          <tbody>
            {vestigingen.map((vestiging) => (
              <tr
                key={vestiging.id}
                className="border-b"
              >
                <td className="p-3">
                  {vestiging.code}
                </td>

                <td className="p-3">
                  {vestiging.naam}
                </td>

                <td className="p-3">
                  {vestiging.actief ? "Ja" : "Nee"}
                </td>
              </tr>
            ))}

            {vestigingen.length === 0 && (
              <tr>
                <td
                  colSpan={3}
                  className="p-6 text-center text-gray-500"
                >
                  Nog geen vestigingen aanwezig.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}