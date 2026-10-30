import seed from "../../../seed/seed.json";
export const people = seed.people;
export function person(id) {
  const { id: person_id, ...profile } = people.find((p) => p.id === id);
  return { person_id, ...profile };
}
