import test from "node:test";
import assert from "node:assert/strict";
import { createStorageHelper } from "../modules/storage.js";

function memoryStorage() {
  const values = new Map();
  return {
    setItem: (key, value) => values.set(String(key), String(value)),
    getItem: (key) => values.has(String(key)) ? values.get(String(key)) : null,
    removeItem: (key) => values.delete(String(key))
  };
}

test("storage helper set, get, and remove", () => {
  const helper = createStorageHelper(memoryStorage());
  helper.set("testValue", "alpha");
  assert.equal(helper.get("testValue"), "alpha");
  helper.remove("testValue");
  assert.equal(helper.get("testValue"), null);
});

test("storage helper writes and reads JSON", () => {
  const helper = createStorageHelper(memoryStorage());
  helper.setJSON("json", { ok: true });
  assert.deepEqual(helper.getJSON("json"), { ok: true });
});

test("damaged JSON produces a named error", () => {
  const adapter = memoryStorage();
  const helper = createStorageHelper(adapter);
  adapter.setItem("mrbdProbe.bad", "{nope");
  assert.throws(() => helper.getJSON("bad"), { name: "StorageParseError" });
});
