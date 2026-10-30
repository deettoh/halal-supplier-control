import { afterEach, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({ timelines: [] }));
vi.mock("gsap", () => ({
  default: {
    registerPlugin: vi.fn(),
    to: vi.fn(() => ({ kill: vi.fn() })),
    timeline: vi.fn((options) => {
      const line = {
        scrollTrigger: options?.scrollTrigger
          ? { start: 0, end: 2400, kill: vi.fn() }
          : null,
        to: vi.fn(function () {
          return this;
        }),
        kill: vi.fn(),
      };
      mocks.timelines.push(line);
      return line;
    }),
  },
}));
vi.mock("gsap/ScrollTrigger", () => ({ ScrollTrigger: {} }));
vi.mock("gsap/ScrollToPlugin", () => ({ ScrollToPlugin: {} }));
import { createSceneController } from "./scene-controller.js";
let controller, root;
afterEach(() => {
  controller?.destroy();
  root?.remove();
  vi.restoreAllMocks();
});
function mount(initialProgress = 0, { reducedMotion = false } = {}) {
  root = document.createElement("section");
  root.innerHTML =
    '<div class="scene-stage"></div><div class="hero-copy"><a href="/demo">Enter demo</a></div><div class="scene-heading"></div><div class="decision-drawer"></div><a href="#registry">Skip walkthrough</a>';
  document.body.append(root);
  Object.defineProperty(root, "clientHeight", { value: 4000 });
  Object.defineProperty(root.querySelector(".scene-stage"), "clientWidth", {
    value: 1200,
  });
  Object.defineProperty(root.querySelector(".scene-stage"), "clientHeight", {
    value: 740,
  });
  const playback = vi.fn();
  controller = createSceneController({
    root,
    progressRef: { current: { value: initialProgress } },
    invalidate: vi.fn(),
    onStageChange: vi.fn(),
    onPlaybackChange: playback,
    reducedMotion,
  });
  return playback;
}
it("stops guided playback when a visitor chooses another same-page destination", () => {
  const playback = mount();
  controller.play();
  expect(playback).toHaveBeenLastCalledWith(true);
  root.querySelector('a[href="#registry"]').click();
  expect(playback).toHaveBeenLastCalledWith(false);
});
it("gives keyboard, wheel and hidden-page navigation control back to the visitor", () => {
  const playback = mount();
  for (const event of [
    new KeyboardEvent("keydown", { key: "PageDown" }),
    new Event("wheel"),
  ]) {
    controller.play();
    window.dispatchEvent(event);
    expect(playback).toHaveBeenLastCalledWith(false);
  }
  controller.play();
  vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  document.dispatchEvent(new Event("visibilitychange"));
  expect(playback).toHaveBeenLastCalledWith(false);
});

it("restores the opening composition after leaving a selected static stage", () => {
  mount(0.53);
  expect(root.querySelector(".hero-copy").style.opacity).toBe("1");
});

it("updates the shared scan even when the CSS fallback has been removed for the 3D renderer", () => {
  mount();
  const line = mocks.timelines.findLast((t) => t.scrollTrigger);
  const [progress, options] = line.to.mock.calls[0];
  progress.value = 0.22;
  options.onUpdate();
  expect(Number(root.style.getPropertyValue("--scan-progress"))).toBeCloseTo(
    0.5,
  );
  expect(root.style.getPropertyValue("--scan-opacity")).toBe("1");
  progress.value = 0.18;
  options.onUpdate();
  expect(Number(root.style.getPropertyValue("--scan-progress"))).toBeCloseTo(
    0.25,
  );
  controller.destroy();
  expect(root.style.getPropertyValue("--scan-opacity")).toBe("");
});
it("clears the scan in the static alternative", () => {
  mount(0.22, { reducedMotion: true });
  expect(root.style.getPropertyValue("--scan-opacity")).toBe("0");
});
it("starts the tour with movement rather than an unexplained opening wait", () => {
  const playback = mount();
  controller.play();
  const tour = mocks.timelines.at(-1);
  expect(tour.to.mock.calls[0][0]).toBe(window);
  expect(tour.to.mock.calls[0][1].scrollTo.y).toBeGreaterThan(0);
  expect(playback).toHaveBeenLastCalledWith(true);
});
it("seeks directly to a section instead of replaying intermediate scroll poses", () => {
  mount();
  const scroll = vi.spyOn(window, "scrollTo");
  const target = document.createElement("section");
  target.getBoundingClientRect = () => ({ top: 2800 });
  const line = mocks.timelines.findLast((t) => t.scrollTrigger);
  const [progress] = line.to.mock.calls[0];
  controller.jumpToSection(target);
  expect(scroll).toHaveBeenLastCalledWith(
    expect.objectContaining({ behavior: "instant" }),
  );
  expect(progress.value).toBe(1);
  target.getBoundingClientRect = () => ({ top: 0 });
  controller.jumpToSection(target);
  expect(progress.value).toBe(0);
  expect(root.querySelector(".hero-copy").style.opacity).toBe("1");
});
