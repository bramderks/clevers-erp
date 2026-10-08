import { test } from "node:test";
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

test("standaard planning bereik blijft 09:00 tot 23:00", () => {
  assert.equal(START_MINUTEN, 540);
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
