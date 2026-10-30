import { person } from "../test/people.js";
import React from "react";
import { it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionProvider } from "../lib/session.jsx";
import { createPreviewGateway } from "../lib/preview/gateway.js";
import { createLiveGateway } from "../lib/api/gateway.js";
import data from "../lib/preview/data.json";
import App from "../App.jsx";
import CheckDelivery from "./check.jsx";
import Masterlist from "./masterlist.jsx";
import Activity from "./activity.jsx";
const staff = person(1);
const supervisor = person(2);
beforeEach(() => {
  window.history.replaceState(null, "", "/");
  URL.createObjectURL = vi.fn(() => "blob:photo-test");
  URL.revokeObjectURL = vi.fn();
});
function wrap(ui, gateway = createPreviewGateway(), identity = staff) {
  return render(
    <SessionProvider gateway={gateway} initialIdentity={identity}>
      {ui}
    </SessionProvider>,
  );
}
async function materialAndPhoto(user) {
  const input = await screen.findByRole("combobox", { name: "Material" });
  await user.click(input);
  await user.type(input, "Cocoa");
  await user.keyboard("{ArrowDown}{Enter}");
  await user.upload(
    screen.getByLabelText("Label photo"),
    new File(["bytes"], "label.png", { type: "image/png" }),
  );
}
it("blocks the previous photo after an unsupported replacement selection", async () => {
  const user = userEvent.setup({ applyAccept: false });
  wrap(<CheckDelivery />);
  await materialAndPhoto(user);
  await user.upload(
    screen.getByLabelText("Label photo"),
    new File(["bad"], "not-a-photo.pdf", { type: "application/pdf" }),
  );
  expect(
    screen.getByRole("button", { name: "Check delivery", exact: true }),
  ).toBeDisabled();
});
it("preserves a prepared JPEG's MIME type and bytes when submitting it", async () => {
  const user = userEvent.setup();
  const bytes = new Uint8Array([255, 216, 255, 217]);
  const createDelivery = vi.fn(async () => data.deliveries[staff.tenant][0]);
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(bytes, {
          headers: { "Content-Type": "image/jpeg" },
        }),
    ),
  );
  try {
    wrap(<CheckDelivery />, { ...createPreviewGateway(), createDelivery });
    const input = await screen.findByRole("combobox", { name: "Material" });
    await user.click(input);
    await user.type(input, "Cocoa");
    await user.keyboard("{ArrowDown}{Enter}");
    await user.click(screen.getByText("Try a prepared label"));
    await user.click(screen.getByRole("button", { name: "Changed brand" }));
    await user.click(
      screen.getByRole("button", { name: "Check delivery", exact: true }),
    );
    await waitFor(() => expect(createDelivery).toHaveBeenCalledOnce());
    const file = createDelivery.mock.calls[0][1].image;
    expect(file.type).toBe("image/jpeg");
    const actual = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(new Uint8Array(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
    expect(actual).toEqual(bytes);
  } finally {
    vi.unstubAllGlobals();
  }
});
it("keeps receiving staff out of the supervisor route without a queue request", () => {
  window.history.replaceState(null, "", "/review");
  const base = createPreviewGateway();
  const listPending = vi.fn(base.listPending);
  wrap(<App />, { ...base, listPending }, staff);
  expect(
    screen.getByRole("heading", {
      name: "This workspace can't open that view.",
    }),
  ).toBeInTheDocument();
  expect(listPending).not.toHaveBeenCalled();
});
it("introduces the product and opens the role picker with Enter demo", async () => {
  const user = userEvent.setup();
  wrap(<App />, createPreviewGateway(), null);
  expect(
    screen.getByRole("heading", { name: /Every delivery.*A clear.*next step/ }),
  ).toBeInTheDocument();
  await user.click(screen.getAllByRole("link", { name: "Enter demo" })[0]);
  expect(
    await screen.findByRole("group", { name: "Choose a demo person" }),
  ).toBeInTheDocument();
});
it("submits the original photo and treats saved extraction failure as a saved review", async () => {
  const user = userEvent.setup();
  let submitted;
  const fetchImpl = vi.fn(async (url, init) => {
    if (init.method === "GET")
      return new Response(JSON.stringify(data.materials["00"][staff.tenant]));
    submitted = init.body.get("image");
    const saved = {
      ...data.deliveries[staff.tenant][1],
      extracted: null,
      error: "The label could not be read.",
    };
    return new Response(JSON.stringify(saved), { status: 201 });
  });
  wrap(<CheckDelivery />, createLiveGateway({ fetchImpl }));
  await materialAndPhoto(user);
  await user.click(
    screen.getByRole("button", { name: "Check delivery", exact: true }),
  );
  await screen.findByRole("heading", { name: "Sent for supervisor review" });
  expect(screen.getByText("Delivery #104")).toBeInTheDocument();
  expect(submitted.name).toBe("label.png");
  expect(screen.getAllByText("Not read").length).toBeGreaterThan(0);
  expect(screen.getAllByText("Not evaluated")).toHaveLength(3);
});
it("shows a real 501 and retains the draft without a preview success", async () => {
  const user = userEvent.setup();
  const fetchImpl = vi.fn(
    async (url, init) =>
      new Response(
        JSON.stringify(
          init.method === "GET"
            ? data.materials["00"][staff.tenant]
            : { detail: "Contract only" },
        ),
        { status: init.method === "GET" ? 200 : 501 },
      ),
  );
  wrap(<CheckDelivery />, createLiveGateway({ fetchImpl }));
  await materialAndPhoto(user);
  await user.click(
    screen.getByRole("button", { name: "Check delivery", exact: true }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "This action isn't available",
  );
  expect(screen.getByText("label.png")).toBeInTheDocument();
  expect(
    screen.queryByRole("heading", { name: "Sent for supervisor review" }),
  ).not.toBeInTheDocument();
});
it("filters only authorised materials and can clear a no-match search", async () => {
  const user = userEvent.setup();
  wrap(<Masterlist />);
  await within(
    await screen.findByRole("table", { name: "Approved materials" }),
  ).findByText("Wheat Flour");
  await user.type(
    screen.getByRole("searchbox", { name: "Search materials" }),
    "does not exist",
  );
  expect(screen.getByText("No matching materials.")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Clear search" }));
  expect(
    within(screen.getByRole("table", { name: "Approved materials" })).getByText(
      "Wheat Flour",
    ),
  ).toBeInTheDocument();
  expect(screen.queryByText("Vegetable Oil")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: /Covered.*3/ }));
  const table = screen.getByRole("table", { name: "Approved materials" });
  expect(within(table).queryByText("Wheat Flour")).not.toBeInTheDocument();
});
it("renders canonical activity actor, action and reason after a decision", async () => {
  const g = createPreviewGateway();
  await g.decide(supervisor, 102, {
    decision: "reject",
    reason: "Return the changed brand.",
  });
  wrap(<Activity />, g, supervisor);
  await screen.findByText("Return the changed brand.");
  expect(screen.getByText("Farid")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Rejected" })).toBeInTheDocument();
});
