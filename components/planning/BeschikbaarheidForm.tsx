"use client";

import {
  FormEvent,
  useMemo,
  useState,
} from "react";

type BeschikbaarheidFormProps = {
  weekId: string;
  medewerkerId: string;
  beschikbaarheidDeadline?: string | Date | null;
  isBeheerder?: boolean;
  onAangemaakt?: () => void;
};

type BeschikbaarheidStatus =
  | "BESCHIKBAAR"
  | "NIET_BESCHIKBAAR";

function isDeadlineVerstreken(
  deadline: string | Date | null | undefined,
) {
  if (!deadline) {
    return false;
  }

  const waarde =
    deadline instanceof Date
      ? deadline
      : new Date(deadline);

  if (Number.isNaN(waarde.getTime())) {
    return false;
  }

  return new Date() > waarde;
}

function formatteerDeadline(
  deadline: string | Date | null | undefined,
) {
  if (!deadline) {
    return null;
  }

  const waarde =
    deadline instanceof Date
      ? deadline
      : new Date(deadline);

  if (Number.isNaN(waarde.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(
    "nl-NL",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(waarde);
}

export default function BeschikbaarheidForm({
  weekId,
  medewerkerId,
  beschikbaarheidDeadline,
  isBeheerder = false,
  onAangemaakt,
}: BeschikbaarheidFormProps) {
  const [datum, setDatum] =
    useState("");

  const [status, setStatus] =
    useState<BeschikbaarheidStatus>(
      "BESCHIKBAAR",
    );

  const [begintijd, setBegintijd] =
    useState("");

  const [eindtijd, setEindtijd] =
    useState("");

  const [opmerking, setOpmerking] =
    useState("");

  const [laden, setLaden] =
    useState(false);

  const [fout, setFout] =
    useState<string | null>(null);

  const deadlineVerstreken =
    useMemo(
      () =>
        isDeadlineVerstreken(
          beschikbaarheidDeadline,
        ),
      [beschikbaarheidDeadline],
    );

  const deadlineTekst =
    useMemo(
      () =>
        formatteerDeadline(
          beschikbaarheidDeadline,
        ),
      [beschikbaarheidDeadline],
    );

  const invoerGeblokkeerd =
    deadlineVerstreken &&
    !isBeheerder;

  function wijzigStatus(
    nieuweStatus: BeschikbaarheidStatus,
  ) {
    setStatus(nieuweStatus);
    setFout(null);

    /*
     * Bij niet beschikbaar zijn tijden
     * niet relevant en worden ze daarom
     * ook leeggemaakt.
     */
    if (
      nieuweStatus ===
      "NIET_BESCHIKBAAR"
    ) {
      setBegintijd("");
      setEindtijd("");
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setFout(null);

    if (invoerGeblokkeerd) {
      setFout(
        "De deadline voor deze beschikbaarheid is verstreken.",
      );
      return;
    }

    if (!weekId || !medewerkerId) {
      setFout(
        "Planningweek en medewerker zijn verplicht.",
      );
      return;
    }

    if (!datum) {
      setFout(
        "Datum is verplicht.",
      );
      return;
    }

    /*
     * Alleen wanneer iemand beschikbaar is,
     * zijn begin- en eindtijd verplicht.
     */
    if (
      status === "BESCHIKBAAR"
    ) {
      if (
        !begintijd ||
        !eindtijd
      ) {
        setFout(
          "Begintijd en eindtijd zijn verplicht wanneer de medewerker beschikbaar is.",
        );
        return;
      }
    }

    const datumWaarde =
      new Date(`${datum}T00:00`);

    if (
      Number.isNaN(
        datumWaarde.getTime(),
      )
    ) {
      setFout(
        "Vul een geldige datum in.",
      );
      return;
    }

    let start: Date | null =
      null;

    let einde: Date | null =
      null;

    if (
      status === "BESCHIKBAAR"
    ) {
      start = new Date(
        `${datum}T${begintijd}`,
      );

      einde = new Date(
        `${datum}T${eindtijd}`,
      );

      if (
        Number.isNaN(
          start.getTime(),
        ) ||
        Number.isNaN(
          einde.getTime(),
        )
      ) {
        setFout(
          "Vul een geldige begin- en eindtijd in.",
        );
        return;
      }

      if (einde <= start) {
        setFout(
          "Eindtijd moet na de begintijd liggen.",
        );
        return;
      }

      const beginMinuten =
        start.getHours() * 60 +
        start.getMinutes();

      const eindMinuten =
        einde.getHours() * 60 +
        einde.getMinutes();

      if (
        beginMinuten < 9 * 60 ||
        eindMinuten > 23 * 60
      ) {
        setFout(
          "Beschikbaarheid kan alleen tussen 09:00 en 23:00 worden opgegeven.",
        );
        return;
      }
    }

    /*
     * Controleer de deadline nogmaals direct
     * voordat de request wordt verstuurd.
     *
     * Eigenaar/beheerder mag ook na de
     * deadline beschikbaarheid toevoegen.
     */
    if (
      isDeadlineVerstreken(
        beschikbaarheidDeadline,
      ) &&
      !isBeheerder
    ) {
      setFout(
        "De deadline voor deze beschikbaarheid is verstreken.",
      );
      return;
    }

    try {
      setLaden(true);

      const response =
        await fetch(
          `/api/medewerkers/${encodeURIComponent(
            medewerkerId,
          )}/beschikbaarheid`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              weekId,

              datum:
                datumWaarde.toISOString(),

              begintijd:
                status ===
                  "BESCHIKBAAR" &&
                start
                  ? start.toISOString()
                  : null,

              eindtijd:
                status ===
                  "BESCHIKBAAR" &&
                einde
                  ? einde.toISOString()
                  : null,

              status,

              opmerking:
                opmerking.trim() ||
                null,
            }),
          },
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.fout ??
            data?.error ??
            "De beschikbaarheid kon niet worden opgeslagen.",
        );
      }

      setDatum("");
      setStatus(
        "BESCHIKBAAR",
      );
      setBegintijd("");
      setEindtijd("");
      setOpmerking("");
      setFout(null);

      onAangemaakt?.();
    } catch (error) {
      console.error(
        "Fout bij aanmaken beschikbaarheid:",
        error,
      );

      setFout(
        error instanceof Error
          ? error.message
          : "De beschikbaarheid kon niet worden opgeslagen.",
      );
    } finally {
      setLaden(false);
    }
  }

  if (invoerGeblokkeerd) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-lg font-semibold text-amber-900">
            Beschikbaarheid gesloten
          </h2>

          <p className="mt-1 text-sm text-amber-800">
            De deadline voor het
            doorgeven van de
            beschikbaarheid is
            verstreken.
          </p>

          {deadlineTekst && (
            <p className="mt-2 text-sm font-medium text-amber-900">
              Deadline:{" "}
              {deadlineTekst}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div>
        <h2 className="text-lg font-semibold text-slate-900">
          Beschikbaarheid toevoegen
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Geef per dag aan of de medewerker
          beschikbaar of niet beschikbaar is.
          Bij beschikbaarheid geef je aan vanaf
          hoe laat en tot hoe laat.
        </p>

        {deadlineTekst && (
          <div
            className={`mt-3 rounded-xl border p-3 ${
              isBeheerder &&
              deadlineVerstreken
                ? "border-blue-200 bg-blue-50"
                : "border-slate-200 bg-slate-50"
            }`}
          >
            {isBeheerder &&
            deadlineVerstreken ? (
              <>
                <p className="text-sm font-semibold text-blue-800">
                  Deadline verstreken
                </p>

                <p className="mt-1 text-xs text-blue-700">
                  Als eigenaar/beheerder
                  kun je nog steeds
                  beschikbaarheid
                  toevoegen.
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-600">
                Beschikbaarheid
                doorgeven kan tot:
              </p>
            )}

            <p
              className={`mt-0.5 text-sm font-semibold ${
                isBeheerder &&
                deadlineVerstreken
                  ? "text-blue-900"
                  : "text-slate-900"
              }`}
            >
              {deadlineTekst}
            </p>
          </div>
        )}
      </div>

      <div>
        <label
          htmlFor="beschikbaarheid-datum"
          className="block text-sm font-medium text-slate-700"
        >
          Datum
        </label>

        <input
          id="beschikbaarheid-datum"
          type="date"
          value={datum}
          onChange={(event) =>
            setDatum(
              event.target.value,
            )
          }
          disabled={laden}
          className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:bg-slate-50"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">
          Beschikbaarheid
        </label>

        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() =>
              wijzigStatus(
                "BESCHIKBAAR",
              )
            }
            disabled={laden}
            className={`rounded-xl border p-4 text-left transition ${
              status === "BESCHIKBAAR"
                ? "border-green-300 bg-green-50 ring-1 ring-green-200"
                : "border-slate-200 bg-white hover:bg-slate-50"
            }`}
          >
            <p
              className={`text-sm font-semibold ${
                status === "BESCHIKBAAR"
                  ? "text-green-800"
                  : "text-slate-800"
              }`}
            >
              Beschikbaar
            </p>

            <p
              className={`mt-1 text-xs ${
                status === "BESCHIKBAAR"
                  ? "text-green-700"
                  : "text-slate-500"
              }`}
            >
              Ik kan op deze dag
              werken.
            </p>
          </button>

          <button
            type="button"
            onClick={() =>
              wijzigStatus(
                "NIET_BESCHIKBAAR",
              )
            }
            disabled={laden}
            className={`rounded-xl border p-4 text-left transition ${
              status ===
              "NIET_BESCHIKBAAR"
                ? "border-red-300 bg-red-50 ring-1 ring-red-200"
                : "border-slate-200 bg-white hover:bg-slate-50"
            }`}
          >
            <p
              className={`text-sm font-semibold ${
                status ===
                "NIET_BESCHIKBAAR"
                  ? "text-red-800"
                  : "text-slate-800"
              }`}
            >
              Niet beschikbaar
            </p>

            <p
              className={`mt-1 text-xs ${
                status ===
                "NIET_BESCHIKBAAR"
                  ? "text-red-700"
                  : "text-slate-500"
              }`}
            >
              Ik kan op deze dag
              niet werken.
            </p>
          </button>
        </div>
      </div>

      {status ===
        "BESCHIKBAAR" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="beschikbaarheid-begintijd"
              className="block text-sm font-medium text-slate-700"
            >
              Beschikbaar vanaf
            </label>

            <input
              id="beschikbaarheid-begintijd"
              type="time"
              min="09:00"
              max="23:00"
              value={begintijd}
              onChange={(event) =>
                setBegintijd(
                  event.target.value,
                )
              }
              disabled={laden}
              className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:bg-slate-50"
              required
            />
          </div>

          <div>
            <label
              htmlFor="beschikbaarheid-eindtijd"
              className="block text-sm font-medium text-slate-700"
            >
              Beschikbaar tot
            </label>

            <input
              id="beschikbaarheid-eindtijd"
              type="time"
              min="09:00"
              max="23:00"
              value={eindtijd}
              onChange={(event) =>
                setEindtijd(
                  event.target.value,
                )
              }
              disabled={laden}
              className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:bg-slate-50"
              required
            />
          </div>
        </div>
      )}

      <div>
        <label
          htmlFor="beschikbaarheid-opmerking"
          className="block text-sm font-medium text-slate-700"
        >
          Opmerking
        </label>

        <textarea
          id="beschikbaarheid-opmerking"
          value={opmerking}
          onChange={(event) =>
            setOpmerking(
              event.target.value,
            )
          }
          rows={3}
          placeholder="Eventuele toelichting..."
          disabled={laden}
          className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:bg-slate-50"
        />
      </div>

      {fout && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm text-amber-800">
            {fout}
          </p>
        </div>
      )}

      <div>
        <button
          type="submit"
          disabled={laden}
          className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {laden
            ? "Opslaan..."
            : "Beschikbaarheid opslaan"}
        </button>
      </div>
    </form>
  );
}