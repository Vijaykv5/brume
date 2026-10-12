import type { AvatarStyle, PlayerProfile } from "./avatar-profile";
import { parsePlayerProfile } from "./avatar-profile";

export const MULTIPLAYER_PATH = "/multiplayer";
export const MULTIPLAYER_PROTOCOL_VERSION = 2;

export type PlayerMovementState = "idle" | "walking" | "running";
export type EncounterKind = "high_five" | "rps";
export type RpsChoice = "rock" | "paper" | "scissors";
export type EncounterStatus = "invited" | "choosing" | "resolved" | "declined" | "cancelled";
export type EncounterResult = "completed" | "initiator_win" | "recipient_win" | "draw";

export type EncounterParticipant = {
  playerId: string;
  username: string;
  walletAddress: string;
};

export type NetworkEncounter = {
  id: string;
  kind: EncounterKind;
  initiator: EncounterParticipant;
  recipient: EncounterParticipant;
  status: EncounterStatus;
  initiatorChoice?: RpsChoice;
  recipientChoice?: RpsChoice;
  result?: EncounterResult;
  winnerPlayerId?: string;
  settlementSignature?: string;
  createdAt: number;
  resolvedAt?: number;
};

export type NetworkPlayer = {
  id: string;
  username: string;
  avatar: AvatarStyle;
  walletAddress?: string;
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
  walletAddress?: string;
};

export type ClientProfileMessage = {
  type: "profile";
  profile: PlayerProfile;
};

export type ClientWalletChallengeMessage = {
  type: "wallet_challenge";
  walletAddress: string;
};

export type ClientWalletConnectedMessage = {
  type: "wallet_connected";
  walletAddress: string;
};

export type ClientWalletAuthMessage = {
  type: "wallet_auth";
  walletAddress: string;
  challenge: string;
  signature: string;
};

export type ClientPaymentReceiptMessage = {
  type: "payment_receipt";
  signature: string;
  recipientWallet: string;
  lamports: number;
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

export type ClientEncounterRequestMessage = {
  type: "encounter_request";
  targetPlayerId: string;
  kind: EncounterKind;
};

export type ClientEncounterResponseMessage = {
  type: "encounter_response";
  encounterId: string;
  accepted: boolean;
};

export type ClientEncounterChoiceMessage = {
  type: "encounter_choice";
  encounterId: string;
  choice: RpsChoice;
};

export type ClientEncounterSettlementMessage = {
  type: "encounter_settlement";
  encounterId: string;
  signature: string;
};

export type ClientMessage =
  | ClientHelloMessage
  | ClientMovementMessage
  | ClientProfileMessage
  | ClientWalletConnectedMessage
  | ClientWalletChallengeMessage
  | ClientWalletAuthMessage
  | ClientPaymentReceiptMessage
  | ClientEncounterRequestMessage
  | ClientEncounterResponseMessage
  | ClientEncounterChoiceMessage
  | ClientEncounterSettlementMessage
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

export type ServerWalletChallengeMessage = {
  type: "wallet_challenge";
  walletAddress: string;
  challenge: string;
  expiresAt: number;
};

export type ServerWalletVerifiedMessage = {
  type: "wallet_verified";
  player: NetworkPlayer;
};

export type ServerWalletVerificationFailedMessage = {
  type: "wallet_verification_failed";
  message: string;
};

export type ServerPaymentReceivedMessage = {
  type: "payment_received";
  signature: string;
  senderPlayerId: string;
  senderUsername: string;
  senderWalletAddress: string;
  lamports: number;
  confirmedAt: number;
};

export type ServerPaymentReceiptFailedMessage = {
  type: "payment_receipt_failed";
  signature: string;
  message: string;
};

export type ServerEncounterUpdatedMessage = {
  type: "encounter_updated";
  encounter: NetworkEncounter;
};

export type ServerEncounterErrorMessage = {
  type: "encounter_error";
  message: string;
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
  | ServerWalletChallengeMessage
  | ServerWalletVerifiedMessage
  | ServerWalletVerificationFailedMessage
  | ServerPaymentReceivedMessage
  | ServerPaymentReceiptFailedMessage
  | ServerEncounterUpdatedMessage
  | ServerEncounterErrorMessage
  | ServerPlayerLeftMessage
  | ServerSnapshotMessage
  | ServerCorrectionMessage
  | ServerPongMessage
  | ServerErrorMessage;

export function isMovementState(value: unknown): value is PlayerMovementState {
  return value === "idle" || value === "walking" || value === "running";
}

export function isEncounterKind(value: unknown): value is EncounterKind {
  return value === "high_five" || value === "rps";
}

export function isRpsChoice(value: unknown): value is RpsChoice {
  return value === "rock" || value === "paper" || value === "scissors";
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
        (message.walletAddress !== undefined &&
          typeof message.walletAddress !== "string") ||
        (message.profile !== undefined && !profile)
      ) {
        return null;
      }

      return {
        type: "hello",
        protocolVersion: message.protocolVersion,
        ...(message.resumeToken ? { resumeToken: message.resumeToken } : {}),
        ...(profile ? { profile } : {}),
        ...(message.walletAddress ? { walletAddress: message.walletAddress } : {}),
      };
    }

    if (message.type === "profile") {
      const profile = parsePlayerProfile(message.profile);
      return profile ? { type: "profile", profile } : null;
    }

    if (
      message.type === "wallet_connected" &&
      typeof message.walletAddress === "string"
    ) {
      return { type: "wallet_connected", walletAddress: message.walletAddress };
    }

    if (
      message.type === "wallet_challenge" &&
      typeof message.walletAddress === "string"
    ) {
      return { type: "wallet_challenge", walletAddress: message.walletAddress };
    }

    if (
      message.type === "wallet_auth" &&
      typeof message.walletAddress === "string" &&
      typeof message.challenge === "string" &&
      typeof message.signature === "string"
    ) {
      return {
        type: "wallet_auth",
        walletAddress: message.walletAddress,
        challenge: message.challenge,
        signature: message.signature,
      };
    }

    if (
      message.type === "payment_receipt" &&
      typeof message.signature === "string" &&
      typeof message.recipientWallet === "string" &&
      Number.isSafeInteger(message.lamports) &&
      (message.lamports as number) > 0
    ) {
      return {
        type: "payment_receipt",
        signature: message.signature,
        recipientWallet: message.recipientWallet,
        lamports: message.lamports as number,
      };
    }

    if (
      message.type === "encounter_request" &&
      typeof message.targetPlayerId === "string" &&
      isEncounterKind(message.kind)
    ) {
      return {
        type: "encounter_request",
        targetPlayerId: message.targetPlayerId,
        kind: message.kind,
      };
    }

    if (
      message.type === "encounter_response" &&
      typeof message.encounterId === "string" &&
      typeof message.accepted === "boolean"
    ) {
      return {
        type: "encounter_response",
        encounterId: message.encounterId,
        accepted: message.accepted,
      };
    }

    if (
      message.type === "encounter_choice" &&
      typeof message.encounterId === "string" &&
      isRpsChoice(message.choice)
    ) {
      return {
        type: "encounter_choice",
        encounterId: message.encounterId,
        choice: message.choice,
      };
    }

    if (
      message.type === "encounter_settlement" &&
      typeof message.encounterId === "string" &&
      typeof message.signature === "string" &&
      message.signature.length >= 64 &&
      message.signature.length <= 100
    ) {
      return {
        type: "encounter_settlement",
        encounterId: message.encounterId,
        signature: message.signature,
      };
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
