"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

type Ruil = {
  id: string;
  status: string;
  aangevraagdOp: string;
  dienstBezetting: {
    id: string;
    dienst: {
      datum: string;
      begintijd: string;
      eindtijd: string;
      week: { vestiging: { naam: string } };
    };
  };
  aanvrager: { voornaam: string; tussenvoegsel: string | null; achternaam: string };
  ruilMedewerker: { voornaam: string; tussenvoegsel: string | null; achternaam: string };
};

function naam(persoon: Ruil["aanvrager"]) {
  return [persoon.voornaam, persoon.tussenvoegsel, persoon.achternaam]
    .filter(Boolean)
    .join(" ");
}

function fmtDatum(value: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(value));
}

export default function AppRuilenPage() {
  const searchParams = useSearchParams();
  const dienstBezettingId = searchParams.get("dienstBezettingId");
  const [items, setItems] = useState<Ruil[] | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);
  const [succes, setSucces] = useState<string | null>(null);

  async function laad() {
    setFout(null);
    try {
      const response = await fetch("/api/planning/ruilen", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.fout ?? "Ruilverzoeken konden niet worden geladen.");
      setItems(Array.isArray(data) ? data : []);
    } catch (error) {
      setFout(error instanceof Error ? error.message : "Ruilverzoeken konden niet worden geladen.");
      setItems([]);
    }
  }

  useEffect(() => {
    void laad();
  }, []);

  async function algemeenRuilverzoek() {
    if (!dienstBezettingId || bezig) return;

    setBezig(true);
    setFout(null);
    setSucces(null);

    try {
      const response = await fetch("/api/planning/ruilen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dienstBezettingId,
          algemeen: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.fout ?? "Het ruilverzoek kon niet worden verstuurd.");
      }

      const aantal =
        typeof data?.aantal === "number" ? data.aantal : 0;

      setSucces(
        aantal > 0
          ? `Je ruilverzoek is verstuurd naar ${aantal} geschikte medewerker(s).`
          : "Je ruilverzoek is verstuurd.",
      );

      await laad();
    } catch (error) {
      setFout(
        error instanceof Error
          ? error.message
          : "Het ruilverzoek kon niet worden verstuurd.",
      );
    } finally {
      setBezig(false);
    }
  }

  async function actie(ruilverzoekId: string, actie: "ACCEPTEREN" | "AFWIJZEN") {
    const response = await fetch("/api/planning/ruilen", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ruilverzoekId, actie }),
    });
    const data = await response.json();
    if (!response.ok) {
      setFout(data.fout ?? "De ruilactie kon niet worden opgeslagen.");
      return;
    }
    await laad();
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-5 pb-24">
      <div className="mx-auto max-w-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Clevers</p>
            <h1 className="mt-1 text-xl font-bold text-slate-900">Ruilverzoeken</h1>
          </div>
          <Link href="/app/planning" className="text-sm font-semibold text-slate-700">Mijn diensten</Link>
        </div>

        <p className="mt-3 text-sm text-slate-500">
          Bekijk je openstaande ruilverzoeken en accepteer of wijs verzoeken af.
        </p>

        {dienstBezettingId && (
          <section className="mt-5 rounded-3xl bg-slate-900 p-5 text-white">
            <p className="text-sm text-slate-300">Geselecteerde dienst</p>
            <h2 className="mt-1 text-lg font-bold">Dienst ruilen</h2>
            <p className="mt-2 text-sm text-slate-300">
              Verstuur een algemeen ruilverzoek. Alleen geschikte medewerkers kunnen het verzoek ontvangen en accepteren.
            </p>
            <button
              type="button"
              onClick={() => void algemeenRuilverzoek()}
              disabled={bezig}
              className="mt-4 w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {bezig ? "Versturen..." : "Stuur ruilverzoek"}
            </button>
          </section>
        )}

        {succes && <p className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-700">{succes}</p>}
        {fout && <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700">{fout}</p>}

        <div className="mt-5 space-y-3">
          {items === null ? (
            <section className="rounded-3xl bg-white p-6 text-center text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
              Laden...
            </section>
          ) : items.length === 0 ? (
            <section className="rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
              <p className="font-semibold text-slate-900">Geen ruilverzoeken</p>
              <p className="mt-1 text-sm text-slate-500">Er staan momenteel geen ruilverzoeken voor je open.</p>
            </section>
          ) : (
            items.map((item) => (
              <section key={item.id} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <p className="font-bold capitalize text-slate-900">{fmtDatum(item.dienstBezetting.dienst.datum)}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {item.dienstBezetting.dienst.week.vestiging.naam} · {naam(item.aanvrager)} → {naam(item.ruilMedewerker)}
                </p>
                <p className="mt-3 text-sm font-semibold text-slate-700">Status: {item.status}</p>

                {item.status === "AANGEVRAAGD" && (
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => void actie(item.id, "AFWIJZEN")}
                      className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
                    >
                      Afwijzen
                    </button>
                    <button
                      type="button"
                      onClick={() => void actie(item.id, "ACCEPTEREN")}
                      className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
                    >
                      Accepteren
                    </button>
                  </div>
                )}
              </section>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
