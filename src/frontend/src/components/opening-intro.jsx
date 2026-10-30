import { AppLink } from "../lib/navigation.jsx";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { LoupeWordmark, UnfoldingRibbon } from "./loupe-brand.jsx";
import { createLoupeIntro } from "./loupe-intro-motion.js";

gsap.registerPlugin(useGSAP);
const seenKey = "loupe-opening-seen:v1";
const motionQuery = "(prefers-reduced-motion: reduce)";

function motionAllowed() {
  const preference = window.matchMedia?.(motionQuery);
  if (!preference || preference.matches) return false;
  try {
    return sessionStorage.getItem("hsc-less-motion") !== "1";
  } catch {
    return true;
  }
}
function shouldPlay() {
  if (!motionAllowed() || window.location.hash) return false;
  try {
    return sessionStorage.getItem(seenKey) !== "1";
  } catch {
    return false;
  }
}

export function OpeningIntro({ children, apiRef }) {
  const [playing, setPlaying] = useState(shouldPlay);
  const content = useRef(null);
  const skip = useRef(null);
  const overlay = useRef(null);
  const manualReplay = useRef(false);
  const focusLanding = useRef(false);
  const finish = useCallback(() => {
    focusLanding.current =
      overlay.current?.contains(document.activeElement) ||
      document.activeElement === document.body;
    manualReplay.current = false;
    setPlaying(false);
  }, []);
  useImperativeHandle(
    apiRef,
    () => ({
      replay() {
        if (!motionAllowed()) return false;
        manualReplay.current = true;
        setPlaying(true);
        return true;
      },
    }),
    [],
  );
  useGSAP(
    () => {
      if (playing) createLoupeIntro(overlay.current, { onComplete: finish });
    },
    { scope: overlay, dependencies: [playing], revertOnUpdate: true },
  );

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
      if (!manualReplay.current) sessionStorage.setItem(seenKey, "1");
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
    const timeout = window.setTimeout(finish, 3850);
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
        <div
          className="opening-intro"
          ref={overlay}
          role="region"
          aria-label="Loupe introduction"
          data-intro-phase="unfold"
        >
          <AppLink
            className="opening-enter primary"
            href="/demo"
            onClick={finish}
          >
            Enter demo
          </AppLink>
          <div className="opening-lockup" aria-hidden="true">
            <div className="opening-mark-position">
              <div className="opening-mark-motion">
                <UnfoldingRibbon />
              </div>
            </div>
            <div className="opening-name-position">
              <div className="opening-name">
                <LoupeWordmark />
              </div>
            </div>
          </div>
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
