import { it, expect } from "vitest";
import { Matrix4, PerspectiveCamera, Vector4 } from "three";
import {
  fitSceneBounds,
  cssPlaneMatrix,
  fallbackSceneBounds,
} from "./scene-layout.js";
import { scenePose } from "./scene-pose.js";

it("fits a spread console between its caption and controls without enlarging it", () => {
  const bounds = { top: 70, bottom: 610 };
  const fit = fitSceneBounds(bounds, { top: 130, bottom: 540 });
  const center = (bounds.top + bounds.bottom) / 2;
  const top = center + (bounds.top - center) * fit.scale + fit.shift;
  const bottom = center + (bounds.bottom - center) * fit.scale + fit.shift;
  expect(top).toBeCloseTo(130);
  expect(bottom).toBeCloseTo(540);
  expect(fit.scale).toBeLessThan(1);
});

it("projects HTML corners onto the same tilted plane as the WebGL camera", () => {
  const camera = new PerspectiveCamera(35, 1200 / 740, 0.1, 60);
  camera.position.z = 12;
  camera.updateMatrixWorld();
  const world = new Matrix4().makeRotationY(-0.3).setPosition(0.2, 0.5, 1.8);
  const local = new Matrix4().set(
    0.01,
    0,
    0,
    -1.43,
    0,
    -0.01,
    0,
    2.19,
    0,
    0,
    1,
    0.055,
    0,
    0,
    0,
    1,
  );
  const clip = camera.projectionMatrix
    .clone()
    .multiply(camera.matrixWorldInverse)
    .multiply(world)
    .multiply(local);
  const css = new Matrix4().fromArray(
    cssPlaneMatrix(clip, { width: 1200, height: 740 }),
  );
  for (const [x, y] of [
    [0, 0],
    [286, 0],
    [0, 438],
    [286, 438],
    [143, 219],
  ]) {
    const native = new Vector4(x, y, 0, 1).applyMatrix4(clip);
    const html = new Vector4(x, y, 0, 1).applyMatrix4(css);
    expect(html.x / html.w).toBeCloseTo((native.x / native.w + 1) * 600);
    expect(html.y / html.w).toBeCloseTo((1 - native.y / native.w) * 370);
    const hit = new Vector4(
      html.x / html.w,
      html.y / html.w,
      0,
      1,
    ).applyMatrix4(css.clone().invert());
    expect(hit.x / hit.w).toBeCloseTo(x);
    expect(hit.y / hit.w).toBeCloseTo(y);
  }
});

it("can reserve caption and control space for every phone stage", () => {
  for (const p of [0.19, 0.29, 0.53, 0.86]) {
    const bounds = fallbackSceneBounds(scenePose(p, { mode: "stacked" }), {
      h: 720,
      scale: 0.8,
      y: 0,
      mobile: true,
    });
    const fit = fitSceneBounds(bounds, { top: 140, bottom: 520 });
    const center = (bounds.top + bounds.bottom) / 2;
    expect(
      center + (bounds.top - center) * fit.scale + fit.shift,
    ).toBeGreaterThanOrEqual(140 - 0.001);
    expect(
      center + (bounds.bottom - center) * fit.scale + fit.shift,
    ).toBeLessThanOrEqual(520 + 0.001);
  }
});

it("keeps an already-clear scene in place and handles a short viewport", () => {
  expect(
    fitSceneBounds({ top: 140, bottom: 500 }, { top: 120, bottom: 520 }),
  ).toEqual({ scale: 1, shift: 0 });
  const short = fitSceneBounds(
    { top: 0, bottom: 540 },
    { top: 100, bottom: 300 },
  );
  expect(short.scale).toBeCloseTo(200 / 540);
  expect(Number.isFinite(short.shift)).toBe(true);
});
