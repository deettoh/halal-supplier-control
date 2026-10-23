import React from "react";
import { it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  SessionProvider,
  useSession,
  validateIdentity,
  homeForRole,
  workspaceKey,
} from "./session.jsx";
import { useScopedMutation } from "./api/hooks.js";
const first = { role: "supervisor", tenant: "Sunrise Bakery SAMPLE" };
const second = { role: "supervisor", tenant: "Crescent Caterer SAMPLE" };
it("rejects malformed or incompatible stored identities", () => {
  expect(
    validateIdentity({ role: "supplier", tenant: "Sunrise Bakery SAMPLE" }),
  ).toBe(null);
  expect(validateIdentity({ role: "admin", tenant: "1" })).toBe(null);
  expect(validateIdentity(first)).toEqual(first);
});
it("uses role-specific homes and mode/role/tenant query identity", () => {
  expect(homeForRole("staff")).toBe("/check");
  expect(homeForRole("supplier")).toBe("/certificates");
  expect(homeForRole("supervisor")).toBe("/review");
  expect(workspaceKey("preview", first)).not.toEqual(
    workspaceKey("live", first),
  );
  expect(workspaceKey("live", first)).not.toEqual(workspaceKey("live", second));
});
function Probe({ request }) {
  const session = useSession();
  const mutation = useScopedMutation((ctx) => request(ctx));
  return (
    <>
      <p>{session.identity.tenant}</p>
      <button onClick={() => mutation.mutate({})}>Save record</button>
      <button onClick={() => session.selectIdentity(second)}>
        Switch test workspace
      </button>
      {mutation.data && <p role="status">{mutation.data.reason}</p>}
    </>
  );
}
it("does not expose a late mutation result after switching workspace", async () => {
  let resolve;
  const request = vi.fn(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const user = userEvent.setup();
  render(
    <SessionProvider gateway={{ mode: "live" }} initialIdentity={first}>
      <Probe request={request} />
    </SessionProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Save record" }));
  await user.click(
    screen.getByRole("button", { name: "Switch test workspace" }),
  );
  await act(async () => resolve({ reason: "OLD WORKSPACE RESULT" }));
  expect(screen.getByText("Crescent Caterer SAMPLE")).toBeInTheDocument();
  expect(screen.queryByText("OLD WORKSPACE RESULT")).not.toBeInTheDocument();
  expect(request.mock.calls[0][0]).toEqual(first);
});
