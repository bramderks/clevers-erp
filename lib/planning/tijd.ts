export const START_MINUTEN = 8 * 60 + 30;
export const EINDE_MINUTEN = 23 * 60;
export const TIJD_INTERVAL = 15;

// Centrale planningformattering: datum = kalenderdatum, tijden = Nederlandse tijdzone.

export function minutenNaarTijd(minuten: number): string {
  if (!Number.isFinite(minuten) || minuten < 0 || minuten > 24 * 60) {
    throw new Error("Ongeldig aantal minuten.");
  }

  const uren = Math.floor(minuten / 60);
  const minutenDeel = minuten % 60;

  return String(uren).padStart(2, "0") + ":" + String(minutenDeel).padStart(2, "0");
}

export function tijdNaarMinuten(tijd: string | null | undefined): number | null {
  if (!tijd) return null;

  const match = /^(\d{1,2}):(\d{2})/.exec(tijd);
  if (match) {
    const uren = Number(match[1]);
    const minuten = Number(match[2]);

    if (!Number.isInteger(uren) || !Number.isInteger(minuten) || uren < 0 || uren > 23 || minuten < 0 || minuten > 59) {
      return null;
    }

    return uren * 60 + minuten;
  }

  const datum = new Date(tijd);
  if (Number.isNaN(datum.getTime())) return null;
  return datum.getHours() * 60 + datum.getMinutes();
}

export function maakTijden(vanaf: number, tot: number, interval = TIJD_INTERVAL): string[] {
  if (!Number.isFinite(vanaf) || !Number.isFinite(tot) || interval <= 0) return [];

  const tijden: string[] = [];
  for (let minuten = vanaf; minuten <= tot; minuten += interval) {
    tijden.push(minutenNaarTijd(minuten));
  }
  return tijden;
}

export function tijdenOverlappen(startA: number, eindeA: number, startB: number, eindeB: number): boolean {
  return startA < eindeB && eindeA > startB;
}


export function formatDienstDatum(datum: Date | string): string {
  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(datum instanceof Date ? datum : new Date(datum));
}

export function formatDienstDatumKort(datum: Date | string): string {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(datum instanceof Date ? datum : new Date(datum));
}

export function formatDienstTijd(datum: Date | string | null | undefined): string {
  if (!datum) return "—";
  return new Intl.DateTimeFormat("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Amsterdam",
  }).format(datum instanceof Date ? datum : new Date(datum));
}

// Vercel build trigger: planning formatter is canonical.


export type LokaleDatumOnderdelen = {
  jaar: number;
  maand: number;
  dag: number;
  uur: number;
  minuut: number;
  seconde: number;
};

export function nederlandseDatumOnderdelen(datum: Date): LokaleDatumOnderdelen {
  const delen = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(datum);

  const waarde = (type: string) =>
    Number(delen.find((deel) => deel.type === type)?.value ?? "0");

  return {
    jaar: waarde("year"),
    maand: waarde("month"),
    dag: waarde("day"),
    uur: waarde("hour"),
    minuut: waarde("minute"),
    seconde: waarde("second"),
  };
}

/**
 * Een planningdatum is een kalenderdatum, geen lokaal server-tijdstip.
 * Daarom bewaren/interpreteren we deze altijd als UTC-middernacht.
 */
export function kalenderDatumUTC(waarde: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(waarde);
  if (!match) throw new Error("Ongeldige kalenderdatum.");

  const jaar = Number(match[1]);
  const maand = Number(match[2]);
  const dag = Number(match[3]);
  const datum = new Date(Date.UTC(jaar, maand - 1, dag));

  if (
    datum.getUTCFullYear() !== jaar ||
    datum.getUTCMonth() !== maand - 1 ||
    datum.getUTCDate() !== dag
  ) {
    throw new Error("Ongeldige kalenderdatum.");
  }

  return datum;
}

export function lokaleKalenderDatumUTC(datum: Date): Date {
  const lokaal = nederlandseDatumOnderdelen(datum);
  return new Date(Date.UTC(lokaal.jaar, lokaal.maand - 1, lokaal.dag));
}

export function lokaleDatumSleutel(datum: Date): string {
  const lokaal = nederlandseDatumOnderdelen(datum);
  return [
    lokaal.jaar,
    String(lokaal.maand).padStart(2, "0"),
    String(lokaal.dag).padStart(2, "0"),
  ].join("-");
}

/**
 * Combineert een Nederlandse kalenderdatum en kloktijd tot één instant.
 * Werkt onafhankelijk van de timezone waarop Vercel/Node draait.
 */
export function nederlandseDatumTijd(datum: string, tijd: string): Date {
  const datumMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datum);
  const tijdMatch = /^(\d{1,2}):(\d{2})$/.exec(tijd);
  if (!datumMatch || !tijdMatch) throw new Error("Ongeldige datum/tijd.");

  const jaar = Number(datumMatch[1]);
  const maand = Number(datumMatch[2]);
  const dag = Number(datumMatch[3]);
  const uur = Number(tijdMatch[1]);
  const minuut = Number(tijdMatch[2]);

  if (uur > 23 || minuut > 59) throw new Error("Ongeldige tijd.");

  const gewensteUTC = Date.UTC(jaar, maand - 1, dag, uur, minuut);
  let kandidaat = new Date(gewensteUTC);

  // Iteratief corrigeren met de daadwerkelijk geldende Amsterdamse offset.
  for (let i = 0; i < 3; i += 1) {
    const lokaal = nederlandseDatumOnderdelen(kandidaat);
    const huidigUTC = Date.UTC(
      lokaal.jaar,
      lokaal.maand - 1,
      lokaal.dag,
      lokaal.uur,
      lokaal.minuut,
      0,
    );
    kandidaat = new Date(kandidaat.getTime() + (gewensteUTC - huidigUTC));
  }

  return kandidaat;
}
