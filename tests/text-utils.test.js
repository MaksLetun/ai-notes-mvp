import assert from "node:assert/strict";
import { test } from "node:test";

import { normalizePersonName } from "../src/text-utils.js";

test("normalizes common Russian name cases to nominative form", () => {
  assert.equal(normalizePersonName("Машей"), "Маша");
  assert.equal(normalizePersonName("Маше"), "Маша");
  assert.equal(normalizePersonName("Машу"), "Маша");
  assert.equal(normalizePersonName("димой"), "Дима");
  assert.equal(normalizePersonName("диму"), "Дима");
  assert.equal(normalizePersonName("Катей"), "Катя");
  assert.equal(normalizePersonName("Петру"), "Петр");
  assert.equal(normalizePersonName("Сергея"), "Сергей");
});

test("keeps nominative names unchanged", () => {
  assert.equal(normalizePersonName("Маша"), "Маша");
  assert.equal(normalizePersonName("Петр"), "Петр");
  assert.equal(normalizePersonName("Сергей"), "Сергей");
});
