import { redirect } from "next/navigation";
import Link from "next/link";
import { CheckSquare } from "lucide-react";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AppTakenPage() {
  const gebruiker = await getCurrentUser();

  if (!gebruiker) {
    redirect("/login?redirect=/app/taken");
  }

  const taken = await prisma.todo.findMany({
    where: {
      gebruikerId: gebruiker.id,
      afgerond: false,
    },
    orderBy: [
      { deadline: "asc" },
      { aangemaaktOp: "desc" },
    ],
    take: 50,
  });

  return (
    <main className="min-h-screen bg-slate-100 pb-10">
      <header className="border-b border-slate-200 bg-white px-5 py-4">
        <div className="mx-auto max-w-lg">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Clevers</p>
          <h1 className="text-xl font-bold text-slate-900">Mijn taken</h1>
        </div>
      </header>
      <div className="mx-auto max-w-lg space-y-3 px-4 py-5">
        {taken.length === 0 ? (
          <section className="rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
            <CheckSquare className="mx-auto text-slate-400" size={28} />
            <p className="mt-3 font-semibold text-slate-900">Geen openstaande taken</p>
          </section>
        ) : (
          taken.map((taak) => (
            <Link key={taak.id} href={taak.link ?? "/app"} className="block rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <p className="font-semibold text-slate-900">{taak.titel}</p>
              {taak.omschrijving && <p className="mt-1 text-sm text-slate-500">{taak.omschrijving}</p>}
              {taak.deadline && <p className="mt-3 text-xs font-medium text-slate-400">Deadline: {new Intl.DateTimeFormat("nl-NL",{day:"2-digit",month:"long",year:"numeric"}).format(taak.deadline)}</p>}
            </Link>
          ))
        )}
      </div>
    </main>
  );
}
