import assert from "node:assert/strict";
import test from "node:test";
import { crossingAxis, timeTickIndexes } from "../src/lib/analytics-chart.ts";

test("count axes retain zero and contain every actual count on integer readable ticks", () => {
  for (const values of [[9], [0], [null], [1, 3, 17, null], [120, 233, 401]]) {
    const axis = crossingAxis(values);
    assert.equal(axis.ticks[0], 0);
    assert.equal(axis.ticks.at(-1), axis.ceiling);
    assert.ok(axis.ticks.every(Number.isInteger));
    assert.ok(values.every(value => value === null || value <= axis.ceiling));
    assert.ok(axis.ticks.length <= 6);
  }
});

test("sparse and long intervals keep exact first and final anchors without duplicate ticks", () => {
  assert.deepEqual(timeTickIndexes(0), []);
  assert.deepEqual(timeTickIndexes(1), [0]);
  assert.deepEqual(timeTickIndexes(2), [0, 1]);
  assert.deepEqual(timeTickIndexes(120), [0, 40, 79, 119]);
});
