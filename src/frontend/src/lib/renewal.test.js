import { describe, it, expect } from "vitest";
import { daysLeftText, daysUntil, renewalState } from "./renewal.js";
const active = {
  id: 1,
  status: "active",
  expiry_date: "2026-11-30",
  renewal_requested_on: "2026-10-31",
};
describe("daysUntil", () => {
  it.each([
    ["2026-11-30", "2026-11-30", 0],
    ["2026-11-30", "2026-11-29", 1],
    ["2026-11-30", "2026-12-03", -3],
    ["2026-11-30", "2026-10-31", 30],
    ["2027-01-01", "2026-12-31", 1],
  ])("counts calendar days to %s from %s", (expiry, today, days) => {
    expect(daysUntil(expiry, today)).toBe(days);
  });
});
describe("daysLeftText", () => {
  it.each([
    [30, "30 days left"],
    [1, "1 day left"],
    [0, "Expires today"],
    [-1, "Expired 1 day ago"],
    [-3, "Expired 3 days ago"],
  ])("describes %i days", (days, text) => {
    expect(daysLeftText(days)).toBe(text);
  });
});
describe("renewalState", () => {
  it("needs no action when nothing was requested", () => {
    expect(
      renewalState([{ ...active, renewal_requested_on: null }]).kind,
    ).toBeNull();
  });
  it("is urgent while the active certificate has an open request", () => {
    expect(renewalState([active])).toEqual({
      kind: "urgent",
      certificates: [active],
      rejected: null,
    });
  });
  it("calms down while a renewal waits for review", () => {
    const state = renewalState([{ id: 2, status: "pending" }, active]);
    expect(state.kind).toBe("waiting");
    expect(state.certificates).toEqual([active]);
  });
  it("ignores the date left on a replaced certificate", () => {
    expect(
      renewalState([
        { id: 2, status: "active", renewal_requested_on: null },
        { ...active, status: "superseded" },
      ]).kind,
    ).toBeNull();
  });
  it("is urgent again after a rejection and names the newest rejection", () => {
    const older = { id: 2, status: "rejected" };
    const newest = { id: 3, status: "rejected" };
    const state = renewalState([older, newest, active]);
    expect(state.kind).toBe("urgent");
    expect(state.rejected).toBe(newest);
  });
  it("does not blame a rejection older than the active certificate", () => {
    const state = renewalState([
      { id: 1, status: "rejected" },
      { ...active, id: 2 },
    ]);
    expect(state.rejected).toBeNull();
  });
});
