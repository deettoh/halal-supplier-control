import { it, expect } from "vitest";
import { scenePose } from "./scene-pose.js";
it("opens and reassembles the same evidence in one bounded sequence", () => {
  const start = scenePose(0),
    peak = scenePose(0.48),
    end = scenePose(1);
  expect(start.stage).toBe(0);
  expect(start.expand).toBe(0);
  expect(peak.stage).toBe(2);
  expect(peak.open).toBe(1);
  expect(peak.rules[2]).toBeGreaterThan(peak.photo[2]);
  expect(end.stage).toBe(3);
  expect(end.open).toBe(0);
  expect(end.decision).toBe(1);
});
it("clamps direct links and keeps the static alternative fully readable", () => {
  expect(scenePose(-10)).toEqual(scenePose(0));
  expect(scenePose(9)).toEqual(scenePose(1));
  expect(scenePose(0.4, { mode: "static" })).toMatchObject({
    open: 0,
    expand: 1,
    decision: 1,
  });
});
