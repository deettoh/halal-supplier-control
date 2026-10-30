import { AppLink } from "../lib/navigation.jsx";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

const seenKey = "hsc-opening-seen:v1";
const motionQuery = "(prefers-reduced-motion: reduce)";

function shouldPlay() {
  const preference = window.matchMedia?.(motionQuery);
  if (!preference || preference.matches || window.location.hash) return false;
  try {
    return sessionStorage.getItem(seenKey) !== "1";
  } catch {
    return false;
  }
}

export function OpeningIntro({ children }) {
  const [playing, setPlaying] = useState(shouldPlay);
  const content = useRef(null);
  const skip = useRef(null);
  const focusLanding = useRef(false);
  const finish = useCallback(() => {
    focusLanding.current = document.activeElement === skip.current;
    setPlaying(false);
  }, []);

  useLayoutEffect(() => {
    if (!playing && focusLanding.current) {
      const main = content.current?.querySelector("main");
      main?.setAttribute("tabindex", "-1");
      main?.focus({ preventScroll: true });
      focusLanding.current = false;
    }
  }, [playing]);

  useEffect(() => {
    if (!playing) return;
    try {
      sessionStorage.setItem(seenKey, "1");
    } catch {
      // If the visit cannot be remembered, avoid replaying an unwanted intro.
      // Resolve the browser failure before taking over scrolling or focus.
      let cancelled = false;
      queueMicrotask(() => {
        if (!cancelled) finish();
      });
      return () => {
        cancelled = true;
      };
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    skip.current?.focus({ preventScroll: true });
    // Independent of CSS events, image downloads, fonts and network requests.
    const timeout = window.setTimeout(finish, 2200);
    const preference = window.matchMedia(motionQuery);
    function onPreferenceChange() {
      if (preference.matches) finish();
    }
    function onKeyDown(event) {
      if (event.key === "Escape") finish();
    }
    preference.addEventListener?.("change", onPreferenceChange);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timeout);
      document.body.style.overflow = previousOverflow;
      preference.removeEventListener?.("change", onPreferenceChange);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [playing, finish]);

  return (
    <>
      <div className="opening-content" ref={content} inert={playing}>
        {children}
      </div>
      {playing && (
        <div className="opening-intro">
          <AppLink className="opening-enter" href="/demo" onClick={finish}>
            Enter demo
          </AppLink>
          <div className="opening-panels" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((index) => (
              <span key={index} style={{ "--panel": index }} />
            ))}
          </div>
          <p className="opening-title" aria-hidden="true">
            {["Halal", "Supplier", "Control"].map((word, index) => (
              <span className="opening-word" key={word}>
                <span style={{ "--word": index }}>{word}</span>
              </span>
            ))}
          </p>
          <button
            className="opening-skip"
            type="button"
            ref={skip}
            onClick={finish}
          >
            Skip intro
          </button>
        </div>
      )}
    </>
  );
}
