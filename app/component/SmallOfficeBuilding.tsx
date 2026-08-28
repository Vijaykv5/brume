"use client";

import type { ThreeElements, ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { BuildingBadge } from "./BuildingBadge";

const WINDOW_COLOR = "#a9dbed";
const WINDOW_FRAME_COLOR = "#d8ddd8";
const ENTRANCE_COLOR = "#26383d";
const ROOF_COLOR = "#ece9df";
const SIGN_COLOR = "#34454a";

export type SmallOfficeBuildingProps = {
  plotId: string;
  domain: string;
  price: string;
  position: [number, number, number];
  width: number;
  height: number;
  depth: number;
  primaryColor: string;
  logoUrl?: string;
  name?: string;
  domainUrl?: string;
  clickable?: boolean;
};

function Window({
  position,
  rotation,
  scale,
}: Pick<ThreeElements["mesh"], "position" | "rotation" | "scale">) {
  return (
    <mesh castShadow position={position} rotation={rotation} scale={scale}>
      <boxGeometry args={[1, 1, 0.08]} />
      <meshStandardMaterial
        color={WINDOW_COLOR}
        metalness={0.08}
        roughness={0.28}
      />
    </mesh>
  );
}

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
    context.font = '700 112px "Inter", Arial, sans-serif';
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

function getDomainUrl(domain: string, domainUrl?: string) {
  const target = domainUrl?.trim() || domain.trim();
  if (!target) return "";
  return /^https?:\/\//i.test(target) ? target : `https://${target}`;
}

export function SmallOfficeBuilding({
  plotId,
  domain,
  price,
  position,
  width,
  height,
  depth,
  primaryColor,
  logoUrl = "",
  name,
  domainUrl,
  clickable = true,
}: SmallOfficeBuildingProps) {
  const [hovered, setHovered] = useState(false);
  const floorHeight = height / 2;
  const frontZ = depth / 2 + 0.045;
  const sideX = width / 2 + 0.045;
  const upperWindowY = height * 0.72;
  const lowerWindowY = height * 0.28;
  const windowWidth = width * 0.2;
  const windowHeight = floorHeight * 0.42;
  const sideWindowWidth = depth * 0.2;
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
        <meshStandardMaterial color={primaryColor} roughness={0.82} />
      </mesh>

      <mesh castShadow position={[0, floorHeight, frontZ + 0.015]}>
        <boxGeometry args={[width + 0.06, 0.07, 0.1]} />
        <meshStandardMaterial color={WINDOW_FRAME_COLOR} roughness={0.76} />
      </mesh>

      {[-0.3, 0.3].flatMap((xFactor) =>
        [lowerWindowY, upperWindowY].map((windowY) => (
          <Window
            key={`${xFactor}-${windowY}`}
            position={[width * xFactor, windowY, frontZ]}
            scale={[windowWidth, windowHeight, 1]}
          />
        )),
      )}

      {[-0.23, 0.23].flatMap((zFactor) =>
        [lowerWindowY, upperWindowY].map((windowY) => (
          <Window
            key={`${zFactor}-${windowY}`}
            position={[sideX, windowY, depth * zFactor]}
            rotation={[0, Math.PI / 2, 0]}
            scale={[sideWindowWidth, windowHeight, 1]}
          />
        )),
      )}

      <mesh castShadow position={[0, floorHeight * 0.3, frontZ + 0.03]}>
        <boxGeometry args={[width * 0.22, floorHeight * 0.6, 0.13]} />
        <meshStandardMaterial color={ENTRANCE_COLOR} roughness={0.58} />
      </mesh>

      <mesh castShadow receiveShadow position={[0, height + 0.1, 0]}>
        <boxGeometry args={[width + 0.22, 0.2, depth + 0.22]} />
        <meshStandardMaterial color={ROOF_COLOR} roughness={0.82} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh
          key={`roof-x-${side}`}
          castShadow
          position={[side * (width / 2 + 0.11), height + 0.28, 0]}
        >
          <boxGeometry args={[0.12, 0.18, depth + 0.32]} />
          <meshStandardMaterial color={SIGN_COLOR} roughness={0.78} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <mesh
          key={`roof-z-${side}`}
          castShadow
          position={[0, height + 0.28, side * (depth / 2 + 0.11)]}
        >
          <boxGeometry args={[width + 0.32, 0.18, 0.12]} />
          <meshStandardMaterial color={SIGN_COLOR} roughness={0.78} />
        </mesh>
      ))}

      <group position={[0, height * 0.56, frontZ + 0.13]}>
        <mesh castShadow>
          <boxGeometry args={[width * 0.72, height * 0.19, 0.12]} />
          <meshStandardMaterial color="#f7f5ef" roughness={0.84} />
        </mesh>
        <group position={[0, 0, 0.07]}>
          <TextLabel
            text={domain}
            width={width * 0.62}
            height={height * 0.14}
          />
        </group>
      </group>

      <group position={[0, height + 1.08, 0]}>
        <BuildingBadge
          title={name ?? domain}
          subtitle={price}
          width={2.35}
          height={0.82}
        />
      </group>
    </group>
  );
}
