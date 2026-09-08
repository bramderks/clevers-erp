import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarPlus } from "lucide-react";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function formatDatum(datum: Date) {
  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(datum);
}

function formatTijd(datum: Date) {
  return new Intl.DateTimeFormat("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(datum);
}

export default async function AppPlanningPage() {
  const gebruiker = await getCurrentUser();

  if (!gebruiker) {
    redirect("/login?redirect=/app/planning");
  }

  const medewerkerId = gebruiker.medewerker?.id;

  if (!medewerkerId) {
    redirect("/app");
  }

  const vandaag = new Date();

  const diensten =
    await prisma.dienstBezetting.findMany({
      where: {
        medewerkerId,
        status: {
          in: ["GEPLAND", "BEVESTIGD"],
        },
        dienst: {
          datum: {
            gte: vandaag,
          },
        },
      },
      select: {
        id: true,
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
          },
        },
      },
      orderBy: {
        dienst: {
          datum: "asc",
        },
      },
    });

  return (
    <main className="min-h-screen bg-slate-100 pb-10">
      <header className="border-b border-slate-200 bg-white px-5 py-4">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Clevers
            </p>
            <h1 className="text-xl font-bold text-slate-900">
              Mijn planning
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/api/app/planning/agenda"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
              title="Zet mijn komende diensten in mijn agenda"
            >
              <CalendarPlus size={18} />
              Agenda
            </a>
            <Link href="/app" className="text-sm font-semibold text-slate-700">
              Terug
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-lg space-y-4 px-4 py-5">
        {diensten.length === 0 ? (
          <section className="rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
            <p className="font-semibold text-slate-900">
              Geen aankomende diensten
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Zodra je wordt ingepland verschijnen je diensten hier.
            </p>
          </section>
        ) : (
          diensten.map((bezetting) => (
            <section
              key={bezetting.id}
              className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
            >
              <p className="font-bold capitalize text-slate-900">
                {formatDatum(bezetting.dienst.datum)}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {bezetting.dienst.week.vestiging.naam}
              </p>
              <p className="mt-4 text-lg font-semibold text-slate-900">
                {formatTijd(bezetting.dienst.begintijd)} – {formatTijd(bezetting.dienst.eindtijd)}
              </p>

              {bezetting.dienst.opmerkingen && (
                <p className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">
                  {bezetting.dienst.opmerkingen}
                </p>
              )}

              <div className="mt-4 grid grid-cols-2 gap-3">
                <Link
                  href={"/app/planning/" + encodeURIComponent(bezetting.id)}
                  className="rounded-xl border border-slate-300 px-4 py-3 text-center text-sm font-semibold text-slate-700"
                >
                  Details
                </Link>
                <Link
                  href={"/app/ruilen?dienstBezettingId=" + encodeURIComponent(bezetting.id)}
                  className="rounded-xl bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white"
                >
                  Ruilen
                </Link>
              </div>
            </section>
          ))
        )}
      </div>
    </main>
  );
}
