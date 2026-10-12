import type { ServerWebSocket } from "bun";
import {
  MULTIPLAYER_PATH,
  MULTIPLAYER_PROTOCOL_VERSION,
  type NetworkPlayer,
  type ServerMessage,
  parseClientMessage,
} from "./protocol";
import { validateMovement } from "./validation";
import {
  BRUME_PLAYER_RADIUS,
  BRUME_PLAYER_SPAWN,
  BRUME_WORLD_GROUND_Y,
  BRUME_WORLD_RADIUS,
} from "./world-config";

const DEFAULT_PORT = 8788;
const RECONNECT_GRACE_MS = 30_000;
const HANDSHAKE_TIMEOUT_MS = 5_000;
const SNAPSHOT_INTERVAL_MS = 2_000;
const HEARTBEAT_INTERVAL_MS = 15_000;
const MAX_MESSAGES_PER_SECOND = 45;
const MAX_MESSAGE_BYTES = 2_048;

type SocketData = {
  connectionId: string;
  playerId: string | null;
  messagesInWindow: number;
  rateWindowStartedAt: number;
  alive: boolean;
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

function createPlayer(activeCount: number): NetworkPlayer {
  const id = crypto.randomUUID();
  const spawn = createSpawnPosition(activeCount);

  return {
    id,
    username: `Explorer ${id.slice(0, 4).toUpperCase()}`,
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
}: MultiplayerServerOptions = {}) {
  const activeSockets = new Map<string, ServerWebSocket<SocketData>>();
  const sessionsByToken = new Map<string, PlayerSession>();
  const sessionTokenByPlayerId = new Map<string, string>();
  const handshakeTimers = new Map<string, ReturnType<typeof setTimeout>>();

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

  const removeExpiredSession = (resumeToken: string) => {
    const session = sessionsByToken.get(resumeToken);
    if (!session || session.expiresAt > Date.now()) return;
    if (activeSockets.has(session.player.id)) return;

    sessionsByToken.delete(resumeToken);
    sessionTokenByPlayerId.delete(session.player.id);
  };

  const disconnectPlayer = (playerId: string) => {
    if (!activeSockets.delete(playerId)) return;

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
                player: createPlayer(activeSockets.size),
                expiresAt: Number.POSITIVE_INFINITY,
                cleanupTimer: null,
              };

          if (session.cleanupTimer) {
            clearTimeout(session.cleanupTimer);
            session.cleanupTimer = null;
          }
          session.expiresAt = Number.POSITIVE_INFINITY;
          session.player = {
            ...session.player,
            movementState: "idle",
            updatedAt: now,
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
            serverTime: now,
          });
          broadcast(
            {
              type: "player_joined",
              player: session.player,
              onlineCount: activeSockets.size,
            },
            session.player.id,
          );
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

  logger.info(
    `BRUME multiplayer listening on ws://${hostname}:${server.port}${MULTIPLAYER_PATH}`,
  );

  return {
    server,
    port: server.port,
    stop() {
      clearInterval(snapshotInterval);
      clearInterval(heartbeatInterval);
      for (const timer of handshakeTimers.values()) clearTimeout(timer);
      for (const session of sessionsByToken.values()) {
        if (session.cleanupTimer) clearTimeout(session.cleanupTimer);
      }
      server.stop(true);
    },
  };
}

if (import.meta.main) {
  const configuredPort = Number(process.env.MULTIPLAYER_PORT ?? DEFAULT_PORT);
  const allowedOrigins = (process.env.MULTIPLAYER_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  createMultiplayerServer({
    port: Number.isInteger(configuredPort) ? configuredPort : DEFAULT_PORT,
    allowedOrigins,
  });
}
