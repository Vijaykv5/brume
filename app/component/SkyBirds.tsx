"use client";

import { Billboard } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

type BirdPalette = {
  body: string;
  wing: string;
  chest: string;
  beak: string;
  tail: string;
};

const BIRD_FORMATION: [number, number, number, number, BirdPalette][] = [
  [
    0,
    0,
    0,
    0,
    {
      body: "#3f5f7a",
      wing: "#273b4f",
      chest: "#d7e0d2",
      beak: "#d59b43",
      tail: "#223241",
    },
  ],
  [
    2.15,
    -0.24,
    -0.24,
    0.7,
    {
      body: "#6f6b55",
      wing: "#4a493b",
      chest: "#eadfbd",
      beak: "#c98836",
      tail: "#38362c",
    },
  ],
  [
    4.05,
    -0.08,
    0.16,
    1.4,
    {
      body: "#536d48",
      wing: "#33452f",
      chest: "#d7e4b7",
      beak: "#dba24a",
      tail: "#263424",
    },
  ],
];
const FLIGHT_SPEED = 4.8;
const FLIGHT_DEPTH = 36;
const FLIGHT_SCREEN_Y = 0.42;
const FLIGHT_SCREEN_MARGIN = 0.18;
const FLIGHT_REST_SECONDS = 30;
const WING_SHAPE = new THREE.Shape()
  .moveTo(0, 0)
  .quadraticCurveTo(-0.18, 0.18, -0.48, 0.16)
  .quadraticCurveTo(-0.35, 0.02, 0, 0);

function FlyingBird({
  position,
  scale,
  flapOffset,
  palette,
  reducedMotion,
}: {
  position: [number, number, number];
  scale: number;
  flapOffset: number;
  palette: BirdPalette;
  reducedMotion: boolean;
}) {
  const birdRef = useRef<THREE.Group>(null);
  const upperWingRef = useRef<THREE.Group>(null);
  const lowerWingRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!birdRef.current || !upperWingRef.current || !lowerWingRef.current) return;

    const elapsed = clock.getElapsedTime();
    const time = elapsed * (reducedMotion ? 1.6 : 7.2) + flapOffset;
    const flap = Math.sin(time);
    const wingAngle = flap * (reducedMotion ? 0.28 : 0.92);

    birdRef.current.position.y = Math.sin(time * 0.45) * 0.04;
    upperWingRef.current.rotation.z = 0.38 + wingAngle;
    lowerWingRef.current.rotation.z = -0.3 - wingAngle * 0.72;
  });

  return (
    <Billboard position={position} scale={scale} follow raycast={() => null}>
      <group ref={birdRef}>
        <group ref={upperWingRef} position={[-0.05, 0.03, 0.02]}>
          <mesh>
            <shapeGeometry args={[WING_SHAPE]} />
            <meshBasicMaterial color={palette.wing} side={THREE.DoubleSide} />
          </mesh>
        </group>
        <group
          ref={lowerWingRef}
          position={[-0.05, -0.03, 0.02]}
          scale={[1, -1, 1]}
        >
          <mesh>
            <shapeGeometry args={[WING_SHAPE]} />
            <meshBasicMaterial color={palette.wing} side={THREE.DoubleSide} />
          </mesh>
        </group>
        <mesh scale={[1.28, 0.54, 0.34]}>
          <sphereGeometry args={[0.16, 12, 8]} />
          <meshBasicMaterial color={palette.body} />
        </mesh>
        <mesh position={[0.05, -0.035, 0.01]} scale={[0.86, 0.34, 0.22]}>
          <sphereGeometry args={[0.13, 10, 6]} />
          <meshBasicMaterial color={palette.chest} />
        </mesh>
        <mesh position={[0.2, 0.02, 0]} scale={[0.7, 0.7, 0.7]}>
          <sphereGeometry args={[0.09, 10, 6]} />
          <meshBasicMaterial color={palette.body} />
        </mesh>
        <mesh position={[0.3, 0.02, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.024, 0.13, 4]} />
          <meshBasicMaterial color={palette.beak} />
        </mesh>
        <mesh position={[-0.25, 0.035, 0]} rotation={[0, 0, -0.48]}>
          <boxGeometry args={[0.2, 0.018, 0.02]} />
          <meshBasicMaterial color={palette.tail} />
        </mesh>
        <mesh position={[-0.25, -0.035, 0]} rotation={[0, 0, 0.48]}>
          <boxGeometry args={[0.2, 0.018, 0.02]} />
          <meshBasicMaterial color={palette.tail} />
        </mesh>
      </group>
    </Billboard>
  );
}

export function SkyBirds() {
  const groupRef = useRef<THREE.Group>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mediaQuery.matches);

    update();
    mediaQuery.addEventListener("change", update);

    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;

    const perspectiveCamera = camera as THREE.PerspectiveCamera;
    const aspect = size.width / Math.max(size.height, 1);
    const visibleHeight =
      2 * Math.tan(THREE.MathUtils.degToRad(perspectiveCamera.fov / 2)) * FLIGHT_DEPTH;
    const visibleWidth = visibleHeight * aspect;
    const startX = visibleWidth * (-0.5 - FLIGHT_SCREEN_MARGIN);
    const endX = visibleWidth * (0.5 + FLIGHT_SCREEN_MARGIN);
    const range = endX - startX;
    const speed = reducedMotion ? FLIGHT_SPEED * 0.35 : FLIGHT_SPEED;
    const flightDuration = range / speed;
    const cycleDuration = flightDuration + FLIGHT_REST_SECONDS;
    const cycleTime = clock.getElapsedTime() % cycleDuration;
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    const up = new THREE.Vector3();

    groupRef.current.visible = cycleTime <= flightDuration;
    if (!groupRef.current.visible) return;

    const progress = cycleTime * speed;

    camera.getWorldDirection(forward);
    right.crossVectors(forward, camera.up).normalize();
    up.crossVectors(right, forward).normalize();

    groupRef.current.quaternion.copy(camera.quaternion);
    groupRef.current.position
      .copy(camera.position)
      .addScaledVector(forward, FLIGHT_DEPTH)
      .addScaledVector(right, startX + progress)
      .addScaledVector(up, visibleHeight * FLIGHT_SCREEN_Y)
      .addScaledVector(up, Math.sin(clock.getElapsedTime() * 0.75) * 0.12);
  });

  return (
    <group
      ref={groupRef}
      position={[0, 0, 0]}
      raycast={() => null}
    >
      {BIRD_FORMATION.map(([x, y, z, flapOffset, palette], index) => (
        <FlyingBird
          key={index}
          position={[x, y, z]}
          scale={0.78 - index * 0.07}
          flapOffset={flapOffset}
          palette={palette}
          reducedMotion={reducedMotion}
        />
      ))}
    </group>
  );
}
