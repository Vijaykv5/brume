import type {
  ExampleBillboard,
  Vector3Tuple,
  WorldCollider,
} from "./types";
import {
  BRUME_PLAYER_SPAWN,
  BRUME_WORLD_GROUND_Y,
  BRUME_WORLD_RADIUS,
} from "@/multiplayer/world-config";

export type TreePlacement = {
  position: Vector3Tuple;
  scale: number;
  rotation: number;
  leaf: string;
  leafAccent: string;
};

export type RockPlacement = {
  position: Vector3Tuple;
  scale: number;
};

export type TrunkPlacement = {
  position: Vector3Tuple;
  rotation: number;
  scale: number;
};

export const WORLD_GROUND_Y = BRUME_WORLD_GROUND_Y;
export const PLAYER_SPAWN: Vector3Tuple = [...BRUME_PLAYER_SPAWN];
export const PLAYER_WORLD_RADIUS = BRUME_WORLD_RADIUS;

export const TREE_PLACEMENTS: TreePlacement[] = [
  { position: [-24, 0.46, -18], scale: 1.36, rotation: -0.4, leaf: "#86bf61", leafAccent: "#c9e8a5" },
  { position: [-17, 0.46, 16], scale: 0.96, rotation: 0.65, leaf: "#5f9e48", leafAccent: "#b9df8d" },
  { position: [12, 0.46, -20], scale: 1.16, rotation: -0.55, leaf: "#72ad50", leafAccent: "#d2efad" },
  { position: [24, 0.46, 15], scale: 1.48, rotation: -0.85, leaf: "#6faf4d", leafAccent: "#d8f0b4" },
  { position: [34, 0.46, -8], scale: 0.88, rotation: 0.35, leaf: "#5f9b46", leafAccent: "#bae18d" },
  { position: [-35, 0.46, 4], scale: 1.08, rotation: -0.35, leaf: "#6cae4e", leafAccent: "#d6f1af" },
  { position: [-47, 0.46, -24], scale: 0.92, rotation: 0.45, leaf: "#76b456", leafAccent: "#c8eaa1" },
  { position: [-42, 0.46, 27], scale: 1.24, rotation: -0.95, leaf: "#5f9e48", leafAccent: "#c1e596" },
  { position: [-8, 0.46, 35], scale: 0.86, rotation: 0.2, leaf: "#82bd5f", leafAccent: "#d4efb0" },
  { position: [18, 0.46, 36], scale: 1.14, rotation: 1.05, leaf: "#6daa4e", leafAccent: "#cdeba5" },
  { position: [43, 0.46, 24], scale: 0.98, rotation: -0.25, leaf: "#7eb95d", leafAccent: "#d7f1b6" },
  { position: [49, 0.46, -22], scale: 1.32, rotation: 0.72, leaf: "#679f4a", leafAccent: "#c5e89b" },
  { position: [6, 0.46, -38], scale: 0.8, rotation: -0.7, leaf: "#8ac466", leafAccent: "#dcf3bb" },
  { position: [-58, 0.46, 6], scale: 1.42, rotation: 0.38, leaf: "#6ea94f", leafAccent: "#c9eaa2" },
  { position: [64, 0.46, 4], scale: 1.08, rotation: -1.15, leaf: "#7fba5e", leafAccent: "#d5efb1" },
  { position: [-54, 0.46, -42], scale: 1.18, rotation: 0.88, leaf: "#5f9c46", leafAccent: "#bde28f" },
  { position: [50, 0.46, 45], scale: 1.34, rotation: -0.42, leaf: "#74b455", leafAccent: "#d8f2b4" },
  { position: [-12, 0.46, 62], scale: 0.98, rotation: 1.24, leaf: "#88c265", leafAccent: "#ddf3be" },
  { position: [30, 0.46, -56], scale: 1.52, rotation: -0.96, leaf: "#689f4b", leafAccent: "#c6e79c" },
];

export const ROCK_PLACEMENTS: RockPlacement[] = [
  { position: [16, 0.12, -13], scale: 0.5 },
  { position: [18.2, 0.1, -15], scale: 0.32 },
  { position: [-21, 0.1, 9.2], scale: 0.42 },
  { position: [20.5, 0.11, 11.8], scale: 0.58 },
  { position: [-15.5, 0.1, 16], scale: 0.34 },
  { position: [27, 0.1, 8.8], scale: 0.46 },
  { position: [-45, 0.1, -18], scale: 0.5 },
  { position: [-38, 0.09, 30], scale: 0.34 },
  { position: [-4, 0.1, 39], scale: 0.42 },
  { position: [25, 0.09, 34], scale: 0.3 },
  { position: [46, 0.12, 19], scale: 0.62 },
  { position: [53, 0.09, -26], scale: 0.36 },
  { position: [10, 0.1, -42], scale: 0.44 },
  { position: [-30, 0.1, -34], scale: 0.28 },
];

export const EDGE_ROCK_PLACEMENTS: RockPlacement[] = [
  { position: [-7.9, 0.58, 2.2], scale: 0.75 },
  { position: [-3.4, 0.56, -5.2], scale: 0.56 },
  { position: [3.6, 0.56, 5.4], scale: 0.64 },
  { position: [8.1, 0.56, 1.4], scale: 0.52 },
];

export const TRUNK_PLACEMENTS: TrunkPlacement[] = [
  { position: [18, 0.22, -5], rotation: 0.55, scale: 1.1 },
  { position: [-19, 0.2, -10], rotation: -0.8, scale: 0.85 },
  { position: [27, 0.2, 8], rotation: 1.1, scale: 0.9 },
  { position: [-27, 0.2, 4], rotation: -0.2, scale: 1.05 },
  { position: [-44, 0.2, 22], rotation: 0.4, scale: 0.92 },
  { position: [-24, 0.2, -31], rotation: -1.15, scale: 0.78 },
  { position: [34, 0.2, 30], rotation: 0.95, scale: 0.88 },
  { position: [48, 0.2, -18], rotation: -0.55, scale: 1 },
  { position: [4, 0.2, 42], rotation: 1.35, scale: 0.72 },
];

export const EXAMPLE_BILLBOARDS: ExampleBillboard[] = [
  {
    id: "billboard:luma-relay",
    kind: "billboard",
    title: "Luma Relay",
    subtitle: "Realtime creator tools",
    description: "A sample project space showing how teams can introduce what they are building inside BRUME World.",
    websiteUrl: "https://example.com/?project=luma-relay",
    imageUrl: "/billboards/luma-relay.svg",
    position: [-20, WORLD_GROUND_Y, 8],
    range: 4.8,
    rotationY: 0.22,
  },
  {
    id: "billboard:moss-market",
    kind: "billboard",
    title: "Moss Market",
    subtitle: "Digital goods, naturally",
    description: "A data-driven billboard ready to be replaced by live campaign content in a future release.",
    websiteUrl: "https://example.com/?project=moss-market",
    imageUrl: "/billboards/moss-market.svg",
    position: [0, WORLD_GROUND_Y, -18],
    range: 4.8,
    rotationY: -0.12,
  },
  {
    id: "billboard:cloud-club",
    kind: "billboard",
    title: "Cloud Club",
    subtitle: "A social space above the noise",
    description: "An example advertising placement with a reusable proximity interaction and website action.",
    websiteUrl: "https://example.com/?project=cloud-club",
    imageUrl: "/billboards/cloud-club.svg",
    position: [32, WORLD_GROUND_Y, 2],
    range: 4.8,
    rotationY: -0.34,
  },
];

export const STATIC_WORLD_COLLIDERS: WorldCollider[] = [
  ...TREE_PLACEMENTS.map((tree, index) => ({
    id: `tree:${index}`,
    shape: "circle" as const,
    position: [tree.position[0], tree.position[2]] as [number, number],
    radius: Math.max(0.58, tree.scale * 0.62),
  })),
  ...ROCK_PLACEMENTS.map((rock, index) => ({
    id: `rock:${index}`,
    shape: "circle" as const,
    position: [rock.position[0], rock.position[2]] as [number, number],
    radius: Math.max(0.34, rock.scale * 0.62),
  })),
  ...EDGE_ROCK_PLACEMENTS.map((rock, index) => ({
    id: `edge-rock:${index}`,
    shape: "circle" as const,
    position: [rock.position[0], rock.position[2]] as [number, number],
    radius: Math.max(0.34, rock.scale * 0.62),
  })),
  ...TRUNK_PLACEMENTS.map((trunk, index) => ({
    id: `trunk:${index}`,
    shape: "circle" as const,
    position: [trunk.position[0], trunk.position[2]] as [number, number],
    radius: trunk.scale * 1.12,
  })),
  {
    id: "pond",
    shape: "box",
    position: [-33, -20],
    halfSize: [5.2, 3.5],
  },
  ...EXAMPLE_BILLBOARDS.map((billboard) => ({
    id: `collider:${billboard.id}`,
    shape: "box" as const,
    position: [billboard.position[0], billboard.position[2]] as [number, number],
    halfSize: [2.9, 1.15] as [number, number],
  })),
];
