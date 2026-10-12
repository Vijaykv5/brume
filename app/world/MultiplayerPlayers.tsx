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
  player,
  playersRef,
}: {
  player: NetworkPlayer;
  playersRef: MutableRefObject<Map<string, NetworkPlayer>>;
}) {
  const playerId = player.id;
  const groupRef = useRef<THREE.Group>(null);
  const motionRef = useRef<PlayerMotionState>({
    position: new THREE.Vector3(
      player.x,
      player.y,
      player.z,
    ),
    velocity: new THREE.Vector3(),
    heading: player.heading,
    moving: player.movementState !== "idle",
    running: player.movementState === "running",
  });
  const targetPositionRef = useRef(new THREE.Vector3());
  const previousPositionRef = useRef(new THREE.Vector3());

  useLayoutEffect(() => {
    const group = groupRef.current;
    const latestPlayer = playersRef.current.get(playerId);
    if (!group || !latestPlayer) return;
    group.position.set(latestPlayer.x, latestPlayer.y, latestPlayer.z);
    group.rotation.y = latestPlayer.heading;
  }, [playerId, playersRef]);

  useFrame((_, rawDelta) => {
    const group = groupRef.current;
    const latestPlayer = playersRef.current.get(playerId) ?? player;
    if (!group) return;

    const delta = Math.min(rawDelta, 0.05);
    const alpha = 1 - Math.exp(-REMOTE_INTERPOLATION_SHARPNESS * delta);
    const targetPosition = targetPositionRef.current.set(
      latestPlayer.x,
      latestPlayer.y,
      latestPlayer.z,
    );
    const previousPosition = previousPositionRef.current.copy(group.position);
    group.position.lerp(targetPosition, alpha);
    group.rotation.y = dampAngle(
      group.rotation.y,
      latestPlayer.heading,
      REMOTE_INTERPOLATION_SHARPNESS,
      delta,
    );

    motionRef.current.position.copy(group.position);
    motionRef.current.velocity
      .copy(group.position)
      .sub(previousPosition)
      .divideScalar(Math.max(delta, 0.001));
    motionRef.current.heading = group.rotation.y;
    motionRef.current.moving = latestPlayer.movementState !== "idle";
    motionRef.current.running = latestPlayer.movementState === "running";
  }, -1.4);

  return (
    <group ref={groupRef}>
      <PlayerAvatar
        motionRef={motionRef}
        username={player.username}
        avatar={player.avatar}
      />
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
          player={player}
          playersRef={playersRef}
        />
      ))}
    </group>
  );
}
