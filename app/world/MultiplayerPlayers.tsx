"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import * as THREE from "three";
import type { NetworkPlayer } from "@/multiplayer/protocol";
import { PlayerAvatar } from "./PlayerAvatar";
import type { PlayerMotionRef, PlayerMotionState } from "./types";

const MOVEMENT_SEND_INTERVAL_SECONDS = 1 / 12;
const IDLE_SEND_INTERVAL_SECONDS = 1;
const REMOTE_INTERPOLATION_SHARPNESS = 12;

function dampAngle(current: number, target: number, sharpness: number, delta: number) {
  const difference =
    THREE.MathUtils.euclideanModulo(target - current + Math.PI, Math.PI * 2) -
    Math.PI;
  return current + difference * (1 - Math.exp(-sharpness * delta));
}

function RemotePlayer({
  initialPlayer,
  playersRef,
}: {
  initialPlayer: NetworkPlayer;
  playersRef: MutableRefObject<Map<string, NetworkPlayer>>;
}) {
  const playerId = initialPlayer.id;
  const groupRef = useRef<THREE.Group>(null);
  const motionRef = useRef<PlayerMotionState>({
    position: new THREE.Vector3(
      initialPlayer.x,
      initialPlayer.y,
      initialPlayer.z,
    ),
    velocity: new THREE.Vector3(),
    heading: initialPlayer.heading,
    moving: initialPlayer.movementState !== "idle",
    running: initialPlayer.movementState === "running",
  });
  const targetPositionRef = useRef(new THREE.Vector3());
  const previousPositionRef = useRef(new THREE.Vector3());

  useLayoutEffect(() => {
    const group = groupRef.current;
    const player = playersRef.current.get(playerId);
    if (!group || !player) return;
    group.position.set(player.x, player.y, player.z);
    group.rotation.y = player.heading;
  }, [playerId, playersRef]);

  useFrame((_, rawDelta) => {
    const group = groupRef.current;
    const player = playersRef.current.get(playerId);
    if (!group || !player) return;

    const delta = Math.min(rawDelta, 0.05);
    const alpha = 1 - Math.exp(-REMOTE_INTERPOLATION_SHARPNESS * delta);
    const targetPosition = targetPositionRef.current.set(
      player.x,
      player.y,
      player.z,
    );
    const previousPosition = previousPositionRef.current.copy(group.position);
    group.position.lerp(targetPosition, alpha);
    group.rotation.y = dampAngle(
      group.rotation.y,
      player.heading,
      REMOTE_INTERPOLATION_SHARPNESS,
      delta,
    );

    motionRef.current.position.copy(group.position);
    motionRef.current.velocity
      .copy(group.position)
      .sub(previousPosition)
      .divideScalar(Math.max(delta, 0.001));
    motionRef.current.heading = group.rotation.y;
    motionRef.current.moving = player.movementState !== "idle";
    motionRef.current.running = player.movementState === "running";
  }, -1.4);

  return (
    <group
      ref={groupRef}
      position={[initialPlayer.x, initialPlayer.y, initialPlayer.z]}
      rotation={[0, initialPlayer.heading, 0]}
    >
      <PlayerAvatar motionRef={motionRef} username={initialPlayer.username} />
    </group>
  );
}

export function MultiplayerPlayers({
  players,
  playersRef,
  localMotionRef,
  sendLocalState,
}: {
  players: NetworkPlayer[];
  playersRef: MutableRefObject<Map<string, NetworkPlayer>>;
  localMotionRef: PlayerMotionRef;
  sendLocalState: (motion: PlayerMotionState) => void;
}) {
  const sendElapsedRef = useRef(0);
  const previousMovementStateRef = useRef("idle");

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const localMotion = localMotionRef.current;
    const movementState = localMotion.running
      ? "running"
      : localMotion.moving
        ? "walking"
        : "idle";
    sendElapsedRef.current += delta;
    const sendInterval = localMotion.moving
      ? MOVEMENT_SEND_INTERVAL_SECONDS
      : IDLE_SEND_INTERVAL_SECONDS;
    const stateChanged = movementState !== previousMovementStateRef.current;

    if (stateChanged || sendElapsedRef.current >= sendInterval) {
      sendElapsedRef.current = 0;
      previousMovementStateRef.current = movementState;
      sendLocalState(localMotion);
    }
  }, -1.5);

  return (
    <group>
      {players.map((player) => (
        <RemotePlayer
          key={player.id}
          initialPlayer={player}
          playersRef={playersRef}
        />
      ))}
    </group>
  );
}
