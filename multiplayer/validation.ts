import type {
  ClientMovementMessage,
  NetworkPlayer,
  PlayerMovementState,
  ServerCorrectionMessage,
} from "./protocol";
import {
  BRUME_PLAYER_RUN_SPEED,
  BRUME_PLAYER_WALK_SPEED,
} from "./world-config";

export const WALK_SPEED_LIMIT = BRUME_PLAYER_WALK_SPEED * 1.17;
export const RUN_SPEED_LIMIT = BRUME_PLAYER_RUN_SPEED * 1.145;
export const IDLE_DRIFT_LIMIT = 0.45;
export const MAX_VALIDATION_WINDOW_SECONDS = 1;
export const POSITION_TOLERANCE = 0.38;

type MovementValidationOptions = {
  now: number;
  groundY: number;
  worldRadius: number;
  playerRadius: number;
};

type MovementValidationResult =
  | { ok: true; player: NetworkPlayer }
  | { ok: false; reason: ServerCorrectionMessage["reason"] };

function normalizeHeading(heading: number) {
  const fullTurn = Math.PI * 2;
  return ((heading + Math.PI) % fullTurn + fullTurn) % fullTurn - Math.PI;
}

function speedForState(state: PlayerMovementState) {
  if (state === "running") return RUN_SPEED_LIMIT;
  if (state === "walking") return WALK_SPEED_LIMIT;
  return 0;
}

export function validateMovement(
  current: NetworkPlayer,
  message: ClientMovementMessage,
  options: MovementValidationOptions,
): MovementValidationResult {
  if (
    !Number.isFinite(message.x) ||
    !Number.isFinite(message.z) ||
    !Number.isFinite(message.heading) ||
    !Number.isSafeInteger(message.sequence) ||
    message.sequence <= current.sequence
  ) {
    return { ok: false, reason: "invalid_payload" };
  }

  const playableRadius = options.worldRadius - options.playerRadius;
  if (message.x * message.x + message.z * message.z > playableRadius * playableRadius) {
    return { ok: false, reason: "out_of_bounds" };
  }

  const deltaSeconds = Math.min(
    Math.max((options.now - current.updatedAt) / 1000, 1 / 60),
    MAX_VALIDATION_WINDOW_SECONDS,
  );
  const distance = Math.hypot(message.x - current.x, message.z - current.z);
  const stateSpeedLimit = speedForState(message.movementState);
  const allowedDistance =
    message.movementState === "idle"
      ? IDLE_DRIFT_LIMIT
      : stateSpeedLimit * deltaSeconds + POSITION_TOLERANCE;

  if (distance > allowedDistance) {
    return { ok: false, reason: "speed_limit" };
  }

  const movementState: PlayerMovementState =
    distance < 0.012 ? "idle" : message.movementState === "running" ? "running" : "walking";

  return {
    ok: true,
    player: {
      ...current,
      x: message.x,
      y: options.groundY,
      z: message.z,
      heading: normalizeHeading(message.heading),
      movementState,
      sequence: message.sequence,
      updatedAt: options.now,
    },
  };
}
