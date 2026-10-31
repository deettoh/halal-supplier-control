// Keep the animated object inside the space reserved for it, never under its copy.
export function sceneSpace(layout, pose, { mobile = false } = {}) {
  // As the trays separate, the whole caption/object composition rises together.
  const captionTop = 20 + 24 * (1 - pose.open) * (1 - pose.decision);
  return {
    top: mobile
      ? Math.max(
          (captionTop + layout.headingHeight + 24) * pose.heading,
          (layout.heroBottom + 20) * (1 - pose.copyAway),
        )
      : captionTop + layout.headingHeight + 24,
    bottom:
      layout.controlsTop - 24 - pose.decision * (layout.drawerHeight + 16),
  };
}

export function fitSceneBounds(bounds, space) {
  const height = Math.max(1, bounds.bottom - bounds.top);
  const available = Math.max(1, space.bottom - space.top);
  const scale = Math.min(1, available / height);
  const center = (bounds.top + bounds.bottom) / 2;
  const top = center - (height * scale) / 2;
  const bottom = center + (height * scale) / 2;
  const shift =
    top < space.top
      ? space.top - top
      : bottom > space.bottom
        ? space.bottom - bottom
        : 0;
  return { scale, shift };
}

export function cssPlaneMatrix(clip, { width, height }) {
  const m = clip.elements,
    halfW = width / 2,
    halfH = height / 2;
  return [
    halfW * (m[0] + m[3]),
    halfH * (m[3] - m[1]),
    0,
    m[3],
    halfW * (m[4] + m[7]),
    halfH * (m[7] - m[5]),
    0,
    m[7],
    0,
    0,
    1,
    0,
    halfW * (m[12] + m[15]),
    halfH * (m[15] - m[13]),
    0,
    m[15],
  ];
}

// CSS fallback uses the same reserved space as WebGL. Project the authored
// plane corners mathematically, without forcing a browser layout every frame.
export function fallbackSceneBounds(pose, { h, scale, y, mobile }) {
  const [rx, ry, rz] = pose.rotation.map((v) => (v * Math.PI) / 180);
  const points = [];
  function corner(x, py, z) {
    const zx = x * Math.cos(rz) - py * Math.sin(rz);
    const zy = x * Math.sin(rz) + py * Math.cos(rz);
    const yz = -zx * Math.sin(ry) + z * Math.cos(ry);
    const yy = zy * Math.cos(rx) - yz * Math.sin(rx);
    const zz = zy * Math.sin(rx) + yz * Math.cos(rx);
    points.push(
      h * (mobile ? 0.53 : 0.51) + y + (yy / (1 - zz / 1900)) * scale,
    );
  }
  [
    ["photo", 18, 298, -3.13],
    ["reading", 331, 286, -0.06],
    ["rules", 632, 310, 3.07],
  ].forEach(([key, left, width, base], i) => {
    const current = i === Math.min(2, pose.stage);
    const dx = mobile
      ? 480 -
        (left + width / 2) +
        (current ? 0 : i < Math.min(2, pose.stage) ? -22 : 22)
      : (pose[key][0] - base) * 100;
    const dy = mobile ? (current ? 0 : -17) : -(pose[key][1] + 0.04) * 100;
    const dz = mobile ? (current ? 125 : 0) : (pose[key][2] - 0.19) * 100;
    for (const x of [left, left + width])
      for (const py of [55, 493]) corner(x - 480 + dx, py - 270 + dy, dz);
  });
  if (!mobile)
    for (const x of [-480, 480]) for (const py of [-270, 270]) corner(x, py, 0);
  return { top: Math.min(...points), bottom: Math.max(...points) };
}
