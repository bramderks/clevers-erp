import { NextRequest, NextResponse } from "next/server";

import { genereerVerloning } from "@/lib/verloning/genereerVerloning";

export async function GET(
  request: NextRequest,
) {
  /*
   * ==========================================================
   * CRON BEVEILIGING
   * ==========================================================
   */

  const cronSecret =
    process.env.CRON_SECRET;

  const authorization =
    request.headers.get(
      "authorization",
    );

  if (
    !cronSecret ||
    authorization !==
      `Bearer ${cronSecret}`
  ) {
    return NextResponse.json(
      {
        succes: false,
        fout: "Niet geautoriseerd.",
      },
      {
        status: 401,
      },
    );
  }

  /*
   * ==========================================================
   * VORIGE MAAND
   * ==========================================================
   *
   * De cron draait op de eerste dag van de maand.
   * Daarom wordt altijd de volledige vorige maand verwerkt.
   */

  const vandaag = new Date();

  const vorigeMaand = new Date(
    vandaag.getFullYear(),
    vandaag.getMonth() - 1,
    1,
  );

  const jaar =
    vorigeMaand.getFullYear();

  const maand =
    vorigeMaand.getMonth() + 1;

  /*
   * ==========================================================
   * VERLONING GENEREREN
   * ==========================================================
   *
   * De generator controleert zelf:
   *
   * - of er urenregistraties zijn;
   * - of alle uren DEFINITIEF zijn;
   * - of de periode al VERWERKT is;
   * - en maakt daarna automatisch het overzicht aan.
   */

  try {
    const resultaat =
      await genereerVerloning(
        jaar,
        maand,
      );

    return NextResponse.json({
      succes: true,
      status: "KLAAR",
      bericht:
        "Verloning succesvol gegenereerd.",
      resultaat,
    });
  } catch (error) {
    const fout =
      error instanceof Error
        ? error.message
        : "Onbekende fout bij het genereren van de verloning.";

    /*
     * Een maand die nog niet volledig definitief is,
     * is geen technische fout.
     *
     * De cron mag daarom gewoon aangeven dat de
     * verloning nog niet klaar is.
     */

    const maandNogNietKlaar =
      fout.includes(
        "kan nog niet worden gegenereerd",
      );

    if (maandNogNietKlaar) {
      console.log(
        `Verloning ${maand}-${jaar} nog niet klaar: ${fout}`,
      );

      return NextResponse.json({
        succes: true,
        status: "WACHT_OP_UREN",
        bericht: fout,
      });
    }

    console.error(
      "Fout bij genereren verloning:",
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