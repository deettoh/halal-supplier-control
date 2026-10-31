import React from "react";
import { it, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { SessionProvider } from "../../lib/session.jsx";
import { createPreviewGateway } from "../../lib/preview/gateway.js";
const spies = vi.hoisted(() => ({ unmount: vi.fn() }));
vi.mock("./scene-canvas.jsx", async () => {
  const React = await import("react");
  return {
    default: function FakeRenderer({ active, onStarted, onReady }) {
      React.useEffect(() => {
        onStarted?.();
        onReady();
        return spies.unmount;
      }, [onStarted, onReady]);
      return (
        <div data-testid="renderer" data-active={active}>
          Decorative renderer
        </div>
      );
    },
  };
});
import LandingScene from "./index.jsx";
afterEach(() => vi.unstubAllGlobals());
it("keeps an initialized renderer stable across device motion preference changes", async () => {
  vi.stubGlobal("innerWidth", 1200);
  vi.stubGlobal("WebGL2RenderingContext", class {});
  const preference = new EventTarget();
  preference.matches = false;
  vi.stubGlobal("matchMedia", () => preference);
  render(
    <SessionProvider gateway={createPreviewGateway()} initialIdentity={null}>
      <LandingScene />
    </SessionProvider>,
  );
  await screen.findByTestId("renderer");
  expect(screen.getByTestId("renderer")).toHaveAttribute("data-active", "true");
  act(() => {
    preference.matches = true;
    preference.dispatchEvent(new Event("change"));
  });
  expect(spies.unmount).not.toHaveBeenCalled();
  expect(screen.getByTestId("renderer")).toHaveAttribute(
    "data-active",
    "false",
  );
  expect(screen.getByTestId("renderer").closest("[hidden]")).not.toBeNull();
  expect(screen.getByRole("heading", { name: "The photo" })).toBeVisible();
  act(() => {
    preference.matches = false;
    preference.dispatchEvent(new Event("change"));
  });
  expect(spies.unmount).not.toHaveBeenCalled();
  expect(screen.getByTestId("renderer").closest("[hidden]")).toBeNull();
  expect(screen.getByTestId("renderer")).toHaveAttribute("data-active", "true");
  act(() => {
    window.innerWidth = 390;
    window.dispatchEvent(new Event("resize"));
  });
  expect(screen.getByTestId("renderer")).toHaveAttribute(
    "data-active",
    "false",
  );
  expect(spies.unmount).not.toHaveBeenCalled();
});
