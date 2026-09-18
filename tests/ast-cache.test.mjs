import { test } from "node:test";
import assert from "node:assert/strict";
import { createAstCache } from "../src/math/ast-cache.js";

test("syntax cache is immutable, LRU bounded, and does not cache failures", () => {
  const read = createAstCache({ maxEntries: 2, maxCharacters: 1000 });
  let calls = 0;
  const parse = () => ({ type: "binary", left: { value: ++calls }, right: { value: 2 } });
  const a = read("a", parse);
  assert.equal(read("a", parse), a);
  assert(Object.isFrozen(a.left));
  assert.throws(() => { a.left.value = 8; }, TypeError);
  read("b", parse); read("a", parse); read("c", parse);
  assert.equal(read("a", parse), a);
  read("b", parse); assert.equal(calls, 4);
  assert.throws(() => read("bad", () => { throw new Error("unfinished"); }));
  assert.equal(read("bad", () => ({ value: 42 })).value, 42);
});

test("oversized syntax is parsed without occupying retained cache space", () => {
  const read = createAstCache({ maxCharacters: 20 });
  let calls = 0;
  const parse = () => ({ value: ++calls });
  read("a".repeat(6), parse); read("a".repeat(6), parse);
  assert.equal(calls, 2);
  read("tiny", parse); read("tiny", parse);
  assert.equal(calls, 3);
});
