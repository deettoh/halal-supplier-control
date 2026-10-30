import React, { Suspense, useMemo, useRef, useEffect } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei/web/Html";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MathUtils, PCFShadowMap } from "three";
import { scenePose } from "./scene-pose.js";
import { EvidencePlane } from "./panels.jsx";

function ConsoleModel({
  progressRef,
  invalidateRef,
  selectedField,
  onSelect,
  onReady,
  onFailure,
}) {
  const gltf = useLoader(GLTFLoader, "/media/signal-console.glb");
  const root = useRef(),
    htmlGroups = useRef({});
  const { viewport, size, camera, invalidate, gl } = useThree();
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
    if (!root.current || size.width <= 0 || size.height <= 0) return;
    const pose = scenePose(progressRef.current.value);
    const view = viewport.getCurrentViewport(camera, [0, 0, 0]);
    const compact = Math.min(
      (size.width * 0.515) / 960,
      (size.height * 0.63) / 540,
    );
    const full = Math.min(
      (size.width * 0.92) / 960,
      (size.height * 0.68) / 540,
    );
    const pixelScale =
      (compact + (full - compact) * pose.expand) *
      (1 - pose.open * 0.24) *
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
    ].forEach(([kind, node, key]) => {
      const position = pose[key];
      const object = model.getObjectByName(node);
      if (object) object.position.set(...position);
      if (htmlGroups.current[kind])
        htmlGroups.current[kind].position.set(
          position[0],
          position[1],
          position[2] + 0.055,
        );
    });
    ["Shell", "Edge"].forEach((name) => {
      const o = model.getObjectByName(name);
      if (o)
        o.material.opacity = 1 - pose.open * (name === "Shell" ? 0.92 : 0.62);
    });
    root.current.updateWorldMatrix(true, true);
  }, -1);
  return (
    <group ref={root}>
      <primitive object={model} dispose={null} />
      {["source", "reading", "rules"].map((kind) => (
        <group
          ref={(el) => {
            htmlGroups.current[kind] = el;
          }}
          key={kind}
        >
          <Html
            transform
            distanceFactor={4}
            zIndexRange={[20, 5]}
            wrapperClass="sc-html-host"
          >
            <EvidencePlane
              kind={kind}
              selectedField={selectedField}
              onSelect={onSelect}
              inCanvas
            />
          </Html>
        </group>
      ))}
    </group>
  );
}
export default function SceneCanvas(props) {
  return (
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
        <ConsoleModel {...props} />
      </Suspense>
    </Canvas>
  );
}
