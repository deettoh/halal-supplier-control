import React from "react";
import { it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RuleChecklist, Comparison } from "./delivery-evidence.jsx";
import { DecisionForm } from "./decision-form.jsx";
import { SessionProvider } from "../lib/session.jsx";
import { createPreviewGateway } from "../lib/preview/gateway.js";
import { person } from "../test/people.js";
it("shows six recorded checks and the visible-mark check without implying authenticity", () => {
  render(
    <RuleChecklist
      rules={["R1", "R2", "R3", "R4", "R5", "R6"].map((rule) => ({
        rule,
        passed: rule === "R6" ? false : true,
        detail: "Recorded detail",
      }))}
    />,
  );
  expect(
    screen.getByRole("heading", { name: /Six checks/ }),
  ).toBeInTheDocument();
  expect(screen.getByText(/Halal mark on label/)).toBeInTheDocument();
});
it("links a server-reported product mismatch as well as brand/manufacturer", () => {
  render(
    <Comparison
      material={{
        name: "Wheat Flour",
        approved_brand: "GoldenMill",
        approved_manufacturer: "Golden Grain Foods",
      }}
      delivery={{
        id: 1,
        extracted: {
          product_name: "Semolina",
          brand: "GoldenMill",
          manufacturer: "Golden Grain Foods",
          halal_mark_present: true,
        },
        rule_results: [
          {
            rule: "R2",
            passed: false,
            detail:
              "Product mismatch: label says Semolina, approved material is Wheat Flour.",
          },
        ],
      }}
    />,
  );
  expect(screen.getByText("Semolina").closest("td")).toHaveClass("mismatch");
});
it("requires the agreed next step for Hold and sends the exact payload", async () => {
  const decide = vi.fn(),
    user = userEvent.setup();
  render(
    <SessionProvider
      gateway={createPreviewGateway()}
      initialIdentity={person(2)}
    >
      <DecisionForm
        delivery={{ id: 1, status: "pending_review" }}
        onDecision={decide}
        canHold
      />
    </SessionProvider>,
  );
  await user.click(screen.getByRole("radio", { name: "Hold delivery" }));
  await user.type(
    screen.getByLabelText("Reason (required)"),
    "Delivered brand differs",
  );
  expect(
    screen.getByRole("button", { name: "Record decision" }),
  ).toBeDisabled();
  await user.selectOptions(
    screen.getByLabelText("Next step (required)"),
    "request_product_details",
  );
  await user.click(screen.getByRole("button", { name: "Record decision" }));
  expect(decide).toHaveBeenCalledWith({
    decision: "hold",
    reason: "Delivered brand differs",
    next_step: "request_product_details",
  });
});
