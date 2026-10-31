const months = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
export function formatDate(value) {
  if (!value) return "No active certificate";
  const [year, month, day] = value.split("-").map(Number);
  return day + " " + months[month - 1] + " " + year;
}
export const BUSINESS_TIME_ZONE = "Asia/Kuala_Lumpur";
export function formatTime(value) {
  return new Intl.DateTimeFormat("en-MY", {
    timeZone: BUSINESS_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}
export const labels = {
  covered: "Covered",
  expiring: "Expiring",
  substitution: "Substitution",
  not_covered: "Not covered",
  needs_human: "Needs review",
  on_hold: "On hold",
  pending: "Waiting for review",
  active: "Active",
  superseded: "Superseded",
  reviewer: "Registry reviewer",
  certificate_submitted: "Renewal submitted",
  certificate_rejected: "Renewal rejected",
  certificate_renewed: "Renewal verified",
  auto_accepted: "Auto-accepted",
  pending_review: "Pending review",
  accepted: "Accepted",
  rejected: "Rejected",
  staff: "Receiving staff",
  supervisor: "Halal supervisor",
  supplier: "Supplier",
};
export function label(value) {
  return labels[value] || String(value ?? "Not read").replaceAll("_", " ");
}
