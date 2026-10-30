import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { scenePose } from "./scene-pose.js";
export function createSceneController({
  root,
  progressRef,
  invalidate,
  onStageChange,
  onPlaybackChange,
  reducedMotion,
}) {
  let destroyed = false,
    lastStage = -1,
    tour,
    move,
    timeline,
    trigger;
  const stage = root.querySelector(".scene-stage");
  let w = stage.clientWidth,
    h = stage.clientHeight,
    mobile = w <= 760;
  function measure() {
    w = stage.clientWidth;
    h = stage.clientHeight;
    mobile = w <= 760;
  }
  function render() {
    if (destroyed) return;
    const p = progressRef.current.value,
      pose = scenePose(p, { mode: reducedMotion ? "static" : "desktop" });
    if (pose.stage !== lastStage) {
      lastStage = pose.stage;
      onStageChange(pose.stage);
    }
    invalidate();
    const hero = root.querySelector(".hero-copy"),
      heading = root.querySelector(".scene-heading"),
      drawer = root.querySelector(".decision-drawer");
    if (reducedMotion) {
      hero.inert = false;
      hero.querySelectorAll("a,button").forEach((el) => {
        el.inert = false;
      });
      hero.style.pointerEvents = "";
      drawer.inert = false;
      root.querySelectorAll(".evidence-plane").forEach((el) => {
        el.inert = false;
      });
      return;
    }
    hero.style.opacity = 1 - pose.copyAway;
    hero.style.transform = `translate3d(${-pose.copyAway * (mobile ? 0 : 60)}px,${-pose.copyAway * (mobile ? 25 : 0)}px,0)`;
    hero.inert = false;
    hero.style.pointerEvents = pose.copyAway > 0.9 ? "none" : "";
    hero.querySelectorAll("a,button").forEach((el) => {
      el.inert = pose.copyAway > 0.9;
    });
    heading.style.opacity = pose.heading;
    heading.style.transform = `translateY(${(1 - pose.heading) * 16}px)`;
    drawer.style.opacity = pose.decision;
    drawer.style.transform = `translate(-50%,${(1 - pose.decision) * 24}px)`;
    drawer.inert = pose.decision < 0.95;
    const position = root.querySelector(".sc-fallback .console-position"),
      world = root.querySelector(".sc-fallback .console-world");
    if (!position || !world) return;
    const compact = mobile
      ? Math.min((w * 0.94) / 960, (h * 0.39) / 540)
      : Math.min((w * 0.515) / 960, (h * 0.63) / 540);
    const full = mobile
      ? Math.min((w * 0.84) / 960, (h * 0.53) / 540)
      : Math.min((w * 0.92) / 960, (h * 0.68) / 540);
    let scale =
      (compact + (full - compact) * pose.expand) *
      (1 - pose.open * 0.24) *
      (1 - pose.decision * 0.2);
    if (mobile)
      scale =
        Math.min((w * 0.77) / 300, (h * 0.43) / 438) *
        (1 - pose.decision * 0.12);
    const x = mobile ? 0 : w * 0.202 * (1 - pose.expand);
    const y = mobile
      ? h * 0.04 +
        (-h * 0.065 - h * 0.04) * pose.expand -
        pose.decision * h * 0.09
      : -h * 0.02 +
        h * 0.005 * pose.expand -
        pose.open * h * 0.1 -
        pose.decision * h * 0.07;
    position.style.transform = `translate(-50%,-50%) translate3d(${x}px,${y}px,0) scale(${scale})`;
    world.style.transform = `rotateX(${pose.rotation[0]}deg) rotateY(${pose.rotation[1]}deg) rotateZ(${pose.rotation[2]}deg)`;
    [
      ["source", "photo"],
      ["reading", "reading"],
      ["rules", "rules"],
    ].forEach(([kind, key], i) => {
      const el = root.querySelector(".sc-fallback ." + kind + "-plane");
      if (!el) return;
      if (mobile) {
        const focus = Math.min(2, pose.stage),
          current = i === focus;
        const center = [167, 474, 787][i];
        el.style.transform = `translate3d(${480 - center + (current ? 0 : i < focus ? -22 : 22)}px,${current ? 0 : -17}px,${current ? 125 : 0}px)`;
        el.style.opacity = current ? "1" : ".22";
        el.inert = !current;
      } else {
        const base = {
          photo: [-3.13, -0.04, 0.19],
          reading: [-0.06, -0.04, 0.19],
          rules: [3.07, -0.04, 0.19],
        }[key];
        el.style.transform = `translate3d(${(pose[key][0] - base[0]) * 100}px,${-(pose[key][1] - base[1]) * 100}px,${(pose[key][2] - base[2]) * 100}px)`;
        el.style.opacity = "1";
        el.inert = false;
      }
    });
    root.querySelector(".sc-fallback .console-shell").style.opacity =
      1 - pose.open * 0.92;
    root.querySelector(".sc-fallback .console-base").style.opacity =
      1 - pose.open * 0.62;
  }
  const canScroll = !reducedMotion && root.clientHeight > 0;
  const oldScrollBehavior = document.documentElement.style.scrollBehavior;
  if (canScroll) document.documentElement.style.scrollBehavior = "auto";
  if (canScroll) {
    gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);
    timeline = gsap
      .timeline({
        scrollTrigger: {
          trigger: root,
          start: () => `top ${mobile ? 64 : 76}px`,
          end: "bottom bottom",
          scrub: 0.15,
          onRefresh: measure,
        },
      })
      .to(progressRef.current, {
        value: 1,
        duration: 1,
        ease: "none",
        onUpdate: render,
      });
    trigger = timeline.scrollTrigger;
  }
  function pause() {
    tour?.kill();
    tour = null;
    onPlaybackChange(false);
  }
  function interrupt(event) {
    if (event.type === "click" && !event.target?.closest?.('a[href^="#"]'))
      return;
    if (
      event.type === "keydown" &&
      ![
        "ArrowDown",
        "ArrowUp",
        "PageDown",
        "PageUp",
        "Home",
        "End",
        " ",
        "Escape",
        "Tab",
      ].includes(event.key)
    )
      return;
    pause();
    move?.kill();
  }
  const topFor = (p) =>
    trigger ? trigger.start + (trigger.end - trigger.start) * p : 0;
  function goToStage(index) {
    pause();
    move?.kill();
    const p = [0, 0.29, 0.53, 0.86][index];
    if (destroyed) return;
    if (!canScroll) {
      progressRef.current.value = p;
      render();
      (index === 3
        ? drawer()
        : root.querySelectorAll(".sc-fallback .evidence-plane")[index]
      )?.scrollIntoView?.({ behavior: "instant", block: "center" });
      return;
    }
    move = gsap.to(window, {
      scrollTo: { y: topFor(p), autoKill: true },
      duration: 0.85,
      ease: "power3.out",
    });
  }
  function drawer() {
    return root.querySelector(".decision-drawer");
  }
  function play() {
    pause();
    if (!canScroll) return;
    move?.kill();
    window.scrollTo({ top: topFor(0), behavior: "instant" });
    onPlaybackChange(true);
    tour = gsap.timeline({
      onComplete: () => {
        tour = null;
        onPlaybackChange(false);
      },
    });
    tour
      .to({}, { duration: 2.2 })
      .to(window, {
        scrollTo: { y: topFor(0.29), autoKill: false },
        duration: 4.3,
        ease: "power2.inOut",
      })
      .to({}, { duration: 4.7 })
      .to(window, {
        scrollTo: { y: topFor(0.53), autoKill: false },
        duration: 3.4,
        ease: "power2.inOut",
      })
      .to({}, { duration: 4.6 })
      .to(window, {
        scrollTo: { y: topFor(0.86), autoKill: false },
        duration: 3,
        ease: "power2.inOut",
      })
      .to({}, { duration: 5.3 })
      .to(window, {
        scrollTo: { y: topFor(1), autoKill: false },
        duration: 2.7,
        ease: "power2.inOut",
      });
  }
  function hidden() {
    if (document.hidden) {
      pause();
      move?.kill();
    }
  }
  ["wheel", "touchstart", "keydown", "click"].forEach((type) =>
    window.addEventListener(type, interrupt, { passive: true }),
  );
  document.addEventListener("visibilitychange", hidden);
  render();
  return {
    goToStage,
    play,
    pause,
    destroy() {
      destroyed = true;
      if (canScroll)
        document.documentElement.style.scrollBehavior = oldScrollBehavior;
      pause();
      move?.kill();
      trigger?.kill();
      timeline?.kill();
      ["wheel", "touchstart", "keydown", "click"].forEach((type) =>
        window.removeEventListener(type, interrupt),
      );
      document.removeEventListener("visibilitychange", hidden);
    },
  };
}
