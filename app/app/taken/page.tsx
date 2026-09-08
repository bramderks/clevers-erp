"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckSquare, LoaderCircle } from "lucide-react";

type Taak = {
  id: string;
  categorie: string;
  titel: string;
  omschrijving: string;
  actie: string;
  gegevens: Record<string, unknown>;
};

export default function AppTakenPage() {
  const [taken, setTaken] = useState<Taak[] | null>(null);

  useEffect(() => {
    fetch("/api/taken")
      .then((response) => response.ok ? response.json() : [])
      .then((data) => setTaken(Array.isArray(data) ? data : []))
      .catch(() => setTaken([]));
  }, []);

  return (
    <main className="min-h-screen bg-slate-100 pb-10">
      <header className="border-b border-slate-200 bg-white px-5 py-4">
        <div className="mx-auto max-w-lg">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Clevers</p>
          <h1 className="text-xl font-bold text-slate-900">Mijn taken</h1>
        </div>
      </header>

      <div className="mx-auto max-w-lg space-y-3 px-4 py-5">
        {taken === null ? (
          <div className="flex justify-center py-10 text-slate-400">
            <LoaderCircle className="animate-spin" size={28} />
          </div>
        ) : taken.length === 0 ? (
          <section className="rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
            <CheckSquare className="mx-auto text-slate-400" size={28} />
            <p className="mt-3 font-semibold text-slate-900">Geen openstaande taken</p>
          </section>
        ) : (
          taken.map((taak) => {
            const href =
              typeof taak.gegevens.href === "string"
                ? taak.gegevens.href
                : taak.categorie === "Verloning"
                  ? "/mijn-verloning"
                  : "/app";

            return (
              <Link key={taak.id} href={href} className="block rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{taak.categorie}</p>
                <p className="mt-1 font-semibold text-slate-900">{taak.titel}</p>
                <p className="mt-1 text-sm text-slate-500">{taak.omschrijving}</p>
              </Link>
            );
          })
        )}
      </div>
    </main>
  );
}
