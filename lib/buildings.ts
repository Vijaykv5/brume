export type BuildingType = "billboard" | "small-office" | "office-building" | "tower";

export type BuildingOption = {
  id: BuildingType;
  name: string;
  price: 2 | 5 | 7 | 10;
  priceCents: 200 | 500 | 700 | 1000;
  description: string;
};

export type BuildingSubmission = {
  buildingType: BuildingType;
  companyName: string;
  domain: string;
  logoUrl?: string;
};

export type BuildingFormData = BuildingSubmission & {
  price: 2 | 5 | 7 | 10;
};

export type SavedBuilding = BuildingFormData & {
  id: string;
  buildingOrderId?: string | null;
  priceCents: 200 | 500 | 700 | 1000;
  position: [number, number, number];
  clickCount: number;
  status: "active" | "hidden";
  createdAt: string;
  updatedAt: string;
};

export type BuildingValidationErrors = Partial<
  Record<"buildingType" | "companyName" | "domain" | "logoUrl", string>
>;

export type BuildingFootprint = {
  position: [number, number, number];
  width: number;
  depth: number;
};

export const BUILDING_OPTIONS: BuildingOption[] = [
  {
    id: "billboard",
    name: "Billboard",
    price: 2,
    priceCents: 200,
    description: "A small sign spot for simple visibility.",
  },
  {
    id: "small-office",
    name: "Small Office",
    price: 5,
    priceCents: 500,
    description: "A small space for new products.",
  },
  {
    id: "office-building",
    name: "Office Building",
    price: 7,
    priceCents: 700,
    description: "More visibility for growing companies.",
  },
  {
    id: "tower",
    name: "Tower",
    price: 10,
    priceCents: 1000,
    description: "The largest space with maximum visibility.",
  },
];

export const ADDED_BUILDING_SPOTS: [number, number][] = [
  [-18, -10],
  [-15, 12],
  [-3, 16],
  [9, 14],
  [21, -9],
  [28, 9],
  [5, -22],
  [-24, 2],
  [17, 21],
  [-31, -16],
  [35, -20],
  [-9, -26],
  [-37, 11],
  [-27, 25],
  [-14, 31],
  [3, 31],
  [22, 31],
  [39, 19],
  [45, -5],
  [27, -26],
  [11, -34],
  [-13, -38],
  [-34, -29],
  [-46, -7],
];

export const EXISTING_BUILDING_FOOTPRINTS: BuildingFootprint[] = [
  {
    position: [-7.2, 0.45, -1.1],
    width: 5.8,
    depth: 4.7,
  },
  {
    position: [2.2, 0.56, -7.1],
    width: 8.2,
    depth: 5.8,
  },
  {
    position: [15.4, 0.56, 3.7],
    width: 9.2,
    depth: 7.8,
  },
];

export function getBuildingOption(buildingType: BuildingType | null | undefined) {
  return BUILDING_OPTIONS.find((option) => option.id === buildingType) ?? null;
}

export function isBuildingType(value: unknown): value is BuildingType {
  return typeof value === "string" && BUILDING_OPTIONS.some((option) => option.id === value);
}

export function normalizeDomain(value: string) {
  return value
    .trim()
    .replace(/^https?:\/\//i, "")
    .split("/")[0]
    .replace(/\.+$/g, "")
    .toLowerCase();
}

export function isValidDomain(domain: string) {
  return /^(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/.test(domain);
}

export function getBuildingRadius(buildingType: BuildingType) {
  if (buildingType === "tower") return 7.2;
  if (buildingType === "office-building") return 6.5;
  if (buildingType === "billboard") return 2.6;
  return 4.4;
}

export function getBuildingFootprintSize(buildingType: BuildingType) {
  if (buildingType === "tower") return { width: 9.2, depth: 7.8 };
  if (buildingType === "office-building") return { width: 8.2, depth: 5.8 };
  if (buildingType === "billboard") return { width: 5.2, depth: 3.6 };
  return { width: 5.8, depth: 4.7 };
}

export function getBuildingGroundY(buildingType: BuildingType) {
  if (buildingType === "billboard") return 0.48;
  return buildingType === "small-office" ? 0.45 : 0.56;
}

export function getAddedBuildingPosition(
  buildingType: BuildingType,
  existingBuildings: Array<{ buildingType: BuildingType; position: [number, number, number] }>,
): [number, number, number] {
  const existingFootprints = [
    ...EXISTING_BUILDING_FOOTPRINTS,
    ...existingBuildings.map((building) => ({
      position: building.position,
      ...getBuildingFootprintSize(building.buildingType),
    })),
  ];
  const shuffledSpots = [...ADDED_BUILDING_SPOTS].sort(() => Math.random() - 0.5);
  const chosenSpot =
    shuffledSpots.find(([x, z]) =>
      canPlaceBuildingAt([x, getBuildingGroundY(buildingType), z], buildingType, existingFootprints),
    ) ?? findOpenBuildingSpot(buildingType, existingFootprints);

  return [chosenSpot[0], getBuildingGroundY(buildingType), chosenSpot[1]];
}

function footprintsOverlap(
  first: BuildingFootprint,
  second: BuildingFootprint,
  padding = 3.5,
) {
  const firstHalfWidth = first.width / 2;
  const secondHalfWidth = second.width / 2;
  const firstHalfDepth = first.depth / 2;
  const secondHalfDepth = second.depth / 2;
  const xDistance = Math.abs(first.position[0] - second.position[0]);
  const zDistance = Math.abs(first.position[2] - second.position[2]);

  return (
    xDistance < firstHalfWidth + secondHalfWidth + padding &&
    zDistance < firstHalfDepth + secondHalfDepth + padding
  );
}

export function canPlaceBuildingAt(
  position: [number, number, number],
  buildingType: BuildingType,
  existingFootprints: BuildingFootprint[],
) {
  const footprint = {
    position,
    ...getBuildingFootprintSize(buildingType),
  };

  return existingFootprints.every((existingFootprint) =>
    !footprintsOverlap(footprint, existingFootprint),
  );
}

function findOpenBuildingSpot(
  buildingType: BuildingType,
  existingFootprints: BuildingFootprint[],
) {
  const searchRings = [36, 44, 52, 60, 68] as const;

  for (const radius of searchRings) {
    const steps = Math.max(16, Math.round(radius / 3));

    for (let step = 0; step < steps; step += 1) {
      const angle = (step / steps) * Math.PI * 2;
      const x = Math.round(Math.cos(angle) * radius);
      const z = Math.round(Math.sin(angle) * radius);
      const position: [number, number, number] = [x, getBuildingGroundY(buildingType), z];

      if (canPlaceBuildingAt(position, buildingType, existingFootprints)) {
        return [x, z] as [number, number];
      }
    }
  }

  return [0, 0] as [number, number];
}

export function getNonOverlappingBuildingPlacements<
  T extends { buildingType: BuildingType; position: [number, number, number] },
>(buildings: T[]) {
  const reservedFootprints = [...EXISTING_BUILDING_FOOTPRINTS];

  return buildings.map((building) => {
    const currentPosition: [number, number, number] = [
      building.position[0],
      getBuildingGroundY(building.buildingType),
      building.position[2],
    ];
    const position = canPlaceBuildingAt(
      currentPosition,
      building.buildingType,
      reservedFootprints,
    )
      ? currentPosition
      : (() => {
          const chosenSpot =
            ADDED_BUILDING_SPOTS.find(([x, z]) =>
              canPlaceBuildingAt(
                [x, getBuildingGroundY(building.buildingType), z],
                building.buildingType,
                reservedFootprints,
              ),
            ) ?? findOpenBuildingSpot(building.buildingType, reservedFootprints);

          return [
            chosenSpot[0],
            getBuildingGroundY(building.buildingType),
            chosenSpot[1],
          ] as [number, number, number];
        })();

    reservedFootprints.push({
      position,
      ...getBuildingFootprintSize(building.buildingType),
    });

    return {
      ...building,
      position,
    };
  });
}

export function validateBuildingSubmission(input: unknown):
  | { ok: true; data: BuildingFormData; option: BuildingOption }
  | { ok: false; errors: BuildingValidationErrors } {
  const raw = typeof input === "object" && input !== null ? input : {};
  const data = raw as Partial<Record<keyof BuildingSubmission, unknown>>;
  const errors: BuildingValidationErrors = {};
  const companyName = typeof data.companyName === "string" ? data.companyName.trim() : "";
  const domain = typeof data.domain === "string" ? normalizeDomain(data.domain) : "";
  const logoUrl = typeof data.logoUrl === "string" ? data.logoUrl.trim() : "";
  const buildingType = data.buildingType;

  if (!isBuildingType(buildingType)) {
    errors.buildingType = "Select a valid building type.";
  }

  if (!companyName) errors.companyName = "Company name is required.";

  if (!domain) {
    errors.domain = "Domain is required.";
  } else if (!isValidDomain(domain)) {
    errors.domain = "Enter a valid domain, like acme.com.";
  }

  if (logoUrl) {
    try {
      const parsedUrl = new URL(logoUrl);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        errors.logoUrl = "Logo URL must start with http:// or https://.";
      }
    } catch {
      errors.logoUrl = "Enter a valid logo URL.";
    }
  }

  if (Object.keys(errors).length > 0 || !isBuildingType(buildingType)) {
    return { ok: false, errors };
  }

  const option = getBuildingOption(buildingType);
  if (!option) return { ok: false, errors: { buildingType: "Select a valid building type." } };

  return {
    ok: true,
    option,
    data: {
      buildingType,
      price: option.price,
      companyName,
      domain,
      ...(logoUrl ? { logoUrl } : {}),
    },
  };
}
