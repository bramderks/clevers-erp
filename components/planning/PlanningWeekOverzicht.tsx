"use client";

import type {
  PlanningWeek,
} from "@/types/planning";

type PlanningWeekOverzichtProps = {
  week: PlanningWeek;

  onNieuweDienst?: (
    datum: string,
  ) => void;

  onWijzigDienst?: (
    dienstId: string,
  ) => void;

  onVerwijderDienst?: (
    dienstId: string,
  ) => void;
};

type PlanningDienst =
  PlanningWeek["diensten"][number];

type Dag = {
  datum: string;
  datumObject: Date;
};

type PlanningGroep = {
  id: string;
  naam: string;
  diensten: PlanningDienst[];
};

type VasteGroep = {
  sleutel: string;
  naam: string;
  varianten: string[];
};

/*
 * ============================================================
 * VASTE VOLGORDE VAN FUNCTIEGROEPEN
 * ============================================================
 *
 * Deze groepen worden altijd weergegeven.
 *
 * Ook wanneer er op een bepaalde dag
 * nog geen dienst binnen die groep staat.
 */

const VASTE_GROEPEN: VasteGroep[] = [
  {
    sleutel: "leidinggevende",
    naam: "Leidinggevende",
    varianten: [
      "leidinggevende",
      "leidinggevenden",
    ],
  },
  {
    sleutel: "coupes",
    naam: "Coupes",
    varianten: [
      "coupes",
      "coupe",
    ],
  },
  {
    sleutel: "handijs",
    naam: "Handijs",
    varianten: [
      "handijs",
      "hand ijs",
    ],
  },
  {
    sleutel: "bediening",
    naam: "Bediening",
    varianten: [
      "bediening",
    ],
  },
  {
    sleutel: "vaatstraat",
    naam: "Vaatstraat",
    varianten: [
      "vaatstraat",
      "vaat straat",
      "vaatstraaat",
      "vaatstaraat",
    ],
  },
];

/*
 * ============================================================
 * DATUM HULPFUNCTIES
 * ============================================================
 */

function datumNaarIso(
  datum: Date,
) {
  const jaar =
    datum.getFullYear();

  const maand = String(
    datum.getMonth() + 1,
  ).padStart(2, "0");

  const dag = String(
    datum.getDate(),
  ).padStart(2, "0");

  return `${jaar}-${maand}-${dag}`;
}

function isoWeekNaarMaandag(
  jaar: number,
  weeknummer: number,
) {
  const vierdeJanuari =
    new Date(
      jaar,
      0,
      4,
      12,
      0,
      0,
    );

  const dag =
    vierdeJanuari.getDay() ||
    7;

  const maandag =
    new Date(
      vierdeJanuari,
    );

  maandag.setDate(
    vierdeJanuari.getDate() -
      dag +
      1 +
      (weeknummer - 1) * 7,
  );

  return maandag;
}

function maakWeekDagen(
  weeknummer: number,
  jaar: number,
): Dag[] {
  const maandag =
    isoWeekNaarMaandag(
      jaar,
      weeknummer,
    );

  return Array.from(
    {
      length: 7,
    },
    (_, index) => {
      const datum =
        new Date(maandag);

      datum.setDate(
        maandag.getDate() +
          index,
      );

      return {
        datum:
          datumNaarIso(datum),

        datumObject:
          datum,
      };
    },
  );
}

/*
 * ============================================================
 * FORMATTERING
 * ============================================================
 */

function formatteerDag(
  datum: Date,
) {
  return new Intl.DateTimeFormat(
    "nl-NL",
    {
      weekday: "long",
    },
  ).format(datum);
}

function formatteerDatum(
  datum: Date,
) {
  return new Intl.DateTimeFormat(
    "nl-NL",
    {
      day: "numeric",
      month: "short",
    },
  ).format(datum);
}

function formatteerTijd(
  waarde: string,
) {
  const match =
    /^(\d{1,2}):(\d{2})/.exec(
      waarde,
    );

  if (match) {
    return `${match[1].padStart(
      2,
      "0",
    )}:${match[2]}`;
  }

  const datum =
    new Date(waarde);

  if (
    Number.isNaN(
      datum.getTime(),
    )
  ) {
    return waarde;
  }

  return new Intl.DateTimeFormat(
    "nl-NL",
    {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    },
  ).format(datum);
}

function dienstDatum(
  waarde: string,
) {
  if (
    /^\d{4}-\d{2}-\d{2}$/.test(
      waarde,
    )
  ) {
    return waarde;
  }

  const datum =
    new Date(waarde);

  if (
    Number.isNaN(
      datum.getTime(),
    )
  ) {
    return "";
  }

  return datumNaarIso(
    datum,
  );
}

/*
 * ============================================================
 * MEDEWERKER HULPFUNCTIES
 * ============================================================
 */

function medewerkerNaam(
  medewerker: NonNullable<
    PlanningDienst["bezetting"][number]["medewerker"]
  >,
) {
  return [
    medewerker.voornaam,
    medewerker.tussenvoegsel,
    medewerker.achternaam,
  ]
    .filter(Boolean)
    .join(" ");
}

/*
 * ============================================================
 * TAG HULPFUNCTIES
 * ============================================================
 */

function tagIdVanDienstTag(
  dienstTag: PlanningDienst["tags"][number],
) {
  return (
    dienstTag.tagId ??
    dienstTag.tag?.id ??
    null
  );
}

function tagNaamVanDienstTag(
  dienstTag: PlanningDienst["tags"][number],
) {
  return (
    dienstTag.tag?.naam ??
    "Onbekende functie"
  );
}

function normaliseerNaam(
  naam: string,
) {
  return naam
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function vindVasteGroep(
  tagNaam: string,
) {
  const genormaliseerd =
    normaliseerNaam(
      tagNaam,
    );

  return VASTE_GROEPEN.find(
    (groep) =>
      groep.varianten.some(
        (variant) =>
          normaliseerNaam(
            variant,
          ) === genormaliseerd,
      ),
  );
}

/*
 * ============================================================
 * DIENSTEN SORTEREN
 * ============================================================
 */

function sorteerDiensten(
  diensten: PlanningDienst[],
) {
  return [...diensten].sort(
    (a, b) =>
      formatteerTijd(
        a.begintijd,
      ).localeCompare(
        formatteerTijd(
          b.begintijd,
        ),
        "nl",
      ),
  );
}

/*
 * ============================================================
 * GROEPERING
 * ============================================================
 *
 * Eerst worden altijd de vijf vaste groepen
 * aangemaakt.
 *
 * Daarna worden eventuele overige tags toegevoegd.
 */

function maakGroepen(
  diensten: PlanningDienst[],
): PlanningGroep[] {
  const groepen =
    new Map<
      string,
      PlanningGroep
    >();

  /*
   * ==========================================================
   * VASTE GROEPEN ALTIJD AANMAKEN
   * ==========================================================
   */

  for (
    const vasteGroep of VASTE_GROEPEN
  ) {
    groepen.set(
      `vast-${vasteGroep.sleutel}`,
      {
        id:
          `vast-${vasteGroep.sleutel}`,

        naam:
          vasteGroep.naam,

        diensten: [],
      },
    );
  }

  /*
   * ==========================================================
   * DIENSTEN VERDELEN OVER GROEPEN
   * ==========================================================
   */

  for (
    const dienst of diensten
  ) {
    if (
      !dienst.tags ||
      dienst.tags.length === 0
    ) {
      const zonderTagId =
        "__zonder_tag__";

      const bestaandeGroep =
        groepen.get(
          zonderTagId,
        );

      if (
        bestaandeGroep
      ) {
        bestaandeGroep.diensten.push(
          dienst,
        );
      } else {
        groepen.set(
          zonderTagId,
          {
            id:
              zonderTagId,

            naam:
              "Overig",

            diensten: [
              dienst,
            ],
          },
        );
      }

      continue;
    }

    /*
     * Een dienst met meerdere tags
     * verschijnt binnen alle relevante
     * functiegroepen.
     */

    for (
      const dienstTag of dienst.tags
    ) {
      const tagId =
        tagIdVanDienstTag(
          dienstTag,
        );

      const tagNaam =
        tagNaamVanDienstTag(
          dienstTag,
        );

      const vasteGroep =
        vindVasteGroep(
          tagNaam,
        );

      /*
       * ========================================================
       * VASTE GROEP
       * ========================================================
       */

      if (
        vasteGroep
      ) {
        const groepId =
          `vast-${vasteGroep.sleutel}`;

        const groep =
          groepen.get(
            groepId,
          );

        groep?.diensten.push(
          dienst,
        );

        continue;
      }

      /*
       * ========================================================
       * OVERIGE TAG
       * ========================================================
       */

      if (!tagId) {
        continue;
      }

      const groepId =
        `tag-${tagId}`;

      const bestaandeGroep =
        groepen.get(
          groepId,
        );

      if (
        bestaandeGroep
      ) {
        bestaandeGroep.diensten.push(
          dienst,
        );
      } else {
        groepen.set(
          groepId,
          {
            id: groepId,

            naam: tagNaam,

            diensten: [
              dienst,
            ],
          },
        );
      }
    }
  }

  /*
   * ==========================================================
   * SORTEREN
   * ==========================================================
   *
   * 1. Vaste groepen
   * 2. Overige tags alfabetisch
   * 3. Overig / zonder tag
   */

  const vasteGroepen =
    VASTE_GROEPEN.map(
      (vasteGroep) =>
        groepen.get(
          `vast-${vasteGroep.sleutel}`,
        ),
    )
      .filter(
        (
          groep,
        ): groep is PlanningGroep =>
          Boolean(groep),
      )
      .map((groep) => ({
        ...groep,

        diensten:
          sorteerDiensten(
            groep.diensten,
          ),
      }));

  const overigeGroepen =
    Array.from(
      groepen.values(),
    )
      .filter(
        (groep) =>
          !groep.id.startsWith(
            "vast-",
          ) &&
          groep.id !==
            "__zonder_tag__",
      )
      .map((groep) => ({
        ...groep,

        diensten:
          sorteerDiensten(
            groep.diensten,
          ),
      }))
      .sort((a, b) =>
        a.naam.localeCompare(
          b.naam,
          "nl",
        ),
      );

  const zonderTag =
    groepen.get(
      "__zonder_tag__",
    );

  const resultaat = [
    ...vasteGroepen,
    ...overigeGroepen,
  ];

  if (zonderTag) {
    resultaat.push({
      ...zonderTag,

      diensten:
        sorteerDiensten(
          zonderTag.diensten,
        ),
    });
  }

  return resultaat;
}

/*
 * ============================================================
 * DIENSTSTATUS
 * ============================================================
 *
 * Groen  = gevuld
 * Rood   = open
 * Blauw  = geruild
 * Geel   = aandachtspunt
 */

function bepaalDienstStatus(
  dienst: PlanningDienst,
) {
  const dienstData =
    dienst as PlanningDienst & {
      status?: string;
      planningStatus?: string;
      isGeruild?: boolean;
      geruild?: boolean;
      aandachtspunt?: boolean;
      heeftAandachtspunt?: boolean;
    };

  const status =
    String(
      dienstData.status ??
        dienstData.planningStatus ??
        "",
    ).toUpperCase();

  /*
   * ==========================================================
   * GERUILD
   * ==========================================================
   */

  if (
    status.includes("RUIL") ||
    status.includes("GERUILD") ||
    dienstData.isGeruild === true ||
    dienstData.geruild === true
  ) {
    return "GERUILD";
  }

  /*
   * ==========================================================
   * AANDACHTSPUNT
   * ==========================================================
   */

  if (
    status.includes("AANDACHT") ||
    status.includes("PROBLEEM") ||
    dienstData.aandachtspunt === true ||
    dienstData.heeftAandachtspunt === true
  ) {
    return "AANDACHT";
  }

  const actieveBezetting =
    dienst.bezetting.filter(
      (bezetting) =>
        bezetting.status !==
          "AFGEZEGD" &&
        bezetting.medewerker !== null,
    );

  /*
   * ==========================================================
   * OPEN
   * ==========================================================
   */

  if (
    actieveBezetting.length ===
    0
  ) {
    return "OPEN";
  }

  /*
   * ==========================================================
   * GEVULD
   * ==========================================================
   */

  return "GEVULD";
}

function dienstStatusStyling(
  dienst: PlanningDienst,
) {
  const status =
    bepaalDienstStatus(
      dienst,
    );

  switch (status) {
    case "GERUILD":
      return {
        kaart:
          "border-blue-300 bg-blue-50 hover:border-blue-400 hover:bg-blue-100",

        badge:
          "bg-blue-100 text-blue-700",

        label:
          "Geruild",
      };

    case "AANDACHT":
      return {
        kaart:
          "border-yellow-300 bg-yellow-50 hover:border-yellow-400 hover:bg-yellow-100",

        badge:
          "bg-yellow-100 text-yellow-700",

        label:
          "Aandachtspunt",
      };

    case "OPEN":
      return {
        kaart:
          "border-red-300 bg-red-50 hover:border-red-400 hover:bg-red-100",

        badge:
          "bg-red-100 text-red-700",

        label:
          "Open",
      };

    case "GEVULD":
    default:
      return {
        kaart:
          "border-emerald-300 bg-emerald-50 hover:border-emerald-400 hover:bg-emerald-100",

        badge:
          "bg-emerald-100 text-emerald-700",

        label:
          "Gevuld",
      };
  }
}

/*
 * ============================================================
 * COMPONENT
 * ============================================================
 */

export default function PlanningWeekOverzicht({
  week,

  onNieuweDienst,
  onWijzigDienst,
  onVerwijderDienst,
}: PlanningWeekOverzichtProps) {
  const dagen =
    maakWeekDagen(
      week.weeknummer,
      week.jaar,
    );

  function openDienst(
    dienstId: string,
  ) {
    onWijzigDienst?.(
      dienstId,
    );
  }

  return (
    <section>
      {/* ========================================================
          HORIZONTALE WEEKWEERGAVE
          ======================================================== */}

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* ======================================================
            SCROLL INFORMATIE
            ====================================================== */}

        <div className="border-b border-slate-200 px-4 py-3 sm:px-6">
          <p className="text-sm text-slate-500">
            Horizontale weekplanning

            <span className="ml-2 text-slate-400">
              ← scroll om alle dagen te bekijken →
            </span>
          </p>
        </div>

        {/* ======================================================
            HORIZONTALE SCROLL CONTAINER
            ====================================================== */}

        <div className="w-full overflow-x-auto overscroll-x-contain pb-4">
          <div className="min-w-[2240px] p-4 sm:p-6">
            <div className="grid grid-cols-7 gap-4">
              {dagen.map((dag) => {
                const dienstenVanDag =
                  sorteerDiensten(
                    week.diensten.filter(
                      (dienst) =>
                        dienstDatum(
                          dienst.datum,
                        ) ===
                        dag.datum,
                    ),
                  );

                const groepen =
                  maakGroepen(
                    dienstenVanDag,
                  );

                return (
                  <div
                    key={dag.datum}
                    className="flex min-h-[760px] min-w-[300px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                  >
                    {/* ==========================================
                        DAG HEADER
                        ========================================== */}

                    <div className="sticky top-0 z-10 border-b border-slate-200 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h2 className="capitalize text-base font-bold text-slate-900">
                            {formatteerDag(
                              dag.datumObject,
                            )}
                          </h2>

                          <p className="mt-1 text-sm text-slate-500">
                            {formatteerDatum(
                              dag.datumObject,
                            )}
                          </p>
                        </div>

                        <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-slate-100 px-2 text-xs font-bold text-slate-600">
                          {
                            dienstenVanDag.length
                          }
                        </span>
                      </div>

                      {/* ========================================
                          + DIENST
                          ======================================== */}

                      {onNieuweDienst && (
                        <button
                          type="button"
                          onClick={() =>
                            onNieuweDienst(
                              dag.datum,
                            )
                          }
                          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.99]"
                        >
                          <span className="text-lg leading-none">
                            +
                          </span>

                          Dienst
                        </button>
                      )}
                    </div>

                    {/* ==========================================
                        FUNCTIEGROEPEN
                        ========================================== */}

                    <div className="flex-1 space-y-5 p-3">
                      {groepen.map(
                        (groep) => (
                          <div
                            key={groep.id}
                            className="space-y-2"
                          >
                            {/* ==================================
                                GROEP HEADER
                                ================================== */}

                            <div className="flex items-center gap-2 border-b-2 border-slate-200 pb-2">
                              <div className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />

                              <h3 className="min-w-0 flex-1 text-xs font-extrabold uppercase tracking-wider text-slate-700">
                                {groep.naam}
                              </h3>

                              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                                {
                                  groep.diensten
                                    .length
                                }
                              </span>
                            </div>

                            {/* ==================================
                                GEEN DIENSTEN IN GROEP
                                ================================== */}

                            {groep.diensten.length ===
                              0 && (
                              <div className="rounded-lg border border-dashed border-slate-200 bg-white/70 px-3 py-3">
                                <p className="text-xs text-slate-400">
                                  Geen dienst gepland
                                </p>
                              </div>
                            )}

                            {/* ==================================
                                DIENSTEN
                                ================================== */}

                            {groep.diensten.length >
                              0 && (
                              <div className="space-y-2">
                                {groep.diensten.map(
                                  (
                                    dienst,
                                  ) => {
                                    const styling =
                                      dienstStatusStyling(
                                        dienst,
                                      );

                                    /*
                                     * Alleen actieve,
                                     * daadwerkelijk gekoppelde
                                     * medewerkers tonen.
                                     */

                                    const actieveBezetting =
                                      dienst.bezetting.filter(
                                        (
                                          bezetting,
                                        ) =>
                                          bezetting.status !==
                                            "AFGEZEGD" &&
                                          bezetting.medewerker !==
                                            null,
                                      );

                                    return (
                                      <div
                                        key={`${groep.id}-${dienst.id}`}
                                        role={
                                          onWijzigDienst
                                            ? "button"
                                            : undefined
                                        }
                                        tabIndex={
                                          onWijzigDienst
                                            ? 0
                                            : undefined
                                        }
                                        onClick={() =>
                                          openDienst(
                                            dienst.id,
                                          )
                                        }
                                        onKeyDown={(
                                          event,
                                        ) => {
                                          if (
                                            !onWijzigDienst
                                          ) {
                                            return;
                                          }

                                          if (
                                            event.key ===
                                              "Enter" ||
                                            event.key ===
                                              " "
                                          ) {
                                            event.preventDefault();

                                            openDienst(
                                              dienst.id,
                                            );
                                          }
                                        }}
                                        className={`rounded-xl border p-3 shadow-sm transition ${
                                          styling.kaart
                                        } ${
                                          onWijzigDienst
                                            ? "cursor-pointer"
                                            : ""
                                        }`}
                                      >
                                        {/* ======================
                                            TIJD + STATUS
                                            ====================== */}

                                        <div className="flex items-start justify-between gap-2">
                                          <div>
                                            <p className="text-sm font-bold text-slate-900">
                                              {formatteerTijd(
                                                dienst.begintijd,
                                              )}

                                              {" – "}

                                              {formatteerTijd(
                                                dienst.eindtijd,
                                              )}
                                            </p>

                                            <span
                                              className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${styling.badge}`}
                                            >
                                              {
                                                styling.label
                                              }
                                            </span>
                                          </div>

                                          {onVerwijderDienst && (
                                            <button
                                              type="button"
                                              onClick={(
                                                event,
                                              ) => {
                                                event.stopPropagation();

                                                onVerwijderDienst(
                                                  dienst.id,
                                                );
                                              }}
                                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-lg font-bold text-red-500 transition hover:bg-red-50"
                                              title="Dienst verwijderen"
                                            >
                                              ×
                                            </button>
                                          )}
                                        </div>

                                        {/* ======================
                                            ALLE FUNCTIES
                                            ====================== */}

                                        {dienst.tags &&
                                          dienst.tags
                                            .length >
                                            1 && (
                                            <div className="mt-3 flex flex-wrap gap-1">
                                              {dienst.tags.map(
                                                (
                                                  dienstTag,
                                                ) => (
                                                  <span
                                                    key={
                                                      dienstTag.id
                                                    }
                                                    className="rounded-full bg-white/70 px-2 py-1 text-[10px] font-medium text-slate-600"
                                                  >
                                                    {tagNaamVanDienstTag(
                                                      dienstTag,
                                                    )}

                                                    {dienstTag.aantal >
                                                      1 &&
                                                      ` × ${dienstTag.aantal}`}
                                                  </span>
                                                ),
                                              )}
                                            </div>
                                          )}

                                        {/* ======================
                                            OPMERKING
                                            ====================== */}

                                        {dienst.opmerkingen && (
                                          <p className="mt-3 text-xs leading-relaxed text-slate-600">
                                            {
                                              dienst.opmerkingen
                                            }
                                          </p>
                                        )}

                                        {/* ======================
                                            BEZETTING
                                            ====================== */}

                                        <div className="mt-3 border-t border-slate-900/10 pt-2">
                                          <div className="flex items-center justify-between">
                                            <span className="text-[11px] text-slate-500">
                                              Bezetting
                                            </span>

                                            <span className="text-xs font-bold text-slate-700">
                                              {
                                                actieveBezetting.length
                                              }{" "}
                                              ingepland
                                            </span>
                                          </div>

                                          {/* ==================
                                              INGEPLANDE
                                              MEDEWERKERS
                                              ================== */}

                                          {actieveBezetting.length >
                                            0 && (
                                            <div className="mt-2 space-y-1.5">
                                              {actieveBezetting.map(
                                                (
                                                  bezetting,
                                                ) => {
                                                  const medewerker =
                                                    bezetting.medewerker;

                                                  if (
                                                    !medewerker
                                                  ) {
                                                    return null;
                                                  }

                                                  return (
                                                    <div
                                                      key={
                                                        bezetting.id
                                                      }
                                                      className="flex items-center gap-2 rounded-lg bg-white/60 px-2.5 py-2"
                                                    >
                                                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700">
                                                        ✓
                                                      </span>

                                                      <span className="min-w-0 truncate text-xs font-semibold text-slate-700">
                                                        {medewerkerNaam(
                                                          medewerker,
                                                        )}
                                                      </span>
                                                    </div>
                                                  );
                                                },
                                              )}
                                            </div>
                                          )}
                                        </div>

                                        {/* ======================
                                            OPEN DIENST MELDING
                                            ====================== */}

                                        {actieveBezetting.length ===
                                          0 && (
                                          <p className="mt-2 text-[11px] font-semibold text-red-600">
                                            Deze dienst staat open
                                          </p>
                                        )}
                                      </div>
                                    );
                                  },
                                )}
                              </div>
                            )}
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}