"use client";

import { ContactShadows, OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ComponentRef } from "react";
import * as THREE from "three";
import { Building } from "./Building";

const ISLAND_WIDTH = 24.5;
const ISLAND_DEPTH = 14;
const ISLAND_RADIUS = 2.1;
const CAMERA_ELEVATION = THREE.MathUtils.degToRad(10);
const CAMERA_AZIMUTH = THREE.MathUtils.degToRad(2);
const CAMERA_VIEW_DIRECTION = new THREE.Vector3(
  Math.sin(CAMERA_AZIMUTH) * Math.cos(CAMERA_ELEVATION),
  Math.sin(CAMERA_ELEVATION),
  Math.cos(CAMERA_AZIMUTH) * Math.cos(CAMERA_ELEVATION),
).normalize();
const ISLAND_BOUNDS = new THREE.Box3(
  new THREE.Vector3(-11.1, -0.55, -7.35),
  new THREE.Vector3(11.1, 0.55, 7.35),
);
const BUILDING_BOUNDS = new THREE.Box3(
  new THREE.Vector3(-7.3, 0.45, -4.35),
  new THREE.Vector3(-3.1, 4.25, -1.25),
);
const PRICE_BADGE_CENTER = new THREE.Vector3(-3.77, 5, -2.8);
const PRICE_BADGE_RADIUS = 0.68;

function createRoundedIslandGeometry(width: number, depth: number, height: number) {
  const x = -width / 2;
  const y = -depth / 2;
  const shape = new THREE.Shape();

  shape.moveTo(x + ISLAND_RADIUS, y);
  shape.lineTo(x + width - ISLAND_RADIUS, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + ISLAND_RADIUS);
  shape.lineTo(x + width, y + depth - ISLAND_RADIUS);
  shape.quadraticCurveTo(x + width, y + depth, x + width - ISLAND_RADIUS, y + depth);
  shape.lineTo(x + ISLAND_RADIUS, y + depth);
  shape.quadraticCurveTo(x, y + depth, x, y + depth - ISLAND_RADIUS);
  shape.lineTo(x, y + ISLAND_RADIUS);
  shape.quadraticCurveTo(x, y, x + ISLAND_RADIUS, y);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: true,
    bevelSegments: 5,
    bevelSize: 0.18,
    bevelThickness: 0.12,
    curveSegments: 12,
    steps: 1,
  });

  geometry.translate(0, 0, -height / 2);
  geometry.rotateX(-Math.PI / 2);
  geometry.computeVertexNormals();

  return geometry;
}

function IslandLayer({
  height,
  y,
  topColor,
  sideColor,
}: {
  height: number;
  y: number;
  topColor: string;
  sideColor: string;
}) {
  const geometry = useMemo(
    () => createRoundedIslandGeometry(ISLAND_WIDTH, ISLAND_DEPTH, height),
    [height],
  );
  const materials = useMemo(
    () => [
      new THREE.MeshStandardMaterial({
        color: topColor,
        roughness: 0.86,
        metalness: 0,
      }),
      new THREE.MeshStandardMaterial({
        color: sideColor,
        roughness: 0.92,
        metalness: 0,
      }),
    ],
    [sideColor, topColor],
  );

  return (
    <mesh
      castShadow
      receiveShadow
      geometry={geometry}
      material={materials}
      position={[0, y, 0]}
    />
  );
}

function GrassPatches() {
  const patches = useMemo(
    () =>
      [
        [-7.8, -4.8, 1.8, 0.9, 0.2, "#8bc86c"],
        [-4.6, -5.6, 1.3, 0.7, -0.35, "#76b85d"],
        [0.2, -5.7, 1.8, 0.8, 0.12, "#96d27c"],
        [4.9, -5.3, 1.5, 0.72, 0.5, "#80bf64"],
        [7.9, -3.9, 1.4, 0.68, -0.25, "#9bd782"],
        [-8.4, 0.1, 1.5, 0.75, 0.4, "#7ebc62"],
        [8.2, 0.6, 1.7, 0.82, -0.42, "#91ce75"],
        [-7.0, 4.9, 1.6, 0.78, -0.1, "#93ce77"],
        [-2.9, 5.5, 1.4, 0.68, 0.38, "#79b95d"],
        [2.9, 5.3, 1.9, 0.82, -0.18, "#8cca6e"],
        [6.9, 4.6, 1.35, 0.66, 0.22, "#78b75d"],
      ] as const,
    [],
  );

  return (
    <group position={[0, 0.43, 0]}>
      {patches.map(([x, z, width, depth, rotation, color]) => (
        <mesh
          key={`${x}-${z}`}
          position={[x, 0.01, z]}
          rotation={[-Math.PI / 2, 0, rotation]}
          scale={[width, depth, 1]}
          receiveShadow
        >
          <circleGeometry args={[1, 22]} />
          <meshStandardMaterial
            color={color}
            roughness={0.95}
            transparent
            opacity={0.42}
          />
        </mesh>
      ))}
    </group>
  );
}

function GrassTuft({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {[-0.16, 0, 0.15].map((offset, index) => (
        <mesh
          key={offset}
          castShadow
          position={[offset, 0.18, index === 1 ? 0.04 : 0]}
          rotation={[0, 0, offset * 1.6]}
        >
          <coneGeometry args={[0.08, 0.45, 5]} />
          <meshStandardMaterial color="#5d9f47" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

function Rock({
  position,
  scale,
}: {
  position: [number, number, number];
  scale: number;
}) {
  return (
    <mesh castShadow receiveShadow position={position} scale={[scale, scale * 0.55, scale]}>
      <dodecahedronGeometry args={[0.42, 0]} />
      <meshStandardMaterial color="#8f9488" roughness={0.96} />
    </mesh>
  );
}

function EdgeDecorations() {
  return (
    <group position={[0, 0.46, 0]}>
      <GrassTuft position={[-8.4, 0, -4.4]} />
      <GrassTuft position={[-6.2, 0, 5.0]} />
      <GrassTuft position={[-1.8, 0, -5.7]} />
      <GrassTuft position={[4.8, 0, 5.2]} />
      <GrassTuft position={[8.2, 0, -2.4]} />
      <GrassTuft position={[7.4, 0, 3.7]} />

      <Rock position={[-7.9, 0.12, 2.2]} scale={0.75} />
      <Rock position={[-3.4, 0.1, -5.2]} scale={0.56} />
      <Rock position={[3.6, 0.1, 5.4]} scale={0.64} />
      <Rock position={[8.1, 0.1, 1.4]} scale={0.52} />
    </group>
  );
}

function FloatingIsland() {
  return (
    <group>
      <IslandLayer height={0.62} y={-0.09} topColor="#526d39" sideColor="#526d39" />
      <IslandLayer height={0.12} y={0.28} topColor="#8a5a31" sideColor="#8a5a31" />
      <IslandLayer height={0.08} y={0.38} topColor="#7fbe61" sideColor="#6cab52" />
      <GrassPatches />
      <EdgeDecorations />
      <Building
        domain="google.com"
        price="$1"
        position={[-5.2, 0.45, -2.8]}
        width={4.2}
        height={3.4}
        depth={3.1}
        primaryColor="#f3f0e7"
        logoUrl=""
      />
    </group>
  );
}

function getBoundsCorners(bounds: THREE.Box3) {
  const { min, max } = bounds;

  return [min.x, max.x].flatMap((x) =>
    [min.y, max.y].flatMap((y) =>
      [min.z, max.z].map((z) => new THREE.Vector3(x, y, z)),
    ),
  );
}

function getVisibleScenePoints(right: THREE.Vector3, cameraUp: THREE.Vector3) {
  const badgeCorners = [-1, 1].flatMap((horizontalDirection) =>
    [-1, 1].map((verticalDirection) =>
      PRICE_BADGE_CENTER.clone()
        .addScaledVector(right, PRICE_BADGE_RADIUS * horizontalDirection)
        .addScaledVector(cameraUp, PRICE_BADGE_RADIUS * verticalDirection),
    ),
  );

  return [
    ...getBoundsCorners(ISLAND_BOUNDS),
    ...getBoundsCorners(BUILDING_BOUNDS),
    ...badgeCorners,
  ];
}

function getProjectedBoundsCenter(
  points: THREE.Vector3[],
  right: THREE.Vector3,
  cameraUp: THREE.Vector3,
) {
  const axes = [right, cameraUp, CAMERA_VIEW_DIRECTION];
  const midpoints = axes.map((axis) => {
    const values = points.map((point) => point.dot(axis));
    return (Math.min(...values) + Math.max(...values)) / 2;
  });

  return right
    .clone()
    .multiplyScalar(midpoints[0])
    .addScaledVector(cameraUp, midpoints[1])
    .addScaledVector(CAMERA_VIEW_DIRECTION, midpoints[2]);
}

function getCameraFraming(aspect: number) {
  const isMobile = aspect < 0.75;
  const isTablet = aspect >= 0.75 && aspect < 1.35;
  const horizontalLimit = isMobile ? 0.9 : isTablet ? 0.84 : 0.79;
  const verticalTopLimit = isMobile ? 0.64 : isTablet ? 0.57 : 0.52;
  const verticalBottomLimit = isMobile ? -0.9 : isTablet ? -0.88 : -0.86;
  const fov = isMobile ? 40 : isTablet ? 37 : 34;
  const fitVerticalBias = isMobile ? 0.1 : 0.14;
  const compositionVerticalBias = isMobile ? 0.28 : isTablet ? 0.18 : 0.24;
  const tangent = Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const forward = CAMERA_VIEW_DIRECTION.clone().negate();
  const right = new THREE.Vector3().crossVectors(forward, THREE.Object3D.DEFAULT_UP).normalize();
  const cameraUp = new THREE.Vector3().crossVectors(right, forward).normalize();
  const visiblePoints = getVisibleScenePoints(right, cameraUp);
  const center = getProjectedBoundsCenter(visiblePoints, right, cameraUp);

  const fitsAtDistance = (distance: number) => {
    const targetOffset = fitVerticalBias * distance * tangent;
    const target = center.clone().addScaledVector(cameraUp, targetOffset);

    return visiblePoints.every((point) => {
      const relative = point.clone().sub(target);
      const depth = distance - relative.dot(CAMERA_VIEW_DIRECTION);
      if (depth <= 0) return false;

      const normalizedX = relative.dot(right) / (depth * tangent * aspect);
      const normalizedY = relative.dot(cameraUp) / (depth * tangent);

      return (
        Math.abs(normalizedX) <= horizontalLimit &&
        normalizedY <= verticalTopLimit &&
        normalizedY >= verticalBottomLimit
      );
    });
  };

  let nearDistance = 6;
  let farDistance = 140;
  for (let iteration = 0; iteration < 48; iteration += 1) {
    const middleDistance = (nearDistance + farDistance) / 2;
    if (fitsAtDistance(middleDistance)) {
      farDistance = middleDistance;
    } else {
      nearDistance = middleDistance;
    }
  }

  const closeFitScale = isMobile
    ? 0.96
    : isTablet
      ? 0.9
      : aspect < 1.7
        ? 0.9
        : 0.86;
  const distance = farDistance * closeFitScale;
  const target = center
    .clone()
    .addScaledVector(cameraUp, compositionVerticalBias * distance * tangent);
  const position = target
    .clone()
    .addScaledVector(CAMERA_VIEW_DIRECTION, distance);

  return {
    fov,
    position: position.toArray() as [number, number, number],
    target: target.toArray() as [number, number, number],
    minTargetY: target.y - 0.7,
    maxTargetY: target.y + 0.7,
  };
}

function CameraRig() {
  const { set, size } = useThree();
  const aspect = size.width / Math.max(size.height, 1);
  const framing = useMemo(() => getCameraFraming(aspect), [aspect]);
  const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null);
  const defaultTarget = useMemo(
    () => new THREE.Vector3(...framing.target),
    [framing.target],
  );
  const fittedCamera = useMemo(() => {
    const nextCamera = new THREE.PerspectiveCamera(
      framing.fov,
      aspect,
      0.1,
      140,
    );
    nextCamera.position.fromArray(framing.position);
    nextCamera.lookAt(defaultTarget);
    nextCamera.updateProjectionMatrix();
    nextCamera.updateMatrixWorld();
    return nextCamera;
  }, [aspect, defaultTarget, framing.fov, framing.position]);
  const correctingMovement = useRef(false);
  const constrainMovement = useCallback(() => {
    const controls = controlsRef.current;
    if (!controls || correctingMovement.current) return;

    const constrainedY = THREE.MathUtils.clamp(
      controls.target.y,
      framing.minTargetY,
      framing.maxTargetY,
    );
    const correction = new THREE.Vector3(
      controls.target.x - defaultTarget.x,
      controls.target.y - constrainedY,
      controls.target.z - defaultTarget.z,
    );

    if (correction.lengthSq() < 0.000001) return;

    correctingMovement.current = true;
    controls.object.position.sub(correction);
    controls.target.set(defaultTarget.x, constrainedY, defaultTarget.z);
    controls.object.lookAt(controls.target);
    correctingMovement.current = false;
  }, [defaultTarget, framing.maxTargetY, framing.minTargetY]);

  useLayoutEffect(() => {
    set({ camera: fittedCamera });

    const controls = controlsRef.current;
    if (controls) {
      controls.target.copy(defaultTarget);
      controls.update();
    }
  }, [defaultTarget, fittedCamera, set]);

  return (
    <OrbitControls
      ref={controlsRef}
      camera={fittedCamera}
      enableDamping={false}
      enablePan
      enableRotate
      enableZoom={false}
      minPolarAngle={0.35}
      maxPolarAngle={Math.PI / 2.25}
      screenSpacePanning
      mouseButtons={{
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.PAN,
        RIGHT: THREE.MOUSE.PAN,
      }}
      touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.PAN }}
      target={framing.target}
      onChange={constrainMovement}
    />
  );
}

export function SceneCanvas() {
  const [resetToken, setResetToken] = useState(0);

  return (
    <div className="scene-stage">
      <Canvas
        className="scene-canvas"
        shadows={{ type: THREE.PCFShadowMap }}
        camera={{ fov: 36, near: 0.1, far: 140, position: [22, 24, 16] }}
        gl={{ antialias: true, alpha: true }}
        onCreated={({ gl }) => {
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.PCFShadowMap;
          gl.setClearAlpha(0);
        }}
      >
        <fog attach="fog" args={["#bfe8ff", 55, 120]} />
        <ambientLight intensity={0.82} />
        <directionalLight
          castShadow
          color="#ffe2b5"
          intensity={1.65}
          position={[-10, 16, 8]}
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-18}
          shadow-camera-right={18}
          shadow-camera-top={18}
          shadow-camera-bottom={-18}
          shadow-camera-near={1}
          shadow-camera-far={50}
        />
        <FloatingIsland />
        <ContactShadows
          position={[0, -0.78, 0]}
          opacity={0.18}
          scale={24}
          blur={3.8}
          far={5}
          color="#7aa7bd"
        />
        <CameraRig key={resetToken} />
      </Canvas>
      <button
        className="reset-camera-button"
        type="button"
        onClick={() => setResetToken((token) => token + 1)}
      >
        Reset camera
      </button>
    </div>
  );
}
