import {
  getAddedBuildingPosition,
  getBuildingOption,
  getNonOverlappingBuildingPlacements,
  isBuildingType,
  type BuildingType,
  type BuildingSubmission,
  type SavedBuilding,
} from "@/lib/buildings";
import {
  bumpBuildingsCacheVersion,
  setCachedBuildings,
} from "@/lib/buildings-cache";
import { ensureBuildingsTable, sql } from "@/lib/db";

export type BuildingRow = {
  id: string;
  building_type: string;
  price_cents: number;
  company_name: string;
  domain: string;
  logo_url: string | null;
  position_x: string | number;
  position_y: string | number;
  position_z: string | number;
  click_count?: string | number | null;
  status: "active" | "hidden";
  created_at: string | Date;
  updated_at: string | Date;
};

export type PaidBuildingInput = BuildingSubmission & {
  buildingType: BuildingType;
  priceCents: 200 | 500 | 700 | 1000;
  orderId: string;
  dodoPaymentId: string;
  dodoCheckoutId?: string | null;
};

export function rowToBuilding(row: BuildingRow): SavedBuilding {
  const buildingType = isBuildingType(row.building_type) ? row.building_type : "small-office";
  const option = getBuildingOption(buildingType);

  return {
    id: row.id,
    buildingType,
    price: option?.price ?? 2,
    priceCents: option?.priceCents ?? 200,
    companyName: row.company_name,
    domain: row.domain,
    ...(row.logo_url ? { logoUrl: row.logo_url } : {}),
    position: [
      Number(row.position_x),
      Number(row.position_y),
      Number(row.position_z),
    ],
    clickCount: Number(row.click_count ?? 0),
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function loadActiveBuildings() {
  await ensureBuildingsTable();
  const rows = await sql`
    select
      id,
      building_type,
      price_cents,
      company_name,
      domain,
      logo_url,
      position_x,
      position_y,
      position_z,
      click_count,
      status,
      created_at,
      updated_at
    from buildings
    where status = 'active'
    order by created_at asc
  `;

  const buildings = (rows as BuildingRow[]).map(rowToBuilding);
  const repairedBuildings = getNonOverlappingBuildingPlacements(buildings);
  const movedBuildings = repairedBuildings.filter((building, index) => {
    const originalPosition = buildings[index].position;

    return building.position.some((value, positionIndex) => value !== originalPosition[positionIndex]);
  });

  if (movedBuildings.length > 0) {
    await Promise.all(
      movedBuildings.map((building) =>
        sql`
          update buildings
          set position_x = ${building.position[0]},
              position_y = ${building.position[1]},
              position_z = ${building.position[2]},
              updated_at = now()
          where id = ${building.id}
        `,
      ),
    );
  }

  return repairedBuildings;
}

export async function refreshBuildingsCache() {
  const activeBuildings = await loadActiveBuildings();
  await setCachedBuildings(activeBuildings);
  await bumpBuildingsCacheVersion();
  return activeBuildings;
}

export async function createPaidBuilding(input: PaidBuildingInput) {
  await ensureBuildingsTable();

  const existingBuildingRows = await sql`
    select
      id,
      building_type,
      price_cents,
      company_name,
      domain,
      logo_url,
      position_x,
      position_y,
      position_z,
      click_count,
      status,
      created_at,
      updated_at
    from buildings
    where building_order_id = ${input.orderId}
    limit 1
  `;

  if ((existingBuildingRows as BuildingRow[]).length > 0) {
    return rowToBuilding((existingBuildingRows as BuildingRow[])[0]);
  }

  const existingRows = await sql`
    select building_type, position_x, position_y, position_z
    from buildings
    where status = 'active'
  `;
  const existingBuildings = (existingRows as Array<{
    building_type: string;
    position_x: string | number;
    position_y: string | number;
    position_z: string | number;
  }>)
    .filter((row): row is typeof row & { building_type: BuildingType } =>
      isBuildingType(row.building_type),
    )
    .map((row) => ({
      buildingType: row.building_type,
      position: [
        Number(row.position_x),
        Number(row.position_y),
        Number(row.position_z),
      ] as [number, number, number],
    }));
  const position = getAddedBuildingPosition(input.buildingType, existingBuildings);
  const id = crypto.randomUUID();
  const rows = await sql`
    insert into buildings (
      id,
      building_type,
      price_cents,
      company_name,
      domain,
      logo_url,
      dodo_payment_id,
      dodo_checkout_id,
      building_order_id,
      paid_at,
      position_x,
      position_y,
      position_z
    ) values (
      ${id},
      ${input.buildingType},
      ${input.priceCents},
      ${input.companyName},
      ${input.domain},
      ${input.logoUrl ?? null},
      ${input.dodoPaymentId},
      ${input.dodoCheckoutId ?? null},
      ${input.orderId},
      now(),
      ${position[0]},
      ${position[1]},
      ${position[2]}
    )
    returning
      id,
      building_type,
      price_cents,
      company_name,
      domain,
      logo_url,
      position_x,
      position_y,
      position_z,
      click_count,
      status,
      created_at,
      updated_at
  `;

  const building = rowToBuilding((rows as BuildingRow[])[0]);
  await refreshBuildingsCache();
  return building;
}
