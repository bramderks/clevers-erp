"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDienstDatum, formatDienstTijd } from "@/lib/planning/tijd";

type Interesse = {
  interesseId: string;
  medewerkerId: string;
  medewerkerNaam: string;
  aangemeldOp: string;
};

type OpenDienst = {
  dienstBezettingId: string;
  dienst: {
    id: string;
    datum: string;
    begintijd: string;
    eindtijd: string;
    tags: {
      aantal: number;
      tag: { id: string; naam: string };
    }[];
    week: {
      jaar: number;
      weeknummer: number;
      vestiging: { naam: string };
    };
  };
  interesses: Interesse[];
};

function formatDatum(datum: string) {
  return formatDienstDatum(datum);
}

function formatTijd(waarde: string) {
  const match = /^(\\d{1,2}):(\\d{2})/.exec(waarde);
  if (match) return `${match[1].padStart(2, "0")}:${match[2]}`;
  return formatDienstTijd(waarde);
}

function dagenTotDienst(datum: string) {
  const dag = new Date(datum);
  const vandaag = new Date();
  dag.setHours(23, 59, 59, 999);
  vandaag.setHours(0, 0, 0, 0);
  return Math.ceil((dag.getTime() - vandaag.getTime()) / (24 * 60 * 60 * 1000));
}

export default function OpenDienstenPage() {
  const [items, setItems] = useState<OpenDienst[]>([]);
  const [laden, setLaden] = useState(true);
  const [bericht, setBericht] = useState("");

  async function laadOpenDiensten() {
    setLaden(true);
    try {
      const response = await fetch("/api/open-diensten/beoordelen", {
        cache: "no-store",
      });
      const data = await response.json();
      setItems(response.ok && Array.isArray(data) ? data : []);
      if (!response.ok) {
        setBericht(data.fout ?? "Open diensten konden niet worden geladen.");
      }
    } finally {
      setLaden(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void laadOpenDiensten(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function toewijzen(dienstBezettingId: string, medewerkerId: string) {
    const response = await fetch("/api/open-diensten/beoordelen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dienstBezettingId, medewerkerId }),
    });

    const data = await response.json();
    setBericht(
      response.ok
        ? "Medewerker definitief toegewezen."
        : data.fout ?? "Toewijzen mislukt.",
    );

    if (response.ok) await laadOpenDiensten();
  }

  const groepen = useMemo(() => {
    const map = new Map<string, OpenDienst[]>();

    for (const item of items) {
      const lijst = map.get(item.dienst.id) ?? [];
      lijst.push(item);
      map.set(item.dienst.id, lijst);
    }

    return Array.from(map.values());
  }, [items]);

  return (
    <main className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">Eigenaar</p>
        <h1 className="text-2xl font-bold text-slate-900">Open diensten</h1>
        <p className="mt-1 text-sm text-slate-600">
          Alle open dienstplekken die nog niet zijn gevuld. Controleer de belangstelling
          en wijs daarna de medewerker definitief toe.
        </p>
      </div>

      {bericht && (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
          {bericht}
        </p>
      )}

      {laden ? (
        <p className="text-sm text-slate-500">Laden...</p>
      ) : groepen.length === 0 ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
          <p className="font-semibold text-emerald-900">Alle open diensten zijn gevuld.</p>
          <p className="mt-1 text-sm text-emerald-800">
            Er zijn momenteel geen open dienstplekken die nog door de eigenaar moeten worden beoordeeld.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groepen.map((groep) => {
            const eerste = groep[0];
            const dagen = dagenTotDienst(eerste.dienst.datum);
            const urgent = dagen <= 7 && groep.every((item) => item.interesses.length === 0);

            return (
              <article
                key={eerste.dienst.id}
                className={`rounded-2xl border p-5 shadow-sm ${
                  urgent
                    ? "border-red-200 bg-red-50"
                    : "border-yellow-200 bg-yellow-50"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold text-slate-900">
                      {formatDatum(eerste.dienst.datum)}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-700">
                      {formatTijd(eerste.dienst.begintijd)} – {formatTijd(eerste.dienst.eindtijd)}
                      {" · "}
                      {eerste.dienst.week.vestiging.naam}
                      {" · "}
                      week {eerste.dienst.week.weeknummer}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {eerste.dienst.tags.map((tag) => (
                        <span
                          key={tag.tag.id}
                          className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200"
                        >
                          {tag.tag.naam} · {Math.max(1, tag.aantal)}
                        </span>
                      ))}
                    </div>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      urgent
                        ? "bg-red-100 text-red-800"
                        : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {urgent
                      ? "Urgent: niemand gemeld"
                      : "Open"}
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  {groep.map((item, index) => (
                    <div
                      key={item.dienstBezettingId}
                      className="rounded-xl border border-white bg-white p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-slate-900">
                            Open plek {index + 1}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {item.interesses.length === 0
                              ? "Nog niemand heeft belangstelling gemeld."
                              : `${item.interesses.length} medewerker(s) hebben belangstelling gemeld.`}
                          </p>
                        </div>
                      </div>

                      {item.interesses.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {item.interesses.map((interesse) => (
                            <div
                              key={interesse.interesseId}
                              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2"
                            >
                              <div>
                                <p className="text-sm font-semibold text-slate-900">
                                  {interesse.medewerkerNaam}
                                </p>
                                <p className="text-xs text-slate-500">
                                  Gemeld{" "}
                                  {new Intl.DateTimeFormat("nl-NL", {
                                    dateStyle: "short",
                                    timeStyle: "short",
                                  }).format(new Date(interesse.aangemeldOp))}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  void toewijzen(
                                    item.dienstBezettingId,
                                    interesse.medewerkerId,
                                  )
                                }
                                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                              >
                                Definitief toewijzen
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                          De eigenaar moet deze plek nog vullen.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
