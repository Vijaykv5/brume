"use client";

import type { ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { BuildingBadge } from "./BuildingBadge";

const RED = "#d5161f";
const WHITE = "#f3f4ef";
const STEEL = "#d9dedb";
const DARK_STEEL = "#8b918e";
const PAD = "#d9232e";

export type SignalTowerProps = {
  plotId: string;
  name: string;
  domain: string;
  price: string;
  domainUrl?: string;
  position: [number, number, number];
  height: number;
  baseWidth: number;
  depth: number;
  clickable?: boolean;
  onHoverChange?: (hovered: boolean) => void;
  onVisit?: () => void;
};

function getDomainUrl(domain: string, domainUrl?: string) {
  const target = domainUrl?.trim() || domain.trim();
  if (!target) return "";
  return /^https?:\/\//i.test(target) ? target : `https://${target}`;
}

function Beam({
  start,
  end,
  radius,
  color,
}: {
  start: [number, number, number];
  end: [number, number, number];
  radius: number;
  color: string;
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
    <mesh position={midpoint} quaternion={quaternion}>
      <cylinderGeometry args={[radius, radius, length, 8]} />
      <meshStandardMaterial color={color} roughness={0.58} metalness={0.22} />
    </mesh>
  );
}

function Dish({
  position,
  rotation,
  scale = 1,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  scale?: number;
}) {
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh>
        <sphereGeometry args={[0.42, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={STEEL} roughness={0.44} metalness={0.28} />
      </mesh>
      <Beam start={[0, -0.04, 0]} end={[0, -0.66, 0]} radius={0.035} color={DARK_STEEL} />
    </group>
  );
}

function PanelAntenna({
  position,
  rotation,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
}) {
  return (
    <group position={position} rotation={rotation}>
      <mesh>
        <boxGeometry args={[0.18, 1.35, 0.12]} />
        <meshStandardMaterial color={STEEL} roughness={0.42} metalness={0.34} />
      </mesh>
      <Beam start={[0, -0.62, 0]} end={[0, -1.06, 0]} radius={0.028} color={DARK_STEEL} />
    </group>
  );
}

export function SignalTower({
  plotId,
  name,
  domain,
  price,
  domainUrl,
  position,
  height,
  baseWidth,
  depth,
  clickable = true,
  onHoverChange,
  onVisit,
}: SignalTowerProps) {
  const [hovered, setHovered] = useState(false);
  const buildingUrl = clickable ? getDomainUrl(domain, domainUrl) : "";
  const levels = [0, 0.18, 0.36, 0.54, 0.72, 0.88, 1] as const;
  const legRadius = baseWidth * 0.014;
  const braceRadius = baseWidth * 0.008;
  const mastRadius = baseWidth * 0.01;

  const cornerAt = (level: number, xSign: -1 | 1, zSign: -1 | 1): [number, number, number] => {
    const taper = THREE.MathUtils.lerp(1, 0.2, level);
    return [
      xSign * (baseWidth * 0.5 * taper),
      height * level,
      zSign * (depth * 0.5 * taper),
    ];
  };

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
      userData={{ plotId, domain, price }}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    >
      {([-1, 1] as const).flatMap((xSign) =>
        ([-1, 1] as const).map((zSign) => (
          <group key={`pad-${xSign}-${zSign}`}>
            <mesh receiveShadow position={cornerAt(0, xSign, zSign)}>
              <boxGeometry args={[0.56, 0.2, 0.56]} />
              <meshStandardMaterial color={PAD} roughness={0.65} />
            </mesh>
            <Beam
              start={cornerAt(0, xSign, zSign)}
              end={cornerAt(0.72, xSign, zSign)}
              radius={legRadius}
              color={xSign === zSign ? RED : WHITE}
            />
            <Beam
              start={cornerAt(0.72, xSign, zSign)}
              end={cornerAt(1, xSign, zSign)}
              radius={legRadius * 0.9}
              color={RED}
            />
          </group>
        )),
      )}

      {levels.slice(0, -1).map((level, index) => {
        const nextLevel = levels[index + 1];
        const color = index % 2 === 0 ? RED : WHITE;

        return (
          <group key={`level-${level}`}>
            {([-1, 1] as const).map((zSign) => (
              <Beam
                key={`front-brace-${zSign}`}
                start={cornerAt(level, -1, zSign)}
                end={cornerAt(nextLevel, 1, zSign)}
                radius={braceRadius}
                color={color}
              />
            ))}
            {([-1, 1] as const).map((xSign) => (
              <Beam
                key={`side-brace-${xSign}`}
                start={cornerAt(level, xSign, -1)}
                end={cornerAt(nextLevel, xSign, 1)}
                radius={braceRadius}
                color={index % 2 === 0 ? WHITE : RED}
              />
            ))}
            <Beam
              start={cornerAt(nextLevel, -1, -1)}
              end={cornerAt(nextLevel, 1, -1)}
              radius={braceRadius}
              color={color}
            />
            <Beam
              start={cornerAt(nextLevel, -1, 1)}
              end={cornerAt(nextLevel, 1, 1)}
              radius={braceRadius}
              color={color}
            />
            <Beam
              start={cornerAt(nextLevel, -1, -1)}
              end={cornerAt(nextLevel, -1, 1)}
              radius={braceRadius}
              color={color}
            />
            <Beam
              start={cornerAt(nextLevel, 1, -1)}
              end={cornerAt(nextLevel, 1, 1)}
              radius={braceRadius}
              color={color}
            />
          </group>
        );
      })}

      <Beam start={[0, height * 0.78, 0]} end={[0, height * 1.2, 0]} radius={mastRadius} color={RED} />
      <Beam start={[-0.5, height * 1.02, 0]} end={[0.5, height * 1.02, 0]} radius={braceRadius} color={RED} />
      <Beam start={[0, height * 1.08, -0.42]} end={[0, height * 1.08, 0.42]} radius={braceRadius} color={RED} />
      <Beam start={[0, height * 1.2, 0]} end={[0, height * 1.35, 0]} radius={mastRadius * 0.65} color={RED} />

      <Dish position={[-baseWidth * 0.38, height * 0.36, depth * 0.48]} rotation={[0.2, -0.85, -0.2]} scale={1.05} />
      <Dish position={[baseWidth * 0.24, height * 0.58, depth * 0.42]} rotation={[0.24, 0.72, 0.18]} scale={0.82} />
      <Dish position={[-baseWidth * 0.2, height * 0.86, depth * 0.28]} rotation={[0.3, -0.6, 0.1]} scale={0.7} />

      <PanelAntenna position={[baseWidth * 0.42, height * 0.48, -depth * 0.36]} rotation={[0, 0.46, 0]} />
      <PanelAntenna position={[-baseWidth * 0.36, height * 0.66, -depth * 0.32]} rotation={[0, -0.44, 0]} />
      <PanelAntenna position={[baseWidth * 0.26, height * 0.82, depth * 0.24]} rotation={[0, 0.6, 0]} />

      <group position={[0, height * 1.28, 0]}>
        <BuildingBadge
          title={name}
          subtitle={price}
          width={3.1}
          height={1}
          backgroundColor="#fff7f4"
          borderColor={RED}
          titleColor={RED}
          subtitleColor="#343638"
        />
      </group>
    </group>
  );
}
