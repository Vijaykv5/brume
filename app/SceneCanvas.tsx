"use client";

import { ContactShadows } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { getBuildingFootprintSize, type BuildingType, type SavedBuilding } from "@/lib/buildings";
import { getWebsiteFaviconUrl } from "@/lib/favicon";
import {
  SmallOfficeBuilding,
} from "./component/SmallOfficeBuilding";
import {
  OfficeBuilding,
} from "./component/OfficeBuilding";
import {
  SignalTower,
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
import { PlayerController } from "./world/PlayerController";
import {
  ThirdPersonCamera,
  type CameraFocusRequest,
} from "./world/ThirdPersonCamera";
import type {
  PlayerMotionState,
  WorldCollider,
  WorldInteraction,
} from "./world/types";
import { useWorldKeyboard } from "./world/useWorldKeyboard";
import { useMultiplayer } from "./world/useMultiplayer";
import { useNearbyPlayer } from "./world/useNearbyPlayer";
import { MultiplayerPlayers } from "./world/MultiplayerPlayers";
import { AvatarCustomizer } from "./world/AvatarCustomizer";
import { WorldBillboards } from "./world/WorldBillboard";
import {
  ControlsTutorial,
  InteractionPanel,
  InteractionPrompt,
  PlayerInteractionPanel,
  PlayerInteractionPrompt,
  WorldLoading,
} from "./world/WorldHud";
import type { NetworkPlayer } from "@/multiplayer/protocol";
import {
  EDGE_ROCK_PLACEMENTS,
  EXAMPLE_BILLBOARDS,
  PLAYER_SPAWN,
  ROCK_PLACEMENTS,
  STATIC_WORLD_COLLIDERS,
  TREE_PLACEMENTS,
  TRUNK_PLACEMENTS,
} from "./world/world-data";

const REVENUE_EXCLUDED_BUILDING_ID = "2b68275d-5db0-40dc-8448-4630323f610e";
const REVENUE_EXCLUDED_BUILDING_ORDER_ID = "17004efa-03a7-455e-af61-631c735efb62";

type AddedBuilding = SavedBuilding;

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

      {ROCK_PLACEMENTS.map((rock, index) => (
        <Rock key={`world-rock-${index}`} {...rock} />
      ))}

      {TRUNK_PLACEMENTS.map((trunk, index) => (
        <FallenTrunk key={`world-trunk-${index}`} {...trunk} />
      ))}

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

function RevenueSignFace({
  label,
  position,
  rotation,
}: {
  label: string;
  position: [number, number, number];
  rotation?: [number, number, number];
}) {
  const texture = useMemo(() => {
    if (typeof document === "undefined") return null;

    const canvas = document.createElement("canvas");
    canvas.width = 1800;
    canvas.height = 420;

    const context = canvas.getContext("2d");
    if (!context) return null;

    context.clearRect(0, 0, canvas.width, canvas.height);

    const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "#f9fff4");
    gradient.addColorStop(1, "#dff3d6");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.strokeStyle = "#9fcf90";
    context.lineWidth = 18;
    context.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#0b654a";
    context.font = '900 156px "Inter", Arial, sans-serif';
    context.fillText(label, canvas.width / 2, canvas.height / 2 + 4, canvas.width * 0.88);

    const nextTexture = new THREE.CanvasTexture(canvas);
    nextTexture.colorSpace = THREE.SRGBColorSpace;
    nextTexture.minFilter = THREE.LinearFilter;
    nextTexture.magFilter = THREE.LinearFilter;
    nextTexture.needsUpdate = true;
    return nextTexture;
  }, [label]);

  useEffect(() => () => texture?.dispose(), [texture]);

  if (!texture) return null;

  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[4.86, 0.76]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
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
          <RevenueSignFace label={revenueLabel} position={[0, -0.01, 0.19]} />
          <RevenueSignFace
            label={revenueLabel}
            position={[0, -0.01, -0.19]}
            rotation={[0, Math.PI, 0]}
          />
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

      {EDGE_ROCK_PLACEMENTS.map((rock, index) => (
        <Rock
          key={`edge-rock-${index}`}
          position={[rock.position[0], rock.position[1] - 0.46, rock.position[2]]}
          scale={rock.scale}
        />
      ))}
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
}: {
  addedBuildings?: AddedBuilding[];
  totalRevenue: number;
  onHoverBuilding: (building: BuildingHoverCardData | null) => void;
  onVisitBuilding: (buildingId: string) => void;
}) {
  return (
    <group>
      <WorldPlot />
      <GrassPatches />
      <RandomTrees />
      <EdgeDecorations />
      <WorldDetails />
      <RevenueHelicopter totalRevenue={totalRevenue} />
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

const BUILDINGS_SYNC_INTERVAL_MS = 10000;
const CHECKOUT_FOCUS_POLL_INTERVAL_MS = 2000;
const CHECKOUT_FOCUS_MAX_POLLS = 30;
const revenueFormatter = new Intl.NumberFormat("en-US");

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
                {!isRevenueExcludedBuilding(building) && <span>${building.price}</span>}
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

function isRevenueExcludedBuilding(building: AddedBuilding) {
  return (
    building.id === REVENUE_EXCLUDED_BUILDING_ID ||
    building.buildingOrderId === REVENUE_EXCLUDED_BUILDING_ORDER_ID
  );
}

export function SceneCanvas({ paymentsEnabled }: { paymentsEnabled: boolean }) {
  const multiplayer = useMultiplayer();
  const [cameraResetToken, setCameraResetToken] = useState(0);
  const [addedBuildings, setAddedBuildings] = useState<AddedBuilding[]>([]);
  const [hoveredBuilding, setHoveredBuilding] = useState<BuildingHoverCardData | null>(null);
  const [focusRequest, setFocusRequest] = useState<CameraFocusRequest | null>(null);
  const [nearbyInteraction, setNearbyInteraction] = useState<WorldInteraction | null>(null);
  const [selectedInteraction, setSelectedInteraction] = useState<WorldInteraction | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<NetworkPlayer | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [addBuildingPanelOpen, setAddBuildingPanelOpen] = useState(false);
  const [avatarCustomizerOpen, setAvatarCustomizerOpen] = useState(false);
  const buildingsSyncInFlightRef = useRef(false);
  const playerMotionRef = useRef<PlayerMotionState>({
    position: new THREE.Vector3(...PLAYER_SPAWN),
    velocity: new THREE.Vector3(),
    heading: Math.PI,
    moving: false,
    running: false,
  });
  const nearbyPlayer = useNearbyPlayer(
    playerMotionRef,
    multiplayer.remotePlayersRef,
  );
  const worldInteractions = useMemo<WorldInteraction[]>(
    () => [
      ...EXAMPLE_BILLBOARDS,
      ...addedBuildings.map((building) => {
        const footprint = getBuildingFootprintSize(building.buildingType);
        const buildingLabel = building.buildingType
          .split("-")
          .map((word) => word.slice(0, 1).toUpperCase() + word.slice(1))
          .join(" ");

        return {
          id: `building:${building.id}`,
          kind: building.buildingType === "billboard" ? "billboard" : "building",
          title: building.companyName,
          subtitle: building.domain,
          description: `${buildingLabel} for ${building.companyName} in BRUME World.`,
          position: building.position,
          range: Math.max(footprint.width, footprint.depth) / 2 + 2.4,
          websiteUrl: `https://${building.domain}`,
          imageUrl: building.logoUrl,
          buildingId: building.id,
        } satisfies WorldInteraction;
      }),
    ],
    [addedBuildings],
  );
  const worldColliders = useMemo<WorldCollider[]>(
    () => [
      ...STATIC_WORLD_COLLIDERS,
      ...addedBuildings.map((building) => {
        const footprint = getBuildingFootprintSize(building.buildingType);
        return {
          id: `building:${building.id}`,
          shape: "box" as const,
          position: [building.position[0], building.position[2]] as [number, number],
          halfSize: [footprint.width / 2, footprint.depth / 2] as [number, number],
        };
      }),
    ],
    [addedBuildings],
  );
  const activeSelectedPlayer =
    selectedPlayer &&
    multiplayer.remotePlayers.some((player) => player.id === selectedPlayer.id)
      ? selectedPlayer
      : null;
  const handleInteract = useCallback(() => {
    if (nearbyPlayer) {
      setSelectedInteraction(null);
      setSelectedPlayer(nearbyPlayer);
      return;
    }

    if (nearbyInteraction) {
      setSelectedPlayer(null);
      setSelectedInteraction(nearbyInteraction);
    }
  }, [nearbyInteraction, nearbyPlayer]);
  const handleEscape = useCallback(() => {
    setSelectedInteraction(null);
    setSelectedPlayer(null);
    setAvatarCustomizerOpen(false);
  }, []);
  const playerInputRef = useWorldKeyboard({
    enabled:
      !addBuildingPanelOpen &&
      !avatarCustomizerOpen &&
      !selectedInteraction &&
      !activeSelectedPlayer,
    onInteract: handleInteract,
    onEscape: handleEscape,
  });
  const totalRevenue = useMemo(
    () =>
      addedBuildings.filter((building) => !isRevenueExcludedBuilding(building)).reduce(
        (total, building) => total + Number(building.price || 0),
        0,
      ),
    [addedBuildings],
  );
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
      setAddedBuildings((currentBuildings) =>
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
    if (!paymentsEnabled) {
      throw new Error("Payments are currently disabled.");
    }

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
    setFocusRequest(getAddedBuildingFocusRequest(building));
  }, []);

  const handlePlayerMovementStart = useCallback(() => {
    setFocusRequest(null);
  }, []);

  const openAvatarCustomizer = useCallback(() => {
    setSelectedInteraction(null);
    setSelectedPlayer(null);
    setAddBuildingPanelOpen(false);
    setAvatarCustomizerOpen(true);
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

  return (
    <div
      className="scene-stage"
      data-multiplayer-state={multiplayer.connectionState}
      data-remote-player-count={multiplayer.remotePlayers.length}
      data-nearby-player-id={nearbyPlayer?.id ?? ""}
    >
      <Canvas
        className="scene-canvas"
        dpr={[1, 1.75]}
        shadows={{ type: THREE.PCFShadowMap }}
        camera={{ fov: 42, near: 0.1, far: 180, position: [8, 8.7, 18] }}
        gl={{ antialias: true, alpha: true }}
        fallback={
          <div className="world-webgl-fallback" role="alert">
            This browser could not start the 3D world. Enable WebGL and try again.
          </div>
        }
        onCreated={({ gl }) => {
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.PCFShadowMap;
          gl.setClearAlpha(0);
          setSceneReady(true);
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
        />
        <Suspense fallback={null}>
          <WorldBillboards
            billboards={EXAMPLE_BILLBOARDS}
            nearbyInteractionId={nearbyInteraction?.id ?? null}
          />
        </Suspense>
        <PlayerController
          inputRef={playerInputRef}
          motionRef={playerMotionRef}
          colliders={worldColliders}
          interactions={worldInteractions}
          positionCorrectionRef={multiplayer.positionCorrectionRef}
          onNearbyInteractionChange={setNearbyInteraction}
          onMovementStart={handlePlayerMovementStart}
          profile={multiplayer.localProfile}
          onCustomize={openAvatarCustomizer}
        />
        <MultiplayerPlayers
          players={multiplayer.remotePlayers}
          playersRef={multiplayer.remotePlayersRef}
          localMotionRef={playerMotionRef}
          sendLocalState={multiplayer.sendLocalState}
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
        <ThirdPersonCamera
          playerMotionRef={playerMotionRef}
          focusRequest={focusRequest}
          resetToken={cameraResetToken}
        />
      </Canvas>
      <WorldLoading visible={!sceneReady} />
      <button
        className="reset-camera-button"
        type="button"
        onClick={() => {
          setFocusRequest(null);
          setCameraResetToken((token) => token + 1);
        }}
      >
        Reset camera
      </button>
      <button
        className="avatar-customize-button"
        type="button"
        onClick={openAvatarCustomizer}
      >
        Customize character
      </button>
      <AnalyticsStatsPill
        onlineNow={multiplayer.onlineCount}
        connectionState={multiplayer.connectionState}
      />
      <p className="sr-only" aria-live="polite">
        Made ${revenueFormatter.format(totalRevenue)} till now
      </p>
      <RecentBuildingsPanel
        buildings={addedBuildings}
        onFocusBuilding={handleFocusBuilding}
      />
      <BuildingHoverCard building={hoveredBuilding} />
      <ControlsTutorial />
      <InteractionPrompt
        interaction={
          selectedInteraction || activeSelectedPlayer || addBuildingPanelOpen || avatarCustomizerOpen || nearbyPlayer
            ? null
            : nearbyInteraction
        }
      />
      <PlayerInteractionPrompt
        player={
          selectedInteraction || activeSelectedPlayer || addBuildingPanelOpen || avatarCustomizerOpen
            ? null
            : nearbyPlayer
        }
      />
      <InteractionPanel
        interaction={selectedInteraction}
        onClose={() => setSelectedInteraction(null)}
        onVisit={() => {
          if (selectedInteraction?.buildingId) {
            void handleVisitBuilding(selectedInteraction.buildingId);
          }
        }}
      />
      <PlayerInteractionPanel
        key={activeSelectedPlayer?.id ?? "no-player"}
        player={activeSelectedPlayer}
        onClose={() => setSelectedPlayer(null)}
      />
      {avatarCustomizerOpen && (
        <AvatarCustomizer
          profile={multiplayer.localProfile}
          onClose={() => setAvatarCustomizerOpen(false)}
          onSave={(profile) => {
            multiplayer.updateLocalProfile(profile);
            setAvatarCustomizerOpen(false);
          }}
        />
      )}
      <AddBuildingPanel
        onAddBuilding={handleAddBuilding}
        open={addBuildingPanelOpen}
        onOpenChange={(open) => {
          if (open) {
            setSelectedInteraction(null);
            setSelectedPlayer(null);
            setAvatarCustomizerOpen(false);
          }
          setAddBuildingPanelOpen(open);
        }}
        paymentsEnabled={paymentsEnabled}
      />
      {loadError && (
        <div className="building-load-error" role="alert">
          <span>{loadError}</span>
          <button type="button" onClick={() => void syncBuildings()}>
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
