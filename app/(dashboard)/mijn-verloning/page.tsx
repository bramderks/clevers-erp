import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import MijnVerloningAkkoordButton from "./MijnVerloningAkkoordButton";

function formatUren(uren: number) {
  return uren
    .toFixed(2)
    .replace(".", ",");
}

export default async function MijnVerloningPage() {
  const gebruiker = await getCurrentUser();

  if (!gebruiker) {
    redirect("/login");
  }

  const medewerkerId =
    gebruiker.medewerker?.id;

  if (!medewerkerId) {
    redirect("/dashboard");
  }

  const periode =
    await prisma.verloningsPeriode.findFirst({
      where: {
        regels: {
          some: {
            medewerkerId,
          },
        },
      },
      orderBy: [
        {
          jaar: "desc",
        },
        {
          maand: "desc",
        },
      ],
      include: {
        regels: {
          where: {
            medewerkerId,
          },
          include: {
            vestiging: {
              select: {
                naam: true,
              },
            },
          },
          orderBy: {
            vestiging: {
              naam: "asc",
            },
          },
        },
        controles: {
          where: {
            medewerkerId,
          },
          select: {
            id: true,
            status: true,
            gecontroleerdOp: true,
            automatischAkkoordOp: true,
          },
        },
      },
    });

  const controle =
    periode?.controles[0] ?? null;

  const totaalDagen =
    periode?.regels.reduce(
      (totaal, regel) =>
        totaal + regel.gewerkteDagen,
      0,
    ) ?? 0;

  const totaalUren =
    periode?.regels.reduce(
      (totaal, regel) =>
        totaal + Number(regel.gewerkteUren),
      0,
    ) ?? 0;

  const vandaag = new Date();

  const controleOpen =
    periode?.status === "KLAAR" &&
    periode.controleStart !== null &&
    periode.controleDeadline !== null &&
    vandaag >= periode.controleStart &&
    vandaag <= periode.controleDeadline;

  const periodeNaam = periode
    ? new Intl.DateTimeFormat(
        "nl-NL",
        {
          month: "long",
          year: "numeric",
        },
      ).format(
        new Date(
          periode.jaar,
          periode.maand - 1,
          1,
        ),
      )
    : null;

  return (
    <main className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Mijn verloning
        </h1>

        <p className="mt-1 text-sm text-slate-600">
          Overzicht van jouw gewerkte dagen en uren.
        </p>
      </div>

      {!periode ? (
        <div className="rounded-xl border bg-white p-8 text-center shadow-sm">
          <p className="font-medium text-slate-900">
            Nog geen verloning beschikbaar
          </p>

          <p className="mt-1 text-sm text-slate-500">
            Zodra jouw eerste verloningsperiode is
            gegenereerd, verschijnt deze hier.
          </p>
        </div>
      ) : (
        <>
          <section className="rounded-xl border bg-white shadow-sm">
            <div className="border-b bg-slate-50 px-6 py-5">
              <h2 className="font-semibold capitalize text-slate-900">
                {periodeNaam}
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Jouw totaaloverzicht voor deze
                verloningsperiode.
              </p>
            </div>

            <div className="grid gap-5 p-6 sm:grid-cols-3">
              <div>
                <p className="text-xs text-slate-500">
                  Gewerkte dagen
                </p>
                <p className="mt-1 text-xl font-semibold text-slate-900">
                  {totaalDagen}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500">
                  Gewerkte uren
                </p>
                <p className="mt-1 text-xl font-semibold text-slate-900">
                  {formatUren(totaalUren)}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500">
                  Status
                </p>
                <p className="mt-1 text-xl font-semibold text-slate-900">
                  {controle?.status === "AKKOORD"
                    ? "Akkoord"
                    : controle?.status ===
                        "AUTOMATISCH_AKKOORD"
                      ? "Automatisch akkoord"
                      : periode.status === "VERWERKT"
                        ? "Verwerkt"
                        : "Open"}
                </p>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
            <div className="border-b bg-slate-50 px-6 py-5">
              <h2 className="font-semibold text-slate-900">
                Mijn uren per vestiging
              </h2>
            </div>

            <div className="divide-y divide-slate-100">
              {periode.regels.map((regel) => (
                <div
                  key={regel.id}
                  className="flex items-center justify-between gap-6 px-6 py-5"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {regel.vestiging.naam}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {regel.gewerkteDagen} gewerkte dagen
                    </p>
                  </div>

                  <p className="font-semibold text-slate-900">
                    {formatUren(
                      Number(regel.gewerkteUren),
                    )} uur
                  </p>
                </div>
              ))}
            </div>
          </section>

          {controleOpen &&
            controle?.status === "OPEN" && (
              <MijnVerloningAkkoordButton
                periodeId={periode.id}
              />
            )}
        </>
      )}
    </main>
  );
}
