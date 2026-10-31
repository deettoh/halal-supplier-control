import { flushSync } from "react-dom";

let activeTransition;
let latestUpdate = 0;
export function invalidateTransitions() {
  latestUpdate += 1;
}
export function transitionUpdate(update) {
  const ticket = ++latestUpdate;
  if (
    typeof document.startViewTransition !== "function" ||
    document.hidden ||
    document.documentElement.dataset.motion === "reduced" ||
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  ) {
    update();
    return;
  }
  let committed = false;
  function commit() {
    if (committed || ticket !== latestUpdate) return;
    committed = true;
    // The browser must snapshot the new React tree before beginning its fade.
    flushSync(update);
  }
  try {
    activeTransition?.skipTransition?.();
    const transition = document.startViewTransition(commit);
    activeTransition = transition;
    // rapid navigation can skip a snapshot and the latest update runs once
    transition.ready?.catch(() => {});
    transition.updateCallbackDone?.catch(() => {});
    const clear = () => {
      if (activeTransition === transition) activeTransition = undefined;
    };
    transition.finished?.then(clear, clear);
  } catch {
    commit();
  }
}
