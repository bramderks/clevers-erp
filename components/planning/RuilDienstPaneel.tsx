"use client";

import { useState } from "react";

type PlanningTag = {
  id: string;
  naam: string;
};

type Beschikbaarheid = {
  begintijd: string | null;
  eindtijd: string | null;
  status: "BESCHIKBAAR" | "NIET_BESCHIKBAAR" | "VOORKEUR";
};

type Kandidaat = {
  id: string;
  voornaam: string;
  tussenvoegsel: string | null;
  achternaam: string;
  tags: PlanningTag[];
  beschikbaarheden: Beschikbaarheid[];
  diensten?: {
    status: string;
    dienst: {
      begintijd: string;
      eindtijd: string;
    };
  }[];
};

type RuilDienstPaneelProps = {
  dienstBezettingId: string;
  huidigeMedewerkerId: string;
  vestigingId: string;
  datum: string;
  begintijd: string;
  eindtijd: string;
  vereisteTags: PlanningTag[];
};

function formatteerNaam(medewerker: Pick<Kandidaat, "voornaam" | "tussenvoegsel" | "achternaam">) {
  return [
    medewerker.voornaam,
    medewerker.tussenvoegsel,
    medewerker.achternaam,
  ]
    .filter(Boolean)
    .join(" ");
}

function heeftAlleTags(
  medewerker: Kandidaat,
  vereisteTags: PlanningTag[],
) {
  if (vereisteTags.length === 0) {
    return true;
  }

  const medewerkerTagIds = new Set(
    medewerker.tags.map((tag) => tag.id),
  );

  return vereisteTags.every((tag) =>
    medewerkerTagIds.has(tag.id),
  );
}

function heeftGeenOverlappendeDienst(
  medewerker: Kandidaat,
  begintijd: string,
  eindtijd: string,
) {
  const dienstStart = new Date(begintijd).getTime();
  const dienstEinde = new Date(eindtijd).getTime();

  return !(medewerker.diensten ?? []).some((bezetting) => {
    if (bezetting.status === "AFGEZEGD") {
      return false;
    }

    const bestaandBegin = new Date(
      bezetting.dienst.begintijd,
    ).getTime();
    const bestaandEinde = new Date(
      bezetting.dienst.eindtijd,
    ).getTime();

    return bestaandBegin < dienstEinde && bestaandEinde > dienstStart;
  });
}

function isVolledigBeschikbaar(
  medewerker: Kandidaat,
  begintijd: string,
  eindtijd: string,
) {
  const dienstStart = new Date(begintijd).getTime();
  const dienstEinde = new Date(eindtijd).getTime();

  return medewerker.beschikbaarheden.some((beschikbaarheid) => {
    if (
      beschikbaarheid.status !== "BESCHIKBAAR" &&
      beschikbaarheid.status !== "VOORKEUR"
    ) {
      return false;
    }

    if (!beschikbaarheid.begintijd || !beschikbaarheid.eindtijd) {
      return false;
    }

    return (
      new Date(beschikbaarheid.begintijd).getTime() <= dienstStart &&
      new Date(beschikbaarheid.eindtijd).getTime() >= dienstEinde
    );
  });
}

export default function RuilDienstPaneel({
  dienstBezettingId,
  huidigeMedewerkerId,
  vestigingId,
  datum,
  begintijd,
  eindtijd,
  vereisteTags,
}: RuilDienstPaneelProps) {
  const [open, setOpen] = useState(false);
  const [laden, setLaden] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [kandidaten, setKandidaten] = useState<Kandidaat[]>([]);
  const [gekozenId, setGekozenId] = useState("");
  const [fout, setFout] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);

  async function openPaneel() {
    setOpen(true);
    setLaden(true);
    setFout(null);
    setSucces(null);
    setGekozenId("");
    setKandidaten([]);

    try {
      const response = await fetch(
        `/api/planning/medewerkers?vestigingId=${encodeURIComponent(
          vestigingId,
        )}&datum=${encodeURIComponent(
          new Intl.DateTimeFormat("sv-SE").format(new Date(datum)),
        )}`,
        {
          credentials: "include",
          cache: "no-store",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.fout ??
            "De medewerkers konden niet worden opgehaald.",
        );
      }

      if (!Array.isArray(data?.medewerkers)) {
        throw new Error(
          "Ongeldige medewerkersgegevens ontvangen.",
        );
      }

      const geschikt = (data.medewerkers as Kandidaat[])
        .filter(
          (medewerker) =>
            medewerker.id !== huidigeMedewerkerId,
        )
        .filter((medewerker) =>
          heeftAlleTags(medewerker, vereisteTags),
        )
        .filter((medewerker) =>
          isVolledigBeschikbaar(
            medewerker,
            begintijd,
            eindtijd,
          ),
        )
        .filter((medewerker) =>
          heeftGeenOverlappendeDienst(
            medewerker,
            begintijd,
            eindtijd,
          ),
        )
        .sort((a, b) =>
          formatteerNaam(a).localeCompare(
            formatteerNaam(b),
            "nl",
          ),
        );

      setKandidaten(geschikt);
    } catch (error) {
      setFout(
        error instanceof Error
          ? error.message
          : "De medewerkers konden niet worden opgehaald.",
      );
    } finally {
      setLaden(false);
    }
  }

  async function dienRuilverzoekIn(algemeen: boolean) {
    if (!algemeen && !gekozenId) {
      setFout("Kies eerst een medewerker.");
      return;
    }

    try {
      setBezig(true);
      setFout(null);
      setSucces(null);

      const response = await fetch("/api/planning/ruilen", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          dienstBezettingId,
          ...(algemeen
            ? { algemeen: true }
            : { ruilMedewerkerId: gekozenId }),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.fout ??
            "Het ruilverzoek kon niet worden ingediend.",
        );
      }

      setSucces(
        algemeen
          ? "De dienst is algemeen ter ruil aangeboden aan medewerkers met de juiste tags."
          : "Het ruilverzoek is ingediend.",
      );
      setGekozenId("");
    } catch (error) {
      setFout(
        error instanceof Error
          ? error.message
          : "Het ruilverzoek kon niet worden ingediend.",
      );
    } finally {
      setBezig(false);
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => void openPaneel()}
        className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
      >
        Ruilen
      </button>

      {open && (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Dienst ruilen
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Kies een medewerker die alle juiste tags heeft en
                beschikbaar is voor de volledige dienst.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={bezig}
              className="w-fit rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600"
            >
              Sluiten
            </button>
          </div>

          {laden ? (
            <p className="mt-4 text-sm text-slate-600">
              Beschikbare medewerkers laden...
            </p>
          ) : kandidaten.length > 0 ? (
            <>
              <select
                value={gekozenId}
                onChange={(event) =>
                  setGekozenId(event.target.value)
                }
                disabled={bezig}
                className="mt-4 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900"
              >
                <option value="">
                  Kies een medewerker...
                </option>

                {kandidaten.map((medewerker) => (
                  <option
                    key={medewerker.id}
                    value={medewerker.id}
                  >
                    {formatteerNaam(medewerker)}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() =>
                  void dienRuilverzoekIn(false)
                }
                disabled={bezig || !gekozenId}
                className="mt-4 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {bezig
                  ? "Indienen..."
                  : "Ruilverzoek indienen"}
              </button>
            </>
          ) : !fout ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">
                Niemand met de juiste tags is momenteel beschikbaar.
              </p>
              <p className="mt-1 text-sm text-amber-800">
                Je kunt deze dienst algemeen ter ruil aanbieden.
                Alle actieve medewerkers met de juiste tags krijgen
                dan een ruilmelding, ook wanneer zij niet beschikbaar
                staan.
              </p>
              <button
                type="button"
                onClick={() =>
                  void dienRuilverzoekIn(true)
                }
                disabled={bezig}
                className="mt-4 rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-sm font-semibold text-amber-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {bezig
                  ? "Aanbieden..."
                  : "Algemeen ter ruil aanbieden"}
              </button>
            </div>
          ) : null}

          {fout && (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {fout}
            </p>
          )}

          {succes && (
            <p className="mt-4 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-medium text-emerald-800">
              {succes}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
