import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { analyzeNote, extractPeople } from "../src/note-analyzer.js";
import { noteCases } from "./fixtures/note-cases.js";

describe("note analyzer QA corpus", () => {
  for (const item of noteCases) {
    test(item.text, () => {
      const analysis = analyzeNote(item.text, item.createdAt);

      assert.deepEqual(analysis.people, item.expect.people);
      assert.equal(analysis.reminder, item.expect.reminder);
      if ("reminderKind" in item.expect) assert.equal(analysis.reminderKind, item.expect.reminderKind);
      assert.equal(analysis.topic, item.expect.topic);

      if ("signal" in item.expect) {
        assert.equal(analysis.signal, item.expect.signal);
      }

      if ("hasTask" in item.expect) {
        assert.equal(analysis.tasks.length > 0, item.expect.hasTask);
      }

      if ("hasDecision" in item.expect) {
        assert.equal(analysis.decisions.length > 0, item.expect.hasDecision);
      }
    });
  }
});

test("extractPeople does not treat weekdays as people", () => {
  assert.deepEqual(extractPeople("обсудить встречу в среду"), []);
  assert.deepEqual(extractPeople("подготовить план к пятнице"), []);
});
