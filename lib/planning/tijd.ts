export const START_MINUTEN = 9 * 60;
export const EINDE_MINUTEN = 23 * 60;
export const TIJD_INTERVAL = 30;

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
