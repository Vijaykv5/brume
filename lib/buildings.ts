export type BuildingType = "small-office" | "office-building" | "tower";

export type BuildingOption = {
  id: BuildingType;
  name: string;
  price: 2 | 3 | 4;
  priceCents: 200 | 300 | 400;
  description: string;
};

export type BuildingSubmission = {
  buildingType: BuildingType;
  companyName: string;
  domain: string;
  logoUrl?: string;
};

export type BuildingFormData = BuildingSubmission & {
  price: 2 | 3 | 4;
};

export type SavedBuilding = BuildingFormData & {
  id: string;
  priceCents: 200 | 300 | 400;
  position: [number, number, number];
  status: "active" | "hidden";
  createdAt: string;
  updatedAt: string;
};

export type BuildingValidationErrors = Partial<
  Record<"buildingType" | "companyName" | "domain" | "logoUrl", string>
>;

export type BuildingFootprint = {
  position: [number, number, number];
  radius: number;
};

export const BUILDING_OPTIONS: BuildingOption[] = [
  {
    id: "small-office",
    name: "Small Office",
    price: 2,
    priceCents: 200,
    description: "A small space for new products.",
  },
  {
    id: "office-building",
    name: "Office Building",
    price: 3,
    priceCents: 300,
    description: "More visibility for growing companies.",
  },
  {
    id: "tower",
    name: "Tower",
    price: 4,
    priceCents: 400,
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
];

export const EXISTING_BUILDING_FOOTPRINTS: BuildingFootprint[] = [
  { position: [-7.2, 0.45, -1.1], radius: 4.4 },
  { position: [2.2, 0.56, -7.1], radius: 6.4 },
  { position: [15.4, 0.56, 3.7], radius: 6.9 },
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
  return 4.4;
}

export function getBuildingGroundY(buildingType: BuildingType) {
  return buildingType === "small-office" ? 0.45 : 0.56;
}

export function getAddedBuildingPosition(
  buildingType: BuildingType,
  existingBuildings: Array<{ buildingType: BuildingType; position: [number, number, number] }>,
): [number, number, number] {
  const buildingRadius = getBuildingRadius(buildingType);
  const existingFootprints = [
    ...EXISTING_BUILDING_FOOTPRINTS,
    ...existingBuildings.map((building) => ({
      position: building.position,
      radius: getBuildingRadius(building.buildingType),
    })),
  ];
  const shuffledSpots = [...ADDED_BUILDING_SPOTS].sort(() => Math.random() - 0.5);
  const chosenSpot =
    shuffledSpots.find(([x, z]) =>
      existingFootprints.every((footprint) => {
        const distance = Math.hypot(x - footprint.position[0], z - footprint.position[2]);
        return distance >= buildingRadius + footprint.radius + 3;
      }),
    ) ?? shuffledSpots[0];

  return [chosenSpot[0], getBuildingGroundY(buildingType), chosenSpot[1]];
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
