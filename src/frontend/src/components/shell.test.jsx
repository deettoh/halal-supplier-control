import React from "react";
import { it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SessionProvider } from "../lib/session.jsx";
import { createPreviewGateway } from "../lib/preview/gateway.js";
import { person } from "../test/people.js";
import { Shell } from "./shell.jsx";
it("gives a named reviewer only the registry workspace navigation", () => {
  render(
    <SessionProvider
      gateway={createPreviewGateway()}
      initialIdentity={person(7)}
    >
      <Shell>
        <h1>Review renewals</h1>
      </Shell>
    </SessionProvider>,
  );
  expect(
    screen.getByRole("link", { name: /Registry renewals/ }),
  ).toHaveAttribute("href", "/registry");
  expect(screen.getByText(/Nadia/)).toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: /Check delivery/ }),
  ).not.toBeInTheDocument();
});
