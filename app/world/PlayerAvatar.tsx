"use client";

import { Billboard } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import {
  AVATAR_ACCENT_OPTIONS,
  AVATAR_COLOR_OPTIONS,
  AVATAR_PANTS_OPTIONS,
  AVATAR_SKIN_OPTIONS,
  getAvatarColor,
  resolveAvatarStyle,
  type AvatarStyle,
} from "@/multiplayer/avatar-profile";
import type { PlayerMotionRef } from "./types";

function AvatarHat({ avatar }: { avatar: AvatarStyle }) {
  if (avatar.hatStyle === "none") return null;
  const color = getAvatarColor(AVATAR_COLOR_OPTIONS, avatar.hatColor);

  if (avatar.hatStyle === "beanie") {
    return (
      <group position={[0, 2.25, 0]}>
        <mesh castShadow scale={[1, 0.72, 1]}>
          <sphereGeometry args={[0.38, 10, 7]} />
          <meshStandardMaterial color={color} roughness={0.84} />
        </mesh>
        <mesh castShadow position={[0, 0.27, 0]}>
          <icosahedronGeometry args={[0.105, 1]} />
          <meshStandardMaterial color={color} roughness={0.84} />
        </mesh>
      </group>
    );
  }

  if (avatar.hatStyle === "bucket") {
    return (
      <group position={[0, 2.27, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.3, 0.39, 0.3, 12]} />
          <meshStandardMaterial color={color} roughness={0.84} />
        </mesh>
        <mesh castShadow position={[0, -0.13, 0]}>
          <cylinderGeometry args={[0.48, 0.48, 0.07, 12]} />
          <meshStandardMaterial color={color} roughness={0.84} />
        </mesh>
      </group>
    );
  }

  return (
    <group position={[0, 2.27, 0]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.36, 0.39, 0.27, 12]} />
        <meshStandardMaterial color={color} roughness={0.82} />
      </mesh>
      <mesh castShadow position={[0, -0.08, 0.29]}>
        <boxGeometry args={[0.46, 0.07, 0.36]} />
        <meshStandardMaterial color={color} roughness={0.82} />
      </mesh>
    </group>
  );
}

function UsernameLabel({ username }: { username: string }) {
  const texture = useMemo(() => {
    if (typeof document === "undefined") return null;

    const canvas = document.createElement("canvas");
    canvas.width = 768;
    canvas.height = 192;
    const context = canvas.getContext("2d");
    if (!context) return null;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "rgba(16, 31, 38, 0.9)";
    context.beginPath();
    context.roundRect(18, 18, canvas.width - 36, canvas.height - 36, 72);
    context.fill();
    context.strokeStyle = "rgba(255, 255, 255, 0.76)";
    context.lineWidth = 8;
    context.stroke();
    context.fillStyle = "#ffffff";
    context.font = '800 72px "Inter", Arial, sans-serif';
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(username, canvas.width / 2, canvas.height / 2 + 3, 660);

    const nextTexture = new THREE.CanvasTexture(canvas);
    nextTexture.colorSpace = THREE.SRGBColorSpace;
    nextTexture.minFilter = THREE.LinearFilter;
    nextTexture.magFilter = THREE.LinearFilter;
    nextTexture.needsUpdate = true;
    return nextTexture;
  }, [username]);

  useEffect(() => () => texture?.dispose(), [texture]);

  if (!texture) return null;

  return (
    <Billboard position={[0, 2.8, 0]} follow>
      <mesh renderOrder={10}>
        <planeGeometry args={[2.35, 0.58]} />
        <meshBasicMaterial
          map={texture}
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </Billboard>
  );
}

export function PlayerAvatar({
  motionRef,
  username,
  avatar,
  onSelect,
}: {
  motionRef: PlayerMotionRef;
  username: string;
  avatar?: AvatarStyle;
  onSelect?: () => void;
}) {
  const visualRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const phaseRef = useRef(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const resolvedAvatar = resolveAvatarStyle(avatar);
  const skinColor = getAvatarColor(AVATAR_SKIN_OPTIONS, resolvedAvatar.skinTone);
  const skinAccent =
    AVATAR_SKIN_OPTIONS.find((option) => option.id === resolvedAvatar.skinTone)?.accent ??
    AVATAR_SKIN_OPTIONS[0].accent;
  const outfitColor = getAvatarColor(
    AVATAR_COLOR_OPTIONS,
    resolvedAvatar.outfitColor,
  );
  const accentColor = getAvatarColor(
    AVATAR_ACCENT_OPTIONS,
    resolvedAvatar.accentColor,
  );
  const pantsColor = getAvatarColor(
    AVATAR_PANTS_OPTIONS,
    resolvedAvatar.pantsColor,
  );

  const handleSelect = (event: ThreeEvent<MouseEvent>) => {
    if (!onSelect) return;
    event.stopPropagation();
    onSelect();
  };

  useEffect(() => () => {
    document.body.style.cursor = "default";
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => setReducedMotion(mediaQuery.matches);

    updateMotionPreference();
    mediaQuery.addEventListener("change", updateMotionPreference);
    return () => mediaQuery.removeEventListener("change", updateMotionPreference);
  }, []);

  useFrame(({ clock }, delta) => {
    const visual = visualRef.current;
    const leftArm = leftArmRef.current;
    const rightArm = rightArmRef.current;
    const leftLeg = leftLegRef.current;
    const rightLeg = rightLegRef.current;
    if (!visual || !leftArm || !rightArm || !leftLeg || !rightLeg) return;

    const { moving, running } = motionRef.current;
    const animationSpeed = running ? 12 : 8;
    if (moving) phaseRef.current += delta * animationSpeed;

    const motionScale = reducedMotion ? 0.24 : 1;
    const swingTarget = moving
      ? Math.sin(phaseRef.current) * (running ? 0.78 : 0.52)
      : 0;
    const animationSharpness = moving ? 16 : 10;
    leftArm.rotation.x = THREE.MathUtils.damp(
      leftArm.rotation.x,
      -swingTarget * motionScale,
      animationSharpness,
      delta,
    );
    rightArm.rotation.x = THREE.MathUtils.damp(
      rightArm.rotation.x,
      swingTarget * motionScale,
      animationSharpness,
      delta,
    );
    leftLeg.rotation.x = THREE.MathUtils.damp(
      leftLeg.rotation.x,
      swingTarget * motionScale,
      animationSharpness,
      delta,
    );
    rightLeg.rotation.x = THREE.MathUtils.damp(
      rightLeg.rotation.x,
      -swingTarget * motionScale,
      animationSharpness,
      delta,
    );

    const idleBob = reducedMotion
      ? 0
      : Math.sin(clock.getElapsedTime() * 2.1) * 0.018;
    const walkBob = moving
      ? Math.abs(Math.sin(phaseRef.current * 2)) *
        (running ? 0.075 : 0.045) *
        motionScale
      : 0;
    visual.position.y = THREE.MathUtils.damp(
      visual.position.y,
      idleBob + walkBob,
      12,
      delta,
    );
  });

  return (
    <group
      onClick={handleSelect}
      onPointerOver={(event) => {
        if (!onSelect) return;
        event.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={(event) => {
        if (!onSelect) return;
        event.stopPropagation();
        document.body.style.cursor = "default";
      }}
    >
      <group ref={visualRef}>
        <AvatarHat avatar={resolvedAvatar} />
        <mesh castShadow position={[0, 1.98, 0]}>
          <icosahedronGeometry args={[0.35, 1]} />
          <meshStandardMaterial color={skinColor} roughness={0.82} />
        </mesh>
        <mesh castShadow position={[0, 1.93, 0.31]} scale={[1, 0.34, 0.18]}>
          <sphereGeometry args={[0.19, 8, 6]} />
          <meshStandardMaterial color={skinAccent} roughness={0.78} />
        </mesh>
        {[-0.12, 0.12].map((x) => (
          <mesh key={x} position={[x, 2.04, 0.31]}>
            <sphereGeometry args={[0.035, 6, 4]} />
            <meshStandardMaterial color="#16333b" roughness={0.7} />
          </mesh>
        ))}

        <mesh castShadow position={[0, 1.34, 0]}>
          <boxGeometry args={[0.72, 0.92, 0.44]} />
          <meshStandardMaterial color={outfitColor} roughness={0.8} />
        </mesh>
        <mesh position={[0, 1.44, 0.225]}>
          <boxGeometry args={[0.4, 0.18, 0.03]} />
          <meshStandardMaterial color={accentColor} roughness={0.72} />
        </mesh>

        <group ref={leftArmRef} position={[-0.48, 1.66, 0]}>
          <mesh castShadow position={[0, -0.38, 0]}>
            <capsuleGeometry args={[0.12, 0.58, 4, 7]} />
            <meshStandardMaterial color={skinColor} roughness={0.82} />
          </mesh>
        </group>
        <group ref={rightArmRef} position={[0.48, 1.66, 0]}>
          <mesh castShadow position={[0, -0.38, 0]}>
            <capsuleGeometry args={[0.12, 0.58, 4, 7]} />
            <meshStandardMaterial color={skinColor} roughness={0.82} />
          </mesh>
        </group>

        <group ref={leftLegRef} position={[-0.2, 0.92, 0]}>
          <mesh castShadow position={[0, -0.42, 0]}>
            <capsuleGeometry args={[0.15, 0.58, 4, 7]} />
            <meshStandardMaterial color={pantsColor} roughness={0.84} />
          </mesh>
          <mesh castShadow position={[0, -0.78, 0.1]}>
            <boxGeometry args={[0.34, 0.18, 0.52]} />
            <meshStandardMaterial color={accentColor} roughness={0.9} />
          </mesh>
        </group>
        <group ref={rightLegRef} position={[0.2, 0.92, 0]}>
          <mesh castShadow position={[0, -0.42, 0]}>
            <capsuleGeometry args={[0.15, 0.58, 4, 7]} />
            <meshStandardMaterial color={pantsColor} roughness={0.84} />
          </mesh>
          <mesh castShadow position={[0, -0.78, 0.1]}>
            <boxGeometry args={[0.34, 0.18, 0.52]} />
            <meshStandardMaterial color={accentColor} roughness={0.9} />
          </mesh>
        </group>
      </group>

      <UsernameLabel username={username} />
    </group>
  );
}
