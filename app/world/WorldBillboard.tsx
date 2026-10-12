"use client";

import { useTexture } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { ExampleBillboard } from "./types";

function BillboardCreative({
  imageUrl,
  active,
}: {
  imageUrl: string;
  active: boolean;
}) {
  const sourceTexture = useTexture(imageUrl);
  const texture = useMemo(() => {
    const nextTexture = sourceTexture.clone();
    nextTexture.colorSpace = THREE.SRGBColorSpace;
    nextTexture.anisotropy = 4;
    nextTexture.needsUpdate = true;
    return nextTexture;
  }, [sourceTexture]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <>
      {[0.111, -0.111].map((z, index) => (
        <mesh
          key={z}
          position={[0, 0, z]}
          rotation={[0, index === 0 ? 0 : Math.PI, 0]}
        >
          <planeGeometry args={[4.8, 2.18]} />
          <meshStandardMaterial
            map={texture}
            emissive={active ? "#8eea35" : "#ffffff"}
            emissiveIntensity={active ? 0.12 : 0.02}
            roughness={0.62}
            toneMapped={false}
          />
        </mesh>
      ))}
    </>
  );
}

function WorldBillboard({
  billboard,
  active,
}: {
  billboard: ExampleBillboard;
  active: boolean;
}) {
  return (
    <group
      position={billboard.position}
      rotation={[0, billboard.rotationY, 0]}
      userData={{ interactionId: billboard.id }}
    >
      <mesh castShadow receiveShadow position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.62, 0.72, 0.16, 10]} />
        <meshStandardMaterial color="#8a978c" roughness={0.92} />
      </mesh>
      <mesh castShadow position={[0, 1.55, 0]}>
        <cylinderGeometry args={[0.12, 0.17, 3, 10]} />
        <meshStandardMaterial color="#5c6b70" metalness={0.18} roughness={0.62} />
      </mesh>

      <group position={[0, 3.15, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[5.15, 2.52, 0.18]} />
          <meshStandardMaterial
            color={active ? "#174c3b" : "#263b42"}
            roughness={0.72}
          />
        </mesh>
        <BillboardCreative imageUrl={billboard.imageUrl} active={active} />
        {[-2.25, 2.25].map((x) => (
          <mesh key={x} position={[x, -1.43, 0.25]} rotation={[0.22, 0, 0]}>
            <boxGeometry args={[0.24, 0.16, 0.32]} />
            <meshStandardMaterial
              color="#fff3bd"
              emissive="#ffe784"
              emissiveIntensity={0.46}
              roughness={0.54}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

export function WorldBillboards({
  billboards,
  nearbyInteractionId,
}: {
  billboards: ExampleBillboard[];
  nearbyInteractionId: string | null;
}) {
  return billboards.map((billboard) => (
    <WorldBillboard
      key={billboard.id}
      billboard={billboard}
      active={billboard.id === nearbyInteractionId}
    />
  ));
}
