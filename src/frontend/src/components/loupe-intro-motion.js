import gsap from "gsap";

export function createLoupeIntro(root, { paused = false, onComplete } = {}) {
  const mark = root.querySelector(".opening-mark-motion");
  const name = root.querySelector(".opening-name");
  const lockup = root.querySelector(".opening-lockup");
  const fold = (part) => root.querySelector(`[data-ribbon-fold="${part}"]`);
  const phase = (value) => {
    root.dataset.introPhase = value;
  };
  const line = gsap.timeline({
    paused,
    onComplete,
    defaults: { ease: "power3.out" },
  });
  line
    .set(root, { opacity: 1 })
    .set(mark, { x: 0, scale: 0.92 })
    .set(name, { opacity: 0, scale: 0.68, y: 22 })
    .call(() => phase("unfold"))
    .fromTo(
      fold("back"),
      { rotationX: -76, rotationY: -24, rotationZ: -12, opacity: 0 },
      { rotationX: 0, rotationY: 0, rotationZ: 0, opacity: 1, duration: 0.85 },
      0.08,
    )
    .fromTo(
      fold("middle"),
      { rotationX: -85, rotationY: 18, rotationZ: 7, opacity: 0 },
      { rotationX: 0, rotationY: 0, rotationZ: 0, opacity: 1, duration: 0.9 },
      0.33,
    )
    .fromTo(
      fold("front"),
      { rotationX: 84, rotationY: -12, rotationZ: -8, opacity: 0 },
      { rotationX: 0, rotationY: 0, rotationZ: 0, opacity: 1, duration: 0.9 },
      0.6,
    )
    .to(mark, { scale: 1, duration: 1.1 }, 0.25)
    .addLabel("unfolded", 1.5)
    .call(() => phase("shift"), [], 1.65)
    .to(
      mark,
      {
        // Leave room for the name, keeping the completed lockup centred.
        x: () =>
          -(
            name.parentElement.getBoundingClientRect().width +
            (parseFloat(getComputedStyle(lockup).columnGap) || 0)
          ) / 2,
        duration: 0.42,
      },
      1.65,
    )
    .addLabel("name", 2.12)
    .call(() => phase("name"), [], "name")
    .to(
      name,
      { opacity: 1, scale: 1, y: 0, duration: 0.5, ease: "back.out(1.45)" },
      "name",
    )
    .addLabel("hold", 2.7)
    .call(() => phase("hold"), [], "hold")
    .addLabel("reveal", 3.2)
    .call(() => phase("reveal"), [], "reveal")
    .to(root, { opacity: 0, duration: 0.32, ease: "power2.inOut" }, "reveal");
  return line;
}
