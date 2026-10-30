import React from "react";
import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Landing from "./landing.jsx";
import { SessionProvider } from "../lib/session.jsx";
import { createPreviewGateway } from "../lib/preview/gateway.js";
function open() {
  window.history.replaceState(null, "", "/");
  return render(
    <SessionProvider gateway={createPreviewGateway()} initialIdentity={null}>
      <Landing />
    </SessionProvider>,
  );
}
it("keeps the evidence readable without WebGL and lets visitors compare each returned label field", async () => {
  const user = userEvent.setup();
  open();
  await user.click(
    screen.getByRole("button", { name: /Product.*Cocoa Powder/ }),
  );
  expect(
    screen.getByRole("button", { name: /Product.*Cocoa Powder/ }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText("Approved product")).toBeVisible();
  expect(screen.getByText(/No live model call/)).toBeVisible();
  await user.click(
    screen.getByRole("button", { name: /Manufacturer.*Silver Valley Foods/ }),
  );
  expect(screen.getByText("Approved manufacturer")).toBeVisible();
  expect(screen.getByRole("heading", { name: "The checks" })).toBeVisible();
  expect(screen.getByText("Halal mark on label")).toBeVisible();
  expect(window.location.pathname).toBe("/");
});
it("keeps all motion-off content available and scrolls stage controls without animation", async () => {
  const user = userEvent.setup(),
    scroll = vi.fn(),
    original = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = scroll;
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  try {
    open();
    await user.click(
      screen.getByRole("button", { name: "Rules", exact: true }),
    );
    expect(scroll).toHaveBeenCalledWith({
      behavior: "instant",
      block: "center",
    });
    expect(scroll.mock.instances.at(-1)).toHaveClass("rules-plane");
    expect(
      screen.getByRole("button", { name: "Play walkthrough" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Preview Hold" }).closest("[inert]"),
    ).toBeNull();
    await user.click(screen.getByRole("button", { name: "Preview Hold" }));
    expect(screen.getByText(/nothing was saved/)).toBeVisible();
  } finally {
    Element.prototype.scrollIntoView = original;
    vi.unstubAllGlobals();
  }
});
it("keeps registry approval illustrative and links entry to the actual workspace picker", async () => {
  const user = userEvent.setup(),
    gateway = createPreviewGateway(),
    decideRenewal = vi.fn();
  render(
    <SessionProvider
      gateway={{ ...gateway, decideRenewal }}
      initialIdentity={null}
    >
      <Landing />
    </SessionProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Preview approval" }));
  expect(screen.getByText("New record is active")).toBeVisible();
  expect(decideRenewal).not.toHaveBeenCalled();
  expect(
    screen.getAllByRole("link", { name: "Enter demo" })[0],
  ).toHaveAttribute("href", "/demo");
});
