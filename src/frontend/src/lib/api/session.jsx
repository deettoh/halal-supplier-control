// Simulated Orbyte login: the role switcher and organisation switcher.
import { createContext, useContext, useMemo, useState } from 'react';
import { ACTORS, SUPPLIERS, TENANTS } from './demo-seed';
const STORAGE_KEY = 'hsc-session-v2';
const SessionContext = createContext(null);
function initial() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return { role: 'supervisor', tenant: TENANTS[0].id };
}
export function SessionProvider({ children }) {
  const [session, setState] = useState(initial);
  const value = useMemo(() => {
    const org =
      session.role === 'supplier'
        ? SUPPLIERS.find((s) => s.id === session.tenant)?.name
        : TENANTS.find((t) => t.id === session.tenant)?.name;
    return {
      session,
      actorName: ACTORS[`${session.tenant}:${session.role}`] ?? session.role,
      orgName: org ?? session.tenant,
      setSession: (s) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
        setState(s);
      },
    };
  }, [session]);
  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}
export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}
export const ROLE_LABELS = {
  staff: 'Receiving Staff',
  supervisor: 'Halal Supervisor',
  supplier: 'Supplier',
};
/** All selectable personas for the role switcher. */
export const PERSONAS = [
  ...TENANTS.flatMap((t) =>
    ['supervisor', 'staff'].map((role) => ({
      session: { role, tenant: t.id },
      label: ROLE_LABELS[role],
      org: t.name,
    })),
  ),
  ...SUPPLIERS.map((s) => ({
    session: { role: 'supplier', tenant: s.id },
    label: 'Supplier',
    org: s.name,
  })),
];
