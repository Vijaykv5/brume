import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  MULTIPLAYER_PATH,
  MULTIPLAYER_PROTOCOL_VERSION,
  type ClientMessage,
  type ServerMessage,
  parseServerMessage,
} from "./protocol";
import { createMultiplayerServer } from "./server";
import {
  createDefaultPlayerProfile,
  resolveAvatarStyle,
  type PlayerProfile,
} from "./avatar-profile";

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

async function connectClient(
  url: string,
  resumeToken?: string,
  profile?: PlayerProfile,
  walletAddress?: string,
) {
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
        ...(profile ? { profile } : {}),
        ...(walletAddress ? { walletAddress } : {}),
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
  const storedProfiles = new Map<string, PlayerProfile>();

  beforeAll(() => {
    const testPort = 20_000 + Math.floor(Math.random() * 20_000);
    multiplayerServer = createMultiplayerServer({
      port: testPort,
      hostname: "127.0.0.1",
      logger: { info() {}, warn() {}, error() {} },
      verifyEncounterSettlement: async () => true,
      profileStore: {
        async get(walletAddress) {
          return storedProfiles.get(walletAddress) ?? null;
        },
        async set(walletAddress, profile) {
          storedProfiles.set(walletAddress, profile);
        },
      },
    });
    socketUrl = `ws://127.0.0.1:${multiplayerServer.port}${MULTIPLAYER_PATH}`;
  });

  afterAll(() => {
    multiplayerServer?.stop();
  });

  test("falls back safely for legacy players without avatar data", () => {
    expect(resolveAvatarStyle(undefined)).toEqual(
      createDefaultPlayerProfile().avatar,
    );
    expect(resolveAvatarStyle({ outfitColor: "coral" })).toMatchObject({
      skinTone: "warm",
      outfitColor: "coral",
      hatStyle: "none",
    });
  });

  test("runs a private-choice RPS encounter and shares its settlement", async () => {
    const first = await connectClient(socketUrl, undefined, createDefaultPlayerProfile("Nova"));
    const second = await connectClient(socketUrl, undefined, createDefaultPlayerProfile("Moss"));
    const firstWallet = "11111111111111111111111111111111";
    const secondWallet = "SysvarRent111111111111111111111111111111111";

    first.client.send({ type: "wallet_connected", walletAddress: firstWallet });
    second.client.send({ type: "wallet_connected", walletAddress: secondWallet });
    await first.client.waitFor((message) => message.type === "wallet_verified");
    await second.client.waitFor((message) => message.type === "wallet_verified");

    first.client.send({
      type: "encounter_request",
      targetPlayerId: second.welcome.playerId,
      kind: "rps",
    });
    const invite = await second.client.waitFor(
      (message) => message.type === "encounter_updated" && message.encounter.status === "invited",
    );
    expect(invite.type).toBe("encounter_updated");
    if (invite.type !== "encounter_updated") throw new Error("Missing encounter invite.");

    second.client.send({
      type: "encounter_response",
      encounterId: invite.encounter.id,
      accepted: true,
    });
    await first.client.waitFor(
      (message) => message.type === "encounter_updated" && message.encounter.status === "choosing",
    );

    first.client.send({ type: "encounter_choice", encounterId: invite.encounter.id, choice: "rock" });
    second.client.send({ type: "encounter_choice", encounterId: invite.encounter.id, choice: "scissors" });
    const result = await first.client.waitFor(
      (message) => message.type === "encounter_updated" && message.encounter.status === "resolved",
    );
    expect(result.type).toBe("encounter_updated");
    if (result.type === "encounter_updated") {
      expect(result.encounter.result).toBe("initiator_win");
      expect(result.encounter.initiatorChoice).toBe("rock");
      expect(result.encounter.recipientChoice).toBe("scissors");
      expect(result.encounter.winnerPlayerId).toBe(first.welcome.playerId);
    }

    const signature = "1".repeat(64);
    first.client.send({
      type: "encounter_settlement",
      encounterId: invite.encounter.id,
      signature,
    });
    const settled = await second.client.waitFor(
      (message) =>
        message.type === "encounter_updated" &&
        message.encounter.settlementSignature === signature,
    );
    expect(settled.type).toBe("encounter_updated");

    first.client.close();
    second.client.close();
  });

  test("joins, synchronizes, validates, leaves, and resumes a session", async () => {
    const first = await connectClient(socketUrl);
    expect(first.welcome.onlineCount).toBe(1);
    expect(first.welcome.self.avatar.outfitColor).toBe("teal");
    expect(first.welcome.self.avatar.hatStyle).toBe("none");

    const joinedMessage = first.client.waitFor(
      (message) => message.type === "player_joined",
    );
    const second = await connectClient(socketUrl);
    expect(second.welcome.onlineCount).toBe(2);
    expect(second.welcome.players.some((player) => player.id === first.welcome.playerId)).toBe(true);
    await joinedMessage;

    const walletAddress = "11111111111111111111111111111111";
    const persistedProfile = createDefaultPlayerProfile("Redis Explorer");
    persistedProfile.avatar = {
      ...persistedProfile.avatar,
      outfitColor: "violet",
      hatStyle: "beanie",
    };
    storedProfiles.set(walletAddress, persistedProfile);
    const walletProfileUpdate = second.client.waitFor(
      (message) =>
        message.type === "player_profile_updated" &&
        message.player.walletAddress === walletAddress &&
        message.player.username === "Redis Explorer",
    );
    first.client.send({
      type: "wallet_connected",
      walletAddress,
    });
    const walletVerified = await first.client.waitFor(
      (message) => message.type === "wallet_verified",
    );
    expect(walletVerified.type).toBe("wallet_verified");
    if (walletVerified.type === "wallet_verified") {
      expect(walletVerified.player.walletAddress).toBe(walletAddress);
      expect(walletVerified.player.username).toBe("Redis Explorer");
      expect(walletVerified.player.avatar.hatStyle).toBe("beanie");
    }
    await walletProfileUpdate;

    const customizedProfile = createDefaultPlayerProfile("Mint Voyager");
    customizedProfile.avatar = {
      ...customizedProfile.avatar,
      outfitColor: "coral",
      hatStyle: "cap",
      hatColor: "gold",
    };
    first.client.send({ type: "profile", profile: customizedProfile });
    const profileUpdate = await second.client.waitFor(
      (message) =>
        message.type === "player_profile_updated" &&
        message.player.id === first.welcome.playerId &&
        message.player.username === "Mint Voyager",
    );
    expect(profileUpdate.type).toBe("player_profile_updated");
    if (profileUpdate.type === "player_profile_updated") {
      expect(profileUpdate.player.username).toBe("Mint Voyager");
      expect(profileUpdate.player.avatar.outfitColor).toBe("coral");
      expect(profileUpdate.player.avatar.hatStyle).toBe("cap");
    }
    expect(storedProfiles.get(walletAddress)?.username).toBe("Mint Voyager");
    expect(storedProfiles.get(walletAddress)?.avatar.hatColor).toBe("gold");

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

  test("attaches a persisted wallet profile during the initial handshake", async () => {
    const walletAddress = "Vote111111111111111111111111111111111111111";
    const profile = createDefaultPlayerProfile("Onchain Neighbor");
    profile.avatar = { ...profile.avatar, outfitColor: "gold", hatStyle: "bucket" };
    storedProfiles.set(walletAddress, profile);

    const connected = await connectClient(socketUrl, undefined, undefined, walletAddress);
    expect(connected.welcome.self.walletAddress).toBe(walletAddress);
    expect(connected.welcome.self.username).toBe("Onchain Neighbor");
    expect(connected.welcome.self.avatar.hatStyle).toBe("bucket");
    connected.client.close();
  });
});
