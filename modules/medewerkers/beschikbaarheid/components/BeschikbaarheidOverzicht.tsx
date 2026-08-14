"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

import BeschikbaarheidWijzigenForm from "./BeschikbaarheidWijzigenForm";

type Beschikbaarheid = {
  id: string;
  datum: Date | string;
  begintijd: Date | string;
  eindtijd: Date | string;
  status: string;
  opmerking: string | null;
};

type BeschikbaarheidOverzichtProps = {
  medewerkerId: string;
  beschikbaarheden: Beschikbaarheid[];
  beschikbaarheidDeadline: Date | string | null;
  magWijzigen: boolean;
  magVerwijderen: boolean;
};

function naarDatum(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function formatDatum(value: Date | string): string {
  const datum = naarDatum(value);

  if (Number.isNaN(datum.getTime())) {
    return "Ongeldige datum";
  }

  return datum.toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatTijd(value: Date | string): string {
  const datum = naarDatum(value);

  if (Number.isNaN(datum.getTime())) {
    return "--:--";
  }

  return datum.toLocaleTimeString("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDeadline(value: Date | string): string {
  const datum = naarDatum(value);

  if (Number.isNaN(datum.getTime())) {
    return "Ongeldige deadline";
  }

  return datum.toLocaleString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusVariant(status: string) {
  switch (status) {
    case "BESCHIKBAAR":
      return "success" as const;

    case "VOORKEUR":
      return "warning" as const;

    case "NIET_BESCHIKBAAR":
      return "danger" as const;

    default:
      return "default" as const;
  }
}

function statusNaam(status: string) {
  switch (status) {
    case "BESCHIKBAAR":
      return "Beschikbaar";

    case "VOORKEUR":
      return "Voorkeur";

    case "NIET_BESCHIKBAAR":
      return "Niet beschikbaar";

    default:
      return status;
  }
}

export default function BeschikbaarheidOverzicht({
  medewerkerId,
  beschikbaarheden,
  beschikbaarheidDeadline,
  magWijzigen,
  magVerwijderen,
}: BeschikbaarheidOverzichtProps) {
  const router = useRouter();

  const [verwijderenId, setVerwijderenId] =
    useState<string | null>(null);

  const [bewerkenId, setBewerkenId] =
    useState<string | null>(null);

  const [error, setError] = useState("");

  const deadline = beschikbaarheidDeadline
    ? naarDatum(beschikbaarheidDeadline)
    : null;

  const deadlineVerstreken =
    deadline !== null &&
    !Number.isNaN(deadline.getTime()) &&
    new Date() > deadline;

  async function verwijderen(id: string) {
    const bevestigen = window.confirm(
      "Weet je zeker dat je deze beschikbaarheid wilt verwijderen?",
    );

    if (!bevestigen) {
      return;
    }

    setVerwijderenId(id);
    setError("");

    try {
      const response = await fetch(
        `/api/medewerkers/${medewerkerId}/beschikbaarheid/${id}`,
        {
          method: "DELETE",
        },
      );

      const resultaat = await response.json();

      if (!response.ok) {
        throw new Error(
          resultaat.error ??
            "De beschikbaarheid kon niet worden verwijderd.",
        );
      }

      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "De beschikbaarheid kon niet worden verwijderd.",
      );
    } finally {
      setVerwijderenId(null);
    }
  }

  function sluiten() {
    setBewerkenId(null);
    setError("");
  }

  function opgeslagen() {
    setBewerkenId(null);
    setError("");
    router.refresh();
  }

  if (beschikbaarheden.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center">
        <p className="text-sm font-medium text-slate-700">
          Nog geen beschikbaarheid opgegeven
        </p>

        <p className="mt-1 text-sm text-slate-500">
          Voeg hierboven de momenten toe waarop je
          beschikbaar bent om te werken.
        </p>

        {deadline &&
          !Number.isNaN(deadline.getTime()) && (
            <p className="mt-3 text-xs text-slate-500">
              Deadline: {formatDeadline(deadline)}
            </p>
          )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {deadline &&
        !Number.isNaN(deadline.getTime()) && (
          <div
            className={[
              "rounded-xl border px-4 py-3 text-sm",
              deadlineVerstreken
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-cyan-200 bg-cyan-50 text-cyan-800",
            ].join(" ")}
          >
            {deadlineVerstreken ? (
              <>
                <p className="font-semibold">
                  Beschikbaarheid is gesloten
                </p>

                <p className="mt-1">
                  De deadline was{" "}
                  {formatDeadline(deadline)}.
                  Alleen een eigenaar of teamleider kan
                  daarna nog wijzigingen uitvoeren.
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold">
                  Beschikbaarheid is nog open
                </p>

                <p className="mt-1">
                  Je kunt je opgegeven beschikbaarheid
                  wijzigen of verwijderen tot{" "}
                  {formatDeadline(deadline)}.
                </p>
              </>
            )}
          </div>
        )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {beschikbaarheden.map((beschikbaarheid) => {
          const bewerken =
            bewerkenId === beschikbaarheid.id;

          if (bewerken) {
            return (
              <div
                key={beschikbaarheid.id}
                className="rounded-xl border border-cyan-200 bg-white p-5"
              >
                <div className="mb-5">
                  <p className="font-semibold text-slate-900">
                    Beschikbaarheid wijzigen
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    Geef aan op welke tijden je op deze
                    datum beschikbaar bent.
                  </p>
                </div>

                <BeschikbaarheidWijzigenForm
                  medewerkerId={medewerkerId}
                  beschikbaarheidId={beschikbaarheid.id}
                  datum={beschikbaarheid.datum}
                  begintijd={beschikbaarheid.begintijd}
                  eindtijd={beschikbaarheid.eindtijd}
                  status={beschikbaarheid.status}
                  opmerking={beschikbaarheid.opmerking}
                  onCancel={sluiten}
                  onSaved={opgeslagen}
                />
              </div>
            );
          }

          return (
            <div
              key={beschikbaarheid.id}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="font-semibold capitalize text-slate-900">
                      {formatDatum(beschikbaarheid.datum)}
                    </p>

                    <Badge
                      variant={statusVariant(
                        beschikbaarheid.status,
                      )}
                    >
                      {statusNaam(
                        beschikbaarheid.status,
                      )}
                    </Badge>
                  </div>

                  <div className="mt-2">
                    <p className="text-sm font-medium text-slate-700">
                      Beschikbaar van{" "}
                      <span className="font-semibold">
                        {formatTijd(
                          beschikbaarheid.begintijd,
                        )}
                      </span>{" "}
                      tot{" "}
                      <span className="font-semibold">
                        {formatTijd(
                          beschikbaarheid.eindtijd,
                        )}
                      </span>
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      Dit is jouw beschikbaarheid, niet
                      de begin- of eindtijd van een dienst.
                    </p>
                  </div>

                  {beschikbaarheid.opmerking && (
                    <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2">
                      <p className="text-xs font-medium text-slate-500">
                        Opmerking
                      </p>

                      <p className="mt-1 text-sm text-slate-600">
                        {beschikbaarheid.opmerking}
                      </p>
                    </div>
                  )}
                </div>

                {(magWijzigen || magVerwijderen) && (
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {magWijzigen && (
                      <Button
                        type="button"
                        onClick={() => {
                          setError("");
                          setBewerkenId(
                            beschikbaarheid.id,
                          );
                        }}
                      >
                        Wijzigen
                      </Button>
                    )}

                    {magVerwijderen && (
                      <Button
                        type="button"
                        disabled={
                          verwijderenId ===
                          beschikbaarheid.id
                        }
                        onClick={() =>
                          verwijderen(
                            beschikbaarheid.id,
                          )
                        }
                      >
                        {verwijderenId ===
                        beschikbaarheid.id
                          ? "Verwijderen..."
                          : "Verwijderen"}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}