  "use client";

  import {
    useMemo,
    useState,
  } from "react";
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

  type PlanningTag = {
    id: string;
    naam: string;
  };

  type Beschikbaarheid = {
    begintijd: string | null;
    eindtijd: string | null;
    status: "BESCHIKBAAR" | "NIET_BESCHIKBAAR" | "VOORKEUR";
  };

  type RuilMedewerker = {
    id: string;
    personeelsnummer: string | null;
    aanhef: string;
    voornaam: string;
    tussenvoegsel: string | null;
    achternaam: string;
    tags: PlanningTag[];
    beschikbaarheden: Beschikbaarheid[];
  };

  type MedewerkerResponse = {
    id: string;
    personeelsnummer: string | null;
    aanhef: string;
    voornaam: string;
    tussenvoegsel: string | null;
    achternaam: string;
    tags: PlanningTag[];
    beschikbaarheden: Beschikbaarheid[];
  };

  type MedewerkersResponse = {
    huidigeMedewerkerId: string | null;
    medewerkers: MedewerkerResponse[];
  };

  type StatusType =
    | "open"
    | "bevestigd"
    | "onderhandeling";

  function formatteerTijd(
    datum: Date | string,
  ) {
    return new Intl.DateTimeFormat(
      "nl-NL",
      {
        hour: "2-digit",
        minute: "2-digit",
      },
    ).format(new Date(datum));
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

  function medewerkerHeeftAlleDienstTags(
    medewerker: MedewerkerResponse,
    dienst: Dienst,
  ) {
    const vereisteTagIds = new Set(
      dienst.tags.map((dienstTag) => dienstTag.tag.id),
    );

    if (vereisteTagIds.size === 0) {
      return true;
    }

    const medewerkerTagIds = new Set(
      medewerker.tags.map((tag) => tag.id),
    );

    return [...vereisteTagIds].every((tagId) =>
      medewerkerTagIds.has(tagId),
    );
  }

  function medewerkerIsBeschikbaarVoorDienst(
    medewerker: MedewerkerResponse,
    dienst: Dienst,
  ) {
    const dienstStart = new Date(dienst.begintijd).getTime();
    const dienstEinde = new Date(dienst.eindtijd).getTime();

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

      const begin = new Date(beschikbaarheid.begintijd).getTime();
      const einde = new Date(beschikbaarheid.eindtijd).getTime();

      return begin <= dienstStart && einde >= dienstEinde;
    });
  }

  function isBhvTag(
    naam: string,
  ) {
    return (
      naam
        .trim()
        .toLowerCase() === "bhv"
    );
  }

  function bepaalStatus(
    dienst: Dienst,
  ): StatusType {
    const actieveBezetting =
      dienst.bezetting.filter(
        (regel) =>
          regel.status !== "AFGEZEGD",
      );

    if (
      actieveBezetting.length === 0
    ) {
      return "open";
    }

    const volledigBevestigd =
      actieveBezetting.every(
        (regel) =>
          regel.status === "BEVESTIGD" ||
          regel.status === "GEWERKT",
      );

    if (volledigBevestigd) {
      return "bevestigd";
    }

    return "onderhandeling";
  }

  function statusKlassen(
    dienst: Dienst,
  ) {
    switch (bepaalStatus(dienst)) {
      case "bevestigd":
        return "border-emerald-300 bg-emerald-50";

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
    bewerkbaar = false,
    kanVerwijderen = false,
    huidigeMedewerkerId = null,
    onGewijzigd,
    onKlik,
  }: DienstDetailProps) {
    const router = useRouter();

    const [
      bevestigenBezig,
      setBevestigenBezig,
    ] = useState(false);

    const [ruilOpen, setRuilOpen] =
      useState(false);

    const [ruilLaden, setRuilLaden] =
      useState(false);

    const [ruilBezig, setRuilBezig] =
      useState(false);

    const [
      ruilMedewerkers,
      setRuilMedewerkers,
    ] = useState<RuilMedewerker[]>([]);

    const [
      gekozenRuilMedewerkerId,
      setGekozenRuilMedewerkerId,
    ] = useState("");

    const [fout, setFout] =
      useState<string | null>(null);

    const [ruilFout, setRuilFout] =
      useState<string | null>(null);

    const geplandeBezettingen =
      useMemo(
        () =>
          dienst.bezetting.filter(
            (regel) =>
              regel.status === "GEPLAND",
          ),
        [dienst.bezetting],
      );

    const eigenBezetting =
      useMemo(() => {
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
      huidigeMedewerkerId !== null &&
      eigenBezetting !== null &&
      (eigenBezetting.status ===
        "GEPLAND" ||
        eigenBezetting.status ===
          "BEVESTIGD");

    async function bevestigBezetting(
      bezettingId: string,
    ) {
      if (!bewerkbaar) {
        return;
      }

      try {
        setBevestigenBezig(true);
        setFout(null);

        const response =
          await fetch(
            `/api/planning/bezetting/${bezettingId}`,
            {
              method: "PATCH",
              headers: {
                "Content-Type":
                  "application/json",
              },
              credentials: "include",
              body: JSON.stringify({
                status: "BEVESTIGD",
              }),
            },
          );

        const data =
          await response.json();

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

        const datum =
          new Intl.DateTimeFormat(
            "sv-SE",
          ).format(
            new Date(dienst.datum),
          );

        const response =
          await fetch(
            `/api/planning/medewerkers?vestigingId=${encodeURIComponent(
              vestigingId,
            )}&datum=${encodeURIComponent(
              datum,
            )}`,
            {
              method: "GET",
              credentials: "include",
              cache: "no-store",
            },
          );

        const data =
          (await response.json()) as
            | MedewerkersResponse
            | { fout?: string };

        if (!response.ok) {
          throw new Error(
            "fout" in data
              ? data.fout ??
                  "De medewerkers konden niet worden opgehaald."
              : "De medewerkers konden niet worden opgehaald.",
          );
        }

        if (
          !data ||
          Array.isArray(data) ||
          !Array.isArray(
            (
              data as MedewerkersResponse
            ).medewerkers,
          )
        ) {
          throw new Error(
            "Ongeldige medewerkersgegevens ontvangen.",
          );
        }

        const medewerkers =
          (
            data as MedewerkersResponse
          ).medewerkers;

        const medewerkersOpDienst =
          new Set(
            dienst.bezetting
              .filter(
                (regel) =>
                  regel.status !==
                  "AFGEZEGD",
              )
              .map(
                (regel) =>
                  regel.medewerker?.id ??
                  null,
              )
              .filter(
                (
                  id,
                ): id is string =>
                  typeof id ===
                  "string",
              ),
          );

        const kandidaten =
          medewerkers
            .filter(
              (medewerker) =>
                medewerker.id !==
                  huidigeMedewerkerId &&
                !medewerkersOpDienst.has(
                  medewerker.id,
                ),
            )
            .filter((medewerker) =>
              medewerkerHeeftAlleDienstTags(
                medewerker,
                dienst,
              ),
            )
            .filter((medewerker) =>
              medewerkerIsBeschikbaarVoorDienst(
                medewerker,
                dienst,
              ),
            )
            .map(
              (medewerker) => ({
                id: medewerker.id,
                personeelsnummer:
                  medewerker.personeelsnummer,
                aanhef:
                  medewerker.aanhef,
                voornaam:
                  medewerker.voornaam,
                tussenvoegsel:
                  medewerker.tussenvoegsel,
                achternaam:
                  medewerker.achternaam,
                tags: medewerker.tags,
                beschikbaarheden:
                  medewerker.beschikbaarheden,
              }),
            )
            .sort((a, b) =>
              formatteerNaam(
                a,
              ).localeCompare(
                formatteerNaam(b),
                "nl",
              ),
            );

        setRuilMedewerkers(
          kandidaten,
        );
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
      if (!kanEigenDienstRuilen) {
        return;
      }

      setFout(null);
      setRuilFout(null);
      setGekozenRuilMedewerkerId("");
      setRuilMedewerkers([]);
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

    async function dienAlgemeneRuilaanbiedingIn() {
      if (!eigenBezetting) return;

      try {
        setRuilBezig(true);
        setRuilFout(null);

        const response = await fetch("/api/planning/ruilen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            dienstBezettingId: eigenBezetting.id,
            algemeen: true,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.fout ?? "De algemene ruilaanbieding kon niet worden aangemaakt.");
        }

        sluitRuilen();
        onGewijzigd?.();
      } catch (error) {
        setRuilFout(error instanceof Error ? error.message : "De algemene ruilaanbieding kon niet worden aangemaakt.");
      } finally {
        setRuilBezig(false);
      }
    }

    async function dienRuilverzoekIn() {
      if (!eigenBezetting) {
        setRuilFout(
          "Je bent niet aan deze dienst gekoppeld.",
        );
        return;
      }

      if (
        eigenBezetting.status !==
          "GEPLAND" &&
        eigenBezetting.status !==
          "BEVESTIGD"
      ) {
        setRuilFout(
          "Deze dienst kan momenteel niet worden geruild.",
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

        const response =
          await fetch(
            "/api/planning/ruilen",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
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

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data?.fout ??
              "Het ruilverzoek kon niet worden aangemaakt.",
          );
        }

        sluitRuilen();

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
      if (!kanVerwijderen || !bewerkbaar) {
        return;
      }

      const bevestiging =
        window.confirm(
          "Deze dienst verwijderen?",
        );

      if (!bevestiging) {
        return;
      }

      try {
        setFout(null);

        const response =
          await fetch(
            `/api/planning/diensten/${dienst.id}`,
            {
              method: "DELETE",
              credentials: "include",
            },
          );

        const data =
          await response.json();

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
          className={`cursor-pointer rounded-xl border px-3 py-2.5 transition hover:shadow-sm ${statusKlassen(
            dienst,
          )}`}
        >
          {/* ====================================================
              TIJD
              ==================================================== */}

          <div className="font-medium text-slate-900">
            {formatteerTijd(
              dienst.begintijd,
            )}{" "}
            -{" "}
            {formatteerTijd(
              dienst.eindtijd,
            )}
          </div>

          {/* ====================================================
              TAGS / FUNCTIES
              ==================================================== */}

          {dienst.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {dienst.tags.map(
                (dienstTag) => {
                  const isBhv =
                    isBhvTag(
                      dienstTag.tag.naam,
                    );

                  return (
                    <span
                      key={dienstTag.id}
                      className={`rounded-md border px-2 py-1 text-[9px] font-semibold ${
                        isBhv
                          ? "border-amber-300 bg-amber-50 text-amber-800"
                          : "border-slate-200 bg-white/80 text-slate-700"
                      }`}
                    >
                      {dienstTag.tag.naam}

                      {!isBhv &&
                        dienstTag.aantal > 1 &&
                        ` × ${dienstTag.aantal}`}
                    </span>
                  );
                },
              )}
            </div>
          )}

          {/* ====================================================
              BEZETTING
              ==================================================== */}

          <div className="mt-2">
            <BezettingOverzicht
              bezetting={
                dienst.bezetting
              }
            />
          </div>

          {/* ====================================================
              BEVESTIGEN
              ==================================================== */}

          {geplandeBezettingen.length >
            0 &&
            bewerkbaar && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {geplandeBezettingen.map(
                  (regel) => (
                    <button
                      key={regel.id}
                      type="button"
                      onClick={(
                        event,
                      ) => {
                        event.stopPropagation();

                        void bevestigBezetting(
                          regel.id,
                        );
                      }}
                      disabled={
                        bevestigenBezig
                      }
                      className="rounded-lg border border-amber-300 bg-white/80 px-2.5 py-1.5 text-[10px] font-semibold text-amber-800 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
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

          {/* ====================================================
              RUILEN
              ==================================================== */}

          {kanEigenDienstRuilen && (
            <div className="mt-2 border-t border-black/5 pt-2">
              <button
                type="button"
                onClick={(
                  event,
                ) => {
                  event.stopPropagation();
                  openRuilen();
                }}
                className="rounded-lg border border-emerald-200 bg-white/80 px-3 py-1.5 text-[10px] font-semibold text-emerald-700 transition hover:bg-emerald-50"
              >
                Ruilen
              </button>
            </div>
          )}

          {/* ====================================================
              FOUT
              ==================================================== */}

          {fout && (
            <p className="mt-2 text-[10px] text-red-600">
              {fout}
            </p>
          )}

          {/* ====================================================
              OPMERKINGEN
              ==================================================== */}

          {dienst.opmerkingen && (
            <p className="mt-2 text-[11px] text-slate-500">
              {dienst.opmerkingen}
            </p>
          )}

          {/* ====================================================
              VERWIJDEREN
              ==================================================== */}

          {kanVerwijderen &&
            bewerkbaar && (
              <div className="mt-2 border-t border-black/5 pt-1.5 text-right">
                <button
                  type="button"
                  onClick={(
                    event,
                  ) => {
                    event.stopPropagation();
                    void verwijderDienst();
                  }}
                  className="text-[9px] font-medium text-slate-400 transition hover:text-red-600"
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
              onClick={(
                event,
              ) =>
                event.stopPropagation()
              }
            >
              <div className="mb-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">
                      Dienst ruilen
                    </h2>

                    <p className="mt-1 text-xs text-slate-500">
                      Kies de medewerker aan wie
                      je deze dienst wilt
                      aanbieden.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={sluitRuilen}
                    disabled={ruilBezig}
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Sluiten"
                  >
                    ✕
                  </button>
                </div>

                <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5">
                  <p className="text-xs font-semibold text-emerald-800">
                    {formatteerTijd(
                      dienst.begintijd,
                    )}{" "}
                    -{" "}
                    {formatteerTijd(
                      dienst.eindtijd,
                    )}
                  </p>
                </div>
              </div>

              {ruilLaden ? (
                <div className="rounded-xl bg-slate-50 px-4 py-8 text-center text-xs text-slate-500">
                  Medewerkers laden...
                </div>
              ) : (
                <>
                  {ruilMedewerkers.length >
                  0 ? (
                    <select
                      value={
                        gekozenRuilMedewerkerId
                      }
                      onChange={(
                        event,
                      ) =>
                        setGekozenRuilMedewerkerId(
                          event.target.value,
                        )
                      }
                      disabled={ruilBezig}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">
                        Kies een medewerker...
                      </option>

                      {ruilMedewerkers.map(
                        (
                          medewerker,
                        ) => (
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
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-5 text-center">
                        <p className="text-xs font-semibold text-amber-900">
                          Niemand met de juiste tags is momenteel beschikbaar.
                        </p>
                        <p className="mt-1 text-xs text-amber-800">
                          Je kunt de dienst algemeen ter ruil aanbieden. Alle actieve medewerkers met de juiste tags krijgen dan een melding, ook als zij nu niet beschikbaar staan.
                        </p>
                        <button
                          type="button"
                          onClick={() => void dienAlgemeneRuilaanbiedingIn()}
                          disabled={ruilBezig}
                          className="mt-4 rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {ruilBezig ? "Aanbieden..." : "Algemeen ter ruil aanbieden"}
                        </button>
                      </div>
                    )
                  )}

                  {ruilFout && (
                    <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-600">
                      {ruilFout}
                    </p>
                  )}

                  <div className="mt-5 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={sluitRuilen}
                      disabled={ruilBezig}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
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
                      className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
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