const clamp = (n) => Math.max(0, Math.min(1, n));
const smooth = (n) => {
  const t = clamp(n);
  return t * t * (3 - 2 * t);
};
const windowed = (p, a, b) => smooth((p - a) / (b - a));
export function scenePose(progress, { mode = "desktop" } = {}) {
  const p = clamp(Number.isFinite(progress) ? progress : 0);
  const expand = mode === "static" ? 1 : windowed(p, 0.025, 0.19);
  const open =
    mode === "static"
      ? 0
      : windowed(p, 0.2, 0.36) * (1 - windowed(p, 0.58, 0.74));
  const decision = mode === "static" ? 1 : windowed(p, 0.73, 0.83);
  return {
    progress: p,
    expand,
    open,
    decision,
    stage: p < 0.19 ? 0 : p < 0.43 ? 1 : p < 0.72 ? 2 : 3,
    photo: [-3.13 - open * 0.58, -0.04 - open * 0.24, 0.19 + open * 0.72],
    reading: [-0.06 + open * 0.11, -0.04 + open * 0.31, 0.19 + open * 1.55],
    rules: [3.07 + open * 0.66, -0.04 - open * 0.08, 0.19 + open * 2.48],
    rotation: [
      (5 * (1 - expand) + open * 10) * (1 - windowed(p, 0.65, 0.79)),
      (-9 * (1 - expand) - open * 15) * (1 - windowed(p, 0.65, 0.79)),
      -open * 0.6,
    ],
    copyAway: windowed(p, 0.018, 0.13),
    heading: windowed(p, 0.12, 0.21),
  };
}
