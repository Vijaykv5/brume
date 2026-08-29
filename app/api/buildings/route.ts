import { NextResponse } from "next/server";
import {
  getAddedBuildingPosition,
  getBuildingOption,
  isBuildingType,
  type BuildingType,
  type SavedBuilding,
  validateBuildingSubmission,
} from "@/lib/buildings";
import {
  bumpBuildingsCacheVersion,
  getCachedBuildings,
  setCachedBuildings,
} from "@/lib/buildings-cache";
import { ensureBuildingsTable, sql } from "@/lib/db";

type BuildingRow = {
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

function rowToBuilding(row: BuildingRow): SavedBuilding {
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

async function loadActiveBuildings() {
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

  return (rows as BuildingRow[]).map(rowToBuilding);
}

function normalizeSavedBuilding(building: SavedBuilding): SavedBuilding {
  return {
    ...building,
    clickCount: Number(building.clickCount ?? 0),
  };
}

export async function GET() {
  try {
    const cachedBuildings = await getCachedBuildings();

    if (cachedBuildings) {
      const buildings = cachedBuildings.map(normalizeSavedBuilding);
      return NextResponse.json(
        { buildings },
        { headers: { "x-buildings-source": "redis" } },
      );
    }

    const buildings = await loadActiveBuildings();
    await setCachedBuildings(buildings);

    return NextResponse.json(
      { buildings },
      { headers: { "x-buildings-source": "postgres" } },
    );
  } catch (error) {
    console.error("Failed to load buildings", error);
    return NextResponse.json(
      { error: "Could not load buildings right now." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    await ensureBuildingsTable();
    const body = await request.json();
    const parsed = validateBuildingSubmission(body);

    if (!parsed.ok) {
      return NextResponse.json({ errors: parsed.errors }, { status: 400 });
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
    const position = getAddedBuildingPosition(parsed.data.buildingType, existingBuildings);
    const id = crypto.randomUUID();
    const rows = await sql`
      insert into buildings (
        id,
        building_type,
        price_cents,
        company_name,
        domain,
        logo_url,
        position_x,
        position_y,
        position_z
      ) values (
        ${id},
        ${parsed.data.buildingType},
        ${parsed.option.priceCents},
        ${parsed.data.companyName},
        ${parsed.data.domain},
        ${parsed.data.logoUrl ?? null},
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
    const activeBuildings = await loadActiveBuildings();
    await setCachedBuildings(activeBuildings);
    await bumpBuildingsCacheVersion();

    return NextResponse.json(
      { building },
      {
        status: 201,
        headers: { "x-buildings-cache": "refreshed" },
      },
    );
  } catch (error) {
    console.error("Failed to save building", error);
    return NextResponse.json(
      { error: "Could not save this building right now." },
      { status: 500 },
    );
  }
}
