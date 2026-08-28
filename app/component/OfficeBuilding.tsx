"use client";

import { Billboard } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { BuildingBadge } from "./BuildingBadge";

const CONCRETE_COLOR = "#b9b4aa";
const CONCRETE_DARK_COLOR = "#918b82";
const WINDOW_COLOR = "#5d6162";
const WINDOW_FRAME_COLOR = "#25292a";
const ROOF_RIM_COLOR = "#343638";
const BASE_COLOR = "#3d3a35";
const SIGN_COLOR = "#34454a";

export type OfficeBuildingProps = {
  plotId: string;
  domain: string;
  price: string;
  position: [number, number, number];
  width: number;
  height: number;
  depth: number;
  primaryColor?: string;
  logoUrl?: string;
  showLabels?: boolean;
  name?: string;
  domainUrl?: string;
  clickable?: boolean;
};

function TextLabel({
  text,
  width,
  height,
  color = SIGN_COLOR,
}: {
  text: string;
  width: number;
  height: number;
  color?: string;
}) {
  const texture = useMemo(() => {
    if (typeof document === "undefined") return null;

    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 256;

    const context = canvas.getContext("2d");
    if (!context) return null;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = color;
    context.font = '700 104px "Inter", Arial, sans-serif';
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, canvas.width / 2, canvas.height / 2, canvas.width * 0.9);

    const nextTexture = new THREE.CanvasTexture(canvas);
    nextTexture.colorSpace = THREE.SRGBColorSpace;
    nextTexture.minFilter = THREE.LinearFilter;
    nextTexture.magFilter = THREE.LinearFilter;
    nextTexture.needsUpdate = true;
    return nextTexture;
  }, [color, text]);

  useEffect(() => () => texture?.dispose(), [texture]);

  if (!texture) return null;

  return (
    <mesh position={[0, 0, 0.01]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial
        map={texture}
        transparent
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

function WindowPane({
  position,
  width,
  height,
  rotation = [0, 0, 0],
}: {
  position: [number, number, number];
  width: number;
  height: number;
  rotation?: [number, number, number];
}) {
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow>
        <boxGeometry args={[width, height, 0.08]} />
        <meshStandardMaterial
          color={WINDOW_COLOR}
          metalness={0.12}
          roughness={0.36}
        />
      </mesh>
      <mesh position={[0, 0, 0.045]}>
        <boxGeometry args={[0.035, height + 0.03, 0.025]} />
        <meshBasicMaterial color={WINDOW_FRAME_COLOR} />
      </mesh>
      <mesh position={[-width / 2, 0, 0.045]}>
        <boxGeometry args={[0.035, height + 0.03, 0.025]} />
        <meshBasicMaterial color={WINDOW_FRAME_COLOR} />
      </mesh>
      <mesh position={[width / 2, 0, 0.045]}>
        <boxGeometry args={[0.035, height + 0.03, 0.025]} />
        <meshBasicMaterial color={WINDOW_FRAME_COLOR} />
      </mesh>
    </group>
  );
}

function ConcretePanel({
  position,
  width,
  height,
}: {
  position: [number, number, number];
  width: number;
  height: number;
}) {
  return (
    <mesh castShadow position={position}>
      <boxGeometry args={[width, height, 0.1]} />
      <meshStandardMaterial color={CONCRETE_COLOR} roughness={0.94} />
    </mesh>
  );
}

function getDomainUrl(domain: string, domainUrl?: string) {
  const target = domainUrl?.trim() || domain.trim();
  if (!target) return "";
  return /^https?:\/\//i.test(target) ? target : `https://${target}`;
}

export function OfficeBuilding({
  plotId,
  domain,
  price,
  position,
  width,
  height,
  depth,
  primaryColor = CONCRETE_COLOR,
  logoUrl = "",
  showLabels = true,
  name,
  domainUrl,
  clickable = true,
}: OfficeBuildingProps) {
  const [hovered, setHovered] = useState(false);
  const frontZ = depth / 2 + 0.045;
  const sideX = width / 2 + 0.045;
  const floorCount = 8;
  const columnCount = 8;
  const usableHeight = height * 0.78;
  const floorGap = usableHeight / floorCount;
  const baseHeight = height * 0.1;
  const windowWidth = width * 0.082;
  const windowHeight = floorGap * 0.42;
  const columnSpacing = width * 0.11;
  const sideWindowWidth = depth * 0.18;
  const sideWindowSpacing = depth * 0.21;
  const buildingUrl = clickable ? getDomainUrl(domain, domainUrl) : "";

  useEffect(() => {
    if (!hovered || !buildingUrl) return;

    document.body.style.cursor = "pointer";
    return () => {
      document.body.style.cursor = "";
    };
  }, [buildingUrl, hovered]);

  const handlePointerOver = (event: ThreeEvent<PointerEvent>) => {
    if (!buildingUrl) return;

    event.stopPropagation();
    setHovered(true);
  };

  const handlePointerOut = (event: ThreeEvent<PointerEvent>) => {
    if (!buildingUrl) return;

    event.stopPropagation();
    setHovered(false);
  };

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    if (!buildingUrl) return;

    event.stopPropagation();
    window.open(buildingUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <group
      position={position}
      userData={{ plotId, domain, price, logoUrl }}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    >
      <mesh castShadow receiveShadow position={[0, height / 2, 0]}>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={primaryColor} roughness={0.96} />
      </mesh>

      <mesh castShadow position={[0, baseHeight / 2, frontZ + 0.01]}>
        <boxGeometry args={[width + 0.12, baseHeight, 0.16]} />
        <meshStandardMaterial color={BASE_COLOR} roughness={0.86} />
      </mesh>

      <mesh castShadow position={[0, height * 0.98, frontZ + 0.035]}>
        <boxGeometry args={[width + 0.08, height * 0.16, 0.12]} />
        <meshStandardMaterial color={CONCRETE_DARK_COLOR} roughness={0.92} />
      </mesh>

      <mesh castShadow receiveShadow position={[0, height + 0.08, 0]}>
        <boxGeometry args={[width + 0.24, 0.16, depth + 0.24]} />
        <meshStandardMaterial color={CONCRETE_DARK_COLOR} roughness={0.9} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh
          key={`roof-side-${side}`}
          castShadow
          position={[side * (width / 2 + 0.12), height + 0.32, 0]}
        >
          <boxGeometry args={[0.16, 0.34, depth + 0.34]} />
          <meshStandardMaterial color={ROOF_RIM_COLOR} roughness={0.84} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <mesh
          key={`roof-front-${side}`}
          castShadow
          position={[0, height + 0.32, side * (depth / 2 + 0.12)]}
        >
          <boxGeometry args={[width + 0.36, 0.34, 0.16]} />
          <meshStandardMaterial color={ROOF_RIM_COLOR} roughness={0.84} />
        </mesh>
      ))}

      {Array.from({ length: floorCount }).flatMap((_, floorIndex) =>
        Array.from({ length: columnCount }).map((__, columnIndex) => {
          const x = (columnIndex - (columnCount - 1) / 2) * columnSpacing;
          const y = baseHeight + floorGap * (floorIndex + 0.72);

          return (
            <WindowPane
              key={`front-window-${floorIndex}-${columnIndex}`}
              position={[x, y, frontZ]}
              width={windowWidth}
              height={windowHeight}
            />
          );
        }),
      )}

      {Array.from({ length: columnCount + 1 }).map((_, index) => {
        const x = (index - columnCount / 2) * columnSpacing;
        return (
          <ConcretePanel
            key={`front-pillar-${index}`}
            position={[x, height * 0.52, frontZ + 0.025]}
            width={0.14}
            height={height}
          />
        );
      })}

      {Array.from({ length: floorCount + 1 }).map((_, index) => {
        const y = baseHeight + floorGap * (index + 0.22);
        return (
          <ConcretePanel
            key={`front-band-${index}`}
            position={[0, y, frontZ + 0.03]}
            width={width + 0.04}
            height={0.2}
          />
        );
      })}

      {[-1, 1].flatMap((side) =>
        Array.from({ length: floorCount - 1 }).flatMap((_, floorIndex) =>
          [-0.5, -0.25, 0, 0.25, 0.5].map((zFactor) => (
            <WindowPane
              key={`side-window-${side}-${floorIndex}-${zFactor}`}
              position={[
                side * sideX,
                baseHeight + floorGap * (floorIndex + 0.82),
                zFactor * sideWindowSpacing * 2,
              ]}
              rotation={[0, Math.PI / 2, 0]}
              width={sideWindowWidth}
              height={windowHeight}
            />
          )),
        ),
      )}

      <group position={[width * 0.22, baseHeight + 0.32, frontZ + 0.18]}>
        <mesh castShadow position={[0, 0.58, 0]}>
          <boxGeometry args={[width * 0.24, 1.16, 0.2]} />
          <meshStandardMaterial color="#1f2425" roughness={0.5} />
        </mesh>
        <mesh castShadow position={[0, 1.36, 0.42]}>
          <boxGeometry args={[width * 0.38, 0.16, 1.02]} />
          <meshStandardMaterial color={CONCRETE_DARK_COLOR} roughness={0.84} />
        </mesh>
        <mesh castShadow position={[-width * 0.16, 0.72, 0.36]}>
          <boxGeometry args={[0.08, 1.38, 0.08]} />
          <meshStandardMaterial color={WINDOW_FRAME_COLOR} roughness={0.68} />
        </mesh>
        <mesh castShadow position={[width * 0.16, 0.72, 0.36]}>
          <boxGeometry args={[0.08, 1.38, 0.08]} />
          <meshStandardMaterial color={WINDOW_FRAME_COLOR} roughness={0.68} />
        </mesh>
        {Array.from({ length: 4 }).map((_, index) => (
          <mesh
            key={`step-${index}`}
            castShadow
            position={[0, 0.06 + index * 0.07, 0.78 + index * 0.08]}
          >
            <boxGeometry args={[width * 0.36, 0.08, 0.18]} />
            <meshStandardMaterial color={CONCRETE_DARK_COLOR} roughness={0.88} />
          </mesh>
        ))}
      </group>

      <group position={[0, height + 1.24, 0]}>
        <BuildingBadge
          title={name ?? domain}
          subtitle={domain}
          width={3.2}
          height={1.05}
          subtitleColor="#ffd400"
        />
      </group>

      {showLabels && (
        <>
          <Billboard position={[-width * 0.38, height + 0.62, depth * 0.24]} follow>
            <mesh castShadow>
              <boxGeometry args={[0.72, 0.34, 0.08]} />
              <meshStandardMaterial color="#efebe2" roughness={0.8} />
            </mesh>
            <group position={[0, 0, 0.05]}>
              <TextLabel text={plotId} width={0.48} height={0.2} />
            </group>
          </Billboard>

          <Billboard position={[0, height * 0.56, frontZ + 0.24]} follow>
            <mesh castShadow>
              <boxGeometry args={[width * 0.5, height * 0.14, 0.08]} />
              <meshStandardMaterial color="#efebe2" roughness={0.82} />
            </mesh>
            <group position={[0, 0, 0.05]}>
              <TextLabel text={domain} width={width * 0.42} height={height * 0.09} />
            </group>
          </Billboard>

          <Billboard position={[width * 0.36, height + 1.05, 0]} follow>
            <mesh castShadow>
              <circleGeometry args={[0.66, 24]} />
              <meshStandardMaterial color={SIGN_COLOR} roughness={0.78} />
            </mesh>
            <mesh position={[0, 0, 0.025]}>
              <circleGeometry args={[0.58, 24]} />
              <meshStandardMaterial color="#ffffff" roughness={0.7} />
            </mesh>
            <group position={[0, 0, 0.05]}>
              <TextLabel text={price} width={0.84} height={0.42} />
            </group>
          </Billboard>
        </>
      )}
    </group>
  );
}
