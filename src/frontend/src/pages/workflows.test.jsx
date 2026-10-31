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
it("offers a file picker without forcing the camera, alongside a camera input", async () => {
  const user = userEvent.setup();
  wrap(<CheckDelivery />);
  const upload = await screen.findByLabelText("Label photo");
  expect(upload).not.toHaveAttribute("capture");
  const camera = screen.getByLabelText("Take photo");
  expect(camera).toHaveAttribute("capture", "environment");
  expect(upload).toBeDisabled();
  expect(camera).toBeDisabled();
  await materialAndPhoto(user);
  expect(upload).toBeEnabled();
  expect(camera).toBeEnabled();
  const captured = new File(["camera bytes"], "camera.jpg", {
    type: "image/jpeg",
  });
  await user.upload(camera, captured);
  expect(screen.getByText("camera.jpg")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Remove photo" }));
  await user.upload(camera, captured);
  expect(screen.getByText("camera.jpg")).toBeInTheDocument();
});
it.each(["Label photo", "Take photo"])(
  "submits the original JPEG selected through %s without auto-submitting",
  async (source) => {
    const user = userEvent.setup();
    const createDelivery = vi.fn(
      async () =>
        data.cases.find((entry) => entry.id === "covered").responses["6"],
    );
    wrap(<CheckDelivery />, { ...createPreviewGateway(), createDelivery });
    await materialAndPhoto(user);
    const image = new File(["original JPEG bytes"], "existing-label.jpg", {
      type: "image/jpeg",
    });
    await user.upload(screen.getByLabelText(source), image);
    expect(createDelivery).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole("button", { name: "Check delivery", exact: true }),
    );
    await waitFor(() => expect(createDelivery).toHaveBeenCalledOnce());
    expect(createDelivery.mock.calls[0][1]).toEqual({ material_id: 6, image });
    expect(createDelivery.mock.calls[0][1].image).toBe(image);
  },
);
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
it("keeps every check and its reason available behind the mobile evidence control", async () => {
  const user = userEvent.setup();
  const delivery = data.cases.find((entry) => entry.id === "alt-brand")
    .responses["6"];
  wrap(<CheckDelivery />, {
    ...createPreviewGateway(),
    createDelivery: vi.fn(async () => delivery),
  });
  await materialAndPhoto(user);
  await user.click(
    screen.getByRole("button", { name: "Check delivery", exact: true }),
  );
  await screen.findByRole("heading", { name: "Sent for supervisor review" });
  const toggle = screen.getByRole("button", { name: "Photo and six checks" });
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  toggle.focus();
  await user.keyboard("{Enter}");
  expect(toggle).toHaveAttribute("aria-expanded", "true");
  const content = document.getElementById(toggle.getAttribute("aria-controls"));
  for (const rule of delivery.rule_results) {
    const row = within(content).getByTestId("rule-" + rule.rule);
    expect(within(row).getByText(rule.detail)).toBeInTheDocument();
  }
  expect(
    screen.getByRole("button", { name: "Check next delivery" }),
  ).toBeEnabled();
  await user.keyboard("{Enter}");
  expect(toggle).toHaveAttribute("aria-expanded", "false");
});
it("keeps receiving staff out of the supervisor route without a queue request", () => {
  window.history.replaceState(null, "", "/review");
  const base = createPreviewGateway();
  const listPending = vi.fn(base.listPending);
  wrap(<App />, { ...base, listPending }, staff);
  expect(
    screen.getByRole("heading", {
      name: "This workspace can't open that view",
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
      ...data.cases.find((c) => c.id === "partial").responses["6"],
      id: 104,
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
  expect(screen.getByText("No matching materials")).toBeInTheDocument();
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
