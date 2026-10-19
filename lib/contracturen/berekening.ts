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

export function berekenDienstUren(begintijd: Date | string, eindtijd: Date | string): number {
  const begin = begintijd instanceof Date ? begintijd.getTime() : new Date(begintijd).getTime();
  const einde = eindtijd instanceof Date ? eindtijd.getTime() : new Date(eindtijd).getTime();
  if (!Number.isFinite(begin) || !Number.isFinite(einde) || einde <= begin) return 0;
  return afrondenUren((einde - begin) / 3_600_000);
}

function afrondenUren(uren: number): number {
  return Math.round((uren + Number.EPSILON) * 100) / 100;
}
