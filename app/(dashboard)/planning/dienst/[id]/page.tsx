import { redirect } from "next/navigation";
import { format } from "date-fns";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import DienstBewerkToggle from "@/components/planning/DienstBewerkToggle";

type RouteProps = {
params: Promise<{
id: string;
}>;
};

function formatTime(date: Date) {
return format(date, "HH");
}

function formatDate(date: Date) {
return format(date, "dd MMMM yyyy");
}

function formatName(medewerker: {
voornaam: string;
tussenvoegsel: string | null;
achternaam: string;
}) {
return [
medewerker.voornaam,
medewerker.tussenvoegsel,
medewerker.achternaam,
]
.filter(Boolean)
.join(" ");
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

function statusKlassen(status: string) {
switch (status) {
case "BEVESTIGD":
case "GEWERKT":
return "border-emerald-200 bg-emerald-50 text-emerald-800";

case "GEPLAND":
  return "border-amber-300 bg-amber-100 text-amber-800";

case "AFGEZEGD":
  return "border-slate-200 bg-slate-100 text-slate-500";

default:
  return "border-slate-200 bg-slate-100 text-slate-600";

}
}

export default async function DienstPagina({
params,
}: RouteProps) {
const gebruiker = await getCurrentUser();

if (!gebruiker) {
redirect("/login");
}

const { id } = await params;

if (!id) {
return (
<main className="rounded-xl border bg-white p-6 shadow-sm">
<h1 className="text-2xl font-semibold text-slate-900">
Dienst niet gevonden
</h1>

    <p className="mt-2 text-sm text-slate-600">
      Er is geen geldig dienst-ID ontvangen.
    </p>
  </main>
);

}

/*

============================================================
ACTIEVE ORGANISATIES
============================================================
*/

const organisaties =
gebruiker.organisaties.filter(
(relatie) =>
relatie.actief &&
relatie.organisatie.actief,
);

const organisatieIds =
Array.from(
new Set(
organisaties.map(
(relatie) =>
relatie.organisatieId,
),
),
);

/*

============================================================
ROLLEN
============================================================


Eigenaar is organisatiebreed.


Teamleider heeft uitsluitend toegang tot
expliciet gekoppelde vestigingen.


Medewerker heeft uitsluitend toegang tot
vestigingen waaraan het medewerkerrecord
gekoppeld is.
*/

const isEigenaar =
organisaties.some(
(relatie) =>
relatie.rol.naam
.trim()
.toLowerCase() ===
"eigenaar",
);

const isTeamleider =
organisaties.some(
(relatie) =>
relatie.rol.naam
.trim()
.toLowerCase() ===
"teamleider",
);

const isMedewerker =
gebruiker.medewerker?.id != null;

/*

============================================================
DIENST OPHALEN
============================================================
*/

const dienst =
await prisma.dienst.findUnique({
where: {
id,
},

  include: {
    week: {
      select: {
        id: true,
        vestigingId: true,

        vestiging: {
          select: {
            id: true,
            naam: true,
            actief: true,
            organisatieId: true,
          },
        },
      },
    },

    tags: {
      include: {
        tag: true,
      },

      orderBy: {
        tag: {
          volgorde: "asc",
        },
      },
    },

    bezetting: {
      include: {
        medewerker: {
          select: {
            id: true,
            personeelsnummer: true,
            aanhef: true,
            voornaam: true,
            tussenvoegsel: true,
            achternaam: true,
          },
        },
      },

      orderBy: {
        aangemaaktOp: "asc",
      },
    },
  },
});

if (!dienst) {
return (
<main className="rounded-xl border bg-white p-6 shadow-sm">
<h1 className="text-2xl font-semibold text-slate-900">
Dienst niet gevonden
</h1>

    <p className="mt-3 text-sm text-slate-600">
      De gevraagde dienst bestaat niet of is niet meer beschikbaar.
    </p>
  </main>
);

}

/*

============================================================
ORGANISATIETOEGANG
============================================================


Niemand mag een dienst openen van een
organisatie waarvoor hij geen actieve
toegang heeft.
*/

const organisatieToegankelijk =
organisatieIds.includes(
dienst.week.vestiging
.organisatieId,
);

if (!organisatieToegankelijk) {
return (
<main className="rounded-xl border bg-white p-6 shadow-sm">
<h1 className="text-2xl font-semibold text-slate-900">
Geen toegang
</h1>

    <p className="mt-2 text-sm text-slate-600">
      Je hebt geen toegang tot deze dienst.
    </p>
  </main>
);

}

/*

============================================================
VESTIGINGSTOEGANG
============================================================
*/

let heeftVestigingToegang =
false;

/*

Eigenaar:
alle actieve vestigingen binnen de
toegankelijke organisatie.
*/

if (isEigenaar) {
heeftVestigingToegang =
dienst.week.vestiging.actief;
}

/*

Teamleider:
alleen expliciete actieve
vestigingToegang.
*/

if (
!heeftVestigingToegang &&
isTeamleider
) {
heeftVestigingToegang =
gebruiker.vestigingToegang.some(
(toegang) =>
toegang.actief &&
toegang.vestiging.actief &&
toegang.vestigingId ===
dienst.week.vestigingId,
);
}

/*

Medewerker:
alleen vestigingen die gekoppeld zijn
aan het medewerkerrecord.
*/

if (
!heeftVestigingToegang &&
isMedewerker
) {
const medewerker =
await prisma.medewerker.findUnique({
where: {
id: gebruiker.medewerker!.id,
},

    select: {
      id: true,
      actief: true,

      vestigingen: {
        where: {
          vestigingId:
            dienst.week.vestigingId,

          vestiging: {
            actief: true,
          },
        },

        select: {
          vestigingId: true,
        },
      },
    },
  });

heeftVestigingToegang =
  Boolean(
    medewerker?.actief &&
      medewerker.vestigingen.length >
        0,
  );

}

if (!heeftVestigingToegang) {
return (
<main className="rounded-xl border bg-white p-6 shadow-sm">
<h1 className="text-2xl font-semibold text-slate-900">
Geen toegang
</h1>

    <p className="mt-2 text-sm text-slate-600">
      Je hebt geen toegang tot deze dienst.
    </p>
  </main>
);

}

/*

============================================================
BEWERKRECHTEN
============================================================


Alleen Eigenaar mag daadwerkelijk
gegevens van een dienst wijzigen.


Teamleider:
volledig bekijken.


Medewerker:
relevante dienstgegevens bekijken.
*/

const magBewerken =
isEigenaar;

/*

============================================================
EIGEN BEZETTING
============================================================
*/

const eigenBezetting =
isMedewerker
? dienst.bezetting.find(
(bezetting) =>
bezetting.medewerker?.id ===
gebruiker.medewerker?.id,
) ?? null
: null;

return (
<main className="space-y-6">
{/* ======================================================
HEADER
====================================================== */}

  <section className="rounded-xl border bg-white p-6 shadow-sm">
    <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Dienst
        </p>

        <h1 className="mt-2 text-3xl font-semibold text-slate-900">
          {formatDate(
            dienst.datum,
          )}
        </h1>

        <p className="mt-2 text-sm text-slate-600">
          {formatTime(
            dienst.begintijd,
          )}{" "}
          -{" "}
          {formatTime(
            dienst.eindtijd,
          )}
        </p>
      </div>

      <div className="rounded-2xl bg-slate-50 px-5 py-4 text-sm text-slate-700">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Vestiging
        </p>

        <p className="mt-1 text-base font-semibold text-slate-900">
          {
            dienst.week.vestiging
              .naam
          }
        </p>
      </div>
    </div>

    <div className="mt-6 grid gap-4 sm:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Datum
        </p>

        <p className="mt-2 text-sm font-medium text-slate-900">
          {formatDate(
            dienst.datum,
          )}
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Tijd
        </p>

        <p className="mt-2 text-sm font-medium text-slate-900">
          {formatTime(
            dienst.begintijd,
          )}{" "}
          -{" "}
          {formatTime(
            dienst.eindtijd,
          )}
        </p>
      </div>
    </div>
  </section>

  {/* ======================================================
      ACTIES — ALLEEN EIGENAAR
      ====================================================== */}

  {magBewerken && (
    <section className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Dienst beheren
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Wijzig de datum, tijden,
            planningtags, opmerkingen en
            bezetting van deze dienst.
          </p>
        </div>

        <DienstBewerkToggle
          dienst={{
            id: dienst.id,
            weekId: dienst.weekId,
            datum: dienst.datum.toISOString(),
            begintijd: dienst.begintijd.toISOString(),
            eindtijd: dienst.eindtijd.toISOString(),
            opmerkingen: dienst.opmerkingen,
            tags: dienst.tags.map((dienstTag) => ({
              id: dienstTag.id,
              dienstId: dienstTag.dienstId,
              tagId: dienstTag.tagId,
              aantal: dienstTag.aantal,
              tag: {
                id: dienstTag.tag.id,
                naam: dienstTag.tag.naam,
                volgorde: dienstTag.tag.volgorde,
                actief: dienstTag.tag.actief,
              },
            })),
            bezetting: dienst.bezetting.map((bezetting) => ({
              id: bezetting.id,
              dienstId: bezetting.dienstId,
              medewerkerId: bezetting.medewerkerId,
              status: bezetting.status as
                | "OPEN"
                | "GEPLAND"
                | "BEVESTIGD"
                | "AFGEZEGD"
                | "GEWERKT",
              medewerker: bezetting.medewerker
                ? {
                    id: bezetting.medewerker.id,
                    personeelsnummer:
                      bezetting.medewerker.personeelsnummer,
                    aanhef: bezetting.medewerker.aanhef,
                    voornaam: bezetting.medewerker.voornaam,
                    tussenvoegsel:
                      bezetting.medewerker.tussenvoegsel,
                    achternaam:
                      bezetting.medewerker.achternaam,
                    tags: [],
                  }
                : null,
            })),
          }}
          vestigingId={
            dienst.week.vestigingId
          }
        />
      </div>
    </section>
  )}

  {/* ======================================================
      TAGS
      ====================================================== */}

  <section className="rounded-xl border bg-white p-6 shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">
          Tags
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          De planningtags voor deze dienst.
        </p>
      </div>

      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
        {dienst.tags.length}{" "}
        {dienst.tags.length === 1
          ? "tag"
          : "tags"}
      </span>
    </div>

    {dienst.tags.length === 0 ? (
      <p className="mt-4 text-sm text-slate-500">
        Geen tags gekoppeld.
      </p>
    ) : (
      <div className="mt-4 flex flex-wrap gap-2">
        {dienst.tags.map(
          (dienstTag) => (
            <span
              key={dienstTag.id}
              className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700"
            >
              {
                dienstTag.tag.naam
              }{" "}
              × {
                dienstTag.aantal
              }
            </span>
          ),
        )}
      </div>
    )}
  </section>

  {/* ======================================================
      BEZETTING
      ====================================================== */}

  <section className="rounded-xl border bg-white p-6 shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">
          Bezetting
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Medewerkers gekoppeld aan deze
          dienst.
        </p>
      </div>

      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
        {
          dienst.bezetting.length
        }{" "}
        {dienst.bezetting.length ===
        1
          ? "persoon"
          : "personen"}
      </span>
    </div>

    {dienst.bezetting.length ===
    0 ? (
      <p className="mt-4 text-sm text-slate-500">
        Er is nog geen bezetting
        toegevoegd.
      </p>
    ) : (
      <div className="mt-4 grid gap-3">
        {dienst.bezetting.map(
          (bezetting) => (
            <div
              key={bezetting.id}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {bezetting.medewerker
                      ? formatName(
                          bezetting.medewerker,
                        )
                      : "Open positie"}
                  </p>

                  {bezetting.medewerker
                    ?.personeelsnummer && (
                    <p className="mt-1 text-xs text-slate-500">
                      Personeelsnummer:{" "}
                      {
                        bezetting
                          .medewerker
                          .personeelsnummer
                      }
                    </p>
                  )}
                </div>

                <span
                  className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusKlassen(
                    bezetting.status,
                  )}`}
                >
                  {statusLabel(
                    bezetting.status,
                  )}
                </span>
              </div>
            </div>
          ),
        )}
      </div>
    )}
  </section>

  {/* ======================================================
      MEDEWERKER / EIGEN PLANNING
      ====================================================== */}

  {isMedewerker &&
    !magBewerken && (
      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Mijn planning
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Je kunt deze dienst bekijken,
              maar niet rechtstreeks
              wijzigen.
            </p>
          </div>

          <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
            Leesmodus
          </span>
        </div>

        {eigenBezetting && (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm font-semibold text-emerald-800">
              Je bent ingepland op deze
              dienst.
            </p>

            <p className="mt-1 text-sm text-emerald-700">
              Status:{" "}
              {statusLabel(
                eigenBezetting.status,
              )}
            </p>
          </div>
        )}
      </section>
    )}

  {/* ======================================================
      TEAMLEIDER — LEESMODUS
      ====================================================== */}

  {isTeamleider &&
    !isEigenaar && (
      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Planning bekijken
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Je hebt volledige inzage in
              deze dienst, maar kunt de
              dienst niet wijzigen.
            </p>
          </div>

          <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
            Leesmodus
          </span>
        </div>
      </section>
    )}

  {/* ======================================================
      OPMERKINGEN
      ====================================================== */}

  {dienst.opmerkingen && (
    <section className="rounded-xl border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">
        Opmerkingen
      </h2>

      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
        {dienst.opmerkingen}
      </p>
    </section>
  )}
</main>

);
}