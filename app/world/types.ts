import type { MutableRefObject } from "react";
import type * as THREE from "three";

export type Vector3Tuple = [number, number, number];
export type Vector2Tuple = [number, number];

export type PlayerInputState = {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  run: boolean;
};

export type PlayerMotionState = {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  heading: number;
  moving: boolean;
  running: boolean;
};

export type PlayerMotionRef = MutableRefObject<PlayerMotionState>;

export type CircleCollider = {
  id: string;
  shape: "circle";
  position: Vector2Tuple;
  radius: number;
};

export type BoxCollider = {
  id: string;
  shape: "box";
  position: Vector2Tuple;
  halfSize: Vector2Tuple;
};

export type WorldCollider = CircleCollider | BoxCollider;

export type WorldInteractionKind = "billboard" | "building" | "future";

export type WorldInteraction = {
  id: string;
  kind: WorldInteractionKind;
  title: string;
  subtitle: string;
  description: string;
  position: Vector3Tuple;
  range: number;
  websiteUrl?: string;
  imageUrl?: string;
  buildingId?: string;
};

export type ExampleBillboard = WorldInteraction & {
  kind: "billboard";
  imageUrl: string;
  rotationY: number;
};
