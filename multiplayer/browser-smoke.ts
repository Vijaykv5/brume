import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ClientMessage, ServerMessage } from "./protocol";

const CHROME_BIN =
  process.env.CHROME_BIN ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const TEST_URL =
  process.env.BRUME_TEST_URL ?? "http://127.0.0.1:3107/flash-arena";
const DEBUG_PORT = Number(process.env.BRUME_CHROME_DEBUG_PORT ?? 9338);
const DEVTOOLS_URL = `http://127.0.0.1:${DEBUG_PORT}`;

type CdpResponse = {
  id?: number;
  method?: string;
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: { message?: string };
};

class CdpClient {
  private socket: WebSocket;
  private nextId = 1;
  private pending = new Map<
    number,
    { resolve: (value: CdpResponse) => void; reject: (error: Error) => void }
  >();
  private listeners = new Map<
    string,
    Set<(params: Record<string, unknown>) => void>
  >();

  private constructor(socket: WebSocket) {
    this.socket = socket;
    socket.addEventListener("message", (event) => {
      if (typeof event.data !== "string") return;
      const message = JSON.parse(event.data) as CdpResponse;

      if (message.id) {
        const request = this.pending.get(message.id);
        if (!request) return;
        this.pending.delete(message.id);
        if (message.error) {
          request.reject(new Error(message.error.message ?? "CDP command failed."));
        } else {
          request.resolve(message);
        }
        return;
      }

      if (message.method && message.params) {
        for (const listener of this.listeners.get(message.method) ?? []) {
          listener(message.params);
        }
      }
    });
  }

  static async connect(webSocketDebuggerUrl: string) {
    const socket = new WebSocket(webSocketDebuggerUrl);
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Timed out connecting to Chrome DevTools.")),
        5_000,
      );
      socket.addEventListener("open", () => {
        clearTimeout(timeout);
        resolve();
      });
      socket.addEventListener("error", () => {
        clearTimeout(timeout);
        reject(new Error("Could not connect to Chrome DevTools."));
      });
    });
    return new CdpClient(socket);
  }

  send(method: string, params: Record<string, unknown> = {}) {
    const id = this.nextId;
    this.nextId += 1;

    return new Promise<CdpResponse>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method: string, listener: (params: Record<string, unknown>) => void) {
    const methodListeners = this.listeners.get(method) ?? new Set();
    methodListeners.add(listener);
    this.listeners.set(method, methodListeners);
  }

  close() {
    this.socket.close();
  }
}

type ChromeTarget = {
  id: string;
  webSocketDebuggerUrl: string;
};

async function waitForDevTools() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 10_000) {
    try {
      const response = await fetch(`${DEVTOOLS_URL}/json/version`);
      if (response.ok) return;
    } catch {
      // Chrome can take a moment to expose its debugging endpoint.
    }
    await Bun.sleep(100);
  }
  throw new Error("Chrome DevTools did not start.");
}

async function createTarget() {
  const response = await fetch(`${DEVTOOLS_URL}/json/new?about:blank`, {
    method: "PUT",
  });
  if (!response.ok) throw new Error("Could not create Chrome tab.");
  return (await response.json()) as ChromeTarget;
}

async function evaluate<T>(client: CdpClient, expression: string) {
  const response = await client.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
  });
  const result = response.result?.result as
    | { value?: T; description?: string }
    | undefined;
  return result?.value as T;
}

async function waitForValue<T>(
  client: CdpClient,
  expression: string,
  predicate: (value: T) => boolean,
  label: string,
  timeoutMs = 20_000,
) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const value = await evaluate<T>(client, expression);
    if (predicate(value)) return value;
    await Bun.sleep(150);
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

function collectSocketMessages(client: CdpClient) {
  const messages: ServerMessage[] = [];
  client.on("Network.webSocketFrameReceived", (params) => {
    const response = params.response as { payloadData?: string } | undefined;
    if (!response?.payloadData) return;
    try {
      messages.push(JSON.parse(response.payloadData) as ServerMessage);
    } catch {
      // Ignore non-JSON DevTools frames.
    }
  });
  return messages;
}

function collectSentSocketMessages(client: CdpClient) {
  const messages: ClientMessage[] = [];
  client.on("Network.webSocketFrameSent", (params) => {
    const response = params.response as { payloadData?: string } | undefined;
    if (!response?.payloadData) return;
    try {
      messages.push(JSON.parse(response.payloadData) as ClientMessage);
    } catch {
      // Ignore non-JSON DevTools frames.
    }
  });
  return messages;
}

function collectRuntimeExceptions(client: CdpClient) {
  const exceptions: string[] = [];
  client.on("Runtime.exceptionThrown", (params) => {
    const details = params.exceptionDetails as
      | { text?: string; exception?: { description?: string } }
      | undefined;
    exceptions.push(details?.exception?.description ?? details?.text ?? "Unknown exception");
  });
  return exceptions;
}

async function waitForSocketMessage<TMessage>(
  messages: TMessage[],
  predicate: (message: TMessage) => boolean,
  label: string,
  timeoutMs = 8_000,
) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const message = messages.find(predicate);
    if (message) return message;
    await Bun.sleep(100);
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

async function dispatchKey(client: CdpClient, type: "keyDown" | "keyUp", key: string) {
  const upperKey = key.toUpperCase();
  await client.send("Input.dispatchKeyEvent", {
    type,
    key,
    code: `Key${upperKey}`,
    windowsVirtualKeyCode: upperKey.charCodeAt(0),
    nativeVirtualKeyCode: upperKey.charCodeAt(0),
  });
}

async function main() {
  const profileDirectory = await mkdtemp(join(tmpdir(), "brume-chrome-"));
  const chrome = Bun.spawn(
    [
      CHROME_BIN,
      "--headless=new",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-background-networking",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--enable-webgl",
      "--ignore-gpu-blocklist",
      "--use-angle=swiftshader",
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${profileDirectory}`,
      "about:blank",
    ],
    { stdout: "ignore", stderr: "ignore" },
  );

  let firstClient: CdpClient | null = null;
  let secondClient: CdpClient | null = null;
  let firstTarget: ChromeTarget | null = null;
  let secondTarget: ChromeTarget | null = null;

  try {
    await waitForDevTools();
    firstTarget = await createTarget();
    secondTarget = await createTarget();
    firstClient = await CdpClient.connect(firstTarget.webSocketDebuggerUrl);
    secondClient = await CdpClient.connect(secondTarget.webSocketDebuggerUrl);

    for (const client of [firstClient, secondClient]) {
      await client.send("Page.enable");
      await client.send("Runtime.enable");
      await client.send("Network.enable");
    }

    const firstSocketMessages = collectSocketMessages(firstClient);
    const secondSocketMessages = collectSocketMessages(secondClient);
    const firstSentSocketMessages = collectSentSocketMessages(firstClient);
    const firstRuntimeExceptions = collectRuntimeExceptions(firstClient);
    const onlineTextExpression =
      "document.querySelector('.analytics-stats-online')?.textContent?.replace(/\\s+/g, ' ').trim() ?? ''";
    await firstClient.send("Page.navigate", { url: TEST_URL });
    const initialSurface = await waitForValue(
      firstClient,
      `({
        gate: document.querySelector('.arena-wallet-gate')?.textContent?.includes('Please connect your wallet to engage with the arena') ?? false,
        world: Boolean(document.querySelector('.scene-stage'))
      })`,
      (value: { gate: boolean; world: boolean }) => value.gate || value.world,
      "wallet gate or arena",
    );
    if (initialSurface.gate) {
      const gateCopy = await evaluate<string>(
        firstClient,
        "document.querySelector('.arena-wallet-gate')?.textContent?.replace(/\\s+/g, ' ').trim() ?? ''",
      );
      if (
        !gateCopy.includes("Please connect your wallet to engage with the arena") ||
        initialSurface.world
      ) {
        throw new Error("Disconnected visitors were not fully gated from the arena.");
      }
      // The gate HTML is server-rendered, so wait for React to attach the
      // Wallet Adapter click handler before opening its portal.
      await Bun.sleep(1_000);
      await evaluate(
        firstClient,
        "document.querySelector('.arena-wallet-gate .wallet-adapter-button')?.click()",
      );
      await waitForValue(
        firstClient,
        "Boolean(document.querySelector('.wallet-adapter-modal'))",
        Boolean,
        "standard wallet adapter modal",
      );
      const hydrationError = firstRuntimeExceptions.find((message) =>
        message.includes("Hydration failed"),
      );
      if (hydrationError) throw new Error(hydrationError);
      console.info("✓ disconnected visitors see the wallet gate and standard adapter modal");
      console.info("ℹ full two-wallet movement and payment checks require browser wallet extensions");
      return;
    }
    await waitForValue(
      firstClient,
      onlineTextExpression,
      (value: string) => value.startsWith("1") && value.includes("online now"),
      "first tab initial connection",
    );
    await secondClient.send("Page.navigate", { url: TEST_URL });
    try {
      await Promise.all([
        waitForValue(
          firstClient,
          onlineTextExpression,
          (value: string) => value.startsWith("2") && value.includes("online now"),
          "first tab online count",
        ),
        waitForValue(
          secondClient,
          onlineTextExpression,
          (value: string) => value.startsWith("2") && value.includes("online now"),
          "second tab online count",
        ),
      ]);
    } catch (error) {
      const diagnostics = await Promise.all(
        [firstClient, secondClient].map((client) =>
          evaluate<Record<string, string>>(
            client,
            `({
              url: location.href,
              title: document.title,
              online: ${onlineTextExpression},
              body: document.body?.innerText?.slice(0, 240) ?? ''
            })`,
          ),
        ),
      );
      throw new Error(
        `${error instanceof Error ? error.message : "Online count failed."} ` +
          `tabs=${JSON.stringify(diagnostics)} frames=${JSON.stringify([
            firstSocketMessages.slice(-3),
            secondSocketMessages.slice(-3),
          ])}`,
      );
    }
    console.info("✓ two browser tabs report 2 active connections");

    const firstWelcome = await waitForSocketMessage(
      firstSocketMessages,
      (message) => message.type === "welcome",
      "first tab welcome",
    );
    const secondWelcome = await waitForSocketMessage(
      secondSocketMessages,
      (message) => message.type === "welcome",
      "second tab welcome",
    );
    if (firstWelcome.type !== "welcome" || secondWelcome.type !== "welcome") {
      throw new Error("Invalid browser welcome frames.");
    }

    const promptExpression =
      "document.querySelector('.world-player-interaction-prompt')?.textContent?.replace(/\\s+/g, ' ').trim() ?? ''";
    try {
      await waitForValue(
        firstClient,
        promptExpression,
        (value: string) => value.includes("Press E to interact"),
        "nearby-player prompt",
      );
    } catch (error) {
      const sceneState = await evaluate<Record<string, string>>(
        firstClient,
        "Object.fromEntries(Array.from(document.querySelector('.scene-stage')?.attributes ?? []).filter((attribute) => attribute.name.startsWith('data-')).map((attribute) => [attribute.name, attribute.value]))",
      );
      const spawnDistance = Math.hypot(
        firstWelcome.self.x - secondWelcome.self.x,
        firstWelcome.self.z - secondWelcome.self.z,
      );
      const latestFirstSnapshot = [...firstSocketMessages]
        .reverse()
        .find((message) => message.type === "snapshot");
      throw new Error(
        `${error instanceof Error ? error.message : "Prompt failed."} ` +
          `spawnDistance=${spawnDistance.toFixed(2)} scene=${JSON.stringify(sceneState)} ` +
          `snapshot=${JSON.stringify(latestFirstSnapshot)}`,
      );
    }
    await dispatchKey(firstClient, "keyDown", "e");
    await dispatchKey(firstClient, "keyUp", "e");

    const panelExpression =
      "document.querySelector('.world-player-interaction-panel')?.textContent?.replace(/\\s+/g, ' ').trim() ?? ''";
    await waitForValue(
      firstClient,
      panelExpression,
      (value: string) =>
        value.includes("View Player") &&
        value.includes("Request Chat") &&
        value.includes("Send SOL") &&
        value.includes("Request Gas"),
      "player interaction menu",
    );
    await firstClient.send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "Escape",
      code: "Escape",
      windowsVirtualKeyCode: 27,
    });
    await waitForValue(
      firstClient,
      panelExpression,
      (value: string) => value.length === 0,
      "closed player interaction menu",
    );
    console.info("✓ proximity prompt and player interaction menu render");

    await evaluate(
      firstClient,
      "document.querySelector('.avatar-customize-button')?.click()",
    );
    await waitForValue(
      firstClient,
      "Boolean(document.querySelector('.avatar-customizer-panel'))",
      Boolean,
      "avatar customizer",
    );
    await evaluate(
      firstClient,
      `(() => {
        const input = document.querySelector('#avatar-name');
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        if (!(input instanceof HTMLInputElement) || !setter) return false;
        setter.call(input, 'Smoke Pilot');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        document.querySelector('[data-avatar-option="outfit-coral"]')?.click();
        document.querySelector('[data-avatar-option="hat-cap"]')?.click();
        return true;
      })()`,
    );
    await waitForValue(
      firstClient,
      `document.querySelector('[data-avatar-option="outfit-coral"]')?.getAttribute('aria-pressed') === 'true' && document.querySelector('[data-avatar-option="hat-cap"]')?.getAttribute('aria-pressed') === 'true'`,
      Boolean,
      "selected avatar style",
    );
    await evaluate(
      firstClient,
      "document.querySelector('#avatar-name')?.form?.requestSubmit()",
    );
    const profileUpdate = await waitForSocketMessage(
      secondSocketMessages,
      (message) =>
        message.type === "player_profile_updated" &&
        message.player.id === firstWelcome.playerId &&
        message.player.username === "Smoke Pilot",
      "remote avatar profile update",
    );
    if (
      profileUpdate.type !== "player_profile_updated" ||
      profileUpdate.player.avatar.outfitColor !== "coral" ||
      profileUpdate.player.avatar.hatStyle !== "cap"
    ) {
      throw new Error("Avatar customization did not synchronize correctly.");
    }
    await waitForValue(
      firstClient,
      "Boolean(document.querySelector('.avatar-customizer-panel'))",
      (value: boolean) => !value,
      "closed avatar customizer",
    );
    console.info("✓ character name, outfit, and hat changes synchronize live");

    await firstClient.send("Page.bringToFront");
    await firstClient.send("Emulation.setFocusEmulationEnabled", {
      enabled: true,
    });
    await waitForSocketMessage(
      firstSentSocketMessages,
      (message) => message.type === "move",
      "active player render loop",
      15_000,
    );
    await dispatchKey(firstClient, "keyDown", "w");
    await Bun.sleep(3_000);
    await dispatchKey(firstClient, "keyUp", "w");
    try {
      await waitForSocketMessage(
        secondSocketMessages,
        (message) =>
          message.type === "player_updated" &&
          message.player.id !== secondWelcome.playerId &&
          message.player.movementState !== "idle",
        "remote movement update",
      );
    } catch (error) {
      throw new Error(
        `${error instanceof Error ? error.message : "Movement failed."} ` +
          `sent=${JSON.stringify(firstSentSocketMessages.slice(-12))} ` +
          `firstReceived=${JSON.stringify(firstSocketMessages.slice(-12))} ` +
          `secondReceived=${JSON.stringify(secondSocketMessages.slice(-12))}`,
      );
    }
    console.info("✓ movement updates reach the other browser tab");

    const originalPlayerId = secondWelcome.playerId;
    secondSocketMessages.length = 0;
    await secondClient.send("Page.reload", { ignoreCache: true });
    const resumedWelcome = await waitForSocketMessage(
      secondSocketMessages,
      (message) => message.type === "welcome",
      "resumed browser session",
    );
    if (
      resumedWelcome.type !== "welcome" ||
      resumedWelcome.playerId !== originalPlayerId
    ) {
      throw new Error("Browser session did not resume with the same player ID.");
    }
    await waitForValue(
      firstClient,
      onlineTextExpression,
      (value: string) => value.startsWith("2") && value.includes("online now"),
      "reconnected online count",
    );
    console.info("✓ page reload resumes the same player session");

    await fetch(`${DEVTOOLS_URL}/json/close/${secondTarget.id}`);
    await waitForValue(
      firstClient,
      onlineTextExpression,
      (value: string) => value.startsWith("1") && value.includes("online now"),
      "disconnect online count",
    );
    await waitForSocketMessage(
      firstSocketMessages,
      (message) =>
        message.type === "player_left" && message.playerId === originalPlayerId,
      "player-left broadcast",
    );
    console.info("✓ leaving removes the player and decrements the counter");
  } finally {
    firstClient?.close();
    secondClient?.close();
    if (firstTarget) {
      await fetch(`${DEVTOOLS_URL}/json/close/${firstTarget.id}`).catch(() => null);
    }
    chrome.kill();
    await chrome.exited;
    await rm(profileDirectory, { recursive: true, force: true });
  }
}

await main();
