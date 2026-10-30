import { person } from "../test/people.js";
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
  const context = person(2);
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
it("requires an explicit named person whose role and organisation stay together", async () => {
  const user = userEvent.setup();
  render(
    <SessionProvider gateway={createPreviewGateway()} initialIdentity={null}>
      <DemoEntry />
    </SessionProvider>,
  );
  expect(
    screen.getByRole("button", { name: "Enter workspace" }),
  ).toBeDisabled();
  await user.click(await screen.findByRole("radio", { name: /Farid/ }));
  expect(screen.getByRole("button", { name: "Enter workspace" })).toBeEnabled();
  expect(screen.getAllByRole("radio")).toHaveLength(7);
  expect(screen.queryByLabelText("Organisation")).not.toBeInTheDocument();
});
