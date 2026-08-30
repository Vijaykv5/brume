"use client";

import { ContactShadows, OrbitControls, Text } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ComponentRef } from "react";
import * as THREE from "three";
import type { BuildingType, SavedBuilding } from "@/lib/buildings";
import { getWebsiteFaviconUrl } from "@/lib/favicon";
import {
  SmallOfficeBuilding,
  type SmallOfficeBuildingProps,
} from "./component/SmallOfficeBuilding";
import {
  OfficeBuilding,
  type OfficeBuildingProps,
} from "./component/OfficeBuilding";
import {
  SignalTower,
  type SignalTowerProps,
} from "./component/SignalTower";
import { WebsiteBillboard } from "./component/WebsiteBillboard";
import {
  AddBuildingPanel,
  type BuildingPreviewData,
} from "./component/AddBuildingPanel";
import { AnalyticsStatsPill } from "./component/AnalyticsStatsPill";
import {
  BuildingHoverCard,
  type BuildingHoverCardData,
} from "./component/BuildingHoverCard";
import { SkyBirds } from "./component/SkyBirds";

const CAMERA_ELEVATION = THREE.MathUtils.degToRad(10);
const CAMERA_AZIMUTH = THREE.MathUtils.degToRad(2);
const CAMERA_VIEW_DIRECTION = new THREE.Vector3(
  Math.sin(CAMERA_AZIMUTH) * Math.cos(CAMERA_ELEVATION),
  Math.sin(CAMERA_ELEVATION),
  Math.cos(CAMERA_AZIMUTH) * Math.cos(CAMERA_ELEVATION),
).normalize();
const CITY_FRAMING_BOUNDS = new THREE.Box3(
  new THREE.Vector3(-24, -0.55, -18),
  new THREE.Vector3(26, 0.55, 18),
);
const BUILDING_BOUNDS = new THREE.Box3(
  new THREE.Vector3(-9.3, 0.45, -2.65),
  new THREE.Vector3(-5.1, 4.25, 0.45),
);
const OFFICE_BUILDING_BOUNDS = new THREE.Box3(
  new THREE.Vector3(-1.1, 0.56, -9.2),
  new THREE.Vector3(5.5, 11.25, -5),
);
const SIGNAL_TOWER_BOUNDS = new THREE.Box3(
  new THREE.Vector3(11.9, 0.46, 0.95),
  new THREE.Vector3(18.9, 18.1, 6.45),
);
const PRICE_BADGE_CENTER = new THREE.Vector3(-5.77, 5, -0.55);
const PRICE_BADGE_RADIUS = 0.68;
const SMALL_OFFICE_BUILDING: SmallOfficeBuildingProps = {
  plotId: "A1",
  name: "google.com",
  domain: "google.com",
  price: "$1",
  domainUrl: "https://google.com",
  position: [-7.2, 0.45, -1.1],
  width: 4.2,
  height: 3.4,
  depth: 3.1,
  primaryColor: "#f3f0e7",
};
const STATIC_SMALL_OFFICE_HOVER: BuildingHoverCardData = {
  id: "static-google",
  name: "google.com",
  domain: "google.com",
  clickCount: 0,
};
const OFFICE_BUILDING: OfficeBuildingProps = {
  plotId: "A2",
  name: "Hey, clicky",
  domain: "heyclicky.com",
  price: "$3",
  domainUrl: "https://heyclicky.com",
  position: [2.2, 0.56, -7.1],
  width: 6.6,
  height: 10.2,
  depth: 4.2,
  showLabels: false,
};
const STATIC_OFFICE_HOVER: BuildingHoverCardData = {
  id: "static-heyclicky",
  name: "Hey, clicky",
  domain: "heyclicky.com",
  clickCount: 0,
};
const SIGNAL_TOWER: SignalTowerProps = {
  plotId: "A4",
  name: "A4 Tower",
  domain: "heyclicky.com",
  price: "$5",
  domainUrl: "https://heyclicky.com",
  position: [15.4, 0.56, 3.7],
  height: 13.4,
  baseWidth: 7,
  depth: 5.5,
};
const STATIC_TOWER_HOVER: BuildingHoverCardData = {
  id: "static-tower",
  name: "A4 Tower",
  domain: "heyclicky.com",
  clickCount: 0,
};
type StaticBuildingId =
  | typeof STATIC_SMALL_OFFICE_HOVER.id
  | typeof STATIC_OFFICE_HOVER.id
  | typeof STATIC_TOWER_HOVER.id;

const STATIC_BUILDING_CLICK_STORAGE_KEY = "buildyourcity:static-building-clicks";
const STATIC_BUILDING_IDS = [
  STATIC_SMALL_OFFICE_HOVER.id,
  STATIC_OFFICE_HOVER.id,
  STATIC_TOWER_HOVER.id,
] as const;

type TreePlacement = {
  position: [number, number, number];
  scale: number;
  rotation: number;
  leaf: string;
  leafAccent: string;
};

type AddedBuilding = SavedBuilding;

type CameraFocusRequest = {
  id: string;
  target: [number, number, number];
  distance: number;
};

const TREE_PLACEMENTS: TreePlacement[] = [
  {
    position: [-24, 0.46, -18],
    scale: 1.36,
    rotation: -0.4,
    leaf: "#86bf61",
    leafAccent: "#c9e8a5",
  },
  {
    position: [-17, 0.46, 16],
    scale: 0.96,
    rotation: 0.65,
    leaf: "#5f9e48",
    leafAccent: "#b9df8d",
  },
  {
    position: [12, 0.46, -20],
    scale: 1.16,
    rotation: -0.55,
    leaf: "#72ad50",
    leafAccent: "#d2efad",
  },
  {
    position: [24, 0.46, 15],
    scale: 1.48,
    rotation: -0.85,
    leaf: "#6faf4d",
    leafAccent: "#d8f0b4",
  },
  {
    position: [34, 0.46, -8],
    scale: 0.88,
    rotation: 0.35,
    leaf: "#5f9b46",
    leafAccent: "#bae18d",
  },
  {
    position: [-35, 0.46, 4],
    scale: 1.08,
    rotation: -0.35,
    leaf: "#6cae4e",
    leafAccent: "#d6f1af",
  },
  {
    position: [-47, 0.46, -24],
    scale: 0.92,
    rotation: 0.45,
    leaf: "#76b456",
    leafAccent: "#c8eaa1",
  },
  {
    position: [-42, 0.46, 27],
    scale: 1.24,
    rotation: -0.95,
    leaf: "#5f9e48",
    leafAccent: "#c1e596",
  },
  {
    position: [-8, 0.46, 35],
    scale: 0.86,
    rotation: 0.2,
    leaf: "#82bd5f",
    leafAccent: "#d4efb0",
  },
  {
    position: [18, 0.46, 36],
    scale: 1.14,
    rotation: 1.05,
    leaf: "#6daa4e",
    leafAccent: "#cdeba5",
  },
  {
    position: [43, 0.46, 24],
    scale: 0.98,
    rotation: -0.25,
    leaf: "#7eb95d",
    leafAccent: "#d7f1b6",
  },
  {
    position: [49, 0.46, -22],
    scale: 1.32,
    rotation: 0.72,
    leaf: "#679f4a",
    leafAccent: "#c5e89b",
  },
  {
    position: [6, 0.46, -38],
    scale: 0.8,
    rotation: -0.7,
    leaf: "#8ac466",
    leafAccent: "#dcf3bb",
  },
  {
    position: [-58, 0.46, 6],
    scale: 1.42,
    rotation: 0.38,
    leaf: "#6ea94f",
    leafAccent: "#c9eaa2",
  },
  {
    position: [64, 0.46, 4],
    scale: 1.08,
    rotation: -1.15,
    leaf: "#7fba5e",
    leafAccent: "#d5efb1",
  },
  {
    position: [-54, 0.46, -42],
    scale: 1.18,
    rotation: 0.88,
    leaf: "#5f9c46",
    leafAccent: "#bde28f",
  },
  {
    position: [50, 0.46, 45],
    scale: 1.34,
    rotation: -0.42,
    leaf: "#74b455",
    leafAccent: "#d8f2b4",
  },
  {
    position: [-12, 0.46, 62],
    scale: 0.98,
    rotation: 1.24,
    leaf: "#88c265",
    leafAccent: "#ddf3be",
  },
  {
    position: [30, 0.46, -56],
    scale: 1.52,
    rotation: -0.96,
    leaf: "#689f4b",
    leafAccent: "#c6e79c",
  },
];

function WorldPlot() {
  return (
    <group>
      <mesh receiveShadow position={[0, 0.27, 0]}>
        <cylinderGeometry args={[140, 140, 0.34, 96, 1, true]} />
        <meshStandardMaterial color="#526d39" roughness={0.92} metalness={0} />
      </mesh>
      <mesh receiveShadow position={[0, 0.445, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[140, 96]} />
        <meshStandardMaterial color="#7fbe61" roughness={0.88} metalness={0} />
      </mesh>
    </group>
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
        [10.2, -5.7, 1.4, 0.68, -0.25, "#9bd782"],
        [-8.4, 0.1, 1.5, 0.75, 0.4, "#7ebc62"],
        [8.2, 0.6, 1.7, 0.82, -0.42, "#91ce75"],
        [-7.0, 4.9, 1.6, 0.78, -0.1, "#93ce77"],
        [-2.9, 5.5, 1.4, 0.68, 0.38, "#79b95d"],
        [2.9, 5.3, 1.9, 0.82, -0.18, "#8cca6e"],
        [6.9, 4.6, 1.35, 0.66, 0.22, "#78b75d"],
        [-48, 18, 3.2, 1.35, 0.38, "#8fca70"],
        [-32, -44, 2.5, 1.05, -0.4, "#75b75d"],
        [36, -36, 3.4, 1.25, 0.2, "#9bd780"],
        [54, 26, 2.7, 1.15, -0.62, "#81bf64"],
        [-18, 50, 3.1, 1.2, 0.72, "#8aca69"],
        [18, 54, 2.4, 0.95, -0.28, "#95d078"],
        [-62, -12, 2.6, 1.1, 0.1, "#78b95e"],
        [62, -8, 3.0, 1.26, -0.18, "#8dcc6f"],
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

function Tree({
  position,
  scale,
  rotation,
  leaf,
  leafAccent,
}: {
  position: [number, number, number];
  scale: number;
  rotation: number;
  leaf: string;
  leafAccent: string;
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]} scale={scale}>
      <mesh castShadow receiveShadow position={[0, 0.48, 0]}>
        <cylinderGeometry args={[0.18, 0.28, 0.96, 8]} />
        <meshStandardMaterial color="#b98b58" roughness={0.86} />
      </mesh>
      <mesh castShadow position={[-0.2, 1.18, -0.02]} scale={[0.96, 0.78, 0.86]}>
        <sphereGeometry args={[0.68, 18, 12]} />
        <meshStandardMaterial color={leaf} roughness={0.82} />
      </mesh>
      <mesh castShadow position={[0.42, 1.06, 0.06]} scale={[0.88, 0.58, 0.72]}>
        <sphereGeometry args={[0.62, 18, 12]} />
        <meshStandardMaterial color={leafAccent} roughness={0.84} />
      </mesh>
      <mesh castShadow position={[-0.46, 1.02, 0.1]} scale={[0.58, 0.44, 0.5]}>
        <sphereGeometry args={[0.56, 14, 10]} />
        <meshStandardMaterial color="#579644" roughness={0.86} />
      </mesh>
    </group>
  );
}

function RandomTrees() {
  return (
    <group>
      {TREE_PLACEMENTS.map((tree) => (
        <Tree
          key={`${tree.position[0]}-${tree.position[2]}`}
          position={tree.position}
          scale={tree.scale}
          rotation={tree.rotation}
          leaf={tree.leaf}
          leafAccent={tree.leafAccent}
        />
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

function SoilPatch({
  position,
  scale,
  rotation = 0,
}: {
  position: [number, number, number];
  scale: [number, number];
  rotation?: number;
}) {
  return (
    <mesh
      receiveShadow
      position={position}
      rotation={[-Math.PI / 2, 0, rotation]}
      scale={[scale[0], scale[1], 1]}
    >
      <circleGeometry args={[1, 11]} />
      <meshStandardMaterial color="#795434" roughness={0.98} />
    </mesh>
  );
}

function FallenTrunk({
  position,
  rotation,
  scale,
}: {
  position: [number, number, number];
  rotation: number;
  scale: number;
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]} scale={scale}>
      <mesh castShadow receiveShadow rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.2, 0.28, 1.8, 7]} />
        <meshStandardMaterial color="#68452e" roughness={0.95} />
      </mesh>
      <mesh castShadow position={[-0.43, 0.1, 0]} rotation={[0, 0, -Math.PI / 3]}>
        <cylinderGeometry args={[0.08, 0.13, 0.75, 6]} />
        <meshStandardMaterial color="#795136" roughness={0.96} />
      </mesh>
    </group>
  );
}

function Mushroom({
  position,
  color,
  scale,
}: {
  position: [number, number, number];
  color: string;
  scale: number;
}) {
  return (
    <group position={position} scale={scale}>
      <mesh castShadow position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.07, 0.1, 0.4, 8]} />
        <meshStandardMaterial color="#eee0bf" roughness={0.9} />
      </mesh>
      <mesh castShadow position={[0, 0.42, 0]} scale={[1, 0.5, 1]}>
        <sphereGeometry args={[0.24, 12, 8]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
    </group>
  );
}

function Pond() {
  return (
    <group position={[-33, 0.015, -20]} rotation={[0, -0.28, 0]}>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} scale={[4.6, 2.8, 1]}>
        <circleGeometry args={[1, 36]} />
        <meshStandardMaterial
          color="#57b8d8"
          roughness={0.28}
          metalness={0.08}
          transparent
          opacity={0.78}
        />
      </mesh>
      <mesh position={[0.65, 0.012, -0.15]} rotation={[-Math.PI / 2, 0, 0.35]} scale={[3.2, 1.45, 1]}>
        <circleGeometry args={[1, 28]} />
        <meshStandardMaterial
          color="#9ee7ef"
          roughness={0.2}
          transparent
          opacity={0.32}
        />
      </mesh>
      <Rock position={[-3.8, 0.1, -0.4]} scale={0.38} />
      <Rock position={[3.6, 0.1, 0.7]} scale={0.32} />
      <GrassTuft position={[-4.4, 0, 1.7]} />
      <GrassTuft position={[4.1, 0, -1.6]} />
      <GrassTuft position={[1.8, 0, 2.6]} />
    </group>
  );
}

function WorldDetails() {
  return (
    <group position={[0, 0.46, 0]}>
      <Pond />
      <SoilPatch position={[16, 0.02, -14]} scale={[2.1, 1.1]} rotation={0.3} />
      <SoilPatch position={[-20, 0.02, 8]} scale={[1.6, 0.9]} rotation={-0.45} />

      <Rock position={[16, 0.12, -13]} scale={0.5} />
      <Rock position={[18.2, 0.1, -15]} scale={0.32} />
      <Rock position={[-21, 0.1, 9.2]} scale={0.42} />
      <Rock position={[20.5, 0.11, 11.8]} scale={0.58} />
      <Rock position={[-15.5, 0.1, 16]} scale={0.34} />
      <Rock position={[27, 0.1, 8.8]} scale={0.46} />
      <Rock position={[-45, 0.1, -18]} scale={0.5} />
      <Rock position={[-38, 0.09, 30]} scale={0.34} />
      <Rock position={[-4, 0.1, 39]} scale={0.42} />
      <Rock position={[25, 0.09, 34]} scale={0.3} />
      <Rock position={[46, 0.12, 19]} scale={0.62} />
      <Rock position={[53, 0.09, -26]} scale={0.36} />
      <Rock position={[10, 0.1, -42]} scale={0.44} />
      <Rock position={[-30, 0.1, -34]} scale={0.28} />

      <FallenTrunk position={[18, 0.22, -5]} rotation={0.55} scale={1.1} />
      <FallenTrunk position={[-19, 0.2, -10]} rotation={-0.8} scale={0.85} />
      <FallenTrunk position={[27, 0.2, 8]} rotation={1.1} scale={0.9} />
      <FallenTrunk position={[-27, 0.2, 4]} rotation={-0.2} scale={1.05} />
      <FallenTrunk position={[-44, 0.2, 22]} rotation={0.4} scale={0.92} />
      <FallenTrunk position={[-24, 0.2, -31]} rotation={-1.15} scale={0.78} />
      <FallenTrunk position={[34, 0.2, 30]} rotation={0.95} scale={0.88} />
      <FallenTrunk position={[48, 0.2, -18]} rotation={-0.55} scale={1.0} />
      <FallenTrunk position={[4, 0.2, 42]} rotation={1.35} scale={0.72} />

      <Mushroom position={[14, 0, -6]} color="#c75b46" scale={1.1} />
      <Mushroom position={[15, 0, -5.2]} color="#d8944e" scale={0.8} />
      <Mushroom position={[-18, 0, 14]} color="#c76b56" scale={0.95} />
      <Mushroom position={[26, 0, -15]} color="#d57b5f" scale={0.9} />
      <GrassTuft position={[-53, 0, 16]} />
      <GrassTuft position={[-49, 0, 20]} />
      <GrassTuft position={[41, 0, -39]} />
      <GrassTuft position={[46, 0, -35]} />
      <GrassTuft position={[59, 0, 20]} />
      <GrassTuft position={[55, 0, 29]} />
      <GrassTuft position={[-17, 0, 55]} />
      <GrassTuft position={[23, 0, 58]} />
      <GrassTuft position={[-59, 0, -30]} />
    </group>
  );
}

function RevenueHelicopter({ totalRevenue }: { totalRevenue: number }) {
  const helicopterRef = useRef<THREE.Group>(null);
  const craftRef = useRef<THREE.Group>(null);
  const rotorRef = useRef<THREE.Group>(null);
  const tailRotorRef = useRef<THREE.Group>(null);
  const signRef = useRef<THREE.Group>(null);
  const { camera, size } = useThree();
  const screenAnchor = useMemo(() => new THREE.Vector3(), []);
  const cameraDirection = useMemo(() => new THREE.Vector3(), []);
  const cameraUp = useMemo(() => new THREE.Vector3(), []);
  const revenueLabel = `Made $${revenueFormatter.format(totalRevenue)} till now`;

  useFrame(({ clock }) => {
    const elapsedTime = clock.getElapsedTime();
    const isCompactViewport = size.width < 640;
    const anchorX = isCompactViewport ? -0.48 : -0.72;
    const anchorY = isCompactViewport ? 0.76 : 0.89;
    const anchorDepth = isCompactViewport ? 17 : 28;

    if (helicopterRef.current) {
      screenAnchor.set(anchorX, anchorY, 0.5).unproject(camera);
      cameraDirection.copy(screenAnchor).sub(camera.position).normalize();
      cameraUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
      helicopterRef.current.position
        .copy(camera.position)
        .addScaledVector(cameraDirection, anchorDepth)
        .addScaledVector(cameraUp, Math.sin(elapsedTime * 1.4) * 0.08);
      helicopterRef.current.scale.setScalar(isCompactViewport ? 0.36 : 0.42);
    }

    if (craftRef.current) {
      craftRef.current.rotation.z =
        THREE.MathUtils.degToRad(Math.sin(elapsedTime * 1.2) * 1.4);
    }

    if (rotorRef.current) {
      rotorRef.current.rotation.y = elapsedTime * 22;
    }

    if (tailRotorRef.current) {
      tailRotorRef.current.rotation.x = elapsedTime * 24;
    }

    if (signRef.current) {
      signRef.current.rotation.z =
        THREE.MathUtils.degToRad(Math.sin(elapsedTime * 1.35) * 1.6);
    }
  });

  return (
    <group
      ref={helicopterRef}
      rotation={[
        THREE.MathUtils.degToRad(-8),
        THREE.MathUtils.degToRad(44),
        THREE.MathUtils.degToRad(1),
      ]}
    >
      <group ref={craftRef}>
        <group>
          <mesh castShadow position={[-0.55, 0, 0]} scale={[1.55, 0.68, 0.82]}>
            <sphereGeometry args={[1, 18, 12]} />
            <meshStandardMaterial color="#80b86f" roughness={0.62} metalness={0.04} />
          </mesh>
          <mesh castShadow position={[-1.4, 0.02, 0]} scale={[0.72, 0.58, 0.7]}>
            <sphereGeometry args={[1, 16, 10]} />
            <meshStandardMaterial color="#eef4b8" roughness={0.58} />
          </mesh>
          <mesh castShadow position={[-0.22, 0.25, 0.6]} scale={[0.46, 0.28, 0.08]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#bcecf0" roughness={0.28} metalness={0.02} />
          </mesh>
          <mesh castShadow position={[1.1, 0.1, 0]} rotation={[0, 0, -0.08]}>
            <boxGeometry args={[1.95, 0.18, 0.2]} />
            <meshStandardMaterial color="#4d9a75" roughness={0.72} />
          </mesh>
          <mesh castShadow position={[2.12, 0.26, 0]} rotation={[0, 0, -0.16]}>
            <boxGeometry args={[0.18, 0.94, 0.42]} />
            <meshStandardMaterial color="#2f8d74" roughness={0.62} />
          </mesh>
          <group ref={tailRotorRef} position={[2.28, 0.16, 0]}>
            <mesh castShadow>
              <boxGeometry args={[0.08, 0.08, 0.88]} />
              <meshStandardMaterial color="#285d61" roughness={0.7} />
            </mesh>
            <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
              <boxGeometry args={[0.08, 0.08, 0.88]} />
              <meshStandardMaterial color="#285d61" roughness={0.7} />
            </mesh>
          </group>
          <mesh castShadow position={[-0.48, 0.84, 0]}>
            <cylinderGeometry args={[0.06, 0.07, 0.56, 10]} />
            <meshStandardMaterial color="#274b4f" roughness={0.7} />
          </mesh>
          <group ref={rotorRef} position={[-0.48, 1.14, 0]}>
            <mesh castShadow>
              <boxGeometry args={[4.1, 0.04, 0.16]} />
              <meshStandardMaterial color="#214b50" roughness={0.54} />
            </mesh>
            <mesh castShadow rotation={[0, Math.PI / 2, 0]}>
              <boxGeometry args={[4.1, 0.04, 0.16]} />
              <meshStandardMaterial color="#386f66" roughness={0.54} />
            </mesh>
          </group>
          <mesh castShadow position={[-0.66, -0.86, -0.5]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.035, 0.035, 2.1, 8]} />
            <meshStandardMaterial color="#274b4f" roughness={0.78} />
          </mesh>
          <mesh castShadow position={[-0.66, -0.86, 0.5]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.035, 0.035, 2.1, 8]} />
            <meshStandardMaterial color="#274b4f" roughness={0.78} />
          </mesh>
          {[-1.26, -0.1].map((x) => (
            <mesh
              key={x}
              castShadow
              position={[x, -0.58, 0]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <cylinderGeometry args={[0.026, 0.026, 1.08, 8]} />
              <meshStandardMaterial color="#274b4f" roughness={0.78} />
            </mesh>
          ))}
        </group>

        <mesh position={[-0.58, -1.28, 0]} rotation={[0, 0, 0]}>
          <cylinderGeometry args={[0.014, 0.014, 1.12, 8]} />
          <meshStandardMaterial color="#4b665d" roughness={0.92} />
        </mesh>
        <group ref={signRef} position={[-0.58, -1.92, 0.02]} scale={[1.68, 1.22, 1]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[5.32, 1.12, 0.24]} />
            <meshStandardMaterial color="#4f996b" roughness={0.72} />
          </mesh>
          <mesh position={[0, 0, 0.12]}>
            <boxGeometry args={[4.86, 0.76, 0.06]} />
            <meshStandardMaterial color="#eef8e8" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0, -0.12]}>
            <boxGeometry args={[4.86, 0.76, 0.06]} />
            <meshStandardMaterial color="#eef8e8" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.48, 0.15]}>
            <boxGeometry args={[5.08, 0.1, 0.12]} />
            <meshStandardMaterial color="#9fcf90" roughness={0.62} />
          </mesh>
          <mesh position={[0, -0.48, 0.15]}>
            <boxGeometry args={[5.08, 0.1, 0.12]} />
            <meshStandardMaterial color="#2e775b" roughness={0.74} />
          </mesh>
          <mesh position={[-2.5, 0, 0.15]}>
            <boxGeometry args={[0.1, 0.98, 0.12]} />
            <meshStandardMaterial color="#2e775b" roughness={0.74} />
          </mesh>
          <mesh position={[2.5, 0, 0.15]}>
            <boxGeometry args={[0.1, 0.98, 0.12]} />
            <meshStandardMaterial color="#2e775b" roughness={0.74} />
          </mesh>
          <Text
            anchorX="center"
            anchorY="middle"
            color="#0b654a"
            fontSize={0.44}
            fontWeight={800}
            maxWidth={4.46}
            outlineColor="#eef8e8"
            outlineWidth={0.01}
            position={[0, -0.01, 0.19]}
          >
            {revenueLabel}
          </Text>
          <Text
            anchorX="center"
            anchorY="middle"
            color="#0b654a"
            fontSize={0.44}
            fontWeight={800}
            maxWidth={4.46}
            outlineColor="#eef8e8"
            outlineWidth={0.01}
            position={[0, -0.01, -0.19]}
            rotation={[0, Math.PI, 0]}
          >
            {revenueLabel}
          </Text>
        </group>
      </group>
    </group>
  );
}

function EdgeDecorations() {
  return (
    <group position={[0, 0.46, 0]}>
      <GrassTuft position={[-8.4, 0, -4.4]} />
      <GrassTuft position={[-6.2, 0, 5.0]} />
      <GrassTuft position={[-1.8, 0, -5.7]} />
      <GrassTuft position={[4.8, 0, 5.2]} />
      <GrassTuft position={[9.6, 0, -0.7]} />
      <GrassTuft position={[7.4, 0, 3.7]} />

      <Rock position={[-7.9, 0.12, 2.2]} scale={0.75} />
      <Rock position={[-3.4, 0.1, -5.2]} scale={0.56} />
      <Rock position={[3.6, 0.1, 5.4]} scale={0.64} />
      <Rock position={[8.1, 0.1, 1.4]} scale={0.52} />
    </group>
  );
}

function AddedWorldBuilding({
  building,
  onHoverBuilding,
  onVisitBuilding,
}: {
  building: AddedBuilding;
  onHoverBuilding: (building: BuildingHoverCardData | null) => void;
  onVisitBuilding: (buildingId: string) => void;
}) {
  const domainUrl = `https://${building.domain}`;
  const hoverData: BuildingHoverCardData = {
    id: building.id,
    name: building.companyName,
    domain: building.domain,
    clickCount: building.clickCount,
    logoUrl: building.logoUrl,
  };
  const commonProps = {
    plotId: building.id,
    name: building.companyName,
    domain: building.domain,
    domainUrl,
    onHoverChange: (hovered: boolean) => onHoverBuilding(hovered ? hoverData : null),
    onVisit: () => onVisitBuilding(building.id),
  };

  if (building.buildingType === "billboard") {
    return (
      <WebsiteBillboard
        {...commonProps}
        price={`$${building.price}`}
        position={[building.position[0], 0.48, building.position[2]]}
      />
    );
  }

  if (building.buildingType === "tower") {
    return (
      <SignalTower
        {...commonProps}
        price={`$${building.price}`}
        position={building.position}
        height={13.4}
        baseWidth={7}
        depth={5.5}
      />
    );
  }

  if (building.buildingType === "office-building") {
    return (
      <OfficeBuilding
        {...commonProps}
        price={`$${building.price}`}
        position={building.position}
        width={6.6}
        height={10.2}
        depth={4.2}
        showLabels={false}
      />
    );
  }

  return (
    <SmallOfficeBuilding
      {...commonProps}
      price={`$${building.price}`}
      position={[building.position[0], 0.45, building.position[2]]}
      width={4.2}
      height={3.4}
      depth={3.1}
      primaryColor="#f3f0e7"
    />
  );
}

function FloatingIsland({
  addedBuildings = [],
  totalRevenue,
  onHoverBuilding,
  onVisitBuilding,
  onVisitStaticBuilding,
  staticClickCounts,
}: {
  addedBuildings?: AddedBuilding[];
  totalRevenue: number;
  onHoverBuilding: (building: BuildingHoverCardData | null) => void;
  onVisitBuilding: (buildingId: string) => void;
  onVisitStaticBuilding: (buildingId: StaticBuildingId) => void;
  staticClickCounts: Record<StaticBuildingId, number>;
}) {
  return (
    <group>
      <WorldPlot />
      <GrassPatches />
      <RandomTrees />
      <EdgeDecorations />
      <WorldDetails />
      <RevenueHelicopter totalRevenue={totalRevenue} />
      <SmallOfficeBuilding
        {...SMALL_OFFICE_BUILDING}
        onHoverChange={(hovered) =>
          onHoverBuilding(
            hovered
              ? {
                  ...STATIC_SMALL_OFFICE_HOVER,
                  clickCount: staticClickCounts[STATIC_SMALL_OFFICE_HOVER.id],
                }
              : null,
          )
        }
        onVisit={() => onVisitStaticBuilding(STATIC_SMALL_OFFICE_HOVER.id)}
      />
      <OfficeBuilding
        {...OFFICE_BUILDING}
        onHoverChange={(hovered) =>
          onHoverBuilding(
            hovered
              ? {
                  ...STATIC_OFFICE_HOVER,
                  clickCount: staticClickCounts[STATIC_OFFICE_HOVER.id],
                }
              : null,
          )
        }
        onVisit={() => onVisitStaticBuilding(STATIC_OFFICE_HOVER.id)}
      />
      <SignalTower
        {...SIGNAL_TOWER}
        onHoverChange={(hovered) =>
          onHoverBuilding(
            hovered
              ? {
                  ...STATIC_TOWER_HOVER,
                  clickCount: staticClickCounts[STATIC_TOWER_HOVER.id],
                }
              : null,
          )
        }
        onVisit={() => onVisitStaticBuilding(STATIC_TOWER_HOVER.id)}
      />
      {addedBuildings.map((building) => (
        <AddedWorldBuilding
          key={building.id}
          building={building}
          onHoverBuilding={onHoverBuilding}
          onVisitBuilding={onVisitBuilding}
        />
      ))}
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
    ...getBoundsCorners(CITY_FRAMING_BOUNDS),
    ...getBoundsCorners(BUILDING_BOUNDS),
    ...getBoundsCorners(OFFICE_BUILDING_BOUNDS),
    ...getBoundsCorners(SIGNAL_TOWER_BOUNDS),
    ...badgeCorners,
  ];
}

function getAddedBuildingBounds(building: AddedBuilding) {
  const [x, y, z] = building.position;
  const dimensions: Record<
    BuildingType,
    { width: number; height: number; depth: number }
  > = {
    billboard: { width: 4.2, height: 4.4, depth: 1.1 },
    "small-office": { width: 4.2, height: 3.6, depth: 3.1 },
    "office-building": { width: 6.8, height: 11.4, depth: 4.6 },
    tower: { width: 7.4, height: 18.8, depth: 6 },
  };
  const { width, height, depth } = dimensions[building.buildingType];

  return new THREE.Box3(
    new THREE.Vector3(x - width / 2, y - 0.2, z - depth / 2),
    new THREE.Vector3(x + width / 2, y + height, z + depth / 2),
  );
}

function getAddedBuildingFocusRequest(building: AddedBuilding): CameraFocusRequest {
  const bounds = getAddedBuildingBounds(building);
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const distance = THREE.MathUtils.clamp(
    Math.max(size.x, size.y, size.z) * 2.4,
    11,
    28,
  );

  return {
    id: `paid:${building.id}`,
    target: center.toArray() as [number, number, number],
    distance,
  };
}

function mergeBuildingIntoList(
  buildings: AddedBuilding[],
  building: AddedBuilding,
) {
  return buildings.some((currentBuilding) => currentBuilding.id === building.id)
    ? buildings.map((currentBuilding) =>
        currentBuilding.id === building.id ? building : currentBuilding,
      )
    : [...buildings, building];
}

function getDynamicVisibleScenePoints(
  right: THREE.Vector3,
  cameraUp: THREE.Vector3,
  addedBuildings: AddedBuilding[],
) {
  return addedBuildings.flatMap((building) =>
    getBoundsCorners(getAddedBuildingBounds(building)),
  );
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

function getWorldXZBounds(points: THREE.Vector3[]) {
  const xValues = points.map((point) => point.x);
  const zValues = points.map((point) => point.z);

  return {
    minX: Math.min(...xValues),
    maxX: Math.max(...xValues),
    minZ: Math.min(...zValues),
    maxZ: Math.max(...zValues),
  };
}

function getCameraFraming(aspect: number, addedBuildings: AddedBuilding[]) {
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
  const visiblePoints = [
    ...getVisibleScenePoints(right, cameraUp),
    ...getDynamicVisibleScenePoints(right, cameraUp, addedBuildings),
  ];
  const center = getProjectedBoundsCenter(visiblePoints, right, cameraUp);
  const worldBounds = getWorldXZBounds(visiblePoints);

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
    distance,
    position: position.toArray() as [number, number, number],
    target: target.toArray() as [number, number, number],
    minTargetY: target.y - 0.7,
    maxTargetY: target.y + 0.7,
    minTargetX: worldBounds.minX - (isMobile ? 2 : 4),
    maxTargetX: worldBounds.maxX + (isMobile ? 2 : 4),
    minTargetZ: worldBounds.minZ - (isMobile ? 2 : 4),
    maxTargetZ: worldBounds.maxZ + (isMobile ? 2 : 4),
    minDistance: Math.max(7, distance * (isMobile ? 0.44 : 0.38)),
    maxDistance: Math.min(
      distance * (isMobile ? 0.82 : isTablet ? 0.96 : 1.18),
      isMobile ? 46 : isTablet ? 62 : 82,
    ),
  };
}

function CameraRig({
  focusRequest,
  addedBuildings,
}: {
  focusRequest: CameraFocusRequest | null;
  addedBuildings: AddedBuilding[];
}) {
  const { set, size } = useThree();
  const aspect = size.width / Math.max(size.height, 1);
  const framing = useMemo(
    () => getCameraFraming(aspect, addedBuildings),
    [addedBuildings, aspect],
  );
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

    const constrainedX = THREE.MathUtils.clamp(
      controls.target.x,
      framing.minTargetX,
      framing.maxTargetX,
    );
    const constrainedY = THREE.MathUtils.clamp(
      controls.target.y,
      framing.minTargetY,
      framing.maxTargetY,
    );
    const constrainedZ = THREE.MathUtils.clamp(
      controls.target.z,
      framing.minTargetZ,
      framing.maxTargetZ,
    );
    const correction = new THREE.Vector3(
      controls.target.x - constrainedX,
      controls.target.y - constrainedY,
      controls.target.z - constrainedZ,
    );
    const target = new THREE.Vector3(constrainedX, constrainedY, constrainedZ);
    const targetToCamera = controls.object.position.clone().sub(target);
    const cameraDistance = targetToCamera.length();
    const constrainedDistance = THREE.MathUtils.clamp(
      cameraDistance,
      framing.minDistance,
      framing.maxDistance,
    );
    const needsDistanceCorrection = Math.abs(cameraDistance - constrainedDistance) > 0.001;

    if (correction.lengthSq() < 0.000001 && !needsDistanceCorrection) return;

    correctingMovement.current = true;
    controls.object.position.sub(correction);
    if (needsDistanceCorrection) {
      targetToCamera.setLength(constrainedDistance);
      controls.object.position.copy(target.clone().add(targetToCamera));
    }
    controls.target.copy(target);
    controls.object.lookAt(controls.target);
    correctingMovement.current = false;
  }, [
    framing.maxDistance,
    framing.maxTargetX,
    framing.maxTargetY,
    framing.maxTargetZ,
    framing.minDistance,
    framing.minTargetX,
    framing.minTargetY,
    framing.minTargetZ,
  ]);

  useLayoutEffect(() => {
    set({ camera: fittedCamera });

    const controls = controlsRef.current;
    if (controls) {
      controls.target.copy(defaultTarget);
      controls.update();
    }
  }, [defaultTarget, fittedCamera, set]);

  useLayoutEffect(() => {
    if (!focusRequest) return;

    const controls = controlsRef.current;
    const focusTarget = new THREE.Vector3(...focusRequest.target);
    const focusPosition = focusTarget
      .clone()
      .addScaledVector(CAMERA_VIEW_DIRECTION, focusRequest.distance);

    fittedCamera.position.copy(focusPosition);
    fittedCamera.lookAt(focusTarget);
    fittedCamera.updateProjectionMatrix();
    fittedCamera.updateMatrixWorld();

    if (controls) {
      controls.target.copy(focusTarget);
      controls.object.position.copy(focusPosition);
      controls.object.lookAt(focusTarget);
      controls.update();
    }
  }, [fittedCamera, focusRequest]);

  return (
    <OrbitControls
      ref={controlsRef}
      camera={fittedCamera}
      enableDamping={false}
      enablePan
      enableRotate
      enableZoom
      zoomToCursor
      minDistance={framing.minDistance}
      maxDistance={framing.maxDistance}
      minPolarAngle={0.48}
      maxPolarAngle={Math.PI / 2.35}
      screenSpacePanning
      mouseButtons={{
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.PAN,
        RIGHT: THREE.MOUSE.PAN,
      }}
      touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
      target={framing.target}
      onChange={constrainMovement}
    />
  );
}

const INTRO_STORAGE_KEY = "buildyourcity:intro-seen";
const BUILDINGS_SYNC_INTERVAL_MS = 10000;
const CHECKOUT_FOCUS_POLL_INTERVAL_MS = 2000;
const CHECKOUT_FOCUS_MAX_POLLS = 30;
const revenueFormatter = new Intl.NumberFormat("en-US");

function getInitialStaticClickCounts(): Record<StaticBuildingId, number> {
  const emptyCounts = Object.fromEntries(
    STATIC_BUILDING_IDS.map((buildingId) => [buildingId, 0]),
  ) as Record<StaticBuildingId, number>;

  if (typeof window === "undefined") return emptyCounts;

  try {
    const rawCounts = JSON.parse(
      window.localStorage.getItem(STATIC_BUILDING_CLICK_STORAGE_KEY) ?? "{}",
    ) as Partial<Record<StaticBuildingId, unknown>>;

    return Object.fromEntries(
      STATIC_BUILDING_IDS.map((buildingId) => [
        buildingId,
        typeof rawCounts[buildingId] === "number"
          ? Math.max(0, rawCounts[buildingId])
          : 0,
      ]),
    ) as Record<StaticBuildingId, number>;
  } catch {
    return emptyCounts;
  }
}

function ProductIntroOverlay({
  visible,
}: {
  visible: boolean;
}) {
  if (!visible) return null;

  return (
    <section className="product-intro" aria-label="Discover products">
      <div className="product-intro-content">
        <h1>
          Discover products
          <span>built to stand out</span>
        </h1>
      </div>
    </section>
  );
}

function formatRecentBuildingTime(createdAt: string) {
  const createdTime = new Date(createdAt).getTime();
  const elapsedMs = Date.now() - createdTime;

  if (!Number.isFinite(createdTime) || elapsedMs < 60_000) return "just now";

  const elapsedMinutes = Math.floor(elapsedMs / 60_000);
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ago`;

  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays < 7) return `${elapsedDays}d ago`;

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(createdAt));
}

function RecentBuildingsPanel({
  buildings,
  onFocusBuilding,
}: {
  buildings: AddedBuilding[];
  onFocusBuilding: (building: AddedBuilding) => void;
}) {
  const recentBuildings = useMemo(
    () =>
      [...buildings]
        .sort(
          (firstBuilding, secondBuilding) =>
            new Date(secondBuilding.createdAt).getTime() -
            new Date(firstBuilding.createdAt).getTime(),
        )
        .slice(0, 4),
    [buildings],
  );

  if (recentBuildings.length === 0) return null;

  return (
    <aside className="recent-buildings-panel" aria-label="Recently added buildings">
      <div className="recent-buildings-header">
        <p>Recently Added</p>
      </div>
      <div className="recent-buildings-list">
        {recentBuildings.map((building) => {
          const faviconUrl = getWebsiteFaviconUrl(building.domain, 64);

          return (
            <button
              className={`recent-building-item${
                building.price === 10 ? " is-premium" : ""
              }`}
              key={building.id}
              type="button"
              onClick={() => onFocusBuilding(building)}
            >
              <span className="recent-building-icon" aria-hidden="true">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={faviconUrl} alt="" />
              </span>
              <span className="recent-building-copy">
                <strong>{building.companyName}</strong>
                <span>{building.domain}</span>
              </span>
              <span className="recent-building-meta">
                <span>${building.price}</span>
                <time dateTime={building.createdAt}>
                  {formatRecentBuildingTime(building.createdAt)}
                </time>
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function mergeBuildingsWithLocalCounts(
  currentBuildings: AddedBuilding[],
  nextBuildings: AddedBuilding[],
) {
  const currentById = new Map(
    currentBuildings.map((building) => [building.id, building]),
  );
  const nextBuildingIds = new Set(nextBuildings.map((building) => building.id));

  const mergedBuildings = nextBuildings.map((building) => {
    const currentBuilding = currentById.get(building.id);
    if (!currentBuilding) return building;

    return {
      ...building,
      clickCount: Math.max(building.clickCount, currentBuilding.clickCount),
    };
  });

  return [
    ...mergedBuildings,
    ...currentBuildings.filter((building) => !nextBuildingIds.has(building.id)),
  ];
}

export function SceneCanvas() {
  const [resetToken, setResetToken] = useState(0);
  const [addedBuildings, setAddedBuildings] = useState<AddedBuilding[]>([]);
  const [cameraFramingBuildings, setCameraFramingBuildings] = useState<AddedBuilding[]>([]);
  const [hoveredBuilding, setHoveredBuilding] = useState<BuildingHoverCardData | null>(null);
  const [staticClickCounts, setStaticClickCounts] = useState(getInitialStaticClickCounts);
  const [focusRequest, setFocusRequest] = useState<CameraFocusRequest | null>(null);
  const [loadError, setLoadError] = useState("");
  const [introVisible, setIntroVisible] = useState(() => {
    if (typeof window === "undefined") return false;

    try {
      return window.localStorage.getItem(INTRO_STORAGE_KEY) !== "true";
    } catch {
      return true;
    }
  });
  const [addBuildingPanelOpen, setAddBuildingPanelOpen] = useState(false);
  const buildingsSyncInFlightRef = useRef(false);
  const cameraFramingInitializedRef = useRef(false);
  const totalRevenue = useMemo(
    () =>
      addedBuildings.reduce(
        (total, building) => total + Number(building.price || 0),
        0,
      ),
    [addedBuildings],
  );
  const completeIntro = useCallback(() => {
    try {
      window.localStorage.setItem(INTRO_STORAGE_KEY, "true");
    } catch {
      // Local storage can be unavailable in private or locked-down browsers.
    }

    setIntroVisible(false);
    setFocusRequest(null);
    setResetToken((token) => token + 1);
  }, []);

  useEffect(() => {
    if (!introVisible) return;

    const timeoutId = window.setTimeout(completeIntro, 3000);
    return () => window.clearTimeout(timeoutId);
  }, [completeIntro, introVisible]);

  const syncBuildings = useCallback(async ({ quiet = false } = {}) => {
    if (buildingsSyncInFlightRef.current) return null;
    if (document.visibilityState !== "visible") return null;

    buildingsSyncInFlightRef.current = true;

    try {
      const response = await fetch(`/api/buildings?sync=${Date.now()}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        buildings?: AddedBuilding[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not load buildings.");
      }

      const buildings = payload.buildings ?? [];
      setAddedBuildings((currentBuildings) =>
        mergeBuildingsWithLocalCounts(currentBuildings, buildings),
      );
      if (!cameraFramingInitializedRef.current) {
        cameraFramingInitializedRef.current = true;
        setCameraFramingBuildings(buildings);
      }
      setLoadError("");
      return buildings;
    } catch (error) {
      if (!quiet) {
        setLoadError(
          error instanceof Error ? error.message : "Could not load saved buildings.",
        );
      }
      return null;
    } finally {
      buildingsSyncInFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const initialSyncId = window.setTimeout(() => {
      if (!cancelled) {
        void syncBuildings();
      }
    }, 0);
    const intervalId = window.setInterval(() => {
      if (!cancelled) {
        void syncBuildings({ quiet: true });
      }
    }, BUILDINGS_SYNC_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void syncBuildings({ quiet: true });
      }
    };
    const handleOnline = () => {
      void syncBuildings({ quiet: true });
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);

    return () => {
      cancelled = true;
      window.clearTimeout(initialSyncId);
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
    };
  }, [syncBuildings]);

  useEffect(() => {
    if (typeof EventSource === "undefined") return;

    const buildingEvents = new EventSource("/api/buildings/events");
    const handleBuildingsChanged = () => {
      void syncBuildings({ quiet: true });
    };
    const handleEventsError = () => {
      buildingEvents.close();
    };

    buildingEvents.addEventListener("buildings-changed", handleBuildingsChanged);
    buildingEvents.addEventListener("error", handleEventsError);

    return () => {
      buildingEvents.removeEventListener("buildings-changed", handleBuildingsChanged);
      buildingEvents.removeEventListener("error", handleEventsError);
      buildingEvents.close();
    };
  }, [syncBuildings]);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const checkoutStatus = searchParams.get("checkout");
    const orderId = searchParams.get("order");

    if (checkoutStatus !== "success" || !orderId) return;

    window.history.replaceState(null, "", window.location.pathname);

    let cancelled = false;
    let pollTimeoutId: number | undefined;
    let pollCount = 0;

    const focusPaidBuilding = (building: AddedBuilding) => {
      setIntroVisible(false);
      setAddedBuildings((currentBuildings) =>
        mergeBuildingIntoList(currentBuildings, building),
      );
      setCameraFramingBuildings((currentBuildings) =>
        mergeBuildingIntoList(currentBuildings, building),
      );
      setFocusRequest(getAddedBuildingFocusRequest(building));
    };

    const pollOrderBuilding = async () => {
      if (cancelled) return;

      pollCount += 1;

      try {
        const response = await fetch(`/api/buildings/orders/${orderId}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as {
          status?: string;
          building?: AddedBuilding | null;
        };

        if (response.ok && payload.status === "paid" && payload.building) {
          await syncBuildings({ quiet: true });
          if (!cancelled) focusPaidBuilding(payload.building);
          return;
        }
      } catch {
        // The webhook can arrive shortly after the checkout redirect.
      }

      if (pollCount >= CHECKOUT_FOCUS_MAX_POLLS) return;

      pollTimeoutId = window.setTimeout(
        pollOrderBuilding,
        CHECKOUT_FOCUS_POLL_INTERVAL_MS,
      );
    };

    pollTimeoutId = window.setTimeout(() => {
      void pollOrderBuilding();
    }, 0);

    return () => {
      cancelled = true;
      if (pollTimeoutId) window.clearTimeout(pollTimeoutId);
    };
  }, [syncBuildings]);

  const handleAddBuilding = async (data: BuildingPreviewData) => {
    const response = await fetch("/api/buildings/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        buildingType: data.buildingType,
        companyName: data.companyName,
        domain: data.domain,
      }),
    });
    const payload = (await response.json()) as {
      checkoutUrl?: string;
      error?: string;
      errors?: Record<string, string>;
    };

    if (!response.ok || !payload.checkoutUrl) {
      const fieldError = payload.errors ? Object.values(payload.errors)[0] : null;
      throw new Error(fieldError ?? payload.error ?? "Could not start checkout.");
    }

    window.location.assign(payload.checkoutUrl);
  };

  const handleFocusBuilding = useCallback((building: AddedBuilding) => {
    setIntroVisible(false);
    setCameraFramingBuildings((currentBuildings) =>
      mergeBuildingIntoList(currentBuildings, building),
    );
    setFocusRequest(getAddedBuildingFocusRequest(building));
  }, []);

  const handleVisitBuilding = async (buildingId: string) => {
    const updateLocalClickCount = (delta: number) => {
      setAddedBuildings((currentBuildings) =>
        currentBuildings.map((building) =>
          building.id === buildingId
            ? { ...building, clickCount: Math.max(0, building.clickCount + delta) }
            : building,
        ),
      );
      setHoveredBuilding((currentBuilding) =>
        currentBuilding?.id === buildingId
          ? { ...currentBuilding, clickCount: Math.max(0, currentBuilding.clickCount + delta) }
          : currentBuilding,
      );
    };

    const syncClickCount = (clickCount: number) => {
      setAddedBuildings((currentBuildings) =>
        currentBuildings.map((building) =>
          building.id === buildingId ? { ...building, clickCount } : building,
        ),
      );
      setHoveredBuilding((currentBuilding) =>
        currentBuilding?.id === buildingId
          ? { ...currentBuilding, clickCount }
          : currentBuilding,
      );
    };

    updateLocalClickCount(1);

    try {
      const response = await fetch(`/api/buildings/${buildingId}/click`, {
        method: "POST",
        keepalive: true,
      });
      const payload = (await response.json()) as {
        clickCount?: number;
      };

      if (!response.ok || typeof payload.clickCount !== "number") {
        throw new Error("Could not track this click.");
      }

      syncClickCount(payload.clickCount);
    } catch {
      console.warn("Could not persist building click count.");
    }
  };

  const handleVisitStaticBuilding = (buildingId: StaticBuildingId) => {
    setStaticClickCounts((currentCounts) => {
      const nextCounts = {
        ...currentCounts,
        [buildingId]: currentCounts[buildingId] + 1,
      };

      try {
        window.localStorage.setItem(
          STATIC_BUILDING_CLICK_STORAGE_KEY,
          JSON.stringify(nextCounts),
        );
      } catch {
        // Static demo counts are only a local convenience.
      }

      return nextCounts;
    });
    setHoveredBuilding((currentBuilding) =>
      currentBuilding?.id === buildingId
        ? { ...currentBuilding, clickCount: currentBuilding.clickCount + 1 }
        : currentBuilding,
    );
  };

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
        <fog attach="fog" args={["#bfe8ff", 85, 175]} />
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
        <FloatingIsland
          addedBuildings={addedBuildings}
          totalRevenue={totalRevenue}
          onHoverBuilding={setHoveredBuilding}
          onVisitBuilding={handleVisitBuilding}
          onVisitStaticBuilding={handleVisitStaticBuilding}
          staticClickCounts={staticClickCounts}
        />
        <SkyBirds />
        <ContactShadows
          position={[0, -0.78, 0]}
          opacity={0.18}
          scale={24}
          blur={3.8}
          far={5}
          color="#7aa7bd"
        />
        <CameraRig
          key={resetToken}
          focusRequest={focusRequest}
          addedBuildings={cameraFramingBuildings}
        />
      </Canvas>
      <button
        className="reset-camera-button"
        type="button"
        onClick={() => {
          setFocusRequest(null);
          setResetToken((token) => token + 1);
        }}
      >
        Reset view
      </button>
      <AnalyticsStatsPill />
      <ProductIntroOverlay visible={introVisible} />
      <p className="sr-only" aria-live="polite">
        Made ${revenueFormatter.format(totalRevenue)} till now
      </p>
      <RecentBuildingsPanel
        buildings={addedBuildings}
        onFocusBuilding={handleFocusBuilding}
      />
      <BuildingHoverCard building={hoveredBuilding} />
      <AddBuildingPanel
        onAddBuilding={handleAddBuilding}
        open={addBuildingPanelOpen}
        onOpenChange={setAddBuildingPanelOpen}
      />
      {loadError && (
        <div className="building-load-error" role="status">
          {loadError}
        </div>
      )}
    </div>
  );
}
