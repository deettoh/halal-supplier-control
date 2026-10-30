import { it, expect, vi } from "vitest";
import gsap from "gsap";
import { createLoupeIntro } from "./loupe-intro-motion.js";

it("finishes the unfold, moves right, then reveals the name before releasing the page", () => {
  const root = document.createElement("div");
  root.innerHTML =
    '<div class="opening-mark-motion"><div data-ribbon-fold="back"></div><div data-ribbon-fold="middle"></div><div data-ribbon-fold="front"></div></div><div class="opening-name"></div>';
  document.body.append(root);
  const complete = vi.fn();
  const line = createLoupeIntro(root, { paused: true, onComplete: complete });
  const mark = root.querySelector(".opening-mark-motion"),
    name = root.querySelector(".opening-name");
  line.seek("unfolded", false);
  expect(Number(gsap.getProperty(name, "opacity"))).toBe(0);
  expect(Number(gsap.getProperty(mark, "x"))).toBe(0);
  for (const plane of root.querySelectorAll("[data-ribbon-fold]"))
    expect(Number(gsap.getProperty(plane, "rotationX"))).toBeCloseTo(0);
  line.seek("name", false);
  expect(Number(gsap.getProperty(mark, "x"))).toBeGreaterThan(0);
  expect(Number(gsap.getProperty(name, "opacity"))).toBe(0);
  line.seek("hold", false);
  expect(Number(gsap.getProperty(name, "opacity"))).toBe(1);
  expect(Number(gsap.getProperty(name, "scale"))).toBeCloseTo(1);
  expect(Number(gsap.getProperty(root, "opacity"))).toBe(1);
  line.progress(1, false);
  expect(complete).toHaveBeenCalledOnce();
  expect(line.duration()).toBeLessThan(4);
  line.kill();
  root.remove();
});
