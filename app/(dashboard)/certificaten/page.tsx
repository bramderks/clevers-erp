import { redirect } from "next/navigation";

import { getCurrentUser, isEigenaar } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function CertificatenPage() {
  const gebruiker = await getCurrentUser();
  if (!gebruiker) redirect("/login");
  if (!(await isEigenaar())) redirect("/dashboard");

  const grens = new Date();
  grens.setDate(grens.getDate() + 60);

  const documenten = await prisma.medewerkerDocument.findMany({
    where: {
      verloopDatum: { not: null, lte: grens },
    },
    orderBy: { verloopDatum: "asc" },
    include: {
      medewerker: { select: { voornaam: true, achternaam: true } },
    },
  });

  return (
    <main className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">Eigenaar</p>
        <h1 className="text-2xl font-bold text-slate-900">Certificaten & documenten</h1>
        <p className="mt-1 text-sm text-slate-600">
          Overzicht van documenten die binnen 60 dagen verlopen of al verlopen zijn.
        </p>
      </div>

      <section className="rounded-2xl border bg-white shadow-sm">
        {documenten.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">Geen verlopen of binnenkort verlopende documenten.</div>
        ) : (
          <div className="divide-y">
            {documenten.map((document) => {
              const verlopen = document.verloopDatum && document.verloopDatum < new Date();
              return (
                <article key={document.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <div>
                    <p className="font-bold text-slate-900">{document.naam}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {document.medewerker.voornaam} {document.medewerker.achternaam} · {document.categorie}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={verlopen ? "font-bold text-red-600" : "font-semibold text-amber-600"}>
                      {verlopen ? "VERLOPEN" : "Verloopt binnenkort"}
                    </p>
                    <p className="text-sm text-slate-500">
                      {new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium" }).format(document.verloopDatum!)}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
