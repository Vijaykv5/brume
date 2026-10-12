import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  MULTIPLAYER_PATH,
  MULTIPLAYER_PROTOCOL_VERSION,
  type ClientMessage,
  type ServerMessage,
  parseServerMessage,
} from "./protocol";
import { createMultiplayerServer } from "./server";

type MessagePredicate = (message: ServerMessage) => boolean;

class TestClient {
  readonly socket: WebSocket;
  readonly messages: ServerMessage[] = [];
  private waiters: Array<{
    predicate: MessagePredicate;
    resolve: (message: ServerMessage) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }> = [];

  constructor(url: string) {
    this.socket = new WebSocket(url);
    this.socket.addEventListener("message", (event) => {
      if (typeof event.data !== "string") return;
      const message = parseServerMessage(event.data);
      if (!message) return;
      this.messages.push(message);

      for (const waiter of [...this.waiters]) {
        if (!waiter.predicate(message)) continue;
        clearTimeout(waiter.timeout);
        this.waiters.splice(this.waiters.indexOf(waiter), 1);
        waiter.resolve(message);
      }
    });
  }

  waitFor(predicate: MessagePredicate, timeoutMs = 2_000) {
    const existingMessage = this.messages.find(predicate);
    if (existingMessage) return Promise.resolve(existingMessage);

    return new Promise<ServerMessage>((resolve, reject) => {
      const waiter = {
        predicate,
        resolve,
        reject,
        timeout: setTimeout(() => {
          this.waiters.splice(this.waiters.indexOf(waiter), 1);
          reject(new Error("Timed out waiting for WebSocket message."));
        }, timeoutMs),
      };
      this.waiters.push(waiter);
    });
  }

  send(message: ClientMessage) {
    this.socket.send(JSON.stringify(message));
  }

  close() {
    this.socket.close(1000, "Test complete");
  }
}

async function connectClient(url: string, resumeToken?: string) {
  const client = new TestClient(url);
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Timed out opening WebSocket.")),
      2_000,
    );
    client.socket.addEventListener("open", () => {
      clearTimeout(timeout);
      client.send({
        type: "hello",
        protocolVersion: MULTIPLAYER_PROTOCOL_VERSION,
        ...(resumeToken ? { resumeToken } : {}),
      });
      resolve();
    });
  });
  const welcome = await client.waitFor((message) => message.type === "welcome");
  if (welcome.type !== "welcome") throw new Error("Missing welcome message.");
  return { client, welcome };
}

describe("BRUME multiplayer server", () => {
  let multiplayerServer: ReturnType<typeof createMultiplayerServer>;
  let socketUrl: string;

  beforeAll(() => {
    multiplayerServer = createMultiplayerServer({
      port: 0,
      hostname: "127.0.0.1",
      logger: { info() {}, warn() {}, error() {} },
    });
    socketUrl = `ws://127.0.0.1:${multiplayerServer.port}${MULTIPLAYER_PATH}`;
  });

  afterAll(() => {
    multiplayerServer.stop();
  });

  test("joins, synchronizes, validates, leaves, and resumes a session", async () => {
    const first = await connectClient(socketUrl);
    expect(first.welcome.onlineCount).toBe(1);

    const joinedMessage = first.client.waitFor(
      (message) => message.type === "player_joined",
    );
    const second = await connectClient(socketUrl);
    expect(second.welcome.onlineCount).toBe(2);
    expect(second.welcome.players.some((player) => player.id === first.welcome.playerId)).toBe(true);
    await joinedMessage;

    first.client.send({
      type: "move",
      x: first.welcome.self.x + 0.2,
      z: first.welcome.self.z,
      heading: 0.3,
      movementState: "walking",
      sequence: 1,
    });
    const synchronizedMove = await second.client.waitFor(
      (message) =>
        message.type === "player_updated" &&
        message.player.id === first.welcome.playerId,
    );
    expect(synchronizedMove.type).toBe("player_updated");
    if (synchronizedMove.type === "player_updated") {
      expect(synchronizedMove.player.x).toBeCloseTo(first.welcome.self.x + 0.2);
      expect(synchronizedMove.player.heading).toBeCloseTo(0.3);
      expect(synchronizedMove.player.movementState).toBe("walking");
    }

    first.client.send({
      type: "move",
      x: first.welcome.self.x + 18,
      z: first.welcome.self.z,
      heading: 0.3,
      movementState: "running",
      sequence: 2,
    });
    const speedCorrection = await first.client.waitFor(
      (message) =>
        message.type === "correction" && message.reason === "speed_limit",
    );
    expect(speedCorrection.type).toBe("correction");

    first.client.send({
      type: "move",
      x: 100,
      z: 100,
      heading: 0,
      movementState: "running",
      sequence: 3,
    });
    const boundaryCorrection = await first.client.waitFor(
      (message) =>
        message.type === "correction" && message.reason === "out_of_bounds",
    );
    expect(boundaryCorrection.type).toBe("correction");

    const leftMessage = first.client.waitFor(
      (message) =>
        message.type === "player_left" &&
        message.playerId === second.welcome.playerId,
    );
    second.client.close();
    const playerLeft = await leftMessage;
    expect(playerLeft.type === "player_left" && playerLeft.onlineCount).toBe(1);

    const rejoinedMessage = first.client.waitFor(
      (message) =>
        message.type === "player_joined" &&
        message.player.id === second.welcome.playerId,
    );
    const resumed = await connectClient(socketUrl, second.welcome.resumeToken);
    expect(resumed.welcome.playerId).toBe(second.welcome.playerId);
    expect(resumed.welcome.onlineCount).toBe(2);
    await rejoinedMessage;

    resumed.client.close();
    first.client.close();
  });
});
