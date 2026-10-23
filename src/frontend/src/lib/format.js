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
export function formatTime(value) {
  return new Intl.DateTimeFormat("en-MY", {
    timeZone: "Asia/Kuala_Lumpur",
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
  needs_human: "Reading incomplete",
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
