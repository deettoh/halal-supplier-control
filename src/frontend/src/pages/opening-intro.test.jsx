import React, { StrictMode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import Landing from "./landing.jsx";
import { SessionProvider } from "../lib/session.jsx";
import { createPreviewGateway } from "../lib/preview/gateway.js";

const seenKey = "hsc-opening-seen:v1";
let preference;

function openLanding({ strict = false } = {}) {
  const page = (
    <SessionProvider gateway={createPreviewGateway()} initialIdentity={null}>
      <Landing />
    </SessionProvider>
  );
  return render(strict ? <StrictMode>{page}</StrictMode> : page);
}

beforeEach(() => {
  vi.useFakeTimers();
  sessionStorage.removeItem(seenKey);
  window.history.replaceState(null, "", "/");
  document.body.style.overflow = "auto";
  preference = new EventTarget();
  preference.matches = false;
  vi.stubGlobal("matchMedia", () => preference);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  sessionStorage.removeItem(seenKey);
  document.body.style.overflow = "";
});

it("reveals the landing after a bounded intro and does not replay in this tab session", () => {
  const first = openLanding();
  expect(screen.getByRole("button", { name: "Skip intro" })).toHaveFocus();
  expect(document.querySelector("main").closest("[inert]")).not.toBeNull();
  expect(document.body.style.overflow).toBe("hidden");
  act(() => vi.advanceTimersByTime(2500));
  expect(screen.queryByRole("button", { name: "Skip intro" })).toBeNull();
  expect(document.querySelector("main").closest("[inert]")).toBeNull();
  expect(screen.getByRole("main")).toHaveFocus();
  expect(document.body.style.overflow).toBe("auto");
  first.unmount();
  openLanding();
  expect(screen.queryByRole("button", { name: "Skip intro" })).toBeNull();
  expect(
    screen.getByRole("heading", { name: /Every delivery.*A clear.*next step/ }),
  ).toBeVisible();
});

it("lets a visitor skip immediately and focuses the landing", () => {
  openLanding();
  fireEvent.click(screen.getByRole("button", { name: "Skip intro" }));
  expect(screen.queryByRole("button", { name: "Skip intro" })).toBeNull();
  expect(screen.getByRole("main")).toHaveFocus();
  expect(document.body.style.overflow).toBe("auto");
});

it("lets Escape dismiss the opening without waiting", () => {
  openLanding();
  fireEvent.keyDown(window, { key: "Escape" });
  expect(screen.queryByRole("button", { name: "Skip intro" })).toBeNull();
  expect(screen.getByRole("main")).toHaveFocus();
});

it("opens the landing directly for reduced motion", () => {
  preference.matches = true;
  openLanding();
  expect(screen.queryByRole("button", { name: "Skip intro" })).toBeNull();
  expect(document.querySelector("main").closest("[inert]")).toBeNull();
  expect(document.body.style.overflow).toBe("auto");
  expect(sessionStorage.getItem(seenKey)).toBeNull();
});

it("dismisses if reduced motion is enabled while the intro is playing", () => {
  openLanding();
  expect(screen.getByRole("button", { name: "Skip intro" })).toBeVisible();
  act(() => {
    preference.matches = true;
    preference.dispatchEvent(new Event("change"));
  });
  expect(screen.queryByRole("button", { name: "Skip intro" })).toBeNull();
  expect(document.body.style.overflow).toBe("auto");
});

it("keeps a direct section link available without an opening overlay", () => {
  window.history.replaceState(null, "", "/#walkthrough");
  openLanding();
  expect(screen.queryByRole("button", { name: "Skip intro" })).toBeNull();
  expect(
    screen.getByRole("region", {
      name: "Interactive SAMPLE delivery walkthrough",
    }),
  ).toBeVisible();
  expect(document.body.style.overflow).toBe("auto");
});

it("cleans up the scroll lock if the landing unmounts before the reveal", () => {
  const page = openLanding();
  expect(document.body.style.overflow).toBe("hidden");
  page.unmount();
  expect(document.body.style.overflow).toBe("auto");
  act(() => vi.advanceTimersByTime(3000));
  expect(document.body.style.overflow).toBe("auto");
});

it("still shows a first visit under StrictMode and releases it normally", () => {
  openLanding({ strict: true });
  expect(screen.getByRole("button", { name: "Skip intro" })).toBeVisible();
  act(() => vi.advanceTimersByTime(2500));
  expect(screen.queryByRole("button", { name: "Skip intro" })).toBeNull();
  expect(document.body.style.overflow).toBe("auto");
});

it("keeps the page usable when browser session storage is unavailable", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new DOMException("Storage blocked", "SecurityError");
  });
  openLanding();
  expect(screen.queryByRole("button", { name: "Skip intro" })).toBeNull();
  expect(document.body.style.overflow).toBe("auto");
  expect(screen.getByRole("link", { name: "How it works" })).toBeVisible();
});

it("bypasses the intro when session storage can be read but cannot be written", async () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("Storage full", "QuotaExceededError");
  });
  let first;
  await act(async () => {
    first = openLanding();
  });
  expect(screen.queryByRole("button", { name: "Skip intro" })).toBeNull();
  expect(document.querySelector("main").closest("[inert]")).toBeNull();
  expect(document.body.style.overflow).toBe("auto");
  first.unmount();
  await act(async () => {
    openLanding();
  });
  expect(screen.queryByRole("button", { name: "Skip intro" })).toBeNull();
  expect(screen.getByRole("link", { name: "How it works" })).toBeVisible();
});
