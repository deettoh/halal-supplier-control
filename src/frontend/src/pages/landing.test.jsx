import React from "react";
import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Landing from "./landing.jsx";
import { SessionProvider } from "../lib/session.jsx";
import { createPreviewGateway } from "../lib/preview/gateway.js";

it("lets visitors inspect each evidence sheet without hiding the comparison or leaving the introduction", async () => {
  const user = userEvent.setup();
  window.history.replaceState(null, "", "/");
  render(
    <SessionProvider gateway={createPreviewGateway()} initialIdentity={null}>
      <Landing />
    </SessionProvider>,
  );
  const record = screen.getByRole("button", { name: "Record", exact: true });
  await user.click(record);
  expect(record).toHaveAttribute("aria-pressed", "true");
  expect(record).toHaveFocus();
  expect(
    screen.getByRole("button", { name: "Compare", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  expect(screen.getAllByText("SilverCocoa", { exact: true })[0]).toBeVisible();
  expect(
    screen.getByRole("heading", { name: "Needs supervisor review" }),
  ).toBeVisible();
  await user.tab();
  await user.keyboard("{Enter}");
  expect(
    screen.getByRole("button", { name: "Compare", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText(/Prepared example dated 22 Oct 2026/)).toBeVisible();
  expect(window.location.pathname).toBe("/");
});
it("scrolls the selected phone sheet into view while respecting reduced motion", async () => {
  const user = userEvent.setup();
  const scroll = vi.fn();
  const original = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = scroll;
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  try {
    render(
      <SessionProvider gateway={createPreviewGateway()} initialIdentity={null}>
        <Landing />
      </SessionProvider>,
    );
    await user.click(
      screen.getByRole("button", { name: "Record", exact: true }),
    );
    expect(scroll).toHaveBeenCalledWith({
      behavior: "instant",
      block: "start",
    });
    expect(scroll.mock.instances[0]).toHaveAttribute(
      "aria-labelledby",
      "example-record",
    );
  } finally {
    Element.prototype.scrollIntoView = original;
    vi.unstubAllGlobals();
  }
});
