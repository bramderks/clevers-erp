"use client";

export default function ZiekmeldingPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-5 pb-28">
      <div className="mx-auto max-w-lg space-y-5">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Persoonlijk
          </p>
          <h1 className="text-2xl font-bold text-slate-900">Ziek melden</h1>
          <p className="mt-1 text-sm text-slate-600">
            Ziekmelden doe je telefonisch bij de eigenaar. Je kunt dit niet zelf in de app registreren.
          </p>
        </header>

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="font-bold text-slate-900">Wat moet je doen?</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-700">
            <li>Bel de eigenaar en geef door dat je ziek bent.</li>
            <li>Bespreek welke geplande dienst(en) hierdoor geraakt worden.</li>
            <li>De eigenaar registreert de ziekmelding bij de betreffende dienst in de planning.</li>
            <li>Neem opnieuw contact op met de eigenaar zodra je weer kunt werken.</li>
          </ol>
        </section>

        <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          De eigenaar beheert de ziekstatus in de planning. Een ziekgemelde dienst blijft zichtbaar in het dossier en telt niet mee voor de verloning.
        </p>
      </div>
    </main>
  );
}
