"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import {
  MULTIPLAYER_PATH,
  MULTIPLAYER_PROTOCOL_VERSION,
  type ClientMessage,
  type NetworkPlayer,
  type PlayerMovementState,
  parseServerMessage,
} from "@/multiplayer/protocol";
import {
  createDefaultPlayerProfile,
  parsePlayerProfile,
  resolveAvatarStyle,
  type PlayerProfile,
} from "@/multiplayer/avatar-profile";
import type { PlayerMotionState, Vector3Tuple } from "./types";

const RESUME_TOKEN_KEY = "brume-world:multiplayer-resume-token";
const PLAYER_PROFILE_KEY = "brume-world:player-profile";
const MAX_RECONNECT_DELAY_MS = 8_000;

export type MultiplayerConnectionState =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "offline";

type MultiplayerState = {
  connectionState: MultiplayerConnectionState;
  localPlayerId: string | null;
  onlineCount: number;
  remotePlayers: NetworkPlayer[];
  remotePlayersRef: MutableRefObject<Map<string, NetworkPlayer>>;
  positionCorrectionRef: MutableRefObject<Vector3Tuple | null>;
  localProfile: PlayerProfile;
  updateLocalProfile: (profile: PlayerProfile) => void;
  sendLocalState: (motion: PlayerMotionState) => void;
};

function getWebSocketUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_MULTIPLAYER_WS_URL?.trim();
  if (configuredUrl) return configuredUrl;

  const socketProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const isLocal =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  return isLocal
    ? `${socketProtocol}//${window.location.hostname}:8788${MULTIPLAYER_PATH}`
    : `${socketProtocol}//${window.location.host}${MULTIPLAYER_PATH}`;
}

function getResumeToken() {
  try {
    return window.sessionStorage.getItem(RESUME_TOKEN_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

function storeResumeToken(token: string) {
  try {
    window.sessionStorage.setItem(RESUME_TOKEN_KEY, token);
  } catch {
    // Session continuity is best-effort when browser storage is unavailable.
  }
}

function getStoredProfile() {
  try {
    const value = window.localStorage.getItem(PLAYER_PROFILE_KEY);
    return value ? parsePlayerProfile(JSON.parse(value)) : null;
  } catch {
    return null;
  }
}

function storeProfile(profile: PlayerProfile) {
  try {
    window.localStorage.setItem(PLAYER_PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // Profile persistence is best-effort when browser storage is unavailable.
  }
}

function movementStateForMotion(motion: PlayerMotionState): PlayerMovementState {
  if (!motion.moving) return "idle";
  return motion.running ? "running" : "walking";
}

function normalizeNetworkPlayer(player: NetworkPlayer): NetworkPlayer {
  return {
    ...player,
    avatar: resolveAvatarStyle(player.avatar),
  };
}

function samePlayerRoster(current: NetworkPlayer[], next: NetworkPlayer[]) {
  return (
    current.length === next.length &&
    current.every((player, index) => {
      const nextPlayer = next[index];
      return (
        player.id === nextPlayer?.id &&
        player.username === nextPlayer.username &&
        JSON.stringify(player.avatar) === JSON.stringify(nextPlayer.avatar)
      );
    })
  );
}

export function useMultiplayer(): MultiplayerState {
  const socketRef = useRef<WebSocket | null>(null);
  const remotePlayersRef = useRef(new Map<string, NetworkPlayer>());
  const positionCorrectionRef = useRef<Vector3Tuple | null>(null);
  const localPlayerIdRef = useRef<string | null>(null);
  const sequenceRef = useRef(0);
  const [connectionState, setConnectionState] =
    useState<MultiplayerConnectionState>("connecting");
  const [localPlayerId, setLocalPlayerId] = useState<string | null>(null);
  const [onlineCount, setOnlineCount] = useState(0);
  const [remotePlayers, setRemotePlayers] = useState<NetworkPlayer[]>([]);
  const [localProfile, setLocalProfile] = useState<PlayerProfile>(() =>
    createDefaultPlayerProfile(),
  );

  const syncRemotePlayers = useCallback(() => {
    const nextPlayers = Array.from(remotePlayersRef.current.values()).sort(
      (firstPlayer, secondPlayer) => firstPlayer.id.localeCompare(secondPlayer.id),
    );
    setRemotePlayers((currentPlayers) =>
      samePlayerRoster(currentPlayers, nextPlayers) ? currentPlayers : nextPlayers,
    );
  }, []);

  useEffect(() => {
    let disposed = false;
    let reconnectAttempts = 0;
    let reconnectTimer: number | undefined;

    const clearRemotePlayers = () => {
      remotePlayersRef.current.clear();
      syncRemotePlayers();
    };

    const connect = () => {
      if (disposed || !navigator.onLine) return;

      const socket = new WebSocket(getWebSocketUrl());
      socketRef.current = socket;

      socket.addEventListener("open", () => {
        reconnectAttempts = 0;
        const storedProfile = getStoredProfile();
        if (storedProfile) setLocalProfile(storedProfile);
        const hello: ClientMessage = {
          type: "hello",
          protocolVersion: MULTIPLAYER_PROTOCOL_VERSION,
          resumeToken: getResumeToken(),
          ...(storedProfile ? { profile: storedProfile } : {}),
        };
        socket.send(JSON.stringify(hello));
      });

      socket.addEventListener("message", (event) => {
        if (typeof event.data !== "string") return;
        const message = parseServerMessage(event.data);
        if (!message) return;

        if (message.type === "welcome") {
          const self = normalizeNetworkPlayer(message.self);
          storeResumeToken(message.resumeToken);
          localPlayerIdRef.current = message.playerId;
          sequenceRef.current = self.sequence;
          positionCorrectionRef.current = [
            self.x,
            self.y,
            self.z,
          ];
          remotePlayersRef.current.clear();
          for (const player of message.players) {
            if (player.id !== message.playerId) {
              remotePlayersRef.current.set(player.id, normalizeNetworkPlayer(player));
            }
          }
          syncRemotePlayers();
          setLocalPlayerId(message.playerId);
          const nextProfile =
            getStoredProfile() ??
            createDefaultPlayerProfile(self.username);
          setLocalProfile(nextProfile);
          storeProfile(nextProfile);
          setOnlineCount(message.onlineCount);
          setConnectionState("connected");
          return;
        }

        if (message.type === "player_joined") {
          if (message.player.id !== localPlayerIdRef.current) {
            remotePlayersRef.current.set(
              message.player.id,
              normalizeNetworkPlayer(message.player),
            );
            syncRemotePlayers();
          }
          setOnlineCount(message.onlineCount);
          return;
        }

        if (message.type === "player_updated") {
          if (message.player.id !== localPlayerIdRef.current) {
            remotePlayersRef.current.set(
              message.player.id,
              normalizeNetworkPlayer(message.player),
            );
          }
          return;
        }

        if (message.type === "player_profile_updated") {
          if (message.player.id !== localPlayerIdRef.current) {
            remotePlayersRef.current.set(
              message.player.id,
              normalizeNetworkPlayer(message.player),
            );
            syncRemotePlayers();
          }
          return;
        }

        if (message.type === "player_left") {
          remotePlayersRef.current.delete(message.playerId);
          syncRemotePlayers();
          setOnlineCount(message.onlineCount);
          return;
        }

        if (message.type === "snapshot") {
          const nextPlayers = new Map<string, NetworkPlayer>();
          for (const player of message.players) {
            if (player.id !== localPlayerIdRef.current) {
              nextPlayers.set(player.id, normalizeNetworkPlayer(player));
            }
          }
          remotePlayersRef.current = nextPlayers;
          syncRemotePlayers();
          setOnlineCount(message.onlineCount);
          return;
        }

        if (message.type === "correction") {
          sequenceRef.current = Math.max(sequenceRef.current, message.player.sequence);
          positionCorrectionRef.current = [
            message.player.x,
            message.player.y,
            message.player.z,
          ];
        }
      });

      socket.addEventListener("close", () => {
        if (socketRef.current === socket) socketRef.current = null;
        if (disposed) return;

        clearRemotePlayers();
        setOnlineCount(0);
        setConnectionState(navigator.onLine ? "reconnecting" : "offline");
        const reconnectDelay = Math.min(
          1_000 * 2 ** reconnectAttempts,
          MAX_RECONNECT_DELAY_MS,
        );
        reconnectAttempts += 1;
        reconnectTimer = window.setTimeout(connect, reconnectDelay);
      });

      socket.addEventListener("error", () => {
        socket.close();
      });
    };

    const handleOnline = () => {
      if (socketRef.current?.readyState === WebSocket.OPEN) return;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      setConnectionState("reconnecting");
      connect();
    };

    const handleOffline = () => {
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      clearRemotePlayers();
      setOnlineCount(0);
      setConnectionState("offline");
      socketRef.current?.close(1001, "Browser offline");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      socketRef.current?.close(1000, "World closed");
      socketRef.current = null;
    };
  }, [syncRemotePlayers]);

  const sendLocalState = useCallback((motion: PlayerMotionState) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN || !localPlayerIdRef.current) {
      return;
    }

    sequenceRef.current += 1;
    const message: ClientMessage = {
      type: "move",
      x: motion.position.x,
      z: motion.position.z,
      heading: motion.heading,
      movementState: movementStateForMotion(motion),
      sequence: sequenceRef.current,
    };
    socket.send(JSON.stringify(message));
  }, []);

  const updateLocalProfile = useCallback((profile: PlayerProfile) => {
    const validProfile = parsePlayerProfile(profile);
    if (!validProfile) return;

    setLocalProfile(validProfile);
    storeProfile(validProfile);
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN || !localPlayerIdRef.current) {
      return;
    }
    socket.send(JSON.stringify({ type: "profile", profile: validProfile } satisfies ClientMessage));
  }, []);

  return {
    connectionState,
    localPlayerId,
    onlineCount,
    remotePlayers,
    remotePlayersRef,
    positionCorrectionRef,
    localProfile,
    updateLocalProfile,
    sendLocalState,
  };
}
