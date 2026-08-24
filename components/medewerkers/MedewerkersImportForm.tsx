"use client";

import {
  ChangeEvent,
  FormEvent,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
} from "lucide-react";

import Button from "@/components/ui/Button";

type ImportFout = {
  rij: number;
  veld?: string;
  melding: string;
};

type ImportResultaat = {
  ok: boolean;
  aangemaakt?: number;
  fouten?: ImportFout[];
  melding?: string;
};

export default function MedewerkersImportForm() {
  const inputRef =
    useRef<HTMLInputElement>(null);

  const [bestand, setBestand] =
    useState<File | null>(null);

  const [bezig, setBezig] =
    useState(false);

  const [resultaat, setResultaat] =
    useState<ImportResultaat | null>(
      null,
    );

  function kiesBestand(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const geselecteerd =
      event.target.files?.[0] ??
      null;

    setBestand(geselecteerd);
    setResultaat(null);
  }

  function verwijderBestand() {
    setBestand(null);
    setResultaat(null);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  async function importeer(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!bestand || bezig) {
      return;
    }

    setBezig(true);
    setResultaat(null);

    try {
      const formData =
        new FormData();

      formData.append(
        "bestand",
        bestand,
      );

      const response =
        await fetch(
          "/api/medewerkers/importeren",
          {
            method: "POST",
            body: formData,
          },
        );

      let data: ImportResultaat;

      try {
        data =
          (await response.json()) as ImportResultaat;
      } catch {
        data = {
          ok: false,
          fouten: [
            {
              rij: 0,
              melding:
                "De server gaf geen geldig antwoord terug.",
            },
          ],
        };
      }

      setResultaat(data);
    } catch (error) {
      console.error(
        "Medewerker importeren:",
        error,
      );

      setResultaat({
        ok: false,
        fouten: [
          {
            rij: 0,
            melding:
              "Er kon geen verbinding met de server worden gemaakt.",
          },
        ],
      });
    } finally {
      setBezig(false);
    }
  }

  const fouten =
    resultaat?.fouten ?? [];

  return (
    <div className="space-y-6">
      <form
        onSubmit={importeer}
        className="space-y-5"
      >
        {!bestand ? (
          <label
            htmlFor="bestand"
            className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center transition hover:border-slate-400 hover:bg-slate-100"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
              <FileSpreadsheet
                size={28}
                className="text-slate-500"
              />
            </div>

            <span className="mt-4 text-sm font-semibold text-slate-800">
              Kies een Excel- of CSV-bestand
            </span>

            <span className="mt-1 text-xs text-slate-500">
              Klik hier om een bestand te
              selecteren
            </span>

            <input
              ref={inputRef}
              id="bestand"
              name="bestand"
              type="file"
              accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={kiesBestand}
              className="sr-only"
            />
          </label>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
                  <FileSpreadsheet
                    size={21}
                    className="text-slate-500"
                  />
                </div>

                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {bestand.name}
                  </p>

                  <p className="mt-0.5 text-xs text-slate-500">
                    {formatteerBestandsgrootte(
                      bestand.size,
                    )}
                  </p>
                </div>
              </div>

              {!bezig && (
                <button
                  type="button"
                  onClick={
                    verwijderBestand
                  }
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-white hover:text-slate-700"
                  aria-label="Bestand verwijderen"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          {bestand && !bezig && (
            <Button
              type="button"
              variant="secondary"
              onClick={
                verwijderBestand
              }
            >
              Ander bestand kiezen
            </Button>
          )}

          <Button
            type="submit"
            disabled={
              !bestand || bezig
            }
          >
            {bezig ? (
              <>
                <Loader2
                  size={18}
                  className="animate-spin"
                />
                Bestand controleren...
              </>
            ) : (
              <>
                <Upload size={18} />
                Bestand controleren
              </>
            )}
          </Button>
        </div>
      </form>

      {bezig && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div className="flex items-center gap-3">
            <Loader2
              size={20}
              className="animate-spin text-slate-500"
            />

            <div>
              <p className="text-sm font-semibold text-slate-900">
                Importbestand wordt
                gecontroleerd
              </p>

              <p className="mt-1 text-sm text-slate-500">
                De medewerkers worden
                gecontroleerd voordat er
                gegevens worden opgeslagen.
              </p>
            </div>
          </div>
        </div>
      )}

      {resultaat?.ok && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2
              size={22}
              className="mt-0.5 shrink-0 text-emerald-600"
            />

            <div className="min-w-0">
              <p className="text-sm font-semibold text-emerald-900">
                Import succesvol
              </p>

              <p className="mt-1 text-sm text-emerald-800">
                {resultaat.melding ??
                  `${resultaat.aangemaakt ?? 0} medewerkers succesvol geïmporteerd.`}
              </p>

              <div className="mt-4">
                <Link
                  href="/medewerkers"
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-medium text-white transition hover:bg-emerald-800"
                >
                  Naar medewerkers
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {!resultaat?.ok &&
        fouten.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-red-200 bg-red-50">
            <div className="border-b border-red-200 px-5 py-4">
              <div className="flex items-start gap-3">
                <AlertCircle
                  size={22}
                  className="mt-0.5 shrink-0 text-red-600"
                />

                <div>
                  <p className="text-sm font-semibold text-red-900">
                    Import kan niet worden
                    uitgevoerd
                  </p>

                  <p className="mt-1 text-sm text-red-800">
                    Er zijn{" "}
                    <strong>
                      {fouten.length}
                    </strong>{" "}
                    fout
                    {fouten.length ===
                    1
                      ? ""
                      : "en"}{" "}
                    gevonden. Er zijn geen
                    medewerkers aangemaakt.
                  </p>
                </div>
              </div>
            </div>

            <div className="max-h-[32rem] overflow-y-auto">
              <div className="divide-y divide-red-100">
                {fouten.map(
                  (fout, index) => (
                    <div
                      key={`${fout.rij}-${fout.veld ?? "algemeen"}-${index}`}
                      className="bg-white px-5 py-4"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900">
                            Rij{" "}
                            {fout.rij > 0
                              ? fout.rij
                              : "algemeen"}
                          </p>

                          <p className="mt-1 text-sm text-slate-600">
                            {fout.melding}
                          </p>
                        </div>

                        {fout.veld && (
                          <span className="inline-flex w-fit shrink-0 rounded-lg bg-red-100 px-2.5 py-1 text-xs font-medium text-red-800">
                            {fout.veld}
                          </span>
                        )}
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>

            <div className="border-t border-red-200 px-5 py-4">
              <p className="text-xs text-red-700">
                Pas de fouten in het
                importbestand aan en upload
                daarna het aangepaste bestand
                opnieuw.
              </p>
            </div>
          </div>
        )}
    </div>
  );
}

function formatteerBestandsgrootte(
  bytes: number,
): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}