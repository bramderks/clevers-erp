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

test("planningstijden lopen in blokken van 30 minuten", () => {
  assert.equal(TIJD_INTERVAL, 30);
  assert.deepEqual(maakTijden(15 * 60, 16 * 60), ["15:00", "15:30", "16:00"]);
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
