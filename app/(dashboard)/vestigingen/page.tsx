import { prisma } from "@/lib/prisma";

import NieuweVestigingForm from "@/components/vestigingen/NieuweVestigingForm";
import VestigingSeizoenForm from "@/components/vestigingen/VestigingSeizoenForm";

import { vereisEigenaar } from "@/lib/requirePermission";

function formatteerDatum(
  datum: Date | null,
) {
  if (!datum) {
    return "Niet ingesteld";
  }

  return new Intl.DateTimeFormat(
    "nl-NL",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    },
  ).format(datum);
}

export default async function VestigingenPage() {
  await vereisEigenaar();

  const vestigingen =
    await prisma.vestiging.findMany({
      orderBy: {
        naam: "asc",
      },
    });

  return (
    <main className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Vestigingen
        </h1>

        <p className="mt-1 text-gray-500">
          Beheer alle vestigingen en hun
          planningsseizoen.
        </p>
      </div>

      <NieuweVestigingForm />

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="border-b px-4 py-4">
          <h2 className="text-base font-semibold text-gray-900">
            Vestigingen
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Het seizoen bepaalt
            automatisch welke
            planningweken beschikbaar
            zijn.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="p-3 text-left text-sm font-medium text-gray-700">
                  Code
                </th>

                <th className="p-3 text-left text-sm font-medium text-gray-700">
                  Naam
                </th>

                <th className="p-3 text-left text-sm font-medium text-gray-700">
                  Seizoen
                </th>

                <th className="p-3 text-left text-sm font-medium text-gray-700">
                  Actief
                </th>

                <th className="p-3 text-left text-sm font-medium text-gray-700">
                  Seizoen instellen
                </th>
              </tr>
            </thead>

            <tbody>
              {vestigingen.map(
                (vestiging) => (
                  <tr
                    key={vestiging.id}
                    className="border-b last:border-b-0"
                  >
                    <td className="p-3 align-top text-sm text-gray-900">
                      {
                        vestiging.code
                      }
                    </td>

                    <td className="p-3 align-top text-sm font-medium text-gray-900">
                      {
                        vestiging.naam
                      }
                    </td>

                    <td className="p-3 align-top text-sm text-gray-600">
                      {vestiging.seizoenStart ||
                      vestiging.seizoenEinde ? (
                        <span>
                          {formatteerDatum(
                            vestiging.seizoenStart,
                          )}{" "}
                          t/m{" "}
                          {formatteerDatum(
                            vestiging.seizoenEinde,
                          )}
                        </span>
                      ) : (
                        <span className="text-gray-400">
                          Niet ingesteld
                        </span>
                      )}
                    </td>

                    <td className="p-3 align-top text-sm text-gray-600">
                      {vestiging.actief
                        ? "Ja"
                        : "Nee"}
                    </td>

                    <td className="p-3 align-top">
                      <VestigingSeizoenForm
                        vestigingId={
                          vestiging.id
                        }
                        seizoenStart={
                          vestiging.seizoenStart
                            ? vestiging.seizoenStart.toISOString()
                            : null
                        }
                        seizoenEinde={
                          vestiging.seizoenEinde
                            ? vestiging.seizoenEinde.toISOString()
                            : null
                        }
                      />
                    </td>
                  </tr>
                ),
              )}

              {vestigingen.length ===
                0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="p-6 text-center text-sm text-gray-500"
                  >
                    Nog geen
                    vestigingen
                    aanwezig.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}