"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

type Section =
  | "algemeen"
  | "contract"
  | "vestigingen"
  | "verloning";

type Vestiging = {
  id: string;
  naam: string;
};

type Rol = {
  id: string;
  naam: string;
};

type Tag = {
  id: string;
  naam: string;
};

type Medewerker = {
  id: string;

  personeelsnummer: string | null;

  aanhef:
    | "DHR"
    | "MEVR"
    | "ANDERS"
    | "GEEN_OPGAVE";

  voornaam: string;

  tussenvoegsel: string | null;

  achternaam: string;

  roepnaam: string | null;

  geboortedatum:
    | Date
    | string;

  email: string;

  telefoon: string;

  contractType:
    | "OPROEP"
    | "VAST"
    | null;

  contractUren:
    | number
    | string
    | null;

  uurloon:
    | number
    | string
    | null;

  datumInDienst:
    | Date
    | string
    | null;

  datumUitDienst:
    | Date
    | string
    | null;

  vestigingen: Vestiging[];

  hoofdvestigingId: string | null;

  rollen: Rol[];

  tags: Tag[];
};

type Props = {
  medewerker: Medewerker;

  section: Section;

  beschikbareVestigingen?: Vestiging[];

  beschikbareRollen?: Rol[];

  beschikbareTags?: Tag[];
};

type FormState = {
  personeelsnummer: string;

  aanhef:
    | "DHR"
    | "MEVR"
    | "ANDERS"
    | "GEEN_OPGAVE";

  voornaam: string;

  tussenvoegsel: string;

  achternaam: string;

  roepnaam: string;

  geboortedatum: string;

  email: string;

  telefoon: string;

  contractType:
    | ""
    | "OPROEP"
    | "VAST";

  contractUren: string;

  uurloon: string;

  datumInDienst: string;

  datumUitDienst: string;
};

function formatDate(
  value:
    | Date
    | string
    | null,
): string {
  if (!value) {
    return "";
  }

  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "";
  }

  return date
    .toISOString()
    .slice(0, 10);
}

function maakFormulier(
  medewerker: Medewerker,
): FormState {
  return {
    personeelsnummer:
      medewerker.personeelsnummer ??
      "",

    aanhef:
      medewerker.aanhef,

    voornaam:
      medewerker.voornaam,

    tussenvoegsel:
      medewerker.tussenvoegsel ??
      "",

    achternaam:
      medewerker.achternaam,

    roepnaam:
      medewerker.roepnaam ??
      "",

    geboortedatum:
      formatDate(
        medewerker.geboortedatum,
      ),

    email:
      medewerker.email,

    telefoon:
      medewerker.telefoon,

    contractType:
      medewerker.contractType ??
      "",

    contractUren:
      medewerker.contractUren !==
      null
        ? String(
            medewerker.contractUren,
          )
        : "",

    uurloon:
      medewerker.uurloon !== null
        ? String(
            medewerker.uurloon,
          )
        : "",

    datumInDienst:
      formatDate(
        medewerker.datumInDienst,
      ),

    datumUitDienst:
      formatDate(
        medewerker.datumUitDienst,
      ),
  };
}

export default function MedewerkerTabBewerken({
  medewerker,
  section,
  beschikbareVestigingen,
  beschikbareRollen,
  beschikbareTags,
}: Props) {
  const router =
    useRouter();

  const [form, setForm] =
    useState<FormState>(() =>
      maakFormulier(
        medewerker,
      ),
    );

  /*
   * ============================================================
   * VESTIGINGEN
   * ============================================================
   */

  const alleVestigingen =
    beschikbareVestigingen &&
    beschikbareVestigingen.length > 0
      ? beschikbareVestigingen
      : medewerker.vestigingen;

  const [
    geselecteerdeVestigingen,
    setGeselecteerdeVestigingen,
  ] = useState<string[]>(
    medewerker.vestigingen.map(
      (vestiging) =>
        vestiging.id,
    ),
  );

  const [
    hoofdvestigingId,
    setHoofdvestigingId,
  ] = useState<string | null>(
    medewerker.hoofdvestigingId,
  );

  /*
   * ============================================================
   * ROLLEN
   * ============================================================
   */

  const [
    geselecteerdeRollen,
    setGeselecteerdeRollen,
  ] = useState<string[]>(
    medewerker.rollen.map(
      (rol) => rol.id,
    ),
  );

  /*
   * ============================================================
   * PLANNINGSTAGS
   * ============================================================
   */

  const [
    geselecteerdeTags,
    setGeselecteerdeTags,
  ] = useState<string[]>(
    medewerker.tags.map(
      (tag) => tag.id,
    ),
  );

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  function updateField<
    K extends keyof FormState,
  >(
    field: K,
    value: FormState[K],
  ) {
    setForm(
      (current) => ({
        ...current,
        [field]: value,
      }),
    );

    setError("");
  }

  /*
   * ============================================================
   * VESTIGINGEN
   * ============================================================
   */

  function toggleVestiging(
    vestigingId: string,
  ) {
    setGeselecteerdeVestigingen(
      (
        huidigeVestigingen,
      ) => {
        const isGeselecteerd =
          huidigeVestigingen.includes(
            vestigingId,
          );

        if (isGeselecteerd) {
          const nieuweVestigingen =
            huidigeVestigingen.filter(
              (id) =>
                id !==
                vestigingId,
            );

          setHoofdvestigingId(
            (
              huidigeHoofdvestiging,
            ) => {
              if (
                huidigeHoofdvestiging !==
                vestigingId
              ) {
                return huidigeHoofdvestiging;
              }

              return (
                nieuweVestigingen[0] ??
                null
              );
            },
          );

          return nieuweVestigingen;
        }

        return [
          ...huidigeVestigingen,
          vestigingId,
        ];
      },
    );

    setError("");
  }

  function selecteerHoofdvestiging(
    vestigingId: string,
  ) {
    if (
      !geselecteerdeVestigingen.includes(
        vestigingId,
      )
    ) {
      return;
    }

    setHoofdvestigingId(
      vestigingId,
    );

    setError("");
  }

  /*
   * ============================================================
   * ROLLEN
   * ============================================================
   */

  function toggleRol(
    rolId: string,
  ) {
    setGeselecteerdeRollen(
      (huidigeRollen) => {
        if (
          huidigeRollen.includes(
            rolId,
          )
        ) {
          return huidigeRollen.filter(
            (id) => id !== rolId,
          );
        }

        return [
          ...huidigeRollen,
          rolId,
        ];
      },
    );

    setError("");
  }

  /*
   * ============================================================
   * TAGS
   * ============================================================
   */

  function toggleTag(
    tagId: string,
  ) {
    setGeselecteerdeTags(
      (huidigeTags) => {
        if (
          huidigeTags.includes(
            tagId,
          )
        ) {
          return huidigeTags.filter(
            (id) => id !== tagId,
          );
        }

        return [
          ...huidigeTags,
          tagId,
        ];
      },
    );

    setError("");
  }

  function terugNaarTabblad() {
    router.push(
      `/medewerkers/${encodeURIComponent(
        medewerker.id,
      )}?tab=${section}`,
    );
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (saving) {
      return;
    }

    setSaving(true);

    setError("");

    try {
      const data: Record<
        string,
        unknown
      > = {};

      /*
       * ==========================================================
       * ALGEMEEN
       * ==========================================================
       */

      if (section === "algemeen") {
        if (
          !form.voornaam.trim()
        ) {
          throw new Error(
            "Voornaam is verplicht.",
          );
        }

        if (
          !form.achternaam.trim()
        ) {
          throw new Error(
            "Achternaam is verplicht.",
          );
        }

        if (
          !form.geboortedatum
        ) {
          throw new Error(
            "Geboortedatum is verplicht.",
          );
        }

        if (
          !form.email.trim()
        ) {
          throw new Error(
            "E-mailadres is verplicht.",
          );
        }

        if (
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
            form.email.trim(),
          )
        ) {
          throw new Error(
            "Het e-mailadres is ongeldig.",
          );
        }

        if (
          !form.telefoon.trim()
        ) {
          throw new Error(
            "Telefoonnummer is verplicht.",
          );
        }

        data.personeelsnummer =
          form.personeelsnummer.trim() ||
          null;

        data.aanhef =
          form.aanhef;

        data.voornaam =
          form.voornaam.trim();

        data.tussenvoegsel =
          form.tussenvoegsel.trim() ||
          null;

        data.achternaam =
          form.achternaam.trim();

        data.roepnaam =
          form.roepnaam.trim() ||
          null;

        data.geboortedatum =
          form.geboortedatum;

        data.email =
          form.email
            .trim()
            .toLowerCase();

        data.telefoon =
          form.telefoon.trim();

        /*
         * ========================================================
         * ROLLEN
         * ========================================================
         */

        data.rolIds =
          geselecteerdeRollen;

        /*
         * ========================================================
         * PLANNINGSTAGS
         * ========================================================
         */

        data.tagIds =
          geselecteerdeTags;
      }

      /*
       * ==========================================================
       * CONTRACT
       * ==========================================================
       */

      if (section === "contract") {
        let contractUren:
          | number
          | null = null;

        if (
          form.contractUren.trim()
        ) {
          const waarde =
            Number(
              form.contractUren,
            );

          if (
            !Number.isFinite(
              waarde,
            ) ||
            waarde < 0
          ) {
            throw new Error(
              "Contracturen moeten een geldig getal zijn.",
            );
          }

          contractUren =
            waarde;
        }

        if (
          form.datumInDienst &&
          form.datumUitDienst &&
          form.datumUitDienst <
            form.datumInDienst
        ) {
          throw new Error(
            "De datum uit dienst kan niet vóór de datum in dienst liggen.",
          );
        }

        data.contractType =
          form.contractType ||
          null;

        data.contractUren =
          contractUren;

        data.datumInDienst =
          form.datumInDienst ||
          null;

        data.datumUitDienst =
          form.datumUitDienst ||
          null;
      }

      /*
       * ==========================================================
       * VESTIGINGEN
       * ==========================================================
       */

      if (
        section ===
        "vestigingen"
      ) {
        if (
          geselecteerdeVestigingen.length ===
          0
        ) {
          throw new Error(
            "Een medewerker moet aan minimaal één vestiging gekoppeld zijn.",
          );
        }

        if (
          !hoofdvestigingId
        ) {
          throw new Error(
            "Selecteer een hoofdvestiging.",
          );
        }

        if (
          !geselecteerdeVestigingen.includes(
            hoofdvestigingId,
          )
        ) {
          throw new Error(
            "De hoofdvestiging moet een geselecteerde vestiging zijn.",
          );
        }

        data.vestigingIds =
          geselecteerdeVestigingen;

        data.hoofdvestigingId =
          hoofdvestigingId;
      }

      /*
       * ==========================================================
       * VERLONING
       * ==========================================================
       */

      if (
        section ===
        "verloning"
      ) {
        let uurloon:
          | number
          | null = null;

        if (
          form.uurloon.trim()
        ) {
          const waarde =
            Number(
              form.uurloon,
            );

          if (
            !Number.isFinite(
              waarde,
            ) ||
            waarde < 0
          ) {
            throw new Error(
              "Uurloon moet een geldig bedrag zijn.",
            );
          }

          uurloon =
            waarde;
        }

        data.uurloon =
          uurloon;
      }

      /*
       * ==========================================================
       * API
       * ==========================================================
       */

      const response =
        await fetch(
          `/api/medewerkers/${encodeURIComponent(
            medewerker.id,
          )}`,
          {
            method: "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              section,
              data,
            }),
          },
        );

      let resultaat:
        | {
            error?: string;
            melding?: string;
          }
        | null = null;

      try {
        resultaat =
          await response.json();
      } catch {
        resultaat = null;
      }

      if (
        !response.ok
      ) {
        throw new Error(
          resultaat?.error ??
            "Opslaan is mislukt.",
        );
      }

      router.push(
        `/medewerkers/${encodeURIComponent(
          medewerker.id,
        )}?tab=${section}`,
      );

      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Opslaan is mislukt.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-8"
    >
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ========================================================
          ALGEMEEN
          ======================================================== */}

      {section ===
        "algemeen" && (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <Input
              label="Personeelsnummer"
              name="personeelsnummer"
              value={
                form.personeelsnummer
              }
              onChange={(event) =>
                updateField(
                  "personeelsnummer",
                  event.target.value,
                )
              }
            />

            <div>
              <label
                htmlFor="aanhef"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Aanhef
              </label>

              <select
                id="aanhef"
                name="aanhef"
                value={
                  form.aanhef
                }
                onChange={(event) =>
                  updateField(
                    "aanhef",
                    event.target
                      .value as FormState["aanhef"],
                  )
                }
                disabled={saving}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 transition focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200 disabled:cursor-not-allowed disabled:bg-slate-100"
              >
                <option value="DHR">
                  Dhr.
                </option>

                <option value="MEVR">
                  Mevr.
                </option>

                <option value="ANDERS">
                  Anders
                </option>

                <option value="GEEN_OPGAVE">
                  Geen opgave
                </option>
              </select>
            </div>

            <Input
              label="Voornaam"
              name="voornaam"
              value={form.voornaam}
              onChange={(event) =>
                updateField(
                  "voornaam",
                  event.target.value,
                )
              }
              required
            />

            <Input
              label="Tussenvoegsel"
              name="tussenvoegsel"
              value={
                form.tussenvoegsel
              }
              onChange={(event) =>
                updateField(
                  "tussenvoegsel",
                  event.target.value,
                )
              }
            />

            <Input
              label="Achternaam"
              name="achternaam"
              value={
                form.achternaam
              }
              onChange={(event) =>
                updateField(
                  "achternaam",
                  event.target.value,
                )
              }
              required
            />

            <Input
              label="Roepnaam"
              name="roepnaam"
              value={
                form.roepnaam
              }
              onChange={(event) =>
                updateField(
                  "roepnaam",
                  event.target.value,
                )
              }
            />

            <Input
              label="Geboortedatum"
              name="geboortedatum"
              type="date"
              value={
                form.geboortedatum
              }
              onChange={(event) =>
                updateField(
                  "geboortedatum",
                  event.target.value,
                )
              }
              required
            />

            <Input
              label="E-mailadres"
              name="email"
              type="email"
              value={form.email}
              onChange={(event) =>
                updateField(
                  "email",
                  event.target.value,
                )
              }
              required
            />

            <Input
              label="Telefoonnummer"
              name="telefoon"
              type="tel"
              value={
                form.telefoon
              }
              onChange={(event) =>
                updateField(
                  "telefoon",
                  event.target.value,
                )
              }
              required
            />
          </div>

          {/* ====================================================
              ROLLEN
              ==================================================== */}

          <div className="border-t border-slate-200 pt-8">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Rollen
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Selecteer de rollen die aan deze medewerker zijn gekoppeld.
              </p>
            </div>

            {!beschikbareRollen ||
            beschikbareRollen.length ===
              0 ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Er zijn geen rollen beschikbaar.
              </div>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {beschikbareRollen.map(
                  (rol) => {
                    const geselecteerd =
                      geselecteerdeRollen.includes(
                        rol.id,
                      );

                    return (
                      <label
                        key={rol.id}
                        className={[
                          "flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition",
                          geselecteerd
                            ? "border-cyan-300 bg-cyan-50"
                            : "border-slate-200 bg-white hover:bg-slate-50",
                        ].join(" ")}
                      >
                        <input
                          type="checkbox"
                          checked={
                            geselecteerd
                          }
                          onChange={() =>
                            toggleRol(
                              rol.id,
                            )
                          }
                          disabled={
                            saving
                          }
                          className="h-4 w-4 rounded border-slate-300"
                        />

                        <span className="text-sm font-medium text-slate-800">
                          {rol.naam}
                        </span>
                      </label>
                    );
                  },
                )}
              </div>
            )}
          </div>

          {/* ====================================================
              PLANNINGSTAGS
              ==================================================== */}

          <div className="border-t border-slate-200 pt-8">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Planningstags
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Selecteer welke planningstags deze medewerker kan uitvoeren.
              </p>
            </div>

            {!beschikbareTags ||
            beschikbareTags.length ===
              0 ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Er zijn geen planningstags beschikbaar.
              </div>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {beschikbareTags.map(
                  (tag) => {
                    const geselecteerd =
                      geselecteerdeTags.includes(
                        tag.id,
                      );

                    return (
                      <label
                        key={tag.id}
                        className={[
                          "flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition",
                          geselecteerd
                            ? "border-cyan-300 bg-cyan-50"
                            : "border-slate-200 bg-white hover:bg-slate-50",
                        ].join(" ")}
                      >
                        <input
                          type="checkbox"
                          checked={
                            geselecteerd
                          }
                          onChange={() =>
                            toggleTag(
                              tag.id,
                            )
                          }
                          disabled={
                            saving
                          }
                          className="h-4 w-4 rounded border-slate-300"
                        />

                        <span className="text-sm font-medium text-slate-800">
                          {tag.naam}
                        </span>
                      </label>
                    );
                  },
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ========================================================
          CONTRACT
          ======================================================== */}

      {section ===
        "contract" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <label
              htmlFor="contractType"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Contracttype
            </label>

            <select
              id="contractType"
              name="contractType"
              value={
                form.contractType
              }
              onChange={(event) =>
                updateField(
                  "contractType",
                  event.target
                    .value as FormState["contractType"],
                )
              }
              disabled={saving}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 transition focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200 disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              <option value="">
                Nog niet ingevuld
              </option>

              <option value="OPROEP">
                Oproep
              </option>

              <option value="VAST">
                Vast
              </option>
            </select>
          </div>

          <Input
            label="Contracturen per week"
            name="contractUren"
            type="number"
            min="0"
            step="0.25"
            value={
              form.contractUren
            }
            onChange={(event) =>
              updateField(
                "contractUren",
                event.target.value,
              )
            }
          />

          <Input
            label="Datum in dienst"
            name="datumInDienst"
            type="date"
            value={
              form.datumInDienst
            }
            onChange={(event) =>
              updateField(
                "datumInDienst",
                event.target.value,
              )
            }
          />

          <Input
            label="Datum uit dienst"
            name="datumUitDienst"
            type="date"
            value={
              form.datumUitDienst
            }
            onChange={(event) =>
              updateField(
                "datumUitDienst",
                event.target.value,
              )
            }
          />
        </div>
      )}

      {/* ========================================================
          VESTIGINGEN
          ======================================================== */}

      {section ===
        "vestigingen" && (
        <div className="space-y-6">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Vestigingen koppelen
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Selecteer de vestigingen
              waar deze medewerker werkt.
              Kies vervolgens één
              hoofdvestiging.
            </p>
          </div>

          {alleVestigingen.length ===
          0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Er zijn geen actieve
              vestigingen beschikbaar.
            </div>
          ) : (
            <div className="space-y-3">
              {alleVestigingen.map(
                (vestiging) => {
                  const geselecteerd =
                    geselecteerdeVestigingen.includes(
                      vestiging.id,
                    );

                  const isHoofdvestiging =
                    hoofdvestigingId ===
                    vestiging.id;

                  return (
                    <div
                      key={vestiging.id}
                      className={[
                        "rounded-xl border p-4 transition",
                        geselecteerd
                          ? "border-cyan-300 bg-cyan-50"
                          : "border-slate-200 bg-white",
                      ].join(" ")}
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <label className="flex cursor-pointer items-center gap-3">
                          <input
                            type="checkbox"
                            checked={
                              geselecteerd
                            }
                            onChange={() =>
                              toggleVestiging(
                                vestiging.id,
                              )
                            }
                            disabled={
                              saving
                            }
                            className="h-4 w-4 rounded border-slate-300"
                          />

                          <span className="text-sm font-medium text-slate-800">
                            {
                              vestiging.naam
                            }
                          </span>
                        </label>

                        {geselecteerd && (
                          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                            <input
                              type="radio"
                              name="hoofdvestiging"
                              value={
                                vestiging.id
                              }
                              checked={
                                isHoofdvestiging
                              }
                              onChange={() =>
                                selecteerHoofdvestiging(
                                  vestiging.id,
                                )
                              }
                              disabled={
                                saving
                              }
                              className="h-4 w-4 border-slate-300"
                            />

                            <span>
                              Hoofdvestiging
                            </span>
                          </label>
                        )}
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          )}

          {geselecteerdeVestigingen.length >
            0 &&
            !hoofdvestigingId && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Kies een hoofdvestiging
                voordat je de wijzigingen
                opslaat.
              </div>
            )}
        </div>
      )}

      {/* ========================================================
          VERLONING
          ======================================================== */}

      {section ===
        "verloning" && (
        <div className="max-w-md">
          <Input
            label="Uurloon"
            name="uurloon"
            type="number"
            min="0"
            step="0.01"
            value={form.uurloon}
            onChange={(event) =>
              updateField(
                "uurloon",
                event.target.value,
              )
            }
          />
        </div>
      )}

      {/* ========================================================
          ACTIES
          ======================================================== */}

      <div className="flex justify-end gap-3 border-t border-slate-200 pt-6">
        <Button
          type="button"
          variant="secondary"
          onClick={
            terugNaarTabblad
          }
          disabled={saving}
        >
          Annuleren
        </Button>

        <Button
          type="submit"
          disabled={saving}
        >
          {saving
            ? "Opslaan..."
            : "Wijzigingen opslaan"}
        </Button>
      </div>
    </form>
  );
}