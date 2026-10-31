import React from "react";
import { it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionProvider } from "../lib/session.jsx";
import { createPreviewGateway } from "../lib/preview/gateway.js";
import { person } from "../test/people.js";
import Certificates from "./certificates.jsx";
it("submits for review without announcing that the new record is active", async () => {
  const g = createPreviewGateway(),
    user = userEvent.setup();
  render(
    <SessionProvider gateway={g} initialIdentity={person(5)}>
      <Certificates />
    </SessionProvider>,
  );
  await user.click(
    await screen.findByRole("button", { name: "Use prepared renewal" }),
  );
  await user.click(
    screen.getByRole("button", { name: "Submit renewal for review" }),
  );
  expect(
    await screen.findByRole("heading", { name: "Renewal submitted" }),
  ).toBeInTheDocument();
  const records = await g.listCertificates(person(5));
  expect(records.find((c) => c.id === 1).status).toBe("active");
  expect(records.filter((c) => c.status === "pending")).toHaveLength(1);
  expect(
    screen.queryByText(/The new record is active/),
  ).not.toBeInTheDocument();
});
