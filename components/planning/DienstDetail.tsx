"use client";

import { useState } from "react";

import type { Dienst } from "@/types/planning";

import BezettingOverzicht from "@/components/planning/BezettingOverzicht";

type DienstDetailProps = {
  dienst: Dienst;
  vestigingId: string;
  bewerkbaar?: boolean;
  kanVerwijderen?: boolean;
  onGewijzigd?: () => void;
};

function formatteerTijd(datum: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(datum));
}

function bepaalStatus(dienst: Dienst) {
  if (dienst.bezetting.length === 0) {
    return "open";
  }

  const actieveBezetting =
    dienst.bezetting.filter(
      (regel) =>
        regel.status !== "AFGEZEGD",
    );

  if (actieveBezetting.length === 0) {
    return "open";
  }

  const bevestigd =
    actieveBezetting.every(
      (regel) =>
        regel.status === "BEVESTIGD" ||
        regel.status === "GEWERKT",
    );

  if (bevestigd) {
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

    default:
      return "border-red-300 bg-red-50";
  }
}

export default function DienstDetail({
  dienst,
  bewerkbaar = true,
  kanVerwijderen = false,
  onGewijzigd,
}: DienstDetailProps) {
  const [bevestigenBezig, setBevestigenBezig] =
    useState(false);

  const [fout, setFout] =
    useState<string | null>(null);

  const geplandeBezettingen =
    dienst.bezetting.filter(
      (regel) =>
        regel.status === "GEPLAND",
    );

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
            "Content-Type":
              "application/json",
          },
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

  return (
    <article
      className={`rounded-lg border px-3 py-2 ${statusKlassen(
        dienst,
      )}`}
    >
      <p className="text-sm font-semibold text-gray-900">
        {formatteerTijd(
          dienst.begintijd,
        )}{" "}
        -{" "}
        {formatteerTijd(
          dienst.eindtijd,
        )}
      </p>

      <div className="mt-1">
        <BezettingOverzicht
          bezetting={
            dienst.bezetting
          }
        />
      </div>

      {geplandeBezettingen.length >
        0 &&
        bewerkbaar && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {geplandeBezettingen.map(
              (regel) => (
                <button
                  key={regel.id}
                  type="button"
                  onClick={() =>
                    bevestigBezetting(
                      regel.id,
                    )
                  }
                  disabled={
                    bevestigenBezig
                  }
                  className="rounded-md border border-amber-300 bg-white/70 px-2 py-1 text-[10px] font-medium text-amber-800 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {bevestigenBezig
                    ? "..."
                    : `Bevestig ${
                        regel.medewerker
                          ? [
                              regel
                                .medewerker
                                .voornaam,
                              regel
                                .medewerker
                                .tussenvoegsel,
                              regel
                                .medewerker
                                .achternaam,
                            ]
                              .filter(
                                Boolean,
                              )
                              .join(" ")
                          : "medewerker"
                      }`}
                </button>
              ),
            )}
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
              onClick={async () => {
                if (
                  !window.confirm(
                    "Deze dienst verwijderen?",
                  )
                ) {
                  return;
                }

                try {
                  const response =
                    await fetch(
                      `/api/planning/diensten/${dienst.id}`,
                      {
                        method: "DELETE",
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
                }
              }}
              className="text-[9px] text-gray-400 transition hover:text-red-600"
            >
              Verwijderen
            </button>
          </div>
        )}
    </article>
  );
}