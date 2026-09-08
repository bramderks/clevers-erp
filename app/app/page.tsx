import { redirect } from "next/navigation";
import Link from "next/link";
import {
  CalendarDays,
  ClipboardClock,
  UserRound,
  WalletCards,
  CheckSquare,
  ArrowLeftRight,
  Palmtree,
  ClipboardCheck,
} from "lucide-react";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PushNotificationButton from "@/components/app/PushNotificationButton";

function formatUren(uren: number) {
  return uren.toFixed(2).replace(".", ",");
}

function formatDatum(datum: Date) {
  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(datum);
}

export default async function MedewerkerAppPage() {
  const gebruiker = await getCurrentUser();

  if (!gebruiker) {
    redirect("/login?redirect=/app");
  }

  const medewerkerId = gebruiker.medewerker?.id;

  if (!medewerkerId) {
    redirect("/dashboard");
  }

  const vandaag = new Date();

  const isEigenaar = gebruiker.organisaties.some(
    (relatie) =>
      relatie.actief &&
      relatie.organisatie.actief &&
      relatie.rol.naam.trim().toLowerCase() === "eigenaar",
  );

  const [
    aankomendeDiensten,
    openBeschikbaarheid,
    laatsteVerloning,
  ] = await Promise.all([
    prisma.dienstBezetting.findMany({
      where: {
        medewerkerId,
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
      take: 3,
    }),
    prisma.week.findMany({
      where: {
        beschikbaarheidDeadline: {
          gt: vandaag,
        },
        vestiging: {
          medewerkers: {
            some: {
              medewerkerId,
            },
          },
        },
      },
      select: {
        id: true,
        jaar: true,
        weeknummer: true,
        vestiging: {
          select: {
            naam: true,
          },
        },
        beschikbaarheden: {
          where: {
            medewerkerId,
          },
          select: {
            id: true,
          },
        },
      },
      orderBy: [
        { jaar: "asc" },
        { weeknummer: "asc" },
      ],
      take: 3,
    }),
    prisma.verloningsPeriode.findFirst({
      where: {
        regels: {
          some: {
            medewerkerId,
          },
        },
      },
      orderBy: [
        { jaar: "desc" },
        { maand: "desc" },
      ],
      select: {
        jaar: true,
        maand: true,
        status: true,
        regels: {
          where: {
            medewerkerId,
          },
          select: {
            gewerkteDagen: true,
            gewerkteUren: true,
          },
        },
      },
    }),
  ]);

  const totaalDagen =
    laatsteVerloning?.regels.reduce(
      (totaal, regel) => totaal + regel.gewerkteDagen,
      0,
    ) ?? 0;

  const totaalUren =
    laatsteVerloning?.regels.reduce(
      (totaal, regel) =>
        totaal + Number(regel.gewerkteUren),
      0,
    ) ?? 0;

  return (
    <main className="min-h-screen bg-slate-100 pb-24">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Clevers
            </p>
            <h1 className="text-xl font-bold text-slate-900">
              Hallo {gebruiker.naam.split(" ")[0]}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <PushNotificationButton />
          <Link
            href="/app/profiel"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-white"
            aria-label="Mijn profiel"
          >
            <UserRound size={20} />
          </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-lg space-y-5 px-4 py-5">
        <section className="grid grid-cols-2 gap-3">
          <Link
            href="/app/beschikbaarheid"
            className="rounded-3xl bg-slate-900 p-5 text-white shadow-sm"
          >
            <ClipboardClock size={24} />
            <p className="mt-8 text-sm text-slate-300">
              Beschikbaarheid
            </p>
            <p className="mt-1 text-lg font-bold">
              Doorgeven
            </p>
          </Link>

          <Link
            href="/app/verloning"
            className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
          >
            <WalletCards
              size={24}
              className="text-slate-700"
            />
            <p className="mt-8 text-sm text-slate-500">
              Mijn verloning
            </p>
            <p className="mt-1 text-lg font-bold text-slate-900">
              Bekijk overzicht
            </p>
          </Link>
        </section>

        {laatsteVerloning && (
          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-medium text-slate-500">
              Laatste verloning
            </p>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-3xl font-bold text-slate-900">
                  {totaalDagen}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  gewerkte dagen
                </p>
              </div>
              <div>
                <p className="text-3xl font-bold text-slate-900">
                  {formatUren(totaalUren)}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  gewerkte uren
                </p>
              </div>
            </div>
          </section>
        )}

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-900">
                Beschikbaarheid
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Openstaande weken
              </p>
            </div>
            <ClipboardClock
              size={22}
              className="text-slate-400"
            />
          </div>

          <div className="mt-4 space-y-3">
            {openBeschikbaarheid.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                Je hebt momenteel geen openstaande weken.
              </p>
            ) : (
              openBeschikbaarheid.map((week) => (
                <Link
                  key={week.id}
                  href="/app/beschikbaarheid"
                  className="block rounded-2xl bg-slate-50 p-4 transition hover:bg-slate-100"
                >
                  <p className="font-semibold text-slate-900">
                    Week {week.weeknummer} · {week.jaar}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {week.vestiging.naam}
                  </p>
                </Link>
              ))
            )}
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <Link href="/app/planning" className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <CalendarDays size={24} className="text-slate-700" />
            <p className="mt-8 text-sm text-slate-500">Planning</p>
            <p className="mt-1 text-lg font-bold text-slate-900">Mijn diensten</p>
          </Link>

          <Link href="/app/vakantie" className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <Palmtree size={24} className="text-slate-700" />
            <p className="mt-8 text-sm text-slate-500">Vakantie</p>
            <p className="mt-1 text-lg font-bold text-slate-900">Doorgeven</p>
          </Link>

          <Link href="/app/taken" className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <CheckSquare size={24} className="text-slate-700" />
            <p className="mt-8 text-sm text-slate-500">To do&apos;s</p>
            <p className="mt-1 text-lg font-bold text-slate-900">Bekijk taken</p>
          </Link>

          <Link href="/app/ruilen" className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <ArrowLeftRight size={24} className="text-slate-700" />
            <p className="mt-8 text-sm text-slate-500">Ruilverzoeken</p>
            <p className="mt-1 text-lg font-bold text-slate-900">Mijn diensten</p>
          </Link>
        </section>

        {isEigenaar && (
          <Link href="/app/afronden" className="block rounded-3xl bg-slate-900 p-5 text-white shadow-sm">
            <ClipboardCheck size={24} />
            <p className="mt-5 text-sm text-slate-300">Dagelijkse planning</p>
            <p className="mt-1 text-lg font-bold">Diensten en uren afronden</p>
          </Link>
        )}

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center gap-3">
            <CalendarDays
              size={22}
              className="text-slate-500"
            />
            <div>
              <h2 className="font-bold text-slate-900">
                Mijn komende diensten
              </h2>
              <p className="text-sm text-slate-500">
                Je eerstvolgende planning
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {aankomendeDiensten.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                Er staan momenteel geen komende diensten gepland.
              </p>
            ) : (
              aankomendeDiensten.map((bezetting) => (
                <div
                  key={bezetting.id}
                  className="rounded-2xl bg-slate-50 p-4"
                >
                  <p className="font-semibold capitalize text-slate-900">
                    {formatDatum(
                      bezetting.dienst.datum,
                    )}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {bezetting.dienst.week.vestiging.naam}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>


    </main>
  );
}
