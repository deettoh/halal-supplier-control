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

it("scrubs the photo scan through one bounded pass and reverses with scroll", () => {
  expect(scenePose(0.14)).toMatchObject({ scanProgress: 0, scanOpacity: 0 });
  expect(scenePose(0.22).scanProgress).toBeCloseTo(0.5);
  expect(scenePose(0.22).scanOpacity).toBe(1);
  expect(scenePose(0.3)).toMatchObject({ scanProgress: 1, scanOpacity: 0 });
  expect(scenePose(0.18).scanProgress).toBeLessThan(
    scenePose(0.26).scanProgress,
  );
});
it("finishes the phone scan before the reading plane takes over and hides it in static mode", () => {
  const phone = scenePose(0.18, { mode: "stacked" });
  expect(phone.scanProgress).toBe(1);
  expect(phone.stage).toBe(0);
  expect(scenePose(0.1075, { mode: "stacked" }).scanProgress).toBeCloseTo(0.5);
  expect(scenePose(0.22, { mode: "static" }).scanOpacity).toBe(0);
});
