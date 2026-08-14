"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import BezettingOverzicht from "@/components/planning/BezettingOverzicht";
import type { Dienst } from "@/types/planning";

type DienstDetailProps = {
  dienst: Dienst;
  vestigingId: string;
  bewerkbaar?: boolean;
  kanVerwijderen?: boolean;
  huidigeMedewerkerId?: string | null;
  onGewijzigd?: () => void;
  onKlik?: (dienstId: string) => void;
};

type RuilMedewerker = {
  id: string;
  personeelsnummer: string | null;
  aanhef: string;
  voornaam: string;
  tussenvoegsel: string | null;
  achternaam: string;
};

type MedewerkersResponse = {
  id: string;
  personeelsnummer: string | null;
  aanhef: string;
  voornaam: string;
  tussenvoegsel: string | null;
  achternaam: string;
};

function formatteerTijd(datum: Date | string) {
  return new Intl.DateTimeFormat("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(datum));
}

function formatteerNaam(medewerker: {
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

function bepaalStatus(dienst: Dienst) {
  if (dienst.bezetting.length === 0) {
    return "open";
  }

  const actieveBezetting = dienst.bezetting.filter(
    (regel) => regel.status !== "AFGEZEGD",
  );

  if (actieveBezetting.length === 0) {
    return "open";
  }

  const volledigBevestigd = actieveBezetting.every(
    (regel) =>
      regel.status === "BEVESTIGD" ||
      regel.status === "GEWERKT",
  );

  if (volledigBevestigd) {
    return "bevestigd";
  }

  return "onderhandeling";
}

function statusKlassen(dienst: Dienst) {
  switch (bepaalStatus(dienst)) {
    case "bevestigd":
      return "border-green-300 bg-green-50";

    case "onderhandeling":
      return "border-amber-400 bg-amber-100";

    case "open":
    default:
      return "border-red-300 bg-red-50";
  }
}

export default function DienstDetail({
  dienst,
  vestigingId,
  bewerkbaar = true,
  kanVerwijderen = false,
  huidigeMedewerkerId = null,
  onGewijzigd,
  onKlik,
}: DienstDetailProps) {
  const router = useRouter();

  const [bevestigenBezig, setBevestigenBezig] =
    useState(false);

  const [ruilOpen, setRuilOpen] =
    useState(false);

  const [ruilLaden, setRuilLaden] =
    useState(false);

  const [ruilBezig, setRuilBezig] =
    useState(false);

  const [ruilMedewerkers, setRuilMedewerkers] =
    useState<RuilMedewerker[]>([]);

  const [gekozenRuilMedewerkerId, setGekozenRuilMedewerkerId] =
    useState("");

  const [fout, setFout] =
    useState<string | null>(null);

  const [ruilFout, setRuilFout] =
    useState<string | null>(null);

  const geplandeBezettingen = useMemo(
    () =>
      dienst.bezetting.filter(
        (regel) => regel.status === "GEPLAND",
      ),
    [dienst.bezetting],
  );

  const eigenBezetting = useMemo(() => {
    if (!huidigeMedewerkerId) {
      return null;
    }

    return (
      dienst.bezetting.find(
        (regel) =>
          regel.medewerker?.id ===
          huidigeMedewerkerId,
      ) ?? null
    );
  }, [
    dienst.bezetting,
    huidigeMedewerkerId,
  ]);

  const kanEigenDienstRuilen =
    bewerkbaar &&
    huidigeMedewerkerId !== null &&
    eigenBezetting !== null &&
    (eigenBezetting.status === "GEPLAND" ||
      eigenBezetting.status === "BEVESTIGD");

  async function bevestigBezetting(
    bezettingId: string,
  ) {
    try {
      setBevestigenBezig(true);
      setFout(null);

      const response = await fetch(
        `/api/planning/bezetting/${bezettingId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            status: "BEVESTIGD",
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.fout ??
            "De medewerker kon niet worden bevestigd.",
        );
      }

      onGewijzigd?.();
    } catch (error) {
      console.error(
        "Fout bij bevestigen medewerker:",
        error,
      );

      setFout(
        error instanceof Error
          ? error.message
          : "De medewerker kon niet worden bevestigd.",
      );
    } finally {
      setBevestigenBezig(false);
    }
  }

  async function laadRuilMedewerkers() {
    if (!huidigeMedewerkerId) {
      return;
    }

    try {
      setRuilLaden(true);
      setRuilFout(null);

      const datum = new Intl.DateTimeFormat(
        "sv-SE",
      ).format(new Date(dienst.datum));

      const response = await fetch(
        `/api/planning/medewerkers?vestigingId=${encodeURIComponent(
          vestigingId,
        )}&datum=${encodeURIComponent(datum)}`,
        {
          method: "GET",
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

      if (!Array.isArray(data)) {
        throw new Error(
          "Ongeldige medewerkersgegevens ontvangen.",
        );
      }

      const medewerkers =
        data as MedewerkersResponse[];

      const medewerkersOpDienst = new Set(
        dienst.bezetting
          .filter(
            (regel) =>
              regel.status !== "AFGEZEGD",
          )
          .map(
            (regel) =>
              regel.medewerker?.id ?? null,
          )
          .filter(
            (id): id is string =>
              typeof id === "string",
          ),
      );

      const kandidaten = medewerkers
        .filter(
          (medewerker) =>
            medewerker.id !==
              huidigeMedewerkerId &&
            !medewerkersOpDienst.has(
              medewerker.id,
            ),
        )
        .map((medewerker) => ({
          id: medewerker.id,
          personeelsnummer:
            medewerker.personeelsnummer,
          aanhef: medewerker.aanhef,
          voornaam: medewerker.voornaam,
          tussenvoegsel:
            medewerker.tussenvoegsel,
          achternaam:
            medewerker.achternaam,
        }))
        .sort((a, b) =>
          formatteerNaam(a).localeCompare(
            formatteerNaam(b),
            "nl",
          ),
        );

      setRuilMedewerkers(kandidaten);
    } catch (error) {
      console.error(
        "Fout bij ophalen ruilmedewerkers:",
        error,
      );

      setRuilFout(
        error instanceof Error
          ? error.message
          : "De medewerkers konden niet worden opgehaald.",
      );
    } finally {
      setRuilLaden(false);
    }
  }

  function openRuilen() {
    setFout(null);
    setRuilFout(null);
    setGekozenRuilMedewerkerId("");
    setRuilOpen(true);

    void laadRuilMedewerkers();
  }

  function sluitRuilen() {
    if (ruilBezig) {
      return;
    }

    setRuilOpen(false);
    setRuilFout(null);
    setGekozenRuilMedewerkerId("");
    setRuilMedewerkers([]);
  }

  async function dienRuilverzoekIn() {
    if (!eigenBezetting) {
      setRuilFout(
        "Je bent niet aan deze dienst gekoppeld.",
      );
      return;
    }

    if (!gekozenRuilMedewerkerId) {
      setRuilFout(
        "Kies eerst een medewerker.",
      );
      return;
    }

    try {
      setRuilBezig(true);
      setRuilFout(null);

      const response = await fetch(
        "/api/planning/ruilen",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            dienstBezettingId:
              eigenBezetting.id,
            ruilMedewerkerId:
              gekozenRuilMedewerkerId,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.fout ??
            "Het ruilverzoek kon niet worden aangemaakt.",
        );
      }

      setRuilOpen(false);
      setGekozenRuilMedewerkerId("");
      setRuilMedewerkers([]);
      setRuilFout(null);

      onGewijzigd?.();
    } catch (error) {
      console.error(
        "Fout bij aanvragen ruil:",
        error,
      );

      setRuilFout(
        error instanceof Error
          ? error.message
          : "Het ruilverzoek kon niet worden aangemaakt.",
      );
    } finally {
      setRuilBezig(false);
    }
  }

  function openDienst() {
    router.push(
      `/planning/dienst/${dienst.id}`,
    );

    onKlik?.(dienst.id);
  }

  function handleKeyDown(
    event: React.KeyboardEvent<HTMLElement>,
  ) {
    if (
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();
      openDienst();
    }
  }

  async function verwijderDienst() {
    const bevestiging = window.confirm(
      "Deze dienst verwijderen?",
    );

    if (!bevestiging) {
      return;
    }

    try {
      setFout(null);

      const response = await fetch(
        `/api/planning/diensten/${dienst.id}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.fout ??
            "De dienst kon niet worden verwijderd.",
        );
      }

      onGewijzigd?.();
    } catch (error) {
      console.error(
        "Fout bij verwijderen dienst:",
        error,
      );

      setFout(
        error instanceof Error
          ? error.message
          : "De dienst kon niet worden verwijderd.",
      );
    }
  }

  return (
    <>
      <article
        role="button"
        tabIndex={0}
        onClick={openDienst}
        onKeyDown={handleKeyDown}
        className={`cursor-pointer rounded-lg border px-3 py-2 transition hover:shadow-sm ${statusKlassen(
          dienst,
        )}`}
      >
        <div className="font-medium text-slate-900">
          {formatteerTijd(dienst.begintijd)} -{" "}
          {formatteerTijd(dienst.eindtijd)}
        </div>

        <div className="mt-1">
          <BezettingOverzicht
            bezetting={dienst.bezetting}
          />
        </div>

        {geplandeBezettingen.length > 0 &&
          bewerkbaar && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {geplandeBezettingen.map(
                (regel) => (
                  <button
                    key={regel.id}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();

                      void bevestigBezetting(
                        regel.id,
                      );
                    }}
                    disabled={bevestigenBezig}
                    className="rounded-md border border-amber-300 bg-white/70 px-2 py-1 text-[10px] font-medium text-amber-800 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {bevestigenBezig
                      ? "..."
                      : `Bevestig ${
                          regel.medewerker
                            ? formatteerNaam(
                                regel.medewerker,
                              )
                            : "medewerker"
                        }`}
                  </button>
                ),
              )}
            </div>
          )}

        {kanEigenDienstRuilen && (
          <div className="mt-2 border-t border-black/5 pt-2">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                openRuilen();
              }}
              className="rounded-md border border-blue-200 bg-white/80 px-3 py-1.5 text-[10px] font-semibold text-blue-700 transition hover:bg-blue-50"
            >
              Ruilen
            </button>
          </div>
        )}

        {fout && (
          <p className="mt-2 text-[10px] text-red-600">
            {fout}
          </p>
        )}

        {dienst.opmerkingen && (
          <p className="mt-2 text-[11px] text-gray-500">
            {dienst.opmerkingen}
          </p>
        )}

        {kanVerwijderen &&
          bewerkbaar && (
            <div className="mt-2 border-t border-black/5 pt-1.5 text-right">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  void verwijderDienst();
                }}
                className="text-[9px] text-gray-400 transition hover:text-red-600"
              >
                Verwijderen
              </button>
            </div>
          )}
      </article>

      {ruilOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 p-4"
          onClick={sluitRuilen}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="mb-4">
              <h2 className="text-base font-semibold text-slate-900">
                Dienst ruilen
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Kies de medewerker aan wie je deze
                dienst wilt aanbieden.
              </p>

              <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">
                {formatteerTijd(
                  dienst.begintijd,
                )}{" "}
                -{" "}
                {formatteerTijd(
                  dienst.eindtijd,
                )}
              </p>
            </div>

            {ruilLaden ? (
              <div className="py-8 text-center text-xs text-slate-500">
                Medewerkers laden...
              </div>
            ) : (
              <>
                {ruilMedewerkers.length > 0 ? (
                  <select
                    value={
                      gekozenRuilMedewerkerId
                    }
                    onChange={(event) =>
                      setGekozenRuilMedewerkerId(
                        event.target.value,
                      )
                    }
                    disabled={ruilBezig}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">
                      Kies een medewerker...
                    </option>

                    {ruilMedewerkers.map(
                      (medewerker) => (
                        <option
                          key={medewerker.id}
                          value={medewerker.id}
                        >
                          {formatteerNaam(
                            medewerker,
                          )}
                        </option>
                      ),
                    )}
                  </select>
                ) : (
                  !ruilFout && (
                    <div className="rounded-xl bg-slate-50 px-4 py-5 text-center text-xs text-slate-500">
                      Er zijn geen andere
                      medewerkers beschikbaar
                      om deze dienst aan te
                      bieden.
                    </div>
                  )
                )}

                {ruilFout && (
                  <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                    {ruilFout}
                  </p>
                )}

                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={sluitRuilen}
                    disabled={ruilBezig}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Annuleren
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void dienRuilverzoekIn()
                    }
                    disabled={
                      ruilBezig ||
                      !gekozenRuilMedewerkerId
                    }
                    className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {ruilBezig
                      ? "Aanvragen..."
                      : "Ruilverzoek aanvragen"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}