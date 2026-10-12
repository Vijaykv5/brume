"use client";

import { useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import type { NetworkPlayer } from "@/multiplayer/protocol";
import type { PlayerMotionRef } from "./types";

const PLAYER_INTERACTION_RANGE = 3.2;
const PROXIMITY_POLL_INTERVAL_MS = 100;

export function useNearbyPlayer(
  localMotionRef: PlayerMotionRef,
  remotePlayersRef: MutableRefObject<Map<string, NetworkPlayer>>,
) {
  const [nearbyPlayer, setNearbyPlayer] = useState<NetworkPlayer | null>(null);
  const nearbyPlayerIdRef = useRef<string | null>(null);

  useEffect(() => {
    const updateNearbyPlayer = () => {
      const localPosition = localMotionRef.current.position;
      let nearestPlayer: NetworkPlayer | null = null;
      let nearestDistanceSquared = Number.POSITIVE_INFINITY;

      for (const player of remotePlayersRef.current.values()) {
        const deltaX = player.x - localPosition.x;
        const deltaZ = player.z - localPosition.z;
        const distanceSquared = deltaX * deltaX + deltaZ * deltaZ;

        if (
          distanceSquared <= PLAYER_INTERACTION_RANGE * PLAYER_INTERACTION_RANGE &&
          distanceSquared < nearestDistanceSquared
        ) {
          nearestPlayer = player;
          nearestDistanceSquared = distanceSquared;
        }
      }

      const nearestPlayerId = nearestPlayer?.id ?? null;
      if (nearestPlayerId === nearbyPlayerIdRef.current) return;

      nearbyPlayerIdRef.current = nearestPlayerId;
      setNearbyPlayer(nearestPlayer);
    };

    updateNearbyPlayer();
    const interval = window.setInterval(
      updateNearbyPlayer,
      PROXIMITY_POLL_INTERVAL_MS,
    );

    return () => window.clearInterval(interval);
  }, [localMotionRef, remotePlayersRef]);

  return nearbyPlayer;
}
