import {
  NextRequest,
  NextResponse,
} from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { genereerVerloning } from "@/lib/verloning/genereerVerloning";

type GenereerVerloningRequest = {
  jaar?: unknown;
  maand?: unknown;
};

export async function POST(
  request: NextRequest,
) {
  try {
    /*
     * ==========================================================
     * GEBRUIKER CONTROLEREN
     * ==========================================================
     */

    const gebruiker =
      await getCurrentUser();

    if (!gebruiker) {
      return NextResponse.json(
        {
          succes: false,
          fout: "Je bent niet ingelogd.",
        },
        {
          status: 401,
        },
      );
    }

    /*
     * ==========================================================
     * ACTIEVE ORGANISATIES
     * ==========================================================
     */

    const organisaties =
      gebruiker.organisaties.filter(
        (relatie) =>
          relatie.actief &&
          relatie.organisatie.actief,
      );

    if (organisaties.length === 0) {
      return NextResponse.json(
        {
          succes: false,
          fout:
            "Je hebt geen toegang tot een actieve organisatie.",
        },
        {
          status: 403,
        },
      );
    }

    /*
     * ==========================================================
     * EIGENAAR CONTROLEREN
     * ==========================================================
     *
     * Handmatig genereren van een verloningsperiode
     * is uitsluitend toegestaan voor de Eigenaar.
     * ==========================================================
     */

    const isEigenaar =
      organisaties.some(
        (relatie) =>
          relatie.rol.naam.toLowerCase() ===
          "eigenaar",
      );

    if (!isEigenaar) {
      return NextResponse.json(
        {
          succes: false,
          fout:
            "Alleen de eigenaar kan een verloningsperiode genereren.",
        },
        {
          status: 403,
        },
      );
    }

    /*
     * ==========================================================
     * REQUEST BODY LEZEN
     * ==========================================================
     */

    let body: GenereerVerloningRequest;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          succes: false,
          fout: "Ongeldige aanvraag.",
        },
        {
          status: 400,
        },
      );
    }

    const jaar =
      typeof body.jaar === "number"
        ? body.jaar
        : Number(body.jaar);

    const maand =
      typeof body.maand === "number"
        ? body.maand
        : Number(body.maand);

    /*
     * ==========================================================
     * JAAR CONTROLEREN
     * ==========================================================
     */

    if (
      !Number.isInteger(jaar) ||
      jaar < 2020 ||
      jaar > 2100
    ) {
      return NextResponse.json(
        {
          succes: false,
          fout: "Geef een geldig jaar op.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * ==========================================================
     * MAAND CONTROLEREN
     * ==========================================================
     */

    if (
      !Number.isInteger(maand) ||
      maand < 1 ||
      maand > 12
    ) {
      return NextResponse.json(
        {
          succes: false,
          fout: "Geef een geldige maand op.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * ==========================================================
     * VERLONING GENEREREN
     * ==========================================================
     *
     * De daadwerkelijke bedrijfslogica staat centraal in:
     *
     * lib/verloning/genereerVerloning.ts
     *
     * De route bevat dus geen duplicatie van de
     * verloningslogica.
     * ==========================================================
     */

    const resultaat =
      await genereerVerloning(
        jaar,
        maand,
      );

    /*
     * ==========================================================
     * SUCCES
     * ==========================================================
     */

    return NextResponse.json(
      {
        succes: true,
        status: "KLAAR",
        bericht:
          "De verloningsperiode is succesvol gegenereerd.",
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
        : "Onbekende fout bij het genereren van de verloning.";

    /*
     * ==========================================================
     * FUNCTIONELE FOUTEN
     * ==========================================================
     *
     * De generator gebruikt fouten om situaties te blokkeren
     * zoals:
     *
     * - geen uren beschikbaar;
     * - uren nog niet definitief;
     * - periode al verwerkt.
     *
     * Dit zijn functionele blokkades en geen technische
     * serverfouten.
     * ==========================================================
     */

    return NextResponse.json(
      {
        succes: false,
        status: "NIET_MOGELIJK",
        fout,
      },
      {
        status: 400,
      },
    );
  }
}