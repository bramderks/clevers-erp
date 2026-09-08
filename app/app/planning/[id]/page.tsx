import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteProps = {
  params: Promise<{
    id: string;
  }>;
};

function formatDatum(datum: Date) {
  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(datum);
}

function formatTijd(datum: Date) {
  return new Intl.DateTimeFormat("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(datum);
}

function statusLabel(status: string) {
  switch (status) {
    case "GEPLAND":
      return "Gepland";
    case "BEVESTIGD":
      return "Bevestigd";
    case "AFGEZEGD":
      return "Afgezegd";
    case "GEWERKT":
      return "Gewerkt";
    default:
      return status;
  }
}

export default async function AppDienstDetailsPage({ params }: RouteProps) {
  const gebruiker = await getCurrentUser();

  if (!gebruiker) {
    redirect("/login?redirect=/app/planning");
  }

  const medewerkerId = gebruiker.medewerker?.id;

  if (!medewerkerId) {
    redirect("/app");
  }

  const { id } = await params;

  const bezetting = await prisma.dienstBezetting.findFirst({
    where: {
      id,
      medewerkerId,
    },
    select: {
      id: true,
      status: true,
      dienst: {
        select: {
          id: true,
          datum: true,
          begintijd: true,
          eindtijd: true,
          opmerkingen: true,
          week: {
            select: {
              vestiging: {
                select: {
                  naam: true,
                },
              },
            },
          },
          tags: {
            orderBy: {
              tag: {
                volgorde: "asc",
              },
            },
            select: {
              id: true,
              aantal: true,
              tag: {
                select: {
                  id: true,
                  naam: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!bezetting) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-6">
        <section className="mx-auto max-w-lg rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h1 className="text-xl font-bold text-slate-900">
            Dienst niet gevonden
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Deze dienst is niet beschikbaar in jouw planning.
          </p>
          <Link
            href="/app/planning"
            className="mt-5 inline-flex rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
          >
            Terug naar mijn planning
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 pb-10">
      <header className="border-b border-slate-200 bg-white px-5 py-4">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Mijn planning
            </p>
            <h1 className="text-xl font-bold text-slate-900">
              Dienstdetails
            </h1>
          </div>
          <Link
            href="/app/planning"
            className="text-sm font-semibold text-slate-700"
          >
            Terug
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-lg space-y-4 px-4 py-5">
        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <p className="font-bold capitalize text-slate-900">
            {formatDatum(bezetting.dienst.datum)}
          </p>

          <p className="mt-2 text-sm text-slate-500">
            {bezetting.dienst.week.vestiging.naam}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Begintijd
              </p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {formatTijd(bezetting.dienst.begintijd)}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Eindtijd
              </p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {formatTijd(bezetting.dienst.eindtijd)}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Status
            </p>
            <p className="mt-1 font-semibold text-slate-900">
              {statusLabel(bezetting.status)}
            </p>
          </div>
        </section>

        {bezetting.dienst.tags.length > 0 && (
          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-base font-bold text-slate-900">
              Planningtags
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {bezetting.dienst.tags.map((dienstTag) => (
                <span
                  key={dienstTag.id}
                  className="rounded-full bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700"
                >
                  {dienstTag.tag.naam} × {dienstTag.aantal}
                </span>
              ))}
            </div>
          </section>
        )}

        {bezetting.dienst.opmerkingen && (
          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-base font-bold text-slate-900">
              Opmerkingen
            </h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
              {bezetting.dienst.opmerkingen}
            </p>
          </section>
        )}

        {(bezetting.status === "GEPLAND" ||
          bezetting.status === "BEVESTIGD") && (
          <Link
            href={
              "/app/ruilen?dienstBezettingId=" +
              encodeURIComponent(bezetting.id)
            }
            className="block rounded-2xl bg-slate-900 px-4 py-4 text-center text-sm font-semibold text-white"
          >
            Dienst ruilen
          </Link>
        )}
      </div>
    </main>
  );
}
