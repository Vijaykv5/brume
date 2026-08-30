"use client";

import { useFrame } from "@react-three/fiber";
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
const FLIGHT_START_X = -42;
const FLIGHT_END_X = 48;
const FLIGHT_BASE_Y = 17;
const FLIGHT_BASE_Z = -12;
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
  const leftWingRef = useRef<THREE.Group>(null);
  const rightWingRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!birdRef.current || !leftWingRef.current || !rightWingRef.current) return;

    const elapsed = clock.getElapsedTime();
    const time = elapsed * (reducedMotion ? 1.6 : 7.2) + flapOffset;
    const flap = Math.sin(time);
    const wingAngle = flap * (reducedMotion ? 0.28 : 0.86);

    birdRef.current.position.y = Math.sin(time * 0.45) * 0.04;
    birdRef.current.rotation.z = Math.sin(time * 0.32) * 0.04;
    leftWingRef.current.rotation.x = -0.28 - wingAngle;
    rightWingRef.current.rotation.x = 0.28 + wingAngle;
  });

  return (
    <group position={position} scale={scale} raycast={() => null}>
      <group ref={birdRef} rotation={[0.04, -0.28, 0]}>
        <group
          ref={leftWingRef}
          position={[-0.04, 0.04, 0.14]}
          rotation={[-0.28, 0.08, 0.08]}
        >
          <mesh>
            <extrudeGeometry
              args={[WING_SHAPE, { depth: 0.035, bevelEnabled: false }]}
            />
            <meshStandardMaterial
              color={palette.wing}
              roughness={0.72}
              metalness={0}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
        <group
          ref={rightWingRef}
          position={[-0.04, 0.04, -0.14]}
          rotation={[0.28, -0.08, 0.08]}
          scale={[1, 1, -1]}
        >
          <mesh>
            <extrudeGeometry
              args={[WING_SHAPE, { depth: 0.035, bevelEnabled: false }]}
            />
            <meshStandardMaterial
              color={palette.wing}
              roughness={0.72}
              metalness={0}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
        <mesh scale={[1.28, 0.54, 0.34]}>
          <sphereGeometry args={[0.16, 14, 10]} />
          <meshStandardMaterial color={palette.body} roughness={0.62} />
        </mesh>
        <mesh position={[0.05, -0.035, 0.01]} scale={[0.86, 0.34, 0.22]}>
          <sphereGeometry args={[0.13, 12, 8]} />
          <meshStandardMaterial color={palette.chest} roughness={0.66} />
        </mesh>
        <mesh position={[0.2, 0.02, 0]} scale={[0.7, 0.7, 0.7]}>
          <sphereGeometry args={[0.09, 12, 8]} />
          <meshStandardMaterial color={palette.body} roughness={0.62} />
        </mesh>
        <mesh position={[0.3, 0.02, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.024, 0.13, 4]} />
          <meshStandardMaterial color={palette.beak} roughness={0.58} />
        </mesh>
        <mesh
          position={[-0.25, 0.035, 0.055]}
          rotation={[0.18, 0.08, -0.56]}
          scale={[1, 1, 0.65]}
        >
          <coneGeometry args={[0.04, 0.24, 3]} />
          <meshStandardMaterial color={palette.tail} roughness={0.76} />
        </mesh>
        <mesh
          position={[-0.25, 0.035, -0.055]}
          rotation={[-0.18, -0.08, -0.56]}
          scale={[1, 1, 0.65]}
        >
          <coneGeometry args={[0.04, 0.24, 3]} />
          <meshStandardMaterial color={palette.tail} roughness={0.76} />
        </mesh>
      </group>
    </group>
  );
}

export function SkyBirds() {
  const groupRef = useRef<THREE.Group>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mediaQuery.matches);

    update();
    mediaQuery.addEventListener("change", update);

    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;

    const range = FLIGHT_END_X - FLIGHT_START_X;
    const speed = reducedMotion ? FLIGHT_SPEED * 0.35 : FLIGHT_SPEED;
    const flightDuration = range / speed;
    const cycleDuration = flightDuration + FLIGHT_REST_SECONDS;
    const cycleTime = clock.getElapsedTime() % cycleDuration;

    groupRef.current.visible = cycleTime <= flightDuration;
    if (!groupRef.current.visible) return;

    const elapsed = clock.getElapsedTime();
    const progress = cycleTime / flightDuration;
    const x = FLIGHT_START_X + range * progress;
    const y = FLIGHT_BASE_Y + Math.sin(elapsed * 0.75) * 0.5;
    const z = FLIGHT_BASE_Z + Math.sin(progress * Math.PI * 2) * 6;
    const velocityX = range;
    const velocityZ = Math.cos(progress * Math.PI * 2) * Math.PI * 12;
    const travelYaw = Math.atan2(-velocityZ, velocityX);

    groupRef.current.position.set(x, y, z);
    groupRef.current.rotation.set(
      Math.sin(elapsed * 0.55) * 0.04,
      travelYaw,
      Math.sin(progress * Math.PI * 2) * -0.16,
    );
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
