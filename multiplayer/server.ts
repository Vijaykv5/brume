import type { ServerWebSocket } from "bun";
import { clusterApiUrl, Connection, PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import {
  MULTIPLAYER_PATH,
  MULTIPLAYER_PROTOCOL_VERSION,
  type NetworkEncounter,
  type NetworkPlayer,
  type RpsChoice,
  type ServerMessage,
  parseClientMessage,
} from "./protocol";
import {
  createDefaultPlayerProfile,
  type PlayerProfile,
} from "./avatar-profile";
import { validateMovement } from "./validation";
import {
  BRUME_PLAYER_RADIUS,
  BRUME_PLAYER_SPAWN,
  BRUME_WORLD_GROUND_Y,
  BRUME_WORLD_RADIUS,
} from "./world-config";
import {
  createPlayerProfileStore,
  type PlayerProfileStore,
} from "../lib/player-profiles";

const DEFAULT_PORT = 8788;
const RECONNECT_GRACE_MS = 30_000;
const HANDSHAKE_TIMEOUT_MS = 5_000;
const SNAPSHOT_INTERVAL_MS = 2_000;
const HEARTBEAT_INTERVAL_MS = 15_000;
const MAX_MESSAGES_PER_SECOND = 45;
const MAX_MESSAGE_BYTES = 2_048;
const WALLET_CHALLENGE_TTL_MS = 2 * 60_000;
const ENCOUNTER_DISTANCE = 6;
const ENCOUNTER_TTL_MS = 60_000;
const BRUME_PROGRAM_ID = new PublicKey("5dhS3bs4CfLaNq6sEvwnDcqkTjkYPKYeettb2BE47C7p");
const BRUME_WORLD_SESSION = new PublicKey("3UrnvFqSpYMdCWY1psEiyii2EKANpxnv4q7uWu3xCmv7");

type ActiveEncounter = NetworkEncounter & {
  privateInitiatorChoice?: RpsChoice;
  privateRecipientChoice?: RpsChoice;
  expiresAt: number;
};

type SocketData = {
  connectionId: string;
  playerId: string | null;
  messagesInWindow: number;
  rateWindowStartedAt: number;
  alive: boolean;
  walletChallenge: {
    walletAddress: string;
    message: string;
    expiresAt: number;
  } | null;
};

type PlayerSession = {
  resumeToken: string;
  player: NetworkPlayer;
  expiresAt: number;
  cleanupTimer: ReturnType<typeof setTimeout> | null;
};

type Logger = Pick<Console, "info" | "warn" | "error">;

export type MultiplayerServerOptions = {
  port?: number;
  hostname?: string;
  allowedOrigins?: string[];
  logger?: Logger;
  verifyEncounterSettlement?: (
    signature: string,
    encounter: NetworkEncounter,
  ) => Promise<boolean>;
  profileStore?: PlayerProfileStore | null;
};

function createSpawnPosition(activeCount: number) {
  if (activeCount === 0) {
    return { x: BRUME_PLAYER_SPAWN[0], z: BRUME_PLAYER_SPAWN[2] };
  }

  const surroundingIndex = activeCount - 1;
  const ring = Math.floor(surroundingIndex / 8) + 1;
  const slot = surroundingIndex % 8;
  const angle = (slot / 8) * Math.PI * 2;
  return {
    x: BRUME_PLAYER_SPAWN[0] + Math.cos(angle) * 2.2 * ring,
    z: BRUME_PLAYER_SPAWN[2] + Math.sin(angle) * 2.2 * ring,
  };
}

function createPlayer(activeCount: number, profile?: PlayerProfile): NetworkPlayer {
  const id = crypto.randomUUID();
  const spawn = createSpawnPosition(activeCount);
  const resolvedProfile = profile ?? createDefaultPlayerProfile(
    `Explorer ${id.slice(0, 4).toUpperCase()}`,
  );

  return {
    id,
    username: resolvedProfile.username,
    avatar: resolvedProfile.avatar,
    x: spawn.x,
    y: BRUME_WORLD_GROUND_Y,
    z: spawn.z,
    heading: Math.PI,
    movementState: "idle",
    sequence: 0,
    updatedAt: Date.now(),
  };
}

function serialize(message: ServerMessage) {
  return JSON.stringify(message);
}

export function createMultiplayerServer({
  port = DEFAULT_PORT,
  hostname = "0.0.0.0",
  allowedOrigins = [],
  logger = console,
  verifyEncounterSettlement,
  profileStore,
}: MultiplayerServerOptions = {}) {
  const activeSockets = new Map<string, ServerWebSocket<SocketData>>();
  const sessionsByToken = new Map<string, PlayerSession>();
  const sessionTokenByPlayerId = new Map<string, string>();
  const handshakeTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const processedPaymentSignatures = new Set<string>();
  const encounters = new Map<string, ActiveEncounter>();
  const resolvedProfileStore =
    profileStore === undefined ? createPlayerProfileStore() : profileStore;
  const solanaConnection = new Connection(
    process.env.SOLANA_RPC_URL?.trim() || clusterApiUrl("devnet"),
    "confirmed",
  );
  const magicBlockConnection = new Connection(
    process.env.MAGICBLOCK_RPC_URL?.trim() || "https://devnet-as.magicblock.app",
    "confirmed",
  );
  const verifySettlement = verifyEncounterSettlement ?? (async (
    signature: string,
    encounter: NetworkEncounter,
  ) => {
    const transaction = await magicBlockConnection.getParsedTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    if (!transaction || transaction.meta?.err) return false;
    return transaction.transaction.message.instructions.some((instruction) => {
      if ("parsed" in instruction || !instruction.programId.equals(BRUME_PROGRAM_ID)) {
        return false;
      }
      const accounts = instruction.accounts.map((account) => account.toBase58());
      return (
        accounts.includes(BRUME_WORLD_SESSION.toBase58()) &&
        accounts.includes(encounter.initiator.walletAddress) &&
        accounts.includes(encounter.recipient.walletAddress)
      );
    });
  });

  const send = (socket: ServerWebSocket<SocketData>, message: ServerMessage) => {
    socket.send(serialize(message));
  };

  const activePlayers = () =>
    Array.from(activeSockets.keys())
      .map((playerId) => {
        const token = sessionTokenByPlayerId.get(playerId);
        return token ? sessionsByToken.get(token)?.player : null;
      })
      .filter((player): player is NetworkPlayer => player !== null && player !== undefined);

  const broadcast = (message: ServerMessage, exceptPlayerId?: string) => {
    const payload = serialize(message);
    for (const [playerId, socket] of activeSockets) {
      if (playerId !== exceptPlayerId) socket.send(payload);
    }
  };

  const persistProfile = (player: NetworkPlayer) => {
    if (!resolvedProfileStore || !player.walletAddress) return;
    void resolvedProfileStore
      .set(player.walletAddress, {
        username: player.username,
        avatar: player.avatar,
      })
      .catch((error) => logger.warn("Failed to persist player profile", error));
  };

  const readPersistedProfile = async (walletAddress: string) => {
    if (!resolvedProfileStore) return null;
    try {
      return await resolvedProfileStore.get(walletAddress);
    } catch (error) {
      logger.warn("Failed to load player profile", error);
      return null;
    }
  };

  const publicEncounter = (encounter: ActiveEncounter): NetworkEncounter => {
    const { privateInitiatorChoice, privateRecipientChoice, expiresAt, ...visible } = encounter;
    void expiresAt;
    if (encounter.status !== "resolved") return visible;
    return {
      ...visible,
      ...(privateInitiatorChoice ? { initiatorChoice: privateInitiatorChoice } : {}),
      ...(privateRecipientChoice ? { recipientChoice: privateRecipientChoice } : {}),
    };
  };

  const sendEncounter = (encounter: ActiveEncounter) => {
    const message: ServerMessage = {
      type: "encounter_updated",
      encounter: publicEncounter(encounter),
    };
    const initiatorSocket = activeSockets.get(encounter.initiator.playerId);
    const recipientSocket = activeSockets.get(encounter.recipient.playerId);
    if (initiatorSocket) send(initiatorSocket, message);
    if (recipientSocket) send(recipientSocket, message);
  };

  const playerHasActiveEncounter = (playerId: string) =>
    Array.from(encounters.values()).some(
      (encounter) =>
        (encounter.initiator.playerId === playerId ||
          encounter.recipient.playerId === playerId) &&
        (encounter.status === "invited" || encounter.status === "choosing"),
    );

  const removeExpiredSession = (resumeToken: string) => {
    const session = sessionsByToken.get(resumeToken);
    if (!session || session.expiresAt > Date.now()) return;
    if (activeSockets.has(session.player.id)) return;

    sessionsByToken.delete(resumeToken);
    sessionTokenByPlayerId.delete(session.player.id);
  };

  const disconnectPlayer = (playerId: string) => {
    if (!activeSockets.delete(playerId)) return;

    for (const encounter of encounters.values()) {
      if (
        encounter.status !== "resolved" &&
        encounter.status !== "declined" &&
        (encounter.initiator.playerId === playerId ||
          encounter.recipient.playerId === playerId)
      ) {
        encounter.status = "cancelled";
        encounter.resolvedAt = Date.now();
        sendEncounter(encounter);
      }
    }

    const resumeToken = sessionTokenByPlayerId.get(playerId);
    const session = resumeToken ? sessionsByToken.get(resumeToken) : null;
    if (session) {
      session.player = {
        ...session.player,
        movementState: "idle",
        updatedAt: Date.now(),
      };
      session.expiresAt = Date.now() + RECONNECT_GRACE_MS;
      if (session.cleanupTimer) clearTimeout(session.cleanupTimer);
      session.cleanupTimer = setTimeout(
        () => removeExpiredSession(session.resumeToken),
        RECONNECT_GRACE_MS + 50,
      );
    }

    broadcast({
      type: "player_left",
      playerId,
      onlineCount: activeSockets.size,
    });
  };

  const server = Bun.serve<SocketData>({
    port,
    hostname,
    fetch(request, bunServer) {
      const url = new URL(request.url);

      if (url.pathname === "/health") {
        return Response.json({
          ok: true,
          connections: activeSockets.size,
          protocolVersion: MULTIPLAYER_PROTOCOL_VERSION,
        });
      }

      if (url.pathname !== MULTIPLAYER_PATH) {
        return new Response("Not found", { status: 404 });
      }

      const origin = request.headers.get("origin");
      if (
        allowedOrigins.length > 0 &&
        origin &&
        !allowedOrigins.includes(origin)
      ) {
        return new Response("Origin not allowed", { status: 403 });
      }

      const connectionId = crypto.randomUUID();
      const upgraded = bunServer.upgrade(request, {
        data: {
          connectionId,
          playerId: null,
          messagesInWindow: 0,
          rateWindowStartedAt: Date.now(),
          alive: true,
          walletChallenge: null,
        },
      });

      return upgraded
        ? undefined
        : new Response("WebSocket upgrade required", { status: 426 });
    },
    websocket: {
      open(socket) {
        const timer = setTimeout(() => {
          if (!socket.data.playerId) socket.close(1008, "Handshake required");
        }, HANDSHAKE_TIMEOUT_MS);
        handshakeTimers.set(socket.data.connectionId, timer);
      },
      message(socket, rawMessage) {
        const now = Date.now();
        if (now - socket.data.rateWindowStartedAt >= 1_000) {
          socket.data.rateWindowStartedAt = now;
          socket.data.messagesInWindow = 0;
        }
        socket.data.messagesInWindow += 1;

        if (socket.data.messagesInWindow > MAX_MESSAGES_PER_SECOND) {
          send(socket, {
            type: "error",
            code: "rate_limited",
            message: "Too many movement updates.",
          });
          socket.close(1008, "Rate limited");
          return;
        }

        const messageText =
          typeof rawMessage === "string"
            ? rawMessage
            : new TextDecoder().decode(rawMessage);
        if (messageText.length > MAX_MESSAGE_BYTES) {
          socket.close(1009, "Message too large");
          return;
        }

        const message = parseClientMessage(messageText);
        if (!message) {
          if (socket.data.playerId) {
            const token = sessionTokenByPlayerId.get(socket.data.playerId);
            const player = token ? sessionsByToken.get(token)?.player : null;
            if (player) {
              send(socket, { type: "correction", player, reason: "invalid_payload" });
            }
          }
          return;
        }

        if (message.type === "hello") {
          if (socket.data.playerId) return;

          if (message.protocolVersion !== MULTIPLAYER_PROTOCOL_VERSION) {
            send(socket, {
              type: "error",
              code: "protocol_mismatch",
              message: "Client and server protocol versions do not match.",
            });
            socket.close(1002, "Protocol mismatch");
            return;
          }

          void (async () => {
            try {
              const resumedSession = message.resumeToken
                ? sessionsByToken.get(message.resumeToken)
                : null;
              const canResume =
                resumedSession &&
                resumedSession.expiresAt > now &&
                !activeSockets.has(resumedSession.player.id);
              const session = canResume
                ? resumedSession
                : {
                    resumeToken: crypto.randomUUID(),
                    player: createPlayer(activeSockets.size, message.profile),
                    expiresAt: Number.POSITIVE_INFINITY,
                    cleanupTimer: null,
                  };

              let walletAddress: string | undefined;
              let persistedProfile: PlayerProfile | null = null;
              if (message.walletAddress) {
                walletAddress = new PublicKey(message.walletAddress).toBase58();
                const alreadyConnected = activePlayers().some(
                  (player) =>
                    player.id !== session.player.id &&
                    player.walletAddress === walletAddress,
                );
                if (alreadyConnected) {
                  throw new Error("This wallet is already active in another arena session.");
                }
                persistedProfile = await readPersistedProfile(walletAddress);
              }

              if (session.cleanupTimer) {
                clearTimeout(session.cleanupTimer);
                session.cleanupTimer = null;
              }
              session.expiresAt = Number.POSITIVE_INFINITY;
              session.player = {
                ...session.player,
                ...(message.profile ?? {}),
                ...(persistedProfile ?? {}),
                ...(walletAddress ? { walletAddress } : {}),
                movementState: "idle",
                updatedAt: Date.now(),
              };

              sessionsByToken.set(session.resumeToken, session);
              sessionTokenByPlayerId.set(session.player.id, session.resumeToken);
              socket.data.playerId = session.player.id;
              activeSockets.set(session.player.id, socket);

              const handshakeTimer = handshakeTimers.get(socket.data.connectionId);
              if (handshakeTimer) clearTimeout(handshakeTimer);
              handshakeTimers.delete(socket.data.connectionId);

              send(socket, {
                type: "welcome",
                protocolVersion: MULTIPLAYER_PROTOCOL_VERSION,
                playerId: session.player.id,
                resumeToken: session.resumeToken,
                self: session.player,
                players: activePlayers().filter(
                  (player) => player.id !== session.player.id,
                ),
                onlineCount: activeSockets.size,
                serverTime: Date.now(),
              });
              broadcast(
                {
                  type: "player_joined",
                  player: session.player,
                  onlineCount: activeSockets.size,
                },
                session.player.id,
              );
            } catch (error) {
              send(socket, {
                type: "wallet_verification_failed",
                message:
                  error instanceof Error
                    ? error.message
                    : "The connected wallet could not join this arena session.",
              });
              socket.close(1008, "Wallet connection failed");
            }
          })();
          return;
        }

        if (!socket.data.playerId) {
          send(socket, {
            type: "error",
            code: "handshake_required",
            message: "Send hello before movement updates.",
          });
          return;
        }

        if (message.type === "ping") {
          send(socket, { type: "pong", sentAt: message.sentAt, serverTime: now });
          return;
        }

        const resumeToken = sessionTokenByPlayerId.get(socket.data.playerId);
        const session = resumeToken ? sessionsByToken.get(resumeToken) : null;
        if (!session) return;

        if (message.type === "wallet_connected") {
          void (async () => {
            try {
              const walletAddress = new PublicKey(message.walletAddress).toBase58();
              const alreadyConnected = activePlayers().some(
                (player) =>
                  player.id !== session.player.id &&
                  player.walletAddress === walletAddress,
              );
              if (alreadyConnected) {
                throw new Error("This wallet is already active in another arena session.");
              }

              const persistedProfile = await readPersistedProfile(walletAddress);
              session.player = {
                ...session.player,
                ...(persistedProfile ?? {}),
                walletAddress,
                updatedAt: Date.now(),
              };
              persistProfile(session.player);
              send(socket, { type: "wallet_verified", player: session.player });
              broadcast(
                { type: "player_profile_updated", player: session.player },
                session.player.id,
              );
            } catch (error) {
              send(socket, {
                type: "wallet_verification_failed",
                message:
                  error instanceof Error
                    ? error.message
                    : "The connected wallet could not be attached to this session.",
              });
            }
          })();
          return;
        }

        if (message.type === "wallet_challenge") {
          try {
            const walletAddress = new PublicKey(message.walletAddress).toBase58();
            const expiresAt = now + WALLET_CHALLENGE_TTL_MS;
            const challenge = [
              "BRUME World wallet verification",
              "",
              `Wallet: ${walletAddress}`,
              `Player: ${session.player.id}`,
              `Nonce: ${crypto.randomUUID()}`,
              `Issued at: ${new Date(now).toISOString()}`,
              "",
              "Signing is free and does not submit a transaction.",
            ].join("\n");
            socket.data.walletChallenge = {
              walletAddress,
              message: challenge,
              expiresAt,
            };
            send(socket, {
              type: "wallet_challenge",
              walletAddress,
              challenge,
              expiresAt,
            });
          } catch {
            send(socket, {
              type: "wallet_verification_failed",
              message: "That Solana wallet address is not valid.",
            });
          }
          return;
        }

        if (message.type === "wallet_auth") {
          const pendingChallenge = socket.data.walletChallenge;
          socket.data.walletChallenge = null;
          try {
            if (
              !pendingChallenge ||
              pendingChallenge.expiresAt < now ||
              pendingChallenge.walletAddress !== message.walletAddress ||
              pendingChallenge.message !== message.challenge
            ) {
              throw new Error("The verification request expired. Please try again.");
            }

            const signature = Uint8Array.from(
              Buffer.from(message.signature, "base64"),
            );
            const publicKey = new PublicKey(message.walletAddress);
            const verified = nacl.sign.detached.verify(
              new TextEncoder().encode(message.challenge),
              signature,
              publicKey.toBytes(),
            );
            if (!verified) throw new Error("The wallet signature could not be verified.");
            const alreadyConnected = activePlayers().some(
              (player) =>
                player.id !== session.player.id &&
                player.walletAddress === publicKey.toBase58(),
            );
            if (alreadyConnected) {
              throw new Error("This wallet is already active in another arena session.");
            }

            session.player = {
              ...session.player,
              walletAddress: publicKey.toBase58(),
              updatedAt: now,
            };
            persistProfile(session.player);
            send(socket, { type: "wallet_verified", player: session.player });
            broadcast(
              { type: "player_profile_updated", player: session.player },
              session.player.id,
            );
          } catch (error) {
            send(socket, {
              type: "wallet_verification_failed",
              message:
                error instanceof Error
                  ? error.message
                  : "Wallet verification failed.",
            });
          }
          return;
        }

        if (message.type === "payment_receipt") {
          const senderWalletAddress = session.player.walletAddress;
          if (!senderWalletAddress || processedPaymentSignatures.has(message.signature)) {
            return;
          }

          void (async () => {
            try {
              const transaction = await solanaConnection.getParsedTransaction(
                message.signature,
                { commitment: "confirmed", maxSupportedTransactionVersion: 0 },
              );
              const matchingTransfer = transaction?.transaction.message.instructions.some(
                (instruction) => {
                  if (!("parsed" in instruction) || instruction.program !== "system") {
                    return false;
                  }
                  const parsed = instruction.parsed as {
                    type?: string;
                    info?: { source?: string; destination?: string; lamports?: number };
                  };
                  return (
                    parsed.type === "transfer" &&
                    parsed.info?.source === senderWalletAddress &&
                    parsed.info?.destination === message.recipientWallet &&
                    parsed.info?.lamports === message.lamports
                  );
                },
              );
              if (!transaction || transaction.meta?.err || !matchingTransfer) {
                throw new Error("The confirmed transfer did not match this receipt.");
              }

              processedPaymentSignatures.add(message.signature);
              const recipientEntry = activePlayers().find(
                (player) => player.walletAddress === message.recipientWallet,
              );
              const recipientSocket = recipientEntry
                ? activeSockets.get(recipientEntry.id)
                : null;
              if (recipientSocket) {
                send(recipientSocket, {
                  type: "payment_received",
                  signature: message.signature,
                  senderPlayerId: session.player.id,
                  senderUsername: session.player.username,
                  senderWalletAddress,
                  lamports: message.lamports,
                  confirmedAt: Date.now(),
                });
              }
            } catch (error) {
              send(socket, {
                type: "payment_receipt_failed",
                signature: message.signature,
                message:
                  error instanceof Error
                    ? error.message
                    : "The payment receipt could not be verified.",
              });
            }
          })();
          return;
        }

        if (message.type === "encounter_request") {
          const targetToken = sessionTokenByPlayerId.get(message.targetPlayerId);
          const targetSession = targetToken ? sessionsByToken.get(targetToken) : null;
          const targetSocket = activeSockets.get(message.targetPlayerId);
          const senderWallet = session.player.walletAddress;
          const targetWallet = targetSession?.player.walletAddress;
          const distance = targetSession
            ? Math.hypot(
                session.player.x - targetSession.player.x,
                session.player.z - targetSession.player.z,
              )
            : Number.POSITIVE_INFINITY;

          if (!targetSession || !targetSocket) {
            send(socket, { type: "encounter_error", message: "That explorer is no longer online." });
            return;
          }
          if (!senderWallet || !targetWallet) {
            send(socket, { type: "encounter_error", message: "Both explorers must connect a wallet first." });
            return;
          }
          if (distance > ENCOUNTER_DISTANCE) {
            send(socket, { type: "encounter_error", message: "Move closer to start an encounter." });
            return;
          }
          if (
            playerHasActiveEncounter(session.player.id) ||
            playerHasActiveEncounter(targetSession.player.id)
          ) {
            send(socket, { type: "encounter_error", message: "One of you is already in an encounter." });
            return;
          }

          const encounter: ActiveEncounter = {
            id: crypto.randomUUID(),
            kind: message.kind,
            initiator: {
              playerId: session.player.id,
              username: session.player.username,
              walletAddress: senderWallet,
            },
            recipient: {
              playerId: targetSession.player.id,
              username: targetSession.player.username,
              walletAddress: targetWallet,
            },
            status: "invited",
            createdAt: now,
            expiresAt: now + ENCOUNTER_TTL_MS,
          };
          encounters.set(encounter.id, encounter);
          sendEncounter(encounter);
          return;
        }

        if (message.type === "encounter_response") {
          const encounter = encounters.get(message.encounterId);
          if (!encounter || encounter.recipient.playerId !== session.player.id) {
            send(socket, { type: "encounter_error", message: "That encounter invite is no longer available." });
            return;
          }
          if (encounter.status !== "invited" || encounter.expiresAt < now) {
            encounter.status = "cancelled";
            encounter.resolvedAt = now;
            sendEncounter(encounter);
            return;
          }
          if (!message.accepted) {
            encounter.status = "declined";
            encounter.resolvedAt = now;
            sendEncounter(encounter);
            return;
          }
          if (encounter.kind === "high_five") {
            encounter.status = "resolved";
            encounter.result = "completed";
            encounter.resolvedAt = now;
          } else {
            encounter.status = "choosing";
            encounter.expiresAt = now + ENCOUNTER_TTL_MS;
          }
          sendEncounter(encounter);
          return;
        }

        if (message.type === "encounter_choice") {
          const encounter = encounters.get(message.encounterId);
          if (!encounter || encounter.kind !== "rps" || encounter.status !== "choosing") {
            send(socket, { type: "encounter_error", message: "That match is not accepting a move." });
            return;
          }
          if (encounter.expiresAt < now) {
            encounter.status = "cancelled";
            encounter.resolvedAt = now;
            sendEncounter(encounter);
            return;
          }
          if (encounter.initiator.playerId === session.player.id) {
            encounter.privateInitiatorChoice = message.choice;
          } else if (encounter.recipient.playerId === session.player.id) {
            encounter.privateRecipientChoice = message.choice;
          } else {
            send(socket, { type: "encounter_error", message: "You are not part of that encounter." });
            return;
          }

          const first = encounter.privateInitiatorChoice;
          const second = encounter.privateRecipientChoice;
          if (first && second) {
            encounter.status = "resolved";
            encounter.resolvedAt = now;
            if (first === second) {
              encounter.result = "draw";
            } else if (
              (first === "rock" && second === "scissors") ||
              (first === "paper" && second === "rock") ||
              (first === "scissors" && second === "paper")
            ) {
              encounter.result = "initiator_win";
              encounter.winnerPlayerId = encounter.initiator.playerId;
            } else {
              encounter.result = "recipient_win";
              encounter.winnerPlayerId = encounter.recipient.playerId;
            }
          }
          sendEncounter(encounter);
          return;
        }

        if (message.type === "encounter_settlement") {
          const encounter = encounters.get(message.encounterId);
          if (
            !encounter ||
            encounter.initiator.playerId !== session.player.id ||
            encounter.status !== "resolved"
          ) {
            send(socket, { type: "encounter_error", message: "This encounter cannot be settled." });
            return;
          }
          void (async () => {
            try {
              const verified = await verifySettlement(
                message.signature,
                publicEncounter(encounter),
              );
              if (!verified) throw new Error("The ER transaction did not match this encounter.");
              encounter.settlementSignature = message.signature;
              sendEncounter(encounter);
            } catch (error) {
              send(socket, {
                type: "encounter_error",
                message: error instanceof Error
                  ? error.message
                  : "The MagicBlock encounter receipt could not be verified.",
              });
            }
          })();
          return;
        }

        if (message.type === "profile") {
          session.player = {
            ...session.player,
            username: message.profile.username,
            avatar: message.profile.avatar,
            updatedAt: now,
          };
          persistProfile(session.player);
          broadcast(
            { type: "player_profile_updated", player: session.player },
            session.player.id,
          );
          return;
        }

        const result = validateMovement(session.player, message, {
          now,
          groundY: BRUME_WORLD_GROUND_Y,
          worldRadius: BRUME_WORLD_RADIUS,
          playerRadius: BRUME_PLAYER_RADIUS,
        });

        if (!result.ok) {
          send(socket, {
            type: "correction",
            player: session.player,
            reason: result.reason,
          });
          return;
        }

        session.player = result.player;
        broadcast(
          { type: "player_updated", player: result.player },
          result.player.id,
        );
      },
      close(socket) {
        const handshakeTimer = handshakeTimers.get(socket.data.connectionId);
        if (handshakeTimer) clearTimeout(handshakeTimer);
        handshakeTimers.delete(socket.data.connectionId);

        if (socket.data.playerId) disconnectPlayer(socket.data.playerId);
      },
      ping(socket) {
        socket.data.alive = true;
      },
      pong(socket) {
        socket.data.alive = true;
      },
      maxPayloadLength: MAX_MESSAGE_BYTES,
      idleTimeout: 40,
    },
  });

  const snapshotInterval = setInterval(() => {
    broadcast({
      type: "snapshot",
      players: activePlayers(),
      onlineCount: activeSockets.size,
      serverTime: Date.now(),
    });
  }, SNAPSHOT_INTERVAL_MS);

  const heartbeatInterval = setInterval(() => {
    for (const socket of activeSockets.values()) {
      if (!socket.data.alive) {
        socket.close(1001, "Heartbeat timeout");
        continue;
      }
      socket.data.alive = false;
      socket.ping();
    }
  }, HEARTBEAT_INTERVAL_MS);

  const encounterCleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [encounterId, encounter] of encounters) {
      if (
        (encounter.status === "invited" || encounter.status === "choosing") &&
        encounter.expiresAt < now
      ) {
        encounter.status = "cancelled";
        encounter.resolvedAt = now;
        sendEncounter(encounter);
      }
      if (encounter.resolvedAt && now - encounter.resolvedAt > 2 * 60_000) {
        encounters.delete(encounterId);
      }
    }
  }, 5_000);

  logger.info(
    `BRUME multiplayer listening on ws://${hostname}:${server.port}${MULTIPLAYER_PATH}`,
  );

  return {
    server,
    port: server.port,
    stop() {
      clearInterval(snapshotInterval);
      clearInterval(heartbeatInterval);
      clearInterval(encounterCleanupInterval);
      for (const timer of handshakeTimers.values()) clearTimeout(timer);
      for (const session of sessionsByToken.values()) {
        if (session.cleanupTimer) clearTimeout(session.cleanupTimer);
      }
      server.stop(true);
    },
  };
}

if (import.meta.main) {
  const configuredPort = Number(
    process.env.MULTIPLAYER_PORT ?? process.env.PORT ?? DEFAULT_PORT,
  );
  const allowedOrigins = (process.env.MULTIPLAYER_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  createMultiplayerServer({
    port: Number.isInteger(configuredPort) ? configuredPort : DEFAULT_PORT,
    allowedOrigins,
  });
}
