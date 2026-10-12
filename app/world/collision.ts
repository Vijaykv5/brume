import * as THREE from "three";
import type { WorldCollider } from "./types";

function intersectsCollider(
  x: number,
  z: number,
  playerRadius: number,
  collider: WorldCollider,
) {
  if (collider.shape === "circle") {
    const deltaX = x - collider.position[0];
    const deltaZ = z - collider.position[1];
    const minimumDistance = playerRadius + collider.radius;

    return deltaX * deltaX + deltaZ * deltaZ < minimumDistance * minimumDistance;
  }

  const closestX = THREE.MathUtils.clamp(
    x,
    collider.position[0] - collider.halfSize[0],
    collider.position[0] + collider.halfSize[0],
  );
  const closestZ = THREE.MathUtils.clamp(
    z,
    collider.position[1] - collider.halfSize[1],
    collider.position[1] + collider.halfSize[1],
  );
  const deltaX = x - closestX;
  const deltaZ = z - closestZ;

  return deltaX * deltaX + deltaZ * deltaZ < playerRadius * playerRadius;
}

function canOccupy(
  x: number,
  z: number,
  colliders: WorldCollider[],
  playerRadius: number,
  worldRadius: number,
) {
  const playableRadius = worldRadius - playerRadius;
  if (x * x + z * z > playableRadius * playableRadius) return false;

  return colliders.every(
    (collider) => !intersectsCollider(x, z, playerRadius, collider),
  );
}

export function resolvePlayerMovement({
  current,
  desired,
  colliders,
  playerRadius,
  worldRadius,
}: {
  current: THREE.Vector3;
  desired: THREE.Vector3;
  colliders: WorldCollider[];
  playerRadius: number;
  worldRadius: number;
}) {
  const resolved = current.clone();

  if (
    canOccupy(
      desired.x,
      resolved.z,
      colliders,
      playerRadius,
      worldRadius,
    )
  ) {
    resolved.x = desired.x;
  }

  if (
    canOccupy(
      resolved.x,
      desired.z,
      colliders,
      playerRadius,
      worldRadius,
    )
  ) {
    resolved.z = desired.z;
  }

  return resolved;
}
