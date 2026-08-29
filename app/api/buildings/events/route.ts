import {
  getBuildingsCacheVersion,
  isBuildingsCacheEnabled,
} from "@/lib/buildings-cache";

export const dynamic = "force-dynamic";

const BUILDINGS_EVENTS_CHECK_INTERVAL_MS = 2000;
const BUILDINGS_EVENTS_HEARTBEAT_INTERVAL_MS = 15000;

function encodeServerEvent(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(request: Request) {
  if (!isBuildingsCacheEnabled()) {
    return new Response("Buildings live updates are not configured.", {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  }

  const encoder = new TextEncoder();
  let closed = false;
  let lastVersion = (await getBuildingsCacheVersion()) ?? 0;
  let checkTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let heartbeatIntervalId: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (message: string) => {
        if (!closed) {
          controller.enqueue(encoder.encode(message));
        }
      };

      const close = () => {
        if (closed) return;
        closed = true;

        if (checkTimeoutId) clearTimeout(checkTimeoutId);
        if (heartbeatIntervalId) clearInterval(heartbeatIntervalId);

        try {
          controller.close();
        } catch {
          // The client may have already closed the connection.
        }
      };

      const scheduleCheck = () => {
        checkTimeoutId = setTimeout(() => {
          void checkForUpdates();
        }, BUILDINGS_EVENTS_CHECK_INTERVAL_MS);
      };

      const checkForUpdates = async () => {
        if (closed) return;

        const nextVersion = await getBuildingsCacheVersion();

        if (typeof nextVersion === "number" && nextVersion > lastVersion) {
          lastVersion = nextVersion;
          send(encodeServerEvent("buildings-changed", { version: nextVersion }));
        }

        scheduleCheck();
      };

      send(encodeServerEvent("connected", { version: lastVersion }));
      heartbeatIntervalId = setInterval(() => {
        send(`: heartbeat ${Date.now()}\n\n`);
      }, BUILDINGS_EVENTS_HEARTBEAT_INTERVAL_MS);

      scheduleCheck();
      request.signal.addEventListener("abort", close, { once: true });
    },
    cancel() {
      closed = true;

      if (checkTimeoutId) clearTimeout(checkTimeoutId);
      if (heartbeatIntervalId) clearInterval(heartbeatIntervalId);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
