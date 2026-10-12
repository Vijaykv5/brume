"use client";

import { useFrame } from "@react-three/fiber";
import type { MutableRefObject } from "react";
import { useRef } from "react";
import * as THREE from "three";
import { resolvePlayerMovement } from "./collision";
import { PlayerAvatar } from "./PlayerAvatar";
import type {
  PlayerInputState,
  PlayerMotionRef,
  Vector3Tuple,
  WorldCollider,
  WorldInteraction,
} from "./types";
import { PLAYER_SPAWN, PLAYER_WORLD_RADIUS, WORLD_GROUND_Y } from "./world-data";
import {
  BRUME_PLAYER_RADIUS,
  BRUME_PLAYER_RUN_SPEED,
  BRUME_PLAYER_WALK_SPEED,
} from "@/multiplayer/world-config";

const PLAYER_RADIUS = BRUME_PLAYER_RADIUS;
const WALK_SPEED = BRUME_PLAYER_WALK_SPEED;
const RUN_SPEED = BRUME_PLAYER_RUN_SPEED;

function dampAngle(current: number, target: number, sharpness: number, delta: number) {
  const difference = THREE.MathUtils.euclideanModulo(
    target - current + Math.PI,
    Math.PI * 2,
  ) - Math.PI;
  return current + difference * (1 - Math.exp(-sharpness * delta));
}

export function PlayerController({
  inputRef,
  motionRef,
  colliders,
  interactions,
  positionCorrectionRef,
  onNearbyInteractionChange,
  onMovementStart,
}: {
  inputRef: MutableRefObject<PlayerInputState>;
  motionRef: PlayerMotionRef;
  colliders: WorldCollider[];
  interactions: WorldInteraction[];
  positionCorrectionRef: MutableRefObject<Vector3Tuple | null>;
  onNearbyInteractionChange: (interaction: WorldInteraction | null) => void;
  onMovementStart: () => void;
}) {
  const playerRef = useRef<THREE.Group>(null);
  const velocityRef = useRef(new THREE.Vector3());
  const desiredDirectionRef = useRef(new THREE.Vector3());
  const cameraForwardRef = useRef(new THREE.Vector3());
  const cameraRightRef = useRef(new THREE.Vector3());
  const desiredPositionRef = useRef(new THREE.Vector3());
  const previousPositionRef = useRef(new THREE.Vector3());
  const previousNearbyIdRef = useRef<string | null>(null);
  const wasMovingRef = useRef(false);

  useFrame(({ camera }, rawDelta) => {
    const player = playerRef.current;
    if (!player) return;

    const velocity = velocityRef.current;
    const desiredDirection = desiredDirectionRef.current;
    const cameraForward = cameraForwardRef.current;
    const cameraRight = cameraRightRef.current;
    const desiredPosition = desiredPositionRef.current;
    const previousPosition = previousPositionRef.current;
    const delta = Math.min(rawDelta, 0.05);
    const input = inputRef.current;

    const positionCorrection = positionCorrectionRef.current;
    if (positionCorrection) {
      player.position.fromArray(positionCorrection);
      player.rotation.y = motionRef.current.heading;
      velocity.set(0, 0, 0);
      motionRef.current.position.copy(player.position);
      motionRef.current.velocity.set(0, 0, 0);
      motionRef.current.moving = false;
      motionRef.current.running = false;
      positionCorrectionRef.current = null;
    }

    const forwardInput = Number(input.forward) - Number(input.backward);
    const sideInput = Number(input.right) - Number(input.left);
    const hasDirectionalInput = forwardInput !== 0 || sideInput !== 0;

    camera.getWorldDirection(cameraForward);
    cameraForward.y = 0;
    if (cameraForward.lengthSq() < 0.0001) cameraForward.set(0, 0, -1);
    cameraForward.normalize();
    cameraRight.crossVectors(cameraForward, THREE.Object3D.DEFAULT_UP).normalize();

    desiredDirection
      .set(0, 0, 0)
      .addScaledVector(cameraForward, forwardInput)
      .addScaledVector(cameraRight, sideInput);
    if (desiredDirection.lengthSq() > 1) desiredDirection.normalize();

    const targetSpeed = input.run ? RUN_SPEED : WALK_SPEED;
    const targetVelocityX = hasDirectionalInput
      ? desiredDirection.x * targetSpeed
      : 0;
    const targetVelocityZ = hasDirectionalInput
      ? desiredDirection.z * targetSpeed
      : 0;
    const movementSharpness = hasDirectionalInput ? 11 : 7;
    velocity.x = THREE.MathUtils.damp(
      velocity.x,
      targetVelocityX,
      movementSharpness,
      delta,
    );
    velocity.z = THREE.MathUtils.damp(
      velocity.z,
      targetVelocityZ,
      movementSharpness,
      delta,
    );

    previousPosition.copy(player.position);
    desiredPosition.copy(player.position).addScaledVector(velocity, delta);
    desiredPosition.y = WORLD_GROUND_Y;
    const resolvedPosition = resolvePlayerMovement({
      current: player.position,
      desired: desiredPosition,
      colliders,
      playerRadius: PLAYER_RADIUS,
      worldRadius: PLAYER_WORLD_RADIUS,
    });
    resolvedPosition.y = WORLD_GROUND_Y;
    player.position.copy(resolvedPosition);

    const actualDeltaX = player.position.x - previousPosition.x;
    const actualDeltaZ = player.position.z - previousPosition.z;
    const actualSpeed = Math.hypot(actualDeltaX, actualDeltaZ) / Math.max(delta, 0.001);
    const moving = actualSpeed > 0.08;
    if (moving) {
      const targetHeading = Math.atan2(actualDeltaX, actualDeltaZ);
      player.rotation.y = dampAngle(player.rotation.y, targetHeading, 14, delta);
    }

    if (moving && !wasMovingRef.current) onMovementStart();
    wasMovingRef.current = moving;

    motionRef.current.position.copy(player.position);
    motionRef.current.velocity.set(
      actualDeltaX / Math.max(delta, 0.001),
      0,
      actualDeltaZ / Math.max(delta, 0.001),
    );
    motionRef.current.heading = player.rotation.y;
    motionRef.current.moving = moving;
    motionRef.current.running = moving && input.run;

    let nearestInteraction: WorldInteraction | null = null;
    let nearestDistanceSquared = Number.POSITIVE_INFINITY;
    for (const interaction of interactions) {
      const deltaX = player.position.x - interaction.position[0];
      const deltaZ = player.position.z - interaction.position[2];
      const distanceSquared = deltaX * deltaX + deltaZ * deltaZ;
      if (
        distanceSquared <= interaction.range * interaction.range &&
        distanceSquared < nearestDistanceSquared
      ) {
        nearestInteraction = interaction;
        nearestDistanceSquared = distanceSquared;
      }
    }

    const nearbyId = nearestInteraction?.id ?? null;
    if (nearbyId !== previousNearbyIdRef.current) {
      previousNearbyIdRef.current = nearbyId;
      onNearbyInteractionChange(nearestInteraction);
    }
  }, -2);

  return (
    <group ref={playerRef} position={PLAYER_SPAWN}>
      <PlayerAvatar motionRef={motionRef} username="BRUME Explorer" />
    </group>
  );
}
