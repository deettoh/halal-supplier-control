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
import { person, people } from "../test/people.js";
const first = person(2),
  second = person(4);
it("rejects legacy identities and person/tenant mismatches", () => {
  expect(
    validateIdentity({ role: "supervisor", tenant: first.tenant }, people),
  ).toBe(null);
  expect(validateIdentity({ ...first, tenant: second.tenant }, people)).toBe(
    null,
  );
  expect(validateIdentity(first, people)).toEqual(first);
  expect(validateIdentity(person(7), people)).toEqual(person(7));
});
it("adds the reviewer home and includes person in query identity", () => {
  expect(homeForRole("reviewer")).toBe("/registry");
  expect(workspaceKey("preview", first)).not.toEqual(
    workspaceKey("live", first),
  );
  expect(workspaceKey("live", first)).not.toEqual(
    workspaceKey("live", { ...first, person_id: 99 }),
  );
});
function Probe({ request, onError }) {
  const session = useSession(),
    mutation = useScopedMutation((ctx) => request(ctx), { onError });
  return (
    <>
      <p>{session.identity?.tenant || "Loading identity"}</p>
      <button onClick={() => mutation.mutate({})}>Save record</button>
      <button onClick={() => session.selectIdentity(second)}>
        Switch test workspace
      </button>
      {mutation.data && <p role="status">{mutation.data.reason}</p>}
    </>
  );
}
it.each([false, true])(
  "ignores late mutation success/error after a workspace switch (error=%s)",
  async (fails) => {
    let finish;
    const request = vi.fn(
      () =>
        new Promise((resolve, reject) => {
          finish = fails ? reject : resolve;
        }),
    );
    const onError = vi.fn(),
      user = userEvent.setup();
    render(
      <SessionProvider
        gateway={{ mode: "live", listPeople: async () => people }}
        initialIdentity={first}
      >
        <Probe request={request} onError={onError} />
      </SessionProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Save record" }));
    await user.click(
      screen.getByRole("button", { name: "Switch test workspace" }),
    );
    await act(async () =>
      finish(
        fails ? new Error("OLD ERROR") : { reason: "OLD WORKSPACE RESULT" },
      ),
    );
    expect(screen.getByText(second.tenant)).toBeInTheDocument();
    expect(screen.queryByText("OLD WORKSPACE RESULT")).not.toBeInTheDocument();
    expect(onError).not.toHaveBeenCalled();
    expect(request.mock.calls[0][0]).toEqual(first);
  },
);
