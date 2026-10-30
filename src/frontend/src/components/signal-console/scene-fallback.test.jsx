import React from "react";
import { it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SceneFallback } from "./scene-fallback.jsx";
it("keeps the original evidence and comparisons usable without a GPU", async () => {
  const select = vi.fn();
  render(<SceneFallback selectedField="brand" onSelect={select} />);
  expect(
    screen.getByRole("img", { name: /Fictional SAMPLE cocoa label/ }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "The checks" }),
  ).toBeInTheDocument();
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: /Product.*Cocoa Powder/ }));
  expect(select).toHaveBeenCalledWith("product");
  expect(screen.getByText("R6")).toBeInTheDocument();
});
