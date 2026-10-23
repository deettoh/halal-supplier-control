import { afterEach, expect, it, vi } from "vitest";
import { transitionUpdate } from "./motion.js";

afterEach(() => {
  delete document.startViewTransition;
  vi.unstubAllGlobals();
});
function preferences(reduced) {
  vi.stubGlobal("matchMedia", () => ({ matches: reduced }));
}
it("changes the view immediately when transitions are unavailable or motion is reduced", () => {
  const update = vi.fn();
  transitionUpdate(update);
  expect(update).toHaveBeenCalledOnce();
  preferences(true);
  document.startViewTransition = () => {
    throw new Error("must not snapshot");
  };
  transitionUpdate(update);
  expect(update).toHaveBeenCalledTimes(2);
});
it("commits once even if a transition throws after taking its update", () => {
  preferences(false);
  document.startViewTransition = (update) => {
    update();
    throw new Error("snapshot unavailable");
  };
  const update = vi.fn();
  transitionUpdate(update);
  expect(update).toHaveBeenCalledOnce();
});
it("falls back to the update when transition setup throws before calling it", () => {
  preferences(false);
  document.startViewTransition = () => {
    throw new Error("snapshot unavailable");
  };
  const update = vi.fn();
  transitionUpdate(update);
  expect(update).toHaveBeenCalledOnce();
});
it("handles a superseded snapshot without repeating the route update", async () => {
  preferences(false);
  let release;
  const first = {
    ready: Promise.resolve(),
    updateCallbackDone: Promise.resolve(),
    finished: new Promise((r) => {
      release = r;
    }),
    skipTransition: vi.fn(),
  };
  const failed = {
    ready: Promise.reject(new Error("snapshot interrupted")),
    updateCallbackDone: Promise.resolve(),
    finished: Promise.resolve(),
  };
  let calls = 0;
  document.startViewTransition = (commit) => {
    commit();
    return calls++ === 0 ? first : failed;
  };
  const update = vi.fn();
  transitionUpdate(update);
  transitionUpdate(update);
  release();
  await Promise.resolve();
  expect(first.skipTransition).toHaveBeenCalledOnce();
  expect(update).toHaveBeenCalledTimes(2);
});
it("keeps the latest destination when an older snapshot's callback arrives last", () => {
  preferences(false);
  const callbacks = [];
  document.startViewTransition = (commit) => {
    callbacks.push(commit);
    return { ready: Promise.resolve(), finished: Promise.resolve() };
  };
  let destination = "/";
  transitionUpdate(() => {
    destination = "/demo";
  });
  transitionUpdate(() => {
    destination = "/review";
  });
  callbacks[1]();
  callbacks[0]();
  expect(destination).toBe("/review");
});
