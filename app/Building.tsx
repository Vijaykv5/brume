"use client";

import { Billboard } from "@react-three/drei";
import type { ThreeElements } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";

const WINDOW_COLOR = "#a9dbed";
const WINDOW_FRAME_COLOR = "#d8ddd8";
const ENTRANCE_COLOR = "#26383d";
const ROOF_COLOR = "#ece9df";
const SIGN_COLOR = "#34454a";

export type BuildingProps = {
  domain: string;
  price: string;
  position: [number, number, number];
  width: number;
  height: number;
  depth: number;
  primaryColor: string;
  logoUrl: string;
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

export function Building({
  domain,
  price,
  position,
  width,
  height,
  depth,
  primaryColor,
  logoUrl,
}: BuildingProps) {
  const floorHeight = height / 2;
  const frontZ = depth / 2 + 0.045;
  const sideX = width / 2 + 0.045;
  const upperWindowY = height * 0.72;
  const lowerWindowY = height * 0.28;
  const windowWidth = width * 0.2;
  const windowHeight = floorHeight * 0.42;
  const sideWindowWidth = depth * 0.2;

  return (
    <group position={position} userData={{ domain, price, logoUrl }}>
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

      <Billboard position={[width * 0.34, height + 1.15, 0]} follow>
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
    </group>
  );
}
