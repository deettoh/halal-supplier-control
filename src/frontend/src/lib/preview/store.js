import data from "./data.json";
export const copy = (value) => structuredClone(value);
export function createPreviewStore() {
  return {
    deliveries: copy(data.deliveries),
    activity: copy(data.initial_activity),
    certificates: copy(data.certificates),
    renewed: [false, false],
    nextId: 500,
    tick: 0,
  };
}
