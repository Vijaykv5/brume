"use client";

import { OrbitControls } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ComponentRef } from "react";
import * as THREE from "three";
import type { PlayerMotionRef, Vector3Tuple } from "./types";
import { WORLD_GROUND_Y } from "./world-data";

export type CameraFocusRequest = {
  id: string;
  target: Vector3Tuple;
  distance: number;
};

const DEFAULT_CAMERA_OFFSET = new THREE.Vector3(8, 7, 10);
const PLAYER_TARGET_HEIGHT = 1.28;

export function ThirdPersonCamera({
  playerMotionRef,
  focusRequest,
  resetToken,
}: {
  playerMotionRef: PlayerMotionRef;
  focusRequest: CameraFocusRequest | null;
  resetToken: number;
}) {
  const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null);
  const resetInProgressRef = useRef(true);
  const lastResetTokenRef = useRef(resetToken);
  const desiredTargetRef = useRef(new THREE.Vector3());
  const targetStepRef = useRef(new THREE.Vector3());
  const desiredCameraPositionRef = useRef(new THREE.Vector3());
  const cameraDirectionRef = useRef(new THREE.Vector3());
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => setReducedMotion(mediaQuery.matches);

    updateMotionPreference();
    mediaQuery.addEventListener("change", updateMotionPreference);
    return () => mediaQuery.removeEventListener("change", updateMotionPreference);
  }, []);

  useLayoutEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const playerPosition = playerMotionRef.current.position;
    const initialTarget = playerPosition
      .clone()
      .add(new THREE.Vector3(0, PLAYER_TARGET_HEIGHT, 0));

    controls.object.position.copy(initialTarget).add(DEFAULT_CAMERA_OFFSET);
    controls.object.lookAt(initialTarget);
    controls.target.copy(initialTarget);
    controls.update();
  }, [playerMotionRef]);

  useEffect(() => {
    if (lastResetTokenRef.current === resetToken) return;
    lastResetTokenRef.current = resetToken;
    resetInProgressRef.current = true;
  }, [resetToken]);

  useEffect(() => {
    if (focusRequest) resetInProgressRef.current = false;
  }, [focusRequest]);

  useFrame((_, rawDelta) => {
    const controls = controlsRef.current;
    if (!controls) return;

    const camera = controls.object;
    const desiredTarget = desiredTargetRef.current;
    const targetStep = targetStepRef.current;
    const desiredCameraPosition = desiredCameraPositionRef.current;
    const cameraDirection = cameraDirectionRef.current;
    const delta = Math.min(rawDelta, 0.05);
    const alpha = reducedMotion ? 1 : 1 - Math.exp(-7 * delta);
    if (focusRequest) {
      desiredTarget.fromArray(focusRequest.target);
      cameraDirection.copy(camera.position).sub(controls.target);
      if (cameraDirection.lengthSq() < 0.001) {
        cameraDirection.copy(DEFAULT_CAMERA_OFFSET);
      }
      cameraDirection.normalize();
      desiredCameraPosition
        .copy(desiredTarget)
        .addScaledVector(cameraDirection, focusRequest.distance);
      controls.target.lerp(desiredTarget, alpha);
      camera.position.lerp(desiredCameraPosition, alpha);
    } else {
      desiredTarget
        .copy(playerMotionRef.current.position)
        .add(new THREE.Vector3(0, PLAYER_TARGET_HEIGHT, 0));

      if (resetInProgressRef.current) {
        desiredCameraPosition.copy(desiredTarget).add(DEFAULT_CAMERA_OFFSET);
        controls.target.lerp(desiredTarget, alpha);
        camera.position.lerp(desiredCameraPosition, alpha);

        if (
          camera.position.distanceToSquared(desiredCameraPosition) < 0.003 &&
          controls.target.distanceToSquared(desiredTarget) < 0.003
        ) {
          resetInProgressRef.current = false;
        }
      } else {
        targetStep.copy(desiredTarget).sub(controls.target).multiplyScalar(alpha);
        controls.target.add(targetStep);
        camera.position.add(targetStep);
      }
    }

    camera.position.y = Math.max(camera.position.y, WORLD_GROUND_Y + 1.1);
    controls.update();
  }, -1);

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.08}
      enablePan={false}
      enableRotate
      enableZoom
      minDistance={4.5}
      maxDistance={30}
      minPolarAngle={0.32}
      maxPolarAngle={Math.PI / 2.18}
      mouseButtons={{
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.ROTATE,
      }}
      touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
      onStart={() => {
        resetInProgressRef.current = false;
      }}
    />
  );
}
