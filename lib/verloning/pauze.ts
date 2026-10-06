export type PauzeBerekening = {
  pauzeMinuten: number;
  brutoMinuten: number;
  nettoMinuten: number;
  gewerkteUren: number;
};

function minutenSindsMiddernacht(datum: Date) {
  const delen = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Amsterdam",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(datum);
  const uur = Number(delen.find((deel) => deel.type === "hour")?.value ?? 0);
  const minuut = Number(delen.find((deel) => deel.type === "minute")?.value ?? 0);
  return uur * 60 + minuut;
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
 *    - Dienst eindigt uiterlijk 14:00 en duurt korter dan 4 uur:
 *      geen pauze.
 *
 *    - Dienst eindigt uiterlijk 14:00 en duurt 4 uur of langer:
 *      15 minuten pauze.
 *
 *    - Dienst eindigt ná 14:00 en duurt maximaal 6 uur:
 *      geen pauze.
 *
 *    - Dienst eindigt ná 14:00 en duurt langer dan 6 uur:
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
 *    - Geen pauze.
 *
 * Avond-/sluitdiensten vanaf 17:00 worden dus volledig als
 * gewerkte tijd gerekend.
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
   * geen pauze.
   */

  if (start >= zeventienUur) {
    return 0;
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
   * Een dienst die uiterlijk om 14:00 eindigt
   * en korter dan 4 uur duurt heeft geen pauze.
   *
   * Een dienst die uiterlijk om 14:00 eindigt
   * en 4 uur of langer duurt heeft 15 minuten pauze.
   *
   * Een dienst van maximaal 6 uur die na 14:00
   * eindigt heeft geen pauze.
   *
   * Duurt de dienst langer dan 6 uur en eindigt
   * deze na 14:00, dan geldt 30 minuten pauze.
   */

  const duurMinuten =
    Math.round(
      (
        eindtijd.getTime() -
        begintijd.getTime()
      ) /
        (1000 * 60),
    );

  if (einde > veertienUur) {
    return duurMinuten > 6 * 60 ? 30 : 0;
  }

  return duurMinuten < 4 * 60 ? 0 : 15;
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