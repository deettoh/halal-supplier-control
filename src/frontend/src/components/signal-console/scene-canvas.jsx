import React, { Suspense, useMemo, useRef, useEffect } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MathUtils, PCFShadowMap, Vector3, Matrix4 } from "three";
import { scenePose } from "./scene-pose.js";
import { fitSceneBounds, cssPlaneMatrix, sceneSpace } from "./scene-layout.js";
import { EvidencePlane } from "./panels.jsx";

function ConsoleModel({
  active,
  progressRef,
  invalidateRef,
  layoutRef,
  panelRefs,
  onReady,
  onFailure,
}) {
  const gltf = useLoader(GLTFLoader, "/media/signal-console.glb");
  const root = useRef();
  const { viewport, size, camera, invalidate, gl } = useThree();
  const point = useMemo(() => new Vector3(), []);
  const projection = useMemo(() => new Matrix4(), []);
  const local = useMemo(() => new Matrix4(), []);
  const model = useMemo(() => {
    const clone = gltf.scene.clone(true);
    clone.traverse((o) => {
      if (o.isMesh) {
        o.material = o.material.clone();
        o.material.transparent = true;
        o.castShadow = !["Shell", "Edge"].includes(o.name);
        o.receiveShadow = true;
      }
    });
    return clone;
  }, [gltf.scene]);
  const trays = useMemo(
    () =>
      ["Shell", "Edge", "PhotoTray", "ReadingTray", "RulesTray"].map((name) => {
        const mesh = model.getObjectByName(name);
        mesh.geometry.computeBoundingBox();
        return mesh;
      }),
    [model],
  );
  useEffect(() => {
    invalidateRef.current = invalidate;
    gl.domElement.setAttribute("aria-hidden", "true");
    const lost = (e) => {
      e.preventDefault();
      onFailure();
    };
    gl.domElement.addEventListener("webglcontextlost", lost);
    onReady();
    invalidate();
    return () => {
      invalidateRef.current = () => {};
      gl.domElement.removeEventListener("webglcontextlost", lost);
      model.traverse((o) => {
        if (o.isMesh) o.material.dispose();
      });
    };
  }, [model, invalidate, invalidateRef, gl, onReady, onFailure]);
  useFrame(() => {
    if (!active || !root.current || size.width <= 0 || size.height <= 0) return;
    const pose = scenePose(progressRef.current.value);
    const view = viewport.getCurrentViewport(camera, [0, 0, 0]);
    const compact = Math.min(
      (size.width * 0.515) / 960,
      (size.height * 0.63) / 540,
    );
    const full = Math.min(
      (size.width * 0.94) / 960,
      (size.height * 0.76) / 540,
    );
    const pixelScale =
      (compact + (full - compact) * pose.expand) *
      (1 - pose.open * 0.18) *
      (1 - pose.decision * 0.2);
    const scale = (pixelScale * 100 * view.height) / size.height;
    root.current.scale.setScalar(scale);
    root.current.position.set(
      view.width * 0.202 * (1 - pose.expand),
      view.height *
        (0.01 - 0.005 * pose.expand + 0.1 * pose.open + 0.07 * pose.decision),
      0,
    );
    root.current.rotation.set(...pose.rotation.map(MathUtils.degToRad));
    [
      ["source", "PhotoTray", "photo"],
      ["reading", "ReadingTray", "reading"],
      ["rules", "RulesTray", "rules"],
    ].forEach(([, node, key]) => {
      const position = pose[key];
      const object = model.getObjectByName(node);
      if (object) object.position.set(...position);
    });
    ["Shell", "Edge"].forEach((name) => {
      const o = model.getObjectByName(name);
      if (o)
        o.material.opacity = 1 - pose.open * (name === "Shell" ? 0.92 : 0.62);
    });
    root.current.updateWorldMatrix(true, true);
    function bounds() {
      let top = Infinity,
        bottom = -Infinity;
      for (const mesh of trays) {
        const { min, max } = mesh.geometry.boundingBox;
        for (const x of [min.x, max.x])
          for (const y of [min.y, max.y])
            for (const z of [min.z, max.z]) {
              point.set(x, y, z).applyMatrix4(mesh.matrixWorld).project(camera);
              const py = ((1 - point.y) * size.height) / 2;
              top = Math.min(top, py);
              bottom = Math.max(bottom, py);
            }
      }
      return { top, bottom };
    }
    const layout = layoutRef.current;
    if (pose.heading > 0 && layout.heading) {
      const space = sceneSpace(layout, pose);
      // fit to projected corners because perspective changes tray bounds
      for (let pass = 0; pass < 3; pass++) {
        const fit = fitSceneBounds(bounds(), space);
        root.current.scale.multiplyScalar(1 + (fit.scale - 1) * pose.heading);
        root.current.updateWorldMatrix(true, true);
        const shifted = fitSceneBounds(bounds(), space);
        root.current.position.y -=
          (shifted.shift * pose.heading * view.height) / size.height;
        root.current.updateWorldMatrix(true, true);
      }
      layout.heading.style.transform = `translate3d(0,${Math.max(12, bounds().top - layout.headingHeight - 24)}px,0)`;
    }
    // A single projective transform keeps normal HTML, its painted pixels and
    // browser hit targets together. Nested CSS perspective contexts can disagree
    // about hit geometry (especially under browser zoom).
    [
      ["source", "PhotoTray", 298],
      ["reading", "ReadingTray", 286],
      ["rules", "RulesTray", 310],
    ].forEach(([kind, name, width]) => {
      const element = panelRefs.current[kind];
      if (!element) return;
      local.set(
        0.01,
        0,
        0,
        -width / 200,
        0,
        -0.01,
        0,
        2.19,
        0,
        0,
        1,
        0.055,
        0,
        0,
        0,
        1,
      );
      projection
        .copy(camera.projectionMatrix)
        .multiply(camera.matrixWorldInverse)
        .multiply(model.getObjectByName(name).matrixWorld)
        .multiply(local);
      const matrix = cssPlaneMatrix(projection, size);
      element.style.transform = `matrix3d(${matrix.join(",")})`;
    });
  }, -1);
  return (
    <group ref={root}>
      <primitive object={model} dispose={null} />
    </group>
  );
}
export default function SceneCanvas(props) {
  const panelRefs = useRef({});
  return (
    <>
      <Canvas
        frameloop="demand"
        dpr={[1, 1.5]}
        shadows={{ type: PCFShadowMap }}
        camera={{ position: [0, 0, 12], fov: 35, near: 0.1, far: 60 }}
        gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
        onCreated={({ gl }) => {
          gl.setClearAlpha(0);
          props.onStarted?.();
        }}
      >
        <ambientLight intensity={1.8} />
        <directionalLight
          position={[-4, 6, 9]}
          intensity={2.8}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-bias={-0.0003}
        />
        <directionalLight position={[5, -2, 5]} intensity={0.6} />
        <mesh position={[0, -0.05, -0.6]} receiveShadow>
          <planeGeometry args={[25, 15]} />
          <shadowMaterial transparent opacity={0.13} />
        </mesh>
        <Suspense fallback={null}>
          <ConsoleModel {...props} panelRefs={panelRefs} />
        </Suspense>
      </Canvas>
      <div className="sc-panel-layer">
        {["source", "reading", "rules"].map((kind) => (
          <div
            key={kind}
            className="sc-html-host sc-projected-plane"
            ref={(el) => {
              panelRefs.current[kind] = el;
            }}
          >
            <EvidencePlane
              kind={kind}
              selectedField={props.selectedField}
              onSelect={props.onSelect}
              selectedRule={props.selectedRule}
              onSelectRule={props.onSelectRule}
              inCanvas
            />
          </div>
        ))}
      </div>
    </>
  );
}
