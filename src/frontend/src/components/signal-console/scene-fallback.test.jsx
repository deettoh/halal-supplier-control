import React from "react";
import { it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SceneFallback } from "./scene-fallback.jsx";
import { sampleDelivery } from "./panels.jsx";
it("keeps the original evidence and comparisons usable without a GPU", async () => {
  const select = vi.fn();
  render(<SceneFallback selectedField="brand" onSelect={select} />);
  expect(
    screen.getByRole("img", { name: /Fictional SAMPLE flour label/ }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "The checks" }),
  ).toBeInTheDocument();
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: /Product.*Wheat Flour/ }));
  expect(select).toHaveBeenCalledWith("product");
  expect(screen.getByText("R6")).toBeInTheDocument();
  expect(screen.getByText("Substitution")).toBeInTheDocument();
});
it("lets visitors select a check by keyboard and read its prepared rule reason", async () => {
  function InteractiveExample() {
    const [selectedRule, onSelectRule] = React.useState("R2");
    return (
      <SceneFallback selectedRule={selectedRule} onSelectRule={onSelectRule} />
    );
  }
  const user = userEvent.setup();
  render(<InteractiveExample />);
  const expiry = screen.getByRole("button", {
    name: /R4 Certificate expiry Pass/,
  });
  expiry.focus();
  await user.keyboard("{Enter}");
  expect(expiry).toHaveAttribute("aria-pressed", "true");
  expect(
    screen.getByRole("status", { name: "Selected check reason" }),
  ).toHaveTextContent(
    sampleDelivery.rule_results.find((r) => r.rule === "R4").detail,
  );
  await user.click(
    screen.getByRole("button", {
      name: /R2 Product, brand & manufacturer Review/,
    }),
  );
  expect(
    screen.getByRole("status", { name: "Selected check reason" }),
  ).toHaveTextContent("Manufacturer score 50.0 is below 90.");
  expect(expiry).toHaveAttribute("aria-pressed", "false");
});
