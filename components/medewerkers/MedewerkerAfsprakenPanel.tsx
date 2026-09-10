"use client";

import {
  useState,
} from "react";
import {
  useRouter,
} from "next/navigation";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";

type Vestiging = {
  id: string;
  naam: string;
};

type Tag = {
  id: string;
  naam: string;
};

type DossierItem = {
  id: string;
  type: string;
  titel: string;
  omschrijving: string | null;
  kanaal: string | null;
  documentNaam: string | null;
  documentUrl: string | null;
  datum: string;
};

type VasteUrenAfspraak = {
  id: string;
  vestigingId: string;
  vestigingNaam: string;
  tagId: string;
  tagNaam: string;
  dagVanWeek: number;
  begintijd: string;
  eindtijd: string;
  startDatum: string;
  eindDatum: string;
  actief: boolean;
  akkoordOp: string;
};

type Props = {
  medewerkerId: string;
  vestigingen: Vestiging[];
  tags: Tag[];
  dossier: DossierItem[];
  vasteUren: VasteUrenAfspraak[];
};

const DAGEN = [
  "Maandag",
  "Dinsdag",
  "Woensdag",
  "Donderdag",
  "Vrijdag",
  "Zaterdag",
  "Zondag",
];

function formatteerDatum(
  waarde: string,
) {
  return new Intl.DateTimeFormat(
    "nl-NL",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
    },
  ).format(
    new Date(
      waarde,
    ),
  );
}

export default function MedewerkerAfsprakenPanel({
  medewerkerId,
  vestigingen,
  tags,
  dossier,
  vasteUren,
}: Props) {
  const router =
    useRouter();

  const vandaag =
    new Date()
      .toISOString()
      .slice(
        0,
        10,
      );

  const [fout, setFout] =
    useState<string | null>(
      null,
    );

  const [melding, setMelding] =
    useState<string | null>(
      null,
    );

  const [
    opslaan,
    setOpslaan,
  ] = useState(false);

  const [
    dossierForm,
    setDossierForm,
  ] = useState({
    dossierType:
      "AFSPRAAK",
    titel: "",
    omschrijving: "",
    kanaal: "",
    documentNaam: "",
    documentUrl: "",
    datum: vandaag,
  });

  const [
    urenForm,
    setUrenForm,
  ] = useState({
    vestigingId:
      vestigingen[0]?.id ?? "",
    tagId:
      tags[0]?.id ?? "",
    dagVanWeek: "1",
    begintijd: "09:00",
    eindtijd: "17:00",
    startDatum: vandaag,
    eindDatum: vandaag,
  });

  async function verstuur(
    body: Record<
      string,
      unknown
    >,
  ) {
    setFout(null);
    setMelding(null);
    setOpslaan(true);

    try {
      const response =
        await fetch(
          `/api/medewerkers/${encodeURIComponent(
            medewerkerId,
          )}/afspraken`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                body,
              ),
          },
        );

      const resultaat =
        await response.json();

      if (!response.ok) {
        throw new Error(
          resultaat.error ??
            "Opslaan is mislukt.",
        );
      }

      setMelding(
        resultaat.melding ??
          "Opgeslagen.",
      );

      router.refresh();
    } catch (error) {
      setFout(
        error instanceof Error
          ? error.message
          : "Opslaan is mislukt.",
      );
    } finally {
      setOpslaan(false);
    }
  }

  async function verwijder(
    type:
      | "dossier"
      | "vaste-uren",
    id: string,
  ) {
    if (
      !window.confirm(
        "Weet je zeker dat je deze afspraak wilt verwijderen?",
      )
    ) {
      return;
    }

    setFout(null);
    setMelding(null);
    setOpslaan(true);

    try {
      const response =
        await fetch(
          `/api/medewerkers/${encodeURIComponent(
            medewerkerId,
          )}/afspraken?type=${encodeURIComponent(
            type,
          )}&id=${encodeURIComponent(
            id,
          )}`,
          {
            method: "DELETE",
          },
        );

      const resultaat =
        await response.json();

      if (!response.ok) {
        throw new Error(
          resultaat.error ??
            "Verwijderen is mislukt.",
        );
      }

      setMelding(
        resultaat.melding ??
          "Verwijderd.",
      );

      router.refresh();
    } catch (error) {
      setFout(
        error instanceof Error
          ? error.message
          : "Verwijderen is mislukt.",
      );
    } finally {
      setOpslaan(false);
    }
  }

  return (
    <div className="space-y-6">
      {fout && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {fout}
        </div>
      )}

      {melding && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {melding}
        </div>
      )}

      <Card
        title="Urenafspraken"
        description="Leg vaste werkdagen, tijden, planningstag en periode vast. Na akkoord wordt de afspraak automatisch in de bestaande planning ingevuld."
      >
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();

            void verstuur({
              type:
                "vaste-uren",
              ...urenForm,
              dagVanWeek:
                Number(
                  urenForm.dagVanWeek,
                ),
            });
          }}
        >
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Vestiging
              </label>

              <select
                value={
                  urenForm.vestigingId
                }
                onChange={(event) =>
                  setUrenForm({
                    ...urenForm,
                    vestigingId:
                      event.target.value,
                  })
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900"
              >
                {vestigingen.map(
                  (vestiging) => (
                    <option
                      key={vestiging.id}
                      value={vestiging.id}
                    >
                      {vestiging.naam}
                    </option>
                  ),
                )}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Planningstag
              </label>

              <select
                value={
                  urenForm.tagId
                }
                onChange={(event) =>
                  setUrenForm({
                    ...urenForm,
                    tagId:
                      event.target.value,
                  })
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900"
              >
                {tags.map(
                  (tag) => (
                    <option
                      key={tag.id}
                      value={tag.id}
                    >
                      {tag.naam}
                    </option>
                  ),
                )}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Vaste dag
              </label>

              <select
                value={
                  urenForm.dagVanWeek
                }
                onChange={(event) =>
                  setUrenForm({
                    ...urenForm,
                    dagVanWeek:
                      event.target.value,
                  })
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900"
              >
                {DAGEN.map(
                  (
                    dag,
                    index,
                  ) => (
                    <option
                      key={dag}
                      value={
                        index + 1
                      }
                    >
                      {dag}
                    </option>
                  ),
                )}
              </select>
            </div>

            <Input
              label="Begintijd"
              type="time"
              value={
                urenForm.begintijd
              }
              onChange={(event) =>
                setUrenForm({
                  ...urenForm,
                  begintijd:
                    event.target.value,
                })
              }
              required
            />

            <Input
              label="Eindtijd"
              type="time"
              value={
                urenForm.eindtijd
              }
              onChange={(event) =>
                setUrenForm({
                  ...urenForm,
                  eindtijd:
                    event.target.value,
                })
              }
              required
            />

            <Input
              label="Startdatum"
              type="date"
              value={
                urenForm.startDatum
              }
              onChange={(event) =>
                setUrenForm({
                  ...urenForm,
                  startDatum:
                    event.target.value,
                })
              }
              required
            />

            <Input
              label="Einddatum"
              type="date"
              value={
                urenForm.eindDatum
              }
              onChange={(event) =>
                setUrenForm({
                  ...urenForm,
                  eindDatum:
                    event.target.value,
                })
              }
              required
            />
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Met <strong>Akkoord en opslaan</strong> wordt deze vaste afspraak definitief vastgelegd en direct toegepast op de bestaande planning. Bestaande overlappende diensten van deze medewerker worden niet overschreven.
          </div>

          <Button
            type="submit"
            disabled={
              opslaan ||
              !urenForm.vestigingId ||
              !urenForm.tagId
            }
          >
            {opslaan
              ? "Opslaan..."
              : "Akkoord en opslaan"}
          </Button>
        </form>

        <div className="mt-8 border-t border-slate-200 pt-6">
          <h3 className="text-base font-semibold text-slate-900">
            Vastgelegde urenafspraken
          </h3>

          {vasteUren.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              Nog geen vaste urenafspraken.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {vasteUren.map(
                (afspraak) => (
                  <div
                    key={afspraak.id}
                    className="flex flex-col gap-4 rounded-xl border border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div>
                      <p className="font-medium text-slate-900">
                        {
                          DAGEN[
                            afspraak.dagVanWeek -
                              1
                          ]
                        }{" "}
                        ·{" "}
                        {
                          afspraak.begintijd
                        }{" "}
                        –{" "}
                        {
                          afspraak.eindtijd
                        }
                      </p>

                      <p className="mt-1 text-sm text-slate-600">
                        {
                          afspraak.vestigingNaam
                        }{" "}
                        ·{" "}
                        {afspraak.tagNaam}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        {
                          formatteerDatum(
                            afspraak.startDatum,
                          )
                        }{" "}
                        t/m{" "}
                        {
                          formatteerDatum(
                            afspraak.eindDatum,
                          )
                        }
                      </p>
                    </div>

                    <Button
                      variant="danger"
                      size="sm"
                      disabled={opslaan}
                      onClick={() =>
                        void verwijder(
                          "vaste-uren",
                          afspraak.id,
                        )
                      }
                    >
                      Verwijderen
                    </Button>
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      </Card>

      <Card
        title="Dossier en afspraken"
        description="Beheer personeelsafspraken, schriftelijke waarschuwingen en registraties van communicatie per e-mail of post."
      >
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();

            void verstuur({
              type: "dossier",
              ...dossierForm,
            });
          }}
        >
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Type
              </label>

              <select
                value={
                  dossierForm.dossierType
                }
                onChange={(event) =>
                  setDossierForm({
                    ...dossierForm,
                    dossierType:
                      event.target.value,
                  })
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900"
              >
                <option value="AFSPRAAK">
                  Afspraak
                </option>

                <option value="WAARSCHUWING">
                  Schriftelijke waarschuwing
                </option>

                <option value="COMMUNICATIE">
                  Communicatie
                </option>

                <option value="OVERIG">
                  Overig
                </option>
              </select>
            </div>

            <Input
              label="Datum"
              type="date"
              value={
                dossierForm.datum
              }
              onChange={(event) =>
                setDossierForm({
                  ...dossierForm,
                  datum:
                    event.target.value,
                })
              }
              required
            />

            <Input
              label="Titel"
              value={
                dossierForm.titel
              }
              onChange={(event) =>
                setDossierForm({
                  ...dossierForm,
                  titel:
                    event.target.value,
                })
              }
              required
            />

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Kanaal
              </label>

              <select
                value={
                  dossierForm.kanaal
                }
                onChange={(event) =>
                  setDossierForm({
                    ...dossierForm,
                    kanaal:
                      event.target.value,
                  })
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900"
              >
                <option value="">
                  Niet opgegeven
                </option>

                <option value="E-MAIL">
                  E-mail
                </option>

                <option value="POST">
                  Post
                </option>

                <option value="GESPREK">
                  Gesprek
                </option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Omschrijving
            </label>

            <textarea
              value={
                dossierForm.omschrijving
              }
              onChange={(event) =>
                setDossierForm({
                  ...dossierForm,
                  omschrijving:
                    event.target.value,
                })
              }
              rows={4}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900"
            />
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <Input
              label="Documentnaam"
              value={
                dossierForm.documentNaam
              }
              onChange={(event) =>
                setDossierForm({
                  ...dossierForm,
                  documentNaam:
                    event.target.value,
                })
              }
              hint="Optioneel."
            />

            <Input
              label="Bijlage-link / documentlocatie"
              type="url"
              value={
                dossierForm.documentUrl
              }
              onChange={(event) =>
                setDossierForm({
                  ...dossierForm,
                  documentUrl:
                    event.target.value,
                })
              }
              hint="Optioneel."
            />
          </div>

          <Button
            type="submit"
            disabled={opslaan}
          >
            Dossieritem opslaan
          </Button>
        </form>

        <div className="mt-8 border-t border-slate-200 pt-6">
          <h3 className="text-base font-semibold text-slate-900">
            Dossierhistorie
          </h3>

          {dossier.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              Nog geen dossieritems.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {dossier.map(
                (item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-medium text-slate-900">
                          {item.titel}
                        </p>

                        <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {item.type}
                          {item.kanaal
                            ? ` · ${item.kanaal}`
                            : ""}
                          {" · "}
                          {
                            formatteerDatum(
                              item.datum,
                            )
                          }
                        </p>

                        {item.omschrijving && (
                          <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">
                            {
                              item.omschrijving
                            }
                          </p>
                        )}

                        {item.documentUrl && (
                          <a
                            href={
                              item.documentUrl
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="mt-3 inline-block text-sm font-medium text-cyan-700 hover:text-cyan-800"
                          >
                            {
                              item.documentNaam ||
                              "Document openen"
                            }
                          </a>
                        )}
                      </div>

                      <Button
                        variant="danger"
                        size="sm"
                        disabled={opslaan}
                        onClick={() =>
                          void verwijder(
                            "dossier",
                            item.id,
                          )
                        }
                      >
                        Verwijderen
                      </Button>
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
