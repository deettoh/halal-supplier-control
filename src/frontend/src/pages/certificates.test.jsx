import React from "react";
import { it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionProvider, useSession } from "../lib/session.jsx";
import { createPreviewGateway } from "../lib/preview/gateway.js";
import { createLiveGateway, ApiError } from "../lib/api/gateway.js";
import data from "../lib/preview/data.json";
import Certificates from "./certificates.jsx";
const identity = { role: "supplier", tenant: "2" };
beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:certificate-test");
  URL.revokeObjectURL = vi.fn();
});
const wrap = (gateway = createPreviewGateway(), who = identity) =>
  render(
    <SessionProvider gateway={gateway} initialIdentity={who}>
      <Certificates />
    </SessionProvider>,
  );
it("submits a JPEG certificate accepted by the current backend", async () => {
  const user = userEvent.setup({ applyAccept: false });
  const base = createPreviewGateway();
  const renewCertificate = vi.fn(async () => {
    throw new ApiError(503, "Unavailable");
  });
  wrap({ ...base, mode: "live", renewCertificate });
  await screen.findByLabelText("Issuer");
  const image = new File(["jpeg"], "certificate.jpg", { type: "image/jpeg" });
  await user.upload(
    screen.getByLabelText("Certificate image (optional)"),
    image,
  );
  await user.click(screen.getByRole("button", { name: "Publish renewal" }));
  await waitFor(() => expect(renewCertificate).toHaveBeenCalled());
  expect(renewCertificate.mock.calls[0][1].image).toBe(image);
});
it("keeps every existing product and brand restriction in the renewal draft", async () => {
  wrap();
  const fields = await screen.findAllByRole("textbox", {
    name: /^Product [0-9]+$/,
  });
  expect(fields).toHaveLength(8);
  expect(fields[0]).toHaveValue("Cocoa Powder");
  expect(
    screen.getByRole("textbox", { name: "Brand restriction 1 (optional)" }),
  ).toHaveValue("SilverCocoa");
  expect(fields[7]).toHaveValue("Spice Mix");
});
it("sends null for an empty brand and preserves failed-save fields and image", async () => {
  const user = userEvent.setup();
  let payload;
  const fetchImpl = vi.fn(async (url, init) => {
    if (init.method === "GET")
      return new Response(JSON.stringify(data.certificates["2"]));
    payload = init.body;
    return new Response(JSON.stringify({ detail: "Contract only" }), {
      status: 501,
    });
  });
  wrap(createLiveGateway({ fetchImpl }));
  await screen.findByRole("textbox", { name: "Product 1" });
  await user.clear(
    screen.getByRole("textbox", { name: "Brand restriction 1 (optional)" }),
  );
  await user.clear(screen.getByLabelText("Expiry date"));
  await user.type(screen.getByLabelText("Expiry date"), "2025-01-01");
  const file = new File(["photo"], "certificate.png", { type: "image/png" });
  await user.upload(
    screen.getByLabelText("Certificate image (optional)"),
    file,
  );
  await user.click(screen.getByRole("button", { name: "Publish renewal" }));
  await screen.findByRole("alert");
  expect(JSON.parse(payload.get("scope"))[0]).toEqual({
    product_name: "Cocoa Powder",
    brand: null,
  });
  expect(payload.get("image")).toBe(file);
  expect(payload.get("expiry_date")).toBe("2025-01-01");
  expect(screen.getByLabelText("Certificate image (optional)").files[0]).toBe(
    file,
  );
  expect(screen.getByRole("textbox", { name: "Product 8" })).toHaveValue(
    "Spice Mix",
  );
});
it("does not publish an empty product scope", async () => {
  const user = userEvent.setup();
  const base = createPreviewGateway();
  const renewCertificate = vi.fn(base.renewCertificate);
  wrap({ ...base, renewCertificate });
  await screen.findByRole("textbox", { name: "Product 1" });
  for (let i = 0; i < 8; i++)
    await user.click(
      screen.getAllByRole("button", { name: /Remove product/ })[0],
    );
  await user.click(screen.getByRole("button", { name: "Publish renewal" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Add at least one product",
  );
  expect(renewCertificate).not.toHaveBeenCalled();
});
it("publishes the prepared renewal and refreshes linked buyers", async () => {
  const user = userEvent.setup();
  const g = createPreviewGateway();
  wrap(g, { role: "supplier", tenant: "1" });
  await screen.findByRole("button", { name: "Use prepared renewal" });
  await user.click(
    screen.getByRole("button", { name: "Use prepared renewal" }),
  );
  await user.click(screen.getByRole("button", { name: "Publish renewal" }));
  await screen.findByText("Renewal saved.");
  for (const tenant of ["Sunrise Bakery SAMPLE", "Crescent Caterer SAMPLE"])
    expect(
      (await g.listMaterials({ role: "staff", tenant }, {})).every(
        (m) => m.coverage_status === "covered",
      ),
    ).toBe(true);
  expect(
    await within(
      screen.getByRole("region", { name: "Current certificate" }),
    ).findByText("SAMPLE-GGS-2027-PREVIEW"),
  ).toBeInTheDocument();
});
function SwitchSupplier() {
  const session = useSession();
  return (
    <button
      onClick={() => session.selectIdentity({ role: "supplier", tenant: "1" })}
    >
      Switch supplier test
    </button>
  );
}
it("ignores an old supplier save after switching identities", async () => {
  const user = userEvent.setup();
  let resolve;
  const g = createPreviewGateway();
  const gateway = {
    ...g,
    mode: "live",
    renewCertificate: () =>
      new Promise((r) => {
        resolve = r;
      }),
  };
  render(
    <SessionProvider gateway={gateway} initialIdentity={identity}>
      <SwitchSupplier />
      <Certificates />
    </SessionProvider>,
  );
  await screen.findByLabelText("Issuer");
  await user.click(screen.getByRole("button", { name: "Publish renewal" }));
  await user.click(
    screen.getByRole("button", { name: "Switch supplier test" }),
  );
  await act(async () => resolve({ ...data.certificates["2"][0], id: 999 }));
  expect(screen.queryByText("Renewal saved.")).not.toBeInTheDocument();
  expect(
    await screen.findByRole("textbox", { name: "Product 10" }),
  ).toHaveValue("Potato Starch");
});
it("blocks publication after replacing a valid image with an unsupported file", async () => {
  const user = userEvent.setup({ applyAccept: false });
  const g = createPreviewGateway();
  const renewCertificate = vi.fn(g.renewCertificate);
  wrap({ ...g, mode: "live", renewCertificate });
  await screen.findByLabelText("Issuer");
  const picker = screen.getByLabelText("Certificate image (optional)");
  await user.upload(
    picker,
    new File(["valid"], "old.png", { type: "image/png" }),
  );
  await user.upload(
    picker,
    new File(["bad"], "wrong.pdf", { type: "application/pdf" }),
  );
  await user.click(screen.getByRole("button", { name: "Publish renewal" }));
  expect(renewCertificate).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toHaveTextContent("PNG");
});
it("retains an editable issuer rather than adding a frontend whitelist", async () => {
  const user = userEvent.setup();
  const g = createPreviewGateway();
  let submitted;
  wrap({
    ...g,
    mode: "live",
    renewCertificate: async (ctx, input) => {
      submitted = input;
      throw new ApiError(501, "Unavailable");
    },
  });
  await screen.findByLabelText("Issuer");
  await user.clear(screen.getByLabelText("Issuer"));
  await user.type(screen.getByLabelText("Issuer"), "Another SAMPLE issuer");
  await user.click(screen.getByRole("button", { name: "Publish renewal" }));
  await waitFor(() => expect(submitted.issuer).toBe("Another SAMPLE issuer"));
});
