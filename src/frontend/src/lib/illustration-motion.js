import { useEffect, useRef } from "react";

export function useIllustrationMotion() {
  const ref = useRef(null);
  useEffect(() => {
    const root = ref.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    const image = root.querySelector("img");
    let loaded = !image || (image.complete && image.naturalWidth > 0);
    let visible = false;
    let started = false;
    function update() {
      const paused = !visible || document.hidden;
      root.dataset.motionPaused = String(paused);
      if (!started && loaded && !paused) {
        started = true;
        root.dataset.motion = "play";
      }
    }
    function onLoad() {
      loaded = true;
      update();
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        update();
      },
      { threshold: 0.15 },
    );
    observer.observe(root);
    image?.addEventListener("load", onLoad);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      image?.removeEventListener("load", onLoad);
      document.removeEventListener("visibilitychange", update);
      delete root.dataset.motion;
      delete root.dataset.motionPaused;
    };
  }, []);
  return ref;
}
