import { test } from "node:test";
import {
  isBeschikbaarheidDeadlineVerstreken,
  isTestOpenVoorWeek,
} from "../lib/beschikbaarheid/deadline";
import * as assert from "node:assert/strict";

import {
  EINDE_MINUTEN,
  START_MINUTEN,
  TIJD_INTERVAL,
  maakTijden,
  minutenNaarTijd,
  tijdNaarMinuten,
  tijdenOverlappen,
} from "../lib/planning/tijd";

test("planningstijden lopen in blokken van 15 minuten", () => {
  assert.equal(TIJD_INTERVAL, 15);
  assert.deepEqual(maakTijden(15 * 60, 16 * 60), ["15:00", "15:15", "15:30", "15:45", "16:00"]);
});

test("tijd conversie is omkeerbaar", () => {
  assert.equal(tijdNaarMinuten("15:30"), 930);
  assert.equal(minutenNaarTijd(930), "15:30");
  assert.equal(tijdNaarMinuten("15:15"), 915);
});

test("ongeldige tijden worden geweigerd", () => {
  assert.equal(tijdNaarMinuten("25:00"), null);
  assert.equal(tijdNaarMinuten("15:60"), null);
  assert.equal(tijdNaarMinuten(""), null);
});

test("overlap gebruikt de bestaande bedrijfsregel", () => {
  assert.equal(tijdenOverlappen(9 * 60, 14 * 60, 14 * 60, 15 * 60), false);
  assert.equal(tijdenOverlappen(9 * 60, 14 * 60, 13 * 60, 15 * 60), true);
});

test("standaard planning bereik blijft 08:30 tot 23:00", () => {
  assert.equal(START_MINUTEN, 510);
  assert.equal(EINDE_MINUTEN, 1380);
});


test("Nederlandse diensttijd blijft lokaal bij datum/tijd conversie", async () => {
  const { nederlandseDatumTijd, lokaleDatumSleutel, tijdInputWaarde } = await import("../lib/planning/tijd");
  const dienst = nederlandseDatumTijd("2026-09-30", "17:00");
  assert.equal(lokaleDatumSleutel(dienst), "2026-09-30");
  assert.equal(tijdInputWaarde(dienst), "17:00");
});

test("pauzeregels blijven centraal en reproduceerbaar", async () => {
  const { berekenGewerkteUren } = await import("../lib/verloning/pauze");
  const ochtend = berekenGewerkteUren(
    new Date("2026-10-08T07:00:00.000Z"),
    new Date("2026-10-08T12:00:00.000Z"),
  );
  assert.equal(ochtend.pauzeMinuten, 15);
  assert.equal(ochtend.gewerkteUren, 4.75);

  const avond = berekenGewerkteUren(
    new Date("2026-10-08T15:00:00.000Z"),
    new Date("2026-10-08T19:00:00.000Z"),
  );
  assert.equal(avond.pauzeMinuten, 0);
  assert.equal(avond.gewerkteUren, 4);
});

test("overlappende functies tellen dezelfde tijd maar één keer", async () => {
  const { mergeTijdIntervallen } = await import("../lib/verloning/overlappendeUren");
  const basis = new Date("2026-09-30T15:00:00.000Z");
  const later = new Date("2026-09-30T16:00:00.000Z");
  const einde = new Date("2026-09-30T19:00:00.000Z");
  const samengevoegd = mergeTijdIntervallen([
    { begintijd: basis, eindtijd: einde },
    { begintijd: later, eindtijd: new Date("2026-09-30T18:00:00.000Z") },
  ]);
  assert.equal(samengevoegd.length, 1);
  assert.equal(samengevoegd[0].begintijd.getTime(), basis.getTime());
  assert.equal(samengevoegd[0].eindtijd.getTime(), einde.getTime());
});


test("beschikbaarheidstestfase opent vanaf volgende week tot 1 december", () => {
  const vandaag = new Date("2026-10-13T12:00:00.000Z");

  assert.equal(isTestOpenVoorWeek(2026, 42, vandaag), false);
  assert.equal(isTestOpenVoorWeek(2026, 43, vandaag), true);
  assert.equal(isTestOpenVoorWeek(2026, 50, vandaag), true);
  assert.equal(
    isTestOpenVoorWeek(2026, 43, new Date("2026-11-30T23:00:00.000Z")),
    false,
  );
});

test("testfase overschrijft tijdelijk een verstreken beschikbaarheidsdeadline", () => {
  const week = {
    jaar: 2026,
    weeknummer: 43,
    beschikbaarheidDeadline: "2026-10-01T23:59:59.999Z",
  };

  assert.equal(
    isBeschikbaarheidDeadlineVerstreken(week, new Date("2026-10-13T12:00:00.000Z")),
    false,
  );
  assert.equal(
    isBeschikbaarheidDeadlineVerstreken(week, new Date("2026-12-01T00:00:00.000Z")),
    true,
  );
});

test("loonkosten verdelen unieke uren zonder dubbele telling van overlappende diensten", async () => {
  const { berekenUniekeUrenPerInterval } = await import("../lib/verloning/overlappendeUren");
  const begin = new Date("2026-09-30T15:00:00.000Z");
  const einde = new Date("2026-09-30T19:00:00.000Z");
  const uren = berekenUniekeUrenPerInterval(
    [
      { id: "dienst-a", medewerkerId: "medewerker-1", vestigingId: "vestiging-1", datum: new Date("2026-09-30T00:00:00.000Z"), begintijd: begin, eindtijd: einde },
      { id: "dienst-b", medewerkerId: "medewerker-1", vestigingId: "vestiging-1", datum: new Date("2026-09-30T00:00:00.000Z"), begintijd: begin, eindtijd: einde },
    ],
    (start, end) => ({ gewerkteUren: (end.getTime() - start.getTime()) / 3_600_000 }),
  );

  assert.equal(uren.get("dienst-a"), 4);
  assert.equal(uren.get("dienst-b"), 0);
  assert.equal([...uren.values()].reduce((totaal, waarde) => totaal + waarde, 0), 4);
});

test("lokale daggrenzen blijven correct bij zomer- en wintertijd", async () => {
  const { lokaleDagGrenzen } = await import("../lib/planning/tijd");

  const zomertijd = lokaleDagGrenzen("2026-03-29");
  const wintertijd = lokaleDagGrenzen("2026-10-25");

  assert.equal((zomertijd.einde.getTime() - zomertijd.start.getTime()) / 3_600_000, 23);
  assert.equal((wintertijd.einde.getTime() - wintertijd.start.getTime()) / 3_600_000, 25);
});


test("vaste contracturen begrenzen alleen de rapportagebasis, niet de werkelijk gewerkte uren", async () => {
  const { begrensRapportageUren, berekenContractUren } = await import("../lib/contracturen/berekening");
  assert.equal(begrensRapportageUren(25, 15), 15);
  assert.equal(begrensRapportageUren(10, 15), 10);
  const balans = berekenContractUren({ contractUren: 16, jaarUrenNorm: null, verlofUrenStart: 80, gewerkteUren: 700, liveIngepland: 30, resterendeOpeningsweken: 5 });
  assert.equal(balans.jaarNorm, 832);
  assert.equal(balans.teWerkenNorm, 752);
  assert.equal(balans.resterendTeWerken, 52);
  assert.equal(balans.nogNietIngepland, 22);
  assert.equal(balans.gemiddeldNogTeWerkenPerWeek, 10.4);
});
