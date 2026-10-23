import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { installHistoryGuard } from "./history-guard.js";
const SessionContext = createContext(null);
export const organisations = {
  sme: [
    { tenant: "Sunrise Bakery SAMPLE", name: "Sunrise Bakery SAMPLE" },
    { tenant: "Crescent Caterer SAMPLE", name: "Crescent Caterer SAMPLE" },
  ],
  supplier: [
    { tenant: "1", name: "Golden Grain Supplies SAMPLE" },
    { tenant: "2", name: "Silver Valley Ingredients SAMPLE" },
  ],
};
export function validateIdentity(value) {
  if (!value || !["staff", "supervisor", "supplier"].includes(value.role))
    return null;
  const allowed = organisations[value.role === "supplier" ? "supplier" : "sme"];
  return allowed.some((o) => o.tenant === value.tenant)
    ? { role: value.role, tenant: value.tenant }
    : null;
}
export function organisationName(identity) {
  return (
    organisations[identity.role === "supplier" ? "supplier" : "sme"].find(
      (o) => o.tenant === identity.tenant,
    )?.name || ""
  );
}
export function homeForRole(role) {
  return (
    { staff: "/check", supervisor: "/review", supplier: "/certificates" }[
      role
    ] || "/demo"
  );
}
export function workspaceKey(mode, identity) {
  return [mode, identity?.role || "visitor", identity?.tenant || ""];
}
function stored(mode) {
  try {
    return validateIdentity(
      JSON.parse(sessionStorage.getItem("hsc.identity." + mode)),
    );
  } catch {
    return null;
  }
}
function ScopedQueries({ children }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false, refetchOnWindowFocus: false },
          mutations: { retry: false },
        },
      }),
  );
  useEffect(
    () => () => {
      client.cancelQueries();
      client.clear();
    },
    [client],
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
export function SessionProvider({ children, gateway, initialIdentity }) {
  const [state, setState] = useState(() => ({
    identity:
      initialIdentity === undefined
        ? stored(gateway.mode)
        : validateIdentity(initialIdentity),
    epoch: 0,
  }));
  const serial = useRef(0);
  const dirty = useRef(false);
  const selectIdentity = useCallback(
    (value) => {
      const identity = validateIdentity(value);
      if (!identity) throw new Error("Choose a valid role and organisation.");
      serial.current += 1;
      dirty.current = false;
      setState({ identity, epoch: serial.current });
      try {
        sessionStorage.setItem(
          "hsc.identity." + gateway.mode,
          JSON.stringify(identity),
        );
      } catch {
        /* Session remains usable when browser storage is blocked. */
      }
    },
    [gateway.mode],
  );
  const setDraftDirty = useCallback((value) => {
    dirty.current = value;
  }, []);
  const confirmDiscard = useCallback(
    () =>
      !dirty.current ||
      window.confirm(
        "Leave this draft? Unsaved changes will be discarded. A request already sent may still be saved.",
      ),
    [],
  );
  const isCurrent = useCallback(
    (ticket) => ticket.epoch === serial.current,
    [],
  );
  useEffect(() => installHistoryGuard(confirmDiscard), [confirmDiscard]);
  useEffect(() => {
    function beforeUnload(event) {
      if (dirty.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, []);
  const value = useMemo(
    () => ({
      ...state,
      gateway,
      selectIdentity,
      setDraftDirty,
      confirmDiscard,
      isCurrent,
      key: workspaceKey(gateway.mode, state.identity),
      capture: () => ({ context: { ...state.identity }, epoch: state.epoch }),
    }),
    [state, gateway, selectIdentity, setDraftDirty, confirmDiscard, isCurrent],
  );
  return (
    <SessionContext.Provider value={value}>
      <ScopedQueries
        key={
          gateway.mode +
          ":" +
          state.identity?.role +
          ":" +
          state.identity?.tenant +
          ":" +
          state.epoch
        }
      >
        {children}
      </ScopedQueries>
    </SessionContext.Provider>
  );
}
export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error("SessionProvider is required.");
  return session;
}
export function useDraft(isDirty) {
  const { setDraftDirty } = useSession();
  useEffect(() => {
    setDraftDirty(isDirty);
    return () => setDraftDirty(false);
  }, [isDirty, setDraftDirty]);
}
