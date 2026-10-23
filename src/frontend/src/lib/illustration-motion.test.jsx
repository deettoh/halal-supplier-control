import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useIllustrationMotion } from "./illustration-motion.js";

let observers;
let hidden;
function Scene({ photo = false }) {
  const ref = useIllustrationMotion();
  return (
    <figure ref={ref} data-testid="scene">
      {photo && <img src="/example.png" alt="SAMPLE evidence" />}
      <figcaption>Prepared example. No live request.</figcaption>
    </figure>
  );
}
function enter(visible) {
  expect(observers).toHaveLength(1);
  act(() => observers[0].callback([{ isIntersecting: visible }]));
}
beforeEach(() => {
  observers = [];
  hidden = false;
  vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback) {
        this.callback = callback;
        this.observe = vi.fn();
        this.disconnect = vi.fn();
        observers.push(this);
      }
    },
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("waits for visible, loaded evidence without hiding the static content", () => {
  render(<Scene photo />);
  const scene = screen.getByTestId("scene");
  expect(screen.getByText(/Prepared example/)).toBeVisible();
  expect(scene).not.toHaveAttribute("data-motion");
  enter(true);
  expect(scene).not.toHaveAttribute("data-motion");
  fireEvent.load(screen.getByRole("img"));
  expect(scene).toHaveAttribute("data-motion", "play");
  expect(scene).toHaveAttribute("data-motion-paused", "false");
});

it("pauses offscreen and on hidden tabs, preserving the single sequence on return", () => {
  render(<Scene />);
  const scene = screen.getByTestId("scene");
  enter(true);
  expect(scene).toHaveAttribute("data-motion", "play");
  enter(false);
  expect(scene).toHaveAttribute("data-motion-paused", "true");
  expect(scene).toHaveAttribute("data-motion", "play");
  enter(true);
  expect(scene).toHaveAttribute("data-motion-paused", "false");
  hidden = true;
  fireEvent(document, new Event("visibilitychange"));
  expect(scene).toHaveAttribute("data-motion-paused", "true");
  hidden = false;
  fireEvent(document, new Event("visibilitychange"));
  expect(scene).toHaveAttribute("data-motion-paused", "false");
  expect(scene).toHaveAttribute("data-motion", "play");
});

it("does not start while the tab is hidden", () => {
  hidden = true;
  render(<Scene />);
  enter(true);
  expect(screen.getByTestId("scene")).not.toHaveAttribute("data-motion");
  hidden = false;
  fireEvent(document, new Event("visibilitychange"));
  expect(screen.getByTestId("scene")).toHaveAttribute("data-motion", "play");
});

it("keeps the readable static example if image loading fails or observers are unavailable", () => {
  const first = render(<Scene photo />);
  enter(true);
  fireEvent.error(screen.getByRole("img"));
  expect(screen.getByText(/Prepared example/)).toBeVisible();
  expect(screen.getByTestId("scene")).not.toHaveAttribute("data-motion");
  first.unmount();
  vi.stubGlobal("IntersectionObserver", undefined);
  render(<Scene />);
  expect(screen.getByText(/Prepared example/)).toBeVisible();
  expect(screen.getByTestId("scene")).not.toHaveAttribute("data-motion");
});

it("disconnects the observer and removes visibility and image listeners on unmount", () => {
  const removeVisibility = vi.spyOn(document, "removeEventListener");
  const scene = render(<Scene photo />);
  const image = screen.getByRole("img");
  const removeLoad = vi.spyOn(image, "removeEventListener");
  scene.unmount();
  expect(observers).toHaveLength(1);
  expect(observers[0].disconnect).toHaveBeenCalledOnce();
  expect(removeVisibility).toHaveBeenCalledWith(
    "visibilitychange",
    expect.any(Function),
  );
  expect(removeLoad).toHaveBeenCalledWith("load", expect.any(Function));
});
