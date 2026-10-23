import React from "react";
import { it, expect, vi } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionProvider } from "./session.jsx";
import { createPreviewGateway } from "./preview/gateway.js";
import App from "../App.jsx";

it("allows cancelling browser Back without losing the supplier draft, then permits confirmed Back and Forward", async () => {
  window.history.replaceState(null, "", "/demo");
  const user = userEvent.setup();
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  render(
    <SessionProvider
      gateway={createPreviewGateway()}
      initialIdentity={{ role: "supplier", tenant: "2" }}
    >
      <App />
    </SessionProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Enter workspace" }));
  const issuer = await screen.findByLabelText("Issuer");
  const originalIssuer = issuer.value;
  await user.clear(issuer);
  await user.type(issuer, "UNSAVED SAMPLE ISSUER");
  await act(async () => window.history.back());
  await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(window.location.pathname).toBe("/certificates"));
  expect(screen.getByLabelText("Issuer")).toHaveValue("UNSAVED SAMPLE ISSUER");
  confirm.mockReturnValue(true);
  await act(async () => window.history.back());
  await screen.findByRole("group", { name: "Choose your role" });
  expect(confirm).toHaveBeenCalledTimes(2);
  await act(async () => window.history.forward());
  expect(await screen.findByLabelText("Issuer")).toHaveValue(originalIssuer);
  await user.click(screen.getByRole("link", { name: "Switch workspace" }));
  await screen.findByRole("group", { name: "Choose your role" });
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
  await screen.findByRole("group", { name: "Choose your role" });
  expect(confirm).toHaveBeenCalledTimes(4);
  confirm.mockRestore();
});
