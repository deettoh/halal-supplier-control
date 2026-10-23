import React from "react";
import { it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionProvider } from "../lib/session.jsx";
import DemoEntry from "./demo-entry.jsx";
import { createPreviewGateway } from "../lib/preview/gateway.js";
it("resets prepared decisions only through the explicit preview control", async () => {
  const user = userEvent.setup();
  const gateway = createPreviewGateway();
  const context = { role: "supervisor", tenant: "Sunrise Bakery SAMPLE" };
  await gateway.decide(context, 102, {
    decision: "reject",
    reason: "Inspect this example.",
  });
  render(
    <SessionProvider gateway={gateway} initialIdentity={null}>
      <DemoEntry />
    </SessionProvider>,
  );
  await user.click(
    screen.getByRole("button", { name: "Reset prepared examples" }),
  );
  expect(
    await screen.findByText("Prepared examples reset."),
  ).toBeInTheDocument();
  expect(await gateway.listPending(context, {})).toHaveLength(2);
});
it("requires an explicit compatible role and organisation", async () => {
  const user = userEvent.setup();
  render(
    <SessionProvider gateway={{ mode: "preview" }} initialIdentity={null}>
      <DemoEntry />
    </SessionProvider>,
  );
  expect(
    screen.getByRole("button", { name: "Enter workspace" }),
  ).toBeDisabled();
  await user.click(screen.getByRole("radio", { name: /Halal supervisor/ }));
  await user.selectOptions(
    screen.getByLabelText("Organisation"),
    "Sunrise Bakery SAMPLE",
  );
  expect(screen.getByRole("button", { name: "Enter workspace" })).toBeEnabled();
  await user.click(screen.getByRole("radio", { name: /Supplier/ }));
  expect(
    screen.getByRole("button", { name: "Enter workspace" }),
  ).toBeDisabled();
  expect(
    screen.queryByRole("option", { name: "Sunrise Bakery SAMPLE" }),
  ).not.toBeInTheDocument();
});
