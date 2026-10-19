import { test } from "node:test";
import * as assert from "node:assert/strict";

import { berekenContractUren, berekenDienstUren, begrensRapportageUren } from "../lib/contracturen/berekening";

test("rapportage begrenst vaste uren op contracturen maar laat werkelijke uren ongemoeid", () => {
  assert.equal(begrensRapportageUren(25, 15), 15);
  assert.equal(begrensRapportageUren(10, 15), 10);
  assert.equal(begrensRapportageUren(25, null), 0);
});

test("jaarurennorm trekt het starttegoed verlof één keer af", () => {
  const balans = berekenContractUren({
    contractUren: 16,
    jaarUrenNorm: null,
    verlofUrenStart: 80,
    gewerkteUren: 700,
    liveIngepland: 30,
    resterendeOpeningsweken: 5,
  });
  assert.equal(balans.jaarNorm, 832);
  assert.equal(balans.teWerkenNorm, 752);
  assert.equal(balans.resterendTeWerken, 52);
  assert.equal(balans.nogNietIngepland, 22);
  assert.equal(balans.gemiddeldNogTeWerkenPerWeek, 10.4);
  assert.equal(balans.gemiddeldNogInTePlannenPerWeek, 4.4);
});

test("een geprognosticeerd overschot wordt afzonderlijk zichtbaar", () => {
  const balans = berekenContractUren({
    contractUren: 16,
    jaarUrenNorm: 832,
    verlofUrenStart: 80,
    gewerkteUren: 760,
    liveIngepland: 10,
    resterendeOpeningsweken: 4,
  });
  assert.equal(balans.nogNietIngepland, -18);
  assert.equal(balans.prognoseOverschot, 18);
  assert.equal(balans.prognoseTekort, 0);
});

test("diensturen worden zonder locale datumverschuiving berekend", () => {
  assert.equal(berekenDienstUren("2026-10-19T15:00:00.000Z", "2026-10-19T19:00:00.000Z"), 4);
  assert.equal(berekenDienstUren("2026-10-19T19:00:00.000Z", "2026-10-19T15:00:00.000Z"), 0);
});
