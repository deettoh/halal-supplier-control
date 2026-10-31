import { person } from "../test/people.js";
import React from "react";
import { it, expect, vi } from "vitest";
import { render, screen, waitFor, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionProvider } from "../lib/session.jsx";
import { createPreviewGateway } from "../lib/preview/gateway.js";
import { DecisionForm } from "./decision-form.jsx";
import { Comparison, RuleChecklist } from "./delivery-evidence.jsx";
import Review from "../pages/review.jsx";
import data from "../lib/preview/data.json";
const identity = person(2);
it("explains an actually empty organisation queue without asking for a nonexistent delivery", async () => {
  render(
    <SessionProvider
      gateway={createPreviewGateway()}
      initialIdentity={person(4)}
    >
      <Review />
    </SessionProvider>,
  );
  expect(
    await screen.findByRole("heading", { name: "Nothing waiting for review" }),
  ).toBeVisible();
  expect(
    screen.getByText(/New flagged deliveries for Crescent Caterer SAMPLE/),
  ).toBeVisible();
  expect(
    screen.queryByText(
      "Select a delivery to inspect its photo and document checks.",
    ),
  ).not.toBeInTheDocument();
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "On hold", exact: true }));
  expect(
    await screen.findByRole("heading", { name: "No held deliveries" }),
  ).toBeVisible();
  expect(
    screen.getByText(
      "Deliveries appear here when a supervisor places them on hold.",
    ),
  ).toBeVisible();
});
it("links the selected comparison field using touch-equivalent clicks and keyboard activation", async () => {
  const user = userEvent.setup();
  const delivery = data.deliveries[identity.tenant][0];
  render(
    <Comparison
      material={{
        name: "Cocoa Powder",
        approved_brand: "SilverCocoa",
        approved_manufacturer: "Silver Valley Foods",
      }}
      delivery={delivery}
    />,
  );
  const brand = screen.getByRole("button", { name: "Brand", exact: true });
  await user.click(brand);
  expect(brand).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText("SilverCocoa")).toBeVisible();
  expect(screen.getByText("ALT SAMPLE BRAND")).toBeVisible();
  await user.tab();
  await user.keyboard("{Enter}");
  expect(
    screen.getByRole("button", { name: "Manufacturer", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(brand).toHaveAttribute("aria-pressed", "false");
  await user.keyboard("{Enter}");
  expect(
    screen.getByRole("button", { name: "Manufacturer", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
});
it.each(["saved", "conflict"])(
  "keeps the current decision locked until its %s response arrives",
  async (outcome) => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    const base = createPreviewGateway();
    let release;
    wrap(<Review />, {
      ...base,
      decide: (ctx, id, input) =>
        new Promise((resolve, reject) => {
          release = async () =>
            outcome === "conflict"
              ? reject(
                  Object.assign(new Error("Already resolved"), { status: 409 }),
                )
              : resolve(await base.decide(ctx, id, input));
        }),
    });
    await screen.findByRole("heading", {
      name: "Cocoa Powder · Delivery #102",
    });
    await user.click(screen.getByLabelText("Reject delivery"));
    await user.type(
      screen.getByLabelText("Reason (required)"),
      "Return changed brand.",
    );
    await user.click(screen.getByRole("button", { name: "Record decision" }));
    const other = screen.getByRole("button", {
      name: /#104.*Pending review.*Cocoa Powder.*Needs review/,
    });
    await user.click(other);
    expect(
      screen.getByRole("heading", { name: "Cocoa Powder · Delivery #102" }),
    ).toBeInTheDocument();
    expect(other).toBeDisabled();
    await act(async () => release());
    if (outcome === "saved") await screen.findByText("Decision recorded");
    else await screen.findByRole("alert");
    await user.click(
      screen.getByRole("button", {
        name: /#104.*Pending review.*Cocoa Powder.*Needs review/,
      }),
    );
    expect(
      screen.getByRole("heading", { name: "Cocoa Powder · Delivery #104" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Reason (required)")).toHaveValue("");
    expect(
      within(
        screen.getByRole("region", { name: "Record a decision" }),
      ).queryByRole("alert"),
    ).not.toBeInTheDocument();
  },
);
it("describes automatic acceptance without inventing a supervisor rejection", () => {
  wrap(
    <DecisionForm
      delivery={{
        id: 500,
        status: "auto_accepted",
        decided_by: null,
        reason: null,
      }}
    />,
  );
  expect(screen.getByText("Automatically accepted")).toBeInTheDocument();
  expect(screen.queryByText(/Rejected by/)).not.toBeInTheDocument();
  expect(screen.queryByText("Decision recorded")).not.toBeInTheDocument();
});
it("does not describe a manufacturer mismatch as a changed brand", async () => {
  const base = createPreviewGateway();
  const original = data.deliveries[identity.tenant][0];
  const row = {
    ...original,
    extracted: {
      ...original.extracted,
      brand: "SilverCocoa",
      manufacturer: "Different SAMPLE Foods",
    },
    rule_results: original.rule_results.map((r) =>
      r.rule === "R2"
        ? { ...r, detail: "Manufacturer score 42.0 is below 90." }
        : r.rule === "R3"
          ? {
              ...r,
              passed: true,
              detail: "Product and brand restriction match certificate scope.",
            }
          : r,
    ),
  };
  wrap(<Review />, { ...base, listPending: async () => [row] });
  await screen.findByRole("heading", { name: "Cocoa Powder · Delivery #102" });
  expect(
    screen.getAllByText("Manufacturer score 42.0 is below 90.")[0],
  ).toBeInTheDocument();
  expect(screen.queryByText("Brand differs")).not.toBeInTheDocument();
});
const wrap = (children, gateway = createPreviewGateway()) =>
  render(
    <SessionProvider gateway={gateway} initialIdentity={identity}>
      {children}
    </SessionProvider>,
  );
it("starts with no decision and requires a nonblank reason for either choice", async () => {
  const onDecision = vi.fn();
  const user = userEvent.setup();
  wrap(
    <DecisionForm
      delivery={{ id: 102, status: "pending_review" }}
      onDecision={onDecision}
    />,
  );
  expect(screen.getByLabelText("Accept delivery")).not.toBeChecked();
  expect(
    screen.getByRole("button", { name: "Record decision" }),
  ).toBeDisabled();
  await user.click(screen.getByLabelText("Reject delivery"));
  await user.type(screen.getByLabelText("Reason (required)"), "   ");
  expect(
    screen.getByRole("button", { name: "Record decision" }),
  ).toBeDisabled();
  await user.type(screen.getByLabelText("Reason (required)"), "Changed brand.");
  await user.click(screen.getByRole("button", { name: "Record decision" }));
  expect(onDecision).toHaveBeenCalledWith({
    decision: "reject",
    reason: "Changed brand.",
  });
});
it("keeps unchecked rules distinct from a failed rule", () => {
  wrap(
    <RuleChecklist
      rules={[
        { rule: "R1", passed: false, detail: "Cannot read manufacturer." },
        { rule: "R2", passed: null, detail: "Incomplete label." },
      ]}
    />,
  );
  expect(
    within(screen.getByTestId("rule-R1")).getByText("Failed"),
  ).toBeInTheDocument();
  expect(
    within(screen.getByTestId("rule-R2")).getByText("Not evaluated"),
  ).toBeInTheDocument();
});
it("records actual supervisor result without changing the coverage verdict", async () => {
  const user = userEvent.setup();
  wrap(<Review />);
  await screen.findByRole("heading", { name: "Cocoa Powder · Delivery #102" });
  await user.click(screen.getByLabelText("Reject delivery"));
  await user.type(
    screen.getByLabelText("Reason (required)"),
    "Return changed brand to supplier.",
  );
  await user.click(screen.getByRole("button", { name: "Record decision" }));
  await screen.findByText("Decision recorded");
  expect(screen.getAllByText("Substitution").length).toBeGreaterThan(0);
  expect(
    screen.getByText("Return changed brand to supplier."),
  ).toBeInTheDocument();
});
it("refetches the queue and blocks stale decisions after 409", async () => {
  const user = userEvent.setup();
  const base = createPreviewGateway();
  const listPending = vi.fn(base.listPending);
  const gateway = {
    ...base,
    listPending,
    decide: async () => {
      throw Object.assign(new Error("Already resolved"), { status: 409 });
    },
  };
  wrap(<Review />, gateway);
  await screen.findByRole("heading", { name: "Cocoa Powder · Delivery #102" });
  await user.click(screen.getByLabelText("Accept delivery"));
  await user.type(screen.getByLabelText("Reason (required)"), "Inspected.");
  await user.click(screen.getByRole("button", { name: "Record decision" }));
  await screen.findByRole("alert");
  await waitFor(() => expect(listPending.mock.calls.length).toBeGreaterThan(1));
  expect(
    screen.getByRole("button", { name: "Record decision" }),
  ).toBeDisabled();
  expect(screen.queryByText("Decision recorded")).not.toBeInTheDocument();
});
it("keeps a conflict visible when the resolved row leaves the queue and clears it on refresh", async () => {
  const user = userEvent.setup();
  const base = createPreviewGateway();
  let resolved = false;
  wrap(<Review />, {
    ...base,
    listPending: async (ctx, options) =>
      resolved ? [] : base.listPending(ctx, options),
    decide: async () => {
      resolved = true;
      throw Object.assign(
        new Error("Another supervisor resolved this delivery."),
        { status: 409 },
      );
    },
  });
  await screen.findByRole("heading", { name: "Cocoa Powder · Delivery #102" });
  await user.click(screen.getByLabelText("Accept delivery"));
  await user.type(screen.getByLabelText("Reason (required)"), "Inspected.");
  await user.click(screen.getByRole("button", { name: "Record decision" }));
  await waitFor(() =>
    expect(
      screen.getByRole("heading", { name: "Pending deliveries (0)" }),
    ).toBeInTheDocument(),
  );
  expect(
    screen.getByRole("heading", { name: "Cocoa Powder · Delivery #102" }),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("Reason (required)")).toHaveValue("Inspected.");
  expect(
    screen.getByRole("button", { name: "Record decision" }),
  ).toBeDisabled();
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Another supervisor resolved this delivery.",
  );
  vi.spyOn(window, "confirm").mockReturnValue(true);
  await user.click(screen.getByRole("button", { name: "Refresh queue" }));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("connects Hold through the workbench and only offers accept or reject afterwards", async () => {
  const user = userEvent.setup(),
    g = createPreviewGateway();
  wrap(<Review />, g);
  await user.click(await screen.findByLabelText("Hold delivery"));
  await user.type(
    screen.getByLabelText("Reason (required)"),
    "Request the replacement certificate.",
  );
  await user.selectOptions(
    screen.getByLabelText("Next step (required)"),
    "request_certificate",
  );
  await user.click(screen.getByRole("button", { name: "Record decision" }));
  await screen.findByText(
    /Previous reason: Request the replacement certificate/,
  );
  expect(screen.queryByLabelText("Hold delivery")).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Record decision" }),
  ).toBeDisabled();
  expect((await g.listOnHold(identity))[0].next_step).toBe(
    "request_certificate",
  );
});
