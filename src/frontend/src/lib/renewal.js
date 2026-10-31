const DAY_MS = 86400000;
const utcDay = (iso) => {
  const [year, month, day] = iso.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
};
export function daysUntil(expiry, today) {
  return Math.round((utcDay(expiry) - utcDay(today)) / DAY_MS);
}
export function daysLeftText(days) {
  if (days === 0) return "Expires today";
  const count = Math.abs(days) + (Math.abs(days) === 1 ? " day" : " days");
  return days > 0 ? count + " left" : "Expired " + count + " ago";
}
export function renewalState(records) {
  const certificates = records.filter(
    (c) => c.status === "active" && c.renewal_requested_on,
  );
  if (!certificates.length)
    return { kind: null, certificates: [], rejected: null };
  if (records.some((c) => c.status === "pending"))
    return { kind: "waiting", certificates, rejected: null };
  const newestActive = Math.max(...certificates.map((c) => c.id));
  const rejected = records
    .filter((c) => c.status === "rejected" && c.id > newestActive)
    .reduce((newest, c) => (!newest || c.id > newest.id ? c : newest), null);
  return { kind: "urgent", certificates, rejected };
}
