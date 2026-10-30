import React, {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useGSAP } from "@gsap/react";
import {
  ArrowRight,
  Play,
  Pause,
  Camera,
  FileText,
  ListChecks,
  UserRound,
} from "lucide-react";
import { AppLink } from "../../lib/navigation.jsx";
import { SceneFallback } from "./scene-fallback.jsx";
import { SceneBoundary } from "./scene-boundary.jsx";
import { createSceneController } from "./scene-controller.js";
const SceneCanvas = lazy(() => import("./scene-canvas.jsx"));
const labels = ["Photo", "Read", "Rules", "Human review"];
const icons = [Camera, FileText, ListChecks, UserRound];
function mediaReduced() {
  return (
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? true
  );
}
function storedReduced() {
  try {
    return sessionStorage.getItem("hsc-less-motion") === "1";
  } catch {
    return false;
  }
}
export default function LandingScene({ apiRef }) {
  const root = useRef(),
    progressRef = useRef({ value: 0 }),
    invalidateRef = useRef(() => {}),
    controller = useRef(),
    layoutRef = useRef({}),
    engaged = useRef(false);
  const [stage, setStage] = useState(0),
    [field, setField] = useState("brand"),
    [rule, setRule] = useState("R2"),
    [playing, setPlaying] = useState(false),
    [held, setHeld] = useState(false);
  const [less, setLess] = useState(() => mediaReduced() || storedReduced());
  const [wide, setWide] = useState(() => window.innerWidth >= 900);
  const [started, setStarted] = useState(false);
  const [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false);
  const forcedStatic =
    failed ||
    !!navigator.connection?.saveData ||
    (wide && typeof window.WebGL2RenderingContext === "undefined");
  const staticMode = less || forcedStatic;
  const can3D = wide && !staticMode;
  useEffect(() => {
    const resize = () => setWide(window.innerWidth >= 900),
      mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const change = () => setLess(mediaReduced() || storedReduced());
    window.addEventListener("resize", resize);
    mq?.addEventListener?.("change", change);
    return () => {
      window.removeEventListener("resize", resize);
      mq?.removeEventListener?.("change", change);
    };
  }, []);
  useLayoutEffect(() => {
    document.body.classList.toggle("less-motion", staticMode);
    document.documentElement.dataset.motion = less ? "reduced" : "full";
    return () => document.body.classList.remove("less-motion");
  }, [staticMode, less]);
  useGSAP(
    () => {
      controller.current = createSceneController({
        root: root.current,
        progressRef,
        layoutRef,
        invalidate: () => invalidateRef.current(),
        onStageChange: setStage,
        onPlaybackChange: setPlaying,
        reducedMotion: staticMode,
      });
      return () => controller.current?.destroy();
    },
    { scope: root, dependencies: [staticMode, wide], revertOnUpdate: true },
  );
  const onStarted = useCallback(() => setStarted(true), []);
  const onReady = useCallback(() => {
    if (engaged.current) setFailed(true);
    else setReady(true);
  }, []);
  const onFailure = useCallback(() => {
    setFailed(true);
    setReady(false);
  }, []);
  useImperativeHandle(
    apiRef,
    () => ({
      jumpToSection: (target) => controller.current?.jumpToSection(target),
    }),
    [],
  );
  function selectField(value) {
    engaged.current = true;
    controller.current?.pause();
    setField(value);
  }
  function selectRule(value) {
    engaged.current = true;
    controller.current?.pause();
    setRule(value);
  }
  function toggleMotion() {
    if (mediaReduced() || forcedStatic) return;
    controller.current?.pause();
    const next = !less;
    try {
      sessionStorage.setItem("hsc-less-motion", next ? "1" : "0");
    } catch {
      /* The current page still honors the preference. */
    }
    setLess(next);
    if (window.scrollY > 0)
      root.current?.scrollIntoView({ behavior: "instant" });
  }
  const title =
    stage < 2
      ? "Open the evidence."
      : stage === 2
        ? "The difference is in the detail."
        : "Clear evidence. Human control.";
  return (
    <section
      id="walkthrough"
      className="journey signal-journey"
      ref={root}
      aria-label="Interactive SAMPLE delivery walkthrough"
    >
      <div className="scene-stage">
        <div className="stage-backdrop" aria-hidden="true">
          <div className="orange-disc" />
          <div className="floor-ellipse" />
        </div>
        <div className="hero-copy">
          <h1>
            Every delivery. <br />A clear
            <br />
            <span> next step.</span>
          </h1>
          <p>
            Read the label. Check document coverage.
            <br />
            Keep the human in control.
          </p>
          <div className="hero-actions">
            <AppLink className="primary" href="/demo">
              Enter demo <ArrowRight aria-hidden="true" />
            </AppLink>
            <button
              className="text-action"
              type="button"
              onClick={() =>
                playing
                  ? controller.current?.pause()
                  : controller.current?.play()
              }
              disabled={staticMode}
              aria-pressed={playing}
              aria-describedby={
                staticMode ? "walkthrough-motion-note" : undefined
              }
            >
              {playing ? "Pause walkthrough" : "Watch the idea"}{" "}
              {playing ? (
                <Pause aria-hidden="true" />
              ) : (
                <Play aria-hidden="true" />
              )}
            </button>
          </div>
          <p className="quiet-note">
            For food businesses. Built around the evidence.
          </p>
          {staticMode && (
            <p className="motion-explanation" id="walkthrough-motion-note">
              Motion is off. Use Photo, Read, Rules and Human review to explore
              the evidence.
            </p>
          )}
        </div>
        <div className="scene-heading">
          <h2>{title}</h2>
          <p>
            {stage < 2
              ? "One label. Three connected views."
              : stage === 2
                ? "Select a field. Follow the reason."
                : "A reason recorded. A next step agreed."}
          </p>
        </div>
        {(can3D || started) && !failed && (
          <div
            className={"sc-canvas " + (ready ? "sc-ready" : "")}
            hidden={!can3D}
            inert={!can3D}
          >
            <SceneBoundary onFailure={onFailure}>
              <Suspense fallback={null}>
                <SceneCanvas
                  progressRef={progressRef}
                  invalidateRef={invalidateRef}
                  layoutRef={layoutRef}
                  selectedField={field}
                  onSelect={selectField}
                  selectedRule={rule}
                  onSelectRule={selectRule}
                  onStarted={onStarted}
                  onReady={onReady}
                  onFailure={onFailure}
                />
              </Suspense>
            </SceneBoundary>
          </div>
        )}
        {(!can3D || !ready) && (
          <SceneFallback
            selectedField={field}
            onSelect={selectField}
            selectedRule={rule}
            onSelectRule={selectRule}
          />
        )}
        <div
          className={"decision-drawer " + (held ? "confirmed" : "")}
          inert={!staticMode}
        >
          <div className="decision-person">
            <span className="avatar" aria-hidden="true">
              F
            </span>
            <div>
              <strong>The next step is human.</strong>
              <span>Farid · Halal supervisor · Sunrise Bakery SAMPLE</span>
            </div>
          </div>
          <div className="decision-detail">
            <span className="decision-tag">Illustrative decision</span>
            <strong>Different brand. Request product details.</strong>
            <span>Reason: brand differs from the approved material.</span>
          </div>
          <button
            type="button"
            className="hold-button"
            onFocus={() => controller.current?.pause()}
            onClick={() => setHeld((v) => !v)}
          >
            {held ? "Reset preview" : "Preview Hold"}
          </button>
          <p className="decision-confirm" role="status">
            {held
              ? "On hold. Request product details. Illustration only; nothing was saved."
              : ""}
          </p>
        </div>
        <div className="scene-controls">
          <div
            className="scene-tabs"
            role="group"
            aria-label="Walkthrough stages"
          >
            {labels.map((label, i) => {
              const Icon = icons[i];
              return (
                <button
                  key={label}
                  type="button"
                  aria-pressed={stage === i}
                  onClick={() => controller.current?.goToStage(i)}
                >
                  <Icon aria-hidden="true" />
                  {label}
                </button>
              );
            })}
          </div>
          <span className="stage-help">
            {stage === 1
              ? "Select a field to compare the reading with the approved material."
              : stage === 2
                ? "Select a check to see its reason."
                : stage === 3
                  ? "The supervisor records a reason and a next step."
                  : "Illustrative SAMPLE journey. No live records change."}
          </span>
          <span className="scene-disclosure">
            Prepared SAMPLE · No live model call or record changes.
          </span>
        </div>
        <div
          className="review-toolbar sc-playback"
          role="group"
          aria-label="Walkthrough playback"
        >
          <button
            type="button"
            onClick={() =>
              playing ? controller.current?.pause() : controller.current?.play()
            }
            disabled={staticMode}
            aria-describedby={
              staticMode ? "walkthrough-motion-note" : undefined
            }
          >
            {playing ? (
              <Pause aria-hidden="true" />
            ) : (
              <Play aria-hidden="true" />
            )}
            {playing ? "Pause walkthrough" : "Play walkthrough"}
          </button>
          <span className="toolbar-divider" />
          <button
            type="button"
            aria-pressed={staticMode}
            title={
              mediaReduced()
                ? "Reduced motion follows your device preference"
                : undefined
            }
            onClick={toggleMotion}
          >
            {staticMode ? "Motion off" : "Less motion"}
          </button>
        </div>
      </div>
    </section>
  );
}
