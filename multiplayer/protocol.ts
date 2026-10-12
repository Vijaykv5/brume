import type { AvatarStyle, PlayerProfile } from "./avatar-profile";
import { parsePlayerProfile } from "./avatar-profile";

export const MULTIPLAYER_PATH = "/multiplayer";
export const MULTIPLAYER_PROTOCOL_VERSION = 1;

export type PlayerMovementState = "idle" | "walking" | "running";

export type NetworkPlayer = {
  id: string;
  username: string;
  avatar: AvatarStyle;
  x: number;
  y: number;
  z: number;
  heading: number;
  movementState: PlayerMovementState;
  sequence: number;
  updatedAt: number;
};

export type ClientHelloMessage = {
  type: "hello";
  protocolVersion: number;
  resumeToken?: string;
  profile?: PlayerProfile;
};

export type ClientProfileMessage = {
  type: "profile";
  profile: PlayerProfile;
};

export type ClientMovementMessage = {
  type: "move";
  x: number;
  z: number;
  heading: number;
  movementState: PlayerMovementState;
  sequence: number;
};

export type ClientPingMessage = {
  type: "ping";
  sentAt: number;
};

export type ClientMessage =
  | ClientHelloMessage
  | ClientMovementMessage
  | ClientProfileMessage
  | ClientPingMessage;

export type ServerWelcomeMessage = {
  type: "welcome";
  protocolVersion: number;
  playerId: string;
  resumeToken: string;
  self: NetworkPlayer;
  players: NetworkPlayer[];
  onlineCount: number;
  serverTime: number;
};

export type ServerPlayerJoinedMessage = {
  type: "player_joined";
  player: NetworkPlayer;
  onlineCount: number;
};

export type ServerPlayerUpdatedMessage = {
  type: "player_updated";
  player: NetworkPlayer;
};

export type ServerPlayerProfileUpdatedMessage = {
  type: "player_profile_updated";
  player: NetworkPlayer;
};

export type ServerPlayerLeftMessage = {
  type: "player_left";
  playerId: string;
  onlineCount: number;
};

export type ServerSnapshotMessage = {
  type: "snapshot";
  players: NetworkPlayer[];
  onlineCount: number;
  serverTime: number;
};

export type ServerCorrectionMessage = {
  type: "correction";
  player: NetworkPlayer;
  reason: "invalid_payload" | "out_of_bounds" | "speed_limit";
};

export type ServerPongMessage = {
  type: "pong";
  sentAt: number;
  serverTime: number;
};

export type ServerErrorMessage = {
  type: "error";
  code: "handshake_required" | "protocol_mismatch" | "rate_limited";
  message: string;
};

export type ServerMessage =
  | ServerWelcomeMessage
  | ServerPlayerJoinedMessage
  | ServerPlayerUpdatedMessage
  | ServerPlayerProfileUpdatedMessage
  | ServerPlayerLeftMessage
  | ServerSnapshotMessage
  | ServerCorrectionMessage
  | ServerPongMessage
  | ServerErrorMessage;

export function isMovementState(value: unknown): value is PlayerMovementState {
  return value === "idle" || value === "walking" || value === "running";
}

export function parseClientMessage(value: string): ClientMessage | null {
  try {
    const message = JSON.parse(value) as Record<string, unknown>;

    if (message.type === "hello") {
      const profile =
        message.profile === undefined ? undefined : parsePlayerProfile(message.profile);
      if (
        typeof message.protocolVersion !== "number" ||
        (message.resumeToken !== undefined &&
          typeof message.resumeToken !== "string") ||
        (message.profile !== undefined && !profile)
      ) {
        return null;
      }

      return {
        type: "hello",
        protocolVersion: message.protocolVersion,
        ...(message.resumeToken ? { resumeToken: message.resumeToken } : {}),
        ...(profile ? { profile } : {}),
      };
    }

    if (message.type === "profile") {
      const profile = parsePlayerProfile(message.profile);
      return profile ? { type: "profile", profile } : null;
    }

    if (message.type === "move") {
      if (
        !Number.isFinite(message.x) ||
        !Number.isFinite(message.z) ||
        !Number.isFinite(message.heading) ||
        !Number.isSafeInteger(message.sequence) ||
        !isMovementState(message.movementState)
      ) {
        return null;
      }

      return {
        type: "move",
        x: message.x as number,
        z: message.z as number,
        heading: message.heading as number,
        movementState: message.movementState,
        sequence: message.sequence as number,
      };
    }

    if (
      message.type === "ping" &&
      typeof message.sentAt === "number" &&
      Number.isFinite(message.sentAt)
    ) {
      return { type: "ping", sentAt: message.sentAt };
    }

    return null;
  } catch {
    return null;
  }
}

export function parseServerMessage(value: string): ServerMessage | null {
  try {
    const message = JSON.parse(value) as ServerMessage;
    return typeof message === "object" && message !== null && "type" in message
      ? message
      : null;
  } catch {
    return null;
  }
}
