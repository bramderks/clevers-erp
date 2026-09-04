export type PauzeBerekening = {
  pauzeMinuten: number;
  brutoMinuten: number;
  nettoMinuten: number;
  gewerkteUren: number;
};

function minutenSindsMiddernacht(
  datum: Date,
) {
  return (
    datum.getHours() * 60 +
    datum.getMinutes()
  );
}

function afrondenOpKwartier(
  minuten: number,
) {
  return Math.round(
    minuten / 15,
  ) * 15;
}

/*
 * ============================================================
 * PAUZEREGELS CLEVER'S ERP
 * ============================================================
 *
 * De volgende regels zijn afgesproken:
 *
 * 1. Start vóór 12:00:
 *
 *    - Dienst eindigt t/m 14:00:
 *      15 minuten pauze.
 *
 *    - Dienst eindigt ná 14:00:
 *      30 minuten pauze.
 *
 * 2. Start vanaf 12:00 en vóór 17:00:
 *
 *    - Dienst eindigt t/m 18:00:
 *      geen pauze.
 *
 *    - Dienst eindigt ná 18:00:
 *      30 minuten pauze.
 *
 * 3. Start vanaf 17:00:
 *
 *    - Altijd 30 minuten pauze.
 *
 * De regel "vanaf 17:00" heeft voorrang op
 * de overige regels.
 * ============================================================
 */

export function bepaalPauzeMinuten(
  begintijd: Date,
  eindtijd: Date,
) {
  const start =
    minutenSindsMiddernacht(
      begintijd,
    );

  const einde =
    minutenSindsMiddernacht(
      eindtijd,
    );

  const twaalfUur = 12 * 60;
  const veertienUur = 14 * 60;
  const zeventienUur = 17 * 60;
  const achttienUur = 18 * 60;

  /*
   * Start vanaf 17:00:
   * altijd 30 minuten pauze.
   */

  if (start >= zeventienUur) {
    return 30;
  }

  /*
   * Start vanaf 12:00 en vóór 17:00.
   *
   * Tot en met 18:00 is er geen verplichte
   * onbetaalde pauze.
   *
   * Na 18:00 geldt 30 minuten pauze.
   */

  if (start >= twaalfUur) {
    if (einde > achttienUur) {
      return 30;
    }

    return 0;
  }

  /*
   * Start vóór 12:00.
   *
   * Tot en met 14:00:
   * 15 minuten pauze.
   *
   * Na 14:00:
   * 30 minuten pauze.
   */

  if (einde > veertienUur) {
    return 30;
  }

  return 15;
}

/*
 * ============================================================
 * GEWERKTE UREN BEREKENEN
 * ============================================================
 *
 * Deze functie is de centrale bron voor de berekening van:
 *
 * - bruto werktijd;
 * - verplichte onbetaalde pauze;
 * - netto werktijd;
 * - gewerkte uren.
 *
 * De uren worden technisch verwerkt in stappen
 * van 15 minuten.
 * ============================================================
 */

export function berekenGewerkteUren(
  begintijd: Date,
  eindtijd: Date,
): PauzeBerekening {
  const brutoMinuten =
    Math.round(
      (
        eindtijd.getTime() -
        begintijd.getTime()
      ) /
        (1000 * 60),
    );

  /*
   * Een eindtijd mag nooit vóór of gelijk aan
   * de begintijd liggen.
   */

  if (brutoMinuten <= 0) {
    throw new Error(
      "De eindtijd moet na de begintijd liggen.",
    );
  }

  const pauzeMinuten =
    bepaalPauzeMinuten(
      begintijd,
      eindtijd,
    );

  const nettoMinuten =
    brutoMinuten -
    pauzeMinuten;

  /*
   * Extra beveiliging tegen een ongeldige
   * situatie waarbij de pauze langer zou zijn
   * dan de volledige dienst.
   */

  if (nettoMinuten <= 0) {
    throw new Error(
      "De berekende werktijd na aftrek van pauze moet groter zijn dan nul.",
    );
  }

  /*
   * De registratie werkt in stappen van
   * 15 minuten.
   */

  const afgerondeNettoMinuten =
    afrondenOpKwartier(
      nettoMinuten,
    );

  return {
    pauzeMinuten,

    brutoMinuten,

    nettoMinuten:
      afgerondeNettoMinuten,

    gewerkteUren:
      Number(
        (
          afgerondeNettoMinuten /
          60
        ).toFixed(2),
      ),
  };
}