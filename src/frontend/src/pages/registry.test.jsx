import React from "react";
import { it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionProvider } from "../lib/session.jsx";
import {
  createPreviewGateway,
  preparedRenewal,
} from "../lib/preview/gateway.js";
import { person } from "../test/people.js";
import Registry from "./registry.jsx";
it("requires a note before a reviewer can activate the submitted renewal", async () => {
  const g = createPreviewGateway();
  await g.renewCertificate(person(5), preparedRenewal("1"));
  const user = userEvent.setup();
  render(
    <SessionProvider gateway={g} initialIdentity={person(7)}>
      <Registry />
    </SessionProvider>,
  );
  expect(
    await screen.findByRole("button", { name: "Verify renewal" }),
  ).toBeDisabled();
  await user.type(
    screen.getByLabelText("Review note (required)"),
    "Compared the submitted document with the registry",
  );
  await user.click(screen.getByRole("button", { name: "Verify renewal" }));
  expect(
    await screen.findByRole("heading", { name: "Renewal verified." }),
  ).toBeInTheDocument();
  expect(
    (await g.listCertificates(person(5))).filter((c) => c.status === "active"),
  ).toHaveLength(1);
});
it("treats zero new expiry requests as a valid repeated result", async () => {
  const g = createPreviewGateway(),
    user = userEvent.setup();
  render(
    <SessionProvider gateway={g} initialIdentity={person(7)}>
      <Registry />
    </SessionProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Run expiry check" }));
  expect(
    await screen.findByText(/1 renewal request recorded/),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Run expiry check" }));
  expect(
    await screen.findByText(/0 renewal requests recorded/),
  ).toBeInTheDocument();
});

it("refetches a conflicted queue while preserving the selected evidence and note for inspection", async () => {
  const base = createPreviewGateway();
  const renewal = await base.renewCertificate(person(5), preparedRenewal("1"));
  let resolved = false;
  const listRenewals = vi.fn((...args) =>
    resolved ? Promise.resolve([]) : base.listRenewals(...args),
  );
  const decideRenewal = vi.fn(async () => {
    resolved = true;
    throw Object.assign(new Error("Already reviewed"), { status: 409 });
  });
  const user = userEvent.setup();
  render(
    <SessionProvider
      gateway={{ ...base, listRenewals, decideRenewal }}
      initialIdentity={person(7)}
    >
      <Registry />
    </SessionProvider>,
  );
  await user.type(
    await screen.findByLabelText("Review note (required)"),
    "Keep this review note.",
  );
  await user.click(screen.getByRole("button", { name: "Verify renewal" }));
  await screen.findByRole("alert");
  expect(listRenewals.mock.calls.length).toBeGreaterThan(1);
  expect(screen.getByLabelText("Review note (required)")).toHaveValue(
    "Keep this review note.",
  );
  expect(screen.getByRole("button", { name: "Verify renewal" })).toBeDisabled();
  expect(screen.getByText(renewal.cert_no)).toBeInTheDocument();
  expect(
    screen.queryByRole("heading", { name: "Renewal verified." }),
  ).not.toBeInTheDocument();
});
