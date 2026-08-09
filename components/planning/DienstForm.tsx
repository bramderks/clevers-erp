"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import type { PlanningTag } from "@/types/planning";

type DienstFormProps = {
  weekId: string;
  vestigingId: string;
  initialDatum?: string;
  onAangemaakt?: () => void;
};

export default function DienstForm({
  weekId,
  vestigingId,
  initialDatum = "",
  onAangemaakt,
}: DienstFormProps) {
  const [datum, setDatum] = useState(initialDatum);
  const [begintijd, setBegintijd] = useState("");
  const [eindtijd, setEindtijd] = useState("");
  const [opmerkingen, setOpmerkingen] = useState("");

  const [tags, setTags] = useState<PlanningTag[]>([]);
  const [geselecteerdeTags, setGeselecteerdeTags] =
    useState<Record<string, number>>({});

  const [ladenTags, setLadenTags] = useState(true);
  const [laden, setLaden] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  useEffect(() => {
    setDatum(initialDatum);
  }, [initialDatum]);

  useEffect(() => {
    async function laadTags() {
      try {
        setLadenTags(true);
        setFout(null);

        const response = await fetch(
          `/api/planning/tags?vestigingId=${encodeURIComponent(
            vestigingId,
          )}`,
          {
            method: "GET",
            cache: "no-store",
          },
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.fout ??
              "De planningtags konden niet worden opgehaald.",
          );
        }

        if (!Array.isArray(data)) {
          throw new Error(
            "De planningtags hebben een ongeldig formaat.",
          );
        }

        setTags(data);
      } catch (error) {
        console.error(
          "Fout bij laden planningtags:",
          error,
        );

        setFout(
          error instanceof Error
            ? error.message
            : "De planningtags konden niet worden opgehaald.",
        );
      } finally {
        setLadenTags(false);
      }
    }

    void laadTags();
  }, [vestigingId]);

  function toggleTag(tagId: string) {
    setGeselecteerdeTags((huidig) => {
      if (huidig[tagId] !== undefined) {
        const nieuw = { ...huidig };
        delete nieuw[tagId];
        return nieuw;
      }

      return {
        ...huidig,
        [tagId]: 1,
      };
    });
  }

  function wijzigAantal(
    tagId: string,
    aantal: string,
  ) {
    const waarde = Number(aantal);

    if (
      !Number.isInteger(waarde) ||
      waarde < 1
    ) {
      return;
    }

    setGeselecteerdeTags((huidig) => ({
      ...huidig,
      [tagId]: waarde,
    }));
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setFout(null);

    if (
      !datum ||
      !begintijd ||
      !eindtijd
    ) {
      setFout(
        "Datum, begintijd en eindtijd zijn verplicht.",
      );
      return;
    }

    const start = new Date(
      `${datum}T${begintijd}`,
    );

    const einde = new Date(
      `${datum}T${eindtijd}`,
    );

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(einde.getTime())
    ) {
      setFout(
        "Vul een geldige datum en tijd in.",
      );
      return;
    }

    if (einde <= start) {
      setFout(
        "Eindtijd moet na de begintijd liggen.",
      );
      return;
    }

    try {
      setLaden(true);

      const response = await fetch(
        "/api/planning/diensten",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            weekId,
            datum: new Date(
              `${datum}T00:00`,
            ).toISOString(),
            begintijd: start.toISOString(),
            eindtijd: einde.toISOString(),
            opmerkingen:
              opmerkingen.trim() || null,
            tags: Object.entries(
              geselecteerdeTags,
            ).map(([tagId, aantal]) => ({
              tagId,
              aantal,
            })),
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.fout ??
            "De dienst kon niet worden aangemaakt.",
        );
      }

      setBegintijd("");
      setEindtijd("");
      setOpmerkingen("");
      setGeselecteerdeTags({});

      onAangemaakt?.();
    } catch (error) {
      console.error(
        "Fout bij aanmaken dienst:",
        error,
      );

      setFout(
        error instanceof Error
          ? error.message
          : "De dienst kon niet worden aangemaakt.",
      );
    } finally {
      setLaden(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5"
    >
      <div>
        <h3 className="text-lg font-semibold text-gray-900">
          Dienst toevoegen
        </h3>

        <p className="mt-1 text-sm text-gray-600">
          Voeg een dienst toe aan deze planningweek.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label
            htmlFor="dienst-datum"
            className="block text-sm font-medium text-gray-900"
          >
            Datum
          </label>

          <input
            id="dienst-datum"
            type="date"
            value={datum}
            onChange={(event) =>
              setDatum(event.target.value)
            }
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
            required
          />
        </div>

        <div>
          <label
            htmlFor="dienst-begintijd"
            className="block text-sm font-medium text-gray-900"
          >
            Begintijd
          </label>

          <input
            id="dienst-begintijd"
            type="time"
            value={begintijd}
            onChange={(event) =>
              setBegintijd(event.target.value)
            }
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
            required
          />
        </div>

        <div>
          <label
            htmlFor="dienst-eindtijd"
            className="block text-sm font-medium text-gray-900"
          >
            Eindtijd
          </label>

          <input
            id="dienst-eindtijd"
            type="time"
            value={eindtijd}
            onChange={(event) =>
              setEindtijd(event.target.value)
            }
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
            required
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="dienst-opmerkingen"
          className="block text-sm font-medium text-gray-900"
        >
          Opmerkingen
        </label>

        <textarea
          id="dienst-opmerkingen"
          value={opmerkingen}
          onChange={(event) =>
            setOpmerkingen(event.target.value)
          }
          rows={3}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-900">
            Benodigde tags
          </label>

          {ladenTags && (
            <span className="text-xs text-gray-500">
              Laden...
            </span>
          )}
        </div>

        {!ladenTags && tags.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">
            Er zijn nog geen actieve planningtags.
          </p>
        ) : (
          <div className="mt-2 space-y-2">
            {tags.map((tag) => {
              const geselecteerd =
                geselecteerdeTags[tag.id] !==
                undefined;

              return (
                <div
                  key={tag.id}
                  className="flex items-center gap-3 rounded-lg border border-gray-200 p-3"
                >
                  <label className="flex flex-1 cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={geselecteerd}
                      onChange={() =>
                        toggleTag(tag.id)
                      }
                    />

                    <span className="text-sm text-gray-800">
                      {tag.naam}
                    </span>
                  </label>

                  {geselecteerd && (
                    <input
                      type="number"
                      min={1}
                      value={
                        geselecteerdeTags[tag.id]
                      }
                      onChange={(event) =>
                        wijzigAantal(
                          tag.id,
                          event.target.value,
                        )
                      }
                      className="w-20 rounded-lg border border-gray-300 px-2 py-1 text-sm"
                      aria-label={`Aantal ${tag.naam}`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {fout && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700">
            {fout}
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={laden}
        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {laden
          ? "Aanmaken..."
          : "Dienst aanmaken"}
      </button>
    </form>
  );
}