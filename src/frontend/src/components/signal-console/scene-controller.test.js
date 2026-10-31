import { afterEach, beforeEach, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({ timelines: [], moves: [] }));
vi.mock("gsap", () => ({
  default: {
    registerPlugin: vi.fn(),
    to: vi.fn(() => {
      const move = { kill: vi.fn() };
      mocks.moves.push(move);
      return move;
    }),
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
beforeEach(() => {
  mocks.timelines.length = 0;
  mocks.moves.length = 0;
});
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
  controller = createSceneController({
    root,
    progressRef: { current: { value: initialProgress } },
    invalidate: vi.fn(),
    onStageChange: vi.fn(),
    reducedMotion,
  });
}
it("stops a selected-stage move when a visitor chooses another same-page destination", () => {
  mount();
  controller.goToStage(1);
  const move = mocks.moves.at(-1);
  expect(move.kill).not.toHaveBeenCalled();
  root.querySelector('a[href="#registry"]').click();
  expect(move.kill).toHaveBeenCalled();
});
it("gives keyboard, wheel and hidden-page navigation control back to the visitor", () => {
  mount();
  for (const event of [
    new KeyboardEvent("keydown", { key: "PageDown" }),
    new Event("wheel"),
  ]) {
    controller.goToStage(1);
    const move = mocks.moves.at(-1);
    window.dispatchEvent(event);
    expect(move.kill).toHaveBeenCalled();
  }
  controller.goToStage(1);
  const move = mocks.moves.at(-1);
  vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  document.dispatchEvent(new Event("visibilitychange"));
  expect(move.kill).toHaveBeenCalled();
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
it("creates only the scroll-linked timeline, never an autoplay tour", () => {
  mount();
  expect(mocks.timelines).toHaveLength(1);
  expect(mocks.timelines[0].scrollTrigger).not.toBeNull();
  expect(mocks.moves).toHaveLength(0);
  expect(controller.play).toBeUndefined();
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
