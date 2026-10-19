export function bepaalContractPeriode(datumInDienst: Date | null, fallbackStart: Date, peildatum: Date): { start: Date; einde: Date } {
  const dag = (waarde: Date) => new Date(Date.UTC(waarde.getUTCFullYear(), waarde.getUTCMonth(), waarde.getUTCDate()));
  const peil = dag(peildatum);
  const anker = dag(datumInDienst ?? fallbackStart);
  let start: Date;
  if (anker > peil) {
    start = anker;
  } else {
    start = new Date(Date.UTC(peil.getUTCFullYear(), anker.getUTCMonth(), anker.getUTCDate()));
    if (start > peil) start = new Date(Date.UTC(peil.getUTCFullYear() - 1, anker.getUTCMonth(), anker.getUTCDate()));
  }
  let volgende = new Date(Date.UTC(start.getUTCFullYear() + 1, start.getUTCMonth(), start.getUTCDate()));
  if (volgende.getUTCMonth() !== start.getUTCMonth()) volgende = new Date(Date.UTC(start.getUTCFullYear() + 1, start.getUTCMonth() + 1, 0));
  const einde = new Date(volgende);
  einde.setUTCDate(einde.getUTCDate() - 1);
  return { start, einde };
}

export type ContractUrenBalansInput = {
  contractUren: number | null;
  jaarUrenNorm: number | null;
  verlofUrenStart: number | null;
  gewerkteUren: number;
  liveIngepland: number;
  resterendeOpeningsweken: number;
};

export function begrensRapportageUren(gewerkteUren: number, contractUren: number | null): number {
  if (!Number.isFinite(gewerkteUren) || gewerkteUren <= 0 || contractUren === null || !Number.isFinite(contractUren) || contractUren <= 0) return 0;
  return afrondenUren(Math.min(gewerkteUren, contractUren));
}

export function berekenContractUren(input: ContractUrenBalansInput) {
  const contractUren = input.contractUren !== null && Number.isFinite(input.contractUren) ? Math.max(0, input.contractUren) : null;
  const jaarNorm = input.jaarUrenNorm !== null && Number.isFinite(input.jaarUrenNorm)
    ? Math.max(0, input.jaarUrenNorm)
    : (contractUren ?? 0) * 52;
  const verlofUrenStart = input.verlofUrenStart !== null && Number.isFinite(input.verlofUrenStart)
    ? Math.max(0, input.verlofUrenStart)
    : 0;
  const teWerkenNorm = Math.max(0, jaarNorm - verlofUrenStart);
  const gewerkteUren = Math.max(0, Number.isFinite(input.gewerkteUren) ? input.gewerkteUren : 0);
  const liveIngepland = Math.max(0, Number.isFinite(input.liveIngepland) ? input.liveIngepland : 0);
  const resterendTeWerken = afrondenUren(teWerkenNorm - gewerkteUren);
  const nogNietIngepland = afrondenUren(resterendTeWerken - liveIngepland);
  const weken = Math.max(0, Math.floor(input.resterendeOpeningsweken));
  return {
    contractUren,
    jaarNorm: afrondenUren(jaarNorm),
    verlofUrenStart: afrondenUren(verlofUrenStart),
    teWerkenNorm: afrondenUren(teWerkenNorm),
    gewerkteUren: afrondenUren(gewerkteUren),
    liveIngepland: afrondenUren(liveIngepland),
    resterendTeWerken,
    nogNietIngepland,
    resterendeOpeningsweken: weken,
    gemiddeldNogTeWerkenPerWeek: weken > 0 ? afrondenUren(Math.max(0, resterendTeWerken) / weken) : null,
    gemiddeldNogInTePlannenPerWeek: weken > 0 ? afrondenUren(Math.max(0, nogNietIngepland) / weken) : null,
    prognoseOverschot: afrondenUren(Math.max(0, -nogNietIngepland)),
    prognoseTekort: afrondenUren(Math.max(0, nogNietIngepland)),
  };
}

export type ContractRapportageRegel = { medewerkerId: string; uren: number; uurloon: number | null; kosten: number | null; contractType?: string | null; contractUren?: number | null };

/** Begrenst uitsluitend de rapportage-uren voor vaste contracten; de bronregistraties blijven ongewijzigd. */
export function begrensRapportageRegels<T extends ContractRapportageRegel>(regels: T[]): T[] {
  const groepen = new Map<string, T[]>();
  for (const regel of regels) {
    if (regel.contractType !== "VAST" || regel.contractUren == null || !Number.isFinite(regel.contractUren)) continue;
    const groep = groepen.get(regel.medewerkerId) ?? [];
    groep.push(regel);
    groepen.set(regel.medewerkerId, groep);
  }
  for (const groep of groepen.values()) {
    const contractUren = Math.max(0, groep[0]?.contractUren ?? 0);
    const totaal = groep.reduce((som, regel) => som + Math.max(0, regel.uren), 0);
    if (totaal <= contractUren || totaal <= 0) continue;
    const factor = contractUren / totaal;
    let toegewezen = 0;
    groep.forEach((regel, index) => {
      const uren = index === groep.length - 1
        ? Math.max(0, Math.round((contractUren - toegewezen + Number.EPSILON) * 100) / 100)
        : Math.round((regel.uren * factor + Number.EPSILON) * 100) / 100;
      regel.uren = uren;
      toegewezen += uren;
      regel.kosten = regel.uurloon == null ? null : uren * regel.uurloon;
    });
  }
  return regels;
}

export function berekenDienstUren(begintijd: Date | string, eindtijd: Date | string): number {
  const begin = begintijd instanceof Date ? begintijd.getTime() : new Date(begintijd).getTime();
  const einde = eindtijd instanceof Date ? eindtijd.getTime() : new Date(eindtijd).getTime();
  if (!Number.isFinite(begin) || !Number.isFinite(einde) || einde <= begin) return 0;
  return afrondenUren((einde - begin) / 3_600_000);
}

function afrondenUren(uren: number): number {
  return Math.round((uren + Number.EPSILON) * 100) / 100;
}
