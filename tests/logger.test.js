import test from "node:test";
import assert from "node:assert/strict";
import { createLogger } from "../modules/logger.js";

function logger(overrides = {}) {
  let tick = 0;
  return createLogger({
    sessionId: "session-test",
    pageInstanceId: "page-test",
    appVersion: "0.1.0",
    gitCommit: "abc1234",
    now: () => new Date("2026-07-28T08:12:33.456Z"),
    monotonicNow: () => ++tick,
    visibility: () => "visible",
    online: () => true,
    ...overrides
  });
}

test("logger creates complete entries with monotonic seq", () => {
  const subject = logger();
  subject.log("input", "keydown", { key: "Enter" });
  subject.log("input", "keyup", { key: "Enter" });
  const entries = subject.getEntries();
  assert.deepEqual(entries.map((entry) => entry.seq), [1, 2]);
  for (const field of ["wallTime", "monotonicMs", "sessionId", "pageInstanceId", "appVersion", "gitCommit", "module", "event", "visibilityState", "online", "payload"]) {
    assert.ok(field in entries[0], `missing ${field}`);
  }
});

test("logger serializes payload and isolates returned entries", () => {
  const subject = logger();
  subject.log("test", "object", { nested: { value: 1 } });
  const copy = subject.getEntries();
  copy[0].payload.nested.value = 2;
  assert.equal(subject.getEntries()[0].payload.nested.value, 1);
});

test("logger truncates over limit and records truncation", () => {
  const subject = logger({ maxEntries: 3 });
  for (let index = 0; index < 5; index += 1) subject.log("test", "entry", { index });
  const entries = subject.getEntries();
  assert.equal(entries.length, 3);
  assert.ok(entries.some((entry) => entry.event === "log-truncated"));
});

test("clear removes old entries and records the clear", () => {
  const subject = logger();
  subject.log("test", "before", {});
  subject.clear();
  const entries = subject.getEntries();
  assert.equal(entries.length, 1);
  assert.equal(entries[0].event, "log-cleared");
});

test("snapshot includes environment and entries", () => {
  const subject = logger({ environmentProvider: () => ({ runtime: "test" }) });
  subject.log("test", "snapshot", {});
  const snapshot = subject.exportSnapshot();
  assert.equal(snapshot.environment.runtime, "test");
  assert.equal(snapshot.entryCount, 1);
});

test("unserializable payload does not crash the app", () => {
  const subject = logger();
  const circular = {};
  circular.self = circular;
  assert.doesNotThrow(() => subject.log("test", "circular", circular));
  assert.equal(subject.getEntries()[0].payload.serializationError, true);
  assert.ok(subject.getEntries().some((entry) => entry.event === "payload-serialization-error"));
});
