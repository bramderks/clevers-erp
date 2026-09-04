import { NextRequest, NextResponse } from "next/server";

import { verwerkVerloning } from "@/lib/verloning/verwerkVerloning";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

/*
 * ============================================================
 * VERLONINGSPERIODE VERWERKEN
 * ============================================================
 *
 * Deze API-route bevat uitsluitend de HTTP-afhandeling.
 *
 * De centrale bedrijfslogica voor:
 *
 * - authenticatie;
 * - autorisatie;
 * - organisatietoegang;
 * - statuscontrole;
 * - validatie;
 * - definitieve verwerking;
 *
 * staat in:
 *
 * lib/verloning/verwerkVerloning.ts
 * ============================================================
 */

export async function POST(
  _request: NextRequest,
  { params }: RouteContext,
) {
  try {
    /*
     * ========================================================
     * PERIODE-ID
     * ========================================================
     */

    const { id } =
      await params;

    if (!id) {
      return NextResponse.json(
        {
          succes: false,
          status: "ONGELDIGE_AANVRAAG",
          fout:
            "Geen verloningsperiode opgegeven.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * ========================================================
     * CENTRALE VERWERKINGSLOGICA
     * ========================================================
     */

    const resultaat =
      await verwerkVerloning(
        id,
      );

    /*
     * ========================================================
     * SUCCES
     * ========================================================
     */

    return NextResponse.json(
      {
        succes: true,
        status: "VERWERKT",
        bericht:
          "De verloningsperiode is succesvol verwerkt.",
        resultaat,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    const fout =
      error instanceof Error
        ? error.message
        : "Onbekende fout bij het verwerken van de verloningsperiode.";

    /*
     * ========================================================
     * FOUTSTATUS BEPALEN
     * ========================================================
     *
     * De centrale functie gebruikt duidelijke foutmeldingen.
     * Hier vertalen we die naar passende HTTP-statuscodes.
     * ========================================================
     */

    if (
      fout ===
      "Je bent niet ingelogd."
    ) {
      return NextResponse.json(
        {
          succes: false,
          status: "NIET_INGELOGD",
          fout,
        },
        {
          status: 401,
        },
      );
    }

    if (
      fout ===
        "Je hebt geen toegang tot een actieve organisatie." ||
      fout ===
        "Alleen de eigenaar kan een verloningsperiode verwerken." ||
      fout ===
        "Je hebt geen toegang tot deze volledige verloningsperiode."
    ) {
      return NextResponse.json(
        {
          succes: false,
          status: "GEEN_TOEGANG",
          fout,
        },
        {
          status: 403,
        },
      );
    }

    if (
      fout ===
      "De verloningsperiode bestaat niet."
    ) {
      return NextResponse.json(
        {
          succes: false,
          status: "NIET_GEVONDEN",
          fout,
        },
        {
          status: 404,
        },
      );
    }

    if (
      fout ===
      "Deze verloningsperiode is al verwerkt en kan niet opnieuw worden verwerkt."
    ) {
      return NextResponse.json(
        {
          succes: false,
          status: "AL_VERWERKT",
          fout,
        },
        {
          status: 409,
        },
      );
    }

    /*
     * ========================================================
     * VALIDATIEFOUT
     * ========================================================
     */

    if (
      fout ===
        "Alleen een verloningsperiode met status Klaar kan worden verwerkt." ||
      fout ===
        "Deze verloningsperiode bevat geen regels en kan niet worden verwerkt."
    ) {
      return NextResponse.json(
        {
          succes: false,
          status: "ONGELDIGE_STATUS",
          fout,
        },
        {
          status: 400,
        },
      );
    }

    /*
     * ========================================================
     * ONBEKENDE TECHNISCHE FOUT
     * ========================================================
     */

    console.error(
      "Fout bij verwerken verloningsperiode:",
      error,
    );

    return NextResponse.json(
      {
        succes: false,
        status: "FOUT",
        fout,
      },
      {
        status: 500,
      },
    );
  }
}