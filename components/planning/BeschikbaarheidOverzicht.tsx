"use client";

import { useState } from "react";

import type { Beschikbaarheid } from "@/types/planning";

type BeschikbaarheidOverzichtProps = {
  medewerkerId: string;
  beschikbaarheden: Beschikbaarheid[];
  beschikbaarheidDeadline: string | null;
  magWijzigen: boolean;
  magVerwijderen: boolean;
  onChanged?: () => void;
};

type BewerkForm = {
  datum: string;
  begintijd: string;
  eindtijd: string;
  status: "BESCHIKBAAR" | "NIET_BESCHIKBAAR";
  opmerking: string;
};

function formatteerDatum(datum: string) {
  const waarde = new Date(datum);

  if (Number.isNaN(waarde.getTime())) {
    return "Ongeldige datum";
  }

  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(waarde);
}

function formatteerTijd(datum: string | null | undefined) {
  if (!datum) {
    return "--:--";
  }

  const waarde = new Date(datum);

  if (Number.isNaN(waarde.getTime())) {
    return "--:--";
  }

  return new Intl.DateTimeFormat("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(waarde);
}

function datumVoorInput(datum: string) {
  const waarde = new Date(datum);

  if (Number.isNaN(waarde.getTime())) {
    return "";
  }

  return waarde.toISOString().slice(0, 10);
}

function tijdVoorInput(datum: string | null | undefined) {
  if (!datum) {
    return "";
  }

  const waarde = new Date(datum);

  if (Number.isNaN(waarde.getTime())) {
    return "";
  }

  return waarde.toISOString().slice(11, 16);
}

function statusLabel(
  status: Beschikbaarheid["status"],
) {
  switch (status) {
    case "BESCHIKBAAR":
      return "Beschikbaar";

    case "NIET_BESCHIKBAAR":
      return "Niet beschikbaar";

    case "VOORKEUR":
      return "Voorkeur";

    default:
      return status;
  }
}

function statusKlassen(
  status: Beschikbaarheid["status"],
) {
  switch (status) {
    case "BESCHIKBAAR":
      return "border-green-200 bg-green-50 text-green-700";

    case "NIET_BESCHIKBAAR":
      return "border-red-200 bg-red-50 text-red-700";

    case "VOORKEUR":
      return "border-amber-200 bg-amber-50 text-amber-700";

    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function deadlineVerstreken(
  deadline: string | null,
) {
  if (!deadline) {
    return false;
  }

  const datum = new Date(deadline);

  if (Number.isNaN(datum.getTime())) {
    return false;
  }

  return new Date() > datum;
}

function isBeschikbaar(
  status: Beschikbaarheid["status"],
) {
  return (
    status === "BESCHIKBAAR" ||
    status === "VOORKEUR"
  );
}

export default function BeschikbaarheidOverzicht({
  medewerkerId,
  beschikbaarheden,
  beschikbaarheidDeadline,
  magWijzigen,
  magVerwijderen,
  onChanged,
}: BeschikbaarheidOverzichtProps) {
  const [bewerkId, setBewerkId] =
    useState<string | null>(null);

  const [formulier, setFormulier] =
    useState<BewerkForm | null>(null);

  const [opslaan, setOpslaan] =
    useState(false);

  const [verwijderenId, setVerwijderenId] =
    useState<string | null>(null);

  const [fout, setFout] =
    useState<string | null>(null);

  const [succes, setSucces] =
    useState<string | null>(null);

  const gesloten =
    deadlineVerstreken(
      beschikbaarheidDeadline,
    );

  function openBewerken(
    beschikbaarheid: Beschikbaarheid,
  ) {
    if (!magWijzigen) {
      return;
    }

    setFout(null);
    setSucces(null);

    setBewerkId(
      beschikbaarheid.id,
    );

    setFormulier({
      datum: datumVoorInput(
        beschikbaarheid.datum,
      ),

      begintijd: isBeschikbaar(
        beschikbaarheid.status,
      )
        ? tijdVoorInput(
            beschikbaarheid.begintijd,
          )
        : "",

      eindtijd: isBeschikbaar(
        beschikbaarheid.status,
      )
        ? tijdVoorInput(
            beschikbaarheid.eindtijd,
          )
        : "",

      status:
        beschikbaarheid.status ===
        "NIET_BESCHIKBAAR"
          ? "NIET_BESCHIKBAAR"
          : "BESCHIKBAAR",

      opmerking:
        beschikbaarheid.opmerking ??
        "",
    });
  }

  function sluitBewerken() {
    if (opslaan) {
      return;
    }

    setBewerkId(null);
    setFormulier(null);
    setFout(null);
  }

  function wijzigFormulier(
    veld: keyof BewerkForm,
    waarde: string,
  ) {
    setFormulier((huidig) => {
      if (!huidig) {
        return huidig;
      }

      return {
        ...huidig,
        [veld]: waarde,
      };
    });

    setFout(null);
    setSucces(null);
  }

  async function slaWijzigingenOp() {
    if (
      !magWijzigen ||
      !bewerkId ||
      !formulier
    ) {
      return;
    }

    if (!formulier.datum) {
      setFout("Datum is verplicht.");
      return;
    }

    /*
     * Bij niet beschikbaar zijn tijden niet nodig.
     */
    if (
      formulier.status ===
      "BESCHIKBAAR"
    ) {
      if (!formulier.begintijd) {
        setFout(
          "Begintijd is verplicht wanneer de medewerker beschikbaar is.",
        );
        return;
      }

      if (!formulier.eindtijd) {
        setFout(
          "Eindtijd is verplicht wanneer de medewerker beschikbaar is.",
        );
        return;
      }

      if (
        formulier.begintijd >=
        formulier.eindtijd
      ) {
        setFout(
          "Eindtijd moet na de begintijd liggen.",
        );
        return;
      }
    }

    setOpslaan(true);
    setFout(null);
    setSucces(null);

    try {
      const response =
        await fetch(
          `/api/medewerkers/${encodeURIComponent(
            medewerkerId,
          )}/beschikbaarheid/${encodeURIComponent(
            bewerkId,
          )}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              datum: `${formulier.datum}T00:00:00`,

              begintijd:
                formulier.status ===
                "BESCHIKBAAR"
                  ? `${formulier.datum}T${formulier.begintijd}:00`
                  : null,

              eindtijd:
                formulier.status ===
                "BESCHIKBAAR"
                  ? `${formulier.datum}T${formulier.eindtijd}:00`
                  : null,

              status:
                formulier.status,

              opmerking:
                formulier.opmerking.trim() ||
                null,
            }),
          },
        );

      const resultaat =
        await response.json();

      if (!response.ok) {
        throw new Error(
          resultaat?.error ??
            "De beschikbaarheid kon niet worden gewijzigd.",
        );
      }

      setSucces(
        "Beschikbaarheid succesvol gewijzigd.",
      );

      setBewerkId(null);
      setFormulier(null);

      onChanged?.();
    } catch (error) {
      console.error(
        "Beschikbaarheid wijzigen mislukt:",
        error,
      );

      setFout(
        error instanceof Error
          ? error.message
          : "De beschikbaarheid kon niet worden gewijzigd.",
      );
    } finally {
      setOpslaan(false);
    }
  }

  async function verwijderBeschikbaarheid(
    beschikbaarheidId: string,
  ) {
    if (!magVerwijderen) {
      return;
    }

    const bevestiging =
      window.confirm(
        "Weet je zeker dat je deze beschikbaarheid wilt verwijderen?",
      );

    if (!bevestiging) {
      return;
    }

    setVerwijderenId(
      beschikbaarheidId,
    );

    setFout(null);
    setSucces(null);

    try {
      const response =
        await fetch(
          `/api/medewerkers/${encodeURIComponent(
            medewerkerId,
          )}/beschikbaarheid/${encodeURIComponent(
            beschikbaarheidId,
          )}`,
          {
            method: "DELETE",
          },
        );

      const resultaat =
        await response.json();

      if (!response.ok) {
        throw new Error(
          resultaat?.error ??
            "De beschikbaarheid kon niet worden verwijderd.",
        );
      }

      setSucces(
        "Beschikbaarheid succesvol verwijderd.",
      );

      if (
        bewerkId ===
        beschikbaarheidId
      ) {
        setBewerkId(null);
        setFormulier(null);
      }

      onChanged?.();
    } catch (error) {
      console.error(
        "Beschikbaarheid verwijderen mislukt:",
        error,
      );

      setFout(
        error instanceof Error
          ? error.message
          : "De beschikbaarheid kon niet worden verwijderd.",
      );
    } finally {
      setVerwijderenId(null);
    }
  }

  if (beschikbaarheden.length === 0) {
    return (
      <div className="space-y-4">
        {fout && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {fout}
          </div>
        )}

        {succes && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {succes}
          </div>
        )}

        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5">
          <p className="text-sm font-semibold text-slate-700">
            Nog geen beschikbaarheid
            opgegeven.
          </p>

          <p className="mt-1 text-sm text-slate-500">
            Voor deze planningweek zijn
            nog geen
            beschikbaarheidsgegevens
            ingevoerd.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {fout && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {fout}
        </div>
      )}

      {succes && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {succes}
        </div>
      )}

      {gesloten &&
        (magWijzigen ||
          magVerwijderen) && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            <p className="font-semibold">
              Deadline verstreken
            </p>

            <p className="mt-1 text-xs text-blue-700">
              Als eigenaar/beheerder kun je
              de beschikbaarheid nog wijzigen
              of verwijderen.
            </p>
          </div>
        )}

      <div className="space-y-3">
        {beschikbaarheden.map(
          (beschikbaarheid) => {
            const isBewerken =
              bewerkId ===
              beschikbaarheid.id;

            const isVerwijderen =
              verwijderenId ===
              beschikbaarheid.id;

            const beschikbaar =
              isBeschikbaar(
                beschikbaarheid.status,
              );

            return (
              <div
                key={
                  beschikbaarheid.id
                }
                className="rounded-xl border border-slate-200 bg-white p-4"
              >
                {!isBewerken ? (
                  <>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold capitalize text-slate-900">
                          {formatteerDatum(
                            beschikbaarheid.datum,
                          )}
                        </p>

                        {beschikbaar ? (
                          <p className="mt-1 text-sm text-slate-600">
                            {formatteerTijd(
                              beschikbaarheid.begintijd,
                            )}{" "}
                            -{" "}
                            {formatteerTijd(
                              beschikbaarheid.eindtijd,
                            )}
                          </p>
                        ) : (
                          <p className="mt-1 text-sm text-slate-500">
                            Geen beschikbaarheid
                            opgegeven
                          </p>
                        )}
                      </div>

                      <span
                        className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold ${statusKlassen(
                          beschikbaarheid.status,
                        )}`}
                      >
                        {statusLabel(
                          beschikbaarheid.status,
                        )}
                      </span>
                    </div>

                    {beschikbaarheid.status ===
                      "VOORKEUR" && (
                      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                        <p className="text-xs text-amber-800">
                          Deze beschikbaarheid
                          bevat nog de oude status
                          "Voorkeur". Nieuwe
                          beschikbaarheid gebruikt
                          alleen Beschikbaar of
                          Niet beschikbaar.
                        </p>
                      </div>
                    )}

                    {beschikbaarheid.opmerking && (
                      <div className="mt-3 border-t border-slate-200 pt-3">
                        <p className="text-sm text-slate-600">
                          {
                            beschikbaarheid.opmerking
                          }
                        </p>
                      </div>
                    )}

                    {(magWijzigen ||
                      magVerwijderen) && (
                      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-4">
                        {magWijzigen && (
                          <button
                            type="button"
                            onClick={() =>
                              openBewerken(
                                beschikbaarheid,
                              )
                            }
                            disabled={
                              isVerwijderen
                            }
                            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Wijzigen
                          </button>
                        )}

                        {magVerwijderen && (
                          <button
                            type="button"
                            onClick={() =>
                              verwijderBeschikbaarheid(
                                beschikbaarheid.id,
                              )
                            }
                            disabled={
                              isVerwijderen
                            }
                            className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isVerwijderen
                              ? "Verwijderen..."
                              : "Verwijderen"}
                          </button>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-5">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">
                        Beschikbaarheid wijzigen
                      </h3>

                      <p className="mt-1 text-xs text-slate-500">
                        Geef aan of de medewerker
                        op deze dag beschikbaar is.
                      </p>
                    </div>

                    {formulier && (
                      <>
                        <div>
                          <label className="mb-2 block text-xs font-medium text-slate-600">
                            Datum
                          </label>

                          <input
                            type="date"
                            value={
                              formulier.datum
                            }
                            onChange={(
                              event,
                            ) =>
                              wijzigFormulier(
                                "datum",
                                event.target.value,
                              )
                            }
                            disabled={opslaan}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-xs font-medium text-slate-600">
                            Beschikbaarheid
                          </label>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <button
                              type="button"
                              onClick={() =>
                                wijzigFormulier(
                                  "status",
                                  "BESCHIKBAAR",
                                )
                              }
                              disabled={opslaan}
                              className={`rounded-xl border px-4 py-3 text-left transition ${
                                formulier.status ===
                                "BESCHIKBAAR"
                                  ? "border-green-300 bg-green-50 text-green-800"
                                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                              }`}
                            >
                              <span className="block text-sm font-semibold">
                                Beschikbaar
                              </span>

                              <span className="mt-1 block text-xs">
                                Ik kan op deze dag
                                werken.
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                wijzigFormulier(
                                  "status",
                                  "NIET_BESCHIKBAAR",
                                )
                              }
                              disabled={opslaan}
                              className={`rounded-xl border px-4 py-3 text-left transition ${
                                formulier.status ===
                                "NIET_BESCHIKBAAR"
                                  ? "border-red-300 bg-red-50 text-red-800"
                                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                              }`}
                            >
                              <span className="block text-sm font-semibold">
                                Niet beschikbaar
                              </span>

                              <span className="mt-1 block text-xs">
                                Ik kan op deze dag
                                niet werken.
                              </span>
                            </button>
                          </div>
                        </div>

                        {formulier.status ===
                          "BESCHIKBAAR" && (
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                              <label className="mb-1 block text-xs font-medium text-slate-600">
                                Beschikbaar vanaf
                              </label>

                              <input
                                type="time"
                                value={
                                  formulier.begintijd
                                }
                                onChange={(
                                  event,
                                ) =>
                                  wijzigFormulier(
                                    "begintijd",
                                    event.target.value,
                                  )
                                }
                                disabled={opslaan}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                              />
                            </div>

                            <div>
                              <label className="mb-1 block text-xs font-medium text-slate-600">
                                Beschikbaar tot
                              </label>

                              <input
                                type="time"
                                value={
                                  formulier.eindtijd
                                }
                                onChange={(
                                  event,
                                ) =>
                                  wijzigFormulier(
                                    "eindtijd",
                                    event.target.value,
                                  )
                                }
                                disabled={opslaan}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                              />
                            </div>
                          </div>
                        )}

                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-600">
                            Opmerking
                          </label>

                          <textarea
                            value={
                              formulier.opmerking
                            }
                            onChange={(
                              event,
                            ) =>
                              wijzigFormulier(
                                "opmerking",
                                event.target.value,
                              )
                            }
                            disabled={opslaan}
                            rows={3}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            placeholder="Optionele opmerking"
                          />
                        </div>

                        <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4">
                          <button
                            type="button"
                            onClick={
                              slaWijzigingenOp
                            }
                            disabled={opslaan}
                            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {opslaan
                              ? "Opslaan..."
                              : "Wijzigingen opslaan"}
                          </button>

                          <button
                            type="button"
                            onClick={
                              sluitBewerken
                            }
                            disabled={opslaan}
                            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed"
                          >
                            Annuleren
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          },
        )}
      </div>
    </div>
  );
}