"use client";

import type { ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { BuildingBadge } from "./BuildingBadge";

const METAL = "#d9e2e2";
const DARK_METAL = "#5f686b";
const FACE = "#f8fbfb";
const TRIM = "#243238";
const CONCRETE = "#a9aaa3";
const ACCENT = "#1976d2";

export type WebsiteBillboardProps = {
  plotId: string;
  name: string;
  domain: string;
  price: string;
  position: [number, number, number];
  width?: number;
  height?: number;
  poleHeight?: number;
  domainUrl?: string;
  logoUrl?: string;
  clickable?: boolean;
  onHoverChange?: (hovered: boolean) => void;
  onVisit?: () => void;
};

function getDomainUrl(domain: string, domainUrl?: string) {
  const target = domainUrl?.trim() || domain.trim();
  if (!target) return "";
  return /^https?:\/\//i.test(target) ? target : `https://${target}`;
}

function BillboardFaceTexture({
  name,
  domain,
  width,
  height,
  side,
}: {
  name: string;
  domain: string;
  width: number;
  height: number;
  side: "front" | "back";
}) {
  const texture = useMemo(() => {
    if (typeof document === "undefined") return null;

    const canvas = document.createElement("canvas");
    canvas.width = 1400;
    canvas.height = 640;
    const context = canvas.getContext("2d");
    if (!context) return null;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = FACE;
    context.fillRect(0, 0, canvas.width, canvas.height);

    const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, "rgba(25, 118, 210, 0.16)");
    gradient.addColorStop(0.48, "rgba(255, 255, 255, 0)");
    gradient.addColorStop(1, "rgba(42, 57, 63, 0.1)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.fillStyle = ACCENT;
    context.fillRect(0, canvas.height - 92, canvas.width, 92);

    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#16252d";
    context.font = '900 108px "Inter", Arial, sans-serif';
    context.fillText(name, canvas.width / 2, canvas.height * 0.42, canvas.width * 0.78);

    context.fillStyle = "#ffffff";
    context.font = '850 70px "Inter", Arial, sans-serif';
    context.fillText(domain, canvas.width / 2, canvas.height - 46, canvas.width * 0.76);

    const nextTexture = new THREE.CanvasTexture(canvas);
    nextTexture.colorSpace = THREE.SRGBColorSpace;
    nextTexture.minFilter = THREE.LinearFilter;
    nextTexture.magFilter = THREE.LinearFilter;
    nextTexture.needsUpdate = true;
    return nextTexture;
  }, [domain, name]);

  useEffect(() => () => texture?.dispose(), [texture]);

  if (!texture) return null;

  return (
    <mesh
      position={[0, 0, side === "front" ? 0.126 : -0.086]}
      rotation={[0, side === "front" ? 0 : Math.PI, 0]}
    >
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

function Beam({
  start,
  end,
  radius,
  color = METAL,
}: {
  start: [number, number, number];
  end: [number, number, number];
  radius: number;
  color?: string;
}) {
  const { length, midpoint, quaternion } = useMemo(() => {
    const startVector = new THREE.Vector3(...start);
    const endVector = new THREE.Vector3(...end);
    const direction = endVector.clone().sub(startVector);
    const nextLength = direction.length();
    const nextMidpoint = startVector.clone().add(endVector).multiplyScalar(0.5);
    const nextQuaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.normalize(),
    );

    return {
      length: nextLength,
      midpoint: nextMidpoint.toArray() as [number, number, number],
      quaternion: nextQuaternion,
    };
  }, [end, start]);

  return (
    <mesh castShadow position={midpoint} quaternion={quaternion}>
      <cylinderGeometry args={[radius, radius, length, 8]} />
      <meshStandardMaterial color={color} metalness={0.28} roughness={0.46} />
    </mesh>
  );
}

function LightFixture({ x }: { x: number }) {
  return (
    <group position={[x, -0.92, 0.28]}>
      <Beam start={[0, 0, 0]} end={[0, -0.24, 0.12]} radius={0.018} color={DARK_METAL} />
      <mesh castShadow position={[0, -0.29, 0.16]} rotation={[0.2, 0, 0]}>
        <boxGeometry args={[0.18, 0.07, 0.11]} />
        <meshStandardMaterial color="#f2f1df" emissive="#fff1a8" emissiveIntensity={0.18} />
      </mesh>
    </group>
  );
}

export function WebsiteBillboard({
  plotId,
  name,
  domain,
  price,
  position,
  width = 3.35,
  height = 1.42,
  poleHeight = 2.35,
  domainUrl,
  logoUrl = "",
  clickable = true,
  onHoverChange,
  onVisit,
}: WebsiteBillboardProps) {
  const [hovered, setHovered] = useState(false);
  const buildingUrl = clickable ? getDomainUrl(domain, domainUrl) : "";
  const boardY = poleHeight + height * 0.52;
  const halfWidth = width / 2;
  const halfHeight = height / 2;

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
    onHoverChange?.(true);
  };

  const handlePointerOut = (event: ThreeEvent<PointerEvent>) => {
    if (!buildingUrl) return;

    event.stopPropagation();
    setHovered(false);
    onHoverChange?.(false);
  };

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    if (!buildingUrl) return;

    event.stopPropagation();
    onVisit?.();
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
      <mesh castShadow receiveShadow position={[0, 0.06, 0]}>
        <boxGeometry args={[0.86, 0.12, 0.64]} />
        <meshStandardMaterial color={CONCRETE} roughness={0.86} />
      </mesh>

      <mesh castShadow position={[0, poleHeight / 2, 0]}>
        <cylinderGeometry args={[0.105, 0.14, poleHeight, 16]} />
        <meshStandardMaterial color={METAL} metalness={0.36} roughness={0.42} />
      </mesh>

      <group position={[0, boardY, 0]} rotation={[0, -0.08, 0]}>
        <mesh castShadow receiveShadow position={[0, 0, 0]}>
          <boxGeometry args={[width + 0.18, height + 0.18, 0.14]} />
          <meshStandardMaterial color={TRIM} roughness={0.62} />
        </mesh>
        <mesh castShadow receiveShadow position={[0, 0, 0.08]}>
          <boxGeometry args={[width, height, 0.08]} />
          <meshStandardMaterial color={FACE} roughness={0.58} />
        </mesh>
        <BillboardFaceTexture
          name={name}
          domain={domain}
          width={width * 0.94}
          height={height * 0.88}
          side="front"
        />
        <BillboardFaceTexture
          name={name}
          domain={domain}
          width={width * 0.94}
          height={height * 0.88}
          side="back"
        />

        <Beam
          start={[-halfWidth * 0.94, -halfHeight - 0.14, -0.18]}
          end={[halfWidth * 0.94, -halfHeight - 0.14, -0.18]}
          radius={0.028}
          color={DARK_METAL}
        />
        {[-0.78, -0.39, 0, 0.39, 0.78].map((factor) => (
          <Beam
            key={`catwalk-${factor}`}
            start={[halfWidth * factor, -halfHeight - 0.34, -0.38]}
            end={[halfWidth * factor, -halfHeight - 0.1, 0.18]}
            radius={0.014}
            color={DARK_METAL}
          />
        ))}
        <mesh castShadow receiveShadow position={[0, -halfHeight - 0.3, -0.2]}>
          <boxGeometry args={[width * 0.96, 0.04, 0.34]} />
          <meshStandardMaterial color="#7d8789" metalness={0.26} roughness={0.52} />
        </mesh>

        {[-0.64, -0.22, 0.22, 0.64].map((factor) => (
          <LightFixture key={`light-${factor}`} x={halfWidth * factor} />
        ))}
      </group>

      <Beam
        start={[0, poleHeight + 0.08, 0]}
        end={[-halfWidth * 0.72, boardY - halfHeight * 0.72, -0.05]}
        radius={0.025}
        color={DARK_METAL}
      />
      <Beam
        start={[0, poleHeight + 0.08, 0]}
        end={[halfWidth * 0.72, boardY - halfHeight * 0.72, -0.05]}
        radius={0.025}
        color={DARK_METAL}
      />

      <group position={[0, boardY + halfHeight + 0.58, 0]}>
        <BuildingBadge
          title={name}
          subtitle={price}
          width={2.2}
          height={0.74}
          backgroundColor="#f7fbff"
          borderColor={ACCENT}
          titleColor="#18303d"
          subtitleColor={ACCENT}
        />
      </group>
    </group>
  );
}
