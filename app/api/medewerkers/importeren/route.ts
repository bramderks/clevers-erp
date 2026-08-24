import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

import { prisma } from "@/lib/prisma";
import {
  getCurrentUser,
  hasPermission,
} from "@/lib/auth";
import { permissions } from "@/lib/permissions";

export const runtime = "nodejs";

type ImportRij = {
  personeelsnummer: string;
  aanhef: string;
  voornaam: string;
  tussenvoegsel: string;
  achternaam: string;
  roepnaam: string;
  geboortedatum: string;
  email: string;
  telefoon: string;
  contracttype: string;
  contracturen: string;
  uurloon: string;
  datumindienst: string;
  datumuitdienst: string;
  vestiging: string;
  hoofdvestiging: string;
};

type ImportFout = {
  rij: number;
  veld?: string;
  melding: string;
};

type OrganisatieContext = {
  organisatieId: string;
  eigenaar: boolean;
};

/*
 * ============================================================
 * VERPLICHTE KOLOMMEN
 * ============================================================
 *
 * Deze sluiten aan op het huidige importbestand.
 *
 * Rol wordt NIET geïmporteerd.
 *
 * De organisatie van een medewerker wordt bepaald via:
 *
 * Medewerker
 *   -> MedewerkerVestiging
 *      -> Vestiging
 *         -> organisatieId
 */

const VERPLICHTE_KOLOMMEN = [
  "personeelsnummer",
  "aanhef",
  "voornaam",
  "achternaam",
  "geboortedatum",
  "email",
  "telefoon",
  "vestiging",
];

/*
 * ============================================================
 * KOLOMNAMEN
 * ============================================================
 */

function normaliseerKolomNaam(
  waarde: unknown,
): string {
  return String(waarde ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_\-\s]+/g, "");
}

function normaliseerWaarde(
  waarde: unknown,
): string {
  if (
    waarde === null ||
    waarde === undefined
  ) {
    return "";
  }

  return String(waarde).trim();
}

function normaliseerVergelijking(
  waarde: unknown,
): string {
  return normaliseerWaarde(
    waarde,
  )
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isLeeg(
  waarde: unknown,
): boolean {
  return (
    waarde === null ||
    waarde === undefined ||
    String(waarde).trim() === ""
  );
}

/*
 * ============================================================
 * AANHEF
 * ============================================================
 *
 * Prisma accepteert:
 *
 * DHR
 * MEVR
 * ANDERS
 * GEEN_OPGAVE
 *
 * De import accepteert ook varianten zoals:
 *
 * dhr
 * Dhr
 * mevr
 * Mevr
 * anders
 * geen opgave
 *
 * Deze worden automatisch genormaliseerd.
 */

function normaliseerAanhef(
  waarde: unknown,
): string {
  const tekst =
    normaliseerVergelijking(
      waarde,
    );

  switch (tekst) {
    case "dhr":
    case "heer":
    case "m":
    case "man":
      return "DHR";

    case "mevr":
    case "mevrouw":
    case "mw":
    case "vrouw":
      return "MEVR";

    case "anders":
      return "ANDERS";

    case "geenopgave":
    case "geenopgave":
      return "GEEN_OPGAVE";

    default:
      return "";
  }
}

/*
 * ============================================================
 * GETAL
 * ============================================================
 */

function maakGetal(
  waarde: unknown,
): number | null {
  if (isLeeg(waarde)) {
    return null;
  }

  const tekst =
    normaliseerWaarde(waarde)
      .replace(/\s/g, "")
      .replace(",", ".");

  const getal = Number(tekst);

  if (!Number.isFinite(getal)) {
    return null;
  }

  return getal;
}

/*
 * ============================================================
 * DATUM
 * ============================================================
 */

function maakDatum(
  waarde: unknown,
): Date | null {
  if (isLeeg(waarde)) {
    return null;
  }

  if (waarde instanceof Date) {
    return Number.isNaN(
      waarde.getTime(),
    )
      ? null
      : waarde;
  }

  /*
   * Excel-serienummer
   */
  if (
    typeof waarde === "number"
  ) {
    const excelDatum =
      XLSX.SSF.parse_date_code(
        waarde,
      );

    if (!excelDatum) {
      return null;
    }

    const datum = new Date(
      excelDatum.y,
      excelDatum.m - 1,
      excelDatum.d,
    );

    return Number.isNaN(
      datum.getTime(),
    )
      ? null
      : datum;
  }

  const tekst =
    normaliseerWaarde(waarde);

  /*
   * Nederlandse datum:
   * dd-mm-yyyy
   * dd/mm/yyyy
   * dd.mm.yyyy
   */
  const nederlandseDatum =
    tekst.match(
      /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/,
    );

  if (nederlandseDatum) {
    const dag = Number(
      nederlandseDatum[1],
    );

    const maand = Number(
      nederlandseDatum[2],
    );

    const jaar = Number(
      nederlandseDatum[3],
    );

    const datum = new Date(
      jaar,
      maand - 1,
      dag,
    );

    if (
      datum.getFullYear() !== jaar ||
      datum.getMonth() !== maand - 1 ||
      datum.getDate() !== dag
    ) {
      return null;
    }

    return datum;
  }

  /*
   * ISO:
   * yyyy-mm-dd
   */
  const isoDatum =
    tekst.match(
      /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
    );

  if (isoDatum) {
    const jaar = Number(
      isoDatum[1],
    );

    const maand = Number(
      isoDatum[2],
    );

    const dag = Number(
      isoDatum[3],
    );

    const datum = new Date(
      jaar,
      maand - 1,
      dag,
    );

    if (
      datum.getFullYear() !== jaar ||
      datum.getMonth() !== maand - 1 ||
      datum.getDate() !== dag
    ) {
      return null;
    }

    return datum;
  }

  /*
   * Laatste fallback voor geldige
   * JavaScript-datums.
   */
  const datum = new Date(tekst);

  return Number.isNaN(
    datum.getTime(),
  )
    ? null
    : datum;
}

/*
 * ============================================================
 * DATUMSLEUTEL
 * ============================================================
 *
 * Gebruikt voor de controle:
 *
 * voornaam + achternaam + geboortedatum
 */

function datumSleutel(
  waarde: unknown,
): string {
  const datum =
    maakDatum(waarde);

  if (!datum) {
    return "";
  }

  return [
    datum.getFullYear(),
    String(
      datum.getMonth() + 1,
    ).padStart(2, "0"),
    String(
      datum.getDate(),
    ).padStart(2, "0"),
  ].join("-");
}

/*
 * ============================================================
 * DUBBELE-MEDEWERKER SLEUTEL
 * ============================================================
 */

function maakDubbeleMedewerkerSleutel(
  rij: ImportRij,
): string {
  const voornaam =
    normaliseerVergelijking(
      rij.voornaam,
    );

  const tussenvoegsel =
    normaliseerVergelijking(
      rij.tussenvoegsel,
    );

  const achternaam =
    normaliseerVergelijking(
      rij.achternaam,
    );

  const geboortedatum =
    datumSleutel(
      rij.geboortedatum,
    );

  return [
    voornaam,
    tussenvoegsel,
    achternaam,
    geboortedatum,
  ].join("|");
}

/*
 * ============================================================
 * EXCEL-RIJ VERTALEN
 * ============================================================
 */

function vertaalRij(
  bron: Record<
    string,
    unknown
  >,
): ImportRij {
  const rij: Record<
    string,
    unknown
  > = {};

  for (const [
    sleutel,
    waarde,
  ] of Object.entries(bron)) {
    rij[
      normaliseerKolomNaam(
        sleutel,
      )
    ] = waarde;
  }

  return {
    personeelsnummer:
      normaliseerWaarde(
        rij.personeelsnummer,
      ),

    aanhef:
      normaliseerWaarde(
        rij.aanhef,
      ),

    voornaam:
      normaliseerWaarde(
        rij.voornaam,
      ),

    tussenvoegsel:
      normaliseerWaarde(
        rij.tussenvoegsel,
      ),

    achternaam:
      normaliseerWaarde(
        rij.achternaam,
      ),

    roepnaam:
      normaliseerWaarde(
        rij.roepnaam,
      ),

    geboortedatum:
      normaliseerWaarde(
        rij.geboortedatum,
      ),

    email:
      normaliseerWaarde(
        rij.email,
      ),

    telefoon:
      normaliseerWaarde(
        rij.telefoon,
      ),

    /*
     * Excel gebruikt:
     * Contractype
     */
    contracttype:
      normaliseerWaarde(
        rij.contractype,
      ),

    contracturen:
      normaliseerWaarde(
        rij.contracturen,
      ),

    /*
     * Excel gebruikt:
     * Uurloom
     */
    uurloon:
      normaliseerWaarde(
        rij.uurloom ??
          rij.uurloon,
      ),

    datumindienst:
      normaliseerWaarde(
        rij.datumindienst,
      ),

    datumuitdienst:
      normaliseerWaarde(
        rij.datumuitdienst,
      ),

    vestiging:
      normaliseerWaarde(
        rij.vestiging,
      ),

    hoofdvestiging:
      normaliseerWaarde(
        rij.hoofdvestiging,
      ),
  };
}

/*
 * ============================================================
 * VERPLICHTE VELDEN
 * ============================================================
 */

function controleerVerplichteVelden(
  rij: ImportRij,
  rijNummer: number,
): ImportFout[] {
  const fouten: ImportFout[] = [];

  const velden: Array<
    [string, unknown]
  > = [
    [
      "personeelsnummer",
      rij.personeelsnummer,
    ],
    [
      "aanhef",
      rij.aanhef,
    ],
    [
      "voornaam",
      rij.voornaam,
    ],
    [
      "achternaam",
      rij.achternaam,
    ],
    [
      "geboortedatum",
      rij.geboortedatum,
    ],
    [
      "email",
      rij.email,
    ],
    [
      "telefoon",
      rij.telefoon,
    ],
    [
      "vestiging",
      rij.vestiging,
    ],
  ];

  for (const [
    veld,
    waarde,
  ] of velden) {
    if (isLeeg(waarde)) {
      fouten.push({
        rij: rijNummer,
        veld,
        melding:
          `Verplicht veld "${veld}" ontbreekt.`,
      });
    }
  }

  return fouten;
}

/*
 * ============================================================
 * RIJVALIDATIE
 * ============================================================
 */

function controleerRij(
  rij: ImportRij,
  rijNummer: number,
): ImportFout[] {
  const fouten =
    controleerVerplichteVelden(
      rij,
      rijNummer,
    );

  /*
   * Aanhef
   */
  if (!isLeeg(rij.aanhef)) {
    const aanhef =
      normaliseerAanhef(
        rij.aanhef,
      );

    if (!aanhef) {
      fouten.push({
        rij: rijNummer,
        veld: "aanhef",
        melding:
          `Ongeldige aanhef "${rij.aanhef}". Gebruik DHR, MEVR, ANDERS of GEEN_OPGAVE.`,
      });
    }
  }

  /*
   * Geboortedatum
   */
  if (
    !isLeeg(
      rij.geboortedatum,
    ) &&
    !maakDatum(
      rij.geboortedatum,
    )
  ) {
    fouten.push({
      rij: rijNummer,
      veld: "geboortedatum",
      melding:
        "Ongeldige geboortedatum.",
    });
  }

  /*
   * Datum indienst
   */
  if (
    !isLeeg(
      rij.datumindienst,
    ) &&
    !maakDatum(
      rij.datumindienst,
    )
  ) {
    fouten.push({
      rij: rijNummer,
      veld: "datumindienst",
      melding:
        "Ongeldige datum indienst.",
    });
  }

  /*
   * Datum uitdienst
   */
  if (
    !isLeeg(
      rij.datumuitdienst,
    ) &&
    !maakDatum(
      rij.datumuitdienst,
    )
  ) {
    fouten.push({
      rij: rijNummer,
      veld: "datumuitdienst",
      melding:
        "Ongeldige datum uitdienst.",
    });
  }

  /*
   * Contracturen
   */
  if (
    !isLeeg(
      rij.contracturen,
    ) &&
    maakGetal(
      rij.contracturen,
    ) === null
  ) {
    fouten.push({
      rij: rijNummer,
      veld: "contracturen",
      melding:
        "Contracturen moeten een geldig getal zijn.",
    });
  }

  /*
   * Uurloon
   */
  if (
    !isLeeg(rij.uurloon) &&
    maakGetal(
      rij.uurloon,
    ) === null
  ) {
    fouten.push({
      rij: rijNummer,
      veld: "uurloon",
      melding:
        "Uurloon moet een geldig getal zijn.",
    });
  }

  /*
   * E-mail
   */
  if (
    !isLeeg(rij.email) &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      rij.email,
    )
  ) {
    fouten.push({
      rij: rijNummer,
      veld: "email",
      melding:
        "Ongeldig e-mailadres.",
    });
  }

  return fouten;
}

/*
 * ============================================================
 * KOLOMMEN CONTROLEREN
 * ============================================================
 */

function controleerKolommen(
  headers: string[],
): ImportFout[] {
  const fouten: ImportFout[] = [];

  const aanwezigeKolommen =
    new Set(
      headers.map(
        normaliseerKolomNaam,
      ),
    );

  for (const kolom of VERPLICHTE_KOLOMMEN) {
    if (
      !aanwezigeKolommen.has(
        kolom,
      )
    ) {
      fouten.push({
        rij: 1,
        veld: kolom,
        melding:
          `Verplichte kolom "${kolom}" ontbreekt in het importbestand.`,
      });
    }
  }

  return fouten;
}

/*
 * ============================================================
 * BESTAND LEZEN
 * ============================================================
 */

async function leesBestand(
  bestand: File,
): Promise<{
  rijen: ImportRij[];
  fouten: ImportFout[];
}> {
  const buffer =
    Buffer.from(
      await bestand.arrayBuffer(),
    );

  const workbook =
    XLSX.read(buffer, {
      type: "buffer",
      cellDates: true,
    });

  const werkbladNaam =
    workbook.SheetNames[0];

  if (!werkbladNaam) {
    throw new Error(
      "Het importbestand bevat geen werkblad.",
    );
  }

  const worksheet =
    workbook.Sheets[
      werkbladNaam
    ];

  const bereik =
    XLSX.utils.decode_range(
      worksheet["!ref"] ??
        "A1:A1",
    );

  const headers: string[] = [];

  for (
    let kolom =
      bereik.s.c;
    kolom <= bereik.e.c;
    kolom++
  ) {
    const cel =
      worksheet[
        XLSX.utils.encode_cell({
          r: bereik.s.r,
          c: kolom,
        })
      ];

    headers.push(
      normaliseerWaarde(
        cel?.v,
      ),
    );
  }

  const kolomFouten =
    controleerKolommen(
      headers,
    );

  if (kolomFouten.length > 0) {
    return {
      rijen: [],
      fouten: kolomFouten,
    };
  }

  const bronRijen =
    XLSX.utils.sheet_to_json<
      Record<string, unknown>
    >(worksheet, {
      defval: "",
      raw: true,
    });

  return {
    rijen: bronRijen.map(
      vertaalRij,
    ),
    fouten: [],
  };
}

/*
 * ============================================================
 * ORGANISATIE CONTEXT
 * ============================================================
 */

async function bepaalOrganisatieContext(
  gebruiker: Awaited<
    ReturnType<typeof getCurrentUser>
  >,
): Promise<OrganisatieContext | null> {
  if (!gebruiker) {
    return null;
  }

  const actieveRelaties =
    gebruiker.organisaties.filter(
      (relatie) =>
        relatie.actief &&
        relatie.organisatie.actief,
    );

  if (
    actieveRelaties.length === 0
  ) {
    return null;
  }

  const eigenaarRelatie =
    actieveRelaties.find(
      (relatie) =>
        relatie.rol.naam
          .trim()
          .toLowerCase() ===
        "eigenaar",
    );

  if (eigenaarRelatie) {
    return {
      organisatieId:
        eigenaarRelatie.organisatieId,
      eigenaar: true,
    };
  }

  return {
    organisatieId:
      actieveRelaties[0]
        .organisatieId,
    eigenaar: false,
  };
}

/*
 * ============================================================
 * POST
 * ============================================================
 */

export async function POST(
  request: Request,
) {
  try {
    /*
     * ----------------------------------------------------------
     * AUTHENTICATIE
     * ----------------------------------------------------------
     */

    const gebruiker =
      await getCurrentUser();

    if (!gebruiker) {
      return NextResponse.json(
        {
          ok: false,
          melding:
            "Je bent niet ingelogd.",
        },
        {
          status: 401,
        },
      );
    }

    const magImporteren =
      await hasPermission(
        permissions.medewerkers.update,
      );

    if (!magImporteren) {
      return NextResponse.json(
        {
          ok: false,
          melding:
            "Je hebt geen toestemming om medewerkers te importeren.",
        },
        {
          status: 403,
        },
      );
    }

    const context =
      await bepaalOrganisatieContext(
        gebruiker,
      );

    if (!context) {
      return NextResponse.json(
        {
          ok: false,
          melding:
            "Er is geen actieve organisatie beschikbaar.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * ----------------------------------------------------------
     * BESTAND
     * ----------------------------------------------------------
     */

    const formData =
      await request.formData();

    const bestand =
      formData.get("bestand");

    if (!(bestand instanceof File)) {
      return NextResponse.json(
        {
          ok: false,
          melding:
            "Geen importbestand ontvangen.",
        },
        {
          status: 400,
        },
      );
    }

    if (bestand.size === 0) {
      return NextResponse.json(
        {
          ok: false,
          melding:
            "Het importbestand is leeg.",
        },
        {
          status: 400,
        },
      );
    }

    const bestandResultaat =
      await leesBestand(
        bestand,
      );

    if (
      bestandResultaat.fouten
        .length > 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          aangemaakt: 0,
          fouten:
            bestandResultaat.fouten,
        },
        {
          status: 422,
        },
      );
    }

    const rijen =
      bestandResultaat.rijen;

    if (rijen.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          aangemaakt: 0,
          fouten: [
            {
              rij: 1,
              melding:
                "Het importbestand bevat geen medewerkers.",
            },
          ],
        },
        {
          status: 422,
        },
      );
    }

    /*
     * ----------------------------------------------------------
     * BASISVALIDATIE
     * ----------------------------------------------------------
     */

    const fouten: ImportFout[] =
      [];

    const personeelsnummers =
      new Map<
        string,
        number
      >();

    const eMails =
      new Map<string, number>();

    const dubbeleMedewerkers =
      new Map<
        string,
        number
      >();

    for (
      let index = 0;
      index < rijen.length;
      index++
    ) {
      const rij =
        rijen[index];

      const rijNummer =
        index + 2;

      fouten.push(
        ...controleerRij(
          rij,
          rijNummer,
        ),
      );

      /*
       * --------------------------------------------
       * Dubbel personeelsnummer
       * --------------------------------------------
       */

      const personeelsnummer =
        normaliseerVergelijking(
          rij.personeelsnummer,
        );

      if (personeelsnummer) {
        const bestaandeRij =
          personeelsnummers.get(
            personeelsnummer,
          );

        if (
          bestaandeRij !==
          undefined
        ) {
          fouten.push({
            rij: rijNummer,
            veld:
              "personeelsnummer",
            melding:
              `Dit personeelsnummer komt ook voor op rij ${bestaandeRij}.`,
          });
        } else {
          personeelsnummers.set(
            personeelsnummer,
            rijNummer,
          );
        }
      }

      /*
       * --------------------------------------------
       * Dubbel e-mailadres
       * --------------------------------------------
       */

      const email =
        normaliseerVergelijking(
          rij.email,
        );

      if (email) {
        const bestaandeRij =
          eMails.get(email);

        if (
          bestaandeRij !==
          undefined
        ) {
          fouten.push({
            rij: rijNummer,
            veld: "email",
            melding:
              `Dit e-mailadres komt ook voor op rij ${bestaandeRij}.`,
          });
        } else {
          eMails.set(
            email,
            rijNummer,
          );
        }
      }

      /*
       * --------------------------------------------
       * Mogelijke dubbele medewerker
       *
       * Voornaam +
       * tussenvoegsel +
       * achternaam +
       * geboortedatum
       * --------------------------------------------
       */

      const dubbeleSleutel =
        maakDubbeleMedewerkerSleutel(
          rij,
        );

      if (
        dubbeleSleutel !==
        "|||"
      ) {
        const bestaandeRij =
          dubbeleMedewerkers.get(
            dubbeleSleutel,
          );

        if (
          bestaandeRij !==
          undefined
        ) {
          fouten.push({
            rij: rijNummer,
            veld:
              "geboortedatum",
            melding:
              `Mogelijke dubbele medewerker: voornaam, achternaam en geboortedatum komen ook voor op rij ${bestaandeRij}.`,
          });
        } else {
          dubbeleMedewerkers.set(
            dubbeleSleutel,
            rijNummer,
          );
        }
      }
    }

    if (fouten.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          aangemaakt: 0,
          fouten,
        },
        {
          status: 422,
        },
      );
    }

    /*
     * ----------------------------------------------------------
     * ORGANISATIEDATA
     * ----------------------------------------------------------
     */

    const [
      vestigingen,
      medewerkerStatus,
      bestaandeMedewerkers,
    ] = await Promise.all([
      prisma.vestiging.findMany({
        where: {
          organisatieId:
            context.organisatieId,
          actief: true,
        },

        select: {
          id: true,
          naam: true,
        },

        orderBy: {
          naam: "asc",
        },
      }),

      prisma.status.findFirst({
        where: {
          module: "MEDEWERKER",
          code: "ACTIEF",
          actief: true,
        },

        select: {
          id: true,
        },
      }),

      prisma.medewerker.findMany({
        where: {
          vestigingen: {
            some: {
              vestiging: {
                organisatieId:
                  context.organisatieId,
              },
            },
          },
        },

        select: {
          id: true,
          personeelsnummer: true,
          email: true,
          voornaam: true,
          tussenvoegsel: true,
          achternaam: true,
          geboortedatum: true,
        },
      }),
    ]);

    if (!medewerkerStatus) {
      return NextResponse.json(
        {
          ok: false,
          aangemaakt: 0,
          fouten: [
            {
              rij: 0,
              melding:
                'Geen actieve medewerkerstatus met code "ACTIEF" gevonden.',
            },
          ],
        },
        {
          status: 500,
        },
      );
    }

    /*
     * ----------------------------------------------------------
     * VESTIGINGSMAP
     * ----------------------------------------------------------
     */

    const vestigingMap =
      new Map<
        string,
        (typeof vestigingen)[number]
      >();

    for (const vestiging of vestigingen) {
      vestigingMap.set(
        normaliseerVergelijking(
          vestiging.naam,
        ),
        vestiging,
      );
    }

    /*
     * ----------------------------------------------------------
     * BESTAANDE MEDEWERKERS
     * ----------------------------------------------------------
     */

    const bestaandePersoneelsnummers =
      new Set(
        bestaandeMedewerkers
          .filter(
            (medewerker) =>
              !isLeeg(
                medewerker.personeelsnummer,
              ),
          )
          .map(
            (medewerker) =>
              normaliseerVergelijking(
                medewerker.personeelsnummer,
              ),
          ),
      );

    const bestaandeEMails =
      new Set(
        bestaandeMedewerkers.map(
          (medewerker) =>
            normaliseerVergelijking(
              medewerker.email,
            ),
        ),
      );

    /*
     * Sleutels van medewerkers die al
     * in Clevers ERP bestaan.
     */

    const bestaandeDubbeleMedewerkers =
      new Map<
        string,
        {
          id: string;
          naam: string;
        }
      >();

    for (const medewerker of bestaandeMedewerkers) {
      const sleutel =
        maakDubbeleMedewerkerSleutel({
          personeelsnummer:
            medewerker.personeelsnummer ??
            "",
          aanhef: "",
          voornaam:
            medewerker.voornaam,
          tussenvoegsel:
            medewerker.tussenvoegsel ??
            "",
          achternaam:
            medewerker.achternaam,
          roepnaam: "",
          geboortedatum:
            medewerker.geboortedatum
              .toISOString()
              .slice(0, 10),
          email:
            medewerker.email,
          telefoon: "",
          contracttype: "",
          contracturen: "",
          uurloon: "",
          datumindienst: "",
          datumuitdienst: "",
          vestiging: "",
          hoofdvestiging: "",
        });

      if (
        sleutel !==
        "|||"
      ) {
        bestaandeDubbeleMedewerkers.set(
          sleutel,
          {
            id: medewerker.id,
            naam:
              `${medewerker.voornaam} ${
                medewerker.tussenvoegsel
                  ? `${medewerker.tussenvoegsel} `
                  : ""
              }${medewerker.achternaam}`,
          },
        );
      }
    }

    /*
     * ----------------------------------------------------------
     * REFERENTIE- EN DUBBELCONTROLE
     * ----------------------------------------------------------
     */

    for (
      let index = 0;
      index < rijen.length;
      index++
    ) {
      const rij =
        rijen[index];

      const rijNummer =
        index + 2;

      /*
       * Personeelsnummer
       */

      const personeelsnummer =
        normaliseerVergelijking(
          rij.personeelsnummer,
        );

      if (
        bestaandePersoneelsnummers.has(
          personeelsnummer,
        )
      ) {
        fouten.push({
          rij: rijNummer,
          veld:
            "personeelsnummer",
          melding:
            `Personeelsnummer "${rij.personeelsnummer}" bestaat al.`,
        });
      }

      /*
       * E-mail
       */

      const email =
        normaliseerVergelijking(
          rij.email,
        );

      if (
        bestaandeEMails.has(
          email,
        )
      ) {
        fouten.push({
          rij: rijNummer,
          veld: "email",
          melding:
            `E-mailadres "${rij.email}" bestaat al.`,
        });
      }

      /*
       * Mogelijke dubbele medewerker
       * tegenover bestaande medewerkers.
       */

      const dubbeleSleutel =
        maakDubbeleMedewerkerSleutel(
          rij,
        );

      if (
        dubbeleSleutel !==
          "|||" &&
        bestaandeDubbeleMedewerkers.has(
          dubbeleSleutel,
        )
      ) {
        const bestaande =
          bestaandeDubbeleMedewerkers.get(
            dubbeleSleutel,
          );

        if (bestaande) {
          fouten.push({
            rij: rijNummer,
            veld:
              "geboortedatum",
            melding:
              `Mogelijke dubbele medewerker: "${bestaande.naam}" bestaat al met dezelfde voornaam, achternaam en geboortedatum.`,
          });
        }
      }

      /*
       * Vestiging
       */

      const vestiging =
        vestigingMap.get(
          normaliseerVergelijking(
            rij.vestiging,
          ),
        );

      if (!vestiging) {
        fouten.push({
          rij: rijNummer,
          veld: "vestiging",
          melding:
            `Vestiging "${rij.vestiging}" bestaat niet binnen de organisatie.`,
        });
      }

      /*
       * Hoofdvestiging
       */

      if (
        !isLeeg(
          rij.hoofdvestiging,
        )
      ) {
        const hoofdvestiging =
          vestigingMap.get(
            normaliseerVergelijking(
              rij.hoofdvestiging,
            ),
          );

        if (!hoofdvestiging) {
          fouten.push({
            rij: rijNummer,
            veld:
              "hoofdvestiging",
            melding:
              `Hoofdvestiging "${rij.hoofdvestiging}" bestaat niet binnen de organisatie.`,
          });
        }
      }
    }

    /*
     * Geen enkele medewerker aanmaken
     * wanneer er ergens een fout zit.
     */

    if (fouten.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          aangemaakt: 0,
          fouten,
        },
        {
          status: 422,
        },
      );
    }

    /*
     * ============================================================
     * IMPORT UITVOEREN
     * ============================================================
     */

    let aangemaakt = 0;

    await prisma.$transaction(
      async (tx) => {
        for (const rij of rijen) {
          /*
           * --------------------------------------------
           * Vestiging
           * --------------------------------------------
           */

          const vestiging =
            vestigingMap.get(
              normaliseerVergelijking(
                rij.vestiging,
              ),
            );

          if (!vestiging) {
            throw new Error(
              `Vestiging "${rij.vestiging}" kon tijdens de import niet worden gevonden.`,
            );
          }

          /*
           * --------------------------------------------
           * Hoofdvestiging
           * --------------------------------------------
           *
           * Als Hoofdvestiging leeg is,
           * wordt Vestiging gebruikt.
           */

          const hoofdvestiging =
            !isLeeg(
              rij.hoofdvestiging,
            )
              ? vestigingMap.get(
                  normaliseerVergelijking(
                    rij.hoofdvestiging,
                  ),
                )
              : vestiging;

          if (!hoofdvestiging) {
            throw new Error(
              `Hoofdvestiging "${rij.hoofdvestiging}" kon tijdens de import niet worden gevonden.`,
            );
          }

          /*
           * --------------------------------------------
           * Aanhef
           * --------------------------------------------
           */

          const aanhef =
            normaliseerAanhef(
              rij.aanhef,
            );

          if (!aanhef) {
            throw new Error(
              `Ongeldige aanhef "${rij.aanhef}".`,
            );
          }

          /*
           * --------------------------------------------
           * MEDEWERKER
           * --------------------------------------------
           */

          const medewerker =
            await tx.medewerker.create({
              data: {
                personeelsnummer:
                  rij.personeelsnummer,

                aanhef:
                  aanhef as never,

                voornaam:
                  rij.voornaam,

                tussenvoegsel:
                  rij.tussenvoegsel ||
                  null,

                achternaam:
                  rij.achternaam,

                roepnaam:
                  rij.roepnaam ||
                  null,

                geboortedatum:
                  maakDatum(
                    rij.geboortedatum,
                  )!,

                email:
                  rij.email,

                telefoon:
                  rij.telefoon,

                statusId:
                  medewerkerStatus.id,

                aanmeldingOp:
                  new Date(),

                contractType:
                  !isLeeg(
                    rij.contracttype,
                  )
                    ? (rij.contracttype as never)
                    : null,

                contractUren:
                  maakGetal(
                    rij.contracturen,
                  ),

                uurloon:
                  maakGetal(
                    rij.uurloon,
                  ),

                datumInDienst:
                  maakDatum(
                    rij.datumindienst,
                  ),

                datumUitDienst:
                  maakDatum(
                    rij.datumuitdienst,
                  ),

                actief: true,
              },
            });

          /*
           * --------------------------------------------
           * PRIMAIRE VESTIGING
           * --------------------------------------------
           */

          await tx.medewerkerVestiging.create(
            {
              data: {
                medewerkerId:
                  medewerker.id,

                vestigingId:
                  vestiging.id,

                hoofdvestiging:
                  hoofdvestiging.id ===
                  vestiging.id,
              },
            },
          );

          /*
           * --------------------------------------------
           * EXTRA HOOFDVESTIGING
           * --------------------------------------------
           *
           * Wanneer Hoofdvestiging anders is dan
           * Vestiging, krijgt de medewerker beide
           * koppelingen.
           */

          if (
            hoofdvestiging.id !==
            vestiging.id
          ) {
            await tx.medewerkerVestiging.create(
              {
                data: {
                  medewerkerId:
                    medewerker.id,

                  vestigingId:
                    hoofdvestiging.id,

                  hoofdvestiging:
                    true,
                },
              },
            );
          }

          aangemaakt++;
        }
      },
    );

    /*
     * ============================================================
     * RESULTAAT
     * ============================================================
     */

    return NextResponse.json({
      ok: true,
      aangemaakt,
      fouten: [],
      melding:
        `${aangemaakt} medewerker${
          aangemaakt === 1
            ? ""
            : "s"
        } succesvol geïmporteerd.`,
    });
  } catch (error) {
    console.error(
      "Medewerker importeren:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        aangemaakt: 0,
        fouten: [
          {
            rij: 0,
            melding:
              "Er is een onverwachte fout opgetreden tijdens het importeren.",
          },
        ],
      },
      {
        status: 500,
      },
    );
  }
}