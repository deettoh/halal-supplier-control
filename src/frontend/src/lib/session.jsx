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
import { invalidateTransitions } from "./motion.js";
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
function identityShape(value) {
  if (
    !value ||
    !["staff", "supervisor", "supplier", "reviewer"].includes(value.role) ||
    !Number.isInteger(value.person_id) ||
    value.person_id <= 0 ||
    typeof value.tenant !== "string" ||
    !value.tenant.trim() ||
    typeof value.name !== "string" ||
    !value.name.trim() ||
    typeof value.title !== "string" ||
    !value.title.trim()
  )
    return null;
  return {
    person_id: value.person_id,
    role: value.role,
    tenant: value.tenant,
    name: value.name,
    title: value.title,
  };
}
export function validateIdentity(value, people = []) {
  const id = value?.person_id ?? value?.id;
  const person = people.find(
    (p) => p.id === id && p.role === value.role && p.tenant === value.tenant,
  );
  return person ? identityShape({ ...person, person_id: person.id }) : null;
}
export function organisationName(identity) {
  if (identity.role === "reviewer") return "Shared registry";
  return (
    organisations[identity.role === "supplier" ? "supplier" : "sme"].find(
      (o) => o.tenant === identity.tenant,
    )?.name || identity.tenant
  );
}
export const routesForRole = {
  staff: ["/check", "/masterlist"],
  supervisor: ["/review", "/masterlist", "/activity"],
  supplier: ["/certificates"],
  reviewer: ["/registry"],
};
export function homeForRole(role) {
  return routesForRole[role]?.[0] || "/demo";
}
export function workspaceKey(mode, identity) {
  return [
    mode,
    identity?.role || "visitor",
    identity?.tenant || "",
    identity?.person_id || "",
  ];
}
function stored(mode) {
  try {
    return JSON.parse(sessionStorage.getItem("hsc.identity." + mode));
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
      initialIdentity === undefined ? null : identityShape(initialIdentity),
    epoch: 0,
  }));
  const [people, setPeople] = useState({
    status: "loading",
    data: [],
    error: null,
  });
  const [peopleAttempt, setPeopleAttempt] = useState(0);
  const serial = useRef(0);
  const dirty = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    Promise.resolve()
      .then(() => {
        if (!gateway.listPeople)
          throw new Error("The connected service cannot list demo people yet.");
        return gateway.listPeople({ signal: controller.signal });
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        if (
          !Array.isArray(data) ||
          data.some((p) => !identityShape({ ...p, person_id: p.id }))
        )
          throw new Error("The service returned an invalid demo people list.");
        setPeople({ status: "success", data, error: null });
        setState((current) => {
          const candidate =
            current.identity ||
            (initialIdentity === undefined
              ? stored(gateway.mode)
              : initialIdentity);
          const identity = validateIdentity(candidate, data);
          if (current.identity && !identity) serial.current += 1;
          return { identity, epoch: serial.current };
        });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setPeople({ status: "error", data: [], error });
      });
    return () => {
      controller.abort();
    };
  }, [gateway, initialIdentity, peopleAttempt]);
  useEffect(
    () => () => {
      serial.current += 1;
    },
    [],
  );
  const retryPeople = useCallback(() => {
    setPeople({ status: "loading", data: [], error: null });
    setPeopleAttempt((n) => n + 1);
  }, []);
  const selectIdentity = useCallback(
    (value) => {
      const identity = validateIdentity(value, people.data);
      if (!identity)
        throw new Error("Choose a valid person from this service's list.");
      serial.current += 1;
      dirty.current = false;
      setState({ identity, epoch: serial.current });
      try {
        sessionStorage.setItem(
          "hsc.identity." + gateway.mode,
          JSON.stringify(identity),
        );
      } catch {
        /* In-memory selection remains usable. */
      }
    },
    [gateway.mode, people.data],
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
  useEffect(
    () => installHistoryGuard(confirmDiscard, invalidateTransitions),
    [confirmDiscard],
  );
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
      people: { ...people, retry: retryPeople },
      selectIdentity,
      setDraftDirty,
      confirmDiscard,
      isCurrent,
      key: workspaceKey(gateway.mode, state.identity),
      capture: () => ({ context: { ...state.identity }, epoch: state.epoch }),
    }),
    [
      state,
      gateway,
      people,
      retryPeople,
      selectIdentity,
      setDraftDirty,
      confirmDiscard,
      isCurrent,
    ],
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
          state.identity?.person_id +
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
