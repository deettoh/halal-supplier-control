import { person } from "../test/people.js";
import React from "react";
import { it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionProvider } from "./session.jsx";
import { createPreviewGateway } from "./preview/gateway.js";
import App from "../App.jsx";
import { AppLink } from "./navigation.jsx";

afterEach(() => vi.restoreAllMocks());

it("allows cancelling browser Back without losing the supplier draft, then permits confirmed Back and Forward", async () => {
  window.history.replaceState(null, "", "/demo");
  const user = userEvent.setup();
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  render(
    <SessionProvider
      gateway={createPreviewGateway()}
      initialIdentity={person(6)}
    >
      <App />
    </SessionProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Enter workspace" }));
  const issuer = await screen.findByLabelText("Issuer", {}, { timeout: 5000 });
  const originalIssuer = issuer.value;
  await user.clear(issuer);
  await user.type(issuer, "UNSAVED SAMPLE ISSUER");
  await act(async () => window.history.back());
  await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(window.location.pathname).toBe("/certificates"));
  expect(screen.getByLabelText("Issuer")).toHaveValue("UNSAVED SAMPLE ISSUER");
  confirm.mockReturnValue(true);
  await act(async () => window.history.back());
  await screen.findByRole("group", { name: "Choose a demo person" });
  expect(confirm).toHaveBeenCalledTimes(2);
  await act(async () => window.history.forward());
  expect(await screen.findByLabelText("Issuer")).toHaveValue(originalIssuer);
  await user.click(screen.getByRole("link", { name: "Switch workspace" }));
  await screen.findByRole("group", { name: "Choose a demo person" });
  await act(async () => window.history.back());
  const restored = await screen.findByLabelText("Issuer");
  await user.clear(restored);
  await user.type(restored, "KEEP THIS FORWARD DRAFT");
  confirm.mockReturnValue(false);
  await act(async () => window.history.forward());
  await waitFor(() => expect(confirm).toHaveBeenCalledTimes(3));
  await waitFor(() => expect(window.location.pathname).toBe("/certificates"));
  expect(screen.getByLabelText("Issuer")).toHaveValue(
    "KEEP THIS FORWARD DRAFT",
  );
  confirm.mockReturnValue(true);
  await act(async () => window.history.forward());
  await screen.findByRole("group", { name: "Choose a demo person" });
  expect(confirm).toHaveBeenCalledTimes(4);
  confirm.mockRestore();
  // This integration test includes lazy routes, typing and five real traversals.
}, 10000);

it("commits an ordinary internal link inside the browser snapshot update", async () => {
  window.history.replaceState(null, "", "/");
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  let commit;
  document.startViewTransition = (update) => {
    commit = update;
    return {
      ready: Promise.resolve(),
      finished: Promise.resolve(),
      updateCallbackDone: Promise.resolve(),
    };
  };
  try {
    const user = userEvent.setup();
    render(
      <SessionProvider gateway={createPreviewGateway()} initialIdentity={null}>
        <App />
      </SessionProvider>,
    );
    await user.click(screen.getAllByRole("link", { name: "Enter demo" })[0]);
    expect(window.location.pathname).toBe("/");
    await act(async () => commit());
    expect(window.location.pathname).toBe("/demo");
    expect(
      screen.getByRole("group", { name: "Choose a demo person" }),
    ).toBeVisible();
  } finally {
    delete document.startViewTransition;
    vi.unstubAllGlobals();
  }
});

it("preserves a caller's cancelled link without moving to another route", async () => {
  window.history.replaceState(null, "", "/demo");
  render(
    <SessionProvider gateway={createPreviewGateway()} initialIdentity={null}>
      <AppLink href="/check" onClick={(event) => event.preventDefault()}>
        Stay here
      </AppLink>
    </SessionProvider>,
  );
  await userEvent
    .setup()
    .click(screen.getByRole("link", { name: "Stay here" }));
  expect(window.location.pathname).toBe("/demo");
});

it("keeps Home when it is clicked after a pending Enter demo transition", async () => {
  window.history.replaceState(null, "", "/");
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  const commits = [];
  document.startViewTransition = (update) => {
    commits.push(update);
    return { ready: Promise.resolve(), finished: Promise.resolve() };
  };
  try {
    const user = userEvent.setup();
    render(
      <SessionProvider gateway={createPreviewGateway()} initialIdentity={null}>
        <App />
      </SessionProvider>,
    );
    await user.click(screen.getAllByRole("link", { name: "Enter demo" })[0]);
    await user.click(screen.getByRole("link", { name: "Loupe", exact: true }));
    await act(async () => {
      for (const commit of commits) commit();
    });
    expect(window.location.pathname).toBe("/");
    expect(
      screen.getByRole("heading", {
        name: /Every delivery.*A clear.*next step/,
      }),
    ).toBeVisible();
  } finally {
    delete document.startViewTransition;
    vi.unstubAllGlobals();
  }
});

it("preserves accepted browser Back when an older snapshot callback arrives afterwards", async () => {
  window.history.replaceState(null, "", "/masterlist");
  window.history.pushState(null, "", "/demo");
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  let commit;
  document.startViewTransition = (update) => {
    commit = update;
    return { ready: Promise.resolve(), finished: Promise.resolve() };
  };
  try {
    render(
      <SessionProvider gateway={createPreviewGateway()} initialIdentity={null}>
        <App />
      </SessionProvider>,
    );
    await userEvent
      .setup()
      .click(screen.getByRole("link", { name: "Back to introduction" }));
    await act(async () => window.history.back());
    await waitFor(() => expect(window.location.pathname).toBe("/masterlist"));
    await act(async () => commit());
    expect(window.location.pathname).toBe("/masterlist");
  } finally {
    delete document.startViewTransition;
    vi.unstubAllGlobals();
  }
});
