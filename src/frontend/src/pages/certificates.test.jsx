import { person } from "../test/people.js";
import React from "react";
import { it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionProvider, useSession } from "../lib/session.jsx";
import { createPreviewGateway } from "../lib/preview/gateway.js";
import { createLiveGateway, ApiError } from "../lib/api/gateway.js";
import data from "../lib/preview/data.json";
import Certificates from "./certificates.jsx";
const identity = person(6);
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

const urgentHeading = { name: "1 certificate needs renewing" };
async function requestedGateway(overrides = {}) {
  const g = createPreviewGateway();
  await g.runExpiryCheck(person(7));
  return { ...g, ...overrides };
}
async function submitPrepared(user) {
  await user.click(
    await screen.findByRole("button", { name: "Use prepared renewal" }),
  );
  await user.click(
    screen.getByRole("button", { name: "Submit renewal for review" }),
  );
  await screen.findByRole("heading", { name: "Renewal submitted" });
}
it("shows no renewal banner until a renewal is requested", async () => {
  wrap(createPreviewGateway(), person(5));
  await screen.findByLabelText("Issuer");
  expect(screen.queryByRole("region", urgentHeading)).not.toBeInTheDocument();
  expect(screen.queryByText("Needs renewing")).not.toBeInTheDocument();
});
it("makes a requested renewal urgent, with days left from the expiry date", async () => {
  const { container } = wrap(
    await requestedGateway({ today: () => "2026-11-28" }),
    person(5),
  );
  const banner = await screen.findByRole("region", urgentHeading);
  expect(within(banner).getByText("SAMPLE-GGS-2026-001")).toBeVisible();
  expect(within(banner).getByText(/30 Nov 2026/)).toBeVisible();
  expect(within(banner).getByText("2 days left")).toBeVisible();
  expect(within(banner).getByText(/still valid/)).toBeVisible();
  const card = screen
    .getByRole("heading", { name: "SAMPLE-GGS-2026-001" })
    .closest("article");
  expect(within(card).getByText("Needs renewing")).toBeVisible();
  expect(within(card).getByText("2 days left")).toBeVisible();
  expect(within(card).getByText(/Renewal requested on/)).toBeVisible();
  expect(container).not.toHaveTextContent(/notification|alert|\bsent\b/i);
});
it("counts days from the prepared date in preview", async () => {
  wrap(await requestedGateway(), person(5));
  const banner = await screen.findByRole("region", urgentHeading);
  expect(within(banner).getByText("39 days left")).toBeVisible();
});
it("says expired, not still valid, once the expiry date has passed", async () => {
  wrap(await requestedGateway({ today: () => "2026-12-03" }), person(5));
  const banner = await screen.findByRole("region", {
    name: "1 certificate has expired",
  });
  expect(within(banner).getByText("Expired 3 days ago")).toBeVisible();
  expect(within(banner).queryByText(/still valid/)).not.toBeInTheDocument();
});
it("calms down after submitting, then clears once verified", async () => {
  const user = userEvent.setup(),
    g = await requestedGateway();
  const { unmount, container } = wrap(g, person(5));
  await submitPrepared(user);
  expect(screen.queryByRole("region", urgentHeading)).not.toBeInTheDocument();
  expect(screen.queryByText("Needs renewing")).not.toBeInTheDocument();
  const waiting = screen.getByRole("region", {
    name: "Your renewal is waiting for review",
  });
  expect(within(waiting).getByText("SAMPLE-GGS-2026-001")).toBeVisible();
  expect(container).not.toHaveTextContent(/notification|alert|\bsent\b/i);
  unmount();
  const pending = (await g.listCertificates(person(5))).find(
    (c) => c.status === "pending",
  );
  await g.decideRenewal(person(7), pending.id, {
    decision: "verify",
    note: "Reviewed SAMPLE renewal.",
  });
  wrap(g, person(5));
  await screen.findByRole("heading", { name: "SAMPLE-GGS-2027-PREVIEW" });
  expect(screen.queryByText("Needs renewing")).not.toBeInTheDocument();
  expect(screen.queryByText(/Renewal requested on/)).not.toBeInTheDocument();
  expect(screen.queryByRole("region", urgentHeading)).not.toBeInTheDocument();
  expect(
    screen.queryByRole("region", {
      name: "Your renewal is waiting for review",
    }),
  ).not.toBeInTheDocument();
});
it("is urgent again after a rejection and can prepare the correction", async () => {
  const user = userEvent.setup(),
    g = await requestedGateway();
  const { unmount } = wrap(g, person(5));
  await submitPrepared(user);
  unmount();
  const pending = (await g.listCertificates(person(5))).find(
    (c) => c.status === "pending",
  );
  await g.decideRenewal(person(7), pending.id, {
    decision: "reject",
    note: "Number unreadable.",
  });
  wrap(g, person(5));
  const banner = await screen.findByRole("region", urgentHeading);
  expect(within(banner).getByText(/last renewal was rejected/)).toBeVisible();
  await user.click(
    screen.getByRole("button", { name: "Prepare corrected renewal" }),
  );
  expect(screen.getByLabelText("Certificate number")).toHaveValue(
    "SAMPLE-GGS-2027-PREVIEW",
  );
});
it("lists every certificate when more than one needs renewing", async () => {
  const [first] = data.certificates["1"];
  const records = [
    { ...first, renewal_requested_on: "2026-10-22" },
    {
      ...first,
      id: 90,
      cert_no: "SAMPLE-SECOND",
      expiry_date: "2026-11-01",
      renewal_requested_on: "2026-10-22",
    },
  ];
  wrap(
    {
      ...createPreviewGateway(),
      listCertificates: async () => records,
      today: () => "2026-10-31",
    },
    person(5),
  );
  const banner = await screen.findByRole("region", {
    name: "2 certificates need renewing",
  });
  expect(within(banner).getByText("30 days left")).toBeVisible();
  expect(within(banner).getByText("1 day left")).toBeVisible();
  expect(within(banner).getByText("SAMPLE-SECOND")).toBeVisible();
});
it("pre-fills readable image fields, keeps unreadable values and waits for explicit submission", async () => {
  const user = userEvent.setup(),
    base = createPreviewGateway();
  let finish;
  const extractCertificate = vi.fn(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const renewCertificate = vi.fn();
  wrap({
    ...base,
    capabilities: { ...base.capabilities, certificateExtract: true },
    extractCertificate,
    renewCertificate,
  });
  await screen.findByLabelText("Issuer");
  const issuer = screen.getByLabelText("Issuer").value;
  const image = new File(["photo"], "certificate.png", { type: "image/png" });
  await user.upload(
    screen.getByLabelText("Certificate image (optional)"),
    image,
  );
  await user.click(screen.getByRole("button", { name: "Pre-fill from image" }));
  expect(screen.getByLabelText("Issuer")).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "Submit renewal for review" }),
  ).toBeDisabled();
  await act(async () =>
    finish({
      extracted: {
        issuer: null,
        cert_no: "SAMPLE-READ-2027",
        holder_name: "SAMPLE Holder",
        expiry_date: "2027-12-31",
        scope: [{ product_name: "New Cocoa", brand: null }],
      },
      error: null,
    }),
  );
  expect(screen.getByLabelText("Issuer")).toHaveValue(issuer);
  expect(screen.getByLabelText("Certificate number")).toHaveValue(
    "SAMPLE-READ-2027",
  );
  expect(screen.getByRole("textbox", { name: "Product 1" })).toHaveValue(
    "New Cocoa",
  );
  expect(
    screen.getByRole("textbox", { name: "Brand restriction 1 (optional)" }),
  ).toHaveValue("");
  expect(
    screen.getByText(/Unreadable fields were left unchanged/),
  ).toBeInTheDocument();
  expect(renewCertificate).not.toHaveBeenCalled();
  await user.clear(screen.getByLabelText("Certificate number"));
  await user.type(
    screen.getByLabelText("Certificate number"),
    "SAMPLE-CORRECTED",
  );
  await user.click(
    screen.getByRole("button", { name: "Submit renewal for review" }),
  );
  await waitFor(() => expect(renewCertificate).toHaveBeenCalled());
  expect(renewCertificate.mock.calls[0][1]).toMatchObject({
    cert_no: "SAMPLE-CORRECTED",
    image,
  });
});

it.each(["unreadable", "network"])(
  "keeps the manual draft after an extraction %s failure",
  async (failure) => {
    const user = userEvent.setup(),
      base = createPreviewGateway();
    const extractCertificate = vi.fn(async () => {
      if (failure === "network")
        throw new ApiError(0, "Service unavailable. Try again.");
      return {
        extracted: null,
        error: "Unreadable certificate. Try another image.",
      };
    });
    wrap({
      ...base,
      capabilities: { ...base.capabilities, certificateExtract: true },
      extractCertificate,
    });
    const number = await screen.findByLabelText("Certificate number");
    await user.clear(number);
    await user.type(number, "MANUAL-SAMPLE");
    await user.upload(
      screen.getByLabelText("Certificate image (optional)"),
      new File(["photo"], "certificate.jpg", { type: "image/jpeg" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Pre-fill from image" }),
    );
    await screen.findByRole("alert");
    expect(number).toHaveValue("MANUAL-SAMPLE");
    expect(
      screen.getByRole("button", { name: "Pre-fill from image" }),
    ).toBeEnabled();
  },
);
it("shows a pending receipt only after the service confirms, keeping the active record", async () => {
  const user = userEvent.setup();
  const base = createPreviewGateway();
  let release;
  wrap(
    {
      ...base,
      renewCertificate: (ctx, input) =>
        new Promise((resolve) => {
          release = async () =>
            resolve(await base.renewCertificate(ctx, input));
        }),
    },
    person(5),
  );
  await screen.findByRole("button", { name: "Use prepared renewal" });
  await user.click(
    screen.getByRole("button", { name: "Use prepared renewal" }),
  );
  await user.click(
    screen.getByRole("button", { name: "Submit renewal for review" }),
  );
  expect(
    screen.queryByRole("heading", { name: "Renewal submitted" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Submitting renewal…" }),
  ).toBeDisabled();
  await act(async () => release());
  const receipt = (
    await screen.findByRole("heading", { name: "Renewal submitted" })
  ).closest("section");
  expect(screen.getByText("SAMPLE-GGS-2026-001")).toBeVisible();
  expect(
    within(
      screen.getByText("SAMPLE-GGS-2026-001").closest("article"),
    ).getByText("Active"),
  ).toBeVisible();
  expect(within(receipt).getByText("SAMPLE-GGS-2027-PREVIEW")).toBeVisible();
  expect(within(receipt).getByText("Waiting for review")).toBeVisible();
});
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
  await user.click(
    screen.getByRole("button", { name: "Submit renewal for review" }),
  );
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
  await user.click(
    screen.getByRole("button", { name: "Submit renewal for review" }),
  );
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
  await user.click(
    screen.getByRole("button", { name: "Submit renewal for review" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Add at least one product",
  );
  expect(renewCertificate).not.toHaveBeenCalled();
});
it("submits the prepared renewal and updates both buyers only after reviewer verification", async () => {
  const user = userEvent.setup(),
    g = createPreviewGateway();
  wrap(g, person(5));
  await user.click(
    await screen.findByRole("button", { name: "Use prepared renewal" }),
  );
  await user.click(
    screen.getByRole("button", { name: "Submit renewal for review" }),
  );
  await screen.findByText("Renewal submitted");
  const pending = (await g.listCertificates(person(5))).find(
    (c) => c.status === "pending",
  );
  expect(
    (await g.listMaterials(person(1))).find((m) => m.id === 1).coverage_status,
  ).toBe("expiring");
  await g.decideRenewal(person(7), pending.id, {
    decision: "verify",
    note: "Reviewed SAMPLE renewal.",
  });
  for (const id of [1, 3])
    expect(
      (await g.listMaterials(person(id))).every(
        (m) => m.coverage_status === "covered",
      ),
    ).toBe(true);
});
function SwitchSupplier() {
  const session = useSession();
  return (
    <button onClick={() => session.selectIdentity(person(5))}>
      Switch supplier test
    </button>
  );
}

it.each([false, true])(
  "ignores late extraction after cancellation or workspace change (switch=%s)",
  async (switchWorkspace) => {
    const user = userEvent.setup(),
      base = createPreviewGateway();
    let finish, signal;
    const gateway = {
      ...base,
      capabilities: { ...base.capabilities, certificateExtract: true },
      extractCertificate: (ctx, input, options) =>
        new Promise((resolve) => {
          finish = resolve;
          signal = options.signal;
        }),
    };
    render(
      <SessionProvider gateway={gateway} initialIdentity={identity}>
        <SwitchSupplier />
        <Certificates />
      </SessionProvider>,
    );
    const number = await screen.findByLabelText("Certificate number");
    const original = number.value;
    await user.upload(
      screen.getByLabelText("Certificate image (optional)"),
      new File(["photo"], "certificate.jpg", { type: "image/jpeg" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Pre-fill from image" }),
    );
    await user.click(
      screen.getByRole("button", {
        name: switchWorkspace ? "Switch supplier test" : "Cancel reading",
      }),
    );
    expect(signal.aborted).toBe(true);
    await act(async () =>
      finish({ extracted: { cert_no: "STALE-SAMPLE" }, error: null }),
    );
    expect(screen.getByLabelText("Certificate number")).not.toHaveValue(
      "STALE-SAMPLE",
    );
    if (!switchWorkspace) {
      expect(screen.getByLabelText("Certificate number")).toHaveValue(original);
      expect(
        screen.getByText("Reading cancelled. Your draft is unchanged."),
      ).toBeInTheDocument();
    } else {
      expect(
        await screen.findByRole("textbox", { name: "Product 10" }),
      ).toHaveValue("Potato Starch");
    }
  },
);
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
  await user.click(
    screen.getByRole("button", { name: "Submit renewal for review" }),
  );
  await user.click(
    screen.getByRole("button", { name: "Switch supplier test" }),
  );
  await act(async () => resolve({ ...data.certificates["2"][0], id: 999 }));
  expect(screen.queryByText("Renewal submitted")).not.toBeInTheDocument();
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
  await user.click(
    screen.getByRole("button", { name: "Submit renewal for review" }),
  );
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
  await user.click(
    screen.getByRole("button", { name: "Submit renewal for review" }),
  );
  await waitFor(() => expect(submitted.issuer).toBe("Another SAMPLE issuer"));
});
