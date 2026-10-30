import React from "react";
import { it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionProvider } from "../../lib/session.jsx";
import { createPreviewGateway } from "../../lib/preview/gateway.js";
const spies = vi.hoisted(() => ({ unmount: vi.fn() }));
vi.mock("./scene-canvas.jsx", async () => {
  const React = await import("react");
  return {
    default: function FakeRenderer({ onStarted, onReady }) {
      React.useEffect(() => {
        onStarted?.();
        onReady();
        return spies.unmount;
      }, [onStarted, onReady]);
      return <div data-testid="renderer">Decorative renderer</div>;
    },
  };
});
import LandingScene from "./index.jsx";
afterEach(() => vi.unstubAllGlobals());
it("keeps an initialized renderer stable while motion-off uses the complete HTML alternative", async () => {
  vi.stubGlobal("innerWidth", 1200);
  vi.stubGlobal("WebGL2RenderingContext", class {});
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  const user = userEvent.setup();
  render(
    <SessionProvider gateway={createPreviewGateway()} initialIdentity={null}>
      <LandingScene />
    </SessionProvider>,
  );
  await screen.findByTestId("renderer");
  await user.click(
    screen.getByRole("button", { name: "Less motion", exact: true }),
  );
  expect(spies.unmount).not.toHaveBeenCalled();
  expect(screen.getByTestId("renderer").closest("[hidden]")).not.toBeNull();
  expect(screen.getByRole("heading", { name: "The photo" })).toBeVisible();
  await user.click(
    screen.getByRole("button", { name: "Motion off", exact: true }),
  );
  expect(spies.unmount).not.toHaveBeenCalled();
  expect(screen.getByTestId("renderer").closest("[hidden]")).toBeNull();
});
