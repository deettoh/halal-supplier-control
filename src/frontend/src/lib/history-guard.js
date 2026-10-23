// Index this app's history entries so a cancelled traversal can return to the
// existing entry without adding duplicates or dropping the forward history.
const key = "hsc.navigation.index";
export function installHistoryGuard(confirmDiscard) {
  const history = window.history;
  const push = history.pushState;
  const replace = history.replaceState;
  let current = Number.isInteger(history.state?.[key]) ? history.state[key] : 0;
  let restoring = false;
  const indexed = (state, index) => ({ ...(state || {}), [key]: index });
  replace.call(history, indexed(history.state, current), "");
  function pushState(state, title, url) {
    current += 1;
    return push.call(history, indexed(state, current), title, url);
  }
  function replaceState(state, title, url) {
    return replace.call(history, indexed(state, current), title, url);
  }
  function pop(event) {
    if (restoring) {
      event.stopImmediatePropagation();
      restoring = false;
      return;
    }
    const next = event.state?.[key];
    // Entries outside this document use the separate beforeunload protection.
    if (!Number.isInteger(next) || next === current) return;
    if (!confirmDiscard()) {
      event.stopImmediatePropagation();
      restoring = true;
      history.go(current - next);
    } else current = next;
  }
  history.pushState = pushState;
  history.replaceState = replaceState;
  window.addEventListener("popstate", pop, true);
  return () => {
    window.removeEventListener("popstate", pop, true);
    if (history.pushState === pushState) history.pushState = push;
    if (history.replaceState === replaceState) history.replaceState = replace;
  };
}
